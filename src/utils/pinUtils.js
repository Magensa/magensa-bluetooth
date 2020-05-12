import PinValidation from './pinValidation';

class PinUtils extends PinValidation {
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

    findPinLength = (maxLen, minLen) => {
        let maxLength = 12;
        let minLength = 4;

        if (maxLen) {
            if (typeof maxLen === 'number' && maxLen <= 12)
                maxLength = (maxLen >= 4) ? maxLen : 12;
        }

        if (minLen) {
            if (typeof minLen === 'number' && minLen >=4)
                minLength = (minLen <= maxLength) ? minLen : 4;
        }

        return parseInt(`${maxLength.toString(16)}${minLength.toString(16)}`, 16);
    }

    buildPinOptionsByte = (languageSelection, waitMessage, verifyPin, pinBlockFormat) => {
        const languagePrompts = Object.freeze({
            "disabled": "00",
            "englishfrench": "01",
            "allspecified": "10"
        });

        languageSelection = (languageSelection) ? (languagePrompts[ languageSelection.toLowerCase() ] || languagePrompts.disabled) : languagePrompts.disabled;
        waitMessage = (typeof waitMessage === 'boolean') ? waitMessage : true;
        verifyPin = (typeof waitMessage === 'boolean') ? waitMessage : true;
        
        pinBlockFormat = (pinBlockFormat && typeof(pinBlockFormat) === 'string') ? 
                (pinBlockFormat.toLowerCase() === 'iso0') ? '0' : '1' 
            : '0';

        const binaryResult = `000${languageSelection}${((waitMessage) ? '1' : '0')}${((verifyPin) ? '1' : '0')}${pinBlockFormat}`;
        this.logDeviceState(`[PinOptionsByte]: binary string representation: ${binaryResult} || byte result: ${parseInt(binaryResult, 2)}`)

        return parseInt(binaryResult, 2);
    }
}

export default PinUtils;