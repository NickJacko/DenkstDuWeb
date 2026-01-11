/**
 * 404 Page JavaScript
 * Version 2.0 - Enhanced Accessibility & CSP-Compliant
 *
 * Features:
 * - Back button navigation with history fallback
 * - ESC key shortcut to home
 * - Focus management for accessibility
 * - ARIA live announcements
 */

(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', function() {
        const backButton = document.getElementById('back-button');
        const errorMessage = document.querySelector('.error-message');

        // ===================================
        // ✅ P1 UI/UX: Back Button Navigation
        // ===================================
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

            // ✅ P1 UI/UX: Auto-focus on back button for keyboard users
            // Wait for page load to prevent scroll jump
            setTimeout(() => {
                backButton.focus();
            }, 100);
        }

        // ===================================
        // ✅ P1 UI/UX: ESC Key Navigation
        // ===================================
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                event.preventDefault();

                // ✅ Announce navigation to screen readers
                if (errorMessage && errorMessage.hasAttribute('aria-live')) {
                    errorMessage.textContent = 'Navigation zur Startseite...';
                }

                // Navigate after brief delay for screen reader announcement
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 200);
            }
        });

        // ===================================
        // ✅ P2 PERFORMANCE: Reduce Animations
        // ===================================
        // Check if user prefers reduced motion
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
            // Disable particle animations
            const particles = document.querySelectorAll('.particle');
            particles.forEach(particle => {
                particle.style.animation = 'none';
                particle.style.opacity = '0.3'; // Keep visible but static
            });
        }

        // ===================================
        // ✅ P1 UI/UX: ARIA Announcement
        // ===================================
        // Announce error to screen readers on load
        if (errorMessage) {
            // Trigger aria-live announcement by updating content
            const originalText = errorMessage.textContent;
            errorMessage.textContent = '';
            setTimeout(() => {
                errorMessage.textContent = originalText;
            }, 100);
        }
    });
})();

