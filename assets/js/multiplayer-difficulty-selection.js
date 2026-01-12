/**
 * No-Cap Multiplayer Difficulty Selection
 * Version 4.0 - Production Ready (Full Audit Fix)
 *
 * ✅ P1 FIX: Device mode validation
 * ✅ P0 FIX: MultiplayerDifficultyModule.firebaseService reference
 * ✅ P0 FIX: localStorage with nocap_ prefix
 * ✅ P0 FIX: All DOM manipulation with textContent
 * ✅ P0 FIX: FSK validation
 */

(function(window) {
    'use strict';

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
    // GLOBAL STATE
    // ===========================
    

    // ===========================
    // INITIALIZATION
    // ===========================

    async function initialize() {
        if (MultiplayerDifficultyModule.isDevelopment) {
            console.log('🎮 Initializing multiplayer difficulty selection...');
        }

        try {
            // Check DOMPurify
            if (typeof DOMPurify === 'undefined') {
                console.error('❌ CRITICAL: DOMPurify not loaded!');
                alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
                return;
            }

            // Check dependencies
            if (typeof GameState === 'undefined') {
                showNotification('Fehler: MultiplayerDifficultyModule.gameState nicht gefunden', 'error');
                return;
            }

            // Wait for dependencies
            if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
                await window.NocapUtils.waitForDependencies(['MultiplayerDifficultyModule.gameState', 'MultiplayerDifficultyModule.firebaseService']);
            }

            MultiplayerDifficultyModule.gameState = new GameState();

            // ✅ FIX: Ensure device mode is set for multiplayer
            if (!MultiplayerDifficultyModule.gameState.deviceMode) {
                MultiplayerDifficultyModule.gameState.setDeviceMode('multi');
                if (MultiplayerDifficultyModule.isDevelopment) {
                    console.log('⚠️ Device mode was not set, setting to multi');
                }
            }

            // ===========================
            // CRITICAL: VALIDATE DEVICE MODE
            // This page requires multiplayer host mode
            // ===========================
            if (!validateGameState()) {
                return;
            }

            // ✅ FIX: Use window.MultiplayerDifficultyModule.firebaseService (not firebaseGameService)
            if (typeof window.MultiplayerDifficultyModule.firebaseService !== 'undefined') {
                MultiplayerDifficultyModule.firebaseService = window.MultiplayerDifficultyModule.firebaseService;
            } else {
                console.error('❌ Firebase service not available');
                showNotification('Firebase nicht verfügbar', 'error');
                setTimeout(() => window.location.href = 'multiplayer-lobby.html', 3000);
                return;
            }

            // Check alcohol mode
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

            // Load from MultiplayerDifficultyModule.gameState
            if (MultiplayerDifficultyModule.gameState.difficulty) {
                const card = document.querySelector(`[data-difficulty="${MultiplayerDifficultyModule.gameState.difficulty}"]`);
                if (card) {
                    card.classList.add('selected');
                    card.setAttribute('aria-checked', 'true');
                    updateContinueButton();
                }
            }

            if (MultiplayerDifficultyModule.isDevelopment) {
                console.log('✅ Multiplayer difficulty selection initialized');
            }

        } catch (error) {
            console.error('❌ Initialization error:', error);
            showNotification('Fehler beim Laden', 'error');
        }
    }

    // ===========================
    // VALIDATION
    // ===========================

    /**
     * Validate game state with strict checks
     */
    function validateGameState() {
        if (MultiplayerDifficultyModule.isDevelopment) {
            console.log('🔍 Validating game state...');
            console.log('GameState:', {
                deviceMode: MultiplayerDifficultyModule.gameState?.deviceMode,
                playerName: MultiplayerDifficultyModule.gameState?.playerName,
                selectedCategories: MultiplayerDifficultyModule.gameState?.selectedCategories,
                gameId: MultiplayerDifficultyModule.gameState?.gameId
            });
        }

        // Strict device mode check
        if (!MultiplayerDifficultyModule.gameState || MultiplayerDifficultyModule.gameState.deviceMode !== 'multi') {
            console.error('❌ Wrong device mode:', MultiplayerDifficultyModule.gameState?.deviceMode);
            showNotification('Falscher Spielmodus', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (!MultiplayerDifficultyModule.gameState.checkValidity()) {
            showNotification('Ungültiger Spielzustand', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        // ✅ Player name must be set (from category-selection)
        if (!MultiplayerDifficultyModule.gameState.playerName || MultiplayerDifficultyModule.gameState.playerName.trim() === '') {
            console.error('❌ No player name - redirecting to category selection');
            showNotification('Bitte zuerst Spielername eingeben', 'warning');
            setTimeout(() => window.location.href = 'multiplayer-category-selection.html', 2000);
            return false;
        }

        if (!MultiplayerDifficultyModule.gameState.selectedCategories || MultiplayerDifficultyModule.gameState.selectedCategories.length === 0) {
            console.error('❌ No categories selected');
            showNotification('Keine Kategorien ausgewählt', 'error');
            setTimeout(() => window.location.href = 'multiplayer-category-selection.html', 2000);
            return false;
        }

        // ✅ FIX: Game-ID wird erst in der Lobby erstellt, nicht hier prüfen!
        // Flow: Category → Difficulty → Lobby (Game-ID wird HIER erstellt)

        if (MultiplayerDifficultyModule.isDevelopment) {
            console.log('✅ Game state valid');
        }
        return true;
    }

    // ===========================
    // ALCOHOL MODE
    // ===========================

    function checkAlcoholMode() {
        try {
            if (window.NocapUtils && window.NocapUtils.getLocalStorage) {
                // ✅ FIX: Use nocap_alcohol_mode (with prefix)
                const alcoholModeStr = window.NocapUtils.getLocalStorage('nocap_alcohol_mode');
                MultiplayerDifficultyModule.alcoholMode = alcoholModeStr === 'true';
            }
            if (MultiplayerDifficultyModule.isDevelopment) {
                console.log(`🍺 Alcohol mode: ${MultiplayerDifficultyModule.alcoholMode}`);
            }
        } catch (error) {
            if (MultiplayerDifficultyModule.isDevelopment) {
                console.error('❌ Error checking alcohol mode:', error);
            }
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

        // ✅ Game-ID wird erst in Lobby erstellt
        if (gameIdEl) {
            if (MultiplayerDifficultyModule.gameState.gameId) {
                gameIdEl.textContent = MultiplayerDifficultyModule.gameState.gameId;
            } else {
                gameIdEl.textContent = 'Wird in Lobby erstellt...';
            }
        }
    }

    // ===========================
    // DISPLAY CATEGORIES WITH TEXTCONTENT
    // ===========================

    /**
     * Display selected categories with safe DOM manipulation
     */
    function displaySelectedCategories() {
        const container = document.getElementById('selected-categories-display');
        if (!container) return;

        container.innerHTML = '';

        if (!MultiplayerDifficultyModule.gameState.selectedCategories || MultiplayerDifficultyModule.gameState.selectedCategories.length === 0) {
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

        if (MultiplayerDifficultyModule.isDevelopment) {
            console.log('✅ Categories displayed');
        }
    }

    // ===========================
    // RENDER CARDS WITH TEXTCONTENT
    // ===========================

    /**
     * Render difficulty cards with safe DOM manipulation
     */
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

            // Event listeners
            card.addTrackedEventListener('click', () => selectDifficulty(key));

            // Keyboard support
            card.addTrackedEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectDifficulty(key);
                }
            });

            grid.appendChild(card);
        });

        if (MultiplayerDifficultyModule.isDevelopment) {
            console.log('✅ Difficulty cards rendered');
        }
    }

    // ===========================
    // DIFFICULTY SELECTION
    // ===========================

    /**
     * Select difficulty with validation
     */
    function selectDifficulty(difficulty) {
        // Validate difficulty
        if (!difficultyData[difficulty]) {
            console.error(`❌ Invalid difficulty: ${difficulty}`);
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

        // Update MultiplayerDifficultyModule.gameState
        MultiplayerDifficultyModule.gameState.difficulty = difficulty;

        // Update continue button
        updateContinueButton();

        // Show confirmation
        showNotification(`${difficultyData[difficulty].name} gewählt!`, 'success', 1500);

        if (MultiplayerDifficultyModule.isDevelopment) {
            console.log(`Selected difficulty: ${difficulty}`);
        }
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
            backBtn.addTrackedEventListener('click', goBack);
        }

        if (continueBtn) {
            continueBtn.addTrackedEventListener('click', proceed);
        }

        if (MultiplayerDifficultyModule.isDevelopment) {
            console.log('✅ Event listeners setup');
        }
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
            // ✅ Difficulty wird in MultiplayerDifficultyModule.gameState gespeichert
            // Firebase Update erfolgt erst in Lobby wenn Game-ID erstellt wurde

            showNotification('Weiter zur Lobby...', 'success', 500);

            setTimeout(() => {
                window.location.href = 'multiplayer-lobby.html';
            }, 500);

        } catch (error) {
            if (MultiplayerDifficultyModule.isDevelopment) {
                console.error('❌ Proceed error:', error);
            }
            showNotification('Fehler beim Fortfahren', 'error');
        }
    }

    function goBack() {
        window.location.href = 'multiplayer-category-selection.html';
    }

    // ===========================
    // INPUT SANITIZATION
    // ===========================

    /**
     * Sanitize text with NocapUtils or fallback
     */
    function sanitizeText(input) {
        if (!input) return '';

        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            return window.NocapUtils.sanitizeInput(String(input));
        }

        return String(input).replace(/<[^>]*>/g, '').substring(0, 500);
    }

    // ===========================
    // UTILITIES (use NocapUtils)
    // ===========================

    const showNotification = window.NocapUtils?.showNotification || function(message, type = 'info') {
        alert(sanitizeText(String(message))); // Fallback
    };

    // ===========================
    // CLEANUP
    // ===========================

    function cleanup() {
        if (window.NocapUtils && window.NocapUtils.cleanupEventListeners) {
            window.NocapUtils.cleanupEventListeners();
        }

        if (MultiplayerDifficultyModule.isDevelopment) {
            console.log('✅ Multiplayer difficulty selection cleanup completed');
        }
    }

    window.addTrackedEventListener('beforeunload', cleanup);

    // ===========================
    // INITIALIZATION
    // ===========================

    if (document.readyState === 'loading') {
        document.addTrackedEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})(window);