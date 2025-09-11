// js/utils.js
// Description: Contains utility functions shared across multiple modules.

/**
 * Extracts the Google Drive file ID from various URL formats.
 * @param {string} url - The Google Drive URL.
 * @returns {string|null} - The extracted file ID or null.
 */
export function extractFileIdFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    // This regex is designed to be robust and capture the long ID from various Google Drive URL formats.
    const match = url.match(/([a-zA-Z0-9_-]{28,})/);
    return match ? match[0] : null;
}
