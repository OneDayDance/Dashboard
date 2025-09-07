// --- CONFIGURATION ---
const CLIENT_ID = "555797317893-ce2nrrf49e5dol0c6lurln0c3it76c2r.apps.googleusercontent.com";
const SPREADSHEET_ID = "1G3kVQdR0yd1j362oZKYRXMby1Ve6PVcY8CrsQnuxVfY";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
// --- END OF CONFIGURATION ---

// --- STATE MANAGEMENT ---
let allRequests = { headers: [], rows: [] };
let allClients = { headers: [], rows: [] };
let allProjects = { headers: [], rows: [] };
let allTasks = { headers: [], rows: [] };
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
    clientSortDirection: 'asc',
    clientCurrentView: 'list',
    visibleClientColumns: ['First Name', 'Last Name', 'Email', 'Organization', 'Status'],
    clientFilters: { status: 'all' },
    // projects tab state
    selectedProjectId: null,
    projectTaskView: 'list' // 'list' or 'board'
};
const sortableColumns = ['Submission Date', 'Full Name', 'Email', 'Organization', 'Primary Service Category', 'Status'];
const clientSortableColumns = ['First Name', 'Last Name', 'Email', 'Organization', 'Status'];


// --- DOM ELEMENTS ---
let tokenClient, gapiInited = false, gisInited = false;
let authorizeButton, signoutButton, appContainer, addClientForm, serviceFilter, statusFilter, searchBar, detailsModal, columnModal, closeModalButtons, listViewBtn, cardViewBtn, modalSaveNoteBtn, archiveToggle, archiveContainer, columnSelectBtn, saveColumnsBtn, landingContainer, clientSearchBar, clientTableContainer, clientDetailsModal, clientStatusFilter, clientListViewBtn, clientCardViewBtn, clientColumnSelectBtn, clientColumnModal, createProjectModal, deleteClientModal, taskDetailsModal;
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
    createProjectModal = document.getElementById('create-project-modal');
    taskDetailsModal = document.getElementById('task-details-modal');
    deleteClientModal = document.getElementById('delete-client-modal');
    clientColumnModal = document.getElementById('client-column-modal');
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
    clientStatusFilter = document.getElementById('client-status-filter');
    clientListViewBtn = document.getElementById('client-list-view-btn');
    clientCardViewBtn = document.getElementById('client-card-view-btn');
    clientColumnSelectBtn = document.getElementById('client-column-select-btn');

    // Assign event listeners
    authorizeButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
    addClientForm.addEventListener('submit', handleAddClientSubmit);
    serviceFilter.onchange = (e) => updateFilter('service', e.target.value);
    statusFilter.onchange = (e) => updateFilter('status', e.target.value);
    searchBar.oninput = (e) => updateSearch(e.target.value);
    clientSearchBar.oninput = (e) => updateClientSearch(e.target.value);
    clientStatusFilter.onchange = (e) => updateClientFilter('status', e.target.value);
    
    window.onclick = (event) => { 
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
    closeModalButtons.forEach(btn => btn.onclick = () => btn.closest('.modal').style.display = 'none');
    
    listViewBtn.onclick = () => setView('list');
    cardViewBtn.onclick = () => setView('card');
    columnSelectBtn.onclick = () => showColumnModal('requests');
    saveColumnsBtn.onclick = () => handleSaveColumns('requests');

    clientListViewBtn.onclick = () => setClientView('list');
    clientCardViewBtn.onclick = () => setClientView('card');
    clientColumnSelectBtn.onclick = () => showColumnModal('clients');
    document.getElementById('save-client-columns-btn').onclick = () => handleSaveColumns('clients');
    
    archiveToggle.onclick = (e) => e.currentTarget.classList.toggle('collapsed');
    document.getElementById('archived-projects-toggle').onclick = (e) => {
        e.currentTarget.classList.toggle('collapsed');
        document.getElementById('archived-projects-list').classList.toggle('collapsed');
    };
    document.getElementById('create-project-form').addEventListener('submit', handleCreateProjectSubmit);
    document.getElementById('task-details-form').addEventListener('submit', handleSaveTask);
    document.getElementById('project-list-collapse-btn').onclick = () => {
        document.getElementById('project-layout-container').classList.toggle('collapsed');
        document.querySelector('.project-list-column').classList.toggle('collapsed');
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
        client_id: CLIENT_ID, scope: SCOPES,
        callback: async (tokenResponse) => {
            if (tokenResponse.error) { console.warn('Token response error:', tokenResponse.error); return; }
            await onSignInSuccess();
        },
    });
    gisInited = true; checkLibsLoaded();
}
async function initializeGapiClient() {
    await gapi.client.init({});
    await gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4');
    gapiInited = true; checkLibsLoaded();
}
function attemptSilentSignIn() {
    if (!silentAuthAttempted) { silentAuthAttempted = true; tokenClient.requestAccessToken({ prompt: '' }); }
}
async function onSignInSuccess() {
    landingContainer.style.display = 'none';
    appContainer.style.display = 'block';
    setupTabs();
    await loadInitialData();
    loadDataForActiveTab();
}
async function loadInitialData() { await Promise.all([loadRequests(), loadClients(), loadProjects(), loadTasks()]); }
function handleAuthClick() { tokenClient.requestAccessToken({ prompt: 'consent' }); }
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
            tabContents.forEach(content => content.style.display = (content.id === `tab-${tabId}`) ? 'block' : 'none');
            loadDataForActiveTab();
        });
    });
}
function loadDataForActiveTab() {
    const activeTab = document.querySelector('.tab-button.active').dataset.tab;
    switch (activeTab) {
        case 'requests': renderRequests(); break;
        case 'clients': renderClients(); break;
        case 'projects': renderProjectsTab(); break;
    }
}
function updateFilter(key, value) { state.filters[key] = value; renderRequests(); }
function updateSearch(term) { state.searchTerm = term.toLowerCase(); renderRequests(); }
function updateClientFilter(key, value) { state.clientFilters[key] = value; renderClients(); }
function updateClientSearch(term) { state.clientSearchTerm = term.toLowerCase(); renderClients(); }
function setView(view) {
    state.currentView = view;
    listViewBtn.classList.toggle('active', view === 'list');
    cardViewBtn.classList.toggle('active', view === 'card');
    renderRequests();
}
function setClientView(view) {
    state.clientCurrentView = view;
    clientListViewBtn.classList.toggle('active', view === 'list');
    clientCardViewBtn.classList.toggle('active', view === 'card');
    renderClients();
}
function showColumnModal(type) {
    if (type === 'requests') {
        populateColumnSelector(allRequests.headers, state.visibleColumns, 'column-checkboxes');
        columnModal.style.display = 'block';
    } else {
        populateColumnSelector(allClients.headers.filter(h => h), state.visibleClientColumns, 'client-column-checkboxes');
        clientColumnModal.style.display = 'block';
    }
}
function handleSaveColumns(type) {
    if (type === 'requests') {
        state.visibleColumns = Array.from(document.querySelectorAll('#column-checkboxes input:checked')).map(cb => cb.value);
        columnModal.style.display = 'none';
        renderRequests();
    } else {
        state.visibleClientColumns = Array.from(document.querySelectorAll('#client-column-checkboxes input:checked')).map(cb => cb.value);
        clientColumnModal.style.display = 'none';
        renderClients();
    }
}

// --- REQUESTS TAB FUNCTIONS ---
async function loadRequests() {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Submissions' });
        const values = response.result.values;
        if (values && values.length > 1) {
            allRequests = { headers: values[0], rows: values.slice(1) };
            populateServiceFilter();
        } else { allRequests = { headers: [], rows: [] }; }
    } catch (err) { console.error("Error loading requests:", err); document.getElementById('requests-container').innerHTML = `<p style="color:red;">Error loading requests.</p>`; }
}
function renderRequests() {
    if (!allRequests.rows || allRequests.rows.length === 0) {
        document.getElementById('requests-container').innerHTML = '<p>No submissions found.</p>';
        document.getElementById('archived-requests-container').innerHTML = '';
        return;
    }
    let { headers, rows } = allRequests;
    let processedRows = [...rows];
    if (state.searchTerm) processedRows = processedRows.filter(row => row.some(cell => String(cell).toLowerCase().includes(state.searchTerm)));
    if (state.filters.service !== 'all') {
        const serviceIndex = headers.indexOf('Primary Service Category');
        processedRows = processedRows.filter(row => row[serviceIndex] === state.filters.service);
    }
    const sortIndex = headers.indexOf(state.sortColumn);
    if (sortIndex > -1) {
        processedRows.sort((a, b) => {
            let valA = a[sortIndex] || '', valB = b[sortIndex] || '';
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
            if (isArchived) archivedRequests.push(row); else newRequests.push(row);
        } else if (state.filters.status === 'archived' && isArchived) { archivedRequests.push(row); } 
        else if (state.filters.status === 'new' && !isArchived) { newRequests.push(row); }
    });
    const renderFn = state.currentView === 'list' ? renderRequestsAsList : renderRequestsAsCards;
    renderFn(newRequests, document.getElementById('requests-container'));
    renderFn(archivedRequests, document.getElementById('archived-requests-container'));
}
function renderRequestsAsList(requestRows, container) {
    container.innerHTML = '';
    if (requestRows.length === 0) { container.innerHTML = `<p>No submissions to display.</p>`; return; }
    const { headers } = allRequests;
    const table = document.createElement('table'); table.className = 'data-table';
    let headerHtml = '<thead><tr>';
    state.visibleColumns.forEach(headerText => {
        let classes = '';
        if (sortableColumns.includes(headerText)) {
            classes += 'sortable';
            if (state.sortColumn === headerText) classes += state.sortDirection === 'asc' ? ' sorted-asc' : ' sorted-desc';
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
                    statusSelect.add(new Option(status, status, false, status === currentStatus));
                });
                statusSelect.onclick = (e) => e.stopPropagation();
                statusSelect.onchange = (e) => handleStatusChange(e, originalIndex);
                td.appendChild(statusSelect);
            } else { td.textContent = row[cellIndex] || ''; }
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
    if (requestRows.length === 0) { container.innerHTML = `<p>No submissions to display.</p>`; return; }
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
            if (headerText === "Full Name") cardContent += `<h3>${row[cellIndex] || 'No Name'}</h3>`;
            else if (headerText !== "Status") cardContent += `<p><strong>${headerText}:</strong> ${row[cellIndex] || 'N/A'}</p>`;
        });
        card.innerHTML = cardContent;
        const statusIndex = headers.indexOf('Status');
        const statusSelect = document.createElement('select');
        statusSelect.dataset.rowIndex = originalIndex;
        const currentStatus = row[statusIndex] || 'New';
        ['New', 'Contacted', 'Archived'].forEach(status => {
            statusSelect.add(new Option(status, status, false, status === currentStatus));
        });
        statusSelect.onclick = (e) => e.stopPropagation();
        statusSelect.onchange = (e) => handleStatusChange(e, originalIndex);
        card.appendChild(statusSelect);
        cardContainer.appendChild(card);
    });
    container.appendChild(cardContainer);
}
async function handleStatusChange(event, rowIndex) {
    const newStatus = event.target.value; event.target.disabled = true;
    try {
        const submissionId = allRequests.rows[rowIndex][allRequests.headers.indexOf('Submission ID')];
        await updateSheetRow('Submissions', 'Submission ID', submissionId, { 'Status': newStatus });
        allRequests.rows[rowIndex][allRequests.headers.indexOf('Status')] = newStatus;
        renderRequests();
    } catch(err) { alert('Could not update status.'); console.error("Status Update Error:", err); event.target.disabled = false; }
}
function showRequestDetailsModal(rowData, headers) {
    const modalBody = document.getElementById('modal-body');
    const ignoredFields = ['Raw Payload', 'All Services JSON', 'Submission ID', 'Timestamp', 'Notes'];
    let contentHtml = '<ul>';
    headers.forEach((header, index) => {
        if (rowData[index] && !ignoredFields.includes(header)) contentHtml += `<li><strong>${header}:</strong> ${rowData[index]}</li>`;
    });
    modalBody.innerHTML = contentHtml + '</ul>';
    const notesTextarea = document.getElementById('modal-notes-textarea');
    const noteStatus = document.getElementById('modal-note-status');
    const originalIndex = allRequests.rows.indexOf(rowData);
    noteStatus.textContent = ''; notesTextarea.value = rowData[headers.indexOf('Notes')] || '';
    modalSaveNoteBtn.onclick = () => handleSaveNote(originalIndex);
    const createClientBtn = document.getElementById('modal-create-client-btn');
    const clientStatus = document.getElementById('modal-client-status');
    const submissionEmail = rowData[headers.indexOf('Email')];
    if (!submissionEmail) { createClientBtn.disabled = true; clientStatus.textContent = "No email in submission."; } 
    else {
        const clientExists = allClients.rows.some(r => r[allClients.headers.indexOf('Email')] === submissionEmail);
        if(clientExists) { createClientBtn.disabled = true; clientStatus.textContent = "Client with this email already exists."; } 
        else {
            createClientBtn.disabled = false; clientStatus.textContent = "";
            createClientBtn.onclick = () => handleCreateClient(rowData, headers);
        }
    }
    detailsModal.style.display = 'block';
}
async function handleCreateClient(submissionRow, submissionHeaders) {
    const createClientBtn = document.getElementById('modal-create-client-btn');
    const clientStatus = document.getElementById('modal-client-status');
    createClientBtn.disabled = true; clientStatus.textContent = 'Creating client...';
    const fullName = submissionRow[submissionHeaders.indexOf('Full Name')] || '';
    const nameParts = fullName.split(' ');
    const clientData = {
        'First Name': nameParts[0], 'Last Name': nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
        'Email': submissionRow[submissionHeaders.indexOf('Email')] || '', 'Phone': submissionRow[submissionHeaders.indexOf('Phone')] || '',
        'Organization': submissionRow[submissionHeaders.indexOf('Organization')] || '', 'Status': 'Active', 'ClientID': `C-${Date.now()}`,
        'Source': 'Submission', 'Original Submission ID': submissionRow[submissionHeaders.indexOf('Submission ID')] || ''
    };
    try {
        await writeData('Clients', clientData);
        clientStatus.textContent = 'Client created successfully!';
        await loadClients(); renderClients();
    } catch (err) { clientStatus.textContent = `Error: ${err.result.error.message}`; createClientBtn.disabled = false; }
}
function handleSort(event) {
    const newSortColumn = event.target.dataset.sort;
    if (state.sortColumn === newSortColumn) { state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc'; } 
    else { state.sortColumn = newSortColumn; state.sortDirection = 'asc'; }
    renderRequests();
}
async function handleSaveNote(rowIndex) {
    const noteStatus = document.getElementById('modal-note-status');
    noteStatus.textContent = 'Saving...';
    const dataToUpdate = { 'Notes': document.getElementById('modal-notes-textarea').value };
    try {
        const submissionId = allRequests.rows[rowIndex][allRequests.headers.indexOf('Submission ID')];
        await updateSheetRow('Submissions', 'Submission ID', submissionId, dataToUpdate);
        allRequests.rows[rowIndex][allRequests.headers.indexOf('Notes')] = dataToUpdate.Notes;
        noteStatus.textContent = 'Saved successfully!';
    } catch (err) { noteStatus.textContent = 'Error saving note.'; console.error("Save Note Error:", err); }
}

// --- PROJECTS & TASKS ---
async function loadProjects() {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Projects' });
        const values = response.result.values;
        if (values && values.length > 1) { allProjects = { headers: values[0], rows: values.slice(1) }; } 
        else { allProjects = { headers: [], rows: [] }; }
    } catch (err) { console.warn("Could not load 'Projects' sheet.", err); allProjects = { headers: [], rows: [] }; }
}
async function loadTasks() {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Tasks' });
        const values = response.result.values;
        if (values && values.length > 1) { allTasks = { headers: values[0], rows: values.slice(1) }; } 
        else { allTasks = { headers: [], rows: [] }; }
    } catch (err) { console.warn("Could not load 'Tasks' sheet.", err); allTasks = { headers: [], rows: [] }; }
}
function renderProjectsTab() {
    const activeList = document.getElementById('active-projects-list'), archivedList = document.getElementById('archived-projects-list'), detailsColumn = document.getElementById('project-details-column');
    activeList.innerHTML = ''; archivedList.innerHTML = '';
    const archivedStatuses = ['Completed', 'Cancelled', 'Archived'];
    const { headers, rows } = allProjects;
    const [statusIndex, nameIndex, clientEmailIndex, projectIdIndex] = ['Status', 'Project Name', 'Client Email', 'ProjectID'].map(h => headers.indexOf(h));
    if ([statusIndex, nameIndex, clientEmailIndex, projectIdIndex].includes(-1)) { activeList.innerHTML = '<p>Project sheet is missing required columns.</p>'; detailsColumn.innerHTML = ''; return; }
    rows.forEach(proj => {
        const isArchived = archivedStatuses.includes(proj[statusIndex]);
        const targetList = isArchived ? archivedList : activeList;
        const client = allClients.rows.find(c => c[allClients.headers.indexOf('Email')] === proj[clientEmailIndex]);
        const clientName = client ? `${client[allClients.headers.indexOf('First Name')]} ${client[allClients.headers.indexOf('Last Name')]}` : 'Unknown Client';
        const item = document.createElement('div');
        item.className = 'project-list-item'; item.dataset.projectId = proj[projectIdIndex];
        item.innerHTML = `<h4>${proj[nameIndex]}</h4><p>${clientName}</p>`;
        item.onclick = () => {
            document.querySelectorAll('.project-list-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            state.selectedProjectId = item.dataset.projectId;
            showProjectDetails(item.dataset.projectId);
        };
        targetList.appendChild(item);
    });
    if (state.selectedProjectId) {
        const item = document.querySelector(`.project-list-item[data-project-id="${state.selectedProjectId}"]`);
        if (item) { item.classList.add('active'); showProjectDetails(state.selectedProjectId); } 
        else { state.selectedProjectId = null; detailsColumn.innerHTML = '<p>Select a project to view its details.</p>'; }
    } else { detailsColumn.innerHTML = '<p>Select a project to view its details.</p>'; }
}
function showProjectDetails(projectId, isEditMode = false) {
    const detailsColumn = document.getElementById('project-details-column');
    const project = allProjects.rows.find(p => p[allProjects.headers.indexOf('ProjectID')] === projectId);
    if (!project) { detailsColumn.innerHTML = '<p>Could not find project details.</p>'; return; }
    const { headers } = allProjects;
    let detailsHtml = `<h3>${isEditMode ? `<input type="text" id="project-edit-ProjectName" value="${project[headers.indexOf('Project Name')]}">` : project[headers.indexOf('Project Name')]}</h3>`;
    detailsHtml += renderGenericProjectDetails(project, headers, isEditMode);
    detailsHtml += `<div class="modal-footer"><button id="project-edit-btn">Edit</button><button id="project-save-btn" style="display:none;">Save</button></div>`;
    detailsColumn.innerHTML = detailsHtml;
    document.getElementById('project-edit-btn').style.display = isEditMode ? 'none' : 'inline-block';
    document.getElementById('project-save-btn').style.display = isEditMode ? 'inline-block' : 'none';
    document.getElementById('project-edit-btn').onclick = () => showProjectDetails(projectId, true);
    document.getElementById('project-save-btn').onclick = () => handleSaveProjectUpdate(projectId);
    detailsColumn.querySelectorAll('.collapsible-header').forEach(header => header.onclick = () => {
        header.classList.toggle('collapsed');
        header.nextElementSibling.classList.toggle('collapsed');
    });
    detailsColumn.querySelectorAll('.task-item, .task-card').forEach(el => el.onclick = (e) => {
        const taskId = e.currentTarget.dataset.taskId;
        if(e.target.type === 'checkbox') { handleTaskStatusChange(taskId, e.target.checked); } 
        else { showTaskModal(projectId, taskId); }
    });
    detailsColumn.querySelector('#add-task-form button').onclick = (e) => { e.preventDefault(); showTaskModal(projectId); };
    document.getElementById('task-view-toggle').onclick = () => {
        state.projectTaskView = state.projectTaskView === 'list' ? 'board' : 'list';
        showProjectDetails(projectId, isEditMode);
    };
    document.getElementById('add-bucket-btn').onclick = () => {
        const bucketName = prompt("Enter new bucket name:");
        if (bucketName) {
            const taskList = document.getElementById('project-task-list');
            if (taskList) { // list view
                const bucketDiv = document.createElement('div');
                bucketDiv.className = 'task-bucket';
                bucketDiv.innerHTML = `<h5>${bucketName}</h5>`;
                taskList.appendChild(bucketDiv);
            } else { // board view
                const board = document.getElementById('project-task-board');
                const column = document.createElement('div');
                column.className = 'task-board-column';
                column.innerHTML = `<h5>${bucketName}</h5>`;
                board.appendChild(column);
            }
        }
    };
    const clientLink = detailsColumn.querySelector('.project-client-card a');
    if (clientLink) clientLink.onclick = () => {
        const client = allClients.rows.find(c => c[allClients.headers.indexOf('Email')] === clientLink.dataset.clientEmail);
        if (client) showClientDetailsModal(client, allClients.headers);
    };
    const sourceReqLink = detailsColumn.querySelector('.source-request-link');
    if(sourceReqLink) sourceReqLink.onclick = () => {
        const req = allRequests.rows.find(r => r[allRequests.headers.indexOf('Submission ID')] === sourceReqLink.dataset.reqId);
        if (req) showRequestDetailsModal(req, allRequests.headers);
    };
}
function renderGenericProjectDetails(data, headers, isEditMode) {
    const clientEmail = data[headers.indexOf('Client Email')];
    const client = allClients.rows.find(c => c[allClients.headers.indexOf('Email')] === clientEmail);
    const clientName = client ? `${client[allClients.headers.indexOf('First Name')]} ${client[allClients.headers.indexOf('Last Name')]}` : 'Unknown Client';
    const coreDetails = ['Status', 'Start Date', 'Value'];
    const personnelDetails = ['Service Provider', 'Location'];
    let html = `<div class="project-client-card"><h4>Client</h4><a href="#" data-client-email="${clientEmail}">${clientName}</a></div>
    <div class="project-details-grid">
        <div class="project-details-section"><h4>Core Details</h4><ul>`;
    coreDetails.forEach(h => {
        const val = data[headers.indexOf(h)] || '';
        html += `<li><strong>${h}:</strong> ${isEditMode ? `<input type="text" id="project-edit-${h.replace(/\s+/g, '')}" value="${val}">` : val}</li>`;
    });
    html += `</ul></div><div class="project-details-section"><h4>Personnel & Location</h4><ul>`;
    personnelDetails.forEach(h => {
        const val = data[headers.indexOf(h)] || '';
        html += `<li><strong>${h}:</strong> ${isEditMode ? `<input type="text" id="project-edit-${h.replace(/\s+/g, '')}" value="${val}">` : val}</li>`;
    });
    html += `</ul></div></div>
    ${renderTasksSection(data[headers.indexOf('ProjectID')])}
    ${renderAdvancedDetails(data, headers)}`;
    return html;
}
function renderTasksSection(projectId) {
    const renderFn = state.projectTaskView === 'list' ? renderTasksAsList : renderTasksAsBoard;
    let html = `<div class="project-details-section">
        <div class="project-details-section-header">
            <h4>Tasks</h4>
            <div class="view-controls">
                <button id="add-bucket-btn">+</button>
                <button id="task-view-toggle">${state.projectTaskView === 'list' ? 'Board' : 'List'} View</button>
            </div>
        </div>
        ${renderFn(projectId)}
        <form id="add-task-form">
            <input type="text" id="new-task-name" placeholder="Add a new task..." required>
            <button type="submit">Add</button>
        </form>
    </div>`;
    return html;
}
function renderTasksAsList(projectId) {
    let html = `<div id="project-task-list">`;
    const { headers, rows } = allTasks, [idIdx, nameIdx, statusIdx, bucketIdx] = ['TaskID', 'Task Name', 'Status', 'Bucket'].map(h => headers.indexOf(h));
    const projectTasks = rows.filter(t => t[headers.indexOf('ProjectID')] === projectId);
    const buckets = [...new Set(projectTasks.map(t => t[bucketIdx] || 'General'))];
    buckets.forEach(bucket => {
        html += `<div class="task-bucket"><h5>${bucket}</h5>`;
        projectTasks.filter(t => (t[bucketIdx] || 'General') === bucket).forEach(task => {
            const isCompleted = task[statusIdx] === 'Done';
            html += `<div class="task-item ${isCompleted ? 'completed' : ''}" data-task-id="${task[idIdx]}"><input type="checkbox" ${isCompleted ? 'checked' : ''}><label>${task[nameIdx]}</label></div>`;
        });
        html += `</div>`;
    });
    return html + `</div>`;
}
function renderTasksAsBoard(projectId) {
    let html = `<div id="project-task-board" class="task-board">`;
    const { headers, rows } = allTasks, [idIdx, nameIdx, statusIdx, bucketIdx] = ['TaskID', 'Task Name', 'Status', 'Bucket'].map(h => headers.indexOf(h));
    const projectTasks = rows.filter(t => t[headers.indexOf('ProjectID')] === projectId);
    const buckets = [...new Set(projectTasks.map(t => t[bucketIdx] || 'General'))];
    buckets.forEach(bucket => {
        html += `<div class="task-board-column"><h5>${bucket}</h5>`;
        projectTasks.filter(t => (t[bucketIdx] || 'General') === bucket).forEach(task => {
            html += `<div class="task-card" data-task-id="${task[idIdx]}"><p>${task[nameIdx]}</p></div>`;
        });
        html += `</div>`;
    });
    return html + `</div>`;
}
function renderAdvancedDetails(data, headers) {
    const reqId = data[headers.indexOf('Source Request ID')];
    return `<div class="project-details-section collapsible-header collapsed"><h4>Advanced Details</h4><span class="toggle-arrow">&#9662;</span></div>
    <div class="collapsible-content collapsed"><ul>
        <li><strong>ProjectID:</strong> ${data[headers.indexOf('ProjectID')]}</li>
        <li><strong>Source Request ID:</strong> ${reqId ? `<a href="#" class="source-request-link" data-req-id="${reqId}">${reqId}</a>` : 'N/A'}</li>
    </ul></div>`;
}
async function handleSaveProjectUpdate(projectId) {
    const btn = document.getElementById('project-save-btn');
    btn.textContent = 'Saving...'; btn.disabled = true;
    const dataToUpdate = {};
    ['Project Name', 'Status', 'Start Date', 'Value', 'Service Provider', 'Location'].forEach(h => {
        const input = document.getElementById(`project-edit-${h.replace(/\s+/g, '')}`);
        if(input) dataToUpdate[h] = input.value;
    });
    try {
        await updateSheetRow('Projects', 'ProjectID', projectId, dataToUpdate);
        await loadProjects();
        renderProjectsTab();
    } catch(err) { console.error('Project update error', err); alert('Could not save project updates.'); btn.textContent = 'Save'; btn.disabled = false; }
}
async function handleCreateProjectSubmit(event) {
    event.preventDefault();
    const statusSpan = document.getElementById('create-project-status');
    statusSpan.textContent = 'Creating project...';
    const sourceRequestSelect = document.getElementById('project-source-request');
    const projectData = {
        'Project Name': document.getElementById('project-name').value, 'Client Email': sourceRequestSelect.dataset.clientEmail,
        'Status': document.getElementById('project-status').value, 'Value': document.getElementById('project-value').value,
        'Start Date': document.getElementById('project-start-date').value, 'ProjectID': `P-${Date.now()}`,
        'Source Request ID': sourceRequestSelect.value, 'Project Type': document.getElementById('project-type').value
    };
    try {
        await writeData('Projects', projectData);
        if (projectData['Source Request ID']) {
            await updateSheetRow('Submissions', 'Submission ID', projectData['Source Request ID'], { 'Status': 'Archived' });
            await loadRequests();
            if (document.querySelector('.tab-button[data-tab="requests"]').classList.contains('active')) renderRequests();
        }
        await loadProjects();
        statusSpan.textContent = 'Project created!';
        setTimeout(() => {
            createProjectModal.style.display = 'none';
            document.querySelector('.tab-button[data-tab="projects"]').click();
        }, 1500);
    } catch (err) { statusSpan.textContent = 'Error creating project.'; console.error('Project creation error', err); }
}
function showTaskModal(projectId, taskId = null) {
    const form = document.getElementById('task-details-form');
    form.reset();
    document.getElementById('task-project-id-input').value = projectId;
    document.getElementById('task-modal-status').textContent = '';
    const { headers, rows } = allTasks;
    const projectTasks = rows.filter(t => t[headers.indexOf('ProjectID')] === projectId);
    const buckets = [...new Set(projectTasks.map(t => t[headers.indexOf('Bucket')] || 'General'))];
    const bucketSelect = document.getElementById('task-bucket');
    bucketSelect.innerHTML = '';
    buckets.forEach(b => bucketSelect.add(new Option(b, b)));

    if (taskId) {
        document.getElementById('task-modal-title').textContent = 'Edit Task';
        document.getElementById('task-id-input').value = taskId;
        const task = allTasks.rows.find(t => t[allTasks.headers.indexOf('TaskID')] === taskId);
        if(task) {
            document.getElementById('task-title').value = task[headers.indexOf('Task Name')] || '';
            document.getElementById('task-description').value = task[headers.indexOf('Description')] || '';
            document.getElementById('task-due-date').value = task[headers.indexOf('Due Date')] || '';
            document.getElementById('task-assignee').value = task[headers.indexOf('Assignee')] || '';
            document.getElementById('task-status').value = task[headers.indexOf('Status')] || 'To Do';
            bucketSelect.value = task[headers.indexOf('Bucket')] || 'General';
            renderSubtasks(JSON.parse(task[headers.indexOf('Subtasks')] || '[]'));
            renderLinks(JSON.parse(task[headers.indexOf('Links')] || '[]'));
        }
    } else {
        document.getElementById('task-modal-title').textContent = 'New Task';
        const newTaskName = document.getElementById('new-task-name')?.value;
        if(newTaskName) document.getElementById('task-title').value = newTaskName;
        renderSubtasks([]); renderLinks([]);
    }
    document.getElementById('add-subtask-btn').onclick = () => {
        const name = document.getElementById('new-subtask-name').value; if(!name) return;
        const subtasks = JSON.parse(document.getElementById('subtasks-data').value);
        subtasks.push({ name, completed: false });
        renderSubtasks(subtasks);
        document.getElementById('new-subtask-name').value = '';
    };
    document.getElementById('add-link-btn').onclick = () => {
        const url = document.getElementById('new-link-url').value; if(!url) return;
        const links = JSON.parse(document.getElementById('links-data').value);
        links.push(url);
        renderLinks(links);
        document.getElementById('new-link-url').value = '';
    };
    taskDetailsModal.style.display = 'block';
}
function renderSubtasks(subtasks) {
    const container = document.getElementById('subtasks-container');
    container.innerHTML = `<input type="hidden" id="subtasks-data" value='${JSON.stringify(subtasks)}'>`;
    subtasks.forEach((sub, i) => {
        container.innerHTML += `<div class="item-tag"><input type="checkbox" ${sub.completed ? 'checked' : ''} onchange="updateSubtaskStatus(${i}, this.checked)"> ${sub.name} <button onclick="removeSubtask(${i})">&times;</button></div>`;
    });
}
function updateSubtaskStatus(index, completed) {
    const subtasks = JSON.parse(document.getElementById('subtasks-data').value);
    subtasks[index].completed = completed;
    renderSubtasks(subtasks);
}
function removeSubtask(index) {
    const subtasks = JSON.parse(document.getElementById('subtasks-data').value);
    subtasks.splice(index, 1);
    renderSubtasks(subtasks);
}
function renderLinks(links) {
    const container = document.getElementById('links-container');
    container.innerHTML = `<input type="hidden" id="links-data" value='${JSON.stringify(links)}'>`;
    links.forEach((link, i) => {
        container.innerHTML += `<div class="item-tag"><a href="${link}" target="_blank">${link}</a> <button onclick="removeLink(${i})">&times;</button></div>`;
    });
}
function removeLink(index) {
    const links = JSON.parse(document.getElementById('links-data').value);
    links.splice(index, 1);
    renderLinks(links);
}
async function handleSaveTask(event) {
    event.preventDefault();
    const statusSpan = document.getElementById('task-modal-status');
    statusSpan.textContent = 'Saving...';
    const taskId = document.getElementById('task-id-input').value;
    const taskData = {
        'ProjectID': document.getElementById('task-project-id-input').value,
        'Task Name': document.getElementById('task-title').value,
        'Description': document.getElementById('task-description').value,
        'Due Date': document.getElementById('task-due-date').value,
        'Assignee': document.getElementById('task-assignee').value,
        'Status': document.getElementById('task-status').value,
        'Bucket': document.getElementById('task-bucket').value || 'General',
        'Subtasks': document.getElementById('subtasks-data').value,
        'Links': document.getElementById('links-data').value
    };
    try {
        if (taskId) await updateSheetRow('Tasks', 'TaskID', taskId, taskData);
        else { taskData.TaskID = `T-${Date.now()}`; await writeData('Tasks', taskData); }
        await loadTasks();
        showProjectDetails(taskData.ProjectID);
        statusSpan.textContent = 'Saved!';
        setTimeout(() => { taskDetailsModal.style.display = 'none'; }, 1000);
    } catch (err) { statusSpan.textContent = 'Error saving task.'; console.error('Task save error', err); }
}
async function handleTaskStatusChange(taskId, isChecked) {
    const newStatus = isChecked ? 'Done' : 'To Do';
    try {
        await updateSheetRow('Tasks', 'TaskID', taskId, { 'Status': newStatus });
        await loadTasks();
        const task = allTasks.rows.find(t => t[allTasks.headers.indexOf('TaskID')] === taskId);
        const projectId = task ? task[allTasks.headers.indexOf('ProjectID')] : state.selectedProjectId;
        if(projectId) showProjectDetails(projectId);
    } catch(err) { console.error('Task status update error', err); alert('Could not update task status.'); }
}

// --- CLIENTS TAB FUNCTIONS ---
async function loadClients() {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Clients' });
        const values = response.result.values;
        if (!values || values.length < 1) { allClients = { headers: [], rows: [] }; } 
        else { allClients = { headers: values[0], rows: values.slice(1) }; }
    } catch (err) { console.error("Error loading clients:", err); document.getElementById('client-table-container').innerHTML = `<p style="color:red;">Error loading clients.</p>`; }
}
function renderClients() {
    const renderFn = state.clientCurrentView === 'list' ? renderClientsAsList : renderClientsAsCards;
    renderFn();
}
function getProcessedClients() {
    if (!allClients.rows || allClients.rows.length === 0) return [];
    let { headers, rows } = allClients; let processedRows = [...rows];
    if (state.clientSearchTerm) processedRows = processedRows.filter(row => row.some(cell => String(cell).toLowerCase().includes(state.clientSearchTerm)));
    if (state.clientFilters.status !== 'all') {
        const statusIndex = headers.indexOf('Status');
        if (statusIndex > -1) processedRows = processedRows.filter(row => row[statusIndex] === state.clientFilters.status);
    }
    const sortIndex = headers.indexOf(state.clientSortColumn);
    if (sortIndex > -1) {
        processedRows.sort((a, b) => {
            let valA = a[sortIndex] || '', valB = b[sortIndex] || '';
            if (valA < valB) return state.clientSortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return state.clientSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }
    return processedRows;
}
function renderClientsAsList() {
    clientTableContainer.innerHTML = '';
    const processedRows = getProcessedClients();
    if (processedRows.length === 0) { clientTableContainer.innerHTML = '<p>No clients found.</p>'; return; }
    const { headers } = allClients;
    const table = document.createElement('table'); table.className = 'data-table';
    let headerHtml = '<thead><tr>';
    state.visibleClientColumns.forEach(headerText => {
        let classes = '';
        if (clientSortableColumns.includes(headerText)) {
            classes += 'sortable';
            if (state.clientSortColumn === headerText) classes += state.clientSortDirection === 'asc' ? ' sorted-asc' : ' sorted-desc';
        }
        headerHtml += `<th class="${classes}" data-sort-client="${headerText}">${headerText}</th>`;
    });
    table.innerHTML = headerHtml + '</tr></thead>';
    const tbody = document.createElement('tbody');
    processedRows.forEach(row => {
        const tr = document.createElement('tr');
        tr.onclick = () => showClientDetailsModal(row, headers);
        state.visibleClientColumns.forEach(header => {
            const cellIndex = headers.indexOf(header);
            const td = document.createElement('td');
            td.textContent = cellIndex > -1 ? (row[cellIndex] || '') : '';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    clientTableContainer.appendChild(table);
    clientTableContainer.querySelectorAll('th.sortable').forEach(th => th.onclick = handleClientSort);
}
function renderClientsAsCards() {
    clientTableContainer.innerHTML = '';
    const processedRows = getProcessedClients();
    if (processedRows.length === 0) { clientTableContainer.innerHTML = '<p>No clients found.</p>'; return; }
    const { headers } = allClients;
    const cardContainer = document.createElement('div'); cardContainer.className = 'card-container';
    processedRows.forEach(row => {
        const card = document.createElement('div');
        card.className = 'client-card';
        card.onclick = () => showClientDetailsModal(row, headers);
        let cardContent = `<h3>${row[headers.indexOf('First Name')] || 'No Name'}</h3>`;
        state.visibleClientColumns.forEach(headerText => {
            if (headerText !== 'First Name') {
                const cellIndex = headers.indexOf(headerText);
                cardContent += `<p><strong>${headerText}:</strong> ${cellIndex > -1 ? (row[cellIndex] || 'N/A') : 'N/A'}</p>`;
            }
        });
        card.innerHTML = cardContent;
        cardContainer.appendChild(card);
    });
    clientTableContainer.appendChild(cardContainer);
}
function handleClientSort(event) {
    const newSortColumn = event.target.dataset.sortClient;
    if (state.clientSortColumn === newSortColumn) { state.clientSortDirection = state.clientSortDirection === 'asc' ? 'desc' : 'asc'; } 
    else { state.clientSortColumn = newSortColumn; state.clientSortDirection = 'asc'; }
    renderClients();
}
function showClientDetailsModal(rowData, headers) {
    const editBtn = document.getElementById('client-modal-edit-btn');
    const saveBtn = document.getElementById('client-modal-save-btn');
    const statusSpan = document.getElementById('client-modal-status');
    statusSpan.textContent = '';
    
    const tabButtons = clientDetailsModal.querySelectorAll('.client-tab-button');
    tabButtons.forEach(button => button.onclick = (e) => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
        clientDetailsModal.querySelectorAll('.client-tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`client-tab-${e.currentTarget.dataset.tab}`).classList.add('active');
        const isEditable = e.currentTarget.dataset.editable === 'true';
        editBtn.style.display = isEditable ? 'inline-block' : 'none';
        saveBtn.style.display = 'none';
    });
    tabButtons[0].click();
    const renderViewMode = (data) => {
        populateClientDetailsTab(data, headers, false);
        populateClientHistoryTab(data[headers.indexOf('Email')]);
        populateClientNotesTab(data, headers, false);
        populateClientFinancialsTab(data[headers.indexOf('Email')]);
        populateClientActionsTab(data, headers);
        const currentTabIsEditable = clientDetailsModal.querySelector('.client-tab-button.active').dataset.editable === 'true';
        editBtn.style.display = currentTabIsEditable ? 'inline-block' : 'none';
        saveBtn.style.display = 'none';
        editBtn.onclick = () => renderEditMode(data);
    };
    const renderEditMode = (data) => {
        populateClientDetailsTab(data, headers, true);
        populateClientNotesTab(data, headers, true);
        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
        saveBtn.onclick = () => handleSaveClientUpdate(data, headers);
    };
    const handleSaveClientUpdate = async (currentRowData, currentHeaders) => {
        statusSpan.textContent = 'Saving...';
        const dataToUpdate = {};
        const fields = ['First Name', 'Last Name', 'Email', 'Phone', 'Organization', 'Status', 'Social Media', 'Notes', 'Contact Logs'];
        fields.forEach(h => {
            const input = document.getElementById(`client-edit-${h.replace(/\s+/g, '')}`);
            if(input) {
                const newValue = input.value;
                const oldValue = currentRowData[currentHeaders.indexOf(h)] || '';
                if (oldValue !== newValue) dataToUpdate[h] = newValue;
            }
        });
        try {
            const clientId = currentRowData[currentHeaders.indexOf('ClientID')];
            if (Object.keys(dataToUpdate).length > 0) await updateSheetRow('Clients', 'ClientID', clientId, dataToUpdate);
            await loadClients(); 
            const updatedRow = allClients.rows.find(r => r[allClients.headers.indexOf('ClientID')] === clientId);
            statusSpan.textContent = 'Saved successfully!';
            renderClients();
            setTimeout(() => { renderViewMode(updatedRow || currentRowData); statusSpan.textContent = ''; }, 1500);
        } catch(err) { statusSpan.textContent = 'Error saving.'; console.error('Client update error:', err); }
    };
    renderViewMode(rowData);
    clientDetailsModal.style.display = 'block';
}
function populateClientDetailsTab(rowData, headers, isEditMode) {
    const container = document.getElementById('client-tab-details');
    const displayHeaders = ['First Name', 'Last Name', 'Email', 'Phone', 'Organization', 'Status', 'Social Media'];
    let contentHtml = '<ul>';
    displayHeaders.forEach(h => {
        const val = rowData[headers.indexOf(h)] || '';
        contentHtml += `<li><strong>${h}:</strong> ${isEditMode ? `<input type="text" id="client-edit-${h.replace(/\s+/g, '')}" value="${val}">` : (val || 'N/A')}</li>`;
    });
    container.innerHTML = contentHtml + '</ul>';
}
function populateClientHistoryTab(clientEmail) {
    const container = document.getElementById('client-tab-history');
    let contentHtml = '<h3>Service Requests</h3>';
    const clientRequests = allRequests.rows.filter(row => row[allRequests.headers.indexOf('Email')] === clientEmail);
    if (clientRequests.length > 0) {
        contentHtml += '<ul>';
        clientRequests.forEach(req => {
            const reqDate = req[allRequests.headers.indexOf('Submission Date')] || 'No Date';
            const reqService = req[allRequests.headers.indexOf('Primary Service Category')] || 'No Service';
            contentHtml += `<li><strong>${reqDate}:</strong> <a href="#" onclick="showLinkedRequest('${req[allRequests.headers.indexOf('Submission ID')]}'); return false;">${reqService}</a></li>`;
        });
        contentHtml += '</ul>';
    } else { contentHtml += '<p>No service requests found for this client.</p>'; }
    contentHtml += '<h3>Projects</h3>';
    const clientProjects = allProjects.rows.filter(row => row[allProjects.headers.indexOf('Client Email')] === clientEmail);
    if (clientProjects.length > 0) {
        contentHtml += '<ul>';
        clientProjects.forEach(proj => {
            const projDate = proj[allProjects.headers.indexOf('Start Date')] || 'No Date';
            const projName = proj[allProjects.headers.indexOf('Project Name')] || 'No Name';
            contentHtml += `<li><strong>${projDate}:</strong> <a href="#" onclick="showLinkedProject('${proj[allProjects.headers.indexOf('ProjectID')]}'); return false;">${projName}</a></li>`;
        });
        contentHtml += '</ul>';
    } else { contentHtml += '<p>No projects found for this client.</p>'; }
    container.innerHTML = contentHtml;
}
function showLinkedRequest(reqId) {
    const request = allRequests.rows.find(r => r[allRequests.headers.indexOf('Submission ID')] === reqId);
    if (request) { clientDetailsModal.style.display = 'none'; showRequestDetailsModal(request, allRequests.headers); }
}
function showLinkedProject(projId) {
    clientDetailsModal.style.display = 'none';
    document.querySelector('.tab-button[data-tab="projects"]').click();
    setTimeout(() => { state.selectedProjectId = projId; renderProjectsTab(); }, 100);
}
function populateClientNotesTab(rowData, headers, isEditMode) {
    const container = document.getElementById('client-tab-notes');
    let contentHtml = '<h3>General Notes</h3>';
    const notesIndex = headers.indexOf('Notes'), logsIndex = headers.indexOf('Contact Logs');
    if (isEditMode) {
        contentHtml += `<textarea id="client-edit-Notes">${rowData[notesIndex] || ''}</textarea>`;
    } else { contentHtml += `<p>${(rowData[notesIndex] || 'No notes.').replace(/\n/g, '<br>')}</p>`; }
    contentHtml += '<h3>Contact Logs</h3>';
    let logs = []; try { logs = JSON.parse(rowData[logsIndex] || '[]'); } catch(e) { console.error("Could not parse logs", e); }
    if (logs.length > 0) logs.forEach(log => contentHtml += `<div class="contact-log"><small>${new Date(log.date).toLocaleString()}</small><p>${log.note}</p></div>`);
    else contentHtml += '<p>No contact logs.</p>';
    if (isEditMode) {
        contentHtml += `<input type="hidden" id="client-edit-ContactLogs" value='${JSON.stringify(logs)}'>
            <h3>Add New Contact Log</h3>
            <textarea id="new-contact-log-entry" placeholder="Log a call, meeting, or email..."></textarea>
            <button id="add-contact-log-btn">Add Log</button>`;
    }
    container.innerHTML = contentHtml;
    if (isEditMode) document.getElementById('add-contact-log-btn').onclick = () => {
        const newNote = document.getElementById('new-contact-log-entry').value; if(!newNote) return;
        logs.unshift({ date: new Date().toISOString(), note: newNote });
        document.getElementById('client-edit-ContactLogs').value = JSON.stringify(logs);
        populateClientNotesTab(rowData, headers, true); 
    };
}
function populateClientFinancialsTab(clientEmail) {
    const container = document.getElementById('client-tab-financials');
    let contentHtml = '<h3>Year-to-Date Income</h3>';
    if (allProjects.headers.length > 0) {
        const [emailIdx, valIdx, dateIdx] = ['Client Email', 'Value', 'Start Date'].map(h => allProjects.headers.indexOf(h));
        const currentYear = new Date().getFullYear();
        let ytdIncome = 0;
        allProjects.rows.forEach(row => {
            if (row[dateIdx] && row[emailIdx] === clientEmail && new Date(row[dateIdx]).getFullYear() === currentYear) {
                ytdIncome += parseFloat(row[valIdx]) || 0;
            }
        });
        contentHtml += `<h2>$${ytdIncome.toFixed(2)}</h2>`;
    } else { contentHtml += '<p>Project data is not available.</p>'; }
    container.innerHTML = contentHtml;
}
function populateClientActionsTab(rowData, headers) {
    const container = document.getElementById('client-tab-actions');
    container.innerHTML = '<h3>Actions</h3>';
    const createProjectBtn = document.createElement('button');
    createProjectBtn.textContent = 'Create New Project';
    createProjectBtn.onclick = () => showCreateProjectModal(rowData, headers);
    container.appendChild(createProjectBtn);
    const deleteClientBtn = document.createElement('button');
    deleteClientBtn.id = 'delete-client-btn';
    deleteClientBtn.textContent = 'Delete Client';
    deleteClientBtn.onclick = () => showDeleteClientModal(rowData, headers);
    container.appendChild(deleteClientBtn);
}
function showCreateProjectModal(clientRow, clientHeaders) {
    clientDetailsModal.style.display = 'none';
    createProjectModal.style.display = 'block';
    const clientEmail = clientRow[clientHeaders.indexOf('Email')];
    const clientName = `${clientRow[clientHeaders.indexOf('First Name')]} ${clientRow[clientHeaders.indexOf('Last Name')]}`;
    document.getElementById('project-client-name').value = clientName;
    const sourceRequestSelect = document.getElementById('project-source-request');
    sourceRequestSelect.innerHTML = '<option value="">Start from scratch</option>';
    sourceRequestSelect.dataset.clientEmail = clientEmail;
    const activeClientRequests = allRequests.rows.filter(r => r[allRequests.headers.indexOf('Email')] === clientEmail && r[allRequests.headers.indexOf('Status')] !== 'Archived');
    activeClientRequests.forEach(req => {
        const date = req[allRequests.headers.indexOf('Submission Date')] || 'No Date';
        const service = req[allRequests.headers.indexOf('Primary Service Category')] || 'No Service';
        const id = req[allRequests.headers.indexOf('Submission ID')];
        sourceRequestSelect.add(new Option(`${date} - ${service}`, id));
    });
    sourceRequestSelect.onchange = (e) => {
        const selectedRequestId = e.target.value;
        if (!selectedRequestId) { document.getElementById('project-name').value = ''; document.getElementById('project-value').value = ''; return; }
        const selectedRequest = allRequests.rows.find(r => r[allRequests.headers.indexOf('Submission ID')] === selectedRequestId);
        if (selectedRequest) {
            document.getElementById('project-name').value = selectedRequest[allRequests.headers.indexOf('Primary Service Category')] || '';
            document.getElementById('project-value').value = selectedRequest[allRequests.headers.indexOf('Quote Total')] || '';
        }
    };
    sourceRequestSelect.dispatchEvent(new Event('change')); 
}
function showDeleteClientModal(rowData, headers) {
    clientDetailsModal.style.display = 'none';
    deleteClientModal.style.display = 'block';
    const confirmInput = document.getElementById('delete-confirm-input');
    const confirmBtn = document.getElementById('delete-confirm-btn');
    confirmInput.value = ''; confirmBtn.disabled = true;
    confirmInput.oninput = () => confirmBtn.disabled = confirmInput.value !== 'Delete';
    confirmBtn.onclick = async () => {
        const statusSpan = document.getElementById('delete-client-status');
        statusSpan.textContent = 'Deleting...'; confirmBtn.disabled = true;
        try {
            await clearSheetRow('Clients', 'ClientID', rowData[headers.indexOf('ClientID')]);
            await loadClients(); renderClients();
            statusSpan.textContent = 'Client deleted.';
            setTimeout(() => { deleteClientModal.style.display = 'none'; }, 1500);
        } catch (err) { statusSpan.textContent = 'Error deleting client.'; console.error('Delete client error:', err); confirmBtn.disabled = false; }
    };
}
async function handleAddClientSubmit(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('add-client-status');
    statusDiv.textContent = 'Adding client...';
    const clientData = {
        'First Name': document.getElementById('client-first-name').value, 'Last Name': document.getElementById('client-last-name').value,
        'Email': document.getElementById('client-email').value, 'Status': 'Active', 'ClientID': `C-${Date.now()}`
    };
    try {
        await writeData('Clients', clientData);
        statusDiv.textContent = 'Client added successfully!'; addClientForm.reset();
        await loadClients(); renderClients();
        setTimeout(() => { statusDiv.textContent = ''; }, 3000);
    } catch (err) { statusDiv.textContent = `Error: ${err.result.error.message}`; }
}

// --- UTILITY & GENERIC DATA FUNCTIONS ---
function columnToLetter(column) {
    let temp, letter = '';
    while (column > 0) { temp = (column - 1) % 26; letter = String.fromCharCode(temp + 65) + letter; column = (column - temp - 1) / 26; }
    return letter;
}
async function updateSheetRow(sheetName, idColumnName, idValue, dataToUpdate) {
    let sheetResponse = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!1:1`});
    let sheetHeaders = (sheetResponse.result.values ? sheetResponse.result.values[0] : []) || [];
    const newHeaders = Object.keys(dataToUpdate).filter(h => !sheetHeaders.includes(h));
    if (newHeaders.length > 0) {
        const firstEmptyColumn = columnToLetter(sheetHeaders.length + 1);
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!${firstEmptyColumn}1`, valueInputOption: 'RAW', resource: { values: [newHeaders] }
        });
        sheetHeaders = sheetHeaders.concat(newHeaders);
    }
    const fullSheetResponse = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: sheetName });
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
        if (columnIndex > -1) updatedRow[columnIndex] = dataToUpdate[columnName];
    }
    const targetRowNumber = visualRowIndex + 1;
    const targetRange = `${sheetName}!A${targetRowNumber}`;
    return gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: targetRange, valueInputOption: 'USER_ENTERED', resource: { values: [updatedRow] }
    });
}
async function clearSheetRow(sheetName, idColumnName, idValue) {
    const fullSheetResponse = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: sheetName });
    const sheetValues = fullSheetResponse.result.values || [];
    const sheetHeaders = sheetValues[0] || [];
    const idIndex = sheetHeaders.indexOf(idColumnName);
    if (idIndex === -1) throw new Error(`Unique ID column '${idColumnName}' not found.`);
    const visualRowIndex = sheetValues.findIndex(row => row && row[idIndex] === idValue);
    if (visualRowIndex === -1) throw new Error(`Could not find row to delete.`);
    const targetRowNumber = visualRowIndex + 1;
    const targetRange = `${sheetName}!A${targetRowNumber}:${columnToLetter(sheetHeaders.length)}${targetRowNumber}`;
    return gapi.client.sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: targetRange });
}
async function writeData(sheetName, dataObject) {
    const headerResponse = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!1:1` });
    let headers = headerResponse.result.values ? headerResponse.result.values[0] : [];
    const newHeaders = Object.keys(dataObject).filter(h => !headers.includes(h));
    if (newHeaders.length > 0) {
        const firstEmptyColumn = columnToLetter(headers.length + 1);
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!${firstEmptyColumn}1`, valueInputOption: 'RAW', resource: { values: [newHeaders] }
        });
        headers = headers.concat(newHeaders);
    }
    const newRow = headers.map(header => dataObject[header] || '');
    return gapi.client.sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: [newRow] } });
}
function populateServiceFilter() {
    if (!allRequests.rows || allRequests.rows.length === 0) return;
    const { headers, rows } = allRequests;
    const serviceIndex = headers.indexOf('Primary Service Category');
    if (serviceIndex === -1) return;
    const services = new Set(rows.map(row => row[serviceIndex]));
    serviceFilter.innerHTML = '<option value="all">All Services</option>';
    services.forEach(service => { if(service) serviceFilter.add(new Option(service, service)); });
}
function populateColumnSelector(headers, visibleColumns, containerId) {
    const container = document.getElementById(containerId); container.innerHTML = '';
    headers.forEach(header => {
        if (!header) return;
        const isChecked = visibleColumns.includes(header);
        container.innerHTML += `<div><label><input type="checkbox" value="${header}" ${isChecked ? 'checked' : ''}>${header}</label></div>`;
    });
}

