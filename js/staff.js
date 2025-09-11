// js/staff.js
// Description: This file contains all the functions for managing staff members.

import { appState } from './state.js';
import { clearContainer, showModal, hideModal, sanitizeHTML } from './utils.js';
import { updateSheetData, addSheetRow, deleteSheetRow, uploadFileToDrive, getFileViewLink } from './api.js';


/**
 * Initializes the staff tab by setting up event listeners.
 */
export function initStaffTab(refreshDataCallback) {
    const searchBar = document.getElementById('staff-search-bar');
    const skillsFilter = document.getElementById('staff-skills-filter');
    const addBtn = document.getElementById('add-staff-btn');

    if (searchBar) searchBar.addEventListener('input', renderStaff);
    if (skillsFilter) skillsFilter.addEventListener('input', renderStaff);
    if (addBtn) addBtn.addEventListener('click', () => openStaffModal());

    const form = document.getElementById('staff-modal-form');
    if (form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleStaffFormSubmit();
            await refreshDataCallback();
        });
    }

    const deleteBtn = document.getElementById('delete-staff-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', handleDeleteStaffClick);
    
    const changePhotoBtn = document.getElementById('staff-change-photo-btn');
    if(changePhotoBtn) changePhotoBtn.addEventListener('click', () => document.getElementById('staff-image-upload').click());

    const imageUpload = document.getElementById('staff-image-upload');
    if(imageUpload) imageUpload.addEventListener('change', handleImageUpload);

    const imagePreviewContainer = document.getElementById('staff-image-preview-container');
    if(imagePreviewContainer) imagePreviewContainer.addEventListener('click', () => document.getElementById('staff-image-upload').click());
}


/**
 * Populates the filter dropdowns for staff based on available skills.
 * Note: This version uses a text input for skills filtering, so this function is not strictly necessary
 * but is kept for potential future use with a dropdown.
 */
function populateFilters() {
    const staff = appState.staff || [];
    const allSkills = new Set();
    staff.forEach(s => {
        const skills = s['Skills'] ? s['Skills'].split(',').map(sk => sk.trim()) : [];
        skills.forEach(skill => allSkills.add(skill));
    });
    // This is where you would populate a <select> dropdown if you had one.
}


/**
 * Renders the staff list based on current filters.
 */
export function renderStaff() {
    const container = document.getElementById('staff-container');
    if (!container) return;

    clearContainer(container);
    populateFilters();

    const staff = appState.staff || [];
    const searchTerm = document.getElementById('staff-search-bar')?.value.toLowerCase() || '';
    const skillsFilter = document.getElementById('staff-skills-filter')?.value.toLowerCase() || '';

    const filteredStaff = staff.filter(member => {
        const nameMatch = member['Name']?.toLowerCase().includes(searchTerm);
        const skillsMatch = skillsFilter === '' || member['Skills']?.toLowerCase().includes(skillsFilter);
        return nameMatch && skillsMatch;
    });

    if (filteredStaff.length === 0) {
        container.innerHTML = '<p>No staff found matching your criteria.</p>';
        return;
    }

    const cardContainer = document.createElement('div');
    cardContainer.className = 'inventory-card-container';

    filteredStaff.forEach(member => {
        const card = document.createElement('div');
        card.className = 'inventory-card staff-card';
        card.dataset.staffId = member['Staff ID'];
        card.addEventListener('click', () => openStaffModal(member));

        const imageUrl = member['Image URL'] || 'img/placeholder';
        const skills = member['Skills'] ? member['Skills'].split(',').map(s => `<span class="skill-tag">${sanitizeHTML(s.trim())}</span>`).join('') : 'No skills listed';

        card.innerHTML = `
            <div class="inventory-card-image staff-card-image">
                <img src="${sanitizeHTML(imageUrl)}" alt="${sanitizeHTML(member['Name'])}" onerror="this.onerror=null;this.src='img/placeholder';">
            </div>
            <div class="inventory-card-content">
                <h3 class="inventory-card-title">${sanitizeHTML(member['Name'])}</h3>
                <div class="staff-skills-container">
                    ${skills}
                </div>
                <div class="inventory-card-footer">
                    <span>Rate: $${sanitizeHTML(member['Standard Rate'] || 'N/A')}/hr</span>
                </div>
            </div>
        `;
        cardContainer.appendChild(card);
    });

    container.appendChild(cardContainer);
}

/**
 * Opens the staff modal, optionally pre-filled with data for editing.
 * @param {Object|null} member - The staff member object to edit, or null for a new member.
 */
export function openStaffModal(member = null) {
    const form = document.getElementById('staff-modal-form');
    form.reset();
    
    const modalTitle = document.getElementById('staff-modal-title');
    const staffIdInput = document.getElementById('staff-id-input');
    const deleteBtn = document.getElementById('delete-staff-btn');
    const statusEl = document.getElementById('staff-modal-status');
    const imagePreview = document.getElementById('staff-image-preview');
    const imagePlaceholder = document.getElementById('staff-image-placeholder');
    const imageUrlInput = document.getElementById('staff-image-url');

    statusEl.textContent = '';
    
    if (member) {
        modalTitle.textContent = 'Edit Staff Member';
        staffIdInput.value = member['Staff ID'];
        deleteBtn.style.display = 'inline-block';

        // Populate form fields
        document.getElementById('staff-name').value = member['Name'] || '';
        document.getElementById('staff-rate').value = member['Standard Rate'] || '';
        document.getElementById('staff-skills').value = member['Skills'] || '';
        document.getElementById('staff-start-date').value = member['Start Date'] || '';
        document.getElementById('staff-notes').value = member['Notes'] || '';
        imageUrlInput.value = member['Image URL'] || '';
        
        if (member['Image URL']) {
            imagePreview.src = member['Image URL'];
            imagePreview.style.display = 'block';
            imagePlaceholder.style.display = 'none';
        } else {
            imagePreview.style.display = 'none';
            imagePlaceholder.style.display = 'flex';
        }

    } else {
        modalTitle.textContent = 'Add New Staff Member';
        staffIdInput.value = `S${Date.now()}`; // Generate new ID
        deleteBtn.style.display = 'none';
        document.getElementById('staff-start-date').value = new Date().toISOString().split('T')[0];
        imagePreview.style.display = 'none';
        imagePlaceholder.style.display = 'flex';
        imageUrlInput.value = '';
    }

    showModal('staff-modal');
}

/**
 * Handles the submission of the staff form (for both adding and updating).
 */
async function handleStaffFormSubmit() {
    const statusEl = document.getElementById('staff-modal-status');
    statusEl.textContent = 'Saving...';
    
    const staffId = document.getElementById('staff-id-input').value;
    const isNewStaff = !appState.staff.some(s => s['Staff ID'] === staffId);

    const formData = {
        'Staff ID': staffId,
        'Name': document.getElementById('staff-name').value,
        'Standard Rate': document.getElementById('staff-rate').value,
        'Skills': document.getElementById('staff-skills').value,
        'Start Date': document.getElementById('staff-start-date').value,
        'Notes': document.getElementById('staff-notes').value,
        'Image URL': document.getElementById('staff-image-url').value,
    };

    try {
        if (isNewStaff) {
            await addSheetRow('Staff', formData);
        } else {
            await updateSheetData('Staff', 'Staff ID', staffId, formData);
        }
        statusEl.textContent = 'Saved successfully!';
        setTimeout(() => {
            hideModal('staff-modal');
            statusEl.textContent = '';
        }, 1500);
    } catch (error) {
        console.error('Error saving staff member:', error);
        statusEl.textContent = `Error: ${error.message}`;
    }
}

/**
 * Handles the click event for deleting a staff member.
 */
function handleDeleteStaffClick() {
    const staffId = document.getElementById('staff-id-input').value;
    if (!staffId) return;

    const modal = document.getElementById('delete-staff-modal');
    const confirmInput = document.getElementById('delete-staff-confirm-input');
    const confirmBtn = document.getElementById('delete-staff-confirm-btn');
    const statusEl = document.getElementById('delete-staff-status');

    confirmInput.value = '';
    confirmBtn.disabled = true;
    statusEl.textContent = '';
    
    showModal('delete-staff-modal');

    confirmInput.oninput = () => {
        confirmBtn.disabled = confirmInput.value !== 'Delete';
    };

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.onclick = async () => {
        statusEl.textContent = 'Deleting...';
        try {
            await deleteSheetRow('Staff', 'Staff ID', staffId);
            statusEl.textContent = 'Deleted successfully.';
            setTimeout(() => {
                hideModal('delete-staff-modal');
                hideModal('staff-modal');
                statusEl.textContent = '';
            }, 1500);
        } catch (error) {
            console.error('Error deleting staff member:', error);
            statusEl.textContent = `Error: ${error.message}`;
        }
    };
}

/**
 * Handles the image upload process for staff photos.
 * @param {Event} event - The file input change event.
 */
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('staff-modal-status');
    statusEl.textContent = 'Uploading photo...';

    const imagePreview = document.getElementById('staff-image-preview');
    const imagePlaceholder = document.getElementById('staff-image-placeholder');
    const imageUrlInput = document.getElementById('staff-image-url');

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
        statusEl.textContent = 'Photo uploaded!';

    } catch (error) {
        console.error('Image upload failed:', error);
        statusEl.textContent = `Upload failed: ${error.message}`;
        imagePreview.src = '';
        imagePreview.style.display = 'none';
        imagePlaceholder.style.display = 'flex';
        imageUrlInput.value = '';
    }
}

