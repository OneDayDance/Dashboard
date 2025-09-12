// js/costumes.js
// Description: Contains all logic for the 'Costumes' tab.

import { state, allCostumes, updateCostumeFilters } from './state.js';
import { updateSheetRow, writeData, uploadImageToDrive, clearSheetRow } from './api.js';
import { elements, showDeleteConfirmationModal } from './ui.js';
import { extractFileIdFromUrl, safeSetValue } from './utils.js';

let refreshData;

// --- INITIALIZATION ---
export function initCostumesTab(refreshDataFn) {
    refreshData = refreshDataFn;
    
    // Check for element existence before assigning event handlers
    if (elements.costumeAddBtn) {
        elements.costumeAddBtn.onclick = () => showCostumeModal(null);
    }
    if (elements.costumeSearchBar) {
        elements.costumeSearchBar.oninput = (e) => { updateCostumeFilters('searchTerm', e.target.value); renderCostumes(); };
    }
    if (elements.costumeStatusFilter) {
        elements.costumeStatusFilter.oninput = (e) => { updateCostumeFilters('status', e.target.value); renderCostumes(); };
    }
    if (elements.costumeCategoryFilter) {
        elements.costumeCategoryFilter.oninput = (e) => { updateCostumeFilters('category', e.target.value); renderCostumes(); };
    }
    if (elements.costumeModalForm) {
        elements.costumeModalForm.addEventListener('submit', handleFormSubmit);
    }
}


// --- RENDERING ---
export function renderCostumes() {
    renderCostumesAsCards();
    updateFilterDropdowns();
}

function renderCostumesAsCards() {
    const container = document.getElementById('costumes-container');
    if (!container) return;
    container.innerHTML = '';

    if (!allCostumes || !allCostumes.rows) {
        container.innerHTML = '<p>Costume data is not available.</p>';
        return;
    }
    
    const processedRows = getProcessedCostumes();

    if (processedRows.length === 0) {
        container.innerHTML = `
            <div class="empty-state-container">
                <h3>No Costumes Found</h3>
                <p>To get started, add a new costume using the button above. If you have data in your sheet that isn't appearing, check the filter settings.</p>
            </div>`;
        return;
    }
    
    const { headers } = allCostumes;
    const cardContainer = document.createElement('div');
    cardContainer.className = 'card-container';

    const [nameIndex, categoryIndex, imageIndex] = ['Name', 'Category', 'Image URL'].map(h => headers.indexOf(h));

    processedRows.forEach(row => {
        const card = document.createElement('div');
        card.className = 'info-card inventory-card';
        card.onclick = () => showCostumeModal(row);

        const imageDiv = document.createElement('div');
        imageDiv.className = 'inventory-card-image';
        
        const rawImageUrl = row[imageIndex] || '';
        const fileId = extractFileIdFromUrl(rawImageUrl);

        if (fileId) {
            const img = document.createElement('img');
            img.alt = row[nameIndex] || 'Costume image';
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
            <h4>${row[nameIndex] || 'Unnamed Costume'}</h4>
            <p><strong>Category:</strong> ${row[categoryIndex] || 'N/A'}</p>
        `;

        card.appendChild(imageDiv);
        card.appendChild(contentDiv);
        cardContainer.appendChild(card);
    });

    container.appendChild(cardContainer);
}


function getProcessedCostumes() {
    if (!allCostumes || !allCostumes.rows) return [];
    let { headers, rows } = allCostumes;
    let processedRows = [...rows];

    const { searchTerm, status, category } = state.costumeFilters || { searchTerm: '', status: 'all', category: 'all' };

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
    if (!allCostumes || !allCostumes.rows) return;
    const { headers, rows } = allCostumes;
    
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

    populateDropdown(elements.costumeStatusFilter, headers.indexOf('Status'));
    populateDropdown(elements.costumeCategoryFilter, headers.indexOf('Category'));
}


// --- MODAL & FORM HANDLING ---

function showCostumeModal(rowData = null) {
    const modal = elements.costumeModal;
    const form = elements.costumeModalForm;
    if (!modal || !form) return;

    form.reset();
    document.getElementById('costume-modal-status').textContent = '';

    const imagePreview = document.getElementById('costume-image-preview');
    const imageUploadInput = document.getElementById('costume-image-upload');
    const changePhotoButton = document.getElementById('costume-change-photo-btn');
    const deleteButton = document.getElementById('delete-costume-btn');

    // Robustly find and reset elements
    if (imagePreview) {
        imagePreview.src = '';
        imagePreview.style.display = 'none';
    }
    if (imageUploadInput) imageUploadInput.value = '';
    safeSetValue('costume-image-url', '');
    
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
        modal.querySelector('#costume-modal-title').textContent = 'Edit Costume';
        const { headers } = allCostumes;
        const costumeId = rowData[headers.indexOf('CostumeID')] || '';
        
        safeSetValue('costume-id-input', costumeId);
        safeSetValue('costume-name', rowData[headers.indexOf('Name')] || '');
        safeSetValue('costume-status', rowData[headers.indexOf('Status')] || 'Available');
        safeSetValue('costume-category', rowData[headers.indexOf('Category')] || '');
        safeSetValue('costume-size', rowData[headers.indexOf('Size')] || '');
        safeSetValue('costume-color', rowData[headers.indexOf('Color')] || '');
        safeSetValue('costume-material', rowData[headers.indexOf('Material')] || '');
        safeSetValue('costume-era', rowData[headers.indexOf('Era/Style')] || '');
        safeSetValue('costume-purchase-cost', rowData[headers.indexOf('Purchase Cost ($)')] || '');
        safeSetValue('costume-condition', rowData[headers.indexOf('Condition')] || 'New');
        safeSetValue('costume-location', rowData[headers.indexOf('Storage Location')] || '');
        safeSetValue('costume-date-added', rowData[headers.indexOf('Date Added')] || '');
        safeSetValue('costume-notes', rowData[headers.indexOf('Notes')] || '');
        
        const imageUrlFromSheet = rowData[headers.indexOf('Image URL')] || '';
        safeSetValue('costume-image-url', imageUrlFromSheet);
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
            deleteButton.onclick = () => {
                modal.style.display = 'none';
                const costumeName = rowData[headers.indexOf('Name')] || 'this costume';
                showDeleteConfirmationModal(
                    `Delete Costume: ${costumeName}`,
                    'This action is permanent and cannot be undone. This will remove the costume from the inventory.',
                    async () => {
                        await clearSheetRow('Costumes', 'CostumeID', costumeId);
                        await refreshData();
                    }
                );
            };
        }

    } else {
        modal.querySelector('#costume-modal-title').textContent = 'Add New Costume';
        safeSetValue('costume-id-input', '');
        const today = new Date().toISOString().split('T')[0];
        safeSetValue('costume-date-added', today);
        if (changePhotoButton) changePhotoButton.textContent = 'Add Photo';
        if (deleteButton) deleteButton.style.display = 'none';
    }

    modal.style.display = 'block';
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const statusSpan = document.getElementById('costume-modal-status');
    statusSpan.textContent = 'Saving...';

    const imageFile = document.getElementById('costume-image-upload').files[0];
    let imageUrl = document.getElementById('costume-image-url').value;

    try {
        if (imageFile) {
            statusSpan.textContent = 'Uploading image...';
            const uploadResult = await uploadImageToDrive(imageFile);
            imageUrl = uploadResult.link;
        }

        const costumeId = document.getElementById('costume-id-input').value;
        const costumeData = {
            'Name': document.getElementById('costume-name').value, 'Image URL': imageUrl,
            'Status': document.getElementById('costume-status').value, 'Category': document.getElementById('costume-category').value,
            'Size': document.getElementById('costume-size').value, 'Color': document.getElementById('costume-color').value,
            'Material': document.getElementById('costume-material').value, 'Era/Style': document.getElementById('costume-era').value,
            'Purchase Cost ($)': document.getElementById('costume-purchase-cost').value, 'Condition': document.getElementById('costume-condition').value,
            'Storage Location': document.getElementById('costume-location').value, 'Date Added': document.getElementById('costume-date-added').value,
            'Notes': document.getElementById('costume-notes').value,
        };

        const sheetPromise = costumeId 
            ? updateSheetRow('Costumes', 'CostumeID', costumeId, costumeData)
            : writeData('Costumes', { ...costumeData, CostumeID: `C-${Date.now()}` });
        
        await sheetPromise; 
        statusSpan.textContent = 'Costume saved successfully!';
        await refreshData();
        setTimeout(() => { elements.costumeModal.style.display = 'none'; }, 1500);

    } catch (err) {
        statusSpan.textContent = `Error: ${err.message}`;
        console.error('Costume save error:', err);
    }
}
