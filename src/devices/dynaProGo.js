import PinPad from './pinPad';
import { dynaProGo } from '../utils/constants';
import { responseNotReceived, deviceNotOpen } from '../errorHandler/errConstants';

class DynaProGo extends PinPad {
    constructor(device, callBacks) {
        super(device, callBacks);

        this.deviceType = dynaProGo;
    }
}

export default DynaProGo;