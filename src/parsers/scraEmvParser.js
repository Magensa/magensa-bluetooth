import TrxStatusParser from './trxStatusParser';

const dukptFailureBase = "Failure, DUKPT scheme is ";
const invalidBase = "Invalid ";


class ScraEmvParser extends TrxStatusParser {
    constructor(device, callBacks) {
        super(device, callBacks);

        this.emvResultCodes = Object.freeze({
            0x81: dukptFailureBase + "not loaded",
            0x82: dukptFailureBase + "loaded but all of its keys have been used",
            0x83: dukptFailureBase + "not loaded (Security Level not 3 or 4)",
            0x84: invalidBase + "Total Transaction Time Field",
            0x85: invalidBase + "Card Type Field",
            0x86: invalidBase + "Options Field",
            0x87: invalidBase + "Amount Authorized Field",
            0x88: invalidBase + "Transaction Type Field",
            0x89: invalidBase +  "Cash Back Field",
            0x8A: invalidBase + "Transaction Currency Code Field",
            0x8E: invalidBase + "Reporting Option",
            0x8F: "Transaction Already In Progress",
            0x91: invalidBase + "Device Serial Number",
            0x96: invalidBase + "System Date and Time"
        });
    }

    parseEmvData = (emvData, isArqc) => (isArqc) ? ({
        arqcData: this.convertArrayToHexString( emvData.slice(11) ),
        arqcDataParsed:
            this.tlvParser(
                emvData.slice(13),
                true
            )
        })
        :
        ({
            signatureRequired: (emvData[11] === 1),
            batchData: this.convertArrayToHexString( emvData.slice(11) ),
            batchDataParsed: this.tlvParser( emvData.slice(14), true )
        })

    //Read Result Code from startTransaction command and return to user. If not 0 - return error message.
    parseEmvCommandResponse = resp =>  {
        let resultCode = resp.slice(4, 6);

        //result code of [0x00, 0x00] is success.
        return (parseInt( resultCode.join("") )) ?
            ({
                code: parseInt(this.convertArrayToHexString( resultCode ), 16),
                name: "StartTransactionError",
                message: this.emvResultCodes[ resultCode[1] ] || "Transaction Error Message not yet documented"
            })
            :
            ({
                code: 0,
                message: "Success, transaction has started"
            })
    }
}

export default ScraEmvParser;