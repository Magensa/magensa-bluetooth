import PinPad from './pinPad';
import { dynaProGo } from '../utils/constants';
import { deviceNotOpen } from '../errorHandler/errConstants';

class DynaProGo extends PinPad {
    constructor(device, callBacks) {
        super(device, callBacks);

        this.deviceType = dynaProGo;
    }

    requestTipOrCashback = tipCashbackOptions => new Promise((resolve, reject) => (!this.device.gatt.connected) ?
        reject(this.buildDeviceErr(deviceNotOpen))
        : this.buildTipOrCashbackCmd( (tipCashbackOptions || {} ))
            .then(tipCashbackCmd => this.sendCommandWithResp(tipCashbackCmd)
            ).then(resp => resolve(resp)
            ).catch(err => reject(this.buildDeviceErr(err)))
    );
}

export default DynaProGo;
