// js/api.js
// Description: Handles all interactions with the Google Sheets API.

import { SPREADSHEET_ID } from './config.js';

// --- DATA LOADING ---
export async function loadRequests() {
    return fetchDataFromSheet('Submissions');
}

export async function loadClients() {
    return fetchDataFromSheet('Clients');
}

export async function loadProjects() {
    return fetchDataFromSheet('Projects');
}

export async function loadTasks() {
    return fetchDataFromSheet('Tasks');
}

async function fetchDataFromSheet(sheetName) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: sheetName
        });
        const values = response.result.values;
        if (values && values.length > 1) {
            // Filter out completely empty rows
            const nonEmptyRows = values.slice(1).filter(row => row.some(cell => cell));
            return { headers: values[0], rows: nonEmptyRows };
        }
        return { headers: (values && values[0]) || [], rows: [] };
    } catch (err) {
        console.error(`Error loading ${sheetName}:`, err);
        return { headers: [], rows: [] };
    }
}

// --- DATA WRITING / UPDATING ---
export async function updateSheetRow(sheetName, idColumnName, idValue, dataToUpdate) {
    let sheetResponse = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!1:1`});
    let sheetHeaders = (sheetResponse.result.values ? sheetResponse.result.values[0] : []) || [];
    const newHeaders = Object.keys(dataToUpdate).filter(h => !sheetHeaders.includes(h));
    if (newHeaders.length > 0) {
        const firstEmptyColumn = columnToLetter(sheetHeaders.length + 1);
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!${firstEmptyColumn}1`, valueInputOption: 'RAW', resource: { values: [newHeaders] }
        });
        sheetHeaders = sheetHeaders.concat(newHeaders);
    }
    const fullSheetResponse = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: sheetName });
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
        if (columnIndex > -1) updatedRow[columnIndex] = dataToUpdate[columnName];
    }
    const targetRowNumber = visualRowIndex + 1;
    const targetRange = `${sheetName}!A${targetRowNumber}`;
    return gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: targetRange, valueInputOption: 'USER_ENTERED', resource: { values: [updatedRow] }
    });
}

export async function writeData(sheetName, dataObject) {
    const headerResponse = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!1:1` });
    let headers = headerResponse.result.values ? headerResponse.result.values[0] : [];
    const newHeaders = Object.keys(dataObject).filter(h => !headers.includes(h));
    if (newHeaders.length > 0) {
        const firstEmptyColumn = columnToLetter(headers.length + 1);
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!${firstEmptyColumn}1`, valueInputOption: 'RAW', resource: { values: [newHeaders] }
        });
        headers = headers.concat(newHeaders);
    }
    const newRow = headers.map(header => dataObject[header] || '');
    return gapi.client.sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: [newRow] } });
}


export async function clearSheetRow(sheetName, idColumnName, idValue) {
    const fullSheetResponse = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: sheetName });
    const sheetValues = fullSheetResponse.result.values || [];
    const sheetHeaders = sheetValues[0] || [];
    const idIndex = sheetHeaders.indexOf(idColumnName);
    if (idIndex === -1) throw new Error(`Unique ID column '${idColumnName}' not found.`);
    const visualRowIndex = sheetValues.findIndex(row => row && row[idIndex] === idValue);
    if (visualRowIndex === -1) throw new Error(`Could not find row to delete.`);
    const targetRowNumber = visualRowIndex + 1;
    const targetRange = `${sheetName}!A${targetRowNumber}:${columnToLetter(sheetHeaders.length)}${targetRowNumber}`;
    return gapi.client.sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: targetRange });
}


// --- UTILITY ---
function columnToLetter(column) {
    let temp, letter = '';
    while (column > 0) { temp = (column - 1) % 26; letter = String.fromCharCode(temp + 65) + letter; column = (column - temp - 1) / 26; }
    return letter;
}
