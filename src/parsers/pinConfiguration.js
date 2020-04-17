import PinUtils from '../utils/pinUtils';
import { configStr, unknown, ascii } from '../utils/constants';

class ParsePinConfig extends PinUtils {
    constructor(device, callBacks) {
        super(device, callBacks);

        this.trackDataOptions = Object.freeze({
            "00": "Disabled",
            "01": "Enabled",
            "11": "Required"
        });

        this.emvL2ConfigOptions = Object.freeze({
            "0000": "No L2 Capability",
            "0001": `${configStr} C1 (EMVCo certified)`,
            "0010": `${configStr} C2`,
            "0011": `${configStr} C3`,
            "0100": `${configStr} C4 (EMVCo certified)`,
            "0101": `${configStr} C5 (EMVCo certified)`,
            "0110": `${configStr} C6`,
            "0111": `${configStr} C7`
        });

        this.enabledBrands = Object.freeze({
            "0": "All contacless kernals enabled",
            "1": "PayPass/MCL support disabled",
            "2": "payWave support disabled",
            "4": "Expresspay support disabled",
            "8": "D-PAS support disabled"
        });
    }

    parseDeviceConfiguration = configArr => ({
        ...this.firstDeviceControlByte( this.decimalToBinary(configArr[1]) ),
        ...this.secondDeviceControlByte( this.decimalToBinary(configArr[2]) ),
        ...this.maskConfigurationByte( this.decimalToBinary(configArr[3]) ),
        ...this.msrConfigurationByte( this.decimalToBinary(configArr[4]) ),
        maskCharacter: this.findMaskCharacter(configArr[5]),
        leadingUnmaskedLength: parseInt(this.decimalToBinary( configArr[6]).slice(4), 2),
        trailingUnmaskedLength: parseInt(this.decimalToBinary( configArr[6]).slice(0, 4), 2),
        emvL2IcsConfig: (this.emvL2ConfigOptions[ this.decimalToBinary(configArr[7]).slice(0, 4) ] || `${unknown}/Undocumented EMV L2 ICS ${configStr}`),
        ...this.contactlessConfig( configArr[8] )
    });

    contactlessConfig = contactlessByte => ({
        contactlessSupport: this.enabledBrands[ this.convertArrayToHexString([contactlessByte])[0] ],
        contactlessGuiControls: (this.decimalToBinary(contactlessByte)[5] === "1") ? "Alternate" : "Standard"
    })

    findMaskCharacter = numChar => {
        if (numChar === 48) {
            return `${ascii}: '0'`
        }
        else {
            const numCharToHex = this.convertArrayToHexString([numChar]);
            const numCharToAscii = this.hexToAscii( numCharToHex );

            return (numCharToAscii) ? `${ascii}: '${numCharToAscii}'` 
                : `Non-${ascii} character in hex: '${numCharToHex}'`
        }
    }

    firstDeviceControlByte = deviceControlByte => ({
        requireMutualAuth: this.stringNumToBool(deviceControlByte[0]),
        msrEncryptionVariant: (deviceControlByte[1] === "1") ? "DATA" : "PIN",
        isClearTextEnabled: this.stringNumToBool(deviceControlByte[3]),
        isBeeperModeEnabled: this.stringNumToBool(deviceControlByte[4]),
        isBitmapLocked: this.stringNumToBool(deviceControlByte[6]),
        isConfigurationLocked: this.stringNumToBool(deviceControlByte[7])
    });

    secondDeviceControlByte = deviceCtrlByte => ({
        isArpcMacEnabled: this.stringNumToBool(deviceCtrlByte[1]),
        isFinancialIccCardTypeReportingEnabled: this.stringNumToBool(deviceCtrlByte[2]),
        arqcBatchDataOutputFormat: (deviceCtrlByte[3] === "1") ? "Reserved Format" : "DynaPro Format"
    });

    maskConfigurationByte = maskConfigByte => ({
        isIsoMaskEnabled: this.stringNumToBool(maskConfigByte[7]),
        isCheckDigitEnabled: this.stringNumToBool(maskConfigByte[6]),
        isMs2Point0Enabled: ( maskConfigByte.slice(4, 6) !== "00")
    });

    msrConfigurationByte = msrConfigByte => ({
        isAAMVAcardEnabled: this.stringNumToBool(msrConfigByte[7]),
        track3Data: ( this.trackDataOptions[ msrConfigByte.slice(4, 6) ] || unknown ),
        track2Data: ( this.trackDataOptions[ msrConfigByte.slice(2, 4) ] || unknown ),
        track1Data: ( this.trackDataOptions[ msrConfigByte.slice(0, 2) ] || unknown ),
    })
}

export default ParsePinConfig;
