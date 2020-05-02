interface DeviceObject {
    id: string,
    name: string,
    deviceType: string,
    deviceInterface: {
        openDevice(): Promise<any>;
        startTransaction(emvOptions?: any): Promise<any>;
        cancelTransaction(): Promise<any>;
        sendCommand(writeCommand: Array<number>): Promise<any>;
        clearSession(): Promise<any>;
        closeDevice(): Promise<any>;
        deviceInfo(): Promise<any>;
        requestCardSwipe(swipeOptions?: any): Promise<any>;
        isDeviceOpen(): boolean;
    }
}

declare module "magensa-bluetooth" {
    export function scanForDevices(callBacks: any, deviceName?: string) : Promise<DeviceObject>;
}