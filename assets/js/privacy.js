// No-Cap - Privacy & GDPR Compliance
// Version 2.0 - Audit-Fixed & Security Hardened

(function(window) {
    'use strict';

    // P1 FIX: Environment detection
    const isDevelopment = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('192.168.');
    const PRIVACY_CONTACT_EMAIL = 'Nickjacklin99@web.de';
    // ============================================================================
    // 🎯 P1 STABILITY: EVENT LISTENER REGISTRY
    // ============================================================================

    /**
     * ✅ P1 STABILITY: Central event listener registry
     * Prevents memory leaks by tracking and cleaning up event listeners
     */
    const eventListenerRegistry = {
        listeners: [],

        /**
         * Register an event listener
         * @param {EventTarget} element - Target element
         * @param {string} event - Event type
         * @param {Function} handler - Event handler
         * @param {Object} options - Event listener options
         */
        add(element, event, handler, options = {}) {
            if (!element || !event || !handler) {
                console.warn('Invalid event listener parameters');
                return;
            }

            element.addEventListener(event, handler, options);
            this.listeners.push({ element, event, handler, options });

            if (isDevelopment) {
                console.log(`📌 Registered listener: ${event} on`, element);
            }
        },

        /**
         * Remove all registered event listeners
         */
        removeAll() {
            this.listeners.forEach(({ element, event, handler, options }) => {
                try {
                    element.removeEventListener(event, handler, options);
                } catch (error) {
                    console.warn('Error removing event listener:', error);
                }
            });

            const count = this.listeners.length;
            this.listeners = [];

            if (isDevelopment) {
                console.log(`🧹 Cleaned up ${count} event listeners`);
            }
        },

        /**
         * Remove specific event listener
         * @param {EventTarget} element - Target element
         * @param {string} event - Event type
         */
        remove(element, event) {
            this.listeners = this.listeners.filter(listener => {
                if (listener.element === element && listener.event === event) {
                    element.removeEventListener(event, listener.handler, listener.options);
                    return false;
                }
                return true;
            });
        }
    };

    // ============================================================================
    // 🛡️ P0 SECURITY: SANITIZATION HELPERS
    // ============================================================================

    /**
     * ✅ P0 SECURITY: Sanitize data from localStorage before use
     * @param {*} value - Value to sanitize
     * @returns {string} Sanitized string
     */
    function sanitizeStorageValue(value) {
        if (value === null || value === undefined) {
            return '';
        }

        const str = String(value);

        // Use DOMPurify if available
        if (typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(str, {
                ALLOWED_TAGS: [],
                ALLOWED_ATTR: [],
                KEEP_CONTENT: true
            });
        }

        // Fallback: Basic XSS prevention
        return str
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .trim()
            .substring(0, 500);
    }

    /**
     * ✅ P0 SECURITY: Safe textContent setter
     * @param {HTMLElement} element - Target element
     * @param {string} text - Text to set
     */
    function setTextContent(element, text) {
        if (!element) return;
        element.textContent = sanitizeStorageValue(text);
    }

    // ============================================================================
    // PRIVACY CONSENT MANAGEMENT
    // ============================================================================

    /**
     * P0 FIX: Check if user has given privacy consent
     */
    function hasPrivacyConsent() {
        try {
            const c = window.NocapCookies?.getConsent?.();
            return !!c; // Consent vorhanden => privacy ok
        } catch (e) {
            return false;
        }
    }

    /**
     * P1 FIX: Show privacy consent modal (safe DOM creation)
     */
    function showPrivacyConsent() {
        // Check if modal already exists
        if (document.getElementById('privacy-modal')) {
            return;
        }

        // P0 FIX: Create modal safely without innerHTML
        const modal = document.createElement('div');
        modal.id = 'privacy-modal';
        modal.className = 'privacy-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', 'privacy-modal-title');
        modal.setAttribute('aria-modal', 'true');

        const modalContent = document.createElement('div');
        modalContent.className = 'privacy-modal-content';

        // Title
        const title = document.createElement('h3');
        title.id = 'privacy-modal-title';
        title.textContent = '🔒 Datenschutz & Cookies';

        // Description
        const description = document.createElement('p');
        description.textContent = 'Wir verwenden nur technisch notwendige Daten für das Multiplayer-Spiel. Keine Werbung, kein Tracking. Alle Daten werden nach 24h automatisch gelöscht.';

        // Info list
        const infoList = document.createElement('ul');
        infoList.className = 'privacy-info-list';

        const infoItems = [
            '✅ Nur notwendige Daten für Spielfunktionalität',
            '✅ Automatische Löschung nach 24 Stunden',
            '✅ Keine Werbung oder Tracking',
            '✅ Jederzeit widerrufbar'
        ];

        infoItems.forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            infoList.appendChild(li);
        });

        // Privacy link
        const linkContainer = document.createElement('div');
        linkContainer.className = 'privacy-link';

        const link = document.createElement('a');
        link.href = 'privacy.html';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = '→ Vollständige Datenschutzerklärung';

        linkContainer.appendChild(link);

        // Buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'privacy-buttons';

        const declineBtn = window.NocapUtils
            ? window.NocapUtils.createButton('Ablehnen', () => declinePrivacy(), 'btn btn-outline')
            : createSimpleButton('Ablehnen', () => declinePrivacy(), 'btn btn-outline');

        const acceptBtn = window.NocapUtils
            ? window.NocapUtils.createButton('Akzeptieren', () => acceptPrivacy(), 'btn btn-primary')
            : createSimpleButton('Akzeptieren', () => acceptPrivacy(), 'btn btn-primary');

        buttonContainer.appendChild(declineBtn);
        buttonContainer.appendChild(acceptBtn);

        // Assemble modal
        modalContent.appendChild(title);
        modalContent.appendChild(description);
        modalContent.appendChild(infoList);
        modalContent.appendChild(linkContainer);
        modalContent.appendChild(buttonContainer);
        modal.appendChild(modalContent);

        document.body.appendChild(modal);

        // Show with animation
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });

        // P1 FIX: Trap focus in modal
        if (window.NocapUtils && window.NocapUtils.trapFocus) {
            window.NocapUtils.trapFocus(modalContent);
        } else {
            // Fallback: Basic focus trap
            setupModalFocusTrap(modalContent);
        }

        // ✅ P1 UI/UX: Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closePrivacyModal();
            }
        };
        eventListenerRegistry.add(document, 'keydown', escapeHandler);

        // ✅ P1 UI/UX: Focus first interactive element
        requestAnimationFrame(() => {
            const firstButton = modalContent.querySelector('button, a');
            if (firstButton) {
                firstButton.focus();
            }
        });
    }

    /**
     * ✅ P1 UI/UX: Basic modal focus trap fallback
     * @param {HTMLElement} modalContent - Modal content element
     */
    function setupModalFocusTrap(modalContent) {
        const focusableElements = modalContent.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        const trapHandler = (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        eventListenerRegistry.add(modalContent, 'keydown', trapHandler);
    }

    /**
     * P0 FIX: Simple button helper (fallback)
     */
    function createSimpleButton(text, onClick, className) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = text;
        button.addEventListener('click', onClick);
        return button;
    }

    /**
     * P1 FIX: Accept privacy consent with validation
     */
    function acceptPrivacy() {
        try {
            const consentData = {
                accepted: true,
                date: new Date().toISOString(),
                version: '1.0',
                userAgent: navigator.userAgent.substring(0, 100), // Truncated
                language: navigator.language
            };

            // P0 FIX: Use safe storage helper
            if (window.NocapUtils) {
                window.NocapUtils.setLocalStorage('nocap_privacy_consent', 'true');
                window.NocapUtils.setLocalStorage('nocap_privacy_date', consentData.date);
                window.NocapUtils.setLocalStorage('nocap_privacy_version', consentData.version);
            } else {
                localStorage.setItem('nocap_privacy_consent', 'true');
                localStorage.setItem('nocap_privacy_date', consentData.date);
                localStorage.setItem('nocap_privacy_version', consentData.version);
            }

            // Hide modal
            closePrivacyModal();

            // P1 FIX: Show success notification
            if (window.NocapUtils) {
                window.NocapUtils.showNotification(
                    'Datenschutz akzeptiert! Multiplayer-Features sind nun verfügbar.',
                    'success',
                    3000
                );
            }

            // Enable multiplayer features
            enableMultiplayerFeatures();

            // P1 FIX: Dispatch custom event
            window.dispatchEvent(new CustomEvent('nocap:privacyAccepted', {
                detail: { timestamp: consentData.date }
            }));

            if (isDevelopment) {
                console.log('✅ Privacy consent accepted');
            }

        } catch (error) {
            console.error('❌ Error accepting privacy consent:', error);
        }
    }

    /**
     * P1 FIX: Decline privacy consent
     */
    function declinePrivacy() {
        try {
            // P0 FIX: Use safe storage
            if (window.NocapUtils) {
                window.NocapUtils.setLocalStorage('nocap_privacy_declined', 'true');
                window.NocapUtils.setLocalStorage('nocap_privacy_decline_date', new Date().toISOString());
            } else {
                localStorage.setItem('nocap_privacy_declined', 'true');
                localStorage.setItem('nocap_privacy_decline_date', new Date().toISOString());
            }

            // Hide modal
            closePrivacyModal();

            // P1 FIX: Show info notification
            if (window.NocapUtils) {
                window.NocapUtils.showNotification(
                    'Ohne Datenschutz-Zustimmung sind nur lokale Spiele möglich.',
                    'warning',
                    5000
                );
            }

            // Disable multiplayer features
            disableMultiplayerFeatures();

            // P1 FIX: Dispatch custom event
            window.dispatchEvent(new CustomEvent('nocap:privacyDeclined'));

            if (isDevelopment) {
                console.log('ℹ️ Privacy consent declined');
            }

        } catch (error) {
            console.error('❌ Error declining privacy consent:', error);
        }
    }

    /**
     * P1 FIX: Revoke privacy consent
     */
    function revokePrivacyConsent() {
        if (!confirm('Datenschutz-Zustimmung wirklich widerrufen? Multiplayer-Features werden deaktiviert und alle gespeicherten Daten gelöscht.')) {
            return;
        }

        revokePrivacyConsentSilent();

        // P1 FIX: Show confirmation
        if (window.NocapUtils) {
            window.NocapUtils.showNotification(
                'Datenschutz-Zustimmung widerrufen und Daten gelöscht.',
                'success',
                3000
            );
        }

        // Redirect to home if on multiplayer page
        if (window.location.pathname.includes('multiplayer') ||
            window.location.pathname.includes('join-game')) {
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        }
    }

    /**
     * P1 FIX: Silent revocation (no confirmation)
     */
    function revokePrivacyConsentSilent() {
        try {
            // Remove consent
            const keysToRemove = [
                'nocap_privacy_consent',
                'nocap_privacy_date',
                'nocap_privacy_version',
                'nocap_privacy_declined',
                'nocap_privacy_decline_date'
            ];

            keysToRemove.forEach(key => {
                if (window.NocapUtils) {
                    window.NocapUtils.removeLocalStorage(key);
                } else {
                    localStorage.removeItem(key);
                }
            });

            // Clear all game data
            clearAllGameData();

            // Disable multiplayer
            disableMultiplayerFeatures();

            // P1 FIX: Dispatch event
            window.dispatchEvent(new CustomEvent('nocap:privacyRevoked'));

            if (isDevelopment) {
                console.log('ℹ️ Privacy consent revoked');
            }

        } catch (error) {
            console.error('❌ Error revoking privacy consent:', error);
        }
    }

    /**
     * P1 FIX: Close privacy modal
     */
    function closePrivacyModal() {
        const modal = document.getElementById('privacy-modal');
        if (!modal) return;

        // ✅ P0: Listener/Fokus-Traps sauber entfernen (Leak verhindern)
        eventListenerRegistry.removeAll();

        modal.classList.remove('show');
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 300);
    }

    // ============================================================================
    // MULTIPLAYER FEATURE MANAGEMENT
    // ============================================================================

    /**
     * P1 FIX: Enable multiplayer features
     */
    function enableMultiplayerFeatures() {
        // Remove disabled state
        document.querySelectorAll('[data-requires-privacy]').forEach(element => {
            element.disabled = false;
            element.classList.remove('privacy-disabled');
            element.removeAttribute('title');
        });

        // Show multiplayer options
        document.querySelectorAll('.multiplayer-feature').forEach(element => {
            // ✅ CSP-FIX: Use CSS class instead of inline style
            element.classList.remove('hidden');
        });

        // Add body class
        document.body.classList.add('privacy-accepted');
        document.body.classList.remove('privacy-required');

        if (isDevelopment) {
            console.log('✅ Multiplayer features enabled');
        }
    }

    /**
     * P1 FIX: Disable multiplayer features
     */
    function disableMultiplayerFeatures() {
        // Disable buttons
        document.querySelectorAll('[data-requires-privacy]').forEach(element => {
            element.disabled = true;
            element.classList.add('privacy-disabled');
            element.setAttribute('title', 'Erfordert Datenschutz-Zustimmung');
        });

        // Hide multiplayer options
        document.querySelectorAll('.multiplayer-feature').forEach(element => {
            // ✅ CSP-FIX: Use CSS class instead of inline style
            element.classList.add('hidden');
        });

        // Add body class
        document.body.classList.add('privacy-required');
        document.body.classList.remove('privacy-accepted');

        // Disconnect Firebase if connected
        if (window.firebaseGameService && window.firebaseGameService.isConnected) {
            window.firebaseGameService.cleanup();
        }

        if (isDevelopment) {
            console.log('ℹ️ Multiplayer features disabled');
        }
    }

    // ============================================================================
    // 📋 P1 UI/UX: TABLE OF CONTENTS & NAVIGATION
    // ============================================================================

    /**
     * ✅ P1 UI/UX: Generate and insert Table of Contents
     */
    function generateTableOfContents() {
        try {
            // Find main content container
            const mainContent = document.querySelector('main') || document.querySelector('.privacy-content');
            if (!mainContent) {
                if (isDevelopment) {
                    console.warn('No main content found for TOC generation');
                }
                return;
            }

            // Find all section headings (h2)
            const headings = mainContent.querySelectorAll('h2');
            if (headings.length === 0) {
                if (isDevelopment) {
                    console.warn('No h2 headings found for TOC');
                }
                return;
            }

            // Create TOC container
            const tocContainer = document.createElement('nav');
            tocContainer.id = 'privacy-toc';
            tocContainer.className = 'privacy-toc';
            tocContainer.setAttribute('aria-label', 'Inhaltsverzeichnis');

            // TOC Title
            const tocTitle = document.createElement('h2');
            tocTitle.className = 'toc-title';
            tocTitle.textContent = '📋 Inhaltsverzeichnis';

            // TOC List
            const tocList = document.createElement('ol');
            tocList.className = 'toc-list';

            // Generate TOC items
            headings.forEach((heading, index) => {
                // Create unique ID for heading if not exists
                if (!heading.id) {
                    const headingText = heading.textContent.trim();
                    const id = 'section-' + headingText
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '');
                    heading.id = id || `section-${index}`;
                }

                // Create TOC item
                const listItem = document.createElement('li');
                listItem.className = 'toc-item';

                const link = document.createElement('a');
                link.href = `#${heading.id}`;
                link.className = 'toc-link';

                // ✅ P0 SECURITY: Use textContent
                setTextContent(link, heading.textContent.trim());

                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    smoothScrollToSection(heading.id);

                    // Update active state
                    document.querySelectorAll('.toc-link').forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                });

                listItem.appendChild(link);
                tocList.appendChild(listItem);
            });

            // Assemble TOC
            tocContainer.appendChild(tocTitle);
            tocContainer.appendChild(tocList);

            // Insert TOC before first heading or at beginning of main
            const firstHeading = mainContent.querySelector('h1, h2');
            if (firstHeading) {
                mainContent.insertBefore(tocContainer, firstHeading);
            } else {
                mainContent.insertBefore(tocContainer, mainContent.firstChild);
            }

            // Add scroll spy
            setupScrollSpy(headings);

            if (isDevelopment) {
                console.log(`✅ TOC generated with ${headings.length} sections`);
            }

        } catch (error) {
            console.error('❌ Error generating TOC:', error);
        }
    }

    /**
     * ✅ P1 UI/UX: Smooth scroll to section with accessibility
     * @param {string} sectionId - ID of target section
     */
    function smoothScrollToSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (!section) return;

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        section.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'start'
        });

        // Focus section for screen readers
        section.setAttribute('tabindex', '-1');
        section.focus();

        // Update URL hash without jumping
        if (history.pushState) {
            history.pushState(null, null, `#${sectionId}`);
        }
    }

    /**
     * ✅ P1 UI/UX: Scroll spy for TOC active states
     * @param {NodeList} headings - Section headings
     */
    function setupScrollSpy(headings) {
        if (!('IntersectionObserver' in window)) {
            return; // Graceful degradation
        }

        const observerOptions = {
            rootMargin: '-20% 0px -70% 0px',
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;

                    // Update active TOC link
                    document.querySelectorAll('.toc-link').forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === `#${id}`) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        }, observerOptions);

        headings.forEach(heading => observer.observe(heading));

        if (isDevelopment) {
            console.log('✅ Scroll spy initialized');
        }
    }

    /**
     * ✅ P1 UI/UX: Make sections collapsible
     */
    function makeCollapsibleSections() {
        try {
            const mainContent = document.querySelector('main') || document.querySelector('.privacy-content');
            if (!mainContent) return;

            const sections = mainContent.querySelectorAll('section, .privacy-section');

            sections.forEach((section, index) => {
                const heading = section.querySelector('h2, h3');
                if (!heading) return;

                // Skip TOC
                if (section.id === 'privacy-toc' || section.classList.contains('privacy-toc')) {
                    return;
                }

                // Create wrapper for collapsible content
                const content = document.createElement('div');
                content.className = 'collapsible-content';
                content.setAttribute('id', `collapsible-${index}`);
                content.setAttribute('aria-hidden', 'false');

                // Move all content after heading into wrapper
                const elementsToMove = [];
                let sibling = heading.nextElementSibling;
                while (sibling) {
                    elementsToMove.push(sibling);
                    sibling = sibling.nextElementSibling;
                }

                elementsToMove.forEach(el => {
                    content.appendChild(el);
                });

                section.appendChild(content);

                // Make heading clickable
                heading.classList.add('collapsible-heading');
                heading.setAttribute('role', 'button');
                heading.setAttribute('aria-expanded', 'true');
                heading.setAttribute('aria-controls', `collapsible-${index}`);
                heading.setAttribute('tabindex', '0');

                // Add toggle icon
                const icon = document.createElement('span');
                icon.className = 'collapse-icon';
                icon.setAttribute('aria-hidden', 'true');
                icon.textContent = '▼';
                heading.appendChild(icon);

                const toggleSection = () => {
                    const isExpanded = heading.getAttribute('aria-expanded') === 'true';

                    heading.setAttribute('aria-expanded', String(!isExpanded));
                    content.setAttribute('aria-hidden', String(isExpanded));

                    section.classList.toggle('is-collapsed', isExpanded);
                    heading.classList.toggle('collapsed', isExpanded);
                    icon.textContent = isExpanded ? '▶' : '▼';
                };
                section.classList.remove('is-collapsed');
                // Event listeners
                eventListenerRegistry.add(heading, 'click', toggleSection);

                eventListenerRegistry.add(heading, 'keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSection();
                    }
                });

            });

            if (isDevelopment) {
                console.log(`✅ Made ${sections.length} sections collapsible`);
            }

        } catch (error) {
            console.error('❌ Error making sections collapsible:', error);
        }
    }

    /**
     * ✅ P1 UI/UX: Add "Back to Top" button for long pages
     */
    function addBackToTopButton() {
        // Check if button already exists
        if (document.getElementById('privacy-back-to-top')) {
            return;
        }

        const button = document.createElement('button');
        button.id = 'privacy-back-to-top';
        button.className = 'back-to-top hidden';
        button.setAttribute('aria-label', 'Zurück nach oben');

        // ✅ P0 SECURITY: Use textContent instead of innerHTML
        const icon = document.createElement('span');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '↑';
        button.appendChild(icon);

        document.body.appendChild(button);

        // Show/hide on scroll
        const toggleButton = () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            if (scrollTop > 500) {
                button.classList.remove('hidden');
                button.classList.add('visible');
            } else {
                button.classList.remove('visible');
                button.classList.add('hidden');
            }
        };

        eventListenerRegistry.add(window, 'scroll', toggleButton, { passive: true });

        eventListenerRegistry.add(button, 'click', () => {
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            window.scrollTo({
                top: 0,
                behavior: prefersReducedMotion ? 'auto' : 'smooth'
            });
        });

        if (isDevelopment) {
            console.log('✅ Back-to-top button added');
        }
    }

    // ============================================================================
    // DATA MANAGEMENT
    // ============================================================================

    /**
     * P0 FIX: Clear all game data
     */
    function clearAllGameData() {
        try {
            // Clear via NocapUtils if available
            if (window.NocapUtils && window.NocapUtils.clearAppStorage) {
                window.NocapUtils.clearAppStorage();
            } else {
                // Fallback: Clear manually
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('nocap_')) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key));
            }

            // Clear GameState if available
            if (window.gameState && typeof window.gameState.clearStorage === 'function') {
                window.gameState.clearStorage();
            }

            if (isDevelopment) {
                console.log('✅ All game data cleared');
            }

        } catch (error) {
            console.error('❌ Error clearing game data:', error);
        }
    }

    /**
     * P1 FIX: Export user data (GDPR Art. 20)
     */
    function exportUserData() {
        try {
            // ✅ P1 UI/UX: Show loading indicator
            showExportProgress(true);

            const c = window.NocapCookies?.getConsent?.();

            const userData = {
                meta: {
                    exportDate: new Date().toISOString(),
                    version: '1.0',
                    appVersion: '4.0'
                },
                consent: {
                    accepted: !!c,
                    timestamp: c?.timestamp ?? null,
                    version: c?.version ?? null,
                    analytics: c?.analytics ?? false,
                    functional: c?.functional ?? false
                },
                gameState: null,
                localStorage: {}
            };


            // Add GameState if available
            if (window.gameState && typeof window.gameState.getDebugInfo === 'function') {
                userData.gameState = window.gameState.getDebugInfo();
            }

            // ✅ P1 DSGVO: Export all nocap_* localStorage items
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('nocap_')) {
                    userData.localStorage[key] = localStorage.getItem(key);
                }
            }

            // Create and download file
            const dataStr = JSON.stringify(userData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `nocap-data-export-${new Date().toISOString().split('T')[0]}.json`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up URL
            URL.revokeObjectURL(link.href);

            // Hide loading indicator
            showExportProgress(false);

            // Show confirmation
            if (window.NocapUtils) {
                window.NocapUtils.showNotification(
                    'Daten erfolgreich exportiert!',
                    'success',
                    3000
                );
            }

            if (isDevelopment) {
                console.log('✅ User data exported', userData);
            }

        } catch (error) {
            console.error('❌ Error exporting user data:', error);

            showExportProgress(false);

            if (window.NocapUtils) {
                window.NocapUtils.showNotification(
                    'Export fehlgeschlagen',
                    'error'
                );
            }
        }
    }

    /**
     * ✅ P1 UI/UX: Show/hide export progress indicator
     * @param {boolean} show - Whether to show or hide
     */
    function showExportProgress(show) {
        let indicator = document.getElementById('privacy-export-progress');

        if (show && !indicator) {
            indicator = document.createElement('div');
            indicator.id = 'privacy-export-progress';
            indicator.className = 'export-progress';
            indicator.setAttribute('role', 'status');
            indicator.setAttribute('aria-live', 'polite');

            const spinner = document.createElement('div');
            spinner.className = 'spinner';
            spinner.setAttribute('aria-hidden', 'true');

            const text = document.createElement('p');
            text.textContent = 'Daten werden exportiert...';

            indicator.appendChild(spinner);
            indicator.appendChild(text);
            document.body.appendChild(indicator);

            requestAnimationFrame(() => {
                indicator.classList.add('visible');
            });
        } else if (!show && indicator) {
            indicator.classList.remove('visible');
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.remove();
                }
            }, 300);
        }
    }

    /**
     * ✅ P1 DSGVO: Delete all user data (GDPR Art. 17)
     */
    function deleteAllUserData() {
        // Confirmation dialog
        const confirmed = confirm(
            '⚠️ WARNUNG: Alle Ihre gespeicherten Daten werden unwiderruflich gelöscht!\n\n' +
            'Dies umfasst:\n' +
            '• Spielstände und Statistiken\n' +
            '• Datenschutz-Einstellungen\n' +
            '• Cookie-Präferenzen\n' +
            '• Altersverifikation\n\n' +
            'Möchten Sie wirklich fortfahren?'
        );

        if (!confirmed) {
            return;
        }

        try {
            // Clear all game data
            clearAllGameData();

            // Clear privacy consent
            revokePrivacyConsentSilent();

            // Clear cookie consent
            if (window.NocapCookies && typeof window.NocapCookies.revokeConsent === 'function') {
                window.NocapCookies.revokeConsent();
            }

            // Clear all nocap_* items
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('nocap_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));

            // Show success message
            if (window.NocapUtils) {
                window.NocapUtils.showNotification(
                    '✅ Alle Daten wurden gelöscht.',
                    'success',
                    5000
                );
            } else {
                alert('✅ Alle Daten wurden gelöscht.');
            }

            if (isDevelopment) {
                console.log('✅ All user data deleted');
            }

            // Redirect to home after 2 seconds
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);

        } catch (error) {
            console.error('❌ Error deleting user data:', error);

            if (window.NocapUtils) {
                window.NocapUtils.showNotification(
                    'Fehler beim Löschen der Daten',
                    'error'
                );
            }
        }
    }

    /**
     * ✅ P1 DSGVO: Generate deletion request email
     */
    function generateDeletionRequestEmail() {
        const subject = encodeURIComponent('Löschantrag gemäß Art. 17 DSGVO - No-Cap');
        const body = encodeURIComponent(
            'Sehr geehrte Damen und Herren,\n\n' +
            'hiermit beantrage ich gemäß Art. 17 DSGVO die Löschung aller mich betreffenden personenbezogenen Daten.\n\n' +
            'Betroffene Daten:\n' +
            '• Spielstände und Statistiken\n' +
            '• Altersverifikations-Daten\n' +
            '• Sonstige gespeicherte Nutzerdaten\n\n' +
            'Datum der Anfrage: ' + new Date().toLocaleDateString('de-DE') + '\n\n' +
            'Mit freundlichen Grüßen'
        );

        const mailtoLink = `mailto:${PRIVACY_CONTACT_EMAIL}?subject=${subject}&body=${body}`;
        window.location.href = mailtoLink;

        if (window.NocapUtils) {
            window.NocapUtils.showNotification(
                'E-Mail-Programm wird geöffnet...',
                'info',
                3000
            );
        }
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /**
     * P1 FIX: Initialize privacy management
     * ✅ DEAKTIVIERT: Cookie-Banner übernimmt jetzt das Consent-Management
     * ✅ P1 UI/UX: Initialisiert TOC und Collapsible Sections
     */
    function initPrivacyManagement() {
        try {
            // ✅ FIX: Nur noch prüfen, NICHT mehr anzeigen
            // Das Cookie-Banner übernimmt das Consent-Management
            if (hasPrivacyConsent()) {
                enableMultiplayerFeatures();
                if (isDevelopment) {
                    console.log('✅ Privacy consent found - Multiplayer enabled');
                }
            } else {
                // NICHT mehr disablen - Cookie-Banner kümmert sich darum
                // disableMultiplayerFeatures();

                if (isDevelopment) {
                    console.log('ℹ️ No privacy consent yet - waiting for Cookie Banner');
                }
            }

            // ✅ ENTFERNT: Zeige NICHT mehr das alte Privacy-Modal
            // Das Cookie-Banner übernimmt diese Aufgabe

            // ✅ P1 UI/UX: Initialize UI features for privacy page
            if (window.location.pathname.includes('privacy.html')) {
                // Wait for DOM to be fully loaded
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => {
                        initPrivacyPageUI();
                    });
                } else {
                    initPrivacyPageUI();
                }
            }

        } catch (error) {
            console.error('❌ Error initializing privacy management:', error);
        }
    }

    /**
     * ✅ P1 UI/UX: Initialize privacy page UI features
     */
    function initPrivacyPageUI() {
        try {
            // Generate Table of Contents
            generateTableOfContents();

            // Make sections collapsible
            makeCollapsibleSections();

            // Add back-to-top button
            addBackToTopButton();

            // ✅ P0 SECURITY: Setup event delegation for action buttons
            setupActionButtons();

            // Handle URL hash on load
            if (window.location.hash) {
                const hash = window.location.hash.substring(1);
                setTimeout(() => {
                    smoothScrollToSection(hash);
                }, 300);
            }

            if (isDevelopment) {
                console.log('✅ Privacy page UI initialized');
            }

        } catch (error) {
            console.error('❌ Error initializing privacy page UI:', error);
        }
    }

    /**
     * ✅ P0 SECURITY: Setup action buttons with event delegation
     */
    function setupActionButtons() {
        // Event delegation for all action buttons
        eventListenerRegistry.add(document, 'click', (event) => {
            const target = event.target.closest('[data-action]');
            if (!target) return;

            const action = target.getAttribute('data-action');

            switch (action) {
                case 'reset-cookies':
                    event.preventDefault();
                    handleCookieReset();
                    break;

                case 'revoke-consent':
                    event.preventDefault();
                    revokePrivacyConsent();
                    break;

                case 'export-data':
                    event.preventDefault();
                    exportUserData();
                    break;

                case 'delete-data':
                    event.preventDefault();
                    deleteAllUserData();
                    break;

                case 'request-deletion':
                    event.preventDefault();
                    generateDeletionRequestEmail();
                    break;

                default:
                    if (isDevelopment) {
                        console.warn('Unknown action:', action);
                    }
            }
        });
    }

    /**
     * ✅ P1 UI/UX: Handle cookie reset button click
     */
    function handleCookieReset() {
        if (window.NocapCookies && typeof window.NocapCookies.revokeConsent === 'function') {
            window.NocapCookies.revokeConsent();

            // Reinitialize cookie banner
            if (typeof window.NocapCookies.reinitialize === 'function') {
                setTimeout(() => {
                    window.NocapCookies.reinitialize();
                }, 500);
            }

            // Show success message
            if (window.NocapUtils && typeof window.NocapUtils.showNotification === 'function') {
                window.NocapUtils.showNotification(
                    'Cookie-Einstellungen zurückgesetzt. Sie werden nun erneut gefragt.',
                    'success',
                    3000
                );
            }
        } else {
            // Fallback: Manually remove cookie consent
            localStorage.removeItem('nocap_cookie_consent');
            localStorage.removeItem('cookieConsent');

            if (window.NocapUtils && typeof window.NocapUtils.showNotification === 'function') {
                window.NocapUtils.showNotification(
                    'Cookie-Einstellungen gelöscht. Bitte laden Sie die Seite neu.',
                    'info',
                    5000
                );
            } else {
                alert('Cookie-Einstellungen gelöscht. Bitte laden Sie die Seite neu.');
            }
        }
    }

    // ============================================================================
    // EXPORT API
    // ============================================================================

    window.NocapPrivacy = {
        // Version
        version: '2.0',

        // Consent management
        hasPrivacyConsent,
        showPrivacyConsent,
        acceptPrivacy,
        declinePrivacy,
        revokePrivacyConsent,

        // Feature management
        enableMultiplayerFeatures,
        disableMultiplayerFeatures,

        // Data management
        clearAllGameData,
        exportUserData,

        // ✅ P1 UI/UX: Navigation & UI
        generateTableOfContents,
        makeCollapsibleSections,
        smoothScrollToSection,
        addBackToTopButton,

        // Initialization
        initPrivacyManagement
    };

    // P1 FIX: Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPrivacyManagement);
    } else {
        initPrivacyManagement();
    }

    if (isDevelopment) {
        console.log('%c✅ NocapPrivacy v2.0 loaded (Audit-Fixed)',
            'color: #9C27B0; font-weight: bold; font-size: 12px');
    }

})(window);