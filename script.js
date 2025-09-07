// --- CONFIGURATION ---
const CLIENT_ID = "555797317893-ce2nrrf49e5dol0c6lurln0c3it76c2r.apps.googleusercontent.com";
const SPREADSHEET_ID = "1G3kVQdR0yd1j362oZKYRXMby1Ve6PVcY8CrsQnuxVfY";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
// --- END OF CONFIGURATION ---

// --- STATE MANAGEMENT ---
let allRequests = { headers: [], rows: [] };
let allClients = { headers: [], rows: [] };
let allProjects = { headers: [], rows: [] }; // To store project data
let state = {
    // requests tab state
    sortColumn: 'Submission Date',
    sortDirection: 'desc',
    searchTerm: '',
    filters: { service: 'all', status: 'all' },
    visibleColumns: ['Submission Date', 'Full Name', 'Primary Service Category', 'Status'],
    currentView: 'list',
    // clients tab state
    clientSearchTerm: '',
    clientSortColumn: 'First Name',
    clientSortDirection: 'asc'
};
const sortableColumns = ['Submission Date', 'Full Name', 'Email', 'Organization', 'Primary Service Category', 'Status'];
const clientSortableColumns = ['First Name', 'Last Name', 'Email', 'Organization', 'Status'];


// --- DOM ELEMENTS ---
let tokenClient, gapiInited = false, gisInited = false;
let authorizeButton, signoutButton, appContainer, addClientForm, serviceFilter, statusFilter, searchBar, detailsModal, columnModal, closeModalButtons, listViewBtn, cardViewBtn, modalSaveNoteBtn, archiveToggle, archiveContainer, columnSelectBtn, saveColumnsBtn, landingContainer, clientSearchBar, clientTableContainer, clientDetailsModal;
let silentAuthAttempted = false;


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
    clientDetailsModal = document.getElementById('client-details-modal');
    closeModalButtons = document.querySelectorAll('.close-button');
    listViewBtn = document.getElementById('list-view-btn');
    cardViewBtn = document.getElementById('card-view-btn');
    modalSaveNoteBtn = document.getElementById('modal-save-note-btn');
    archiveToggle = document.getElementById('archive-toggle');
    archiveContainer = document.getElementById('archived-requests-container');
    columnSelectBtn = document.getElementById('column-select-btn');
    saveColumnsBtn = document.getElementById('save-columns-btn');
    landingContainer = document.getElementById('landing-container');
    clientSearchBar = document.getElementById('client-search-bar');
    clientTableContainer = document.getElementById('client-table-container');

    // Assign event listeners
    authorizeButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
    addClientForm.addEventListener('submit', handleAddClientSubmit);
    serviceFilter.onchange = (e) => updateFilter('service', e.target.value);
    statusFilter.onchange = (e) => updateFilter('status', e.target.value);
    searchBar.oninput = (e) => updateSearch(e.target.value);
    clientSearchBar.oninput = (e) => updateClientSearch(e.target.value);
    
    closeModalButtons.forEach(btn => btn.onclick = () => {
        detailsModal.style.display = 'none';
        columnModal.style.display = 'none';
        clientDetailsModal.style.display = 'none';
    });
    window.onclick = (event) => { 
        if (event.target == detailsModal) detailsModal.style.display = 'none';
        if (event.target == columnModal) columnModal.style.display = 'none';
        if (event.target == clientDetailsModal) clientDetailsModal.style.display = 'none';
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
        attemptSilentSignIn();
    }
}

function gapiLoaded() { gapi.load('client', initializeGapiClient); }

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (tokenResponse) => {
            if (tokenResponse.error) {
                console.warn('Token response error:', tokenResponse.error);
                return;
            }
            await onSignInSuccess();
        },
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

function attemptSilentSignIn() {
    if (!silentAuthAttempted) {
        silentAuthAttempted = true;
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

async function onSignInSuccess() {
    landingContainer.style.display = 'none';
    appContainer.style.display = 'block';
    setupTabs();
    await loadInitialData();
    loadDataForActiveTab();
}

async function loadInitialData() {
    // Load all data concurrently for faster startup
    await Promise.all([loadRequests(), loadClients(), loadProjects()]);
}

function handleAuthClick() {
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        appContainer.style.display = 'none';
        landingContainer.style.display = 'flex';
        silentAuthAttempted = false;
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
    renderRequests();
}
function updateSearch(term) {
    state.searchTerm = term.toLowerCase();
    renderRequests();
}

function updateClientSearch(term) {
    state.clientSearchTerm = term.toLowerCase();
    renderClients();
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
        document.getElementById('requests-container').innerHTML = `<p style="color:red;">Error loading requests.</p>`;
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
    let { headers, rows } = allRequests;
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
    table.innerHTML = headerHtml + '</tr></thead>';

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
                statusSelect.onclick = (e) => e.stopPropagation();
                statusSelect.onchange = (e) => handleStatusChange(e, originalIndex);
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
        statusSelect.onchange = (e) => handleStatusChange(e, originalIndex);
        
        card.appendChild(statusSelect);
        cardContainer.appendChild(card);
    });
    container.appendChild(cardContainer);
}

async function handleStatusChange(event, rowIndex) {
    const selectElement = event.target;
    const newStatus = selectElement.value;
    const dataToUpdate = { 'Status': newStatus };
    
    selectElement.disabled = true;
    try {
        const submissionId = allRequests.rows[rowIndex][allRequests.headers.indexOf('Submission ID')];
        await updateSheetRow('Submissions', 'Submission ID', submissionId, dataToUpdate);
        allRequests.rows[rowIndex][allRequests.headers.indexOf('Status')] = newStatus;
        renderRequests();
    } catch(err) {
        alert('Could not update status.');
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
    
    const notesTextarea = document.getElementById('modal-notes-textarea');
    const noteStatus = document.getElementById('modal-note-status');
    const originalIndex = allRequests.rows.indexOf(rowData);
    noteStatus.textContent = '';
    const notesIndex = headers.indexOf('Notes');
    notesTextarea.value = rowData[notesIndex] || '';
    modalSaveNoteBtn.onclick = () => handleSaveNote(originalIndex);

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
        'Phone': submissionRow[submissionHeaders.indexOf('Phone')] || '',
        'Organization': submissionRow[submissionHeaders.indexOf('Organization')] || '',
        'Status': 'Active',
        'ClientID': `C-${Date.now()}`,
        'Source': 'Submission',
        'Original Submission ID': submissionRow[submissionHeaders.indexOf('Submission ID')] || ''
    };

    try {
        await writeData('Clients', clientData);
        clientStatus.textContent = 'Client created successfully!';
        await loadClients();
        renderClients();
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
        const submissionId = allRequests.rows[rowIndex][allRequests.headers.indexOf('Submission ID')];
        await updateSheetRow('Submissions', 'Submission ID', submissionId, dataToUpdate);
        allRequests.rows[rowIndex][allRequests.headers.indexOf('Notes')] = newNote;
        noteStatus.textContent = 'Saved successfully!';
    } catch (err) {
        noteStatus.textContent = 'Error saving note.';
        console.error("Save Note Error:", err);
    }
}

// --- PROJECTS TAB FUNCTIONS (NEW) ---
async function loadProjects() {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Projects' });
        const values = response.result.values;
        if (values && values.length > 1) {
            allProjects = { headers: values[0], rows: values.slice(1) };
        } else {
            allProjects = { headers: [], rows: [] };
        }
    } catch (err) {
        console.warn("Could not load 'Projects' sheet. Some client features may be limited.", err);
        allProjects = { headers: [], rows: [] };
    }
}


// --- CLIENTS TAB FUNCTIONS ---
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
        document.getElementById('client-table-container').innerHTML = `<p style="color:red;">Error loading clients.</p>`;
    }
}

function renderClients() {
    clientTableContainer.innerHTML = '';
    if (!allClients.rows || allClients.rows.length === 0) {
        clientTableContainer.innerHTML = '<p>No clients found.</p>';
        return;
    }

    let { headers, rows } = allClients;
    let processedRows = rows;
    
    if (state.clientSearchTerm) {
        processedRows = processedRows.filter(row => row.some(cell => String(cell).toLowerCase().includes(state.clientSearchTerm)));
    }
    
    const sortIndex = headers.indexOf(state.clientSortColumn);
    if (sortIndex > -1) {
        processedRows.sort((a, b) => {
            let valA = a[sortIndex] || ''; let valB = b[sortIndex] || '';
            if (valA < valB) return state.clientSortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return state.clientSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    const table = document.createElement('table');
    table.className = 'data-table';
    let headerHtml = '<thead><tr>';
    const displayHeaders = ['First Name', 'Last Name', 'Email', 'Organization', 'Status'];
    displayHeaders.forEach(headerText => {
        let classes = '';
        if (clientSortableColumns.includes(headerText)) {
            classes += 'sortable';
            if (state.clientSortColumn === headerText) {
                classes += state.clientSortDirection === 'asc' ? ' sorted-asc' : ' sorted-desc';
            }
        }
        headerHtml += `<th class="${classes}" data-sort-client="${headerText}">${headerText}</th>`;
    });
    table.innerHTML = headerHtml + '</tr></thead>';

    const tbody = document.createElement('tbody');
    processedRows.forEach(row => {
        const tr = document.createElement('tr');
        tr.onclick = () => showClientDetailsModal(row, headers);
        displayHeaders.forEach(header => {
            const cellIndex = headers.indexOf(header);
            const td = document.createElement('td');
            td.textContent = row[cellIndex] || '';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    clientTableContainer.appendChild(table);
    
    clientTableContainer.querySelectorAll('th.sortable').forEach(th => {
        th.onclick = handleClientSort;
    });
}

function handleClientSort(event) {
    const newSortColumn = event.target.dataset.sortClient;
    if (state.clientSortColumn === newSortColumn) {
        state.clientSortDirection = state.clientSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        state.clientSortColumn = newSortColumn;
        state.clientSortDirection = 'asc';
    }
    renderClients();
}

function showClientDetailsModal(rowData, headers) {
    const editBtn = document.getElementById('client-modal-edit-btn');
    const saveBtn = document.getElementById('client-modal-save-btn');
    const statusSpan = document.getElementById('client-modal-status');
    const clientEmail = rowData[headers.indexOf('Email')];
    statusSpan.textContent = '';
    
    const tabButtons = clientDetailsModal.querySelectorAll('.client-tab-button');
    const tabContents = clientDetailsModal.querySelectorAll('.client-tab-content');
    tabButtons.forEach(button => {
        button.onclick = () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`client-tab-${button.dataset.tab}`).classList.add('active');
        };
    });
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    tabButtons[0].classList.add('active');
    tabContents[0].classList.add('active');


    const renderViewMode = () => {
        populateClientDetailsTab(rowData, headers, false);
        populateClientHistoryTab(clientEmail);
        populateClientNotesTab(rowData, headers, false);
        populateClientFinancialsTab(clientEmail);

        editBtn.style.display = 'inline-block';
        saveBtn.style.display = 'none';
        editBtn.onclick = renderEditMode;
    };

    const renderEditMode = () => {
        populateClientDetailsTab(rowData, headers, true);
        populateClientHistoryTab(clientEmail);
        populateClientNotesTab(rowData, headers, true);
        populateClientFinancialsTab(clientEmail);

        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
        saveBtn.onclick = handleSaveClientUpdate;
    };

    const handleSaveClientUpdate = async () => {
        statusSpan.textContent = 'Saving...';
        const dataToUpdate = {};
        let updatedRowData = [...rowData];
        
        // Dynamically get all headers that should be editable
        const readOnlyHeaders = ['ClientID', 'Original Submission ID', 'Source'];
        const editableHeaders = allClients.headers.filter(h => !readOnlyHeaders.includes(h));
        
        // Define which fields are expected on the details tab for potential creation
        const detailFields = ['First Name', 'Last Name', 'Email', 'Phone', 'Organization', 'Status', 'Social Media'];

        // Collect data from Details and Notes tabs
        [...detailFields, 'Notes', 'Contact Logs'].forEach(header => {
            const inputId = `client-edit-${header.replace(/\s+/g, '')}`;
            const inputElement = document.getElementById(inputId);
            const headerIndex = headers.indexOf(header);
            
            if (inputElement) {
                const newValue = (header === 'Contact Logs') ? JSON.stringify(JSON.parse(inputElement.value)) : inputElement.value;
                dataToUpdate[header] = newValue;
                if(headerIndex > -1) updatedRowData[headerIndex] = newValue;
            }
        });
        
        try {
            const clientId = rowData[headers.indexOf('ClientID')];
            await updateSheetRow('Clients', 'ClientID', clientId, dataToUpdate);
            
            await loadClients(); // Re-fetch to get the latest data structure
            const updatedClientRow = allClients.rows.find(r => r[allClients.headers.indexOf('ClientID')] === clientId);

            rowData = updatedClientRow || updatedRowData;
            
            statusSpan.textContent = 'Saved successfully!';
            renderClients();
            setTimeout(() => {
                renderViewMode();
                 statusSpan.textContent = '';
            }, 1500);

        } catch(err) {
            statusSpan.textContent = 'Error saving.';
            console.error('Client update error:', err);
        }
    };

    renderViewMode();
    clientDetailsModal.style.display = 'block';
}

function populateClientDetailsTab(rowData, headers, isEditMode) {
    const container = document.getElementById('client-tab-details');
    const displayHeaders = ['First Name', 'Last Name', 'Email', 'Phone', 'Organization', 'Status', 'Social Media'];
    let contentHtml = '<ul>';

    if (isEditMode) {
        displayHeaders.forEach(header => {
            const headerId = header.replace(/\s+/g, '');
            const headerIndex = headers.indexOf(header);
            const value = headerIndex > -1 ? (rowData[headerIndex] || '') : '';
            contentHtml += `<li><strong>${header}:</strong> <input type="text" id="client-edit-${headerId}" value="${value}"></li>`;
        });
    } else {
        displayHeaders.forEach(header => {
            const headerIndex = headers.indexOf(header);
            const value = headerIndex > -1 ? (rowData[headerIndex] || 'N/A') : 'N/A';
            contentHtml += `<li><strong>${header}:</strong> <span>${value}</span></li>`;
        });
    }
    contentHtml += '</ul>';
    container.innerHTML = contentHtml;
}

function populateClientHistoryTab(clientEmail) {
    const container = document.getElementById('client-tab-history');
    let contentHtml = '<h3>Service Requests</h3>';
    const reqEmailIndex = allRequests.headers.indexOf('Email');
    const clientRequests = allRequests.rows.filter(row => row[reqEmailIndex] === clientEmail);
    
    if (clientRequests.length > 0) {
        contentHtml += '<ul>';
        clientRequests.forEach(req => {
            const reqDate = req[allRequests.headers.indexOf('Submission Date')] || 'No Date';
            const reqService = req[allRequests.headers.indexOf('Primary Service Category')] || 'No Service';
            contentHtml += `<li><strong>${reqDate}:</strong> ${reqService}</li>`;
        });
        contentHtml += '</ul>';
    } else {
        contentHtml += '<p>No service requests found for this client.</p>';
    }

    contentHtml += '<h3>Projects</h3>';
    if(allProjects.headers.length > 0) {
        const projEmailIndex = allProjects.headers.indexOf('Client Email');
        const clientProjects = allProjects.rows.filter(row => row[projEmailIndex] === clientEmail);
        if (clientProjects.length > 0) {
            contentHtml += '<ul>';
            clientProjects.forEach(proj => {
                const projDate = proj[allProjects.headers.indexOf('Date')] || 'No Date';
                const projName = proj[allProjects.headers.indexOf('Project Name')] || 'No Name';
                const projStatus = proj[allProjects.headers.indexOf('Status')] || 'No Status';
                contentHtml += `<li><strong>${projDate}:</strong> ${projName} (${projStatus})</li>`;
            });
            contentHtml += '</ul>';
        } else {
            contentHtml += '<p>No projects found for this client.</p>';
        }
    } else {
        contentHtml += '<p>Project data is not available.</p>';
    }

    container.innerHTML = contentHtml;
}

function populateClientNotesTab(rowData, headers, isEditMode) {
    const container = document.getElementById('client-tab-notes');
    let contentHtml = '<h3>General Notes</h3>';
    const notesIndex = headers.indexOf('Notes');
    const logsIndex = headers.indexOf('Contact Logs');

    if (isEditMode) {
        const notes = notesIndex > -1 ? (rowData[notesIndex] || '') : '';
        contentHtml += `<textarea id="client-edit-Notes">${notes}</textarea>`;
    } else {
        const notes = notesIndex > -1 ? (rowData[notesIndex] || 'No notes for this client.') : 'No notes for this client.';
        contentHtml += `<p>${notes.replace(/\n/g, '<br>')}</p>`;
    }

    contentHtml += '<h3>Contact Logs</h3>';
    const logsJson = logsIndex > -1 ? (rowData[logsIndex] || '[]') : '[]';
    let logs = [];
    try {
        logs = JSON.parse(logsJson);
    } catch(e) {
        console.error("Could not parse contact logs", e);
    }
    
    if (logs.length > 0) {
        logs.forEach(log => {
            contentHtml += `<div class="contact-log"><small>${new Date(log.date).toLocaleString()}</small><p>${log.note}</p></div>`;
        });
    } else {
        contentHtml += '<p>No contact logs.</p>';
    }

    if (isEditMode) {
        // Hidden input to store the JSON string of logs, to be saved later
        contentHtml += `<input type="hidden" id="client-edit-ContactLogs" value='${JSON.stringify(logs)}'>`;
        contentHtml += `
            <h3>Add New Contact Log</h3>
            <textarea id="new-contact-log-entry" placeholder="Log a call, meeting, or email..."></textarea>
            <button id="add-contact-log-btn" class="modal-button">Add Log</button>
        `;
    }

    container.innerHTML = contentHtml;

    if (isEditMode) {
        document.getElementById('add-contact-log-btn').onclick = () => {
            const newNote = document.getElementById('new-contact-log-entry').value;
            if(!newNote) return;

            const newLog = { date: new Date().toISOString(), note: newNote };
            logs.unshift(newLog);
            
            document.getElementById('client-edit-ContactLogs').value = JSON.stringify(logs);
            
            // Re-render the tab to show the new log immediately
            populateClientNotesTab(rowData, headers, true); 
        };
    }
}

function populateClientFinancialsTab(clientEmail) {
    const container = document.getElementById('client-tab-financials');
    let contentHtml = '<h3>Year-to-Date Income</h3>';

    if (allProjects.headers.length > 0) {
        const projEmailIndex = allProjects.headers.indexOf('Client Email');
        const projValueIndex = allProjects.headers.indexOf('Value');
        const projDateIndex = allProjects.headers.indexOf('Date');
        const currentYear = new Date().getFullYear();
        let ytdIncome = 0;

        allProjects.rows.forEach(row => {
            if (!row[projDateIndex]) return;
            const rowYear = new Date(row[projDateIndex]).getFullYear();
            if (row[projEmailIndex] === clientEmail && rowYear === currentYear) {
                const value = parseFloat(row[projValueIndex]);
                if (!isNaN(value)) {
                    ytdIncome += value;
                }
            }
        });
        contentHtml += `<h2>$${ytdIncome.toFixed(2)}</h2>`;

    } else {
        contentHtml += '<p>Project data is not available to calculate income.</p>';
    }
    container.innerHTML = contentHtml;
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
        setTimeout(() => { statusDiv.textContent = ''; }, 3000);
    } catch (err) {
        statusDiv.textContent = `Error: ${err.result.error.message}`;
    }
}

// --- UTILITY & GENERIC DATA FUNCTIONS ---
function columnToLetter(column) {
    let temp, letter = '';
    while (column > 0) {
        temp = (column - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        column = (column - temp - 1) / 26;
    }
    return letter;
}

async function updateSheetRow(sheetName, idColumnName, idValue, dataToUpdate) {
    let sheetResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: sheetName,
    });
    
    let sheetValues = sheetResponse.result.values || [[]];
    let sheetHeaders = sheetValues[0] || [];

    const newHeaders = Object.keys(dataToUpdate).filter(h => !sheetHeaders.includes(h));
    if (newHeaders.length > 0) {
        const firstEmptyColumn = columnToLetter(sheetHeaders.length + 1);
        const newHeadersRange = `${sheetName}!${firstEmptyColumn}1`;
        
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: newHeadersRange,
            valueInputOption: 'RAW',
            resource: { values: [newHeaders] }
        });

        // Re-fetch after adding new headers
        sheetResponse = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID, range: sheetName,
        });
        sheetValues = sheetResponse.result.values || [[]];
        sheetHeaders = sheetValues[0] || [];
    }
    
    const idIndex = sheetHeaders.indexOf(idColumnName);
    if (idIndex === -1) throw new Error(`Unique ID column '${idColumnName}' not found.`);
    
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
        resource: { values: [updatedRow] }
    });
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

