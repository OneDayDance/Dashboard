// js/equipment.js
// Description: Contains all logic for the 'Equipment' tab.

import { state, allEquipment, updateState, updateEquipmentFilters } from './state.js';
import { updateSheetRow, writeData, uploadImageToDrive } from './api.js';
import { elements } from './ui.js';

let refreshData;

// --- INITIALIZATION ---
export function initEquipmentTab(refreshDataFn) {
    refreshData = refreshDataFn;
    
    if (elements.equipmentAddBtn) {
        elements.equipmentAddBtn.onclick = () => showEquipmentModal(null);
    }
    if (elements.equipmentSearchBar) {
        elements.equipmentSearchBar.oninput = (e) => { updateEquipmentFilters('searchTerm', e.target.value.toLowerCase()); renderEquipment(); };
    }
    if (elements.equipmentStatusFilter) {
        elements.equipmentStatusFilter.onchange = (e) => { updateEquipmentFilters('status', e.target.value); renderEquipment(); };
    }
    if (elements.equipmentCategoryFilter) {
        elements.equipmentCategoryFilter.onchange = (e) => { updateEquipmentFilters('category', e.target.value); renderEquipment(); };
    }
    if (elements.equipmentModalForm) {
        elements.equipmentModalForm.addEventListener('submit', handleFormSubmit);
    }
}

// --- RENDERING ---
export function renderEquipment() {
    renderEquipmentAsCards();
    populateFilterOptions();
}

/**
 * Takes any Google Drive URL and converts it to a direct, embeddable image link.
 * This version is more robust and finds the file ID from various URL formats.
 * @param {string} url - The original URL from Google Drive.
 * @returns {string} - A URL suitable for direct image display, or an empty string.
 */
function getDirectDriveImage(url) {
    if (!url || typeof url !== 'string' || !url.includes('drive.google.com')) {
        return ''; 
    }
    
    if (url.includes('uc?export=view')) {
        return url;
    }

    const match = url.match(/([a-zA-Z0-9_-]{28,})/);
    
    if (match && match[0]) {
        const fileId = match[0];
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
    
    console.warn("getDirectDriveImage: Could not extract File ID from URL:", url);
    return '';
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

    if (!allEquipment.headers || allEquipment.headers.length === 0) {
        console.warn("Equipment headers not available yet, skipping render.");
        container.innerHTML = `<p>Loading equipment headers...</p>`;
        return;
    }

    const { headers } = allEquipment;
    const cardContainer = document.createElement('div');
    cardContainer.className = 'card-container';

    const [nameIndex, statusIndex, categoryIndex, imageIndex] = ['Name', 'Status', 'Category', 'Image URL'].map(h => headers.indexOf(h));

    if (imageIndex === -1) {
        console.error("Critical Error: 'Image URL' header not found in fetched data for Equipment.");
    }

    processedRows.forEach(row => {
        const rawImageUrl = row[imageIndex] || '';
        const imageUrl = getDirectDriveImage(rawImageUrl);

        const card = document.createElement('div');
        card.className = 'info-card inventory-card';
        card.onclick = () => showEquipmentModal(row);

        const imageDiv = document.createElement('div');
        imageDiv.className = 'inventory-card-image';

        if (imageUrl) {
            // **THE FIX**: Use an <img> tag instead of background-image for better cross-origin compatibility.
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = row[nameIndex] || 'Equipment image';
            img.crossOrigin = "anonymous"; // Important for preventing certain CORS errors
            img.onerror = () => { 
                imageDiv.classList.add('no-image');
                imageDiv.textContent = 'Image Error';
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
            <p><strong>Status:</strong> ${row[statusIndex] || 'N/A'}</p>
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

    const { searchTerm, status, category } = state.equipmentFilters;

    if (searchTerm) {
        processedRows = processedRows.filter(row => row.some(cell => String(cell).toLowerCase().includes(searchTerm)));
    }
    if (status !== 'all') {
        const statusIndex = headers.indexOf('Status');
        if (statusIndex > -1) processedRows = processedRows.filter(row => row[statusIndex] === status);
    }
    if (category !== 'all') {
        const categoryIndex = headers.indexOf('Category');
        if (categoryIndex > -1) processedRows = processedRows.filter(row => row[categoryIndex] === category);
    }
    return processedRows;
}

function populateFilterOptions() {
    // Placeholder for future dynamic filter population
}

// --- MODAL & FORM HANDLING ---

/**
 * Helper function to safely set the value of a form element.
 * @param {string} id - The ID of the element.
 * @param {string} value - The value to set.
 */
function safeSetValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.value = value;
    } else {
        console.warn(`Element with ID '${id}' not found.`);
    }
}


function showEquipmentModal(rowData = null) {
    const modal = elements.equipmentModal;
    const form = elements.equipmentModalForm;
    
    if (!modal || !form) {
        console.error("Equipment modal or form element not found in cache! Check `ui.js` and `index.html`.");
        return;
    }

    form.reset();
    document.getElementById('equipment-modal-status').textContent = '';

    const imagePreview = document.getElementById('equipment-image-preview');
    imagePreview.style.backgroundImage = 'none';
    imagePreview.innerHTML = '<span>Click to upload image</span>';
    safeSetValue('equipment-image-url', '');

    if (elements.equipmentImageUpload) {
        elements.equipmentImageUpload.value = ''; // Clear file input
        elements.equipmentImageUpload.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.style.backgroundImage = `url('${e.target.result}')`;
                    imagePreview.innerHTML = '';
                };
                reader.readAsDataURL(file);
            }
        };
    }
    imagePreview.onclick = () => {
        if (elements.equipmentImageUpload) {
            elements.equipmentImageUpload.click();
        }
    };

    if (rowData) {
        modal.querySelector('#equipment-modal-title').textContent = 'Edit Equipment';
        const { headers } = allEquipment;

        safeSetValue('equipment-id-input', rowData[headers.indexOf('EquipmentID')] || '');
        safeSetValue('equipment-name', rowData[headers.indexOf('Name')] || '');
        safeSetValue('equipment-status', rowData[headers.indexOf('Status')] || 'Available');
        safeSetValue('equipment-category', rowData[headers.indexOf('Category')] || '');
        safeSetValue('equipment-manufacturer', rowData[headers.indexOf('Manufacturer')] || '');
        safeSetValue('equipment-model', rowData[headers.indexOf('Model')] || '');
        safeSetValue('equipment-serial', rowData[headers.indexOf('Serial Number')] || '');
        safeSetValue('equipment-purchase-cost', rowData[headers.indexOf('Purchase Cost')] || '');
        safeSetValue('equipment-purchase-date', rowData[headers.indexOf('Purchase Date')] || '');
        safeSetValue('equipment-location', rowData[headers.indexOf('Storage Location')] || '');
        safeSetValue('equipment-notes', rowData[headers.indexOf('Notes')] || '');
        
        const imageUrl = getDirectDriveImage(rowData[headers.indexOf('Image URL')] || '');
        safeSetValue('equipment-image-url', imageUrl);
        if (imageUrl) {
            imagePreview.style.backgroundImage = `url('${imageUrl}')`;
            imagePreview.innerHTML = '';
        }
    } else {
        modal.querySelector('#equipment-modal-title').textContent = 'Add New Equipment';
        safeSetValue('equipment-id-input', '');
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        safeSetValue('equipment-purchase-date', `${year}-${month}-${day}`);
    }

    modal.style.display = 'block';
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const statusSpan = document.getElementById('equipment-modal-status');
    statusSpan.textContent = 'Saving...';

    const imageFile = elements.equipmentImageUpload ? elements.equipmentImageUpload.files[0] : null;
    let imageUrl = document.getElementById('equipment-image-url').value;

    try {
        if (imageFile) {
            statusSpan.textContent = 'Uploading image...';
            const uploadResult = await uploadImageToDrive(imageFile);
            imageUrl = uploadResult.link;
        }

        const equipmentId = document.getElementById('equipment-id-input').value;
        const equipmentData = {
            'Name': document.getElementById('equipment-name').value,
            'Image URL': imageUrl,
            'Status': document.getElementById('equipment-status').value,
            'Category': document.getElementById('equipment-category').value,
            'Manufacturer': document.getElementById('equipment-manufacturer').value,
            'Model': document.getElementById('equipment-model').value,
            'Serial Number': document.getElementById('equipment-serial').value,
            'Purchase Cost': document.getElementById('equipment-purchase-cost').value,
            'Purchase Date': document.getElementById('equipment-purchase-date').value,
            'Storage Location': document.getElementById('equipment-location').value,
            'Notes': document.getElementById('equipment-notes').value,
        };

        const sheetPromise = equipmentId
            ? updateSheetRow('Equipment', 'EquipmentID', equipmentId, equipmentData)
            : writeData('Equipment', { ...equipmentData, EquipmentID: `EQP-${Date.now()}` });
        
        await sheetPromise;
        console.log("Google Sheet update successful.");
        statusSpan.textContent = 'Equipment saved successfully!';
        
        await refreshData(); // Explicitly call refreshData AFTER sheet update completes.

        setTimeout(() => {
            elements.equipmentModal.style.display = 'none';
        }, 1500);

    } catch (err) {
        statusSpan.textContent = `Error: ${err.message}`;
        console.error('Equipment save error:', err);
    }
}

