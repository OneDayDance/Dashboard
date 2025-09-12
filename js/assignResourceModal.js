// js/assignResourceModal.js
// Description: Handles the logic for the generic "Assign Resource" modal for staff, equipment, etc.

import { allProjects } from './state.js';
import { updateSheetRow } from './api.js';
import { elements } from './ui.js';

let refreshData;

/**
 * Initializes the module with a function to refresh all app data.
 * @param {Function} refreshDataFn - The function to call to reload data from sheets.
 */
export function initAssignResourceModal(refreshDataFn) {
    refreshData = refreshDataFn;
}

/**
 * Factory function to create a handler for a specific resource type (e.g., staff, equipment).
 * This allows for a generic modal UI to be used for different types of resources with
 * different data structures and rendering logic.
 * @param {object} config - Configuration object for the specific resource type.
 * @returns {object} An object with `renderAssignedSection` and `showAssignModal` methods.
 */
export function createResourceHandler(config) {

    const {
        resourceType,
        resourceNameSingular,
        resourceNamePlural,
        allResourcesState,
        idKey,
        projectSheetColumn,
        isComplex, // true for array of objects (staff), false for array of IDs (equipment)
        getAssignments,
        formatForSave,
        renderAssignedItemCard,
        createModalItemElement,
    } = config;

    /**
     * Renders the section in the project details view showing assigned resources.
     * @param {Array} project - The project data row.
     * @param {Array} headers - The headers for the projects sheet.
     * @returns {string} HTML string for the assigned resources section.
     */
    function renderAssignedSection(project, headers) {
        const assignedData = getAssignments(project, headers);
        let itemsHtml = '';
        // FIX: Call the state function to get the latest resource data.
        const currentResources = allResourcesState();
        const [idIndex, nameIndex, imageIndex] = [idKey, 'Name', 'Image URL'].map(h => currentResources.headers.indexOf(h));
        
        if (assignedData && assignedData.length > 0) {
            assignedData.forEach(assignment => {
                const resourceId = isComplex ? assignment.id : assignment;
                // FIX: Use the fetched currentResources, not the potentially stale module-level import.
                const resource = currentResources.rows.find(row => row[idIndex] === resourceId);
                if (resource) {
                    itemsHtml += renderAssignedItemCard(resource, assignment, { idIndex, nameIndex, imageIndex });
                }
            });
        }
        
        if (!itemsHtml) {
            itemsHtml = `<p>No ${resourceType} assigned to this project.</p>`;
        }

        return `
            <div class="project-details-section content-section">
                <div class="project-details-section-header">
                    <h4>Assigned ${resourceNamePlural}</h4>
                    <div class="view-controls">
                         <button id="assign-${resourceType}-btn" type="button" class="btn btn-secondary">Assign ${resourceNameSingular}</button>
                    </div>
                </div>
                <div id="assigned-${resourceType}-container" class="assigned-resource-container">${itemsHtml}</div>
            </div>
        `;
    }

    /**
     * Shows and configures the generic modal for assigning the specific resource.
     * @param {string} projectId - The ID of the project to assign resources to.
     */
    function showAssignModal(projectId) {
        const project = allProjects.rows.find(p => p[allProjects.headers.indexOf('ProjectID')] === projectId);
        if (!project) return;
        
        // Configure modal titles and placeholders
        elements.assignResourceModalTitle.textContent = `Assign ${resourceNamePlural} to Project`;
        elements.assignResourceAvailableTitle.textContent = `Available ${resourceNamePlural}`;
        elements.assignResourceSelectedTitle.textContent = `Assigned to Project`;
        elements.resourceSearchInput.placeholder = `Search ${resourceType}...`;
        
        const initialAssignments = getAssignments(project, allProjects.headers);
        let localSelected = isComplex ? JSON.parse(JSON.stringify(initialAssignments)) : new Set(initialAssignments);

        const searchInput = elements.resourceSearchInput;
        const searchResultsContainer = elements.resourceSearchResults;
        const selectedContainer = elements.selectedResourceList;
    
        const render = () => {
            const searchTerm = searchInput.value.toLowerCase();
            searchResultsContainer.innerHTML = '';
            selectedContainer.innerHTML = '';

            // FIX: Get the current resource state each time the modal content is rendered.
            const currentResources = allResourcesState();

            // Render selected items
            const renderCollection = isComplex ? localSelected : Array.from(localSelected);
            renderCollection.forEach(assignmentOrId => {
                const id = isComplex ? assignmentOrId.id : assignmentOrId;
                const item = currentResources.rows.find(row => row[currentResources.headers.indexOf(idKey)] === id);
                if (item) {
                    // FIX: Pass the fresh `currentResources` data to the element creator function.
                    selectedContainer.appendChild(createModalItemElement(item, true, assignmentOrId, { localSelected, render, currentResources }));
                }
            });
            
            // Render search results
            const [nameIndex, idIndex] = ['Name', idKey].map(h => currentResources.headers.indexOf(h));
            const availableItems = currentResources.rows.filter(row => {
                const name = (row[nameIndex] || '').toLowerCase();
                const id = (row[idIndex] || '').toLowerCase();
                return name.includes(searchTerm) || id.includes(searchTerm);
            });

            availableItems.forEach(item => {
                 // FIX: Pass the fresh `currentResources` data to the element creator function.
                 searchResultsContainer.appendChild(createModalItemElement(item, false, null, { localSelected, render, currentResources }));
            });
        };

        searchInput.value = '';
        searchInput.oninput = render;

        elements.saveAssignedResourceBtn.onclick = async () => {
             // For complex types like staff, update state from inputs before saving
            if (isComplex && config.updateStateBeforeSave) {
                config.updateStateBeforeSave(selectedContainer, localSelected);
            }

            const statusSpan = elements.assignResourceStatus;
            statusSpan.textContent = 'Saving...';
            try {
                const dataToSave = formatForSave(localSelected);
                await updateSheetRow('Projects', 'ProjectID', projectId, { [projectSheetColumn]: dataToSave });
                statusSpan.textContent = 'Saved!';
                await refreshData();
                setTimeout(() => {
                    elements.assignResourceModal.style.display = 'none';
                }, 1000);
            } catch (err) {
                statusSpan.textContent = 'Error saving.';
                console.error(`Error assigning ${resourceType}:`, err);
            }
        };

        render();
        elements.assignResourceModal.style.display = 'block';
    }

    return { renderAssignedSection, showAssignModal };
}
