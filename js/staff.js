// js/staff.js
// Description: Contains all logic for the 'Staff' tab.

import { state, allStaff, updateState } from './state.js';
import { updateSheetRow, writeData, uploadImageToDrive, clearSheetRow } from './api.js';
import { elements } from './ui.js';

let refreshData;

// --- INITIALIZATION ---
export function initStaffTab(refreshDataFn) {
    refreshData = refreshDataFn;
    
    if (elements.staffAddBtn) {
        elements.staffAddBtn.onclick = () => showStaffModal(null);
    }
    if (elements.staffSearchBar) {
        elements.staffSearchBar.oninput = (e) => { updateState({ staffFilters: { ...state.staffFilters, searchTerm: e.target.value.toLowerCase() } }); renderStaff(); };
    }
    if (elements.staffSkillsFilter) {
        elements.staffSkillsFilter.oninput = (e) => { updateState({ staffFilters: { ...state.staffFilters, skill: e.target.value.toLowerCase() } }); renderStaff(); };
    }
    if (elements.staffModalForm) {
        elements.staffModalForm.addEventListener('submit', handleFormSubmit);
    }
}

// --- RENDERING ---
export function renderStaff() {
    renderStaffAsCards();
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

function renderStaffAsCards() {
    const container = document.getElementById('staff-container');
    if (!container) return;
    container.innerHTML = '';

    if (!allStaff || !allStaff.rows) {
        container.innerHTML = '<p>Staff data is not available.</p>';
        return;
    }
    
    const processedRows = getProcessedStaff();

    if (processedRows.length === 0) {
        container.innerHTML = `
            <div class="empty-state-container">
                <h3>No Staff Found</h3>
                <p>To get started, add a new staff member using the button above. If you have data in your sheet that isn't appearing, check the filter settings.</p>
            </div>`;
        return;
    }
    
    if (!allStaff.headers || allStaff.headers.length === 0) {
        console.warn("Staff headers not available yet, skipping render.");
        container.innerHTML = `<p>Loading staff headers...</p>`;
        return;
    }
    
    const { headers } = allStaff;
    const cardContainer = document.createElement('div');
    cardContainer.className = 'card-container';

    const [nameIndex, skillsIndex, imageIndex] = ['Name', 'Skills', 'Image URL'].map(h => headers.indexOf(h));

    processedRows.forEach(row => {
        const card = document.createElement('div');
        card.className = 'info-card inventory-card';
        card.onclick = () => showStaffModal(row);

        const imageDiv = document.createElement('div');
        imageDiv.className = 'inventory-card-image';
        
        const rawImageUrl = row[imageIndex] || '';
        const fileId = extractFileIdFromUrl(rawImageUrl);

        if (fileId) {
            const img = document.createElement('img');
            img.alt = row[nameIndex] || 'Staff image';
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
        
        const skills = (row[skillsIndex] || '').split(',').map(s => s.trim()).filter(Boolean);
        const skillChips = skills.map(skill => `<span class="skill-chip">${skill}</span>`).join('');

        contentDiv.innerHTML = `
            <h4>${row[nameIndex] || 'Unnamed Staff Member'}</h4>
            <div class="skill-chips-container">
                ${skillChips || '<p>No skills listed.</p>'}
            </div>
        `;

        card.appendChild(imageDiv);
        card.appendChild(contentDiv);
        cardContainer.appendChild(card);
    });

    container.appendChild(cardContainer);
}


function getProcessedStaff() {
    if (!allStaff || !allStaff.rows) return [];
    let { headers, rows } = allStaff;
    let processedRows = [...rows];

    const { searchTerm, skill } = state.staffFilters || { searchTerm: '', skill: ''};

    if (searchTerm) {
        processedRows = processedRows.filter(row => row.some(cell => String(cell).toLowerCase().includes(searchTerm)));
    }
    
    if (skill) {
        const skillsIndex = headers.indexOf('Skills');
        if (skillsIndex > -1) {
            processedRows = processedRows.filter(row => (row[skillsIndex] || '').toLowerCase().includes(skill));
        }
    }

    return processedRows;
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

function showStaffModal(rowData = null) {
    const modal = elements.staffModal;
    const form = elements.staffModalForm;
    
    if (!modal || !form) {
        console.error("Staff modal or form element not found in cache! Check `ui.js` and `index.html`.");
        return;
    }

    form.reset();
    document.getElementById('staff-modal-status').textContent = '';

    const imagePreviewContainer = document.getElementById('staff-image-preview-container');
    const imagePreview = document.getElementById('staff-image-preview');
    const imageUploadInput = document.getElementById('staff-image-upload');
    const changePhotoButton = document.getElementById('staff-change-photo-btn');
    const deleteButton = document.getElementById('delete-staff-btn');
    
    imagePreview.src = '';
    imagePreview.style.display = 'none';
    imageUploadInput.value = '';
    safeSetValue('staff-image-url', '');

    // The entire preview container now triggers the file input
    changePhotoButton.onclick = () => imageUploadInput.click();
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
    
    if (rowData) {
        modal.querySelector('#staff-modal-title').textContent = 'Edit Staff';
        const { headers } = allStaff;
        const staffId = rowData[headers.indexOf('StaffID')] || '';
        
        safeSetValue('staff-id-input', staffId);
        safeSetValue('staff-name', rowData[headers.indexOf('Name')] || '');
        safeSetValue('staff-rate', rowData[headers.indexOf('Standard Rate')] || '');
        safeSetValue('staff-skills', rowData[headers.indexOf('Skills')] || '');
        safeSetValue('staff-start-date', rowData[headers.indexOf('Start Date')] || '');
        safeSetValue('staff-notes', rowData[headers.indexOf('Notes')] || '');
        
        const imageUrlFromSheet = rowData[headers.indexOf('Image URL')] || '';
        safeSetValue('staff-image-url', imageUrlFromSheet);
        const fileId = extractFileIdFromUrl(imageUrlFromSheet);

        if (fileId) {
            imagePreview.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w300`;
            imagePreview.style.display = 'block';
            changePhotoButton.textContent = 'Change Photo';
        } else {
            changePhotoButton.textContent = 'Add Photo';
        }

        deleteButton.style.display = 'block';
        deleteButton.onclick = () => showDeleteStaffModal(staffId);

    } else {
        modal.querySelector('#staff-modal-title').textContent = 'Add New Staff';
        safeSetValue('staff-id-input', '');
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        safeSetValue('staff-start-date', `${year}-${month}-${day}`);
        changePhotoButton.textContent = 'Add Photo';
        deleteButton.style.display = 'none';
    }

    modal.style.display = 'block';
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const statusSpan = document.getElementById('staff-modal-status');
    statusSpan.textContent = 'Saving...';

    const imageFile = document.getElementById('staff-image-upload').files[0];
    let imageUrl = document.getElementById('staff-image-url').value;

    try {
        if (imageFile) {
            statusSpan.textContent = 'Uploading image...';
            const uploadResult = await uploadImageToDrive(imageFile);
            imageUrl = uploadResult.link;
        }

        const staffId = document.getElementById('staff-id-input').value;
        const staffData = {
            'Name': document.getElementById('staff-name').value,
            'Image URL': imageUrl,
            'Standard Rate': document.getElementById('staff-rate').value,
            'Skills': document.getElementById('staff-skills').value,
            'Start Date': document.getElementById('staff-start-date').value,
            'Notes': document.getElementById('staff-notes').value,
        };

        const sheetPromise = staffId 
            ? updateSheetRow('Staff', 'StaffID', staffId, staffData)
            : writeData('Staff', { ...staffData, StaffID: `S-${Date.now()}` });
        
        await sheetPromise; 
        console.log("Google Sheet update successful.");
        statusSpan.textContent = 'Staff member saved successfully!';

        await refreshData();

        setTimeout(() => {
            elements.staffModal.style.display = 'none';
        }, 1500);

    } catch (err) {
        statusSpan.textContent = `Error: ${err.message}`;
        console.error('Staff save error:', err);
    }
}

// --- DELETE STAFF ---

function showDeleteStaffModal(staffId) {
    const modal = elements.deleteStaffModal;
    if (!modal) return;
    modal.style.display = 'block';

    const confirmInput = document.getElementById('delete-staff-confirm-input');
    const confirmBtn = document.getElementById('delete-staff-confirm-btn');
    
    confirmInput.value = '';
    confirmBtn.disabled = true;

    confirmInput.oninput = () => {
        confirmBtn.disabled = confirmInput.value !== 'Delete';
    };

    confirmBtn.onclick = () => handleDeleteStaff(staffId);
}

async function handleDeleteStaff(staffId) {
    const statusSpan = document.getElementById('delete-staff-status');
    statusSpan.textContent = 'Deleting...';
    document.getElementById('delete-staff-confirm-btn').disabled = true;

    try {
        await clearSheetRow('Staff', 'StaffID', staffId);
        await refreshData();
        statusSpan.textContent = 'Staff member deleted.';
        setTimeout(() => {
            elements.deleteStaffModal.style.display = 'none';
            elements.staffModal.style.display = 'none'; // Also close the edit modal
        }, 1500);
    } catch (err) {
        statusSpan.textContent = 'Error deleting staff member.';
        console.error('Delete staff error:', err);
        document.getElementById('delete-staff-confirm-btn').disabled = false;
    }
}

