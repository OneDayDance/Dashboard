// js/costumes.js
// Description: Contains all logic for the 'Costumes' tab.

import { state, allCostumes, updateState, updateCostumeFilters } from './state.js';
import { updateSheetRow, writeData, uploadImageToDrive } from './api.js';
import { elements } from './ui.js';

let refreshData;

// --- INITIALIZATION ---
export function initCostumesTab(refreshDataFn) {
    refreshData = refreshDataFn;
    
    // Attach event listeners to elements that exist on page load
    if (elements.costumeAddBtn) {
        elements.costumeAddBtn.onclick = () => showCostumeModal(null);
    }
    if (elements.costumeSearchBar) {
        elements.costumeSearchBar.oninput = (e) => { updateCostumeFilters('searchTerm', e.target.value.toLowerCase()); renderCostumes(); };
    }
    if (elements.costumeStatusFilter) {
        elements.costumeStatusFilter.onchange = (e) => { updateCostumeFilters('status', e.target.value); renderCostumes(); };
    }
    if (elements.costumeCategoryFilter) {
        elements.costumeCategoryFilter.onchange = (e) => { updateCostumeFilters('category', e.target.value); renderCostumes(); };
    }
    if (elements.costumeModalForm) {
        elements.costumeModalForm.addEventListener('submit', handleFormSubmit);
    }
}

// --- RENDERING ---
export function renderCostumes() {
    renderCostumesAsCards();
    populateFilterOptions();
}

/**
 * NEW HELPER FUNCTION
 * Takes a Google Drive URL and converts it to a direct image link.
 * @param {string} url - The original URL from Google Drive.
 * @returns {string} - A URL suitable for direct image display.
 */
function getDirectDriveImage(url) {
    if (!url || !url.includes('drive.google.com')) {
        return url; // Return original if not a drive link or empty
    }
    // If it's already the correct format, return it
    if (url.includes('uc?export=view')) {
        return url;
    }
    // Try to extract the ID from common share link formats
    const match = url.match(/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
        return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
    return ''; // Return empty if we can't parse it
}

function renderCostumesAsCards() {
    const container = document.getElementById('costumes-container');
    if (!container) return;
    container.innerHTML = '';
    const processedRows = getProcessedCostumes();

    if (processedRows.length === 0) {
        container.innerHTML = '<p>No costumes found.</p>';
        return;
    }

    const { headers } = allCostumes;
    const cardContainer = document.createElement('div');
    cardContainer.className = 'card-container';

    const [nameIndex, statusIndex, categoryIndex, imageIndex] = ['Name', 'Status', 'Category', 'Image URL'].map(h => headers.indexOf(h));

    processedRows.forEach(row => {
        const rawImageUrl = row[imageIndex] || '';
        const imageUrl = getDirectDriveImage(rawImageUrl);

        const card = document.createElement('div');
        card.className = 'info-card inventory-card';
        card.onclick = () => showCostumeModal(row);

        const imageDiv = document.createElement('div');
        imageDiv.className = 'inventory-card-image';

        if (imageUrl) {
            imageDiv.style.backgroundImage = `url('${imageUrl}')`;
        } else {
            imageDiv.classList.add('no-image');
            imageDiv.textContent = 'No Image';
        }
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'inventory-card-content';
        contentDiv.innerHTML = `
            <h4>${row[nameIndex] || 'Unnamed Costume'}</h4>
            <p><strong>Status:</strong> ${row[statusIndex] || 'N/A'}</p>
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

    const { searchTerm, status, category } = state.costumeFilters;

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
    // This function can be expanded to dynamically populate filters from sheet data
    // For now, we'll keep it simple.
}

// --- MODAL & FORM HANDLING ---

function showCostumeModal(rowData = null) {
    const modal = elements.costumeModal;
    const form = elements.costumeModalForm;
    if (!modal || !form) return;

    form.reset();
    document.getElementById('costume-modal-status').textContent = '';

    const imagePreview = document.getElementById('costume-image-preview');
    imagePreview.style.backgroundImage = 'none';
    imagePreview.innerHTML = '<span>Click to upload image</span>';
    document.getElementById('costume-image-url').value = '';
    
    // FIX: Use the cached element and add a guard clause
    if (elements.costumeImageUpload) {
        elements.costumeImageUpload.onchange = (event) => {
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
        if (elements.costumeImageUpload) {
            elements.costumeImageUpload.click();
        }
    };

    if (rowData) {
        modal.querySelector('#costume-modal-title').textContent = 'Edit Costume';
        const { headers } = allCostumes;
        // Populate form fields from rowData
        document.getElementById('costume-id-input').value = rowData[headers.indexOf('CostumeID')] || '';
        document.getElementById('costume-name').value = rowData[headers.indexOf('Name')] || '';
        document.getElementById('costume-status').value = rowData[headers.indexOf('Status')] || 'Available';
        document.getElementById('costume-category').value = rowData[headers.indexOf('Category')] || '';
        document.getElementById('costume-size').value = rowData[headers.indexOf('Size')] || '';
        document.getElementById('costume-color').value = rowData[headers.indexOf('Color')] || '';
        document.getElementById('costume-material').value = rowData[headers.indexOf('Material')] || '';
        document.getElementById('costume-era').value = rowData[headers.indexOf('Era/Style')] || '';
        document.getElementById('costume-purchase-cost').value = rowData[headers.indexOf('Purchase Cost')] || '';
        document.getElementById('costume-condition').value = rowData[headers.indexOf('Condition')] || 'New';
        document.getElementById('costume-location').value = rowData[headers.indexOf('Storage Location')] || '';
        document.getElementById('costume-notes').value = rowData[headers.indexOf('Notes')] || '';
        
        const imageUrl = getDirectDriveImage(rowData[headers.indexOf('Image URL')] || '');
        document.getElementById('costume-image-url').value = imageUrl;
        if (imageUrl) {
            imagePreview.style.backgroundImage = `url('${imageUrl}')`;
            imagePreview.innerHTML = '';
        }
    } else {
        modal.querySelector('#costume-modal-title').textContent = 'Add New Costume';
        document.getElementById('costume-id-input').value = '';
        document.getElementById('costume-date-added').value = new Date().toLocaleDateString();
    }

    modal.style.display = 'block';
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const statusSpan = document.getElementById('costume-modal-status');
    statusSpan.textContent = 'Saving...';

    const imageFile = elements.costumeImageUpload ? elements.costumeImageUpload.files[0] : null;
    let imageUrl = document.getElementById('costume-image-url').value;

    try {
        if (imageFile) {
            statusSpan.textContent = 'Uploading image...';
            const uploadResult = await uploadImageToDrive(imageFile);
            imageUrl = uploadResult.link;
        }

        const costumeId = document.getElementById('costume-id-input').value;
        const costumeData = {
            'Name': document.getElementById('costume-name').value,
            'Image URL': imageUrl,
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
        };

        if (costumeId) {
            await updateSheetRow('Costumes', 'CostumeID', costumeId, costumeData);
        } else {
            costumeData['CostumeID'] = `COS-${Date.now()}`;
            await writeData('Costumes', costumeData);
        }

        statusSpan.textContent = 'Costume saved successfully!';
        await refreshData();
        setTimeout(() => {
            elements.costumeModal.style.display = 'none';
        }, 1500);

    } catch (err) {
        statusSpan.textContent = `Error: ${err.message}`;
        console.error('Costume save error:', err);
    }
}

