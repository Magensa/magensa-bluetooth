import PinPad from './pinPad';
import { deviceNotIdle, dynaProGo } from '../utils/constants';
import { responseNotReceived, deviceNotFound, deviceNotOpen, missingRequiredFields } from '../errorHandler/errConstants';

class DynaProGo extends PinPad {
    constructor(device, callBacks) {
        super(device, callBacks);

        this.getKsnAvailable = false;
        this.requestedKsn = null;
        
        this.getSerialNumber = false;
        this.requestedSn = null;

        this.deviceType = dynaProGo;
    }

    setDisplayMessage = displayOptions => new Promise((resolve, reject) => 
        (this.device && this.device.gatt.connected) ? 
            this.buildDisplayCmd( (displayOptions || {}) ).then( cmd => this.sendCommandWithResp(cmd) 
                ).then(resp => resolve(resp)
                ).catch(err => reject( this.buildDeviceErr(err) ))
            : reject( this.buildDeviceErr(deviceNotOpen)) );

    buildDisplayCmd = ({ displayTime, messageId, }) => new Promise( (resolve, reject) => 
        (typeof(messageId) === 'undefined') ? 
            reject( missingRequiredFields("messageId") ) 
            : resolve([
                0x01, 0x07,
                (typeof(displayTime) !== 'undefined') ? displayTime : 0x0F,
                messageId
            ])
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
        .then( () => (this.getSerialNumber) ? Promise.resolve(true) : this.waitForSn(5) 
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

export default DynaProGo;