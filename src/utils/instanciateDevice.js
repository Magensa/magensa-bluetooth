import DpMini from '../devices/dynaProMini';
import DynProGo from '../devices/dynaProGo';
import EDynamo from '../devices/eDynamo';
import TDynamo from '../devices/tDynamo';

class DeviceInterface {
    constructor({ 
        getCardService,
        startTransaction,
        cancelTransaction,
        sendCommandWithResp,
        clearSession,
        closeDevice,
        getDeviceInfo,
        requestCardSwipe,
        isDeviceConnected,
        disconnect
    }) {
        this.openDevice = getCardService;
        this.startTransaction = startTransaction;
        this.cancelTransaction = cancelTransaction;
        this.sendCommand = sendCommandWithResp;
        this.clearSession = (clearSession) ? clearSession : () => Promise.resolve();
        this.closeDevice = closeDevice;
        this.deviceInfo = getDeviceInfo;
        this.requestCardSwipe = requestCardSwipe;
        this.isDeviceOpen = isDeviceConnected;
        this.forceDisconnect = disconnect
    }
};

const newDeviceInstance = {
    eDynamo: (device, callbacks) => new EDynamo(device, callbacks),
    tDynamo:  (device, callbacks) => new TDynamo(device, callbacks),
    dynaProGo: (device, callbacks) => new DynProGo(device, callbacks),
    "DynaPro Mini": (device, callbacks) => new DpMini(device, callbacks),
}

export const buildDeviceObject = (device, callbacks, deviceTypeString) => ({
    id: device.id,
    name: device.name,
    deviceType: deviceTypeString,
    deviceInterface: new DeviceInterface(
        newDeviceInstance[ deviceTypeString ](device, callbacks)
    )
});

