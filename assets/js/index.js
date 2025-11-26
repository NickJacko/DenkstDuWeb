/**
 * No-Cap Landing Page - Main Script
 * Version 4.0 - Production Ready (Audit-Fixed)
 *
 * ✅ P0 FIX: DOMPurify fallback instead of fatal error
 * ✅ P1 FIX: Device mode REMOVED from landing (set on target pages)
 * ✅ P1 FIX: Deprecated firebase-config.js removed
 * ✅ P2 FIX: Animations via CSS (prefers-reduced-motion)
 */

(function(window) {
    'use strict';

    // ===========================
    // GLOBAL STATE
    // ===========================
    let ageVerified = false;
    let isAdult = false;
    let alcoholMode = false;
    let gameState = null;
    let directJoinInterval = null;

    // Environment detection
    const isDevelopment = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('192.168.');

    // ===========================
    // P0 FIX: DOMPURIFY VALIDATION
    // ===========================

    /**
     * Check if DOMPurify is available - show friendly error instead of crash
     */
    function checkDOMPurify() {
        if (typeof DOMPurify === 'undefined') {
            console.error('❌ CRITICAL: DOMPurify not loaded!');

            // Show user-friendly error modal instead of alert
            const errorModal = document.createElement('div');
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
            errorModal.innerHTML = `
                <div style="text-align: center; padding: 2rem; max-width: 500px;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">🛡️</div>
                    <h2 style="margin-bottom: 1rem;">Sicherheitskomponente nicht geladen</h2>
                    <p style="margin-bottom: 2rem; opacity: 0.8;">
                        Die Sicherheitskomponente konnte nicht geladen werden.<br>
                        Bitte lade die Seite neu.
                    </p>
                    <button onclick="location.reload()" style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border: none;
                        padding: 1rem 2rem;
                        border-radius: 12px;
                        font-size: 1rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: transform 0.2s;
                    " onmouseover="this.style.transform='scale(1.05)'" 
                       onmouseout="this.style.transform='scale(1)'">
                        🔄 Seite neu laden
                    </button>
                </div>
            `;
            document.body.appendChild(errorModal);
            return false;
        }
        return true;
    }

    // ===========================
    // AGE VERIFICATION
    // ===========================

    /**
     * Show age verification modal
     */
    function showAgeModal() {
        const modal = document.getElementById('age-modal');
        const mainApp = document.getElementById('main-app');

        if (modal && mainApp) {
            modal.style.display = 'flex';
            mainApp.style.filter = 'blur(5px)';
            mainApp.style.pointerEvents = 'none';

            // Focus trap for accessibility
            if (window.NocapUtils && window.NocapUtils.trapFocus) {
                const cleanup = window.NocapUtils.trapFocus(modal);
                modal._focusTrapCleanup = cleanup;
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
     * Hide age verification modal
     */
    function hideAgeModal() {
        const modal = document.getElementById('age-modal');
        const mainApp = document.getElementById('main-app');

        if (modal && mainApp) {
            modal.style.display = 'none';
            mainApp.style.filter = 'none';
            mainApp.style.pointerEvents = 'auto';

            // Cleanup focus trap
            if (modal._focusTrapCleanup && typeof modal._focusTrapCleanup === 'function') {
                modal._focusTrapCleanup();
                modal._focusTrapCleanup = null;
            }
        }
    }

    /**
     * Save age verification with validation
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
     * Update Firebase with age verification
     */
    async function updateFirebaseAgeVerification(ageLevel) {
        try {
            // P1 FIX: Check if firebase-service is available (no more firebase-config)
            if (!window.FirebaseService) {
                return;
            }

            const userId = window.FirebaseService.getCurrentUserId?.();
            if (!userId || !firebase || !firebase.database) {
                return;
            }

            await firebase.database().ref(`users/${userId}`).update({
                ageVerified: true,
                ageVerificationLevel: ageLevel,
                lastAgeVerification: firebase.database.ServerValue.TIMESTAMP
            });

            if (isDevelopment) {
                console.log('✅ Firebase age verification updated');
            }

        } catch (error) {
            console.warn('⚠️ Could not update age verification in DB:', error);
        }
    }

    /**
     * Load age verification with validation
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
                return false;
            }

            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;

            // Check if verification is still valid (24 hours)
            if (verification.timestamp && now - verification.timestamp < oneDay) {
                ageVerified = verification.ageVerified === true;
                isAdult = verification.isAdult === true;
                alcoholMode = verification.alcoholMode === true;

                return true;
            } else {
                // Expired - clear it
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
     * Clear verification
     */
    function clearVerification() {
        if (window.NocapUtils) {
            window.NocapUtils.removeLocalStorage('nocap_age_verification');
            window.NocapUtils.removeLocalStorage('nocap_age_level');
        } else {
            localStorage.removeItem('nocap_age_verification');
            localStorage.removeItem('nocap_age_level');
        }
    }

    /**
     * Update UI based on age verification (safe DOM manipulation)
     */
    function updateUIForVerification() {
        if (!alcoholMode) {
            // Use textContent instead of innerHTML
            const drinkIcon = document.getElementById('drink-icon');
            const drinkText = document.getElementById('drink-text');
            const step4Text = document.getElementById('step4-text');

            if (drinkIcon) {
                drinkIcon.textContent = '🎯';
            }

            if (drinkText) {
                drinkText.textContent = 'Bekomme Challenges bei falschen Schätzungen';
            }

            if (step4Text) {
                step4Text.textContent = 'Wer falsch lag, bekommt eine Challenge!';
            }
        }
    }

    // ===========================
    // FIREBASE INITIALIZATION
    // ===========================

    /**
     * Initialize Firebase with better error handling
     */
    async function initializeFirebase() {
        try {
            // P1 FIX: Check for FirebaseService instead of deprecated FirebaseConfig
            if (!window.FirebaseService) {
                console.warn('⚠️ FirebaseService not available - offline mode');
                return false;
            }

            // Wait for Firebase to be ready
            if (window.FirebaseService.waitForFirebase) {
                await window.FirebaseService.waitForFirebase();
            }

            // Try anonymous sign-in for immediate gameplay
            if (window.FirebaseService.signInAnonymously) {
                const result = await window.FirebaseService.signInAnonymously();

                if (!result || !result.success) {
                    console.warn('⚠️ Anonymous sign-in failed - offline mode');
                    return false;
                }
            }

            if (isDevelopment) {
                console.log('✅ Firebase initialized successfully');
            }

            return true;

        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
            return false;
        }
    }

    // ===========================
    // GAME MODE SELECTION
    // ===========================

    /**
     * Validate state before navigation
     */
    function validateGameState() {
        if (!ageVerified) {
            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    'Bitte bestätige zuerst dein Alter',
                    'warning'
                );
            }
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
     * ✅ P1 FIX: Start single device mode - NO device mode setting here
     */
    function startSingleDevice() {
        if (!validateGameState()) {
            return;
        }

        try {
            // ✅ ONLY store age/alcohol flags - device mode is set on category-selection.html
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
     * ✅ P1 FIX: Start multiplayer mode - NO device mode setting here
     */
    function startMultiplayer() {
        if (!validateGameState()) {
            return;
        }

        // Check privacy consent
        if (window.NocapPrivacy && !window.NocapPrivacy.hasPrivacyConsent()) {
            window.NocapPrivacy.showPrivacyConsent();
            return;
        }

        try {
            // ✅ ONLY flag as host - device mode is set on multiplayer-category-selection.html
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
     * ✅ P1 FIX: Join existing game - NO device mode setting here
     */
    function joinGame() {
        if (!validateGameState()) {
            return;
        }

        // Check privacy consent
        if (window.NocapPrivacy && !window.NocapPrivacy.hasPrivacyConsent()) {
            window.NocapPrivacy.showPrivacyConsent();
            return;
        }

        try {
            // ✅ ONLY flag as guest - device mode is set on join-game.html
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

    // ===========================
    // ANIMATION HELPERS
    // ===========================

    /**
     * ✅ P2 FIX: Animate mode cards via CSS classes (respects prefers-reduced-motion)
     */
    function animateCards() {
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
            // Skip animations for accessibility
            return;
        }

        setTimeout(() => {
            const cards = document.querySelectorAll('.mode-card');

            cards.forEach((card, index) => {
                setTimeout(() => {
                    card.classList.add('card-animate-in');
                }, index * 200);
            });
        }, 500);
    }

    /**
     * Smooth scroll to section
     */
    function smoothScrollTo(target) {
        const element = document.querySelector(target);
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    // ===========================
    // URL PARAMETER HANDLING
    // ===========================

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
            : { valid: /^[A-Z0-9]{6}$/i.test(gameId), gameId: gameId.toUpperCase() };

        if (!validation.valid) {
            console.warn('⚠️ Invalid gameId format:', gameId);

            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification('Ungültiger Spiel-Code', 'error');
            }
            return;
        }

        const sanitizedGameId = validation.gameId;

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

    // ===========================
    // EVENT LISTENERS
    // ===========================

    /**
     * Setup all event listeners with proper cleanup tracking
     */
    function setupEventListeners() {
        // Age checkbox
        const ageCheckbox = document.getElementById('age-checkbox');
        const btn18Plus = document.getElementById('btn-18plus');

        if (ageCheckbox && btn18Plus) {
            ageCheckbox.addEventListener('change', function() {
                btn18Plus.disabled = !this.checked;
                btn18Plus.setAttribute('aria-disabled', !this.checked);

                if (this.checked) {
                    btn18Plus.classList.add('enabled');
                } else {
                    btn18Plus.classList.remove('enabled');
                }
            });
        }

        // 18+ button
        if (btn18Plus) {
            btn18Plus.addEventListener('click', function() {
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
            btnUnder18.addEventListener('click', function() {
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
            btnSingle.addEventListener('click', startSingleDevice);
        }

        const btnMulti = document.getElementById('btn-multi');
        if (btnMulti) {
            btnMulti.addEventListener('click', startMultiplayer);
        }

        const btnJoin = document.getElementById('btn-join');
        if (btnJoin) {
            btnJoin.addEventListener('click', joinGame);
        }

        // Mode cards clickable (keyboard support)
        const modeSingle = document.getElementById('mode-single');
        if (modeSingle) {
            modeSingle.addEventListener('click', function(e) {
                if (e.target.tagName !== 'BUTTON') {
                    startSingleDevice();
                }
            });

            modeSingle.addEventListener('keydown', function(e) {
                if ((e.key === 'Enter' || e.key === ' ') && e.target === modeSingle) {
                    e.preventDefault();
                    startSingleDevice();
                }
            });
        }

        const modeMulti = document.getElementById('mode-multi');
        if (modeMulti) {
            modeMulti.addEventListener('click', function(e) {
                if (e.target.tagName !== 'BUTTON') {
                    startMultiplayer();
                }
            });

            modeMulti.addEventListener('keydown', function(e) {
                if ((e.key === 'Enter' || e.key === ' ') && e.target === modeMulti) {
                    e.preventDefault();
                    startMultiplayer();
                }
            });
        }

        const modeJoin = document.getElementById('mode-join');
        if (modeJoin) {
            modeJoin.addEventListener('click', function(e) {
                if (e.target.tagName !== 'BUTTON') {
                    joinGame();
                }
            });

            modeJoin.addEventListener('keydown', function(e) {
                if ((e.key === 'Enter' || e.key === ' ') && e.target === modeJoin) {
                    e.preventDefault();
                    joinGame();
                }
            });
        }

        // Scroll indicator (Keyboard support)
        const scrollIndicator = document.getElementById('scroll-indicator');
        if (scrollIndicator) {
            scrollIndicator.addEventListener('click', function() {
                smoothScrollTo('.game-modes');
            });

            scrollIndicator.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    smoothScrollTo('.game-modes');
                }
            });
        }
    }

    // ===========================
    // CLEANUP
    // ===========================

    /**
     * Cleanup on page unload
     */
    function cleanup() {
        if (directJoinInterval) {
            clearInterval(directJoinInterval);
            directJoinInterval = null;
        }

        // Cleanup utils
        if (window.NocapUtils && window.NocapUtils.cleanupEventListeners) {
            window.NocapUtils.cleanupEventListeners();
        }

        if (isDevelopment) {
            console.log('✅ Index page cleanup completed');
        }
    }

    window.addEventListener('beforeunload', cleanup);

    // ===========================
    // INITIALIZATION
    // ===========================

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
            } else {
                showAgeModal();
            }

            // Setup event listeners
            setupEventListeners();

            // Initialize Firebase (async, non-blocking)
            initializeFirebase().catch(error => {
                console.warn('Firebase initialization error:', error);
            });

            // Handle direct game join via URL
            handleDirectJoin();

            if (isDevelopment) {
                console.log('✅ Index page initialized');
            }

        } catch (error) {
            console.error('❌ Initialization error:', error);
        }
    }

    // ===========================
    // DOM READY
    // ===========================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})(window);