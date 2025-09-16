// js/main.js
// Description: The main entry point for the application. Handles initialization, authentication, and orchestrates the different modules.

import { CLIENT_ID, SCOPES } from './config.js';
import { loadRequests, loadClients, loadProjects, loadTasks, loadCostumes, loadEquipment, loadStaff } from './api.js';
import { 
    elements, 
    cacheDOMElements, 
    setupTabs, 
    setupModalCloseButtons
} from './ui.js';
import { showToast, hideToast } from './toast.js';
import { initRequestsTab, renderRequests } from './requests.js';
import { initClientsTab, renderClients } from './clients.js';
import { initProjectsTab, renderProjectsTab } from './projects.js';
import { initCostumesTab, renderCostumes } from './costumes.js';
import { initEquipmentTab, renderEquipment } from './equipment.js';
import { initStaffTab, renderStaff } from './staff.js';
import { renderAnalytics } from './analytics.js';


// --- STATE ---
let tokenClient;
let gapiInited = false;
let gisInited = false;
let silentAuthAttempted = false;
let authLoadTimeout; // Variable to hold the timeout

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    cacheDOMElements(); // This should be first
    
    elements.authorizeButton.onclick = handleAuthClick;
    elements.signoutButton.onclick = handleSignoutClick;
    
    authLoadTimeout = setTimeout(() => {
        handleAuthError("Authentication is taking too long to load. Please check your network connection and ad-blockers, then refresh the page.");
    }, 15000);

    loadGoogleScripts();
});

// This function is now the single source of truth for rendering tab content.
function renderContentForActiveTab() {
    const activeTab = document.querySelector('.tab-button.active')?.dataset.tab;
    if (!activeTab) return;

    switch (activeTab) {
        case 'requests':
            renderRequests();
            break;
        case 'analytics':
            renderAnalytics();
            break;
        case 'clients':
            renderClients();
            break;
        case 'projects':
            renderProjectsTab();
            break;
        case 'costumes':
            renderCostumes();
            break;
        case 'equipment':
            renderEquipment();
            break;
        case 'staff':
            renderStaff();
            break;
        default:
            console.warn(`No render function found for tab: ${activeTab}`);
    }
}


function initializeAppUI() {
    setupTabs(renderContentForActiveTab); // Pass the central render function to the tab setup.
    setupModalCloseButtons();
    
    initRequestsTab(loadInitialData);
    initClientsTab(loadInitialData);
    initProjectsTab(loadInitialData);
    initCostumesTab(loadInitialData);
    initEquipmentTab(loadInitialData);
    initStaffTab(loadInitialData);
}


/**
 * Updates the UI to show an authentication error message.
 * @param {string} errorMessage - The message to display to the user.
 */
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

/**
 * Dynamically creates and loads the Google API and Identity scripts.
 */
function loadGoogleScripts() {
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => {
        console.log("Google Identity Services (GIS) script loaded.");
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
        console.log("Google API (GAPI) script loaded.");
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

/**
 * Initializes the GAPI client for Google Sheets and Google Drive.
 */
async function initializeGapiClient() {
    console.log("Initializing GAPI client...");
    try {
        await gapi.client.init({});
        await Promise.all([
            gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4'),
            gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest')
        ]);
        console.log("GAPI client initialized successfully for Sheets and Drive.");
        gapiInited = true;
        checkLibsLoaded();
    } catch (err) {
        handleAuthError(`Failed to initialize GAPI client. Error: ${err.message}`);
    }
}


/**
 * Checks if both Google libraries are loaded and initialized.
 */
function checkLibsLoaded() {
    if (gapiInited && gisInited) {
        console.log("Both GAPI and GIS libraries are loaded and initialized.");
        clearTimeout(authLoadTimeout); 
        elements.authorizeButton.disabled = false;
        elements.authorizeButton.textContent = 'Authorize';
        attemptSilentSignIn();
    }
}

/**
 * Attempts to get an access token without user interaction.
 */
function attemptSilentSignIn() {
    if (!silentAuthAttempted) {
        silentAuthAttempted = true;
        if (tokenClient) {
            tokenClient.requestAccessToken({ prompt: '' });
        }
    }
}

// --- AUTH HANDLERS & DATA LOADING ---
/**
 * Main function to run after a successful sign-in.
 */
async function onSignInSuccess() {
    elements.landingContainer.style.display = 'none';
    elements.appContainer.style.display = 'block';
    initializeAppUI();
    
    const loadingToast = showToast('Loading initial data...', -1, 'info');
    try {
        await loadInitialData(false); // Pass false to prevent showing a redundant success toast
        showToast('Data loaded successfully!', 3000, 'success');
    } catch (err) {
        showToast(`Failed to load initial data: ${err.message}. Please check sheet permissions and try again.`, 6000, 'error');
    } finally {
        hideToast(loadingToast);
    }
}

/**
 * Fetches all necessary data from the spreadsheet and stores it in the state.
 * @param {boolean} showSuccessToast - Whether to show a success toast upon completion.
 */
async function loadInitialData(showSuccessToast = true) {
    console.log("Refreshing all application data...");
    const loadingToast = showToast('Refreshing data...', -1, 'info');
    try {
        await Promise.all([
            loadRequests(), 
            loadClients(), 
            loadProjects(), 
            loadTasks(),
            loadCostumes(),
            loadEquipment(),
            loadStaff()
        ]);
        console.log("All application data refreshed.");
        renderContentForActiveTab();
        if (showSuccessToast) {
            showToast('Data refreshed!', 3000, 'success');
        }
    } catch (err) {
        showToast(`Failed to refresh data: ${err.message}`, 5000, 'error');
        // re-throw to allow callers to handle the error
        throw err;
    } finally {
        hideToast(loadingToast);
    }
}


/**
 * Handles the explicit click of the "Authorize" button.
 */
function handleAuthClick() {
    if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    }
}

/**
 * Signs the user out and returns to the landing page.
 */
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
