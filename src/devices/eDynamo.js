import Scra from './scra';
import { 
    swipeListening,
    successCode,
    eDynamo
} from '../utils/constants';

class EDynamo extends Scra {
    constructor(device, callBacks) {
        super(device, callBacks);

        this.deviceType = eDynamo;
    }

    getCardService = () => new Promise( (resolve, reject) => 
        this.getCardServiceBase(1)
        .then(resp => resolve(resp)
        ).catch( err => reject(this.buildDeviceErr(err)) )
    );

    requestCardSwipe = () => new Promise( (resolve, reject) => 
        (!this.device.gatt.connected) ? 
            this.getCardServiceBase(1)
            .then( () => 
                resolve({ 
                    code: successCode,
                    message: swipeListening
                }) 
            ).catch(err => reject(this.buildDeviceErr(err) ))
        : resolve({
            code: successCode,
            message: swipeListening
        }) 
    );
}

export default EDynamo;