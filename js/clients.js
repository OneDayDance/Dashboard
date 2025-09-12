// js/clients.js
// Description: This file contains all the functions for managing clients in the dashboard.

import { SPREADSHEET_ID } from './config.js';
import { updateSheetRow, writeData, clearSheetRow } from './api.js';
import { showModal, hideModal, createTable, createCard, clearContainer, formatDate, sanitizeHTML } from './utils.js';
import { state, allClients } from './state.js';

// --- STATE ---
let currentView = 'table'; // 'table' or 'card'
let visibleColumns = ['Name', 'Email', 'Phone', 'Status', 'Organization', 'Lead Source', 'Date Added'];

// --- CACHED ELEMENTS ---
const elements = {};

/**
 * Caches the DOM elements for the clients tab to avoid repeated lookups.
 */
function cacheDOMElements() {
    elements.clientTableContainer = document.getElementById('client-table-container');
    elements.clientSearchBar = document.getElementById('client-search-bar');
    elements.clientStatusFilter = document.getElementById('client-status-filter');
    elements.addClientBtn = document.getElementById('add-client-btn');
    elements.addClientModal = document.getElementById('add-client-modal');
    elements.addClientForm = document.getElementById('add-client-form');
    elements.addClientModalStatus = document.getElementById('add-client-modal-status');
    elements.clientDetailsModal = document.getElementById('client-details-modal');
    elements.clientModalName = document.getElementById('client-modal-name');
    elements.clientModalStatus = document.getElementById('client-modal-status');
    elements.clientModalPaneContent = document.querySelector('#client-details-modal .modal-pane-content');
    elements.clientModalNav = document.querySelector('#client-details-modal .modal-nav');
    elements.deleteClientModal = document.getElementById('delete-client-modal');
    elements.deleteConfirmInput = document.getElementById('delete-confirm-input');
    elements.deleteConfirmBtn = document.getElementById('delete-confirm-btn');
    elements.deleteClientStatus = document.getElementById('delete-client-status');
    elements.clientViewToggleBtn = document.getElementById('client-view-toggle-btn');
    elements.clientColumnSelectBtn = document.getElementById('client-column-select-btn');
    elements.clientColumnModal = document.getElementById('client-column-modal');
    elements.clientColumnCheckboxes = document.getElementById('client-column-checkboxes');
    elements.saveClientColumnsBtn = document.getElementById('save-client-columns-btn');
}


/**
 * Initializes the clients tab with event listeners and initial data rendering.
 */
export function initClientsTab(refreshDataCallback) {
    const clientSearchBar = document.getElementById('client-search-bar');
    const clientStatusFilter = document.getElementById('client-status-filter');
    const addClientBtn = document.getElementById('add-client-btn');
    const clientViewToggleBtn = document.getElementById('client-view-toggle-btn');
    const clientColumnSelectBtn = document.getElementById('client-column-select-btn');
    const addClientForm = document.getElementById('add-client-form');
    
    if (clientSearchBar) clientSearchBar.addEventListener('input', renderClients);
    if (clientStatusFilter) clientStatusFilter.addEventListener('change', renderClients);
    if (addClientBtn) addClientBtn.addEventListener('click', () => showModal('add-client-modal'));
    if (clientViewToggleBtn) clientViewToggleBtn.addEventListener('click', toggleClientView);
    if (clientColumnSelectBtn) clientColumnSelectBtn.addEventListener('click', () => showModal('client-column-modal'));

    if (addClientForm) {
        // Prevent multiple listeners by removing old one if it exists
        const newForm = addClientForm.cloneNode(true);
        addClientForm.parentNode.replaceChild(newForm, addClientForm);
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await addNewClient();
            await refreshDataCallback();
        });
    }
    
    setupClientColumnSelector();
}

/**
 * Adds a new client to the spreadsheet.
 */
async function addNewClient() {
    cacheDOMElements();
    elements.addClientModalStatus.textContent = 'Adding client...';
    try {
        const newClient = {
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
            'Date Added': new Date().toISOString().split('T')[0], // YYYY-MM-DD
            'Last Contacted': '',
            'Total Value': 0,
            'Notes': '',
            'Client ID': `C${Date.now()}` // Generate a unique ID
        };
        await writeData('Clients', newClient);
        elements.addClientModalStatus.textContent = 'Client added successfully!';
        elements.addClientForm.reset();
        setTimeout(() => {
            hideModal('add-client-modal');
            elements.addClientModalStatus.textContent = '';
        }, 1500);
    } catch (error) {
        console.error('Error adding client:', error);
        elements.addClientModalStatus.textContent = `Error: ${error.message}`;
    }
}

/**
 * Renders the list of clients in the UI based on current filters and view.
 */
export function renderClients() {
    cacheDOMElements();
    const clients = allClients.rows;
    if (!clients) {
        console.warn("Client data is not available yet.");
        return;
    }
    
    const searchTerm = elements.clientSearchBar ? elements.clientSearchBar.value.toLowerCase() : '';
    const statusFilter = elements.clientStatusFilter ? elements.clientStatusFilter.value : 'all';

    const filteredClients = clients.filter(client => {
        const matchesSearch = Object.values(client).some(val =>
            String(val).toLowerCase().includes(searchTerm)
        );
        const matchesStatus = statusFilter === 'all' || client[allClients.headers.indexOf('Status')] === statusFilter;
        return matchesSearch && matchesStatus;
    });

    clearContainer(elements.clientTableContainer);

    if (currentView === 'table') {
        renderClientTable(filteredClients);
    } else {
        renderClientCards(filteredClients);
    }
}

/**
 * Renders the client data as a table.
 * @param {Array} clients - The filtered list of clients to render.
 */
function renderClientTable(clients) {
    cacheDOMElements();
    const headers = visibleColumns.includes('Name') ? visibleColumns.filter(h => h !== 'Name').concat(['First Name', 'Last Name']) : visibleColumns;
    
    // Combine First Name and Last Name for display if 'Name' is a visible column
    const displayData = clients.map(client => {
        const clientCopy = { };
        for(let i=0; i < allClients.headers.length; i++) {
            clientCopy[allClients.headers[i]] = client[i];
        }
        if (visibleColumns.includes('Name')) {
            clientCopy['Name'] = `${client[allClients.headers.indexOf('First Name')] || ''} ${client[allClients.headers.indexOf('Last Name')] || ''}`.trim();
        }
        return clientCopy;
    });
    
    const table = createTable(displayData, visibleColumns, 'Client ID', openClientDetailsModal);
    elements.clientTableContainer.appendChild(table);
}

/**
 * Renders the client data as cards.
 * @param {Array} clients - The filtered list of clients to render.
 */
function renderClientCards(clients) {
    cacheDOMElements();
    if (clients.length === 0) {
        elements.clientTableContainer.innerHTML = '<p>No clients found.</p>';
        return;
    }

    const cardContainer = document.createElement('div');
    cardContainer.className = 'card-view-container';

    clients.forEach(client => {
        const clientObj = {};
         for(let i=0; i < allClients.headers.length; i++) {
            clientObj[allClients.headers[i]] = client[i];
        }
        const title = `${clientObj['First Name']} ${clientObj['Last Name']}`;
        const details = {
            'Email': clientObj['Email'],
            'Phone': clientObj['Phone'],
            'Status': `<span class="status-badge status-${clientObj['Status']?.toLowerCase().replace(/\s+/g, '-')}">${clientObj['Status']}</span>`
        };
        const card = createCard(title, details, 'client-id', clientObj['Client ID'], openClientDetailsModal);
        cardContainer.appendChild(card);
    });

    elements.clientTableContainer.appendChild(cardContainer);
}


/**
 * Toggles between table and card view for clients.
 */
function toggleClientView() {
    cacheDOMElements();
    currentView = currentView === 'table' ? 'card' : 'table';
    elements.clientViewToggleBtn.textContent = currentView === 'table' ? 'Card View' : 'Table View';
    renderClients();
}

async function getClientById(clientId) {
    const clientRow = allClients.rows.find(client => client[allClients.headers.indexOf('Client ID')] === clientId);
    if (!clientRow) return null;
    const clientObj = {};
    for(let i=0; i < allClients.headers.length; i++) {
        clientObj[allClients.headers[i]] = clientRow[i];
    }
    return clientObj;
}

/**
 * Opens the client details modal and populates it with data.
 * @param {string} clientId - The ID of the client to display.
 */
export async function openClientDetailsModal(clientId) {
    cacheDOMElements();
    const client = await getClientById(clientId);
    if (!client) {
        alert('Client not found!');
        return;
    }

    state.currentClient = client;
    elements.clientModalName.textContent = `${client['First Name']} ${client['Last Name']}`;
    
    // Reset tabs to the default 'details' view
    elements.clientModalNav.querySelectorAll('.modal-nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.tab === 'details') {
            link.classList.add('active');
        }
    });

    renderClientDetailsPane('details'); 

    // Setup tab navigation
    elements.clientModalNav.onclick = (e) => {
        e.preventDefault();
        if (e.target.classList.contains('modal-nav-link')) {
            elements.clientModalNav.querySelectorAll('.modal-nav-link').forEach(link => link.classList.remove('active'));
            e.target.classList.add('active');
            renderClientDetailsPane(e.target.dataset.tab);
        }
    };

    showModal('client-details-modal');
}

/**
 * Renders the content for the selected tab within the client details modal.
 * @param {string} tabName - The name of the tab to render ('details', 'history', etc.).
 */
function renderClientDetailsPane(tabName) {
    cacheDOMElements();
    const client = state.currentClient;
    if (!client) return;

    clearContainer(elements.clientModalPaneContent);

    switch (tabName) {
        case 'details':
            renderClientDetails(client);
            break;
        case 'history':
            renderClientHistory(client);
            break;
        case 'notes':
            renderClientNotes(client);
            break;
        case 'financials':
            renderClientFinancials(client);
            break;
        case 'actions':
            renderClientActions(client);
            break;
        default:
            elements.clientModalPaneContent.innerHTML = `<p>Coming soon.</p>`;
    }
}

/**
 * Renders the main details form for a client.
 * @param {Object} client - The client data object.
 */
function renderClientDetails(client) {
    cacheDOMElements();
    const formHTML = `
        <form id="edit-client-form" class="details-form">
            <div class="form-grid">
                <div class="form-field"><label>First Name</label><input type="text" name="First Name" value="${sanitizeHTML(client['First Name'] || '')}"></div>
                <div class="form-field"><label>Last Name</label><input type="text" name="Last Name" value="${sanitizeHTML(client['Last Name'] || '')}"></div>
                <div class="form-field"><label>Email</label><input type="email" name="Email" value="${sanitizeHTML(client['Email'] || '')}"></div>
                <div class="form-field"><label>Phone</label><input type="text" name="Phone" value="${sanitizeHTML(client['Phone'] || '')}"></div>
                <div class="form-field"><label>Organization</label><input type="text" name="Organization" value="${sanitizeHTML(client['Organization'] || '')}"></div>
                <div class="form-field">
                    <label>Status</label>
                    <select name="Status">
                        <option ${client['Status'] === 'Lead' ? 'selected' : ''}>Lead</option>
                        <option ${client['Status'] === 'Active' ? 'selected' : ''}>Active</option>
                        <option ${client['Status'] === 'On Hold' ? 'selected' : ''}>On Hold</option>
                        <option ${client['Status'] === 'Past' ? 'selected' : ''}>Past</option>
                    </select>
                </div>
                <div class="form-field"><label>Lead Source</label><input type="text" name="Lead Source" value="${sanitizeHTML(client['Lead Source'] || '')}"></div>
                <div class="form-field"><label>Address</label><input type="text" name="Address" value="${sanitizeHTML(client['Address'] || '')}"></div>
                <div class="form-field"><label>Social Media</label><input type="url" name="Social Media" value="${sanitizeHTML(client['Social Media'] || '')}"></div>
                <div class="form-field"><label>Birthday</label><input type="date" name="Birthday" value="${sanitizeHTML(client['Birthday'] || '')}"></div>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Save Changes</button>
                <span id="edit-client-status"></span>
            </div>
        </form>
    `;
    elements.clientModalPaneContent.innerHTML = formHTML;

    document.getElementById('edit-client-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const statusEl = document.getElementById('edit-client-status');
        statusEl.textContent = 'Saving...';
        
        const formData = new FormData(e.target);
        const updatedData = Object.fromEntries(formData.entries());

        try {
            await updateSheetRow('Clients', 'Client ID', client['Client ID'], updatedData);
            statusEl.textContent = 'Saved successfully!';
            // Refresh local state
            const clientIndex = allClients.rows.findIndex(c => c[allClients.headers.indexOf('Client ID')] === client['Client ID']);
            if(clientIndex > -1) {
                for(const key in updatedData) {
                    const headerIndex = allClients.headers.indexOf(key);
                    if(headerIndex > -1) {
                        allClients.rows[clientIndex][headerIndex] = updatedData[key];
                    }
                }
            }
            renderClients(); // Re-render the main client list
            setTimeout(() => statusEl.textContent = '', 2000);
        } catch (error) {
            statusEl.textContent = `Error: ${error.message}`;
        }
    });
}

/**
 * Renders the project and request history for a client.
 * @param {Object} client - The client data object.
 */
function renderClientHistory(client) {
    cacheDOMElements();
    const clientProjects = allProjects.rows.filter(p => p[allProjects.headers.indexOf('Client ID')] === client['Client ID']);
    const clientRequests = allRequests.rows.filter(r => r[allRequests.headers.indexOf('Email')] === client['Email']);

    let historyHTML = '<h3>Associated Projects</h3>';
    if (clientProjects.length > 0) {
        historyHTML += '<ul>';
        clientProjects.forEach(p => {
            const projectObj = {};
            for(let i=0; i < allProjects.headers.length; i++) {
                projectObj[allProjects.headers[i]] = p[i];
            }
            historyHTML += `<li><strong>${sanitizeHTML(projectObj['Project Name'])}</strong> - Status: ${sanitizeHTML(projectObj['Status'])} (Value: $${projectObj['Project Value'] || 0})</li>`;
        });
        historyHTML += '</ul>';
    } else {
        historyHTML += '<p>No projects found for this client.</p>';
    }

    historyHTML += '<h3>Associated Requests</h3>';
    if (clientRequests.length > 0) {
        historyHTML += '<ul>';
        clientRequests.forEach(r => {
             const requestObj = {};
            for(let i=0; i < allRequests.headers.length; i++) {
                requestObj[allRequests.headers[i]] = r[i];
            }
            historyHTML += `<li><strong>${sanitizeHTML(requestObj['Primary Service Category'])}</strong> - Submitted: ${formatDate(requestObj['Submission Date'])}</li>`;
        });
        historyHTML += '</ul>';
    } else {
        historyHTML += '<p>No service requests found for this client.</p>';
    }

    elements.clientModalPaneContent.innerHTML = historyHTML;
}

/**
 * Renders the notes and logs for a client.
 * @param {Object} client - The client data object.
 */
function renderClientNotes(client) {
    cacheDOMElements();
    const notes = client['Notes'] || '';
    const notesHTML = `
        <h3>Notes & Communication Log</h3>
        <textarea id="client-notes-textarea" class="notes-textarea">${sanitizeHTML(notes)}</textarea>
        <div class="form-actions">
            <button id="save-notes-btn" class="btn btn-primary">Save Notes</button>
            <span id="save-notes-status"></span>
        </div>
    `;
    elements.clientModalPaneContent.innerHTML = notesHTML;

    document.getElementById('save-notes-btn').addEventListener('click', async () => {
        const statusEl = document.getElementById('save-notes-status');
        statusEl.textContent = 'Saving...';
        const newNotes = document.getElementById('client-notes-textarea').value;
        try {
            await updateSheetRow('Clients', 'Client ID', client['Client ID'], { 'Notes': newNotes });
            statusEl.textContent = 'Notes saved!';
            // Update local state
            client['Notes'] = newNotes;
            setTimeout(() => statusEl.textContent = '', 2000);
        } catch (error) {
            statusEl.textContent = `Error: ${error.message}`;
        }
    });
}


/**
 * Renders the financial information for a client.
 * @param {Object} client - The client data object.
 */
function renderClientFinancials(client) {
    cacheDOMElements();
    const clientProjects = allProjects.rows.filter(p => p[allProjects.headers.indexOf('Client ID')] === client['Client ID']);
    const totalValue = clientProjects.reduce((sum, p) => sum + (parseFloat(p[allProjects.headers.indexOf('Project Value')]) || 0), 0);

    const financialsHTML = `
        <h3>Financial Overview</h3>
        <div class="kpi-grid">
            <div class="kpi-card info-card">
                <h3>Total Project Value</h3>
                <p>$${totalValue.toFixed(2)}</p>
            </div>
            <div class="kpi-card info-card">
                <h3>Total Projects</h3>
                <p>${clientProjects.length}</p>
            </div>
        </div>
        <h4>Project Breakdown</h4>
        <div class="table-responsive-container">
            <table>
                <thead>
                    <tr><th>Project Name</th><th>Status</th><th>Value</th><th>Start Date</th></tr>
                </thead>
                <tbody>
                    ${clientProjects.map(p => {
                         const projectObj = {};
                        for(let i=0; i < allProjects.headers.length; i++) {
                            projectObj[allProjects.headers[i]] = p[i];
                        }
                        return `
                        <tr>
                            <td>${sanitizeHTML(projectObj['Project Name'])}</td>
                            <td>${sanitizeHTML(projectObj['Status'])}</td>
                            <td>$${(parseFloat(projectObj['Project Value']) || 0).toFixed(2)}</td>
                            <td>${formatDate(projectObj['Start Date'])}</td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>
    `;
    elements.clientModalPaneContent.innerHTML = financialsHTML;
}

/**
 * Renders the action buttons for a client.
 * @param {Object} client - The client data object.
 */
function renderClientActions(client) {
    cacheDOMElements();
    const actionsHTML = `
        <h3>Client Actions</h3>
        <div class="actions-container">
            <button id="create-project-from-client-btn" class="btn btn-secondary">Create New Project</button>
            <button id="delete-client-btn" class="btn btn-danger">Delete Client</button>
        </div>
    `;
    elements.clientModalPaneContent.innerHTML = actionsHTML;

    document.getElementById('create-project-from-client-btn').addEventListener('click', () => {
        // Pre-fill and open the create project modal
        document.getElementById('project-client-name').value = `${client['First Name']} ${client['Last Name']} (ID: ${client['Client ID']})`;
        // You might want a more robust way to link client to project, like storing the ID in a hidden input
        showModal('create-project-modal');
    });

    document.getElementById('delete-client-btn').addEventListener('click', () => {
        handleDeleteClientClick(client['Client ID']);
    });
}

/**
 * Handles the click event for the delete client button.
 * @param {string} clientId - The ID of the client to delete.
 */
function handleDeleteClientClick(clientId) {
    cacheDOMElements();
    showModal('delete-client-modal');
    elements.deleteConfirmInput.value = '';
    elements.deleteConfirmBtn.disabled = true;

    // Use a clone to remove old event listeners before adding a new one
    const newDeleteBtn = elements.deleteConfirmBtn.cloneNode(true);
    elements.deleteConfirmBtn.parentNode.replaceChild(newDeleteBtn, elements.deleteConfirmBtn);
    elements.deleteConfirmBtn = newDeleteBtn;

    elements.deleteConfirmInput.oninput = () => {
        elements.deleteConfirmBtn.disabled = elements.deleteConfirmInput.value !== 'Delete';
    };

    elements.deleteConfirmBtn.onclick = async () => {
        elements.deleteClientStatus.textContent = 'Deleting...';
        try {
            await clearSheetRow('Clients', 'Client ID', clientId);
            elements.deleteClientStatus.textContent = 'Client deleted successfully.';
            
            // Remove from local state
            allClients.rows = allClients.rows.filter(c => c[allClients.headers.indexOf('Client ID')] !== clientId);
            
            setTimeout(() => {
                hideModal('delete-client-modal');
                hideModal('client-details-modal');
                elements.deleteClientStatus.textContent = '';
                renderClients();
            }, 1500);

        } catch (error) {
            elements.deleteClientStatus.textContent = `Error: ${error.message}`;
        }
    };
}


/**
 * Sets up the column selector modal for the client table.
 */
function setupClientColumnSelector() {
    cacheDOMElements();
    const allColumns = [
        'Name', 'Email', 'Phone', 'Status', 'Organization', 
        'Lead Source', 'Date Added', 'Last Contacted', 'Total Value',
        'Address', 'Social Media', 'Birthday'
    ];
    
    clearContainer(elements.clientColumnCheckboxes);

    allColumns.forEach(col => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'checkbox-container';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `col-${col.replace(/\s+/g, '-')}`;
        checkbox.value = col;
        checkbox.checked = visibleColumns.includes(col);
        
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = col;

        checkboxDiv.appendChild(checkbox);
        checkboxDiv.appendChild(label);
        elements.clientColumnCheckboxes.appendChild(checkboxDiv);
    });

    elements.saveClientColumnsBtn.onclick = () => {
        const selectedColumns = [];
        elements.clientColumnCheckboxes.querySelectorAll('input:checked').forEach(cb => {
            selectedColumns.push(cb.value);
        });
        visibleColumns = selectedColumns;
        renderClients();
        hideModal('client-column-modal');
    };
}