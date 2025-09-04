// --- CONFIGURATION ---
const CLIENT_ID = "555797317893-ce2nrrf4e5dol0c6lurln0c3it76c2r.apps.googleusercontent.com";
const SPREADSHEET_ID = "1G3kVQdR0yd1j362oZKYRXMby1Ve6PVcY8CrsQnuxVfY";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
// --- END OF CONFIGURATION ---

const authorizeButton = document.getElementById('authorize_button');
const signoutButton = document.getElementById('signout_button');
const mainContent = document.getElementById('main-content');

let tokenClient;
let gapiInited = false;
let gisInited = false;

/**
 * Callback after the API client library has loaded.
 */
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

/**
 * Callback after the Google Identity Services library has loaded.
 */
function gisLoaded() {
    tokenClient = google.accounts.id.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
    });
    gisInited = true;
    maybeEnableButtons();
}

/**
 * Initializes the API client library.
 */
async function initializeGapiClient() {
    await gapi.client.init({
        // NOTE: No API key is needed for the Sheets API in this context
    });
    gapiInited = true;
    maybeEnableButtons();
}

/**
* Enables user interaction after all libraries are loaded.
*/
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        authorizeButton.onclick = handleAuthClick;
        signoutButton.onclick = handleSignoutClick;
    }
}

/**
 * Sign in the user upon button click.
 */
function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        // Show signed-in UI
        signoutButton.style.display = 'block';
        authorizeButton.innerText = 'Refresh Data';
        mainContent.style.display = 'block';
        
        // Load the data
        await loadClients();
    };

    if (gapi.client.getToken() === null) {
        // Prompt the user to select a Google Account and ask for consent to share their data
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        // Skip display of account chooser and consent dialog for an existing session.
        tokenClient.requestAccessToken({prompt: ''});
    }
}

/**
 * Sign out the user upon button click.
 */
function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        
        // Update UI
        document.getElementById('client-list').innerText = 'Authorize to load client list.';
        authorizeButton.innerText = 'Authorize and Load Data';
        signoutButton.style.display = 'none';
    }
}

/**
 * Fetches client data from the 'Clients' sheet.
 */
async function loadClients() {
    const clientListDiv = document.getElementById('client-list');
    clientListDiv.innerHTML = '<p>Loading clients...</p>';

    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Clients!A:E', // Adjust range as needed
        });
        
        const range = response.result;
        if (range.values && range.values.length > 1) { // Check if values exist
            const headers = range.values.shift(); // Remove header row
            
            clientListDiv.innerHTML = '';
            const ul = document.createElement('ul');

            range.values.forEach(row => {
                const li = document.createElement('li');
                // Assuming FirstName is column B (index 1) and Email is column D (index 3)
                const firstName = row[1] || 'N/A'; // Handle empty cells
                const email = row[3] || 'N/A';
                li.textContent = `${firstName} - (${email})`; 
                ul.appendChild(li);
            });
            clientListDiv.appendChild(ul);

        } else {
            clientListDiv.innerHTML = '<p>No clients found.</p>';
        }
    } catch (err) {
        console.error("API Error:", err);
        clientListDiv.innerHTML = `<p style="color:red;">Error: ${err.result.error.message}</p>`;
    }
}
