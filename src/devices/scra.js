import ScraEmvParser from '../parsers/scraEmvParser';
import { 
    commandNotSent,
    responseNotReceived,
    deviceNotFound,
    deviceNotOpen,
    gattServerNotConnected
} from '../errorHandler/errConstants';
import { 
    closeSuccess, 
    successCode, 
    openSuccess 
} from '../utils/constants';

class Scra extends ScraEmvParser {
    constructor(device, callBacks) {
        super(device, callBacks);
        this.transactionCallback = callBacks.transactionCallback || callBacks;
        this.displayCallback = callBacks.displayCallback;
        this.transactionStatusCallback = callBacks.transactionStatusCallback;
        this.userSelectionCallback = callBacks.userSelectionCallback;
        
        this.maxBlockId = null;
        this.initialNotification = null;
        this.rawData = {};

        this.dataReadStatusCharacteristic = null;
        this.dataReadyCharacteristic = null;
        this.commandCharacteristic = null;
        this.cardDataListener = null;
        
        this.cardDataNotification ="0508e6f8-ad82-898f-f843-e3410cb60201";
        this.commandCharId = '0508e6f8-ad82-898f-f843-e3410cb60200';
        this.dataReadyId = "0508e6f8-ad82-898f-f843-e3410cb60202";
        this.dataReadStatusId = "0508e6f8-ad82-898f-f843-e3410cb60203";

        this.emvOptions = Object.freeze({
            'normal': 0x00,
            'bypasspin': 0x01,
            'forceonline': 0x02,
            'quickchip': 0x80,
            'pinbypassquickchip': 0x81,
            'forceonlinequickchip': 0x82
        });

        this.resultCodes = Object.freeze({
            '0000': "Success",
            '038B': "Invalid Selection Status",
            '038C': 'Invalid Selection Result',
            '038D': "Failure, no transaction currently in progress",
            '038F': "Failure, transaction already in progress"
        });

        this.emvCommandBase = [0x49, 0x19, 0x00, 0x00, 0x03, 0x00, 0x00, 0x13];

        this.cancelEmvCommand = Uint8Array.of(
            0x49, 0x06, 0x00, 0x00, 0x03, 0x04, 0x00, 0x00
        );
    }

    getCardServiceBase = optionalIndex => new Promise( (resolve, reject) => (!this.device) ?
        reject( this.buildDeviceErr(deviceNotFound))
        :
        this.connectAndCache(optionalIndex)
            .then( service =>
                service.getCharacteristic(this.cardDataNotification)
            ).then(characteristic => {
                this.logDeviceState(`[GATT NOTIFICATIONS]: Request to cache characteristics, start notifications, and attach listeners. || ${new Date()}`);
                
                return characteristic.startNotifications()
            }).then(characteristic => {
                characteristic.removeEventListener('characteristicvaluechanged', this.cardDataHandler);
                characteristic.addEventListener('characteristicvaluechanged', this.cardDataHandler);
                
                this.cardDataListener = characteristic;
                return Promise.resolve();
            }).then( 
                () => this.cardService.getCharacteristic(this.commandCharId)
            ).then(characteristic => {
                this.commandCharacteristic = characteristic;

                //If this library is being used in a web application
                //Make sure the device disconnects properly upon window unload.
                if (window) {
                    window.removeEventListener('beforeunload', this.onDestroyHandler);
                    window.addEventListener('beforeunload', this.onDestroyHandler);
                }

                return Promise.resolve();
            }).then(
                () => this.cardService.getCharacteristic(this.dataReadyId)
            ).then( characteristic => characteristic.startNotifications()
            ).then( characteristic => {
                characteristic.removeEventListener('characteristicvaluechanged', this.dataReadyHandler);
                characteristic.addEventListener('characteristicvaluechanged', this.dataReadyHandler);

                this.dataReadyCharacteristic = characteristic;
                return Promise.resolve();
            }).then(
                () => this.cardService.getCharacteristic(this.dataReadStatusId)
            ).then( characteristic => {
                this.dataReadStatusCharacteristic = characteristic;
                this.logDeviceState(`[GATT NOTIFICATIONS]: Success! Cached characteristics, started notifications, and attached listeners. || ${new Date()}`)
                return resolve({
                    code: successCode,
                    message: openSuccess
                });
            }).catch(err => reject( err ))
    );

    dataReadyHandler = event => {
        let eventValue = event.target.value;
        let formattedEventValue = this.readByteArray(eventValue);

        this.logDeviceState(`dataReady listener: ${this.convertArrayToHexString(formattedEventValue)}`);

        if (this.commandSent) {
            this.commandRespAvailable = true;
            this.commandSent = false;
        }
    }

    cardDataHandler = event => {
        let eventValue = event.target.value;

        //If the first position in the array === 255, card data notifications have finished.
        if (eventValue.getUint8(0) !== 255) {
            let notificationArray = this.readByteArray(eventValue);

            this.rawData = {
                ...this.rawData,
                [notificationArray[0]]: notificationArray.slice(1)
            }
        }
        else {
            //Keep track of the amount of notifications sent from device.
            this.maxBlockId = eventValue.getUint8(1);

            if (this.checkNotificationLength()) {
                this.initialNotification = (this.rleFormats[ this.rawData[0][0] ]) ? this.decodeRLE(this.rawData[0]) : this.rawData[0];
                this.logDeviceState(this.rawData);
                
                //Check if swipe data
                if (this.initialNotification[0] === 0 || this.initialNotification[0] === 1) {
                    return this.returnToUser(this.transactionCallback)( this.parseHidData( this.buildInitialDataArray(true) ) );
                }
                else {
                    let notificationId = this.convertArrayToHexString([
                        this.initialNotification[7],
                        this.initialNotification[8]
                    ]);
                    
                    return this.findNotificationType(notificationId)
                }
            } 
            else this.sendErrToCallback( this.throwLenErr() );
        }
    }

    findNotificationType = notificationId => {
        let builtNotification = this.buildInitialDataArray(true);

        switch(notificationId) {
            case "0300":
                this.logDeviceState('==Transaction Status==');
                return this.returnToUser(this.transactionStatusCallback)(this.parseTransactionStatus( builtNotification ));
            case "0301":
                this.logDeviceState("==Display Message Request==");
                return this.returnToUser(this.displayCallback)({
                    displayMessage: this.bufferToUtf8( builtNotification.slice(11) )
                });
            case "0302":
                this.logDeviceState("==User Selection Request==");
                this.logDeviceState(this.convertArrayToHexString(builtNotification));
                //TODO: Further investigation warranted for this circumstance.
                return this.returnToUser(this.transactionStatusCallback)( this.parseUserSelectionRequest(buildNotification) );
                break;
            case "0303":
                this.logDeviceState("==ARQC Message==");
                return this.returnToUser(this.transactionCallback)(this.parseEmvData( builtNotification, true )) ;
            case "0304":
                this.logDeviceState('==Batch Data Message==');
                return this.returnToUser(this.transactionCallback)(this.parseEmvData( builtNotification, false ));
            default:
                this.logDeviceState(`Undocumented Notification ID: ${notificationId}`, builtNotification);
                this.logDeviceState( this.convertArrayToHexString( builtNotification ) );
        }
    }

    startTransaction = emvOptions => new Promise( (resolve, reject) => (!this.device.gatt.connected) ? 
        reject( this.buildDeviceErr(deviceNotOpen) )
        :
        this.sendCommandWithResp(
            this.buildEmvCommand( emvOptions || {} )
        ).then( value => {
            let commandResp = this.parseEmvCommandResponse(value);
            this.logDeviceState(commandResp);

        return (commandResp.code === 0) ? resolve(commandResp) :
                (commandResp.code !== 918) ? reject(this.buildDeviceErr(commandResp)) :
                    this.setDeviceDateTime()
                    .then( () => this.delayPromise(500) )
                    .then( () => resolve( this.startTransaction(emvOptions) ) )
        }).catch(err => reject( this.buildDeviceErr(err)) )
    ); 

    buildEmvCommand = ({ 
        timeout, 
        cardType, 
        transactionType, 
        cashBack, 
        currencyCode, 
        reportVerbosity,
        emvOptions,
        authorizedAmount
    }) => {
        console.log(`timeout: ${timeout} || cardType: ${cardType} || transactionType: ${transactionType} || emvOptions: ${emvOptions} || authorizedAmount: ${authorizedAmount} || cashBack: ${cashBack} || currencyCode: ${currencyCode} || reportVerbosity: ${reportVerbosity}`)
        
        let command = [ 
            ...this.emvCommandBase, 
            timeout || 0x3C, 
            (cardType) ? this.cardTypes( cardType.toLowerCase() ) : 0x03,
            (typeof(emvOptions) !== 'undefined') ? (this.emvOptions[ emvOptions.toLowerCase() ]) : 0x80
        ];

        console.log('base command: ', command);

        command = (authorizedAmount) ? 
            command.concat( this.convertNumToAmount(authorizedAmount) )
            : command.concat( [0x00, 0x00, 0x00, 0x00, 0x01, 0x00] );

        command = (transactionType) ? 
            command.concat(this.transactionTypes[ transactionType.toLowerCase() ] || 0x00) 
            : command.concat(0x00)
        
        command = (cashBack) ? command.concat( this.convertNumToAmount(cashBack) )
            : command.concat( this.newArrayPartial(0x00, 6) );

        command = (currencyCode) ? command.concat( this.currencyCode[ currencyCode.toLowerCase() ] ||  this.currencyCode['default'] )
            : command.concat( [0x08, 0x40] );

        command.push(
            (reportVerbosity) ? ( this.statusVerbosity[ reportVerbosity.toLowerCase() ] || 0x00 ) : 0x01
        );
        
        return command;
    }

    readCommandValue = () => new Promise (resolve => this.commandCharacteristic.readValue()
        .then( value => resolve( this.readByteArray(value) )));

    readBatteryLevel = () => new Promise( resolve => 
        this.sendCommandWithResp([0x45, 0x00]).then(value => resolve( value[2] ))
    );

    checkNotificationLength = () => Math.max(...Object.keys(this.rawData)) === this.maxBlockId - 1;
   
    sendCommandWithResp = writeCommand => new Promise( (resolve, reject) => {
        if (!this.commandCharacteristic) {
            return reject( this.buildDeviceErr(commandNotSent))
        }
        else {
            this.logDeviceState(`Sending command: ${this.convertArrayToHexString(writeCommand)}`);
            this.commandSent = true;

            return this.commandCharacteristic.writeValue(Uint8Array.from(writeCommand))
            .then( () => (this.commandRespAvailable) ? Promise.resolve( true ) : this.waitForDeviceResponse(15))
            .then( waitResp => {
                this.commandRespAvailable = false;
                
                return (!waitResp) ? 
                    reject( this.buildDeviceErr(responseNotReceived)) : this.readCommandValue()
            }).then(response => resolve(response)
            ).catch(err => reject( this.buildDeviceErr(err) ));
        }
    });

    returnToUser = specifiedCallback => returnObj => {
        this.initialNotification = null;
        this.maxBlockId = null;
        this.rawData = {};
        return specifiedCallback(returnObj);
    }

    buildDateTimeCommand = specificTime => {
        let dateTimeCommand = [0x49, 0x22, 0x00, 0x00, 0x03, 0x0C, 0x00, 0x1C];
        dateTimeCommand = dateTimeCommand.concat( this.newArrayPartial(0x00, 17) );
        //Format Date segment below
        const current = (specificTime instanceof Date) ? specificTime : new Date();

        //Month (zero based index, so add 1).
        dateTimeCommand.push( 
            this.castDecToHex( current.getMonth() + 1)
        );

        dateTimeCommand.push(
            this.castDecToHex( current.getDate() )
        );

        dateTimeCommand.push(
            this.castDecToHex( current.getHours() )
        );

        dateTimeCommand.push(
            this.castDecToHex( current.getMinutes() )
        );

        dateTimeCommand.push(
            this.castDecToHex( current.getSeconds() )
        );

        //Currently unused offset.  0x00 - 0x06 is valid - but is not examined.
        dateTimeCommand.push(0x00);

        //Year is based upon 2008 === 0x00.
        dateTimeCommand.push(
            this.castDecToHex( current.getFullYear() - 2008 )
        )

        //MAC - for all devices except two exceptions (see documentation) this can be padded with zeros.
        dateTimeCommand = dateTimeCommand.concat( this.newArrayPartial(0x00, 4) );
        
        return dateTimeCommand;
    }

    setDeviceDateTime = specificTime => new Promise((resolve, reject) => 
        this.sendCommandWithResp(
            this.buildDateTimeCommand(specificTime)
        ).then(resp => resolve(resp)
        ).catch(err => reject(this.buildDeviceErr(err)))
    );

    getKsn = () => new Promise( (resolve, reject) => 
        (!this.device.gatt.connected) ? reject( this.buildDeviceErr(gattServerNotConnected)) 
        : this.sendCommandWithResp([0x09, 0x00])
        .then( resp => this.convertArrayToHexString(resp.slice(2)) )
        .then(formattedValue => resolve(formattedValue))
    );

    getDeviceSn = () => new Promise(resolve => 
        this.sendCommandWithResp([0x00, 0x01, 0x03])
        .then( resp => this.bufferToUtf8(resp.slice(2)) 
        ).then(formattedValue => resolve(formattedValue))
    );

    gatherDeviceInfo = () => new Promise( (resolve, reject) => {
        let battery;
        let serialNum;

        this.readBatteryLevel()
        .then( respBattery => {
            battery = respBattery;
            return this.getDeviceSn()
        }).then( respSn => {
            serialNum = respSn;
            return resolve([ battery, serialNum ])
        }).catch(err => reject(err) )
    });

    getDeviceInfo = () => new Promise( (resolve, reject) => (!this.device.gatt.connected) ?
        reject( this.buildDeviceErr(deviceNotOpen) ) 
        : this.gatherDeviceInfo()
            .then(
                deviceInfo => resolve({
                    deviceName: this.device.name,
                    deviceType: this.deviceType,
                    batteryLevel: deviceInfo[0],
                    serialNumber: deviceInfo[1],
                    isConnected: this.device.gatt.connected
                })
            ).catch(err => reject( this.buildDeviceErr(err) ))
    );

    sendUserSelection = selectionResult => new Promise((resolve, reject) => (!this.device.gatt.connected) ? 
        reject( this.buildDeviceErr(deviceNotOpen) ) 
        : this.sendCommandWithResp([0x49, 0x08, 0x00, 0x00, 0x03, 0x02, 0x00, 0x02, 0x00, selectionResult])
            .then(resp => {
                this.logDeviceState(`[User Selection Resp]: ${this.convertArrayToHexString(resp)}`);
                
                return resolve({
                    userSelectionResponse: (this.resultCodes[ 
                        this.convertArrayToHexString( resp.slice(4, 6) ) 
                    ] || "Unknown or undocumented result code")
                });
            }).catch(err => reject( this.buildDeviceErr(err) ))
    )

    buildArpcCommand = (len, data) => ([0x49, (len + 6), 0x00, 0x00, 0x03, 0x03, 0x00, len, ...data ]);

    sendArpc = arpcResp => new Promise((resolve, reject) => this.sendArpcBase(arpcResp)
        .then(arpcCmd => this.sendCommandWithResp(arpcCmd))
        .then(resp => {
            this.logDeviceState(`[Send ARPC Resp]: ${this.convertArrayToHexString(resp)}`);
            const resultCode = (resp.length > 5) ? this.convertArrayToHexString( resp.slice(4, 6) ) : "";

            return resolve({
                sendArpcResponse: (this.resultCodes[ resultCode ] || "Unknown or undocumented result code")
            })
        }).catch(err => reject(this.buildDeviceErr(err)))
    );

    clearGattCache = () => {
        if (window)
            window.removeEventListener('beforeunload', this.onDestroyHandler);
        
        this.maxBlockId = null;
        this.initialNotification = null;
        this.rawData = {};

        this.dataReadStatusCharacteristic = null;
        this.dataReadyCharacteristic = null;
        this.commandCharacteristic = null;
        this.cardDataListener = null;
    }

    ceaseNotifications = () => new Promise( resolve => (!this.cardDataListener) ? resolve() : this.cardDataListener.stopNotifications()
        .then( () => {
            this.cardDataListener.removeEventListener('characteristicvaluechanged', this.cardDataHandler);
            return this.dataReadStatusCharacteristic.stopNotifications()
        }).then(() => {
            this.dataReadyCharacteristic.removeEventListener('characteristicvaluechanged', this.dataReadyHandler);
            return resolve()
        })
    );

    cancelTransaction = () => new Promise( (resolve, reject) => (!this.commandCharacteristic) ? 
        reject( this.buildDeviceErr(commandNotSent))
        :
        this.commandCharacteristic.writeValue(this.cancelEmvCommand)
        .then(() => resolve())
        .catch(err => reject(this.buildDeviceErr(err)))
    );

    closeDevice = () => new Promise( (resolve, reject) => 
        (!this.device.gatt.connected) ? resolve({
            code: successCode,
            message: closeSuccess
        }) 
        :
        this.ceaseNotifications().then(() => {
            this.clearGattCache();
            return this.disconnect();
        }).then(() => resolve({
            code: successCode,
            message: closeSuccess
        })).catch(err => reject( this.buildDeviceErr(err) ))
    ) 

    clearSession = () => new Promise((resolve, reject) => 
        (this.device && this.device.gatt.connected) ? 
            resolve("SCRA devices do not carry a session") 
            : reject( this.buildDeviceErr(deviceNotOpen)) )
}

export default Scra;