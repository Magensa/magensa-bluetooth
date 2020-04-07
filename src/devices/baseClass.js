import ErrorHandler from '../errorHandler';
import { 
    deviceNotFound, 
    gattServerNotConnected,
    getServiceFail,
    notFoundObj
} from '../errorHandler/errConstants';

class DeviceBase extends ErrorHandler {
    constructor(device, callbacks) {
        super(callbacks);

        this.device = device;
        this.disconnectCallback = callbacks.disconnectHandler;
        this.gattServer = null;
        this.cardService = null;

        this.deviceUUIDs = [
            "0508e6f8-ad82-898f-f843-e3410cb60104",
            "0508e6f8-ad82-898f-f843-e3410cb60103", 
            "0508e6f8-ad82-898f-f843-e3410cb60101"
        ];

        this.cardTypesObj = Object.freeze({
            'msr': 0x01,
            'chip': 0x02,
            'chipmsr': 0x03,
            'contactless': 0x04,
            'contactlessmsr': 0x05,
            'contactlesschip':0x06,
            'all': 0x07
        });

        this.statusVerbosity = Object.freeze({
            "minimum": 0x00,
            'medium': 0x01,
            'verbose': 0x02
        });

        this.currencyCode = Object.freeze({
            'dollar': [0x08, 0x40],
            'euro': [0x09, 0x78],
            'pound': [0x08, 0x26],
            'default': [0x00, 0x00] 
        });

        this.apiNetworkErr = {
            code: 19,
            name: 'NetworkError'
        };

        this.commandRespAvailable = false;
    }

    cardTypes = cardTypeStr => (cardTypeStr !== 'all') ? 
        (this.cardTypesObj[ cardTypeStr ] || 0x03) 
        : (this.device.deviceType.toLowerCase().includes('tdynamo') || this.device.deviceType === "dynaProGo") ? 
            0x07 : 0x03;
        

    connect = () => new Promise( (resolve, reject) => {
        this.logDeviceState(`[GATT]: Device Connection Request || ${new Date()}`);

        return (this.device) ?
            this.device.gatt.connect()
                .then(server => {
                    this.logDeviceState(`[GATT]: Device connected - GATT Server retrieved successfully || ${new Date()}`);
                    this.gattServer = server;

                    return resolve();
                })
            :
            reject( this.buildDeviceErr(deviceNotFound) )
    });

    disconnect = () => new Promise( resolve => 
        (!this.device.gatt.connected) ? resolve() 
        : 
        resolve(this.device.gatt.disconnect())
    );

    cacheCardServiceBase = serviceIndex => new Promise( (resolve, reject) => {
        serviceIndex = serviceIndex || 0;
        this.logDeviceState(`[GATT]: Cache Card Service Request || ${new Date()}`);

        return (!this.gattServer) ? 
            reject( this.buildDeviceErr(gattServerNotConnected))
            :
            this.findPrimaryService(serviceIndex)
            .then(service => resolve(service))
            .catch(err => reject(err))
    });

    findPrimaryService = serviceIndex => new Promise( (resolve, reject) =>
        this.gattServer.getPrimaryService(this.deviceUUIDs[serviceIndex])
        .then(service => {
            this.cardService = service;

            this.logDeviceState(`[GATT]: Success! GATT Card Service retrieved and cached || ${new Date()}`);

            this.device.addEventListener('gattserverdisconnected', this.disconnectHandler);
            return resolve( service );
        }).catch( err => {
            if (err.code === notFoundObj.errorCode && err.name === notFoundObj.errorName) {
                if (typeof this.deviceUUIDs[serviceIndex + 1] !== "undefined") {

                    this.logDeviceState(
                        `[ERROR]: Failed to connect. UUID: ${this.deviceUUIDs[ serviceIndex ]} is not valid for this device. Trying again with UUID: ${this.deviceUUIDs[ serviceIndex + 1 ]} || ${new Date()}`
                    );

                    return this.findPrimaryService(serviceIndex + 1);
                }
            }

            this.logDeviceState(`[ERROR]: Failed to retrieve Card Service - UUID: ${this.deviceUUIDs[ serviceIndex ]} is not valid for this device. || ${new Date()}`);
            
            reject( err );
        })
    );

    connectAndCache = optionalIndex => new Promise( (resolve, reject) => {

        let tryToConnect = tryCount => new Promise( (innerResolve, innerReject) => (tryCount < 4) ? 
            this.connect()
                .then( () => this.cacheCardServiceBase(optionalIndex) )
                .then( cacheServiceResp => innerResolve( cacheServiceResp )
                ).catch( err => {
                    if (err.code === this.apiNetworkErr.code && err.name === this.apiNetworkErr.name) {
                        return setTimeout( () => {
                            this.logDeviceState(`[ERROR]: Error caching GATT Service - Clearing cache and trying again. || ${new Date()}`);
                            this.clearGattCache();
                            return innerResolve( tryToConnect( tryCount + 1 ) );
                        }, 500)
                    }
                    else {
                        this.logDeviceState(`[ERROR]: Failed to cache GATT Service || ${new Date()}`);
                        return innerReject( err )
                    }
                })
            :
            innerReject( this.buildDeviceErr(getServiceFail) )
        );

        tryToConnect(0).then(
            cacheServiceResp => resolve( cacheServiceResp)
        ).catch(err => reject(err));
    });

    cancelAndDisconnect = () => this.cancelTransaction().then( () => this.device.gatt.disconnect() );

    onDestroyHandler = () => (this.device) ? 
        (this.device.gatt.connected) ? this.cancelAndDisconnect() : null
    : null;

    waitForDeviceResponse = maxTries => new Promise( resolve => {

        let waitForResponse = tryNumber => 
            (tryNumber < maxTries) ? 
                (this.commandRespAvailable) ? resolve( true ) : setTimeout(() => waitForResponse(tryNumber + 1), 200)
            : resolve( false );

        waitForResponse(0);
    });

    disconnectHandler = event => {
        this.gattServer = null;
        this.cardService = null;

        this.logDeviceState(`[Disconnected]: Disconnect event. Returning event to user, removing device listener || ${new Date()}`);

        this.disconnectCallback(event);
        this.device.removeEventListener('gattserverdisconnected', this.disconnectHandler);
    }

    isDeviceConnected = () => (this.device.gatt) ? this.device.gatt.connected : false;
}

export default DeviceBase;