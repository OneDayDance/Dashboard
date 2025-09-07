// --- CONFIGURATION ---
const CLIENT_ID = "555797317893-ce2nrrf49e5dol0c6lurln0c3it76c2r.apps.googleusercontent.com";
const SPREADSHEET_ID = "1G3kVQdR0yd1j362oZKYRXMby1Ve6PVcY8CrsQnuxVfY";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
// --- END OF CONFIGURATION ---

// --- STATE MANAGEMENT ---
let allRequests = { headers: [], rows: [] };
let allClients = { headers: [], rows: [] };
let state = {
    currentPage: 1,
    rowsPerPage: 10,
    sortColumn: 'Submission Date',
    sortDirection: 'desc',
    searchTerm: '',
    filters: { service: 'all', status: 'all' },
    visibleColumns: ['Submission Date', 'Full Name', 'Primary Service Category', 'Status'],
    currentView: 'list'
};
const sortableColumns = ['Submission Date', 'Full Name', 'Email', 'Organization', 'Primary Service Category', 'Status'];

// --- DOM ELEMENTS ---
let tokenClient, gapiInited = false, gisInited = false;
let authorizeButton, signoutButton, appContainer, addClientForm, serviceFilter, statusFilter, searchBar, detailsModal, columnModal, closeModalButtons, listViewBtn, cardViewBtn, modalSaveNoteBtn, archiveToggle, archiveContainer, columnSelectBtn, saveColumnsBtn, landingContainer;

document.addEventListener('DOMContentLoaded', () => {
    // Assign all elements
    authorizeButton = document.getElementById('authorize_button');
    signoutButton = document.getElementById('signout_button');
    appContainer = document.getElementById('app-container');
    addClientForm = document.getElementById('add-client-form');
    serviceFilter = document.getElementById('service-filter');
    statusFilter = document.getElementById('status-filter');
    searchBar = document.getElementById('search-bar');
    detailsModal = document.getElementById('details-modal');
    columnModal = document.getElementById('column-modal');
    closeModalButtons = document.querySelectorAll('.close-button');
    listViewBtn = document.getElementById('list-view-btn');
    cardViewBtn = document.getElementById('card-view-btn');
    modalSaveNoteBtn = document.getElementById('modal-save-note-btn');
    archiveToggle = document.getElementById('archive-toggle');
    archiveContainer = document.getElementById('archived-requests-container');
    columnSelectBtn = document.getElementById('column-select-btn');
    saveColumnsBtn = document.getElementById('save-columns-btn');
    landingContainer = document.getElementById('landing-container');

    // Assign event listeners
    authorizeButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
    addClientForm.addEventListener('submit', handleAddClientSubmit);
    serviceFilter.onchange = (e) => updateFilter('service', e.target.value);
    statusFilter.onchange = (e) => updateFilter('status', e.target.value);
    searchBar.oninput = (e) => updateSearch(e.target.value);
    
    closeModalButtons.forEach(btn => btn.onclick = () => {
        detailsModal.style.display = 'none';
        columnModal.style.display = 'none';
    });
    window.onclick = (event) => { 
        if (event.target == detailsModal) detailsModal.style.display = 'none';
        if (event.target == columnModal) columnModal.style.display = 'none';
    };
    
    listViewBtn.onclick = () => setView('list');
    cardViewBtn.onclick = () => setView('card');
    columnSelectBtn.onclick = () => columnModal.style.display = 'block';
    saveColumnsBtn.onclick = handleSaveColumns;
    
    archiveToggle.onclick = () => {
        archiveToggle.classList.toggle('collapsed');
        archiveContainer.classList.toggle('collapsed');
    };
});

// --- INITIALIZATION & AUTH ---
function checkLibsLoaded() {
    if (gapiInited && gisInited) {
        authorizeButton.disabled = false;
        authorizeButton.textContent = 'Authorize';
    }
}

function gapiLoaded() { gapi.load('client', initializeGapiClient); }
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: SCOPES, callback: '',
    });
    gisInited = true;
    checkLibsLoaded();
}
async function initializeGapiClient() {
    await gapi.client.init({});
    await gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4');
    gapiInited = true;
    checkLibsLoaded();
}

async function loadInitialData() {
    await Promise.all([loadRequests(), loadClients()]);
}

function handleAuthClick() {
    tokenClient.callback = async (tokenResponse) => {
        if (tokenResponse.error !== undefined) { throw (tokenResponse); }
        landingContainer.style.display = 'none';
        appContainer.style.display = 'block';
        setupTabs();
        await loadInitialData();
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
        landingContainer.style.display = 'flex';
    }
}

// --- TAB NAVIGATION & CORE LOGIC ---
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
            renderRequests();
            break;
        case 'clients':
            renderClients();
            break;
    }
}
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
function handleSaveColumns() {
    const selectedColumns = [];
    document.querySelectorAll('#column-checkboxes input[type="checkbox"]:checked').forEach(checkbox => {
        selectedColumns.push(checkbox.value);
    });
    state.visibleColumns = selectedColumns;
    columnModal.style.display = 'none';
    renderRequests();
}

// --- REQUESTS TAB FUNCTIONS ---
async function loadRequests() {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID, range: 'Submissions',
        });
        const values = response.result.values;
        if (values && values.length > 1) {
            allRequests = { headers: values[0], rows: values.slice(1) };
            populateServiceFilter();
            populateColumnSelector();
        } else {
            allRequests = { headers: [], rows: [] };
        }
    } catch (err) {
        console.error("Error loading requests:", err);
        document.getElementById('requests-container').innerHTML = `<p style="color:red;">Error loading requests: ${err.result.error.message}</p>`;
    }
    archiveToggle.classList.add('collapsed');
    archiveContainer.classList.add('collapsed');
}

function renderRequests() {
    if (!allRequests.rows || allRequests.rows.length === 0) {
        document.getElementById('requests-container').innerHTML = '<p>No submissions found.</p>';
        document.getElementById('archived-requests-container').innerHTML = '';
        return;
    }
    const { headers, rows } = allRequests;
    let processedRows = rows;
    if (state.searchTerm) {
        processedRows = processedRows.filter(row => row.some(cell => String(cell).toLowerCase().includes(state.searchTerm)));
    }
    if (state.filters.service !== 'all') {
        const serviceIndex = headers.indexOf('Primary Service Category');
        processedRows = processedRows.filter(row => row[serviceIndex] === state.filters.service);
    }
    const sortIndex = headers.indexOf(state.sortColumn);
    if (sortIndex > -1) {
        processedRows.sort((a, b) => {
            let valA = a[sortIndex] || ''; let valB = b[sortIndex] || '';
            if (state.sortColumn === 'Submission Date') {
                valA = new Date(valA).getTime() || 0;
                valB = new Date(valB).getTime() || 0;
            }
            if (valA < valB) return state.sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return state.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    const statusIndex = headers.indexOf('Status');
    const newRequests = [], archivedRequests = [];
    
    processedRows.forEach(row => {
        const isArchived = row[statusIndex] === 'Archived';
        if (state.filters.status === 'all') {
            if (isArchived) archivedRequests.push(row);
            else newRequests.push(row);
        } else if (state.filters.status === 'archived' && isArchived) {
            archivedRequests.push(row);
        } else if (state.filters.status === 'new' && !isArchived) {
            newRequests.push(row);
        }
    });

    const renderFn = state.currentView === 'list' ? renderRequestsAsList : renderRequestsAsCards;
    renderFn(newRequests, document.getElementById('requests-container'));
    renderFn(archivedRequests, document.getElementById('archived-requests-container'));
}

function renderRequestsAsList(requestRows, container) {
    container.innerHTML = '';
    if (requestRows.length === 0) {
        container.innerHTML = `<p>No submissions to display.</p>`;
        return;
    }
    const { headers } = allRequests;
    const table = document.createElement('table');
    table.className = 'data-table';
    let headerHtml = '<thead><tr>';
    state.visibleColumns.forEach(headerText => {
        let classes = '';
        if (sortableColumns.includes(headerText)) {
            classes += 'sortable';
            if (state.sortColumn === headerText) { classes += state.sortDirection === 'asc' ? ' sorted-asc' : ' sorted-desc'; }
        }
        headerHtml += `<th class="${classes}" data-sort="${headerText}">${headerText}</th>`;
    });
    table.innerHTML = headerHtml += '</tr></thead>';

    const tbody = document.createElement('tbody');
    requestRows.forEach(row => {
        const originalIndex = allRequests.rows.indexOf(row);
        const tr = document.createElement('tr');
        tr.onclick = () => showRequestDetailsModal(row, headers);
        
        state.visibleColumns.forEach(headerText => {
            const cellIndex = headers.indexOf(headerText);
            const td = document.createElement('td');
            if (headerText === 'Status') {
                const statusSelect = document.createElement('select');
                statusSelect.dataset.rowIndex = originalIndex;
                const currentStatus = row[cellIndex] || 'New';
                ['New', 'Contacted', 'Archived'].forEach(status => {
                    const option = new Option(status, status, false, status === currentStatus);
                    statusSelect.add(option);
                });
                statusSelect.onclick = (e) => e.stopPropagation(); // Prevent modal from opening
                statusSelect.onchange = handleStatusChange;
                td.appendChild(statusSelect);
            } else {
                td.textContent = row[cellIndex] || '';
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
    container.querySelectorAll('th.sortable').forEach(th => th.onclick = handleSort);
}

function renderRequestsAsCards(requestRows, container) {
    container.innerHTML = '';
    if (requestRows.length === 0) {
        container.innerHTML = `<p>No submissions to display.</p>`;
        return;
    }
    const { headers } = allRequests;
    const cardContainer = document.createElement('div');
    cardContainer.className = 'card-container';
    
    requestRows.forEach(row => {
        const originalIndex = allRequests.rows.indexOf(row);
        const card = document.createElement('div');
        card.className = 'request-card';
        card.onclick = () => showRequestDetailsModal(row, headers);
        
        // Dynamically add visible columns to the card
        let cardContent = '';
        state.visibleColumns.forEach(headerText => {
            const cellIndex = headers.indexOf(headerText);
            if (headerText === "Full Name") {
                cardContent += `<h3>${row[cellIndex] || 'No Name'}</h3>`;
            } else if (headerText !== "Status") {
                cardContent += `<p><strong>${headerText}:</strong> ${row[cellIndex] || 'N/A'}</p>`;
            }
        });
        card.innerHTML = cardContent;

        const statusIndex = headers.indexOf('Status');
        const statusSelect = document.createElement('select');
        statusSelect.dataset.rowIndex = originalIndex;
        const currentStatus = row[statusIndex] || 'New';
        ['New', 'Contacted', 'Archived'].forEach(status => {
            const option = new Option(status, status, false, status === currentStatus);
            statusSelect.add(option);
        });
        statusSelect.onclick = (e) => e.stopPropagation();
        statusSelect.onchange = handleStatusChange;
        
        card.appendChild(statusSelect);
        cardContainer.appendChild(card);
    });
    container.appendChild(cardContainer);
}

async function handleStatusChange(event) {
    const selectElement = event.target;
    const newStatus = selectElement.value;
    const rowIndex = parseInt(selectElement.dataset.rowIndex, 10);
    const dataToUpdate = { 'Status': newStatus };
    
    selectElement.disabled = true;
    try {
        await updateRowData('Submissions', rowIndex, dataToUpdate);
        allRequests.rows[rowIndex][allRequests.headers.indexOf('Status')] = newStatus;
        renderRequests();
    } catch(err) {
        alert('Could not update status. See console for details.');
        console.error("Status Update Error:", err);
        selectElement.disabled = false;
    }
}

function showRequestDetailsModal(rowData, headers) {
    const modalBody = document.getElementById('modal-body');
    const ignoredFields = ['Raw Payload', 'All Services JSON', 'Submission ID', 'Timestamp', 'Notes'];
    let contentHtml = '<ul>';
    headers.forEach((header, index) => {
        if (rowData[index] && !ignoredFields.includes(header)) {
            contentHtml += `<li><strong>${header}:</strong> ${rowData[index]}</li>`;
        }
    });
    contentHtml += '</ul>';
    modalBody.innerHTML = contentHtml;
    
    // Notes section
    const notesTextarea = document.getElementById('modal-notes-textarea');
    const noteStatus = document.getElementById('modal-note-status');
    const originalIndex = allRequests.rows.indexOf(rowData);
    noteStatus.textContent = '';
    const notesIndex = headers.indexOf('Notes');
    notesTextarea.value = rowData[notesIndex] || '';
    modalSaveNoteBtn.onclick = () => handleSaveNote(originalIndex);

    // Client section
    const createClientBtn = document.getElementById('modal-create-client-btn');
    const clientStatus = document.getElementById('modal-client-status');
    const submissionEmailIndex = headers.indexOf('Email');
    const submissionEmail = rowData[submissionEmailIndex];
    
    if (!submissionEmail) {
        createClientBtn.disabled = true;
        clientStatus.textContent = "No email in submission.";
    } else {
        const clientEmailIndex = allClients.headers.indexOf('Email');
        const clientExists = allClients.rows.some(clientRow => clientRow[clientEmailIndex] === submissionEmail);

        if(clientExists) {
            createClientBtn.disabled = true;
            clientStatus.textContent = "Client with this email already exists.";
        } else {
            createClientBtn.disabled = false;
            clientStatus.textContent = "";
            createClientBtn.onclick = () => handleCreateClient(rowData, headers);
        }
    }
    
    detailsModal.style.display = 'block';
}

async function handleCreateClient(submissionRow, submissionHeaders) {
    const createClientBtn = document.getElementById('modal-create-client-btn');
    const clientStatus = document.getElementById('modal-client-status');
    createClientBtn.disabled = true;
    clientStatus.textContent = 'Creating client...';

    const fullName = submissionRow[submissionHeaders.indexOf('Full Name')] || '';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    const clientData = {
        'First Name': firstName,
        'Last Name': lastName,
        'Email': submissionRow[submissionHeaders.indexOf('Email')] || '',
        'Phone': submissionRow[submissionHeaders.indexOf('Phone Number')] || '',
        'Organization': submissionRow[submissionHeaders.indexOf('Organization')] || '',
        'Status': 'Active',
        'ClientID': `C-${Date.now()}`,
        'Source': 'Submission',
        'Original Submission ID': submissionRow[submissionHeaders.indexOf('Submission ID')] || ''
    };

    try {
        await writeData('Clients', clientData);
        clientStatus.textContent = 'Client created successfully!';
        await loadClients(); // Refresh client data
    } catch (err) {
        clientStatus.textContent = `Error: ${err.result.error.message}`;
        createClientBtn.disabled = false;
    }
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

async function handleSaveNote(rowIndex) {
    const noteStatus = document.getElementById('modal-note-status');
    noteStatus.textContent = 'Saving...';
    const newNote = document.getElementById('modal-notes-textarea').value;
    const dataToUpdate = { 'Notes': newNote };

    try {
        await updateRowData('Submissions', rowIndex, dataToUpdate);
        allRequests.rows[rowIndex][allRequests.headers.indexOf('Notes')] = newNote;
        noteStatus.textContent = 'Saved successfully!';
    } catch (err) {
        noteStatus.textContent = 'Error saving note.';
        console.error("Save Note Error:", err);
    }
}

// --- UTILITY & GENERIC DATA FUNCTIONS ---
async function updateRowData(sheetName, localRowIndex, dataToUpdate) {
    // This function remains the same
    const { headers, rows } = allRequests;
    const rowData = rows[localRowIndex];
    const idColumnName = 'Submission ID';
    const idIndex = headers.indexOf(idColumnName);
    if (idIndex === -1) throw new Error(`'${idColumnName}' column not found.`);
    const uniqueId = rowData[idIndex];
    const sheetResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: sheetName,
    });
    const sheetValues = sheetResponse.result.values;
    const sheetHeaders = sheetValues[0];
    const visualRowIndex = sheetValues.findIndex(sheetRow => sheetRow && sheetRow[idIndex] === uniqueId);
    if (visualRowIndex === -1) throw new Error("Could not find row in sheet.");
    const originalRow = sheetValues[visualRowIndex];
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
        spreadsheetId: SPREADSHEET_ID, range: targetRange, valueInputOption: 'RAW',
        resource: { values: [updatedRow] }
    });
}

async function loadClients() {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Clients' });
        const values = response.result.values;
        if (!values || values.length < 1) {
            allClients = { headers: [], rows: [] };
        } else {
            allClients = { headers: values[0], rows: values.slice(1) };
        }
    } catch (err) {
        console.error("Error loading clients:", err);
    }
}

function renderClients() {
    const clientListDiv = document.getElementById('client-list');
    clientListDiv.innerHTML = '';
    if (!allClients.rows || allClients.rows.length === 0) {
        clientListDiv.innerHTML = '<p>No clients found.</p>';
        return;
    }
    const { headers, rows } = allClients;
    const firstNameIndex = headers.indexOf('First Name');
    const emailIndex = headers.indexOf('Email');
    if (firstNameIndex === -1 || emailIndex === -1) {
         clientListDiv.innerHTML = `<p style="color:red;">Error: Required client columns not found.</p>`;
         return;
    }
    const ul = document.createElement('ul');
    rows.forEach(row => {
        const li = document.createElement('li');
        li.textContent = `${row[firstNameIndex] || 'N/A'} - (${row[emailIndex] || 'N/A'})`;
        ul.appendChild(li);
    });
    clientListDiv.appendChild(ul);
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
function populateServiceFilter() {
    if (!allRequests.rows || allRequests.rows.length === 0) return;
    const { headers, rows } = allRequests;
    const serviceIndex = headers.indexOf('Primary Service Category');
    if (serviceIndex === -1) return;
    const services = new Set(rows.map(row => row[serviceIndex]));
    serviceFilter.innerHTML = '<option value="all">All Services</option>';
    services.forEach(service => {
        if(service) {
            const option = new Option(service, service);
            serviceFilter.add(option);
        }
    });
}
function populateColumnSelector() {
    const container = document.getElementById('column-checkboxes');
    container.innerHTML = '';
    allRequests.headers.forEach(header => {
        if (!header) return;
        const isChecked = state.visibleColumns.includes(header);
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <label>
                <input type="checkbox" value="${header}" ${isChecked ? 'checked' : ''}>
                ${header}
            </label>
        `;
        container.appendChild(wrapper);
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
        renderClients();
    } catch (err) {
        statusDiv.textContent = `Error: ${err.result.error.message}`;
    }
}
