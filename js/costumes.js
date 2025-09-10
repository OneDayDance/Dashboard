// js/costumes.js
// Description: Contains all logic for the 'Costumes' tab.

import { state, allCostumes, updateState, updateCostumeFilters } from './state.js';
import { updateSheetRow, writeData, uploadImageToDrive } from './api.js';
import { elements } from './ui.js';

let refreshData;

// --- INITIALIZATION ---
export function initCostumesTab(refreshDataFn) {
    refreshData = refreshDataFn;
    
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
 * Extracts the Google Drive file ID from various URL formats.
 * @param {string} url - The Google Drive URL.
 * @returns {string|null} - The extracted file ID or null.
 */
function extractFileIdFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/([a-zA-Z0-9_-]{28,})/);
    return match ? match[0] : null;
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
    
    if (!allCostumes.headers || allCostumes.headers.length === 0) {
        console.warn("Costume headers not available yet, skipping render.");
        container.innerHTML = `<p>Loading costume headers...</p>`;
        return;
    }
    
    const { headers } = allCostumes;
    const cardContainer = document.createElement('div');
    cardContainer.className = 'card-container';

    const [nameIndex, statusIndex, categoryIndex, imageIndex] = ['Name', 'Status', 'Category', 'Image URL'].map(h => headers.indexOf(h));

    if (imageIndex === -1) {
        console.error("Critical Error: 'Image URL' header not found in fetched data for Costumes.");
    }

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
}

// --- MODAL & FORM HANDLING ---

function safeSetValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.value = value;
    } else {
        console.warn(`Element with ID '${id}' not found.`);
    }
}

function showCostumeModal(rowData = null) {
    const modal = elements.costumeModal;
    const form = elements.costumeModalForm;
    
    if (!modal || !form) {
        console.error("Costume modal or form element not found in cache! Check `ui.js` and `index.html`.");
        return;
    }

    form.reset();
    document.getElementById('costume-modal-status').textContent = '';

    // --- NEW IMAGE HANDLING LOGIC ---
    const imagePreview = document.getElementById('costume-image-preview');
    const imagePlaceholder = document.getElementById('costume-image-placeholder');
    const changeImageBtn = document.getElementById('costume-change-image-btn');
    const imageUploadInput = document.getElementById('costume-image-upload');

    // Reset UI
    imagePreview.src = '';
    imagePreview.style.display = 'none';
    imagePlaceholder.style.display = 'block';
    imageUploadInput.value = ''; // Clear file input
    safeSetValue('costume-image-url', '');

    // Event listeners for new image upload
    changeImageBtn.onclick = () => imageUploadInput.click();
    imageUploadInput.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
                imagePlaceholder.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    };
    
    if (rowData) {
        modal.querySelector('#costume-modal-title').textContent = 'Edit Costume';
        const { headers } = allCostumes;
        
        safeSetValue('costume-id-input', rowData[headers.indexOf('CostumeID')] || '');
        safeSetValue('costume-name', rowData[headers.indexOf('Name')] || '');
        safeSetValue('costume-status', rowData[headers.indexOf('Status')] || 'Available');
        safeSetValue('costume-category', rowData[headers.indexOf('Category')] || '');
        safeSetValue('costume-size', rowData[headers.indexOf('Size')] || '');
        safeSetValue('costume-color', rowData[headers.indexOf('Color')] || '');
        safeSetValue('costume-material', rowData[headers.indexOf('Material')] || '');
        safeSetValue('costume-era', rowData[headers.indexOf('Era/Style')] || '');
        safeSetValue('costume-purchase-cost', rowData[headers.indexOf('Purchase Cost')] || '');
        safeSetValue('costume-condition', rowData[headers.indexOf('Condition')] || 'New');
        safeSetValue('costume-location', rowData[headers.indexOf('Storage Location')] || '');
        safeSetValue('costume-date-added', rowData[headers.indexOf('Date Added')] || '');
        safeSetValue('costume-notes', rowData[headers.indexOf('Notes')] || '');
        
        const imageUrlFromSheet = rowData[headers.indexOf('Image URL')] || '';
        safeSetValue('costume-image-url', imageUrlFromSheet);
        const fileId = extractFileIdFromUrl(imageUrlFromSheet);

        if (fileId) {
            imagePreview.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w300`;
            imagePreview.style.display = 'block';
            imagePlaceholder.style.display = 'none';
        }
    } else {
        modal.querySelector('#costume-modal-title').textContent = 'Add New Costume';
        safeSetValue('costume-id-input', '');
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        safeSetValue('costume-date-added', `${year}-${month}-${day}`);
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

        const sheetPromise = costumeId 
            ? updateSheetRow('Costumes', 'CostumeID', costumeId, costumeData)
            : writeData('Costumes', { ...costumeData, CostumeID: `COS-${Date.now()}` });
        
        await sheetPromise; 
        console.log("Google Sheet update successful.");
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

