import Utilities from "../utils";

class SwipeParser extends Utilities {
    constructor() {
        super();
    }

    formatExpPAN = rawData => {
        let stringData = (typeof rawData === 'object') ? this.bufferToUtf8(rawData.slice(4)) : rawData;
    
        if (stringData.indexOf(';') !== -1) {
            const formattedString = this.splitExpPAN(stringData);
    
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
            const expPAN = stringData.replace(';','').replace('?','').split('=');
            const exp = expPAN[1].slice(0, 4);
            const serviceCode = expPAN[1].slice(4, 7);
            const formattedExp = exp.slice(-2) + '/' + exp.slice(0, 2);
            const maskedPAN = expPAN[0];
            const lastFour = expPAN[0].slice(-4);

            return [maskedPAN, lastFour, formattedExp, serviceCode]
        }
        else return ["Not Found", "Not Found", "Not Found", "Not Found"]
    };
}

export default SwipeParser;