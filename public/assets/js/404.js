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
            const onBackClick = () => {
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.location.href = '/index.html';
                }
            };
            backButton.addEventListener('click', onBackClick);


            // ✅ P1 UI/UX: Auto-focus on back button for keyboard users
            // Wait for page load to prevent scroll jump
            setTimeout(() => {
                backButton.focus();
            }, 100);
        }

        // ===================================
        // ✅ P1 UI/UX: ESC Key Navigation
        // ===================================
        const onKeyDown = (event) => {
            if (event.key !== 'Escape') return;

            event.preventDefault();

            // Announce navigation to screen readers
            if (errorMessage && errorMessage.hasAttribute('aria-live')) {
                errorMessage.textContent = 'Navigation zur Startseite...';
            }

            setTimeout(() => {
                window.location.href = '/index.html';
            }, 200);
        };
        document.addEventListener('keydown', onKeyDown);


        // ===================================
        // ✅ P2 PERFORMANCE: Reduce Animations
        // ===================================
        // Check if user prefers reduced motion
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
            document.documentElement.classList.add('reduced-motion');
        }

        // ===================================
        // ✅ P1 UI/UX: ARIA Announcement
        // ===================================
        // Announce error to screen readers on load
        if (errorMessage && errorMessage.hasAttribute('aria-live')) {
            // Trigger aria-live announcement by updating content
            const originalText = errorMessage.textContent;
            errorMessage.textContent = '';
            setTimeout(() => {
                errorMessage.textContent = originalText;
            }, 100);
        }
    });
})();

