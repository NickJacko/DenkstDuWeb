/**
 * No-Cap Player Setup (Single Device Mode)
 * Version 5.0 - JavaScript-Kern Hardening
 *
 * ✅ P0: Module Pattern - no global variables (XSS prevention)
 * ✅ P0: Event-Listener cleanup on beforeunload
 * ✅ P1: Device mode validation
 * ✅ P0: Input sanitization with DOMPurify
 * ✅ P1: Players stored in PlayerSetupModule.gameState
 * ✅ P1: Keyboard navigation improved
 * ✅ P2: Drag & drop with accessibility
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

    const PlayerSetupModule = {
        state: {
            gameState: null,
            alcoholMode: false,
            questionCounts: {
                fsk0: 0,
                fsk16: 0,
                fsk18: 0,
                special: 0
            },
            draggedItem: null,
            undoStack: [],
            eventListenerCleanup: [],
            isDevelopment: window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('192.168.')
        },

        get gameState() { return this.state.gameState; },
        set gameState(val) { this.state.gameState = val; },

        get alcoholMode() { return this.state.alcoholMode; },
        set alcoholMode(val) { this.state.alcoholMode = !!val; },

        get questionCounts() { return this.state.questionCounts; },

        get draggedItem() { return this.state.draggedItem; },
        set draggedItem(val) { this.state.draggedItem = val; },

        get undoStack() { return this.state.undoStack; },

        get isDevelopment() { return this.state.isDevelopment; }
    };

    Object.seal(PlayerSetupModule.state);

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
        PlayerSetupModule.state.eventListenerCleanup.push({element, event, handler, options});
    }

    // ===========================
    // CONSTANTS
    // ===========================
    const MAX_PLAYERS = 10; // ✅ P1 Stabilität: Maximum 10 Spieler (serverseitig via joinGame validiert)
    const MIN_PLAYERS = 2;
    const MAX_UNDO_STACK = 10;

    // (All state moved to PlayerSetupModule)

    // ===========================
    // INITIALIZATION
    // ===========================

    /**
     * Wait for Firebase to be fully initialized
     */
    async function waitForFirebase() {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max

        while (attempts < maxAttempts) {
            if (window.firebaseInitialized) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        console.warn('⚠️ Firebase initialization timeout');
        return false;
    }

    async function initialize() {
        if (PlayerSetupModule.isDevelopment) {
            console.log('👥 Initializing player setup...');
        }

        showLoading();

        try {
            // Check DOMPurify
            if (typeof DOMPurify === 'undefined') {
                console.error('❌ CRITICAL: DOMPurify not loaded!');
                alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
                hideLoading();
                return;
            }

            // Check for required dependencies
            if (typeof window.GameState === 'undefined') {
                console.error('❌ PlayerSetupModule.gameState not found');
                showNotification('Fehler beim Laden. Bitte Seite neu laden.', 'error');
                hideLoading();
                return;
            }

            const firebaseReady = await waitForFirebase();
            if (!firebaseReady && !PlayerSetupModule.isDevelopment) {
                showOfflineMode();
            }

            // Wait for dependencies
            if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
                await window.NocapUtils.waitForDependencies(['GameState']);
            }

            // Use central PlayerSetupModule.gameState
            PlayerSetupModule.gameState = new window.GameState();

            // ✅ P1 FIX: Validate device mode
            if (!validateDeviceMode()) {
                hideLoading();
                return;
            }

            // Check alcohol mode
            checkAlcoholMode();

            // Validate prerequisites
            if (!validatePrerequisites()) {
                hideLoading();
                return;
            }

            // Load question counts
            await loadQuestionCounts();

            // Load players from PlayerSetupModule.gameState
            initializePlayerInputs();

            // Update UI
            updateGameSummary();
            updateUI();

            // Setup event listeners
            setupEventListeners();

            hideLoading();

            if (PlayerSetupModule.isDevelopment) {
                console.log('✅ Player setup initialized');
                console.log('Game State:', PlayerSetupModule.gameState.getDebugInfo());
            }

        } catch (error) {
            console.error('❌ Initialization error:', error);
            showNotification('Fehler beim Laden', 'error');
            hideLoading();
        }
    }

    // ===========================
    // VALIDATION & GUARDS
    // ===========================

    /**
     * ✅ P1 FIX: Validate device mode
     */
    function validateDeviceMode() {
        const deviceMode = PlayerSetupModule.gameState.deviceMode;

        if (!deviceMode) {
            console.error('❌ No device mode set');
            showNotification('Spielmodus nicht gesetzt', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (deviceMode !== 'single') {
            console.error(`❌ Wrong device mode: ${deviceMode} (expected "single")`);
            showNotification('Nicht im Einzelgerät-Modus', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (PlayerSetupModule.isDevelopment) {
            console.log('✅ Device mode validated: single');
        }

        return true;
    }

    function validatePrerequisites() {
        if (!PlayerSetupModule.gameState.checkValidity()) {
            showNotification('Ungültiger Spielzustand', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (!PlayerSetupModule.gameState.selectedCategories || PlayerSetupModule.gameState.selectedCategories.length === 0) {
            console.error('❌ No categories selected');
            showNotification('Keine Kategorien ausgewählt!', 'error');
            setTimeout(() => window.location.href = 'category-selection.html', 2000);
            return false;
        }

        if (!PlayerSetupModule.gameState.difficulty) {
            console.error('❌ No difficulty selected');
            showNotification('Kein Schwierigkeitsgrad ausgewählt!', 'error');
            setTimeout(() => window.location.href = 'difficulty-selection.html', 2000);
            return false;
        }

        return true;
    }

    // ===========================
    // ALCOHOL MODE CHECK
    // ===========================

    function checkAlcoholMode() {
        try {
            PlayerSetupModule.alcoholMode = PlayerSetupModule.gameState.alcoholMode === true;
            if (PlayerSetupModule.alcoholMode) {
                const ageLevel = parseInt(localStorage.getItem('nocap_age_level')) || 0;
                if (ageLevel < 18) {
                    PlayerSetupModule.alcoholMode = false;
                    if (typeof PlayerSetupModule.gameState.setAlcoholMode === 'function') {
                        PlayerSetupModule.gameState.setAlcoholMode(false);
                    }
                    showNotification('Alkohol-Modus nur für 18+', 'warning', 2500);
                }
            }
            const difficultyIcon = document.getElementById('difficulty-icon');
            if (difficultyIcon) {
                difficultyIcon.textContent = PlayerSetupModule.alcoholMode ? '🍺' : '💧';
            }

            if (PlayerSetupModule.isDevelopment) {
                console.log(`🍺 Alcohol mode: ${PlayerSetupModule.alcoholMode}`);
            }
        } catch (error) {
            console.error('Error checking alcohol mode:', error);
            PlayerSetupModule.alcoholMode = false;
        }
    }

    // ===========================
    // QUESTION COUNTS FROM FIREBASE
    // ===========================

    async function loadQuestionCounts() {
        try {
            if (PlayerSetupModule.isDevelopment) {
                console.log('📊 Loading question counts...');
            }

            // ✅ P1 STABILITY: Check if Firebase is initialized
            if (!window.firebaseInitialized || typeof firebase === 'undefined' || !firebase.database) {
                console.warn('⚠️ Firebase not available, using offline mode');
                showOfflineMode();
                await loadLocalBackup();
                return;
            }

            // ✅ FIX: Get Firebase instances from FirebaseConfig
            const firebaseInstances = window.FirebaseConfig?.getFirebaseInstances();
            if (!firebaseInstances || !firebaseInstances.database) {
                console.warn('⚠️ Firebase database not available, using offline mode');
                showOfflineMode();
                await loadLocalBackup();
                return;
            }

            const { database } = firebaseInstances;
            const categories = ['fsk0', 'fsk16', 'fsk18', 'special'];

            for (const category of categories) {
                try {
                    const questionsRef = database.ref(`questions/${category}`);
                    const snapshot = await questionsRef.once('value');

                    if (snapshot.exists()) {
                        const questions = snapshot.val();
                        PlayerSetupModule.questionCounts[category] = Object.keys(questions).length;
                    } else {
                        PlayerSetupModule.questionCounts[category] = getFallbackCount(category);
                    }
                } catch (error) {
                    console.warn(`Error loading ${category}:`, error);
                    PlayerSetupModule.questionCounts[category] = getFallbackCount(category);
                }
            }

            hideOfflineMode();
            updateTotalQuestions();

            if (PlayerSetupModule.isDevelopment) {
                console.log('✅ Question counts loaded:', PlayerSetupModule.questionCounts);
            }

        } catch (error) {
            console.error('Error loading question counts:', error);
            showOfflineMode();
            await loadLocalBackup();
        }
    }

    /**
     * ✅ P1 STABILITY: Load local backup when offline
     */
    async function loadLocalBackup() {
        try {
            const response = await fetch('/assets/data/questions-backup.json');
            if (response.ok) {
                const backup = await response.json();
                if (backup.counts) {
                    Object.assign(PlayerSetupModule.state.questionCounts, backup.counts);
                } else {
                    useFallbackCounts();
                }
                updateTotalQuestions();

                if (PlayerSetupModule.isDevelopment) {
                    console.log('✅ Loaded local backup:', PlayerSetupModule.questionCounts);
                }
            } else {
                throw new Error('Backup file not found');
            }
        } catch (error) {
            console.warn('⚠️ Could not load backup, using fallback:', error);
            useFallbackCounts();
        }
    }

    /**
     * ✅ P1 STABILITY: Show offline mode warning
     */
    function showOfflineMode() {
        const offlineWarning = document.getElementById('offline-warning');
        if (offlineWarning) {
            offlineWarning.classList.remove('hidden');
        }
    }

    /**
     * ✅ P1 STABILITY: Hide offline mode warning
     */
    function hideOfflineMode() {
        const offlineWarning = document.getElementById('offline-warning');
        if (offlineWarning) {
            offlineWarning.classList.add('hidden');
        }
    }

    function useFallbackCounts() {
        Object.assign(PlayerSetupModule.state.questionCounts, {
            fsk0: 200, fsk16: 300, fsk18: 250, special: 150
        });
        updateTotalQuestions();
    }

    function getFallbackCount(category) {
        const fallbacks = { fsk0: 200, fsk16: 300, fsk18: 250, special: 150 };
        return fallbacks[category] || 0;
    }

    function updateTotalQuestions() {
        const totalQuestionsEl = document.getElementById('questions-total');
        if (!totalQuestionsEl) return;

        if (!PlayerSetupModule.gameState.selectedCategories || PlayerSetupModule.gameState.selectedCategories.length === 0) {
            totalQuestionsEl.textContent = '0 Fragen';
            return;
        }

        const total = PlayerSetupModule.gameState.selectedCategories.reduce((sum, category) => {
            return sum + (PlayerSetupModule.questionCounts[category] || 0);
        }, 0);

        totalQuestionsEl.textContent = `${total} Fragen`;
    }

    // ===========================
    // INPUT SANITIZATION
    // ✅ P0 SECURITY: Use centralized sanitizer from utils.js
    // ===========================

    /**
     * ✅ P0 SECURITY: Sanitize player name using NocapUtils
     * Imported from utils.js to avoid code duplication
     */
    const sanitizePlayerName = (input) => {
        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            // Use centralized sanitizer
            let sanitized = window.NocapUtils.sanitizeInput(input);

            // Additional cleanup for player names
            sanitized = sanitized
                .replace(/[^\w\säöüÄÖÜß\-]/g, '') // Only alphanumeric, spaces, umlauts, hyphens
                .trim();

            // Limit to 15 characters
            return sanitized.substring(0, 15);
        }

        // Fallback if NocapUtils not available
        if (!input) return '';

        let sanitized = String(input)
            .replace(/<[^>]*>/g, '')               // Remove HTML tags
            .replace(/[<>'"]/g, '')                // Remove dangerous chars
            .replace(/[^\w\säöüÄÖÜß\-]/g, '')     // Only safe chars
            .trim()
            .substring(0, 15);

        return sanitized;
    };

    // ===========================
    // PLAYER INPUT MANAGEMENT
    // ===========================

    /**
     * Initialize player inputs from PlayerSetupModule.gameState
     */
    function initializePlayerInputs() {
        // Check if players exist in PlayerSetupModule.gameState
        const savedPlayers = PlayerSetupModule.gameState.players || PlayerSetupModule.gameState.get?.('players');

        if (savedPlayers && Array.isArray(savedPlayers) && savedPlayers.length > 0) {
            if (PlayerSetupModule.isDevelopment) {
                console.log('🔄 Loading previous players from GameState:', savedPlayers);
            }

            const inputs = document.querySelectorAll('.player-input');

            savedPlayers.forEach((playerName, index) => {
                const sanitizedName = sanitizePlayerName(playerName);

                if (index < inputs.length) {
                    inputs[index].value = sanitizedName;
                } else {
                    // Add more inputs if needed
                    while (document.querySelectorAll('.player-input').length <= index) {
                        addPlayerInput();
                    }
                    const newInputs = document.querySelectorAll('.player-input');
                    if (newInputs[index]) {
                        newInputs[index].value = sanitizedName;
                    }
                }
            });

            // Update UI after loading
            updatePlayersFromInputs();
            updateUI();
        }
    }

    /**
     * Get current players list from inputs
     */
    function getPlayersList() {
        const inputs = document.querySelectorAll('.player-input');
        const players = [];

        inputs.forEach(input => {
            const name = sanitizePlayerName(input.value.trim());
            if (name && name.length >= 2) {
                players.push(name);
            }
        });

        return players;
    }

    /**
     * ✅ P1 FIX: Update players in PlayerSetupModule.gameState from inputs
     */
    function updatePlayersFromInputs() {
        const players = getPlayersList();

        if (typeof PlayerSetupModule.gameState.setPlayers === 'function') {
            PlayerSetupModule.gameState.setPlayers(players);
        } else if (typeof PlayerSetupModule.gameState.set === 'function') {
            PlayerSetupModule.gameState.set('players', players);
        } else {
            PlayerSetupModule.gameState.players = players;
        }

        // Only save if we have valid players
        if (players.length > 0) {
            PlayerSetupModule.gameState.save();
        }

        if (PlayerSetupModule.isDevelopment) {
            console.log('📝 Players updated in GameState:', players);
        }
    }

    function addPlayerInput() {
        const inputsList = document.getElementById('players-input-list');
        const currentInputs = inputsList.querySelectorAll('.player-input-row');
        const limitWarning = document.getElementById('player-limit-warning');
        const addPlayerBtn = document.getElementById('add-player-btn');

        // ✅ P1 Stabilität: Maximum 10 Spieler
        if (currentInputs.length >= MAX_PLAYERS) {
            showNotification(`Maximal ${MAX_PLAYERS} Spieler erlaubt`, 'warning');

            // Zeige Limit-Warnung an
            if (limitWarning) {
                limitWarning.classList.remove('hidden');
            }

            // Deaktiviere "Spieler hinzufügen" Button
            if (addPlayerBtn) {
                addPlayerBtn.disabled = true;
                addPlayerBtn.setAttribute('aria-disabled', 'true');
            }

            return;
        }

        // Verstecke Warnung falls sichtbar
        if (limitWarning) {
            limitWarning.classList.add('hidden');
        }

        const newIndex = currentInputs.length;
        const newRow = document.createElement('div');
        newRow.className = 'player-input-row';
        newRow.setAttribute('role', 'listitem');

        const numberDiv = document.createElement('div');
        numberDiv.className = 'player-number';
        numberDiv.textContent = newIndex + 1;
        numberDiv.setAttribute('aria-hidden', 'true');

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'player-input';
        input.placeholder = `Spieler ${newIndex + 1}...`;
        input.maxLength = 15;
        input.dataset.index = newIndex;
        input.setAttribute('aria-label', `Spieler ${newIndex + 1} Name`);
        input.setAttribute('autocomplete', 'off');

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-player-btn';
        removeBtn.type = 'button';
        removeBtn.textContent = '×';
        removeBtn.dataset.index = newIndex;
        // ✅ CSP FIX: Use CSS class instead of inline style
        if (newIndex < 2) {
            removeBtn.classList.add('hidden');
        }
        removeBtn.setAttribute('aria-label', `Spieler ${newIndex + 1} entfernen`);

        newRow.appendChild(numberDiv);
        newRow.appendChild(input);
        newRow.appendChild(removeBtn);

        inputsList.appendChild(newRow);
        updateAddButton();

        input.focus();

        if (PlayerSetupModule.isDevelopment) {
            console.log(`➕ Added player input #${newIndex + 1}`);
        }
    }

    function removePlayerInput(index) {
        const inputsList = document.getElementById('players-input-list');
        const inputs = inputsList.querySelectorAll('.player-input-row');
        const limitWarning = document.getElementById('player-limit-warning');
        const addPlayerBtn = document.getElementById('add-player-btn');

        if (inputs.length <= MIN_PLAYERS) {
            showNotification(`Mindestens ${MIN_PLAYERS} Spieler nötig`, 'warning');
            return;
        }

        // ✅ P1 STABILITY: Save to undo stack before removing
        const playerInput = inputs[index].querySelector('.player-input');
        const removedPlayerName = playerInput ? playerInput.value : '';
        if (removedPlayerName && removedPlayerName.trim()) {
            addToUndoStack({
                action: 'remove',
                playerName: removedPlayerName,
                index: index
            });

            // Show undo notification
            showNotificationWithUndo(
                `Spieler "${removedPlayerName}" entfernt`,
                () => undoLastAction()
            );
        }

        // ✅ P1 Stabilität: Reaktiviere Button wenn unter Limit
        if (inputs.length === MAX_PLAYERS) {
            if (addPlayerBtn) {
                addPlayerBtn.disabled = false;
                addPlayerBtn.removeAttribute('aria-disabled');
            }
            if (limitWarning) {
                limitWarning.classList.add('hidden');
            }
        }

        inputs[index].remove();

        // Renumber remaining inputs
        const remainingInputs = inputsList.querySelectorAll('.player-input-row');
        remainingInputs.forEach((row, newIndex) => {
            const numberEl = row.querySelector('.player-number');
            const inputEl = row.querySelector('.player-input');
            const removeBtn = row.querySelector('.remove-player-btn');

            numberEl.textContent = newIndex + 1;
            inputEl.placeholder = `Spieler ${newIndex + 1}...`;
            inputEl.dataset.index = newIndex;
            inputEl.setAttribute('aria-label', `Spieler ${newIndex + 1} Name`);

            removeBtn.dataset.index = newIndex;
            // ✅ CSP FIX: Use CSS class instead of inline style
            if (newIndex < 2) {
                removeBtn.classList.add('hidden');
            } else {
                removeBtn.classList.remove('hidden');
            }
            removeBtn.setAttribute('aria-label', `Spieler ${newIndex + 1} entfernen`);
        });

        updatePlayersFromInputs();
        updateUI();
        updateAddButton();

        if (PlayerSetupModule.isDevelopment) {
            console.log(`➖ Removed player input #${index + 1}`);
        }
    }

    // ===========================
    // UNDO FUNCTIONALITY
    // ✅ P1 STABILITY: Undo for accidentally deleted players
    // ===========================

    /**
     * Add action to undo stack
     */
    function addToUndoStack(action) {
        PlayerSetupModule.undoStack.push(action);

        // Limit stack size
        if (PlayerSetupModule.undoStack.length > MAX_UNDO_STACK) {
            PlayerSetupModule.undoStack.shift();
        }

        if (PlayerSetupModule.isDevelopment) {
            console.log('📚 Undo stack:', PlayerSetupModule.undoStack);
        }
    }

    /**
     * Undo last action
     */
    function undoLastAction() {
        if (PlayerSetupModule.undoStack.length === 0) {
            showNotification('Nichts zum Rückgängigmachen', 'info');
            return;
        }

        const lastAction = PlayerSetupModule.undoStack.pop();

        if (lastAction.action === 'remove') {
            // Re-add the player
            const inputsList = document.getElementById('players-input-list');
            const currentInputs = inputsList.querySelectorAll('.player-input-row');

            // Add input at the original position or at the end
            const targetIndex = Math.min(lastAction.index, currentInputs.length);

            addPlayerInput();

            // Set the name
            const newInputs = document.querySelectorAll('.player-input');
            if (newInputs[targetIndex]) {
                newInputs[targetIndex].value = lastAction.playerName;
                newInputs[targetIndex].focus();
            }

            updatePlayersFromInputs();
            updateUI();

            showNotification('Rückgängig gemacht', 'success', 1500);

            if (PlayerSetupModule.isDevelopment) {
                console.log(`↩️ Undid removal of "${lastAction.playerName}"`);
            }
        }
    }

    /**
     * ✅ P1 UI/UX: Show notification with undo button
     */
    function showNotificationWithUndo(message, undoCallback) {
        if (window.NocapUtils && window.NocapUtils.showNotificationWithAction) {
            window.NocapUtils.showNotificationWithAction(
                message,
                'Rückgängig',
                undoCallback,
                'info',
                5000
            );
        } else {
            // Fallback
            showNotification(message, 'info', 3000);
        }
    }

    /**
     * ✅ P1 DSGVO: Delete all player data
     */
    function deleteAllPlayerData() {
        const confirmed = confirm(
            '⚠️ WARNUNG: Alle Spielerdaten werden unwiderruflich gelöscht!\n\n' +
            'Dies umfasst:\n' +
            '• Alle Spielernamen\n' +
            '• Hochgeladene Avatare\n' +
            '• Gespeicherte Spielreihenfolge\n\n' +
            'Möchten Sie wirklich fortfahren?'
        );

        if (!confirmed) {
            return;
        }

        try {
            // Clear all player inputs
            const inputsList = document.getElementById('players-input-list');
            const inputs = inputsList.querySelectorAll('.player-input');

            inputs.forEach(input => {
                input.value = '';
            });

            // Clear PlayerSetupModule.gameState
            if (typeof PlayerSetupModule.gameState.setPlayers === 'function') {
                PlayerSetupModule.gameState.setPlayers([]);
            } else if (typeof PlayerSetupModule.gameState.set === 'function') {
                PlayerSetupModule.gameState.set('players', []);
            } else {
                PlayerSetupModule.gameState.players = [];
            }
            PlayerSetupModule.gameState.save();

            // Clear undo stack
            PlayerSetupModule.state.undoStack.length = 0;

            // Clear any avatar data from localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('avatar_')) {
                    localStorage.removeItem(key);
                }
            }

            updatePlayersFromInputs();
            updateUI();

            showNotification('✅ Alle Spielerdaten gelöscht', 'success', 3000);

            if (PlayerSetupModule.isDevelopment) {
                console.log('🗑️ All player data deleted');
            }
        } catch (error) {
            console.error('Error deleting player data:', error);
            showNotification('Fehler beim Löschen der Daten', 'error');
        }
    }

    // ===========================
    // UPDATE UI
    // ===========================

    function updateUI() {
        const players = getPlayersList();

        // Update player count badge
        const currentCount = document.getElementById('current-count');
        if (currentCount) {
            currentCount.textContent = players.length;
        }

        // Update start button state
        const startBtn = document.getElementById('start-btn');
        const startHint = document.getElementById('start-hint');

        if (players.length >= MIN_PLAYERS) {
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.setAttribute('aria-disabled', 'false');
            }
            if (startHint) {
                startHint.textContent = `${players.length} Spieler bereit - Los geht's!`;
            }
        } else {
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.setAttribute('aria-disabled', 'true');
            }
            if (startHint) {
                const needed = MIN_PLAYERS - players.length;
                startHint.textContent = `Noch ${needed} Spieler nötig`;
            }
        }

        updatePlayersPreview();
        updateAddButton();
        updateRemoveButtons();
    }

    // ===========================
    // PLAYERS PREVIEW WITH DRAG & DROP
    // ===========================

    function updatePlayersPreview() {
        const preview = document.getElementById('players-preview');
        const playersOrder = document.getElementById('players-order');

        if (!preview || !playersOrder) return;

        const players = getPlayersList();

        if (players.length > 0) {
            // ✅ CSP FIX: Use CSS class instead of inline style
            preview.classList.remove('hidden');
            while (playersOrder.firstChild) playersOrder.removeChild(playersOrder.firstChild);

            players.forEach((name, index) => {
                const item = document.createElement('div');
                item.className = 'player-order-item';
                item.draggable = true;
                item.dataset.index = index;
                item.setAttribute('role', 'listitem');
                item.setAttribute('aria-label', `Spieler ${index + 1}: ${name}`);

                // ✅ AUDIT FIX: Keyboard accessibility
                item.setAttribute('tabindex', '0');
                item.setAttribute('aria-grabbed', 'false');

                const numberDiv = document.createElement('div');
                numberDiv.className = 'player-order-number';
                numberDiv.textContent = index + 1;

                const nameSpan = document.createElement('span');
                // Use textContent for XSS safety
                nameSpan.textContent = name;

                const handleSpan = document.createElement('span');
                handleSpan.className = 'drag-handle';
                handleSpan.textContent = '☰';
                handleSpan.setAttribute('aria-label', 'Ziehen zum Verschieben');

                item.appendChild(numberDiv);
                item.appendChild(nameSpan);
                item.appendChild(handleSpan);

                playersOrder.appendChild(item);
            });

            setupDragAndDrop();
        } else {
            // ✅ CSP FIX: Use CSS class instead of inline style
            preview.classList.add('hidden');
        }
    }

    // ===========================
    // DRAG & DROP FUNCTIONALITY
    // ✅ P1 STABILITY: All drag listeners are tracked for cleanup
    // ===========================

    function setupDragAndDrop() {
        const items = document.querySelectorAll('.player-order-item');

        items.forEach(item => {
            // Drag & Drop
            addTrackedEventListener(item, 'dragstart', handleDragStart);
            addTrackedEventListener(item, 'dragend', handleDragEnd);
            addTrackedEventListener(item, 'dragover', handleDragOver);
            addTrackedEventListener(item, 'drop', handleDrop);
            addTrackedEventListener(item, 'dragleave', handleDragLeave);

            // ✅ AUDIT FIX: Keyboard navigation for reordering
            addTrackedEventListener(item, 'keydown', handleKeyboardReorder);
        });
    }

    /**
     * ✅ AUDIT FIX: Keyboard navigation for player order
     * Arrow Up/Down to move players in the list
     */
    function handleKeyboardReorder(e) {
        const index = parseInt(this.dataset.index);
        const players = getPlayersList();

        let moved = false;

        if (e.key === 'ArrowUp' && index > 0) {
            // Move player up
            e.preventDefault();
            const [movedPlayer] = players.splice(index, 1);
            players.splice(index - 1, 0, movedPlayer);
            moved = true;

            if (PlayerSetupModule.isDevelopment) {
                console.log(`⬆️ Moved player ${index + 1} up`);
            }
        } else if (e.key === 'ArrowDown' && index < players.length - 1) {
            // Move player down
            e.preventDefault();
            const [movedPlayer] = players.splice(index, 1);
            players.splice(index + 1, 0, movedPlayer);
            moved = true;

            if (PlayerSetupModule.isDevelopment) {
                console.log(`⬇️ Moved player ${index + 1} down`);
            }
        }

        if (moved) {
            // Update inputs to match new order
            const inputs = document.querySelectorAll('.player-input');
            players.forEach((name, idx) => {
                if (inputs[idx]) {
                    inputs[idx].value = name;
                }
            });

            // Update PlayerSetupModule.gameState and UI
            updatePlayersFromInputs();
            updateUI();

            // Restore focus to the moved item
            setTimeout(() => {
                const items = document.querySelectorAll('.player-order-item');
                const newIndex = e.key === 'ArrowUp' ? index - 1 : index + 1;
                if (items[newIndex]) {
                    items[newIndex].focus();
                }
            }, 100);

            showNotification('Reihenfolge geändert', 'success', 1500);
        }
    }

    function handleDragStart(e) {
        PlayerSetupModule.draggedItem = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.index);

        // ✅ AUDIT FIX: Accessibility attributes
        this.setAttribute('aria-grabbed', 'true');

        if (PlayerSetupModule.isDevelopment) {
            console.log(`🎯 Started dragging player ${parseInt(this.dataset.index) + 1}`);
        }
    }

    function handleDragEnd() {
        this.classList.remove('dragging');

        // ✅ AUDIT FIX: Reset aria-grabbed
        this.setAttribute('aria-grabbed', 'false');

        document.querySelectorAll('.player-order-item').forEach(item => {
            item.classList.remove('drag-over');
            item.removeAttribute('aria-dropeffect'); // Clean up
        });
    }

    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';

        if (this !== PlayerSetupModule.draggedItem) {
            this.classList.add('drag-over');

            // ✅ AUDIT FIX: Accessibility dropeffect
            this.setAttribute('aria-dropeffect', 'move');
        }

        return false;
    }

    function handleDragLeave() {
        this.classList.remove('drag-over');

        // ✅ AUDIT FIX: Clean up aria-dropeffect
        this.removeAttribute('aria-dropeffect');
    }

    function handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        if (PlayerSetupModule.draggedItem !== this) {
            const fromIndex = parseInt(PlayerSetupModule.draggedItem.dataset.index);
            const toIndex = parseInt(this.dataset.index);

            // Get current players
            const players = getPlayersList();

            // Reorder
            const [movedPlayer] = players.splice(fromIndex, 1);
            players.splice(toIndex, 0, movedPlayer);

            // Update inputs to match new order
            const inputs = document.querySelectorAll('.player-input');
            players.forEach((name, index) => {
                if (inputs[index]) {
                    inputs[index].value = name;
                }
            });

            // Update PlayerSetupModule.gameState
            updatePlayersFromInputs();
            updateUI();

            showNotification('Reihenfolge aktualisiert!', 'success', 2000);

            if (PlayerSetupModule.isDevelopment) {
                console.log(`🔄 Reordered: ${fromIndex + 1} → ${toIndex + 1}`);
            }
        }

        return false;
    }

    // ===========================
    // UPDATE BUTTONS
    // ===========================

    function updateAddButton() {
        const addBtn = document.getElementById('add-player-btn');
        if (!addBtn) return;

        const currentInputs = document.querySelectorAll('.player-input-row').length;
        const btnText = addBtn.querySelector('.btn-text');

        if (currentInputs >= MAX_PLAYERS) {
            addBtn.disabled = true;
            addBtn.setAttribute('aria-disabled', 'true');
            if (btnText) {
                btnText.textContent = `Maximum erreicht (${MAX_PLAYERS})`;
            }
        } else {
            addBtn.disabled = false;
            addBtn.setAttribute('aria-disabled', 'false');
            if (btnText) {
                btnText.textContent = 'Spieler hinzufügen';
            }
        }
    }

    function updateRemoveButtons() {
        const removeButtons = document.querySelectorAll('.remove-player-btn');
        const totalInputs = removeButtons.length;

        removeButtons.forEach((btn, index) => {
            // ✅ CSP FIX: Use CSS class instead of inline style
            if (index < 2 || totalInputs <= MIN_PLAYERS) {
                btn.classList.add('hidden');
            } else {
                btn.classList.remove('hidden');
            }
        });
    }

    // ===========================
    // GAME SUMMARY
    // ===========================

    function updateGameSummary() {
        const categoryNames = {
            fsk0: 'Familie & Freunde 👨‍👩‍👧‍👦',
            fsk16: 'Party Time 🎉',
            fsk18: 'Heiß & Gewagt 🔥',
            special: 'Special Edition ⭐'
        };

        const difficultyNames = {
            easy: 'Entspannt (Abweichung)',
            medium: 'Normal (Abweichung)',
            hard: 'Hardcore (Abweichung × 2)'
        };

        // Use textContent
        const categoriesSummary = document.getElementById('categories-summary');
        if (categoriesSummary) {
            if (PlayerSetupModule.gameState.selectedCategories && PlayerSetupModule.gameState.selectedCategories.length > 0) {
                const categoryList = PlayerSetupModule.gameState.selectedCategories
                    .map(cat => categoryNames[cat] || cat)
                    .join(', ');
                categoriesSummary.textContent = categoryList;
            } else {
                categoriesSummary.textContent = 'Keine ausgewählt';
            }
        }

        const difficultySummary = document.getElementById('difficulty-summary');
        if (difficultySummary) {
            difficultySummary.textContent = difficultyNames[PlayerSetupModule.gameState.difficulty] || PlayerSetupModule.gameState.difficulty || 'Nicht ausgewählt';
        }
    }

    // ===========================
    // VALIDATION
    // ===========================

    // ===========================
    // HELPER: Get next empty input
    // ===========================

    function getNextEmptyInput() {
        const inputs = document.querySelectorAll('.player-input');
        for (let input of inputs) {
            if (!input.value.trim()) {
                return input;
            }
        }
        return null;
    }

    function validatePlayerNames(players) {
        const names = players.map(name => name.toLowerCase());
        const uniqueNames = new Set(names);

        if (names.length !== uniqueNames.size) {
            showNotification('Jeder Spieler braucht einen einzigartigen Namen!', 'error');
            return false;
        }

        for (let name of players) {
            if (name.length < 2 || name.length > 15) {
                showNotification('Namen müssen zwischen 2-15 Zeichen lang sein!', 'error');
                return false;
            }
        }

        return true;
    }

    // ===========================
    // EVENT LISTENERS
    // ✅ P1 STABILITY: All listeners are tracked for cleanup
    // ===========================

    function setupEventListeners() {
        // Back button
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            addTrackedEventListener(backBtn, 'click', goBack);
        }

        // Start button
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            addTrackedEventListener(startBtn, 'click', startGame);
        }

        // Add player button
        const addPlayerBtn = document.getElementById('add-player-btn');
        if (addPlayerBtn) {
            addTrackedEventListener(addPlayerBtn, 'click', addPlayerInput);
        }


        // Input changes - delegate to parent
        const inputsList = document.getElementById('players-input-list');
        if (inputsList) {
            const inputHandler = function(e) {
                if (e.target.classList.contains('player-input')) {
                    // Sanitize with NocapUtils
                    const sanitized = sanitizePlayerName(e.target.value);
                    if (sanitized !== e.target.value) {
                        e.target.value = sanitized;
                    }
                    updatePlayersFromInputs();
                    updateUI();
                }
            };
            addTrackedEventListener(inputsList, 'input', inputHandler);

            // Remove button clicks - delegate
            const clickHandler = function(e) {
                if (e.target.classList.contains('remove-player-btn')) {
                    const index = parseInt(e.target.dataset.index);
                    if (!isNaN(index)) {
                        removePlayerInput(index);
                    }
                }
            };
            addTrackedEventListener(inputsList, 'click', clickHandler);
        }

        // Enter key to move to next input or start
        const keypressHandler = function(e) {
            if (e.target.classList.contains('player-input') && e.key === 'Enter') {
                e.preventDefault();
                const nextInput = getNextEmptyInput();
                if (nextInput) {
                    nextInput.focus();
                } else if (getPlayersList().length >= MIN_PLAYERS) {
                    startGame();
                }
            }
        };
        addTrackedEventListener(document, 'keydown', keypressHandler);

        if (PlayerSetupModule.isDevelopment) {
            console.log(`✅ Setup ${PlayerSetupModule.state.eventListenerCleanup.length} tracked event listeners`);
        }
    }

    // ===========================
    // START GAME
    // ===========================

    /**
     * ✅ P1 DSGVO/Jugendschutz: Check FSK rating before starting
     */
    function checkFSKRating() {
        const difficulty = PlayerSetupModule.gameState.difficulty;
        const categories = PlayerSetupModule.gameState.selectedCategories || [];

        let requiredAge = 0;
        let warning = '';

        // Check difficulty-based FSK
        if (difficulty === 'hard' || categories.includes('fsk18')) {
            requiredAge = 18;
            warning = 'FSK 18 - Nur für Erwachsene';
        } else if (difficulty === 'medium' || categories.includes('fsk16')) {
            requiredAge = 16;
            warning = 'FSK 16 - Ab 16 Jahren';
        }

        if (requiredAge > 0) {
            // Check if user has verified age
            const ageVerification = localStorage.getItem('nocap_age_verification');
            const ageLevel = localStorage.getItem('nocap_age_level');

            if (!ageVerification || !ageLevel) {
                showNotification('Altersverifikation erforderlich!', 'error');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
                return false;
            }

            const userAge = parseInt(ageLevel);
            if (userAge < requiredAge) {
                showNotification(
                    `${warning} - Diese Kategorien sind für deine Altersgruppe nicht verfügbar.`,
                    'error'
                );
                return false;
            }
        }

        return true;
    }

    async function startGame() {
        if (PlayerSetupModule.isDevelopment) {
            console.log('🚀 Starting game...');
        }

        const players = getPlayersList();

        if (players.length < MIN_PLAYERS) {
            showNotification(`Mindestens ${MIN_PLAYERS} Spieler nötig!`, 'warning');
            return;
        }

        if (!validatePlayerNames(players)) {
            return;
        }

        if (!PlayerSetupModule.gameState.selectedCategories || PlayerSetupModule.gameState.selectedCategories.length === 0) {
            showNotification('Keine Kategorien ausgewählt!', 'error');
            return;
        }

        if (!PlayerSetupModule.gameState.difficulty) {
            showNotification('Kein Schwierigkeitsgrad ausgewählt!', 'error');
            return;
        }

        // ✅ P1 DSGVO/Jugendschutz: FSK-Check
        if (!checkFSKRating()) {
            return;
        }

        showLoading();

        if (typeof PlayerSetupModule.gameState.setPlayers === 'function') {
            PlayerSetupModule.gameState.setPlayers(players);
        } else if (typeof PlayerSetupModule.gameState.set === 'function') {
            PlayerSetupModule.gameState.set('players', players);
        } else {
            PlayerSetupModule.gameState.players = players;
        }
        if (typeof PlayerSetupModule.gameState.setGamePhase === 'function') {
            PlayerSetupModule.gameState.setGamePhase('playing');
        } else if (typeof PlayerSetupModule.gameState.set === 'function') {
            PlayerSetupModule.gameState.set('gamePhase', 'playing');
        } else {
            PlayerSetupModule.gameState.gamePhase = 'playing';
        }
        PlayerSetupModule.gameState.save(true); // Immediate save

        showNotification('Spiel wird gestartet...', 'success', 1500);

        if (PlayerSetupModule.isDevelopment) {
            console.log('Game starting with state:', PlayerSetupModule.gameState.getDebugInfo());
        }

        setTimeout(() => {
            window.location.href = 'gameplay.html';
        }, 1500);
    }

    // ===========================
    // NAVIGATION
    // ✅ P1 STABILITY: Save progress when going back
    // ===========================

    function goBack() {
        if (PlayerSetupModule.isDevelopment) {
            console.log('⬅️ Going back to difficulty selection...');
        }

        // ✅ P1 STABILITY: Save current players before going back
        const players = getPlayersList();

        if (players.length > 0) {
            if (typeof PlayerSetupModule.gameState.setPlayers === 'function') {
                PlayerSetupModule.gameState.setPlayers(players);
            } else if (typeof PlayerSetupModule.gameState.set === 'function') {
                PlayerSetupModule.gameState.set('players', players);
            } else {
                PlayerSetupModule.gameState.players = players;
            }
            PlayerSetupModule.gameState.save();

            if (PlayerSetupModule.isDevelopment) {
                console.log('💾 Saved current players:', players);
            }
        }

        showLoading();
        setTimeout(() => {
            window.location.href = 'difficulty-selection.html';
        }, 300);
    }

    // ===========================
    // UTILITY FUNCTIONS
    // ===========================
    // UTILITY FUNCTIONS (use NocapUtils)
    // ===========================

    const showLoading = window.NocapUtils?.showLoading || function() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.add('show');
    };

    const hideLoading = window.NocapUtils?.hideLoading || function() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.remove('show');
    };

    const showNotification = window.NocapUtils?.showNotification || function(message) {
        alert(String(message)); // Fallback
    };

    // ===========================
    // CLEANUP
    // ✅ P1 STABILITY: Remove all tracked event listeners to prevent memory leaks
    // ===========================

    function cleanup() {
        // Remove all tracked event listeners
        PlayerSetupModule.state.eventListenerCleanup.forEach(({ element, event, handler, options }) => {
            if (element && element.removeEventListener) {
                element.removeEventListener(event, handler, options);
            }
        });

        // Clear the array
        PlayerSetupModule.state.eventListenerCleanup.length = 0;

        if (PlayerSetupModule.isDevelopment) {
            console.log('✅ Player setup cleanup completed - all event listeners removed');
        }
    }

    addTrackedEventListener(window, 'beforeunload', cleanup);

    // ===========================
    // INITIALIZATION
    // ===========================

    async function startApp() {
        const firebaseReady = await waitForFirebase();
        if (!firebaseReady) {
            showOfflineMode();
            showNotification('Offline-Modus: Firebase nicht verfügbar.', 'warning', 3000);
        }
        await initialize();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp);
    } else {
        startApp();
    }

})(window);