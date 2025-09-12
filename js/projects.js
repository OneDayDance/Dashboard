// js/projects.js
// Description: Contains all logic for the 'Projects' tab shell and project-level actions.

import { state, allProjects, allClients, allTasks, allRequests, allEquipment, allStaff, updateState } from './state.js';
import { updateSheetRow, writeData, clearSheetRow } from './api.js';
import { elements, showDeleteConfirmationModal } from './ui.js';
import { showRequestDetailsModal } from './requests.js';
import { showClientDetailsModal } from './clients.js';
import { initAssignResourceModal, createResourceHandler } from './assignResourceModal.js';
import { initTaskManager, renderTasksSection, setupTaskClickHandlers, setupDragAndDrop } from './taskManager.js';
import { extractFileIdFromUrl } from './utils.js';

let refreshData;
let equipmentAssigner, staffAssigner;

// --- CONFIGS FOR ASSIGNABLE RESOURCES ---

const equipmentAssignerConfig = {
    resourceType: 'equipment',
    resourceNameSingular: 'Equipment',
    resourceNamePlural: 'Equipment',
    // FIX: Pass a function that returns the current state, not the state object itself.
    // This prevents the config from holding a stale reference to the initial empty state.
    allResourcesState: () => allEquipment,
    idKey: 'EquipmentID',
    projectSheetColumn: 'Assigned Equipment',
    isComplex: false,

    getAssignments: (project, headers) => {
        const json = project[headers.indexOf('Assigned Equipment')] || '[]';
        try { return JSON.parse(json); } catch (e) { return []; }
    },

    formatForSave: (localSelected) => JSON.stringify(Array.from(localSelected)),

    renderAssignedItemCard: (resource, assignment, indices) => {
        const fileId = extractFileIdFromUrl(resource[indices.imageIndex] || '');
        const thumbHtml = fileId 
            ? `<img src="https://drive.google.com/thumbnail?id=${fileId}&sz=w100" alt="${resource[indices.nameIndex]}">`
            : `<span>No Image</span>`;
        return `
            <div class="assigned-resource-card">
                <div class="resource-item-thumb">${thumbHtml}</div>
                <div class="resource-item-details">
                    <p>${resource[indices.nameIndex]}</p>
                    <span>${resource[indices.idIndex]}</span>
                </div>
            </div>
        `;
    },

    // FIX: Updated to accept `currentResources` from the modal handler.
    // This ensures it uses fresh data instead of the stale module-level import.
    createModalItemElement: (item, isSelected, assignment, { localSelected, render, currentResources }) => {
        const { headers } = currentResources;
        const [idIndex, nameIndex, imageIndex] = ['EquipmentID', 'Name', 'Image URL'].map(h => headers.indexOf(h));
        const element = document.createElement('div');
        const itemId = item[idIndex];
        element.className = isSelected ? 'selected-resource-item' : 'resource-search-item';
        element.dataset.resourceId = itemId;

        if (!isSelected && localSelected.has(itemId)) {
            element.classList.add('selected');
        }

        const fileId = extractFileIdFromUrl(item[imageIndex] || '');
        const thumbHtml = fileId 
            ? `<img src="https://drive.google.com/thumbnail?id=${fileId}&sz=w100" alt="${item[nameIndex]}">`
            : '';

        element.innerHTML = `
            <div class="resource-item-thumb">${thumbHtml}</div>
            <div class="resource-item-details">
                <p>${item[nameIndex]}</p>
                <span>${itemId}</span>
            </div>
        `;
        
        element.onclick = () => {
            if (localSelected.has(itemId)) {
                localSelected.delete(itemId);
            } else {
                localSelected.add(itemId);
            }
            render();
        };
        return element;
    }
};

const staffAssignerConfig = {
    resourceType: 'staff',
    resourceNameSingular: 'Staff',
    resourceNamePlural: 'Staff',
    // FIX: Pass a function that returns the current state.
    allResourcesState: () => allStaff,
    idKey: 'StaffID',
    projectSheetColumn: 'Assigned Staff',
    isComplex: true,

    getAssignments: (project, headers) => {
        const json = project[headers.indexOf('Assigned Staff')] || '[]';
        try {
            return JSON.parse(json).map(staff => ({
                ...staff,
                roles: Array.isArray(staff.roles) ? staff.roles : (staff.role ? [staff.role] : [])
            }));
        } catch (e) { return []; }
    },

    formatForSave: (localSelected) => JSON.stringify(localSelected),

    renderAssignedItemCard: (resource, assignment, indices) => {
        const fileId = extractFileIdFromUrl(resource[indices.imageIndex] || '');
        const thumbHtml = fileId 
            ? `<img src="https://drive.google.com/thumbnail?id=${fileId}&sz=w100" alt="${resource[indices.nameIndex]}">`
            : `<span>No Photo</span>`;
        const rolesHtml = (assignment.roles || []).map(role => `<span class="skill-chip">${role}</span>`).join('');
        return `
            <div class="assigned-resource-card">
                <div class="resource-item-thumb">${thumbHtml}</div>
                <div class="resource-item-details">
                    <p>${resource[indices.nameIndex]}</p>
                    <div class="skill-chips-container">${rolesHtml || 'No role assigned'}</div>
                </div>
            </div>
        `;
    },

    // FIX: Updated to accept `currentResources` from the modal handler.
    createModalItemElement: (item, isSelected, assignment, { localSelected, render, currentResources }) => {
        const { headers } = currentResources;
        const [idIndex, nameIndex, imageIndex] = ['StaffID', 'Name', 'Image URL'].map(h => headers.indexOf(h));
        const element = document.createElement('div');
        const itemId = item[idIndex];
        element.className = isSelected ? 'selected-resource-item' : 'resource-search-item';
        element.dataset.resourceId = itemId;

        if (!isSelected && localSelected.some(s => s.id === itemId)) {
            element.classList.add('selected');
        }

        const fileId = extractFileIdFromUrl(item[imageIndex] || '');
        const thumbHtml = fileId ? `<img src="https://drive.google.com/thumbnail?id=${fileId}&sz=w100" alt="${item[nameIndex]}">` : '';
        
        let rolesHtml = '';
        if (isSelected) {
            const currentAssignment = assignment || { roles: [] };
            rolesHtml = '<div class="staff-role-input-container">';
            currentAssignment.roles.forEach((role, i) => {
                rolesHtml += `<div class="role-entry"><input type="text" class="staff-role-input" placeholder="Role..." value="${role}" data-index="${i}"><button type="button" class="btn btn-danger btn-small remove-role-btn" data-index="${i}">&times;</button></div>`;
            });
            rolesHtml += '<button type="button" class="btn btn-secondary btn-small add-role-btn">+ Role</button></div>';
        }

        element.innerHTML = `
            <div class="resource-item-thumb">${thumbHtml}</div>
            <div class="resource-item-details">
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
             removeButton.style.alignSelf = 'center';
             removeButton.onclick = (e) => {
                e.stopPropagation();
                localSelected = localSelected.filter(s => s.id !== itemId);
                render();
             };
             element.appendChild(removeButton);

             element.querySelector('.add-role-btn').onclick = (e) => {
                 e.stopPropagation();
                 const currentAssignment = localSelected.find(s => s.id === itemId);
                 currentAssignment.roles.push('');
                 render();
             };

             element.querySelectorAll('.remove-role-btn').forEach(btn => {
                 btn.onclick = (e) => {
                     e.stopPropagation();
                     const currentAssignment = localSelected.find(s => s.id === itemId);
                     currentAssignment.roles.splice(btn.dataset.index, 1);
                     render();
                 };
             });
        }

        return element;
    },
    
    updateStateBeforeSave: (selectedContainer, localSelected) => {
        selectedContainer.querySelectorAll('.selected-resource-item').forEach(itemEl => {
            const resourceId = itemEl.dataset.resourceId;
            const assignment = localSelected.find(s => s.id === resourceId);
            if (assignment) {
                const roles = [];
                itemEl.querySelectorAll('.staff-role-input').forEach(input => {
                    const roleValue = input.value.trim();
                    if (roleValue) roles.push(roleValue);
                });
                assignment.roles = roles;
            }
        });
    }
};

// --- INITIALIZATION ---
export function initProjectsTab(refreshDataFn) {
    refreshData = refreshDataFn;
    initTaskManager(refreshDataFn);
    initAssignResourceModal(refreshDataFn);

    equipmentAssigner = createResourceHandler(equipmentAssignerConfig);
    staffAssigner = createResourceHandler(staffAssignerConfig);

    document.getElementById('project-search-bar').oninput = (e) => {
        updateState({ projectSearchTerm: e.target.value });
        renderProjectsTab();
    };
    document.getElementById('create-project-form').addEventListener('submit', handleCreateProjectSubmit);
    document.getElementById('gdrive-link-form').addEventListener('submit', handleSaveGDriveLink);
    document.getElementById('archived-projects-toggle').onclick = (e) => {
        e.currentTarget.classList.toggle('collapsed');
        document.getElementById('archived-projects-list').classList.toggle('collapsed');
    };
    
    // Make showProjectDetails globally accessible for taskManager to prevent circular dependencies
    window.showProjectDetails = showProjectDetails;
}

// --- TAB RENDERING ---
export function renderProjectsTab() {
    const activeList = document.getElementById('active-projects-list');
    const archivedList = document.getElementById('archived-projects-list');
    const detailsColumn = document.getElementById('project-details-column');
    activeList.innerHTML = '';
    archivedList.innerHTML = '';

    if (!allProjects.rows) {
        activeList.innerHTML = '<p>Loading projects...</p>';
        return;
    }

    const { headers, rows } = allProjects;
    const searchTerm = state.projectSearchTerm.toLowerCase();
    let filteredRows = rows;

    if (searchTerm) {
        const nameIndex = headers.indexOf('Project Name');
        const emailIndex = headers.indexOf('Client Email');
        const clientEmailIndex = allClients.headers.indexOf('Email');
        const clientFNameIndex = allClients.headers.indexOf('First Name');
        const clientLNameIndex = allClients.headers.indexOf('Last Name');

        filteredRows = rows.filter(proj => {
            const projectName = (proj[nameIndex] || '').toLowerCase();
            const clientEmail = (proj[emailIndex] || '').toLowerCase();
            const client = allClients.rows.find(c => c[clientEmailIndex] === clientEmail);
            const clientName = client ? `${client[clientFNameIndex]} ${client[clientLNameIndex]}`.toLowerCase() : '';
            return projectName.includes(searchTerm) || clientName.includes(searchTerm);
        });
    }

    const archivedStatuses = ['Completed', 'Cancelled', 'Archived'];
    const [statusIndex, nameIndex, clientEmailIndex, projectIdIndex] = ['Status', 'Project Name', 'Client Email', 'ProjectID'].map(h => headers.indexOf(h));

    if ([statusIndex, nameIndex, clientEmailIndex, projectIdIndex].includes(-1)) {
        activeList.innerHTML = '<p>Project sheet is missing required columns.</p>';
        detailsColumn.innerHTML = '';
        return;
    }

    filteredRows.forEach(proj => {
        const isArchived = archivedStatuses.includes(proj[statusIndex]);
        const targetList = isArchived ? archivedList : activeList;
        const client = allClients.rows.find(c => c[allClients.headers.indexOf('Email')] === proj[clientEmailIndex]);
        const clientName = client ? `${client[allClients.headers.indexOf('First Name')]} ${client[allClients.headers.indexOf('Last Name')]}` : 'Unknown Client';

        const item = document.createElement('div');
        item.className = 'project-list-item';
        item.dataset.projectId = proj[projectIdIndex];
        item.innerHTML = `<h4>${proj[nameIndex] || 'Untitled Project'}</h4><p>${clientName}</p>`;
        item.onclick = () => {
            document.querySelectorAll('.project-list-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            updateState({ selectedProjectId: item.dataset.projectId });
            showProjectDetails(item.dataset.projectId);
        };
        targetList.appendChild(item);
    });

    if (state.selectedProjectId) {
        const item = document.querySelector(`.project-list-item[data-project-id="${state.selectedProjectId}"]`);
        if (item) {
            item.classList.add('active');
            showProjectDetails(state.selectedProjectId);
        } else {
            updateState({ selectedProjectId: null });
            detailsColumn.innerHTML = '<p>Select a project to view its details.</p>';
        }
    } else {
        detailsColumn.innerHTML = '<p>Select a project to view its details.</p>';
    }
}

// --- PROJECT DETAILS VIEW ---

function showProjectDetails(projectId, isEditingProject = false) {
    const detailsColumn = document.getElementById('project-details-column');
    const project = allProjects.rows.find(p => p[allProjects.headers.indexOf('ProjectID')] === projectId);
    if (!project) { detailsColumn.innerHTML = '<p>Could not find project details.</p>'; return; }

    detailsColumn.innerHTML = `
        ${renderProjectHeader(project, allProjects.headers, isEditingProject)}
        <div class="project-details-body">
            ${renderCoreDetails(project, allProjects.headers, isEditingProject)}
            ${renderFinancialsSection(project, allProjects.headers)}
            ${staffAssigner.renderAssignedSection(project, allProjects.headers)}
            ${equipmentAssigner.renderAssignedSection(project, allProjects.headers)}
            ${renderTasksSection(projectId)}
            ${renderAdvancedDetails(project, allProjects.headers)}
        </div>
        ${isEditingProject ? `<div class="modal-footer"><button id="project-save-btn" class="btn btn-primary">Save Changes</button></div>` : ''}
    `;
    attachProjectDetailsEventListeners(projectId);
}

// --- DETAIL SECTION RENDERERS ---

function renderProjectHeader(project, headers, isEditing) {
    const projectName = project[headers.indexOf('Project Name')] || 'Untitled Project';
    return `
        <div class="project-details-header">
            <h3>${isEditing ? `<input type="text" id="project-edit-ProjectName" value="${projectName}">` : projectName}</h3>
            <div id="project-actions-container" class="project-actions-dropdown">
                <button id="project-actions-btn" class="btn btn-secondary">Actions</button>
                <div id="project-actions-content" class="project-actions-dropdown-content">
                    <a href="#" id="project-edit-action">Edit Project Details</a>
                    <a href="#" id="project-archive-action">Archive Project</a>
                    <a href="#" id="project-delete-action" class="delete">Delete Project</a>
                </div>
            </div>
        </div>`;
}

function renderCoreDetails(project, headers, isEditing) {
    const clientEmail = project[headers.indexOf('Client Email')];
    const client = allClients.rows.find(c => c[allClients.headers.indexOf('Email')] === clientEmail);
    const clientName = client ? `${client[allClients.headers.indexOf('First Name')]} ${client[allClients.headers.indexOf('Last Name')]}` : 'Unknown Client';
    const clientPhone = client ? client[allClients.headers.indexOf('Phone')] || 'N/A' : 'N/A';
    const folderLink = project[headers.indexOf('Google Folder Link')] || '';
    const projectId = project[headers.indexOf('ProjectID')];

    const createDetailItem = (header, isEditing) => {
        const val = project[headers.indexOf(header)] || '';
        const id = `project-edit-${header.replace(/\s+/g, '')}`;
        return `<li><strong>${header}:</strong> ${isEditing ? `<input type="text" id="${id}" value="${val}">` : val}</li>`;
    };

    let coreDetailsHtml = `<div class="project-details-section content-section"><h4>Core Details</h4><ul>
        ${createDetailItem('Status', isEditing)}
        ${createDetailItem('Start Date', isEditing)}
    </ul></div>`;
    
    let personnelDetailsHtml = `<div class="project-details-section content-section"><h4>Personnel & Location</h4><ul>
        ${createDetailItem('Service Provider', isEditing)}
        ${createDetailItem('Location', isEditing)}
    </ul></div>`;

    const clientCardHtml = `<div class="project-client-card interactive-card info-card" data-client-email="${clientEmail}">
        <div class="card-main-content"><h4>Client</h4><p>${clientName}</p></div>
        <div class="card-hover-content"><p>Email: <span>${clientEmail}</span></p><p>Phone: <span>${clientPhone}</span></p></div>
    </div>`;

    const hasLink = !!folderLink;
    const gDriveCardHtml = `<div class="folder-link-container interactive-card info-card ${hasLink ? 'has-link' : ''}" data-project-id="${projectId}" data-link="${folderLink}">
         <div class="card-main-content"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M464 128H272l-54.63-54.63c-6-6-14.14-9.37-22.63-9.37H48C21.5 64 0 85.5 0 112v288c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48V176c0-26.5-21.5-48-48-48z"/></svg><h4>Project Folder</h4></div>
         <div class="card-hover-content"><p>${hasLink ? 'Visit Folder' : 'Link Folder'}</p></div>
    </div>`;
    
    return `<div class="project-details-grid">${coreDetailsHtml}${personnelDetailsHtml}${clientCardHtml}${gDriveCardHtml}</div>`;
}

function renderFinancialsSection(project, headers, isEditMode = false) {
    const financialsJSON = project[headers.indexOf('Cost Breakdown')] || '[]';
    let lineItems = [];
    try { lineItems = JSON.parse(financialsJSON); } catch (e) { console.error("Bad financials JSON:", e); }
    const total = lineItems.reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);

    let itemsHtml = '';
    if (isEditMode) {
        lineItems.forEach((item, index) => {
            itemsHtml += `<tr class="line-item-row">
                <td><input type="text" class="line-item-desc" value="${item.description || ''}" placeholder="Item Description"></td>
                <td><input type="number" class="line-item-cost" value="${item.cost || 0}" step="0.01" placeholder="0.00"></td>
                <td><button type="button" class="btn btn-danger remove-line-item-btn" data-index="${index}">&times;</button></td>
            </tr>`;
        });
    } else {
        lineItems.forEach(item => {
            itemsHtml += `<tr>
                <td>${item.description || 'N/A'}</td>
                <td>$${(parseFloat(item.cost) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>`;
        });
        if (lineItems.length === 0) itemsHtml = '<tr><td colspan="2">No line items have been added.</td></tr>';
    }
    
    const editControls = isEditMode
        ? `<div class="financials-edit-actions">
               <button id="add-line-item-btn" type="button" class="btn btn-primary">Add Item</button>
               <div>
                   <button id="save-financials-btn" type="button" class="btn btn-primary">Save</button>
                   <button id="cancel-financials-btn" type="button" class="btn btn-subtle">Cancel</button>
               </div>
           </div>`
        : `<button id="edit-financials-btn" type="button" class="btn btn-secondary">Edit</button>`;

    return `
        <div class="project-details-section content-section">
            <div class="project-details-section-header">
                <h4>Financials</h4>
                <div class="view-controls">${!isEditMode ? editControls : ''}</div>
            </div>
            <table class="line-item-table">
                <thead><tr><th>Description</th><th>Cost</th>${isEditMode ? '<th></th>' : ''}</tr></thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <div class="financials-total"><strong>Total:</strong><span>$${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
            ${isEditMode ? editControls : ''}
        </div>`;
}

function renderAdvancedDetails(data, headers) {
    const reqId = data[headers.indexOf('Source Request ID')];
    return `<div class="project-details-section collapsible-header collapsed"><h4>Advanced Details</h4><span class="toggle-arrow">&#9662;</span></div>
    <div class="collapsible-content collapsed"><ul>
        <li><strong>ProjectID:</strong> ${data[headers.indexOf('ProjectID')]}</li>
        <li><strong>Source Request ID:</strong> ${reqId ? `<a href="#" class="source-request-link" data-req-id="${reqId}">${reqId}</a>` : 'N/A'}</li>
    </ul></div>`;
}

// --- EVENT LISTENERS ---
function attachProjectDetailsEventListeners(projectId) {
    const detailsColumn = document.getElementById('project-details-column');
    if (!detailsColumn) return;

    // Header Actions
    const actionsContainer = detailsColumn.querySelector('#project-actions-container');
    if (actionsContainer) {
        const actionsBtn = actionsContainer.querySelector('#project-actions-btn');
        const actionsContent = actionsContainer.querySelector('#project-actions-content');
        let leaveTimeout;
        const showDropdown = () => { clearTimeout(leaveTimeout); actionsContent.style.display = 'block'; };
        const hideDropdown = () => { leaveTimeout = setTimeout(() => { actionsContent.style.display = 'none'; }, 300); };
        actionsBtn.addEventListener('mouseenter', showDropdown);
        actionsContainer.addEventListener('mouseleave', hideDropdown);
        actionsContainer.querySelector('#project-edit-action').onclick = (e) => { e.preventDefault(); showProjectDetails(projectId, true); };
        actionsContainer.querySelector('#project-archive-action').onclick = (e) => { e.preventDefault(); handleArchiveProject(projectId); };
        actionsContainer.querySelector('#project-delete-action').onclick = (e) => {
            e.preventDefault();
            const project = allProjects.rows.find(p => p[allProjects.headers.indexOf('ProjectID')] === projectId);
            const projectName = project ? project[allProjects.headers.indexOf('Project Name')] : 'this project';

            showDeleteConfirmationModal(
                `Delete Project: ${projectName}`,
                `This action is permanent and cannot be undone. This project and all of its associated tasks will be permanently deleted.`,
                async () => {
                    const tasksToDelete = allTasks.rows.filter(t => t[allTasks.headers.indexOf('ProjectID')] === projectId);
                    const taskDeletionPromises = tasksToDelete.map(t => clearSheetRow('Tasks', 'TaskID', t[allTasks.headers.indexOf('TaskID')]));
                    await Promise.all(taskDeletionPromises);
                    await clearSheetRow('Projects', 'ProjectID', projectId);
                    updateState({ selectedProjectId: null });
                    await refreshData();
                }
            );
        };
    }
    const saveProjectBtn = detailsColumn.querySelector('#project-save-btn');
    if (saveProjectBtn) saveProjectBtn.onclick = () => handleSaveProjectUpdate(projectId);

    // Core Details
    const gdriveCard = detailsColumn.querySelector('.folder-link-container');
    if (gdriveCard) gdriveCard.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (gdriveCard.dataset.link) window.open(gdriveCard.dataset.link, '_blank');
        else {
            elements.gdriveLinkModal.style.display = 'block';
            document.getElementById('gdrive-project-id-input').value = projectId;
        }
    };
    const clientCard = detailsColumn.querySelector('.project-client-card');
    if (clientCard) clientCard.onclick = () => {
        const client = allClients.rows.find(c => c[allClients.headers.indexOf('Email')] === clientCard.dataset.clientEmail);
        if (client) showClientDetailsModal(client, allClients.headers);
    };

    // Financials
    const editFinancialsBtn = detailsColumn.querySelector('#edit-financials-btn');
    if (editFinancialsBtn) editFinancialsBtn.onclick = () => {
        const project = allProjects.rows.find(p => p[allProjects.headers.indexOf('ProjectID')] === projectId);
        editFinancialsBtn.closest('.project-details-section').outerHTML = renderFinancialsSection(project, allProjects.headers, true);
        attachProjectDetailsEventListeners(projectId);
    };
    const saveFinancialsBtn = detailsColumn.querySelector('#save-financials-btn');
    if(saveFinancialsBtn) saveFinancialsBtn.onclick = () => handleSaveFinancials(projectId);
    const cancelFinancialsBtn = detailsColumn.querySelector('#cancel-financials-btn');
    if(cancelFinancialsBtn) cancelFinancialsBtn.onclick = () => showProjectDetails(projectId);
    const addLineItemBtn = detailsColumn.querySelector('#add-line-item-btn');
    if(addLineItemBtn) addLineItemBtn.onclick = () => {
        const tbody = detailsColumn.querySelector('.line-item-table tbody');
        const newRow = document.createElement('tr');
        newRow.className = 'line-item-row';
        newRow.innerHTML = `<td><input type="text" class="line-item-desc" placeholder="Item Description"></td><td><input type="number" class="line-item-cost" step="0.01" placeholder="0.00"></td><td><button type="button" class="btn btn-danger remove-line-item-btn">&times;</button></td>`;
        tbody.appendChild(newRow);
        newRow.querySelector('.remove-line-item-btn').onclick = (e) => e.target.closest('tr').remove();
    };
    detailsColumn.querySelectorAll('.remove-line-item-btn').forEach(btn => btn.onclick = (e) => e.target.closest('tr').remove());

    // Assign Modals
    const assignEquipmentBtn = detailsColumn.querySelector('#assign-equipment-btn');
    if (assignEquipmentBtn) assignEquipmentBtn.onclick = () => equipmentAssigner.showAssignModal(projectId);
    const assignStaffBtn = detailsColumn.querySelector('#assign-staff-btn');
    if (assignStaffBtn) assignStaffBtn.onclick = () => staffAssigner.showAssignModal(projectId);

    // Advanced Details
    detailsColumn.querySelectorAll('.collapsible-header').forEach(header => header.onclick = () => {
        header.classList.toggle('collapsed');
        header.nextElementSibling.classList.toggle('collapsed');
    });
    const sourceReqLink = detailsColumn.querySelector('.source-request-link');
    if (sourceReqLink) sourceReqLink.onclick = e => {
        e.preventDefault();
        const request = allRequests.rows.find(r => r[allRequests.headers.indexOf('Submission ID')] === e.currentTarget.dataset.reqId);
        if (request) showRequestDetailsModal(request, allRequests.headers);
    };
    
    setupDragAndDrop(detailsColumn);
    setupTaskClickHandlers(detailsColumn, projectId);
}

// --- PROJECT-LEVEL ACTIONS ---
async function handleSaveFinancials(projectId) {
    const lineItems = [];
    document.querySelectorAll('.line-item-table .line-item-row').forEach(row => {
        const description = row.querySelector('.line-item-desc').value.trim();
        const cost = row.querySelector('.line-item-cost').value;
        if (description) lineItems.push({ description, cost: parseFloat(cost) || 0 });
    });
    try {
        await updateSheetRow('Projects', 'ProjectID', projectId, { 'Cost Breakdown': JSON.stringify(lineItems) });
        await refreshData();
    } catch (err) { alert('Error saving financials.'); console.error(err); }
}

export function showCreateProjectModal(clientRow, clientHeaders, sourceRequestId = null) {
    elements.createProjectModal.style.display = 'block';
    const clientEmail = clientRow[clientHeaders.indexOf('Email')];
    const clientName = `${clientRow[clientHeaders.indexOf('First Name')]} ${clientRow[clientHeaders.indexOf('Last Name')]}`;
    document.getElementById('project-client-name').value = clientName;
    const sourceRequestSelect = document.getElementById('project-source-request');
    sourceRequestSelect.innerHTML = '<option value="">Start from scratch</option>';
    sourceRequestSelect.dataset.clientEmail = clientEmail;
    const activeClientRequests = allRequests.rows.filter(r => r[allRequests.headers.indexOf('Email')] === clientEmail && r[allRequests.headers.indexOf('Status')] !== 'Archived');
    activeClientRequests.forEach(req => {
        const date = req[allRequests.headers.indexOf('Submission Date')] || 'No Date';
        const service = req[allRequests.headers.indexOf('Primary Service Category')] || 'No Service';
        const id = req[allRequests.headers.indexOf('Submission ID')];
        sourceRequestSelect.add(new Option(`${date} - ${service}`, id));
    });
    if (sourceRequestId) sourceRequestSelect.value = sourceRequestId;
    sourceRequestSelect.onchange = (e) => {
        const selectedRequestId = e.target.value;
        if (!selectedRequestId) { document.getElementById('project-name').value = ''; document.getElementById('project-value').value = ''; return; }
        const selectedRequest = allRequests.rows.find(r => r[allRequests.headers.indexOf('Submission ID')] === selectedRequestId);
        if (selectedRequest) {
            document.getElementById('project-name').value = selectedRequest[allRequests.headers.indexOf('Primary Service Category')] || '';
            document.getElementById('project-value').value = selectedRequest[allRequests.headers.indexOf('Quote Total')] || '';
        }
    };
    sourceRequestSelect.dispatchEvent(new Event('change'));
}

async function handleCreateProjectSubmit(event) {
    event.preventDefault();
    const statusSpan = document.getElementById('create-project-status');
    statusSpan.textContent = 'Creating project...';
    const sourceRequestSelect = document.getElementById('project-source-request');
    const sourceRequestId = sourceRequestSelect.value;
    let costBreakdown = '[]';

    if (sourceRequestId) {
        const request = allRequests.rows.find(r => r[allRequests.headers.indexOf('Submission ID')] === sourceRequestId);
        const quoteIndex = allRequests.headers.indexOf('Quote Breakdown');
        
        if (request && quoteIndex > -1 && request[quoteIndex]) {
            try {
                const parsedQuote = JSON.parse(request[quoteIndex]);
                if (Array.isArray(parsedQuote)) {
                    costBreakdown = JSON.stringify(parsedQuote.map(item => ({
                        description: item.item || 'Unnamed Item',
                        cost: parseFloat(item.cost) || 0
                    })));
                }
            } catch (e) {
                const desc = request[quoteIndex];
                const total = parseFloat(request[allRequests.headers.indexOf('Quote Total')] || '0') || 0;
                costBreakdown = JSON.stringify([{ description: desc, cost: total }]);
            }
        }
    }

    const projectData = {
        'Project Name': document.getElementById('project-name').value, 'Client Email': sourceRequestSelect.dataset.clientEmail,
        'Status': document.getElementById('project-status').value, 'Value': document.getElementById('project-value').value,
        'Start Date': document.getElementById('project-start-date').value, 'ProjectID': `P-${Date.now()}`,
        'Source Request ID': sourceRequestId, 'Project Type': document.getElementById('project-type').value,
        'Cost Breakdown': costBreakdown
    };

    try {
        await writeData('Projects', projectData);
        if (projectData['Source Request ID']) {
            await updateSheetRow('Submissions', 'Submission ID', projectData['Source Request ID'], { 'Status': 'Archived' });
        }
        await refreshData();
        statusSpan.textContent = 'Project created!';
        setTimeout(() => {
            elements.createProjectModal.style.display = 'none';
            document.querySelector('.tab-button[data-tab="projects"]').click(); 
        }, 1500);
    } catch (err) { statusSpan.textContent = 'Error creating project.'; console.error('Project creation error', err); }
}

async function handleSaveProjectUpdate(projectId) {
    const dataToUpdate = {};
    ['Project Name', 'Status', 'Start Date', 'Service Provider', 'Location'].forEach(h => {
        const input = document.getElementById(`project-edit-${h.replace(/\s+/g, '')}`);
        if(input) dataToUpdate[h] = input.value;
    });
    try {
        await updateSheetRow('Projects', 'ProjectID', projectId, dataToUpdate);
        await refreshData();
    } catch(err) { console.error('Project update error', err); alert('Could not save project updates.'); }
}

async function handleArchiveProject(projectId) {
    try {
        await updateSheetRow('Projects', 'ProjectID', projectId, { 'Status': 'Archived' });
        await refreshData();
    } catch(err) { console.error('Archive project error', err); alert('Could not archive project.'); }
}

async function handleSaveGDriveLink(event) {
    event.preventDefault();
    const statusSpan = document.getElementById('gdrive-link-status');
    statusSpan.textContent = 'Saving...';
    const projectId = document.getElementById('gdrive-project-id-input').value;
    const newLink = document.getElementById('gdrive-link-input').value;

    try {
        await updateSheetRow('Projects', 'ProjectID', projectId, { 'Google Folder Link': newLink });
        await refreshData();
        statusSpan.textContent = 'Saved!';
        setTimeout(() => { elements.gdriveLinkModal.style.display = 'none'; }, 1000);
    } catch (err) { statusSpan.textContent = 'Error saving link.'; console.error('GDrive link save error:', err); }
}
