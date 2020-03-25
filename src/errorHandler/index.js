import EmvParser from '../parsers/emvParser'
import ApiError from './apiError';
import LengthError from './lengthError';
import DeviceError from './deviceError';

class ErrorHandler extends EmvParser {
    constructor(callbacks) {
        super();

        this.errorCallback = callbacks.errorCallback;
    };

    buildDeviceErr = err => (err instanceof DOMException) ? 
        new ApiError(err) : (err instanceof Error) ? 
            err : new DeviceError(err);

    throwLenErr = () => new LengthError();

    sendErrToCallback = err => {
        this.errorCallback(err);
        return err;
    };
}

export default ErrorHandler;