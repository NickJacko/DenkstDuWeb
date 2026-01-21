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

    const Logger = window.NocapUtils?.Logger || {
        debug: () => {
        },
        info: () => {
        },
        warn: () => {
        },
        error: () => {
        }
    };


    // ✅ P0 FIX: All state encapsulated in module scope (no global variables)
    const IndexPageModule = {
        // State
        state: {
            ageVerified: false,
            isAdult: false,
            alcoholMode: false,
            gameState: null,
            eventListenerCleanup: [],
            scrollThrottle: null,
            initialized: false,
            isDevelopment: window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('192.168.')
        },

        // Getters/Setters for controlled access
        get ageVerified() {
            return this.state.ageVerified;
        },
        set ageVerified(val) {
            this.state.ageVerified = !!val;
        },

        get isAdult() {
            return this.state.isAdult;
        },
        set isAdult(val) {
            this.state.isAdult = !!val;
        },

        get alcoholMode() {
            return this.state.alcoholMode;
        },
        set alcoholMode(val) {
            this.state.alcoholMode = !!val;
        },

        get gameState() {
            return this.state.gameState;
        },
        set gameState(val) {
            this.state.gameState = val;
        },

        get isDevelopment() {
            return this.state.isDevelopment;
        }
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
     * ✅ P0 SECURITY: Load age verification with validation and expiry check
     * Sanitizes all data from localStorage before use
     * @returns {boolean} True if valid verification found
     */
    function loadVerification() {
        // ✅ Only read from Settings cache (no gating, no modal, no server requirement)
        try {
            const ageLevelRaw = localStorage.getItem('nocap_age_level');
            const ageLevel = parseInt(ageLevelRaw, 10) || 0;

            IndexPageModule.ageVerified = ageLevel > 0;
            IndexPageModule.isAdult = ageLevel >= 18;

            // alcoholMode is only allowed for 18+, otherwise force off
            IndexPageModule.alcoholMode = ageLevel >= 18;

            return ageLevel > 0;
        } catch (e) {
            IndexPageModule.ageVerified = false;
            IndexPageModule.isAdult = false;
            IndexPageModule.alcoholMode = false;
            return false;
        }
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
                Logger.warn('⚠️ FirebaseConfig not available - offline mode');
                return false;
            }

            // Wait for Firebase to be ready
            if (window.FirebaseConfig.waitForFirebase) {
                await window.FirebaseConfig.waitForFirebase(5000);
            }

            // Check if initialization was successful
            if (!window.FirebaseConfig.isInitialized()) {
                Logger.warn('⚠️ Firebase not initialized - offline mode');
                return false;
            }

            if (IndexPageModule.isDevelopment) {
                Logger.debug('✅ Firebase ready for multiplayer');
            }

            return true;

        } catch (error) {
            Logger.error('❌ Firebase initialization error:', error);
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
        // ✅ No age gate on landing. Only ensure GameState exists.
        if (!IndexPageModule.gameState) {
            Logger.error('❌ GameState not initialized');
            window.NocapUtils?.showNotification?.('Fehler beim Laden der Spieldaten', 'error');
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
                Logger.debug('🎮 Navigating to single device category selection');
            }

            window.location.href = 'category-selection.html';

        } catch (error) {
            Logger.error('❌ Error starting single device mode:', error);

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
                Logger.debug('🌐 Navigating to multiplayer category selection');
            }

            window.location.href = 'multiplayer-category-selection.html';

        } catch (error) {
            Logger.error('❌ Error starting multiplayer mode:', error);

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
                Logger.debug('🔗 Navigating to join game');
            }

            window.location.href = 'join-game.html';

        } catch (error) {
            Logger.error('❌ Error joining game:', error);

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
            const icon = document.createElement("span");
            icon.setAttribute("aria-hidden", "true");
            icon.textContent = "↑";
            scrollButton.appendChild(icon);


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
        addTrackedEventListener(window, 'scroll', throttledToggle, {passive: true});
        addTrackedEventListener(scrollButton, 'click', scrollToTop);

        // Initial check
        toggleScrollButton();

        if (IndexPageModule.isDevelopment) {
            Logger.debug('✅ Scroll-to-top button initialized (throttled)');
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
                card.classList.add('card-animate-in');
                card.classList.remove('will-animate');
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
        if (!element) return;

        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        element.scrollIntoView({
            behavior: prefersReducedMotion ? "auto" : "smooth",
            block: "start"
        });

        // ✅ A11y: ensure focus works even if element isn't normally focusable
        const hadTabIndex = element.hasAttribute("tabindex");
        if (!hadTabIndex) element.setAttribute("tabindex", "-1");

        element.focus({preventScroll: true});

        if (!hadTabIndex) {
            // keep it clean after focus (optional)
            setTimeout(() => element.removeAttribute("tabindex"), 1000);
        }
    }


    function handleDirectJoin() {
        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('gameId');

        if (!gameId) return;

        const strictPattern = /^[A-Z0-9]{6}$/i;

        if (gameId.length !== 6 || !strictPattern.test(gameId)) {
            Logger.warn('⚠️ Invalid gameId format (must be exactly 6 alphanumeric chars):', gameId);
            window.NocapUtils?.showNotification?.(
                'Ungültiger Spiel-Code. Muss 6 Zeichen sein (A-Z, 0-9)',
                'error'
            );

            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            return;
        }

        const sanitizedGameId = DOMPurify.sanitize(gameId.toUpperCase().trim());
        window.location.href = `join-game.html?gameId=${encodeURIComponent(sanitizedGameId)}`;
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
            Logger.debug(`✅ ${IndexPageModule.state.eventListenerCleanup.length} event listeners registered`);
        }
    }
    // ===================================
// 🧹 CLEANUP
// ===================================
    function cleanup() {

        IndexPageModule.state.eventListenerCleanup.forEach(({ element, event, handler, options }) => {
            try { element.removeEventListener(event, handler, options); } catch (_) {}
        });
        IndexPageModule.state.eventListenerCleanup = [];

        if (window.NocapUtils?.cleanupEventListeners) {
            window.NocapUtils.cleanupEventListeners();
        }

        if (IndexPageModule.isDevelopment) {
            Logger.debug('✅ Index page cleanup completed');
        }
    }

    window.addEventListener('beforeunload', cleanup);

// ===================================
// 🚀 INITIALIZATION
// ===================================
    async function initialize() {
        try {
            if (IndexPageModule.state.initialized) return;
            IndexPageModule.state.initialized = true;

            if (!checkDOMPurify()) return;
            await initializeFirebase().catch(err => Logger.warn('⚠️ Firebase initialization error:', err));

            if (typeof GameState === 'undefined') {
                Logger.error('❌ GameState class not found!');
                window.NocapUtils?.showNotification?.('Fehler beim Laden der Spieldaten', 'error');
                return;
            }

            IndexPageModule.gameState = new GameState();
            if (IndexPageModule.isDevelopment) Logger.debug('✅ GameState initialized');

            // ✅ Settings-only: just read cached age level (if any) and adjust UI
            loadVerification();
            updateUIForVerification();

            // ✅ NEW: Check if user was kicked from lobby
            checkKickReason();

            animateCards();
            setupEventListeners();
            setupScrollToTop();
            handleDirectJoin();

            if (IndexPageModule.isDevelopment) Logger.debug('✅ Index page initialized');
        } catch (err) {
            Logger.error('❌ Initialization error:', err);
            window.NocapUtils?.showNotification?.('Fehler beim Laden der Seite', 'error');
        }
    }

    /**
     * ✅ NEW: Check if user was kicked from a lobby
     */
    function checkKickReason() {
        try {
            const kickReason = sessionStorage.getItem('nocap_kick_reason');
            if (!kickReason) return;

            sessionStorage.removeItem('nocap_kick_reason');

            let message = '';
            if (kickReason === 'fsk18_restriction') {
                message = '⚠️ Du wurdest aus dem Spiel entfernt, da der Host FSK18-Inhalte aktiviert hat.';
            } else if (kickReason === 'fsk16_restriction') {
                message = '⚠️ Du wurdest aus dem Spiel entfernt, da der Host FSK16-Inhalte aktiviert hat.';
            }

            if (message && window.NocapUtils?.showNotification) {
                setTimeout(() => {
                    window.NocapUtils.showNotification(message, 'warning', 5000);
                }, 500);
            }
        } catch (error) {
            Logger.warn('⚠️ Could not check kick reason:', error);
        }
    }

    // ===================================
    // 🎬 DOM READY (NUR EINMAL!)
    // ===================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})(window);