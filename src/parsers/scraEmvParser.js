import TrxStatusParser from './trxStatusParser';
import { unknownUndoc } from '../utils/constants';

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

        this.resultCodes = Object.freeze({
            '0000': "Success",
            '038B': "Invalid Selection Status",
            '038C': 'Invalid Selection Result',
            '038D': "Failure, no transaction currently in progress",
            '038F': "Failure, transaction already in progress",
            '0390': 'Device has no keys',
            '0391': 'Invalid device serial number',
            '0392': 'Invalid type of MAC field',
            '0396': 'Invalid date/time data',
            '0397': 'Invalid MAC',
            '1000': `${unknownUndoc} result`
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
        : ({
            signatureRequired: (emvData[11] === 0x80) ? "CBC-MAC checked in ARQC online response" : (emvData[11] === 0x01),
            batchData: this.convertArrayToHexString( emvData.slice(11) ),
            batchDataParsed: this.tlvParser( emvData.slice(14), true )
        })

    //Read Result Code from startTransaction command and return to user. If not 0 - return error message.
    parseEmvCommandResponse = resp =>  {
        const resultCode = resp.slice(4, 6);

        //result code of [0x00, 0x00] is success.
        return (parseInt( resultCode.join("") )) ?
            ({
                code: parseInt(this.convertArrayToHexString( resultCode ), 16),
                name: "StartTransactionError",
                message: this.emvResultCodes[ resultCode[1] ] || "Transaction Error Message not yet documented"
            }) : ({
                code: 0,
                message: "Success, transaction has started"
            })
    }

    parseUserSelectionRequest = selectionRequest => ({
        userSelectionRequest: {
            selectionType: (selectionRequest[0] === 0x00) ? "Application Selection" : "Language Selection",
            timeRemaining:  selectionRequest[1],
            menuItems: this.convertArrayToHexString(selectionRequest.slice(2))
        }
    })
    
    parseResultCode =  resp => {
        const resultCode = (resp.length > 5) ? this.convertArrayToHexString( resp.slice(4, 6) ) : "1000";

        return ({
            code: parseInt(resultCode, 16),
            message: (this.resultCodes[ resultCode ] || `${unknownUndoc} result code`)
        })
    }
}

export default ScraEmvParser;