export default class DeviceInterface {
    constructor({ 
        getCardService,
        startTransaction,
        cancelTransaction,
        sendCommandWithResp,
        clearSession,
        closeDevice,
        getDeviceInfo,
        requestCardSwipe,
        isDeviceConnected
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
    }
};