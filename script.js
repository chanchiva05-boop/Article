/**
 * TEVA Copy Text Function
 * Main function to copy text to clipboard
 */
function copyText() {
    console.log("Copy button clicked!");
    
    // Get the text to copy
    const textToCopy = document.getElementById("textToCopy").textContent;
    console.log("Text to copy:", textToCopy);
    
    // Try using Clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                console.log("Text copied successfully using Clipboard API");
                showSuccess();
            })
            .catch(err => {
                console.error("Clipboard API failed:", err);
                // Fallback to execCommand
                fallbackCopyText(textToCopy);
            });
    } else {
        // Use fallback method
        console.log("Using fallback copy method");
        fallbackCopyText(textToCopy);
    }
}

/**
 * Fallback copy method using execCommand
 * @param {string} text - The text to copy
 */
function fallbackCopyText(text) {
    console.log("Attempting fallback copy...");
    
    // Create a temporary textarea element
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Make the textarea invisible
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    textArea.style.opacity = "0";
    
    // Add to document
    document.body.appendChild(textArea);
    
    // Select and copy
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            console.log("Fallback copy successful");
            showSuccess();
        } else {
            console.error("Fallback copy failed");
            showError();
        }
    } catch (err) {
        console.error("Fallback copy error:", err);
        showError();
    } finally {
        // Clean up
        document.body.removeChild(textArea);
    }
}

/**
 * Show success notification
 */
function showSuccess() {
    console.log("Showing success notification");
    
    // Play sound if available
    const clickSound = document.getElementById("clickSound");
    if (clickSound) {
        clickSound.currentTime = 0;
        clickSound.play().catch(err => {
            console.log("Audio playback failed:", err);
        });
    } else {
        console.log("Audio element not found");
    }
    
    // Show toast notification
    const toast = document.getElementById("toast");
    if (toast) {
        toast.style.display = "block";
        
        // Hide after 1.8 seconds
        setTimeout(() => {
            toast.style.display = "none";
        }, 1800);
    } else {
        console.log("Toast element not found");
    }
}

/**
 * Show error notification
 */
function showError() {
    console.log("Showing error notification");
    
    // Show alert as fallback
    alert("មិនអាច copy អត្ថបទបានទេ។ សូមព្យាយាមម្តងទៀត។\n\nCannot copy text. Please try again.");
}

/**
 * Initialize the application
 */
function initApp() {
    console.log("TEVA App Initializing...");
    
    // Make copyText function available globally
    window.copyText = copyText;
    
    // Check if elements exist
    const button = document.querySelector('button');
    const textElement = document.getElementById('textToCopy');
    const toast = document.getElementById('toast');
    
    if (!button) console.error("Button not found!");
    if (!textElement) console.error("Text to copy element not found!");
    if (!toast) console.error("Toast element not found!");
    
    console.log("Button found:", !!button);
    console.log("Text element found:", !!textElement);
    console.log("Toast element found:", !!toast);
    
    // Add some visual feedback when page loads
    document.body.style.opacity = '1';
    
    console.log("TEVA App Initialized Successfully!");
}

// Initialize when DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}