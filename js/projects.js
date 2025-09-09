// js/projects.js
// Description: Contains all logic for the 'Projects' tab and task management.

import { state, allProjects, allClients, allTasks, allRequests, updateState } from './state.js';
import { updateSheetRow, writeData, clearSheetRow } from './api.js';
import { elements } from './ui.js';
import { showRequestDetailsModal } from './requests.js';

// --- INITIALIZATION ---
export function initProjectsTab() {
    document.getElementById('project-search-bar').oninput = (e) => {
        updateState({ projectSearchTerm: e.target.value });
        renderProjectsTab();
    };
    document.getElementById('create-project-form').addEventListener('submit', handleCreateProjectSubmit);
    document.getElementById('task-details-form').addEventListener('submit', handleSaveTask);
    document.getElementById('gdrive-link-form').addEventListener('submit', handleSaveGDriveLink);
    document.getElementById('archived-projects-toggle').onclick = (e) => {
        e.currentTarget.classList.toggle('collapsed');
        document.getElementById('archived-projects-list').classList.toggle('collapsed');
    };
}

// --- RENDERING ---
export function renderProjectsTab() {
    const activeList = document.getElementById('active-projects-list');
    const archivedList = document.getElementById('archived-projects-list');
    const detailsColumn = document.getElementById('project-details-column');
    activeList.innerHTML = '';
    archivedList.innerHTML = '';

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


function showProjectDetails(projectId, isEditMode = false) {
    const detailsColumn = document.getElementById('project-details-column');
    const project = allProjects.rows.find(p => p[allProjects.headers.indexOf('ProjectID')] === projectId);
    if (!project) { detailsColumn.innerHTML = '<p>Could not find project details.</p>'; return; }
    const { headers } = allProjects;
    let detailsHtml = `
        <div class="project-details-header">
            <h3>${isEditMode ? `<input type="text" id="project-edit-ProjectName" value="${project[headers.indexOf('Project Name')]}">` : project[headers.indexOf('Project Name')]}</h3>
            <div id="project-actions-container" class="project-actions-dropdown">
                <button id="project-actions-btn" class="btn btn-secondary">Actions</button>
                <div id="project-actions-content" class="project-actions-dropdown-content">
                    <a href="#" id="project-edit-action">Edit Project</a>
                    <a href="#" id="project-archive-action">Archive Project</a>
                    <a href="#" id="project-delete-action" class="delete">Delete Project</a>
                </div>
            </div>
        </div>`;
    detailsHtml += renderGenericProjectDetails(project, headers, isEditMode);
    if (isEditMode) detailsHtml += `<div class="modal-footer"><button id="project-save-btn" class="btn btn-primary">Save</button></div>`;
    detailsColumn.innerHTML = detailsHtml;

    // --- Event Listeners for details view ---
    const actionsContainer = document.getElementById('project-actions-container');
    const actionsBtn = document.getElementById('project-actions-btn');
    const actionsContent = document.getElementById('project-actions-content');
    let leaveTimeout;

    const showDropdown = () => { clearTimeout(leaveTimeout); actionsContent.style.display = 'block'; };
    const hideDropdown = () => { leaveTimeout = setTimeout(() => { actionsContent.style.display = 'none'; }, 300); };
    
    if (actionsBtn) {
        actionsBtn.addEventListener('mouseenter', showDropdown);
        actionsContainer.addEventListener('mouseleave', hideDropdown);
        document.getElementById('project-edit-action').onclick = (e) => { e.preventDefault(); showProjectDetails(projectId, true); };
        document.getElementById('project-archive-action').onclick = (e) => { e.preventDefault(); handleArchiveProject(projectId); };
        document.getElementById('project-delete-action').onclick = (e) => { e.preventDefault(); showDeleteProjectModal(projectId); };
    }


    if (isEditMode) document.getElementById('project-save-btn').onclick = () => handleSaveProjectUpdate(projectId);

    detailsColumn.querySelectorAll('.collapsible-header').forEach(header => header.onclick = () => {
        header.classList.toggle('collapsed');
        header.nextElementSibling.classList.toggle('collapsed');
    });
    
    const sourceReqLink = detailsColumn.querySelector('.source-request-link');
    if (sourceReqLink) {
        sourceReqLink.addEventListener('click', e => {
            e.preventDefault();
            const reqId = e.currentTarget.dataset.reqId;
            const request = allRequests.rows.find(r => r[allRequests.headers.indexOf('Submission ID')] === reqId);
            if (request) {
                showRequestDetailsModal(request, allRequests.headers);
            }
        });
    }
    
    const gdriveCard = detailsColumn.querySelector('.folder-link-container');
    if (gdriveCard) {
        // Using .onclick to ensure only one handler is ever attached, preventing listener stacking.
        gdriveCard.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation(); // Stop the event from bubbling up to other elements.

            const link = gdriveCard.dataset.link;
            if (link) {
                window.open(link, '_blank');
            } else {
                elements.gdriveLinkModal.style.display = 'block';
                document.getElementById('gdrive-project-id-input').value = projectId;
                document.getElementById('gdrive-link-input').value = '';
                document.getElementById('gdrive-link-status').textContent = '';
            }
        };
    }

    setupDragAndDrop(detailsColumn);
    setupTaskClickHandlers(detailsColumn, projectId);
}


function renderGenericProjectDetails(data, headers, isEditMode) {
    const clientEmail = data[headers.indexOf('Client Email')];
    const client = allClients.rows.find(c => c[allClients.headers.indexOf('Email')] === clientEmail);
    const clientName = client ? `${client[allClients.headers.indexOf('First Name')]} ${client[allClients.headers.indexOf('Last Name')]}` : 'Unknown Client';
    const clientPhone = client ? client[allClients.headers.indexOf('Phone')] || 'N/A' : 'N/A';
    const folderLink = data[headers.indexOf('Google Folder Link')] || '';
    const projectId = data[headers.indexOf('ProjectID')];

    let coreDetailsHtml = `<div class="project-details-section content-section"><h4>Core Details</h4><ul>`;
    ['Status', 'Start Date', 'Value'].forEach(h => {
        const val = data[headers.indexOf(h)] || '';
        coreDetailsHtml += `<li><strong>${h}:</strong> ${isEditMode ? `<input type="text" id="project-edit-${h.replace(/\s+/g, '')}" value="${val}">` : val}</li>`;
    });
    coreDetailsHtml += `</ul></div>`;
    
    let personnelDetailsHtml = `<div class="project-details-section content-section"><h4>Personnel & Location</h4><ul>`;
    ['Service Provider', 'Location'].forEach(h => {
        const val = data[headers.indexOf(h)] || '';
        personnelDetailsHtml += `<li><strong>${h}:</strong> ${isEditMode ? `<input type="text" id="project-edit-${h.replace(/\s+/g, '')}" value="${val}">` : val}</li>`;
    });
    if(isEditMode) personnelDetailsHtml += `<li><strong>Folder Link:</strong><input type="text" id="project-edit-GoogleFolderLink" value="${folderLink}"></li>`;
    personnelDetailsHtml += `</ul></div>`;

    const clientCardHtml = `
        <div class="project-client-card interactive-card info-card" data-client-email="${clientEmail}">
            <div class="card-main-content">
                <h4>Client</h4>
                <p>${clientName}</p>
            </div>
            <div class="card-hover-content">
                <p>Email: <span>${clientEmail}</span></p>
                <p>Phone: <span>${clientPhone}</span></p>
            </div>
        </div>`;

    const hasLink = !!folderLink;
    const gDriveCardHtml = `
        <div class="folder-link-container interactive-card info-card ${hasLink ? 'has-link' : ''}" data-project-id="${projectId}" data-link="${folderLink}">
             <div class="card-main-content">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M464 128H272l-54.63-54.63c-6-6-14.14-9.37-22.63-9.37H48C21.5 64 0 85.5 0 112v288c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48V176c0-26.5-21.5-48-48-48z"/></svg>
                <h4>Project Folder</h4>
             </div>
             <div class="card-hover-content">
                <p>${hasLink ? 'Visit Folder' : 'Link Folder'}</p>
             </div>
        </div>`;
    
    return `<div class="project-details-grid">
        ${coreDetailsHtml}
        ${personnelDetailsHtml}
        ${clientCardHtml}
        ${gDriveCardHtml}
    </div>
    ${renderTasksSection(projectId)}
    ${renderAdvancedDetails(data, headers)}`;
}
function renderTasksSection(projectId) {
    const renderFn = state.projectTaskView === 'list' ? renderTasksAsList : renderTasksAsBoard;
    return `<div class="project-details-section content-section">
        <div class="project-details-section-header">
            <h4>Tasks</h4>
            <div class="view-controls">
                <button id="add-bucket-btn" class="btn btn-secondary">+</button>
                <button id="task-view-toggle" class="btn btn-subtle">${state.projectTaskView === 'list' ? 'Board' : 'List'} View</button>
            </div>
        </div>
        ${renderFn(projectId)}
    </div>`;
}
function renderTasksAsList(projectId) {
    let html = `<div id="project-task-list">`;
    const projectTasks = getProjectTasksSorted(projectId);
    const buckets = getProjectBuckets(projectId);
    buckets.forEach(bucket => {
        html += `<div class="task-bucket" draggable="true" data-bucket="${bucket}"><h5>${bucket}</h5>`;
        projectTasks.filter(t => (t.row[allTasks.headers.indexOf('Bucket')] || 'General') === bucket).forEach(task => {
            html += renderTaskItem(task.row, task.subtasks);
        });
        html += `<button class="add-task-to-bucket-btn" data-bucket="${bucket}">+ Add Task</button></div>`;
    });
    return html + `</div>`;
}
function renderTasksAsBoard(projectId) {
    let html = `<div id="project-task-board" class="task-board">`;
    const projectTasks = getProjectTasksSorted(projectId);
    const buckets = getProjectBuckets(projectId);
    buckets.forEach(bucket => {
        html += `<div class="task-board-column" draggable="true" data-bucket="${bucket}"><h5>${bucket}</h5>`;
        projectTasks.filter(t => (t.row[allTasks.headers.indexOf('Bucket')] || 'General') === bucket).forEach(task => {
            html += renderTaskCard(task.row, task.subtasks);
        });
        html += `<button class="add-task-to-bucket-btn" data-bucket="${bucket}">+ Add Task</button></div>`;
    });
    return html + `</div>`;
}
function renderTaskItem(taskRow, subtasks) {
    const [idIdx, nameIdx, statusIdx] = ['TaskID', 'Task Name', 'Status'].map(h => allTasks.headers.indexOf(h));
    const isCompleted = taskRow[statusIdx] === 'Done';
    let subtasksHtml = '';
    if (subtasks.length > 0) {
        subtasksHtml += '<ul class="subtask-list">';
        subtasks.forEach((sub, i) => {
            subtasksHtml += `<li class="subtask-item"><input type="checkbox" data-task-id="${taskRow[idIdx]}" data-subtask-index="${i}" ${sub.completed ? 'checked' : ''}> ${sub.name}</li>`;
        });
        subtasksHtml += '</ul>';
        const completedCount = subtasks.filter(s => s.completed).length;
        const progress = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;
        subtasksHtml += `<div class="task-progress" title="${completedCount}/${subtasks.length} complete"><div class="task-progress-bar" style="width:${progress}%"></div></div>`;
    }
    return `<div class="task-item" draggable="true" data-task-id="${taskRow[idIdx]}">
                <div class="task-main ${isCompleted ? 'completed' : ''}">
                    <input type="checkbox" ${isCompleted ? 'checked' : ''}>
                    <label>${taskRow[nameIdx]}</label>
                </div>
                ${subtasksHtml}
            </div>`;
}
function renderTaskCard(taskRow, subtasks) {
     const [idIdx, nameIdx] = ['TaskID', 'Task Name'].map(h => allTasks.headers.indexOf(h));
     let subtaskSummary = '';
     if (subtasks.length > 0) {
        const completedCount = subtasks.filter(s => s.completed).length;
        subtaskSummary = `<p class="subtask-summary">✓ ${completedCount}/${subtasks.length}</p>`;
     }
    return `<div class="task-card" draggable="true" data-task-id="${taskRow[idIdx]}"><p>${taskRow[nameIdx]}</p>${subtaskSummary}</div>`;
}
function getProjectTasksSorted(projectId) {
    const { headers, rows } = allTasks, [idIdx, sortIdx, subtaskIdx] = ['ProjectID', 'SortIndex', 'Subtasks'].map(h => headers.indexOf(h));
    return rows.filter(t => t[idIdx] === projectId)
               .sort((a,b) => (a[sortIdx] || 0) - (b[sortIdx] || 0))
               .map(row => ({ row, subtasks: JSON.parse(row[subtaskIdx] || '[]') }));
}
function getProjectBuckets(projectId) {
    const project = allProjects.rows.find(p => p[allProjects.headers.indexOf('ProjectID')] === projectId);
    if (project) {
        const bucketsJSON = project[allProjects.headers.indexOf('Task Buckets')];
        if (bucketsJSON) try { return JSON.parse(bucketsJSON); } catch(e){}
    }
    return ['General'];
}

function renderAdvancedDetails(data, headers) {
    const reqId = data[headers.indexOf('Source Request ID')];
    return `<div class="project-details-section collapsible-header collapsed"><h4>Advanced Details</h4><span class="toggle-arrow">&#9662;</span></div>
    <div class="collapsible-content collapsed"><ul>
        <li><strong>ProjectID:</strong> ${data[headers.indexOf('ProjectID')]}</li>
        <li><strong>Source Request ID:</strong> ${reqId ? `<a href="#" class="source-request-link" data-req-id="${reqId}">${reqId}</a>` : 'N/A'}</li>
    </ul></div>`;
}
// --- DRAG AND DROP ---
function setupDragAndDrop(container) {
    container.querySelectorAll('[draggable="true"]').forEach(el => {
        el.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            e.dataTransfer.setData(el.matches('.task-bucket, .task-board-column') ? 'text/bucket-id' : 'text/task-id', el.dataset.bucket || el.dataset.taskId);
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => el.classList.add('dragging'), 0);
        });
        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            document.querySelectorAll('.task-placeholder, .bucket-placeholder').forEach(p => p.remove());
        });
    });

    container.querySelectorAll('.task-bucket, .task-board-column, #project-task-list, #project-task-board').forEach(zone => {
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('drop', handleDrop);
    });
}
function handleDragOver(e) {
    e.preventDefault();
    const draggingEl = document.querySelector('.dragging');
    if (!draggingEl) return;

    let placeholder = document.querySelector('.task-placeholder, .bucket-placeholder');
    const removePlaceholder = () => { if(placeholder) placeholder.remove(); placeholder = null; };

    if (draggingEl.matches('.task-bucket, .task-board-column')) {
        const isListView = draggingEl.matches('.task-bucket');
        const container = isListView ? document.getElementById('project-task-list') : document.getElementById('project-task-board');
        const afterEl = isListView ? getDragAfterElementVertical(container, e.clientY, '.task-bucket') : getDragAfterBucketHorizontal(container, e.clientX);
        if ((draggingEl.nextElementSibling === afterEl) || (afterEl && afterEl.previousElementSibling === draggingEl) || (!afterEl && container.lastElementChild === draggingEl)) { removePlaceholder(); return; }
        if (!placeholder) { placeholder = document.createElement('div'); placeholder.className = 'bucket-placeholder'; }
        if(isListView) placeholder.style.height = `${draggingEl.offsetHeight}px`;
        if (afterEl) container.insertBefore(placeholder, afterEl); else container.appendChild(placeholder);
    } else {
        const container = e.target.closest('.task-bucket, .task-board-column');
        if (!container) { removePlaceholder(); return; }
        const afterEl = getDragAfterElementVertical(container, e.clientY, '.task-item, .task-card');
        const addBtn = container.querySelector('.add-task-to-bucket-btn');
        if (draggingEl.parentNode === container && ((draggingEl.nextElementSibling === afterEl) || (afterEl && afterEl.previousElementSibling === draggingEl) || (!afterEl && addBtn && addBtn.previousElementSibling === draggingEl))) { removePlaceholder(); return; }
        if (!placeholder) { placeholder = document.createElement('div'); placeholder.className = 'task-placeholder'; }
        placeholder.style.height = `${draggingEl.offsetHeight}px`;
        if (afterEl) container.insertBefore(placeholder, afterEl); else container.insertBefore(placeholder, addBtn);
    }
}
function getDragAfterElementVertical(container, y, selector) {
    const draggableElements = [...container.querySelectorAll(`${selector}:not(.dragging)`)];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}
function getDragAfterBucketHorizontal(container, x) {
    const draggableElements = [...container.querySelectorAll('.task-board-column:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}
async function handleDrop(e) {
    e.preventDefault(); e.stopPropagation();
    const placeholder = document.querySelector('.task-placeholder, .bucket-placeholder');
    const draggedElement = document.querySelector('.dragging');
    if (!draggedElement || !placeholder) {
        if (draggedElement) draggedElement.classList.remove('dragging');
        if (placeholder) placeholder.remove();
        return;
    }

    const taskId = e.dataTransfer.getData('text/task-id');
    const bucketId = e.dataTransfer.getData('text/bucket-id');
    placeholder.parentNode.replaceChild(draggedElement, placeholder);
    draggedElement.classList.remove('dragging');

    try {
        if (bucketId) {
            const newOrder = Array.from(draggedElement.parentNode.children).filter(el => el.matches('[data-bucket]')).map(el => el.dataset.bucket);
            await updateSheetRow('Projects', 'ProjectID', state.selectedProjectId, { 'Task Buckets': JSON.stringify(newOrder) });
        } else if (taskId) {
            const promises = [];
            document.querySelectorAll('.task-bucket, .task-board-column').forEach(bucketEl => {
                Array.from(bucketEl.querySelectorAll('[data-task-id]')).forEach((taskEl, i) => {
                     promises.push(updateSheetRow('Tasks', 'TaskID', taskEl.dataset.taskId, { 'Bucket': bucketEl.dataset.bucket, 'SortIndex': i }));
                });
            });
            await Promise.all(promises);
        }
        showProjectDetails(state.selectedProjectId);
    } catch (err) {
        alert("Error saving new order. The view will be refreshed.");
        console.error("Drag/drop save error:", err);
        showProjectDetails(state.selectedProjectId);
    }
}
// --- MODALS AND ACTIONS ---
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
    const projectData = {
        'Project Name': document.getElementById('project-name').value, 'Client Email': sourceRequestSelect.dataset.clientEmail,
        'Status': document.getElementById('project-status').value, 'Value': document.getElementById('project-value').value,
        'Start Date': document.getElementById('project-start-date').value, 'ProjectID': `P-${Date.now()}`,
        'Source Request ID': sourceRequestSelect.value, 'Project Type': document.getElementById('project-type').value
    };
    try {
        await writeData('Projects', projectData);
        if (projectData['Source Request ID']) {
            await updateSheetRow('Submissions', 'Submission ID', projectData['Source Request ID'], { 'Status': 'Archived' });
        }
        statusSpan.textContent = 'Project created!';
        setTimeout(() => {
            elements.createProjectModal.style.display = 'none';
            document.querySelector('.tab-button[data-tab="projects"]').click();
        }, 1500);
    } catch (err) { statusSpan.textContent = 'Error creating project.'; console.error('Project creation error', err); }
}

function showDeleteProjectModal(projectId) {
    elements.deleteProjectModal.style.display = 'block';
    const confirmInput = document.getElementById('delete-project-confirm-input');
    const confirmBtn = document.getElementById('delete-project-confirm-btn');
    confirmInput.value = ''; confirmBtn.disabled = true;
    confirmInput.oninput = () => confirmBtn.disabled = confirmInput.value !== 'Delete';
    confirmBtn.onclick = () => handleDeleteProject(projectId);
}

async function handleDeleteProject(projectId) {
    const statusSpan = document.getElementById('delete-project-status');
    statusSpan.textContent = 'Deleting...';
    document.getElementById('delete-project-confirm-btn').disabled = true;
    try {
        const tasksToDelete = allTasks.rows.filter(t => t[allTasks.headers.indexOf('ProjectID')] === projectId);
        const taskDeletionPromises = tasksToDelete.map(t => clearSheetRow('Tasks', 'TaskID', t[allTasks.headers.indexOf('TaskID')]));
        await Promise.all(taskDeletionPromises);
        await clearSheetRow('Projects', 'ProjectID', projectId);
        updateState({ selectedProjectId: null });
        statusSpan.textContent = 'Project deleted.';
        setTimeout(() => elements.deleteProjectModal.style.display = 'none', 1500);
    } catch(err) {
        statusSpan.textContent = 'Error deleting project.';
        console.error('Delete project error', err);
    }
}
async function handleSaveProjectUpdate(projectId) {
    const dataToUpdate = {};
    ['Project Name', 'Status', 'Start Date', 'Value', 'Service Provider', 'Location'].forEach(h => {
        const input = document.getElementById(`project-edit-${h.replace(/\s+/g, '')}`);
        if(input) dataToUpdate[h] = input.value;
    });
    const folderLinkInput = document.getElementById('project-edit-GoogleFolderLink');
    if(folderLinkInput) dataToUpdate['Google Folder Link'] = folderLinkInput.value;

    try {
        await updateSheetRow('Projects', 'ProjectID', projectId, dataToUpdate);
        renderProjectsTab();
    } catch(err) { console.error('Project update error', err); alert('Could not save project updates.'); }
}
async function handleArchiveProject(projectId) {
    try {
        await updateSheetRow('Projects', 'ProjectID', projectId, { 'Status': 'Archived' });
        renderProjectsTab();
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
        showProjectDetails(projectId);
        statusSpan.textContent = 'Saved!';
        setTimeout(() => { elements.gdriveLinkModal.style.display = 'none'; }, 1000);
    } catch (err) {
        statusSpan.textContent = 'Error saving link.';
        console.error('GDrive link save error:', err);
    }
}
// Task related functions
async function handleSaveTask(event) {
    event.preventDefault();
    const statusSpan = document.getElementById('task-modal-status');
    statusSpan.textContent = 'Saving...';
    const taskId = document.getElementById('task-id-input').value;
    const taskData = {
        'ProjectID': document.getElementById('task-project-id-input').value,
        'Task Name': document.getElementById('task-title').value,
        'Description': document.getElementById('task-description').value,
        'Due Date': document.getElementById('task-due-date').value,
        'Assignee': document.getElementById('task-assignee').value,
        'Status': document.getElementById('task-status').value,
        'Bucket': document.getElementById('task-bucket').value || 'General',
        'Subtasks': document.getElementById('subtasks-data').value,
        'Links': document.getElementById('links-data').value
    };
    try {
        if (taskId) await updateSheetRow('Tasks', 'TaskID', taskId, taskData);
        else { 
            taskData.TaskID = `T-${Date.now()}`; 
            const tasksInBucket = getProjectTasksSorted(taskData.ProjectID).filter(t => (t.row[allTasks.headers.indexOf('Bucket')] || 'General') === taskData.Bucket);
            taskData.SortIndex = tasksInBucket.length;
            await writeData('Tasks', taskData); 
        }
        showProjectDetails(taskData.ProjectID);
        statusSpan.textContent = 'Saved!';
        setTimeout(() => { elements.taskDetailsModal.style.display = 'none'; }, 1000);
    } catch (err) { statusSpan.textContent = 'Error saving task.'; console.error('Task save error', err); }
}

function setupTaskClickHandlers(container, projectId) {
    container.querySelectorAll('.task-item, .task-card').forEach(el => {
        el.onclick = (e) => {
            if (e.target.closest('.subtask-item') || e.currentTarget.classList.contains('dragging')) return;
            const taskId = e.currentTarget.dataset.taskId;
            if (e.target.matches('.task-main input[type="checkbox"]')) handleTaskStatusChange(taskId, e.target.checked);
            else showTaskModal(projectId, taskId);
        };
    });
    container.querySelectorAll('.subtask-item input[type="checkbox"]').forEach(cb => cb.addEventListener('change', handleSubtaskStatusChange));
    container.querySelectorAll('.add-task-to-bucket-btn').forEach(btn => btn.onclick = () => showTaskModal(projectId, null, btn.dataset.bucket));
    document.getElementById('task-view-toggle').onclick = () => {
        updateState({ projectTaskView: state.projectTaskView === 'list' ? 'board' : 'list' });
        showProjectDetails(projectId);
    };
    document.getElementById('add-bucket-btn').onclick = async () => {
        const bucketName = prompt("Enter new bucket name:");
        if (bucketName && bucketName.trim() !== '') {
            const project = allProjects.rows.find(p => p[allProjects.headers.indexOf('ProjectID')] === projectId);
            const bucketsIndex = allProjects.headers.indexOf('Task Buckets');
            let currentBuckets = [];
            if (bucketsIndex > -1 && project[bucketsIndex]) try { currentBuckets = JSON.parse(project[bucketsIndex]); } catch (e) {}
            if (!currentBuckets.includes(bucketName.trim())) {
                currentBuckets.push(bucketName.trim());
                try {
                    await updateSheetRow('Projects', 'ProjectID', projectId, { 'Task Buckets': JSON.stringify(currentBuckets) });
                    showProjectDetails(projectId);
                } catch (err) { alert("Could not save new bucket."); console.error(err); }
            }
        }
    };
}

async function handleTaskStatusChange(taskId, isChecked) {
    const newStatus = isChecked ? 'Done' : 'To Do';
    try {
        await updateSheetRow('Tasks', 'TaskID', taskId, { 'Status': newStatus });
        const task = allTasks.rows.find(t => t[allTasks.headers.indexOf('TaskID')] === taskId);
        const projectId = task ? task[allTasks.headers.indexOf('ProjectID')] : state.selectedProjectId;
        if(projectId) showProjectDetails(projectId);
    } catch(err) { console.error('Task status update error', err); alert('Could not update task status.'); }
}
async function handleSubtaskStatusChange(event) {
    const checkbox = event.target;
    const taskId = checkbox.dataset.taskId;
    const subtaskIndex = parseInt(checkbox.dataset.subtaskIndex, 10);
    const isChecked = checkbox.checked;

    checkbox.disabled = true;

    const taskIndex = allTasks.rows.findIndex(t => t[allTasks.headers.indexOf('TaskID')] === taskId);
    if (taskIndex === -1) return;

    const taskRow = allTasks.rows[taskIndex];
    const subtasksJson = taskRow[allTasks.headers.indexOf('Subtasks')] || '[]';
    let subtasks = [];
    try {
        subtasks = JSON.parse(subtasksJson);
    } catch (e) {
        console.error("Error parsing subtasks for task:", taskId, e);
        return;
    }

    if (subtasks[subtaskIndex]) {
        subtasks[subtaskIndex].completed = isChecked;
    }

    const updatedSubtasksJson = JSON.stringify(subtasks);

    try {
        await updateSheetRow('Tasks', 'TaskID', taskId, { 'Subtasks': updatedSubtasksJson });
        showProjectDetails(state.selectedProjectId);
    } catch (err) {
        console.error('Subtask status update error', err);
        alert('Could not update subtask status.');
        showProjectDetails(state.selectedProjectId);
    }
}

export function showTaskModal(projectId, taskId = null, bucketName = null) {
    const form = document.getElementById('task-details-form'); form.reset();
    document.getElementById('task-project-id-input').value = projectId;
    document.getElementById('task-modal-status').textContent = '';
    const project = allProjects.rows.find(p => p[allProjects.headers.indexOf('ProjectID')] === projectId);
    let buckets = getProjectBuckets(projectId);
    const bucketSelect = document.getElementById('task-bucket');
    bucketSelect.innerHTML = '';
    buckets.forEach(b => bucketSelect.add(new Option(b, b)));

    if (taskId) {
        document.getElementById('task-modal-title').textContent = 'Edit Task';
        document.getElementById('task-id-input').value = taskId;
        const task = allTasks.rows.find(t => t[allTasks.headers.indexOf('TaskID')] === taskId);
        if(task) {
            const { headers } = allTasks;
            document.getElementById('task-title').value = task[headers.indexOf('Task Name')] || '';
            document.getElementById('task-description').value = task[headers.indexOf('Description')] || '';
            document.getElementById('task-due-date').value = task[headers.indexOf('Due Date')] || '';
            document.getElementById('task-assignee').value = task[headers.indexOf('Assignee')] || '';
            document.getElementById('task-status').value = task[headers.indexOf('Status')] || 'To Do';
            bucketSelect.value = task[headers.indexOf('Bucket')] || 'General';
            renderSubtasks(JSON.parse(task[headers.indexOf('Subtasks')] || '[]'));
            renderLinks(JSON.parse(task[headers.indexOf('Links')] || '[]'));
        }
    } else {
        document.getElementById('task-modal-title').textContent = 'New Task';
        if (bucketName) bucketSelect.value = bucketName;
        renderSubtasks([]); renderLinks([]);
    }
    document.getElementById('add-subtask-btn').onclick = () => {
        const name = document.getElementById('new-subtask-name').value; if(!name) return;
        const subtasks = JSON.parse(document.getElementById('subtasks-data').value);
        subtasks.push({ name, completed: false });
        renderSubtasks(subtasks);
        document.getElementById('new-subtask-name').value = '';
    };
    document.getElementById('add-link-btn').onclick = () => {
        const url = document.getElementById('new-link-url').value; if(!url) return;
        const links = JSON.parse(document.getElementById('links-data').value);
        links.push(url);
        renderLinks(links);
        document.getElementById('new-link-url').value = '';
    };
    elements.taskDetailsModal.style.display = 'block';
}
function renderSubtasks(subtasks) {
    const container = document.getElementById('subtasks-container-modal');
    container.innerHTML = `<input type="hidden" id="subtasks-data" value='${JSON.stringify(subtasks)}'>`;
    subtasks.forEach((sub, i) => {
        const item = document.createElement('div');
        item.className = 'subtask-item';
        item.setAttribute('draggable', true);
        item.dataset.index = i;
        item.innerHTML = `<input type="checkbox" ${sub.completed ? 'checked' : ''}> <label>${sub.name}</label> <button type="button" class="btn btn-subtle">&times;</button>`;
        item.querySelector('input').onchange = (e) => updateSubtaskStatus(i, e.target.checked);
        item.querySelector('button').onclick = () => removeSubtask(i);
        item.ondragstart = (e) => e.dataTransfer.setData('text/subtask-index', i);
        container.appendChild(item);
    });
    container.ondragover = (e) => e.preventDefault();
    container.ondrop = (e) => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData('text/subtask-index'));
        const target = e.target.closest('.subtask-item');
        if (target) {
            const toIndex = parseInt(target.dataset.index);
            const subtasks = JSON.parse(document.getElementById('subtasks-data').value);
            const [moved] = subtasks.splice(fromIndex, 1);
            subtasks.splice(toIndex, 0, moved);
            renderSubtasks(subtasks);
        }
    };
}
function updateSubtaskStatus(index, completed) {
    const subtasks = JSON.parse(document.getElementById('subtasks-data').value);
    subtasks[index].completed = completed;
    renderSubtasks(subtasks);
}
function removeSubtask(index) {
    const subtasks = JSON.parse(document.getElementById('subtasks-data').value);
    subtasks.splice(index, 1);
    renderSubtasks(subtasks);
}
function renderLinks(links) {
    const container = document.getElementById('links-container');
    container.innerHTML = `<input type="hidden" id="links-data" value='${JSON.stringify(links)}'>`;
    links.forEach((link, i) => {
        const linkEl = document.createElement('div');
        linkEl.className = 'item-tag';
        linkEl.innerHTML = `<a href="${link}" target="_blank">${link}</a> <button type="button" class="btn btn-subtle" data-index="${i}">&times;</button>`;
        container.appendChild(linkEl);
    });
    // Add event listeners after rendering
    container.querySelectorAll('.item-tag button').forEach(button => {
        button.addEventListener('click', e => {
            const indexToRemove = parseInt(e.currentTarget.dataset.index, 10);
            const currentLinks = JSON.parse(document.getElementById('links-data').value);
            currentLinks.splice(indexToRemove, 1);
            renderLinks(currentLinks);
        });
    });
}
