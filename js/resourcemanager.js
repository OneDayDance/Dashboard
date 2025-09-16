// js/resourceManager.js
// Description: A generic manager for handling inventory-like resources (Costumes, Equipment, Staff).

import { state, updateState } from './state.js';
import { updateSheetRow, writeData, uploadImageToDrive, clearSheetRow } from './api.js';
import { showDeleteConfirmationModal } from './ui.js';
import { showToast, hideToast } from './toast.js';
import { extractFileIdFromUrl, safeSetValue } from './utils.js';

/**
 * A simple pluralization helper for UI labels.
 * @param {string} word - The word to pluralize.
 * @returns {string} - The pluralized word.
 */
function pluralize(word) {
    if (word.endsWith('y')) {
        return word.slice(0, -1) + 'ies';
    }
    if (word.endsWith('s')) {
        return word + 'es';
    }
    return word + 's';
}

/**
 * Creates a resource manager instance with a specific configuration.
 * @param {object} config - The configuration object for the resource.
 * @returns {object} An object with init and render methods.
 */
export function createResourceManager(config) {
    let refreshData;

    // --- HELPERS ---
    const getElement = (suffix) => document.getElementById(`${config.name}-${suffix}`);
    const getRequiredElement = (suffix) => {
        const el = getElement(suffix);
        if (!el) throw new Error(`Required element not found: ${config.name}-${suffix}`);
        return el;
    };

    // --- EVENT HANDLERS ---
    function init(refreshDataFn) {
        refreshData = refreshDataFn;
        
        getRequiredElement('add-btn').onclick = () => showModal(null);
        getRequiredElement('search-bar').oninput = (e) => {
            const currentFilters = state[config.stateFilterKey] || {};
            updateState({ [config.stateFilterKey]: { ...currentFilters, searchTerm: e.target.value.toLowerCase() } });
            render();
        };
        getRequiredElement('modal-form').addEventListener('submit', handleFormSubmit);

        config.filters.forEach(filter => {
            const filterElement = document.getElementById(filter.uiId);
            if (filterElement) {
                filterElement.oninput = (e) => {
                    const currentFilters = state[config.stateFilterKey] || {};
                    updateState({ [config.stateFilterKey]: { ...currentFilters, [filter.stateKey]: e.target.value.toLowerCase() } });
                    render();
                };
            }
        });
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        let toast = showToast('Saving...', -1, 'info');

        const imageFile = getRequiredElement('image-upload').files[0];
        let imageUrl = getRequiredElement('image-url').value;

        try {
            if (imageFile) {
                hideToast(toast);
                toast = showToast('Uploading image...', -1, 'info');
                const uploadResult = await uploadImageToDrive(imageFile);
                imageUrl = uploadResult.link;
                hideToast(toast);
                toast = showToast('Saving details...', -1, 'info');
            }

            const itemId = getRequiredElement('id-input').value;
            const itemData = { 'Image URL': imageUrl };
            config.formFields.forEach(field => {
                const input = getElement(field.id);
                if (input) {
                    itemData[field.sheetColumn] = input.value;
                }
            });

            const sheetPromise = itemId 
                ? updateSheetRow(config.sheetName, `${config.resourceName}ID`, itemId, itemData)
                : writeData(config.sheetName, { ...itemData, [`${config.resourceName}ID`]: `${config.idPrefix}${Date.now()}` });
            
            await sheetPromise; 
            hideToast(toast);
            showToast(`${config.resourceName} saved successfully!`, 3000, 'success');

            await refreshData();

            setTimeout(() => {
                getRequiredElement('modal').style.display = 'none';
            }, 1500);

        } catch (err) {
            hideToast(toast);
            showToast(`Error: ${err.message}`, 5000, 'error');
            console.error(`${config.resourceName} save error:`, err);
        }
    }

    // --- RENDERING ---
    function render() {
        renderCards();
        if (config.filters.length > 0) {
            updateFilterDropdowns();
        }
    }

    function renderCards() {
        const container = getRequiredElement('container');
        container.innerHTML = '';
        const { rows } = config.stateData();

        if (!rows) {
            container.innerHTML = `<p>${config.resourceName} data is not available.</p>`;
            return;
        }
        
        const processedRows = getProcessedData();

        if (processedRows.length === 0) {
            container.innerHTML = `
                <div class="empty-state-container">
                    <h3>No ${pluralize(config.resourceName)} Found</h3>
                    <p>To get started, add a new ${config.name} using the button above. If you have data in your sheet that isn't appearing, check the filter settings.</p>
                </div>`;
            return;
        }
        
        const { headers } = config.stateData();
        const cardContainer = document.createElement('div');
        cardContainer.className = 'card-container';

        const [nameIndex, imageIndex] = ['Name', 'Image URL'].map(h => headers.indexOf(h));

        processedRows.forEach(row => {
            const card = document.createElement('div');
            card.className = 'info-card inventory-card';
            card.onclick = () => showModal(row);

            const imageDiv = document.createElement('div');
            imageDiv.className = 'inventory-card-image';
            
            const fileId = extractFileIdFromUrl(row[imageIndex] || '');

            if (fileId) {
                const img = document.createElement('img');
                img.alt = row[nameIndex] || `${config.resourceName} image`;
                img.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w300`;
                img.onerror = () => { 
                    imageDiv.classList.add('no-image');
                    imageDiv.textContent = 'Image Error';
                    img.remove();
                };
                imageDiv.appendChild(img);
            } else {
                imageDiv.classList.add('no-image');
                imageDiv.textContent = 'No Image';
            }
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'inventory-card-content';
            contentDiv.innerHTML = config.cardRenderer(row, headers);

            card.appendChild(imageDiv);
            card.appendChild(contentDiv);
            cardContainer.appendChild(card);
        });

        container.appendChild(cardContainer);
    }

    function getProcessedData() {
        const { headers, rows } = config.stateData();
        if (!rows) return [];
        let processedRows = [...rows];
        const currentFilters = state[config.stateFilterKey] || {};

        if (currentFilters.searchTerm) {
            processedRows = processedRows.filter(row => row.some(cell => String(cell).toLowerCase().includes(currentFilters.searchTerm)));
        }
        
        config.filters.forEach(filter => {
            const filterValue = currentFilters[filter.stateKey];
            if (filterValue && filterValue !== 'all') {
                const columnIndex = headers.indexOf(filter.sheetColumn);
                if (columnIndex > -1) {
                    processedRows = processedRows.filter(row => (row[columnIndex] || '').toLowerCase().includes(filterValue));
                }
            }
        });

        return processedRows;
    }

    function updateFilterDropdowns() {
        const { headers, rows } = config.stateData();
        if (!rows) return;
        
        config.filters.forEach(filter => {
            const filterElement = document.getElementById(filter.uiId);
            if (filterElement && filterElement.tagName === 'SELECT') {
                const columnIndex = headers.indexOf(filter.sheetColumn);
                if (columnIndex === -1) return;

                const uniqueValues = [...new Set(rows.map(row => row[columnIndex]).filter(Boolean))];
                const currentValue = filterElement.value;
                filterElement.innerHTML = `<option value="all">All ${pluralize(filter.sheetColumn)}</option>`;
                uniqueValues.sort().forEach(value => {
                    const option = document.createElement('option');
                    option.value = value.toLowerCase();
                    option.textContent = value;
                    filterElement.appendChild(option);
                });
                filterElement.value = currentValue;
            }
        });
    }

    // --- MODAL & FORM HANDLING ---
    function showModal(rowData = null) {
        const modal = getRequiredElement('modal');
        const form = getRequiredElement('modal-form');
        form.reset();
        
        getRequiredElement('modal-status').textContent = '';
        const imagePreview = getRequiredElement('image-preview');
        const imageUploadInput = getRequiredElement('image-upload');
        const changePhotoButton = getRequiredElement('change-photo-btn');
        const deleteButton = getRequiredElement('delete-btn');

        imagePreview.src = '';
        imagePreview.style.display = 'none';
        imageUploadInput.value = '';
        safeSetValue(`${config.name}-image-url`, '');
        
        changePhotoButton.onclick = () => imageUploadInput.click();
        imageUploadInput.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.src = e.target.result;
                    imagePreview.style.display = 'block';
                    changePhotoButton.textContent = 'Change Photo';
                };
                reader.readAsDataURL(file);
            }
        };
        
        if (rowData) {
            getElement('modal-title').textContent = `Edit ${config.resourceName}`;
            const { headers } = config.stateData();
            const itemId = rowData[headers.indexOf(`${config.resourceName}ID`)] || '';
            
            safeSetValue(`${config.name}-id-input`, itemId);
            config.formFields.forEach(field => {
                safeSetValue(`${config.name}-${field.id}`, rowData[headers.indexOf(field.sheetColumn)] || '');
            });
            
            const imageUrlFromSheet = rowData[headers.indexOf('Image URL')] || '';
            safeSetValue(`${config.name}-image-url`, imageUrlFromSheet);
            const fileId = extractFileIdFromUrl(imageUrlFromSheet);

            if (fileId) {
                imagePreview.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w300`;
                imagePreview.style.display = 'block';
                changePhotoButton.textContent = 'Change Photo';
            } else {
                changePhotoButton.textContent = 'Add Photo';
            }

            deleteButton.style.display = 'block';
            deleteButton.onclick = () => {
                modal.style.display = 'none';
                const itemName = rowData[headers.indexOf('Name')] || `this ${config.name}`;
                showDeleteConfirmationModal(
                    `Delete ${config.resourceName}: ${itemName}`,
                    'This action is permanent and cannot be undone.',
                    async () => {
                        await clearSheetRow(config.sheetName, `${config.resourceName}ID`, itemId);
                        await refreshData();
                    }
                );
            };
        } else {
            getElement('modal-title').textContent = `Add New ${config.resourceName}`;
            safeSetValue(`${config.name}-id-input`, '');
            // Set default date if applicable
            const dateField = config.formFields.find(f => f.type === 'date');
            if (dateField) {
                safeSetValue(`${config.name}-${dateField.id}`, new Date().toISOString().split('T')[0]);
            }
            changePhotoButton.textContent = 'Add Photo';
            deleteButton.style.display = 'none';
        }

        modal.style.display = 'block';
    }

    return { init, render };
}

