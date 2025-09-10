// js/ui.js
// Description: Handles DOM manipulation, UI setup, and event listeners for UI components.

import { state, allRequests, allClients, allCostumes } from './state.js';

export const elements = {};

/**
 * Caches frequently accessed DOM elements.
 */
export function cacheDOMElements() {
    elements.authorizeButton = document.getElementById('authorize_button');
    elements.signoutButton = document.getElementById('signout_button');
    elements.appContainer = document.getElementById('app-container');
    elements.serviceFilter = document.getElementById('service-filter');
    elements.statusFilter = document.getElementById('status-filter');
    elements.searchBar = document.getElementById('search-bar');
    elements.detailsModal = document.getElementById('details-modal');
    elements.columnModal = document.getElementById('column-modal');
    elements.clientDetailsModal = document.getElementById('client-details-modal');
    elements.createProjectModal = document.getElementById('create-project-modal');
    elements.taskDetailsModal = document.getElementById('task-details-modal');
    elements.deleteClientModal = document.getElementById('delete-client-modal');
    elements.deleteProjectModal = document.getElementById('delete-project-modal');
    elements.clientColumnModal = document.getElementById('client-column-modal');
    elements.gdriveLinkModal = document.getElementById('gdrive-link-modal');
    elements.closeModalButtons = document.querySelectorAll('.close-button');
    elements.requestViewToggleBtn = document.getElementById('request-view-toggle-btn');
    elements.archiveToggle = document.getElementById('archive-toggle');
    elements.archiveContainer = document.getElementById('archived-requests-container');
    elements.columnSelectBtn = document.getElementById('column-select-btn');
    elements.saveColumnsBtn = document.getElementById('save-columns-btn');
    elements.landingContainer = document.getElementById('landing-container');
    elements.clientSearchBar = document.getElementById('client-search-bar');
    elements.clientTableContainer = document.getElementById('client-table-container');
    elements.clientStatusFilter = document.getElementById('client-status-filter');
    elements.clientTypeFilter = document.getElementById('client-type-filter');
    elements.clientViewToggleBtn = document.getElementById('client-view-toggle-btn');
    elements.clientColumnSelectBtn = document.getElementById('client-column-select-btn');
    elements.projectSearchBar = document.getElementById('project-search-bar');
    elements.loadingOverlay = document.getElementById('loading-overlay');
    elements.addClientModal = document.getElementById('add-client-modal');
    elements.costumeModal = document.getElementById('costume-modal');
    elements.equipmentModal = document.getElementById('equipment-modal');
}

/**
 * Sets up the main tab navigation.
 */
export function setupTabs() {
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

/**
 * Loads the appropriate data rendering function for the currently active tab.
 */
export function loadDataForActiveTab() {
    const activeTab = document.querySelector('.tab-button.active')?.dataset.tab;
    if (!activeTab) return;

    // This structure prevents circular dependencies.
    if (activeTab === 'requests') {
        import('./requests.js').then(module => module.renderRequests());
    } else if (activeTab === 'analytics') {
        import('./analytics.js').then(module => module.renderAnalytics());
    } else if (activeTab === 'clients') {
        import('./clients.js').then(module => module.renderClients());
    } else if (activeTab === 'projects') {
        import('./projects.js').then(module => module.renderProjectsTab());
    } else if (activeTab === 'costumes') {
        import('./costumes.js').then(module => module.renderCostumes());
    } else if (activeTab === 'equipment') {
        import('./equipment.js').then(module => module.renderEquipment());
    }
}

/**
 * Sets up event listeners for all modal close buttons.
 */
export function setupModalCloseButtons() {
    elements.closeModalButtons.forEach(btn => {
        btn.onclick = () => {
            btn.closest('.modal').style.display = 'none';
        };
    });
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
}

/**
 * Populates a checkbox list for selecting visible columns.
 */
export function showColumnModal(headers, visibleColumns, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    headers.forEach(header => {
        if (!header) return;
        const isChecked = visibleColumns.includes(header);
        const div = document.createElement('div');
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = header;
        checkbox.checked = isChecked;
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(header));
        div.appendChild(label);
        container.appendChild(div);
    });
    
    container.closest('.modal').style.display = 'block';
}

// --- LOADING AND ERROR INDICATORS ---
export function showLoadingIndicator() {
    if (elements.loadingOverlay) elements.loadingOverlay.style.display = 'flex';
}

export function hideLoadingIndicator() {
    if (elements.loadingOverlay) elements.loadingOverlay.style.display = 'none';
}

export function showMainError(message) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    let errorContainer = document.getElementById('main-error-container');
    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.id = 'main-error-container';
        errorContainer.className = 'card';
        errorContainer.style.margin = '20px';
        errorContainer.style.padding = '20px';
        errorContainer.style.color = '#721c24';
        errorContainer.style.backgroundColor = '#f8d7da';
        elements.appContainer.appendChild(errorContainer);
    }
    errorContainer.innerHTML = `<h2>An Error Occurred</h2><p>${message}</p>`;
    errorContainer.style.display = 'block';
}

