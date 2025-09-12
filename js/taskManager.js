// js/taskManager.js
// Description: Handles all logic related to tasks within a project.

import { allTasks } from './state.js';
import { updateSheetRow, writeData } from './api.js';
import { elements } from './ui.js';

let refreshData;

export function initTaskManager(refreshDataFn) {
    refreshData = refreshDataFn;
    document.getElementById('task-details-form').addEventListener('submit', handleTaskFormSubmit);
    
    // Add listeners for subtasks and links
    document.getElementById('add-subtask-btn').addEventListener('click', handleAddSubtask);
    document.getElementById('add-link-btn').addEventListener('click', handleAddLink);
}

export function renderTasksSection(projectId) {
    // This function will render the task board or list view
    return `
        <div class="project-details-section content-section">
            <div class="project-details-section-header">
                <h4>Tasks</h4>
                <div class="view-controls">
                    <button id="add-task-btn" type="button" class="btn btn-secondary">Add Task</button>
                </div>
            </div>
            <div id="task-board-container">
                <!-- Task content will be rendered here by other functions -->
            </div>
        </div>
    `;
}

export function setupTaskClickHandlers(container, projectId) {
    const addTaskBtn = container.querySelector('#add-task-btn');
    if (addTaskBtn) {
        addTaskBtn.onclick = () => showTaskDetailsModal(null, projectId);
    }
    // Logic to render the actual tasks will go here and attach click events
    renderTaskBoard(container.querySelector('#task-board-container'), projectId);
}


function renderTaskBoard(container, projectId) {
    if (!container) return;
    const projectTasks = allTasks.rows.filter(t => t[allTasks.headers.indexOf('ProjectID')] === projectId);

    const buckets = projectTasks.reduce((acc, task) => {
        const bucketName = task[allTasks.headers.indexOf('Bucket')] || 'To Do';
        if (!acc[bucketName]) {
            acc[bucketName] = [];
        }
        acc[bucketName].push(task);
        return acc;
    }, {});

    const bucketOrder = ['To Do', 'In Progress', 'Done']; // Add any other custom buckets
    Object.keys(buckets).forEach(b => {
        if (!bucketOrder.includes(b)) bucketOrder.push(b);
    });

    let boardHtml = '<div class="task-board">';
    for (const bucketName of bucketOrder) {
        boardHtml += `
            <div class="task-board-column" data-bucket="${bucketName}">
                <h5>${bucketName}</h5>
                <div class="task-list">
        `;
        const tasksInBucket = buckets[bucketName] || [];
        tasksInBucket.forEach(task => {
            const title = task[allTasks.headers.indexOf('Title')] || 'Untitled';
            const taskId = task[allTasks.headers.indexOf('TaskID')];
            boardHtml += `<div class="task-card" data-task-id="${taskId}">${title}</div>`;
        });
        boardHtml += '</div></div>';
    }
    boardHtml += '</div>';
    container.innerHTML = boardHtml;

    // Add click listeners to the newly rendered task cards
    container.querySelectorAll('.task-card').forEach(card => {
        card.onclick = () => {
            const taskId = card.dataset.taskId;
            const taskData = allTasks.rows.find(t => t[allTasks.headers.indexOf('TaskID')] === taskId);
            if (taskData) {
                showTaskDetailsModal(taskData, projectId);
            }
        };
    });
}

function showTaskDetailsModal(taskData = null, projectId, bucketName = 'To Do') {
    const modal = elements.taskDetailsModal;
    const form = document.getElementById('task-details-form');
    form.reset();

    document.getElementById('task-modal-title').textContent = taskData ? 'Edit Task' : 'New Task';
    document.getElementById('task-project-id-input').value = projectId;
    
    const taskId = taskData ? taskData[allTasks.headers.indexOf('TaskID')] : '';
    document.getElementById('task-id-input').value = taskId;
    
    if (taskData) {
        document.getElementById('task-title').value = taskData[allTasks.headers.indexOf('Title')] || '';
        document.getElementById('task-description').value = taskData[allTasks.headers.indexOf('Description')] || '';
        document.getElementById('task-due-date').value = taskData[allTasks.headers.indexOf('Due Date')] || '';
        document.getElementById('task-assignee').value = taskData[allTasks.headers.indexOf('Assignee')] || '';
        document.getElementById('task-status').value = taskData[allTasks.headers.indexOf('Status')] || 'To Do';
        document.getElementById('task-bucket').value = taskData[allTasks.headers.indexOf('Bucket')] || 'To Do';
    } else {
        document.getElementById('task-status').value = 'To Do';
        document.getElementById('task-bucket').value = bucketName;
    }

    modal.style.display = 'block';
}

async function handleTaskFormSubmit(event) {
    event.preventDefault();
    const statusSpan = document.getElementById('task-modal-status');
    statusSpan.textContent = 'Saving...';
    
    const taskId = document.getElementById('task-id-input').value;
    const projectId = document.getElementById('task-project-id-input').value;

    const taskData = {
        'ProjectID': projectId,
        'Title': document.getElementById('task-title').value,
        'Description': document.getElementById('task-description').value,
        'Due Date': document.getElementById('task-due-date').value,
        'Assignee': document.getElementById('task-assignee').value,
        'Status': document.getElementById('task-status').value,
        'Bucket': document.getElementById('task-bucket').value,
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

function handleAddSubtask() {
    // Placeholder for subtask logic
    console.log("Add subtask clicked");
}

function handleAddLink() {
    // Placeholder for link logic
    console.log("Add link clicked");
}

export function setupDragAndDrop(container) {
    // Placeholder for drag and drop logic
    // This is a complex feature and would require a more detailed implementation
    console.log("Drag and drop setup initiated.");
}
