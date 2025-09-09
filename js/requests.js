// js/requests.js
// Description: Contains all logic for the 'Requests' tab.

import { state, allRequests, allClients, sortableColumns, updateState, updateFilters } from './state.js';
import { updateSheetRow, writeData } from './api.js';
import { showColumnModal, elements } from './ui.js';
import { showCreateProjectModal } from './projects.js';

// --- STATE & EVENT HANDLERS ---
export function initRequestsTab() {
    document.getElementById('service-filter').onchange = (e) => { updateFilters('service', e.target.value); renderRequests(); };
    document.getElementById('status-filter').onchange = (e) => { updateFilters('status', e.target.value); renderRequests(); };
    document.getElementById('search-bar').oninput = (e) => { updateState({ searchTerm: e.target.value.toLowerCase() }); renderRequests(); };
    document.getElementById('request-view-toggle-btn').onclick = toggleRequestView;
    document.getElementById('column-select-btn').onclick = () => showColumnModal('requests');
    document.getElementById('save-columns-btn').onclick = handleSaveColumns;
    document.getElementById('archive-toggle').onclick = (e) => {
        e.currentTarget.classList.toggle('collapsed');
        document.getElementById('archived-requests-container').classList.toggle('collapsed');
    };
}

// --- RENDERING ---
export function renderRequests() {
    if (!allRequests.rows || allRequests.rows.length === 0) {
        document.getElementById('requests-container').innerHTML = '<p>No submissions found.</p>';
        document.getElementById('archived-requests-container').innerHTML = '';
        return;
    }

    const processedRows = getProcessedRequests();

    const statusIndex = allRequests.headers.indexOf('Status');
    const newRequests = [], archivedRequests = [];
    processedRows.forEach(row => {
        const isArchived = row[statusIndex] === 'Archived';
        if (state.filters.status === 'all') {
            if (isArchived) archivedRequests.push(row); else newRequests.push(row);
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

// --- LOGIC ---
function getProcessedRequests() {
    let { headers, rows } = allRequests;
    let processedRows = [...rows];

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

    return processedRows;
}

function handleSort(event) {
    const newSortColumn = event.target.dataset.sort;
    if (state.sortColumn === newSortColumn) {
        updateState({ sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc' });
    } else {
        updateState({ sortColumn: newSortColumn, sortDirection: 'asc' });
    }
    renderRequests();
}

async function handleStatusChange(event, rowIndex) {
    const newStatus = event.target.value;
    event.target.disabled = true;
    try {
        const submissionId = allRequests.rows[rowIndex][allRequests.headers.indexOf('Submission ID')];
        await updateSheetRow('Submissions', 'Submission ID', submissionId, { 'Status': newStatus });
        allRequests.rows[rowIndex][allRequests.headers.indexOf('Status')] = newStatus;
        renderRequests();
    } catch (err) {
        alert('Could not update status.');
        console.error("Status Update Error:", err);
        event.target.disabled = false;
    }
}

function toggleRequestView() {
    updateState({ currentView: state.currentView === 'list' ? 'card' : 'list' });
    document.getElementById('request-view-toggle-btn').textContent = state.currentView === 'list' ? 'Card View' : 'List View';
    renderRequests();
}

function handleSaveColumns() {
    updateState({ visibleColumns: Array.from(document.querySelectorAll('#column-checkboxes input:checked')).map(cb => cb.value) });
    elements.columnModal.style.display = 'none';
    renderRequests();
}

// --- MODAL FUNCTIONS ---
export function showRequestDetailsModal(rowData, headers) {
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
    noteStatus.textContent = '';
    notesTextarea.value = rowData[headers.indexOf('Notes')] || '';
    document.getElementById('modal-save-note-btn').onclick = () => handleSaveNote(originalIndex);

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

        if (!clientExists) {
            if (actionStatus.textContent === "") { // Don't overwrite other statuses
                actionStatus.textContent = "Create client before making project.";
            }
            createProjectBtn.onclick = null;
        } else {
            createProjectBtn.onclick = () => {
                const client = allClients.rows.find(c => c[allClients.headers.indexOf('Email')] === submissionEmail);
                elements.detailsModal.style.display = 'none';
                showCreateProjectModal(client, allClients.headers, rowData[headers.indexOf('Submission ID')]);
            };
        }
    }

    elements.detailsModal.style.display = 'block';
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
    } catch (err) {
        noteStatus.textContent = 'Error saving note.';
        console.error("Save Note Error:", err);
    }
}

async function handleCreateClient(submissionRow, submissionHeaders) {
    const actionStatus = document.getElementById('modal-request-actions-status');
    actionStatus.textContent = 'Creating client...';
    const fullName = submissionRow[submissionHeaders.indexOf('Full Name')] || '';
    const nameParts = fullName.split(' ');
    const clientData = {
        'First Name': nameParts[0],
        'Last Name': nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
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
        actionStatus.textContent = 'Client created successfully!';
        // Data will be reloaded on next tab switch or manually
        setTimeout(() => elements.detailsModal.style.display = 'none', 1500);
    } catch (err) {
        actionStatus.textContent = `Error: ${err.result.error.message}`;
    }
}

