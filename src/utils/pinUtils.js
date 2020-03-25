import DeviceBase from '../devices/baseClass';

class PinUtils extends DeviceBase {
    constructor(device, callBacks) {
        super(device, callBacks);
    }

    decimalToBinary = num => {
        let binaryNum = (num >>> 0).toString(2);
        return "00000000".substr(binaryNum.length) + binaryNum;
    }

    stringNumToBool = stringNum => !!+stringNum;

    findNullTerminatedString = nullTerminatedArray => {
        let targetIndex;

        for (let i = 0; i < nullTerminatedArray.length; i++) {
            if (nullTerminatedArray[i] === 0) {
                if (nullTerminatedArray[i + 1] === 0 && nullTerminatedArray[i + 2] === 0) {
                    targetIndex = i;
                    break;
                }
            }
        }

        return (targetIndex) ? 
            this.convertArrayToHexString(nullTerminatedArray.slice(2, targetIndex) ) 
            : this.convertArrayToHexString(nullTerminatedArray.slice(2) );
    }
}

export default PinUtils;