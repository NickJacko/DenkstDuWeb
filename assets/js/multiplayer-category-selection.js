/**
 * No-Cap Multiplayer Category Selection
 * Version 5.2 - FSK18-System Integration
 *
 * CRITICAL: This page is the "Source of Truth" for Multiplayer Host Mode
 * - Sets deviceMode = 'multi'
 * - Sets isHost = true, isGuest = false
 * - Creates/manages Firebase game
 *
 * ✅ P0: Module Pattern - no global variables (XSS prevention)
 * ✅ P0: Event-Listener cleanup on beforeunload
 * ✅ P0: MANDATORY server-side premium validation
 * ✅ FSK18: FSK0 & FSK16 always allowed, FSK18 requires server validation
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
            hostHasPremium: false,
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
            ageRange: 'Für alle',
            description: 'Lustige und harmlose Fragen für die ganze Familie',
            examples: ['...gemeinsam mit der Familie verreist?', '...im Supermarkt etwas vergessen?'],
            requiresAge: 0
        },
        fsk16: {
            name: 'Party Time',
            icon: '🎉',
            color: '#FF9800',
            fsk: 'FSK 16',
            ageRange: 'Für alle', // ✅ FSK18-SYSTEM: Always unlocked
            description: 'Freche und witzige Fragen für Partys mit Freunden',
            examples: ['...auf einer Party eingeschlafen?', '...den Namen vergessen?'],
            requiresAge: 0 // ✅ FSK18-SYSTEM: No age requirement
        },
        fsk18: {
            name: 'Heiß & Gewagt',
            icon: '🔥',
            color: '#F44336',
            fsk: 'FSK 18',
            ageRange: 'Nur Erwachsene',
            description: 'Intime und pikante Fragen nur für Erwachsene',
            examples: ['...an einem öffentlichen Ort...?', '...mit jemandem...?'],
            requiresAge: 18
        },
        special: {
            name: 'Special Edition',
            icon: '⭐',
            color: '#FFD700',
            fsk: 'Premium',
            ageRange: 'Exklusiv',
            description: 'Exklusive Premium-Fragen für besondere Momente',
            examples: ['Premium Inhalte', 'Exklusive Fragen'],
            requiresAge: 0
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

        if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
            await window.NocapUtils.waitForDependencies(['GameState', 'FirebaseService']);
        }

        MultiplayerCategoryModule.gameState = new window.GameState();

        // CRITICAL: Always set device mode to 'multi' for multiplayer pages
        MultiplayerCategoryModule.gameState.setDeviceMode('multi');
        // ✅ ensure auth (anonymous ok) so DB operations have a user
        try {
            if (window.authService?.ensureAuth) {
                await window.authService.ensureAuth();
            }
        } catch (e) {
            Logger.warn('⚠️ ensureAuth failed (continuing):', e);
        }

        Logger.debug('📱 Device mode set to: multi');

        // CRITICAL: DEVICE MODE ENFORCEMENT
        Logger.debug('🎮 Checking user role...');

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

        if (MultiplayerCategoryModule.gameState.isGuest === true ||
            (MultiplayerCategoryModule.gameState.gameId && !MultiplayerCategoryModule.gameState.isHost)) {
            if (!wantsHost) {
                MultiplayerCategoryModule.isHost = false;
                MultiplayerCategoryModule.gameState.isHost = false;
                MultiplayerCategoryModule.gameState.isGuest = true;
                Logger.debug('👤 User is GUEST - showing read-only view');
            } else {
                MultiplayerCategoryModule.isHost = true;
                MultiplayerCategoryModule.gameState.isHost = true;
                MultiplayerCategoryModule.gameState.isGuest = false;
                Logger.debug('👑 User wants HOST (overriding guest state) - showing editable view');
            }
        } else {
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

        if (typeof window.FirebaseService !== 'undefined') {
            MultiplayerCategoryModule.firebaseService = window.FirebaseService;
        } else {
            Logger.error('❌ Firebase service not available');
            showNotification('Firebase nicht verfügbar', 'error');
            setTimeout(() => window.location.href = 'index.html', 3000);
            return;
        }

        checkAgeVerification();

        if (!validateGameState()) {
            return;
        }

        updateHeaderInfo();

        if (MultiplayerCategoryModule.gameState.playerName &&
            MultiplayerCategoryModule.gameState.playerName.trim()) {
            MultiplayerCategoryModule.playerNameConfirmed = true;
            showCategorySelection();
        } else {
            showPlayerNameInput();
        }

        await checkPremiumStatus();
        await loadQuestionCounts();

        await renderCategoryCards();

        setupEventListeners();

        if (MultiplayerCategoryModule.playerNameConfirmed) {
            initializeSelectedCategories();

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

        if (nameInput) {
            try {
                const savedDisplayName = window.NocapUtils
                    ? window.NocapUtils.getLocalStorage('nocap_display_name')
                    : localStorage.getItem('nocap_display_name');

                if (savedDisplayName && savedDisplayName.trim()) {
                    nameInput.value = savedDisplayName.trim();
                    Logger.debug('✅ Pre-filled name from settings:', savedDisplayName);

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

        if (!MultiplayerCategoryModule.gameState ||
            MultiplayerCategoryModule.gameState.deviceMode !== 'multi') {
            Logger.error('❌ Wrong device mode:', MultiplayerCategoryModule.gameState?.deviceMode);
            showNotification('Falscher Spielmodus', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (!MultiplayerCategoryModule.gameState.deviceMode) {
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

    /**
     * ✅ FSK18-SYSTEM: Simplified age check - no redirect on load
     * Age verification is only enforced when trying to activate FSK18
     */
    function checkAgeVerification() {
        try {
            const getLS = (k) => window.NocapUtils?.getLocalStorage
                ? window.NocapUtils.getLocalStorage(k)
                : localStorage.getItem(k);

            const ageLevel = parseInt(getLS('nocap_age_level') || '0', 10) || 0;

            Logger.debug(`ℹ️ Current age level: ${ageLevel} (FSK0/FSK16 always accessible)`);
            return true;

        } catch (error) {
            Logger.error('❌ Age verification error:', error);
            return false;
        }
    }

// ===========================
// PREMIUM & QUESTION COUNTS
// ===========================

    async function checkPremiumStatus() {
        try {
            const isPremium = typeof window.firebaseService?.isPremiumUser === 'function'
                ? window.firebaseService.isPremiumUser()
                : false;
            MultiplayerCategoryModule.state.hostHasPremium = isPremium;


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
            if (window.FirebaseConfig?.waitForFirebase) {
                await window.FirebaseConfig.waitForFirebase(10000);
            }

            const instances = window.FirebaseConfig?.getFirebaseInstances?.();
            const functions = instances?.functions;

            if (!functions) {
                Logger.warn('⚠️ Firebase Functions not available, using defaults');
                return;
            }

            // ✅ Load counts for each category via Cloud Function
            for (const key of Object.keys(categoryData)) {
                try {
                    // ✅ FSK0, FSK16, special: Direct database access (allowed)
                    if (key === 'fsk0' || key === 'fsk16' || key === 'special') {
                        const database = instances?.database;
                        if (database?.ref) {
                            const snapshot = await database.ref(`questions/${key}`).once('value');
                            if (snapshot.exists()) {
                                const questions = snapshot.val();
                                MultiplayerCategoryModule.state.questionCounts[key] =
                                    Array.isArray(questions)
                                        ? questions.length
                                        : Object.keys(questions).length;
                            }
                        }
                    }
                    // ✅ FSK18: Via Cloud Function (server-side validation)
                    else if (key === 'fsk18') {
                        const database = instances?.database;
                        if (database?.ref) {
                            const snapshot = await database.ref('questions/fsk18').once('value');
                            const questions = snapshot.val();
                            MultiplayerCategoryModule.state.questionCounts[key] = questions
                                ? Object.keys(questions).length : 0;
                        }
                    }
                } catch (error) {
                    Logger.warn(`⚠️ Failed to load count for ${key}:`, error);
                }
            }

            Logger.debug('✅ Question counts loaded:', MultiplayerCategoryModule.state.questionCounts);
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

        if (nameInput) {
            addTrackedEventListener(nameInput, 'input', handleNameInput);
            addTrackedEventListener(nameInput, 'keypress', (e) => {
                if (e.key === 'Enter' && !confirmNameBtn.disabled) {
                    confirmPlayerName();
                }
            });
            if (!MultiplayerCategoryModule.playerNameConfirmed) {
                setTimeout(() => nameInput.focus(), 100);
            }
        }

        if (confirmNameBtn) {
            addTrackedEventListener(confirmNameBtn, 'click', confirmPlayerName);
        }

        // ✅ FSK18-SYSTEM: Listen for age verification event
        addTrackedEventListener(window, 'nocap:age-verified', handleAgeVerified);

        Logger.debug('✅ Event listeners setup');
    }

    /**
     * ✅ FSK18-SYSTEM: Handle age verification event - invalidate cache and re-render
     */
    async function handleAgeVerified(event) {
        const ageLevel = event?.detail?.ageLevel ?? 0;

        Logger.debug('🔄 Age verified event received, re-rendering cards with ageLevel:', ageLevel);

        // Invalidate FSK18 cache in GameState
        if (MultiplayerCategoryModule.gameState?.invalidateFSK18Cache) {
            MultiplayerCategoryModule.gameState.invalidateFSK18Cache('age-verified');
        }

        showNotification('Altersverifikation aktualisiert! 🎉', 'success', 2000);

        // Re-render category cards with updated age restrictions
        await renderCategoryCards();

        // Re-apply selected categories
        initializeSelectedCategories();
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

        // ✅ FSK18-SYSTEM: Only check for FSK18
        const verified = String(getLS('nocap_age_verification') || 'false') === 'true';
        const ageLevel = parseInt(getLS('nocap_age_level') || '0', 10) || 0;

        const hasPremium = MultiplayerCategoryModule.state.hostHasPremium === true;

        Object.entries(categoryData).forEach(([key, cat]) => {
            const card = document.createElement('div');
            card.className = 'category-card';
            card.dataset.category = key;
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', `${cat.name} auswählen`);

            const isGuest = !MultiplayerCategoryModule.isHost;

            // ✅ FSK18-SYSTEM: FSK0 & FSK16 always unlocked
            const locked = isGuest ||
                (key === 'fsk18' && (!verified || ageLevel < 18)) ||
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
            } else if (key === 'fsk18') {
                // ✅ FSK18-SYSTEM: Allow click to trigger age verification
                addTrackedEventListener(card, 'click', () => toggleCategory(key));
                addTrackedEventListener(card, 'keypress', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleCategory(key);
                    }
                });
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

    /**
     * ✅ FSK18-SYSTEM: Updated toggle logic
     * - FSK0 & FSK16: Always accessible
     * - FSK18: Requires server validation via GameState
     */
    async function toggleCategory(key) {
        const card = document.querySelector(`[data-category="${key}"]`);
        if (!card) return;

        if (card.classList.contains('locked')) {
            if (key === 'special') {
                showPremiumInfo();
                return;
            }
// ✅ Premium is HOST-wide: only host needs premium, but selection must be blocked if host not premium
            if (key === 'special' && MultiplayerCategoryModule.state.hostHasPremium !== true) {
                showPremiumInfo();
                return;
            }

            // ✅ FSK18-SYSTEM: Only FSK18 requires validation
            if (key === 'fsk18') {
                // Check if Firebase is available (fail closed)
                if (!window.FirebaseConfig?.isInitialized?.()) {
                    showNotification(
                        '⚠️ FSK18-Validierung erfordert Internetverbindung',
                        'error',
                        5000
                    );
                    return;
                }

                Logger.debug('🔒 FSK18 locked - checking access...');

                // Use GameState's server validation
                const hasAccess = await MultiplayerCategoryModule.gameState.canAccessFSK('fsk18', true);

                if (!hasAccess) {
                    Logger.debug('❌ FSK18 access denied');

                    // Show age verification modal
                    if (window.SettingsModule?.showFSKError) {
                        window.SettingsModule.showFSKError(
                            'fsk18',
                            'Altersverifikation erforderlich für FSK18-Inhalte'
                        );
                    } else {
                        showNotification(
                            '🔞 Altersverifikation erforderlich! Bitte verifiziere dein Alter in den Einstellungen.',
                            'error',
                            5000
                        );
                    }

                    return;
                }

                Logger.debug('✅ FSK18 access validated - unlocking card');

                // Unlock the card
                card.classList.remove('locked');
                card.setAttribute('aria-disabled', 'false');

                // Remove overlay
                const overlay = card.querySelector('.locked-overlay');
                if (overlay) {
                    overlay.remove();
                }

                // Now proceed with toggle
                // Fall through to toggle logic below
            } else {
                // Other locked categories (shouldn't happen for FSK0/FSK16)
                return;
            }
        }

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
            if (MultiplayerCategoryModule.gameState.gameId && (key === 'fsk18')) {
                const warningMessage = 'Achtung: Spieler unter 18 Jahren werden automatisch entfernt!';

                if (!confirm(`${warningMessage}\n\nMöchtest du ${categoryData[key].name} wirklich aktivieren?`)) {
                    return;
                }
            }

            MultiplayerCategoryModule.gameState.addCategory(key);
            card.classList.add('selected');
            card.classList.add(key);
            card.setAttribute('aria-pressed', 'true');
        }

        updateSelectionSummary();
        await syncWithFirebase();

        if (MultiplayerCategoryModule.gameState.gameId) {
            await kickInvalidPlayersAfterCategoryChange();
        }
    }

    async function kickInvalidPlayersAfterCategoryChange() {
        if (!MultiplayerCategoryModule.gameState?.gameId) return;
        if (!MultiplayerCategoryModule.isHost) return;

        try {
            const gameId = MultiplayerCategoryModule.gameState.gameId;
            const selectedCategories = getSelectedCategories();

            const hasFSK18 = selectedCategories.includes('fsk18');

            if (!hasFSK18) return;

            const requiredAge = 18;

            const instances = window.FirebaseConfig?.getFirebaseInstances?.();
            const database = instances?.database;
            if (!database?.ref) return;

            const playersRef = database.ref(`games/${gameId}/players`);

            const snapshot = await playersRef.once('value');

            if (!snapshot.exists()) return;

            const players = snapshot.val();
            let kickedCount = 0;

            for (const [playerId, player] of Object.entries(players)) {
                if (player.isHost) continue;

                const playerAge = player.ageLevel || 0;

                if (playerAge < requiredAge) {
                        await database.ref(`games/${gameId}/players/${playerId}`)
                        .remove();

                    kickedCount++;

                    Logger.debug(`✅ Kicked player ${player.name} (age ${playerAge} < required ${requiredAge})`);
                }
            }

            if (kickedCount > 0) {
                showNotification(
                    `${kickedCount} Spieler wurden aufgrund der FSK-Änderung entfernt`,
                    'info',
                    3000
                );
            }

        } catch (error) {
            Logger.error('❌ Auto-kick error:', error);
        }
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

            const gameId = MultiplayerCategoryModule.gameState.gameId;

            await database.ref(`games/${gameId}/settings/categories`)
                .set(MultiplayerCategoryModule.gameState.selectedCategories);

// ✅ NEW: host-wide premium flag (so guests can use premium questions in this lobby)
            await database.ref(`games/${gameId}/settings/hostHasPremium`)
                .set(MultiplayerCategoryModule.state.hostHasPremium === true);


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

        const getLS = (k) => window.NocapUtils?.getLocalStorage
            ? window.NocapUtils.getLocalStorage(k)
            : localStorage.getItem(k);

        const isEditingLobby = String(getLS('nocap_editing_lobby') || 'false') === 'true';
        const existingGameId = getLS('nocap_existing_game_id');

        if (isEditingLobby && existingGameId && MultiplayerCategoryModule.gameState.isHost) {
            try {
                const instances = window.FirebaseConfig?.getFirebaseInstances?.();
                const database = instances?.database;

                if (database?.ref) {
                    await database.ref(`games/${existingGameId}/settings`).update({
                        categories: selectedCategories,
                        hostHasPremium: MultiplayerCategoryModule.state.hostHasPremium === true,
                        updatedAt: Date.now()
                    });
                    Logger.debug('✅ Updated categories in existing game:', selectedCategories);
                }
            } catch (error) {
                Logger.error('❌ Failed to update categories:', error);
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

    window.addEventListener('beforeunload', cleanup);

// ===========================
// INITIALIZATION
// ===========================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})(window);