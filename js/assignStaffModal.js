// js/assignStaffModal.js
// Description: Handles the logic for the "Assign Staff" modal.

import { state, allProjects, allStaff } from './state.js';
import { updateSheetRow } from './api.js';
import { elements } from './ui.js';

let refreshData;

export function initAssignStaff(refreshDataFn) {
    refreshData = refreshDataFn;
}

export function renderAssignedStaffSection(project, headers) {
    const assignedStaffJSON = project[headers.indexOf('Assigned Staff')] || '[]';
    let assignedStaff = [];
    try {
        assignedStaff = JSON.parse(assignedStaffJSON);
    } catch (e) {
        console.error("Could not parse assigned staff JSON:", e);
    }

    let itemsHtml = '';
    if (assignedStaff.length > 0) {
        const [idIndex, nameIndex, imageIndex] = ['StaffID', 'Name', 'Image URL'].map(h => allStaff.headers.indexOf(h));
        
        assignedStaff.forEach(assignment => {
            const staffMember = allStaff.rows.find(row => row[idIndex] === assignment.id);
            if (staffMember) {
                const fileId = extractFileIdFromUrl(staffMember[imageIndex] || '');
                const thumbHtml = fileId 
                    ? `<img src="https://drive.google.com/thumbnail?id=${fileId}&sz=w100" alt="${staffMember[nameIndex]}">`
                    : `<span>No Photo</span>`;
                
                const rolesHtml = (assignment.roles || []).map(role => `<span class="skill-chip">${role}</span>`).join('');

                itemsHtml += `
                    <div class="assigned-staff-card">
                        <div class="assigned-staff-thumb">${thumbHtml}</div>
                        <div class="assigned-staff-details">
                            <p>${staffMember[nameIndex]}</p>
                            <div class="skill-chips-container">${rolesHtml || 'No role assigned'}</div>
                        </div>
                    </div>
                `;
            }
        });
    } else {
        itemsHtml = '<p>No staff assigned to this project.</p>';
    }

    return `
        <div class="project-details-section content-section">
            <div class="project-details-section-header">
                <h4>Assigned Staff</h4>
                <div class="view-controls">
                     <button id="assign-staff-btn" type="button" class="btn btn-secondary">Assign Staff</button>
                </div>
            </div>
            <div id="assigned-staff-container">${itemsHtml}</div>
        </div>
    `;
}

export function showAssignStaffModal(projectId) {
    const project = allProjects.rows.find(p => p[allProjects.headers.indexOf('ProjectID')] === projectId);
    if (!project) return;
    
    const assignedStaffJSON = project[allProjects.headers.indexOf('Assigned Staff')] || '[]';
    let currentlyAssigned = [];
    try {
        currentlyAssigned = JSON.parse(assignedStaffJSON).map(staff => ({
            ...staff,
            roles: Array.isArray(staff.roles) ? staff.roles : (staff.role ? [staff.role] : [])
        }));
    } catch (e) {}

    const searchInput = elements.staffSearchInput;
    const searchResultsContainer = elements.staffSearchResults;
    const selectedContainer = elements.selectedStaffList;
    
    let localSelected = [...currentlyAssigned]; 

    const render = () => {
        const searchTerm = searchInput.value.toLowerCase();
        
        searchResultsContainer.innerHTML = '';
        selectedContainer.innerHTML = '';

        const [idIndex, nameIndex, imageIndex] = ['StaffID', 'Name', 'Image URL'].map(h => allStaff.headers.indexOf(h));

        // Render selected items
        localSelected.forEach(assignment => {
            const item = allStaff.rows.find(row => row[idIndex] === assignment.id);
            if (item) {
                selectedContainer.appendChild(createStaffItemElement(item, idIndex, nameIndex, imageIndex, true, assignment.roles));
            }
        });
        
        // Render search results
        const availableItems = allStaff.rows.filter(row => {
            const name = (row[nameIndex] || '').toLowerCase();
            const id = (row[idIndex] || '').toLowerCase();
            return name.includes(searchTerm) || id.includes(searchTerm);
        });

        availableItems.forEach(item => {
             searchResultsContainer.appendChild(createStaffItemElement(item, idIndex, nameIndex, imageIndex, false));
        });
    };

    const createStaffItemElement = (item, idIndex, nameIndex, imageIndex, isSelected, roles = []) => {
        const element = document.createElement('div');
        const itemId = item[idIndex];
        element.className = isSelected ? 'selected-staff-item' : 'staff-search-item';
        element.dataset.staffId = itemId;

        if (!isSelected && localSelected.some(s => s.id === itemId)) {
            element.classList.add('selected');
        }

        const fileId = extractFileIdFromUrl(item[imageIndex] || '');
        const thumbHtml = fileId 
            ? `<img src="https://drive.google.com/thumbnail?id=${fileId}&sz=w100" alt="${item[nameIndex]}">`
            : '';
        
        let rolesHtml = '';
        if (isSelected) {
            rolesHtml = '<div class="staff-role-input-container">';
            roles.forEach((role, i) => {
                rolesHtml += `<div class="role-entry"><input type="text" class="staff-role-input" placeholder="Role..." value="${role}" data-staff-id="${itemId}" data-index="${i}"><button type="button" class="btn btn-danger btn-small remove-role-btn" data-index="${i}">&times;</button></div>`;
            });
            rolesHtml += '<button type="button" class="btn btn-secondary btn-small add-role-btn">+ Role</button></div>';
        }

        element.innerHTML = `
            <div class="staff-item-thumb">${thumbHtml}</div>
            <div class="staff-item-details">
                <p>${item[nameIndex]}</p>
                <span>${itemId}</span>
                ${rolesHtml}
            </div>
        `;
        
        if (!isSelected) {
            element.onclick = () => {
                if (!localSelected.some(s => s.id === itemId)) {
                    localSelected.push({ id: itemId, roles: [''] });
                    render();
                }
            };
        } else {
             const removeButton = document.createElement('button');
             removeButton.className = 'btn btn-danger btn-small';
             removeButton.innerHTML = '&times;';
             removeButton.onclick = () => {
                localSelected = localSelected.filter(s => s.id !== itemId);
                render();
             };
             element.appendChild(removeButton);

             element.querySelector('.add-role-btn').onclick = () => {
                 const assignment = localSelected.find(s => s.id === itemId);
                 assignment.roles.push('');
                 render();
             };

             element.querySelectorAll('.remove-role-btn').forEach(btn => {
                 btn.onclick = () => {
                     const assignment = localSelected.find(s => s.id === itemId);
                     assignment.roles.splice(btn.dataset.index, 1);
                     render();
                 };
             });
        }

        return element;
    };

    searchInput.oninput = render;
    elements.saveAssignedStaffBtn.onclick = async () => {
        // Update roles from input fields before saving
        selectedContainer.querySelectorAll('.selected-staff-item').forEach(item => {
            const staffId = item.dataset.staffId;
            const assignment = localSelected.find(s => s.id === staffId);
            if (assignment) {
                const roles = [];
                item.querySelectorAll('.staff-role-input').forEach(input => {
                    const roleValue = input.value.trim();
                    if (roleValue) roles.push(roleValue);
                });
                assignment.roles = roles;
            }
        });

        const statusSpan = document.getElementById('assign-staff-status');
        statusSpan.textContent = 'Saving...';
        try {
            const newAssignedStaff = JSON.stringify(localSelected);
            await updateSheetRow('Projects', 'ProjectID', projectId, { 'Assigned Staff': newAssignedStaff });
            statusSpan.textContent = 'Saved!';
            await refreshData();
            setTimeout(() => {
                elements.assignStaffModal.style.display = 'none';
            }, 1000);
        } catch (err) {
            statusSpan.textContent = 'Error saving.';
            console.error('Error assigning staff:', err);
        }
    };

    render();
    elements.assignStaffModal.style.display = 'block';
}
