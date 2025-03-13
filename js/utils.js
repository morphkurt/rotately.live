/**
 * Time formatting utilities
 */

/**
 * Format time from seconds to HH:MM:SS.mmm format
 * @param {number} timeInSeconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatTime(timeInSeconds) {
    if (typeof timeInSeconds !== 'number' || timeInSeconds < 0) {
        throw new Error('Invalid input: time must be a non-negative number');
    }

    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const milliseconds = Math.round((timeInSeconds % 1) * 1000);

    return (
        String(hours).padStart(2, '0') + ':' +
        String(minutes).padStart(2, '0') + ':' +
        String(seconds).padStart(2, '0') + '.' +
        String(milliseconds).padStart(3, '0')
    );
}

/**
 * Parse time from HH:MM:SS.mmm format to seconds
 * @param {string} timeString - Time in HH:MM:SS.mmm format
 * @returns {number} Time in seconds
 */
function parseTime(timeString) {
    const regex = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/;
    const match = timeString.match(regex);
    if (!match) {
        throw new Error('Invalid timestamp format. Expected HH:MM:SS.mmm');
    }

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    const milliseconds = parseInt(match[4], 10);

    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

/**
 * Analytics utilities
 */

/**
 * Push event to GTM dataLayer
 * @param {string} eventName - Name of the event
 * @param {Object} eventData - Event data
 */
function pushDataLayerEvent(eventName, eventData) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
        event: eventName,
        ...eventData
    });
}