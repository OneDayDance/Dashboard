// js/ui.js
// Description: Handles DOM manipulation, UI setup, and event listeners for UI components.
import { showToast, hideToast } from './toast.js';

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
    elements.mainContentArea = document.querySelector('#app-container > main');
    elements.closeModalButtons = document.querySelectorAll('.close-button');

    // Requests Tab
    elements.serviceFilter = document.getElementById('service-filter');
    elements.statusFilter = document.getElementById('status-filter');
    elements.searchBar = document.getElementById('search-bar');
    elements.requestViewToggleBtn = document.getElementById('request-view-toggle-btn');
    elements.archiveToggle = document.getElementById('archive-toggle');
    elements.archiveContainer = document.getElementById('archived-requests-container');
    elements.columnSelectBtn = document.getElementById('column-select-btn');
    
    // Clients Tab
    elements.addClientBtn = document.getElementById('add-client-btn');
    elements.clientSearchBar = document.getElementById('client-search-bar');
    elements.clientTableContainer = document.getElementById('client-table-container');
    elements.clientStatusFilter = document.getElementById('client-status-filter');
    elements.clientViewToggleBtn = document.getElementById('client-view-toggle-btn');
    elements.clientColumnSelectBtn = document.getElementById('client-column-select-btn');

    // Projects Tab
    elements.projectSearchBar = document.getElementById('project-search-bar');

    // Costumes Tab
    elements.costumeAddBtn = document.getElementById('costume-add-btn');
    elements.costumeSearchBar = document.getElementById('costume-search-bar');
    elements.costumeStatusFilter = document.getElementById('costume-status-filter');
    elements.costumeCategoryFilter = document.getElementById('costume-category-filter');
    
    // Equipment Tab
    elements.equipmentAddBtn = document.getElementById('equipment-add-btn');
    elements.equipmentSearchBar = document.getElementById('equipment-search-bar');
    elements.equipmentStatusFilter = document.getElementById('equipment-status-filter');
    elements.equipmentCategoryFilter = document.getElementById('equipment-category-filter');

    // Staff Tab
    elements.staffAddBtn = document.getElementById('staff-add-btn');
    elements.staffSearchBar = document.getElementById('staff-search-bar');
    elements.staffSkillsFilter = document.getElementById('staff-skills-filter');

    // Modals
    elements.detailsModal = document.getElementById('details-modal');
    elements.columnModal = document.getElementById('column-modal');
    elements.clientDetailsModal = document.getElementById('client-details-modal');
    elements.createProjectModal = document.getElementById('create-project-modal');
    elements.taskDetailsModal = document.getElementById('task-details-modal');
    elements.deleteConfirmationModal = document.getElementById('delete-confirmation-modal');
    elements.clientColumnModal = document.getElementById('client-column-modal');
    elements.gdriveLinkModal = document.getElementById('gdrive-link-modal');
    elements.addClientModal = document.getElementById('add-client-modal');
    elements.costumeModal = document.getElementById('costume-modal');
    elements.equipmentModal = document.getElementById('equipment-modal');
    elements.staffModal = document.getElementById('staff-modal');
    elements.assignClientModal = document.getElementById('assign-client-modal');
    
    // Generic Assign Resource Modal
    elements.assignResourceModal = document.getElementById('assign-resource-modal');
    elements.assignResourceModalTitle = document.getElementById('assign-resource-modal-title');
    elements.assignResourceAvailableTitle = document.getElementById('assign-resource-available-title');
    elements.assignResourceSelectedTitle = document.getElementById('assign-resource-selected-title');
    elements.resourceSearchInput = document.getElementById('resource-search-input');
    elements.resourceSearchResults = document.getElementById('resource-search-results');
    elements.selectedResourceList = document.getElementById('selected-resource-list');
    elements.saveAssignedResourceBtn = document.getElementById('save-assigned-resource-btn');


    // Modal Forms & Inputs
    elements.addClientForm = document.getElementById('add-client-form');
    elements.costumeModalForm = document.getElementById('costume-modal-form');
    elements.equipmentModalForm = document.getElementById('equipment-modal-form');
    elements.staffModalForm = document.getElementById('staff-modal-form');
    elements.assignClientForm = document.getElementById('assign-client-form');
}

/**
 * Sets up the main tab navigation.
 * @param {Function} onTabClick - The function to call when a tab is clicked to render its content.
 */
export function setupTabs(onTabClick) {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Set initial state
    const initialTab = document.querySelector('.tab-button[data-tab="requests"]');
    if (initialTab) {
        initialTab.classList.add('active');
    }
    const initialContent = document.querySelector('#tab-requests');
    if (initialContent) {
        initialContent.style.display = 'block';
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const tabId = button.dataset.tab;
            tabContents.forEach(content => {
                content.style.display = (content.id === `tab-${tabId}`) ? 'block' : 'none';
            });
            if (onTabClick) {
                onTabClick(); // Call the central render function
            }
        });
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

/**
 * @deprecated This function is no longer in use and is kept for backward compatibility to avoid import errors.
 * The data loading and rendering logic has been moved to main.js and individual tab modules.
 */
export function loadDataForActiveTab() {
    console.warn("loadDataForActiveTab() is deprecated and should be removed from imports.");
}

/**
 * Shows the unified delete confirmation modal.
 * @param {string} title - The title for the modal (e.g., "Delete Client").
 * @param {string} message - The specific warning message.
 * @param {Function} onConfirm - The async function to call when the delete button is clicked.
 */
export function showDeleteConfirmationModal(title, message, onConfirm) {
    const modal = elements.deleteConfirmationModal;
    if (!modal) return;

    // Get elements
    const modalTitle = document.getElementById('delete-modal-title');
    const warningMessage = document.getElementById('delete-modal-warning-message');
    const confirmInput = document.getElementById('delete-modal-confirm-input');
    const confirmBtn = document.getElementById('delete-modal-confirm-btn');
    const statusSpan = document.getElementById('delete-modal-status');

    // Set content
    modalTitle.textContent = title;
    warningMessage.innerHTML = `<strong>Warning:</strong> ${message}`;
    confirmBtn.textContent = title.split(' ')[0]; // e.g., "Delete" from "Delete Client"

    // Reset state
    confirmInput.value = '';
    confirmBtn.disabled = true;
    statusSpan.textContent = '';
    confirmInput.oninput = () => {
        confirmBtn.disabled = confirmInput.value !== 'Delete';
    };

    // Set the confirm action
    confirmBtn.onclick = async () => {
        const deletingToast = showToast('Deleting...', -1, 'info');
        confirmBtn.disabled = true;
        confirmInput.disabled = true;
        try {
            await onConfirm();
            hideToast(deletingToast);
            showToast('Deleted successfully.', 3000, 'success');
            modal.style.display = 'none';
            confirmInput.disabled = false;
        } catch (err) {
            hideToast(deletingToast);
            showToast(`Error: ${err.message}`, 5000, 'error');
            statusSpan.textContent = `Error: ${err.message}`; // Also show in modal for clarity
            console.error('Deletion error:', err);
            confirmBtn.disabled = false;
            confirmInput.disabled = false;
        }
    };
    
    modal.style.display = 'block';
}
