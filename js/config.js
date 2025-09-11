// js/config.js
// Description: Holds the static configuration variables for the application.

export const CLIENT_ID = "555797317893-ce2nrrf49e5dol0c6lurln0c3it76c2r.apps.googleusercontent.com";
export const SPREADSHEET_ID = "1G3kVQdR0yd1j362oZKYRXMby1Ve6PVcY8CrsQnuxVfY";

// IMPORTANT: Updated to the full Google Drive scope to support Shared Drives.
// This is necessary for long-term stability and team access.
// Users will be prompted to grant this broader permission.
export const SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive";

// The name of the folder in the Shared Drive where inventory images will be stored.
export const INVENTORY_IMAGE_FOLDER = "Dashboard_Inventory_Images";

// Names of the sheets in the Google Sheet
export const SHEET_NAMES = {
    requests: 'Submissions',
    clients: 'Clients',
    projects: 'Projects',
    costumes: 'Costumes',
    equipment: 'Equipment',
    staff: 'Staff',
    tasks: 'Tasks'
};
