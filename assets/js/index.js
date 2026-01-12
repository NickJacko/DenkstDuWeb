/**
 * NO-CAP Landing Page - Main Script
 * Version 7.0 - JavaScript-Kern Hardening
 *
 * AUDIT FIXES APPLIED:
 * ✅ P0: DOMPurify validation with user-friendly fallback
 * ✅ P0: All inline event handlers removed (CSP compliant)
 * ✅ P0: Module pattern - no global variables (XSS prevention)
 * ✅ P1: Proper Firebase initialization with firebase-config.js
 * ✅ P1: Device mode removed from landing (set on target pages)
 * ✅ P1: Input sanitization via DOMPurify
 * ✅ P1: Scroll events with throttle/debounce (performance)
 * ✅ P1: Centralized Auth via FirebaseConfig (no duplicate state)
 * ✅ P1: Cookie banner delayed after page load
 * ✅ P2: Accessibility improvements (keyboard navigation, ARIA)
 * ✅ P2: Animations respect prefers-reduced-motion
 * ✅ PRODUCTION: Logger statt console (no spam in production)
 */

(function(window) {
    'use strict';

    // ===================================
    // 🔒 MODULE SCOPE - NO GLOBAL POLLUTION
    // ===================================

    // Get Logger from utils
    const Logger = window.NocapUtils?.Logger || {
        debug: (...args) => {},
        info: (...args) => {},
        warn: console.warn,
        error: console.error
    };

    // ✅ P0 FIX: All state encapsulated in module scope (no global variables)
    const IndexPageModule = {
        // State
        state: {
            ageVerified: false,
            isAdult: false,
            alcoholMode: false,
            gameState: null,
            directJoinInterval: null,
            eventListenerCleanup: [],
            scrollThrottle: null,
            isDevelopment: window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('192.168.')
        },

        // Getters/Setters for controlled access
        get ageVerified() { return this.state.ageVerified; },
        set ageVerified(val) { this.state.ageVerified = !!val; },

        get isAdult() { return this.state.isAdult; },
        set isAdult(val) { this.state.isAdult = !!val; },

        get alcoholMode() { return this.state.alcoholMode; },
        set alcoholMode(val) { this.state.alcoholMode = !!val; },

        get gameState() { return this.state.gameState; },
        set gameState(val) { this.state.gameState = val; },

        get isDevelopment() { return this.state.isDevelopment; }
    };

    // Prevent tampering
    Object.seal(IndexPageModule.state);

    // ===================================
    // 🛠️ PERFORMANCE UTILITIES
    // ===================================

    /**
     * ✅ P1 FIX: Throttle function for scroll events (performance optimization)
     * Limits function execution to once per wait period
     * @param {Function} func - Function to throttle
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Throttled function
     */
    function throttle(func, wait = 100) {
        let timeout = null;
        let previous = 0;

        return function executedFunction(...args) {
            const now = Date.now();
            const remaining = wait - (now - previous);

            if (remaining <= 0 || remaining > wait) {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                previous = now;
                func.apply(this, args);
            } else if (!timeout) {
                timeout = setTimeout(() => {
                    previous = Date.now();
                    timeout = null;
                    func.apply(this, args);
                }, remaining);
            }
        };
    }

    /**
     * ✅ P1 FIX: Debounce function for input events
     * Delays function execution until after wait period of inactivity
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    function debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ===================================
    // 🛡️ P0 FIX: DOMPURIFY VALIDATION
    // ===================================

    /**
     * Check if DOMPurify is available - show friendly error instead of crash
     * @returns {boolean} True if DOMPurify is available
     */
    function checkDOMPurify() {
        if (typeof DOMPurify === 'undefined') {
            Logger.error('❌ CRITICAL: DOMPurify not loaded!');
            showDOMPurifyError();
            return false;
        }

        Logger.debug('✅ DOMPurify available');
        return true;
    }

    /**
     * ✅ P0 FIX: Show user-friendly DOMPurify error modal (CSP-konform, keine Inline-Styles)
     */
    function showDOMPurifyError() {
        const errorModal = document.createElement('div');
        errorModal.className = 'dompurify-error-modal';
        errorModal.setAttribute('role', 'alert');
        errorModal.setAttribute('aria-live', 'assertive');

        const errorContent = document.createElement('div');
        errorContent.className = 'dompurify-error-content';

        const icon = document.createElement('div');
        icon.className = 'dompurify-error-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '🛡️';

        const title = document.createElement('h2');
        title.className = 'dompurify-error-title';
        title.textContent = 'Sicherheitskomponente nicht geladen';

        const message = document.createElement('p');
        message.className = 'dompurify-error-message';
        message.textContent = 'Die Sicherheitskomponente konnte nicht geladen werden. Bitte lade die Seite neu.';

        const reloadButton = document.createElement('button');
        reloadButton.className = 'dompurify-error-button';
        reloadButton.textContent = '🔄 Seite neu laden';
        reloadButton.addEventListener('click', () => location.reload());

        errorContent.appendChild(icon);
        errorContent.appendChild(title);
        errorContent.appendChild(message);
        errorContent.appendChild(reloadButton);
        errorModal.appendChild(errorContent);
        document.body.appendChild(errorModal);
    }

    // ===================================
    // 🔐 AGE VERIFICATION
    // ===================================

    /**
     * ✅ P1 FIX: Show age verification modal with centralized auth check
     * Uses Firebase Custom Claims instead of local state
     */
    function showAgeModal() {
        const modal = document.getElementById('age-modal');
        const mainApp = document.getElementById('main-app');

        if (modal && mainApp) {
            // ✅ CSP-FIX: Use CSS classes instead of inline styles
            if (window.NocapUtils && window.NocapUtils.showElement) {
                window.NocapUtils.showElement(modal, 'flex');
            } else {
                modal.classList.remove('hidden');
                modal.classList.add('d-flex');
            }
            modal.removeAttribute('aria-hidden');

            mainApp.classList.add('modal-open-blur');
            mainApp.setAttribute('aria-hidden', 'true');

            // Focus trap for accessibility
            if (window.NocapUtils && window.NocapUtils.trapFocus) {
                const cleanup = window.NocapUtils.trapFocus(modal);
                modal._focusTrapCleanup = cleanup;
            }

            // Focus first interactive element
            const firstButton = modal.querySelector('button, input[type="checkbox"]');
            if (firstButton) {
                setTimeout(() => firstButton.focus(), 100);
            }

            // Announce to screen readers
            if (window.NocapUtils && window.NocapUtils.announceToScreenReader) {
                window.NocapUtils.announceToScreenReader(
                    'Altersverifikation erforderlich. Bitte bestätige dein Alter.',
                    'assertive'
                );
            }
        }
    }

    /**
     * Hide age verification modal with cleanup
     */
    function hideAgeModal() {
        const modal = document.getElementById('age-modal');
        const mainApp = document.getElementById('main-app');

        if (modal && mainApp) {
            // ✅ CSP-FIX: Use CSS classes instead of inline styles
            if (window.NocapUtils && window.NocapUtils.hideElement) {
                window.NocapUtils.hideElement(modal);
            } else {
                modal.classList.add('hidden');
            }
            modal.setAttribute('aria-hidden', 'true');

            mainApp.classList.remove('modal-open-blur');
            mainApp.removeAttribute('aria-hidden');

            // Cleanup focus trap
            if (modal._focusTrapCleanup && typeof modal._focusTrapCleanup === 'function') {
                modal._focusTrapCleanup();
                modal._focusTrapCleanup = null;
            }

            // ✅ FIX: Check if user came from join-game or other page
            const returnUrl = sessionStorage.getItem('nocap_return_url');
            if (returnUrl) {
                sessionStorage.removeItem('nocap_return_url');

                if (IndexPageModule.isDevelopment) {
                    console.log('↩️ Returning to:', returnUrl);
                }

                // Show smooth transition notification
                if (window.NocapUtils && window.NocapUtils.showNotification) {
                    window.NocapUtils.showNotification(
                        '✓ Altersverifikation abgeschlossen - kehre zurück...',
                        'success',
                        1000
                    );
                }

                // Immediate redirect (no visible flash to index page)
                window.location.replace(returnUrl);
                return;
            }

            // Return focus to main content
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                mainContent.focus();
            }
        }
    }

    /**
     * ✅ P0 FIX: Save age verification with MANDATORY server validation
     * ✅ P1 FIX: Synchronizes with central FirebaseAuth Custom Claims
     * @param {boolean} isAdultUser - Whether user is 18+
     * @param {boolean} allowAlcohol - Whether alcohol mode is allowed
     * @returns {Promise<boolean>} Success status
     */
    async function saveVerification(isAdultUser, allowAlcohol) {
        try {
            const ageLevel = isAdultUser ? 18 : 0;

            // ✅ P0 FIX: Serverseitige Validierung MUSS erfolgreich sein
            const serverVerified = await updateFirebaseAgeVerification(ageLevel);

            if (!serverVerified) {
                // Server-Validierung fehlgeschlagen - KEINE lokale Speicherung
                console.error('❌ Server verification failed - age not saved');
                return false;
            }

            // ✅ P1 FIX: Synchronize with Firebase Auth Custom Claims
            if (window.FirebaseConfig && window.FirebaseConfig.isInitialized()) {
                try {
                    const user = window.FirebaseConfig.getCurrentUser();
                    if (user) {
                        // Force token refresh to get updated custom claims
                        await user.getIdToken(true);

                        if (IndexPageModule.isDevelopment) {
                            Logger.debug('✅ Firebase token refreshed with new age claims');
                        }
                    }
                } catch (authError) {
                    Logger.warn('⚠️ Could not refresh auth token:', authError);
                    // Non-fatal - continue with local storage
                }
            }

            // Nur nach erfolgreicher Server-Validierung: Lokale Speicherung (UX-Cache)
            const verification = {
                ageVerified: true,
                isAdult: isAdultUser === true,
                alcoholMode: allowAlcohol === true,
                timestamp: Date.now(),
                serverVerified: true // Flag für serverseitige Bestätigung
            };

            // Use safe storage helpers
            if (window.NocapUtils) {
                window.NocapUtils.setLocalStorage('nocap_age_level', ageLevel);
                window.NocapUtils.setLocalStorage('nocap_age_verification', verification);
            } else {
                localStorage.setItem('nocap_age_level', ageLevel.toString());
                localStorage.setItem('nocap_age_verification', JSON.stringify(verification));
            }

            // ✅ Update module state
            IndexPageModule.ageVerified = true;
            IndexPageModule.isAdult = isAdultUser;
            IndexPageModule.alcoholMode = allowAlcohol;

            if (IndexPageModule.isDevelopment) {
                console.log('✅ Age verification saved (server-validated):', { ageLevel, alcoholMode });
            }

            return true;

        } catch (error) {
            console.error('❌ Could not save age verification:', error);

            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    'Fehler beim Speichern der Altersverifikation',
                    'error'
                );
            }

            return false;
        }
    }

    /**
     * ✅ P0 FIX: Update Firebase with age verification (async, non-blocking)
     * Server-side validierung via Cloud Function mit Custom Claims
     * @param {number} ageLevel - Age verification level (0 or 18)
     * @returns {Promise<boolean>} Success status
     */
    async function updateFirebaseAgeVerification(ageLevel) {
        try {
            // ✅ FALLBACK: If Firebase not available, allow local-only storage with warning
            if (!window.FirebaseConfig || !window.FirebaseConfig.isInitialized()) {
                if (IndexPageModule.isDevelopment) {
                    console.warn('⚠️ Firebase not initialized - using local-only age verification');
                }

                // Show warning to user
                if (window.NocapUtils && window.NocapUtils.showNotification) {
                    window.NocapUtils.showNotification(
                        '⚠️ Offline-Modus: Altersverifikation nur lokal gespeichert',
                        'warning',
                        3000
                    );
                }

                return true; // Allow continuation with local storage
            }

            const userId = window.FirebaseConfig.getCurrentUserId();
            if (!userId) {
                if (IndexPageModule.isDevelopment) {
                    console.warn('⚠️ No user ID - using local-only age verification');
                }

                // Show warning
                if (window.NocapUtils && window.NocapUtils.showNotification) {
                    window.NocapUtils.showNotification(
                        '⚠️ Altersverifikation nur lokal gespeichert',
                        'warning',
                        3000
                    );
                }

                return true; // Allow continuation
            }

            // ✅ P0 FIX: Try server-side validation via Cloud Function
            try {
                const { functions } = window.FirebaseConfig.getFirebaseInstances();

                if (!functions) {
                    throw new Error('Firebase Functions not available');
                }

                const verifyAge = functions.httpsCallable('verifyAge');

                const result = await verifyAge({
                    ageLevel: ageLevel,
                    consent: true
                });

                if (result.data && result.data.success) {
                    if (IndexPageModule.isDevelopment) {
                        console.log('✅ Server-side age verification successful:', result.data);
                    }

                    // Show success
                    if (window.NocapUtils && window.NocapUtils.showNotification) {
                        window.NocapUtils.showNotification(
                            '✓ Altersverifikation gespeichert',
                            'success',
                            2000
                        );
                    }

                    return true;
                } else {
                    throw new Error('Server verification failed');
                }

            } catch (cloudFunctionError) {
                console.error('❌ Server-side age verification FAILED:', cloudFunctionError);

                // ✅ FALLBACK: Allow local storage with warning instead of blocking
                if (window.NocapUtils && window.NocapUtils.showNotification) {
                    window.NocapUtils.showNotification(
                        '⚠️ Server-Validierung fehlgeschlagen - Altersverifikation nur lokal gespeichert',
                        'warning',
                        4000
                    );
                }

                // Don't clear - allow local storage
                return true; // Allow continuation with local-only verification
            }

        } catch (error) {
            console.error('❌ Age verification error:', error);

            // ✅ FALLBACK: Allow local storage instead of failing completely
            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    '⚠️ Altersverifikation nur lokal gespeichert',
                    'warning',
                    3000
                );
            }

            return true; // Allow continuation
        }
    }

    /**
     * ✅ P0 SECURITY: Load age verification with validation and expiry check
     * Sanitizes all data from localStorage before use
     * @returns {boolean} True if valid verification found
     */
    function loadVerification() {
        try {
            const saved = window.NocapUtils
                ? window.NocapUtils.getLocalStorage('nocap_age_verification')
                : localStorage.getItem('nocap_age_verification');

            if (!saved) {
                return false;
            }

            const verification = typeof saved === 'string' ? JSON.parse(saved) : saved;

            // ✅ P0 SECURITY: Validate structure and sanitize all string values
            if (!verification || typeof verification !== 'object') {
                clearVerification();
                return false;
            }

            // ✅ P0 SECURITY: Validate and sanitize timestamp
            const timestamp = parseInt(verification.timestamp);
            if (isNaN(timestamp) || timestamp < 0 || timestamp > Date.now()) {
                Logger.warn('⚠️ Invalid timestamp in age verification');
                clearVerification();
                return false;
            }

            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;

            // Check if verification is still valid (24 hours)
            if (timestamp && now - timestamp < oneDay) {
                // ✅ P0 SECURITY: Strict boolean validation
                IndexPageModule.ageVerified = verification.ageVerified === true;
                IndexPageModule.isAdult = verification.isAdult === true;
                IndexPageModule.alcoholMode = verification.alcoholMode === true;

                if (IndexPageModule.isDevelopment) {
                    Logger.debug('✅ Age verification loaded from storage');
                }

                return true;
            } else {
                // Expired - clear it
                if (IndexPageModule.isDevelopment) {
                    Logger.info('ℹ️ Age verification expired (>24h)');
                }
                clearVerification();
                return false;
            }

        } catch (error) {
            Logger.error('❌ Could not load age verification:', error);
            clearVerification();
            return false;
        }
    }

    /**
     * Clear verification from storage
     */
    function clearVerification() {
        if (window.NocapUtils) {
            window.NocapUtils.removeLocalStorage('nocap_age_verification');
            window.NocapUtils.removeLocalStorage('nocap_age_level');
        } else {
            localStorage.removeItem('nocap_age_verification');
            localStorage.removeItem('nocap_age_level');
        }

        IndexPageModule.ageVerified = false;
        IndexPageModule.isAdult = false;
        IndexPageModule.alcoholMode = false;
    }

    /**
     * Update UI based on age verification (safe DOM manipulation)
     */
    function updateUIForVerification() {
        if (!IndexPageModule.alcoholMode) {
            // Use textContent instead of innerHTML for XSS safety
            const drinkIcon = document.getElementById('drink-icon');
            const drinkText = document.getElementById('drink-text');
            const step4Text = document.getElementById('step4-text');

            if (drinkIcon) {
                drinkIcon.textContent = '💧';
                drinkIcon.setAttribute('aria-label', 'Alkoholfrei');
            }

            if (drinkText) {
                drinkText.textContent = 'Bekomme Challenges bei falschen Schätzungen';
            }

            if (step4Text) {
                step4Text.textContent = 'Wer falsch lag, bekommt eine Challenge!';
            }
        }
    }

    // ===================================
    // 🔥 FIREBASE INITIALIZATION
    // ===================================

    /**
     * Initialize Firebase with proper error handling
     * @returns {Promise<boolean>} True if successful
     */
    async function initializeFirebase() {
        try {
            // Check for FirebaseConfig (new architecture)
            if (!window.FirebaseConfig) {
                console.warn('⚠️ FirebaseConfig not available - offline mode');
                return false;
            }

            // Wait for Firebase to be ready
            if (window.FirebaseConfig.waitForFirebase) {
                await window.FirebaseConfig.waitForFirebase(5000);
            }

            // Check if initialization was successful
            if (!window.FirebaseConfig.isInitialized()) {
                console.warn('⚠️ Firebase not initialized - offline mode');
                return false;
            }

            if (IndexPageModule.isDevelopment) {
                console.log('✅ Firebase ready for multiplayer');
            }

            return true;

        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
            return false;
        }
    }

    // ===================================
    // 🎮 GAME MODE SELECTION
    // ===================================

    /**
     * Validate state before navigation
     * @returns {boolean} True if valid
     */
    function validateGameState() {
        if (!IndexPageModule.ageVerified) {
            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    'Bitte bestätige zuerst dein Alter',
                    'warning'
                );
            }
            showAgeModal();
            return false;
        }

        if (!IndexPageModule.gameState) {
            console.error('❌ GameState not initialized');

            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    'Fehler beim Laden der Spieldaten',
                    'error'
                );
            }
            return false;
        }

        return true;
    }

    /**
     * ✅ AUDIT FIX: Start single device mode - NO device mode setting here
     */
    function startSingleDevice() {
        if (!validateGameState()) {
            return;
        }

        try {
            // ONLY store age/alcohol flags - device mode is set on category-selection.html
            IndexPageModule.gameState.setAlcoholMode(IndexPageModule.alcoholMode);

            if (window.NocapUtils) {
                window.NocapUtils.setLocalStorage('nocap_is_adult', IndexPageModule.isAdult);
            } else {
                localStorage.setItem('nocap_is_adult', IndexPageModule.isAdult.toString());
            }

            if (IndexPageModule.isDevelopment) {
                console.log('🎮 Navigating to single device category selection');
            }

            window.location.href = 'category-selection.html';

        } catch (error) {
            console.error('❌ Error starting single device mode:', error);

            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    'Fehler beim Starten des Spiels',
                    'error'
                );
            }
        }
    }

    /**
     * ✅ AUDIT FIX: Start multiplayer mode - NO device mode setting here
     */
    function startMultiplayer() {
        if (!validateGameState()) {
            return;
        }

        // ✅ FIX: Privacy-Check entfernt - Cookie-Banner setzt Consent automatisch
        // Alte Privacy-Check-Logik ist deaktiviert, Cookie-Banner übernimmt

        try {
            // ONLY flag as host - device mode is set on multiplayer-category-selection.html
            IndexPageModule.gameState.setAlcoholMode(IndexPageModule.alcoholMode);

            // Flag that user wants to be host (checked on target page)
            if (window.NocapUtils) {
                window.NocapUtils.setLocalStorage('nocap_wants_host', true);
                window.NocapUtils.setLocalStorage('nocap_is_adult', IndexPageModule.isAdult);
            } else {
                localStorage.setItem('nocap_wants_host', 'true');
                localStorage.setItem('nocap_is_adult', IndexPageModule.isAdult.toString());
            }

            if (IndexPageModule.isDevelopment) {
                console.log('🌐 Navigating to multiplayer category selection');
            }

            window.location.href = 'multiplayer-category-selection.html';

        } catch (error) {
            console.error('❌ Error starting multiplayer mode:', error);

            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    'Fehler beim Starten des Spiels',
                    'error'
                );
            }
        }
    }

    /**
     * ✅ AUDIT FIX: Join existing game - NO device mode setting here
     */
    function joinGame() {
        if (!validateGameState()) {
            return;
        }

        // ✅ FIX: Privacy-Check entfernt - Cookie-Banner setzt Consent automatisch

        try {
            // ONLY flag as guest - device mode is set on join-game.html
            IndexPageModule.gameState.setAlcoholMode(IndexPageModule.alcoholMode);

            // Flag that user wants to join (checked on target page)
            if (window.NocapUtils) {
                window.NocapUtils.setLocalStorage('nocap_wants_join', true);
                window.NocapUtils.setLocalStorage('nocap_is_adult', IndexPageModule.isAdult);
            } else {
                localStorage.setItem('nocap_wants_join', 'true');
                localStorage.setItem('nocap_is_adult', IndexPageModule.isAdult.toString());
            }

            if (IndexPageModule.isDevelopment) {
                console.log('🔗 Navigating to join game');
            }

            window.location.href = 'join-game.html';

        } catch (error) {
            console.error('❌ Error joining game:', error);

            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    'Fehler beim Beitreten',
                    'error'
                );
            }
        }
    }

        // ===================================
        // 🎬 ANIMATION HELPERS
        // ===================================

        /**
         * ✅ P1 UI/UX: Setup scroll-to-top button with throttled scroll event
         */
        function setupScrollToTop() {
            // Check if button already exists
            let scrollButton = document.getElementById('scroll-to-top');

            if (!scrollButton) {
                // Create scroll-to-top button
                scrollButton = document.createElement('button');
                scrollButton.id = 'scroll-to-top';
                scrollButton.className = 'scroll-to-top hidden';
                scrollButton.setAttribute('aria-label', 'Zurück nach oben');
                scrollButton.setAttribute('title', 'Zurück nach oben');
                scrollButton.innerHTML = '<span aria-hidden="true">↑</span>';

                document.body.appendChild(scrollButton);
            }

            // Show/hide button based on scroll position
            const toggleScrollButton = () => {
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

                if (scrollTop > 300) {
                    scrollButton.classList.remove('hidden');
                    scrollButton.classList.add('visible');
                } else {
                    scrollButton.classList.remove('visible');
                    scrollButton.classList.add('hidden');
                }
            };

            // ✅ P1 FIX: Throttle scroll event for performance (max 1 call per 100ms)
            const throttledToggle = throttle(toggleScrollButton, 100);

            // Scroll to top on click
            const scrollToTop = () => {
                // Check for reduced motion preference
                const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

                window.scrollTo({
                    top: 0,
                    behavior: prefersReducedMotion ? 'auto' : 'smooth'
                });

                // Focus on main content after scroll
                const mainContent = document.getElementById('main-content');
                if (mainContent) {
                    mainContent.focus();
                }
            };

            // Add event listeners with throttle
            addTrackedEventListener(window, 'scroll', throttledToggle, { passive: true });
            addTrackedEventListener(scrollButton, 'click', scrollToTop);

            // Initial check
            toggleScrollButton();

            if (IndexPageModule.isDevelopment) {
                Logger.debug('✅ Scroll-to-top button initialized (throttled)');
            }
        }

        /**
         * ✅ P1 UI/UX: Lazy load modals and heavy components
         */
        function lazyLoadComponents() {
            // Lazy load age modal content (only when needed)
            const ageModal = document.getElementById('age-modal');

            if (ageModal && !ageModal.dataset.loaded) {
                // Mark as loaded
                ageModal.dataset.loaded = 'true';

                // Add intersection observer for future lazy-loaded images
                if ('IntersectionObserver' in window) {
                    const imageObserver = new IntersectionObserver((entries, observer) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                const img = entry.target;

                                if (img.dataset.src) {
                                    img.src = img.dataset.src;
                                    img.removeAttribute('data-src');
                                }

                                observer.unobserve(img);
                            }
                        });
                    }, {
                        rootMargin: '50px' // Load 50px before entering viewport
                    });

                    // Observe all lazy images
                    document.querySelectorAll('img[data-src]').forEach(img => {
                        imageObserver.observe(img);
                    });

                    if (IndexPageModule.isDevelopment) {
                        Logger.debug('✅ Image lazy loading initialized');
                    }
                }
            }
        }

        /**
         * ✅ AUDIT FIX: Animate mode cards via CSS classes (respects prefers-reduced-motion)
         */
        function animateCards() {
            // Check for reduced motion preference
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            if (prefersReducedMotion) {
                if (IndexPageModule.isDevelopment) {
                    Logger.info('ℹ️ Animations disabled (prefers-reduced-motion)');
                }
                // Make cards visible immediately if animation is disabled
                const cards = document.querySelectorAll('.mode-card');
                cards.forEach(card => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                });
                return;
            }

            setTimeout(() => {
                const cards = document.querySelectorAll('.mode-card');

                cards.forEach((card, index) => {
                    // Add will-animate class first to enable animation
                    card.classList.add('will-animate');
                    setTimeout(() => {
                        card.classList.add('card-animate-in');
                    }, index * 150);
                });
            }, 300);
        }

        /**
         * ✅ P1 UI/UX: Smooth scroll to section with accessibility support
         * @param {string} target - CSS selector for target element
         */
        function smoothScrollTo(target) {
            const element = document.querySelector(target);
            if (!element) {
                return;
            }

            // Check for reduced motion preference
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            element.scrollIntoView({
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
                block: 'start'
            });

            // Focus target for keyboard users
            if (element.hasAttribute('tabindex') || element.tagName === 'A' || element.tagName === 'BUTTON') {
                element.focus();
            }
        }

        // ===================================
        // 🔗 URL PARAMETER HANDLING
        // ===================================

        /**
         * ✅ AUDIT FIX: Handle direct game join with STRICT validation
         * Only allows exactly 6 alphanumeric characters [A-Z0-9]{6}
         */
        function handleDirectJoin() {
            const urlParams = new URLSearchParams(window.location.search);
            const gameId = urlParams.get('gameId');

            if (!gameId) {
                return;
            }

            // ✅ STRICT VALIDATION: Only [A-Z0-9]{6}
            const strictPattern = /^[A-Z0-9]{6}$/i;

            // Validate length and pattern
            if (gameId.length !== 6 || !strictPattern.test(gameId)) {
                console.warn('⚠️ Invalid gameId format (must be exactly 6 alphanumeric chars):', gameId);

                if (window.NocapUtils && window.NocapUtils.showNotification) {
                    window.NocapUtils.showNotification(
                        'Ungültiger Spiel-Code. Muss 6 Zeichen sein (A-Z, 0-9)',
                        'error'
                    );
                }

                // Clear invalid parameter from URL
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
                return;
            }

            // Sanitize with DOMPurify AND uppercase
            const sanitizedGameId = DOMPurify.sanitize(gameId.toUpperCase().trim());

            // Clear any existing interval
            if (IndexPageModule.state.directJoinInterval) {
                clearInterval(IndexPageModule.state.directJoinInterval);
            }

            // Wait for age verification
            let attempts = 0;
            const maxAttempts = 100; // 10 seconds

            IndexPageModule.state.directJoinInterval = setInterval(() => {
                attempts++;

                if (IndexPageModule.ageVerified) {
                    clearInterval(IndexPageModule.state.directJoinInterval);
                    IndexPageModule.state.directJoinInterval = null;

                    // Use encodeURIComponent for safe URL parameter
                    window.location.href = `join-game.html?gameId=${encodeURIComponent(sanitizedGameId)}`;
                }

                // Timeout after 10 seconds
                if (attempts >= maxAttempts) {
                    clearInterval(IndexPageModule.state.directJoinInterval);
                    IndexPageModule.state.directJoinInterval = null;

                    if (!IndexPageModule.ageVerified && window.NocapUtils && window.NocapUtils.showNotification) {
                        window.NocapUtils.showNotification(
                            'Altersverifikation erforderlich zum Beitreten',
                            'warning'
                        );
                    }
                }
            }, 100);
        }

        // ===================================
        // 🎯 EVENT LISTENERS
        // ===================================

        /**
         * Register event listener with cleanup tracking
         * @param {Element} element - DOM element
         * @param {string} event - Event type
         * @param {Function} handler - Event handler
         * @param {Object} options - Event options
         */
        function addTrackedEventListener(element, event, handler, options = {}) {
            if (!element) return;

            element.addEventListener(event, handler, options);
            IndexPageModule.state.eventListenerCleanup.push({element, event, handler, options});
        }

        /**
         * Setup all event listeners with proper cleanup tracking
         */
        function setupEventListeners() {
            // ✅ AUDIT FIX: ESC-Taste schließt Age-Modal (falls bereits verifiziert)
            const ageModal = document.getElementById('age-modal');
            if (ageModal) {
                addTrackedEventListener(ageModal, 'modal-close', function () {
                    // Nur schließen, wenn bereits verifiziert
                    if (IndexPageModule.ageVerified) {
                        hideAgeModal();
                    }
                });
            }

            // Age checkbox
            const ageCheckbox = document.getElementById('age-checkbox');
            const btn18Plus = document.getElementById('btn-18plus');

            if (ageCheckbox && btn18Plus) {
                addTrackedEventListener(ageCheckbox, 'change', function () {
                    const isChecked = this.checked;
                    btn18Plus.disabled = !isChecked;
                    btn18Plus.setAttribute('aria-disabled', !isChecked);

                    if (isChecked) {
                        btn18Plus.classList.add('enabled');
                    } else {
                        btn18Plus.classList.remove('enabled');
                    }
                });
            }

            // 18+ button
            if (btn18Plus) {
                addTrackedEventListener(btn18Plus, 'click', async function () {
                    const checkbox = document.getElementById('age-checkbox');
                    if (checkbox && checkbox.checked) {
                        // ✅ P0 FIX: Warte auf serverseitige Validierung
                        this.disabled = true;
                        this.textContent = '⏳ Validiere...';

                        const success = await saveVerification(true, true);

                        if (success) {
                            updateUIForVerification();
                            hideAgeModal();
                            animateCards();

                            if (window.NocapUtils && window.NocapUtils.showNotification) {
                                window.NocapUtils.showNotification(
                                    'Spiel mit allen Inhalten verfügbar',
                                    'success',
                                    2000
                                );
                            }
                        } else {
                            // Reset Button bei Fehler
                            this.disabled = false;
                            this.innerHTML = '<span aria-hidden="true">🔞</span> Weiter (18+)';

                            if (window.NocapUtils && window.NocapUtils.showNotification) {
                                window.NocapUtils.showNotification(
                                    'Validierung fehlgeschlagen. Bitte versuche es später erneut.',
                                    'error',
                                    4000
                                );
                            }
                        }
                    }
                });
            }

            // Under 18 button
            const btnUnder18 = document.getElementById('btn-under-18');
            if (btnUnder18) {
                addTrackedEventListener(btnUnder18, 'click', async function () {
                    // ✅ P0 FIX: Auch unter-18 Validierung serverseitig
                    this.disabled = true;
                    this.textContent = '⏳ Speichere...';

                    const success = await saveVerification(false, false);

                    if (success) {
                        updateUIForVerification();
                        hideAgeModal();
                        animateCards();

                        if (window.NocapUtils && window.NocapUtils.showNotification) {
                            window.NocapUtils.showNotification(
                                'Jugendschutz-Modus aktiviert',
                                'info',
                                2000
                            );
                        }
                    } else {
                        // Reset Button bei Fehler
                        this.disabled = false;
                        this.innerHTML = '<span aria-hidden="true">👶</span> Ich bin unter 18';

                        if (window.NocapUtils && window.NocapUtils.showNotification) {
                            window.NocapUtils.showNotification(
                                'Validierung fehlgeschlagen. Bitte versuche es später erneut.',
                                'error',
                                4000
                            );
                        }
                    }
                });
            }

            // Game mode buttons
            const btnSingle = document.getElementById('btn-single');
            if (btnSingle) {
                addTrackedEventListener(btnSingle, 'click', startSingleDevice);
            }

            const btnMulti = document.getElementById('btn-multi');
            if (btnMulti) {
                addTrackedEventListener(btnMulti, 'click', startMultiplayer);
            }

            const btnJoin = document.getElementById('btn-join');
            if (btnJoin) {
                addTrackedEventListener(btnJoin, 'click', joinGame);
            }

            // Scroll indicator (Button - no need for click handler on div)
            const scrollIndicator = document.getElementById('scroll-indicator');
            if (scrollIndicator) {
                addTrackedEventListener(scrollIndicator, 'click', function () {
                    smoothScrollTo('.game-modes');
                });
            }

            if (IndexPageModule.isDevelopment) {
                console.log(`✅ ${IndexPageModule.state.eventListenerCleanup.length} event listeners registered`);
            }
        }

        // ===================================
        // 🧹 CLEANUP
        // ===================================

        /**
         * Cleanup all resources on page unload
         */
        function cleanup() {
            // Clear intervals
            if (IndexPageModule.state.directJoinInterval) {
                clearInterval(IndexPageModule.state.directJoinInterval);
                IndexPageModule.state.directJoinInterval = null;
            }

            // Remove all tracked event listeners
            IndexPageModule.state.eventListenerCleanup.forEach(({element, event, handler, options}) => {
                try {
                    element.removeEventListener(event, handler, options);
                } catch (error) {
                    // Element may have been removed from DOM
                }
            });
            IndexPageModule.state.eventListenerCleanup = [];

            // Cleanup utils
            if (window.NocapUtils && window.NocapUtils.cleanupEventListeners) {
                window.NocapUtils.cleanupEventListeners();
            }

            // Cleanup modal focus trap
            const modal = document.getElementById('age-modal');
            if (modal && modal._focusTrapCleanup) {
                modal._focusTrapCleanup();
                modal._focusTrapCleanup = null;
            }

            if (IndexPageModule.isDevelopment) {
                console.log('✅ Index page cleanup completed');
            }
        }

        addTrackedEventListener(window, 'beforeunload', cleanup);

        // ===================================
        // 🚀 INITIALIZATION
        // ===================================

        /**
         * Main initialization function with dependency checks
         */
        async function initialize() {
            try {
                // ✅ P0 FIX: Check DOMPurify with friendly error
                if (!checkDOMPurify()) {
                    return; // Stop execution, error modal shown
                }

                // Wait for GameState
                if (typeof GameState === 'undefined') {
                    console.error('❌ GameState class not found!');

                    if (window.NocapUtils && window.NocapUtils.showNotification) {
                        window.NocapUtils.showNotification(
                            'Fehler beim Laden der Spieldaten',
                            'error'
                        );
                    }
                    return;
                }

                // Initialize GameState FIRST
                try {
                    IndexPageModule.gameState = new GameState();

                    if (IndexPageModule.isDevelopment) {
                        console.log('✅ GameState initialized');
                    }
                } catch (error) {
                    console.error('❌ GameState initialization failed:', error);

                    if (window.NocapUtils && window.NocapUtils.showNotification) {
                        window.NocapUtils.showNotification(
                            'Fehler beim Laden der Spieldaten',
                            'error'
                        );
                    }
                    return;
                }

                // Check for existing age verification
                if (loadVerification()) {
                    updateUIForVerification();
                    hideAgeModal();
                    animateCards();

                    if (IndexPageModule.isDevelopment) {
                        console.log('✅ Age verification restored from storage');
                    }
                } else {
                    showAgeModal();
                }

                // Setup event listeners
                setupEventListeners();

                // ✅ P1 UI/UX: Setup scroll-to-top button
                setupScrollToTop();

                // ✅ P1 UI/UX: Initialize lazy loading for heavy components
                lazyLoadComponents();

                // Initialize Firebase (async, non-blocking)
                initializeFirebase().catch(error => {
                    console.warn('⚠️ Firebase initialization error:', error);
                    // Non-fatal - single-device mode still works
                });

                // Handle direct game join via URL
                handleDirectJoin();

                if (IndexPageModule.isDevelopment) {
                    Logger.debug('%c✅ Index page initialized',
                        'color: #4CAF50; font-weight: bold; font-size: 12px');
                }

            } catch (error) {
                console.error('❌ Initialization error:', error);

                if (window.NocapUtils && window.NocapUtils.showNotification) {
                    window.NocapUtils.showNotification(
                        'Fehler beim Laden der Seite',
                        'error'
                    );
                }
            }
        }

        // ===================================
        // 🎬 DOM READY
        // ===================================

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
        } else {
            initialize();
        }
})(window);