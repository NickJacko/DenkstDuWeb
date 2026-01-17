/**
 * No-Cap Multiplayer Category Selection
 * Version 5.1 - BUGFIX: addEventListener Errors
 *
 * CRITICAL: This page is the "Source of Truth" for Multiplayer Host Mode
 * - Sets deviceMode = 'multi'
 * - Sets isHost = true, isGuest = false
 * - Creates/manages Firebase game
 *
 * ✅ P0: Module Pattern - no global variables (XSS prevention)
 * ✅ P0: Event-Listener cleanup on beforeunload
 * ✅ P0: MANDATORY server-side premium validation
 * ✅ BUGFIX: Corrected addEventListener usage
 */

(function(window) {
    'use strict';

    // Get Logger from utils
    const Logger = window.NocapUtils?.Logger || {
        debug: (...args) => {},
        info: (...args) => {},
        warn: console.warn,
        error: console.error
    };

    // ===========================
    // 🔒 MODULE SCOPE - NO GLOBAL POLLUTION
    // ===========================

    const MultiplayerCategoryModule = {
        state: {
            gameState: null,
            firebaseService: null,
            questionCounts: { fsk0: 200, fsk16: 300, fsk18: 250, special: 150 },
            playerNameConfirmed: false,
            isHost: true,
            eventListenerCleanup: [],
            isDevelopment: window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1'
        },

        get gameState() { return this.state.gameState; },
        set gameState(val) { this.state.gameState = val; },

        get firebaseService() { return this.state.firebaseService; },
        set firebaseService(val) { this.state.firebaseService = val; },

        get questionCounts() { return this.state.questionCounts; },

        get playerNameConfirmed() { return this.state.playerNameConfirmed; },
        set playerNameConfirmed(val) { this.state.playerNameConfirmed = !!val; },

        get isHost() { return this.state.isHost; },
        set isHost(val) { this.state.isHost = !!val; },

        get isDevelopment() { return this.state.isDevelopment; }
    };

    Object.seal(MultiplayerCategoryModule.state);

    // ===========================
    // 🛠️ PERFORMANCE UTILITIES
    // ===========================

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

    // ✅ BUGFIX: Corrected function name and implementation
    function addTrackedEventListener(element, event, handler, options = {}) {
        if (!element) return;
        element.addEventListener(event, handler, options);
        MultiplayerCategoryModule.state.eventListenerCleanup.push({element, event, handler, options});
    }

    // ===========================
    // CONSTANTS
    // ===========================
    const categoryData = {
        fsk0: {
            name: 'Familie & Freunde',
            icon: '👨‍👩‍👧‍👦',
            color: '#4CAF50',
            fsk: 'FSK 0',
            ageRange: 'Ab 0 Jahren',
            description: 'Lustige und harmlose Fragen für die ganze Familie',
            examples: ['...gemeinsam mit der Familie verreist?', '...im Supermarkt etwas vergessen?']
        },
        fsk16: {
            name: 'Party Time',
            icon: '🎉',
            color: '#FF9800',
            fsk: 'FSK 16',
            ageRange: 'Ab 16 Jahren',
            description: 'Freche und witzige Fragen für Partys mit Freunden',
            examples: ['...auf einer Party eingeschlafen?', '...den Namen vergessen?']
        },
        fsk18: {
            name: 'Heiß & Gewagt',
            icon: '🔥',
            color: '#F44336',
            fsk: 'FSK 18',
            ageRange: 'Nur Erwachsene',
            description: 'Intime und pikante Fragen nur für Erwachsene',
            examples: ['...an einem öffentlichen Ort...?', '...mit jemandem...?']
        },
        special: {
            name: 'Special Edition',
            icon: '⭐',
            color: '#FFD700',
            fsk: 'Premium',
            ageRange: 'Exklusiv',
            description: 'Exklusive Premium-Fragen für besondere Momente',
            examples: ['Premium Inhalte', 'Exklusive Fragen']
        }
    };

    // ===========================
    // INITIALIZATION
    // ===========================

    async function initialize() {
        Logger.debug('🌐 Initializing multiplayer category selection...');

        // P0 FIX: Check DOMPurify
        if (typeof DOMPurify === 'undefined') {
            Logger.error('❌ CRITICAL: DOMPurify not loaded!');
            alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
            return;
        }

        // ✅ BUGFIX: Check for window.GameState (constructor)
        if (typeof window.GameState === 'undefined') {
            showNotification('Fehler beim Laden', 'error');
            return;
        }
// ✅ Ensure Firebase is initialized
        try {
            if (!window.FirebaseConfig?.isInitialized?.()) {
                await window.FirebaseConfig.initialize();
            }
            await window.FirebaseConfig.waitForFirebase(10000);
        } catch (e) {
            Logger.warn('⚠️ Firebase not ready yet:', e);
        }

        // P1 FIX: Wait for dependencies
        if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
            await window.NocapUtils.waitForDependencies(['GameState', 'FirebaseService']);
        }

        MultiplayerCategoryModule.gameState = new window.GameState();

        // CRITICAL: Always set device mode to 'multi' for multiplayer pages
        MultiplayerCategoryModule.gameState.setDeviceMode('multi');
        Logger.debug('📱 Device mode set to: multi');

        // CRITICAL: DEVICE MODE ENFORCEMENT
        Logger.debug('🎮 Checking user role...');

        // Check if user explicitly wants to be host (coming from index.html)
        let wantsHost = false;
        try {
            if (window.NocapUtils) {
                wantsHost = window.NocapUtils.getLocalStorage('nocap_wants_host') === true ||
                           window.NocapUtils.getLocalStorage('nocap_wants_host') === 'true';
            } else {
                wantsHost = localStorage.getItem('nocap_wants_host') === 'true';
            }
        } catch (error) {
            Logger.warn('⚠️ Could not check nocap_wants_host flag:', error);
        }

        // Check if user is guest
        if (MultiplayerCategoryModule.gameState.isGuest === true ||
            (MultiplayerCategoryModule.gameState.gameId && !MultiplayerCategoryModule.gameState.isHost)) {
            // Only stay as guest if they didn't explicitly request to be host
            if (!wantsHost) {
                MultiplayerCategoryModule.isHost = false;
                MultiplayerCategoryModule.gameState.isHost = false;
                MultiplayerCategoryModule.gameState.isGuest = true;
                Logger.debug('👤 User is GUEST - showing read-only view');
            } else {
                // User wants to be host, override guest status
                MultiplayerCategoryModule.isHost = true;
                MultiplayerCategoryModule.gameState.isHost = true;
                MultiplayerCategoryModule.gameState.isGuest = false;
                Logger.debug('👑 User wants HOST (overriding guest state) - showing editable view');
            }
        } else {
            // Force host mode
            MultiplayerCategoryModule.isHost = true;
            MultiplayerCategoryModule.gameState.isHost = true;
            MultiplayerCategoryModule.gameState.isGuest = false;
            Logger.debug('👑 User is HOST - showing editable view');
        }

        Logger.debug('✅ User role set:', {
            deviceMode: MultiplayerCategoryModule.gameState.deviceMode,
            isHost: MultiplayerCategoryModule.isHost,
            isGuest: MultiplayerCategoryModule.gameState.isGuest
        });

        // Clear the wants_host flag after using it
        if (wantsHost) {
            try {
                if (window.NocapUtils) {
                    window.NocapUtils.removeLocalStorage('nocap_wants_host');
                } else {
                    localStorage.removeItem('nocap_wants_host');
                }
                Logger.debug('✅ Cleared nocap_wants_host flag');
            } catch (error) {
                Logger.warn('⚠️ Could not clear nocap_wants_host flag:', error);
            }
        }

        // ✅ BUGFIX: Use window.FirebaseService
        if (typeof window.FirebaseService !== 'undefined') {
            MultiplayerCategoryModule.firebaseService = window.FirebaseService;
        } else {
            Logger.error('❌ Firebase service not available');
            showNotification('Firebase nicht verfügbar', 'error');
            setTimeout(() => window.location.href = 'index.html', 3000);
            return;
        }

        // P0 FIX: Check age verification with expiration
        if (!checkAgeVerification()) {
            return;
        }

        // Validate game state
        if (!validateGameState()) {
            return;
        }

        // Update UI with player info
        updateHeaderInfo();

        // Check if player name already set
        if (MultiplayerCategoryModule.gameState.playerName &&
            MultiplayerCategoryModule.gameState.playerName.trim()) {
            MultiplayerCategoryModule.playerNameConfirmed = true;
            showCategorySelection();
        } else {
            showPlayerNameInput();
        }

        // Initialize Firebase and load data
        await checkPremiumStatus();
        await loadQuestionCounts();

        // Render categories
        await renderCategoryCards();

        // Setup event listeners
        setupEventListeners();

        // Load from gameState
        if (MultiplayerCategoryModule.playerNameConfirmed) {
            initializeSelectedCategories();

            // Mark guest as ready when they view categories
            if (!MultiplayerCategoryModule.isHost) {
                setTimeout(() => markPlayerReady(), 1000);
            }
        }

        Logger.debug('✅ Multiplayer category selection initialized');
    }

    // ===========================
    // PLAYER NAME INPUT
    // ===========================

    function showPlayerNameInput() {
        const nameSection = document.getElementById('player-name-section');
        const categoryContainer = document.getElementById('category-selection-container');
        const multiplayerHeader = document.getElementById('multiplayer-header');
        const nameInput = document.getElementById('player-name-input');

        if (nameSection) nameSection.classList.remove('hidden');
        if (categoryContainer) categoryContainer.classList.add('hidden');
        if (multiplayerHeader) multiplayerHeader.classList.add('hidden');

        // ✅ Load display name from settings (if set)
        if (nameInput) {
            try {
                // Try to get display name from localStorage (set by settings.js)
                const savedDisplayName = window.NocapUtils
                    ? window.NocapUtils.getLocalStorage('nocap_display_name')
                    : localStorage.getItem('nocap_display_name');

                if (savedDisplayName && savedDisplayName.trim()) {
                    nameInput.value = savedDisplayName.trim();
                    Logger.debug('✅ Pre-filled name from settings:', savedDisplayName);

                    // Trigger input event to enable confirm button
                    const event = new Event('input', { bubbles: true });
                    nameInput.dispatchEvent(event);
                }
            } catch (error) {
                Logger.warn('⚠️ Could not load display name from settings:', error);
            }
        }
    }

    function showCategorySelection() {
        const nameSection = document.getElementById('player-name-section');
        const categoryContainer = document.getElementById('category-selection-container');
        const multiplayerHeader = document.getElementById('multiplayer-header');

        if (nameSection) nameSection.classList.add('hidden');
        if (categoryContainer) categoryContainer.classList.remove('hidden');
        if (multiplayerHeader) multiplayerHeader.classList.remove('hidden');

        updateHeaderInfo();
    }

    function handleNameInput(e) {
        const input = e.target;
        const confirmBtn = document.getElementById('confirm-name-btn');
        const value = input.value.trim();

        if (confirmBtn) {
            if (value.length >= 2) {
                confirmBtn.disabled = false;
                confirmBtn.classList.remove('disabled');
                confirmBtn.setAttribute('aria-disabled', 'false');
            } else {
                confirmBtn.disabled = true;
                confirmBtn.classList.add('disabled');
                confirmBtn.setAttribute('aria-disabled', 'true');
            }
        }
    }

    function confirmPlayerName() {
        const nameInput = document.getElementById('player-name-input');
        if (!nameInput) return;

        const playerName = sanitizeText(nameInput.value.trim());

        if (playerName.length < 2) {
            showNotification('Name muss mindestens 2 Zeichen haben', 'warning');
            return;
        }

        if (playerName.length > 20) {
            showNotification('Name darf maximal 20 Zeichen haben', 'warning');
            return;
        }

        MultiplayerCategoryModule.gameState.setPlayerName(playerName);
        MultiplayerCategoryModule.playerNameConfirmed = true;

        // ✅ Save display name to settings (sync with settings.js)
        try {
            if (window.NocapUtils && window.NocapUtils.setLocalStorage) {
                window.NocapUtils.setLocalStorage('nocap_display_name', playerName);
            } else {
                localStorage.setItem('nocap_display_name', playerName);
            }
            Logger.debug('✅ Display name saved to settings');
        } catch (error) {
            Logger.warn('⚠️ Could not save display name to settings:', error);
        }

        Logger.debug('✅ Player name set and saved:', playerName);

        showNotification(`Willkommen ${playerName}! 👋`, 'success', 1500);

        setTimeout(() => {
            showCategorySelection();
        }, 500);
    }

    // ===========================
    // VALIDATION
    // ===========================

    function validateGameState() {
        Logger.debug('🔍 Validating game state...');

        // P0 FIX: Strict device mode check
        if (!MultiplayerCategoryModule.gameState ||
            MultiplayerCategoryModule.gameState.deviceMode !== 'multi') {
            Logger.error('❌ Wrong device mode:', MultiplayerCategoryModule.gameState?.deviceMode);
            showNotification('Falscher Spielmodus', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        // P0 FIX: Verify host status
        if (!MultiplayerCategoryModule.gameState.isHost) {
            Logger.error('❌ Not host');
            showNotification('Du bist nicht der Host', 'error');
            setTimeout(() => window.location.href = 'multiplayer-lobby.html', 2000);
            return false;
        }

        if (!MultiplayerCategoryModule.gameState.checkValidity()) {
            showNotification('Ungültiger Spielzustand', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        Logger.debug('✅ Game state valid');
        return true;
    }

    // ===========================
    // AGE VERIFICATION
    // ===========================

    function checkAgeVerification() {
        try {
            const getLS = (k) => window.NocapUtils?.getLocalStorage
                ? window.NocapUtils.getLocalStorage(k)
                : localStorage.getItem(k);

            const verified = String(getLS('nocap_age_verification') || 'false') === 'true';
            const ageLevel = parseInt(getLS('nocap_age_level') || '0', 10) || 0;

            // ✅ settings-only: Wenn nicht verifiziert -> zurück zur index/settings
            if (!verified) {
                Logger.warn('⚠️ No age verification (settings-only)');
                showNotification('Altersverifizierung erforderlich! Bitte in den Settings bestätigen.', 'warning');
                setTimeout(() => window.location.href = 'index.html', 2000);
                return false;
            }

            Logger.debug(`✅ Age verification OK (settings-only): ageLevel=${ageLevel}`);
            return true;

        } catch (error) {
            Logger.error('❌ Age verification error (settings-only):', error);
            showNotification('Altersverifizierung erforderlich! Bitte in den Settings bestätigen.', 'warning');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }
    }

    // ===========================
    // PREMIUM & QUESTION COUNTS
    // ===========================

    async function checkPremiumStatus() {
        try {
            const isPremium = await MultiplayerCategoryModule.gameState.isPremiumUser();

            Logger.debug(`${isPremium ? '✅' : '🔒'} Premium status: ${isPremium}`);

            const specialCard = document.querySelector('[data-category="special"]');
            if (specialCard) {
                if (isPremium) {
                    specialCard.classList.remove('locked');
                    specialCard.setAttribute('aria-disabled', 'false');
                } else {
                    specialCard.classList.add('locked');
                    specialCard.setAttribute('aria-disabled', 'true');
                }
            }

        } catch (error) {
            Logger.error('❌ Premium check failed:', error);

            const specialCard = document.querySelector('[data-category="special"]');
            if (specialCard) {
                specialCard.classList.add('locked');
                specialCard.setAttribute('aria-disabled', 'true');
            }

            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    'Premium-Status konnte nicht überprüft werden',
                    'warning',
                    3000
                );
            }
        }
    }

    async function loadQuestionCounts() {
        try {
            // ✅ garantiert, dass eine Firebase App existiert
            if (window.FirebaseConfig?.waitForFirebase) {
                await window.FirebaseConfig.waitForFirebase(10000);
            }

            const instances = window.FirebaseConfig?.getFirebaseInstances?.();
            const database = instances?.database;

            if (!database) {
                Logger.warn('⚠️ Firebase DB not available, using defaults');
                return;
            }

            const questionsRef = database.ref('questions');
            const snapshot = await questionsRef.once('value');

            if (snapshot.exists()) {
                const questions = snapshot.val();
                Object.keys(categoryData).forEach(key => {
                    if (questions[key]) {
                        if (Array.isArray(questions[key])) {
                            MultiplayerCategoryModule.state.questionCounts[key] = questions[key].length;
                        } else if (typeof questions[key] === 'object') {
                            MultiplayerCategoryModule.state.questionCounts[key] = Object.keys(questions[key]).length;
                        }
                    }
                });

                Logger.debug('✅ Question counts loaded:', MultiplayerCategoryModule.state.questionCounts);
            }
        } catch (error) {
            Logger.warn('⚠️ Question counts error:', error);
        }
    }


    // ===========================
    // HEADER INFO
    // ===========================

    function updateHeaderInfo() {
        const hostNameEl = document.getElementById('host-name');
        const gameIdEl = document.getElementById('game-id-display');

        if (hostNameEl && MultiplayerCategoryModule.gameState.playerName) {
            hostNameEl.textContent = MultiplayerCategoryModule.gameState.playerName;
        }

        if (gameIdEl) {
            if (MultiplayerCategoryModule.gameState.gameId) {
                gameIdEl.textContent = MultiplayerCategoryModule.gameState.gameId;
            } else {
                gameIdEl.textContent = 'Wird in Lobby erstellt...';
            }
        }
    }
    // ===========================
    // EVENT LISTENERS
    // ===========================

    function setupEventListeners() {
        const backBtn = document.getElementById('back-button');
        const proceedBtn = document.getElementById('proceed-button');
        const nameInput = document.getElementById('player-name-input');
        const confirmNameBtn = document.getElementById('confirm-name-btn');

        if (backBtn) {
            addTrackedEventListener(backBtn, 'click', goBack);
        }
        if (proceedBtn) {
            addTrackedEventListener(proceedBtn, 'click', proceed);
        }

        // Player name input listeners
        if (nameInput) {
            addTrackedEventListener(nameInput, 'input', handleNameInput);
            addTrackedEventListener(nameInput, 'keypress', (e) => {
                if (e.key === 'Enter' && !confirmNameBtn.disabled) {
                    confirmPlayerName();
                }
            });
            // Auto-focus
            if (!MultiplayerCategoryModule.playerNameConfirmed) {
                setTimeout(() => nameInput.focus(), 100);
            }
        }

        if (confirmNameBtn) {
            addTrackedEventListener(confirmNameBtn, 'click', confirmPlayerName);
        }

        Logger.debug('✅ Event listeners setup');
    }

    // ===========================
    // INITIALIZE SELECTED CATEGORIES
    // ===========================

    function initializeSelectedCategories() {
        if (MultiplayerCategoryModule.gameState.selectedCategories &&
            Array.isArray(MultiplayerCategoryModule.gameState.selectedCategories)) {
            MultiplayerCategoryModule.gameState.selectedCategories.forEach(key => {
                if (!categoryData[key]) {
                    Logger.warn(`⚠️ Invalid category: ${key}`);
                    return;
                }

                const card = document.querySelector(`[data-category="${key}"]`);
                if (card && !card.classList.contains('locked')) {
                    card.classList.add('selected');
                    card.classList.add(key);
                }
            });
            updateSelectionSummary();
        }
    }

    // ===========================
    // RENDER CARDS
    // ===========================

    async function renderCategoryCards() {
        const grid = document.getElementById('categories-grid');
        if (!grid) return;

        grid.innerHTML = '';

        const getLS = (k) => window.NocapUtils?.getLocalStorage
            ? window.NocapUtils.getLocalStorage(k)
            : localStorage.getItem(k);

        const verified = String(getLS('nocap_age_verification') || 'false') === 'true';
        const ageLevel = parseInt(getLS('nocap_age_level') || '0', 10) || 0;


        const hasPremium = await MultiplayerCategoryModule.gameState.isPremiumUser();

        Object.entries(categoryData).forEach(([key, cat]) => {
            const card = document.createElement('div');
            card.className = 'category-card';
            card.dataset.category = key;
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', `${cat.name} auswählen`);

            const isGuest = !MultiplayerCategoryModule.isHost;
            const locked = isGuest ||
                (key === 'fsk18' && (!verified || ageLevel < 18)) ||
                (key === 'fsk16' && (!verified || ageLevel < 16)) ||
                (key === 'special' && !hasPremium);


            if (locked) {
                card.classList.add('locked');
                card.setAttribute('aria-disabled', 'true');
            }

            if (isGuest) {
                card.classList.add('guest-disabled');
                card.setAttribute('aria-label', `${cat.name} (Nur Host kann auswählen)`);
            }

            buildCategoryCard(card, key, cat, locked, ageLevel, verified, isGuest);


            // Event listeners
            if (!locked && !isGuest) {
                addTrackedEventListener(card, 'click', () => toggleCategory(key));
                addTrackedEventListener(card, 'keypress', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleCategory(key);
                    }
                });
            } else if (isGuest) {
                addTrackedEventListener(card, 'click', () => {
                    showNotification('Nur der Host kann Kategorien auswählen', 'info');
                });
            } else if (key === 'fsk18' && (!verified || ageLevel < 18)) {
                addTrackedEventListener(card, 'click', () =>
                    showNotification(!verified ? 'Bitte erst in den Settings dein Alter bestätigen' : 'Du musst 18+ sein', 'warning'));
            } else if (key === 'fsk16' && (!verified || ageLevel < 16)) {
                addTrackedEventListener(card, 'click', () =>
                    showNotification(!verified ? 'Bitte erst in den Settings dein Alter bestätigen' : 'Du musst 16+ sein', 'warning'));
            } else if (key === 'special') {
                addTrackedEventListener(card, 'click', (e) => {
                    if (e.target.closest('.unlock-btn')) {
                        e.stopPropagation();
                        showPremiumInfo();
                    }
                });
            }

            grid.appendChild(card);
        });

        Logger.debug(`✅ Cards rendered (${MultiplayerCategoryModule.isHost ? 'Host' : 'Guest'} mode)`);
    }

    function buildCategoryCard(card, key, cat, locked, ageLevel, verified, isGuest = false) {

        // Locked overlay
        if (locked) {
            const overlay = document.createElement('div');
            overlay.className = 'locked-overlay';

            const lockIcon = document.createElement('div');
            lockIcon.className = 'lock-icon';
            lockIcon.textContent = isGuest ? '👁️' : '🔒';
            lockIcon.setAttribute('aria-hidden', 'true');

            const lockMessage = document.createElement('p');
            lockMessage.className = 'lock-message';

            if (isGuest) {
                lockMessage.textContent = 'Nur Host kann auswählen';
            } else if (key === 'fsk18' && (!verified || ageLevel < 18)) {
                lockMessage.textContent = !verified ? 'Bitte Alter in Settings bestätigen' : 'Nur für Erwachsene (18+)';
            } else if (key === 'fsk16' && (!verified || ageLevel < 16)) {
                lockMessage.textContent = !verified ? 'Bitte Alter in Settings bestätigen' : 'Ab 16 Jahren';
            } else if (key === 'special') {
                lockMessage.textContent = 'Premium Inhalt';

                const unlockBtn = document.createElement('button');
                unlockBtn.className = 'unlock-btn';
                unlockBtn.type = 'button';
                unlockBtn.textContent = '💎 Freischalten';
                overlay.appendChild(unlockBtn);
            }

            overlay.appendChild(lockIcon);
            overlay.appendChild(lockMessage);
            card.appendChild(overlay);

            if (key === 'special') {
                const badge = document.createElement('div');
                badge.className = 'premium-badge';
                badge.textContent = '👑 PREMIUM';
                badge.setAttribute('aria-hidden', 'true');
                card.appendChild(badge);
            }
        }

        // Header
        const header = document.createElement('div');
        header.className = 'category-header';

        const icon = document.createElement('div');
        icon.className = 'category-icon';
        icon.textContent = cat.icon;
        icon.setAttribute('aria-hidden', 'true');

        const fskBadge = document.createElement('div');
        fskBadge.className = `fsk-badge ${key}-badge`;
        fskBadge.textContent = cat.fsk;

        header.appendChild(icon);
        header.appendChild(fskBadge);

        // Title
        const title = document.createElement('h3');
        title.className = 'category-title';
        title.textContent = cat.name;

        // Description
        const description = document.createElement('p');
        description.className = 'category-description';
        description.textContent = cat.description;

        // Examples
        const examplesDiv = document.createElement('div');
        examplesDiv.className = 'category-examples';

        const examplesQuestions = document.createElement('div');
        examplesQuestions.className = 'example-questions';

        cat.examples.forEach(ex => {
            const exampleDiv = document.createElement('div');
            exampleDiv.className = 'example-question';
            exampleDiv.textContent = sanitizeText(ex);
            examplesQuestions.appendChild(exampleDiv);
        });

        examplesDiv.appendChild(examplesQuestions);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'category-footer';

        const ageRange = document.createElement('span');
        ageRange.className = 'age-range';
        ageRange.textContent = cat.ageRange;

        const questionCount = document.createElement('span');
        questionCount.className = 'question-count';
        questionCount.textContent = `~${MultiplayerCategoryModule.questionCounts[key]} Fragen`;

        footer.appendChild(ageRange);
        footer.appendChild(questionCount);

        // Assemble card
        card.appendChild(header);
        card.appendChild(title);
        card.appendChild(description);
        card.appendChild(examplesDiv);
        card.appendChild(footer);
    }

    // ===========================
    // CATEGORY SELECTION
    // ===========================

    function toggleCategory(key) {
        const card = document.querySelector(`[data-category="${key}"]`);
        if (!card || card.classList.contains('locked')) return;

        if (!categoryData[key]) {
            Logger.error(`❌ Invalid category: ${key}`);
            return;
        }

        const selectedCategories = getSelectedCategories();

        if (selectedCategories.includes(key)) {
            MultiplayerCategoryModule.gameState.removeCategory(key);
            card.classList.remove('selected');
            card.classList.remove(key);
            card.setAttribute('aria-pressed', 'false');
        } else {
            MultiplayerCategoryModule.gameState.addCategory(key);
            card.classList.add('selected');
            card.classList.add(key);
            card.setAttribute('aria-pressed', 'true');
        }

        updateSelectionSummary();
        syncWithFirebase();
    }

    function getSelectedCategories() {
        return MultiplayerCategoryModule.gameState.selectedCategories || [];
    }

    function updateSelectionSummary() {
        const summary = document.getElementById('selection-summary');
        const title = document.getElementById('summary-title');
        const list = document.getElementById('selected-categories');
        const total = document.getElementById('total-questions');
        const btn = document.getElementById('proceed-button');

        const selectedCategories = getSelectedCategories();

        if (selectedCategories.length > 0) {
            if (summary) summary.classList.add('show');
            if (btn) {
                btn.classList.add('enabled');
                btn.disabled = false;
                btn.setAttribute('aria-disabled', 'false');
            }

            if (title) {
                title.textContent = `${selectedCategories.length} Kategorie${selectedCategories.length > 1 ? 'n' : ''} ausgewählt`;
            }

            if (list) {
                list.innerHTML = '';

                selectedCategories.forEach(c => {
                    const data = categoryData[c];
                    if (!data) return;

                    const tag = document.createElement('div');
                    tag.className = 'selected-category-tag';

                    const iconSpan = document.createElement('span');
                    iconSpan.textContent = data.icon;
                    iconSpan.setAttribute('aria-hidden', 'true');

                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = data.name;

                    tag.appendChild(iconSpan);
                    tag.appendChild(nameSpan);
                    list.appendChild(tag);
                });
            }

            if (total) {
                const totalQ = selectedCategories.reduce((sum, c) =>
                    sum + (MultiplayerCategoryModule.questionCounts[c] || 0), 0);
                total.textContent = totalQ;
            }
        } else {
            if (summary) summary.classList.remove('show');
            if (btn) {
                btn.classList.remove('enabled');
                btn.disabled = true;
                btn.setAttribute('aria-disabled', 'true');
            }
        }
    }

    async function syncWithFirebase() {
        if (!MultiplayerCategoryModule.gameState?.gameId) return;

        try {
            const instances = window.FirebaseConfig?.getFirebaseInstances?.();
            const database = instances?.database;

            if (!database?.ref) return;

            const gameRef = database.ref(`games/${MultiplayerCategoryModule.gameState.gameId}/settings/categories`);
            await gameRef.set(MultiplayerCategoryModule.gameState.selectedCategories);

        } catch (error) {
            Logger.error('❌ Sync error:', error);
        }
    }

    async function checkAllPlayersReady() {
        if (!MultiplayerCategoryModule.gameState?.gameId) return true;

        try {
            const instances = window.FirebaseConfig?.getFirebaseInstances?.();
            const database = instances?.database;
            if (!database?.ref) {
                Logger.warn('⚠️ Firebase DB not available for ready check');
                return true;
            }

            const gameRef = database.ref(`games/${MultiplayerCategoryModule.gameState.gameId}/players`);
            const snapshot = await gameRef.once('value');

            if (!snapshot.exists()) return true;

            const players = snapshot.val() || {};
            const playerList = Object.entries(players)
                .filter(([_, p]) => p && typeof p === 'object')
                .map(([key, p]) => ({ key, ...p }));

            const allReady = playerList.every(player => {
                if (player.isHost) return true;
                return player.categoryReady === true;
            });

            Logger.debug(`✅ Ready check: ${playerList.filter(p => p.categoryReady || p.isHost).length}/${playerList.length} players ready`);
            return allReady;

        } catch (error) {
            Logger.error('❌ Ready check error:', error);
            showNotification('Fehler beim Ready-Check - fortfahren mit Vorsicht', 'warning');
            return true;
        }
    }


    async function markPlayerReady() {
        if (!MultiplayerCategoryModule.gameState?.gameId) return;
        if (MultiplayerCategoryModule.isHost) return;

        try {
            const instances = window.FirebaseConfig?.getFirebaseInstances?.();
            const database = instances?.database;
            if (!database?.ref) return;

            let playerKey = MultiplayerCategoryModule.gameState.playerId;
            if (!playerKey) {
                // ✅ Fallback: eindeutige ID erzeugen, damit Gäste sich nicht überschreiben
                playerKey = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                MultiplayerCategoryModule.gameState.playerId = playerKey;
                MultiplayerCategoryModule.gameState.save(true);
            }

            const playerRef = database.ref(`games/${MultiplayerCategoryModule.gameState.gameId}/players/${playerKey}`);

            await playerRef.update({
                categoryReady: true,
                name: sanitizeText(MultiplayerCategoryModule.gameState.playerName || 'Spieler'),
                isHost: false,
                updatedAt: Date.now()
            });

            Logger.debug('✅ Player marked as ready for category selection');

        } catch (error) {
            Logger.error('❌ Mark ready error:', error);
        }
    }


    // ===========================
    // NAVIGATION
    // ===========================

    async function proceed() {
        const selectedCategories = getSelectedCategories();

        if (selectedCategories.length === 0) {
            showNotification('Wähle mindestens eine Kategorie', 'warning');
            return;
        }

        if (MultiplayerCategoryModule.gameState.isHost === true && MultiplayerCategoryModule.gameState.gameId) {
            const allReady = await checkAllPlayersReady();
            if (!allReady) {
                showNotification(
                    'Bitte warte, bis alle Spieler die Kategorieauswahl gesehen haben',
                    'warning'
                );
                return;
            }
        }

        showNotification('Kategorien gespeichert!', 'success', 500);
        setTimeout(() => {
            window.location.href = 'multiplayer-difficulty-selection.html';
        }, 500);
    }

    function goBack() {
        Logger.debug('🔙 Navigating back to index...');

        if (MultiplayerCategoryModule.gameState) {
            MultiplayerCategoryModule.gameState.deviceMode = null;
            MultiplayerCategoryModule.gameState.isHost = false;
            MultiplayerCategoryModule.gameState.isGuest = false;
            MultiplayerCategoryModule.gameState.selectedCategories = [];
            MultiplayerCategoryModule.gameState.playerName = '';
            MultiplayerCategoryModule.gameState.gameId = null;
            MultiplayerCategoryModule.gameState.playerId = null;
            MultiplayerCategoryModule.gameState.isGuest = false;
            MultiplayerCategoryModule.gameState.isHost = false;

            if (window.NocapUtils && window.NocapUtils.removeLocalStorage) {
                window.NocapUtils.removeLocalStorage('nocap_player_name');
                window.NocapUtils.removeLocalStorage('nocap_game_id');
            }

            MultiplayerCategoryModule.gameState.save();
        }

        window.location.href = 'index.html';
    }

    // ===========================
    // PREMIUM
    // ===========================

    function showPremiumInfo() {
        showNotification('Premium-Funktion kommt bald!', 'info');
    }

    // ===========================
    // INPUT SANITIZATION
    // ===========================

    function sanitizeText(input) {
        if (!input) return '';

        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            return window.NocapUtils.sanitizeInput(String(input));
        }

        return String(input).replace(/<[^>]*>/g, '').substring(0, 500);
    }

    // ===========================
    // UTILITIES
    // ===========================

    const showNotification = window.NocapUtils?.showNotification ||
        function(message, type = 'info') {
            alert(sanitizeText(String(message)));
        };

    // ===========================
    // CLEANUP
    // ===========================

    function cleanup() {
        MultiplayerCategoryModule.state.eventListenerCleanup.forEach(
            ({element, event, handler, options}) => {
                try {
                    element.removeEventListener(event, handler, options);
                } catch (error) {
                    // Element may have been removed from DOM
                }
            }
        );
        MultiplayerCategoryModule.state.eventListenerCleanup = [];

        if (window.NocapUtils && window.NocapUtils.cleanupEventListeners) {
            window.NocapUtils.cleanupEventListeners();
        }

        Logger.debug('✅ Multiplayer category selection cleanup completed');
    }

    // ✅ BUGFIX: Use normal window.addEventListener
    window.addEventListener('beforeunload', cleanup);

    // ===========================
    // INITIALIZATION
    // ===========================

    // ✅ BUGFIX: Use normal document.addEventListener
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})(window);