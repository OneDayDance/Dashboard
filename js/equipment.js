// js/equipment.js
// Description: Contains all logic for the 'Equipment' tab.

import { state, allEquipment, updateEquipmentFilters } from './state.js';
import { writeData, updateSheetRow, uploadImageToDrive } from './api.js';
import { elements } from './ui.js';

let refreshData;

export function initEquipmentTab(refreshDataFn) {
    refreshData = refreshDataFn;
    document.getElementById('equipment-add-btn').onclick = () => showEquipmentModal(null);
    document.getElementById('equipment-search-bar').oninput = (e) => { updateEquipmentFilters('searchTerm', e.target.value.toLowerCase()); renderEquipment(); };
    document.getElementById('equipment-status-filter').onchange = (e) => { updateEquipmentFilters('status', e.target.value); renderEquipment(); };
    document.getElementById('equipment-category-filter').onchange = (e) => { updateEquipmentFilters('category', e.target.value); renderEquipment(); };
    document.getElementById('equipment-modal-form').onsubmit = handleFormSubmit;
}

export function renderEquipment() {
    const container = document.getElementById('equipment-container');
    container.innerHTML = '';
    const processedRows = getProcessedEquipment();

    if (processedRows.length === 0) {
        container.innerHTML = '<p>No equipment found. Click "Add Equipment" to get started.</p>';
        return;
    }

    processedRows.forEach(item => {
        const card = document.createElement('div');
        card.className = 'info-card inventory-card';
        card.onclick = () => showEquipmentModal(item);

        const imageUrl = item.row[allEquipment.headers.indexOf('Image URL')] || 'https://placehold.co/300x300?text=No+Image';
        const name = item.row[allEquipment.headers.indexOf('Name')] || 'Unnamed Equipment';
        const status = item.row[allEquipment.headers.indexOf('Status')] || 'N/A';
        const category = item.row[allEquipment.headers.indexOf('Category')] || 'N/A';
        const model = item.row[allEquipment.headers.indexOf('Model')] || 'N/A';

        card.innerHTML = `
            <div class="inventory-card-image" style="background-image: url('${imageUrl}')"></div>
            <div class="inventory-card-content">
                <h3>${name}</h3>
                <p><strong>Status:</strong> <span class="status-${status.toLowerCase()}">${status}</span></p>
                <p><strong>Category:</strong> ${category}</p>
                <p><strong>Model:</strong> ${model}</p>
            </div>
        `;
        container.appendChild(card);
    });

    populateFilterOptions();
}

function getProcessedEquipment() {
    if (!allEquipment.rows || allEquipment.rows.length === 0) return [];

    let processedRows = allEquipment.rows.map(row => ({ row }));
    const { searchTerm, status, category } = state.equipmentFilters;

    if (searchTerm) {
        processedRows = processedRows.filter(({ row }) =>
            row.some(cell => String(cell).toLowerCase().includes(searchTerm))
        );
    }
    if (status !== 'all') {
        const statusIndex = allEquipment.headers.indexOf('Status');
        if (statusIndex > -1) processedRows = processedRows.filter(({ row }) => row[statusIndex] === status);
    }
    if (category !== 'all') {
        const categoryIndex = allEquipment.headers.indexOf('Category');
        if (categoryIndex > -1) processedRows = processedRows.filter(({ row }) => row[categoryIndex] === category);
    }

    return processedRows;
}

function populateFilterOptions() {
    const categoryFilter = document.getElementById('equipment-category-filter');
    const statusFilter = document.getElementById('equipment-status-filter');
    const categoryIndex = allEquipment.headers.indexOf('Category');
    const statusIndex = allEquipment.headers.indexOf('Status');

    if (categoryIndex > -1) {
        const categories = [...new Set(allEquipment.rows.map(row => row[categoryIndex]).filter(Boolean))];
        const currentCategory = categoryFilter.value;
        categoryFilter.innerHTML = '<option value="all">All Categories</option>';
        categories.sort().forEach(cat => categoryFilter.add(new Option(cat, cat)));
        categoryFilter.value = currentCategory;
    }
    if (statusIndex > -1) {
        const statuses = [...new Set(allEquipment.rows.map(row => row[statusIndex]).filter(Boolean))];
        const currentStatus = statusFilter.value;
        statusFilter.innerHTML = '<option value="all">All Statuses</option>';
        statuses.sort().forEach(stat => statusFilter.add(new Option(stat, stat)));
        statusFilter.value = currentStatus;
    }
}

function showEquipmentModal(equipmentData) {
    const modal = elements.equipmentModal;
    const form = document.getElementById('equipment-modal-form');
    form.reset();
    document.getElementById('equipment-modal-status').textContent = '';
    document.getElementById('equipment-image-preview').style.backgroundImage = 'none';
    document.getElementById('equipment-image-preview-text').style.display = 'block';

    const modalTitle = modal.querySelector('#equipment-modal-title');
    const equipmentIdInput = document.getElementById('equipment-id');

    if (equipmentData) {
        modalTitle.textContent = 'Edit Equipment';
        const { headers } = allEquipment;
        const row = equipmentData.row;
        
        equipmentIdInput.value = row[headers.indexOf('EquipmentID')];
        document.getElementById('equipment-name').value = row[headers.indexOf('Name')] || '';
        document.getElementById('equipment-image-url').value = row[headers.indexOf('Image URL')] || '';
        document.getElementById('equipment-status').value = row[headers.indexOf('Status')] || 'Available';
        document.getElementById('equipment-category').value = row[headers.indexOf('Category')] || '';
        document.getElementById('equipment-manufacturer').value = row[headers.indexOf('Manufacturer')] || '';
        document.getElementById('equipment-model').value = row[headers.indexOf('Model')] || '';
        document.getElementById('equipment-serial').value = row[headers.indexOf('Serial Number')] || '';
        document.getElementById('equipment-cost').value = row[headers.indexOf('Purchase Cost')] || '';
        document.getElementById('equipment-purchase-date').value = row[headers.indexOf('Purchase Date')] || '';
        document.getElementById('equipment-location').value = row[headers.indexOf('Storage Location')] || '';
        document.getElementById('equipment-last-maintenance').value = row[headers.indexOf('Last Maintenance')] || '';
        document.getElementById('equipment-notes').value = row[headers.indexOf('Notes')] || '';

        const imageUrl = row[headers.indexOf('Image URL')];
        if (imageUrl) {
            document.getElementById('equipment-image-preview').style.backgroundImage = `url('${imageUrl}')`;
            document.getElementById('equipment-image-preview-text').style.display = 'none';
        }
    } else {
        modalTitle.textContent = 'Add New Equipment';
        equipmentIdInput.value = '';
    }

    modal.style.display = 'block';
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const statusSpan = document.getElementById('equipment-modal-status');
    statusSpan.textContent = 'Saving...';

    const form = event.target;
    const equipmentId = form['equipment-id'].value;
    const imageFile = form['equipment-image-file'].files[0];
    let imageUrl = form['equipment-image-url'].value;

    try {
        if (imageFile) {
            statusSpan.textContent = 'Uploading image...';
            imageUrl = await uploadImageToDrive(imageFile);
        }

        const equipmentData = {
            'Name': form['equipment-name'].value,
            'Image URL': imageUrl,
            'Status': form['equipment-status'].value,
            'Category': form['equipment-category'].value,
            'Manufacturer': form['equipment-manufacturer'].value,
            'Model': form['equipment-model'].value,
            'Serial Number': form['equipment-serial'].value,
            'Purchase Cost': form['equipment-cost'].value,
            'Purchase Date': form['equipment-purchase-date'].value,
            'Storage Location': form['equipment-location'].value,
            'Last Maintenance': form['equipment-last-maintenance'].value,
            'Notes': form['equipment-notes'].value
        };

        if (equipmentId) {
            statusSpan.textContent = 'Updating equipment...';
            await updateSheetRow('Equipment', 'EquipmentID', equipmentId, equipmentData);
        } else {
            statusSpan.textContent = 'Adding new equipment...';
            equipmentData['EquipmentID'] = `EQP-${Date.now()}`;
            await writeData('Equipment', equipmentData);
        }

        statusSpan.textContent = 'Saved successfully!';
        await refreshData();
        
        setTimeout(() => {
            elements.equipmentModal.style.display = 'none';
        }, 1500);

    } catch (err) {
        statusSpan.textContent = `Error: ${err.message}`;
        console.error('Equipment save error:', err);
    }
}

