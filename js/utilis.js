// js/utils.js
// Description: Contains utility and helper functions shared across the application.

/**
 * Extracts the Google Drive file ID from various URL formats.
 * @param {string} url - The Google Drive URL.
 * @returns {string|null} - The extracted file ID or null.
 */
export function extractFileIdFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/([a-zA-Z0-9_-]{28,})/);
    return match ? match[0] : null;
}

/**
 * Safely sets the value of a form input element by its ID.
 * Logs a warning if the element is not found, preventing crashes.
 * @param {string} id - The ID of the HTML element.
 * @param {*} value - The value to set for the element.
 */
export function safeSetValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.value = value;
    } else {
        console.warn(`Element with ID '${id}' not found.`);
    }
}
