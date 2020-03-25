import PinStatusParser from '../parsers/pinStatusParser';
import { 
    deviceNotFound, 
    readFailed, 
    commandNotSentFromHost, 
    commandNotSent,
    deviceNotOpen
} from '../errorHandler/errConstants';
import { closeSuccess, successCode, noSessionToClear } from '../utils/constants';

class PinPad extends PinStatusParser {
    constructor(device, callBacks) {
        super(device, callBacks);
        this.transactionCallback = callBacks.transactionCallback || callBacks;
        this.transactionStatusCallback = callBacks.transactionStatusCallback;

        this.deviceFromHostLen = '0508e6f8-ad82-898f-f843-e3410cb60220';
        this.deviceFromHostData = '0508e6f8-ad82-898f-f843-e3410cb60221';
        this.deviceToHostLen = '0508e6f8-ad82-898f-f843-e3410cb60222';
        this.deviceToHostData = '0508e6f8-ad82-898f-f843-e3410cb60223';

        this.cardDataListener = null;
        this.receiveDataChar = null;
        this.commandCharacteristic = null;
        this.sendLenToDevice = null;

        this.commandSent = false;
        this.swipeHasBegun = false;
        this.transactionHasStarted = false;
        this.dataGathered = false;
        this.startTransactionCommand = null;

        this.gattBusy = {
            code: 19, 
            message: "GATT operation already in progress."
        };

        this.transactionTypes = Object.freeze({
            'purchase': 0x00,
            'cashadvance': 0x01,
            'cashback': 0x02,
            'purchasegoods': 0x04,
            'purchaseservices': 0x08,
            'contactlesscashback': 0x09,
            'cashmanual': 0x12,
            'refund': 0x20, 
            'chiponlypayment': 0x50
        });

        this.emvOptions = Object.freeze({
            'normal': 0x00,
            'bypasspin': 0x01,
            'forceonline': 0x02,
            'acquirernotavailable': 0x04
        });

        this.displayTypes = Object.freeze({
            'swipeidlealternate': 0x00,
            'swipecard': 0x01,
            'pleaseswipe': 0x02,
            'pleaseswipeagain': 0x03,
            'chiperroruseswipe': 0x04
        });

        this.reportIds = Object.freeze({
            responseAck: 0x01,
            endSession: 0x02,
            requestCardSwipe: 0x03,
            cardStatusReport: 0x22,
            deviceStateReport: 0x20,
            cardDataReport: 0x23,
            emvCardholderStatus: 0x2C,
            bigBlockData: 0x29,
            emvCompletion: 0xA2,
            getKsn: 0x30,
            requestSn: 0x1A
        });

        this.toneChoice = Object.freeze({
            'nosound': 0x00,
            'onebeep': 0x01,
            'twobeeps': 0x02
        });

        this.initialNotification = [0x00];
    }

    getCardServiceBase = () => new Promise( (parentResolve, parentReject) => (!this.device) ?
        parentReject(
            this.buildDeviceErr(deviceNotFound)
        )
        :
        this.connectAndCache(2)
            .then( service => {
                this.logDeviceState(`[GATT]: Cache AppDataToHostLength Characteristic || ${new Date()}`);

                return service.getCharacteristic(this.deviceToHostLen) 
            }).then( characteristic => {
                this.logDeviceState(`[GATT]: Begin notifications on AppDataToHostLength Characteristic || ${new Date()}`);
                this.cardDataListener = characteristic;
                
                return this.cardDataListener.startNotifications()
            }).then( characteristic => 
                new Promise(resolve => {
                    this.logDeviceState(`[GATT]: Add listener to notifications || ${new Date()}`);

                    this.cardDataListener.removeEventListener('characteristicvaluechanged', this.dataWatcher);
                    this.cardDataListener.addEventListener('characteristicvaluechanged', this.dataWatcher);
                    
                    return resolve()
                })
            ).then( () => {
                this.logDeviceState(`[GATT]: Cache AppDataToHost Characteristic || ${new Date()}`);

                return this.cardService.getCharacteristic(this.deviceToHostData)
            }).then( characteristic => 
                new Promise( resolve => {
                    this.receiveDataChar = characteristic;
                    return resolve();
            })
            ).then( () => {
                this.logDeviceState(`[GATT]: Cache AppDataFromHostLength Characteristic || ${new Date()}`);
                return this.cardService.getCharacteristic(this.deviceFromHostLen)
            }).then( characteristic => 
                new Promise( resolve => {
                    this.sendLenToDevice = characteristic;
                    return resolve();
                })
            ).then( () => {
                this.logDeviceState(`[GATT]: Cache AppDataFromHost Characteristic || ${new Date()}`);
                return this.cardService.getCharacteristic(this.deviceFromHostData)
            }).then( characteristic => 
                new Promise( resolve => {
                    this.commandCharacteristic = characteristic;

                    //If this library is being used in a web application
                    //Make sure the device cancels any active command, and disconnects properly
                    if (window) {
                        window.removeEventListener('beforeunload', this.onDestroyHandler);
                        window.addEventListener('beforeunload', this.onDestroyHandler);
                    }

                    this.logDeviceState(`[GATT]: Successfully cached all GATT services and characteristics.  Returning successful open to user || ${new Date()}`);

                    return resolve()
                })
            ).then(() => this.delayPromise(400) ).then(() => parentResolve()
            ).catch(err => parentReject( err ))
        );
    
    dataWatcher = event => {
        let dataEvent = event.target.value.getUint8(0);
        this.logDeviceState(`[NOTIFY: AppDataToHostLength]: ${this.convertArrayToHexString([dataEvent])} || ${new Date()}`);

        if (this.commandSent && dataEvent === 3) {
            this.commandSent = false;
            this.commandRespAvailable = true;
            return;
        }

        return this.readCommandResp();
    }

    readCommandResp = () => new Promise( (resolve, reject) => (!this.receiveDataChar) ?
        reject( this.buildDeviceErr(readFailed))
        : 
        this.receiveDataChar.readValue()
            .then(value => this.readValueHandler(value) )
            .then(value => resolve(value))
            .catch( err => {
                if (err.code === this.gattBusy.code && err.message === this.gattBusy.message) {
                    this.logDeviceState(`[INFO]: Read failed due to device being busy. Attempting read again || ${new Date()}`)
                    return this.readCommandResp()
                }
                else return reject(this.buildDeviceErr(err))
            }));

    readValueHandler = readValue => new Promise( resolve => {
        let commandResp = this.readByteArray(readValue);
        this.logDeviceState(`[READ: AppDataToHost]: ${this.convertArrayToHexString(commandResp)} || ${new Date()}`);

        if (commandResp.length) {
            switch(commandResp[0]) {
                case this.reportIds.cardStatusReport:
                    return resolve( this.handleCardStatusReport(commandResp) )
                case this.reportIds.deviceStateReport:
                    return resolve( this.handleDeviceStateReport(commandResp) )
                case this.reportIds.responseAck:
                    return resolve( this.parseAckResponse(commandResp) )
                case this.reportIds.cardDataReport:
                    return resolve( this.handleCardDataReport(commandResp) )
                case this.reportIds.emvCardholderStatus:
                    return resolve( this.handleCardholderStatusReport(commandResp) )
                case this.reportIds.emvCompletion:
                    return resolve( this.handleEmvCompletion(commandResp) )
                case this.reportIds.bigBlockData:
                    return resolve( this.handleBigBlockData(commandResp) )
                case this.reportIds.getKsn:
                    return resolve( this.formatKsnAndSn(commandResp) )
                case this.reportIds.requestSn:
                    return resolve ( this.formatSerialNumber(commandResp) )
            };
        }
        else
            resolve()
    });

    handleEmvCompletion = commandResp => {
        return this.transactionStatusCallback(
            this.parseEmvCompletion(commandResp)
        )
    }

    handleBigBlockData = bigBlockData => {
        switch(bigBlockData[2]) {
            case 0x00:
               this.handleBigBlockBegin(bigBlockData);
               break;
            case 0x63:
                this.maxBlockId = Math.max(...Object.keys(this.rawData)) + 1;
                this.logDeviceState(this.rawData);
                this.handleBigBlockFinish();
                break;
            default:
                this.rawData = {
                    ...this.rawData,
                    [ bigBlockData[2] ]: bigBlockData.slice(4)
                };
                break;
        }

        return;
    }

    handleCardholderStatusReport = commandResp => this.transactionStatusCallback(
            this.parseEmvCardholderInteractionStatus(commandResp)
        );

    handleCardStatusReport = commandResp => new Promise( resolve => {
        this.transactionStatusCallback(
            this.parseCardStatusReport(commandResp)
        )

        return (this.swipeHasBegun) ? 
            this.sendCommandWithResp([0x01, 0x0A, 0x00])
            .then( ackResp => {
                this.transactionStatusCallback(ackResp);
                return resolve()
            }).catch(err => this.sendErrToCallback( this.buildDeviceErr(err) ))
        : 
            (this.transactionHasStarted) ? 
                this.sendCommandWithResp([0x01, 0xAB, 0x00])
                .then( ackResp => {
                    this.transactionStatusCallback( ackResp);
                    return resolve();
                }).catch(err => this.sendErrToCallback( this.buildDeviceErr(err) ))
                : 
                resolve()
    });

    handleDeviceStateReport = commandResp => {
        if (this.dataGathered) {
            this.dataGathered = false;
            this.startTransactionCommand = null;
            
            //Send assembled transaction data to callback
            this.transactionCallback({
                swipeData: this.cardDataObj
            });
        }

        this.transactionStatusCallback(
            this.parseDeviceStateReport(commandResp)
        );
    }

    handleCardDataReport = commandResp => {
        if (this.swipeHasBegun) {
            this.swipeHasBegun = false;
            this.dataGathered = true;
        }

        if (commandResp.length !== 3) {
            this.parseCardData(commandResp)
        }
        else {
            // TODO:
            // console.log("Trailing card data: ", commandResp);

            this.logDeviceState("[ERROR] Undocumented Card Data below");
            this.logDeviceState(commandResp);
        }
    }

    requestCardSwipe = swipeOptions => new Promise( (resolve, reject) => {
        this.swipeHasBegun = true;
        this.cardDataObj = {};

        this.getCardServiceBase()
            .then( () => 
                this.sendCommandWithResp([0x01, 0x02, 0x00])
            ).then( ackResp => {
                this.transactionStatusCallback(ackResp);
                return Promise.resolve()
            }).then( () => 
                this.sendCommandWithResp(
                    this.buildSwipeCommand( swipeOptions || {} )
                )
            ).then( resp => resolve(resp)
            ).catch( err => reject(err))
    });
        
    startTransaction = emvOptions => new Promise( (resolve, reject) => {
        this.transactionHasStarted = true;
        this.cardDataObj = {};
        this.logDeviceState(`[INFO]: EMV transaction begun || ${new Date()}`)

        return (!this.device.gatt.connected) ? reject( this.buildDeviceErr(deviceNotOpen))
            :
            this.sendCommandWithResp([0x01, 0x02, 0x00])
                .then( ackResp => {
                        this.transactionStatusCallback(ackResp);
                        this.logDeviceState(ackResp)
                        return Promise.resolve()
                }).then( () =>
                    this.sendCommandWithResp( this.buildEmvCommand( emvOptions || {} ) )
                ).then( resp => resolve(resp)
                ).catch(err => reject(err));
    });

    buildSwipeCommand = ({ 
        timeout, 
        isFallback, 
        toneChoice, 
        displayType
    }) => {
        let command = [ 
            0x01, 0x03, 
            (timeout || 0x3C),
            (isFallback === true) ? 0x04 : (displayType) ? (this.displayTypes[ displayType.toLowerCase() ] || 0x02) : 0x02,
            (toneChoice) ? (this.toneChoice[ toneChoice.toLowerCase() ] || 0x01) : 0x01
        ];

        this.startTransactionCommand = command;

        return command;
    }

    buildEmvCommand = ({ 
        timeout, 
        pinTimeout, 
        cardType, 
        transactionType, 
        cashBack, 
        currencyCode,
        toneChoice, 
        isQuickChip, 
        authorizedAmount, 
        emvOptions 
    }) => {
        let command = [ 
            0x01,
            0xA2,
            (timeout || 0x3C),
            (pinTimeout || 0x14),
            0x00,
            (toneChoice) ? (this.toneChoice[ toneChoice.toLowerCase() ] || 0x01) : 0x01,
            (cardType) ? this.cardTypes( cardType.toLowerCase() ) : 0x03,
            (emvOptions) ? (this.emvOptions[ emvOptions.toLowerCase() ] || 0x00) : 0x00
        ];

        command = (authorizedAmount) ? 
            command.concat( this.convertNumToAmount(authorizedAmount) ) 
            : command.concat( [0x00, 0x00, 0x00, 0x00, 0x01, 0x00] );

        command = (transactionType) ? 
            command.concat(this.transactionTypes[ transactionType.toLowerCase() ] || 0x00) 
            : command.concat(0x00)

        command = (cashBack) ? command.concat( this.convertNumToAmount( cashBack ) ) 
            : command.concat( this.newArrayPartial(0x00, 6) );

        command = command.concat( this.newArrayPartial(0x00, 12) );

        command = (currencyCode) ? command.concat(( this.currencyCode[ currencyCode.toLowerCase() ] ||  this.currencyCode['default'] ))
            : command.concat([0x08, 0x40])

        command.push(0x00);

        command.push(
            (isQuickChip === false) ? 0x00 : 0x01
        )

        command = command.concat( this.newArrayPartial(0x00, 28) )

        this.startTransactionCommand = command;

        return command;
    }

    sendPinCommand = writeCommand => new Promise( (resolve, reject) => {
        this.logDeviceState(`[AppFromHostLength]: ${this.convertArrayToHexString([writeCommand.length])} || ${new Date()}`);

        return (!this.sendLenToDevice) ? reject( this.buildDeviceErr(commandNotSentFromHost))
        : 
        this.sendLenToDevice.writeValue(Uint8Array.of( writeCommand.length))
            .then( () => {
                this.commandSent = true;
                this.logDeviceState(`[AppFromHostData]: ${this.convertArrayToHexString(writeCommand)} || ${new Date()}`);
                return this.commandCharacteristic.writeValue( Uint8Array.from(writeCommand) )
            }).then(() => resolve())
            .catch(err => reject(err));
    });

    cancelTransaction = () => new Promise( (resolve, reject) => (!this.commandCharacteristic) ? 
        reject( this.buildDeviceErr(commandNotSent))
        :
        this.sendCommandWithResp([0x01, 0x05, 0x00])
        .then( ackResp => resolve(ackResp) )
        .catch( err => reject(err) )
    );

    clearSession = () => new Promise( (resolve, reject) => {
        this.logDeviceState(`[ClearSession]: Request to clear session || ${new Date()}`);

        return (!this.sendLenToDevice) ? resolve(noSessionToClear) 
            : this.sendCommandWithResp([0x01, 0x02, 0x00])
            .then( ackResp => {
                this.transactionStatusCallback(ackResp);
                this.logDeviceState(`[ClearSession]: Received clear session resp || ${new Date()}`);
                return resolve(ackResp)
            }).catch(err => reject( this.buildDeviceErr(err) ));
    });

    clearSessionAndClose = () => new Promise((outerResolve, reject) => {
        this.logDeviceState(`[ClearSessionAndClose]: Request to close device || ${new Date()}`);

        return this.sendCommandWithResp([0x01, 0x02, 0x00])
        .then( ackResp => {
            this.transactionStatusCallback(ackResp);
            this.logDeviceState(`[ClearSessionAndClose]: Received clear session resp. Stop GATT notifications || ${new Date()}`);

            return this.cardDataListener.stopNotifications()
        }).then( () => {
            this.cardDataListener.removeEventListener('characteristicvaluechanged', this.dataWatcher);
            this.cardDataListener = null;
            this.logDeviceState(`[ClearSessionAndClose]: GATT notifications stopped, removed characteristic from cache || ${new Date()}`);

            return this.delayPromise(500)
        }).then( () => {
            this.clearGattCache();
            this.logDeviceState(`[ClearSessionAndClose]: cleared remaining cache. Closing device || ${new Date()}`);

            return Promise.resolve();
        }).then( () => this.disconnect() 
        ).then( () => outerResolve() )
        .catch( err => reject(err) );
    })

    closePinDevice = () => new Promise( (resolve, reject) => (!this.cardDataListener) ?
        this.disconnect().then( () => {
            this.logDeviceState(`[CLOSE DEVICE]: Clearing JS cache || ${new Date()}`);
            this.clearGattCache();
            return resolve();
        }).catch(err => reject( err ) )
        :
        this.cardDataListener.stopNotifications()
        .then( () => {
            this.cardDataListener.removeEventListener('characteristicvaluechanged', this.dataWatcher);
            this.cardDataListener = null;
            this.logDeviceState(`[CLOSE DEVICE]: GATT notifications stopped, removed characteristic from cache || ${new Date()}`);
            return this.delayPromise( 300 )
        }).then( () => {
            this.logDeviceState(`[CLOSE DEVICE]: Closing device || ${new Date()}`);
            return Promise.resolve( this.disconnect() )
        }).then( () => {
            this.logDeviceState(`[CLOSE DEVICE]: Clearing JS cache || ${new Date()}`);
            this.clearGattCache();
            return resolve();
        }).catch(err => reject( err ) )
    );

    closeDevice = () => new Promise( (resolve, reject) => 
        (!this.device.gatt.connected) ? resolve({
            code: successCode,
            message: closeSuccess
        }) 
        :
        this.clearSession()
            .then( () => 
                this.closePinDevice()
            ).then(()=> resolve({
                code: successCode,
                message: closeSuccess
            })).catch(err => reject(this.buildDeviceErr(err)))
    );

    clearGattCache = () => {
        this.transactionHasStarted = false;
        this.receiveDataChar = null;
        this.commandCharacteristic = null;
        this.sendLenToDevice = null;

        this.commandSent = false;
        this.commandRespAvailable = false;
        this.swipeHasBegun = false;
        this.dataGathered = false;
        this.startTransactionCommand = null;
    }
}

export default PinPad;