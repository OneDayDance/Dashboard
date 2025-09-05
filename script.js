// --- CONFIGURATION ---
const CLIENT_ID = "555797317893-ce2nrrf49e5dol0c6lurln0c3it76c2r.apps.googleusercontent.com";
const SPREADSHEET_ID = "1G3kVQdR0yd1j362oZKYRXMby1Ve6PVcY8CrsQnuxVfY";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
// --- END OF CONFIGURATION ---

// HTML Elements
const authorizeButton = document.getElementById('authorize_button');
const signoutButton = document.getElementById('signout_button');
const appContainer = document.getElementById('app-container');
const addClientForm = document.getElementById('add-client-form');

// State
let tokenClient;
let gapiInited = false;
let gisInited = false;


// --- INITIALIZATION & AUTH ---

window.onload = () => {
    // This is needed to load the two Google scripts from the HTML
};

function gapiLoaded() { gapi.load('client', initializeGapiClient); }

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: SCOPES, callback: '',
    });
    gisInited = true;
    if (gapiInited) {
        authorizeButton.style.visibility = 'visible';
    }
}

async function initializeGapiClient() {
    await gapi.client.init({});
    await gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4');
    gapiInited = true;
    if (gisInited) {
        authorizeButton.style.visibility = 'visible';
    }
}

authorizeButton.onclick = handleAuthClick;
signoutButton.onclick = handleSignoutClick;

function handleAuthClick() {
    tokenClient.callback = async (tokenResponse) => {
        if (tokenResponse.error !== undefined) { throw (tokenResponse); }
        // On successful login, set up the app
        signoutButton.style.display = 'block';
        authorizeButton.style.display = 'none';
        appContainer.style.display = 'block';
        setupTabs();
        // Load data for the default active tab
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
        // Hide the main app and show the authorize button
        appContainer.style.display = 'none';
        authorizeButton.style.display = 'block';
        signoutButton.style.display = 'none';
    }
}


// --- TAB NAVIGATION LOGIC ---

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update button active state
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Hide all content, then show the correct one
            const tabId = button.dataset.tab;
            tabContents.forEach(content => {
                content.style.display = (content.id === `tab-${tabId}`) ? 'block' : 'none';
            });

            // Load data for the newly active tab
            loadDataForActiveTab();
        });
    });
}

function loadDataForActiveTab() {
    const activeTab = document.querySelector('.tab-button.active').dataset.tab;
    switch (activeTab) {
        case 'requests':
            // TODO: loadRequests();
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

addClientForm.addEventListener('submit', handleAddClientSubmit);

// --- DATA FUNCTIONS (CLIENTS) ---

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

async function writeData(sheetName, dataObject) {
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
