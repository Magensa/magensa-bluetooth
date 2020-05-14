import ScraEmvParser from '../parsers/scraEmvParser';


class ScraCmdBuilder extends ScraEmvParser {
    constructor(device, callBacks) {
        super(device, callBacks);

        this.emvOptions = Object.freeze({
            'normal': 0x00,
            'bypasspin': 0x01,
            'forceonline': 0x02,
            'quickchip': 0x80,
            'pinbypassquickchip': 0x81,
            'forceonlinequickchip': 0x82
        });

        this.statusVerbosity = Object.freeze({
            "minimum": 0x00,
            'medium': 0x01,
            'verbose': 0x02
        });

        this.emvCommandBase = [0x49, 0x19, 0x00, 0x00, 0x03, 0x00, 0x00, 0x13];
    }

    amountHelper = (authAmount, trxType, defaultValue) => {
        switch(typeof(authAmount)) {
            case 'number':
                return this.convertNumToAmount(authAmount);
            case 'object':
                return authAmount;
            case 'string':
                return this.hexToBytes(authAmount);
            case 'undefined':
                const trxTypeLower = (typeof(trxType) === 'string') ? trxType.toLowerCase() : "";
                return (trxTypeLower === 'refund' || trxTypeLower === 'cashback' || trxTypeLower === 'contactlesscashback') ? 
                    this.newArrayPartial(0x00, 6) : defaultValue;
            default:
                return defaultValue;
        }
    }

    buildEmvCommand = ({ 
        timeout, 
        cardType, 
        transactionType, 
        cashBack, 
        currencyCode, 
        reportVerbosity,
        emvOptions,
        authorizedAmount
    }) => {
        
        let command = [ 
            ...this.emvCommandBase, 
            timeout || 0x3C, 
            (cardType) ? this.cardTypes( cardType.toLowerCase() ) : 0x03,
            (typeof(emvOptions) !== 'undefined') ? (this.emvOptions[ emvOptions.toLowerCase() ]) : 0x80
        ];

        command = command.concat( this.amountHelper(authorizedAmount, transactionType, [0x00, 0x00, 0x00, 0x00, 0x01, 0x00]) );

        command = (transactionType) ? 
            command.concat(this.transactionTypes[ transactionType.toLowerCase() ] || 0x00) 
            : command.concat(0x00)

        command = command.concat( this.amountHelper(cashBack, transactionType, this.newArrayPartial(0x00, 6)) );

        command = (currencyCode) ? command.concat( this.currencyCode[ currencyCode.toLowerCase() ] ||  this.currencyCode['default'] )
            : command.concat( [0x08, 0x40] );

        command.push(
            (reportVerbosity) ? ( this.statusVerbosity[ reportVerbosity.toLowerCase() ] || 0x00 ) : 0x01
        );
        
        return command;
    }

    buildArpcCommand = (len, data) => ([0x49, (len + 6), 0x00, 0x00, 0x03, 0x03, ((len >> 8) & 0xFF), (len & 0xFF), ...data ]);

    buildDateTimeCommand = specificTime => {
        let dateTimeCommand = [0x49, 0x22, 0x00, 0x00, 0x03, 0x0C, 0x00, 0x1C];
        dateTimeCommand = dateTimeCommand.concat( this.newArrayPartial(0x00, 17) );
        //Format Date segment below
        const current = (specificTime instanceof Date) ? specificTime : new Date();

        //Month (zero based index, so add 1).
        dateTimeCommand.push( 
            this.castDecToHex( current.getMonth() + 1)
        );

        dateTimeCommand.push(
            this.castDecToHex( current.getDate() )
        );

        dateTimeCommand.push(
            this.castDecToHex( current.getHours() )
        );

        dateTimeCommand.push(
            this.castDecToHex( current.getMinutes() )
        );

        dateTimeCommand.push(
            this.castDecToHex( current.getSeconds() )
        );

        //Currently unused offset.  0x00 - 0x06 is valid - but is not examined.
        dateTimeCommand.push(0x00);

        //Year is based upon 2008 === 0x00.
        dateTimeCommand.push(
            this.castDecToHex( current.getFullYear() - 2008 )
        )

        //MAC - for all devices except two exceptions (see documentation) this can be padded with zeros.
        dateTimeCommand = dateTimeCommand.concat( this.newArrayPartial(0x00, 4) );
        
        return dateTimeCommand;
    }
}

export default ScraCmdBuilder;
