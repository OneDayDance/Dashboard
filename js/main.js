// js/main.js
// Description: The main entry point for the application. Handles initialization, authentication, and orchestrates the different modules.

import { CLIENT_ID, SCOPES } from './config.js';
import { loadRequests, loadClients, loadProjects, loadTasks } from './api.js';
import { allRequests, setAllRequests, setAllClients, setAllProjects, setAllTasks } from './state.js';
import { setupTabs, loadDataForActiveTab, cacheDOMElements, elements, setupModalCloseButtons } from './ui.js';
import { initRequestsTab } from './requests.js';
import { initClientsTab } from './clients.js';
import { initProjectsTab } from './projects.js';

// --- STATE ---
let tokenClient;
let gapiInited = false;
let gisInited = false;
let silentAuthAttempted = false;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    cacheDOMElements();
    setupModalCloseButtons();
    initRequestsTab();
    initClientsTab();
    initProjectsTab();

    elements.authorizeButton.onclick = handleAuthClick;
    elements.signoutButton.onclick = handleSignoutClick;
});

// These functions are assigned to the window object so they can be called by the Google scripts' onload callbacks
window.gapiLoaded = function() {
    gapi.load('client', initializeGapiClient);
};

window.gisLoaded = function() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (tokenResponse) => {
            if (tokenResponse.error) {
                console.warn('Token response error:', tokenResponse.error);
                // Potentially handle failed silent sign-in here
                return;
            }
            await onSignInSuccess();
        },
    });
    gisInited = true;
    checkLibsLoaded();
};

async function initializeGapiClient() {
    await gapi.client.init({});
    await gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4');
    gapiInited = true;
    checkLibsLoaded();
}

function checkLibsLoaded() {
    if (gapiInited && gisInited) {
        elements.authorizeButton.disabled = false;
        elements.authorizeButton.textContent = 'Authorize';
        attemptSilentSignIn();
    }
}

// --- AUTHENTICATION ---
function attemptSilentSignIn() {
    if (!silentAuthAttempted) {
        silentAuthAttempted = true;
        // The prompt: '' triggers a silent sign-in attempt
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

function handleAuthClick() {
    // The prompt: 'consent' will force the user to see the consent screen.
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        elements.appContainer.style.display = 'none';
        elements.landingContainer.style.display = 'flex';
        silentAuthAttempted = false; // Allow silent sign-in again on next load
    }
}

// --- CORE APP LOGIC ---
async function onSignInSuccess() {
    elements.landingContainer.style.display = 'none';
    elements.appContainer.style.display = 'block';
    setupTabs();
    await loadInitialData();
    loadDataForActiveTab();
}

async function loadInitialData() {
    // Fetch all data from sheets in parallel for faster loading
    const [requests, clients, projects, tasks] = await Promise.all([
        loadRequests(),
        loadClients(),
        loadProjects(),
        loadTasks()
    ]);
    
    // Update the central state with the fetched data
    setAllRequests(requests);
    setAllClients(clients);
    setAllProjects(projects);
    setAllTasks(tasks);

    // Populate filters that depend on the data
    populateServiceFilter();
}


function populateServiceFilter() {
    const serviceFilter = document.getElementById('service-filter');
    const { headers, rows } = allRequests;
    if (!rows || rows.length === 0) return;

    const serviceIndex = headers.indexOf('Primary Service Category');
    if (serviceIndex === -1) return;
    
    const services = new Set(rows.map(row => row[serviceIndex]));
    serviceFilter.innerHTML = '<option value="all">All Services</option>';
    services.forEach(service => {
        if (service) serviceFilter.add(new Option(service, service));
    });
}

