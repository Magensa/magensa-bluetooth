import PinCmdBuilder from '../commandBuilders/pinCmdBuilder';
import { 
    deviceNotFound, 
    readFailed, 
    commandNotSentFromHost, 
    commandNotSent,
    deviceNotOpen,
    responseNotReceived
} from '../errorHandler/errConstants';
import { 
    openSuccess, 
    successCode, 
    noSessionToClear, 
    gattBusy, 
    successfulClose, 
    magUuidPrefix 
} from '../utils/constants';


class PinPad extends PinCmdBuilder {
    constructor(device, callBacks) {
        super(device, callBacks);
        this.transactionCallback = callBacks.transactionCallback || callBacks;
        this.transactionStatusCallback = callBacks.transactionStatusCallback;

        this.deviceFromHostLen = `${magUuidPrefix}220`;
        this.deviceFromHostData = `${magUuidPrefix}221`;
        this.deviceToHostLen = `${magUuidPrefix}222`;
        this.deviceToHostData = `${magUuidPrefix}223`;

        this.cardDataListener = null;
        this.receiveDataChar = null;
        this.commandCharacteristic = null;
        this.sendLenToDevice = null;

        this.commandSent = false;
        this.swipeHasBegun = false;
        this.transactionHasStarted = false;
        this.dataGathered = false;
        this.isQuickChipTransaction = true;
        this.deviceSerialNumber = null;

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
            requestSn: 0x1A,
            deviceConfig: 0x09,
            pinResponse: 0x24,
            selectionResponse: 0x25,
            displayResp: 0x27,
            tipCashbackReport: 0x30,
            delayedAck: 0x2A
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
        const dataEvent = event.target.value.getUint8(0);
        this.logDeviceState(`[NOTIFY: AppDataToHostLength]: ${this.convertArrayToHexString([dataEvent])} || ${new Date()}`);

        if (this.commandSent && dataEvent === 3) {
                this.commandRespAvailable = true;
                this.commandSent = false;
                return;
        }
        else {
            try {
                return this.readCommandResp();
            }
            catch(err) {
                return this.errorCallback(err);
            }
        }
    }

    readCommandResp = () => new Promise( (resolve, reject) => (!this.receiveDataChar) ?
        reject( this.buildDeviceErr(readFailed))
        : this.receiveDataChar.readValue()
            .then(value => this.readValueHandler(value) )
            .then(value => resolve(value))
            .catch( err => {
                if (err.code === gattBusy.code && err.message === gattBusy.message) {
                    this.logDeviceState(`[INFO]: Read failed due to device being busy. Attempting read again || ${new Date()}`)
                    return this.delayPromise(50).then(() => resolve( this.readCommandResp() ))
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
                    return resolve( this.transactionStatusCallback(
                        this.parseEmvCardholderInteractionStatus(commandResp)
                    ));
                case this.reportIds.emvCompletion:
                    return resolve( this.transactionStatusCallback(
                        this.parseEmvCompletion(commandResp)
                    ));
                case this.reportIds.bigBlockData:
                    return resolve( this.handleBigBlockData(commandResp) )
                case this.reportIds.requestSn:
                    return resolve( this.formatSerialNumber(commandResp) )
                case this.reportIds.deviceConfig:
                    return resolve( this.parseDeviceConfiguration(commandResp) )
                case this.reportIds.pinResponse:
                    return resolve( 
                        this.transactionCallback( this.parsePinResponse(commandResp) )
                    );
                case this.reportIds.selectionResponse:
                    return resolve( this.parseCardholderResponse(commandResp) )
                case this.reportIds.displayResp:
                    return resolve( 
                        this.transactionStatusCallback( this.findOperationStatus(commandResp[1]) )
                    );
                case this.reportIds.tipCashbackReport:
                    return resolve( this.parseTipCashbackReport(commandResp) );
                case this.reportIds.delayedAck:
                    const ackResp = this.parseAckResponse(commandResp);
                    this.transactionStatusCallback({ delayedACK: ackResp })
                    return resolve( ackResp )
                default:
                    this.logDeviceState(
                        `[Data Resp]: There is no parser for this data, returning to caller: ${this.convertArrayToHexString(commandResp)} || ${new Date()}`
                    );
                    return resolve( this.transactionCallback( commandResp ) );
            };
        }
        else
            resolve();
    });

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

        this.parseCardData(commandResp);
    }

    requestCardSwipe = swipeOptions => new Promise( (resolve, reject) => (!this.device.gatt.connected) ? 
        reject( this.buildDeviceErr(deviceNotOpen) )
        : this.clearSession()
            .then( ackResp => {
                this.logDeviceState(`[INFO]: MSR transaction has begun || ${new Date()}`)
                this.swipeHasBegun = true;
                this.cardDataObj = {};

                return this.sendCommandWithResp(
                    this.buildSwipeCommand( (swipeOptions || {}) )
                )
            }).then( resp => resolve(resp)
            ).catch( err => reject(err))
    );
        
    startTransaction = emvOptions => new Promise( (resolve, reject) => {
        this.transactionHasStarted = true;
        this.cardDataObj = {};
        this.logDeviceState(`[INFO]: EMV transaction has begun || ${new Date()}`)

        return (!this.device.gatt.connected) ? reject( this.buildDeviceErr(deviceNotOpen))
            : this.sendCommandWithResp(this.clearSessionCmd)
                .then( ackResp => {
                        this.transactionStatusCallback(ackResp);
                        return this.buildEmvCommand( emvOptions || {} )
                }).then( emvCommmand =>
                    this.sendCommandWithResp( emvCommmand )
                ).then( resp => resolve(resp)
                ).catch(err => reject( this.buildDeviceErr(err) ));
    });

    requestPinEntry = pinOptions => new Promise( (resolve, reject) => {
        this.logDeviceState(`[PIN]: Request for PIN entry start || ${new Date()}`);

        return (!this.device.gatt.connected) ? reject( this.buildDeviceErr(deviceNotOpen))
            : this.sendCommandWithResp( this.buildPinCommand( pinOptions || {} ) )
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

    sendArpc = arpcResp => new Promise((resolve, reject) => (!this.device.gatt.connected) ?
        reject(this.buildDeviceErr(deviceNotOpen))
        : this.sendArpcBase(arpcResp)
        .then(arpcCmd => this.delayPromise(200, arpcCmd)
        ).then(cmd => this.sendCommandWithResp(cmd)
        ).then(resp => {
            this.logDeviceState(`[Send ARPC Result]: ${this.convertArrayToHexString(resp)}`);

            return resolve(resp);
        }).catch(err => reject(this.buildDeviceErr(err)))
    );

    setDisplayMessage = displayOptions => new Promise((resolve, reject) => 
        (this.device && this.device.gatt.connected) ? 
            this.buildDisplayCmd( (displayOptions || {}) ).then( cmd => this.sendCommandWithResp(cmd) 
                ).then(resp => resolve(resp)
                ).catch(err => reject( this.buildDeviceErr(err) ))
            : reject( this.buildDeviceErr(deviceNotOpen)) );

    sendPinCommand = writeCommand => new Promise( (resolve, reject) => {
        writeCommand = (typeof(writeCommand) === 'string') ? this.hexToBytes(writeCommand) : writeCommand;
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

            return reject( this.buildDeviceErr(err) );
        })
    );

    tryCommandAgain = writeCommand => new Promise( (resolve, reject) => this.sendPinCommand(writeCommand)
        .then( () => this.waitForDeviceResponse(5) )
        .then( waitResp => (waitResp) ? resolve( this.readCommandResp() )
            : reject( this.buildDeviceErr(responseNotReceived) )
        )
    );

    //#region GetDeviceInfo
    getDeviceInfo = () => new Promise( (resolve, reject) => (!this.device.gatt.connected) ?
        reject(this.buildDeviceErr(deviceNotOpen)) 
        : this.gatherDeviceInfo()
            .then( deviceInfo => resolve(deviceInfo)
            ).catch(err => reject( this.buildDeviceErr(err)) )
    );

    gatherDeviceInfo = () => new Promise( (resolve, reject) => (this.deviceSerialNumber) ? 
        resolve({
            serialNumber: this.deviceSerialNumber,
            deviceName: this.device.name,
            deviceType: this.deviceType,
            isConnected: this.device.gatt.connected
        }) 
        : this.checkIfDeviceIdle()
            .then( () => this.getDeviceInfoProceed()
            ).then( () => resolve({
                    serialNumber: this.deviceSerialNumber,
                    deviceName: this.device.name,
                    deviceType: this.deviceType,
                    isConnected: this.device.gatt.connected
                })
            ).catch(err => reject(err))
    );

    getDeviceInfoProceed = () => new Promise( (resolve, reject) => {
        this.sendPinCommand([0x00, 0x1A, 0x05])
        .then( () => (this.deviceSerialNumber) ? Promise.resolve(true) : this.waitForSn(7) 
        ).then( waitResp => (waitResp) ? resolve() : 
            reject( this.buildDeviceErr(responseNotReceived))
        ).catch( err => reject(err))
    })

    checkIfDeviceIdle = () => new Promise(resolve => 
        this.sendCommandWithResp([0x01, 0x1A, 0x05])
            .then( ackResp => {
                if (ackResp.code === 0x81) {
                    return this.clearSession()
                    .then( () => resolve( this.checkIfDeviceIdle() ));
                }
                else {
                    this.transactionStatusCallback(ackResp);
                    return resolve();
                }
            })
    );

    waitForSn = maxTries => new Promise( resolve => {

        const waitForResponse = tryNumber => 
            (tryNumber < maxTries) ? 
                (this.deviceSerialNumber) ? resolve( true ) : setTimeout(() => waitForResponse(tryNumber + 1), 200)
            : resolve( false );

        waitForResponse(0);
    });
    //#endregion

    cancelTransaction = () => new Promise( (resolve, reject) => (!this.commandCharacteristic) ? 
        reject( this.buildDeviceErr(commandNotSent))
        : this.sendCommandWithResp([0x01, 0x05, 0x00])
        .then( ackResp => resolve(ackResp) )
        .catch( err => reject(err) )
    );

    clearSession = bitmapId => new Promise( (resolve, reject) => {
        this.logDeviceState(`[ClearSession]: Request to clear session || ${new Date()}`);

        return (!this.sendLenToDevice) ? resolve(noSessionToClear) 
            : this.sendCommandWithResp(
                (!bitmapId) ? this.clearSessionCmd : [0x01, 0x02, bitmapId]
            ).then( ackResp => {
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
        : this.cardDataListener.stopNotifications()
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
            .then( () => this.closePinDevice()
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

        this.swipeHasBegun = false;
        this.transactionHasStarted = false;
    }
}

export default PinPad;
