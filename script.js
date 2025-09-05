// --- CONFIGURATION ---
const CLIENT_ID = "555797317893-ce2nrrf49e5dol0c6lurln0c3it76c2r.apps.googleusercontent.com";
const SPREADSHEET_ID = "1G3kVQdR0yd1j362oZKYRXMby1Ve6PVcY8CrsQnuxVfY";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
// --- END OF CONFIGURATION ---

const authorizeButton = document.getElementById('authorize_button');
const signoutButton = document.getElementById('signout_button');
const mainContent = document.getElementById('main-content');
const addClientForm = document.getElementById('add-client-form');

let tokenClient;
let gapiInited = false;
let gisInited = false;

function gapiLoaded() { gapi.load('client', initializeGapiClient); }
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: SCOPES, callback: '',
    });
    gisInited = true;
    maybeEnableButtons();
}
async function initializeGapiClient() {
    await gapi.client.init({});
    gapiInited = true;
    maybeEnableButtons();
}
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        authorizeButton.onclick = handleAuthClick;
        signoutButton.onclick = handleSignoutClick;
        addClientForm.addEventListener('submit', handleAddClientSubmit);
    }
}

function handleAuthClick() {
    tokenClient.callback = async (tokenResponse) => {
        if (tokenResponse.error !== undefined) { throw (tokenResponse); }
        signoutButton.style.display = 'block';
        authorizeButton.innerText = 'Refresh Data';
        mainContent.style.display = 'block';
        await loadClients();
    };
    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        document.getElementById('client-list').innerText = 'Authorize to load client list.';
        authorizeButton.innerText = 'Authorize and Load Data';
        signoutButton.style.display = 'none';
        mainContent.style.display = 'none';
    }
}

/**
 * Dynamically reads client data by first finding column headers.
 */
async function loadClients() {
    const clientListDiv = document.getElementById('client-list');
    clientListDiv.innerHTML = '<p>Loading clients...</p>';
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Clients', // Read the whole sheet
        });
        
        const values = response.result.values;
        if (!values || values.length <= 1) {
            clientListDiv.innerHTML = '<p>No client data found.</p>';
            return;
        }

        const headers = values[0];
        const dataRows = values.slice(1);

        // Find the column index for the headers we care about.
        const firstNameIndex = headers.indexOf('First Name');
        const lastNameIndex = headers.indexOf('Last Name');
        const emailIndex = headers.indexOf('Email');
        
        if (firstNameIndex === -1 || emailIndex === -1) {
             clientListDiv.innerHTML = `<p style="color:red;">Error: 'First Name' or 'Email' column not found in the 'Clients' sheet.</p>`;
             return;
        }
        
        clientListDiv.innerHTML = '';
        const ul = document.createElement('ul');
        dataRows.forEach(row => {
            const li = document.createElement('li');
            const firstName = row[firstNameIndex] || 'N/A';
            const lastName = row[lastNameIndex] || '';
            const email = row[emailIndex] || 'N/A';
            li.textContent = `${firstName} ${lastName} - (${email})`;
            ul.appendChild(li);
        });
        clientListDiv.appendChild(ul);

    } catch (err) {
        console.error("API Error:", err);
        clientListDiv.innerHTML = `<p style="color:red;">Error: ${err.result.error.message}</p>`;
    }
}

/**
 * Handles the 'Add Client' form submission.
 */
async function handleAddClientSubmit(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('add-client-status');
    statusDiv.textContent = 'Adding client...';

    const clientData = {
        'First Name': document.getElementById('client-first-name').value,
        'Last Name': document.getElementById('client-last-name').value,
        'Email': document.getElementById('client-email').value,
        'Status': 'Active', // Example of a default value
        'ClientID': `C-${Date.now()}` // Example of an auto-generated ID
    };

    try {
        await writeData('Clients', clientData);
        statusDiv.textContent = 'Client added successfully!';
        addClientForm.reset();
        await loadClients(); // Refresh the client list
    } catch (err) {
        console.error("Write Error:", err);
        statusDiv.textContent = `Error: ${err.result.error.message}`;
    }
}

/**
 * A generic function to write a row of data dynamically.
 * It will create headers if the sheet is empty.
 * @param {string} sheetName The name of the sheet tab.
 * @param {object} dataObject An object where keys match header names.
 */
async function writeData(sheetName, dataObject) {
    // 1. Get current headers from the sheet
    const headerResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!1:1`, // Get the first row
    });

    let headers = headerResponse.result.values ? headerResponse.result.values[0] : [];
    
    // 2. If sheet is empty, write the object keys as the new headers
    if (headers.length === 0) {
        headers = Object.keys(dataObject);
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1`,
            valueInputOption: 'RAW',
            resource: {
                values: [headers],
            },
        });
    }

    // 3. Create the new row in the correct column order
    const newRow = headers.map(header => dataObject[header] || ''); // Use value or empty string

    // 4. Append the new row to the sheet
    return gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: sheetName,
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: [newRow],
        },
    });
}
