/**
 * Finds all ELST atoms in an MP4 file by traversing the proper hierarchy
 * @param buffer - Uint8Array containing the MP4 file data
 * @returns Array of ELST atoms found in the MP4 file
 */
export function findElstAtoms(buffer) {
    const elstAtoms = [];
    const timescales = [];
    // Step 1: Find the moov atom
    const moovAtom = findAtom(buffer, 0, buffer.length, 'moov');
    if (!moovAtom) {
        console.log('No moov atom found');
        return elstAtoms;
    }
    // Step 2: Find all trak atoms within moov
    const mvhdAtom = findAtom(buffer, moovAtom.offset + 8, moovAtom.offset + moovAtom.size, 'mvhd');
    if (!mvhdAtom) {
        console.log('No mvhd atom found');
        return elstAtoms;
    }
    const mvhdTimescale = parseMvhdTimescale(buffer, mvhdAtom.offset);
    // Step 2: Find all trak atoms within moov
    const trakAtoms = findAtoms(buffer, moovAtom.offset + 8, moovAtom.offset + moovAtom.size, 'trak');
    // Step 3: For each trak, find the edts atom and then the elst atom
    for (const trakAtom of trakAtoms) {
        // Find trackID first (in tkhd)
        let trackId;
        const tkhdAtom = findAtom(buffer, trakAtom.offset + 8, trakAtom.offset + trakAtom.size, 'tkhd');
        if (tkhdAtom) {
            // Version is at offset 8 from tkhd start
            const version = buffer[tkhdAtom.offset + 8];
            // Track ID is at different offsets depending on version
            if (version === 0) {
                // Version 0: skip 12 bytes (version, flags, creation time, modification time)
                trackId = readUint32(buffer, tkhdAtom.offset + 20);
            }
            else {
                // Version 1: skip 20 bytes (version, flags, creation time (64-bit), modification time (64-bit))
                trackId = readUint32(buffer, tkhdAtom.offset + 28);
            }
        }
        // Find edts atom
        const edtsAtom = findAtom(buffer, trakAtom.offset + 8, trakAtom.offset + trakAtom.size, 'edts');
        const mdiaAtom = findAtom(buffer, trakAtom.offset + 8, trakAtom.offset + trakAtom.size, 'mdia');
        let timescale = 1;
        if (mdiaAtom) {
            // Find elst atom within edts
            const mdhdAtom = findAtom(buffer, mdiaAtom.offset + 8, mdiaAtom.offset + mdiaAtom.size, 'mdhd');
            if (mdhdAtom) {
                // Parse the elst atom
                timescale = parseMdhdTimescale(buffer, mdhdAtom.offset);
            }
        }
        if (edtsAtom) {
            // Find elst atom within edts
            const elstAtom = findAtom(buffer, edtsAtom.offset + 8, edtsAtom.offset + edtsAtom.size, 'elst');
            if (elstAtom) {
                // Parse the elst atom
                const parsedElst = parseElstAtom(buffer, elstAtom.offset);
                if (parsedElst) {
                    parsedElst.trackId = trackId;
                    parsedElst.timescale = timescale;
                    parsedElst.mvhdTimescale = mvhdTimescale;
                    elstAtoms.push(parsedElst);
                }
            }
        }
    }
    return elstAtoms;
}
/**
 * Find an atom of a specific type within a range
 * @param buffer - Uint8Array containing the MP4 file data
 * @param start - Start offset to search from
 * @param end - End offset to search to
 * @param type - Type of atom to find (e.g., 'moov', 'trak')
 * @returns Atom object if found, null otherwise
 */
export function findAtom(buffer, start, end, type) {
    let offset = start;
    while (offset < end - 8) {
        const size = readUint32(buffer, offset);
        if (size === 0 || offset + size > end) {
            break;
        }
        const atomType = String.fromCharCode(buffer[offset + 4], buffer[offset + 5], buffer[offset + 6], buffer[offset + 7]);
        if (atomType === type) {
            return {
                offset,
                size,
                type: atomType
            };
        }
        offset += size;
    }
    return null;
}
/**
 * Find all atoms of a specific type within a range
 * @param buffer - Uint8Array containing the MP4 file data
 * @param start - Start offset to search from
 * @param end - End offset to search to
 * @param type - Type of atom to find (e.g., 'trak')
 * @returns Array of atom objects found
 */
export function findAtoms(buffer, start, end, type) {
    const atoms = [];
    let offset = start;
    while (offset < end - 8) {
        const size = readUint32(buffer, offset);
        if (size === 0 || offset + size > end) {
            break;
        }
        const atomType = String.fromCharCode(buffer[offset + 4], buffer[offset + 5], buffer[offset + 6], buffer[offset + 7]);
        if (atomType === type) {
            atoms.push({
                offset,
                size,
                type: atomType
            });
        }
        offset += size;
    }
    return atoms;
}
/**
 * Parse a single ELST atom starting at the specified offset
 * @param buffer - Uint8Array containing the MP4 file data
 * @param offset - Offset where the ELST atom starts
 * @returns Parsed ELST atom or null if parsing failed
 */
export function parseElstAtom(buffer, offset) {
    try {
        const size = readUint32(buffer, offset);
        // Read version and flags
        const versionAndFlags = readUint32(buffer, offset + 8);
        const version = (versionAndFlags >> 24) & 0xFF;
        const flags = versionAndFlags & 0xFFFFFF;
        // Read entry count
        const entryCount = readUint32(buffer, offset + 12);
        // Create ELST atom object
        const elstAtom = {
            offset,
            size,
            version,
            flags,
            entryCount,
            entries: [],
            timescale: 0,
            mvhdTimescale: 0,
        };
        // Starting point for entries data
        let entryOffset = offset + 16;
        // Parse each entry based on version
        for (let i = 0; i < entryCount; i++) {
            if (version === 0) {
                // 32-bit values in version 0
                const segmentDuration = readUint32(buffer, entryOffset);
                const mediaTime = readInt32(buffer, entryOffset + 4);
                const mediaRateInteger = readInt16(buffer, entryOffset + 8);
                const mediaRateFraction = readInt16(buffer, entryOffset + 10);
                elstAtom.entries.push({
                    segmentDuration,
                    mediaTime,
                    mediaRateInteger,
                    mediaRateFraction,
                });
                entryOffset += 12; // 32-bit (4 bytes) * 3 fields
            }
            else if (version === 1) {
                // 64-bit values in version 1
                const segmentDuration = readUint64(buffer, entryOffset);
                const mediaTime = readInt64(buffer, entryOffset + 8);
                const mediaRateInteger = readInt16(buffer, entryOffset + 16);
                const mediaRateFraction = readInt16(buffer, entryOffset + 18);
                elstAtom.entries.push({
                    segmentDuration,
                    mediaTime,
                    mediaRateInteger,
                    mediaRateFraction,
                });
                entryOffset += 20; // 64-bit (8 bytes) * 2 fields + 16-bit (2 bytes) * 2 fields
            }
            else {
                console.error(`Unknown ELST version: ${version}`);
                return null;
            }
        }
        return elstAtom;
    }
    catch (error) {
        console.error("Error parsing ELST atom:", error);
        return null;
    }
}
// Utility functions for reading various data types
export function readUint32(buffer, offset) {
    return ((buffer[offset] << 24) |
        (buffer[offset + 1] << 16) |
        (buffer[offset + 2] << 8) |
        buffer[offset + 3]);
}
export function readInt32(buffer, offset) {
    const value = readUint32(buffer, offset);
    return value > 0x7FFFFFFF ? value - 0x100000000 : value;
}
export function readInt16(buffer, offset) {
    const value = (buffer[offset] << 8) | buffer[offset + 1];
    return value > 0x7FFF ? value - 0x10000 : value;
}
export function readUint64(buffer, offset) {
    // JavaScript can't handle 64-bit integers precisely
    // This implementation assumes the high 32 bits are small enough
    const high = readUint32(buffer, offset);
    const low = readUint32(buffer, offset + 4);
    // If high bits are too large, this will lose precision
    return high * 0x100000000 + low;
}
export function readInt64(buffer, offset) {
    const high = readInt32(buffer, offset);
    const low = readUint32(buffer, offset + 4);
    // If high bits are too large, this will lose precision
    return high * 0x100000000 + low;
}
export function parseMdhdTimescale(buffer, startOffset) {
    /**
     * Parse the MDHD atom to extract the timescale value.
     *
     * @param data - Binary data containing the MDHD atom
     * @param startOffset - Offset to the start of the MDHD atom
     * @returns The timescale value as an integer
     */
    // Skip atom size (4 bytes) and atom type (4 bytes)
    let offset = startOffset + 8;
    // Get version (1 byte)
    const version = buffer[offset];
    offset += 1;
    // Skip flags (3 bytes)
    offset += 3;
    let timescale;
    if (version === 1) {
        // Version 1: 64-bit creation and modification times
        // Skip creation_time (8 bytes), modification_time (8 bytes)
        offset += 16;
        // Extract timescale (4 bytes)
        timescale = (buffer[offset] << 24) | (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3];
    }
    else {
        // Version 0: 32-bit times
        // Skip creation_time (4 bytes) and modification_time (4 bytes)
        offset += 8;
        // Extract timescale (4 bytes)
        timescale = (buffer[offset] << 24) | (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3];
    }
    return timescale;
}
export function modifyElstAtom(buffer, elstAtom, startTimeUs, endTimeUs) {
    let byteArray = elstAtom.version == 1 ? new Uint8Array(16) : new Uint8Array(8);
    const duration = endTimeUs - startTimeUs;
    const scaledSegmentDuration = BigInt(Math.round(Number(duration) * elstAtom.mvhdTimescale / Number(1000000)));
    const mediaTime = BigInt(Math.round(Number(startTimeUs) * (elstAtom.timescale) / Number(1000000)));
    if (elstAtom.version == 1) {
        byteArray.set(BigIntToUint8Array(scaledSegmentDuration), 0);
        byteArray.set(BigIntToUint8Array(mediaTime), 8);
    }
    else {
        byteArray.set(NumberToUint8Array(Number(scaledSegmentDuration)), 0);
        byteArray.set(NumberToUint8Array(Number(mediaTime)), 4);
    }
    buffer.set(byteArray, elstAtom.offset + 16);
    function BigIntToUint8Array(value) {
        let arr = new Uint8Array(8);
        for (let i = 0; i < 8; i++) {
            arr[7 - i] = Number(value & BigInt(0xFF)); // Extract last 8 bits
            value >>= BigInt(8); // Shift right by 8 bits
        }
        return arr;
    }
    function NumberToUint8Array(value) {
        let arr = new Uint8Array(4);
        let tempValue = value >>> 0; // Ensure it's treated as unsigned
        for (let i = 0; i < 4; i++) {
            arr[3 - i] = tempValue & 0xFF; // Extract last 8 bits
            tempValue >>= 8; // Shift right by 8 bits
        }
        return arr;
    }
}
export function parseMvhdTimescale(buffer, startOffset) {
    /**
     * Parse the MDHD atom to extract the timescale value.
     *
     * @param data - Binary data containing the MDHD atom
     * @param startOffset - Offset to the start of the MDHD atom
     * @returns The timescale value as an integer
     */
    // Skip atom size (4 bytes) and atom type (4 bytes)
    let offset = startOffset + 8;
    // Get version (1 byte)
    const version = buffer[offset];
    offset += 1;
    // Skip flags (3 bytes)
    offset += 3;
    let timescale;
    if (version === 1) {
        // Version 1: 64-bit creation and modification times
        // Skip creation_time and modification
        offset += 16;
        // Extract timescale (4 bytes)
        timescale = (buffer[offset] << 24) | (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3];
    }
    else {
        // Version 0: 32-bit times
        // Skip creation_time and modification
        offset += 8;
        // Extract timescale (4 bytes)
        timescale = (buffer[offset] << 24) | (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3];
    }
    return timescale;
}
