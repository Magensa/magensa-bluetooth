import PinCmdBuilder from '../commandBuilders/pinCmdBuilder';
import { 
    deviceNotFound, 
    readFailed, 
    commandNotSentFromHost, 
    commandNotSent,
    deviceNotOpen,
    responseNotReceived,
    missingRequiredFields
} from '../errorHandler/errConstants';
import { openSuccess, successCode, noSessionToClear, gattBusy, successfulClose } from '../utils/constants';

class PinPad extends PinCmdBuilder {
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
        this.isQuickChipTransaction = true;
        this.hasTip = false;

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
            requestSn: 0x1A,
            deviceConfig: 0x09,
            pinResponse: 0x24,
            selectionResponse: 0x25,
            displayResp: 0x27,
            tipCashbackReport: 0x30
        });

        this.toneChoice = Object.freeze({
            'nosound': 0x00,
            'onebeep': 0x01,
            'twobeeps': 0x02
        });

        this.initialNotification = [0x00];

        this.clearSessionCmd = [0x01, 0x02, 0x00];
    }

    getCardService = () => new Promise( (parentResolve, parentReject) => (!this.device) ?
        parentReject( this.buildDeviceErr(deviceNotFound) )
        :
        this.connectAndCache(2)
            .then( service => {
                this.logDeviceState(`[GATT]: Cache AppDataToHostLength Characteristic || ${new Date()}`);

                return service.getCharacteristic(this.deviceToHostLen) 
            }).then( characteristic => {
                this.logDeviceState(`[GATT]: Begin notifications on AppDataToHostLength Characteristic || ${new Date()}`);

                return characteristic.startNotifications()
            }).then( characteristic => {
                this.logDeviceState(`[GATT]: Add listener to notifications || ${new Date()}`);

                characteristic.removeEventListener('characteristicvaluechanged', this.dataWatcher);
                characteristic.addEventListener('characteristicvaluechanged', this.dataWatcher);

                this.cardDataListener = characteristic;
                this.logDeviceState(`[GATT]: Cache AppDataToHost Characteristic || ${new Date()}`);

                return this.cardService.getCharacteristic(this.deviceToHostData);
            }).then( characteristic => {
                    this.receiveDataChar = characteristic;
                    this.logDeviceState(`[GATT]: Cache AppDataFromHostLength Characteristic || ${new Date()}`);

                    return this.cardService.getCharacteristic(this.deviceFromHostLen)
            }).then( characteristic => {
                    this.sendLenToDevice = characteristic;
                    this.logDeviceState(`[GATT]: Cache AppDataFromHost Characteristic || ${new Date()}`);

                    return this.cardService.getCharacteristic(this.deviceFromHostData)
            }).then( characteristic => {
                    this.commandCharacteristic = characteristic;

                    /*
                        If this library is being used in a web application
                        Make sure the device cancels any active command, and disconnects properly
                    */

                    if (window) {
                        window.removeEventListener('beforeunload', this.onDestroyHandler);
                        window.addEventListener('beforeunload', this.onDestroyHandler);
                    }

                    this.logDeviceState(`[GATT]: Successfully cached all GATT services and characteristics. Returning successful pair to user || ${new Date()}`);

                    return this.delayPromise(400)
            }).then(() => parentResolve({ 
                    code: successCode,
                    message: openSuccess
            })).catch(err => parentReject( this.buildDeviceErr(err) ))
    );
    
    dataWatcher = event => {
        let dataEvent = event.target.value.getUint8(0);
        this.logDeviceState(`[NOTIFY: AppDataToHostLength]: ${this.convertArrayToHexString([dataEvent])} || ${new Date()}`);

        if (this.commandSent && dataEvent === 3) {
                this.commandRespAvailable = true;
                this.commandSent = false;
                
                return;
        }
        else
            return this.readCommandResp();
    }

    readCommandResp = () => new Promise( (resolve, reject) => (!this.receiveDataChar) ?
        reject( this.buildDeviceErr(readFailed))
        : 
        this.receiveDataChar.readValue()
            .then(value => this.readValueHandler(value) )
            .then(value => resolve(value))
            .catch( err => {
                if (err.code === gattBusy.code && err.message === gattBusy.message) {
                    this.logDeviceState(`[INFO]: Read failed due to device being busy. Attempting read again || ${new Date()}`)
                    return this.delayPromise(100).then(() => resolve( this.readCommandResp() ))
                }
                else return reject(this.buildDeviceErr(err))
            }));

    readValueHandler = readValue => new Promise( resolve => {
        const commandResp = this.readByteArray(readValue);
        this.logDeviceState(`[READ: AppDataToHost]: ${this.convertArrayToHexString(commandResp)} || ${new Date()}`);

        if (commandResp.length) {
            switch(commandResp[0]) {
                case this.reportIds.responseAck:
                    return resolve( this.parseAckResponse(commandResp) )
                case this.reportIds.deviceStateReport:
                    return resolve( this.handleDeviceStateReport(commandResp) )
                case this.reportIds.cardStatusReport:
                    return resolve( this.handleCardStatusReport(commandResp) )
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
                    return resolve( this.formatSerialNumber(commandResp) )
                case this.reportIds.deviceConfig:
                    return resolve( this.parseDeviceConfiguration(commandResp) )
                case this.reportIds.pinResponse:
                    return resolve( 
                        this.transactionCallback( this.parsePinResponse(pinResp) )
                    );
                case this.reportIds.selectionResponse:
                    return resolve( this.parseCardholderResponse(commandResp) )
                case this.reportIds.displayResp:
                    return resolve( 
                        this.transactionStatusCallback( this.findOperationStatus(commandResp[1]) )
                    );
                case this.reportIds.tipCashbackReport:
                    return resolve( this.parseTipCashbackReport(commandResp) );
                default:
                    this.logDeviceState(
                        `[Data Resp]: There is no parser for this data, returning to caller: ${this.convertArrayToHexString(commandResp)} || ${new Date()}`
                    );
                    return resolve( this.transactionCallback( commandResp ) );
            };
        }
        else
            resolve( commandResp );
    });

    handleEmvCompletion = commandResp => {
        console.log("[!] EMV Completion: ", commandResp);
        return this.transactionStatusCallback(
            this.parseEmvCompletion(commandResp)
        )
    }

    handleBigBlockData = bigBlockData => {
        switch(bigBlockData[2]) {
            case 0x00:
               this.handleBigBlockBegin( bigBlockData );
               break;
            case 0x63:
                this.maxBlockId = Math.max(...Object.keys(this.rawData)) + 1;
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

        return (this.swipeHasBegun || this.transactionHasStarted) ? 
            this.sendCommandWithResp( 
                (this.swipeHasBegun ? [0x01, 0x0A, 0x00] : [0x01, 0xAB, 0x00])
            ).then( ackResp => resolve( this.transactionStatusCallback(ackResp) )
            ).catch(err => this.sendErrToCallback( this.buildDeviceErr(err) ))
        : resolve()
    });

    handleDeviceStateReport = commandResp => {
        if (this.dataGathered) {
            this.dataGathered = false;
            
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

            this.logDeviceState("[ERROR] Undocumented Card Data below");
            this.logDeviceState(commandResp);
        }
    }

    requestCardSwipe = swipeOptions => new Promise( (resolve, reject) => {
        this.swipeHasBegun = true;
        this.cardDataObj = {};

        return (!this.device.gatt.connected) ? reject( this.buildDeviceErr(deviceNotOpen))
            : 
            this.sendCommandWithResp( this.clearSessionCmd )
            .then( ackResp => {
                this.transactionStatusCallback(ackResp);

                return this.sendCommandWithResp(
                    this.buildSwipeCommand( (swipeOptions || {}) )
                )
            }).then( resp => resolve(resp)
            ).catch( err => reject(err))
    });
        
    startTransaction = emvOptions => new Promise( (resolve, reject) => {
        this.transactionHasStarted = true;
        this.cardDataObj = {};
        this.logDeviceState(`[INFO]: EMV transaction begun || ${new Date()}`)

        // return (!this.device.gatt.connected) ? reject( this.buildDeviceErr(deviceNotOpen))
        //     :
        //     this.sendCommandWithResp(this.clearSessionCmd)
        //         .then( ackResp => {
        //                 this.transactionStatusCallback(ackResp);
        //                 return this.buildEmvCommand( emvOptions || {} )
        //         }).then( emvCommmand =>
        //             this.sendCommandWithResp( emvCommmand )
        //         ).then( resp => resolve(resp)
        //         ).catch(err => reject( this.buildDeviceErr(err) ));

        return this.buildEmvCommand( emvOptions || {} )
                .then( emvCommmand =>
                    this.sendCommandWithResp( emvCommmand )
                ).then( resp => resolve(resp)
                ).catch(err => reject( this.buildDeviceErr(err) ));
    });

    

    requestPinEntry = pinOptions => new Promise( (resolve, reject) => {
        this.logDeviceState(`[PIN]: Request for PIN entry start || ${new Date()}`);
        console.log("pinoptions: ", pinOptions);

        return (!this.device.gatt.connected) ? reject( this.buildDeviceErr(deviceNotOpen))
            :
            this.sendCommandWithResp( this.buildPinCommand( pinOptions || {} ) )
                .then( resp => resolve(resp)
                ).catch(err => reject(err));
    }); 

    sendBigBlockData = (dataType, dataLen, data) => new Promise((parentResolve, parentReject) => {
        let blockZero = [0x01, 0x10, dataType, 0x00, (dataLen & 0xFF)];

        if (dataLen < 60) {
            blockZero = blockZero.concat(...this.newArrayPartial(0x00, 60));
            this.logDeviceState(`[Send Big Block Data Legacy]: ${this.convertArrayToHexString(blockZero)}`);

            let legacyData = [0x01, 0x10, dataType, 0x01, dataLen, ...data];

            if (legacyData.length < 65)
                legacyData = legacyData.concat(...this.newArrayPartial(0x00, (65 - legacyData.length)))

            return this.sendPinCommand(blockZero).then(() => this.sendPinCommand(legacyData)
                ).then(() => parentResolve()
                ).catch(err => parentReject(this.buildDeviceErr(err)));
        }
        else {
            blockZero = blockZero.concat([
                ((dataLen >> 8) & 0xFF), 
                ((dataLen >> 16) & 0xFF), 
                ((dataLen >> 24) & 0xFF), 
                0x01, 
                ...this.newArrayPartial(0x00, 56)
            ]);

            return this.sendExtendedBigBlockData(dataType, dataLen, data, blockZero).then(() => parentResolve());
        }
    });

    sendExtendedBigBlockData = (dataType, dataLen, data, blockZero) => new Promise( (parentResolve, parentReject) => {
        const numberOfBlocks = Math.ceil(dataLen / 60);
        let workingOnPromise = false;
        let commandBlocks = [];

        this.logDeviceState(`[Send Big Block Data Extended]: ${this.convertArrayToHexString(blockZero)} || ${new Date()}`);

        const beginQueue = () => new Promise((beginQueueResolve, beginQueueReject) => {
            if (workingOnPromise)
                return this.delayPromise(500).then(() => beginQueueResolve( beginQueue() ));

            const dataBlock = commandBlocks.shift();

            if (!dataBlock)
                return beginQueueResolve(true);

            workingOnPromise = true;

            return dataBlock.queuedPromise()
                .then(() => dataBlock.resolve()
                ).then(() => {
                    workingOnPromise = false;
                    return beginQueueResolve( beginQueue() )
                }).catch(err => {
                    workingOnPromise = false;
                    return beginQueueReject( dataBlock.reject(err) );
                })
        });

        const enqueue = queuedPromise => new Promise((resolve, reject) => {
            commandBlocks.push({
                queuedPromise,
                resolve,
                reject,
            });
        });

        enqueue( 
            () => new Promise(innerResolve => 
                this.sendPinCommand(blockZero).then(() => innerResolve()) ) 
        );

        for (let i = 0, block = 1; block <= numberOfBlocks; i + 60, block++) {
            let dataForBlock = data.slice(i, (i + 60));
            let blockCmd = [0x01, 0x10, dataType, block, dataForBlock.length, ...dataForBlock];

            if (blockCmd.length !== 65)
                blockCmd = blockCmd.concat( ...this.newArrayPartial(0x00, (65 - blockCmd.length)) )

            enqueue( 
                () => new Promise( innerResolve => 
                    this.sendPinCommand(blockCmd).then( () => innerResolve()) )
            );
        }

        this.logDeviceState(`[Send Big Block Data Extended]: Executing queue of ${commandBlocks.length} commands || ${new Date()}`);

        return beginQueue().then(beginQueResp => parentResolve(beginQueResp)).catch(err => parentReject(err));
    });

    sendArpc = arpcResp => new Promise((resolve, reject) => this.sendArpcBase(arpcResp)
        .then(arpcCmd => this.delayPromise(200, arpcCmd)
        ).then(cmd => {
            console.log('passed through command: ', cmd);
            return this.sendCommandWithResp(cmd)
        }).then(resp => {
            this.logDeviceState(`[Send ARPC Result]: ${this.convertArrayToHexString(resp)}`);

            return resolve(resp);
        }).catch(err => reject(this.buildDeviceErr(err)))
    );

    /* TODO: */
    requestTipOrCashback = tipCashbackOptions => new Promise((resolve, reject) => {
        //If Tip
        this.hasTip = true;

        return this.buildTipOrCashbackCmd(tipCashbackOptions)
            .then(tipCashbackCmd =>  {
                console.log('returned with this command:', tipCashbackCmd, this.convertArrayToHexString(tipCashbackCmd));
                
                return this.sendCommandWithResp(tipCashbackCmd)
            }).then(resp => {
                console.log('tip-cashback resp: ', resp);
                return resolve(resp);
            })
            .catch(err => reject(this.buildDeviceErr(err)))
    });

    setDisplayMessage = displayOptions => new Promise((resolve, reject) => 
        (this.device && this.device.gatt.connected) ? 
            this.buildDisplayCmd( (displayOptions || {}) ).then( cmd => this.sendCommandWithResp(cmd) 
                ).then(resp => resolve(resp)
                ).catch(err => reject( this.buildDeviceErr(err) ))
            : reject( this.buildDeviceErr(deviceNotOpen)) );

    sendPinCommand = writeCommand => new Promise( (resolve, reject) => {
        this.logDeviceState(`[AppFromHostLength]: ${this.convertArrayToHexString([writeCommand.length])} || ${new Date()}`);

        return (!this.sendLenToDevice) ? reject( this.buildDeviceErr(commandNotSentFromHost) )
        : this.sendLenToDevice.writeValue(Uint8Array.of( writeCommand.length ))
            .then( () => {
                this.logDeviceState(`[AppFromHostData]: ${this.convertArrayToHexString(writeCommand)} || ${new Date()}`);
                this.commandSent = true;
                return resolve( this.commandCharacteristic.writeValue( Uint8Array.from(writeCommand) ) )
            }).catch(err => {
                this.commandSent = false;
                return reject(err)
            });
    });

    sendCommandWithResp = writeCommand => new Promise( (resolve, reject) => this.sendPinCommand(writeCommand)
        .then( () => (this.commandRespAvailable) ? Promise.resolve(true) : this.waitForDeviceResponse(16) )
        .then( waitResp => (waitResp) ? this.readCommandResp() : this.tryCommandAgain(writeCommand) )
        .then( response => {
            this.commandRespAvailable = false;

            return resolve( response );
        }).catch( err => {
            this.commandRespAvailable = false;

            return reject( this.buildDeviceErr(err) )
        })
    );

    tryCommandAgain = writeCommand => new Promise( (resolve, reject) => this.sendPinCommand(writeCommand)
        .then( () => this.waitForDeviceResponse(5) )
        .then( waitResp => (waitResp) ? resolve( this.readCommandResp() )
            : reject( this.buildDeviceErr(responseNotReceived) )
        )
    );

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
            : this.sendCommandWithResp(this.clearSessionCmd)
            .then( ackResp => {
                this.transactionStatusCallback(ackResp);
                this.logDeviceState(`[ClearSession]: Received clear session response || ${new Date()}`);
                this.clearInternalState();
                return resolve(ackResp)
            }).catch(err => reject( this.buildDeviceErr(err) ));
    });

    closePinDevice = () => new Promise( (resolve, reject) => (!this.cardDataListener) ?
        this.disconnect().then( () => {
            this.logDeviceState(`[Close Device]: Device Closed. Clearing JS cache || ${new Date()}`);
            this.clearGattCache();
            
            return resolve();
        }).catch(err => reject( err ) )
        :
        this.cardDataListener.stopNotifications()
        .then( () => {
            this.logDeviceState(`[Close Device]: GATT notifications stopped. Clearing JS cache || ${new Date()}`);

            this.cardDataListener.removeEventListener('characteristicvaluechanged', this.dataWatcher);
            this.cardDataListener = null;
            this.clearGattCache();

            return resolve( this.disconnect() )
        }).catch(err => reject( err ) )
    );

    closeDevice = () => new Promise( (resolve, reject) => (!this.device.gatt.connected) ? 
        resolve(successfulClose) 
        : this.clearSession()
            .then( () => 
                this.closePinDevice()
            ).then(()=> resolve(successfulClose)
            ).catch(err => {
                this.disconnect();
                return reject(this.buildDeviceErr(err) )
            })
    );

    clearInternalState = () => {
        this.commandSent = false;
        this.commandRespAvailable = false;
        this.dataGathered = false;
        this.isQuickChipTransaction = true;
    }

    clearGattCache = () => {
        this.transactionHasStarted = false;
        this.receiveDataChar = null;
        this.commandCharacteristic = null;
        this.sendLenToDevice = null;
        this.clearInternalState();

        this.hasTip = false;
        this.swipeHasBegun = false;
        this.transactionHasStarted = false;
    }
}

export default PinPad;