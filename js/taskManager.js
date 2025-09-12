// js/taskManager.js
// Description: Handles all logic related to tasks within a project.

import { state, allTasks, updateState } from './state.js';
import { updateSheetRow, writeData, clearSheetRow } from './api.js';
import { elements, showDeleteConfirmationModal } from './ui.js';

let refreshData;

export function initTaskManager(refreshDataFn) {
    refreshData = refreshDataFn;
    document.getElementById('task-details-form').addEventListener('submit', handleTaskFormSubmit);
    
    document.getElementById('add-subtask-btn').addEventListener('click', () => {
        const input = document.getElementById('new-subtask-name');
        if (input.value.trim()) {
            renderSubtaskItem({ text: input.value.trim(), completed: false });
            input.value = '';
        }
    });

    document.getElementById('add-link-btn').addEventListener('click', () => {
        const urlInput = document.getElementById('new-link-url');
        const nameInput = document.getElementById('new-link-name');
        if (urlInput.value.trim()) {
            renderLinkItem({ url: urlInput.value.trim(), name: nameInput.value.trim() || urlInput.value.trim() });
            urlInput.value = '';
            nameInput.value = '';
        }
    });
}

/**
 * Main rendering dispatcher for tasks. Checks the current view state and calls the appropriate renderer.
 * @param {HTMLElement} container - The container element to render tasks into.
 * @param {string} projectId - The ID of the current project.
 */
export function renderTasks(container, projectId) {
    if (!container) return;

    if (state.projectTaskView === 'list') {
        renderTaskList(container, projectId);
    } else {
        renderTaskBoard(container, projectId);
    }

    // Attach click handlers to the newly rendered tasks
    container.querySelectorAll('.task-card, .task-list-item').forEach(card => {
        card.onclick = () => {
            const taskId = card.dataset.taskId;
            const taskData = allTasks.rows.find(t => t[allTasks.headers.indexOf('TaskID')] === taskId);
            if (taskData) {
                showTaskDetailsModal(taskData, projectId);
            }
        };
    });
    
    // Attach handlers for bucket deletion
    container.querySelectorAll('.delete-bucket-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const bucketName = e.target.dataset.bucket;
            handleDeleteBucket(bucketName, projectId);
        };
    });
}


function renderTaskList(container, projectId) {
    const projectTasks = allTasks.rows.filter(t => t[allTasks.headers.indexOf('ProjectID')] === projectId);
    if (projectTasks.length === 0) {
        container.innerHTML = '<p>No tasks yet. Click "Add Task" to get started.</p>';
        return;
    }

    const { headers } = allTasks;
    const [titleIdx, assigneeIdx, dueDateIdx, statusIdx, taskIdIdx] = ['Title', 'Assignee', 'Due Date', 'Status', 'TaskID'].map(h => headers.indexOf(h));
    
    let tableHtml = `
        <table class="data-table task-list-view">
            <thead>
                <tr>
                    <th>Title</th>
                    <th>Assignee</th>
                    <th>Due Date</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    projectTasks.forEach(task => {
        tableHtml += `
            <tr class="task-list-item" data-task-id="${task[taskIdIdx]}">
                <td>${task[titleIdx] || 'Untitled'}</td>
                <td>${task[assigneeIdx] || 'N/A'}</td>
                <td>${task[dueDateIdx] || 'N/A'}</td>
                <td><span class="status-badge">${task[statusIdx] || 'To Do'}</span></td>
            </tr>
        `;
    });

    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;
}


function renderTaskBoard(container, projectId) {
    const projectTasks = allTasks.rows.filter(t => t[allTasks.headers.indexOf('ProjectID')] === projectId);

    const buckets = projectTasks.reduce((acc, task) => {
        const bucketName = task[allTasks.headers.indexOf('Bucket')] || 'To Do';
        if (!acc[bucketName]) acc[bucketName] = [];
        acc[bucketName].push(task);
        return acc;
    }, {});
    
    const defaultBuckets = ['To Do', 'In Progress', 'Done'];
    const bucketOrder = [...defaultBuckets];
    Object.keys(buckets).forEach(b => {
        if (!bucketOrder.includes(b)) bucketOrder.push(b);
    });

    let boardHtml = '<div class="task-board">';
    bucketOrder.forEach(bucketName => {
        const deleteBtnHtml = !defaultBuckets.includes(bucketName)
            ? `<button class="delete-bucket-btn" data-bucket="${bucketName}" title="Delete Bucket">&times;</button>`
            : '';
            
        boardHtml += `
            <div class="task-board-column" data-bucket="${bucketName}">
                <div class="task-board-column-header">
                    <h5>${bucketName}</h5>
                    ${deleteBtnHtml}
                </div>
                <div class="task-list">`;
        
        const tasksInBucket = buckets[bucketName] || [];
        tasksInBucket.forEach(task => {
            const { headers } = allTasks;
            const [title, taskId, subtasksJson] = [
                task[headers.indexOf('Title')] || 'Untitled',
                task[headers.indexOf('TaskID')],
                task[headers.indexOf('Subtasks')] || '[]'
            ];
            
            let subtasks = [];
            try { subtasks = JSON.parse(subtasksJson); } catch(e) {}
            const completed = subtasks.filter(s => s.completed).length;
            const subtaskSummary = subtasks.length > 0 ? `<div class="subtask-summary">${completed}/${subtasks.length} subtasks</div>` : '';

            boardHtml += `
                <div class="task-card" data-task-id="${taskId}">
                    <p>${title}</p>
                    ${subtaskSummary}
                </div>`;
        });
        boardHtml += '</div></div>';
    });
    boardHtml += '</div>';
    container.innerHTML = boardHtml;
}


function showTaskDetailsModal(taskData = null, projectId, bucketName = 'To Do') {
    const modal = elements.taskDetailsModal;
    const form = document.getElementById('task-details-form');
    form.reset();

    document.getElementById('task-modal-title').textContent = taskData ? 'Edit Task' : 'New Task';
    document.getElementById('task-project-id-input').value = projectId;
    
    const { headers } = allTasks;
    const taskId = taskData ? taskData[headers.indexOf('TaskID')] : '';
    document.getElementById('task-id-input').value = taskId;

    // Populate standard fields
    if (taskData) {
        document.getElementById('task-title').value = taskData[headers.indexOf('Title')] || '';
        document.getElementById('task-description').value = taskData[headers.indexOf('Description')] || '';
        document.getElementById('task-due-date').value = taskData[headers.indexOf('Due Date')] || '';
        document.getElementById('task-assignee').value = taskData[headers.indexOf('Assignee')] || '';
        document.getElementById('task-status').value = taskData[headers.indexOf('Status')] || 'To Do';
        document.getElementById('task-bucket').value = taskData[headers.indexOf('Bucket')] || 'To Do';
    } else {
        document.getElementById('task-status').value = 'To Do';
        document.getElementById('task-bucket').value = bucketName;
    }
    
    // Populate Subtasks
    const subtasksContainer = document.getElementById('subtasks-container-modal');
    subtasksContainer.innerHTML = '';
    const subtasksJson = taskData ? taskData[headers.indexOf('Subtasks')] : '[]';
    try {
        JSON.parse(subtasksJson || '[]').forEach(renderSubtaskItem);
    } catch(e) { console.error("Bad subtask JSON", e); }

    // Populate Links
    const linksContainer = document.getElementById('links-container');
    linksContainer.innerHTML = '';
    const linksJson = taskData ? taskData[headers.indexOf('Links')] : '[]';
    try {
        JSON.parse(linksJson || '[]').forEach(renderLinkItem);
    } catch(e) { console.error("Bad links JSON", e); }

    // Populate bucket dropdown
    const bucketSelect = document.getElementById('task-bucket');
    const projectTasks = allTasks.rows.filter(t => t[headers.indexOf('ProjectID')] === projectId);
    const existingBuckets = [...new Set(projectTasks.map(t => t[headers.indexOf('Bucket')] || 'To Do'))];
    bucketSelect.innerHTML = '';
    existingBuckets.forEach(b => {
        const option = new Option(b, b, false, b === (taskData ? taskData[headers.indexOf('Bucket')] : bucketName));
        bucketSelect.add(option);
    });

    modal.style.display = 'block';
}

function renderSubtaskItem(subtask) {
    const container = document.getElementById('subtasks-container-modal');
    const div = document.createElement('div');
    div.className = 'subtask-item-modal';
    div.innerHTML = `
        <input type="checkbox" ${subtask.completed ? 'checked' : ''}>
        <input type="text" value="${subtask.text}">
        <button type="button" class="btn btn-danger btn-small">&times;</button>
    `;
    div.querySelector('button').onclick = () => div.remove();
    container.appendChild(div);
}

function renderLinkItem(link) {
    const container = document.getElementById('links-container');
    const div = document.createElement('div');
    div.className = 'link-item-modal';
    div.innerHTML = `
        <a href="${link.url}" target="_blank">${link.name}</a>
        <input type="hidden" class="link-item-url" value="${link.url}">
        <input type="hidden" class="link-item-name" value="${link.name}">
        <button type="button" class="btn btn-danger btn-small">&times;</button>
    `;
    div.querySelector('button').onclick = () => div.remove();
    container.appendChild(div);
}

async function handleTaskFormSubmit(event) {
    event.preventDefault();
    const statusSpan = document.getElementById('task-modal-status');
    statusSpan.textContent = 'Saving...';
    
    const taskId = document.getElementById('task-id-input').value;

    // Collect Subtasks
    const subtasks = [];
    document.querySelectorAll('#subtasks-container-modal .subtask-item-modal').forEach(item => {
        const text = item.querySelector('input[type="text"]').value;
        if (text) {
            subtasks.push({ text: text, completed: item.querySelector('input[type="checkbox"]').checked });
        }
    });

    // Collect Links
    const links = [];
    document.querySelectorAll('#links-container .link-item-modal').forEach(item => {
        links.push({
            url: item.querySelector('.link-item-url').value,
            name: item.querySelector('.link-item-name').value
        });
    });

    const taskData = {
        'ProjectID': document.getElementById('task-project-id-input').value,
        'Title': document.getElementById('task-title').value,
        'Description': document.getElementById('task-description').value,
        'Due Date': document.getElementById('task-due-date').value,
        'Assignee': document.getElementById('task-assignee').value,
        'Status': document.getElementById('task-status').value,
        'Bucket': document.getElementById('task-bucket').value,
        'Subtasks': JSON.stringify(subtasks),
        'Links': JSON.stringify(links)
    };

    try {
        if (taskId) {
            await updateSheetRow('Tasks', 'TaskID', taskId, taskData);
        } else {
            await writeData('Tasks', { ...taskData, 'TaskID': `T-${Date.now()}` });
        }
        statusSpan.textContent = 'Task saved!';
        await refreshData();
        setTimeout(() => {
            elements.taskDetailsModal.style.display = 'none';
        }, 1000);

    } catch (err) {
        statusSpan.textContent = 'Error saving task.';
        console.error('Task save error:', err);
    }
}

async function handleDeleteBucket(bucketName, projectId) {
    showDeleteConfirmationModal(
        `Delete Bucket: ${bucketName}`,
        `This will move all tasks in this bucket to 'To Do'. This action cannot be undone.`,
        async () => {
            const { headers, rows } = allTasks;
            const [projIdIdx, bucketIdx, taskIdIdx] = ['ProjectID', 'Bucket', 'TaskID'].map(h => headers.indexOf(h));
            
            const tasksToMove = rows.filter(t => t[projIdIdx] === projectId && t[bucketIdx] === bucketName);

            const updatePromises = tasksToMove.map(task => {
                const taskId = task[taskIdIdx];
                return updateSheetRow('Tasks', 'TaskID', taskId, { 'Bucket': 'To Do' });
            });
            
            await Promise.all(updatePromises);
            await refreshData();
        }
    );
}

export function setupDragAndDrop(container) {
    // Placeholder for drag and drop logic
    console.log("Drag and drop setup initiated.");
}
