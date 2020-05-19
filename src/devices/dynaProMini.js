import PinPad from './pinPad';
import {  dpMini } from '../utils/constants';

class DpMini extends PinPad {
    constructor(device, callBacks) {
        super(device, callBacks);
        
        this.deviceType = dpMini;
    }
}

export default DpMini;
