// js/equipment.js
// Description: Contains all logic for the 'Equipment' tab.

import { state, allEquipment, updateEquipmentFilters } from './state.js';
import { updateSheetRow, writeData, uploadImageToDrive, clearSheetRow } from './api.js';
import { elements } from './ui.js';

let refreshData;

// --- INITIALIZATION ---
export function initEquipmentTab(refreshDataFn) {
    refreshData = refreshDataFn;

    if (elements.equipmentAddBtn) {
        elements.equipmentAddBtn.onclick = () => showEquipmentModal(null);
    }
    if (elements.equipmentSearchBar) {
        elements.equipmentSearchBar.oninput = (e) => { updateEquipmentFilters('searchTerm', e.target.value); renderEquipment(); };
    }
    if (elements.equipmentStatusFilter) {
        elements.equipmentStatusFilter.oninput = (e) => { updateEquipmentFilters('status', e.target.value); renderEquipment(); };
    }
    if (elements.equipmentCategoryFilter) {
        elements.equipmentCategoryFilter.oninput = (e) => { updateEquipmentFilters('category', e.target.value); renderEquipment(); };
    }
    if (elements.equipmentModalForm) {
        elements.equipmentModalForm.addEventListener('submit', handleFormSubmit);
    }
}


// --- RENDERING ---
export function renderEquipment() {
    renderEquipmentAsCards();
    updateFilterDropdowns();
}

/**
 * Extracts the Google Drive file ID from various URL formats.
 * @param {string} url - The Google Drive URL.
 * @returns {string|null} - The extracted file ID or null.
 */
function extractFileIdFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/([a-zA-Z0-9_-]{28,})/);
    return match ? match[0] : null;
}

function renderEquipmentAsCards() {
    const container = document.getElementById('equipment-container');
    if (!container) return;
    container.innerHTML = '';

    if (!allEquipment || !allEquipment.rows) {
        container.innerHTML = '<p>Equipment data is not available.</p>';
        return;
    }
    
    const processedRows = getProcessedEquipment();

    if (processedRows.length === 0) {
        container.innerHTML = `
            <div class="empty-state-container">
                <h3>No Equipment Found</h3>
                <p>To get started, add new equipment using the button above. If you have data in your sheet that isn't appearing, check the filter settings.</p>
            </div>`;
        return;
    }
    
    const { headers } = allEquipment;
    const cardContainer = document.createElement('div');
    cardContainer.className = 'card-container';

    const [nameIndex, categoryIndex, imageIndex] = ['Name', 'Category', 'Image URL'].map(h => headers.indexOf(h));

    processedRows.forEach(row => {
        const card = document.createElement('div');
        card.className = 'info-card inventory-card';
        card.onclick = () => showEquipmentModal(row);

        const imageDiv = document.createElement('div');
        imageDiv.className = 'inventory-card-image';
        
        const rawImageUrl = row[imageIndex] || '';
        const fileId = extractFileIdFromUrl(rawImageUrl);

        if (fileId) {
            const img = document.createElement('img');
            img.alt = row[nameIndex] || 'Equipment image';
            img.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w300`;
            img.onerror = () => { 
                imageDiv.classList.add('no-image');
                imageDiv.textContent = 'Image Error';
                img.remove();
            };
            imageDiv.appendChild(img);
        } else {
            imageDiv.classList.add('no-image');
            imageDiv.textContent = 'No Image';
        }
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'inventory-card-content';
        contentDiv.innerHTML = `
            <h4>${row[nameIndex] || 'Unnamed Equipment'}</h4>
            <p><strong>Category:</strong> ${row[categoryIndex] || 'N/A'}</p>
        `;

        card.appendChild(imageDiv);
        card.appendChild(contentDiv);
        cardContainer.appendChild(card);
    });

    container.appendChild(cardContainer);
}

function getProcessedEquipment() {
    if (!allEquipment || !allEquipment.rows) return [];
    let { headers, rows } = allEquipment;
    let processedRows = [...rows];

    const { searchTerm, status, category } = state.equipmentFilters || { searchTerm: '', status: 'all', category: 'all' };

    if (searchTerm) {
        processedRows = processedRows.filter(row => row.some(cell => String(cell).toLowerCase().includes(searchTerm)));
    }
    
    if (status && status !== 'all') {
        const statusIndex = headers.indexOf('Status');
        if (statusIndex > -1) {
            processedRows = processedRows.filter(row => (row[statusIndex] || '').toLowerCase() === status);
        }
    }

    if (category && category !== 'all') {
        const categoryIndex = headers.indexOf('Category');
        if (categoryIndex > -1) {
            processedRows = processedRows.filter(row => (row[categoryIndex] || '').toLowerCase() === category);
        }
    }

    return processedRows;
}

function updateFilterDropdowns() {
    if (!allEquipment || !allEquipment.rows) return;
    const { headers, rows } = allEquipment;
    
    const populateDropdown = (filterElement, columnIndex) => {
        if (!filterElement) return;

        const uniqueValues = [...new Set(rows.map(row => row[columnIndex]).filter(Boolean))];
        const currentValue = filterElement.value;
        filterElement.innerHTML = '<option value="all">All</option>'; // Default option
        uniqueValues.sort().forEach(value => {
            const option = document.createElement('option');
            option.value = value.toLowerCase();
            option.textContent = value;
            filterElement.appendChild(option);
        });
        filterElement.value = currentValue;
    };

    populateDropdown(elements.equipmentStatusFilter, headers.indexOf('Status'));
    populateDropdown(elements.equipmentCategoryFilter, headers.indexOf('Category'));
}

// --- MODAL & FORM HANDLING ---

function safeSetValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value;
}

function showEquipmentModal(rowData = null) {
    const modal = elements.equipmentModal;
    const form = elements.equipmentModalForm;
    if (!modal || !form) return;

    form.reset();
    document.getElementById('equipment-modal-status').textContent = '';

    const imagePreview = document.getElementById('equipment-image-preview');
    const imageUploadInput = document.getElementById('equipment-image-upload');
    const changePhotoButton = document.getElementById('equipment-change-photo-btn');
    const deleteButton = document.getElementById('delete-equipment-btn');

    if (imagePreview) {
        imagePreview.src = '';
        imagePreview.style.display = 'none';
    }
    if (imageUploadInput) imageUploadInput.value = '';
    safeSetValue('equipment-image-url', '');

    if (changePhotoButton && imageUploadInput) {
        changePhotoButton.onclick = () => imageUploadInput.click();
    }
    if (imageUploadInput && imagePreview && changePhotoButton) {
        imageUploadInput.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.src = e.target.result;
                    imagePreview.style.display = 'block';
                    changePhotoButton.textContent = 'Change Photo';
                };
                reader.readAsDataURL(file);
            }
        };
    }

    if (rowData) {
        modal.querySelector('#equipment-modal-title').textContent = 'Edit Equipment';
        const { headers } = allEquipment;
        const equipmentId = rowData[headers.indexOf('EquipmentID')] || '';
        
        safeSetValue('equipment-id-input', equipmentId);
        safeSetValue('equipment-name', rowData[headers.indexOf('Name')] || '');
        safeSetValue('equipment-status', rowData[headers.indexOf('Status')] || 'Available');
        safeSetValue('equipment-category', rowData[headers.indexOf('Category')] || '');
        safeSetValue('equipment-manufacturer', rowData[headers.indexOf('Manufacturer')] || '');
        safeSetValue('equipment-model', rowData[headers.indexOf('Model')] || '');
        safeSetValue('equipment-serial', rowData[headers.indexOf('Serial Number')] || '');
        safeSetValue('equipment-purchase-cost', rowData[headers.indexOf('Purchase Cost ($)')] || '');
        safeSetValue('equipment-purchase-date', rowData[headers.indexOf('Purchase Date')] || '');
        safeSetValue('equipment-location', rowData[headers.indexOf('Storage Location')] || '');
        safeSetValue('equipment-notes', rowData[headers.indexOf('Notes')] || '');
        
        const imageUrlFromSheet = rowData[headers.indexOf('Image URL')] || '';
        safeSetValue('equipment-image-url', imageUrlFromSheet);
        const fileId = extractFileIdFromUrl(imageUrlFromSheet);

        if (fileId && imagePreview) {
            imagePreview.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w300`;
            imagePreview.style.display = 'block';
            if (changePhotoButton) changePhotoButton.textContent = 'Change Photo';
        } else {
            if (changePhotoButton) changePhotoButton.textContent = 'Add Photo';
        }

        if (deleteButton) {
            deleteButton.style.display = 'block';
            deleteButton.onclick = () => showDeleteEquipmentModal(equipmentId);
        }

    } else {
        modal.querySelector('#equipment-modal-title').textContent = 'Add New Equipment';
        safeSetValue('equipment-id-input', '');
        const today = new Date().toISOString().split('T')[0];
        safeSetValue('equipment-purchase-date', today);
        if (changePhotoButton) changePhotoButton.textContent = 'Add Photo';
        if (deleteButton) deleteButton.style.display = 'none';
    }

    modal.style.display = 'block';
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const statusSpan = document.getElementById('equipment-modal-status');
    statusSpan.textContent = 'Saving...';

    const imageFile = document.getElementById('equipment-image-upload').files[0];
    let imageUrl = document.getElementById('equipment-image-url').value;

    try {
        if (imageFile) {
            statusSpan.textContent = 'Uploading image...';
            const uploadResult = await uploadImageToDrive(imageFile);
            imageUrl = uploadResult.link;
        }

        const equipmentId = document.getElementById('equipment-id-input').value;
        const equipmentData = {
            'Name': document.getElementById('equipment-name').value, 'Image URL': imageUrl,
            'Status': document.getElementById('equipment-status').value, 'Category': document.getElementById('equipment-category').value,
            'Manufacturer': document.getElementById('equipment-manufacturer').value, 'Model': document.getElementById('equipment-model').value,
            'Serial Number': document.getElementById('equipment-serial').value, 'Purchase Cost ($)': document.getElementById('equipment-purchase-cost').value,
            'Purchase Date': document.getElementById('equipment-purchase-date').value, 'Storage Location': document.getElementById('equipment-location').value,
            'Notes': document.getElementById('equipment-notes').value,
        };

        const sheetPromise = equipmentId 
            ? updateSheetRow('Equipment', 'EquipmentID', equipmentId, equipmentData)
            : writeData('Equipment', { ...equipmentData, EquipmentID: `E-${Date.now()}` });
        
        await sheetPromise; 
        statusSpan.textContent = 'Equipment saved successfully!';
        await refreshData();
        setTimeout(() => { elements.equipmentModal.style.display = 'none'; }, 1500);

    } catch (err) {
        statusSpan.textContent = `Error: ${err.message}`;
        console.error('Equipment save error:', err);
    }
}

// --- DELETE EQUIPMENT ---
function showDeleteEquipmentModal(equipmentId) {
    const modal = elements.deleteEquipmentModal;
    if (!modal) return;
    modal.style.display = 'block';

    const confirmInput = document.getElementById('delete-equipment-confirm-input');
    const confirmBtn = document.getElementById('delete-equipment-confirm-btn');
    
    confirmInput.value = '';
    confirmBtn.disabled = true;
    confirmInput.oninput = () => { confirmBtn.disabled = confirmInput.value !== 'Delete'; };
    confirmBtn.onclick = () => handleDeleteEquipment(equipmentId);
}

async function handleDeleteEquipment(equipmentId) {
    const statusSpan = document.getElementById('delete-equipment-status');
    statusSpan.textContent = 'Deleting...';
    document.getElementById('delete-equipment-confirm-btn').disabled = true;

    try {
        await clearSheetRow('Equipment', 'EquipmentID', equipmentId);
        await refreshData();
        statusSpan.textContent = 'Equipment deleted.';
        setTimeout(() => {
            elements.deleteEquipmentModal.style.display = 'none';
            elements.equipmentModal.style.display = 'none';
        }, 1500);
    } catch (err) {
        statusSpan.textContent = 'Error deleting equipment.';
        console.error('Delete equipment error:', err);
        document.getElementById('delete-equipment-confirm-btn').disabled = false;
    }
}
