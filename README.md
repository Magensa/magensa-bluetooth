magensa-bluetooth
==============
[![npm version](https://img.shields.io/npm/v/magensa-bluetooth.svg?style=for-the-badge)](https://www.npmjs.org/package/magensa-bluetooth "magensa-bluetooth npm.js")  
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
- [DynaPro Go](https://www.magtek.com/product/dynapro-go)

If you have a device, and would like to see this library in action, please head over to our [Playground](https://btplayground.magensa.dev).  
If you would like to purchase a device, please head over to the [MagTek Store](https://shop.magtek.com).  

Usage
=======
The implementation below will prompt a pair window displaying all MagTek devices in range.  Once the end user selects the appropriate device from the pair window, the response to this function call will be a [device object](#1-Device-Object).  
The device pair window is part of the [WebBluetooth API](https://www.w3.org/community/web-bluetooth), and is currently mandatory (no bypass exists as of this time).

```javascript
import { scanForDevices } from 'magensa-bluetooth';

function exampleCallback(dataObj) {
    console.log("data send from device", dataObj);
};

//Using Promises:
scanForDevices(exampleCallback).then( connectedDevice => 
    /*
        'connectedDevice', in this example, is a return object containing device information  
        and the interface needed to interact with your paired device.  
        See Device Object under the 'Return Objects' header below, for more details.  

        Store this device object in a manner that makes sense for your application.  
        This example saves the object to a global namespace:  
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
        /*  
            Now 'connectedDevice' contains the device object.  
            Store this in a manner that makes sense for your application.  
        */
        window.MagTekDevice = connectedDevice;
    }
    catch(error) {
        console.error(error);
    }
}
```  
  
The callback function(s) provided are the only way the paired device can send data to the host.  
- All data returned to the provided callbacks will be of type ```object```.  Please see [Return Objects](#Return-Objects) section for more information.
- Please see the [Callbacks](#Callbacks) section below for more information about user provided callback functions.
- For single page applications, please ensure that the callback function(s) provided is always "mounted" to receive data.


Device Interface API
============ 
All methods are asynchronous (```isDeviceOpen``` being the only synchronous exception).  Be sure to catch all exceptions - as any error occured upon invocation of these functions will throw an [Error](#5-Error-Object).  
  
| Function | Input Parameters | Output | Notes |
|:--------:|:-------:|:-------:|:--------:|
| scanForDevices | [callbacks](#Callbacks) [,deviceName[, deviceType]] | [Device Object](#1-Device-Object) | [Please refer to callback examples below](#Callback-Examples). Device name is optional. Device type is optional and supports special cases. Available types [listed here](#Device-Types) |
| startTransaction | [emvOptions](#EMV-Options-Object) | [Success](#6-Success-Object) | Initiates EMV transaction. [emvOptions](#EMV-Options-Object) is optional - any property supplied will override the default |
| cancelTransaction | none | [Success](#6-Success-Object) | Cancel any transaction that is in progress. |
| openDevice | none | [Success](#6-Success-Object) | Opens paired device to receive commands |
| closeDevice | none | [Success](#6-Success-Object) | Clears session (when applicable) and closes device safely |
| clearSession | Number (optional) | [Success](#6-Success-Object) | Removes previous card data from device's volatile memory. Only PinPad devices have session. Optional input is "Bitmap slot number" for displaying custom display templates |
| deviceInfo | none | [Device Information](#7Device-Information) | Be aware this call will clear device session prior to returning device information |
| requestCardSwipe | [swipeOptions](#Swipe-Options-Object) | [Success](#6-Success-Object) | [swipeOptions](#Swipe-Options-Object) is optional. Any property supplied will override the default|
| isDeviceOpen | none | ```Boolean``` | synchronous function that returns device's open status |
| sendCommand | ```Hex String``` or ```Array<Number>``` | ```object``` | send raw command to device. Output will be an object (if the response has a parser) or array (if returning raw device response) |
| forceDisconnect | none | ```void``` | Sever device connection, in the case that the device becomes unresponsive |
| requestPinEntry | [pinOptions](#PIN-Options-Object) | [Success](#6-Success-Object) | PinPad devices only |
| setDisplayMessage | [displayOptions](#Display-Options-Object) | [Success](#6-Success-Object) | PinPad devices only |
| sendUserSelection | Number | [Success](#6-Success-Object) | SCRA devices only. This command is only used to respond to device's [userSelectionRequest](#10-User-Selection-Request) |
| sendArpcResponse | ```Hex String``` or ```Array<Numbers>``` | [Success](#6-Success-Object) | For more information about building ARPC, please see the [MagTek® documentation](https://www.magtek.com/content/documentationfiles/d998200136.pdf#page=129) |
| setDeviceDateTime | JavaScript [```Date```](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) object | [Success](#6-Success-Object) | SCRA devices only |
| requestTipOrCashback | [tipCashbackOptions](#Tip-Cashback-Options-Object) | [Success](#6-Success-Object) | DynaPro Go Only |  


## EMV Options Object
Emv Options object is the input object for the ```startTransaction``` function.  All property values have default values. Any property supplied will override the default value, while any not supplied will use default values.  
There are some differences between devices - so this section will be broken down into four parts:  

1. [Properties that are shared](#Shared-Properties) by both device types   
2. [Properties for SCRA](#SCRA-properties-only) devices only
3. [PinPad properties](#PinPad-properties-only) only
4. [DynaPro Go properties](#DynaPro-Go-properties-only) only

### *__Shared Properties__*:
-------------------------------  
| Property Name | Description | Type  | Acceptable Values | Default Value |
|:------------:|:-----------:|:--------------:|:---------------:|:---------------:|
| timeout  | time, in seconds, before transaction timeout | Number | 1 - 255 | 60 |
| cardType | types of cards to accept for transaction | String | ```'msr', 'chip', 'chipMsr', 'contactless', 'contactlessChip', 'all'``` | ```chipMsr``` |
| cashBack | amount to process as cashback transaction. For transactionType ```'refund'```, this value must be ```0``` | Number or ```Array<Numbers>``` | Number or 6 'byte' n12 format representation of number Number type has [limitations](#Transaction-Amount-Limitations), please plan accordingly | 0 |
| currencyCode | type of currency. ```'default'``` uses device's application terminal setting (usually USA dollar) | String | ```'dollar', 'euro', 'pound', 'default'```| ```'dollar'``` |
| authorizedAmount | amount to authorize for transaction. For transactionType ```'refund'```, this value must be ```0``` | Number or ```Array<Numbers>``` | Number or 6 'byte' n12 format representation of number Number type has [limitations](#Transaction-Amount-Limitations), please plan accordingly | 100 |
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

### *__DynaPro Go properties only__*:
--------------------------  
| Property Name | Description | Type | Acceptable Values | Default Value | Notes |
|:------------:|:-----------:|:--------------:|:---------------:|:---------------:|:---------------:|
| taxAmount | Total tax amount | Number or ```Array<Numbers>``` | Number or 6 'byte' n12 format representation of number | 0 | No decimal points. Number type has [limitations](#Transaction-Amount-Limitations), please plan accordingly |
| taxPercent | Tax percentage rate | Number or ```Array<Numbers>``` | Number or 4 'byte' (n6 format x 100) representation of number | 0 - 99 |This number is for display purposes only - device does not perform tax calculations |
| tipAmount | Total tip amount | Number or ```Array<Numbers>``` | Number or 6 'byte' n12 format representation of number | 0 | No decimal points. Number type has [limitations](#Transaction-Amount-Limitations), please plan accordingly |
| balanceBeforeGenAC | (Contactless Only) Balance Read Before Gen AC (EMV Tag DF8104) | Number or ```Array<Numbers>``` | Number or 6 'byte' n12 format representation of number | 0 | No decimal points. Number type has [limitations](#Transaction-Amount-Limitations), please plan accordingly |
| balanceAfterGenAC | (Contactless Only) Balance Read After Gen AC (EMV Tag DF8105) | Number or ```Array<Numbers>``` | Number or 6 'byte' n12 format representation of number | 0 | No decimal points. Number type has [limitations](#Transaction-Amount-Limitations), please plan accordingly |
| trxCategoryCode | (PayPass/MCL Tag 9F53) | Number | N/A | 0 | Optional value |

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

## PIN Options Object
| Property Name | Description | Type | Acceptable Values | Default Value | Notes |
|:------------:|:-----------:|:--------------:|:---------------:|:---------------:|:---------------:|
| languageSelection | Define language prompt behavior | String | ```'disabled', 'englishFrench', 'allSpecified' ``` | ```'disabled'``` | ```'allSpecified'``` uses tag DFDF2D to define available languages |
| displayType | Define prompt template for PIN entry | String | ```'enterPin', 'enterPinAmount', 'reEnterPin', 'reEnterPinAmount', 'verifyPin'``` | ```'enterPin'``` | |
| timeout  | time, in seconds, before requestPin timeout | Number | 0 - 255 (0 for 256 seconds) | 30 | |
| toneChoice | Select device beep behavior | String | ```'noSound', 'oneBeep', 'twoBeeps'``` | ```'oneBeep'``` | |
| pinBlockFormat | Define Pin Block Format | String | ```'iso0', 'iso3'``` | ```'iso0'``` | This value is only respected if device is sent a PAN. If device has no PAN, device creates EPB using ISO Format 1 | 
| verifyPin | Should device prompt for PIN verification | Boolean | ```true, false``` | ```true``` | |
| waitMessage | Display wait message | Boolean | ```true, false``` | ```true``` | |
| maxPinLength | Specify maximum PIN length | Number | <=12 && >= ```minPinLength``` | 12 | Value must be <=12 and >= ```minPinLength``` |
| minPinLength | Specify minimum PIN length| Number | >=4 && <= ```maxPinLength``` | 4 | Value must be >=4 and <= ```maxPinLength``` |

## Tip Cashback Options Object

| Property Name | Description | Type | Acceptable Values | Default Value | Notes |
|:------------:|:-----------:|:--------------:|:---------------:|:---------------:|:---------------:|
| timeout | time (in seconds) before operation timeout | Number | 1 - 60 | 30 |  |
| commandType | Tip or Cashback Mode | String | ```'tip', 'cashback'``` | N/A | commandType is required |
| toneChoice | Select device beep behavior | String | ```'noSound', 'oneBeep', 'twoBeeps'``` | ```'oneBeep'``` | |
| transactionAmount | Subtotal amount for transaction | Number or ```Array<Numbers>``` | Number or 6 'byte' n12 format representation of number | N/A | No decimal points. Number type has [limitations](#Transaction-Amount-Limitations), please plan accordingly |
| calculatedTaxAmount | Total tax amount | Number or ```Array<Numbers>``` | Number or 6 'byte' n12 format representation of number | N/A | No decimal points. Number type has [limitations](#Transaction-Amount-Limitations), please plan accordingly |
| taxRate | Tax percentage rate | Number or ```Array<Numbers>``` |  Number or 4 'byte' (n6 format x 100) representation of number | 0 - 99 | This number is for display purposes only - device does not perform tax calculations. taxRate is required |
| tipSelectionMode | Preset tip amount type | String | ```'percent', 'amount'``` | N/A | This value is only mandatory in Tip mode. N/A for Cashback Mode |
| leftAmount | Fixed Percent or Amount for left display | Number | 0-99 | 0 | N/A for Cashback Mode |
| middleAmount | Fixed Percent or Amount for middle display | Number | 0-99 | 0 | N/A for Cashback Mode |
| rightAmount | Fixed Percent or Amount for right display | Number | 0-99 | 0 | N/A for Cashback Mode |

## Display Options Object

| Property Name | Description | Type | Acceptable Values | Default Value | Notes |
|:------------:|:-----------:|:--------------:|:---------------:|:---------------:|:---------------:|
| messageId | Id for message to display | Number | [Acceptable IDs are listed here](https://www.magtek.com/content/documentationfiles/d998200136.pdf#page=51) | N/A | No default value - ID is required |
| displayTime | How long the display message will display on screen | Number | 0 (infinite) - 255 | 15 seconds | |

# Callbacks
User defined callback functions can be as granular as desired.  For this purpose - there is only one callback that is mandatory to provide to the ```scanForDevices``` method.  The remaining callbacks are subscription based.  In reference to the return objects for the below callbacks - please see the [Return Objects](#Return-Objects) section for object structures.

```errorCallback``` is the only special case. Please see description for behavior. For all other callbacks - if one is not provided - data will be sent to the main callback (```transactionCallback```).  This can sometimes clutter the callback data, and become problematic, so please plan callback structure according to your specific needs.  
  
| Callback | Return object | Notes |
|:--------:|:-------------:|:-----:|
| transactionCallback | [Transaction Result Object](#2-Transaction-Result-Object) | Transaction data. Object structure will depend on which type of transaction was requested. This is the only mandatory callback, as it serves as the main/default callback. |
| errorCallback | [Error Object](#5-Error-Object) | If provided, all internal errors that cannot be thrown to a caller will be piped to this callback. If not provided, internal errors will log to JavaScript console. All errors pertaining to functions invoked via the [deviceInterface](#Device-Interface-API) will always be thrown back to the caller |
| displayCallback | [Display Message Object](#3-Display-Message-Object) | Message to display directly to the end user. This callback is only used by SCRA devices. PinPad devices will display messages directly on the device |
| transactionStatusCallback | [Transaction Status Object](#4-Transaction-Status-Object) | Status, Progress, Messages, and Codes will all be piped to this callback. You can throttle [```reportVerbosity```](#SCRA-properties-only) on SCRA devices |
| disconnectHandler | Disconnect Event | Disconnect Event inherits from [Event](https://developer.mozilla.org/en-US/docs/Web/API/Event). Disconnect events are emitted every time a device disconnects (closes) |
| userSelectionCallback | [userSelectionRequest](#10-User-Selection-Request) | SCRA devices that have multiple applications, and process a card with multiple applications will send this report. User must select item from the menu items listed in the report and respond using the ```sendUserSelection``` function with the menu selection number |

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
            PinPad devices will not use this callback, and will instead use the device display.
            The message language is determined by device configuration.
        */
        document.getElementById('display-to-user').innerText = displayMessage;
    }

    allCallbacks.userSelectionCallback = ({ userSelectionRequest }) => {
        /*
            Respond to any User Selection Request Notifications.
            SCRA devices with multiple applications only.
        */
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
        const deviceResp = await scanForDevices(callbacks);
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
        PinPad devices will not use this callback, and will instead use the device display.
        The message language is determined by device configuration.
    */
    document.getElementById('display-to-user').innerText = displayMessage;
}

const exampleDisconnectHandler = event => {
    //Handle device disconnect events.
    let message = `Device: ${event.target.name} has disconnected`;
}

const exampleUserSelectionCallback = ({ userSelectionRequest }) => {
     /*
        Respond to any User Selection Request Notifications.
        SCRA devices with multiple applications only.
    */
}

//Note that when structuring multiple callbacks in an object - 'transactionCallback' becomes mandatory.

let callBackObject = {
    transactionCallback: exampleTransactionHandler,
    errorCallback: exampleErrorHandler,
    displayCallback: exampleDisplayMessageHandler,
    transactionStatusCallback: exampleTransactionStatusHandler,
    disconnectHandler: exampleDisconnectHandler,
    userSelectionCallback: exampleUserSelectionCallback
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
        const deviceResp = await scanForDevices(callBackObject);
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
    deviceInterface: {
        openDevice: Function
        startTransaction: Function
        cancelTransaction: Function
        sendCommand: Function
        clearSession: Function
        closeDevice: Function
        deviceInfo: Function
        requestCardSwipe: Function
        isDeviceOpen: Function
        forceDisconnect: Function
        requestPinEntry: Function
        setDisplayMessage: Function
        sendUserSelection: Function
        sendArpcResponse: Function
        setDeviceDateTime: Function
        requestTipOrCashback: Function
    }
}
```

#### 2. Transaction Result Object:
```arqcData``` and ```batchData``` are hex strings that are unparsed, and contain the same data as the parsed objects.
```javascript
{
    arqcData: String,
    arqcDataParsed: [
        { tag: String, length: Number, value: String }, 
        { tag: String, length: Number, value: String }
    ],
    batchData: String,
    batchDataParsed: [
        { tag: String, length: Number, value: String },
        { tag: String, length: Number, value: String }
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
    deviceType: String,
    isConnected: Boolean,
    serialNumber: String,
    batteryLevel: Number //Scra devices only - Pin devices display battery level
}
```

#### 8. Tip Cashback Report
```javascript
{
    tipCashbackReport: {
        operationStatus: String,
        reportMode: String,
        amount: Array<Number>,
        tax: Array<Number>,
        taxRate: Array<Number>,
        tipOrCashbackAmount: Array<Number>
    }
}
```

#### 9. Pin Data Report
```javascript
{
    pinData: {
        operationStatus: String,
        pinKsn: String,
        encryptedPinBlock: String
    }
}
```

#### 10. User Selection Request
```javascript
{
    userSelectionRequest: {
        selectionType: String,
        timeRemaining:  Number,
        menuItems: Array<Number>
    }
}
```

Playground and Additional Information
============
Please visit our [Playground](https://btplayground.magensa.dev) for an interactive demo.
- The Playground also offers [detailed compatibility](https://btplayground.magensa.dev/compatibility-info) information, as well as first time pairing instructions for all compatible browsers and operating systems.  
- The Playground [source code](https://github.com/Magensa/MagensaBluetoothPlayground) is also available as an example implementation.
<br />  

## _Debug Event_
For added visibility during development, this library has a debug event emitter (```deviceLog```) that will log verbose details for all device interactions.    
This can be especially useful when a bad command is sent - or to see the behavior when a device begins to refuse commands.   
If you wish to subscribe to the event, you may do so:  
```javascript
const debugLogger = logInfo => console.log(logInfo.detail);

window.addEventListener('deviceLog', debugLogger, { passive: true});
//Be sure to remove it when unmounting to avoid memory leaks:
window.removeEventListener('deviceLog', debugLogger, { passive: true});
```  

## _WebBluetooth Info_
There are some [WebBluetooth](https://www.w3.org/community/web-bluetooth) issues that users of this library should be made aware of:  

- The _initial_ pairing process (wherin the Chromium browser, and the Operating System coincide the Bluetooth Pair) can be a bit challenging at times. To that end, a comprehensive list of pairing instructions, based upon browser choice and operating system, has been put together in our [Playground](https://btplayground.magensa.dev/compatibility-info).
    - Select a browser, operating system, expand the panel and click "Specific Details".
    - Most all users that have trouble getting this library started, need to follow the instructions to the letter.
        - Also, following the instructions to the letter, in addition to a device power cycle, will solve most all initial pairing issues.
    - Remember this initial pair is one-time only, and does not need to be repeated to utilize the library (or any WebBluetooth solution) in the future.  
  
- There is a simple check that can be included in the web application that consumes this library, to see if the client is using a compatible browser.  That check is as follows:  
    ```javascript
        if (navigator && navigator.bluetooth) { 
            //Compatible
        }
        else {
            //Not Compatible browser
        }
    ```
    - It is important to note that compatible browsers _will fail_ this check if the site is not deployed through secure context (valid https:// domain).
        - ```localhost``` will work for development purposes, but it's important to note that ```192.168.0.1:``` and ```127.0.0.1``` will both fail the secure context check.
            - This is especially important to consider for active mobile development.
        - When a compatible browser fails the secure context check - the bluetooth property is removed from the ```navigator``` object. No other error or warning is emitted.

## _Transaction Amount Limitations_
Please be aware that there are limitations on maximum amounts for transactions:  
The maximum length of Transaction Amount, Calculated Tax Amount, Tip dollar amount, and Cash Back
dollar amount is 10 digits. If the Tip calculated by percentage equals or exceeds $42,949,672.95, the
device shows 0.

## _Device Types_
Under very rare circumstances, it is possible this library will fail to identify a valid device type.  
In this case, there is a third parameter for ```scanForDevices``` function that accepts a ```deviceType```. The available types are:  
- ```tDynamo```
- ```eDynamo```
- ```dynaProGo```
- ```DynaPro Mini```  

MagTek® is a registered trademark of MagTek, Inc.  
Magensa™ is a trademark of MagTek, Inc.
