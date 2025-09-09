// js/state.js
// Description: Manages the dynamic state of the application.

export let state = {
    // requests tab state
    sortColumn: 'Submission Date',
    sortDirection: 'desc',
    searchTerm: '',
    filters: { service: 'all', status: 'all' },
    visibleColumns: ['Submission Date', 'Full Name', 'Primary Service Category', 'Status'],
    currentView: 'list',
    // clients tab state
    clientSearchTerm: '',
    clientSortColumn: 'First Name',
    clientSortDirection: 'asc',
    clientCurrentView: 'list',
    visibleClientColumns: ['First Name', 'Last Name', 'Email', 'Organization', 'Status'],
    clientFilters: { status: 'all' },
    // projects tab state
    selectedProjectId: null,
    projectTaskView: 'list', // 'list' or 'board'
    projectSearchTerm: ''
};

export let charts = {
    revenue: null,
    services: null,
    projects: null
};

export const sortableColumns = ['Submission Date', 'Full Name', 'Email', 'Organization', 'Primary Service Category', 'Status'];
export const clientSortableColumns = ['First Name', 'Last Name', 'Email', 'Organization', 'Status'];

export let allRequests = { headers: [], rows: [] };
export let allClients = { headers: [], rows: [] };
export let allProjects = { headers: [], rows: [] };
export let allTasks = { headers: [], rows: [] };

export function setAllRequests(data) { allRequests = data; }
export function setAllClients(data) { allClients = data; }
export function setAllProjects(data) { allProjects = data; }
export function setAllTasks(data) { allTasks = data; }

export function updateState(newState) {
    state = { ...state, ...newState };
}

export function updateFilters(key, value) {
    state.filters[key] = value;
}

export function updateClientFilters(key, value) {
    state.clientFilters[key] = value;
}
