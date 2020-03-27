declare module "magensa-bluetooth" {
    function scanForDevices(callBacks: any, deviceName: string) : any;
    export = scanForDevices
}