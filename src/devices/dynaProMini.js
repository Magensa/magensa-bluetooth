import PinPad from './pinPad';
import { deviceNotIdle, dpMini } from '../utils/constants';
import { responseNotReceived, deviceNotFound } from '../errorHandler/errConstants';

class DpMini extends PinPad {
    constructor(device, callBacks) {
        super(device, callBacks);
        
        this.deviceType = dpMini;
    }
}

export default DpMini;