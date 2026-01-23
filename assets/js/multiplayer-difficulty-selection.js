/**
 * No-Cap Multiplayer Difficulty Selection
 * Version 4.3 - FSK18-System Integration
 *
 * ✅ FSK18: FSK0 & FSK16 always allowed, FSK18 requires server validation
 * ✅ NEW: Rechtlich sichere Texte (keine "Schlücke"-Animierung)
 * ✅ BUGFIX: Module Pattern added
 * ✅ BUGFIX: addEventListener usage corrected
 * ✅ P1 FIX: Device mode validation
 * ✅ P0 FIX: All DOM manipulation with textContent
 */

(function(window) {
    'use strict';

    const Logger = window.NocapUtils?.Logger || {
        debug: (...args) => {},
        info: (...args) => {},
        warn: console.warn,
        error: console.error
    };

    // ===========================
    // 🔒 MODULE SCOPE
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
    // PERFORMANCE UTILITIES
    // ===========================

    function addTrackedEventListener(element, event, handler, options = {}) {
        if (!element) return;
        element.addEventListener(event, handler, options);
        const capture = typeof options === 'boolean' ? options : !!options.capture;
        MultiplayerDifficultyModule.state.eventListenerCleanup.push({ element, event, handler, capture });
    }

    // ===========================
    // CONSTANTS - RECHTLICH SICHER
    // ===========================
    const difficultyData = {
        easy: {
            name: 'Entspannt',
            icon: '🍹',
            description: 'Perfekt für entspannte Abende. Kleine Strafen bei Fehlschätzungen.',
            penalty: '1 Punkt pro Abweichung',
            formula: 'Für gemütliche Runden',
            multiplier: 1,
            color: '#4CAF50'
        },
        medium: {
            name: 'Normal',
            icon: '🍺',
            description: 'Gute Balance. Standard für die meisten Spielrunden.',
            penalty: 'Abweichung = Punkte',
            formula: 'Ausgewogene Herausforderung',
            multiplier: 1,
            color: '#FF9800'
        },
        hard: {
            name: 'Hardcore',
            icon: '🍻',
            description: 'Für Profis. Hohe Strafen bei Fehlschätzungen!',
            penalty: 'Abweichung × 2 = Punkte',
            formula: 'Maximale Herausforderung!',
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
    // INITIALIZATION
    // ===========================

    async function initialize() {
        Logger.debug('🎮 Initializing multiplayer difficulty selection...');

        try {
            if (typeof window.GameState === 'undefined') {
                showNotification('Fehler: GameState nicht gefunden', 'error');
                return;
            }

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

            if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
                await window.NocapUtils.waitForDependencies(['GameState']);
            }

            MultiplayerDifficultyModule.gameState = new window.GameState();

            MultiplayerDifficultyModule.gameState.setDeviceMode('multi');
            Logger.debug('📱 Device mode set to: multi');

            // ✅ FSK18-SYSTEM: Validate game state with server-side FSK check
            const isValid = await validateGameState();
            if (!isValid) {
                return;
            }

            checkAlcoholMode();
            updateAlcoholModeUI();
            updateHeaderInfo();
            displaySelectedCategories();
            renderDifficultyCards();
            setupEventListeners();

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

    /**
     * ✅ FSK18-SYSTEM: Updated validation with server-side FSK check
     * - FSK0 & FSK16: No validation needed
     * - FSK18: Requires server validation via GameState.canAccessFSK()
     */
    async function validateGameState() {
        Logger.debug('🔍 Validating game state...');
        Logger.debug('GameState:', {
            deviceMode: MultiplayerDifficultyModule.gameState?.deviceMode,
            playerName: MultiplayerDifficultyModule.gameState?.playerName,
            selectedCategories: MultiplayerDifficultyModule.gameState?.selectedCategories,
            gameId: MultiplayerDifficultyModule.gameState?.gameId
        });

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

        // ✅ FSK18-SYSTEM: Check if FSK18 is selected
        const selectedCategories = MultiplayerDifficultyModule.gameState.selectedCategories || [];
        const hasFSK18 = selectedCategories.includes('fsk18');

        // ✅ FSK0 & FSK16: No validation needed
        if (!hasFSK18) {
            Logger.debug('✅ No FSK18 content - validation passed');
            return true;
        }

        // ✅ FSK18: Server-side validation required
        Logger.debug('🔒 FSK18 content detected - validating access...');

        // Check Firebase availability (fail closed)
        if (!window.FirebaseConfig?.isInitialized?.()) {
            Logger.error('❌ Firebase not available - cannot validate FSK18 access');
            showNotification(
                '⚠️ FSK18-Validierung erfordert Internetverbindung',
                'error',
                5000
            );
            setTimeout(() => window.location.href = 'multiplayer-category-selection.html', 2000);
            return false;
        }

        try {
            // Use GameState's server validation
            const hasAccess = await MultiplayerDifficultyModule.gameState.canAccessFSK('fsk18', true);

            if (!hasAccess) {
                Logger.error('❌ FSK18 access denied');
                showNotification(
                    '🔞 Keine Berechtigung für FSK18-Inhalte! Bitte verifiziere dein Alter.',
                    'error',
                    5000
                );
                setTimeout(() => window.location.href = 'multiplayer-category-selection.html', 2000);
                return false;
            }

            Logger.debug('✅ FSK18 access validated');
            return true;

        } catch (error) {
            Logger.error('❌ FSK18 validation error:', error);
            showNotification(
                '⚠️ Fehler bei der Altersverifikation. Bitte versuche es erneut.',
                'error',
                5000
            );
            setTimeout(() => window.location.href = 'multiplayer-category-selection.html', 2000);
            return false;
        }
    }

    // ===========================
    // ALCOHOL MODE - NEUE LOGIK
    // ===========================

    function checkAlcoholMode() {
        try {
            const getLS = (k) => window.NocapUtils?.getLocalStorage
                ? window.NocapUtils.getLocalStorage(k)
                : localStorage.getItem(k);

            const rawAge = getLS('nocap_age_level');
            const ageLevel = Number(rawAge) || parseInt(String(rawAge || '0'), 10) || 0;

            MultiplayerDifficultyModule.alcoholMode = false;

            if (ageLevel >= 18) {
                const alcoholModeStr = String(getLS('nocap_alcohol_mode') || 'false');
                MultiplayerDifficultyModule.alcoholMode = alcoholModeStr === 'true';
            }

        } catch (error) {
            Logger.error('❌ Error checking alcohol mode:', error);
            MultiplayerDifficultyModule.alcoholMode = false;
        }
    }

    /**
     * ✅ NEW: Rechtlich sichere UI-Updates (keine "Schlücke"-Animierung)
     */
    function updateAlcoholModeUI() {
        const subtitle = document.getElementById('difficulty-subtitle');

        // ✅ Rechtlich sicher: immer "Punkte"
        if (subtitle) {
            subtitle.textContent = 'Wie intensiv soll das Spiel werden?';

            const small = document.createElement('small');
            small.textContent = 'Bestimmt die Konsequenz bei Fehlschätzungen';
            subtitle.appendChild(document.createElement('br'));
            subtitle.appendChild(small);
        }

        // ✅ Keine Unterscheidung mehr zwischen Alkohol/Nicht-Alkohol
        // Alle Texte bleiben rechtlich sicher
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
    // RENDER CARDS - NEUE TEXTE
    // ===========================

    function renderDifficultyCards() {
        const grid = document.getElementById('difficulty-grid');
        if (!grid) return;

        grid.innerHTML = '';

        Object.entries(difficultyData).forEach(([key, data]) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `difficulty-card ${key}`;
            card.dataset.difficulty = key;
            card.setAttribute('role', 'radio');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-checked', 'false');
            card.setAttribute('aria-label', `${data.name} - ${data.penalty}`);

            // Header
            const header = document.createElement('div');
            header.className = 'difficulty-header';

            const left = document.createElement('div');
            left.className = 'difficulty-left';

            const icon = document.createElement('div');
            icon.className = 'sips-indicator';
            icon.id = `${key}-icon`;
            icon.textContent = data.icon;
            icon.setAttribute('aria-hidden', 'true');

            const info = document.createElement('div');
            info.className = 'difficulty-info';

            const name = document.createElement('h2');
            name.textContent = data.name;

            const badge = document.createElement('div');
            badge.className = `difficulty-badge ${key}-badge`;
            badge.setAttribute('role', 'img');
            badge.setAttribute('aria-label', `${data.name} Schwierigkeitsgrad`);
            badge.textContent = key === 'easy' ? 'LEICHT' : key === 'medium' ? 'MITTEL' : 'SCHWER';

            info.appendChild(name);
            info.appendChild(badge);

            left.appendChild(icon);
            left.appendChild(info);

            header.appendChild(left);

            // Explanation
            const explanation = document.createElement('div');
            explanation.className = 'sips-explanation';

            const baseSips = document.createElement('div');
            baseSips.className = 'base-sips';
            baseSips.id = `${key}-base`;
            baseSips.textContent = data.penalty;

            const formula = document.createElement('div');
            formula.className = 'sips-formula';
            formula.id = `${key}-formula`;

            const formulaDiv = document.createElement('div');
            formulaDiv.textContent = data.formula;
            formula.appendChild(formulaDiv);

            explanation.appendChild(baseSips);
            explanation.appendChild(formula);

            // Description
            const description = document.createElement('div');
            description.className = 'difficulty-description';
            description.textContent = data.description;

            // Assemble card
            card.appendChild(header);
            card.appendChild(explanation);
            card.appendChild(description);

            addTrackedEventListener(card, 'click', () => selectDifficulty(key));

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
        if (!difficultyData[difficulty]) {
            Logger.error(`❌ Invalid difficulty: ${difficulty}`);
            return;
        }

        document.querySelectorAll('.difficulty-card').forEach(card => {
            card.classList.remove('selected');
            card.setAttribute('aria-checked', 'false');
        });

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

        updateContinueButton();

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
            btn.textContent = 'Weiter zur Lobby';
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
            // ✅ Wenn wir eine bestehende Lobby editieren, speichere Difficulty direkt in Firebase
            const getLS = (k) => window.NocapUtils?.getLocalStorage
                ? window.NocapUtils.getLocalStorage(k)
                : localStorage.getItem(k);

            const isEditingLobby = String(getLS('nocap_editing_lobby') || 'false') === 'true';
            const existingGameId = getLS('nocap_existing_game_id');

            if (isEditingLobby && existingGameId && MultiplayerDifficultyModule.gameState.isHost) {
                try {
                    // ✅ Update difficulty in Firebase
                    const instances = window.FirebaseConfig?.getFirebaseInstances?.();
                    const database = instances?.database;

                    if (database?.ref) {
                        await database.ref(`games/${existingGameId}/settings/difficulty`).set(MultiplayerDifficultyModule.gameState.difficulty);
                        Logger.debug('✅ Updated difficulty in existing game:', MultiplayerDifficultyModule.gameState.difficulty);
                    }
                } catch (error) {
                    Logger.error('❌ Failed to update difficulty:', error);
                }
            }

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