import ScraCmdBuilder from '../commandBuilders/scraCmdBuilder';
import { 
    commandNotSent,
    responseNotReceived,
    deviceNotFound,
    deviceNotOpen
} from '../errorHandler/errConstants';
import { 
    closeSuccess, 
    successCode, 
    openSuccess,
    magUuidPrefix
} from '../utils/constants';

class Scra extends ScraCmdBuilder {
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
        
        this.cardDataNotification =`${magUuidPrefix}201`;
        this.commandCharId = `${magUuidPrefix}200`;
        this.dataReadyId = `${magUuidPrefix}202`;
        this.dataReadStatusId = `${magUuidPrefix}203`;

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
                return this.cardService.getCharacteristic(this.commandCharId)
            }).then(characteristic => {
                this.commandCharacteristic = characteristic;
                /*
                    If this library is being used in a web application
                    Make sure the device disconnects properly upon window unload.
                */
                if (window) {
                    window.removeEventListener('beforeunload', this.onDestroyHandler);
                    window.addEventListener('beforeunload', this.onDestroyHandler);
                }

                return this.cardService.getCharacteristic(this.dataReadyId)
            }).then( characteristic => characteristic.startNotifications()
            ).then( characteristic => {
                characteristic.removeEventListener('characteristicvaluechanged', this.dataReadyHandler);
                characteristic.addEventListener('characteristicvaluechanged', this.dataReadyHandler);

                this.dataReadyCharacteristic = characteristic;
                return this.cardService.getCharacteristic(this.dataReadStatusId)
            }).then( characteristic => {
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

        this.logDeviceState(`[Data Ready Listener]: ${this.convertArrayToHexString(formattedEventValue)}`);

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
                
                //Check if swipe data
                if (this.initialNotification[0] === 0 || this.initialNotification[0] === 1) {
                    return this.returnToUser(this.transactionCallback)( this.parseHidData( this.buildInitialDataArray(true) ) );
                }
                else {
                    const notificationId = this.convertArrayToHexString([
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
                return this.returnToUser(this.userSelectionCallback)( this.parseUserSelectionRequest(buildNotification) );
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
        : this.sendCommandWithResp(
            this.buildEmvCommand( emvOptions || {} )
        ).then( value => {
            const commandResp = this.parseEmvCommandResponse(value);

            return (commandResp.code === 0) ? resolve(commandResp) :
                (commandResp.code !== 918) ? reject(this.buildDeviceErr(commandResp)) :
                    this.setDeviceDateTime()
                    .then( () => this.delayPromise(500) )
                    .then( () => resolve( this.startTransaction(emvOptions) ) )
        }).catch(err => reject( this.buildDeviceErr(err)) )
    ); 

    readCommandValue = () => new Promise (resolve => this.commandCharacteristic.readValue()
        .then( value => resolve( this.readByteArray(value) )));

    checkNotificationLength = () => Math.max(...Object.keys(this.rawData)) === this.maxBlockId - 1;
   
    sendCommandWithResp = writeCommand => new Promise( (resolve, reject) => {
        if (!this.commandCharacteristic) {
            return reject( this.buildDeviceErr(commandNotSent))
        }
        else {
            writeCommand = (typeof(writeCommand) === 'string') ? this.hexToBytes(writeCommand) : writeCommand;
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

    setDeviceDateTime = specificTime => new Promise((resolve, reject) => (!this.device.gatt.connected) ?
        reject(deviceNotOpen)
        : this.sendCommandWithResp(
            this.buildDateTimeCommand(specificTime)
        ).then(resp => resolve( this.parseResultCode(resp) )
        ).catch(err => reject(this.buildDeviceErr(err)))
    );

    readBatteryLevel = () => new Promise( resolve => 
        this.sendCommandWithResp([0x45, 0x00]).then(value => resolve( value[2] ))
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
            serialNum = respSn.substring(0, 7);
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
                
                return resolve( this.parseResultCode(resp) )
            }).catch(err => reject( this.buildDeviceErr(err) ))
    )

    sendArpc = arpcResp => new Promise((resolve, reject) => this.sendArpcBase(arpcResp)
        .then(arpcCmd => this.sendCommandWithResp(arpcCmd))
        .then(resp => resolve( this.parseResultCode(resp) ))
        .catch(err => reject(this.buildDeviceErr(err)))
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
        : this.sendCommandWithResp(this.cancelEmvCommand)
        .then(resp => resolve( this.parseResultCode(resp) )
        ).catch(err => reject(this.buildDeviceErr(err)))
    );


    closeDevice = () => new Promise( (resolve, reject) => 
        (!this.device.gatt.connected) ? resolve({
            code: successCode,
            message: closeSuccess
        }) 
        : this.ceaseNotifications().then(() => {
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
