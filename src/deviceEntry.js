import ApiError from './errorHandler/apiError';
import { allDeviceConfig, findDeviceByDeviceName } from './configurations';
import { buildDeviceObject } from './utils/instanciateDevice';
import { findDeviceTypeString, findDeviceByProductName } from './utils/identifyDevice';


const arrangeCallbacks = callBacks => {

    const defaultCallback = dataObj => {
        console.warn("Callback not provided to 'scanForDevices' function. Please provide at least one callback function to this method");
        console.log("transactionCallback data: ", dataObj);
    }

    callBacks = callBacks || defaultCallback;
    
    const isFuncType = (typeof callBacks === 'function');

    const propAssignment = propName => (callBacks[propName]) ? callBacks[propName] : 
        (isFuncType) ? callBacks : callBacks.transactionCallback;

    const defaultErrCallback = errObj => 
        console.error("[MagensaBluetooth Internal Error]: ", errObj);

    callBacks.errorCallback = (callBacks.errorCallback || defaultErrCallback);
    callBacks.transactionStatusCallback = ( callBacks.transactionStatusCallback || propAssignment('transactionStatusCallback') );
    callBacks.userSelectionCallback = ( callBacks.userSelectionCallback || propAssignment('userSelectionCallback') );
    callBacks.displayCallback = ( callBacks.displayCallback || propAssignment('displayCallback') );
    callBacks.disconnectHandler = (callBacks.disconnectHandler || propAssignment('transactionCallback') );

    return callBacks;
}

export const scanForDevices = (callBacks, deviceName, deviceType) => new Promise( (resolve, reject) => {
    if (typeof callBacks === 'object' && typeof callBacks.transactionCallback === 'undefined')
        return reject("When providing multiple callbacks in an object, 'transactionCallback' must be provided");

    callBacks = arrangeCallbacks(callBacks);

    const options = (deviceName) ? findDeviceByDeviceName(deviceName) : allDeviceConfig;
    
    return navigator.bluetooth.requestDevice( options )
        .then(device => {

            const deviceTypeName = findDeviceTypeString(device.name, deviceType);

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
