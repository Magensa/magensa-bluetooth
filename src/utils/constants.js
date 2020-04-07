const openSuccess = "Device Open";
const closeSuccess = "Device Closed"
const successCode = 0;

const swipeListening = "Success, listening for swipe"

const deviceNotIdle = "Device not idle";

const noSessionToClear = Object.freeze({
    code: 0,
    message: "Success, there was no session to clear"
});

const tDynamo = "tDynamo";
const eDynamo = "eDynamo";
const dynaProGo = "dynaProGo";
const dpMini = "DynaPro Mini";

const eDynamoPattern = new RegExp(/^eDynamo-/);
const tDynamoPattern = new RegExp(/^tDynamo-/);
const dpMiniPattern = new RegExp(/^DPMini/);
const dpGoPattern = new RegExp(/^DPG/);

export {
    openSuccess,
    successCode,
    swipeListening,
    deviceNotIdle,
    closeSuccess,
    noSessionToClear,
    eDynamoPattern,
    tDynamoPattern,
    dpMiniPattern,
    dpGoPattern,
    tDynamo,
    eDynamo,
    dynaProGo,
    dpMini
}