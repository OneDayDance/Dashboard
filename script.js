// --- CONFIGURATION ---
const CLIENT_ID = "555797317893-ce2nrrf49e5dol0c6lurln0c3it76c2r.apps.googleusercontent.com";
const SPREADSHEET_ID = "1G3kVQdR0yd1j362oZKYRXMby1Ve6PVcY8CrsQnuxVfY";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
// --- END OF CONFIGURATION ---

// Declare variables
let authorizeButton, signoutButton, appContainer, addClientForm, serviceFilter, modal, closeModalButton;
let tokenClient;
let gapiInited = false, gisInited = false;
let allRequests = []; // Cache for requests to make filtering fast

document.addEventListener('DOMContentLoaded', () => {
    // Assign all elements once the DOM is ready
    authorizeButton = document.getElementById('authorize_button');
    signoutButton = document.getElementById('signout_button');
    appContainer = document.getElementById('app-container');
    addClientForm = document.getElementById('add-client-form');
    serviceFilter = document.getElementById('service-filter');
    modal = document.getElementById('details-modal');
    closeModalButton = document.querySelector('.close-button');

    // Assign event listeners
    authorizeButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
    addClientForm.addEventListener('submit', handleAddClientSubmit);
    serviceFilter.onchange = renderRequestsTable; // Re-render table on filter change
    closeModalButton.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
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

// ... handleSignoutClick function remains the same ...
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

// ... setupTabs and loadDataForActiveTab functions remain the same ...
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
            loadRequests();
            break;
        case 'clients':
            loadClients();
            break;
        // ... other cases ...
    }
}


// --- DATA FUNCTIONS ---

// ... handleAddClientSubmit, loadClients, and writeData functions remain the same ...
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


/**
 * NEW: Controller for loading and rendering requests.
 */
async function loadRequests() {
    const container = document.getElementById('requests-container');
    container.innerHTML = '<p>Loading new service requests...</p>';
    // If we haven't fetched requests yet, do it now. Otherwise, use the cached data.
    if (allRequests.length === 0) {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID, range: 'Submissions',
            });
            const values = response.result.values;
            if (values && values.length > 1) {
                allRequests = {
                    headers: values[0],
                    rows: values.slice(1)
                };
                populateServiceFilter();
            }
        } catch (err) {
            console.error("API Error:", err);
            container.innerHTML = `<p style="color:red;">Error loading requests: ${err.result.error.message}</p>`;
            return;
        }
    }
    renderRequestsTable();
}

/**
 * NEW: Renders the requests table based on the current filter.
 */
function renderRequestsTable() {
    const container = document.getElementById('requests-container');
    if (allRequests.length === 0 || allRequests.rows.length === 0) {
        container.innerHTML = '<p>No new submissions found.</p>';
        return;
    }

    const { headers, rows } = allRequests;
    const selectedService = serviceFilter.value;

    // Filter the rows
    const serviceIndex = headers.indexOf('Primary Service Category');
    const filteredRows = (selectedService === 'all')
        ? rows
        : rows.filter(row => row[serviceIndex] === selectedService);

    if (filteredRows.length === 0) {
        container.innerHTML = '<p>No submissions match the selected filter.</p>';
        return;
    }

    // Find column indices
    const dateIndex = headers.indexOf('Submission Date');
    const nameIndex = headers.indexOf('Full Name');
    const emailIndex = headers.indexOf('Email');
    const firstNameIndex = headers.indexOf('First Name');
    const lastNameIndex = headers.indexOf('Last Name');

    container.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `<thead><tr><th>Date</th><th>Name</th><th>Service</th><th>Action</th></tr></thead>`;
    
    const tbody = document.createElement('tbody');
    filteredRows.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row[dateIndex] || ''}</td>
            <td>${row[nameIndex] || ''}</td>
            <td>${row[serviceIndex] || ''}</td>
        `;
        // Make the row clickable to show details
        tr.onclick = () => showRequestDetailsModal(row, headers);
        
        // Add the "Create Client" button cell
        const actionTd = document.createElement('td');
        const button = document.createElement('button');
        button.textContent = 'Create Client';
        button.dataset.firstName = row[firstNameIndex] || '';
        button.dataset.lastName = row[lastNameIndex] || '';
        button.dataset.email = row[emailIndex] || '';
        button.onclick = (event) => {
            event.stopPropagation(); // Prevents the row's click event from firing
            handleCreateClientFromRequest(event);
        };
        actionTd.appendChild(button);
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    container.appendChild(table);
}

/**
 * NEW: Populates the filter dropdown with unique service categories.
 */
function populateServiceFilter() {
    if (allRequests.length === 0) return;
    const { headers, rows } = allRequests;
    const serviceIndex = headers.indexOf('Primary Service Category');
    if (serviceIndex === -1) return;

    // Get unique service categories
    const services = new Set(rows.map(row => row[serviceIndex]));
    
    // Clear existing options except the first one
    serviceFilter.innerHTML = '<option value="all">All Services</option>';
    
    services.forEach(service => {
        if(service) { // Ensure not to add empty options
            const option = document.createElement('option');
            option.value = service;
            option.textContent = service;
            serviceFilter.appendChild(option);
        }
    });
}

/**
 * NEW: Displays all data for a single request in a modal.
 */
function showRequestDetailsModal(rowData, headers) {
    const modalBody = document.getElementById('modal-body');
    let contentHtml = '<ul>';
    headers.forEach((header, index) => {
        if(rowData[index]) { // Only show fields that have data
            contentHtml += `<li><strong>${header}:</strong> ${rowData[index]}</li>`;
        }
    });
    contentHtml += '</ul>';
    
    modalBody.innerHTML = contentHtml;
    modal.style.display = 'block';
}

// ... handleCreateClientFromRequest function remains the same ...
async function handleCreateClientFromRequest(event) {
    const button = event.target;
    button.textContent = 'Creating...';
    button.disabled = true;

    const { firstName, lastName, email } = button.dataset;
    const clientData = {
        'First Name': firstName,
        'Last Name': lastName,
        'Email': email,
        'Status': 'Lead',
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
