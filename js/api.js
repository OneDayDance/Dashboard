// js/api.js
// Description: Handles all interactions with the Google Sheets API.

import { SPREADSHEET_ID } from './config.js';
import { setAllRequests, setAllClients, setAllProjects, setAllTasks, setAllCostumes, setAllEquipment } from './state.js';

// Removed the import from main.js to break the circular dependency.
// The refresh logic will now be handled by the module that calls the API function.

async function fetchData(range, setter) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: range
        });
        const values = response.result.values;
        let data = { headers: [], rows: [] };
        if (values && values.length > 0) {
            data = { headers: values[0], rows: values.slice(1).filter(row => row.length > 0) };
        }
        setter(data); // Store the fetched data in the state
        console.log(`Successfully loaded data from ${range}`);
        return data;
    } catch (err) {
        console.error(`Error loading data from sheet range "${range}":`, err);
        // Set empty data on failure to prevent app crashes
        setter({ headers: [], rows: [] }); 
        // Re-throw the error to be caught by the calling function
        throw new Error(`Could not load data for ${range}. Please check the sheet name and permissions.`);
    }
}

export const loadRequests = () => fetchData('Submissions', setAllRequests);
export const loadClients = () => fetchData('Clients', setAllClients);
export const loadProjects = () => fetchData('Projects', setAllProjects);
export const loadTasks = () => fetchData('Tasks', setAllTasks);
export const loadCostumes = () => fetchData('Costumes', setAllCostumes);
export const loadEquipment = () => fetchData('Equipment', setAllEquipment);


/**
 * Finds a row by a unique ID and updates specified columns.
 * @param {string} sheetName - The name of the sheet.
 * @param {string} idColumnName - The header of the unique ID column.
 * @param {string} idValue - The value of the unique ID to find.
 * @param {object} dataToUpdate - An object where keys are column headers and values are the new cell values.
 * @returns {Promise<object>} - The result from the Sheets API.
 */
export async function updateSheetRow(sheetName, idColumnName, idValue, dataToUpdate) {
    // Get the current headers to find column indices
    let sheetResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!1:1`
    });
    let sheetHeaders = (sheetResponse.result.values ? sheetResponse.result.values[0] : []) || [];
    
    // Check if new columns need to be added
    const newHeaders = Object.keys(dataToUpdate).filter(h => !sheetHeaders.includes(h));
    if (newHeaders.length > 0) {
        const firstEmptyColumn = columnToLetter(sheetHeaders.length + 1);
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!${firstEmptyColumn}1`,
            valueInputOption: 'RAW',
            resource: { values: [newHeaders] }
        });
        // Update the local headers variable
        sheetHeaders = sheetHeaders.concat(newHeaders);
    }

    // Get the full sheet to find the row number
    const fullSheetResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: sheetName
    });
    const sheetValues = fullSheetResponse.result.values || [];
    const idIndex = sheetHeaders.indexOf(idColumnName);
    if (idIndex === -1) throw new Error(`Unique ID column '${idColumnName}' not found in ${sheetName}.`);

    const visualRowIndex = sheetValues.findIndex(row => row && row[idIndex] === idValue);
    if (visualRowIndex === -1) throw new Error(`Could not find row with ${idColumnName} = ${idValue}.`);

    // Prepare the updated row data
    const originalRow = sheetValues[visualRowIndex] || [];
    // Ensure the original row has enough columns to match the headers
    while (originalRow.length < sheetHeaders.length) originalRow.push('');
    const updatedRow = [...originalRow];

    for (const columnName in dataToUpdate) {
        const columnIndex = sheetHeaders.indexOf(columnName);
        if (columnIndex > -1) {
            updatedRow[columnIndex] = dataToUpdate[columnName];
        }
    }

    // The actual row number in the sheet is the index + 1
    const targetRowNumber = visualRowIndex + 1;
    const targetRange = `${sheetName}!A${targetRowNumber}`;

    // Return the promise directly, no longer responsible for refreshing data.
    return gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: targetRange,
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: [updatedRow]
        }
    });
}

/**
 * Appends or inserts a new row of data, dynamically matching columns and filling empty rows.
 * @param {string} sheetName - The name of the sheet.
 * @param {object} dataObject - An object where keys are column headers and values are cell values.
 * @returns {Promise<object>} - The result from the Sheets API.
 */
export async function writeData(sheetName, dataObject) {
    // 1. Get all data from the sheet to find headers and empty rows.
    const fullSheetResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: sheetName
    });
    const sheetValues = fullSheetResponse.result.values || [];
    let headers = sheetValues.length > 0 ? sheetValues[0] : [];

    // 2. Normalize headers and data keys for robust matching.
    const normalize = str => (str || '').toLowerCase().trim();
    const headerMap = new Map();
    headers.forEach(h => { if (h) headerMap.set(normalize(h), h); });
    
    const dataKeys = Object.keys(dataObject);
    const dataKeyMap = new Map();
    dataKeys.forEach(k => dataKeyMap.set(normalize(k), k));

    // 3. Identify and add any new headers to the sheet.
    const newHeaders = [];
    for (const normalizedKey of dataKeyMap.keys()) {
        if (!headerMap.has(normalizedKey)) {
            newHeaders.push(dataKeyMap.get(normalizedKey)); // Use original case for the new header
        }
    }

    if (newHeaders.length > 0) {
        const firstEmptyColumn = columnToLetter(headers.length + 1);
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!${firstEmptyColumn}1`,
            valueInputOption: 'RAW',
            resource: { values: [newHeaders] }
        });
        // Update local headers array to reflect the newly added columns.
        headers = headers.concat(newHeaders);
    }
    
    // 4. Create the new row array in the correct order based on the final headers.
    const newRow = headers.map(header => {
        const normalizedHeader = normalize(header);
        const originalDataKey = dataKeyMap.get(normalizedHeader);
        return originalDataKey ? dataObject[originalDataKey] : '';
    });

    // 5. Find the first completely empty row to write to.
    let targetRowNumber = -1;
    for (let i = 1; i < sheetValues.length; i++) {
        const row = sheetValues[i];
        const isEmpty = row.length === 0 || row.every(cell => cell === null || cell === '');
        if (isEmpty) {
            targetRowNumber = i + 1; // Sheet rows are 1-based
            break;
        }
    }

    // 6. If an empty row was found, UPDATE it. Otherwise, APPEND a new row.
    if (targetRowNumber !== -1) {
        console.log(`Found empty row at ${targetRowNumber}. Updating...`);
        const targetRange = `${sheetName}!A${targetRowNumber}`;
        return gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: targetRange,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [newRow]
            }
        });
    } else {
        console.log('No empty rows found. Appending to sheet...');
        return gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: sheetName,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [newRow]
            }
        });
    }
}

/**
 * Clears all values from a specific row identified by a unique ID.
 * @param {string} sheetName - The name of the sheet.
 * @param {string} idColumnName - The header of the unique ID column.
 * @param {string} idValue - The value of the unique ID to find and delete.
 * @returns {Promise<object>} - The result from the Sheets API.
 */
export async function clearSheetRow(sheetName, idColumnName, idValue) {
    const fullSheetResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: sheetName
    });
    const sheetValues = fullSheetResponse.result.values || [];
    const sheetHeaders = sheetValues[0] || [];
    const idIndex = sheetHeaders.indexOf(idColumnName);
    if (idIndex === -1) throw new Error(`Unique ID column '${idColumnName}' not found.`);

    const visualRowIndex = sheetValues.findIndex(row => row && row[idIndex] === idValue);
    if (visualRowIndex === -1) {
        console.warn(`Could not find row to delete with ${idColumnName} = ${idValue}. It may have already been deleted.`);
        return; // Exit gracefully if the row isn't found
    }

    const targetRowNumber = visualRowIndex + 1;
    const targetRange = `${sheetName}!A${targetRowNumber}:${columnToLetter(sheetHeaders.length)}${targetRowNumber}`;

    return gapi.client.sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: targetRange,
    });
}


/**
 * Converts a 1-based column index to its A1 notation letter.
 * e.g., 1 -> A, 27 -> AA
 * @param {number} column - The column number.
 * @returns {string} - The column letter.
 */
function columnToLetter(column) {
    let temp, letter = '';
    while (column > 0) {
        temp = (column - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        column = (column - temp - 1) / 26;
    }
    return letter;
}
