// js/costumes.js
// Description: This file contains all the functions for managing the costume inventory.

import { allCostumes } from './state.js';
import { clearContainer, showModal, hideModal, sanitizeHTML } from './utils.js';
import { updateSheetRow, writeData, clearSheetRow, uploadImageToDrive } from './api.js';

/**
 * Initializes the costumes tab by setting up event listeners.
 */
export function initCostumesTab(refreshDataCallback) {
    const searchBar = document.getElementById('costume-search-bar');
    const statusFilter = document.getElementById('costume-status-filter');
    const categoryFilter = document.getElementById('costume-category-filter');
    const addBtn = document.getElementById('add-costume-btn');

    if (searchBar) searchBar.addEventListener('input', renderCostumes);
    if (statusFilter) statusFilter.addEventListener('change', renderCostumes);
    if (categoryFilter) categoryFilter.addEventListener('change', renderCostumes);
    if (addBtn) addBtn.addEventListener('click', () => openCostumeModal());

    const form = document.getElementById('costume-modal-form');
    if (form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleCostumeFormSubmit();
            await refreshDataCallback();
        });
    }

    const deleteBtn = document.getElementById('delete-costume-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', handleDeleteCostumeClick);

    const changePhotoBtn = document.getElementById('costume-change-photo-btn');
    if(changePhotoBtn) changePhotoBtn.addEventListener('click', () => document.getElementById('costume-image-upload').click());

    const imageUpload = document.getElementById('costume-image-upload');
    if(imageUpload) imageUpload.addEventListener('change', handleImageUpload);

    const imagePreviewContainer = document.getElementById('costume-image-preview-container');
    if(imagePreviewContainer) imagePreviewContainer.addEventListener('click', () => document.getElementById('costume-image-upload').click());
}

/**
 * Populates the filter dropdowns for costumes.
 */
function populateFilters() {
    const costumes = allCostumes.rows || [];
    const statusFilter = document.getElementById('costume-status-filter');
    const categoryFilter = document.getElementById('costume-category-filter');
    const statusIndex = allCostumes.headers.indexOf('Status');
    const categoryIndex = allCostumes.headers.indexOf('Category');


    const statuses = [...new Set(costumes.map(c => c[statusIndex]).filter(Boolean))];
    const categories = [...new Set(costumes.map(c => c[categoryIndex]).filter(Boolean))];

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
 * Renders the costume inventory based on current filters.
 */
export function renderCostumes() {
    const container = document.getElementById('costumes-container');
    if (!container) return;
    
    clearContainer(container);
    populateFilters();

    const costumes = allCostumes.rows || [];
    const searchTerm = document.getElementById('costume-search-bar')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('costume-status-filter')?.value || 'all';
    const categoryFilter = document.getElementById('costume-category-filter')?.value || 'all';
    const statusIndex = allCostumes.headers.indexOf('Status');
    const categoryIndex = allCostumes.headers.indexOf('Category');

    const filteredCostumes = costumes.filter(costume => {
        const matchesSearch = costume.some(val =>
            String(val).toLowerCase().includes(searchTerm)
        );
        const matchesStatus = statusFilter === 'all' || costume[statusIndex] === statusFilter;
        const matchesCategory = categoryFilter === 'all' || costume[categoryIndex] === categoryFilter;
        return matchesSearch && matchesStatus && matchesCategory;
    });

    if (filteredCostumes.length === 0) {
        container.innerHTML = '<p>No costumes found matching your criteria.</p>';
        return;
    }

    const cardContainer = document.createElement('div');
    cardContainer.className = 'inventory-card-container';

    filteredCostumes.forEach(costumeRow => {
        const costume = {};
        allCostumes.headers.forEach((header, i) => {
            costume[header] = costumeRow[i];
        });
        const card = document.createElement('div');
        card.className = 'inventory-card';
        card.dataset.costumeId = costume['Costume ID'];
        card.addEventListener('click', () => openCostumeModal(costume));

        const imageUrl = costume['Image URL'] || 'img/placeholder';
        const statusClass = `status-${costume['Status']?.toLowerCase().replace(/\s+/g, '-') || 'unknown'}`;

        card.innerHTML = `
            <div class="inventory-card-image">
                <img src="${sanitizeHTML(imageUrl)}" alt="${sanitizeHTML(costume['Name'])}" onerror="this.onerror=null;this.src='img/placeholder';">
            </div>
            <div class="inventory-card-content">
                <h3 class="inventory-card-title">${sanitizeHTML(costume['Name'])}</h3>
                <p class="inventory-card-category">${sanitizeHTML(costume['Category'] || 'Uncategorized')}</p>
                <div class="inventory-card-footer">
                    <span class="status-badge ${statusClass}">${sanitizeHTML(costume['Status'] || 'Unknown')}</span>
                </div>
            </div>
        `;
        cardContainer.appendChild(card);
    });

    container.appendChild(cardContainer);
}


/**
 * Opens the costume modal, optionally pre-filled with costume data for editing.
 * @param {Object|null} costume - The costume object to edit, or null for a new costume.
 */
export function openCostumeModal(costume = null) {
    const form = document.getElementById('costume-modal-form');
    form.reset();
    
    const modalTitle = document.getElementById('costume-modal-title');
    const costumeIdInput = document.getElementById('costume-id-input');
    const deleteBtn = document.getElementById('delete-costume-btn');
    const statusEl = document.getElementById('costume-modal-status');
    const imagePreview = document.getElementById('costume-image-preview');
    const imagePlaceholder = document.getElementById('costume-image-placeholder');
    const imageUrlInput = document.getElementById('costume-image-url');

    statusEl.textContent = '';
    
    if (costume) {
        modalTitle.textContent = 'Edit Costume';
        costumeIdInput.value = costume['Costume ID'];
        deleteBtn.style.display = 'inline-block';

        // Populate form fields
        document.getElementById('costume-name').value = costume['Name'] || '';
        document.getElementById('costume-status').value = costume['Status'] || 'Available';
        document.getElementById('costume-category').value = costume['Category'] || '';
        document.getElementById('costume-size').value = costume['Size'] || '';
        document.getElementById('costume-color').value = costume['Color'] || '';
        document.getElementById('costume-material').value = costume['Material'] || '';
        document.getElementById('costume-era').value = costume['Era/Style'] || '';
        document.getElementById('costume-purchase-cost').value = costume['Purchase Cost'] || '';
        document.getElementById('costume-condition').value = costume['Condition'] || 'New';
        document.getElementById('costume-location').value = costume['Storage Location'] || '';
        document.getElementById('costume-date-added').value = costume['Date Added'] || '';
        document.getElementById('costume-notes').value = costume['Notes'] || '';
        imageUrlInput.value = costume['Image URL'] || '';
        
        if (costume['Image URL']) {
            imagePreview.src = costume['Image URL'];
            imagePreview.style.display = 'block';
            imagePlaceholder.style.display = 'none';
        } else {
            imagePreview.style.display = 'none';
            imagePlaceholder.style.display = 'flex';
        }

    } else {
        modalTitle.textContent = 'Add New Costume';
        costumeIdInput.value = `COS${Date.now()}`; // Generate new ID
        deleteBtn.style.display = 'none';
        document.getElementById('costume-date-added').value = new Date().toISOString().split('T')[0];
        imagePreview.style.display = 'none';
        imagePlaceholder.style.display = 'flex';
        imageUrlInput.value = '';

    }

    showModal('costume-modal');
}

/**
 * Handles the submission of the costume form (for both adding and updating).
 */
async function handleCostumeFormSubmit() {
    const statusEl = document.getElementById('costume-modal-status');
    statusEl.textContent = 'Saving...';
    
    const costumeId = document.getElementById('costume-id-input').value;
    const isNewCostume = !allCostumes.rows.some(c => c[allCostumes.headers.indexOf('Costume ID')] === costumeId);

    const formData = {
        'Costume ID': costumeId,
        'Name': document.getElementById('costume-name').value,
        'Status': document.getElementById('costume-status').value,
        'Category': document.getElementById('costume-category').value,
        'Size': document.getElementById('costume-size').value,
        'Color': document.getElementById('costume-color').value,
        'Material': document.getElementById('costume-material').value,
        'Era/Style': document.getElementById('costume-era').value,
        'Purchase Cost': document.getElementById('costume-purchase-cost').value,
        'Condition': document.getElementById('costume-condition').value,
        'Storage Location': document.getElementById('costume-location').value,
        'Date Added': document.getElementById('costume-date-added').value,
        'Notes': document.getElementById('costume-notes').value,
        'Image URL': document.getElementById('costume-image-url').value,
    };

    try {
        if (isNewCostume) {
            await writeData('Costumes', formData);
        } else {
            await updateSheetRow('Costumes', 'Costume ID', costumeId, formData);
        }
        statusEl.textContent = 'Saved successfully!';
        setTimeout(() => {
            hideModal('costume-modal');
            statusEl.textContent = '';
        }, 1500);
    } catch (error) {
        console.error('Error saving costume:', error);
        statusEl.textContent = `Error: ${error.message}`;
    }
}

/**
 * Handles the click event for deleting a costume.
 */
function handleDeleteCostumeClick() {
    const costumeId = document.getElementById('costume-id-input').value;
    if (!costumeId) return;

    const modal = document.getElementById('delete-costume-modal');
    const confirmInput = document.getElementById('delete-costume-confirm-input');
    const confirmBtn = document.getElementById('delete-costume-confirm-btn');
    const statusEl = document.getElementById('delete-costume-status');

    confirmInput.value = '';
    confirmBtn.disabled = true;
    statusEl.textContent = '';
    
    showModal('delete-costume-modal');

    confirmInput.oninput = () => {
        confirmBtn.disabled = confirmInput.value !== 'Delete';
    };

    // Clone and replace the button to avoid multiple listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.onclick = async () => {
        statusEl.textContent = 'Deleting...';
        try {
            await clearSheetRow('Costumes', 'Costume ID', costumeId);
            statusEl.textContent = 'Deleted successfully.';
            setTimeout(() => {
                hideModal('delete-costume-modal');
                hideModal('costume-modal');
                statusEl.textContent = '';
                // The main.js refreshDataCallback will handle re-rendering
            }, 1500);
        } catch (error) {
            console.error('Error deleting costume:', error);
            statusEl.textContent = `Error: ${error.message}`;
        }
    };
}

/**
 * Handles the image upload process.
 * @param {Event} event - The file input change event.
 */
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('costume-modal-status');
    statusEl.textContent = 'Uploading image...';

    const imagePreview = document.getElementById('costume-image-preview');
    const imagePlaceholder = document.getElementById('costume-image-placeholder');
    const imageUrlInput = document.getElementById('costume-image-url');

    try {
        // Show a local preview immediately
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreview.style.display = 'block';
            imagePlaceholder.style.display = 'none';
        };
        reader.readAsDataURL(file);

        // Upload to Drive and get link
        const { link } = await uploadImageToDrive(file);
        
        imageUrlInput.value = link;
        statusEl.textContent = 'Image uploaded!';

    } catch (error) {
        console.error('Image upload failed:', error);
        statusEl.textContent = `Upload failed: ${error.message}`;
        // Reset preview if upload fails
        imagePreview.src = '';
        imagePreview.style.display = 'none';
        imagePlaceholder.style.display = 'flex';
        imageUrlInput.value = '';
    }
}