/* * Client-side script for Google Sheets API access using OAuth 2.0
 */

// --- PASTE YOUR CREDENTIALS AND SPREADSHEET INFO HERE ---
const CLIENT_ID = "555797317893-ce2nrrf49e5dol0c6lurln0c3it76c2r.apps.googleusercontent.com"; 
const SPREADSHEET_ID = "1G3kVQdR0yd1j362oZKYRXMby1Ve6PVcY8CrsQnuxVfY";
// --- END OF CONFIGURATION ---

// Scopes define the permissions the user grants.
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

const authorizeButton = document.getElementById('authorize_button');
const signoutButton = document.getElementById('signout_button');
const mainContent = document.getElementById('main-content');

/**
 * On load, called to load the auth2 library and API client library.
 */
function handleClientLoad() {
    gapi.load('client:auth2', initClient);
}

/**
 * Initializes the API client library and sets up sign-in state
 * listeners.
 */
function initClient() {
    gapi.client.init({
        clientId: CLIENT_ID,
        scope: SCOPES
    }).then(function () {
        // Listen for sign-in state changes.
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

        // Handle the initial sign-in state.
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
        authorizeButton.onclick = handleAuthClick;
        signoutButton.onclick = handleSignoutClick;
    }, function(error) {
        console.error(JSON.stringify(error, null, 2));
    });
}

/**
 * Called when the signed in status changes, to update the UI
 * and load data.
 */
function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        authorizeButton.style.display = 'none';
        signoutButton.style.display = 'block';
        mainContent.style.display = 'block';
        loadClients();
    } else {
        authorizeButton.style.display = 'block';
        signoutButton.style.display = 'none';
        mainContent.style.display = 'none';
    }
}

/**
 * Sign in the user upon button click.
 */
function handleAuthClick(event) {
    gapi.auth2.getAuthInstance().signIn();
}

/**
 * Sign out the user upon button click.
 */
function handleSignoutClick(event) {
    gapi.auth2.getAuthInstance().signOut();
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
        if (range.values.length > 1) { // More than just the header
            const headers = range.values.shift(); // Remove header row
            
            clientListDiv.innerHTML = '';
            const ul = document.createElement('ul');

            range.values.forEach(row => {
                const li = document.createElement('li');
                // Assuming FirstName is the 2nd column (index 1) and Email is the 4th (index 3)
                li.textContent = `${row[1]} - (${row[3]})`; 
                ul.appendChild(li);
            });
            clientListDiv.appendChild(ul);

        } else {
            clientListDiv.innerHTML = '<p>No clients found.</p>';
        }
    } catch (err) {
        clientListDiv.innerHTML = `<p style="color:red;">Error: ${err.result.error.message}</p>`;
    }
}

// Load the client library.
handleClientLoad();
