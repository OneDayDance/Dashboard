// js/ui.js
// Description: Handles DOM manipulation, UI setup, and event listeners for UI components.

export const elements = {};

/**
 * Caches frequently accessed DOM elements.
 */
export function cacheDOMElements() {
    elements.authorizeButton = document.getElementById('authorize_button');
    elements.signoutButton = document.getElementById('signout_button');
    elements.appContainer = document.getElementById('app-container');
    elements.addClientModal = document.getElementById('add-client-modal');
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
    elements.modalSaveNoteBtn = document.getElementById('modal-save-note-btn');
    elements.archiveToggle = document.getElementById('archive-toggle');
    elements.archiveContainer = document.getElementById('archived-requests-container');
    elements.columnSelectBtn = document.getElementById('column-select-btn');
    elements.saveColumnsBtn = document.getElementById('save-columns-btn');
    elements.landingContainer = document.getElementById('landing-container');
    elements.clientSearchBar = document.getElementById('client-search-bar');
    elements.clientTableContainer = document.getElementById('client-table-container');
    elements.clientStatusFilter = document.getElementById('client-status-filter');
    elements.clientViewToggleBtn = document.getElementById('client-view-toggle-btn');
    elements.clientColumnSelectBtn = document.getElementById('client-column-select-btn');
    elements.projectSearchBar = document.getElementById('project-search-bar');
    elements.loadingOverlay = document.getElementById('loading-overlay');
    elements.mainContentArea = document.querySelector('#app-container > main'); // A bit generic, might need refinement
    
    // Inventory elements
    elements.costumeModal = document.getElementById('costume-modal');
    elements.equipmentModal = document.getElementById('equipment-modal');
}

/**
 * Sets up the main tab navigation.
 */
export function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Set initial state
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

    // Dynamically import and call the render function for the active tab
    // This avoids circular dependencies and keeps concerns separated.
    import('../js/requests.js').then(module => {
        if (activeTab === 'requests') module.renderRequests();
    });
    import('../js/analytics.js').then(module => {
        if (activeTab === 'analytics') module.renderAnalytics();
    });
    import('../js/clients.js').then(module => {
        if (activeTab === 'clients') module.renderClients();
    });
    import('../js/projects.js').then(module => {
        if (activeTab === 'projects') module.renderProjectsTab();
    });
    import('../js/costumes.js').then(module => {
        if (activeTab === 'costumes') module.renderCostumes();
    });
    import('../js/equipment.js').then(module => {
        if (activeTab === 'equipment') module.renderEquipment();
    });
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

    // Also close modals if the user clicks on the background overlay
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
}

/**
 * Populates a checkbox list for selecting visible columns.
 * @param {string[]} headers - All available column headers.
 * @param {string[]} visibleColumns - The headers that should be checked.
 * @param {string} containerId - The ID of the container element for the checkboxes.
 */
export function showColumnModal(headers, visibleColumns, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = ''; // Clear previous checkboxes
    headers.forEach(header => {
        if (!header) return; // Skip empty headers
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
    
    // Show the parent modal
    container.closest('.modal').style.display = 'block';
}

// --- LOADING AND ERROR INDICATORS ---
export function showLoadingIndicator() {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.display = 'flex';
    }
}

export function hideLoadingIndicator() {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.display = 'none';
    }
}

export function showMainError(message) {
    // Hide all main tab content
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });

    // Create a dedicated error display area if it doesn't exist
    let errorContainer = document.getElementById('main-error-container');
    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.id = 'main-error-container';
        errorContainer.className = 'card'; // Use existing card styling
        errorContainer.style.margin = '20px';
        errorContainer.style.padding = '20px';
        errorContainer.style.color = '#721c24'; // Error text color
        errorContainer.style.backgroundColor = '#f8d7da'; // Error background color
        elements.appContainer.appendChild(errorContainer);
    }
    
    errorContainer.innerHTML = `<h2>An Error Occurred</h2><p>${message}</p>`;
    errorContainer.style.display = 'block';
}

