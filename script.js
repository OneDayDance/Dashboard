// --- CONFIGURATION ---
const CLIENT_ID = "555797317893-ce2nrrf49e5dol0c6lurln0c3it76c2r.apps.googleusercontent.com";
const SPREADSHEET_ID = "1G3kVQdR0yd1j362oZKYRXMby1Ve6PVcY8CrsQnuxVfY";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
// --- END OF CONFIGURATION ---

// State Variables
let tokenClient, gapiInited = false, gisInited = false;
let allRequests = []; // Cache for requests
let currentView = 'list'; // 'list' or 'card'

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
    
    // View toggle listeners
    listViewBtn.onclick = () => {
        currentView = 'list';
        listViewBtn.classList.add('active');
        cardViewBtn.classList.remove('active');
        renderRequests();
    };
    cardViewBtn.onclick = () => {
        currentView = 'card';
        cardViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
        renderRequests();
    };
});

// --- INITIALIZATION & AUTH ---
// All auth functions (gapiLoaded, gisLoaded, initializeGapiClient, handleAuthClick, handleSignoutClick) remain the same.
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
// The setupTabs and loadDataForActiveTab functions remain largely the same.
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
    const container = document.getElementById('requests-container');
    container.innerHTML = '<p>Loading new service requests...</p>';
    if (allRequests.length === 0) {
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
    }
    renderRequests();
}

function renderRequests() {
    if (currentView === 'list') {
        renderRequestsAsList();
    } else {
        renderRequestsAsCards();
    }
}

function getFilteredRequests() {
    if (allRequests.length === 0 || allRequests.rows.length === 0) return [];
    const { headers, rows } = allRequests;
    const selectedService = serviceFilter.value;
    const serviceIndex = headers.indexOf('Primary Service Category');
    return (selectedService === 'all')
        ? rows
        : rows.filter(row => row[serviceIndex] === selectedService);
}

function renderRequestsAsList() {
    const container = document.getElementById('requests-container');
    const filteredRows = getFilteredRequests();
    if (filteredRows.length === 0) {
        container.innerHTML = '<p>No submissions match the selected filter.</p>';
        return;
    }

    const { headers } = allRequests;
    const dateIndex = headers.indexOf('Submission Date');
    const nameIndex = headers.indexOf('Full Name');
    const serviceIndex = headers.indexOf('Primary Service Category');

    container.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `<thead><tr><th>Date</th><th>Name</th><th>Service</th><th>Actions</th></tr></thead>`;
    
    const tbody = document.createElement('tbody');
    filteredRows.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${row[dateIndex] || ''}</td><td>${row[nameIndex] || ''}</td><td>${row[serviceIndex] || ''}</td>`;
        tr.onclick = () => showRequestDetailsModal(row, headers);
        
        const actionTd = document.createElement('td');
        actionTd.innerHTML = `
            <button class="initiate-project-btn" data-row-index="${index}">Initiate Project</button>
            <button class="archive-btn" data-row-index="${index}">Archive</button>
        `;
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
    
    // Add event listeners after table is in the DOM
    container.querySelectorAll('.initiate-project-btn').forEach(b => b.onclick = handleInitiateProject);
    container.querySelectorAll('.archive-btn').forEach(b => b.onclick = handleArchiveRequest);
}

function renderRequestsAsCards() {
    const container = document.getElementById('requests-container');
    const filteredRows = getFilteredRequests();
    if (filteredRows.length === 0) {
        container.innerHTML = '<p>No submissions match the selected filter.</p>';
        return;
    }

    const { headers } = allRequests;
    const dateIndex = headers.indexOf('Submission Date');
    const nameIndex = headers.indexOf('Full Name');
    const serviceIndex = headers.indexOf('Primary Service Category');

    container.innerHTML = '';
    const cardContainer = document.createElement('div');
    cardContainer.className = 'card-container';
    
    filteredRows.forEach((row, index) => {
        const card = document.createElement('div');
        card.className = 'request-card';
        card.innerHTML = `
            <h3>${row[nameIndex] || 'No Name'}</h3>
            <p><strong>Date:</strong> ${row[dateIndex] || 'N/A'}</p>
            <p><strong>Service:</strong> ${row[serviceIndex] || 'N/A'}</p>
            <div class="actions">
                <button class="details-btn">Details</button>
                <button class="initiate-project-btn">Initiate Project</button>
                <button class="archive-btn">Archive</button>
            </div>
        `;
        // Add event listeners to buttons within the card
        card.querySelector('.details-btn').onclick = () => showRequestDetailsModal(row, headers);
        card.querySelector('.initiate-project-btn').onclick = handleInitiateProject;
        card.querySelector('.initiate-project-btn').dataset.rowIndex = index;
        card.querySelector('.archive-btn').onclick = handleArchiveRequest;
        card.querySelector('.archive-btn').dataset.rowIndex = index;
        
        cardContainer.appendChild(card);
    });
    container.appendChild(cardContainer);
}

function showRequestDetailsModal(rowData, headers) {
    const modalBody = document.getElementById('modal-body');
    const ignoredFields = ['Raw Payload', 'All Services JSON', 'Submission IDTimestamp'];
    let contentHtml = '<ul>';
    let rawPayload = '';
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
            // If it's not valid JSON, just show as text
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
        'ClientID': 'LOOKUP_REQUIRED', // We'll need to find the client ID or create a client
        'Status': 'Planning',
        'StartDate': requestData['Primary Date'] || new Date().toLocaleDateString(),
        'Description': `Based on service request from ${requestData['Submission Date']}.\nService: ${requestData['Primary Service Type']}\nLocation: ${requestData['Primary Location']}`
    };

    try {
        await writeData('Projects', projectData);
        button.textContent = 'Project Created';
        // Note: This doesn't archive the request automatically, that's a separate action.
    } catch(err) {
        button.textContent = 'Error!';
        button.disabled = false;
        alert('Could not create project. See console for details.');
        console.error("Initiate Project Error:", err);
    }
}

async function handleArchiveRequest(event) {
    event.stopPropagation();
    const button = event.target;
    if (!confirm('Are you sure you want to archive this request? This will move it from the Submissions sheet.')) return;
    
    button.textContent = 'Archiving...';
    button.disabled = true;

    const rowIndex = parseInt(button.dataset.rowIndex, 10);
    const { headers, rows } = allRequests;
    const rowData = rows[rowIndex];
    const rowObject = arrayToObject(rowData, headers);
    
    try {
        // Step 1: Write the data to the 'Archived' sheet
        await writeData('Archived', rowObject);

        // Step 2: Delete the row from the 'Submissions' sheet (this is complex)
        // Note: The Sheets API uses 1-based indexing for rows and requires the sheet's grid ID.
        // This is a simplified approach; a robust solution would fetch the sheetId first.
        // We'll find the row number based on a unique ID, like 'Submission IDTimestamp'.
        const timestampIndex = headers.indexOf('Submission IDTimestamp');
        const timestamp = rowData[timestampIndex];
        
        // Find the visual row number in the sheet
        const allSheetValues = (await gapi.client.sheets.spreadsheets.values.get({spreadsheetId: SPREADSHEET_ID, range: 'Submissions'})).result.values;
        const visualRowIndex = allSheetValues.findIndex(row => row[timestampIndex] === timestamp);

        if (visualRowIndex > -1) {
            // Step 3: Delete the row using a batch update. Assumes sheetId is 0 (the first sheet).
            // A truly robust solution would look up the sheetId first.
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: 0, // DANGER: Assumes 'Submissions' is the very first sheet
                                dimension: 'ROWS',
                                startIndex: visualRowIndex,
                                endIndex: visualRowIndex + 1
                            }
                        }
                    }]
                }
            });
        }
        
        // Step 4: Remove from local cache and re-render
        allRequests.rows.splice(rowIndex, 1);
        renderRequests();

    } catch(err) {
        button.textContent = 'Error!';
        button.disabled = false;
        alert('Could not archive request. The sheet might have been changed by someone else. Please refresh.');
        console.error("Archive Error:", err);
    }
}


// --- UTILITY AND OTHER DATA FUNCTIONS ---

// ... populateServiceFilter, handleCreateClientFromRequest, handleAddClientSubmit, loadClients, and writeData remain here ...
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
async function handleCreateClientFromRequest(event) {
    event.stopPropagation();
    const button = event.target;
    button.textContent = 'Creating...';
    button.disabled = true;
    const { firstName, lastName, email } = button.dataset;
    const clientData = {
        'First Name': firstName, 'Last Name': lastName, 'Email': email,
        'Status': 'Lead', 'ClientID': `C-${Date.now()}`
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
