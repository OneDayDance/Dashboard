// --- CONFIGURATION ---
const CLIENT_ID = "555797317893-ce2nrrf49e5dol0c6lurln0c3it76c2r.apps.googleusercontent.com";
const SPREADSHEET_ID = "1G3kVQdR0yd1j362oZKYRXMby1Ve6PVcY8CrsQnuxVfY";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
// --- END OF CONFIGURATION ---

const authorizeButton = document.getElementById('authorize_button');
const signoutButton = document.getElementById('signout_button');
const mainContent = document.getElementById('main-content');

let tokenClient;
let gapiInited = false;
let gisInited = false;

// Runs when the Google API client library (for Sheets) is loaded.
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

// Runs when the Google Identity Services (for login) is loaded.
function gisLoaded() {
    // This is the correct new way to initialize the token client
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // Will be defined just before use
    });
    gisInited = true;
    maybeEnableButtons();
}

// Initializes the Google API client.
async function initializeGapiClient() {
    await gapi.client.init({}); // API key not needed for this flow
    gapiInited = true;
    maybeEnableButtons();
}

// Enables buttons once both libraries are fully loaded.
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        authorizeButton.style.opacity = 1;
        authorizeButton.disabled = false;
        authorizeButton.onclick = handleAuthClick;
        signoutButton.onclick = handleSignoutClick;
    }
}

// Called when the user clicks the authorization button.
function handleAuthClick() {
    tokenClient.callback = async (tokenResponse) => {
        if (tokenResponse.error !== undefined) {
            throw (tokenResponse);
        }
        // Show the signed-in UI
        signoutButton.style.display = 'block';
        authorizeButton.innerText = 'Refresh Data';
        mainContent.style.display = 'block';

        // Load data from the spreadsheet
        await loadClients();
    };

    // If the user doesn't have a token, request one.
    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        // If they have a token, just refresh it without a prompt.
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

// Called when the user clicks the sign-out button.
function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        
        // Update the UI
        document.getElementById('client-list').innerText = 'Authorize to load client list.';
        authorizeButton.innerText = 'Authorize and Load Data';
        signoutButton.style.display = 'none';
        mainContent.style.display = 'none';
    }
}

// Fetches client data from the 'Clients' sheet.
async function loadClients() {
    const clientListDiv = document.getElementById('client-list');
    clientListDiv.innerHTML = '<p>Loading clients...</p>';

    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Clients!A:E', // Adjust range as needed
        });
        
        const range = response.result;
        if (range.values && range.values.length > 1) {
            const headers = range.values.shift(); // Remove header row
            
            clientListDiv.innerHTML = '';
            const ul = document.createElement('ul');

            range.values.forEach(row => {
                const li = document.createElement('li');
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
