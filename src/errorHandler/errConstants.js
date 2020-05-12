const notFoundObj = Object.freeze({
    errorCode: 8,
    errorName: "NotFoundError"
});

const apiNetworkErr = Object.freeze({
    code: 19,
    name: 'NetworkError'
});

const deviceNotFound = Object.freeze({
    code: 1002,
    name: 'DeviceNotFound',
    message: "Please select device to connect"
});

const gattServerNotConnected = Object.freeze({
    code: 1003,
    name: "GattServerNotConnected",
    message: "Please connect desired device"
});

const commandNotSent = Object.freeze({
    code: 1004, 
    name: "CommandNotSent", 
    message: "Command characteristic not found, device not opened"
});

const deviceNotOpen = Object.freeze({
    code: 1005, 
    name: "CommandNotSent", 
    message: "Device not opened"
});

const commandNotSentFromHost = Object.freeze({
    code: 1006, 
    name: "CommandNotSent", 
    message: "Application From Host not found.  Device not connected"
});

const readFailed = Object.freeze({
    code: 1007, 
    name: "ReadFailed", 
    message: "Unable to read data from device. Communication error"
});

const responseNotReceived = Object.freeze({
    code: 1008, 
    name: 'ResponseNotReceived', 
    message: "Command was sent, but response was not received from device"
});

const getServiceFail = Object.freeze({
    code: 1009, 
    name: "GetServiceFail", 
    message: "Failed to retrieve primary GATT service. Please connect device"
});

const commandNotAccepted = Object.freeze({
    code: 1013,
    name: "CommandNotAccepted",
    message: "Device did not accept command"
});

const missingRequiredFields = fieldName => Object.freeze({
    code: 1014,
    name: "MissingRequiredParameter",
    message: `'${fieldName}' is required to call this function.`
});

const wrongInputTypes = (acceptableTypes, propertyName) => Object.freeze({
    code: 1015,
    name: "IncorrectInputType",
    message: `Parameter type for ${propertyName} was not correct, acceptable type(s) are: ${acceptableTypes.join(", ")}`
});

const wrongInputValues = (acceptableVals, propertyName) => Object.freeze({
    code: 1015,
    name: "IncorrectInputValue",
    message: `Parameter value for ${propertyName} was not correct, acceptable value(s) are: ${acceptableVals.join(", ")}`
});

export {
    commandNotAccepted,
    commandNotSent,
    responseNotReceived,
    deviceNotFound,
    deviceNotOpen,
    gattServerNotConnected,
    readFailed,
    commandNotSentFromHost,
    getServiceFail,
    notFoundObj,
    apiNetworkErr,
    missingRequiredFields,
    wrongInputTypes,
    wrongInputValues
}
