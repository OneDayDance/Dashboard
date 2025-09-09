// js/clients.js
// Description: Contains all logic for the 'Clients' tab.

import { state, allClients, allRequests, allProjects, clientSortableColumns, updateState, updateClientFilters, setAllClients } from './state.js';
import { updateSheetRow, writeData, clearSheetRow } from './api.js';
import { showColumnModal, elements } from './ui.js';
import { showCreateProjectModal, renderProjectsTab } from './projects.js';
import { showRequestDetailsModal } from './requests.js';

// --- STATE & EVENT HANDLERS ---
export function initClientsTab() {
    document.getElementById('add-client-form').addEventListener('submit', handleAddClientSubmit);
    document.getElementById('client-search-bar').oninput = (e) => { updateState({ clientSearchTerm: e.target.value.toLowerCase() }); renderClients(); };
    document.getElementById('client-status-filter').onchange = (e) => { updateClientFilters('status', e.target.value); renderClients(); };
    document.getElementById('client-list-view-btn').onclick = () => setClientView('list');
    document.getElementById('client-card-view-btn').onclick = () => setClientView('card');
    document.getElementById('client-column-select-btn').onclick = () => showColumnModal('clients');
    document.getElementById('save-client-columns-btn').onclick = handleSaveColumns;
}

// --- RENDERING ---
export function renderClients() {
    const renderFn = state.clientCurrentView === 'list' ? renderClientsAsList : renderClientsAsCards;
    renderFn();
}

function renderClientsAsList() {
    const container = document.getElementById('client-table-container');
    container.innerHTML = '';
    const processedRows = getProcessedClients();
    if (processedRows.length === 0) { container.innerHTML = '<p>No clients found.</p>'; return; }

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
    container.appendChild(table);
    container.querySelectorAll('th.sortable').forEach(th => th.onclick = handleClientSort);
}

function renderClientsAsCards() {
    const container = document.getElementById('client-table-container');
    container.innerHTML = '';
    const processedRows = getProcessedClients();
    if (processedRows.length === 0) { container.innerHTML = '<p>No clients found.</p>'; return; }
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
    container.appendChild(cardContainer);
}


// --- LOGIC ---
function getProcessedClients() {
    if (!allClients.rows || allClients.rows.length === 0) return [];
    let { headers, rows } = allClients;
    let processedRows = [...rows];
    if (state.clientSearchTerm) {
        processedRows = processedRows.filter(row => row.some(cell => String(cell).toLowerCase().includes(state.clientSearchTerm)));
    }
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

function handleClientSort(event) {
    const newSortColumn = event.target.dataset.sortClient;
    if (state.clientSortColumn === newSortColumn) {
        updateState({ clientSortDirection: state.clientSortDirection === 'asc' ? 'desc' : 'asc' });
    } else {
        updateState({ clientSortColumn: newSortColumn, clientSortDirection: 'asc' });
    }
    renderClients();
}

function setClientView(view) {
    updateState({ clientCurrentView: view });
    document.getElementById('client-list-view-btn').classList.toggle('active', view === 'list');
    document.getElementById('client-card-view-btn').classList.toggle('active', view === 'card');
    renderClients();
}

function handleSaveColumns() {
    updateState({ visibleClientColumns: Array.from(document.querySelectorAll('#client-column-checkboxes input:checked')).map(cb => cb.value) });
    elements.clientColumnModal.style.display = 'none';
    renderClients();
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
        document.getElementById('add-client-form').reset();
        // The main data reload will handle updating the view.
        setTimeout(() => { statusDiv.textContent = ''; }, 3000);
    } catch (err) {
        statusDiv.textContent = `Error: ${err.result.error.message}`;
    }
}

// --- MODAL FUNCTIONS ---
function showClientDetailsModal(rowData, headers) {
    const editBtn = document.getElementById('client-modal-edit-btn');
    const saveBtn = document.getElementById('client-modal-save-btn');
    const statusSpan = document.getElementById('client-modal-status');
    const footer = elements.clientDetailsModal.querySelector('.modal-footer');
    statusSpan.textContent = '';

    const tabButtons = elements.clientDetailsModal.querySelectorAll('.client-tab-button');

    // The tab click handler is the master controller for visibility.
    tabButtons.forEach(button => button.onclick = (e) => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
        elements.clientDetailsModal.querySelectorAll('.client-tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`client-tab-${e.currentTarget.dataset.tab}`).classList.add('active');

        const isEditable = e.currentTarget.dataset.editable === 'true';

        if (isEditable) {
            // Show the footer and reset buttons to "view" mode.
            // This cancels "edit" mode if the user switches to another editable tab.
            footer.style.display = 'block';
            editBtn.style.display = 'inline-block';
            saveBtn.style.display = 'none';
        } else {
            // Hide the footer for non-editable tabs.
            footer.style.display = 'none';
        }
    });

    const renderViewMode = (data) => {
        populateClientDetailsTab(data, headers, false);
        populateClientHistoryTab(data[headers.indexOf('Email')]);
        populateClientNotesTab(data, headers, false);
        populateClientFinancialsTab(data[headers.indexOf('Email')]);
        populateClientActionsTab(data, headers);
    };

    const renderEditMode = (data) => {
        populateClientDetailsTab(data, headers, true);
        populateClientNotesTab(data, headers, true);
    };

    editBtn.onclick = () => {
        // Switch to "edit" mode visuals
        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
        renderEditMode(rowData);
    };

    const handleSaveClientUpdate = async (currentRowData, currentHeaders) => {
        statusSpan.textContent = 'Saving...';
        const dataToUpdate = {};
        const fields = ['First Name', 'Last Name', 'Email', 'Phone', 'Organization', 'Status', 'Social Media', 'Notes', 'Contact Logs'];
        fields.forEach(h => {
            const input = document.getElementById(`client-edit-${h.replace(/\s+/g, '')}`);
            if (input) {
                const newValue = input.value;
                const oldValue = currentRowData[currentHeaders.indexOf(h)] || '';
                if (oldValue !== newValue) dataToUpdate[h] = newValue;
            }
        });
        try {
            const clientId = currentRowData[currentHeaders.indexOf('ClientID')];
            if (Object.keys(dataToUpdate).length > 0) await updateSheetRow('Clients', 'ClientID', clientId, dataToUpdate);
            const updatedRow = allClients.rows.find(r => r[allClients.headers.indexOf('ClientID')] === clientId);
            statusSpan.textContent = 'Saved successfully!';
            renderClients();
            setTimeout(() => {
                // After saving, go back to view mode by re-clicking the current tab
                const currentTab = elements.clientDetailsModal.querySelector('.client-tab-button.active');
                renderViewMode(updatedRow || currentRowData);
                if (currentTab) currentTab.click();
                statusSpan.textContent = '';
            }, 1500);
        } catch (err) {
            statusSpan.textContent = 'Error saving.';
            console.error('Client update error:', err);
        }
    };
    
    // Assign the save handler once, so it's always available.
    saveBtn.onclick = () => handleSaveClientUpdate(rowData, headers);

    // Initial setup
    renderViewMode(rowData); // Populate content for all tabs
    tabButtons[0].click();   // Set the initial state for the first tab
    elements.clientDetailsModal.style.display = 'block';
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
            const reqId = req[allRequests.headers.indexOf('Submission ID')];
            contentHtml += `<li><strong>${reqDate}:</strong> <a href="#" class="linked-request" data-req-id="${reqId}">${reqService}</a></li>`;
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
            const projId = proj[allProjects.headers.indexOf('ProjectID')];
            contentHtml += `<li><strong>${projDate}:</strong> <a href="#" class="linked-project" data-proj-id="${projId}">${projName}</a></li>`;
        });
        contentHtml += '</ul>';
    } else { contentHtml += '<p>No projects found for this client.</p>'; }

    container.innerHTML = contentHtml;

    // Add event listeners
    container.querySelectorAll('.linked-request').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const reqId = e.currentTarget.dataset.reqId;
            const request = allRequests.rows.find(r => r[allRequests.headers.indexOf('Submission ID')] === reqId);
            if (request) {
                elements.clientDetailsModal.style.display = 'none';
                showRequestDetailsModal(request, allRequests.headers);
            }
        });
    });

    container.querySelectorAll('.linked-project').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const projId = e.currentTarget.dataset.projId;
            elements.clientDetailsModal.style.display = 'none';
            document.querySelector('.tab-button[data-tab="projects"]').click();
            setTimeout(() => {
                updateState({ selectedProjectId: projId });
                renderProjectsTab();
            }, 100); // Timeout to allow tab switch to complete
        });
    });
}

function populateClientNotesTab(rowData, headers, isEditMode) {
    const container = document.getElementById('client-tab-notes');
    let contentHtml = '<h3>General Notes</h3>';
    const notesIndex = headers.indexOf('Notes'), logsIndex = headers.indexOf('Contact Logs');
    if (isEditMode) {
        contentHtml += `<textarea id="client-edit-Notes">${rowData[notesIndex] || ''}</textarea>`;
    } else { contentHtml += `<p>${(rowData[notesIndex] || 'No notes.').replace(/\n/g, '<br>')}</p>`; }
    contentHtml += '<h3>Contact Logs</h3>';
    let logs = []; try { logs = JSON.parse(rowData[logsIndex] || '[]'); } catch (e) { console.error("Could not parse logs", e); }
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
        const newNote = document.getElementById('new-contact-log-entry').value; if (!newNote) return;
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

function showDeleteClientModal(rowData, headers) {
    elements.clientDetailsModal.style.display = 'none';
    elements.deleteClientModal.style.display = 'block';
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
            const clientIndex = allClients.rows.findIndex(r => r[allClients.headers.indexOf('ClientID')] === clientId);
            if (clientIndex > -1) allClients.rows.splice(clientIndex, 1);
            renderClients();
            statusSpan.textContent = 'Client deleted.';
            setTimeout(() => { elements.deleteClientModal.style.display = 'none'; }, 1500);
        } catch (err) { statusSpan.textContent = 'Error deleting client.'; console.error('Delete client error:', err); confirmBtn.disabled = false; }
    };
}


