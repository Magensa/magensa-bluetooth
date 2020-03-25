import ScraSwipeParser from '../parsers/scraSwipeParser';

class TrxStatusParser extends ScraSwipeParser {
    constructor(device, callBacks) {
        super(device, callBacks);

        this.TrxStatusEnum = Object.freeze({
            0x00: "Transaction Started and Idle",
            0x01: "Card is Inserted",
            0x02: "Error",
            0x03: "Transaction Progress Change",
            0x04: "Waiting for User Response",
            0x05: "Timed Out",
            0x06: "Transaction Complete",
            0x07: "Cancelled by Host",
            0x08: "Card Removed",
            0x09: "Contactless Token Detected, Powering Up Card",
            0x0A: "MSR Swipe Detected"
        });

        this.TrxProgressIndicator = Object.freeze({
            0x00: "No transaction in progress",
            0x01: "Waiting for cardholder to present payment",
            0x02: "Powering up the card",
            0x03: "Selecting the application",
            0x04: "Waiting for user language selection",  //Contact Only
            0x05: "Waiting for user application selection",  //Contact Only
            0x06: "Initiating application",  //Contact Only
            0x07: "Reading application data",  //Contact Only
            0x08: "Offline data authentication",  //Contact Only
            0x09: "Process restrictions",  //Contact Only
            0x0A: "Cardholder verification",  //Contact Only
            0x0B: "Terminal risk management",  //Contact Only
            0x0C: "Terminal action analysis",  //Contact Only
            0x0D: "Generating first application cryptogram",  //Contact Only
            0x0E: "Card action analysis",  //Contact Only
            0x0F: "Online processing",
            0x10: "Waiting online processing response",
            0x11: "Transaction Complete",
            0x12: "Transaction Error",
            0x13: "Transaction Approved",
            0x14: "Transaction Declined",
            0x15: "Transaction Cancelled by MSR Swipe",  //MSR Only
            0x16: "EMV error - Conditions Not Satisfied",  //Contact Only
            0x17: "EMV error - Card Blocked",  //Contact Only
            0x18: "Application selection failed",  //Contact Only
            0x19: "EMV error - Card Not Accepted",  //Contact Only
            0x1A: "Empty Candidate List",
            0x1B: "Application Blocked",
            0x29: "Contactless Remove Card",
            0x2A: "Collision Detected",
            0x2B: "Refer to Mobile Device Prompt",
            0x2C: "Contactless Transaction Complete",
            0x2D: "Request Switch to ICC/MSR - Kernel has refused contactless payment",
            0x2E: "Wrong Card Type (MSD or EMV)",
            0x2F: "No Application Interchange Profile (Tag 82) Received",
            0x31: "Magnetic stripe decoding error.",
            0x3C: "Magnetic stripe decoding during Technical Fallback. Revert to MSR, powering up but not receiving an Answer to Reset from card.",
            0x3D: "Magnetic stripe card decoded during MSR Fallback. Device reverted to MSR, but encountered fatal errors.",
            0x3E: "Magnetic stripe card decoded during a No Fallback MSR read."
        });
    }

    parseTransactionStatus = notification => {
        let dataLen = this.readTwoByteLength([
            notification[1],
            notification[2]
        ]);

        let newNotification = notification.slice(3);

        return (newNotification.length === dataLen) ? this.parseNotifications(newNotification) : this.throwLenErr();
    }

    
    parseNotifications = notificationSlice => {
        let newNotificationSlice = notificationSlice.slice(6);

        let notificationLength = this.readTwoByteLength([
            newNotificationSlice[0],
            newNotificationSlice[1]
        ]);

        let notificationContent = newNotificationSlice.slice(2);
        
        //========================================================================================//
            //notificationContent Format by Index:
            //0: Event => See this.TrxStatusEnum for codes.
            //1: Current Operation Time remaining in seconds.
            //2: Current Transaction Progress Indicator => See this.TrxProgressIndicator for codes.
            //3 - 4: Final Status => No documentation provided for this (usually is 0000).
        //========================================================================================//

        let trxStatusCode = notificationContent[0];
        let trxProgressCode = notificationContent[2];

        return (notificationContent.length === notificationLength) ?  {
            transactionStatus: {
                statusCode: trxStatusCode,
                statusMsg: ( this.TrxStatusEnum[ trxStatusCode ] || "Status code message not documented" ),
                progressCode: trxProgressCode,
                progressMsg: ( this.TrxProgressIndicator[ trxProgressCode ] || "Progress code message not documented" )
            }
        }
        :
        this.throwLenErr();
    }
}

export default TrxStatusParser;