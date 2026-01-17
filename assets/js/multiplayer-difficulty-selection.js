/**
 * No-Cap Multiplayer Difficulty Selection
 * Version 4.1 - BUGFIX: Module Pattern & addEventListener
 *
 * ✅ BUGFIX: Module Pattern added (was missing)
 * ✅ BUGFIX: addEventListener usage corrected
 * ✅ BUGFIX: FirebaseService reference fixed
 * ✅ P1 FIX: Device mode validation
 * ✅ P0 FIX: All DOM manipulation with textContent
 * ✅ P0 FIX: FSK validation
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
    // ✅ BUGFIX: This was completely missing!
    // ===========================

    const MultiplayerDifficultyModule = {
        state: {
            gameState: null,
            alcoholMode: false,
            eventListenerCleanup: [],
            isDevelopment: window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1'
        },

        get gameState() { return this.state.gameState; },
        set gameState(val) { this.state.gameState = val; },

        get alcoholMode() { return this.state.alcoholMode; },
        set alcoholMode(val) { this.state.alcoholMode = !!val; },

        get isDevelopment() { return this.state.isDevelopment; }
    };

    Object.seal(MultiplayerDifficultyModule.state);

    // ===========================
    // 🛠️ PERFORMANCE UTILITIES
    // ===========================

    function addTrackedEventListener(element, event, handler, options = {}) {
        if (!element) return;
        element.addEventListener(event, handler, options);
        const capture = typeof options === 'boolean' ? options : !!options.capture;
        MultiplayerDifficultyModule.state.eventListenerCleanup.push({ element, event, handler, capture });
    }

    // ===========================
    // CONSTANTS
    // ===========================
    const difficultyData = {
        easy: {
            name: 'Entspannt',
            icon: '🍷',
            description: 'Perfekt für lockere Runden',
            penalty: '1 Punkt bei falscher Schätzung',
            penaltyAlcohol: '1 Schluck bei falscher Schätzung',
            formula: 'Punkte = Abweichung',
            multiplier: 1,
            color: '#4CAF50'
        },
        medium: {
            name: 'Normal',
            icon: '🍺',
            description: 'Der Standard für lustige Abende',
            penalty: 'Abweichung = Punkte',
            penaltyAlcohol: 'Abweichung = Schlücke',
            formula: 'Punkte = Abweichung',
            multiplier: 1,
            color: '#FF9800'
        },
        hard: {
            name: 'Hardcore',
            icon: '🔥',
            description: 'Nur für Profis!',
            penalty: 'Doppelte Punkte!',
            penaltyAlcohol: 'Doppelte Schlücke!',
            formula: 'Punkte = Abweichung × 2',
            multiplier: 2,
            color: '#F44336'
        }
    };

    const categoryIcons = {
        fsk0: '👨‍👩‍👧‍👦',
        fsk16: '🎉',
        fsk18: '🔥',
        special: '⭐'
    };

    const categoryNames = {
        fsk0: 'Familie & Freunde',
        fsk16: 'Party Time',
        fsk18: 'Heiß & Gewagt',
        special: 'Special Edition'
    };
// ===========================
// 🔞 SETTINGS-ONLY AGE HELPERS
// ===========================

    function getSettingsAge() {
        const getLS = (k) => window.NocapUtils?.getLocalStorage
            ? window.NocapUtils.getLocalStorage(k)
            : localStorage.getItem(k);

        const rawVerified = getLS('nocap_age_verification');
        const verified = rawVerified === true || String(rawVerified || 'false') === 'true';

        const rawAge = getLS('nocap_age_level');
        const ageLevel = Number(rawAge) || parseInt(String(rawAge || '0'), 10) || 0;

        Logger.debug('🔞 Settings age check:', { rawVerified, verified, rawAge, ageLevel });

        return { verified, ageLevel };
    }


    function requireAgeVerifiedOrRedirect() {
        const { verified } = getSettingsAge();
        if (!verified) {
            Logger.warn('⚠️ No age verification (settings-only)');
            showNotification('Altersverifizierung erforderlich! Bitte in den Settings bestätigen.', 'warning');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }
        return true;
    }
    // ===========================
    // INITIALIZATION
    // ===========================

    async function initialize() {
        Logger.debug('🎮 Initializing multiplayer difficulty selection...');

        try {

            // ✅ BUGFIX: Check for window.GameState (constructor)
            if (typeof window.GameState === 'undefined') {
                showNotification('Fehler: GameState nicht gefunden', 'error');
                return;
            }

            // ✅ Ensure Firebase is initialized (guarded)
            try {
                if (!window.FirebaseConfig) {
                    Logger.warn('⚠️ FirebaseConfig missing - firebase-config.js not loaded?');
                } else {
                    if (!window.FirebaseConfig.isInitialized?.()) {
                        await window.FirebaseConfig.initialize();
                    }
                    await window.FirebaseConfig.waitForFirebase(10000);
                }
            } catch (e) {
                Logger.warn('⚠️ Firebase not ready yet:', e);
            }


            // Wait for dependencies
            if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
                await window.NocapUtils.waitForDependencies(['GameState']);
            }

            MultiplayerDifficultyModule.gameState = new window.GameState();

            // CRITICAL: Always set device mode to 'multi' for multiplayer pages
            MultiplayerDifficultyModule.gameState.setDeviceMode('multi');
            Logger.debug('📱 Device mode set to: multi');

            // Validate device mode
            if (!validateGameState()) {
                return;
            }

            // ✅ Settings-only age verification required for multiplayer flow
            if (!requireAgeVerifiedOrRedirect()) {
                return;
            }

            // Check alcohol mode (now depends on age)
            checkAlcoholMode();
            updateAlcoholModeUI();

            // Update header info
            updateHeaderInfo();

            // Display selected categories
            displaySelectedCategories();

            // Render difficulty cards
            renderDifficultyCards();

            // Setup event listeners
            setupEventListeners();

            // Load from gameState
            if (MultiplayerDifficultyModule.gameState.difficulty) {
                const card = document.querySelector(`[data-difficulty="${MultiplayerDifficultyModule.gameState.difficulty}"]`);
                if (card) {
                    card.classList.add('selected');
                    card.setAttribute('aria-checked', 'true');
                    updateContinueButton();
                }
            }

            Logger.debug('✅ Multiplayer difficulty selection initialized');

        } catch (error) {
            Logger.error('❌ Initialization error:', error);
            showNotification('Fehler beim Laden', 'error');
        }
    }

    // ===========================
    // VALIDATION
    // ===========================

    function validateGameState() {
        Logger.debug('🔍 Validating game state...');
        Logger.debug('GameState:', {
            deviceMode: MultiplayerDifficultyModule.gameState?.deviceMode,
            playerName: MultiplayerDifficultyModule.gameState?.playerName,
            selectedCategories: MultiplayerDifficultyModule.gameState?.selectedCategories,
            gameId: MultiplayerDifficultyModule.gameState?.gameId
        });

        // Strict device mode check
        if (!MultiplayerDifficultyModule.gameState ||
            MultiplayerDifficultyModule.gameState.deviceMode !== 'multi') {
            Logger.error('❌ Wrong device mode:', MultiplayerDifficultyModule.gameState?.deviceMode);
            showNotification('Falscher Spielmodus', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (typeof MultiplayerDifficultyModule.gameState.checkValidity === 'function' &&
            !MultiplayerDifficultyModule.gameState.checkValidity()) {
            showNotification('Ungültiger Spielzustand', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        // Player name must be set
        if (!MultiplayerDifficultyModule.gameState.playerName ||
            MultiplayerDifficultyModule.gameState.playerName.trim() === '') {
            Logger.error('❌ No player name - redirecting to category selection');
            showNotification('Bitte zuerst Spielername eingeben', 'warning');
            setTimeout(() => window.location.href = 'multiplayer-category-selection.html', 2000);
            return false;
        }

        if (!MultiplayerDifficultyModule.gameState.selectedCategories ||
            MultiplayerDifficultyModule.gameState.selectedCategories.length === 0) {
            Logger.error('❌ No categories selected');
            showNotification('Keine Kategorien ausgewählt', 'error');
            setTimeout(() => window.location.href = 'multiplayer-category-selection.html', 2000);
            return false;
        }
// ✅ Settings-only FSK validation (hard gate)
        const { verified, ageLevel } = getSettingsAge();
        if (!verified) {
            Logger.error('❌ Age not verified (settings-only)');
            showNotification('Altersverifizierung erforderlich!', 'warning');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        const selected = MultiplayerDifficultyModule.gameState.selectedCategories || [];
        if (selected.includes('fsk18') && ageLevel < 18) {
            Logger.error('❌ Selected fsk18 but user < 18');
            showNotification('Du musst 18+ sein für diese Kategorie', 'warning');
            setTimeout(() => window.location.href = 'multiplayer-category-selection.html', 2000);
            return false;
        }

        if (selected.includes('fsk16') && ageLevel < 16) {
            Logger.error('❌ Selected fsk16 but user < 16');
            showNotification('Du musst 16+ sein für diese Kategorie', 'warning');
            setTimeout(() => window.location.href = 'multiplayer-category-selection.html', 2000);
            return false;
        }

        Logger.debug('✅ Game state valid');
        return true;
    }

    // ===========================
    // ALCOHOL MODE
    // ===========================

    function checkAlcoholMode() {
        try {
            const { verified, ageLevel } = getSettingsAge();

            // Default: false
            MultiplayerDifficultyModule.alcoholMode = false;

            // If not verified -> keep false (redirect handled earlier)
            if (!verified) {
                Logger.warn('⚠️ Alcohol mode disabled: not verified (settings-only)');
                return;
            }

            // Alcohol only allowed for 18+
            if (ageLevel < 18) {
                Logger.warn('⚠️ Alcohol mode disabled: User under 18');
                MultiplayerDifficultyModule.alcoholMode = false;
                return;
            }

            // Read toggle (only meaningful if 18+)
            const getLS = (k) => window.NocapUtils?.getLocalStorage
                ? window.NocapUtils.getLocalStorage(k)
                : localStorage.getItem(k);

            const alcoholModeStr = String(getLS('nocap_alcohol_mode') || 'false');
            MultiplayerDifficultyModule.alcoholMode = alcoholModeStr === 'true';

            Logger.debug(`🍺 Alcohol mode: ${MultiplayerDifficultyModule.alcoholMode} (ageLevel=${ageLevel})`);
        } catch (error) {
            Logger.error('❌ Error checking alcohol mode:', error);
            MultiplayerDifficultyModule.alcoholMode = false;
        }
    }

    function updateAlcoholModeUI() {
        const subtitle = document.getElementById('difficulty-subtitle');
        if (subtitle) {
            subtitle.textContent = MultiplayerDifficultyModule.alcoholMode
                ? 'Bestimmt die Anzahl der Schlücke bei falschen Schätzungen'
                : 'Bestimmt die Konsequenz bei falschen Schätzungen';
        }

        // Update difficulty data based on alcohol mode
        Object.keys(difficultyData).forEach(key => {
            const data = difficultyData[key];
            if (MultiplayerDifficultyModule.alcoholMode && data.penaltyAlcohol) {
                data.currentPenalty = data.penaltyAlcohol;
            } else {
                data.currentPenalty = data.penalty;
            }
        });
    }

    // ===========================
    // HEADER INFO
    // ===========================

    function updateHeaderInfo() {
        const hostNameEl = document.getElementById('host-name');
        const gameIdEl = document.getElementById('game-id-display');

        if (hostNameEl && MultiplayerDifficultyModule.gameState.playerName) {
            hostNameEl.textContent = MultiplayerDifficultyModule.gameState.playerName;
        }

        if (gameIdEl) {
            if (MultiplayerDifficultyModule.gameState.gameId) {
                gameIdEl.textContent = MultiplayerDifficultyModule.gameState.gameId;
            } else {
                gameIdEl.textContent = 'Wird in Lobby erstellt...';
            }
        }
    }

    // ===========================
    // DISPLAY CATEGORIES
    // ===========================

    function displaySelectedCategories() {
        const container = document.getElementById('selected-categories-display');
        if (!container) return;

        container.innerHTML = '';

        if (!MultiplayerDifficultyModule.gameState.selectedCategories ||
            MultiplayerDifficultyModule.gameState.selectedCategories.length === 0) {
            const emptyMsg = document.createElement('span');
            emptyMsg.className = 'empty-categories-msg';
            emptyMsg.textContent = 'Keine Kategorien';
            container.appendChild(emptyMsg);
            return;
        }

        MultiplayerDifficultyModule.gameState.selectedCategories.forEach(cat => {
            const icon = categoryIcons[cat] || '❓';
            const name = categoryNames[cat] || cat;

            const tag = document.createElement('div');
            tag.className = 'category-tag';

            const iconSpan = document.createElement('span');
            iconSpan.className = 'tag-icon';
            iconSpan.textContent = icon;
            iconSpan.setAttribute('aria-hidden', 'true');

            const nameSpan = document.createElement('span');
            nameSpan.className = 'tag-name';
            nameSpan.textContent = name;

            tag.appendChild(iconSpan);
            tag.appendChild(nameSpan);

            container.appendChild(tag);
        });

        Logger.debug('✅ Categories displayed');
    }
    // ===========================
    // RENDER CARDS
    // ===========================

    function renderDifficultyCards() {
        const grid = document.getElementById('difficulty-grid');
        if (!grid) return;

        grid.innerHTML = '';

        Object.entries(difficultyData).forEach(([key, data]) => {
            const card = document.createElement('div');
            card.className = 'difficulty-card';
            card.dataset.difficulty = key;
            card.setAttribute('role', 'radio');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-checked', 'false');
            card.setAttribute('aria-label', `${data.name} Schwierigkeitsgrad wählen`);

            // Header
            const header = document.createElement('div');
            header.className = 'difficulty-header';

            const icon = document.createElement('div');
            icon.className = 'difficulty-icon';
            icon.textContent = data.icon;
            icon.setAttribute('aria-hidden', 'true');

            const name = document.createElement('h3');
            name.className = 'difficulty-name';
            name.textContent = data.name;

            header.appendChild(icon);
            header.appendChild(name);

            // Description
            const description = document.createElement('p');
            description.className = 'difficulty-description';
            description.textContent = data.description;

            // Penalty
            const penalty = document.createElement('div');
            penalty.className = 'difficulty-penalty';
            penalty.textContent = data.currentPenalty || data.penalty;

            // Formula
            const formula = document.createElement('div');
            formula.className = 'difficulty-formula';
            formula.textContent = data.formula;

            // Assemble card
            card.appendChild(header);
            card.appendChild(description);
            card.appendChild(penalty);
            card.appendChild(formula);

            // ✅ BUGFIX: Use addTrackedEventListener function (not card.addTrackedEventListener)
            addTrackedEventListener(card, 'click', () => selectDifficulty(key));

            // Keyboard support
            addTrackedEventListener(card, 'keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectDifficulty(key);
                }
            });

            grid.appendChild(card);
        });

        Logger.debug('✅ Difficulty cards rendered');
    }

    // ===========================
    // DIFFICULTY SELECTION
    // ===========================

    function selectDifficulty(difficulty) {
        // Validate difficulty
        if (!difficultyData[difficulty]) {
            Logger.error(`❌ Invalid difficulty: ${difficulty}`);
            return;
        }

        // Remove selection from all cards
        document.querySelectorAll('.difficulty-card').forEach(card => {
            card.classList.remove('selected');
            card.setAttribute('aria-checked', 'false');
        });

        // Add selection to clicked card
        const selectedCard = document.querySelector(`[data-difficulty="${difficulty}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
            selectedCard.setAttribute('aria-checked', 'true');
        }

        if (typeof MultiplayerDifficultyModule.gameState.setDifficulty === 'function') {
            MultiplayerDifficultyModule.gameState.setDifficulty(difficulty);
        } else {
            MultiplayerDifficultyModule.gameState.difficulty = difficulty;
        }

        // Update continue button
        updateContinueButton();

        // Show confirmation
        showNotification(`${difficultyData[difficulty].name} gewählt!`, 'success', 1500);

        Logger.debug(`Selected difficulty: ${difficulty}`);
    }

    function updateContinueButton() {
        const btn = document.getElementById('continue-btn');
        if (!btn) return;

        if (MultiplayerDifficultyModule.gameState.difficulty) {
            btn.disabled = false;
            btn.classList.add('enabled');
            btn.setAttribute('aria-disabled', 'false');
            btn.textContent = '➡️ Weiter zur Lobby';
        } else {
            btn.disabled = true;
            btn.classList.remove('enabled');
            btn.setAttribute('aria-disabled', 'true');
            btn.textContent = 'Schwierigkeitsgrad wählen';
        }
    }

    // ===========================
    // EVENT LISTENERS
    // ===========================

    function setupEventListeners() {
        const backBtn = document.getElementById('back-button');
        const continueBtn = document.getElementById('continue-btn');

        if (backBtn) {
            addTrackedEventListener(backBtn, 'click', goBack);
        }

        if (continueBtn) {
            addTrackedEventListener(continueBtn, 'click', proceed);
        }

        Logger.debug('✅ Event listeners setup');
    }

    // ===========================
    // NAVIGATION
    // ===========================

    async function proceed() {
        if (!MultiplayerDifficultyModule.gameState.difficulty) {
            showNotification('Bitte wähle einen Schwierigkeitsgrad', 'warning');
            return;
        }

        try {
            showNotification('Weiter zur Lobby...', 'success', 500);

            setTimeout(() => {
                window.location.href = 'multiplayer-lobby.html';
            }, 500);

        } catch (error) {
            Logger.error('❌ Proceed error:', error);
            showNotification('Fehler beim Fortfahren', 'error');
        }
    }

    function goBack() {
        try {
            if (MultiplayerDifficultyModule.gameState) {
                MultiplayerDifficultyModule.gameState.difficulty = null;
                MultiplayerDifficultyModule.gameState.save?.(true);
            }
        } catch (e) {}
        window.location.href = 'multiplayer-category-selection.html';
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
        MultiplayerDifficultyModule.state.eventListenerCleanup.forEach(
            ({ element, event, handler, capture }) => {
                try {
                    if (element) element.removeEventListener(event, handler, capture);
                } catch (e) {
                }
            }
        );

        MultiplayerDifficultyModule.state.eventListenerCleanup.length = 0;

        if (window.NocapUtils && window.NocapUtils.cleanupEventListeners) {
            window.NocapUtils.cleanupEventListeners();
        }

        Logger.debug('✅ Multiplayer difficulty selection cleanup completed');
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