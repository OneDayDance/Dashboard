// js/main.js
// Description: The main entry point for the application. Handles initialization, authentication, and orchestrates the different modules.

import { CLIENT_ID, SCOPES } from './config.js';
import { loadRequests, loadClients, loadProjects, loadTasks, loadCostumes, loadEquipment } from './api.js';
import { 
    elements, 
    cacheDOMElements, 
    setupTabs, 
    setupModalCloseButtons, 
    loadDataForActiveTab,
    showLoadingIndicator,
    hideLoadingIndicator,
    showMainError
} from './ui.js';
import { initRequestsTab } from './requests.js';
import { initClientsTab } from './clients.js';
import { initProjectsTab } from './projects.js';
import { initCostumesTab } from './costumes.js';
import { initEquipmentTab } from './equipment.js';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let silentAuthAttempted = false;
let authLoadTimeout;
let uiInitialized = false; // Flag to prevent re-initializing listeners

/**
 * Sets up all the event listeners for the main application UI.
 * This is called only after a successful sign-in.
 */
function initializeAppUI() {
    if (uiInitialized) return; // Ensure this only runs once

    console.log("Initializing application UI event listeners...");
    initRequestsTab(loadInitialData);
    initClientsTab(loadInitialData);
    initProjectsTab(loadInitialData);
    initCostumesTab(loadInitialData);
    initEquipmentTab(loadInitialData);
    
    uiInitialized = true;
}


document.addEventListener('DOMContentLoaded', () => {
    cacheDOMElements();
    setupModalCloseButtons();
    
    // Note: Tab initialization is now deferred until after sign-in.

    elements.authorizeButton.onclick = handleAuthClick;
    elements.signoutButton.onclick = handleSignoutClick;
    
    authLoadTimeout = setTimeout(() => {
        handleAuthError("Authentication is taking too long to load. Please check your network connection and ad-blockers, then refresh the page.");
    }, 15000);

    loadGoogleScripts();
});

function handleAuthError(errorMessage) {
    console.error(errorMessage);
    clearTimeout(authLoadTimeout);
    if (elements.authorizeButton) {
        elements.authorizeButton.disabled = true;
        elements.authorizeButton.textContent = 'Authentication Error';
    }
    const landingBoxMessage = document.querySelector('.landing-box p');
    if (landingBoxMessage) {
        landingBoxMessage.style.color = '#dc3545';
        landingBoxMessage.innerHTML = errorMessage;
    }
}

function loadGoogleScripts() {
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => {
        try {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: async (tokenResponse) => {
                    if (tokenResponse.error) {
                        handleAuthError(`Authentication error: ${tokenResponse.error}`);
                        return;
                    }
                    await onSignInSuccess();
                },
            });
            gisInited = true;
            checkLibsLoaded();
        } catch (err) {
            handleAuthError(`Failed to initialize Google Identity Services. Error: ${err.message}`);
        }
    };
    gisScript.onerror = () => handleAuthError("Failed to load the Google Identity script. Please check your network connection or ad-blockers.");
    document.body.appendChild(gisScript);

    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = () => {
        gapi.load('client', {
            callback: initializeGapiClient,
            onerror: () => handleAuthError("Failed to load the GAPI client library."),
            timeout: 10000,
            ontimeout: () => handleAuthError("Timed out while loading the GAPI client library."),
        });
    };
    gapiScript.onerror = () => handleAuthError("Failed to load the Google API script. Please check your network connection or ad-blockers.");
    document.body.appendChild(gapiScript);
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({});
        await gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4');
        gapiInited = true;
        checkLibsLoaded();
    } catch (err) {
        handleAuthError(`Failed to initialize GAPI client. Error: ${err.message}`);
    }
}

function checkLibsLoaded() {
    if (gapiInited && gisInited) {
        clearTimeout(authLoadTimeout);
        elements.authorizeButton.disabled = false;
        elements.authorizeButton.textContent = 'Authorize';
        attemptSilentSignIn();
    }
}

function attemptSilentSignIn() {
    if (!silentAuthAttempted) {
        silentAuthAttempted = true;
        if (tokenClient) {
            tokenClient.requestAccessToken({ prompt: '' });
        }
    }
}

async function onSignInSuccess() {
    elements.landingContainer.style.display = 'none';
    elements.appContainer.style.display = 'block';
    
    // Initialize UI listeners now that the app is visible and authenticated
    initializeAppUI();
    
    setupTabs();
    
    showLoadingIndicator();
    try {
        await loadInitialData();
        loadDataForActiveTab(); 
    } catch (err) {
        showMainError(`Failed to load initial data: ${err.message}. Please check sheet permissions and try again.`);
    } finally {
        hideLoadingIndicator();
    }
}

async function loadInitialData() {
    console.log("Refreshing all application data...");
    showLoadingIndicator();
    try {
        await Promise.all([
            loadRequests(), 
            loadClients(), 
            loadProjects(), 
            loadTasks(),
            loadCostumes(),
            loadEquipment()
        ]);
        console.log("All application data refreshed.");
        loadDataForActiveTab();
    } catch (err) {
        showMainError(`Failed to refresh data: ${err.message}`);
    } finally {
        hideLoadingIndicator();
    }
}

function handleAuthClick() {
    if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    }
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        elements.appContainer.style.display = 'none';
        elements.landingContainer.style.display = 'flex';
        silentAuthAttempted = false;
    }
}

