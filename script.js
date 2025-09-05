// --- CONFIGURATION ---
const CLIENT_ID = "555797317893-ce2nrrf49e5dol0c6lurln0c3it76c2r.apps.googleusercontent.com";
const SPREADSHEET_ID = "1G3kVQdR0yd1j362oZKYRXMby1Ve6PVcY8CrsQnuxVfY";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
// --- END OF CONFIGURATION ---

// Declare variables; they will be assigned after the DOM loads.
let authorizeButton, signoutButton, appContainer, addClientForm;
let tokenClient;
let gapiInited = false;
let gisInited = false;

document.addEventListener('DOMContentLoaded', () => {
    authorizeButton = document.getElementById('authorize_button');
    signoutButton = document.getElementById('signout_button');
    appContainer = document.getElementById('app-container');
    addClientForm = document.getElementById('add-client-form');
    authorizeButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
    addClientForm.addEventListener('submit', handleAddClientSubmit);
});


// --- INITIALIZATION & AUTH ---

function gapiLoaded() { gapi.load('client', initializeGapiClient); }
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: SCOPES, callback: '',
    });
    gisInited = true;
}
async function initializeGapiClient() {
    await gapi.client.init({});
    await gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4');
    gapiInited = true;
}

function handleAuthClick() {
    tokenClient.callback = async (tokenResponse) => {
        if (tokenResponse.error !== undefined) { throw (tokenResponse); }
        signoutButton.style.display = 'block';
        authorizeButton.style.display = 'none';
        appContainer.style.display = 'block';
        setupTabs();
        loadDataForActiveTab();
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
        appContainer.style.display = 'none';
        authorizeButton.style.display = 'block';
        signoutButton.style.display = 'none';
    }
}


// --- TAB NAVIGATION LOGIC ---

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    document.querySelector('.tab-button[data-tab="requests"]').classList.add('active');
    document.querySelector('#tab-requests').style.display = 'block';
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const tabId = button.dataset.tab;
            tabContents.forEach(content => {
                content.style.display = (content.id === `tab-${tabId}`) ? 'block' : 'none';
            });
            loadDataForActiveTab();
        });
    });
}

function loadDataForActiveTab() {
    const activeTab = document.querySelector('.tab-button.active').dataset.tab;
    switch (activeTab) {
        case 'requests':
            loadRequests(); // This is now active
            break;
        case 'analytics':
            // TODO: renderAnalytics();
            break;
        case 'clients':
            loadClients();
            break;
        case 'projects':
            // TODO: loadProjects();
            break;
        case 'costumes':
            // TODO: loadCostumes();
            break;
        case 'equipment':
            // TODO: loadEquipment();
            break;
    }
}


// --- DATA FUNCTIONS ---

async function handleAddClientSubmit(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('add-client-status');
    statusDiv.textContent = 'Adding client...';
    const clientData = {
        'First Name': document.getElementById('client-first-name').value,
        'Last Name': document.getElementById('client-last-name').value,
        'Email': document.getElementById('client-email').value,
        'Status': 'Active', 
        'ClientID': `C-${Date.now()}`
    };
    try {
        await writeData('Clients', clientData);
        statusDiv.textContent = 'Client added successfully!';
        addClientForm.reset();
        await loadClients();
    } catch (err) {
        console.error("Write Error:", err);
        statusDiv.textContent = `Error: ${err.result.error.message}`;
    }
}

async function loadClients() {
    // This function remains the same as before
    const clientListDiv = document.getElementById('client-list');
    clientListDiv.innerHTML = '<p>Loading clients...</p>';
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID, range: 'Clients',
        });
        const values = response.result.values;
        if (!values || values.length < 1) {
            clientListDiv.innerHTML = '<p>No client data found. Try adding one!</p>';
            return;
        }
        const headers = values[0];
        const dataRows = values.slice(1);
        const firstNameIndex = headers.indexOf('First Name');
        const lastNameIndex = headers.indexOf('Last Name');
        const emailIndex = headers.indexOf('Email');
        
        if (firstNameIndex === -1 || emailIndex === -1) {
             clientListDiv.innerHTML = `<p style="color:red;">Error: Required column not found in 'Clients' sheet.</p>`;
             return;
        }
        
        clientListDiv.innerHTML = '';
        if (dataRows.length === 0) {
            clientListDiv.innerHTML = '<p>No clients found. Try adding one!</p>';
            return;
        }
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
 * NEW: Fetches and displays data from the "Submissions" tab.
 */
async function loadRequests() {
    const container = document.getElementById('tab-requests');
    container.innerHTML = '<p>Loading new service requests...</p>';

    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID, range: 'Submissions',
        });
        const values = response.result.values;
        if (!values || values.length <= 1) {
            container.innerHTML = '<h2>New Service Requests</h2><p>No new submissions found.</p>';
            return;
        }
        const headers = values[0];
        const dataRows = values.slice(1);
        
        // Find the columns we need from the "Submissions" sheet
        const dateIndex = headers.indexOf('Submission Date');
        const nameIndex = headers.indexOf('Full Name');
        const emailIndex = headers.indexOf('Email');
        const serviceIndex = headers.indexOf('Primary Service Category');
        // We also need these for creating a client
        const firstNameIndex = headers.indexOf('First Name');
        const lastNameIndex = headers.indexOf('Last Name');

        container.innerHTML = '<h2>New Service Requests</h2>';
        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Service</th>
                    <th>Action</th>
                </tr>
            </thead>
        `;
        const tbody = document.createElement('tbody');
        dataRows.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row[dateIndex] || ''}</td>
                <td>${row[nameIndex] || ''}</td>
                <td>${row[emailIndex] || ''}</td>
                <td>${row[serviceIndex] || ''}</td>
            `;
            const actionTd = document.createElement('td');
            const button = document.createElement('button');
            button.textContent = 'Create Client';
            // Store the necessary data on the button itself
            button.dataset.firstName = row[firstNameIndex] || '';
            button.dataset.lastName = row[lastNameIndex] || '';
            button.dataset.email = row[emailIndex] || '';
            
            button.onclick = handleCreateClientFromRequest;
            actionTd.appendChild(button);
            tr.appendChild(actionTd);
            tbody.appendChild(tr);
        });
        
        table.appendChild(tbody);
        container.appendChild(table);

    } catch (err) {
        console.error("API Error:", err);
        container.innerHTML = `<p style="color:red;">Error loading requests: ${err.result.error.message}</p>`;
    }
}

/**
 * NEW: Handles the "Create Client" button click from a submission.
 */
async function handleCreateClientFromRequest(event) {
    const button = event.target;
    button.textContent = 'Creating...';
    button.disabled = true;

    // Retrieve the data we stored on the button's dataset
    const { firstName, lastName, email } = button.dataset;

    const clientData = {
        'First Name': firstName,
        'Last Name': lastName,
        'Email': email,
        'Status': 'Lead', // Default status for clients from submissions
        'ClientID': `C-${Date.now()}`
    };

    try {
        await writeData('Clients', clientData);
        button.textContent = 'Client Created!';
    } catch (err) {
        button.textContent = 'Error!';
        button.disabled = false;
        console.error("Write Error:", err);
    }
}


async function writeData(sheetName, dataObject) {
    // This function remains the same as before
    const headerResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!1:1`,
    });
    let headers = headerResponse.result.values ? headerResponse.result.values[0] : [];
    if (headers.length === 0) {
        headers = Object.keys(dataObject);
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A1`,
            valueInputOption: 'RAW', resource: { values: [headers] },
        });
    }
    const newRow = headers.map(header => dataObject[header] || '');
    return gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID, range: sheetName,
        valueInputOption: 'USER_ENTERED', resource: { values: [newRow] },
    });
}
