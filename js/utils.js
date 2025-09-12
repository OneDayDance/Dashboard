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

/**
 * Clears the content of a container element.
 * @param {HTMLElement} container - The element to clear.
 */
export function clearContainer(container) {
    if (container) {
        container.innerHTML = '';
    }
}

/**
 * Shows a modal dialog by its ID.
 * @param {string} modalId - The ID of the modal to show.
 */
export function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

/**
 * Hides a modal dialog by its ID.
 * @param {string} modalId - The ID of the modal to hide.
 */
export function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Sanitizes a string to prevent XSS attacks by replacing HTML characters.
 * @param {string} str - The string to sanitize.
 * @returns {string} The sanitized string.
 */
export function sanitizeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(match) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[match];
    });
}

/**
 * Formats a date string into a more readable format (e.g., YYYY-MM-DD).
 * @param {string} dateString - The date string to format.
 * @returns {string} The formatted date or 'N/A'.
 */
export function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return dateString; // Return original if invalid
        }
        return date.toISOString().split('T')[0];
    } catch (e) {
        return dateString; // Return original on error
    }
}

/**
 * Creates a data table from an array of objects.
 * @param {Array<Object>} data - The array of data objects.
 * @param {Array<string>} columns - The columns to display.
 * @param {string} idKey - The key in the data object to use for the row's data-id attribute.
 * @param {Function} rowClickHandler - The function to call when a row is clicked.
 * @returns {HTMLTableElement} The created table element.
 */
export function createTable(data, columns, idKey, rowClickHandler) {
    const table = document.createElement('table');
    table.className = 'data-table';

    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
    });

    const tbody = table.createTBody();
    data.forEach(item => {
        const row = tbody.insertRow();
        row.dataset.id = item[idKey];
        row.style.cursor = 'pointer';
        row.onclick = () => rowClickHandler(item[idKey]);

        columns.forEach(col => {
            const cell = row.insertCell();
            cell.innerHTML = item[col] || ''; // Allow HTML for status badges etc.
        });
    });

    return table;
}

/**
 * Creates a generic card element.
 * @param {string} title - The title for the card.
 * @param {Object} details - An object of key-value pairs for the card content.
 * @param {string} idKey - The key for the data attribute.
 * @param {string} idValue - The value for the data attribute.
 * @param {Function} clickHandler - The function to call on click.
 * @returns {HTMLDivElement} The created card element.
 */
export function createCard(title, details, idKey, idValue, clickHandler) {
    const card = document.createElement('div');
    card.className = 'info-card';
    card.dataset.id = idValue;
    card.style.cursor = 'pointer';
    card.onclick = () => clickHandler(idValue);

    const cardTitle = document.createElement('h3');
    cardTitle.textContent = sanitizeHTML(title);
    card.appendChild(cardTitle);

    for (const [key, value] of Object.entries(details)) {
        const p = document.createElement('p');
        p.innerHTML = `<strong>${sanitizeHTML(key)}:</strong> ${value}`; // Allow HTML for status badges
        card.appendChild(p);
    }
    return card;
}