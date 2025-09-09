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
    document.getElementById('client-column-select-btn').onclick = () => showColumnModal(allClients.headers, state.visibleClientColumns, 'client-column-checkboxes');
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
        card.className = 'client-card info-card';
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

// --- REBUILT MODAL FUNCTIONS ---

export function showClientDetailsModal(rowData, headers) {
    // --- STATE MANAGEMENT ---
    let localState = {
        activeTab: 'details',
        isEditMode: false,
        currentRowData: [...rowData]
    };

    // --- DOM ELEMENT REFERENCES ---
    const modal = elements.clientDetailsModal;
    const nameHeader = modal.querySelector('#client-modal-name');
    const navLinks = modal.querySelectorAll('.nav-link');
    const contentArea = modal.querySelector('.modal-pane-content');
    const footer = modal.querySelector('.modal-footer');
    const statusSpan = modal.querySelector('#client-modal-status');

    // --- RENDER LOGIC ---
    function render() {
        // Update name
        const [fName, lName] = [localState.currentRowData[headers.indexOf('First Name')], localState.currentRowData[headers.indexOf('Last Name')]];
        nameHeader.textContent = `${fName || ''} ${lName || ''}`.trim() || 'Client Details';

        // Update nav links
        navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.tab === localState.activeTab);
        });

        // Render content
        const tabRenderers = {
            details: populateClientDetailsTab,
            history: populateClientHistoryTab,
            notes: populateClientNotesTab,
            financials: populateClientFinancialsTab,
            actions: populateClientActionsTab,
        };
        contentArea.innerHTML = tabRenderers[localState.activeTab]();

        // Render footer
        const editableTabs = ['details', 'notes'];
        footer.innerHTML = ''; // Clear previous buttons
        if (editableTabs.includes(localState.activeTab)) {
            if (localState.isEditMode) {
                const saveBtn = document.createElement('button');
                saveBtn.className = 'btn btn-primary';
                saveBtn.textContent = 'Save Changes';
                saveBtn.onclick = handleSaveClientUpdate;
                footer.appendChild(saveBtn);
            } else {
                const editBtn = document.createElement('button');
                editBtn.className = 'btn btn-secondary';
                editBtn.textContent = 'Edit';
                editBtn.onclick = () => {
                    localState.isEditMode = true;
                    render();
                };
                footer.appendChild(editBtn);
            }
        }
        footer.appendChild(statusSpan); // Re-append status span
        statusSpan.textContent = '';
    }

    // --- CONTENT POPULATION ---
    function populateClientDetailsTab() {
        const displayHeaders = ['First Name', 'Last Name', 'Email', 'Phone', 'Organization', 'Status', 'Social Media'];
        let contentHtml = '<div class="form-grid-condensed">';
        displayHeaders.forEach(h => {
            const val = localState.currentRowData[headers.indexOf(h)] || '';
            const inputId = `client-edit-${h.replace(/\s+/g, '')}`;
            contentHtml += `
                <div class="form-field">
                    <label for="${inputId}">${h}</label>
                    ${localState.isEditMode ? `<input type="text" id="${inputId}" value="${val}">` : `<p>${val || 'N/A'}</p>`}
                </div>`;
        });
        return contentHtml + '</div>';
    }

    function populateClientHistoryTab() {
        const clientEmail = localState.currentRowData[headers.indexOf('Email')];
        let contentHtml = '<h3>Service Requests</h3>';
        const clientRequests = allRequests.rows.filter(row => row[allRequests.headers.indexOf('Email')] === clientEmail);
        if (clientRequests.length > 0) {
            contentHtml += '<ul>';
            clientRequests.forEach(req => {
                const reqDate = req[allRequests.headers.indexOf('Submission Date')] || 'No Date';
                const reqService = req[allRequests.headers.indexOf('Primary Service Category')] || 'No Service';
                contentHtml += `<li><strong>${reqDate}:</strong> <a href="#" class="linked-request" data-req-id="${req[allRequests.headers.indexOf('Submission ID')]}">${reqService}</a></li>`;
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
                contentHtml += `<li><strong>${projDate}:</strong> <a href="#" class="linked-project" data-proj-id="${proj[allProjects.headers.indexOf('ProjectID')]}">${projName}</a></li>`;
            });
            contentHtml += '</ul>';
        } else { contentHtml += '<p>No projects found for this client.</p>'; }
        return contentHtml;
    }

    function populateClientNotesTab() {
        const notesIndex = headers.indexOf('Notes');
        const logsIndex = headers.indexOf('Contact Logs');
        const notesVal = localState.currentRowData[notesIndex] || '';
        let contentHtml = '<h3>General Notes</h3>';
        if (localState.isEditMode) {
            contentHtml += `<textarea id="client-edit-Notes">${notesVal}</textarea>`;
        } else {
            contentHtml += `<p class="pre-wrap">${notesVal || 'No notes.'}</p>`;
        }

        contentHtml += '<h3>Contact Logs</h3>';
        let logs = []; 
        try { logs = JSON.parse(localState.currentRowData[logsIndex] || '[]'); } catch (e) { console.error("Could not parse logs", e); }
        
        if (logs.length > 0) {
            logs.forEach(log => contentHtml += `<div class="contact-log"><small>${new Date(log.date).toLocaleString()}</small><p>${log.note}</p></div>`);
        } else {
            contentHtml += '<p>No contact logs.</p>';
        }

        if (localState.isEditMode) {
            contentHtml += `<input type="hidden" id="client-edit-ContactLogs" value='${JSON.stringify(logs)}'>
                <h3>Add New Contact Log</h3>
                <textarea id="new-contact-log-entry" placeholder="Log a call, meeting, or email..."></textarea>
                <button id="add-contact-log-btn" class="btn btn-secondary">Add Log</button>`;
        }
        return contentHtml;
    }

    function populateClientFinancialsTab() {
        const clientEmail = localState.currentRowData[headers.indexOf('Email')];
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
            contentHtml += `<p class="financial-total">$${ytdIncome.toFixed(2)}</p>`;
        } else { contentHtml += '<p>Project data is not available.</p>'; }
        return contentHtml;
    }

    function populateClientActionsTab() {
        return `
            <h3>Actions</h3>
            <div class="action-buttons-container">
                <button id="modal-new-project-btn" class="btn btn-primary">Create New Project</button>
                <button id="modal-delete-client-btn" class="btn btn-danger">Delete Client</button>
            </div>`;
    }

    // --- EVENT HANDLERS ---
    function attachContentEventListeners() {
        // --- Note/Log specific ---
        const addLogBtn = document.getElementById('add-contact-log-btn');
        if (addLogBtn) addLogBtn.onclick = () => {
            const newNote = document.getElementById('new-contact-log-entry').value; 
            if (!newNote) return;
            const logsInput = document.getElementById('client-edit-ContactLogs');
            let logs = JSON.parse(logsInput.value);
            logs.unshift({ date: new Date().toISOString(), note: newNote });
            logsInput.value = JSON.stringify(logs);
            // Re-render only the notes tab content for instant feedback
            contentArea.innerHTML = populateClientNotesTab();
            attachContentEventListeners(); // Re-attach listeners to new content
        };

        // --- History specific ---
        contentArea.querySelectorAll('.linked-request').forEach(link => {
            link.onclick = (e) => {
                e.preventDefault();
                const request = allRequests.rows.find(r => r[allRequests.headers.indexOf('Submission ID')] === e.target.dataset.reqId);
                if (request) { modal.style.display = 'none'; showRequestDetailsModal(request, allRequests.headers); }
            };
        });
        contentArea.querySelectorAll('.linked-project').forEach(link => {
            link.onclick = (e) => {
                e.preventDefault();
                modal.style.display = 'none';
                document.querySelector('.tab-button[data-tab="projects"]').click();
                setTimeout(() => { updateState({ selectedProjectId: e.target.dataset.projId }); renderProjectsTab(); }, 100);
            };
        });

        // --- Actions specific ---
        const newProjectBtn = document.getElementById('modal-new-project-btn');
        if (newProjectBtn) newProjectBtn.onclick = () => showCreateProjectModal(localState.currentRowData, headers);
        
        const deleteClientBtn = document.getElementById('modal-delete-client-btn');
        if(deleteClientBtn) deleteClientBtn.onclick = () => showDeleteClientModal(localState.currentRowData, headers);
    }
    
    async function handleSaveClientUpdate() {
        statusSpan.textContent = 'Saving...';
        const dataToUpdate = {};
        const fields = ['First Name', 'Last Name', 'Email', 'Phone', 'Organization', 'Status', 'Social Media', 'Notes', 'Contact Logs'];
        fields.forEach(h => {
            const input = document.getElementById(`client-edit-${h.replace(/\s+/g, '')}`);
            if (input) {
                const newValue = input.value;
                const oldValue = localState.currentRowData[headers.indexOf(h)] || '';
                if (oldValue !== newValue) dataToUpdate[h] = newValue;
            }
        });

        try {
            const clientId = localState.currentRowData[headers.indexOf('ClientID')];
            if (Object.keys(dataToUpdate).length > 0) {
                await updateSheetRow('Clients', 'ClientID', clientId, dataToUpdate);
            }
            statusSpan.textContent = 'Saved successfully!';
            
            // Update local and global state before re-rendering
            const updatedRowIndex = allClients.rows.findIndex(r => r[allClients.headers.indexOf('ClientID')] === clientId);
            if(updatedRowIndex > -1) {
                // Create a new row array with the updates applied
                const newRow = [...allClients.rows[updatedRowIndex]];
                Object.keys(dataToUpdate).forEach(key => {
                    const headerIndex = headers.indexOf(key);
                    if (headerIndex > -1) newRow[headerIndex] = dataToUpdate[key];
                });
                allClients.rows[updatedRowIndex] = newRow;
                localState.currentRowData = newRow;
            }

            renderClients(); // Update the main view
            
            setTimeout(() => {
                localState.isEditMode = false;
                render();
                attachContentEventListeners();
            }, 1000);

        } catch (err) {
            statusSpan.textContent = 'Error saving.';
            console.error('Client update error:', err);
        }
    }

    navLinks.forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            localState.activeTab = e.target.dataset.tab;
            localState.isEditMode = false; // Always exit edit mode on tab change
            render();
            attachContentEventListeners();
        };
    });

    // --- INITIALIZATION ---
    render();
    attachContentEventListeners();
    modal.style.display = 'block';
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

