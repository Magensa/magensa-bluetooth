import Scra from './scra';
import { 
    swipeListening,
    successCode,
    tDynamo
} from '../utils/constants';
import { commandNotAccepted } from '../errorHandler/errConstants';

class TDynamo extends Scra {
    constructor(device, callBacks) {
        super(device, callBacks);

        this.setHeadAlwaysOn = [0x58, 0x01, 0x01];
        //this.setHeadOffWhenIdle = Uint8Array.of(0x58, 0x01, 0x00);

        this.deviceType = tDynamo
    }

    getCardService = () => new Promise( (resolve, reject) => 
        this.getCardServiceBase()
        .then(resp => resolve(resp)
        ).catch( err => reject(this.buildDeviceErr(err)) )
    );

    requestCardSwipe = () => new Promise( (resolve, reject) => (!this.device.gatt.connected) ?
        this.getCardServiceBase()
        .then(() => 
            this.sendCommandWithResp(this.setHeadAlwaysOn)
        ).then(setHeadOpenResp => (parseInt(setHeadOpenResp) === 0) ? 
            resolve({ 
                code: successCode,
                message: swipeListening
            })
            :
            reject( this.buildDeviceErr(commandNotAccepted) )
        ).catch(err => reject(err))
        :
        this.sendCommandWithResp(this.setHeadAlwaysOn)
        .then(setHeadOpenResp => (parseInt(setHeadOpenResp) === 0) ? 
            resolve({ 
                code: successCode,
                message: swipeListening
            })
            :
            reject( this.buildDeviceErr(commandNotAccepted)
            )
        ).catch(err => reject(err))
    );
}

export default TDynamo;