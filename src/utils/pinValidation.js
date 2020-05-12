import DeviceBase from '../devices/baseClass';

import {
    missingRequiredFields,
    wrongInputTypes,
    wrongInputValues
} from '../errorHandler/errConstants';

class PinValidation extends DeviceBase {
    constructor(device, callBacks) {
        super(device, callBacks);
    }

    validateAmount = parentReject => (amount, propName, defaultVal) => {
        switch(typeof(amount)) {
            case 'number':
                return (amount.toString().length > 12) ? parentReject(wrongInputValues(['number of 12 digits or less', 'byte array representation of amount (6 bytes, n12 format)'], amount)) 
                    : this.convertNumToAmount(amount);
            case 'object':
                return (amount.length === 6) ? amount 
                    : parentReject(wrongInputValues(['12 digit or less number', 'byte array representation of amount (6 bytes, n12 format)'], propName));
            case 'undefined':
                return (typeof(defaultVal) === 'undefined') ? parentReject(missingRequiredFields(propName)) : defaultVal;
            default:
                return parentReject(wrongInputTypes(['number of 12 digits or less', 'byte array representation of amount (6 bytes, n12 format)'], propName))
        }
    }
    
    validateRequiredInputs = validationConfig => new Promise((resolve, reject) => {
        for (let i = 0; i < validationConfig.length; i++) {
            let { prop, validTypes, validValues, condition, propName } = validationConfig[i];

            if (typeof(prop) === 'undefined' && condition)
                return reject(missingRequiredFields(propName));

            let typeIsValid = false;
            for (let indx = 0; indx < validTypes.length; indx++) {
                if (typeof(prop) === validTypes[indx]) {
                    typeIsValid = true;
                    break;
                }
            }

            if (!typeIsValid)
                return reject(wrongInputTypes(validTypes, propName)); 

            if (typeof(validValues) !== 'undefined') {
                let valsAreValid = false;
                for (let index = 0; index < validValues.length; index++) {
                    if (prop.toLowerCase() === validValues[index]) {
                        valsAreValid = true;
                        break;
                    }
                }

                if (!valsAreValid)
                    return reject(wrongInputValues(validValues, propName))
            }
        }

        return resolve(true);
    });

}

export default PinValidation;