class ApiError extends Error {
    constructor({ message, code, name }) {
        super( (message || "Web Bluetooth API threw an unknown, or undocumented error" ));
        this.code = (code || 1000);
        this.name = (name || "WebBluetoothError")
    }
}

export default ApiError;