// --- CONFIGURATION ---
const CLIENT_ID = "555797317893-ce2nrrf49e5dol0c6lurln0c3it76c2r.apps.googleusercontent.com";
const SPREADSHEET_ID = "1G3kVQdR0yd1j362oZKYRXMby1Ve6PVcY8CrsQnuxVfY";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
// --- END OF CONFIGURATION ---

// --- STATE MANAGEMENT ---
let allRequests = { headers: [], rows: [] };
let state = {
    currentPage: 1,
    rowsPerPage: 10,
    sortColumn: 'Submission Date',
    sortDirection: 'desc',
    searchTerm: '',
    filters: {
        service: 'all',
        status: 'all' // 'all', 'new', 'archived'
    }
};

// --- DOM ELEMENTS (declared globally, assigned when DOM is ready) ---
let tokenClient, gapiInited = false, gisInited = false;
let authorizeButton, signoutButton, appContainer, addClientForm, serviceFilter, statusFilter, searchBar, modal, closeModalButton, listViewBtn, cardViewBtn, modalSaveNoteBtn;

document.addEventListener('DOMContentLoaded', () => {
    // Assign all elements
    authorizeButton = document.getElementById('authorize_button');
    signoutButton = document.getElementById('signout_button');
    appContainer = document.getElementById('app-container');
    addClientForm = document.getElementById('add-client-form');
    serviceFilter = document.getElementById('service-filter');
    statusFilter = document.getElementById('status-filter');
    searchBar = document.getElementById('search-bar');
    modal = document.getElementById('details-modal');
    closeModalButton = document.querySelector('.close-button');
    listViewBtn = document.getElementById('list-view-btn');
    cardViewBtn = document.getElementById('card-view-btn');
    modalSaveNoteBtn = document.getElementById('modal-save-note-btn');

    // Assign event listeners
    authorizeButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
    addClientForm.addEventListener('submit', handleAddClientSubmit);
    serviceFilter.onchange = (e) => updateFilter('service', e.target.value);
    statusFilter.onchange = (e) => updateFilter('status', e.target.value);
    searchBar.oninput = (e) => updateSearch(e.target.value);
    closeModalButton.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => { if (event.target == modal) { modal.style.display = 'none'; } };
    listViewBtn.onclick = () => setView('list');
    cardViewBtn.onclick = () => setView('card');
});

// --- CORE LOGIC & WORKFLOW ---

function updateFilter(key, value) {
    state.filters[key] = value;
    state.currentPage = 1;
    renderRequests();
}

function updateSearch(term) {
    state.searchTerm = term.toLowerCase();
    state.currentPage = 1;
    renderRequests();
}

function setView(view) {
    state.currentView = view;
    listViewBtn.classList.toggle('active', view === 'list');
    cardViewBtn.classList.toggle('active', view === 'card');
    renderRequests();
}

/**
 * The main rendering pipeline. Takes all data, applies filters, sorting,
 * pagination, and then calls the appropriate render function.
 */
function renderRequests() {
    if (allRequests.rows.length === 0) {
        document.getElementById('requests-container').innerHTML = '<p>No submissions found.</p>';
        return;
    }

    const { headers, rows } = allRequests;
    const statusIndex = headers.indexOf('Status');
    
    // 1. Apply Status Filter (New vs Archived)
    let processedRows = rows;
    if (state.filters.status !== 'all') {
        const isArchived = state.filters.status === 'archived';
        processedRows = rows.filter(row => (row[statusIndex] === 'Archived') === isArchived);
    }

    // 2. Apply Search Term
    if (state.searchTerm) {
        processedRows = processedRows.filter(row => 
            row.some(cell => cell.toLowerCase().includes(state.searchTerm))
        );
    }

    // 3. Apply Service Category Filter
    if (state.filters.service !== 'all') {
        const serviceIndex = headers.indexOf('Primary Service Category');
        processedRows = processedRows.filter(row => row[serviceIndex] === state.filters.service);
    }
    
    // 4. Apply Sorting
    const sortIndex = headers.indexOf(state.sortColumn);
    if (sortIndex > -1) {
        processedRows.sort((a, b) => {
            let valA = a[sortIndex] || '';
            let valB = b[sortIndex] || '';
            // Basic date sorting for 'Submission Date'
            if (state.sortColumn === 'Submission Date') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            }
            if (valA < valB) return state.sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return state.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // 5. Apply Pagination
    const startIndex = (state.currentPage - 1) * state.rowsPerPage;
    const endIndex = startIndex + state.rowsPerPage;
    const paginatedRows = processedRows.slice(startIndex, endIndex);

    // 6. Render
    const container = document.getElementById('requests-container');
    if (state.currentView === 'list') {
        renderRequestsAsList(paginatedRows, container);
    } else {
        renderRequestsAsCards(paginatedRows, container);
    }
    renderPagination(processedRows.length);
}


// --- All other functions from the previous step ---
// NOTE: Some functions like renderRequestsAsList are modified to work with the new pipeline.

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
async function loadRequests() {
    const container = document.getElementById('requests-container');
    container.innerHTML = '<p>Loading new service requests...</p>';
    document.getElementById('archived-requests-container').innerHTML = ''; // Clear archived
    
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID, range: 'Submissions',
        });
        const values = response.result.values;
        if (values && values.length > 1) {
            allRequests = { headers: values[0], rows: values.slice(1) };
            populateServiceFilter();
        } else {
            allRequests = { headers: [], rows: [] };
        }
    } catch (err) {
        container.innerHTML = `<p style="color:red;">Error loading requests: ${err.result.error.message}</p>`;
        return;
    }
    setView('list'); // Default to list view on load
}

function renderRequestsAsList(paginatedRows, container) {
    container.innerHTML = '';
    if (paginatedRows.length === 0) {
        container.innerHTML = '<p>No requests match your criteria.</p>';
        return;
    }
    const { headers } = allRequests;
    const dateIndex = headers.indexOf('Submission Date');
    const nameIndex = headers.indexOf('Full Name');
    const statusIndex = headers.indexOf('Status');
    const table = document.createElement('table');
    table.className = 'data-table';
    
    const sortableHeaders = ['Submission Date', 'Full Name'];
    let headerHtml = '<thead><tr>';
    sortableHeaders.forEach(headerText => {
        let classes = 'sortable';
        if (state.sortColumn === headerText) {
            classes += state.sortDirection === 'asc' ? ' sorted-asc' : ' sorted-desc';
        }
        headerHtml += `<th class="${classes}" data-sort="${headerText}">${headerText}</th>`;
    });
    headerHtml += '<th>Status</th><th>Actions</th></tr></thead>';
    table.innerHTML = headerHtml;

    const tbody = document.createElement('tbody');
    paginatedRows.forEach(row => {
        const originalIndex = allRequests.rows.indexOf(row);
        const tr = document.createElement('tr');
        const status = row[statusIndex] || 'New';
        const statusClass = `badge-${status.toLowerCase()}`;
        tr.innerHTML = `<td>${row[dateIndex] || ''}</td><td>${row[nameIndex] || ''}</td><td><span class="badge ${statusClass}">${status}</span></td>`;
        
        const isArchived = row[statusIndex] === 'Archived';
        const actionTd = document.createElement('td');
        actionTd.innerHTML = `<button class="details-btn" data-row-index="${originalIndex}">Details</button><button class="archive-btn" data-row-index="${originalIndex}">${isArchived ? 'Unarchive' : 'Archive'}</button>`;
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
    
    container.querySelectorAll('.details-btn').forEach(b => b.onclick = (e) => showRequestDetailsModal(allRequests.rows[e.target.dataset.rowIndex], headers));
    container.querySelectorAll('.archive-btn').forEach(b => b.onclick = handleArchiveRequest);
    container.querySelectorAll('th.sortable').forEach(th => th.onclick = handleSort);
}

function handleSort(event) {
    const newSortColumn = event.target.dataset.sort;
    if (state.sortColumn === newSortColumn) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortColumn = newSortColumn;
        state.sortDirection = 'asc';
    }
    renderRequests();
}

function renderPagination(totalRows) {
    const container = document.getElementById('pagination-controls');
    container.innerHTML = '';
    const pageCount = Math.ceil(totalRows / state.rowsPerPage);
    if (pageCount <= 1) return;

    for (let i = 1; i <= pageCount; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === state.currentPage) {
            btn.classList.add('active');
        }
        btn.onclick = () => {
            state.currentPage = i;
            renderRequests();
        };
        container.appendChild(btn);
    }
}

async function showRequestDetailsModal(rowData, headers) {
    const modalBody = document.getElementById('modal-body');
    const notesTextarea = document.getElementById('modal-notes-textarea');
    const noteStatus = document.getElementById('modal-note-status');
    const originalIndex = allRequests.rows.indexOf(rowData);

    noteStatus.textContent = '';
    const ignoredFields = ['Raw Payload', 'All Services JSON', 'Submission ID', 'Timestamp', 'Notes'];
    let contentHtml = '<ul>';
    const rawPayloadIndex = headers.indexOf('Raw Payload');
    const notesIndex = headers.indexOf('Notes');
    
    headers.forEach((header, index) => {
        if (rowData[index] && !ignoredFields.includes(header)) {
            contentHtml += `<li><strong>${header}:</strong> ${rowData[index]}</li>`;
        }
    });
    contentHtml += '</ul>';
    
    if (rawPayloadIndex > -1 && rowData[rawPayloadIndex]) {
        try {
            contentHtml += `<h3>Raw Payload Data</h3><pre><code>${JSON.stringify(JSON.parse(rowData[rawPayloadIndex]), null, 2)}</code></pre>`;
        } catch (e) {
            contentHtml += `<h3>Raw Payload Data</h3><pre><code>${rowData[rawPayloadIndex]}</code></pre>`;
        }
    }
    
    modalBody.innerHTML = contentHtml;
    notesTextarea.value = rowData[notesIndex] || '';
    modalSaveNoteBtn.onclick = () => handleSaveNote(originalIndex);
    modal.style.display = 'block';
}

async function handleSaveNote(rowIndex) {
    const noteStatus = document.getElementById('modal-note-status');
    noteStatus.textContent = 'Saving...';
    const newNote = document.getElementById('modal-notes-textarea').value;
    
    const { headers, rows } = allRequests;
    const rowData = rows[rowIndex];
    const notesIndex = headers.indexOf('Notes');
    const submissionIdIndex = headers.indexOf('Submission ID');

    if (notesIndex === -1 || submissionIdIndex === -1) {
        noteStatus.textContent = "Error: 'Notes' or 'Submission ID' column missing.";
        return;
    }

    try {
        const submissionId = rowData[submissionIdIndex];
        const allSheetValues = (await gapi.client.sheets.spreadsheets.values.get({spreadsheetId: SPREADSHEET_ID, range: 'Submissions'})).result.values;
        const visualRowIndex = allSheetValues.findIndex(sheetRow => sheetRow && sheetRow[submissionIdIndex] === submissionId);

        if (visualRowIndex === -1) throw new Error("Could not find row in sheet.");
        
        const targetCell = `${String.fromCharCode(65 + notesIndex)}${visualRowIndex + 1}`;
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Submissions!${targetCell}`,
            valueInputOption: 'RAW',
            resource: { values: [[newNote]] }
        });

        allRequests.rows[rowIndex][notesIndex] = newNote; // Update cache
        noteStatus.textContent = 'Saved successfully!';
    } catch (err) {
        noteStatus.textContent = 'Error saving note.';
        console.error("Save Note Error:", err);
    }
}


// --- All other functions (from previous steps) ---
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
            throw new Error("Could not find the row in the sheet to update.");
        }
        
        const targetRowNumber = visualRowIndex + 1;
        const targetRange = `Submissions!A${targetRowNumber}`;
        const updatedRowValues = [...rowData];
        updatedRowValues[statusIndex] = newStatus;

        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: targetRange,
            valueInputOption: 'RAW',
            resource: { values: [updatedRowValues] }
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
function populateServiceFilter() {
    if (allRequests.rows.length === 0) return;
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
        clientListDiv.innerHTML = `<p style="color:red;">Error: ${err.result.error.message}`;
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
