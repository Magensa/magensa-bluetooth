import DeviceBase from '../devices/baseClass';

class ScraSwipeParser extends DeviceBase {
    constructor(device, callBacks) {
        super(device, callBacks);

        this.dataNames = [
            'track1',
            'track2',
            'track3',
            'ksn',
            'magnePrint',
            'magnePrintStatus',
            'serialNumber',
            'encSessionId',
            'track1Masked',
            'track2Masked',
            'track3Masked'
        ];

        this.offset = 3;

        //Moved Status Enums to DeviceBase for inheritance.
    }

    trackIndices = offset => Object.freeze({
        track1DecodeStatus: offset,
        track2DecodeStatus: offset + 1,
        track3DecodeStatus: offset + 2,
        track1Len: offset + 3,
        track2Len: offset + 4,
        track3Len: offset + 5,
        cardEncodeType: offset + 6,
        track1Start: offset + 7,
        track1End: offset + 118,
        track2Start: offset + 119,
        track2End: offset + 230,
        track3Start: offset + 231,
        track3End: offset + 342,
        cardStatus: offset + 343,
        magnePrintStatusStart: offset + 344,
        magnePrintStatusEnd: offset +  347,
        magnePrintLen: offset + 348,
        magnePrintStart: offset + 349,
        magnePrintEnd: offset + 476,
        serialNumberStart: offset + 477,
        serialNumberEnd: offset + 492,
        deviceEncStatusStart: offset + 493,
        deviceEncStatusEnd: offset + 494,
        ksnStart: offset + 495,
        ksnEnd: offset + 504,
        track1MaskedLen: offset + 505,
        track2MaskedLen: offset + 506,
        track3MaskedLen: offset + 507,
        track1MaskedStart: offset + 508,
        track1MaskedEnd: offset + 619,
        track2MaskedStart: offset + 620,
        track2MaskedEnd: offset + 731,
        track3MaskedStart: offset + 732,
        track3MaskedEnd: offset + 843,
        encSessionIdStart: offset + 844,
        encSessionIdEnd: offset + 851,
        track1AbsLen: offset + 852,
        track2AbsLen: offset + 853,
        track3AbsLen: offset + 854,
        magnePrintAbsLen: offset + 855
    });

    parseHidData = data => {
        let trackPositions = this.trackIndices(this.offset);
        let trackInfo = {};
    
        //Iterate through track names and format in key value pair format.
        this.dataNames.forEach( dataProp => {

            let trackData = data.slice(
                trackPositions[`${dataProp}Start`], trackPositions[`${dataProp}End`] + 1
            );

            if (trackPositions.hasOwnProperty(`${dataProp}Len`)) {
                trackData = trackData.slice(
                    0, data[trackPositions[`${dataProp}Len`]]
                )
            }

            //Special formatting is needed for track2Masked, tracks with a "DecodeStatus" field, Device Serial Number, and tracks that have a "masked" suffix.
            //The below ternary returns the proper format, depending on track name, and performs much better than if/elseif/else statement.
            trackInfo = (dataProp === 'track2Masked') ? this.formatTrack2Masked( trackInfo, dataProp, this.bufferToUtf8(trackData) ) : 
                (trackPositions.hasOwnProperty(`${dataProp}DecodeStatus`)) ? this.formatTrackWithDecode( trackInfo, dataProp, data[trackPositions[`${dataProp}DecodeStatus`]], this.convertArrayToHexString(trackData) ) : 
                    (dataProp === 'serialNumber') ? this.formatSerialNumber(trackInfo, trackData) : 
                    { 
                        ...trackInfo,
                        [dataProp] : (dataProp.toLowerCase().includes('masked')) ? this.bufferToUtf8(trackData) : this.convertArrayToHexString(trackData)
                    }
        })
        
        return { swipeData: { ...trackInfo } };
    }

    formatSerialNumber = (trackInfo, trackData) => ({
        ...trackInfo,
        serialNumber: this.bufferToUtf8( (trackData.length > 7 ? trackData.slice(0, 7) : trackData ) )
    });

    //Moved Exp and PAN formating to Utils class - for inheritance.

    formatTrack2Masked = (trackInfo, dataProp, track2Masked) => ({
        ...trackInfo,
        [dataProp] : track2Masked,
        ...this.formatExpPAN(track2Masked)
    });

    formatTrackWithDecode = (trackInfo, dataProp, decodeStatusValue, trackValue) => ({
        ...trackInfo,
        [dataProp] : trackValue,
        [`${dataProp}DecodeStatus`] : decodeStatusValue === 0x00 ? "Ok" : "Error",
        [`${dataProp}DecodeStatusCode`] : decodeStatusValue
    });
}

export default ScraSwipeParser;