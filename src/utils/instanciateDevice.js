import DpMini from '../devices/dynaProMini';
import DynProGo from '../devices/dynaProGo';
import EDynamo from '../devices/eDynamo';
import TDynamo from '../devices/tDynamo';
import { 
    tDynamo,
    eDynamo,
    dynaProGo,
    dpMini 
} from '../utils/constants'; 

const commandNotUsed = isScra => 
    () => Promise.resolve(`${(isScra ? 'SCRA' : 'PinPad')} devices do not use this command`);

    
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
        disconnect,
        requestPinEntry,
        setDisplayMessage,
        sendUserSelection,
        sendArpc,
        setDeviceDateTime,
        requestTipOrCashback
    }) {
        this.openDevice = getCardService;
        this.startTransaction = startTransaction;
        this.cancelTransaction = cancelTransaction;
        this.sendCommand = sendCommandWithResp;
        this.clearSession = clearSession;
        this.closeDevice = closeDevice;
        this.deviceInfo = getDeviceInfo;
        this.requestCardSwipe = requestCardSwipe;
        this.isDeviceOpen = isDeviceConnected;
        this.forceDisconnect = disconnect;
        this.requestPinEntry = (requestPinEntry) ? requestPinEntry : commandNotUsed(true);
        this.setDisplayMessage = (setDisplayMessage) ? setDisplayMessage : commandNotUsed(true);
        this.sendUserSelection = (sendUserSelection) ? sendUserSelection : commandNotUsed();
        this.sendArpcResponse = sendArpc;
        this.setDeviceDateTime = (setDeviceDateTime) ? setDeviceDateTime : commandNotUsed();
        this.requestTipOrCashback = (requestTipOrCashback) ? requestTipOrCashback : () => Promise.resolve("This device does not use this command");
    }
};

const newDeviceInstance = {
    [eDynamo]: (device, callbacks) => new EDynamo(device, callbacks),
    [tDynamo]:  (device, callbacks) => new TDynamo(device, callbacks),
    [dynaProGo]: (device, callbacks) => new DynProGo(device, callbacks),
    [dpMini]: (device, callbacks) => new DpMini(device, callbacks),
}

export const buildDeviceObject = (device, callbacks, deviceTypeString) => ({
    id: device.id,
    name: device.name,
    deviceType: deviceTypeString,
    deviceInterface: new DeviceInterface(
        newDeviceInstance[ deviceTypeString ](device, callbacks)
    )
});

