// js/ui.js
// Description: Handles DOM manipulation, UI setup, and event listeners for UI components.

export const elements = {};

/**
 * Caches frequently accessed DOM elements.
 */
export function cacheDOMElements() {
    // General App
    elements.authorizeButton = document.getElementById('authorize_button');
    elements.signoutButton = document.getElementById('signout_button');
    elements.appContainer = document.getElementById('app-container');
    elements.landingContainer = document.getElementById('landing-container');
    elements.loadingOverlay = document.getElementById('loading-overlay');
    elements.mainContentArea = document.querySelector('#app-container > main');
    elements.closeModalButtons = document.querySelectorAll('.close-button');

    // Requests Tab
    elements.serviceFilter = document.getElementById('service-filter');
    elements.statusFilter = document.getElementById('status-filter');
    elements.searchBar = document.getElementById('search-bar');
    elements.requestViewToggleBtn = document.getElementById('request-view-toggle-btn');
    elements.columnSelectBtn = document.getElementById('column-select-btn');
    elements.saveColumnsBtn = document.getElementById('save-columns-btn');

    // Clients Tab
    elements.clientSearchBar = document.getElementById('client-search-bar');
    elements.clientTableContainer = document.getElementById('client-table-container');
    elements.clientStatusFilter = document.getElementById('client-status-filter');
    elements.clientAddBtn = document.getElementById('add-client-btn');
    elements.addClientForm = document.getElementById('add-client-form');
    elements.clientViewToggleBtn = document.getElementById('client-view-toggle-btn');
    elements.clientColumnSelectBtn = document.getElementById('client-column-select-btn');

    // Projects Tab
    elements.projectSearchBar = document.getElementById('project-search-bar');

    // Costume Tab
    elements.costumeAddBtn = document.getElementById('add-costume-btn'); // FIX: Added this line
    elements.costumeSearchBar = document.getElementById('costume-search-bar');
    elements.costumeStatusFilter = document.getElementById('costume-status-filter');
    elements.costumeCategoryFilter = document.getElementById('costume-category-filter');
    
    // Equipment Tab
    elements.equipmentAddBtn = document.getElementById('add-equipment-btn'); // FIX: Added this line
    elements.equipmentSearchBar = document.getElementById('equipment-search-bar');
    elements.equipmentStatusFilter = document.getElementById('equipment-status-filter');
    elements.equipmentCategoryFilter = document.getElementById('equipment-category-filter');

    // Modals
    elements.detailsModal = document.getElementById('details-modal');
    elements.columnModal = document.getElementById('column-modal');
    elements.clientColumnModal = document.getElementById('client-column-modal');
    elements.clientDetailsModal = document.getElementById('client-details-modal');
    elements.addClientModal = document.getElementById('add-client-modal');
    elements.createProjectModal = document.getElementById('create-project-modal');
    elements.taskDetailsModal = document.getElementById('task-details-modal');
    elements.deleteClientModal = document.getElementById('delete-client-modal');
    elements.deleteProjectModal = document.getElementById('delete-project-modal');
    elements.gdriveLinkModal = document.getElementById('gdrive-link-modal');
    
    // Inventory Modals
    elements.costumeModal = document.getElementById('costume-modal');
    elements.costumeModalForm = document.getElementById('costume-modal-form');
    elements.costumeImageUpload = document.getElementById('costume-image-upload');
    elements.equipmentModal = document.getElementById('equipment-modal');
    elements.equipmentModalForm = document.getElementById('equipment-modal-form');
    elements.equipmentImageUpload = document.getElementById('equipment-image-upload');
}

/**
 * Sets up the main tab navigation.
 */
export function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Set initial state based on the 'active' class in HTML
    const initiallyActiveTab = document.querySelector('.tab-button.active')?.dataset.tab || 'requests';
    tabContents.forEach(content => {
        content.style.display = (content.id === `tab-${initiallyActiveTab}`) ? 'block' : 'none';
    });
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            if (button.classList.contains('active')) return; // Do nothing if already active

            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
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
 * @param {string} modalId - The ID of the modal to show.
 * @param {string} containerId - The ID of the container element for the checkboxes.
 */
export function showColumnModal(headers, visibleColumns, modalId, containerId) {
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
    
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
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

