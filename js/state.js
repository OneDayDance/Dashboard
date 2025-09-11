// js/state.js
// Description: Manages the application's global state, including all data fetched from Google Sheets.
// Also contains functions for updating data back to the sheet.

import { updateSheetData } from './api.js';
import { SHEET_NAMES } from './config.js';

// --- UI State --- //
export let state = {
    // Requests Tab
    currentView: 'list',
    searchTerm: '',
    filters: { service: 'all', status: 'all' },
    sortColumn: 'Submission Date',
    sortDirection: 'desc',
    visibleColumns: ['Full Name', 'Email', 'Primary Service Category', 'Submission Date', 'Status'],
    
    // Clients Tab
    clientCurrentView: 'list',
    clientSearchTerm: '',
    clientFilters: { status: 'all' },
    clientSortColumn: 'Last Name',
    clientSortDirection: 'asc',
    visibleClientColumns: ['First Name', 'Last Name', 'Email', 'Phone', 'Status'],

    // Inventory Tabs
    costumeFilters: { searchTerm: '', status: 'all', category: 'all' },
    equipmentFilters: { searchTerm: '', status: 'all', category: 'all' },
    staffFilters: { searchTerm: '', skill: '' },

    // Projects Tab
    selectedProjectId: null,
};

// --- Raw Data State --- //
// Each variable holds an object with 'headers' and 'rows' properties
export let allRequests = {};
export let allClients = {};
export let allProjects = {};
export let allCostumes = {};
export let allEquipment = {};
export let allStaff = {};
export let allTasks = {};

// --- Constants --- //
export const sortableColumns = ['Submission Date', 'Full Name', 'Email', 'Primary Service Category'];
export const clientSortableColumns = ['First Name', 'Last Name', 'Email', 'Organization', 'Status', 'Intake Date'];


// --- State Management Functions --- //

/**
 * Merges a new state object into the global UI state.
 * @param {object} newState - The partial state object to merge.
 */
export function updateState(newState) {
    Object.assign(state, newState);
}

export function updateFilters(key, value) {
    state.filters[key] = value;
}

export function updateClientFilters(key, value) {
    state.clientFilters[key] = value.toLowerCase();
}

export function updateCostumeFilters(key, value) {
    state.costumeFilters[key] = value.toLowerCase();
}

export function updateEquipmentFilters(key, value) {
    state.equipmentFilters[key] = value.toLowerCase();
}


/**
 * Updates a state variable with new data and adds a helper method.
 * @param {object} stateVar - The state variable to update (e.g., allRequests).
 * @param {object} data - The new data object with headers and rows.
 */
function updateStateVariable(stateVar, data) {
    Object.assign(stateVar, data);
    // Helper method to get rows as an array of objects
    stateVar.rowsAsObjects = function() {
        if (!this.rows || !this.headers) return [];
        return this.rows.map(row => {
            const obj = {};
            this.headers.forEach((header, i) => {
                obj[header] = row[i];
            });
            return obj;
        });
    };
}

/**
 * Generic function to set data for any state property.
 * @param {string} type - The type of data to set (e.g., 'requests', 'clients').
 * @param {object} data - The data object from the API.
 */
export function setData(type, data) {
    switch (type) {
        case 'requests':
            updateStateVariable(allRequests, data);
            break;
        case 'clients':
            updateStateVariable(allClients, data);
            break;
        case 'projects':
            updateStateVariable(allProjects, data);
            break;
        case 'costumes':
            updateStateVariable(allCostumes, data);
            break;
        case 'equipment':
            updateStateVariable(allEquipment, data);
            break;
        case 'staff':
            updateStateVariable(allStaff, data);
            break;
        case 'tasks':
            updateStateVariable(allTasks, data);
            break;
        default:
            console.warn(`Unknown data type: ${type}`);
    }
}

// --- Specific Data Setters (for api.js) --- //
export function setAllRequests(data) { setData('requests', data); }
export function setAllClients(data) { setData('clients', data); }
export function setAllProjects(data) { setData('projects', data); }
export function setAllCostumes(data) { setData('costumes', data); }
export function setAllEquipment(data) { setData('equipment', data); }
export function setAllStaff(data) { setData('staff', data); }
export function setAllTasks(data) { setData('tasks', data); }


/**
 * Sets the current active view.
 * @param {string} viewName - The name of the tab/view.
 */
export function setCurrentView(viewName) {
    state.currentView = viewName;
}

// --- Data Mutation Functions --- //

/**
 * Updates a specific cell in the Google Sheet for a given client.
 * @param {string} clientId - The ID of the client to update.
 * @param {string} field - The header/column name of the field to update.
 * @param {*} value - The new value to set.
 */
export async function updateClientData(clientId, field, value) {
    if (!allClients.rows) throw new Error("Client data not loaded.");
    
    const idIdx = allClients.headers.indexOf('Client ID');
    const fieldIdx = allClients.headers.indexOf(field);
    
    if (idIdx === -1 || fieldIdx === -1) {
        throw new Error(`Field "${field}" not found in client headers.`);
    }

    const rowIndex = allClients.rows.findIndex(row => row[idIdx] === clientId);
    if (rowIndex === -1) {
        throw new Error(`Client with ID "${clientId}" not found.`);
    }

    // API is 1-based, headers are row 1, so data starts at row 2
    const sheetRow = rowIndex + 2;
    const sheetCol = fieldIdx + 1;

    try {
        await updateSheetData(SHEET_NAMES.clients, sheetRow, sheetCol, value);
        // Update local state
        allClients.rows[rowIndex][fieldIdx] = value;
    } catch (error) {
        console.error('Failed to update client data:', error);
        throw error;
    }
}

/**
 * Updates a specific cell in the Google Sheet for a given request.
 * @param {string} requestId - The ID of the request to update.
 * @param {string} field - The header/column name of the field to update.
 * @param {*} value - The new value to set.
 */
export async function updateRequestData(requestId, field, value) {
    if (!allRequests.rows) throw new Error("Request data not loaded.");
    
    const idIdx = allRequests.headers.indexOf('Timestamp'); // Assuming Timestamp is the unique ID
    const fieldIdx = allRequests.headers.indexOf(field);
    
    if (idIdx === -1 || fieldIdx === -1) {
        throw new Error(`Field "${field}" not found in request headers.`);
    }

    const rowIndex = allRequests.rows.findIndex(row => row[idIdx] === requestId);
    if (rowIndex === -1) {
        throw new Error(`Request with ID "${requestId}" not found.`);
    }

    const sheetRow = rowIndex + 2;
    const sheetCol = fieldIdx + 1;
    
    try {
        await updateSheetData(SHEET_NAMES.requests, sheetRow, sheetCol, value);
        // Update local state
        allRequests.rows[rowIndex][fieldIdx] = value;
    } catch (error) {
        console.error('Failed to update request data:', error);
        throw error;
    }
}

/**
 * Updates a specific cell in the Google Sheet for a given project.
 * @param {string} projectId - The ID of the project to update.
 * @param {string} field - The header/column name of the field to update.
 * @param {*} value - The new value to set.
 */
export async function updateProjectData(projectId, field, value) {
    if (!allProjects.rows) throw new Error("Project data not loaded.");
    
    const idIdx = allProjects.headers.indexOf('Project ID');
    const fieldIdx = allProjects.headers.indexOf(field);
    
    if (idIdx === -1) throw new Error(`"Project ID" column not found.`);
    if (fieldIdx === -1) throw new Error(`Field "${field}" not found in project headers.`);

    const rowIndex = allProjects.rows.findIndex(row => row[idIdx] === projectId);
    if (rowIndex === -1) throw new Error(`Project with ID "${projectId}" not found.`);

    const sheetRow = rowIndex + 2;
    const sheetCol = fieldIdx + 1;

    try {
        await updateSheetData(SHEET_NAMES.projects, sheetRow, sheetCol, value);
        // Update local state
        allProjects.rows[rowIndex][fieldIdx] = value;
    } catch (error) {
        console.error(`Failed to update project data for field ${field}:`, error);
        throw error;
    }
}

/**
 * Updates the entire "Cost Breakdown" for a project.
 * @param {string} projectId The project's ID.
 * @param {Array<Object>} costItems The array of cost items.
 */
export async function updateProjectFinancials(projectId, costItems) {
    const value = JSON.stringify(costItems);
    await updateProjectData(projectId, 'Cost Breakdown', value);
}

/**
 * Updates the Google Drive link for a project.
 * @param {string} projectId The project's ID.
 * @param {string} link The new Google Drive folder URL.
 */
export async function updateProjectGDriveLink(projectId, link) {
    await updateProjectData(projectId, 'Google Drive Link', link);
}

/**
 * Adds a new task to a project or updates an existing one.
 * @param {string} projectId The ID of the project.
 * @param {object} taskData The task object to add/update.
 */
export async function updateTaskInProject(projectId, taskData, newBucketName = null) {
    const idIdx = allProjects.headers.indexOf('Project ID');
    const tasksIdx = allProjects.headers.indexOf('Tasks');
    const bucketsIdx = allProjects.headers.indexOf('Task Buckets');

    const rowIndex = allProjects.rows.findIndex(row => row[idIdx] === projectId);
    if (rowIndex === -1) throw new Error("Project not found");

    let tasks = JSON.parse(allProjects.rows[rowIndex][tasksIdx] || '[]');
    const taskIndex = tasks.findIndex(t => t.id === taskData.id);
    
    if (taskIndex > -1) {
        tasks[taskIndex] = taskData;
    } else {
        throw new Error("Task to update not found.");
    }

    if (newBucketName) {
         let buckets = JSON.parse(allProjects.rows[rowIndex][bucketsIdx] || '{}');
         // Remove from any old bucket
         Object.keys(buckets).forEach(key => {
            buckets[key] = buckets[key].filter(id => id !== taskData.id);
         });
         // Add to new bucket
         if (!buckets[newBucketName]) buckets[newBucketName] = [];
         buckets[newBucketName].push(taskData.id);
         await updateProjectData(projectId, 'Task Buckets', JSON.stringify(buckets));
    }

    await updateProjectData(projectId, 'Tasks', JSON.stringify(tasks));
}

/**
 * Adds a new task to a project.
 * @param {string} projectId The ID of the project.
 * @param {object} taskData The new task object.
 * @param {string} bucketName The bucket to add the task to.
 */
export async function addTaskToProject(projectId, taskData, bucketName) {
    const idIdx = allProjects.headers.indexOf('Project ID');
    const tasksIdx = allProjects.headers.indexOf('Tasks');
    const bucketsIdx = allProjects.headers.indexOf('Task Buckets');

    const rowIndex = allProjects.rows.findIndex(row => row[idIdx] === projectId);
    if (rowIndex === -1) throw new Error("Project not found");

    let tasks = JSON.parse(allProjects.rows[rowIndex][tasksIdx] || '[]');
    tasks.push(taskData);
    
    let buckets = JSON.parse(allProjects.rows[rowIndex][bucketsIdx] || '{}');
    if (!buckets[bucketName]) {
        buckets[bucketName] = [];
    }
    buckets[bucketName].push(taskData.id);
    
    // Update both in parallel
    await Promise.all([
        updateProjectData(projectId, 'Tasks', JSON.stringify(tasks)),
        updateProjectData(projectId, 'Task Buckets', JSON.stringify(buckets))
    ]);
}


/**
 * Deletes a task from a project.
 * @param {string} projectId The ID of the project.
 * @param {string} taskId The ID of the task to delete.
 */
export async function deleteTaskFromProject(projectId, taskId) {
    // This function is a placeholder. A real implementation would be more complex
    // as it involves finding the task, removing it from the 'Tasks' JSON array,
    // and removing its ID from the 'Task Buckets' JSON object, then saving both.
    console.warn(`deleteTaskFromProject is not fully implemented. Task ID: ${taskId}`);
}

/**
 * Updates a specific cell for a costume.
 * @param {string} costumeId The ID of the costume.
 * @param {string} field The column header.
 * @param {any} value The new value.
 */
export async function updateCostumeData(costumeId, field, value) {
    if (!allCostumes.rows) throw new Error("Costume data not loaded.");
    const idIdx = allCostumes.headers.indexOf('ID');
    const fieldIdx = allCostumes.headers.indexOf(field);
    if (idIdx === -1 || fieldIdx === -1) throw new Error(`Field "${field}" not found.`);

    const rowIndex = allCostumes.rows.findIndex(row => row[idIdx] === costumeId);
    if (rowIndex === -1) throw new Error(`Costume with ID "${costumeId}" not found.`);
    
    const sheetRow = rowIndex + 2;
    const sheetCol = fieldIdx + 1;

    await updateSheetData(SHEET_NAMES.costumes, sheetRow, sheetCol, value);
    allCostumes.rows[rowIndex][fieldIdx] = value;
}

/**
 * Updates a specific cell for an equipment item.
 * @param {string} equipmentId The ID of the equipment.
 * @param {string} field The column header.
 * @param {any} value The new value.
 */
export async function updateEquipmentData(equipmentId, field, value) {
    if (!allEquipment.rows) throw new Error("Equipment data not loaded.");
    const idIdx = allEquipment.headers.indexOf('ID');
    const fieldIdx = allEquipment.headers.indexOf(field);
    if (idIdx === -1 || fieldIdx === -1) throw new Error(`Field "${field}" not found.`);

    const rowIndex = allEquipment.rows.findIndex(row => row[idIdx] === equipmentId);
    if (rowIndex === -1) throw new Error(`Equipment with ID "${equipmentId}" not found.`);
    
    const sheetRow = rowIndex + 2;
    const sheetCol = fieldIdx + 1;

    await updateSheetData(SHEET_NAMES.equipment, sheetRow, sheetCol, value);
    allEquipment.rows[rowIndex][fieldIdx] = value;
}

/**
 * Updates a specific cell for a staff member.
 * @param {string} staffId The ID of the staff member.
 * @param {string} field The column header.
 * @param {any} value The new value.
 */
export async function updateStaffData(staffId, field, value) {
    if (!allStaff.rows) throw new Error("Staff data not loaded.");
    const idIdx = allStaff.headers.indexOf('ID');
    const fieldIdx = allStaff.headers.indexOf(field);
    if (idIdx === -1 || fieldIdx === -1) throw new Error(`Field "${field}" not found.`);

    const rowIndex = allStaff.rows.findIndex(row => row[idIdx] === staffId);
    if (rowIndex === -1) throw new Error(`Staff with ID "${staffId}" not found.`);
    
    const sheetRow = rowIndex + 2;
    const sheetCol = fieldIdx + 1;

    await updateSheetData(SHEET_NAMES.staff, sheetRow, sheetCol, value);
    allStaff.rows[rowIndex][fieldIdx] = value;
}

// Helper function to find project row index
function findProjectRowIndex(projectId) {
    if (!allProjects.rows) return -1;
    const idIdx = allProjects.headers.indexOf('Project ID');
    if (idIdx === -1) return -1;
    return allProjects.rows.findIndex(row => row[idIdx] === projectId);
}


// --- Functions for Assigning Equipment/Staff --- //

export async function addAssignedEquipmentToProject(projectId, equipmentId) {
    const projectRowIndex = findProjectRowIndex(projectId);
    if (projectRowIndex === -1) throw new Error("Project not found");

    const assignedEquipmentIdx = allProjects.headers.indexOf('Assigned Equipment');
    if (assignedEquipmentIdx === -1) throw new Error("'Assigned Equipment' column not found");

    let assigned = [];
    try {
        const existingData = allProjects.rows[projectRowIndex][assignedEquipmentIdx];
        if (existingData) {
            assigned = JSON.parse(existingData);
        }
    } catch (e) {
        console.error("Could not parse assigned equipment data:", e);
    }

    if (!assigned.includes(equipmentId)) {
        assigned.push(equipmentId);
    }

    const newValue = JSON.stringify(assigned);
    return updateProjectData(projectId, 'Assigned Equipment', newValue);
}

export async function removeAssignedEquipmentFromProject(projectId, equipmentId) {
    const projectRowIndex = findProjectRowIndex(projectId);
    if (projectRowIndex === -1) throw new Error("Project not found");

    const assignedEquipmentIdx = allProjects.headers.indexOf('Assigned Equipment');
    if (assignedEquipmentIdx === -1) throw new Error("'Assigned Equipment' column not found");
    
    let assigned = [];
    try {
        const existingData = allProjects.rows[projectRowIndex][assignedEquipmentIdx];
        if (existingData) {
            assigned = JSON.parse(existingData);
        }
    } catch (e) { console.error("Could not parse assigned equipment data:", e); }

    const newAssigned = assigned.filter(id => id !== equipmentId);
    const newValue = JSON.stringify(newAssigned);
    return updateProjectData(projectId, 'Assigned Equipment', newValue);
}

export async function addAssignedStaffToProject(projectId, staffAssignment) { // staffAssignment = {id, role}
    const projectRowIndex = findProjectRowIndex(projectId);
    if (projectRowIndex === -1) throw new Error("Project not found");

    const assignedStaffIdx = allProjects.headers.indexOf('Assigned Staff');
    if (assignedStaffIdx === -1) throw new Error("'Assigned Staff' column not found");

    let assigned = [];
    try {
        const existingData = allProjects.rows[projectRowIndex][assignedStaffIdx];
        if (existingData) {
            assigned = JSON.parse(existingData);
        }
    } catch (e) { console.error("Could not parse assigned staff data:", e); }

    // Remove if exists to update, then add back
    assigned = assigned.filter(s => s.id !== staffAssignment.id);
    assigned.push(staffAssignment);

    const newValue = JSON.stringify(assigned);
    return updateProjectData(projectId, 'Assigned Staff', newValue);
}


export async function removeAssignedStaffFromProject(projectId, staffAssignment) { // staffAssignment = {id, role}
    const projectRowIndex = findProjectRowIndex(projectId);
    if (projectRowIndex === -1) throw new Error("Project not found");

    const assignedStaffIdx = allProjects.headers.indexOf('Assigned Staff');
    if (assignedStaffIdx === -1) throw new Error("'Assigned Staff' column not found");

    let assigned = [];
    try {
        const existingData = allProjects.rows[projectRowIndex][assignedStaffIdx];
        if (existingData) {
            assigned = JSON.parse(existingData);
        }
    } catch (e) { console.error("Could not parse assigned staff data:", e); }
    
    const newAssigned = assigned.filter(s => s.id !== staffAssignment.id);
    const newValue = JSON.stringify(newAssigned);
    return updateProjectData(projectId, 'Assigned Staff', newValue);
}
