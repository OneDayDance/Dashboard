// js/equipment.js
// Description: This file contains all the functions for managing the equipment inventory.

import { appState } from './state.js';
import { clearContainer, showModal, hideModal, sanitizeHTML } from './utils.js';
import { updateSheetData, addSheetRow, deleteSheetRow, uploadFileToDrive, getFileViewLink } from './api.js';

/**
 * Initializes the equipment tab by setting up event listeners.
 */
export function initEquipmentTab(refreshDataCallback) {
    const searchBar = document.getElementById('equipment-search-bar');
    const statusFilter = document.getElementById('equipment-status-filter');
    const categoryFilter = document.getElementById('equipment-category-filter');
    const addBtn = document.getElementById('add-equipment-btn');

    if(searchBar) searchBar.addEventListener('input', renderEquipment);
    if(statusFilter) statusFilter.addEventListener('change', renderEquipment);
    if(categoryFilter) categoryFilter.addEventListener('change', renderEquipment);
    if(addBtn) addBtn.addEventListener('click', () => openEquipmentModal());

    const form = document.getElementById('equipment-modal-form');
    if (form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleEquipmentFormSubmit();
            await refreshDataCallback();
        });
    }

    const deleteBtn = document.getElementById('delete-equipment-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', handleDeleteEquipmentClick);
    
    const changePhotoBtn = document.getElementById('equipment-change-photo-btn');
    if(changePhotoBtn) changePhotoBtn.addEventListener('click', () => document.getElementById('equipment-image-upload').click());

    const imageUpload = document.getElementById('equipment-image-upload');
    if(imageUpload) imageUpload.addEventListener('change', handleImageUpload);

    const imagePreviewContainer = document.getElementById('equipment-image-preview-container');
    if(imagePreviewContainer) imagePreviewContainer.addEventListener('click', () => document.getElementById('equipment-image-upload').click());
}

/**
 * Populates the filter dropdowns for equipment.
 */
function populateFilters() {
    const equipment = appState.equipment || [];
    const statusFilter = document.getElementById('equipment-status-filter');
    const categoryFilter = document.getElementById('equipment-category-filter');

    const statuses = [...new Set(equipment.map(e => e['Status']).filter(Boolean))];
    const categories = [...new Set(equipment.map(e => e['Category']).filter(Boolean))];

    // Clear existing options except the first "All" option
    statusFilter.length = 1;
    categoryFilter.length = 1;

    statuses.forEach(status => {
        const option = new Option(status, status);
        statusFilter.add(option);
    });

    categories.forEach(category => {
        const option = new Option(category, category);
        categoryFilter.add(option);
    });
}


/**
 * Renders the equipment inventory based on current filters.
 */
export function renderEquipment() {
    const container = document.getElementById('equipment-container');
    if (!container) return;
    
    clearContainer(container);
    populateFilters();

    const equipment = appState.equipment || [];
    const searchTerm = document.getElementById('equipment-search-bar')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('equipment-status-filter')?.value || 'all';
    const categoryFilter = document.getElementById('equipment-category-filter')?.value || 'all';

    const filteredEquipment = equipment.filter(item => {
        const matchesSearch = Object.values(item).some(val =>
            String(val).toLowerCase().includes(searchTerm)
        );
        const matchesStatus = statusFilter === 'all' || item['Status'] === statusFilter;
        const matchesCategory = categoryFilter === 'all' || item['Category'] === categoryFilter;
        return matchesSearch && matchesStatus && matchesCategory;
    });

    if (filteredEquipment.length === 0) {
        container.innerHTML = '<p>No equipment found matching your criteria.</p>';
        return;
    }

    const cardContainer = document.createElement('div');
    cardContainer.className = 'inventory-card-container';

    filteredEquipment.forEach(item => {
        const card = document.createElement('div');
        card.className = 'inventory-card';
        card.dataset.equipmentId = item['Equipment ID'];
        card.addEventListener('click', () => openEquipmentModal(item));

        const imageUrl = item['Image URL'] || 'img/placeholder';
        const statusClass = `status-${item['Status']?.toLowerCase().replace(/\s+/g, '-') || 'unknown'}`;

        card.innerHTML = `
            <div class="inventory-card-image">
                <img src="${sanitizeHTML(imageUrl)}" alt="${sanitizeHTML(item['Name'])}" onerror="this.onerror=null;this.src='img/placeholder';">
            </div>
            <div class="inventory-card-content">
                <h3 class="inventory-card-title">${sanitizeHTML(item['Name'])}</h3>
                <p class="inventory-card-category">${sanitizeHTML(item['Category'] || 'Uncategorized')}</p>
                <div class="inventory-card-footer">
                    <span class="status-badge ${statusClass}">${sanitizeHTML(item['Status'] || 'Unknown')}</span>
                </div>
            </div>
        `;
        cardContainer.appendChild(card);
    });

    container.appendChild(cardContainer);
}

/**
 * Opens the equipment modal, optionally pre-filled with data for editing.
 * @param {Object|null} item - The equipment object to edit, or null for a new item.
 */
export function openEquipmentModal(item = null) {
    const form = document.getElementById('equipment-modal-form');
    form.reset();
    
    const modalTitle = document.getElementById('equipment-modal-title');
    const equipmentIdInput = document.getElementById('equipment-id-input');
    const deleteBtn = document.getElementById('delete-equipment-btn');
    const statusEl = document.getElementById('equipment-modal-status');
    const imagePreview = document.getElementById('equipment-image-preview');
    const imagePlaceholder = document.getElementById('equipment-image-placeholder');
    const imageUrlInput = document.getElementById('equipment-image-url');

    statusEl.textContent = '';
    
    if (item) {
        modalTitle.textContent = 'Edit Equipment';
        equipmentIdInput.value = item['Equipment ID'];
        deleteBtn.style.display = 'inline-block';

        // Populate form fields
        document.getElementById('equipment-name').value = item['Name'] || '';
        document.getElementById('equipment-status').value = item['Status'] || 'Available';
        document.getElementById('equipment-category').value = item['Category'] || '';
        document.getElementById('equipment-manufacturer').value = item['Manufacturer'] || '';
        document.getElementById('equipment-model').value = item['Model'] || '';
        document.getElementById('equipment-serial').value = item['Serial Number'] || '';
        document.getElementById('equipment-purchase-cost').value = item['Purchase Cost'] || '';
        document.getElementById('equipment-purchase-date').value = item['Purchase Date'] || '';
        document.getElementById('equipment-location').value = item['Storage Location'] || '';
        document.getElementById('equipment-notes').value = item['Notes'] || '';
        imageUrlInput.value = item['Image URL'] || '';
        
        if (item['Image URL']) {
            imagePreview.src = item['Image URL'];
            imagePreview.style.display = 'block';
            imagePlaceholder.style.display = 'none';
        } else {
            imagePreview.style.display = 'none';
            imagePlaceholder.style.display = 'flex';
        }

    } else {
        modalTitle.textContent = 'Add New Equipment';
        equipmentIdInput.value = `EQ${Date.now()}`; // Generate new ID
        deleteBtn.style.display = 'none';
        document.getElementById('equipment-purchase-date').value = new Date().toISOString().split('T')[0];
        imagePreview.style.display = 'none';
        imagePlaceholder.style.display = 'flex';
        imageUrlInput.value = '';
    }

    showModal('equipment-modal');
}

/**
 * Handles the submission of the equipment form (for both adding and updating).
 */
async function handleEquipmentFormSubmit() {
    const statusEl = document.getElementById('equipment-modal-status');
    statusEl.textContent = 'Saving...';
    
    const equipmentId = document.getElementById('equipment-id-input').value;
    const isNewItem = !appState.equipment.some(e => e['Equipment ID'] === equipmentId);

    const formData = {
        'Equipment ID': equipmentId,
        'Name': document.getElementById('equipment-name').value,
        'Status': document.getElementById('equipment-status').value,
        'Category': document.getElementById('equipment-category').value,
        'Manufacturer': document.getElementById('equipment-manufacturer').value,
        'Model': document.getElementById('equipment-model').value,
        'Serial Number': document.getElementById('equipment-serial').value,
        'Purchase Cost': document.getElementById('equipment-purchase-cost').value,
        'Purchase Date': document.getElementById('equipment-purchase-date').value,
        'Storage Location': document.getElementById('equipment-location').value,
        'Notes': document.getElementById('equipment-notes').value,
        'Image URL': document.getElementById('equipment-image-url').value,
    };

    try {
        if (isNewItem) {
            await addSheetRow('Equipment', formData);
        } else {
            await updateSheetData('Equipment', 'Equipment ID', equipmentId, formData);
        }
        statusEl.textContent = 'Saved successfully!';
        setTimeout(() => {
            hideModal('equipment-modal');
            statusEl.textContent = '';
        }, 1500);
    } catch (error) {
        console.error('Error saving equipment:', error);
        statusEl.textContent = `Error: ${error.message}`;
    }
}

/**
 * Handles the click event for deleting an equipment item.
 */
function handleDeleteEquipmentClick() {
    const equipmentId = document.getElementById('equipment-id-input').value;
    if (!equipmentId) return;

    const modal = document.getElementById('delete-equipment-modal');
    const confirmInput = document.getElementById('delete-equipment-confirm-input');
    const confirmBtn = document.getElementById('delete-equipment-confirm-btn');
    const statusEl = document.getElementById('delete-equipment-status');

    confirmInput.value = '';
    confirmBtn.disabled = true;
    statusEl.textContent = '';
    
    showModal('delete-equipment-modal');

    confirmInput.oninput = () => {
        confirmBtn.disabled = confirmInput.value !== 'Delete';
    };

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.onclick = async () => {
        statusEl.textContent = 'Deleting...';
        try {
            await deleteSheetRow('Equipment', 'Equipment ID', equipmentId);
            statusEl.textContent = 'Deleted successfully.';
            setTimeout(() => {
                hideModal('delete-equipment-modal');
                hideModal('equipment-modal');
                statusEl.textContent = '';
            }, 1500);
        } catch (error) {
            console.error('Error deleting equipment:', error);
            statusEl.textContent = `Error: ${error.message}`;
        }
    };
}


/**
 * Handles the image upload process for equipment.
 * @param {Event} event - The file input change event.
 */
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('equipment-modal-status');
    statusEl.textContent = 'Uploading image...';

    const imagePreview = document.getElementById('equipment-image-preview');
    const imagePlaceholder = document.getElementById('equipment-image-placeholder');
    const imageUrlInput = document.getElementById('equipment-image-url');

    try {
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreview.style.display = 'block';
            imagePlaceholder.style.display = 'none';
        };
        reader.readAsDataURL(file);

        const fileId = await uploadFileToDrive(file);
        const viewLink = await getFileViewLink(fileId);
        
        imageUrlInput.value = viewLink;
        statusEl.textContent = 'Image uploaded!';

    } catch (error) {
        console.error('Image upload failed:', error);
        statusEl.textContent = `Upload failed: ${error.message}`;
        imagePreview.src = '';
        imagePreview.style.display = 'none';
        imagePlaceholder.style.display = 'flex';
        imageUrlInput.value = '';
    }
}

