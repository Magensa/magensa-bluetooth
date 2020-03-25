import PinPad from './pinPad';
import { openSuccess, successCode, deviceNotIdle } from '../utils/constants';
import { responseNotReceived, deviceNotFound } from '../errorHandler/errConstants';

class DpMini extends PinPad {
    constructor(device, callBacks) {
        super(device, callBacks);

        this.getKsnAvailable = false;
        this.requestedKsn = null;
        
        this.getSerialNumber = false;
        this.requestedSn = null;
    }

    getCardService = () => new Promise( (resolve, reject) => 
        this.getCardServiceBase().then(() => resolve({ 
            code: successCode,
            message: openSuccess
        }))
        .catch(err => reject( this.buildDeviceErr(err) ))
    );

    sendCommandWithResp = writeCommand => new Promise( (resolve, reject) => {
        this.logDeviceState(`[INFO]: Below command sent to device || ${new Date()}`);
        this.logDeviceState(writeCommand);
        
        this.sendPinCommand(writeCommand)
        .then( () => (this.commandRespAvailable || this.waitForDeviceResponse(16)) )
        .then( waitResp => (waitResp) ? this.readCommandResp() : this.tryCommandAgain(writeCommand) )
        .then( response => {
            this.commandRespAvailable = false;

            return resolve( response );
        }).catch( err => reject( this.buildDeviceErr(err) ));
    });

    tryCommandAgain = writeCommand => this.sendPinCommand(writeCommand)
        .then( () => this.waitForDeviceResponse(5) )
        .then( waitResp => (waitResp) ? this.readCommandResp()
            : Promise.reject( this.buildDeviceErr(responseNotReceived))
        );

    //#region GetDeviceInfo
    getDeviceInfo = () => new Promise( (resolve, reject) => (!this.device) ?
        reject(this.buildDeviceErr(deviceNotFound)) 
        : this.gatherDeviceInfo()
            .then( deviceInfo => resolve(deviceInfo)
            ).catch(err => reject( this.buildDeviceErr(err)) )
    );

    gatherDeviceInfo = () => new Promise( (resolve, reject) => {
        this.checkIfDeviceIdle()
        .then( () => this.getDeviceInfoProceed()
        ).then( deviceInfo => 
             resolve({
                 ...deviceInfo,
                 deviceName: this.device.name,
                 isConnected: this.device.gatt.connected,
             })
        ).catch(err => reject(err))
     });

    getDeviceInfoBase = () => new Promise( resolve => {
        this.sendCommandWithResp([0x01, 0x1A, 0x05])
        .then( ackResp => resolve(ackResp))
    });

    getDeviceInfoProceed = () => new Promise( (resolve, reject) => {
        this.sendPinCommand([0x00, 0x1A, 0x05])
        .then( () => (this.getSerialNumber || this.waitForSn(5)) 
        ).then( waitResp => (waitResp) ? Promise.resolve() : 
            reject( this.buildDeviceErr(responseNotReceived))
        ).then( () => {
            let returnSn = { 
                serialNumber: this.hexToAscii(this.requestedSn.serialNumber) 
            };
            
            this.getSerialNumber = false;
            this.requestedSn = null;
            return resolve(  returnSn );
        }).catch( err => reject(err))
    })

    checkIfDeviceIdle = () => new Promise(resolve => {
        this.getDeviceInfoBase()
        .then( ackResp => {
            if (ackResp.message === deviceNotIdle) {
                return this.clearSession()
                .then( () => this.getDeviceInfoBase() );
            }
            else {
                this.transactionStatusCallback(ackResp);
                return resolve();
            }
        }).then(ackResp => {
            this.transactionStatusCallback(ackResp);
            return resolve();
        })
    });

    waitForSn = maxTries => new Promise( resolve => {

        let waitForResponse = tryNumber => 
            (tryNumber < maxTries) ? 
                (this.getSerialNumber) ? resolve( true ) : setTimeout(() => waitForResponse(tryNumber + 1), 200)
            : resolve( false );

        waitForResponse(0);
    });
    //#endregion
}

export default DpMini;