import ParsePinConfig from './pinConfiguration';
import { unknown } from '../utils/constants';

class PinStatusParser extends ParsePinConfig {
    constructor(device, callBacks) {
        super(device, callBacks);

        this.operationStatus = Object.freeze({
            0x00: "Ok",
            0x01: "Cardholder Cancel",
            0x02: "Timeout",
            0x03: "Host Cancel",
            0x04: "Verify fail",
            0x05: "Keypad Security",
            0x06: "Calibration Done",
            0x07: "Write with duplicate RID and index",
            0x08: "Write with corrupted Key",
            0x09: "CA Public Key reached maximum capacity",
            0x0A: "CA Public Key read with invalid RID or Index"
        });

        this.ACKSTS = Object.freeze({
            0x00: "Ok",
            0x15: "RID error/Index not found",
            0x80: "Device Error: error, tamper, missing certificate or incorrect signature detected",
            0x81: "Device not idle",
            0x82: "Data Error or Bad Paramater(s)",
            0x83: "Length Error: data size is either too small, too large, incomplete, or OID of the cert doesn't match predefined OID",
            0x84: "PAN Exists",
            0x85: "Missing or Incorrect Key",
            0x86: "Device Busy",
            0x87: "Device Locked",
            0x88: "Auth required",
            0x89: "Bad Auth",
            0x8A: "Device Not Available",
            0x8B: "Amount Needed - If PIN amount is required, no amount has been set",
            0x8C: "Battery is critically low",
            0x8D: "Device is resetting",
            0x90: "Certificate does not exist",
            0x91: "Expired (Cert/CRL)",
            0x92: "Invalid (Cert/CRL/Message)",
            0x93: "Revoked (Cert/CRL)",
            0x94: "CRL does not exist",
            0x95: "Certificate exists",
            0x96: "Duplicate KSN/Key"
        });

        this.pinDisplayMessages = Object.freeze({
            0x00: "Hands Off",
            0x01: "Approved",
            0x02: "Declined",
            0x03: "Cancelled",
            0x04: "Thank You",
            0x05: "PIN Invalid",
            0x06: "Processing",
            0x07: "Please Wait"
        });

        this.pinCommandIds = Object.freeze({
            0x01: "responseACK",
            0x02: "clearSession",
            0x03: "swipe",
            0x04: "requestPinEntry",
            0x05: "cancelCommand",
            0x06: "requestCardholderSelection",
            0x07: "displayMessage",
            0x08: "requestDeviceStatus",
            0x09: "requestDeviceConfiguration",
            0x0A: "requestMsrData",
            0x0B: "getChallenge",
            0x07: "displayMessage",
            0xA2: "emvTransactionStatus",
            0xAB: "requestEmvData",
            0x30: "getKsn",
            0x05: "cancelCommand",
            0x1A: "requestDeviceInfo",
            0x10: "sendBigBlockData"
        });

        this.cardTypesEnum = Object.freeze({
            0x00: "Other",
            0x01: "Financial",
            0x02: "AAMVA",
            0x03: "Manual",
            0x04: "Unknown",
            0x05: "ICC",
            0x06: "Contactless ICC - EMV",
            0x07: "Financial MSR + ICC",
            0x08: "Contactless ICC - MSD"
        });

        this.deviceState = Object.freeze({
            0x00: "Idle",
            0x01: "Session",
            0x02: "Wait For Card",
            0x03: "Wait For PIN",
            0x04: "Wait For Selection",
            0x05: "Displaying Message",
            0x06: "Test (Reserved for future use)",
            0x07: "Manual Card Entry",
            0x09: "Wait Cardholder Entry",
            0x0A: "Chip Card",
            0x0B: "ICC Kernel Test",
            0x0C: "EMV Transaction",
            0x0D: "Show PAN"
        });

        this.pinKeyStatusEnum = Object.freeze({
            "00": "PIN Key OK",
            "01": "PIN Key Exhausted",
            "10": "No PIN Key",
            "11": "PIN Key Not Bound"
        });

        this.msrKeyStatusEnum = Object.freeze({
            "00": "MSR Key OK",
            "01": "MSR Key Exhausted",
            "10": "No MSR Key",
            "11": "MSR Key Not Bound"
        });

        this.cardDataIds = Object.freeze({
            0x01: "track1",
            0x02: "track2",
            0x03: "track3",
            0x04: "encryptedTrack1",
            0x05: "encryptedTrack2",
            0x06: "encryptedTrack3",
            0x07: "magnePrint",
            0x40: "encryptedPanAndExp",
            0x41: "serialNumber",
            0x63: "ksnAndMagnePrintStatus",
            0x64: "CBC-MAC"
        });

        this.cardholderStatusIds = Object.freeze({
            0x01: "Waiting for amount confirmation selection",
            0x02: "Amount confirmation selected",
            0x03: "Waiting for multi-payment ICC Application selection",
            0x04: "ICC Application selected",
            0x07: "Waiting for language selection",
            0x08: "Language selected",
            0x09: "Waiting for credit/debit selection",
            0x0A: "Credit/Debit selected",
            0x0B: "Waiting for Pin Entry for ICC",
            0x0C: "PIN entered for ICC",
            0x0D: "Waiting for Pin Entry for MSR",
            0x0E: "PIN entered for MSR"
        });

        this.bufferTypes = Object.freeze({
            0x02: "Device Certificate",
            0x32: "Set BIN (MAC)",
            0x42: "CSR",
            0xA1: "EMV data in TLV format, Tag Data (MAC)",
            0xA2: "RESERVED",
            0xA3: "RESERVED",
            0xA4: "EMV data in TLV format, Authorization Request (ARQC)",
            0xA5: "CA Public Key (MAC)",
            0xAB: "EMV data in TLV format, Batch Data"
        });

        this.cardDataObj = {};

        this.arqcArriving = false;
        this.batchDataArriving = false;

        this.arqcTotalLen = 0;
        this.batchTotalLen = 0;

        this.statusEnum = Object.freeze({
            ok: 0x00,
            empty: 0x01,
            error: 0x02,
            disabled: 0x03
        });

        this.convertStatusToString = Object.freeze({
            0x00: "Ok",
            0x01: "Empty",
            0x02: "Error",
            0x04: "Disabled"
        });
    }

    findEmvCardholderStatus = cardHolderStatusByte =>  ({
        emvCardholderStatus: (this.cardholderStatusIds[ cardHolderStatusByte ] || `${unknown}/Undocumented Cardholder Interaction Status ID: ${cardHolderStatusByte}`)
    });

    findOperationStatus = statusId => ({
        operationStatus: (this.operationStatus[ statusId ] || `${unknown} Operation Status`)
    });

    parseDisplayMessageDone = displayStatus => this.findOperationStatus(displayStatus[2]);

    parseEmvCompletion = commandResp => {
        //TODO:
        console.log("[!-!-!-!- emvCompletion -!-!-!-!", commandResp);
        return ({

        });
    }

    formatSerialNumber = commandResp => {
        this.requestedSn = {
            serialNumber: this.findNullTerminatedString(commandResp)
        }
        
        this.getSerialNumber = true;
        return;
    }

    formatKsnAndSn = commandResp => {
        this.requestedKsn = {
            ksn: this.convertArrayToHexString( commandResp.slice(2, 12) ),
            serialNumber: this.convertArrayToHexString( commandResp.slice(12, 20) )
        };

        this.getKsnAvailable = true;
        return;
}

    handleBigBlockBegin = bigBlockData => {
        switch(bigBlockData[1]) {
            case 0xA4:
                this.arqcArriving = true;
                this.arqcTotalLen = this.readTwoByteLength([ bigBlockData[5], bigBlockData[4] ]);
                break;
            case 0xAB:
                this.batchDataArriving = true;
                this.batchTotalLen = this.readTwoByteLength([ bigBlockData[5], bigBlockData[4] ]);
                break;
            case 0x18:
            case 0x20:
            case 0x21:
                //Debug data. Ignore.
                break;
            default:
                this.transactionStatusCallback({
                    bufferType: (this.bufferTypes[ bigBlockData[1] ] || "Buffer type not documented")
                });
                break;
        }

        return;
    }

    handleArqcBigBlockFinish = () => {
        const arqc = this.buildInitialDataArray(false);
        const dataForArqc = this.convertArrayToHexString( arqc );

        this.logDeviceState(`[ARQC]: ${dataForArqc}`);

        this.cardDataObj = {
            ...this.cardDataObj,
            arqcData: dataForArqc,
            arqcDataParsed: this.tlvParser(
                arqc.slice(2)
            )
        }

        this.rawData = {};

        this.arqcArriving = false;
        return (!this.isQuickChipTransaction) ? this.transactionCallback( this.cardDataObj ) : void(0);
    }

    handleBatchBigBlockFinish = () => {
        const batch = this.buildInitialDataArray(false);
        const dataForBatch = this.convertArrayToHexString( batch );

        this.logDeviceState(`[BATCH DATA]: ${dataForBatch}`);

        this.transactionHasStarted = false;

        const parsedBatchData = this.tlvParser(
            batch.slice(2)
        );

        const isSignatureRequired = parsedBatchData.find( ({ tag }) => tag === "DFDF40");

        this.cardDataObj = (isSignatureRequired) ? ({
            ...this.cardDataObj,
            batchData: dataForBatch,
            batchDataParsed: parsedBatchData,
            signatureRequired: (isSignatureRequired === 0x01)
        }) : ({
            ...this.cardDataObj,
            batchData: dataForBatch,
            batchDataParsed: parsedBatchData
        });

        this.rawData = {};

        this.batchDataArriving = false;

        return this.transactionCallback( this.cardDataObj );
    }

    handleBigBlockFinish = () => {
        if (this.arqcArriving) {
            return this.handleArqcBigBlockFinish();
        }
        else if (this.batchDataArriving) {
           return this.handleBatchBigBlockFinish();
        }
    }

    parseEmvCardholderInteractionStatus = cardholderResp => {
        switch(cardholderResp[1]) {
            case 0x02: 
                return ({
                    ...this.findEmvCardholderStatus(cardholderResp[1]),
                    amountConfirmed: (cardholderResp[4] === 0x01) ? true : (cardholderResp[4] === 0x02) ? false : "Unknown/Undocumented Amount Confirmed Status"
                });
            case 0x04:
                return ({
                    ...this.findEmvCardholderStatus(cardholderResp[1]),
                    applicationOrLabelName: this.bufferToUtf8( cardholderResp.slice(4) )
                });
            case 0x0A:
                return ({
                    ...this.findEmvCardholderStatus(cardholderResp[1]),
                    methodSelected: (cardholderResp[4] === 0x01) ? "Credit" : 
                    (cardholderResp[4] === 0x02) ? "Debit" : `${unknown}/Undocumented payment method selected`
                });
            case 0x20:
                return ({
                    ...this.findEmvCardholderStatus(cardholderResp[1]),
                    tlvData: this.tlvParser( cardholderResp.slice(4) ) 
                });
            default:
                return (typeof cardholderResp[4] === 'undefined') ? this.findEmvCardholderStatus(cardholderResp[1]) 
                    : ({
                        ...this.findEmvCardholderStatus(cardholderResp[1]),
                        undocumentedData: this.convertArrayToHexString( cardholderResp.slice(4) )
                    });
        }
    }

    parseCardStatusReport = cardStatus => (cardStatus.length < 4) ?  
        this.findOperationStatus(cardStatus[2])
        : ({
            ...this.findOperationStatus(cardStatus[2]),
            cardStatus: (cardStatus[2] === 0x00) ? "Ok" : "Error",
            cardType: this.cardTypesEnum[ cardStatus[3] ]
        });

    parseAckResponse = ackResp => ({
        code: ackResp[1],
        message: this.ACKSTS[ ackResp[1] ],
        commandType: ( this.pinCommandIds[ ackResp[2] ] || "Device error or command type not documented" )
    });

    parseDeviceStateReport = deviceResp => ({
        deviceState: this.deviceState[ deviceResp[1] ], 
        sessionState: this.parseSessionState(
            this.decimalToBinary( deviceResp[2] )
        ),
        deviceStatus: this.parseDeviceStatus(
            this.decimalToBinary(deviceResp[3])
        ),
        deviceCertStatus: this.parseCertStatus( 
            this.decimalToBinary( deviceResp[4] )
        ),
        hardwareStatus: this.parseHardwareStatus(
            this.decimalToBinary(deviceResp[5])
        ),
        additionalInfo: this.parseAdditionalInfo(
            this.decimalToBinary(deviceResp[6])
        )
    });

    parseSessionState = binaryString => ({
        powerDidChange: this.stringNumToBool( binaryString[0] ),
        cardDataIsAvailable: this.stringNumToBool( binaryString[4] ),
        panParsedFromCard: this.stringNumToBool( binaryString[5] ),
        externalPanSent: this.stringNumToBool( binaryString[6] ),
        amountWasSent: this.stringNumToBool( binaryString[7] )
    });

    parseCertStatus = binaryString => ({
        msrCrlCertExists: this.stringNumToBool( binaryString[0] ),
        pinCrlCertExists: this.stringNumToBool( binaryString[1] ),
        mfgUnbindCertExists: this.stringNumToBool( binaryString[3] ),
        msrCaCertExists: this.stringNumToBool( binaryString[4] ),
        pinCaCertExists: this.stringNumToBool( binaryString[5] ),
        deviceCaCertExists: this.stringNumToBool( binaryString[6] ),
        deviceCertExists: this.stringNumToBool( binaryString[7] )
    });

    parseDeviceStatus = binaryString => (binaryString !== "00000000") ? ({
        pinKeyStatus: this.pinKeyStatusEnum[ binaryString.slice(6) ],
        msrKeyStatus: this.msrKeyStatusEnum[ binaryString.slice(4, 6) ],
        tamperDetected: this.stringNumToBool( binaryString[3] ),
        isAuthenticated: this.stringNumToBool( binaryString[1] ),
        deviceErrorDetected: this.stringNumToBool( binaryString[0] )
    })
    : "Ok";

    parseHardwareStatus = binaryString => ({
        IE3_only: this.stringNumToBool( binaryString[0] ),
        SRED: this.stringNumToBool( binaryString[1] ),
        MagHeadIsProgrammed: this.stringNumToBool( binaryString[6] ),
        tamperSensorsAreActive: this.stringNumToBool( binaryString[7] )
    });

    parseAdditionalInfo = binaryString => ({
        ICC_AcquirerMasterKeyIsInjected: !this.stringNumToBool( binaryString[7] ),
        ICC_SessionKeyIsActive: !this.stringNumToBool( binaryString[6] ),
        CAPK_EmvDatabaseIsCorrupted: this.stringNumToBool( binaryString[5] ),
        EmvTerminalDatabaseIsCorrupted: this.stringNumToBool( binaryString[4] ),
        cardIsPresentInChipCardConnector: this.stringNumToBool( binaryString[3] )
    });

    parseCardData = partialNotification => {
        const trackKey = (this.cardDataIds[ partialNotification[1] ] || `trackName${unknown}`);

        if (partialNotification[2] === this.statusEnum.ok) {

            switch(trackKey) {
                case "track1":
                    this.cardDataObj = {
                        ...this.cardDataObj,
                        [trackKey]: this.bufferToUtf8(partialNotification.slice(4))
                    }
                    
                    break;
                case "track2":
                    this.cardDataObj = {
                        ...this.cardDataObj,
                        [trackKey]: this.bufferToUtf8(partialNotification.slice(4)),
                        ...this.formatExpPAN(
                            partialNotification
                        )
                    }

                    break;
                case "ksnAndMagnePrintStatus":
                    this.cardDataObj = {
                        ...this.cardDataObj,
                        ksn: this.convertArrayToHexString(partialNotification.slice(4, 14)),
                        magnePrintStatus: this.convertArrayToHexString(partialNotification.slice(-4))
                    }

                    break;
                default:
                    this.cardDataObj = {
                        ...this.cardDataObj,
                        [trackKey]: this.convertArrayToHexString(partialNotification.slice(4))
                    }
            }
        }
        else {
            this.cardDataObj = {
                ...this.cardDataObj,
                [trackKey]: this.convertStatusToString[ partialNotification[2] ]
            }
        }
    }

    parsePinResponse = pinResp => {
        this.logDeviceState(`[PIN Response]: Response from PIN Entry: ${this.convertArrayToHexString(pinResp)}`);
        
        return (pinResp.length > 2) ? ({
            pinData: {
                ...this.findOperationStatus(pinResp[1]),
                pinKsn: this.convertArrayToHexString( pinResp.slice(2, 12) ),
                encryptedPinBlock: this.convertArrayToHexString( pinResp.slice(12, 20) )
            }
        })
        : this.findOperationStatus(pinResp[1]);
    }

    parseCardholderResponse = selectionResp => {
        const deviceKeys = Object.freeze({
            0x71: "Left function key",
            0x72: "Middle function key",
            0x74: "Right function key",
            0x78: "Enter key"
        });

        return (selectionResp.length > 2) ? ({
            ...this.findOperationStatus(selectionResp[1]),
            keyPressed: (deviceKeys[ selectionResp[2] ] || `${unknown}/Undocumented Key`)
        })
        : this.findOperationStatus(selectionResp[1])
    }
}

export default PinStatusParser;