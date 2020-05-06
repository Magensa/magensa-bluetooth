import ErrorHandler from '../errorHandler';
import { 
    deviceNotFound, 
    gattServerNotConnected,
    getServiceFail,
    notFoundObj,
    deviceNotOpen,
    apiNetworkErr,
    wrongInputTypes
} from '../errorHandler/errConstants';
import { cardTypeAll, cardTypesObj, successfulClose } from '../utils/constants';

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

        this.transactionTypes = Object.freeze({
            'purchase': 0x00,
            'cashadvance': 0x01,
            'cashback': 0x02,
            'purchasegoods': 0x04,
            'purchaseservices': 0x08,
            'contactlesscashback': 0x09,
            'cashmanual': 0x12,
            'refund': 0x20, 
            'chiponlypayment': 0x50
        });

        this.commandRespAvailable = false;
    }

    cardTypes = cardTypeStr => (cardTypeStr !== 'all') ? 
        (cardTypesObj[ cardTypeStr ] || 0x03) : (cardTypeAll[ this.deviceType ] || 0x03);
        

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

    disconnect = () => new Promise( resolve =>  {
        if (!this.device.gatt.connected) {
            return resolve( successfulClose )
        }
        else {
            this.device.gatt.disconnect()
            return resolve( successfulClose )
        }
    });

    cacheCardServiceBase = serviceIndex => new Promise( (resolve, reject) => {
        serviceIndex = serviceIndex || 0;
        this.logDeviceState(`[GATT]: Cache Card Service Request || ${new Date()}`);

        return (!this.gattServer) ? 
            reject( this.buildDeviceErr(gattServerNotConnected) )
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
                if (typeof( this.deviceUUIDs[serviceIndex + 1] !== "undefined" )) {

                    this.logDeviceState(
                        `[ERROR]: Failed to connect. UUID: ${this.deviceUUIDs[ serviceIndex ]} is not valid for this device. Trying again with UUID: ${this.deviceUUIDs[ serviceIndex + 1 ]} || ${new Date()}`
                    );

                    return resolve( this.findPrimaryService(serviceIndex + 1) );
                }
            }
            else {
                this.logDeviceState(`[ERROR]: Failed to retrieve Card Service - UUID: ${this.deviceUUIDs[ serviceIndex ]} is not valid for this device. || ${new Date()}`);
            
                return reject( err );
            }
        })
    );

    connectAndCache = optionalIndex => new Promise( (resolve, reject) => {

        let tryToConnect = tryCount => new Promise( (innerResolve, innerReject) => (tryCount < 4) ? 
            this.connect()
                .then( () => this.cacheCardServiceBase(optionalIndex) )
                .then( cacheServiceResp => innerResolve( cacheServiceResp )
                ).catch( err => {
                    if (err.code === apiNetworkErr.code && err.name === apiNetworkErr.name) {
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

        return tryToConnect(0).then(
            cacheServiceResp => resolve( cacheServiceResp)
        ).catch(err => reject(err));
    });

    sendArpcBase = arpcResp => new Promise((resolve, reject) => {
        if (!this.device.gatt.connected)
            return reject( this.buildDeviceErr(deviceNotOpen) );

        if (typeof arpcResp !== 'string' && typeof arpcResp !== 'object')
            return reject( this.buildDeviceErr( wrongInputTypes(['string', 'array of numbers']) ) );

        const dataLen = (typeof arpcResp === 'string') ? (arpcResp.length / 2) : arpcResp.length;
        const inputData = (typeof arpcResp === 'string') ? this.hexToBytes(arpcResp) : arpcResp;

        return resolve(
            this.buildArpcCommand(dataLen, inputData)
        )
    });

    onDestroyHandler = () => {
        if (this.device && this.device.gatt.connected) 
            return this.device.gatt.disconnect();
    }

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