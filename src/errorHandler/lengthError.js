class LengthError extends Error {
    constructor() {
        super("Device communication error. Length does not match data");
        this.name = "BleTransmissionError";
        this.code = 1012;
    }
}

export default LengthError;