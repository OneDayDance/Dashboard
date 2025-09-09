// js/ui.js
// Description: Handles general UI interactions, DOM element selections, and modal management.

import { renderRequests } from './requests.js';
import { renderAnalytics } from './analytics.js';
import { renderClients } from './clients.js';
import { renderProjectsTab } from './projects.js';
import { state, allRequests, allClients } from './state.js';

// --- DOM ELEMENTS ---
export let elements = {};

export function cacheDOMElements() {
    elements.authorizeButton = document.getElementById('authorize_button');
    elements.signoutButton = document.getElementById('signout_button');
    elements.appContainer = document.getElementById('app-container');
    elements.landingContainer = document.getElementById('landing-container');
    elements.detailsModal = document.getElementById('details-modal');
    elements.clientDetailsModal = document.getElementById('client-details-modal');
    elements.createProjectModal = document.getElementById('create-project-modal');
    elements.taskDetailsModal = document.getElementById('task-details-modal');
    elements.deleteClientModal = document.getElementById('delete-client-modal');
    elements.deleteProjectModal = document.getElementById('delete-project-modal');
    elements.gdriveLinkModal = document.getElementById('gdrive-link-modal');
    elements.columnModal = document.getElementById('column-modal');
    elements.clientColumnModal = document.getElementById('client-column-modal');
    elements.closeModalButtons = document.querySelectorAll('.close-button');
}


// --- TAB NAVIGATION ---
export function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    document.querySelector('.tab-button[data-tab="requests"]').classList.add('active');
    document.querySelector('#tab-requests').style.display = 'block';

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const tabId = button.dataset.tab;
            tabContents.forEach(content => content.style.display = (content.id === `tab-${tabId}`) ? 'block' : 'none');
            loadDataForActiveTab();
        });
    });
}

export function loadDataForActiveTab() {
    const activeTab = document.querySelector('.tab-button.active').dataset.tab;
    switch (activeTab) {
        case 'requests': renderRequests(); break;
        case 'analytics': renderAnalytics(); break;
        case 'clients': renderClients(); break;
        case 'projects': renderProjectsTab(); break;
    }
}

// --- MODAL & UI HELPERS ---
export function showColumnModal(type) {
    if (type === 'requests') {
        populateColumnSelector(allRequests.headers, state.visibleColumns, 'column-checkboxes');
        elements.columnModal.style.display = 'block';
    } else {
        populateColumnSelector(allClients.headers.filter(h => h), state.visibleClientColumns, 'client-column-checkboxes');
        elements.clientColumnModal.style.display = 'block';
    }
}

export function populateColumnSelector(headers, visibleColumns, containerId) {
    const container = document.getElementById(containerId); container.innerHTML = '';
    headers.forEach(header => {
        if (!header) return;
        const isChecked = visibleColumns.includes(header);
        container.innerHTML += `<div><label><input type="checkbox" value="${header}" ${isChecked ? 'checked' : ''}>${header}</label></div>`;
    });
}

export function setupModalCloseButtons() {
    elements.closeModalButtons.forEach(btn => btn.onclick = () => btn.closest('.modal').style.display = 'none');
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
}
