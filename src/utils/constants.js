const openSuccess = "Device Open";
const closeSuccess = "Device Closed"
const successCode = 0;
const swipeListening = "Success, listening for swipe"
const deviceNotIdle = "Device not idle";
const tDynamo = "tDynamo";
const eDynamo = "eDynamo";
const dynaProGo = "dynaProGo";
const dpMini = "DynaPro Mini";

const configStr = "Configuration";
const unknown = "Unknown";
const unknownUndoc = `${unknown}/Undocumented`;
const ascii = "ASCII";

const magUuidPrefix = "0508e6f8-ad82-898f-f843-e3410cb60";

const noSessionToClear = Object.freeze({
    code: successCode,
    message: "Success, there was no session to clear"
});

const gattBusy = Object.freeze({
    code: 19, 
    message: "GATT operation already in progress."
});

const successfulClose = Object.freeze({
    code: successCode,
    message: closeSuccess
});

const cardTypeAll = Object.freeze({
    [eDynamo]: 0x03,
    [tDynamo]: 0x07,
    [dpMini]: 0x03,
    [dynaProGo]: 0x07
});

const cardTypesObj = Object.freeze({
    'msr': 0x01,
    'chip': 0x02,
    'chipmsr': 0x03,
    'contactless': 0x04,
    'contactlessmsr': 0x05,
    'contactlesschip':0x06,
    'all': 0x07
});

export {
    openSuccess,
    successCode,
    swipeListening,
    deviceNotIdle,
    closeSuccess,
    noSessionToClear,
    tDynamo,
    eDynamo,
    dynaProGo,
    dpMini,
    cardTypeAll,
    cardTypesObj,
    gattBusy,
    successfulClose,
    configStr,
    unknown,
    unknownUndoc,
    ascii,
    magUuidPrefix
}
