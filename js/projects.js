// js/projects.js
// Description: Handles all logic for the Projects tab, including rendering the project list, details, tasks, and financials.

import {
    allProjects, allClients, allStaff, allEquipment, currentView,
    updateProjectData, updateProjectFinancials, addTaskToProject, updateTaskInProject, deleteTaskFromProject,
    updateProjectGDriveLink, addAssignedEquipmentToProject, removeAssignedEquipmentFromProject,
    addAssignedStaffToProject, removeAssignedStaffFromProject
} from './state.js';
import {
    showModal, hideModal, updateStatus,
    openClientDetailsFromId
} from './ui.js';
import { gapi } from './main.js';

let activeDragTask = null;
let activeDragBucket = null;
let currentProjectId = null;

export function initProjects() {
    renderProjects();
    document.getElementById('project-search-bar').addEventListener('input', () => renderProjects(document.getElementById('project-search-bar').value));
    document.getElementById('archived-projects-toggle').addEventListener('click', (e) => {
        e.currentTarget.classList.toggle('collapsed');
        document.getElementById('archived-projects-list').classList.toggle('collapsed');
    });

    // Task Modal Event Listeners
    const taskForm = document.getElementById('task-details-form');
    taskForm.addEventListener('submit', handleTaskFormSubmit);
    document.getElementById('add-subtask-btn').addEventListener('click', handleAddSubtask);
    document.getElementById('add-link-btn').addEventListener('click', handleAddLink);

     // GDrive Modal Event Listeners
    document.getElementById('gdrive-link-form').addEventListener('submit', handleGDriveLinkSubmit);
}

// Main rendering function
export function renderProjects(searchTerm = '') {
    const activeList = document.getElementById('active-projects-list');
    const archivedList = document.getElementById('archived-projects-list');
    activeList.innerHTML = '';
    archivedList.innerHTML = '';

    if (!allProjects.rows) {
        activeList.innerHTML = '<p>No projects found.</p>';
        return;
    }

    const nameIdx = allProjects.headers.indexOf('Project Name');
    const clientNameIdx = allProjects.headers.indexOf('Client Name');
    const statusIdx = allProjects.headers.indexOf('Status');
    const idIdx = allProjects.headers.indexOf('Project ID');
    
    if (nameIdx === -1 || clientNameIdx === -1 || statusIdx === -1 || idIdx === -1) {
        console.error("Project headers are missing required columns.");
        activeList.innerHTML = '<p>Error loading projects due to missing data columns.</p>';
        return;
    }

    const filteredProjects = allProjects.rows.filter(row => {
        const projectName = row[nameIdx] || '';
        const clientName = row[clientNameIdx] || '';
        return projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               clientName.toLowerCase().includes(searchTerm.toLowerCase());
    });

    filteredProjects.forEach(row => {
        const project = {
            'Project Name': row[nameIdx],
            'Client Name': row[clientNameIdx],
            'Status': row[statusIdx],
            'Project ID': row[idIdx]
        };

        const listItem = createProjectListItem(project);
        if (project['Status'] === 'Archived') {
            archivedList.appendChild(listItem);
        } else {
            activeList.appendChild(listItem);
        }
    });
    
    // Auto-select the first project or the one that was open
    if (currentProjectId) {
        const elementToSelect = document.querySelector(`.project-list-item[data-project-id="${currentProjectId}"]`);
        if (elementToSelect) {
            selectProject(elementToSelect);
        } else {
            // If the current project is no longer visible (e.g., archived), clear the details
            currentProjectId = null;
            document.getElementById('project-details-column').innerHTML = '<p>Select a project to view its details.</p>';
        }
    }
}

function createProjectListItem(project) {
    const listItem = document.createElement('div');
    listItem.className = 'project-list-item';
    listItem.dataset.projectId = project['Project ID'];
    listItem.innerHTML = `
        <h4>${project['Project Name']}</h4>
        <p>${project['Client Name']}</p>
        <p>Status: ${project['Status']}</p>
    `;
    listItem.addEventListener('click', () => {
        selectProject(listItem);
    });
    return listItem;
}

function selectProject(element) {
    // Deselect other items
    document.querySelectorAll('.project-list-item.active').forEach(item => {
        item.classList.remove('active');
    });
    // Select the new item
    element.classList.add('active');
    currentProjectId = element.dataset.projectId;
    renderProjectDetails(currentProjectId);
}

export function renderProjectDetails(projectId) {
    const detailsContainer = document.getElementById('project-details-column');
    detailsContainer.innerHTML = ''; // Clear previous details
    currentProjectId = projectId; // Update the global tracker

    if (!allProjects.rows) {
        detailsContainer.innerHTML = '<p>Project data not loaded.</p>';
        return;
    }

    const idIdx = allProjects.headers.indexOf('Project ID');
    const projectRow = allProjects.rows.find(row => row[idIdx] === projectId);

    if (!projectRow) {
        detailsContainer.innerHTML = '<p>Project not found.</p>';
        return;
    }

    // Convert row to object
    const project = allProjects.headers.reduce((obj, header, i) => {
        obj[header] = projectRow[i];
        return obj;
    }, {});
    
    // --- Header ---
    const header = document.createElement('div');
    header.className = 'project-details-header';
    header.innerHTML = `
        <div>
            <h2>${project['Project Name']}</h2>
            <p><strong>Status:</strong> ${project['Status'] || 'N/A'}</p>
        </div>
        <div class="project-actions-dropdown">
            <button class="btn btn-secondary">Actions &#9662;</button>
            <div class="project-actions-dropdown-content">
                <a href="#" id="edit-project-details-btn">Edit Details</a>
                <a href="#" id="archive-project-btn">Archive Project</a>
                <a href="#" id="delete-project-btn" class="delete">Delete Project</a>
            </div>
        </div>
    `;
    detailsContainer.appendChild(header);
    
    // Setup Action Dropdown
    const actionBtn = header.querySelector('.btn');
    const dropdownContent = header.querySelector('.project-actions-dropdown-content');
    actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', () => dropdownContent.style.display = 'none'); // Close on outside click
    
    // --- Details Grid ---
    const clientLink = `<a href="#" data-client-id="${project['Client ID']}">${project['Client Name'] || 'N/A'}</a>`;
    const detailsGrid = document.createElement('div');
    detailsGrid.className = 'project-details-grid';
    detailsGrid.innerHTML = `
        <div class="project-details-section">
            <h4>Core Details</h4>
            <ul>
                <li><strong>Client:</strong> ${clientLink}</li>
                <li><strong>Project Type:</strong> ${project['Project Type'] || 'N/A'}</li>
                <li><strong>Status:</strong> ${project['Status'] || 'N/A'}</li>
                <li><strong>Start Date:</strong> ${project['Start Date'] ? new Date(project['Start Date']).toLocaleDateString() : 'N/A'}</li>
            </ul>
        </div>
        <div class="project-details-section">
             <h4>Google Drive</h4>
            <div id="gdrive-card-container"></div>
        </div>
    `;
    detailsContainer.appendChild(detailsGrid);
    
    // Add client link functionality
    detailsGrid.querySelector('a[data-client-id]').addEventListener('click', (e) => {
        e.preventDefault();
        openClientDetailsFromId(e.target.dataset.clientId);
    });

    // Render Google Drive Card
    renderGDriveCard(project['Google Drive Link'], project['Project ID']);

    // --- Financials ---
    renderFinancialsSection(project);

    // --- Tasks ---
    renderTasksSection(project);
    
    // --- Assigned Equipment ---
    renderAssignedEquipmentSection(project);

    // --- Assigned Staff ---
    renderAssignedStaffSection(project);

    // --- Notes ---
    const notesSection = document.createElement('div');
    notesSection.className = 'project-details-section card';
    notesSection.innerHTML = `
        <h4>Notes</h4>
        <textarea id="project-notes" placeholder="Add notes for this project...">${project['Notes'] || ''}</textarea>
        <button id="save-project-notes-btn" class="btn btn-secondary" style="margin-top: 10px;">Save Notes</button>
    `;
    detailsContainer.appendChild(notesSection);

    // Event Listeners for actions
    document.getElementById('save-project-notes-btn').addEventListener('click', () => {
        const notes = document.getElementById('project-notes').value;
        updateProjectData(projectId, 'Notes', notes);
        updateStatus('Notes saved!', 'success', 'project-list-title');
    });

    document.getElementById('delete-project-btn').addEventListener('click', (e) => {
        e.preventDefault();
        const modal = document.getElementById('delete-project-modal');
        modal.dataset.projectId = projectId;
        showModal('delete-project-modal');
    });
}

function renderGDriveCard(gdriveLink, projectId) {
    const container = document.getElementById('gdrive-card-container');
    container.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'info-card interactive-card folder-link-container';
    if (gdriveLink) {
        card.innerHTML = `
            <div class="card-main-content">
                <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"></path><path d="M10.21 16.83l-2.04-1.99 1.41-1.41 2.04 2 5.66-5.66 1.41 1.41z"></path></svg>
                <h4>Folder Linked</h4>
            </div>
            <div class="card-hover-content">
                <a href="${gdriveLink}" target="_blank" class="btn btn-primary">Open Folder</a>
            </div>
        `;
        card.addEventListener('click', () => window.open(gdriveLink, '_blank'));
    } else {
        card.innerHTML = `
            <div class="card-main-content">
                <svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V6h5.17l2 2H20v10z"></path></svg>
                <h4>Link Folder</h4>
            </div>
            <div class="card-hover-content">
                <button class="btn btn-primary" id="link-gdrive-folder-btn">Link Now</button>
            </div>
        `;
        card.addEventListener('click', () => openGDriveLinkModal(projectId));
    }
    container.appendChild(card);
}

function openGDriveLinkModal(projectId) {
    document.getElementById('gdrive-project-id-input').value = projectId;
    document.getElementById('gdrive-link-input').value = '';
    updateStatus('', 'clear', 'gdrive-link-status');
    showModal('gdrive-link-modal');
}

async function handleGDriveLinkSubmit(e) {
    e.preventDefault();
    const projectId = document.getElementById('gdrive-project-id-input').value;
    const link = document.getElementById('gdrive-link-input').value;
    const statusEl = document.getElementById('gdrive-link-status');

    if (!projectId || !link) {
        updateStatus('Missing project ID or link.', 'error', statusEl);
        return;
    }
    updateStatus('Saving...', 'info', statusEl);
    try {
        await updateProjectGDriveLink(projectId, link);
        updateStatus('Link saved!', 'success', statusEl);
        setTimeout(() => {
            hideModal('gdrive-link-modal');
            renderProjectDetails(projectId);
        }, 1000);
    } catch (error) {
        updateStatus(`Error: ${error.message}`, 'error', statusEl);
    }
}


function renderFinancialsSection(project) {
    const detailsContainer = document.getElementById('project-details-column');
    const financialsSection = document.createElement('div');
    financialsSection.className = 'project-details-section card';
    
    let isEditing = false;
    let costItems = [];
    try {
        costItems = JSON.parse(project['Cost Breakdown'] || '[]');
    } catch (e) {
        console.error("Could not parse Cost Breakdown:", e);
        costItems = [];
    }

    function renderView() {
        const totalCost = costItems.reduce((sum, item) => sum + parseFloat(item.cost || 0), 0);
        const headerHTML = `
            <div class="project-details-section-header">
                <h4>Financials</h4>
                <p class="financial-total">Total: <span>$${totalCost.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></p>
            </div>
        `;
        if (isEditing) {
            let tableRows = costItems.map((item, index) => `
                <tr>
                    <td><input type="text" class="cost-item-name" value="${item.name}" data-index="${index}"></td>
                    <td><input type="number" class="cost-item-cost" value="${item.cost}" step="0.01" data-index="${index}"></td>
                    <td><button class="btn btn-danger btn-small" data-action="delete" data-index="${index}">X</button></td>
                </tr>
            `).join('');

            financialsSection.innerHTML = `
                ${headerHTML}
                <table class="line-item-table">
                    <thead><tr><th>Item</th><th>Cost</th><th></th></tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
                <div class="financials-edit-actions">
                    <button class="btn btn-secondary" data-action="add">Add Item</button>
                    <div>
                        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
                        <button class="btn btn-primary" data-action="save">Save</button>
                    </div>
                </div>
            `;
        } else {
            let tableRows = costItems.map(item => `
                <tr>
                    <td>${item.name}</td>
                    <td>$${parseFloat(item.cost || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                </tr>
            `).join('');

            financialsSection.innerHTML = `
                ${headerHTML}
                <table class="line-item-table">
                    <thead><tr><th>Item</th><th>Cost</th></tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
                 <button class="btn btn-secondary" data-action="edit">Edit</button>
            `;
        }
        detailsContainer.insertBefore(financialsSection, detailsContainer.querySelector('.card:has(h4:contains(Tasks))'));
    }

    financialsSection.addEventListener('click', async (e) => {
        const action = e.target.dataset.action;
        if (action === 'edit') {
            isEditing = true;
            renderView();
        } else if (action === 'cancel') {
            isEditing = false;
             try {
                costItems = JSON.parse(project['Cost Breakdown'] || '[]');
            } catch (e) { costItems = []; }
            renderView();
        } else if (action === 'add') {
            costItems.push({ name: '', cost: '0.00' });
            renderView();
        } else if (action === 'delete') {
            costItems.splice(e.target.dataset.index, 1);
            renderView();
        } else if (action === 'save') {
            isEditing = false;
            await updateProjectFinancials(project['Project ID'], costItems);
            // Re-fetch or update local state for project before re-rendering
            project['Cost Breakdown'] = JSON.stringify(costItems);
            renderView();
            updateStatus('Financials saved!', 'success', 'project-list-title');
        }
    });

    financialsSection.addEventListener('change', (e) => {
        if (isEditing && (e.target.classList.contains('cost-item-name') || e.target.classList.contains('cost-item-cost'))) {
            const index = e.target.dataset.index;
            const key = e.target.classList.contains('cost-item-name') ? 'name' : 'cost';
            costItems[index][key] = e.target.value;
        }
    });

    renderView();
}


function renderTasksSection(project) {
    const detailsContainer = document.getElementById('project-details-column');
    const tasksSection = document.createElement('div');
    tasksSection.className = 'project-details-section card';

    let tasks = [];
    try {
        tasks = JSON.parse(project['Tasks'] || '[]');
    } catch (e) {
        console.error("Could not parse Tasks:", e);
        tasks = [];
    }

    const taskBuckets = ['To Do', 'In Progress', 'Done']; // Or get from a setting
    let buckets = {};
    try {
        buckets = JSON.parse(project['Task Buckets'] || `{}`);
        if (!Object.keys(buckets).length) {
             buckets = {
                'Default Bucket': []
            };
        }
    } catch(e) {
        buckets = {
            'Default Bucket': []
        };
    }
    
    tasksSection.innerHTML = `
        <div class="project-details-section-header">
            <h4>Tasks</h4>
            <div>
                 <select id="task-view-toggle">
                    <option value="list">List View</option>
                    <option value="board">Board View</option>
                </select>
                <button id="add-task-btn" class="btn btn-secondary">Add Task</button>
            </div>
        </div>
        <div id="tasks-content-container"></div>
    `;
    
    detailsContainer.insertBefore(tasksSection, detailsContainer.querySelector('.card:has(h4:contains(Assigned Equipment))'));

    const container = document.getElementById('tasks-content-container');
    
    function renderListView() {
        container.innerHTML = '';
        const bucketContainer = document.createElement('div');
        bucketContainer.id = 'task-buckets-list-view';

        Object.entries(buckets).forEach(([bucketName, taskIds]) => {
            const bucketEl = document.createElement('div');
            bucketEl.className = 'task-bucket';
            bucketEl.dataset.bucketName = bucketName;
            let taskItemsHTML = taskIds.map(taskId => {
                const task = tasks.find(t => t.id === taskId);
                return task ? createTaskItemHTML(task) : '';
            }).join('');
            
            bucketEl.innerHTML = `
                <h5>${bucketName}</h5>
                <div class="task-list">${taskItemsHTML}</div>
                <button class="btn btn-subtle add-task-to-bucket-btn" data-bucket="${bucketName}">+ Add Task</button>
            `;
            bucketContainer.appendChild(bucketEl);
        });

        container.appendChild(bucketContainer);
    }
    
    function renderBoardView() {
        container.innerHTML = '';
        const boardContainer = document.createElement('div');
        boardContainer.className = 'task-board';
        boardContainer.id = 'task-board-view';

        Object.entries(buckets).forEach(([bucketName, taskIds]) => {
            const columnEl = document.createElement('div');
            columnEl.className = 'task-board-column';
            columnEl.dataset.bucketName = bucketName;

            let taskCardsHTML = taskIds.map(taskId => {
                const task = tasks.find(t => t.id === taskId);
                return task ? createTaskCardHTML(task) : '';
            }).join('');
            
            columnEl.innerHTML = `
                <h5>${bucketName}</h5>
                <div class="task-card-list">${taskCardsHTML}</div>
                 <button class="btn btn-subtle add-task-to-bucket-btn" data-bucket="${bucketName}">+ Add Task</button>
            `;
            boardContainer.appendChild(columnEl);
        });

        container.appendChild(boardContainer);
    }

    document.getElementById('task-view-toggle').addEventListener('change', (e) => {
        if (e.target.value === 'list') {
            renderListView();
        } else {
            renderBoardView();
        }
        addDragAndDropListeners();
    });
    
    // Initial Render
    renderListView();
    addDragAndDropListeners();
    
    // Event listeners
    document.getElementById('add-task-btn').addEventListener('click', () => openTaskModal(null, project['Project ID']));
    tasksSection.addEventListener('click', (e) => {
        if (e.target.closest('.task-item') || e.target.closest('.task-card')) {
            const taskElement = e.target.closest('.task-item') || e.target.closest('.task-card');
            const taskId = taskElement.dataset.taskId;
            openTaskModal(taskId, project['Project ID']);
        }
        if (e.target.classList.contains('add-task-to-bucket-btn')) {
            const bucket = e.target.dataset.bucket;
            openTaskModal(null, project['Project ID'], bucket);
        }
    });
    tasksSection.addEventListener('change', (e) => {
        if (e.target.matches('.task-item-checkbox, .subtask-item-checkbox')) {
            const taskId = e.target.closest('[data-task-id]').dataset.taskId;
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;

            if (e.target.matches('.subtask-item-checkbox')) {
                const subtaskIndex = e.target.dataset.subtaskIndex;
                task.subtasks[subtaskIndex].completed = e.target.checked;
            } else { // Main task checkbox
                task.status = e.target.checked ? 'Done' : 'To Do';
            }
            updateTaskInProject(project['Project ID'], task);
        }
    });

}

function createTaskItemHTML(task) {
    const isCompleted = task.status === 'Done';
    const subtasks = task.subtasks || [];
    const completedSubtasks = subtasks.filter(st => st.completed).length;
    const hasSubtasks = subtasks.length > 0;
    
    let subtaskListHTML = '';
    if (hasSubtasks) {
        subtaskListHTML = `<ul class="subtask-list">`;
        subtasks.forEach((st, index) => {
            subtaskListHTML += `
                <li class="subtask-item">
                    <input type="checkbox" class="subtask-item-checkbox" data-subtask-index="${index}" ${st.completed ? 'checked' : ''}>
                    <label>${st.name}</label>
                </li>`;
        });
        subtaskListHTML += `</ul>`;
    }

    return `
        <div class="task-item" data-task-id="${task.id}" draggable="true">
            <div class="task-main ${isCompleted ? 'completed' : ''}">
                <input type="checkbox" class="task-item-checkbox" ${isCompleted ? 'checked' : ''}>
                <label>${task.title}</label>
            </div>
            ${hasSubtasks ? `<div class="task-progress"><div class="task-progress-bar" style="width: ${(completedSubtasks/subtasks.length)*100}%"></div></div>` : ''}
            ${subtaskListHTML}
        </div>
    `;
}

function createTaskCardHTML(task) {
    const subtasks = task.subtasks || [];
    const completedSubtasks = subtasks.filter(st => st.completed).length;
    const hasSubtasks = subtasks.length > 0;
    
    return `
        <div class="task-card" data-task-id="${task.id}" draggable="true">
            <p>${task.title}</p>
            ${hasSubtasks ? `<div class="subtask-summary">${completedSubtasks}/${subtasks.length} subtasks done</div>` : ''}
        </div>
    `;
}

// DRAG AND DROP LOGIC
function addDragAndDropListeners() {
    const tasks = document.querySelectorAll('.task-item, .task-card');
    tasks.forEach(task => {
        task.addEventListener('dragstart', handleDragStart);
        task.addEventListener('dragend', handleDragEnd);
    });
    
    const buckets = document.querySelectorAll('.task-bucket .task-list, .task-board-column .task-card-list');
    buckets.forEach(bucket => {
        bucket.addEventListener('dragover', handleDragOver);
        bucket.addEventListener('dragleave', handleDragLeave);
        bucket.addEventListener('drop', handleDrop);
    });

    // Also for bucket-to-bucket dragging
    const bucketContainers = document.querySelectorAll('.task-bucket, .task-board-column');
    bucketContainers.forEach(container => {
        container.addEventListener('dragstart', handleBucketDragStart);
        container.addEventListener('dragend', handleBucketDragEnd);
        container.addEventListener('dragover', handleBucketDragOver);
        container.addEventListener('drop', handleBucketDrop);
    });
}

function handleDragStart(e) {
    activeDragTask = e.target;
    e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.target.classList.add('dragging'), 0);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    activeDragTask = null;
    document.querySelectorAll('.task-placeholder').forEach(p => p.remove());
}

function handleDragOver(e) {
    e.preventDefault();
    const dropZone = e.currentTarget;
    const afterElement = getDragAfterElement(dropZone, e.clientY);
    const placeholder = document.querySelector('.task-placeholder') || createPlaceholder(activeDragTask);
    
    if (afterElement == null) {
        dropZone.appendChild(placeholder);
    } else {
        dropZone.insertBefore(placeholder, afterElement);
    }
}

function handleDragLeave(e) {
    // This can be tricky; handled by dragover and drop
}

async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation(); // Prevent parent drop handlers
    const dropZone = e.currentTarget;
    const bucketName = dropZone.closest('[data-bucket-name]').dataset.bucketName;
    const taskId = e.dataTransfer.getData('text/plain');
    const draggedElement = document.querySelector(`[data-task-id="${taskId}"]`);
    const placeholder = document.querySelector('.task-placeholder');

    if (draggedElement && bucketName) {
        dropZone.insertBefore(draggedElement, placeholder);
        placeholder.remove();
        
        // Update state
        const project = allProjects.rowsAsObjects().find(p => p['Project ID'] === currentProjectId);
        if (project) {
            const buckets = JSON.parse(project['Task Buckets'] || '{}');
            // Remove from old bucket
            Object.keys(buckets).forEach(key => {
                buckets[key] = buckets[key].filter(id => id !== taskId);
            });
            // Add to new bucket in correct position
            const tasksInBucket = Array.from(dropZone.children).map(child => child.dataset.taskId).filter(Boolean);
            buckets[bucketName] = tasksInBucket;
            
            await updateProjectData(currentProjectId, 'Task Buckets', JSON.stringify(buckets));
        }
    }
}

function handleBucketDragStart(e) {
    if (!e.target.matches('.task-bucket, .task-board-column')) return;
    e.stopPropagation();
    activeDragBucket = e.target;
    e.dataTransfer.setData('text/plain', e.target.dataset.bucketName);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.target.classList.add('dragging'), 0);
}

function handleBucketDragEnd(e) {
    if (!activeDragBucket) return;
    e.target.classList.remove('dragging');
    activeDragBucket = null;
    document.querySelectorAll('.bucket-placeholder').forEach(p => p.remove());
}

function handleBucketDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropContainer = e.currentTarget.parentElement;
    const afterElement = getDragAfterElement(dropContainer, e.clientY, true);
    const placeholder = document.querySelector('.bucket-placeholder') || createPlaceholder(activeDragBucket, true);

    if (afterElement == null) {
        dropContainer.appendChild(placeholder);
    } else {
        dropContainer.insertBefore(placeholder, afterElement);
    }
}

async function handleBucketDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropContainer = e.currentTarget.parentElement;
    const bucketName = e.dataTransfer.getData('text/plain');
    const draggedBucket = document.querySelector(`[data-bucket-name="${bucketName}"]`);
    const placeholder = document.querySelector('.bucket-placeholder');
    
    if(draggedBucket) {
        dropContainer.insertBefore(draggedBucket, placeholder);
        placeholder.remove();
        
        // Update state
        const project = allProjects.rowsAsObjects().find(p => p['Project ID'] === currentProjectId);
        if (project) {
            const buckets = JSON.parse(project['Task Buckets'] || '{}');
            const orderedBucketNames = Array.from(dropContainer.children)
                .map(child => child.dataset.bucketName).filter(Boolean);
            
            const newBuckets = {};
            orderedBucketNames.forEach(name => {
                newBuckets[name] = buckets[name] || [];
            });

            await updateProjectData(currentProjectId, 'Task Buckets', JSON.stringify(newBuckets));
        }
    }
}

function getDragAfterElement(container, y, isBucket = false) {
    const draggableElements = [...container.querySelectorAll(isBucket ? '[data-bucket-name]:not(.dragging)' : '[data-task-id]:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function createPlaceholder(draggedElement, isBucket = false) {
    const placeholder = document.createElement('div');
    if (isBucket) {
        placeholder.className = 'bucket-placeholder';
        placeholder.style.height = `${draggedElement.offsetHeight}px`;
    } else {
        placeholder.className = 'task-placeholder';
        placeholder.style.height = `${draggedElement.offsetHeight}px`;
    }
    return placeholder;
}


// --- Task Modal ---
function openTaskModal(taskId, projectId, defaultBucket = null) {
    const modal = document.getElementById('task-details-modal');
    const form = document.getElementById('task-details-form');
    form.reset();
    document.getElementById('subtasks-container-modal').innerHTML = '';
    document.getElementById('links-container').innerHTML = '';
    updateStatus('', 'clear', 'task-modal-status');
    
    document.getElementById('task-project-id-input').value = projectId;

    const project = allProjects.rowsAsObjects().find(p => p['Project ID'] === projectId);
    const buckets = project ? JSON.parse(project['Task Buckets'] || '{}') : {};
    const bucketSelect = document.getElementById('task-bucket');
    bucketSelect.innerHTML = Object.keys(buckets).map(b => `<option>${b}</option>`).join('');

    if (taskId) {
        document.getElementById('task-modal-title').textContent = 'Edit Task';
        const tasks = JSON.parse(project['Tasks'] || '[]');
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            document.getElementById('task-id-input').value = task.id;
            document.getElementById('task-title').value = task.title;
            document.getElementById('task-description').value = task.description || '';
            document.getElementById('task-due-date').value = task.dueDate || '';
            document.getElementById('task-assignee').value = task.assignee || '';
            document.getElementById('task-status').value = task.status || 'To Do';
            
            // Find which bucket it belongs to
            let taskBucket = defaultBucket;
            for (const [bucketName, taskIds] of Object.entries(buckets)) {
                if (taskIds.includes(taskId)) {
                    taskBucket = bucketName;
                    break;
                }
            }
            bucketSelect.value = taskBucket || Object.keys(buckets)[0];

            // Render subtasks and links
            (task.subtasks || []).forEach(st => addSubtaskToDOM(st.name, st.completed));
            (task.links || []).forEach(link => addLinkToDOM(link));
        }
    } else {
        document.getElementById('task-modal-title').textContent = 'New Task';
        document.getElementById('task-id-input').value = '';
        if (defaultBucket) {
            bucketSelect.value = defaultBucket;
        }
    }
    showModal('task-details-modal');
}


async function handleTaskFormSubmit(e) {
    e.preventDefault();
    const statusEl = document.getElementById('task-modal-status');
    updateStatus('Saving...', 'info', statusEl);
    
    const projectId = document.getElementById('task-project-id-input').value;
    const taskId = document.getElementById('task-id-input').value;
    
    // Collect subtasks
    const subtasks = [];
    document.querySelectorAll('#subtasks-container-modal .item-tag').forEach(tag => {
        subtasks.push({
            name: tag.querySelector('span').textContent,
            completed: tag.querySelector('input').checked
        });
    });

    // Collect links
    const links = [];
    document.querySelectorAll('#links-container .item-tag a').forEach(linkEl => {
        links.push(linkEl.href);
    });

    const taskData = {
        id: taskId || `task_${new Date().getTime()}`,
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-description').value,
        dueDate: document.getElementById('task-due-date').value,
        assignee: document.getElementById('task-assignee').value,
        status: document.getElementById('task-status').value,
        subtasks: subtasks,
        links: links,
    };
    
    const selectedBucket = document.getElementById('task-bucket').value;

    try {
        if (taskId) {
            await updateTaskInProject(projectId, taskData, selectedBucket);
        } else {
            await addTaskToProject(projectId, taskData, selectedBucket);
        }
        updateStatus('Task saved successfully!', 'success', statusEl);
        setTimeout(() => {
            hideModal('task-details-modal');
            renderProjectDetails(projectId);
        }, 1000);
    } catch (error) {
        updateStatus(`Error: ${error.message}`, 'error', statusEl);
    }
}

function handleAddSubtask() {
    const input = document.getElementById('new-subtask-name');
    if (input.value.trim()) {
        addSubtaskToDOM(input.value.trim());
        input.value = '';
    }
}
function handleAddLink() {
    const input = document.getElementById('new-link-url');
    if (input.value.trim()) {
        addLinkToDOM(input.value.trim());
        input.value = '';
    }
}

function addSubtaskToDOM(name, isCompleted = false) {
    const container = document.getElementById('subtasks-container-modal');
    const tag = document.createElement('div');
    tag.className = 'item-tag';
    tag.innerHTML = `
        <input type="checkbox" ${isCompleted ? 'checked' : ''}>
        <span>${name}</span>
        <button type="button">&times;</button>
    `;
    tag.querySelector('button').addEventListener('click', () => tag.remove());
    container.appendChild(tag);
}

function addLinkToDOM(url) {
    const container = document.getElementById('links-container');
    const tag = document.createElement('div');
    tag.className = 'item-tag';
    try {
        const hostname = new URL(url).hostname;
        tag.innerHTML = `
            <a href="${url}" target="_blank">${hostname}</a>
            <button type="button">&times;</button>
        `;
        tag.querySelector('button').addEventListener('click', () => tag.remove());
        container.appendChild(tag);
    } catch (e) {
        // Handle invalid URL if necessary
        console.warn("Invalid URL for link tag:", url);
    }
}

// --- Assigned Equipment & Staff --- //
function renderAssignedEquipmentSection(project) {
    const detailsContainer = document.getElementById('project-details-column');
    const section = document.createElement('div');
    section.className = 'project-details-section card';
    
    let assignedEquipmentIds = [];
    try {
        assignedEquipmentIds = JSON.parse(project['Assigned Equipment'] || '[]');
    } catch(e) { console.error("Could not parse Assigned Equipment", e); }
    
    let contentHTML = '';
    if (assignedEquipmentIds.length > 0) {
        contentHTML = '<div id="assigned-equipment-container">';
        assignedEquipmentIds.forEach(id => {
            const equipment = allEquipment.rowsAsObjects().find(eq => eq['ID'] === id);
            if (equipment) {
                contentHTML += createAssignedItemCard(equipment, 'equipment');
            }
        });
        contentHTML += '</div>';
    } else {
        contentHTML = '<p>No equipment assigned to this project.</p>';
    }

    section.innerHTML = `
        <div class="project-details-section-header">
            <h4>Assigned Equipment</h4>
            <button id="assign-equipment-btn" class="btn btn-secondary">Assign Equipment</button>
        </div>
        ${contentHTML}
    `;
    detailsContainer.insertBefore(section, detailsContainer.querySelector('.card:has(h4:contains(Assigned Staff))'));
    
    document.getElementById('assign-equipment-btn').addEventListener('click', () => openAssignEquipmentModal(project));
}

function renderAssignedStaffSection(project) {
    const detailsContainer = document.getElementById('project-details-column');
    const section = document.createElement('div');
    section.className = 'project-details-section card';

    let assignedStaff = [];
    try {
        assignedStaff = JSON.parse(project['Assigned Staff'] || '[]'); // This is an array of objects {id, role}
    } catch(e) { console.error("Could not parse Assigned Staff", e); }

    let contentHTML = '';
    if (assignedStaff.length > 0) {
        contentHTML = '<div id="assigned-staff-container">';
        assignedStaff.forEach(staffAssignment => {
            const staffMember = allStaff.rowsAsObjects().find(s => s['ID'] === staffAssignment.id);
            if (staffMember) {
                contentHTML += createAssignedItemCard(staffMember, 'staff', staffAssignment.role);
            }
        });
        contentHTML += '</div>';
    } else {
        contentHTML = '<p>No staff assigned to this project.</p>';
    }

    section.innerHTML = `
        <div class="project-details-section-header">
            <h4>Assigned Staff</h4>
            <button id="assign-staff-btn" class="btn btn-secondary">Assign Staff</button>
        </div>
        ${contentHTML}
    `;
    detailsContainer.insertBefore(section, detailsContainer.querySelector('.card:has(h4:contains(Notes))'));
    
    document.getElementById('assign-staff-btn').addEventListener('click', () => openAssignStaffModal(project));
}


function createAssignedItemCard(item, type, role = '') {
    const name = item['Name'];
    const image = item['Image URL'];
    const details = type === 'equipment' ? `${item['Category'] || ''} - ${item['Model'] || ''}` : role;
    const thumbClass = type === 'equipment' ? 'assigned-equipment-thumb' : 'assigned-staff-thumb';

    return `
        <div class="assigned-${type}-card">
            <div class="${thumbClass}">
                ${image ? `<img src="${image}" alt="${name}">` : name.substring(0, 2).toUpperCase()}
            </div>
            <div class="assigned-${type}-details">
                <p>${name}</p>
                <span>${details}</span>
            </div>
        </div>
    `;
}

// Open Assign Equipment Modal
let currentProjectForAssignment = null;

function openAssignEquipmentModal(project) {
    currentProjectForAssignment = project;
    const searchResults = document.getElementById('equipment-search-results');
    const selectedList = document.getElementById('selected-equipment-list');
    searchResults.innerHTML = '';
    selectedList.innerHTML = '';
    updateStatus('', 'clear', 'assign-equipment-status');

    let assignedIds = [];
    try {
        assignedIds = JSON.parse(project['Assigned Equipment'] || '[]');
    } catch(e) {}
    
    // Populate already assigned
    assignedIds.forEach(id => {
        const equipment = allEquipment.rowsAsObjects().find(eq => eq['ID'] === id);
        if(equipment) {
            const el = createSelectedItem(equipment, 'equipment');
            selectedList.appendChild(el);
        }
    });

    // Populate search results with all available
    filterAndRenderEquipmentForAssignment('');

    showModal('assign-equipment-modal');
}

document.getElementById('equipment-search-input').addEventListener('input', (e) => {
    filterAndRenderEquipmentForAssignment(e.target.value);
});

function filterAndRenderEquipmentForAssignment(searchTerm) {
    const resultsContainer = document.getElementById('equipment-search-results');
    resultsContainer.innerHTML = '';
    const selectedIds = Array.from(document.querySelectorAll('#selected-equipment-list .selected-equipment-item')).map(el => el.dataset.id);

    allEquipment.rowsAsObjects().forEach(equipment => {
        if (equipment['Name'].toLowerCase().includes(searchTerm.toLowerCase())) {
            const isSelected = selectedIds.includes(equipment['ID']);
            const el = createSearchItem(equipment, 'equipment', isSelected);
            resultsContainer.appendChild(el);
        }
    });
}


document.getElementById('equipment-search-results').addEventListener('click', (e) => {
    const itemEl = e.target.closest('.equipment-search-item');
    if (itemEl && !itemEl.classList.contains('selected')) {
        const equipmentId = itemEl.dataset.id;
        const equipment = allEquipment.rowsAsObjects().find(eq => eq['ID'] === equipmentId);
        if (equipment) {
            const selectedEl = createSelectedItem(equipment, 'equipment');
            document.getElementById('selected-equipment-list').appendChild(selectedEl);
            itemEl.classList.add('selected');
        }
    }
});

document.getElementById('selected-equipment-list').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-btn')) {
        const itemEl = e.target.closest('.selected-equipment-item');
        const equipmentId = itemEl.dataset.id;
        itemEl.remove();
        const searchItem = document.querySelector(`#equipment-search-results .equipment-search-item[data-id="${equipmentId}"]`);
        if (searchItem) {
            searchItem.classList.remove('selected');
        }
    }
});

document.getElementById('save-assigned-equipment-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('assign-equipment-status');
    if (!currentProjectForAssignment) return;
    
    updateStatus('Saving...', 'info', statusEl);
    
    const initialAssigned = JSON.parse(currentProjectForAssignment['Assigned Equipment'] || '[]');
    const finalAssigned = Array.from(document.querySelectorAll('#selected-equipment-list .selected-equipment-item')).map(el => el.dataset.id);

    const toAdd = finalAssigned.filter(id => !initialAssigned.includes(id));
    const toRemove = initialAssigned.filter(id => !finalAssigned.includes(id));

    try {
        for (const id of toAdd) {
            await addAssignedEquipmentToProject(currentProjectForAssignment['Project ID'], id);
        }
        for (const id of toRemove) {
            await removeAssignedEquipmentFromProject(currentProjectForAssignment['Project ID'], id);
        }
        
        updateStatus('Assignments saved!', 'success', statusEl);
        setTimeout(() => {
            hideModal('assign-equipment-modal');
            renderProjectDetails(currentProjectForAssignment['Project ID']);
        }, 1000);
    } catch(error) {
        updateStatus(`Error: ${error.message}`, 'error', statusEl);
    }
});


// Open Assign Staff Modal
function openAssignStaffModal(project) {
    currentProjectForAssignment = project;
    const searchResults = document.getElementById('staff-search-results');
    const selectedList = document.getElementById('selected-staff-list');
    searchResults.innerHTML = '';
    selectedList.innerHTML = '';
    updateStatus('', 'clear', 'assign-staff-status');

    let assignedStaff = [];
    try {
        assignedStaff = JSON.parse(project['Assigned Staff'] || '[]'); // Array of {id, role}
    } catch(e) {}
    
    // Populate already assigned
    assignedStaff.forEach(assignment => {
        const staffMember = allStaff.rowsAsObjects().find(s => s['ID'] === assignment.id);
        if(staffMember) {
            const el = createSelectedItem(staffMember, 'staff', assignment.role);
            selectedList.appendChild(el);
        }
    });

    // Populate search results with all available
    filterAndRenderStaffForAssignment('');

    showModal('assign-staff-modal');
}

document.getElementById('staff-search-input').addEventListener('input', (e) => {
    filterAndRenderStaffForAssignment(e.target.value);
});

function filterAndRenderStaffForAssignment(searchTerm) {
    const resultsContainer = document.getElementById('staff-search-results');
    resultsContainer.innerHTML = '';
    const selectedIds = Array.from(document.querySelectorAll('#selected-staff-list .selected-staff-item')).map(el => el.dataset.id);

    allStaff.rowsAsObjects().forEach(staff => {
        if (staff['Name'].toLowerCase().includes(searchTerm.toLowerCase())) {
            const isSelected = selectedIds.includes(staff['ID']);
            const el = createSearchItem(staff, 'staff', isSelected);
            resultsContainer.appendChild(el);
        }
    });
}


document.getElementById('staff-search-results').addEventListener('click', (e) => {
    const itemEl = e.target.closest('.staff-search-item');
    if (itemEl && !itemEl.classList.contains('selected')) {
        const staffId = itemEl.dataset.id;
        const staff = allStaff.rowsAsObjects().find(s => s['ID'] === staffId);
        if (staff) {
            const selectedEl = createSelectedItem(staff, 'staff', 'Team Member'); // Default role
            document.getElementById('selected-staff-list').appendChild(selectedEl);
            itemEl.classList.add('selected');
        }
    }
});

document.getElementById('selected-staff-list').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-btn')) {
        const itemEl = e.target.closest('.selected-staff-item');
        const staffId = itemEl.dataset.id;
        itemEl.remove();
        const searchItem = document.querySelector(`#staff-search-results .staff-search-item[data-id="${staffId}"]`);
        if (searchItem) {
            searchItem.classList.remove('selected');
        }
    }
});

document.getElementById('save-assigned-staff-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('assign-staff-status');
    if (!currentProjectForAssignment) return;
    
    updateStatus('Saving...', 'info', statusEl);
    
    const initialAssigned = JSON.parse(currentProjectForAssignment['Assigned Staff'] || '[]'); // {id, role}
    const finalAssigned = Array.from(document.querySelectorAll('#selected-staff-list .selected-staff-item')).map(el => ({
        id: el.dataset.id,
        role: el.querySelector('.role-input').value
    }));

    const initialIds = initialAssigned.map(a => a.id);
    const finalIds = finalAssigned.map(a => a.id);
    
    const toAdd = finalAssigned.filter(a => !initialIds.includes(a.id));
    const toRemoveIds = initialIds.filter(id => !finalIds.includes(id));
    const toUpdate = finalAssigned.filter(a => {
        const initial = initialAssigned.find(i => i.id === a.id);
        return initial && initial.role !== a.role;
    });

    try {
        // Removals first
        for (const id of toRemoveIds) {
            await removeAssignedStaffFromProject(currentProjectForAssignment['Project ID'], { id });
        }
        // Then additions and updates
        for (const assignment of [...toAdd, ...toUpdate]) {
            await addAssignedStaffToProject(currentProjectForAssignment['Project ID'], assignment);
        }
        
        updateStatus('Assignments saved!', 'success', statusEl);
        setTimeout(() => {
            hideModal('assign-staff-modal');
            renderProjectDetails(currentProjectForAssignment['Project ID']);
        }, 1000);
    } catch(error) {
        updateStatus(`Error: ${error.message}`, 'error', statusEl);
    }
});

function createSearchItem(item, type, isSelected) {
    const el = document.createElement('div');
    el.className = `${type}-search-item ${isSelected ? 'selected' : ''}`;
    el.dataset.id = item['ID'];
    el.innerHTML = `
        <div class="${type}-item-thumb">
            ${item['Image URL'] ? `<img src="${item['Image URL']}" alt="${item['Name']}">` : item['Name'].substring(0,2).toUpperCase()}
        </div>
        <div class="${type}-item-details">
            <p>${item['Name']}</p>
            <span>${type === 'equipment' ? (item['Category'] || 'N/A') : (item['Skills'] || 'N/A')}</span>
        </div>
    `;
    return el;
}

function createSelectedItem(item, type, role = '') {
    const el = document.createElement('div');
    el.className = `selected-${type}-item`;
    el.dataset.id = item['ID'];

    let detailsHTML = `<p>${item['Name']}</p>`;
    if (type === 'staff') {
        detailsHTML += `<input type="text" class="role-input" value="${role}" placeholder="Role...">`;
    } else {
        detailsHTML += `<span>${item['Category'] || 'N/A'}</span>`;
    }

    el.innerHTML = `
        <div class="${type}-item-thumb">
            ${item['Image URL'] ? `<img src="${item['Image URL']}" alt="${item['Name']}">` : item['Name'].substring(0,2).toUpperCase()}
        </div>
        <div class="${type}-item-details">
            ${detailsHTML}
        </div>
        <button class="btn btn-danger btn-small remove-btn">X</button>
    `;
    return el;
}
