import ApiError from './errorHandler/apiError';
import { allDeviceConfig, findDeviceByDeviceName } from './configurations';
import { buildDeviceObject } from './utils/instanciateDevice';
import {
    eDynamoPattern,
    tDynamoPattern,
    dpMiniPattern,
    dpGoPattern,
    tDynamo,
    eDynamo,
    dynaProGo,
    dpMini
} from './utils/constants';
import { notFoundObj } from './errorHandler/errConstants';

const findDeviceByProductName = selectedDevice => new Promise( (resolve, reject) => {
    let modelNameString;

    return selectedDevice.gatt.connect()
    .then(server => server.getPrimaryService('device_information')
    ).then(service => service.getCharacteristic('model_number_string')
    ).then(characteristic => characteristic.readValue()
    ).then(value => {
        modelNameString = new TextDecoder('utf-8').decode(value).trim();
        return selectedDevice.gatt.disconnect();
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

const inspectDeviceName = deviceName => (tDynamoPattern.test(deviceName)) ? tDynamo : 
    (eDynamoPattern.test(deviceName)) ? eDynamo : 
        (dpGoPattern.test(deviceName)) ? dynaProGo : 
            (dpMiniPattern.test(deviceName)) ? dpMini : "";


const defaultCallback = dataObj => {
    console.warn("Callback not provided to 'scanForDevices' function. Please provide at least one callback function to this method");
    console.log("transactionCallback data: ", dataObj);
}

const defaultErrCallback = errObj => 
    console.error("[MagensaBluetooth Internal Error]: ", errObj);


export const scanForDevices = (callBacks, deviceName) => new Promise( (resolve, reject) => {
    callBacks = callBacks || defaultCallback;

    if (typeof callBacks === 'object' && typeof callBacks.transactionCallback === 'undefined') {
        return reject("When providing multiple callbacks in an object, 'transactionCallback' must be provided");
    }

    const propAssignment = propName => (callBacks[propName]) ? callBacks[propName] : 
        (typeof callBacks === 'function') ? callBacks : callBacks.transactionCallback;

    callBacks.errorCallback = (callBacks.errorCallback || defaultErrCallback);
    callBacks.transactionStatusCallback = ( callBacks.transactionStatusCallback || propAssignment('transactionStatusCallback') );
    callBacks.userSelectionCallback = ( callBacks.userSelectionCallback || propAssignment('userSelectionCallback') );
    callBacks.displayCallback = ( callBacks.displayCallback || propAssignment('displayCallback') );
    callBacks.disconnectHandler = (callBacks.disconnectHandler || propAssignment('transactionCallback') );

    const options = (deviceName) ? findDeviceByDeviceName(deviceName) : allDeviceConfig;
    
    return navigator.bluetooth.requestDevice( options )
        .then(device => {
            const deviceTypeName = null;// = inspectDeviceName( device.name );

            return (deviceTypeName) ? resolve( buildDeviceObject(device, callBacks, deviceTypeName) ) :
                findDeviceByProductName(device).then( 
                    deviceTypeString => (!deviceTypeString) ? 
                        reject("Selected device is not supported") 
                        : resolve( buildDeviceObject(device, callBacks, deviceTypeString) )
                ).catch(err => reject(err));
        }).catch(err => (typeof err === "object") ? 
            reject( new ApiError(err) ) : 
            reject("Selected device is not supported")
        )
});
