export const IDENTITY_MATRIX = new Uint8Array([
    // First row
    0x00, 0x01, 0x00, 0x00, // 0x00010000
    0x00, 0x00, 0x00, 0x00, // 0x00000000
    0x00, 0x00, 0x00, 0x00, // 0x00000000
    // Second row
    0x00, 0x00, 0x00, 0x00, // 0x00000000
    0x00, 0x01, 0x00, 0x00, // 0x00010000
    0x00, 0x00, 0x00, 0x00, // 0x00000000
    // Third row
    0x00, 0x00, 0x00, 0x00, // 0x00000000
    0x00, 0x00, 0x00, 0x00, // 0x00000000
    0x40, 0x00, 0x00, 0x00 // 0x40000000
]);
export const ROTATE_90 = new Uint8Array([
    // First row
    0x00, 0x00, 0x00, 0x00, // 0.0
    0x00, 0x01, 0x00, 0x00, // 1.0 in fixed point (0x00010000)
    0x00, 0x00, 0x00, 0x00, // 0.0
    // Second row
    0xFF, 0xFF, 0x00, 0x00, // -1.0 in fixed point (0xFFFF0000)
    0x00, 0x00, 0x00, 0x00, // 0.0
    0x00, 0x00, 0x00, 0x00, // 0.0
    // Third row
    0x00, 0x00, 0x00, 0x00, // 0.0
    0x00, 0x00, 0x00, 0x00, // 0.0
    0x40, 0x00, 0x00, 0x00 // 1.0 in fixed point (0x40000000)
]);
export const ROTATE_180 = new Uint8Array([
    // First row
    0xFF, 0xFF, 0x00, 0x00, // -1.0 in fixed point (0xFFFF0000)
    0x00, 0x00, 0x00, 0x00, // 0.0
    0x00, 0x00, 0x00, 0x00, // 0.0
    // Second row
    0x00, 0x00, 0x00, 0x00, // 0.0
    0xFF, 0xFF, 0x00, 0x00, // -1.0 in fixed point (0xFFFF0000)
    0x00, 0x00, 0x00, 0x00, // 0.0
    // Third row
    0x00, 0x00, 0x00, 0x00, // 0.0
    0x00, 0x00, 0x00, 0x00, // 0.0
    0x40, 0x00, 0x00, 0x00 // 1.0 in fixed point (0x40000000)
]);
export const ROTATE_270 = new Uint8Array([
    // First row
    0x00, 0x00, 0x00, 0x00, // 0.0
    0xFF, 0xFF, 0x00, 0x00, // -1.0 in fixed point (0xFFFF0000)
    0x00, 0x00, 0x00, 0x00, // 0.0
    // Second row
    0x00, 0x01, 0x00, 0x00, // 1.0 in fixed point (0x00010000)
    0x00, 0x00, 0x00, 0x00, // 0.0
    0x00, 0x00, 0x00, 0x00, // 0.0
    // Third row
    0x00, 0x00, 0x00, 0x00, // 0.0
    0x00, 0x00, 0x00, 0x00, // 0.0
    0x40, 0x00, 0x00, 0x00 // 1.0 in fixed point (0x40000000)
]);
export function readUInt32BE(fileBuffer, offset) {
    const view = new DataView(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);
    return view.getUint32(offset, false); // false for big-endian
}
export function findVideoTkhdOffset(fileBuffer) {
    let offset = 0;
    const length = fileBuffer.length;
    while (offset < length) {
        if (offset + 8 > length)
            break; // Prevent reading beyond buffer
        const atomSize = readUInt32BE(fileBuffer, offset);
        const atomType = new TextDecoder().decode(fileBuffer.slice(offset + 4, offset + 8));
        if (atomSize < 8 || offset + atomSize > length)
            break; // Invalid atom
        if (atomType === 'moov') {
            let moovEnd = offset + atomSize;
            let moovOffset = offset + 8;
            while (moovOffset < moovEnd) {
                if (moovOffset + 8 > moovEnd)
                    break;
                const trakSize = readUInt32BE(fileBuffer, moovOffset);
                const trakType = new TextDecoder().decode(fileBuffer.slice(moovOffset + 4, moovOffset + 8));
                if (trakType === 'trak') {
                    let trakEnd = moovOffset + trakSize;
                    let trakOffset = moovOffset + 8;
                    let tkhdOffset = null;
                    let tkhdSize = null;
                    let isVideoTrack = false;
                    while (trakOffset < trakEnd) {
                        if (trakOffset + 8 > trakEnd)
                            break;
                        const subAtomSize = readUInt32BE(fileBuffer, trakOffset);
                        const subAtomType = new TextDecoder().decode(fileBuffer.slice(trakOffset + 4, trakOffset + 8));
                        if (subAtomType === 'tkhd') {
                            tkhdOffset = trakOffset;
                            tkhdSize = subAtomSize;
                        }
                        else if (subAtomType === 'mdia') {
                            let mdiaEnd = trakOffset + subAtomSize;
                            let mdiaOffset = trakOffset + 8;
                            while (mdiaOffset < mdiaEnd) {
                                if (mdiaOffset + 8 > mdiaEnd)
                                    break;
                                const mdiaSubAtomSize = readUInt32BE(fileBuffer, mdiaOffset);
                                const mdiaSubAtomType = new TextDecoder().decode(fileBuffer.slice(mdiaOffset + 4, mdiaOffset + 8));
                                if (mdiaSubAtomType === 'hdlr') {
                                    const handlerType = new TextDecoder().decode(fileBuffer.slice(mdiaOffset + 16, mdiaOffset + 20));
                                    if (handlerType === 'vide') {
                                        isVideoTrack = true;
                                    }
                                }
                                mdiaOffset += mdiaSubAtomSize;
                            }
                        }
                        trakOffset += subAtomSize;
                    }
                    if (isVideoTrack && tkhdOffset !== null && tkhdSize != null) {
                        return [tkhdOffset, tkhdSize];
                    }
                }
                moovOffset += trakSize;
            }
        }
        offset += atomSize;
    }
    return null;
}
export function getMatrix(fileBuffer, matrixOffset) {
    return new Uint8Array(fileBuffer.slice(matrixOffset, matrixOffset + 36));
}
export function modifyTkhdMatrix(fileBuffer, matrixOffset, currentMatrix, rotation = '90cw') {
    if (matrixOffset + 36 > fileBuffer.length)
        return;
    const matrix = [IDENTITY_MATRIX, ROTATE_90, ROTATE_180, ROTATE_270];
    const index = findMatchingIndex(matrix, currentMatrix);
    let matrixBytes = IDENTITY_MATRIX;
    // Set rotation matrix values based on specified rotation
    switch (rotation) {
        case '90cw':
            matrixBytes = matrix[(index + 1) % 4];
            break;
        case '180':
            matrixBytes = matrix[(index + 2) % 4];
            break;
        case '90ccw':
            matrixBytes = matrix[(index + 3) % 4];
            break;
    }
    const byteArray = new Uint8Array(matrixBytes.buffer);
    fileBuffer.set(byteArray, matrixOffset);
    function areBytesEqual(a, b) {
        if (a.length !== b.length)
            return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i])
                return false;
        }
        return true;
    }
    function findMatchingIndex(matrix, target) {
        const index = matrix.findIndex(item => areBytesEqual(item, target));
        return index === -1 ? 0 : index; // Return 0 if no match is found
    }
}
export function calculateMatrixOffset(fileBuffer, tkhdOffset) {
    // Read the version byte (first byte of the box content)
    const version = fileBuffer[tkhdOffset + 8];
    // Based on the standard, the matrix follows:
    // Version 0: 4 (fullbox) + 32 (creation_time to duration) + 8 (reserved) + 4 (layer & alternate_group) + 4 (volume & reserved) = 52 bytes
    // Version 1: 4 (fullbox) + 64 (creation_time to duration) + 8 (reserved) + 4 (layer & alternate_group) + 4 (volume & reserved) = 84 bytes
    let matrixOffset = tkhdOffset + 12; // Skip the FullBox header (version + flags) + and atom header
    // Add the size of the fields before the matrix
    if (version === 1) {
        // 64-bit creation_time, modification_time, 32-bit track_ID, 32-bit reserved, 64-bit duration
        matrixOffset += 8 + 8 + 4 + 4 + 8;
    }
    else {
        // 32-bit creation_time, modification_time, track_ID, reserved, duration
        matrixOffset += 4 + 4 + 4 + 4 + 4;
    }
    // Add the size of the remaining fields before the matrix
    matrixOffset += 8; // Two 32-bit reserved fields
    matrixOffset += 2; // 16-bit layer
    matrixOffset += 2; // 16-bit alternate_group
    matrixOffset += 2; // 16-bit volume
    matrixOffset += 2; // 16-bit reserved
    return matrixOffset;
}
