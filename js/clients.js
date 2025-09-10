// js/clients.js
// Description: Contains all logic for the 'Clients' tab.

import { state, allClients, allRequests, allProjects, clientSortableColumns, updateState, updateClientFilters } from './state.js';
import { updateSheetRow, writeData, clearSheetRow } from './api.js';
import { showColumnModal, elements } from './ui.js';
import { showCreateProjectModal, renderProjectsTab } from './projects.js';
import { showRequestDetailsModal } from './requests.js';

let refreshData; // This will hold the main data refresh function.

// --- STATE & EVENT HANDLERS ---
export function initClientsTab(refreshDataFn) {
    refreshData = refreshDataFn;
    
    if (elements.clientAddBtn) {
        elements.clientAddBtn.onclick = () => showAddClientModal();
    }
    if (elements.clientSearchBar) {
        elements.clientSearchBar.oninput = (e) => { updateState({ clientSearchTerm: e.target.value.toLowerCase() }); renderClients(); };
    }
    if (elements.clientStatusFilter) {
        elements.clientStatusFilter.onchange = (e) => { updateClientFilters('status', e.target.value); renderClients(); };
    }
    if (elements.clientViewToggleBtn) {
        elements.clientViewToggleBtn.onclick = () => setClientView(state.clientCurrentView === 'list' ? 'card' : 'list');
    }
    // FIX: Corrected event listener logic
    if (elements.clientColumnSelectBtn) {
        elements.clientColumnSelectBtn.onclick = () => showColumnModal(allClients.headers, state.visibleClientColumns, 'client-column-modal', 'client-column-checkboxes');
    }
    if (elements.addClientForm) {
        elements.addClientForm.addEventListener('submit', handleAddClientSubmit);
    }
    
    const saveColumnsBtn = document.getElementById('save-client-columns-btn');
    if (saveColumnsBtn) {
        saveColumnsBtn.onclick = handleSaveColumns;
    }
}

function showAddClientModal() {
    if (elements.addClientModal) {
        elements.addClientModal.style.display = 'block';
        elements.addClientForm.reset();
        document.getElementById('add-client-modal-status').textContent = '';
    }
}

async function handleAddClientSubmit(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('add-client-modal-status');
    statusDiv.textContent = 'Adding client...';

    const clientData = {
        'First Name': document.getElementById('add-client-first-name').value,
        'Last Name': document.getElementById('add-client-last-name').value,
        'Email': document.getElementById('add-client-email').value,
        'Phone': document.getElementById('add-client-phone').value,
        'Organization': document.getElementById('add-client-organization').value,
        'Status': document.getElementById('add-client-status').value,
        'Lead Source': document.getElementById('add-client-lead-source').value,
        'Address': document.getElementById('add-client-address').value,
        'Social Media': document.getElementById('add-client-social').value,
        'Birthday': document.getElementById('add-client-birthday').value,
        'Intake Date': new Date().toLocaleDateString(),
        'ClientID': `C-${Date.now()}`
    };

    try {
        await writeData('Clients', clientData);
        statusDiv.textContent = 'Client added successfully!';
        await refreshData();
        setTimeout(() => { 
            elements.addClientModal.style.display = 'none';
        }, 1500);
    } catch (err) {
        statusDiv.textContent = `Error: ${err.message}`;
        console.error("Add client error:", err);
    }
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
        let cardContent = `<h3>${row[headers.indexOf('First Name')] || 'No Name'} ${row[headers.indexOf('Last Name')] || ''}</h3>`;
        state.visibleClientColumns.forEach(headerText => {
            if (headerText !== 'First Name' && headerText !== 'Last Name') {
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
    if(elements.clientViewToggleBtn) {
        elements.clientViewToggleBtn.textContent = view === 'list' ? 'Card View' : 'List View';
    }
    renderClients();
}

function handleSaveColumns() {
    updateState({ visibleClientColumns: Array.from(document.querySelectorAll('#client-column-checkboxes input:checked')).map(cb => cb.value) });
    const modal = document.getElementById('client-column-modal');
    if (modal) modal.style.display = 'none';
    renderClients();
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
        const displayHeaders = ['First Name', 'Last Name', 'Email', 'Phone', 'Organization', 'Status', 'Lead Source', 'Address', 'Social Media', 'Birthday', 'Intake Date'];
        let contentHtml = '<div class="form-grid-condensed">';
        displayHeaders.forEach(h => {
            const val = localState.currentRowData[headers.indexOf(h)] || '';
            const inputId = `client-edit-${h.replace(/\s+/g, '')}`;
            
            let fieldHtml = `<div class="form-field"><label for="${inputId}">${h}</label>`;
            
            if (localState.isEditMode) {
                if (h === 'Status') {
                    fieldHtml += `<select id="${inputId}">
                        <option value="Lead" ${val === 'Lead' ? 'selected' : ''}>Lead</option>
                        <option value="Active" ${val === 'Active' ? 'selected' : ''}>Active</option>
                        <option value="On Hold" ${val === 'On Hold' ? 'selected' : ''}>On Hold</option>
                        <option value="Past" ${val === 'Past' ? 'selected' : ''}>Past</option>
                    </select>`;
                } else if (h === 'Birthday' || h === 'Intake Date') {
                     fieldHtml += `<input type="date" id="${inputId}" value="${val}">`;
                } else {
                    fieldHtml += `<input type="text" id="${inputId}" value="${val}">`;
                }
            } else {
                fieldHtml += `<p>${val || 'N/A'}</p>`;
            }
            contentHtml += fieldHtml + `</div>`;
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
        const fields = ['First Name', 'Last Name', 'Email', 'Phone', 'Organization', 'Status', 'Lead Source', 'Address', 'Social Media', 'Birthday', 'Intake Date', 'Notes', 'Contact Logs'];
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
            await refreshData();
            
            // Immediately update local state for a faster UI feel
            const updatedRowIndex = allClients.rows.findIndex(r => r[allClients.headers.indexOf('ClientID')] === clientId);
            if(updatedRowIndex > -1) {
                const newRow = [...allClients.rows[updatedRowIndex]];
                Object.keys(dataToUpdate).forEach(key => {
                    const headerIndex = headers.indexOf(key);
                    if (headerIndex > -1) newRow[headerIndex] = dataToUpdate[key];
                });
                localState.currentRowData = newRow;
            }
            
            statusSpan.textContent = 'Saved successfully!';
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
            statusSpan.textContent = 'Client deleted.';
            await refreshData();
            setTimeout(() => { elements.deleteClientModal.style.display = 'none'; }, 1500);
        } catch (err) { statusSpan.textContent = 'Error deleting client.'; console.error('Delete client error:', err); confirmBtn.disabled = false; }
    };
}

