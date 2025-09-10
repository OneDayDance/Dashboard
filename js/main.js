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

// --- STATE ---
let tokenClient;
let gapiInited = false;
let gisInited = false;
let silentAuthAttempted = false;
let authLoadTimeout; // Variable to hold the timeout

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    cacheDOMElements();
    setupModalCloseButtons();
    
    // Pass the main data loading function to the init functions of each tab.
    // This avoids circular dependencies by using dependency injection.
    initRequestsTab(loadInitialData);
    initClientsTab(loadInitialData);
    initProjectsTab(loadInitialData);
    initCostumesTab(loadInitialData);
    initEquipmentTab(loadInitialData);

    elements.authorizeButton.onclick = handleAuthClick;
    elements.signoutButton.onclick = handleSignoutClick;
    
    // Start a timeout to catch indefinite loading issues
    authLoadTimeout = setTimeout(() => {
        handleAuthError("Authentication is taking too long to load. Please check your network connection and ad-blockers, then refresh the page.");
    }, 15000); // 15-second timeout

    loadGoogleScripts();
});

/**
 * Updates the UI to show an authentication error message.
 * @param {string} errorMessage - The message to display to the user.
 */
function handleAuthError(errorMessage) {
    console.error(errorMessage);
    clearTimeout(authLoadTimeout); // Stop the timeout if an error occurs
    if (elements.authorizeButton) {
        elements.authorizeButton.disabled = true;
        elements.authorizeButton.textContent = 'Authentication Error';
    }
    const landingBoxMessage = document.querySelector('.landing-box p');
    if (landingBoxMessage) {
        landingBoxMessage.style.color = '#dc3545'; // Use a distinct error color
        landingBoxMessage.innerHTML = errorMessage;
    }
}

/**
 * Dynamically creates and loads the Google API and Identity scripts.
 * Includes error handling for failed loads.
 */
function loadGoogleScripts() {
    // GIS (Google Identity Services) Script for Authentication
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

    // GAPI (Google API) Script for Sheets access
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = () => {
        console.log("Google API (GAPI) script loaded.");
        // GAPI's own loader has built-in success/error handling
        gapi.load('client', {
            callback: initializeGapiClient,
            onerror: () => handleAuthError("Failed to load the GAPI client library."),
            timeout: 10000, // 10 seconds
            ontimeout: () => handleAuthError("Timed out while loading the GAPI client library."),
        });
    };
    gapiScript.onerror = () => handleAuthError("Failed to load the Google API script. Please check your network connection or ad-blockers.");
    document.body.appendChild(gapiScript);
}

/**
 * Initializes the GAPI client for Google Sheets.
 */
async function initializeGapiClient() {
    console.log("Initializing GAPI client...");
    try {
        await gapi.client.init({});
        // Load both Sheets and Drive APIs
        await gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4');
        await gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
        console.log("GAPI client initialized successfully for Sheets and Drive.");
        gapiInited = true;
        checkLibsLoaded();
    } catch (err) {
        handleAuthError(`Failed to initialize GAPI client. Error: ${err.message}`);
    }
}

/**
 * Checks if both Google libraries are loaded and initialized.
 * If so, enables the authorize button and attempts a silent sign-in.
 */
function checkLibsLoaded() {
    if (gapiInited && gisInited) {
        console.log("Both GAPI and GIS libraries are loaded and initialized.");
        clearTimeout(authLoadTimeout); // Successfully loaded, so clear the timeout
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
    setupTabs();
    
    showLoadingIndicator();
    try {
        // Perform the first data load and render the initial view.
        await loadInitialData();
        loadDataForActiveTab(); 
    } catch (err) {
        showMainError(`Failed to load initial data: ${err.message}. Please check sheet permissions and try again.`);
    } finally {
        hideLoadingIndicator();
    }
}

/**
 * Fetches all necessary data from the spreadsheet and stores it in the state.
 * This is the central data refresh function for the entire application.
 * It also re-renders the currently active tab to show the new data.
 */
export async function loadInitialData() {
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
        // After fetching new data, always re-render the view for the active tab.
        loadDataForActiveTab();
    } catch (err) {
        showMainError(`Failed to refresh data: ${err.message}`);
    } finally {
        hideLoadingIndicator();
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
        silentAuthAttempted = false; // Allow silent sign-in on next visit
    }
}
