import { magUuidPrefix } from '../utils/constants';

const allDeviceConfig = {
    filters: [
        { services: [`${magUuidPrefix}104`] },
        { services: [`${magUuidPrefix}101`] }, 
        { services: [`${magUuidPrefix}103`] }
    ],
    optionalServices: [
        `${magUuidPrefix}104`, 
        `${magUuidPrefix}103`, 
        `${magUuidPrefix}101`, 
        `${magUuidPrefix}202`,
        'device_information'
    ],
    keepRepeatedDevices: false,
    acceptAllAdvertisements: false
}

const findDeviceByDeviceName = deviceName => ({
    filters: [
        { namePrefix: deviceName }
    ],
    optionalServices: [
        `${magUuidPrefix}104`, 
        `${magUuidPrefix}103`, 
        `${magUuidPrefix}101`,
        `${magUuidPrefix}202`,
        'device_information'
    ],
    keepRepeatedDevices: false,
    acceptAllAdvertisements: false
});


export {
    allDeviceConfig,
    findDeviceByDeviceName
}
