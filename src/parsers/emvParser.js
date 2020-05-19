import SwipeParser from './swipeParser';


class EmvParser extends SwipeParser {
    constructor() {
        super();

        this.moreTagBytesFlag1 = 0x1F;
        this.moreTagBytesFlag2 = 0x80;
        this.constructedFlag = 0x20;
        this.moreLengthFlag = 0x80;
        this.oneByteLengthMask = 0x7F;

        this.trxStatusToString = Object.freeze({
            0x00: "Approved",
            0x01: "Declined",
            0x02: "Error",
            0x10: "Cancelled By Host",
            0x11: "Confirm Amount No",
            0x12: "Confirm Amount Timeout",
            0x13: "Confirm Amount Cancel",
            0x14: "MSR Select Debit",
            0x15: "MSR Select Debit",
            0x16: "MSR Select Credit/Debit timout",
            0x17: "MSR Select Credit/Debit cancel",
            0x18: "Signature Capture Cancelled by Host (SC-S Only | SC-F only)",
            0x19: "Signature Capture Timeout (SC-S Only | SC-F Only)",
            0x1A: "Signature Capture Cancelled by Cardholder (SC-S Only | SC-F Only)",
            0x1B: "PIN Entry Cancelled by Host",
            0x1C: "PIN entry timeout",
            0x1D: "PIN entry Cancelled by Cardholder",
            0x1E: "Manual Selected Cancelled by Host",
            0x1F: "Manual Selection Timeout",
            0x20: "Manual Selction Cancelled by Cardholder",
            0x21: "Waiting for Card Cancelled by Host",
            0x22: "Waiting for Card Timeout",
            0x23: "[SCRA]: Cancelled by Card Swipe (MSR) ||[PIN]: Waiting for Card Cancelled by Cardholder ",
            0x24: "Waiting for Card ICC Seated",
            0x25: "Waiting for Card MSR Swiped",
            0xFF: "Unknown Transaction Status",
        });
    }

    tlvParser = (data, isMsr) => {
        const dataLength = data.length;
        let result = [];
        let iTLV = 0;
        let iTag;
        let bTag = true;
        let byteValue;
        let lengthValue;
        let tagBytes = null;
        let TagBuffer = [];

        while (iTLV < dataLength) {
            byteValue = data[iTLV];

            if (bTag) {
                iTag = 0;
                let bMoreTagBytes = true;

                if (byteValue === 0) {
                    //First byte of tag cannot be zero.
                    break;
                }

                while (bMoreTagBytes && (iTLV < dataLength)) {
                    byteValue = data[iTLV];
                    iTLV++;

                    TagBuffer[iTag] = byteValue;

                    bMoreTagBytes = (iTag === 0) ? ((byteValue & this.moreTagBytesFlag1) == this.moreTagBytesFlag1) :
                        ((byteValue & this.moreTagBytesFlag2) == this.moreTagBytesFlag2);

                    iTag++;
                }

                tagBytes = this.convertArrayToHexString(TagBuffer.slice(0, iTag));
                bTag = false;
            }
            else {
                lengthValue = 0;

                if ((byteValue & this.moreLengthFlag) == this.moreLengthFlag) {
                    let nLengthBytes = byteValue & this.oneByteLengthMask;
                    iTLV++;
                    let iLen = 0;

                    while ((iLen < nLengthBytes) && (iTLV < dataLength)) {
                        byteValue = data[iTLV];
                        iTLV++;
                        lengthValue = ((lengthValue & 0x000000FF) << 8) + byteValue;
                        iLen++;
                    }
                }
                else {
                    lengthValue = byteValue & this.oneByteLengthMask;
                    iTLV++;
                }

                if (tagBytes) {
                    let tagByte = TagBuffer[0];

                    let endIndex = ((iTLV + lengthValue) > dataLength) ? dataLength : iTLV + lengthValue;

                    let len = endIndex - iTLV;
                    let valueBytes = (len > 0) ? this.convertArrayToHexString(data.slice(iTLV, iTLV + len)) : "";

                    result.push({
                        "tag": tagBytes,
                        "tagLength": (!lengthValue) ? (valueBytes.length + 1 / 2) : lengthValue,
                        "tagValue": this.hexOrAsciiFormatter(tagBytes, valueBytes, isMsr)
                    });

                    if ( !((tagByte & this.constructedFlag) == this.constructedFlag) ) {
                        iTLV += lengthValue;
                    }
                }

                bTag = true;
            }
        }
        
        return result;
    }

    hexOrAsciiFormatter = (tagBytes, valueBytes, isMsr) => {
        switch(tagBytes) {
            case "DFDF1A":
                return `${valueBytes} ${this.trxStatusToString[ parseInt(valueBytes, 16) ]}`
            case "DFDF4D":
            case "5F20":
                return this.hexToAscii(valueBytes);
            case "DFDF25":
                return (isMsr) ? this.hexToAscii( (valueBytes ? valueBytes.substring(0, 14) : valueBytes) ) : valueBytes;
            case "DFDF40":
                return (valueBytes === 0x80) ? `${valueBytes}  CBC-MAC checked in ARQC online response` : (valueBytes === 0x01);
            default:
                return valueBytes;
        }
    }
}

export default EmvParser;