class DeviceError extends Error {
    constructor({ code, name, message }) {
        super(message);
        this.name = (name || "DeviceError");
        this.code = (code || 1000)
    }
}

export default DeviceError;
