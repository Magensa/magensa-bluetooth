const allDeviceConfig = {
    filters: [
        { services: ["0508e6f8-ad82-898f-f843-e3410cb60104"] },
        { services: ["0508e6f8-ad82-898f-f843-e3410cb60101"] }, 
        { services: ["0508e6f8-ad82-898f-f843-e3410cb60103"] }
    ],
    optionalServices: [
        "0508e6f8-ad82-898f-f843-e3410cb60104", 
        "0508e6f8-ad82-898f-f843-e3410cb60103", 
        "0508e6f8-ad82-898f-f843-e3410cb60101", 
        "0508e6f8-ad82-898f-f843-e3410cb60202",
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
        "0508e6f8-ad82-898f-f843-e3410cb60104", 
        "0508e6f8-ad82-898f-f843-e3410cb60103", 
        "0508e6f8-ad82-898f-f843-e3410cb60101",
        "0508e6f8-ad82-898f-f843-e3410cb60202",
        'device_information'
    ],
    keepRepeatedDevices: false,
    acceptAllAdvertisements: false
});


export {
    allDeviceConfig,
    findDeviceByDeviceName
}