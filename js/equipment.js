// js/equipment.js
// Description: Contains all logic for the 'Equipment' tab using the generic resource manager.

import { allEquipment } from './state.js';
import { createResourceManager } from './resourceManager.js';

// --- CONFIGURATION ---
const genericCardRenderer = (row, headers) => {
    const name = row[headers.indexOf('Name')] || 'Unnamed Equipment';
    const category = row[headers.indexOf('Category')] || 'N/A';
    return `<h4>${name}</h4><p><strong>Category:</strong> ${category}</p>`;
};

const equipmentConfig = {
    name: 'equipment',
    resourceName: 'Equipment',
    sheetName: 'Equipment',
    idPrefix: 'E-',
    stateData: () => allEquipment,
    stateFilterKey: 'equipmentFilters',
    cardRenderer: genericCardRenderer,
    filters: [
        { uiId: 'equipment-status-filter', sheetColumn: 'Status', stateKey: 'status' },
        { uiId: 'equipment-category-filter', sheetColumn: 'Category', stateKey: 'category' }
    ],
    formFields: [
        { id: 'name', sheetColumn: 'Name' },
        { id: 'status', sheetColumn: 'Status' },
        { id: 'category', sheetColumn: 'Category' },
        { id: 'manufacturer', sheetColumn: 'Manufacturer' },
        { id: 'model', sheetColumn: 'Model' },
        { id: 'serial', sheetColumn: 'Serial Number' },
        { id: 'purchase-cost', sheetColumn: 'Purchase Cost ($)', type: 'number' },
        { id: 'purchase-date', sheetColumn: 'Purchase Date', type: 'date' },
        { id: 'location', sheetColumn: 'Storage Location' },
        { id: 'notes', sheetColumn: 'Notes', type: 'textarea' },
    ]
};

// --- MANAGER INSTANCE ---
const equipmentManager = createResourceManager(equipmentConfig);

// --- EXPORTS ---
export const initEquipmentTab = equipmentManager.init;
export const renderEquipment = equipmentManager.render;
