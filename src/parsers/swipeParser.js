import Utilities from "../utils";

class SwipeParser extends Utilities {
    constructor() {
        super();
    }

    formatExpPAN = rawData => {
        let stringData = (typeof rawData === 'object') ? this.bufferToUtf8(rawData.slice(4)) : rawData;
    
        if (stringData.indexOf(';') !== -1) {
            let formattedString = this.splitExpPAN(stringData);
    
            return {
                maskedPAN: formattedString[0],
                Last4: formattedString[1],
                expirationDate: formattedString[2],
                serviceCode: formattedString[3]
            }
        }
        else return {
            maskedPAN: "",
            Last4: "",
            expirationDate: "",
            serviceCode: ""
        }
    }

    splitExpPAN = stringData => {
        if (stringData.length > 3) {
            let expPAN = stringData.replace(';','').replace('?','').split('=');
            let exp = expPAN[1].slice(0, 4);
            let serviceCode = expPAN[1].slice(4, 7);
            let formattedExp = exp.slice(-2) + '/' + exp.slice(0, 2);
            let maskedPAN = expPAN[0];
            let lastFour = expPAN[0].slice(-4);

            return [maskedPAN, lastFour, formattedExp, serviceCode]
        }
        else return ["Not Found", "Not Found", "Not Found", "Not Found"]
    };
}

export default SwipeParser;