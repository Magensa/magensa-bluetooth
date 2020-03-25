import DpMini from './devices/dynaProMini';
import EDynamo from './devices/eDynamo';
import TDynamo from './devices/tDynamo';
import DeviceInterface from './devices/deviceInterface';
import ApiError from './errorHandler/apiError';
import { allDeviceConfig, findDeviceByDeviceName } from './configurations';

const findDeviceByProductName = selectedDevice => 
    new Promise( (resolve, reject) => selectedDevice.gatt.connect()
        .then(server =>
            server.getPrimaryService('device_information')
        ).then(service => service.getCharacteristic('model_number_string')
        ).then(characteristic => characteristic.readValue()
        ).then(value => {
            let modelNameString = new TextDecoder('utf-8').decode(value);
            return resolve([
                selectedDevice, 
                modelNameString
            ]);
        }).catch(err => reject(err) )
);

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

    let isCallbackFunction = (typeof callBacks === 'function');

    const propAssignment = propName => (callBacks[propName]) ? callBacks[propName] : 
        (isCallbackFunction) ? callBacks : callBacks.transactionCallback;

    callBacks.errorCallback = (callBacks.errorCallback || defaultErrCallback);
    callBacks.transactionStatusCallback = ( callBacks.transactionStatusCallback || propAssignment('transactionStatusCallback') );
    callBacks.userSelectionCallback = ( callBacks.userSelectionCallback || propAssignment('userSelectionCallback') );
    callBacks.displayCallback = ( callBacks.displayCallback || propAssignment('displayCallback') );
    callBacks.disconnectHandler = (callBacks.disconnectHandler || propAssignment('transactionCallback') );

    let options = (deviceName) ? findDeviceByDeviceName(deviceName) : allDeviceConfig;
    
    return navigator.bluetooth.requestDevice( options )
    .then(device => findDeviceByProductName(device)
    ).then(deviceInfo => {
        let deviceType = deviceInfo[1].trim().toLowerCase();
        deviceInfo[0].deviceType = deviceType;

        let selectedDevice = (deviceType.includes('edynamo')) ? new EDynamo(deviceInfo[0], callBacks) : 
                (deviceType.includes('tdynamo')) ? new TDynamo(deviceInfo[0], callBacks) : 
                (deviceType.includes('dynapro')) ? new DpMini(deviceInfo[0], callBacks) : 
                null;

        return (selectedDevice) ? Promise.resolve([ selectedDevice, deviceInfo[1] ]) 
            : reject("Selected device is not supported")
    }).then( selectedDeviceInfo => {
        let deviceObj = selectedDeviceInfo[0].device;
        let selectedInterface = new DeviceInterface(selectedDeviceInfo[0]);

        let returnDeviceObj = {
            id: deviceObj.id,
            name: deviceObj.name,
            deviceType: selectedDeviceInfo[1],
            deviceInterface: selectedInterface
        };
        
        return resolve( returnDeviceObj );
    }).catch(err => (typeof err === "object") ? 
        reject(new ApiError(err) ) : 
        reject("Selected device is not supported")
    )
});