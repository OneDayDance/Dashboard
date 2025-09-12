// js/assignEquipmentModal.js
// Description: Handles the logic for the "Assign Equipment" modal.

import { state, allProjects, allEquipment } from './state.js';
import { updateSheetRow } from './api.js';
import { elements } from './ui.js';

let refreshData;

export function initAssignEquipment(refreshDataFn) {
    refreshData = refreshDataFn;
}

export function renderAssignedEquipmentSection(project, headers) {
    const assignedEquipmentJSON = project[headers.indexOf('Assigned Equipment')] || '[]';
    let assignedIds = [];
    try {
        assignedIds = JSON.parse(assignedEquipmentJSON);
    } catch (e) {
        console.error("Could not parse assigned equipment JSON:", e);
    }

    let itemsHtml = '';
    if (assignedIds.length > 0) {
        const [idIndex, nameIndex, imageIndex] = ['EquipmentID', 'Name', 'Image URL'].map(h => allEquipment.headers.indexOf(h));
        
        assignedIds.forEach(id => {
            const equipment = allEquipment.rows.find(row => row[idIndex] === id);
            if (equipment) {
                const fileId = extractFileIdFromUrl(equipment[imageIndex] || '');
                const thumbHtml = fileId 
                    ? `<img src="https://drive.google.com/thumbnail?id=${fileId}&sz=w100" alt="${equipment[nameIndex]}">`
                    : `<span>No Image</span>`;

                itemsHtml += `
                    <div class="assigned-equipment-card">
                        <div class="assigned-equipment-thumb">${thumbHtml}</div>
                        <div class="assigned-equipment-details">
                            <p>${equipment[nameIndex]}</p>
                            <span>${equipment[idIndex]}</span>
                        </div>
                    </div>
                `;
            }
        });
    } else {
        itemsHtml = '<p>No equipment assigned to this project.</p>';
    }

    return `
        <div class="project-details-section content-section">
            <div class="project-details-section-header">
                <h4>Assigned Equipment</h4>
                <div class="view-controls">
                     <button id="assign-equipment-btn" type="button" class="btn btn-secondary">Assign Equipment</button>
                </div>
            </div>
            <div id="assigned-equipment-container">${itemsHtml}</div>
        </div>
    `;
}

export function showAssignEquipmentModal(projectId) {
    const project = allProjects.rows.find(p => p[allProjects.headers.indexOf('ProjectID')] === projectId);
    if (!project) return;
    
    const assignedEquipmentJSON = project[allProjects.headers.indexOf('Assigned Equipment')] || '[]';
    let currentlyAssignedIds = new Set();
    try {
        currentlyAssignedIds = new Set(JSON.parse(assignedEquipmentJSON));
    } catch (e) {}

    const searchInput = elements.equipmentSearchInput;
    const searchResultsContainer = elements.equipmentSearchResults;
    const selectedContainer = elements.selectedEquipmentList;
    
    let localSelectedIds = new Set(currentlyAssignedIds);

    const render = () => {
        const searchTerm = searchInput.value.toLowerCase();
        
        searchResultsContainer.innerHTML = '';
        selectedContainer.innerHTML = '';

        const [idIndex, nameIndex, imageIndex] = ['EquipmentID', 'Name', 'Image URL'].map(h => allEquipment.headers.indexOf(h));

        // Render selected items first
        localSelectedIds.forEach(id => {
            const item = allEquipment.rows.find(row => row[idIndex] === id);
            if (item) {
                selectedContainer.appendChild(createEquipmentItemElement(item, idIndex, nameIndex, imageIndex, true));
            }
        });
        
        // Render search results
        const availableItems = allEquipment.rows.filter(row => {
            const name = (row[nameIndex] || '').toLowerCase();
            const id = (row[idIndex] || '').toLowerCase();
            return (name.includes(searchTerm) || id.includes(searchTerm));
        });

        availableItems.forEach(item => {
             searchResultsContainer.appendChild(createEquipmentItemElement(item, idIndex, nameIndex, imageIndex, false));
        });
    };

    const createEquipmentItemElement = (item, idIndex, nameIndex, imageIndex, isSelected) => {
        const element = document.createElement('div');
        const itemId = item[idIndex];
        element.className = isSelected ? 'selected-equipment-item' : 'equipment-search-item';
        element.dataset.equipmentId = itemId;

        if (!isSelected && localSelectedIds.has(itemId)) {
            element.classList.add('selected');
        }

        const fileId = extractFileIdFromUrl(item[imageIndex] || '');
        const thumbHtml = fileId 
            ? `<img src="https://drive.google.com/thumbnail?id=${fileId}&sz=w100" alt="${item[nameIndex]}">`
            : '';

        element.innerHTML = `
            <div class="equipment-item-thumb">${thumbHtml}</div>
            <div class="equipment-item-details">
                <p>${item[nameIndex]}</p>
                <span>${itemId}</span>
            </div>
        `;
        
        element.onclick = () => {
            if (localSelectedIds.has(itemId)) {
                localSelectedIds.delete(itemId);
            } else {
                localSelectedIds.add(itemId);
            }
            render();
        };
        return element;
    };

    searchInput.oninput = render;
    elements.saveAssignedEquipmentBtn.onclick = async () => {
        const statusSpan = document.getElementById('assign-equipment-status');
        statusSpan.textContent = 'Saving...';
        try {
            const newAssignedEquipment = JSON.stringify(Array.from(localSelectedIds));
            await updateSheetRow('Projects', 'ProjectID', projectId, { 'Assigned Equipment': newAssignedEquipment });
            statusSpan.textContent = 'Saved!';
            await refreshData();
            setTimeout(() => {
                elements.assignEquipmentModal.style.display = 'none';
            }, 1000);
        } catch (err) {
            statusSpan.textContent = 'Error saving.';
            console.error('Error assigning equipment:', err);
        }
    };

    render();
    elements.assignEquipmentModal.style.display = 'block';
}
