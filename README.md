magensa-bluetooth
==============
[![npm version](https://img.shields.io/npm/v/magensa-bluetooth.svg?style=for-the-badge)](https://www.npmjs.org/package/magensa-bluetooth)  
Interface between [MagTek®](https://www.magtek.com) Bluetooth devices, and Chromium based browsers.  


## Browser Support

![Chrome](https://raw.github.com/alrra/browser-logos/master/src/chrome/chrome_48x48.png) | ![Opera](https://raw.github.com/alrra/browser-logos/master/src/opera/opera_48x48.png) | ![Edge](https://raw.github.com/alrra/browser-logos/master/src/edge/edge_48x48.png) | ![Samsung](https://raw.githubusercontent.com/alrra/browser-logos/master/src/samsung-internet/samsung-internet_48x48.png) |
--- | --- | --- | --- |
Latest ✔ | Latest ✔ | Latest ✔ | Latest ✔ |  
  
This library utilizes [WebBluetooth API](https://www.w3.org/community/web-bluetooth).  
WebBluetooth compatibility information can be found at the [implementation status README](https://github.com/WebBluetoothCG/web-bluetooth/blob/master/implementation-status.md) and [caniuse.com](https://caniuse.com/#feat=web-bluetooth).  
Additionally, we have put together detailed compatibility information, as well as initial pair instructions, in our [Playground](https://btplayground.magensa.dev/compatibility-info).

Installation
=============
NPM:  
```
npm install magensa-bluetooth
```  
Yarn:  
```
yarn add magensa-bluetooth
```  
  
Grab your MagTek® device and Get Started
=============
In order to utilize this library, you must have a MagTek® device with Bluetooth capabilities.  Currently the compatible devies are  
- [eDynamo](https://www.magtek.com/product/edynamo)
- [tDynamo](https://www.magtek.com/product/tdynamo)
- [DynaPro Mini](https://www.magtek.com/product/dynapro-mini)  

If you have a device, and would like to see this library in action, please head over to our [Playground](https://btplayground.magensa.dev).  
If you would like to purchase a device, please head over to [this store](https://shop.magtek.com).  

Usage
=======
The implementation below will prompt a pair window displaying all MagTek devices in range.  Once the end user selects the appropriate device from the pair window, the response to this function call will be a [device object](#1-Device-Object).  
The device pair window is part of the [WebBluetooth API](https://www.w3.org/community/web-bluetooth), and is currently mandatory (no bypass exists as of this time).

```javascript
import { scanForDevices } from 'magensa-bluetooth';

function exampleCallback(dataObj) {
    console.log(dataObj);
};

//Using Promises:
scanForDevices(exampleCallback).then( connectedDevice => 
    /*
        'connectedDevice', in this example, is a return object containing device information and the interface needed to interact with your paired device.
        See Device Object under the 'Return Objects' header below, for more details.

        Store this device object in a manner that makes sense for your application. This example saves the object to a global namespace:
    */
    window.MagTekDevice = connectedDevice;
    /*
        Now the device can be acccessed globally. 
        if you wish to limit the scope of the connected device - please do so at your discretion.
    */
).catch(err => console.error(err));

//Using async/await:
const examplePairing = async() => {
    try {
        const connectedDevice = await scanForDevices(exampleCallback);

        //Now "connectedDevice" contains the device object. Store this in a manner that makes sense for your application.
        window.MagTekDevice = connectedDevice;
    }
    catch(error) {
        console.error(error);
    }
}
```  
  
The callback function provided is the only way the paired device can send data to the user.  
- All data returned to the provided callbacks will be of type ```object```.  Please see [Return Objects](#Return-Objects) section for more information.
- Please see the [Callbacks](#Callbacks) section below for more information about user provided callback functions.


Device Interface API
============ 
All methods are asynchronous (```isDeviceOpen``` being the only synchronous exception).  Be sure to catch all exceptions - as any error occured upon invocation of these functions will throw an [Error](#4-Error-Object).  
  
| Function | Input Parameters | Output | Notes |
|:--------:|:-------:|:-------:|:--------:|
| scanForDevices | [callbacks](#Callbacks) [,deviceName] | [Device Object](#1-Device-Object) | [Please refer to examples below](#Callback-Examples). Device name is optional. **Despite the device being returned in an open state - it is recommended to open the device prior to interaction** |
| startTransaction | [emvOptions](#EMV-Options-Object) | [Success](#5-Success-Object) | emvOptions is optional - any property supplied will override the default |
| cancelTransaction | none | `void` | Cancel any transaction that is in progress. |
| openDevice | none | [Success](#5-Success-Object) | opens paired device to receive commands |
| closeDevice | none | [Success](#5-Success-Object) | clears session (when applicable) and closes device safely |
| clearSession | none | `void` (SCRA) [Success](#5-Success-Object)  (PinPad) | removes previous card data from device's volatile memory. Only PinPad devices have session  |
| deviceInfo | none | [Device Information](#6-Device-Information) | Be aware this call will clear device session prior to returning device information |
| requestCardSwipe | [swipeOptions](#Swipe-Options-Object) | [Success](#5-Success-Object) | swipeOptions is optional. Any property supplied will override the default|
| isDeviceOpen | none | ```Boolean``` | synchronous function that returns device's open status |


## EMV Options Object
Emv Options object is optional.  All property values have default values. Any property supplied will override the default value, while any not supplied will use default values.  There are some slight differences between PinPad Devices and SCRA devices, so this section will be broken down into three parts:  
1. [Properties that are shared](#Shared-Properties) by both device types   
2. [Properties for SCRA](#SCRA-properties-only) devices only
3. [PinPad properties](#PinPad-properties-only) only

### *__Shared Properties__*:
-------------------------------  
| Property Name | Description | Type  | Acceptable Values | Default Value |
|:------------:|:-----------:|:--------------:|:---------------:|:---------------:|
| timeout  | time, in seconds, before transaction timeout | Number | 1 - 255 | 60 |
| cardType | types of cards to accept for transaction | String | ```'msr', 'chip', 'chipMsr', 'contactless', 'contactlessChip', 'all'``` | ```chipMsr``` |
| cashBack | amount to process as cashback transaction. For transactionType ```'refund'```, this value must be ```0``` | Number | any integer (no floats) up to 281 trillion | 0 |
| currencyCode | type of currency. ```'default'``` uses device's application terminal setting (usually USA dollar) | String | ```'dollar', 'euro', 'pound', 'default'```| ```'dollar'``` |
| authorizedAmount | amount to authorize for transaction. For transactionType ```'refund'```, this value must be ```0``` | Number | any integer (no floats) up to 281 trillion | 100 |
<hr />

<br />

### *__SCRA properties only__*:
----------------------------  
| Property Name | Description | Type  | Acceptable Values | Default Value |
|:------------:|:-----------:|:--------------:|:---------------:|:---------------:|
| emvOptions | online EMV options | String | ```'normal', 'byPassPin', 'forceOnline', 'quickChip', 'pinByPassQuickChip', 'forceOnlineQuickChip'``` |```'quickChip'``` |
| transactionType | type of transaction to process | String | ```'purchase', 'cashback', 'refund', 'contactlessCashback'``` | ```'purchase'``` |
| reportVerbosity | EMV Transaction Status/Progress messaging level | String | ```'minimum', 'medium', 'verbose'``` | ```'minimum'```  |
<hr />

<br />

### *__PinPad properties only__*:
--------------------------  
| Property Name | Description | Type  | Acceptable Values | Default Value |
|:------------:|:-----------:|:--------------:|:---------------:|:---------------:|
| emvOptions | online EMV options | String | ```'normal', 'byPassPin', 'forceOnline', 'acquirerNotAvailable'``` | ```'normal'``` |
| transactionType | type of transaction to process | String | ```'purchase', 'cashAdvance', 'cashback', 'purchaseGoods', 'purchaseServices', 'cashManual', 'refund', 'chipOnlyPayment'``` | ```'purchase'``` |
| pinTimeout | wait time in seconds for cardholder to enter PIN | Number | 1 -255 |20 |
| toneChoice | Select device beep behavior | String | ```'noSound', 'oneBeep', 'twoBeeps'``` | ```'oneBeep'``` |
| isQuickChip | arm in QuickChip mode, or not | Boolean | ```true``` or ```false``` | ```true``` |

<hr />

<br />

## Swipe Options Object
#### _Swipe options are only valid for PinPad devices. Swipe options passed to a SCRA device will be ignored_.  
| Property Name | Description | Type  | Acceptable Values | Default Value |
|:------------:|:-----------:|:--------------:|:---------------:|:---------------:|
| timeout  | time, in seconds, before transaction timeout | Number | 1 - 255 (0 for infinite wait) | 60 |
| displayType | choose which display customer will see on device display | | ```'swipeIdleAlternate', 'swipeCard', 'pleaseSwipe', 'pleaseSwipeAgain', 'chipErrorUseSwipe' ``` | ```'pleaseSwipe'``` |
| toneChoice | Select device beep behavior | String | ```'noSound', 'oneBeep', 'twoBeeps'``` | ```'oneBeep'``` |
| isFallback | execute swipe with fallback flag. Be aware this will set displayType to ```'chipErrorUseSwipe'``` | Boolean | ```true``` or ```false``` | ```false``` | 


# Callbacks
User defined callback functions can be as granular as desired.  For this purpose - there is only one callback that is mandatory to provide to the ```scanForDevices``` method.  The remaining callbacks are subscription based.  In reference to the return objects for the below callbacks - please see the [Return Objects](#Return-Objects) section for object structures.

```errorCallback``` is the only special case. Please see description for behavior. For all other callbacks - if one is not provided - data will be sent to the main callback (```transactionCallback```).  This can sometimes clutter the callback data, and become problematic, so please plan callback structure according to your specific needs.  
  
| Callback | Return object | Notes |
|:--------:|:-------------:|:-----:|
| transactionCallback | [Transaction Result Object](#2-Transaction-Result-Object) | Transaction data. Object structure will depend on which type of transaction was requested |
| errorCallback | [Error Object](#5-Error-Object) | If provided, all internal errors that cannot be thrown to a caller will be piped to this callback. If not provided, internal errors will log to JavaScript console. All errors pertaining to functions invoked via the [deviceInterface](#Device-Interface-API) will always be thrown back to the caller |
| displayCallback | Display Message Object | message to display directly to the end user. This callback is only used by SCRA devices. PinPad devices will display messages directly on the device |
| transactionStatusCallback | Transaction Status Object | Status, Progress, Messages, and Codes will all be piped to this callback. You can throttle [```reportVerbosity```](#*__SCRA-properties-only__*) on SCRA devices |
| disconnectHandler | Disconnect Event (inherits from [Event](https://developer.mozilla.org/en-US/docs/Web/API/Event)) | disconnect events are sent to: disconnectHandler if one is provided, or main callback (```transactionCallback```) if not provided|

# Callback Examples
This is the most basic example - using Promises.
```javascript
let exampleCallback = responseObj => {
    /*
        For a single callback, all responses will be passed to this callback.
        You can filter by properties in the responseObj, if desired.
        For example...
    */

    if ('swipeData' in responseObj) {
        //process swipe data.
    }
}

scanForDevices(exampleCallback)
    .then( device => {
        window.MagTekDevice = device
    })
    .catch( errObj => {
        console.log(errObj)
    });
```

This is the most basic example - using async/await.
```javascript
let exampleCallback = responseObj => {
    /*
        For a single callback, all responses will be passed to this callback.
        You can filter by properties in the responseObj, if desired.
        For example...
    */

   const { swipeData } = responseObj;

   if (swipeData) {
       //process swipe data.
   }
}

const connectDevice = async() => {
    try {
        let deviceResp = await scanForDevices(exampleCallback)

        window.MagTekDevice = devicedeviceResp
    }
    catch(error) {
        console.log(error)
    }
}
```

### These are two examples of the most granular way to interact with this library:

Structure callbacks using ```function``` property assignment:
```javascript

const callbacks = (function() {
    const allCallbacks = responseObj => {
        /*
            This will be the main callback, also known as the 'transactionCallback'.
            Since we are using an IIFE to structure callbacks, we don't need to explicitly assign this value.
        */

        if ('swipeData' in responseObj) {
            //Handle swipe data.
        }
    }

    allCallbacks.errorCallback = errObj => {
        /*
            Handle all internal errors that cannot be thrown back to a caller.
            If this callback is not provided - internal errors will be logged to the JavaScript console.
        */
    }

    allCallbacks.transactionStatusCallback = statusObj => {
        /*
            Handle or log all transaction status, progress, codes and messages.
            This callback is great for debugging and device visibility.
        */
    }

    allCallbacks.displayCallback = ({ displayMessage }) => {
        /*
            Handle all user display messages.
            For SCRA devices - EMV standards state this message must be displayed directly to the user.
            PinPad devices will use this callback, and will instead use the device display.
            The message language is determined by device configuration.
        */
        document.getElementById('display-to-user').innerText = displayMessage;
    }

    allCallbacks.disconnectHandler = event => {
        //Handle device disconnect events.
        let message = `Device: ${event.target.name} has disconnected`;
    }

    return allCallbacks;
})();

//Using Promises
scanForDevices(callbacks)
    .then( device => {
        window.MagTekDevice = device
    })
    .catch( errObj => {
        console.error("Caught Error: ", errObj);
    });
    

//Using async/await
const pairDevice = async() => {
    try {
        let deviceResp = await scanForDevices(callbacks);
        window.MagTekDevice = deviceResp;
    }
    catch(error) {
        console.error("Caught Error: ", errObj);
    }
}

```

Structure callbacks using an ```Object```:
```javascript
const exampleErrorHandler = errObj => {
    /*
        Handle all internal errors that cannot be thrown back to a caller.
        If this callback is not provided - internal errors will be logged to the JavaScript console.
    */
}

const exampleTransactionHandler = dataObj => {
    //Handle all transaction/card data.
}

const exampleTransactionStatusHandler = statusObj => {
    /*
        Handle or log all transaction status, progress, codes and messages.
        This callback is great for debugging and device visibility.
    */
}

const exampleDisplayMessageHandler = ({ displayMessage }) => {
    /*
        Handle all user display messages.
        For SCRA devices - EMV standards state this message must be displayed directly to the user.
        PinPad devices will use this callback, and will instead use the device display.
        The message language is determined by device configuration.
    */
    document.getElementById('display-to-user').innerText = displayMessage;
}

const exampleDisconnectHandler = event => {
    //Handle device disconnect events.
    let message = `Device: ${event.target.name} has disconnected`;
}

//Note that when structuring multiple callbacks in an object - 'transactionCallback' becomes mandatory.

let callBackObject = {
    transactionCallback: exampleTransactionHandler,
    errorCallback: exampleErrorHandler,
    displayCallback: exampleDisplayMessageHandler,
    transactionStatusCallback: exampleTransactionStatusHandler,
    disconnectHandler: exampleDisconnectHandler
}

//Using Promises
scanForDevices(callBackObject)
    .then( device => {
        window.MagTekDevice = device
    })
    .catch( errObj => {
        console.error("Caught Error: ", errObj);
    });
    

//Using async/await
const connectDevice = async() => {
    try {
        let deviceResp = await scanForDevices(callBackObject);
        window.MagTekDevice = deviceResp;
    }
    catch(error) {
        console.error("Caught Error: ", errObj);
    }
}

```

## Return Objects

#### 1. Device Object
```javascript
{
    id: String,
    name: String,
    deviceType: String,
    deviceInterface: Object
}
```

#### 2. Transaction Result Object:
```arqcData``` and ```batchData``` are hex strings that are unparsed, and contain the same data as the parsed objects.
```javascript
{
    arqcData: String,
    arqcDataParsed: [
        { tag: String, tagName: String, length: Number, value: String }, 
        { tag: String, tagName: String, length: Number, value: String }
    ],
    batchData: String,
    batchDataParsed: [
        { tag: String, tagName: String, length: Number, value: String },
        { tag: String, tagName: String, length: Number, value: String }
    ],
    swipeData: {
        ksn: String,
        Last4: String,
        encSessionId: String,
        expirationDate: String, // MM/DD format
        magnePrint: String,
        magnePrintStatus: String,
        maskedPAN: String,
        serialNumber: String,
        track1: String,
        track1Masked: String,
        track1DecodeStatus: Number,
        track2: String,
        track2DecodeStatus: Number,
        track2Masked: String,
        track3: String,
        track3DecodeStatus: Number,
        track3Masked: String
    },
    signatureRequired: Boolean
}
```

#### 3. Display Message Object:
```javascript
{
    displayMessage: String
}
```

#### 4. Transaction Status Object:
```javascript
{
    transactionStatus: {
        statusCode: Number,
        statusMsg: String,
        progressCode: Number,
        progressMsg: String
    }
}
```

#### 5. Error Object
There are many error objects, depending on what layer threw the error.
All errors extend JavaScript's [Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error). All have the following properties.
```javascript
{
    Error: {
        code: Number,
        name: String,
        message: String
    }
}
```

#### 6. Success Object
```javascript
{
    code: 0,
    message: String
}
```

#### 7. Device Information
```javascript
{
    deviceName: String,
    isConnected: Boolean,
    serialNumber: String,
    batteryLevel: Number //Scra devices only - Pin devices display battery level
}
```

Playground and Additional Information
============
Please visit our [Playground](https://btplayground.magensa.dev) for an interactive demo.
- The Playground also offers [detailed compatibility](https://btplayground.magensa.dev/compatibility-info) and first time pairing instructions for all compatible browsers and operating systems.  

