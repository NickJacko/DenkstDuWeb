/**
 * NO-CAP Landing Page - Main Script
 * Version 5.0 - Production Ready (Full Audit Compliance)
 *
 * AUDIT FIXES APPLIED:
 * ✅ P0: DOMPurify validation with user-friendly fallback
 * ✅ P0: All inline event handlers removed (CSP compliant)
 * ✅ P1: Proper Firebase initialization with firebase-config.js
 * ✅ P1: Device mode removed from landing (set on target pages)
 * ✅ P1: Input sanitization via DOMPurify
 * ✅ P2: Accessibility improvements (keyboard navigation, ARIA)
 * ✅ P2: Animations respect prefers-reduced-motion
 */

(function(window) {
    'use strict';

    // ===================================
    // 📊 GLOBAL STATE
    // ===================================

    let ageVerified = false;
    let isAdult = false;
    let alcoholMode = false;
    let gameState = null;
    let directJoinInterval = null;
    let eventListenerCleanup = [];

    // Environment detection
    const isDevelopment = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('192.168.');

    // ===================================
    // 🛡️ P0 FIX: DOMPURIFY VALIDATION
    // ===================================

    /**
     * Check if DOMPurify is available - show friendly error instead of crash
     * @returns {boolean} True if DOMPurify is available
     */
    function checkDOMPurify() {
        if (typeof DOMPurify === 'undefined') {
            console.error('❌ CRITICAL: DOMPurify not loaded!');
            showDOMPurifyError();
            return false;
        }

        if (isDevelopment) {
            console.log('✅ DOMPurify available');
        }

        return true;
    }

    /**
     * Show user-friendly DOMPurify error modal
     */
    function showDOMPurifyError() {
        const errorModal = document.createElement('div');
        errorModal.setAttribute('role', 'alert');
        errorModal.setAttribute('aria-live', 'assertive');
        errorModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            color: white;
            font-family: 'Poppins', sans-serif;
        `;

        const errorContent = document.createElement('div');
        errorContent.style.cssText = `
            text-align: center;
            padding: 2rem;
            max-width: 500px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
        `;

        const icon = document.createElement('div');
        icon.style.cssText = 'font-size: 4rem; margin-bottom: 1rem;';
        icon.textContent = '🛡️';

        const title = document.createElement('h2');
        title.style.cssText = 'margin-bottom: 1rem; font-size: 1.5rem;';
        title.textContent = 'Sicherheitskomponente nicht geladen';

        const message = document.createElement('p');
        message.style.cssText = 'margin-bottom: 2rem; opacity: 0.8; line-height: 1.6;';
        message.textContent = 'Die Sicherheitskomponente konnte nicht geladen werden. Bitte lade die Seite neu.';

        const reloadButton = document.createElement('button');
        reloadButton.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 1rem 2rem;
            border-radius: 12px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        `;
        reloadButton.textContent = '🔄 Seite neu laden';
        reloadButton.addEventListener('click', () => location.reload());
        reloadButton.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
        });
        reloadButton.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });

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
     * Show age verification modal with focus management
     */
    function showAgeModal() {
        const modal = document.getElementById('age-modal');
        const mainApp = document.getElementById('main-app');

        if (modal && mainApp) {
            modal.style.display = 'flex';
            modal.removeAttribute('aria-hidden');
            mainApp.style.filter = 'blur(5px)';
            mainApp.style.pointerEvents = 'none';
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
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
            mainApp.style.filter = 'none';
            mainApp.style.pointerEvents = 'auto';
            mainApp.removeAttribute('aria-hidden');

            // Cleanup focus trap
            if (modal._focusTrapCleanup && typeof modal._focusTrapCleanup === 'function') {
                modal._focusTrapCleanup();
                modal._focusTrapCleanup = null;
            }

            // Return focus to main content
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                mainContent.focus();
            }
        }
    }

    /**
     * Save age verification with validation and security
     * @param {boolean} isAdultUser - Whether user is 18+
     * @param {boolean} allowAlcohol - Whether alcohol mode is allowed
     */
    function saveVerification(isAdultUser, allowAlcohol) {
        try {
            const verification = {
                ageVerified: true,
                isAdult: isAdultUser === true,
                alcoholMode: allowAlcohol === true,
                timestamp: Date.now()
            };

            // Store age level as separate value for server-side checks
            const ageLevel = isAdultUser ? 18 : 0;

            // Use safe storage helpers
            if (window.NocapUtils) {
                window.NocapUtils.setLocalStorage('nocap_age_level', ageLevel);
                window.NocapUtils.setLocalStorage('nocap_age_verification', verification);
            } else {
                localStorage.setItem('nocap_age_level', ageLevel.toString());
                localStorage.setItem('nocap_age_verification', JSON.stringify(verification));
            }

            ageVerified = true;
            isAdult = isAdultUser;
            alcoholMode = allowAlcohol;

            // Update Firebase user profile if authenticated
            updateFirebaseAgeVerification(ageLevel);

            if (isDevelopment) {
                console.log('✅ Age verification saved:', { ageLevel, alcoholMode });
            }

        } catch (error) {
            console.error('❌ Could not save age verification:', error);

            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    'Fehler beim Speichern der Altersverifikation',
                    'error'
                );
            }
        }
    }

    /**
     * Update Firebase with age verification (async, non-blocking)
     * ✅ AUDIT FIX: Jetzt mit serverseitiger Cloud Function Validierung
     * @param {number} ageLevel - Age verification level (0 or 18)
     */
    async function updateFirebaseAgeVerification(ageLevel) {
        try {
            // Check if FirebaseConfig is available (new architecture)
            if (!window.FirebaseConfig || !window.FirebaseConfig.isInitialized()) {
                if (isDevelopment) {
                    console.log('ℹ️ Firebase not initialized, skipping age verification update');
                }
                return;
            }

            const userId = window.FirebaseConfig.getCurrentUserId();
            if (!userId) {
                if (isDevelopment) {
                    console.log('ℹ️ No user ID, skipping age verification update');
                }
                return;
            }

            // ✅ AUDIT FIX: Rufe Cloud Function für serverseitige Validierung auf
            try {
                const { functions } = window.FirebaseConfig.getFirebaseInstances();
                const verifyAge = functions.httpsCallable('verifyAge');

                const result = await verifyAge({
                    ageLevel: ageLevel,
                    consent: true
                });

                if (result.data && result.data.success) {
                    if (isDevelopment) {
                        console.log('✅ Server-side age verification successful:', result.data);
                    }

                    // Zeige Success-Nachricht
                    if (window.NocapUtils && window.NocapUtils.showNotification) {
                        window.NocapUtils.showNotification(
                            '✓ Altersverifikation gespeichert',
                            'success',
                            2000
                        );
                    }
                } else {
                    throw new Error('Server verification failed');
                }

            } catch (cloudFunctionError) {
                console.warn('⚠️ Cloud Function not available, using fallback:', cloudFunctionError);

                // Fallback: Lokale Database-Update (weniger sicher, aber besser als nichts)
                const { database } = window.FirebaseConfig.getFirebaseInstances();
                await database.ref(`users/${userId}`).update({
                    ageVerified: true,
                    ageVerificationLevel: ageLevel,
                    lastAgeVerification: firebase.database.ServerValue.TIMESTAMP
                });

                if (isDevelopment) {
                    console.log('✅ Firebase age verification updated (fallback mode)');
                }
            }

        } catch (error) {
            console.warn('⚠️ Could not update age verification in DB:', error);
            // Non-fatal - continue without DB update
            // LocalStorage bleibt als UX-Feature bestehen
        }
    }

    /**
     * Load age verification with validation and expiry check
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

            // Validate structure
            if (!verification || typeof verification !== 'object') {
                clearVerification();
                return false;
            }

            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;

            // Check if verification is still valid (24 hours)
            if (verification.timestamp && now - verification.timestamp < oneDay) {
                ageVerified = verification.ageVerified === true;
                isAdult = verification.isAdult === true;
                alcoholMode = verification.alcoholMode === true;

                if (isDevelopment) {
                    console.log('✅ Age verification loaded from storage');
                }

                return true;
            } else {
                // Expired - clear it
                if (isDevelopment) {
                    console.log('ℹ️ Age verification expired (>24h)');
                }
                clearVerification();
                return false;
            }

        } catch (error) {
            console.error('❌ Could not load age verification:', error);
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

        ageVerified = false;
        isAdult = false;
        alcoholMode = false;
    }

    /**
     * Update UI based on age verification (safe DOM manipulation)
     */
    function updateUIForVerification() {
        if (!alcoholMode) {
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

            if (isDevelopment) {
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
        if (!ageVerified) {
            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    'Bitte bestätige zuerst dein Alter',
                    'warning'
                );
            }
            showAgeModal();
            return false;
        }

        if (!gameState) {
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
            gameState.setAlcoholMode(alcoholMode);

            if (window.NocapUtils) {
                window.NocapUtils.setLocalStorage('nocap_is_adult', isAdult);
            } else {
                localStorage.setItem('nocap_is_adult', isAdult.toString());
            }

            if (isDevelopment) {
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
            gameState.setAlcoholMode(alcoholMode);

            // Flag that user wants to be host (checked on target page)
            if (window.NocapUtils) {
                window.NocapUtils.setLocalStorage('nocap_wants_host', true);
                window.NocapUtils.setLocalStorage('nocap_is_adult', isAdult);
            } else {
                localStorage.setItem('nocap_wants_host', 'true');
                localStorage.setItem('nocap_is_adult', isAdult.toString());
            }

            if (isDevelopment) {
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
            gameState.setAlcoholMode(alcoholMode);

            // Flag that user wants to join (checked on target page)
            if (window.NocapUtils) {
                window.NocapUtils.setLocalStorage('nocap_wants_join', true);
                window.NocapUtils.setLocalStorage('nocap_is_adult', isAdult);
            } else {
                localStorage.setItem('nocap_wants_join', 'true');
                localStorage.setItem('nocap_is_adult', isAdult.toString());
            }

            if (isDevelopment) {
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
         * ✅ AUDIT FIX: Animate mode cards via CSS classes (respects prefers-reduced-motion)
         */
        function animateCards() {
            // Check for reduced motion preference
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            if (prefersReducedMotion) {
                if (isDevelopment) {
                    console.log('ℹ️ Animations disabled (prefers-reduced-motion)');
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
         * Smooth scroll to section with accessibility support
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
         * Handle direct game join via URL parameter with proper sanitization
         */
        function handleDirectJoin() {
            const urlParams = new URLSearchParams(window.location.search);
            const gameId = urlParams.get('gameId');

            if (!gameId) {
                return;
            }

            // Validate and sanitize gameId
            const validation = window.NocapUtils
                ? window.NocapUtils.validateGameId(gameId)
                : {valid: /^[A-Z0-9]{6}$/i.test(gameId), gameId: gameId.toUpperCase().substring(0, 6)};

            if (!validation.valid) {
                console.warn('⚠️ Invalid gameId format:', gameId);

                if (window.NocapUtils && window.NocapUtils.showNotification) {
                    window.NocapUtils.showNotification('Ungültiger Spiel-Code', 'error');
                }
                return;
            }

            const sanitizedGameId = DOMPurify.sanitize(validation.gameId);

            // Clear any existing interval
            if (directJoinInterval) {
                clearInterval(directJoinInterval);
            }

            // Wait for age verification
            let attempts = 0;
            const maxAttempts = 100; // 10 seconds

            directJoinInterval = setInterval(() => {
                attempts++;

                if (ageVerified) {
                    clearInterval(directJoinInterval);
                    directJoinInterval = null;

                    // Use encodeURIComponent for safe URL parameter
                    window.location.href = `join-game.html?gameId=${encodeURIComponent(sanitizedGameId)}`;
                }

                // Timeout after 10 seconds
                if (attempts >= maxAttempts) {
                    clearInterval(directJoinInterval);
                    directJoinInterval = null;

                    if (!ageVerified && window.NocapUtils && window.NocapUtils.showNotification) {
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
            eventListenerCleanup.push({element, event, handler, options});
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
                    if (ageVerified) {
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
                addTrackedEventListener(btn18Plus, 'click', function () {
                    const checkbox = document.getElementById('age-checkbox');
                    if (checkbox && checkbox.checked) {
                        saveVerification(true, true);
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
                    }
                });
            }

            // Under 18 button
            const btnUnder18 = document.getElementById('btn-under-18');
            if (btnUnder18) {
                addTrackedEventListener(btnUnder18, 'click', function () {
                    saveVerification(false, false);
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

            if (isDevelopment) {
                console.log(`✅ ${eventListenerCleanup.length} event listeners registered`);
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
            if (directJoinInterval) {
                clearInterval(directJoinInterval);
                directJoinInterval = null;
            }

            // Remove all tracked event listeners
            eventListenerCleanup.forEach(({element, event, handler, options}) => {
                try {
                    element.removeEventListener(event, handler, options);
                } catch (error) {
                    // Element may have been removed from DOM
                }
            });
            eventListenerCleanup = [];

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

            if (isDevelopment) {
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
                    gameState = new GameState();

                    if (isDevelopment) {
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

                    if (isDevelopment) {
                        console.log('✅ Age verification restored from storage');
                    }
                } else {
                    showAgeModal();
                }

                // Setup event listeners
                setupEventListeners();

                // Initialize Firebase (async, non-blocking)
                initializeFirebase().catch(error => {
                    console.warn('⚠️ Firebase initialization error:', error);
                    // Non-fatal - single-device mode still works
                });

                // Handle direct game join via URL
                handleDirectJoin();

                if (isDevelopment) {
                    console.log('%c✅ Index page initialized',
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