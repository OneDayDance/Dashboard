// js/costumes.js
// Description: Contains all logic for the 'Costumes' tab using the generic resource manager.

import { allCostumes } from './state.js';
import { createResourceManager } from './resourceManager.js';

// --- CONFIGURATION ---
const genericCardRenderer = (row, headers) => {
    const name = row[headers.indexOf('Name')] || 'Unnamed Costume';
    const category = row[headers.indexOf('Category')] || 'N/A';
    return `<h4>${name}</h4><p><strong>Category:</strong> ${category}</p>`;
};

const costumeConfig = {
    name: 'costume',
    resourceName: 'Costume',
    sheetName: 'Costumes',
    idPrefix: 'C-',
    stateData: () => allCostumes,
    stateFilterKey: 'costumeFilters',
    cardRenderer: genericCardRenderer,
    filters: [
        { uiId: 'costume-status-filter', sheetColumn: 'Status', stateKey: 'status' },
        { uiId: 'costume-category-filter', sheetColumn: 'Category', stateKey: 'category' }
    ],
    formFields: [
        { id: 'name', sheetColumn: 'Name' },
        { id: 'status', sheetColumn: 'Status' },
        { id: 'category', sheetColumn: 'Category' },
        { id: 'size', sheetColumn: 'Size' },
        { id: 'color', sheetColumn: 'Color' },
        { id: 'material', sheetColumn: 'Material' },
        { id: 'era', sheetColumn: 'Era/Style' },
        { id: 'purchase-cost', sheetColumn: 'Purchase Cost ($)', type: 'number' },
        { id: 'condition', sheetColumn: 'Condition' },
        { id: 'location', sheetColumn: 'Storage Location' },
        { id: 'date-added', sheetColumn: 'Date Added', type: 'date' },
        { id: 'notes', sheetColumn: 'Notes', type: 'textarea' },
    ]
};

// --- MANAGER INSTANCE ---
const costumeManager = createResourceManager(costumeConfig);

// --- EXPORTS ---
export const initCostumesTab = costumeManager.init;
export const renderCostumes = costumeManager.render;
