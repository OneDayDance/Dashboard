// js/costumes.js
// Description: Contains all logic for the 'Costumes' tab.

import { state, allCostumes, updateCostumeFilters } from './state.js';
import { writeData, updateSheetRow, uploadImageToDrive } from './api.js';
import { elements } from './ui.js';

let refreshData;

export function initCostumesTab(refreshDataFn) {
    refreshData = refreshDataFn;
    document.getElementById('costume-add-btn').onclick = () => showCostumeModal(null);
    document.getElementById('costume-search-bar').oninput = (e) => { updateCostumeFilters('searchTerm', e.target.value.toLowerCase()); renderCostumes(); };
    document.getElementById('costume-status-filter').onchange = (e) => { updateCostumeFilters('status', e.target.value); renderCostumes(); };
    document.getElementById('costume-category-filter').onchange = (e) => { updateCostumeFilters('category', e.target.value); renderCostumes(); };
    document.getElementById('costume-modal-form').onsubmit = handleFormSubmit;
}

export function renderCostumes() {
    const container = document.getElementById('costumes-container');
    container.innerHTML = '';
    const processedRows = getProcessedCostumes();

    if (processedRows.length === 0) {
        container.innerHTML = '<p>No costumes found. Click "Add Costume" to get started.</p>';
        return;
    }

    processedRows.forEach(costume => {
        const card = document.createElement('div');
        card.className = 'info-card inventory-card';
        card.onclick = () => showCostumeModal(costume);

        const imageUrl = costume.row[allCostumes.headers.indexOf('Image URL')] || 'https://placehold.co/300x300?text=No+Image';
        const name = costume.row[allCostumes.headers.indexOf('Name')] || 'Unnamed Costume';
        const status = costume.row[allCostumes.headers.indexOf('Status')] || 'N/A';
        const category = costume.row[allCostumes.headers.indexOf('Category')] || 'N/A';
        const size = costume.row[allCostumes.headers.indexOf('Size')] || 'N/A';
        
        card.innerHTML = `
            <div class="inventory-card-image" style="background-image: url('${imageUrl}')"></div>
            <div class="inventory-card-content">
                <h3>${name}</h3>
                <p><strong>Status:</strong> <span class="status-${status.toLowerCase()}">${status}</span></p>
                <p><strong>Category:</strong> ${category}</p>
                <p><strong>Size:</strong> ${size}</p>
            </div>
        `;
        container.appendChild(card);
    });

    populateFilterOptions();
}

function getProcessedCostumes() {
    if (!allCostumes.rows || allCostumes.rows.length === 0) return [];
    
    let processedRows = allCostumes.rows.map(row => ({ row })); // Wrap in object for easier reference
    const { searchTerm, status, category } = state.costumeFilters;

    if (searchTerm) {
        processedRows = processedRows.filter(({ row }) => 
            row.some(cell => String(cell).toLowerCase().includes(searchTerm))
        );
    }
    if (status !== 'all') {
        const statusIndex = allCostumes.headers.indexOf('Status');
        if (statusIndex > -1) processedRows = processedRows.filter(({ row }) => row[statusIndex] === status);
    }
    if (category !== 'all') {
        const categoryIndex = allCostumes.headers.indexOf('Category');
        if (categoryIndex > -1) processedRows = processedRows.filter(({ row }) => row[categoryIndex] === category);
    }
    
    return processedRows;
}

function populateFilterOptions() {
    const categoryFilter = document.getElementById('costume-category-filter');
    const statusFilter = document.getElementById('costume-status-filter');
    const categoryIndex = allCostumes.headers.indexOf('Category');
    const statusIndex = allCostumes.headers.indexOf('Status');

    if (categoryIndex > -1) {
        const categories = [...new Set(allCostumes.rows.map(row => row[categoryIndex]).filter(Boolean))];
        const currentCategory = categoryFilter.value;
        categoryFilter.innerHTML = '<option value="all">All Categories</option>';
        categories.sort().forEach(cat => categoryFilter.add(new Option(cat, cat)));
        categoryFilter.value = currentCategory;
    }
    if (statusIndex > -1) {
        const statuses = [...new Set(allCostumes.rows.map(row => row[statusIndex]).filter(Boolean))];
        const currentStatus = statusFilter.value;
        statusFilter.innerHTML = '<option value="all">All Statuses</option>';
        statuses.sort().forEach(stat => statusFilter.add(new Option(stat, stat)));
        statusFilter.value = currentStatus;
    }
}


function showCostumeModal(costumeData) {
    const modal = elements.costumeModal;
    const form = document.getElementById('costume-modal-form');
    form.reset();
    document.getElementById('costume-modal-status').textContent = '';
    document.getElementById('costume-image-preview').style.backgroundImage = 'none';
    document.getElementById('costume-image-preview-text').style.display = 'block';

    const modalTitle = modal.querySelector('#costume-modal-title');
    const costumeIdInput = document.getElementById('costume-id');

    if (costumeData) {
        modalTitle.textContent = 'Edit Costume';
        const { headers } = allCostumes;
        const row = costumeData.row;
        
        costumeIdInput.value = row[headers.indexOf('CostumeID')];
        document.getElementById('costume-name').value = row[headers.indexOf('Name')] || '';
        document.getElementById('costume-image-url').value = row[headers.indexOf('Image URL')] || '';
        document.getElementById('costume-status').value = row[headers.indexOf('Status')] || 'Available';
        document.getElementById('costume-category').value = row[headers.indexOf('Category')] || '';
        document.getElementById('costume-size').value = row[headers.indexOf('Size')] || '';
        document.getElementById('costume-color').value = row[headers.indexOf('Color')] || '';
        document.getElementById('costume-material').value = row[headers.indexOf('Material')] || '';
        document.getElementById('costume-era').value = row[headers.indexOf('Era/Style')] || '';
        document.getElementById('costume-cost').value = row[headers.indexOf('Purchase Cost')] || '';
        document.getElementById('costume-condition').value = row[headers.indexOf('Condition')] || 'New';
        document.getElementById('costume-location').value = row[headers.indexOf('Storage Location')] || '';
        document.getElementById('costume-notes').value = row[headers.indexOf('Notes')] || '';

        const imageUrl = row[headers.indexOf('Image URL')];
        if (imageUrl) {
            document.getElementById('costume-image-preview').style.backgroundImage = `url('${imageUrl}')`;
            document.getElementById('costume-image-preview-text').style.display = 'none';
        }
    } else {
        modalTitle.textContent = 'Add New Costume';
        costumeIdInput.value = '';
    }

    modal.style.display = 'block';
}


async function handleFormSubmit(event) {
    event.preventDefault();
    const statusSpan = document.getElementById('costume-modal-status');
    statusSpan.textContent = 'Saving...';
    
    const form = event.target;
    const costumeId = form['costume-id'].value;
    const imageFile = form['costume-image-file'].files[0];
    let imageUrl = form['costume-image-url'].value;

    try {
        if (imageFile) {
            statusSpan.textContent = 'Uploading image...';
            imageUrl = await uploadImageToDrive(imageFile);
        }

        const costumeData = {
            'Name': form['costume-name'].value,
            'Image URL': imageUrl,
            'Status': form['costume-status'].value,
            'Category': form['costume-category'].value,
            'Size': form['costume-size'].value,
            'Color': form['costume-color'].value,
            'Material': form['costume-material'].value,
            'Era/Style': form['costume-era'].value,
            'Purchase Cost': form['costume-cost'].value,
            'Condition': form['costume-condition'].value,
            'Storage Location': form['costume-location'].value,
            'Notes': form['costume-notes'].value
        };

        if (costumeId) { // Editing existing costume
            statusSpan.textContent = 'Updating costume...';
            await updateSheetRow('Costumes', 'CostumeID', costumeId, costumeData);
        } else { // Creating new costume
            statusSpan.textContent = 'Adding new costume...';
            costumeData['CostumeID'] = `COS-${Date.now()}`;
            costumeData['Date Added'] = new Date().toLocaleDateString();
            await writeData('Costumes', costumeData);
        }

        statusSpan.textContent = 'Saved successfully!';
        await refreshData();

        setTimeout(() => {
            elements.costumeModal.style.display = 'none';
        }, 1500);

    } catch (err) {
        statusSpan.textContent = `Error: ${err.message}`;
        console.error('Costume save error:', err);
    }
}

