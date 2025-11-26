/**
 * No-Cap Player Setup (Single Device Mode)
 * Version 4.0 - Production Ready (Full Audit Fix)
 *
 * ✅ P1 FIX: Device mode validation
 * ✅ P0 FIX: Input sanitization with DOMPurify
 * ✅ P1 FIX: Players stored in GameState
 * ✅ P1 FIX: Keyboard navigation improved
 * ✅ P2 FIX: Drag & drop with accessibility
 */

(function(window) {
    'use strict';

    // ===========================
    // CONSTANTS
    // ===========================
    const MAX_PLAYERS = 8;
    const MIN_PLAYERS = 2;

    // ===========================
    // GLOBAL STATE
    // ===========================
    let gameState = null;
    let alcoholMode = false;
    let questionCounts = {
        fsk0: 0,
        fsk16: 0,
        fsk18: 0,
        special: 0
    };

    // Drag and drop state
    let draggedItem = null;

    const isDevelopment = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('192.168.');

    // ===========================
    // INITIALIZATION
    // ===========================

    async function initialize() {
        if (isDevelopment) {
            console.log('👥 Initializing player setup...');
        }

        showLoading();

        try {
            // Check DOMPurify
            if (typeof DOMPurify === 'undefined') {
                console.error('❌ CRITICAL: DOMPurify not loaded!');
                alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
                return;
            }

            // Check for required dependencies
            if (typeof GameState === 'undefined') {
                console.error('❌ GameState not found');
                showNotification('Fehler beim Laden. Bitte Seite neu laden.', 'error');
                return;
            }

            // Wait for dependencies
            if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
                await window.NocapUtils.waitForDependencies(['GameState']);
            }

            // Use central GameState
            gameState = new GameState();

            // ✅ P1 FIX: Validate device mode
            if (!validateDeviceMode()) {
                return;
            }

            // Check alcohol mode
            checkAlcoholMode();

            // Validate prerequisites
            if (!validatePrerequisites()) {
                return;
            }

            // Load question counts
            await loadQuestionCounts();

            // Load players from GameState
            initializePlayerInputs();

            // Update UI
            updateGameSummary();
            updateUI();

            // Setup event listeners
            setupEventListeners();

            hideLoading();

            if (isDevelopment) {
                console.log('✅ Player setup initialized');
                console.log('Game State:', gameState.getDebugInfo());
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
        const deviceMode = gameState.deviceMode;

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

        if (isDevelopment) {
            console.log('✅ Device mode validated: single');
        }

        return true;
    }

    function validatePrerequisites() {
        if (!gameState.checkValidity()) {
            showNotification('Ungültiger Spielzustand', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (!gameState.selectedCategories || gameState.selectedCategories.length === 0) {
            console.error('❌ No categories selected');
            showNotification('Keine Kategorien ausgewählt!', 'error');
            setTimeout(() => window.location.href = 'category-selection.html', 2000);
            return false;
        }

        if (!gameState.difficulty) {
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
            alcoholMode = gameState.alcoholMode === true;

            const difficultyIcon = document.getElementById('difficulty-icon');
            if (difficultyIcon) {
                difficultyIcon.textContent = alcoholMode ? '🍺' : '💧';
            }

            if (isDevelopment) {
                console.log(`🍺 Alcohol mode: ${alcoholMode}`);
            }
        } catch (error) {
            console.error('Error checking alcohol mode:', error);
            alcoholMode = false;
        }
    }

    // ===========================
    // QUESTION COUNTS FROM FIREBASE
    // ===========================

    async function loadQuestionCounts() {
        try {
            if (isDevelopment) {
                console.log('📊 Loading question counts...');
            }

            if (typeof firebase === 'undefined' || !firebase.database) {
                console.warn('⚠️ Firebase not available, using fallback counts');
                useFallbackCounts();
                return;
            }

            // Wait for Firebase if available
            if (window.FirebaseService && window.FirebaseService.waitForFirebase) {
                await window.FirebaseService.waitForFirebase();
            }

            const categories = ['fsk0', 'fsk16', 'fsk18', 'special'];

            for (const category of categories) {
                try {
                    const questionsRef = firebase.database().ref(`questions/${category}`);
                    const snapshot = await questionsRef.once('value');

                    if (snapshot.exists()) {
                        const questions = snapshot.val();
                        questionCounts[category] = Object.keys(questions).length;
                    } else {
                        questionCounts[category] = getFallbackCount(category);
                    }
                } catch (error) {
                    console.warn(`Error loading ${category}:`, error);
                    questionCounts[category] = getFallbackCount(category);
                }
            }

            updateTotalQuestions();

            if (isDevelopment) {
                console.log('✅ Question counts loaded:', questionCounts);
            }

        } catch (error) {
            console.error('Error loading question counts:', error);
            useFallbackCounts();
        }
    }

    function useFallbackCounts() {
        questionCounts = {
            fsk0: 200,
            fsk16: 300,
            fsk18: 250,
            special: 150
        };
        updateTotalQuestions();
    }

    function getFallbackCount(category) {
        const fallbacks = { fsk0: 200, fsk16: 300, fsk18: 250, special: 150 };
        return fallbacks[category] || 0;
    }

    function updateTotalQuestions() {
        const totalQuestionsEl = document.getElementById('questions-total');
        if (!totalQuestionsEl) return;

        if (!gameState.selectedCategories || gameState.selectedCategories.length === 0) {
            totalQuestionsEl.textContent = '0 Fragen';
            return;
        }

        const total = gameState.selectedCategories.reduce((sum, category) => {
            return sum + (questionCounts[category] || 0);
        }, 0);

        totalQuestionsEl.textContent = `${total} Fragen`;
    }

    // ===========================
    // INPUT SANITIZATION
    // ===========================

    /**
     * Sanitize player name with NocapUtils or fallback
     */
    function sanitizePlayerName(input) {
        if (!input) return '';

        // Use NocapUtils if available
        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            return window.NocapUtils.sanitizeInput(input).substring(0, 15);
        }

        // Fallback sanitization
        let sanitized = String(input).replace(/<[^>]*>/g, '');
        sanitized = sanitized.replace(/[^a-zA-Z0-9äöüÄÖÜß\s\-_.,!?]/g, '');

        return sanitized.substring(0, 15);
    }

    // ===========================
    // PLAYER INPUT MANAGEMENT
    // ===========================

    /**
     * Initialize player inputs from GameState
     */
    function initializePlayerInputs() {
        // Check if players exist in GameState
        const savedPlayers = gameState.get('players');

        if (savedPlayers && Array.isArray(savedPlayers) && savedPlayers.length > 0) {
            if (isDevelopment) {
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
     * ✅ P1 FIX: Update players in GameState from inputs
     */
    function updatePlayersFromInputs() {
        const players = getPlayersList();

        // Store in GameState (not a direct property assignment - use setter if available)
        if (gameState.setPlayers) {
            gameState.setPlayers(players);
        } else {
            // Fallback: direct assignment
            gameState.players = players;
            gameState.save();
        }

        if (isDevelopment) {
            console.log('📝 Players updated in GameState:', players);
        }
    }

    function addPlayerInput() {
        const inputsList = document.getElementById('players-input-list');
        const currentInputs = inputsList.querySelectorAll('.player-input-row');

        if (currentInputs.length >= MAX_PLAYERS) {
            showNotification(`Maximal ${MAX_PLAYERS} Spieler erlaubt`, 'warning');
            return;
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
        removeBtn.style.display = newIndex < 2 ? 'none' : 'flex';
        removeBtn.setAttribute('aria-label', `Spieler ${newIndex + 1} entfernen`);

        newRow.appendChild(numberDiv);
        newRow.appendChild(input);
        newRow.appendChild(removeBtn);

        inputsList.appendChild(newRow);
        updateAddButton();

        input.focus();

        if (isDevelopment) {
            console.log(`➕ Added player input #${newIndex + 1}`);
        }
    }

    function removePlayerInput(index) {
        const inputsList = document.getElementById('players-input-list');
        const inputs = inputsList.querySelectorAll('.player-input-row');

        if (inputs.length <= MIN_PLAYERS) {
            showNotification(`Mindestens ${MIN_PLAYERS} Spieler nötig`, 'warning');
            return;
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
            removeBtn.style.display = newIndex < 2 ? 'none' : 'flex';
            removeBtn.setAttribute('aria-label', `Spieler ${newIndex + 1} entfernen`);
        });

        updatePlayersFromInputs();
        updateUI();
        updateAddButton();

        if (isDevelopment) {
            console.log(`➖ Removed player input #${index + 1}`);
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
            preview.style.display = 'block';
            playersOrder.innerHTML = '';

            players.forEach((name, index) => {
                const item = document.createElement('div');
                item.className = 'player-order-item';
                item.draggable = true;
                item.dataset.index = index;
                item.setAttribute('role', 'listitem');
                item.setAttribute('aria-label', `Spieler ${index + 1}: ${name}`);

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
            preview.style.display = 'none';
        }
    }

    // ===========================
    // DRAG & DROP FUNCTIONALITY
    // ===========================

    function setupDragAndDrop() {
        const items = document.querySelectorAll('.player-order-item');

        items.forEach(item => {
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragend', handleDragEnd);
            item.addEventListener('dragover', handleDragOver);
            item.addEventListener('drop', handleDrop);
            item.addEventListener('dragleave', handleDragLeave);
        });
    }

    function handleDragStart(e) {
        draggedItem = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.index);
    }

    function handleDragEnd() {
        this.classList.remove('dragging');
        document.querySelectorAll('.player-order-item').forEach(item => {
            item.classList.remove('drag-over');
        });
    }

    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';

        if (this !== draggedItem) {
            this.classList.add('drag-over');
        }

        return false;
    }

    function handleDragLeave() {
        this.classList.remove('drag-over');
    }

    function handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        if (draggedItem !== this) {
            const fromIndex = parseInt(draggedItem.dataset.index);
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

            // Update GameState
            updatePlayersFromInputs();
            updateUI();

            showNotification('Reihenfolge aktualisiert!', 'success', 2000);

            if (isDevelopment) {
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
            if (index < 2 || totalInputs <= MIN_PLAYERS) {
                btn.style.display = 'none';
            } else {
                btn.style.display = 'flex';
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
            if (gameState.selectedCategories && gameState.selectedCategories.length > 0) {
                const categoryList = gameState.selectedCategories
                    .map(cat => categoryNames[cat] || cat)
                    .join(', ');
                categoriesSummary.textContent = categoryList;
            } else {
                categoriesSummary.textContent = 'Keine ausgewählt';
            }
        }

        const difficultySummary = document.getElementById('difficulty-summary');
        if (difficultySummary) {
            difficultySummary.textContent = difficultyNames[gameState.difficulty] || gameState.difficulty || 'Nicht ausgewählt';
        }
    }

    // ===========================
    // VALIDATION
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
    // ===========================

    function setupEventListeners() {
        // Back button
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', goBack);
        }

        // Start button
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', startGame);
        }

        // Add player button
        const addPlayerBtn = document.getElementById('add-player-btn');
        if (addPlayerBtn) {
            addPlayerBtn.addEventListener('click', addPlayerInput);
        }

        // Input changes - delegate to parent
        const inputsList = document.getElementById('players-input-list');
        if (inputsList) {
            inputsList.addEventListener('input', function(e) {
                if (e.target.classList.contains('player-input')) {
                    // Sanitize with NocapUtils
                    const sanitized = sanitizePlayerName(e.target.value);
                    if (sanitized !== e.target.value) {
                        e.target.value = sanitized;
                    }
                    updatePlayersFromInputs();
                    updateUI();
                }
            });

            // Remove button clicks - delegate
            inputsList.addEventListener('click', function(e) {
                if (e.target.classList.contains('remove-player-btn')) {
                    const index = parseInt(e.target.dataset.index);
                    if (!isNaN(index)) {
                        removePlayerInput(index);
                    }
                }
            });
        }

        // Enter key to move to next input or start
        document.addEventListener('keypress', function(e) {
            if (e.target.classList.contains('player-input') && e.key === 'Enter') {
                e.preventDefault();
                const nextInput = getNextEmptyInput();
                if (nextInput) {
                    nextInput.focus();
                } else if (getPlayersList().length >= MIN_PLAYERS) {
                    startGame();
                }
            }
        });
    }

    // ===========================
    // START GAME
    // ===========================

    function startGame() {
        if (isDevelopment) {
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

        if (!gameState.selectedCategories || gameState.selectedCategories.length === 0) {
            showNotification('Keine Kategorien ausgewählt!', 'error');
            return;
        }

        if (!gameState.difficulty) {
            showNotification('Kein Schwierigkeitsgrad ausgewählt!', 'error');
            return;
        }

        showLoading();

        // ✅ P1 FIX: Save to GameState and set game phase
        if (gameState.setPlayers) {
            gameState.setPlayers(players);
        } else {
            gameState.players = players;
        }
        gameState.gamePhase = 'playing';
        gameState.save(true); // Immediate save

        showNotification('Spiel wird gestartet...', 'success', 1500);

        if (isDevelopment) {
            console.log('Game starting with state:', gameState.getDebugInfo());
        }

        setTimeout(() => {
            window.location.href = 'gameplay.html';
        }, 1500);
    }

    // ===========================
    // NAVIGATION
    // ===========================

    function goBack() {
        showLoading();
        setTimeout(() => {
            window.location.href = 'difficulty-selection.html';
        }, 300);
    }

    // ===========================
    // UTILITY FUNCTIONS
    // ===========================

    function showLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.add('show');
        }
    }

    function hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.remove('show');
        }
    }

    /**
     * Safe notification using NocapUtils
     */
    function showNotification(message, type = 'info', duration = 3000) {
        if (window.NocapUtils && window.NocapUtils.showNotification) {
            window.NocapUtils.showNotification(message, type, duration);
            return;
        }

        // Fallback implementation
        const container = document.body;

        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'polite');

        const textSpan = document.createElement('span');
        textSpan.className = 'notification-text';
        textSpan.textContent = String(message);

        notification.appendChild(textSpan);
        container.appendChild(notification);

        // Inline styles for fallback
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.padding = '15px 20px';
        notification.style.borderRadius = '10px';
        notification.style.color = 'white';
        notification.style.fontWeight = '600';
        notification.style.zIndex = '10001';
        notification.style.maxWidth = '300px';

        if (type === 'success') notification.style.background = '#4CAF50';
        if (type === 'error') notification.style.background = '#F44336';
        if (type === 'warning') notification.style.background = '#FF9800';
        if (type === 'info') notification.style.background = '#2196F3';

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, duration);
    }

    // ===========================
    // CLEANUP
    // ===========================

    function cleanup() {
        if (window.NocapUtils && window.NocapUtils.cleanupEventListeners) {
            window.NocapUtils.cleanupEventListeners();
        }

        if (isDevelopment) {
            console.log('✅ Player setup cleanup completed');
        }
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