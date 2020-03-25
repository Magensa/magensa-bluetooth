import { magTekTags } from "../configurations/emvTags";
import SwipeParser from './swipeParser';

class EmvParser extends SwipeParser {
    constructor() {
        super();
        this.magTekTags = magTekTags;

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
            0x1E: "Manual Selected Cancelled by Host",
            0x1F: "Manual Selection Timeout",
            0x21: "Waiting for Card Cancelled by Host",
            0x22: "Waiting for Card Timeout",
            0x23: "Cancelled by Card Swipe (MSR)",
            0xFF: "Unknown Transaction Status"
        });
    }

    tlvParser = (data, isMsr) => {
        let dataLength = data.length;
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
                        "tagLabel": (this.magTekTags[tagBytes]) ? this.magTekTags[tagBytes] : "Tag Name not yet documented",
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
                return `${valueBytes} ${this.trxStatusToString[parseInt(valueBytes, 16)]}`
            case "DFDF4D":
                return this.hexToAscii(valueBytes);
            case "DFDF25":
                return (isMsr) ? this.hexToAscii(valueBytes) : valueBytes;
            case "5F20":
                return this.hexToAscii(valueBytes);
            default:
                return valueBytes;
        }
    }
}

export default EmvParser;