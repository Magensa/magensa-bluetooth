class Utilities {
    constructor() {

        this.rleFormats = Object.freeze({
            0x00: false,    //Normal
            0x01: true,     //RLE format
            0x02: false,    //Notify Uncompressed
            0x03: true      //Notify RLE format
        });

     };

     logDeviceState = logInfo => {
        let logEvent = new CustomEvent("deviceLog", { 
            bubbles: true,
            detail: logInfo 
        });

        window.dispatchEvent(logEvent);
    }

    convertArrayToHexString = array =>
        Array.from(array, byte =>
            ('0' + (byte & 0xFF).toString(16)).slice(-2)
        ).join('').toUpperCase()
    
    readTwoByteLength = twoBytes => (twoBytes[0] << 8) | twoBytes[1];

    bufferToUtf8 = arrayBuffer =>
        new TextDecoder('utf-8').decode(Uint8Array.from(arrayBuffer));

    castDecToHex = num => parseInt( num.toString(16), 16);

    newArrayPartial = (num, repetitions) => new Array(repetitions).fill(num);

    readByteArray = dataView => {
        let valueArray = [];
        
        for (let i = 0; i < dataView.byteLength; i++) {
            valueArray.push(dataView.getUint8(i));
        }

        return valueArray;
    }

    hexToAscii = hexString => {
        let asciiResp = '';
        for (let i = 0; (i < hexString.length && hexString.substr(i, 2) !== '00'); i += 2) {
            asciiResp += String.fromCharCode(
                parseInt(hexString.substr(i, 2), 16)
            )
        }

        return asciiResp.trim();
    }

    hexToBytes = hexStr => {
        let bytes = [];
        for (let current = 0; current < hexStr.length; current += 2)
            bytes.push( parseInt(hexStr.substr(current, 2), 16) );
    
        return bytes;
    }

    decodeRLE = arraySegment => {
        let returnSegment = [ arraySegment[0] ];
    
        let nextIndex = 0;
        let initialLength = arraySegment.length;
    
        for (let i = 1; i < initialLength; i++) {
            nextIndex = i + 1;
    
            if (nextIndex + 1 < initialLength) {
    
                if (arraySegment[i] === arraySegment[nextIndex]) {
    
                    returnSegment.push(
                        ...this.newArrayPartial(arraySegment[i], arraySegment[nextIndex + 1])
                    );
    
                    //adjust index accordingly, prior to being incremented by the iteration.
                    i = nextIndex + 1;
                }
                else returnSegment.push(arraySegment[i])
            }
            else returnSegment.push(arraySegment[i]);
        }

        return returnSegment;
    }

    buildInitialDataArray = checkForRle => {
        let returnArray = [];

        for (let i = Math.min(...Object.keys(this.rawData)); i < this.maxBlockId; i++) {
            returnArray = returnArray.concat(...this.rawData[i])
        }

        return (!checkForRle) ? returnArray : this.checkRle(returnArray);
    }

    checkRle = returnArray => (this.rleFormats[ this.initialNotification[0] ]) ? this.decodeRLE(returnArray) : returnArray;

    convertCurrencyCode = currencyString => {
        let currency = currencyString.toLowerCase();

        return (currency === 'us') ? [0x08, 0x40] : 
            (currency === 'euro') ? [0x09, 0x78] : [0x00, 0x00];
    }

    //Convert number to 6 byte array.
    convertNumToAmount = num => {
        let stringNum = num.toString();
        let returnArr = [];
        while (stringNum.length < 12)
            stringNum = "0" + stringNum;

        for (let i = 0; i < stringNum.length; i +=2)
            returnArr.push(
                parseInt(stringNum.substr(i, 2), 16)
            )
    
        return returnArr;
    }

    delayPromise = (delay, passedValue) =>
        new Promise( resolve => {
            setTimeout( () => resolve(passedValue), delay);
        });
}

export default Utilities;