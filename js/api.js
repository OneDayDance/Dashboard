// js/api.js
// Description: Handles all interactions with the Google Sheets API and Google Drive API.

import { SPREADSHEET_ID } from './config.js';
import { setAllRequests, setAllClients, setAllProjects, setAllTasks, setAllCostumes, setAllEquipment, setAllStaff } from './state.js';

// --- GOOGLE SHEETS API ---

/**
 * Fetches and processes data from a specific sheet.
 * This function now pads rows to ensure data consistency.
 * @param {string} range - The sheet name to fetch (e.g., 'Submissions').
 * @param {Function} setter - The state setter function to store the data.
 * @returns {Promise<object>} - The processed data.
 */
async function fetchData(range, setter) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: range
        });
        const values = response.result.values;
        let data = { headers: [], rows: [] };

        if (values && values.length > 0) {
            const headers = values[0];
            const headerCount = headers.length;
            const rawRows = values.slice(1).filter(row => row.some(cell => cell !== '' && cell !== null)); // Filter truly empty rows

            // Pad any truncated rows to match the header count
            const paddedRows = rawRows.map(row => {
                while (row.length < headerCount) {
                    row.push('');
                }
                return row;
            });

            data = { headers: headers, rows: paddedRows };
        }

        setter(data);
        console.log(`Successfully loaded data from ${range}`);
        return data;
    } catch (err) {
        console.error(`Error loading data from sheet range "${range}":`, err);
        setter({ headers: [], rows: [] }); 
        throw new Error(`Could not load data for ${range}. Please check the sheet name and permissions.`);
    }
}


export const loadRequests = () => fetchData('Submissions', setAllRequests);
export const loadClients = () => fetchData('Clients', setAllClients);
export const loadProjects = () => fetchData('Projects', setAllProjects);
export const loadTasks = () => fetchData('Tasks', setAllTasks);
export const loadCostumes = () => fetchData('Costumes', setAllCostumes);
export const loadEquipment = () => fetchData('Equipment', setAllEquipment);
export const loadStaff = () => fetchData('Staff', setAllStaff);

/**
 * Finds a row by a unique ID and updates specified columns.
 * @param {string} sheetName - The name of the sheet.
 * @param {string} idColumnName - The header of the unique ID column.
 * @param {string} idValue - The value of the unique ID to find.
 * @param {object} dataToUpdate - An object where keys are column headers and values are the new cell values.
 * @returns {Promise<object>} - The result from the Sheets API.
 */
export async function updateSheetRow(sheetName, idColumnName, idValue, dataToUpdate) {
    let sheetResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!1:1`
    });
    let sheetHeaders = (sheetResponse.result.values ? sheetResponse.result.values[0] : []) || [];
    
    const newHeaders = Object.keys(dataToUpdate).filter(h => !sheetHeaders.includes(h));
    if (newHeaders.length > 0) {
        const firstEmptyColumn = columnToLetter(sheetHeaders.length + 1);
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!${firstEmptyColumn}1`,
            valueInputOption: 'RAW',
            resource: { values: [newHeaders] }
        });
        sheetHeaders = sheetHeaders.concat(newHeaders);
    }

    const fullSheetResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: sheetName
    });
    const sheetValues = fullSheetResponse.result.values || [];
    const idIndex = sheetHeaders.indexOf(idColumnName);
    if (idIndex === -1) throw new Error(`Unique ID column '${idColumnName}' not found in ${sheetName}.`);

    const visualRowIndex = sheetValues.findIndex(row => row && row[idIndex] === idValue);
    if (visualRowIndex === -1) throw new Error(`Could not find row with ${idColumnName} = ${idValue}.`);

    const originalRow = sheetValues[visualRowIndex] || [];
    while (originalRow.length < sheetHeaders.length) originalRow.push('');
    const updatedRow = [...originalRow];

    for (const columnName in dataToUpdate) {
        const columnIndex = sheetHeaders.indexOf(columnName);
        if (columnIndex > -1) {
            updatedRow[columnIndex] = dataToUpdate[columnName];
        }
    }
    
    const targetRowNumber = visualRowIndex + 1;
    const targetRange = `${sheetName}!A${targetRowNumber}`;

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
 * Appends or inserts a new row of data. This function is now robust against empty columns in the sheet.
 * @param {string} sheetName - The name of the sheet.
 * @param {object} dataObject - An object where keys are column headers and values are cell values.
 * @returns {Promise<object>} - The result from the Sheets API.
 */
export async function writeData(sheetName, dataObject) {
    const headerResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!1:1`
    });
    let headers = (headerResponse.result.values ? headerResponse.result.values[0] : []) || [];

    const normalize = str => (str || '').toLowerCase().trim();
    
    const buildHeaderMap = (hdrs) => {
        const map = new Map();
        hdrs.forEach((h, i) => { 
            if (h) map.set(normalize(h), { original: h, index: i }); 
        });
        return map;
    };

    let headerMap = buildHeaderMap(headers);
    
    const newHeaders = Object.keys(dataObject).filter(k => !headerMap.has(normalize(k)));

    if (newHeaders.length > 0) {
        const firstEmptyColumn = columnToLetter(headers.length + 1);
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!${firstEmptyColumn}1`,
            valueInputOption: 'RAW',
            resource: { values: [newHeaders] }
        });
        headers = headers.concat(newHeaders);
        headerMap = buildHeaderMap(headers);
    }
    
    const newRow = Array(headers.length).fill('');
    for (const dataKey in dataObject) {
        const normalizedKey = normalize(dataKey);
        if (headerMap.has(normalizedKey)) {
            const { index } = headerMap.get(normalizedKey);
            newRow[index] = dataObject[dataKey];
        }
    }

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
        return;
    }

    const targetRowNumber = visualRowIndex + 1;
    const targetRange = `${sheetName}!A${targetRowNumber}:${columnToLetter(sheetHeaders.length)}${targetRowNumber}`;

    return gapi.client.sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: targetRange,
    });
}

// --- GOOGLE DRIVE API ---

let inventoryFolderId = null;

/**
 * Finds or creates the dedicated inventory folder in the user's Google Drive.
 * @returns {Promise<string>} - The ID of the inventory folder.
 */
async function getInventoryFolderId() {
    if (inventoryFolderId) return inventoryFolderId;

    const folderName = 'Dashboard_Inventory_Images';
    try {
        const response = await gapi.client.drive.files.list({
            q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            corpora: 'allDrives'
        });

        if (response.result.files && response.result.files.length > 0) {
            console.log(`Found inventory folder with ID: ${response.result.files[0].id}`);
            inventoryFolderId = response.result.files[0].id;
            return inventoryFolderId;
        } else {
            throw new Error(`The '${folderName}' folder was not found in any accessible Drive. Please follow the setup instructions to create it in a Shared Drive.`);
        }
    } catch (err) {
        console.error("Error finding inventory folder:", err);
        throw new Error("Could not find the inventory folder. Please check setup instructions.");
    }
}


/**
 * Uploads an image file to the dedicated Google Drive folder.
 * @param {File} file - The image file to upload.
 * @returns {Promise<{link: string, id: string}>} - An object with the direct view link and the file ID.
 */
export async function uploadImageToDrive(file) {
    const folderId = await getInventoryFolderId();
    const metadata = {
        name: `${new Date().getTime()}_${file.name}`,
        parents: [folderId]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
        method: 'POST',
        headers: new Headers({ 'Authorization': `Bearer ${gapi.client.getToken().access_token}` }),
        body: form
    });
    
    if (!response.ok) {
        const errorBody = await response.json();
        console.error("Drive upload failed:", errorBody);
        throw new Error(`Failed to upload image. Server responded with: ${errorBody.error.message}`);
    }

    const result = await response.json();
    const fileId = result.id;
    
    // Make the file publicly readable
    await gapi.client.drive.permissions.create({
        fileId: fileId,
        resource: {
            role: 'reader',
            type: 'anyone'
        },
        supportsAllDrives: true,
    });
    
    // Construct a direct-view link that works in <img> tags
    const directLink = `https://drive.google.com/uc?export=view&id=${fileId}`;
    return { link: directLink, id: fileId };
}

/**
 * Converts a 1-based column index to its A1 notation letter.
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
