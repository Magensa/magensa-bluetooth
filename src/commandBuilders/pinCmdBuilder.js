import PinStatusParser from '../parsers/pinStatusParser';

class PinCmdBuilder extends PinStatusParser {
    constructor(device, callBacks) {
        super(device, callBacks);
    }

    buildSwipeCommand = ({ timeout, isFallback, toneChoice, displayType }) => ([ 
        0x01, 0x03, (timeout || 0x3C),
        (isFallback === true) ? 0x04 : (typeof(displayType) !== 'undefined') ? this.displayTypes[ displayType.toLowerCase() ] : 0x02,
        (typeof(toneChoice) !== 'undefined') ? this.toneChoice[ toneChoice.toLowerCase() ] : 0x01
    ]);

    buildEmvCommand = ({ 
        timeout, 
        pinTimeout, 
        cardType, 
        transactionType, 
        cashBack, 
        currencyCode,
        toneChoice, 
        isQuickChip, 
        authorizedAmount, 
        emvOptions,
        taxAmount,
        taxPercent,
        tipAmount,
        balanceBeforeGenAC,
        balanceAfterGenAC,
        trxCategoryCode
    }) => new Promise((resolve, reject) => {
        this.isQuickChipTransaction = (isQuickChip === false) ? false : true;
        //TODO: Re-examine scope. May be able to limit this flag to this function.
        this.hasTip = (this.hasTip || (typeof(tipAmount) !== 'undefined'));
        const validator = this.validateAmount(reject);

        let command = [ 
            0x01, 0xA2,
            (timeout || 0x3C),
            (pinTimeout || 0x14),
            0x00,
            (typeof(toneChoice) !== 'undefined') ? this.toneChoice[ toneChoice.toLowerCase() ] : 0x01,
            (cardType) ? this.cardTypes( cardType.toLowerCase() ) : this.cardTypes("all"),
            (typeof(emvOptions) !== 'undefined') ? this.emvOptions[ emvOptions.toLowerCase() ] : 0x00
        ];
        
        const authAmount = validator(authorizedAmount, 'authorizedAmount', [0x00, 0x00, 0x00, 0x00, 0x01, 0x00]);
        if (typeof(authAmount) === 'undefined')
            return reject(authAmount);
        else
            command = command.concat( authAmount );

        command = (typeof(transactionType) !== 'undefined') ? 
            command.concat(this.transactionTypes[ transactionType.toLowerCase() ])
            : command.concat(0x00)

        const cashbackAmnt = validator(cashBack, 'cashBack', this.newArrayPartial(0x00, 6));
        if (typeof(cashbackAmnt) === 'undefined')
            return reject(cashbackAmnt);
        else
            command = command.concat( cashbackAmnt );

        const balanceBeforeAmnt = validator(balanceBeforeGenAC, 'balanceBeforeGenAC', this.newArrayPartial(0x00, 6));
        if (typeof(balanceBeforeAmnt) === 'undefined')
            return reject(balanceBeforeAmnt);
        else
            command = command.concat( balanceBeforeAmnt );

        const balanceAfterAmnt = validator(balanceAfterGenAC, 'balanceAfterGenAC', this.newArrayPartial(0x00, 6));
        if (typeof(balanceAfterAmnt) === 'undefined')
            return reject(balanceAfterAmnt);
        else
            command = command.concat( balanceAfterAmnt );

        command = (currencyCode) ? command.concat(( this.currencyCode[ currencyCode.toLowerCase() ] ||  this.currencyCode['default'] ))
            : command.concat(this.currencyCode.dollar);

        command.push( (typeof(trxCategoryCode) !== 'undefined') ? trxCategoryCode : 0x00 );

        command.push( (this.isQuickChipTransaction) ? 0x01 : 0x00 );

        command.push( ((this.hasTip) ? 0x01 : (typeof(cashBack) !== 'undefined') ? 0x02 : 0x00) );


        const taxAmnt = validator(taxAmount, 'taxAmount', this.newArrayPartial(0x00, 6));
        if (typeof(taxAmnt) === 'undefined')
            return reject(taxAmnt);
        else
            command = command.concat( taxAmnt );

        command = (typeof(taxPercent) !== 'undefined') ? 
            (typeof(taxPercent) === 'number') ? command.concat(this.convertNumToAmount(taxPercent, 6)) : command.concat(taxPercent)
        : command.concat( this.newArrayPartial(0x00, 3) );

        command = command.concat( this.newArrayPartial(0x00, 3) );

        const tipAmnt = validator(tipAmount, 'tipAmount', this.newArrayPartial(0x00, 6));
        if (typeof(tipAmnt) === 'undefined')
            return reject(tipAmnt);
        else
            command = command.concat( tipAmnt );

        command = command.concat( this.newArrayPartial(0x00, 9) );

        return resolve(command);
    });

    buildPinCommand = ({
        languageSelection,
        displayType,
        timeout,
        maxPinLength,
        minPinLength,
        toneChoice,
        waitMessage,
        verifyPin,
        pinBlockFormat
    }) => {

        const pinDisplayOptions = Object.freeze({
            "enterpin": 0x00,
            "enterpinamount": 0x01,
            "reenterpinamount": 0x02,
            "reenterpin": 0x03,
            "verifypin": 0x04
        });

        const pinCmd = [
            0x01, 0x04,
            (timeout || 0x1E),
            ((displayType) ? (pinDisplayOptions[ displayType.toLowerCase() ] || 0x00): 0x00),
            (this.findPinLength(maxPinLength, minPinLength)),
            (typeof(toneChoice) !== 'undefined') ? this.toneChoice[ toneChoice.toLowerCase() ] : 0x01,
            (this.buildPinOptionsByte(languageSelection, waitMessage, verifyPin, pinBlockFormat))
        ];

        console.log('[PIN CMD] Built PIN Command: ', pinCmd);

        return pinCmd;
    }

    buildArpcCommand = (len, data) => new Promise((resolve, reject) => {
        this.sendBigBlockData(0xA4, len, data).then(
            () => resolve([0x01, 0xA4, ...this.newArrayPartial(0x00, 10)])
        ).catch(err => reject(err));
    });

    buildTipOrCashbackCmd = ({
        timeout,
        commandType,
        toneChoice,
        transactionAmount,
        calculatedTaxAmount,
        taxRate,
        tipSelectionMode,
        leftButton,
        middleButton,
        rightButton
    }) => new Promise((resolve, reject) => {
        const validator = this.validateAmount(reject);

        const propsToValidate = [
            {
                prop: commandType,
                propName: 'commandType',
                validTypes: ['string'],
                condition: true,
                validValues: ['tip', 'cashback']
            },
            {
                prop: tipSelectionMode,
                propName: 'tipSelectionMode',
                condition: (commandType.toLowerCase() !== 'cashback'),
                validTypes: ['string'],
                validValues: ['percent', 'amount']
            },
            {
                prop: taxRate,
                propName: 'taxRate',
                condition: true,
                validTypes: ['number', 'object']
            }
        ];

        this.validateRequiredInputs(propsToValidate).then(() => {
            let tipCashbackCmd = [
                0x01, 0xA0,
                (typeof(timeout) !== 'undefined') ? timeout : 0x1E,
                (typeof(toneChoice) === 'string') ? this.toneChoice[ toneChoice.toLowerCase() ] : this.toneChoice.onebeep
            ];

            const trxAmnt = validator(transactionAmount, 'transactionAmount');
            if (typeof(trxAmnt) === 'undefined')
                return reject(trxAmnt);
            else
                tipCashbackCmd = tipCashbackCmd.concat( trxAmnt );
    
            const calcTaxAmnt = validator(calculatedTaxAmount, 'calculatedTaxAmount');
            if (typeof(calcTaxAmnt) === 'undefined')
                return reject(calcTaxAmnt);
            else
                tipCashbackCmd = tipCashbackCmd.concat( calcTaxAmnt );
            
            tipCashbackCmd = (typeof(taxRate) === 'number') ? 
                tipCashbackCmd.concat(this.convertNumToAmount(taxRate, 6)) : tipCashbackCmd.concat(taxRate);

            tipCashbackCmd.push(
                (typeof(tipSelectionMode) === 'undefined') ? 0x00 : (tipSelectionMode === 'percent') ? 0x00 : 0x01
            )

            tipCashbackCmd = (typeof(leftButton) !== 'undefined') ? 
                (typeof(leftButton) === 'number') ? tipCashbackCmd.concat(this.convertNumToAmount(leftButton, 4)) : leftButton
            : tipCashbackCmd.concat(this.newArrayPartial(0x00, 2));

            tipCashbackCmd = (typeof(middleButton) !== 'undefined') ?
                (typeof(middleButton) === 'number') ? tipCashbackCmd.concat(this.convertNumToAmount(middleButton, 4)) : middleButton
            : tipCashbackCmd.concat(this.newArrayPartial(0x00, 2));
                
            tipCashbackCmd = (typeof(rightButton) !== 'undefined') ? 
                (typeof(rightButton) === 'number') ? tipCashbackCmd.concat(this.convertNumToAmount(rightButton, 4)) : rightButton
            : tipCashbackCmd.concat(this.newArrayPartial(0x00, 2));

            tipCashbackCmd = tipCashbackCmd.concat(this.newArrayPartial(0x00, 26));

            return resolve(tipCashbackCmd);
        }).catch(err => reject(err))
    });

    buildDisplayCmd = ({ displayTime, messageId, }) => new Promise( (resolve, reject) => 
        (typeof(messageId) === 'undefined') ? 
            reject( missingRequiredFields("messageId") ) 
            : resolve([
                0x01, 0x07,
                (typeof(displayTime) !== 'undefined') ? displayTime : 0x0F,
                messageId
            ])
        );
}

export default PinCmdBuilder;