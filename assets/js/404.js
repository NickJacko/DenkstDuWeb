/**
 * 404 Page JavaScript
 * Version 1.0 - CSP-Compliant
 *
 * Handles back button navigation with fallback to home
 */

document.addEventListener('DOMContentLoaded', function() {
    const backButton = document.getElementById('back-button');

    if (backButton) {
        backButton.addEventListener('click', function() {
            // If browser has history, go back
            if (window.history.length > 1) {
                window.history.back();
            } else {
                // Fallback to home if no history
                window.location.href = '/index.html';
            }
        });
    }

    // Optional: Add keyboard navigation (ESC to go home)
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            window.location.href = '/index.html';
        }
    });
});

