import {
    tDynamo,
    eDynamo,
    dynaProGo,
    dpMini
} from './constants';
import { notFoundObj } from '../errorHandler/errConstants';

const eDynamoPattern = new RegExp(/^eDynamo-/);
const tDynamoPattern = new RegExp(/^tDynamo-/);
const dpMiniPattern = new RegExp(/^DPMini/);
const dpGoPattern = new RegExp(/^DPG/);


const inspectDeviceName = deviceName => (tDynamoPattern.test(deviceName)) ? tDynamo : 
    (eDynamoPattern.test(deviceName)) ? eDynamo : 
        (dpGoPattern.test(deviceName)) ? dynaProGo : 
            (dpMiniPattern.test(deviceName)) ? dpMini : "";

const formatTypeString = deviceTypeStr => {
    const deviceTypeArr = [dynaProGo, dpMini, eDynamo, tDynamo];
    let returnStr = "";

    for (let i = 0; i < deviceTypeArr.length; i++) {
        if (deviceTypeStr.toLowerCase() === deviceTypeArr[i].toLowerCase()) {
            returnStr = deviceTypeArr[i];
            break;
        }
    }

    return returnStr;
}

export const findDeviceTypeString = (nameStr, typeStr) => {
    if (typeStr) {
        const formattedStr = formatTypeString(typeStr);

        if (formattedStr) {
            return formattedStr;
        }
    }

    return inspectDeviceName(nameStr)
}

export const findDeviceByProductName = selectedDevice => new Promise( (resolve, reject) => {
    let modelNameString;

    return selectedDevice.gatt.connect()
    .then(server => server.getPrimaryService('device_information')
    ).then(service => service.getCharacteristic('model_number_string')
    ).then(characteristic => characteristic.readValue()
    ).then(value => {
        modelNameString = new TextDecoder('utf-8').decode(value).trim();
        return Promise.resolve( selectedDevice.gatt.disconnect() );
    }).then( () => resolve( modelNameString )
    ).catch(err => (
            err.code === notFoundObj.errorCode && 
            err.name === notFoundObj.errorName && 
            err.message.includes("0000180a-0000-1000-8000-00805f9b34fb")
        ) ? (!selectedDevice.gatt.connected) ? resolve( dynaProGo ) 
            : Promise.resolve( selectedDevice.gatt.disconnect() ).then(() => resolve( dynaProGo ))
        : reject(err)
    );
});
