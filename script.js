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
let authorizeButton, signoutButton, appContainer, addClientForm, serviceFilter, statusFilter, searchBar, detailsModal, columnModal, closeModalButtons, listViewBtn, cardViewBtn, modalSaveNoteBtn, archiveToggle, archiveContainer, columnSelectBtn, saveColumnsBtn, landingContainer, clientSearchBar, clientTableContainer, clientDetailsModal, clientStatusFilter, clientListViewBtn, clientCardViewBtn, clientColumnSelectBtn, clientColumnModal, createProjectModal, deleteClientModal, taskDetailsModal, deleteProjectModal;
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
    deleteProjectModal = document.getElementById('delete-project-modal');
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
    
    archiveToggle.onclick = (e) => {
        e.currentTarget.classList.toggle('collapsed');
        archiveContainer.classList.toggle('collapsed');
    }
    document.getElementById('archived-projects-toggle').onclick = (e) => {
        e.currentTarget.classList.toggle('collapsed');
        document.getElementById('archived-projects-list').classList.toggle('collapsed');
    };
    document.getElementById('create-project-form').addEventListener('submit', handleCreateProjectSubmit);
    document.getElementById('task-details-form').addEventListener('submit', handleSaveTask);
    document.getElementById('project-list-collapse-btn').onclick = () => {
        const layout = document.getElementById('project-layout-container');
        const column = document.querySelector('.project-list-column');
        layout.classList.toggle('collapsed');
        column.classList.toggle('collapsed');
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
    const createProjectBtn = document.getElementById('modal-create-project-btn');
    const actionStatus = document.getElementById('modal-request-actions-status');
    const submissionEmail = rowData[headers.indexOf('Email')];
    if (!submissionEmail) {
        createClientBtn.disabled = true;
        createProjectBtn.disabled = true;
        actionStatus.textContent = "No email in submission.";
    } else {
        const clientExists = allClients.rows.some(r => r[allClients.headers.indexOf('Email')] === submissionEmail);
        createClientBtn.disabled = clientExists;
        createProjectBtn.disabled = !clientExists;
        if (clientExists) {
            actionStatus.textContent = "Client already exists.";
            createClientBtn.onclick = null;
        } else {
            actionStatus.textContent = "";
            createClientBtn.onclick = () => handleCreateClient(rowData, headers);
        }
        if(!clientExists) {
             actionStatus.textContent = "Create client before making project.";
             createProjectBtn.onclick = null;
        } else {
            createProjectBtn.onclick = () => {
                const client = allClients.rows.find(c => c[allClients.headers.indexOf('Email')] === submissionEmail);
                detailsModal.style.display = 'none';
                showCreateProjectModal(client, allClients.headers, rowData[headers.indexOf('Submission ID')]);
            };
        }
    }
    detailsModal.style.display = 'block';
}
async function handleCreateClient(submissionRow, submissionHeaders) {
    const actionStatus = document.getElementById('modal-request-actions-status');
    actionStatus.textContent = 'Creating client...';
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
        actionStatus.textContent = 'Client created successfully!';
        await loadClients(); renderClients();
        setTimeout(() => detailsModal.style.display = 'none', 1500);
    } catch (err) { actionStatus.textContent = `Error: ${err.result.error.message}`; }
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
    let detailsHtml = `
        <div class="project-details-header">
            <h3>${isEditMode ? `<input type="text" id="project-edit-ProjectName" value="${project[headers.indexOf('Project Name')]}">` : project[headers.indexOf('Project Name')]}</h3>
            <div class="project-actions-dropdown">
                <button id="project-actions-btn">Actions</button>
                <div id="project-actions-content" class="project-actions-dropdown-content">
                    <a href="#" id="project-edit-action">Edit Project</a>
                    <a href="#" id="project-archive-action">Archive Project</a>
                    <a href="#" id="project-delete-action" class="delete">Delete Project</a>
                </div>
            </div>
        </div>`;
    detailsHtml += renderGenericProjectDetails(project, headers, isEditMode);
    if (isEditMode) detailsHtml += `<div class="modal-footer"><button id="project-save-btn">Save</button></div>`;
    detailsColumn.innerHTML = detailsHtml;

    document.getElementById('project-actions-btn').onclick = () => {
        document.getElementById('project-actions-content').style.display = 'block';
    };
    window.addEventListener('click', (event) => {
        if (!event.target.matches('#project-actions-btn')) {
            document.getElementById('project-actions-content').style.display = 'none';
        }
    }, { once: true });
    
    document.getElementById('project-edit-action').onclick = () => showProjectDetails(projectId, true);
    document.getElementById('project-archive-action').onclick = () => handleArchiveProject(projectId);
    document.getElementById('project-delete-action').onclick = () => showDeleteProjectModal(projectId);

    if (isEditMode) document.getElementById('project-save-btn').onclick = () => handleSaveProjectUpdate(projectId);

    detailsColumn.querySelectorAll('.collapsible-header').forEach(header => header.onclick = () => {
        header.classList.toggle('collapsed');
        header.nextElementSibling.classList.toggle('collapsed');
    });

    // --- Drag and Drop Event Listeners ---
    detailsColumn.querySelectorAll('[draggable="true"]').forEach(el => {
        el.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            const isBucket = el.matches('.task-bucket, .task-board-column');
            if (isBucket) {
                e.dataTransfer.setData('text/bucket-id', el.dataset.bucket);
            } else {
                e.dataTransfer.setData('text/task-id', el.dataset.taskId);
            }
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => el.classList.add('dragging'), 0);
        });
        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            document.querySelectorAll('.task-placeholder, .bucket-placeholder').forEach(p => p.remove());
        });
    });

    const dropzones = detailsColumn.querySelectorAll('.task-bucket, .task-board-column, #project-task-list, #project-task-board');
    dropzones.forEach(zone => {
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('drop', handleDrop);
    });

    detailsColumn.querySelectorAll('.task-item, .task-card').forEach(el => {
        el.onclick = (e) => {
            // If the click was on a subtask item or its checkbox, do nothing here.
            // The dedicated change listener for the checkbox will handle the logic.
            if (e.target.closest('.subtask-item')) {
                return;
            }
            
            if (e.currentTarget.classList.contains('dragging')) return;
            const taskId = e.currentTarget.dataset.taskId;

            // If it's the main task checkbox
            if (e.target.matches('.task-main input[type="checkbox"]')) {
                 handleTaskStatusChange(taskId, e.target.checked);
            } else { // Otherwise, open the modal
                 showTaskModal(projectId, taskId);
            }
        };
    });

    // Dedicated listener for subtasks to handle logic
    detailsColumn.querySelectorAll('.subtask-item input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', handleSubtaskStatusChange);
    });
     
    detailsColumn.querySelectorAll('.add-task-to-bucket-btn').forEach(btn => btn.onclick = () => showTaskModal(projectId, null, btn.dataset.bucket));
    document.getElementById('task-view-toggle').onclick = () => {
        state.projectTaskView = state.projectTaskView === 'list' ? 'board' : 'list';
        showProjectDetails(projectId, isEditMode);
    };
    document.getElementById('add-bucket-btn').onclick = async () => {
        const bucketName = prompt("Enter new bucket name:");
        if (bucketName && bucketName.trim() !== '') {
            const bucketsIndex = allProjects.headers.indexOf('Task Buckets');
            let currentBuckets = [];
            if (bucketsIndex > -1 && project[bucketsIndex]) try { currentBuckets = JSON.parse(project[bucketsIndex]); } catch (e) {}
            if (!currentBuckets.includes(bucketName.trim())) {
                currentBuckets.push(bucketName.trim());
                try {
                    await updateSheetRow('Projects', 'ProjectID', projectId, { 'Task Buckets': JSON.stringify(currentBuckets) });
                    await loadProjects();
                    showProjectDetails(projectId);
                } catch (err) { alert("Could not save new bucket."); console.error(err); }
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
    return `<div class="project-details-section">
        <div class="project-details-section-header">
            <h4>Tasks</h4>
            <div class="view-controls">
                <button id="add-bucket-btn">+</button>
                <button id="task-view-toggle">${state.projectTaskView === 'list' ? 'Board' : 'List'} View</button>
            </div>
        </div>
        ${renderFn(projectId)}
    </div>`;
}
function renderTasksAsList(projectId) {
    let html = `<div id="project-task-list">`;
    const projectTasks = getProjectTasksSorted(projectId);
    const buckets = getProjectBuckets(projectId);
    buckets.forEach(bucket => {
        html += `<div class="task-bucket" draggable="true" data-bucket="${bucket}"><h5>${bucket}</h5>`;
        projectTasks.filter(t => (t.row[allTasks.headers.indexOf('Bucket')] || 'General') === bucket).forEach(task => {
            html += renderTaskItem(task.row, task.subtasks);
        });
        html += `<button class="add-task-to-bucket-btn" data-bucket="${bucket}">+ Add Task</button></div>`;
    });
    return html + `</div>`;
}
function renderTasksAsBoard(projectId) {
    let html = `<div id="project-task-board" class="task-board">`;
    const projectTasks = getProjectTasksSorted(projectId);
    const buckets = getProjectBuckets(projectId);
    buckets.forEach(bucket => {
        html += `<div class="task-board-column" draggable="true" data-bucket="${bucket}"><h5>${bucket}</h5>`;
        projectTasks.filter(t => (t.row[allTasks.headers.indexOf('Bucket')] || 'General') === bucket).forEach(task => {
            html += renderTaskCard(task.row, task.subtasks);
        });
        html += `<button class="add-task-to-bucket-btn" data-bucket="${bucket}">+ Add Task</button></div>`;
    });
    return html + `</div>`;
}
function renderTaskItem(taskRow, subtasks) {
    const [idIdx, nameIdx, statusIdx] = ['TaskID', 'Task Name', 'Status'].map(h => allTasks.headers.indexOf(h));
    const isCompleted = taskRow[statusIdx] === 'Done';
    let subtasksHtml = '';
    if (subtasks.length > 0) {
        subtasksHtml += '<ul class="subtask-list">';
        subtasks.forEach((sub, i) => {
            subtasksHtml += `<li class="subtask-item"><input type="checkbox" data-task-id="${taskRow[idIdx]}" data-subtask-index="${i}" ${sub.completed ? 'checked' : ''}> ${sub.name}</li>`;
        });
        subtasksHtml += '</ul>';
        const completedCount = subtasks.filter(s => s.completed).length;
        const progress = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;
        subtasksHtml += `<div class="task-progress" title="${completedCount}/${subtasks.length} complete"><div class="task-progress-bar" style="width:${progress}%"></div></div>`;
    }
    return `<div class="task-item" draggable="true" data-task-id="${taskRow[idIdx]}">
                <div class="task-main ${isCompleted ? 'completed' : ''}">
                    <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="handleTaskStatusChange('${taskRow[idIdx]}', this.checked)">
                    <label>${taskRow[nameIdx]}</label>
                </div>
                ${subtasksHtml}
            </div>`;
}
function renderTaskCard(taskRow, subtasks) {
     const [idIdx, nameIdx] = ['TaskID', 'Task Name'].map(h => allTasks.headers.indexOf(h));
     let subtaskSummary = '';
     if (subtasks.length > 0) {
        const completedCount = subtasks.filter(s => s.completed).length;
        subtaskSummary = `<p class="subtask-summary">✓ ${completedCount}/${subtasks.length}</p>`;
     }
    return `<div class="task-card" draggable="true" data-task-id="${taskRow[idIdx]}"><p>${taskRow[nameIdx]}</p>${subtaskSummary}</div>`;
}
function getProjectTasksSorted(projectId) {
    const { headers, rows } = allTasks, [idIdx, sortIdx, subtaskIdx] = ['ProjectID', 'SortIndex', 'Subtasks'].map(h => headers.indexOf(h));
    return rows.filter(t => t[idIdx] === projectId)
               .sort((a,b) => (a[sortIdx] || 0) - (b[sortIdx] || 0))
               .map(row => ({ row, subtasks: JSON.parse(row[subtaskIdx] || '[]') }));
}
function getProjectBuckets(projectId) {
    const project = allProjects.rows.find(p => p[allProjects.headers.indexOf('ProjectID')] === projectId);
    if (project) {
        const bucketsJSON = project[allProjects.headers.indexOf('Task Buckets')];
        if (bucketsJSON) try { return JSON.parse(bucketsJSON); } catch(e){}
    }
    return ['General'];
}

// --- DRAG AND DROP LOGIC ---
function getDragAfterElementVertical(container, y, selector) {
    const draggableElements = [...container.querySelectorAll(`${selector}:not(.dragging)`)];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getDragAfterBucketHorizontal(container, x) {
    const draggableElements = [...container.querySelectorAll('.task-board-column:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function handleDragOver(e) {
    e.preventDefault();
    const draggingEl = document.querySelector('.dragging');
    if (!draggingEl) return;

    let placeholder = document.querySelector('.task-placeholder, .bucket-placeholder');
    
    const removePlaceholder = () => {
        if(placeholder) {
            placeholder.remove();
            placeholder = null;
        }
    };

    const isBucket = draggingEl.matches('.task-bucket, .task-board-column');
    
    if (isBucket) {
        const isListView = draggingEl.matches('.task-bucket');
        const container = isListView ? document.getElementById('project-task-list') : document.getElementById('project-task-board');
        const afterEl = isListView ? getDragAfterElementVertical(container, e.clientY, '.task-bucket') : getDragAfterBucketHorizontal(container, e.clientX);

        // Redundancy Check for buckets
        if (draggingEl.nextElementSibling === afterEl || (afterEl && afterEl.previousElementSibling === draggingEl)) {
            removePlaceholder();
            return;
        }
        if (!afterEl && container.lastElementChild === draggingEl) { // already at the end
            removePlaceholder();
            return;
        }
        
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.className = 'bucket-placeholder';
        }
        if(isListView) placeholder.style.height = `${draggingEl.offsetHeight}px`;
        
        if (afterEl) {
            container.insertBefore(placeholder, afterEl);
        } else {
            container.appendChild(placeholder);
        }
    } else { // TASK
        const container = e.target.closest('.task-bucket, .task-board-column');
        if (!container) {
            removePlaceholder();
            return;
        }

        const afterEl = getDragAfterElementVertical(container, e.clientY, '.task-item, .task-card');
        const isSameContainer = draggingEl.parentNode === container;

        // Redundancy Check for tasks
        if (isSameContainer) {
            if (draggingEl.nextElementSibling === afterEl) {
                 removePlaceholder();
                 return;
            }
            if (!afterEl && container.querySelector('.add-task-to-bucket-btn').previousElementSibling === draggingEl) { // already at the end
                 removePlaceholder();
                 return;
            }
        }
        
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.className = 'task-placeholder';
        }
        placeholder.style.height = `${draggingEl.offsetHeight}px`;

        if (afterEl) {
            container.insertBefore(placeholder, afterEl);
        } else {
            const addTaskBtn = container.querySelector('.add-task-to-bucket-btn');
            container.insertBefore(placeholder, addTaskBtn);
        }
    }
}

async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const placeholder = document.querySelector('.task-placeholder, .bucket-placeholder');
    const draggedElement = document.querySelector('.dragging');
    
    if (!draggedElement || !placeholder) {
        if (draggedElement) draggedElement.classList.remove('dragging');
        if (placeholder) placeholder.remove();
        return;
    }

    const taskId = e.dataTransfer.getData('text/task-id');
    const bucketId = e.dataTransfer.getData('text/bucket-id');

    // Optimistic UI Update: Replace placeholder with the actual element
    placeholder.parentNode.replaceChild(draggedElement, placeholder);
    draggedElement.classList.remove('dragging');

    try {
        if (bucketId) {
            // --- BUCKET DROP SAVE LOGIC ---
            const newBucketsOrder = Array.from(draggedElement.parentNode.children)
                                         .filter(el => el.matches('[data-bucket]'))
                                         .map(el => el.dataset.bucket);
            await updateSheetRow('Projects', 'ProjectID', state.selectedProjectId, { 'Task Buckets': JSON.stringify(newBucketsOrder) });
            await loadProjects();
        } else if (taskId) {
            // --- TASK DROP SAVE LOGIC ---
            const allBuckets = document.querySelectorAll('.task-bucket, .task-board-column');
            const allPromises = [];
            allBuckets.forEach(bucketEl => {
                const bucketName = bucketEl.dataset.bucket;
                const tasksInBucket = Array.from(bucketEl.querySelectorAll('[data-task-id]'));
                tasksInBucket.forEach((taskEl, index) => {
                     allPromises.push(
                        updateSheetRow('Tasks', 'TaskID', taskEl.dataset.taskId, { 
                            'Bucket': bucketName, 
                            'SortIndex': index 
                        })
                    );
                });
            });
            await Promise.all(allPromises);
            await loadTasks();
        }
        // Re-render the project details to ensure UI is perfectly in sync with data
        showProjectDetails(state.selectedProjectId);
    } catch (err) {
        alert("Error saving new order. The view will be refreshed to reflect the last saved state.");
        console.error("Drag/drop save error:", err);
        // On failure, re-render from the last known good state
        showProjectDetails(state.selectedProjectId);
    }
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
    const dataToUpdate = {};
    ['Project Name', 'Status', 'Start Date', 'Value', 'Service Provider', 'Location'].forEach(h => {
        const input = document.getElementById(`project-edit-${h.replace(/\s+/g, '')}`);
        if(input) dataToUpdate[h] = input.value;
    });
    try {
        await updateSheetRow('Projects', 'ProjectID', projectId, dataToUpdate);
        await loadProjects();
        renderProjectsTab();
    } catch(err) { console.error('Project update error', err); alert('Could not save project updates.'); }
}
async function handleArchiveProject(projectId) {
    try {
        await updateSheetRow('Projects', 'ProjectID', projectId, { 'Status': 'Archived' });
        await loadProjects();
        renderProjectsTab();
    } catch(err) { console.error('Archive project error', err); alert('Could not archive project.'); }
}
function showDeleteProjectModal(projectId) {
    deleteProjectModal.style.display = 'block';
    const confirmInput = document.getElementById('delete-project-confirm-input');
    const confirmBtn = document.getElementById('delete-project-confirm-btn');
    confirmInput.value = ''; confirmBtn.disabled = true;
    confirmInput.oninput = () => confirmBtn.disabled = confirmInput.value !== 'Delete';
    confirmBtn.onclick = () => handleDeleteProject(projectId);
}
async function handleDeleteProject(projectId) {
    const statusSpan = document.getElementById('delete-project-status');
    statusSpan.textContent = 'Deleting...';
    document.getElementById('delete-project-confirm-btn').disabled = true;
    try {
        const tasksToDelete = allTasks.rows.filter(t => t[allTasks.headers.indexOf('ProjectID')] === projectId);
        const taskDeletionPromises = tasksToDelete.map(t => clearSheetRow('Tasks', 'TaskID', t[allTasks.headers.indexOf('TaskID')]));
        await Promise.all(taskDeletionPromises);
        await clearSheetRow('Projects', 'ProjectID', projectId);
        await loadProjects();
        await loadTasks();
        state.selectedProjectId = null;
        renderProjectsTab();
        statusSpan.textContent = 'Project deleted.';
        setTimeout(() => deleteProjectModal.style.display = 'none', 1500);
    } catch(err) {
        statusSpan.textContent = 'Error deleting project.';
        console.error('Delete project error', err);
    }
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
function showTaskModal(projectId, taskId = null, bucketName = null) {
    const form = document.getElementById('task-details-form'); form.reset();
    document.getElementById('task-project-id-input').value = projectId;
    document.getElementById('task-modal-status').textContent = '';
    const project = allProjects.rows.find(p => p[allProjects.headers.indexOf('ProjectID')] === projectId);
    let buckets = getProjectBuckets(projectId);
    const bucketSelect = document.getElementById('task-bucket');
    bucketSelect.innerHTML = '';
    buckets.forEach(b => bucketSelect.add(new Option(b, b)));

    if (taskId) {
        document.getElementById('task-modal-title').textContent = 'Edit Task';
        document.getElementById('task-id-input').value = taskId;
        const task = allTasks.rows.find(t => t[allTasks.headers.indexOf('TaskID')] === taskId);
        if(task) {
            const { headers } = allTasks;
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
        if (bucketName) bucketSelect.value = bucketName;
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
    const container = document.getElementById('subtasks-container-modal');
    container.innerHTML = `<input type="hidden" id="subtasks-data" value='${JSON.stringify(subtasks)}'>`;
    subtasks.forEach((sub, i) => {
        const item = document.createElement('div');
        item.className = 'subtask-item';
        item.setAttribute('draggable', true);
        item.dataset.index = i;
        item.innerHTML = `<input type="checkbox" ${sub.completed ? 'checked' : ''}> <label>${sub.name}</label> <button type="button">&times;</button>`;
        item.querySelector('input').onchange = (e) => updateSubtaskStatus(i, e.target.checked);
        item.querySelector('button').onclick = () => removeSubtask(i);
        item.ondragstart = (e) => e.dataTransfer.setData('text/subtask-index', i);
        container.appendChild(item);
    });
    container.ondragover = (e) => e.preventDefault();
    container.ondrop = (e) => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData('text/subtask-index'));
        const target = e.target.closest('.subtask-item');
        if (target) {
            const toIndex = parseInt(target.dataset.index);
            const subtasks = JSON.parse(document.getElementById('subtasks-data').value);
            const [moved] = subtasks.splice(fromIndex, 1);
            subtasks.splice(toIndex, 0, moved);
            renderSubtasks(subtasks);
        }
    };
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
        container.innerHTML += `<div class="item-tag"><a href="${link}" target="_blank">${link}</a> <button type="button" onclick="removeLink(${i})">&times;</button></div>`;
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
        else { 
            taskData.TaskID = `T-${Date.now()}`; 
            const tasksInBucket = getProjectTasksSorted(taskData.ProjectID).filter(t => (t.row[allTasks.headers.indexOf('Bucket')] || 'General') === taskData.Bucket);
            taskData.SortIndex = tasksInBucket.length;
            await writeData('Tasks', taskData); 
        }
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
async function handleSubtaskStatusChange(event) {
    const checkbox = event.target;
    const taskId = checkbox.dataset.taskId;
    const subtaskIndex = parseInt(checkbox.dataset.subtaskIndex, 10);
    const isChecked = checkbox.checked;

    checkbox.disabled = true;

    const taskIndex = allTasks.rows.findIndex(t => t[allTasks.headers.indexOf('TaskID')] === taskId);
    if (taskIndex === -1) return;

    const taskRow = allTasks.rows[taskIndex];
    const subtasksJson = taskRow[allTasks.headers.indexOf('Subtasks')] || '[]';
    let subtasks = [];
    try {
        subtasks = JSON.parse(subtasksJson);
    } catch (e) {
        console.error("Error parsing subtasks for task:", taskId, e);
        return;
    }

    if (subtasks[subtaskIndex]) {
        subtasks[subtaskIndex].completed = isChecked;
    }

    const updatedSubtasksJson = JSON.stringify(subtasks);

    try {
        await updateSheetRow('Tasks', 'TaskID', taskId, { 'Subtasks': updatedSubtasksJson });
        await loadTasks(); // Reload tasks to get fresh data
        showProjectDetails(state.selectedProjectId); // Re-render view
    } catch (err) {
        console.error('Subtask status update error', err);
        alert('Could not update subtask status.');
        // Re-render to revert to last known good state from memory
        showProjectDetails(state.selectedProjectId);
    }
}


// --- CLIENTS TAB FUNCTIONS ---
async function loadClients() {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Clients' });
        const values = response.result.values;
        if (!values || values.length < 1) { allClients = { headers: [], rows: [] }; } 
        else { allClients = { headers: values[0], rows: values.slice(1).filter(row => row.length > 0) }; } // Filter out empty rows
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
function showCreateProjectModal(clientRow, clientHeaders, sourceRequestId = null) {
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
    if (sourceRequestId) sourceRequestSelect.value = sourceRequestId;
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
        const clientId = rowData[headers.indexOf('ClientID')];
        try {
            await clearSheetRow('Clients', 'ClientID', clientId);
            // FIX: Remove client from local data to prevent null row
            const clientIndex = allClients.rows.findIndex(r => r[allClients.headers.indexOf('ClientID')] === clientId);
            if (clientIndex > -1) allClients.rows.splice(clientIndex, 1);
            renderClients();
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


