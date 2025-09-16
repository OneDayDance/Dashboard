// js/toast.js
// Description: Handles creating and managing toast notifications.

// Create a container for toasts and append it to the body
const toastContainer = document.createElement('div');
toastContainer.id = 'toast-container';
document.body.appendChild(toastContainer);

let currentToast = null;

/**
 * Shows a toast message. A new toast will replace the one currently visible.
 * @param {string} message - The message to display.
 * @param {number} [duration=3000] - How long to show the toast in ms. Use -1 for an indefinite toast that must be hidden manually.
 * @param {string} [type='info'] - The type of toast: 'info', 'success', or 'error'.
 * @returns {HTMLElement} The created toast element, which can be passed to hideToast.
 */
export function showToast(message, duration = 3000, type = 'info') {
    // If a toast is already showing, hide it before showing the new one
    if (currentToast) {
        hideToast(currentToast);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);
    
    // A small delay is necessary to allow the browser to render the element before adding the class that triggers the transition.
    setTimeout(() => {
        toast.classList.add('show');
    }, 10); 

    currentToast = toast;

    // Set a timeout to automatically hide the toast unless the duration is indefinite (-1)
    if (duration !== -1) {
        setTimeout(() => {
            hideToast(toast);
        }, duration);
    }
    
    return toast;
}

/**
 * Hides a specific toast element.
 * @param {HTMLElement} [toast] - The toast element to hide. If null, it hides the currently active toast.
 */
export function hideToast(toast) {
    const toastToHide = toast || currentToast;
    if (toastToHide && toastToHide.parentElement) {
        toastToHide.classList.remove('show');
        // Wait for the transition to finish before removing the element from the DOM
        toastToHide.addEventListener('transitionend', () => {
            if (toastToHide.parentElement) {
                toastToHide.parentElement.removeChild(toastToHide);
            }
        }, { once: true });
    }
    
    // If we are hiding the currently active toast, clear the reference to it.
    if (toastToHide === currentToast) {
        currentToast = null;
    }
}
