// --- CONFIGURATION ---
const CLIENT_ID = "555797317893-ce2nrrf49e5dol0c6lurln0c3it76c2r.apps.googleusercontent.com";
const SPREADSHEET_ID = "1G3kVQdR0yd1j362oZKYRXMby1Ve6PVcY8CrsQnuxVfY";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
// --- END OF CONFIGURATION ---

// State Variables
let tokenClient, gapiInited = false, gisInited = false;
let allRequests = [];
let currentView = 'list';

// --- DOM ELEMENT DECLARATIONS ---
let authorizeButton, signoutButton, appContainer, addClientForm, serviceFilter, modal, closeModalButton, listViewBtn, cardViewBtn;

document.addEventListener('DOMContentLoaded', () => {
    // Assign all elements
    authorizeButton = document.getElementById('authorize_button');
    signoutButton = document.getElementById('signout_button');
    appContainer = document.getElementById('app-container');
    addClientForm = document.getElementById('add-client-form');
    serviceFilter = document.getElementById('service-filter');
    modal = document.getElementById('details-modal');
    closeModalButton = document.querySelector('.close-button');
    listViewBtn = document.getElementById('list-view-btn');
    cardViewBtn = document.getElementById('card-view-btn');

    // Assign event listeners
    authorizeButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
    addClientForm.addEventListener('submit', handleAddClientSubmit);
    serviceFilter.onchange = renderRequests;
    closeModalButton.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => { if (event.target == modal) { modal.style.display = 'none'; } };
    
    listViewBtn.onclick = () => { currentView = 'list'; updateViewToggle(); renderRequests(); };
    cardViewBtn.onclick = () => { currentView = 'card'; updateViewToggle(); renderRequests(); };
});

function updateViewToggle() {
    listViewBtn.classList.toggle('active', currentView === 'list');
    cardViewBtn.classList.toggle('active', currentView === 'card');
}


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


// --- TAB NAVIGATION ---
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
    }
}


// --- REQUESTS TAB FUNCTIONS ---

async function loadRequests() {
    allRequests = []; 
    const container = document.getElementById('requests-container');
    container.innerHTML = '<p>Loading new service requests...</p>';
    
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID, range: 'Submissions',
        });
        const values = response.result.values;
        if (values && values.length > 1) {
            allRequests = { headers: values[0], rows: values.slice(1) };
            populateServiceFilter();
        }
    } catch (err) {
        container.innerHTML = `<p style="color:red;">Error loading requests: ${err.result.error.message}</p>`;
        return;
    }
    renderRequests();
}

function renderRequests() {
    if (allRequests.length === 0) {
        document.getElementById('requests-container').innerHTML = '<p>No submissions found.</p>';
        document.getElementById('archived-requests-container').innerHTML = '';
        return;
    }

    const { headers, rows } = allRequests;
    const statusIndex = headers.indexOf('Status');
    const newRequests = rows.filter(row => row[statusIndex] !== 'Archived');
    const archivedRequests = rows.filter(row => row[statusIndex] === 'Archived');

    if (currentView === 'list') {
        renderRequestsAsList(newRequests, document.getElementById('requests-container'));
        renderRequestsAsList(archivedRequests, document.getElementById('archived-requests-container'));
    } else {
        renderRequestsAsCards(newRequests, document.getElementById('requests-container'));
        renderRequestsAsCards(archivedRequests, document.getElementById('archived-requests-container'));
    }
}

function getFilteredRequests(sourceRows) {
    if (!sourceRows || sourceRows.length === 0) return [];
    const { headers } = allRequests;
    const selectedService = serviceFilter.value;
    const serviceIndex = headers.indexOf('Primary Service Category');
    return (selectedService === 'all')
        ? sourceRows
        : sourceRows.filter(row => row[serviceIndex] === selectedService);
}

function renderRequestsAsList(requestRows, container) {
    const filteredRows = getFilteredRequests(requestRows);
    if (filteredRows.length === 0) {
        container.innerHTML = `<p>No submissions ${container.id.includes('archived') ? 'archived' : 'found'}.</p>`;
        return;
    }

    const { headers } = allRequests;
    const dateIndex = headers.indexOf('Submission Date');
    const nameIndex = headers.indexOf('Full Name');
    const serviceIndex = headers.indexOf('Primary Service Category');
    const statusIndex = headers.indexOf('Status');

    container.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `<thead><tr><th>Date</th><th>Name</th><th>Service</th><th>Actions</th></tr></thead>`;
    
    const tbody = document.createElement('tbody');
    filteredRows.forEach(row => {
        const originalIndex = allRequests.rows.indexOf(row);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${row[dateIndex] || ''}</td><td>${row[nameIndex] || ''}</td><td>${row[serviceIndex] || ''}</td>`;
        tr.onclick = () => showRequestDetailsModal(row, headers);
        
        const isArchived = row[statusIndex] === 'Archived';
        const actionTd = document.createElement('td');
        actionTd.innerHTML = `
            <button class="initiate-project-btn" data-row-index="${originalIndex}" ${isArchived ? 'disabled' : ''}>Initiate Project</button>
            <button class="archive-btn" data-row-index="${originalIndex}">${isArchived ? 'Unarchive' : 'Archive'}</button>
        `;
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
    
    container.querySelectorAll('.initiate-project-btn').forEach(b => b.onclick = handleInitiateProject);
    container.querySelectorAll('.archive-btn').forEach(b => b.onclick = handleArchiveRequest);
}

function renderRequestsAsCards(requestRows, container) {
    const filteredRows = getFilteredRequests(requestRows);
    if (filteredRows.length === 0) {
        container.innerHTML = `<p>No submissions ${container.id.includes('archived') ? 'archived' : 'found'}.</p>`;
        return;
    }

    const { headers } = allRequests;
    const dateIndex = headers.indexOf('Submission Date');
    const nameIndex = headers.indexOf('Full Name');
    const serviceIndex = headers.indexOf('Primary Service Category');
    const statusIndex = headers.indexOf('Status');

    container.innerHTML = '';
    const cardContainer = document.createElement('div');
    cardContainer.className = 'card-container';
    
    filteredRows.forEach(row => {
        const originalIndex = allRequests.rows.indexOf(row);
        const isArchived = row[statusIndex] === 'Archived';
        const card = document.createElement('div');
        card.className = 'request-card';
        card.innerHTML = `
            <h3>${row[nameIndex] || 'No Name'}</h3>
            <p><strong>Date:</strong> ${row[dateIndex] || 'N/A'}</p>
            <p><strong>Service:</strong> ${row[serviceIndex] || 'N/A'}</p>
            <div class="actions">
                <button class="details-btn">Details</button>
                <button class="initiate-project-btn" ${isArchived ? 'disabled' : ''}>Initiate Project</button>
                <button class="archive-btn">${isArchived ? 'Unarchive' : 'Archive'}</button>
            </div>
        `;
        card.querySelector('.details-btn').onclick = () => showRequestDetailsModal(row, headers);
        card.querySelector('.initiate-project-btn').dataset.rowIndex = originalIndex;
        card.querySelector('.initiate-project-btn').onclick = handleInitiateProject;
        card.querySelector('.archive-btn').dataset.rowIndex = originalIndex;
        card.querySelector('.archive-btn').onclick = handleArchiveRequest;
        
        cardContainer.appendChild(card);
    });
    container.appendChild(cardContainer);
}

async function handleArchiveRequest(event) {
    event.stopPropagation();
    const button = event.target;
    const rowIndex = parseInt(button.dataset.rowIndex, 10);
    const { headers, rows } = allRequests;
    const rowData = rows[rowIndex];
    
    const statusIndex = headers.indexOf('Status');
    const submissionIdIndex = headers.indexOf('Submission ID'); 
    
    if (statusIndex === -1 || submissionIdIndex === -1) {
        alert("Error: 'Status' or 'Submission ID' column not found in your sheet. Please add them.");
        return;
    }
    
    const currentStatus = rowData[statusIndex];
    const newStatus = currentStatus === 'Archived' ? '' : 'Archived';
    button.textContent = 'Updating...';
    button.disabled = true;

    try {
        const submissionId = rowData[submissionIdIndex];
        const allSheetValues = (await gapi.client.sheets.spreadsheets.values.get({spreadsheetId: SPREADSHEET_ID, range: 'Submissions'})).result.values;
        const visualRowIndex = allSheetValues.findIndex(sheetRow => sheetRow && sheetRow[submissionIdIndex] === submissionId);

        if (visualRowIndex === -1) {
            throw new Error("Could not find the row in the sheet to update. It may have been changed by someone else.");
        }
        
        const targetRowNumber = visualRowIndex + 1;
        
        // ** THIS IS THE FIX **
        // This simplified range is more robust. It tells the API where to START writing
        // and the API figures out the rest based on the data we send.
        const targetRange = `Submissions!A${targetRowNumber}`;
        
        const updatedRowValues = [...rowData]; // Create a copy of the row
        updatedRowValues[statusIndex] = newStatus; // Update the status in the copy

        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: targetRange,
            valueInputOption: 'RAW',
            resource: {
                values: [updatedRowValues] // Write the entire updated row back
            }
        });
        
        allRequests.rows[rowIndex][statusIndex] = newStatus;
        renderRequests();

    } catch(err) {
        alert('Could not update status. See console for details.');
        console.error("Archive/Update Error:", err);
        button.textContent = newStatus === 'Archived' ? 'Unarchive' : 'Archive';
        button.disabled = false;
    }
}


// --- All other functions remain the same ---

function showRequestDetailsModal(rowData, headers) {
    const modalBody = document.getElementById('modal-body');
    const ignoredFields = ['Raw Payload', 'All Services JSON', 'Submission ID', 'Timestamp'];
    let contentHtml = '<ul>';
    const rawPayloadIndex = headers.indexOf('Raw Payload');
    headers.forEach((header, index) => {
        if (rowData[index] && !ignoredFields.includes(header)) {
            contentHtml += `<li><strong>${header}:</strong> ${rowData[index]}</li>`;
        }
    });
    contentHtml += '</ul>';
    if (rawPayloadIndex > -1 && rowData[rawPayloadIndex]) {
        try {
            const payload = JSON.parse(rowData[rawPayloadIndex]);
            contentHtml += '<h3>Raw Payload Data</h3>';
            contentHtml += `<pre><code>${JSON.stringify(payload, null, 2)}</code></pre>`;
        } catch (e) {
            contentHtml += '<h3>Raw Payload Data (Not valid JSON)</h3>';
            contentHtml += `<pre><code>${rowData[rawPayloadIndex]}</code></pre>`;
        }
    }
    modalBody.innerHTML = contentHtml;
    modal.style.display = 'block';
}
async function handleInitiateProject(event) {
    event.stopPropagation();
    const button = event.target;
    if (!confirm('Are you sure you want to create a new project from this request?')) return;
    button.textContent = 'Creating...';
    button.disabled = true;
    const rowIndex = button.dataset.rowIndex;
    const { headers, rows } = allRequests;
    const requestData = arrayToObject(rows[rowIndex], headers);
    const projectData = {
        'ProjectName': `Project for ${requestData['Full Name']} - ${requestData['Submission Date']}`,
        'ClientID': 'LOOKUP_REQUIRED',
        'Status': 'Planning',
        'StartDate': requestData['Primary Date'] || new Date().toLocaleDateString(),
        'Description': `Based on service request from ${requestData['Submission Date']}.\nService: ${requestData['Primary Service Type']}\nLocation: ${requestData['Primary Location']}`
    };
    try {
        await writeData('Projects', projectData);
        button.textContent = 'Project Created';
    } catch(err) {
        button.textContent = 'Error!';
        button.disabled = false;
        alert('Could not create project. See console for details.');
        console.error("Initiate Project Error:", err);
    }
}
function populateServiceFilter() {
    if (allRequests.length === 0) return;
    const { headers, rows } = allRequests;
    const serviceIndex = headers.indexOf('Primary Service Category');
    if (serviceIndex === -1) return;
    const services = new Set(rows.map(row => row[serviceIndex]));
    serviceFilter.innerHTML = '<option value="all">All Services</option>';
    services.forEach(service => {
        if(service) {
            const option = document.createElement('option');
            option.value = service;
            option.textContent = service;
            serviceFilter.appendChild(option);
        }
    });
}
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
        statusDiv.textContent = `Error: ${err.result.error.message}`;
    }
}
async function loadClients() {
    const clientListDiv = document.getElementById('client-list');
    clientListDiv.innerHTML = '<p>Loading clients...</p>';
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Clients' });
        const values = response.result.values;
        if (!values || values.length < 1) {
            clientListDiv.innerHTML = '<p>No client data found.</p>';
            return;
        }
        const headers = values[0];
        const dataRows = values.slice(1);
        const firstNameIndex = headers.indexOf('First Name');
        const lastNameIndex = headers.indexOf('Last Name');
        const emailIndex = headers.indexOf('Email');
        
        if (firstNameIndex === -1 || emailIndex === -1) {
             clientListDiv.innerHTML = `<p style="color:red;">Error: Required column not found.</p>`;
             return;
        }
        
        clientListDiv.innerHTML = '';
        if (dataRows.length === 0) {
            clientListDiv.innerHTML = '<p>No clients found.</p>';
            return;
        }
        const ul = document.createElement('ul');
        dataRows.forEach(row => {
            const li = document.createElement('li');
            li.textContent = `${row[firstNameIndex] || 'N/A'} ${row[lastNameIndex] || ''} - (${row[emailIndex] || 'N/A'})`;
            ul.appendChild(li);
        });
        clientListDiv.appendChild(ul);
    } catch (err) {
        clientListDiv.innerHTML = `<p style="color:red;">Error: ${err.result.error.message}</p>`;
    }
}
async function writeData(sheetName, dataObject) {
    const headerResponse = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!1:1` });
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
function arrayToObject(row, headers) {
    const obj = {};
    headers.forEach((header, index) => {
        obj[header] = row[index];
    });
    return obj;
}
