// js/taskManager.js
// Description: Handles all logic related to tasks within a project.

import { state, allTasks, allStaff, updateState } from './state.js';
import { updateSheetRow, writeData, clearSheetRow } from './api.js';
import { elements, showDeleteConfirmationModal } from './ui.js';

let refreshData;

// --- INITIALIZATION ---
export function initTaskManager(refreshDataFn) {
    refreshData = refreshDataFn;
    document.getElementById('task-details-form').addEventListener('submit', handleTaskFormSubmit);
    document.getElementById('add-subtask-btn').addEventListener('click', () => renderSubtaskItem({ name: '', completed: false }, true));
    document.getElementById('add-link-btn').addEventListener('click', handleAddLink);
}


// --- DATA HELPERS ---
function getProjectTasks(projectId) {
    const { headers, rows } = allTasks;
    const projIdIdx = headers.indexOf('ProjectID');
    const sortIdx = headers.indexOf('SortIndex');
    
    if (projIdIdx === -1) return [];

    return rows
        .filter(t => t[projIdIdx] === projectId)
        .sort((a, b) => {
            const sortA = parseFloat(a[sortIdx]) || 0;
            const sortB = parseFloat(b[sortIdx]) || 0;
            return sortA - sortB;
        });
}

function getBucketsForProject(projectTasks) {
    const { headers } = allTasks;
    const bucketIdx = headers.indexOf('Bucket');
    
    // Use a Map to preserve insertion order, which is now sorted by SortIndex
    const buckets = projectTasks.reduce((acc, task) => {
        const bucketName = (task[bucketIdx] || 'Uncategorized').trim();
        if (!acc.has(bucketName)) acc.set(bucketName, []);
        acc.get(bucketName).push(task);
        return acc;
    }, new Map());

    const bucketOrder = Array.from(buckets.keys());
    const bucketsObject = Object.fromEntries(buckets);
    
    return { buckets: bucketsObject, bucketOrder };
}


// --- MAIN RENDERER ---
function renderTasksForProject(container, projectId) {
    const view = state.projectTaskView || 'list';
    const renderFn = view === 'list' ? renderTaskList : renderTaskBoard;
    renderFn(container, projectId);
}

export function setupTaskClickHandlers(container, projectId) {
    const taskContainer = container.querySelector('#task-board-container');
    if (!taskContainer) return;

    // View Toggle
    const viewToggleBtn = container.querySelector('#task-view-toggle-btn');
    if (viewToggleBtn) {
        viewToggleBtn.textContent = state.projectTaskView === 'list' ? 'Board View' : 'List View';
        viewToggleBtn.onclick = () => {
            updateState({ projectTaskView: state.projectTaskView === 'list' ? 'board' : 'list' });
            renderTasksForProject(taskContainer, projectId);
            setupTaskClickHandlers(container, projectId); // Re-attach handlers for the new view
        };
    }
    
    // Add Task Button
    const addTaskBtn = container.querySelector('#add-task-btn');
    if (addTaskBtn) {
        addTaskBtn.onclick = () => showTaskDetailsModal(null, projectId);
    }

    renderTasksForProject(taskContainer, projectId);

    // Event Delegation for dynamic content
    taskContainer.addEventListener('click', (e) => {
        const target = e.target;
        const taskCard = target.closest('.task-card, .task-list-item');
        const completeBtn = target.closest('.complete-task-btn');
        const addTaskInBucketBtn = target.closest('.add-task-in-bucket-btn');
        const deleteBucketBtn = target.closest('.delete-bucket-btn');

        if (completeBtn) {
            e.stopPropagation();
            handleToggleComplete(completeBtn.dataset.taskId);
        } else if (addTaskInBucketBtn) {
            showTaskDetailsModal(null, projectId, addTaskInBucketBtn.dataset.bucket);
        } else if (deleteBucketBtn) {
            handleDeleteBucket(deleteBucketBtn.dataset.bucket, projectId);
        } else if (taskCard) {
            const taskId = taskCard.dataset.taskId;
            const taskData = allTasks.rows.find(t => t[allTasks.headers.indexOf('TaskID')] === taskId);
            if (taskData) showTaskDetailsModal(taskData, projectId);
        }
    });

    if (state.projectTaskView === 'board') {
        setupDragAndDrop(taskContainer, projectId);
    }
}


// --- VIEW-SPECIFIC RENDERERS ---

function renderTaskList(container, projectId) {
    const projectTasks = getProjectTasks(projectId);
    if (projectTasks.length === 0) {
        container.innerHTML = '<div class="empty-state-container"><p>No tasks yet. Click "Add Task" to get started.</p></div>';
        return;
    }
    
    const { headers } = allTasks;
    const [nameIdx, taskIdIdx, statusIdx] = ['Task Name', 'TaskID', 'Status'].map(h => headers.indexOf(h));
    const { buckets, bucketOrder } = getBucketsForProject(projectTasks);
    
    let listHtml = '<div class="task-list-asana-container">';
    bucketOrder.forEach(bucketName => {
        if (!buckets[bucketName] || buckets[bucketName].length === 0) return;

        listHtml += `<div class="task-bucket-header"><h4>${bucketName}</h4></div>`;
        buckets[bucketName].forEach(task => {
            const isCompleted = task[statusIdx] === 'Done';
            listHtml += `
                <div class="task-list-item ${isCompleted ? 'completed' : ''}" data-task-id="${task[taskIdIdx]}">
                    <button class="complete-task-btn ${isCompleted ? 'completed' : ''}" data-task-id="${task[taskIdIdx]}">
                        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    </button>
                    <label>${task[nameIdx] || 'Untitled'}</label>
                </div>`;
        });
    });
    listHtml += '</div>';
    container.innerHTML = listHtml;
}


function renderTaskBoard(container, projectId) {
    const projectTasks = getProjectTasks(projectId);
    if (projectTasks.length === 0) {
        container.innerHTML = '<div class="empty-state-container"><p>No tasks yet. Click "Add Task" to get started.</p></div>';
        return;
    }
    
    const { headers } = allTasks;
    const [nameIdx, taskIdIdx, subtasksIdx, statusIdx] = ['Task Name', 'TaskID', 'Subtasks', 'Status'].map(h => headers.indexOf(h));
    const { buckets, bucketOrder } = getBucketsForProject(projectTasks);
    
    let boardHtml = '<div class="task-board">';
    bucketOrder.forEach(bucketName => {
        const tasksInBucket = buckets[bucketName] || [];
        
        const deleteBtnHtml = bucketName !== 'Uncategorized'
            ? `<button class="btn btn-danger btn-small delete-bucket-btn" data-bucket="${bucketName}" title="Delete Bucket">&times;</button>`
            : '';
            
        boardHtml += `
            <div class="task-board-column" data-bucket="${bucketName}" draggable="true">
                <div class="task-board-column-header"><h5>${bucketName}</h5>${deleteBtnHtml}</div>
                <div class="task-list">`;
        
        tasksInBucket.forEach(task => {
            const isCompleted = task[statusIdx] === 'Done';
            let subtasks = [];
            try { subtasks = JSON.parse(task[subtasksIdx] || '[]'); } catch(e) {}
            const completedSubtasks = subtasks.filter(s => s.completed).length;
            const subtaskSummary = subtasks.length > 0 ? `<div class="subtask-summary">${completedSubtasks}/${subtasks.length} subtasks</div>` : '';

            boardHtml += `
                <div class="task-card" data-task-id="${task[taskIdIdx]}" draggable="true">
                    <button class="complete-task-btn ${isCompleted ? 'completed' : ''}" data-task-id="${task[taskIdIdx]}">
                        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    </button>
                    <div class="task-card-content">
                        <p>${task[nameIdx] || 'Untitled'}</p>
                        ${subtaskSummary}
                    </div>
                </div>`;
        });

        boardHtml += `</div><button class="add-task-in-bucket-btn" data-bucket="${bucketName}">+ Add task</button></div>`;
    });
    boardHtml += '</div>';
    container.innerHTML = boardHtml;
}


// --- MODAL & FORM HANDLING ---

function showTaskDetailsModal(taskData = null, projectId, bucketName = 'Uncategorized') {
    const modal = elements.taskDetailsModal;
    const form = document.getElementById('task-details-form');
    form.reset();

    document.getElementById('task-modal-title').textContent = taskData ? 'Edit Task' : 'New Task';
    document.getElementById('task-project-id-input').value = projectId;
    
    const { headers } = allTasks;
    const taskId = taskData ? taskData[headers.indexOf('TaskID')] : '';
    document.getElementById('task-id-input').value = taskId;

    // Populate assignee dropdown
    const assigneeSelect = document.getElementById('task-assignee');
    assigneeSelect.innerHTML = '<option value="">Unassigned</option>'; // Clear and add default
    if (allStaff && allStaff.rows) {
        const nameIndex = allStaff.headers.indexOf('Name');
        if (nameIndex > -1) {
            allStaff.rows.forEach(staff => {
                const staffName = staff[nameIndex];
                if (staffName) {
                    assigneeSelect.add(new Option(staffName, staffName));
                }
            });
        }
    }

    // Populate standard fields
    if (taskData) {
        document.getElementById('task-title').value = taskData[headers.indexOf('Task Name')] || '';
        document.getElementById('task-description').value = taskData[headers.indexOf('Description')] || '';
        document.getElementById('task-due-date').value = taskData[headers.indexOf('Due Date')] || '';
        assigneeSelect.value = taskData[headers.indexOf('Assignee')] || '';
        document.getElementById('task-status').value = taskData[headers.indexOf('Status')] || 'To Do';
    } else {
        document.getElementById('task-status').value = 'To Do';
    }
    
    // Populate Subtasks & Links
    const subtasksContainer = document.getElementById('subtasks-container-modal');
    subtasksContainer.innerHTML = '';
    try { JSON.parse((taskData && taskData[headers.indexOf('Subtasks')]) || '[]').forEach(subtask => renderSubtaskItem(subtask, false)); } catch(e) {}
    
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

    if (taskData) {
        bucketInput.value = taskData[headers.indexOf('Bucket')] || 'Uncategorized';
    } else {
        bucketInput.value = bucketName;
    }

    // Delete button logic
    const deleteBtn = document.getElementById('task-delete-btn');
    if (taskId) {
        deleteBtn.style.display = 'block';
        deleteBtn.onclick = () => handleDeleteTask(taskId);
    } else {
        deleteBtn.style.display = 'none';
    }

    modal.style.display = 'block';
}

function renderSubtaskItem(subtask, isNew = false) {
    const container = document.getElementById('subtasks-container-modal');
    const item = document.createElement('div');
    item.className = 'subtask-item-modal';
    item.innerHTML = `
        <input type="checkbox" ${subtask.completed ? 'checked' : ''}>
        <input type="text" value="${subtask.name}" placeholder="Subtask name...">
        <button type="button" class="btn btn-danger btn-small remove-subtask-btn">&times;</button>
    `;
    item.querySelector('.remove-subtask-btn').onclick = () => item.remove();
    container.appendChild(item);
    if (isNew) {
        item.querySelector('input[type="text"]').focus();
    }
}

function renderLinkItem({ name, url }) {
    const container = document.getElementById('links-container');
    const item = document.createElement('div');
    item.className = 'link-item-modal';
    item.innerHTML = `
        <a href="${url}" target="_blank">${name || url}</a>
        <input type="hidden" class="link-name-data" value="${name}">
        <input type="hidden" class="link-url-data" value="${url}">
        <button type="button" class="btn btn-danger btn-small remove-link-btn">&times;</button>
    `;
    item.querySelector('.remove-link-btn').onclick = () => item.remove();
    container.appendChild(item);
}


// --- ACTIONS ---

async function handleTaskFormSubmit(event) {
    event.preventDefault();
    const statusSpan = document.getElementById('task-modal-status');
    statusSpan.textContent = 'Saving...';
    
    const taskId = document.getElementById('task-id-input').value;
    const projectId = document.getElementById('task-project-id-input').value;

    const subtasks = Array.from(document.querySelectorAll('#subtasks-container-modal .subtask-item-modal')).map(item => ({
        completed: item.querySelector('input[type="checkbox"]').checked,
        name: item.querySelector('input[type="text"]').value
    })).filter(s => s.name);

    const links = Array.from(document.querySelectorAll('#links-container .link-item-modal')).map(item => ({
        name: item.querySelector('.link-name-data').value,
        url: item.querySelector('.link-url-data').value
    }));

    const taskData = {
        'ProjectID': projectId,
        'Task Name': document.getElementById('task-title').value,
        'Description': document.getElementById('task-description').value,
        'Due Date': document.getElementById('task-due-date').value,
        'Assignee': document.getElementById('task-assignee').value,
        'Status': document.getElementById('task-status').value,
        'Bucket': document.getElementById('task-bucket').value.trim() || 'Uncategorized',
        'Subtasks': JSON.stringify(subtasks),
        'Links': JSON.stringify(links),
    };
    
    try {
        if (taskId) {
            await updateSheetRow('Tasks', 'TaskID', taskId, taskData);
        } else {
            // Assign a high sort index to new tasks to place them at the end.
            const projectTasks = getProjectTasks(projectId);
            const maxSortIndex = projectTasks.reduce((max, t) => Math.max(max, parseFloat(t[allTasks.headers.indexOf('SortIndex')] || 0)), 0);
            taskData['SortIndex'] = maxSortIndex + 1;
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

function handleAddLink() {
    const nameInput = document.getElementById('new-link-name');
    const urlInput = document.getElementById('new-link-url');
    if (urlInput.value && urlInput.checkValidity()) {
        renderLinkItem({ name: nameInput.value.trim(), url: urlInput.value.trim() });
        nameInput.value = '';
        urlInput.value = '';
    }
}


async function handleToggleComplete(taskId) {
    const { headers, rows } = allTasks;
    const task = rows.find(t => t[headers.indexOf('TaskID')] === taskId);
    if (!task) return;
    
    const statusIdx = headers.indexOf('Status');
    const currentStatus = task[statusIdx];
    const newStatus = currentStatus === 'Done' ? 'To Do' : 'Done';

    try {
        await updateSheetRow('Tasks', 'TaskID', taskId, { 'Status': newStatus });
        await refreshData();
    } catch(err) {
        alert('Could not update task status.');
        console.error("Task complete toggle error:", err);
    }
}

async function handleDeleteTask(taskId) {
    showDeleteConfirmationModal(
        `Delete Task`,
        `This will permanently delete the task. This action cannot be undone.`,
        async () => {
            await clearSheetRow('Tasks', 'TaskID', taskId);
            await refreshData();
            elements.taskDetailsModal.style.display = 'none';
        }
    );
}

async function handleDeleteBucket(bucketName, projectId) {
    if (bucketName === 'Uncategorized') return;
    
    showDeleteConfirmationModal(
        `Delete Bucket: ${bucketName}`,
        `This will move all tasks in this bucket to 'Uncategorized'. This action cannot be undone.`,
        async () => {
            const { headers, rows } = allTasks;
            const [projIdIdx, bucketIdx, taskIdIdx] = ['ProjectID', 'Bucket', 'TaskID'].map(h => headers.indexOf(h));
            
            const tasksToMove = rows.filter(t => t[projIdIdx] === projectId && t[bucketIdx] === bucketName);

            const updatePromises = tasksToMove.map(task => {
                const taskId = task[taskIdIdx];
                return updateSheetRow('Tasks', 'TaskID', taskId, { 'Bucket': 'Uncategorized' });
            });
            
            await Promise.all(updatePromises);
            await refreshData();
        }
    );
}


// --- DRAG AND DROP ---
export function setupDragAndDrop(container, projectId) {
    let draggedItem = null;
    let placeholder = null;
    let dragType = null; // 'task' or 'bucket'

    function createPlaceholder(item) {
        placeholder = document.createElement('div');
        placeholder.className = dragType === 'task' ? 'task-placeholder' : 'bucket-placeholder';
        placeholder.style.height = `${item.offsetHeight}px`;
        return placeholder;
    }

    container.addEventListener('dragstart', e => {
        draggedItem = e.target;
        if (draggedItem.matches('.task-card')) {
            dragType = 'task';
        } else if (draggedItem.matches('.task-board-column')) {
            dragType = 'bucket';
        } else {
            return; // Not a draggable item
        }

        setTimeout(() => draggedItem.classList.add('dragging'), 0);
        placeholder = createPlaceholder(draggedItem);
    });

    container.addEventListener('dragend', e => {
        if (!draggedItem) return;
        draggedItem.classList.remove('dragging');
        draggedItem = null;
        if (placeholder && placeholder.parentNode) {
            placeholder.parentNode.removeChild(placeholder);
        }
        placeholder = null;
        dragType = null;
    });

    container.addEventListener('dragover', e => {
        e.preventDefault();
        if (!draggedItem) return;

        if (dragType === 'task') {
            const list = e.target.closest('.task-list');
            if (list) {
                const afterElement = getDragAfterElement(list, e.clientY);
                if (afterElement == null) {
                    list.appendChild(placeholder);
                } else {
                    list.insertBefore(placeholder, afterElement);
                }
            }
        } else if (dragType === 'bucket') {
            const board = e.target.closest('.task-board');
            if (board) {
                const afterElement = getDragAfterElement(board, e.clientX);
                 if (afterElement == null) {
                    board.appendChild(placeholder);
                } else {
                    board.insertBefore(placeholder, afterElement);
                }
            }
        }
    });

    container.addEventListener('drop', async e => {
        e.preventDefault();
        if (!draggedItem || !placeholder) return;

        let updatePromise;

        if (dragType === 'task') {
            const newBucket = e.target.closest('.task-board-column')?.dataset.bucket;
            if (newBucket) {
                const taskId = draggedItem.dataset.taskId;
                const newSortIndex = calculateNewSortIndex(placeholder);
                updatePromise = updateSheetRow('Tasks', 'TaskID', taskId, { 'Bucket': newBucket, 'SortIndex': newSortIndex });
            }
        } else if (dragType === 'bucket') {
            // Dragging a whole bucket reorders it
            const newSortIndex = calculateNewSortIndex(placeholder);
            const { headers, rows } = allTasks;
            const tasksInBucket = getProjectTasks(projectId).filter(t => (t[headers.indexOf('Bucket')] || 'Uncategorized') === draggedItem.dataset.bucket);
            
            const promises = tasksInBucket.map((task, index) => {
                const taskId = task[headers.indexOf('TaskID')];
                // Stagger the sort index to maintain order within the bucket
                return updateSheetRow('Tasks', 'TaskID', taskId, { 'SortIndex': newSortIndex + index });
            });
            updatePromise = Promise.all(promises);
        }

        if (updatePromise) {
            await updatePromise.catch(err => {
                console.error("Drag and drop save error:", err);
                alert("Could not save changes.");
            });
            // Perform a full refresh to ensure data integrity
            await refreshData();
        }

    });
}

function getDragAfterElement(container, coord) {
    const draggableElements = [...container.querySelectorAll('[draggable="true"]:not(.dragging)')];
    const isHorizontal = container.classList.contains('task-board');

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = isHorizontal ? coord - box.left - box.width / 2 : coord - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function calculateNewSortIndex(placeholder) {
    const prevElement = placeholder.previousElementSibling;
    const nextElement = placeholder.nextElementSibling;
    const { headers } = allTasks;
    const sortIdx = headers.indexOf('SortIndex');

    let prevSort = 0;
    if (prevElement) {
        const prevId = prevElement.dataset.taskId || prevElement.querySelector('.task-card')?.dataset.taskId;
        if(prevId) {
            const task = allTasks.rows.find(t => t[headers.indexOf('TaskID')] === prevId);
            if (task) prevSort = parseFloat(task[sortIdx] || 0);
        }
    }
    
    let nextSort = prevSort + 1000; // Default if it's the last item
    if (nextElement) {
         const nextId = nextElement.dataset.taskId || nextElement.querySelector('.task-card')?.dataset.taskId;
         if(nextId) {
            const task = allTasks.rows.find(t => t[headers.indexOf('TaskID')] === nextId);
            if (task) nextSort = parseFloat(task[sortIdx] || 0);
         }
    }
    
    return (prevSort + nextSort) / 2;
}
