// js/taskManager.js
// Description: Handles all logic related to tasks within a project.

import { state, allTasks, updateState } from './state.js';
import { updateSheetRow, writeData, clearSheetRow } from './api.js';
import { elements, showDeleteConfirmationModal } from './ui.js';

let refreshData;

// --- INITIALIZATION ---
export function initTaskManager(refreshDataFn) {
    refreshData = refreshDataFn;
    window.showTaskDetailsModal = showTaskDetailsModal; // Expose to global scope for projects.js

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

// --- DATA PREPARATION ---
function getProjectTasks(projectId) {
    const { headers, rows } = allTasks;
    const [projIdIdx, sortIdx] = ['ProjectID', 'SortIndex'].map(h => headers.indexOf(h));

    const tasks = rows.filter(t => t[projIdIdx] === projectId);
    
    // Sort tasks by SortIndex if it exists, otherwise leave as is.
    if (sortIdx > -1) {
        tasks.sort((a, b) => (parseFloat(a[sortIdx]) || 0) - (parseFloat(b[sortIdx]) || 0));
    }
    return tasks;
}

function getBucketsForProject(projectTasks) {
    const { headers } = allTasks;
    const bucketIdx = headers.indexOf('Bucket');
    
    const buckets = projectTasks.reduce((acc, task) => {
        const bucketName = task[bucketIdx] || 'To Do';
        if (!acc[bucketName]) acc[bucketName] = [];
        acc[bucketName].push(task);
        return acc;
    }, {});

    const defaultBuckets = ['To Do', 'In Progress', 'Done'];
    const customBuckets = Object.keys(buckets).filter(b => !defaultBuckets.includes(b)).sort();
    
    return { buckets, bucketOrder: [...defaultBuckets, ...customBuckets] };
}

// --- MAIN RENDERER ---
export function renderTasks(container, projectId) {
    if (!container) return;

    if (state.projectTaskView === 'list') {
        renderTaskList(container, projectId);
    } else {
        renderTaskBoard(container, projectId);
    }
    
    // Use event delegation for dynamically created elements
    container.addEventListener('click', (e) => {
        const taskItem = e.target.closest('.task-card, .task-list-item-asana');
        if (taskItem && !e.target.closest('a, button, input')) {
            const taskId = taskItem.dataset.taskId;
            const taskData = allTasks.rows.find(t => t[allTasks.headers.indexOf('TaskID')] === taskId);
            if (taskData) showTaskDetailsModal(taskData, projectId);
            return;
        }

        const completeBtn = e.target.closest('.complete-task-btn');
        if (completeBtn) {
            e.stopPropagation();
            const taskId = completeBtn.dataset.taskId;
            const currentStatus = allTasks.rows.find(t => t[allTasks.headers.indexOf('TaskID')] === taskId)[allTasks.headers.indexOf('Status')];
            handleToggleTaskComplete(taskId, currentStatus);
            return;
        }

        const deleteBtn = e.target.closest('.delete-bucket-btn');
        if (deleteBtn) {
            e.stopPropagation();
            const bucketName = deleteBtn.dataset.bucket;
            handleDeleteBucket(bucketName, projectId);
            return;
        }

        const addTaskInBucketBtn = e.target.closest('.add-task-in-bucket-btn');
        if (addTaskInBucketBtn) {
            e.stopPropagation();
            const bucketName = addTaskInBucketBtn.dataset.bucket;
            showTaskDetailsModal(null, projectId, bucketName);
            return;
        }
    });
}

// --- VIEW-SPECIFIC RENDERERS ---

function renderTaskList(container, projectId) {
    const projectTasks = getProjectTasks(projectId);
    if (projectTasks.length === 0) {
        container.innerHTML = '<div class="empty-state-container"><p>No tasks yet. Click "Add Task" to get started.</p></div>';
        return;
    }
    
    const { headers } = allTasks;
    const [taskIdIdx, nameIdx, assigneeIdx, dueDateIdx, statusIdx] = ['TaskID', 'Task Name', 'Assignee', 'Due Date', 'Status'].map(h => headers.indexOf(h));
    const { buckets, bucketOrder } = getBucketsForProject(projectTasks);
    
    let listHtml = '<div class="task-list-asana-container">';
    bucketOrder.forEach(bucketName => {
        if (!buckets[bucketName] || buckets[bucketName].length === 0) return;

        listHtml += `<div class="task-bucket-header"><h4>${bucketName}</h4></div>`;
        buckets[bucketName].forEach(task => {
            const isCompleted = task[statusIdx] === 'Done';
            listHtml += `
                <div class="task-list-item-asana" data-task-id="${task[taskIdIdx]}">
                    <button class="complete-task-btn ${isCompleted ? 'completed' : ''}" data-task-id="${task[taskIdIdx]}">
                        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    </button>
                    <span class="task-name">${task[nameIdx] || 'Untitled'}</span>
                    <span class="task-assignee">${task[assigneeIdx] || 'N/A'}</span>
                    <span class="task-due-date">${task[dueDateIdx] || 'N/A'}</span>
                </div>`;
        });
    });
    listHtml += '</div>';
    container.innerHTML = listHtml;
}

function renderTaskBoard(container, projectId) {
    const projectTasks = getProjectTasks(projectId);
    const { headers } = allTasks;
    const [nameIdx, taskIdIdx, subtasksIdx] = ['Task Name', 'TaskID', 'Subtasks'].map(h => headers.indexOf(h));
    const { buckets, bucketOrder } = getBucketsForProject(projectTasks);
    
    let boardHtml = '<div class="task-board">';
    bucketOrder.forEach(bucketName => {
        const tasksInBucket = buckets[bucketName] || [];
        // Only render default buckets or custom buckets that have tasks.
        if (tasksInBucket.length === 0 && !['To Do', 'In Progress', 'Done'].includes(bucketName)) return;

        const deleteBtnHtml = !['To Do', 'In Progress', 'Done'].includes(bucketName)
            ? `<button class="delete-bucket-btn" data-bucket="${bucketName}" title="Delete Bucket">&times;</button>`
            : '';
            
        boardHtml += `
            <div class="task-board-column" data-bucket="${bucketName}">
                <div class="task-board-column-header"><h5>${bucketName}</h5>${deleteBtnHtml}</div>
                <div class="task-list">`;
        
        tasksInBucket.forEach(task => {
            let subtasks = [];
            try { subtasks = JSON.parse(task[subtasksIdx] || '[]'); } catch(e) {}
            const completed = subtasks.filter(s => s.completed).length;
            const subtaskSummary = subtasks.length > 0 ? `<div class="subtask-summary">${completed}/${subtasks.length} subtasks</div>` : '';

            boardHtml += `<div class="task-card" data-task-id="${task[taskIdIdx]}"><p>${task[nameIdx] || 'Untitled'}</p>${subtaskSummary}</div>`;
        });

        boardHtml += `</div><button class="add-task-in-bucket-btn" data-bucket="${bucketName}">+ Add task</button></div>`;
    });
    boardHtml += '</div>';
    container.innerHTML = boardHtml;
}

// --- MODAL & FORM HANDLING ---

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
        document.getElementById('task-title').value = taskData[headers.indexOf('Task Name')] || '';
        document.getElementById('task-description').value = taskData[headers.indexOf('Description')] || '';
        document.getElementById('task-due-date').value = taskData[headers.indexOf('Due Date')] || '';
        document.getElementById('task-assignee').value = taskData[headers.indexOf('Assignee')] || '';
        document.getElementById('task-status').value = taskData[headers.indexOf('Status')] || 'To Do';
    } else {
        document.getElementById('task-status').value = 'To Do';
    }
    
    // Populate Subtasks
    const subtasksContainer = document.getElementById('subtasks-container-modal');
    subtasksContainer.innerHTML = '';
    try { JSON.parse((taskData && taskData[headers.indexOf('Subtasks')]) || '[]').forEach(renderSubtaskItem); } catch(e) {}
    
    const linksContainer = document.getElementById('links-container');
    linksContainer.innerHTML = '';
    try { JSON.parse((taskData && taskData[headers.indexOf('Links')]) || '[]').forEach(renderLinkItem); } catch(e) {}

    // Populate bucket datalist for suggestions
    const bucketInput = document.getElementById('task-bucket');
    const bucketDatalist = document.getElementById('bucket-suggestions');
    const { bucketOrder } = getBucketsForProject(getProjectTasks(projectId));
    
    if (bucketDatalist) {
        bucketDatalist.innerHTML = '';
        bucketOrder.forEach(b => {
            const option = document.createElement('option');
            option.value = b;
            bucketDatalist.appendChild(option);
        });
    }

    // Set the initial value for the bucket input
    if (taskData) {
        bucketInput.value = taskData[headers.indexOf('Bucket')] || 'To Do';
    } else {
        bucketInput.value = bucketName;
    }

    modal.style.display = 'block';
}

function renderSubtaskItem(subtask) {
    const container = document.getElementById('subtasks-container-modal');
    const div = document.createElement('div');
    div.className = 'subtask-item-modal';
    div.innerHTML = `<input type="checkbox" ${subtask.completed ? 'checked' : ''}><input type="text" value="${subtask.text}"><button type="button" class="btn btn-danger btn-small">&times;</button>`;
    div.querySelector('button').onclick = () => div.remove();
    container.appendChild(div);
}

function renderLinkItem(link) {
    const container = document.getElementById('links-container');
    const div = document.createElement('div');
    div.className = 'link-item-modal';
    div.innerHTML = `<a href="${link.url}" target="_blank">${link.name}</a><input type="hidden" class="link-item-url" value="${link.url}"><input type="hidden" class="link-item-name" value="${link.name}"><button type="button" class="btn btn-danger btn-small">&times;</button>`;
    div.querySelector('button').onclick = () => div.remove();
    container.appendChild(div);
}

async function handleTaskFormSubmit(event) {
    event.preventDefault();
    const statusSpan = document.getElementById('task-modal-status');
    statusSpan.textContent = 'Saving...';
    
    const subtasks = Array.from(document.querySelectorAll('#subtasks-container-modal .subtask-item-modal')).map(item => ({
        text: item.querySelector('input[type="text"]').value,
        completed: item.querySelector('input[type="checkbox"]').checked
    })).filter(s => s.text);
    
    const links = Array.from(document.querySelectorAll('#links-container .link-item-modal')).map(item => ({
        url: item.querySelector('.link-item-url').value,
        name: item.querySelector('.link-item-name').value
    }));

    const taskData = {
        'ProjectID': document.getElementById('task-project-id-input').value,
        'Task Name': document.getElementById('task-title').value,
        'Description': document.getElementById('task-description').value,
        'Due Date': document.getElementById('task-due-date').value,
        'Assignee': document.getElementById('task-assignee').value,
        'Status': document.getElementById('task-status').value,
        'Bucket': document.getElementById('task-bucket').value,
        'Subtasks': JSON.stringify(subtasks),
        'Links': JSON.stringify(links)
    };
    
    const taskId = document.getElementById('task-id-input').value;
    try {
        if (taskId) {
            await updateSheetRow('Tasks', 'TaskID', taskId, taskData);
        } else {
            await writeData('Tasks', { ...taskData, 'TaskID': `T-${Date.now()}` });
        }
        statusSpan.textContent = 'Task saved!';
        await refreshData();
        setTimeout(() => { elements.taskDetailsModal.style.display = 'none'; }, 1000);
    } catch (err) {
        statusSpan.textContent = 'Error saving task.';
        console.error('Task save error:', err);
    }
}

// --- ACTIONS ---

async function handleToggleTaskComplete(taskId, currentStatus) {
    const newStatus = currentStatus === 'Done' ? 'To Do' : 'Done';
    const btn = document.querySelector(`.complete-task-btn[data-task-id="${taskId}"]`);
    if (btn) btn.disabled = true;

    try {
        await updateSheetRow('Tasks', 'TaskID', taskId, { 'Status': newStatus });
        await refreshData();
    } catch (err) {
        console.error("Task complete toggle error:", err);
        if (btn) btn.disabled = false;
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
            const updatePromises = tasksToMove.map(task => updateSheetRow('Tasks', 'TaskID', task[taskIdIdx], { 'Bucket': 'To Do' }));
            await Promise.all(updatePromises);
            await refreshData();
        }
    );
}

export function setupDragAndDrop(container) {
    // Placeholder for drag and drop logic
    console.log("Drag and drop setup initiated.");
}


