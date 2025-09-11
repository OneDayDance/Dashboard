// js/taskManager.js
// Description: Manages all task-related functionality including rendering, modals, and drag-and-drop.

import { state, allProjects, allTasks, updateState } from './state.js';
import { updateSheetRow, writeData } from './api.js';
import { elements } from './ui.js';

let refreshData;

// --- INITIALIZATION ---
export function initTaskManager(refreshDataFn) {
    refreshData = refreshDataFn;
    document.getElementById('task-details-form').addEventListener('submit', handleSaveTask);
}

// --- TASK RENDERING ---
export function renderTasksSection(projectId) {
    const renderFn = state.projectTaskView === 'list' ? renderTasksAsList : renderTasksAsBoard;
    return `<div class="project-details-section content-section">
        <div class="project-details-section-header"><h4>Tasks</h4>
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
        html += `<button class="add-task-to-bucket-btn btn btn-secondary" data-bucket="${bucket}">+ Add Task</button></div>`;
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
        html += `<button class="add-task-to-bucket-btn btn btn-secondary" data-bucket="${bucket}">+ Add Task</button></div>`;
    });
    return html + `</div>`;
}

function renderTaskItem(taskRow, subtasks) {
    const [idIdx, nameIdx, statusIdx, bucketIdx] = ['TaskID', 'Task Name', 'Status', 'Bucket'].map(h => allTasks.headers.indexOf(h));
    const isCompleted = taskRow[statusIdx] === 'Done';
    let subtasksHtml = '';
    if (subtasks.length > 0) {
        subtasksHtml += '<ul class="subtask-list">';
        subtasks.forEach((sub, i) => { subtasksHtml += `<li class="subtask-item"><input type="checkbox" data-task-id="${taskRow[idIdx]}" data-subtask-index="${i}" ${sub.completed ? 'checked' : ''}> ${sub.name}</li>`; });
        subtasksHtml += '</ul>';
        const completedCount = subtasks.filter(s => s.completed).length;
        const progress = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;
        subtasksHtml += `<div class="task-progress" title="${completedCount}/${subtasks.length} complete"><div class="task-progress-bar" style="width:${progress}%"></div></div>`;
    }
    return `<div class="task-item" draggable="true" data-task-id="${taskRow[idIdx]}" data-bucket="${taskRow[bucketIdx] || 'General'}"><div class="task-main ${isCompleted ? 'completed' : ''}"><input type="checkbox" ${isCompleted ? 'checked' : ''}><label>${taskRow[nameIdx]}</label></div>${subtasksHtml}</div>`;
}

function renderTaskCard(taskRow, subtasks) {
     const [idIdx, nameIdx, bucketIdx] = ['TaskID', 'Task Name', 'Bucket'].map(h => allTasks.headers.indexOf(h));
     let subtaskSummary = '';
     if (subtasks.length > 0) { const completedCount = subtasks.filter(s => s.completed).length; subtaskSummary = `<p class="subtask-summary">✓ ${completedCount}/${subtasks.length}</p>`; }
    return `<div class="task-card" draggable="true" data-task-id="${taskRow[idIdx]}" data-bucket="${taskRow[bucketIdx] || 'General'}"><p>${taskRow[nameIdx]}</p>${subtaskSummary}</div>`;
}

// --- TASK MODAL & SAVING ---
export function showTaskModal(projectId, taskId = null, bucketName = null) {
    const form = document.getElementById('task-details-form'); form.reset();
    document.getElementById('task-project-id-input').value = projectId;
    document.getElementById('task-modal-status').textContent = '';
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
        document.getElementById('task-id-input').value = '';
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
        if (taskId) {
            await updateSheetRow('Tasks', 'TaskID', taskId, taskData);
        } else { 
            taskData.TaskID = `T-${Date.now()}`; 
            const tasksInBucket = getProjectTasksSorted(taskData.ProjectID).filter(t => (t.row[allTasks.headers.indexOf('Bucket')] || 'General') === taskData.Bucket);
            taskData.SortIndex = tasksInBucket.length;
            await writeData('Tasks', taskData); 
        }
        await refreshData();
        statusSpan.textContent = 'Saved!';
        setTimeout(() => { elements.taskDetailsModal.style.display = 'none'; }, 1000);
    } catch (err) { statusSpan.textContent = 'Error saving task.'; console.error('Task save error', err); }
}

// --- TASK EVENT HANDLERS ---
export function setupTaskClickHandlers(container, projectId) {
    container.querySelectorAll('.task-item, .task-card').forEach(el => {
        el.onclick = (e) => {
            if (e.target.closest('.subtask-item') || e.currentTarget.classList.contains('dragging')) return;
            const taskId = e.currentTarget.dataset.taskId;
            if (e.target.matches('.task-main input[type="checkbox"]')) {
                e.stopPropagation();
                handleTaskStatusChange(taskId, e.target.checked);
            }
            else showTaskModal(projectId, taskId);
        };
    });
    container.querySelectorAll('.subtask-item input[type="checkbox"]').forEach(cb => cb.addEventListener('change', handleSubtaskStatusChange));
    container.querySelectorAll('.add-task-to-bucket-btn').forEach(btn => btn.onclick = () => showTaskModal(projectId, null, btn.dataset.bucket));
    
    const taskViewToggle = document.getElementById('task-view-toggle');
    if (taskViewToggle) taskViewToggle.onclick = () => {
        const newView = state.projectTaskView === 'list' ? 'board' : 'list';
        updateState({ projectTaskView: newView });
        if (window.showProjectDetails) {
            window.showProjectDetails(projectId);
        }
    };

    const addBucketBtn = document.getElementById('add-bucket-btn');
    if(addBucketBtn) addBucketBtn.onclick = async () => {
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
                    await refreshData();
                } catch (err) { alert("Could not save new bucket."); console.error(err); }
            }
        }
    };
}

async function handleTaskStatusChange(taskId, isChecked) {
    const newStatus = isChecked ? 'Done' : 'To Do';
    try {
        await updateSheetRow('Tasks', 'TaskID', taskId, { 'Status': newStatus });
        await refreshData();
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
    try { subtasks = JSON.parse(subtasksJson); } catch (e) { console.error("Error parsing subtasks for task:", taskId, e); return; }
    if (subtasks[subtaskIndex]) subtasks[subtaskIndex].completed = isChecked;
    const updatedSubtasksJson = JSON.stringify(subtasks);
    try {
        await updateSheetRow('Tasks', 'TaskID', taskId, { 'Subtasks': updatedSubtasksJson });
        await refreshData();
    } catch (err) { 
        console.error('Subtask status update error', err); 
        alert('Could not update subtask status.'); 
        await refreshData();
    }
}

// --- DRAG AND DROP ---
export function setupDragAndDrop(container) {
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
        if (afterEl) container.insertBefore(placeholder, afterEl); else if (addBtn) container.insertBefore(placeholder, addBtn); else container.appendChild(placeholder);
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
    if (!draggedElement || !placeholder) { if (draggedElement) draggedElement.classList.remove('dragging'); if (placeholder) placeholder.remove(); return; }

    const newParentBucketEl = placeholder.closest('[data-bucket]');
    const taskId = e.dataTransfer.getData('text/task-id');
    const bucketId = e.dataTransfer.getData('text/bucket-id');

    placeholder.parentNode.replaceChild(draggedElement, placeholder);
    draggedElement.classList.remove('dragging');

    try {
        const promises = [];
        if (bucketId) { // A bucket was dragged
            const newOrder = Array.from(draggedElement.parentNode.children).filter(el => el.matches('[data-bucket]')).map(el => el.dataset.bucket);
            promises.push(updateSheetRow('Projects', 'ProjectID', state.selectedProjectId, { 'Task Buckets': JSON.stringify(newOrder) }));
        } else if (taskId && newParentBucketEl) { // A task was dragged
            draggedElement.dataset.bucket = newParentBucketEl.dataset.bucket;
            
            document.querySelectorAll('.task-bucket, .task-board-column').forEach(bucketEl => {
                Array.from(bucketEl.querySelectorAll('[data-task-id]')).forEach((taskEl, i) => {
                     promises.push(updateSheetRow('Tasks', 'TaskID', taskEl.dataset.taskId, { 'Bucket': bucketEl.dataset.bucket, 'SortIndex': i }));
                });
            });
        }
        await Promise.all(promises);
        await refreshData();
    } catch (err) { 
        alert("Error saving new order."); 
        console.error("Drag/drop save error:", err); 
        await refreshData();
    }
}

// --- HELPERS ---
function getProjectTasksSorted(projectId) {
    if (!allTasks.rows) return [];
    const { headers, rows } = allTasks;
    const [idIdx, sortIdx, subtaskIdx] = ['ProjectID', 'SortIndex', 'Subtasks'].map(h => headers.indexOf(h));
    return rows.filter(t => t[idIdx] === projectId)
               .sort((a,b) => (parseInt(a[sortIdx]) || 0) - (parseInt(b[sortIdx]) || 0))
               .map(row => ({ row, subtasks: JSON.parse(row[subtaskIdx] || '[]') }));
}

function getProjectBuckets(projectId) {
    const project = allProjects.rows.find(p => p[allProjects.headers.indexOf('ProjectID')] === projectId);
    if (project) {
        const bucketsJSON = project[allProjects.headers.indexOf('Task Buckets')];
        if (bucketsJSON) try { return JSON.parse(bucketsJSON); } catch(e){}
    }
    const tasks = getProjectTasksSorted(projectId);
    const bucketsFromTasks = [...new Set(tasks.map(t => t.row[allTasks.headers.indexOf('Bucket')] || 'General'))];
    if(bucketsFromTasks.length > 0) return bucketsFromTasks;

    return ['General'];
}

function renderSubtasks(subtasks) {
    const container = document.getElementById('subtasks-container-modal');
    container.innerHTML = `<input type="hidden" id="subtasks-data" value='${JSON.stringify(subtasks)}'>`;
    subtasks.forEach((sub, i) => {
        const item = document.createElement('div');
        item.className = 'item-tag';
        item.innerHTML = `<input type="checkbox" ${sub.completed ? 'checked' : ''}> <label>${sub.name}</label> <button type="button" class="btn-subtle">&times;</button>`;
        item.querySelector('input').onchange = (e) => updateSubtaskStatus(i, e.target.checked);
        item.querySelector('button').onclick = () => removeSubtask(i);
        container.appendChild(item);
    });
}
function updateSubtaskStatus(index, completed) { const subtasks = JSON.parse(document.getElementById('subtasks-data').value); subtasks[index].completed = completed; renderSubtasks(subtasks); }
function removeSubtask(index) { const subtasks = JSON.parse(document.getElementById('subtasks-data').value); subtasks.splice(index, 1); renderSubtasks(subtasks); }

function renderLinks(links) {
    const container = document.getElementById('links-container');
    container.innerHTML = `<input type="hidden" id="links-data" value='${JSON.stringify(links)}'>`;
    links.forEach((link, i) => {
        const linkEl = document.createElement('div');
        linkEl.className = 'item-tag';
        linkEl.innerHTML = `<a href="${link}" target="_blank">${link}</a> <button type="button" data-index="${i}">&times;</button>`;
        container.appendChild(linkEl);
    });
    container.querySelectorAll('.item-tag button').forEach(button => {
        button.addEventListener('click', e => {
            const indexToRemove = parseInt(e.currentTarget.dataset.index, 10);
            const currentLinks = JSON.parse(document.getElementById('links-data').value);
            currentLinks.splice(indexToRemove, 1);
            renderLinks(currentLinks);
        });
    });
}
