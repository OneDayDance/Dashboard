// js/api.js
// Description: Handles all interactions with the Google Sheets and Google Drive APIs.

import { SPREADSHEET_ID } from './config.js';
import { setAllRequests, setAllClients, setAllProjects, setAllTasks, setAllCostumes, setAllEquipment } from './state.js';

// --- GOOGLE SHEETS API ---

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

export async function writeData(sheetName, dataObject) {
    const fullSheetResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: sheetName
    });
    const sheetValues = fullSheetResponse.result.values || [];
    let headers = sheetValues.length > 0 ? sheetValues[0] : [];

    const normalize = str => (str || '').toLowerCase().trim();
    const headerMap = new Map();
    headers.forEach(h => { if (h) headerMap.set(normalize(h), h); });
    
    const dataKeys = Object.keys(dataObject);
    const dataKeyMap = new Map();
    dataKeys.forEach(k => dataKeyMap.set(normalize(k), k));

    const newHeaders = [];
    for (const normalizedKey of dataKeyMap.keys()) {
        if (!headerMap.has(normalizedKey)) {
            newHeaders.push(dataKeyMap.get(normalizedKey));
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
        headers = headers.concat(newHeaders);
    }
    
    const newRow = headers.map(header => {
        const normalizedHeader = normalize(header);
        const originalDataKey = dataKeyMap.get(normalizedHeader);
        return originalDataKey ? dataObject[originalDataKey] : '';
    });

    let targetRowNumber = -1;
    for (let i = 1; i < sheetValues.length; i++) {
        const row = sheetValues[i];
        const isEmpty = row.length === 0 || row.every(cell => cell === null || cell === '');
        if (isEmpty) {
            targetRowNumber = i + 1;
            break;
        }
    }

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
        console.warn(`Could not find row to delete with ${idColumnName} = ${idValue}.`);
        return;
    }

    const targetRowNumber = visualRowIndex + 1;
    const targetRange = `${sheetName}!A${targetRowNumber}:${columnToLetter(sheetHeaders.length)}${targetRowNumber}`;

    return gapi.client.sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: targetRange,
    });
}

function columnToLetter(column) {
    let temp, letter = '';
    while (column > 0) {
        temp = (column - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        column = (column - temp - 1) / 26;
    }
    return letter;
}


// --- GOOGLE DRIVE API ---
const INVENTORY_FOLDER_NAME = 'Dashboard_Inventory_Images';
let inventoryFolderId = null;

async function getInventoryFolderId() {
    if (inventoryFolderId) return inventoryFolderId;

    try {
        await gapi.client.load('drive', 'v3');
        console.log("Searching for inventory folder...");
        
        const response = await gapi.client.drive.files.list({
            q: `name='${INVENTORY_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            corpora: 'allDrives'
        });

        if (response.result.files && response.result.files.length > 0) {
            inventoryFolderId = response.result.files[0].id;
            console.log(`Found inventory folder with ID: ${inventoryFolderId}`);
            return inventoryFolderId;
        } else {
            throw new Error(`Inventory folder named '${INVENTORY_FOLDER_NAME}' not found in any accessible Drive.`);
        }
    } catch (err) {
        console.error("Error finding inventory folder:", err);
        throw new Error("Could not find inventory folder. Please check setup instructions.");
    }
}

export async function uploadImageToDrive(file) {
    const folderId = await getInventoryFolderId();
    if (!folderId) {
        throw new Error('Could not find the inventory folder. Please check setup instructions.');
    }

    const metadata = {
        name: `${new Date().getTime()}-${file.name}`,
        parents: [folderId]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
        method: 'POST',
        headers: new Headers({ 'Authorization': `Bearer ${gapi.auth.getToken().access_token}` }),
        body: form,
    });
    
    const uploadedFile = await response.json();
    if (uploadedFile.error) {
        throw new Error(uploadedFile.error.message);
    }

    // THIS IS THE FIX: Construct a permanent, direct-download link.
    const directLink = `https://drive.google.com/uc?export=view&id=${uploadedFile.id}`;
    return { id: uploadedFile.id, link: directLink };
}

