// js/staff.js
// Description: Contains all logic for the 'Staff' tab using the generic resource manager.

import { allStaff } from './state.js';
import { createResourceManager } from './resourcemanager.js';

// --- CONFIGURATION ---
const staffCardRenderer = (row, headers) => {
    const name = row[headers.indexOf('Name')] || 'Unnamed Staff Member';
    const skills = (row[headers.indexOf('Skills')] || '').split(',').map(s => s.trim()).filter(Boolean);
    const skillChips = skills.map(skill => `<span class="skill-chip">${skill}</span>`).join('');

    return `
        <h4>${name}</h4>
        <div class="skill-chips-container">
            ${skillChips || '<p>No skills listed.</p>'}
        </div>
    `;
};

const staffConfig = {
    name: 'staff',
    resourceName: 'Staff',
    sheetName: 'Staff',
    idPrefix: 'S-',
    stateData: () => allStaff,
    stateFilterKey: 'staffFilters',
    cardRenderer: staffCardRenderer,
    filters: [
        { uiId: 'staff-skills-filter', sheetColumn: 'Skills', stateKey: 'skill' }
    ],
    formFields: [
        { id: 'name', sheetColumn: 'Name' },
        { id: 'rate', sheetColumn: 'Standard Rate', type: 'number' },
        { id: 'skills', sheetColumn: 'Skills' },
        { id: 'start-date', sheetColumn: 'Start Date', type: 'date' },
        { id: 'notes', sheetColumn: 'Notes', type: 'textarea' },
    ]
};


// --- MANAGER INSTANCE ---
const staffManager = createResourceManager(staffConfig);

// --- EXPORTS ---
export const initStaffTab = staffManager.init;
export const renderStaff = staffManager.render;
