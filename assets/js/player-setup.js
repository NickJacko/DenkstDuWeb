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
    const MAX_PLAYERS = 10; // ✅ P1 Stabilität: Maximum 10 Spieler (serverseitig via joinGame validiert)
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

    // ✅ P0 SECURITY: Avatar upload state and validation
    const avatarUploads = new Map(); // Track upload progress
    const AVATAR_MAX_SIZE = 2 * 1024 * 1024; // 2MB
    const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    // ✅ P1 STABILITY: Event listener tracking for cleanup
    const _eventListeners = [];

    const isDevelopment = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('192.168.');

    // ===========================
    // ✅ P1 STABILITY: EVENT LISTENER HELPER
    // ===========================

    /**
     * Add event listener with automatic tracking for cleanup
     * @param {Element} element - DOM element
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    function addTrackedEventListener(element, event, handler, options) {
        if (!element) return;

        element.addEventListener(event, handler, options);
        _eventListeners.push({ element, event, handler, options });

        if (isDevelopment) {
            console.log(`📌 Tracked event: ${event} on`, element);
        }
    }

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

        if (isDevelopment) {
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
            // ✅ CSP FIX: Use CSS class instead of inline style
            preview.classList.remove('hidden');
            playersOrder.innerHTML = '';

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

            if (isDevelopment) {
                console.log(`⬆️ Moved player ${index + 1} up`);
            }
        } else if (e.key === 'ArrowDown' && index < players.length - 1) {
            // Move player down
            e.preventDefault();
            const [movedPlayer] = players.splice(index, 1);
            players.splice(index + 1, 0, movedPlayer);
            moved = true;

            if (isDevelopment) {
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

            // Update GameState and UI
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
        draggedItem = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.index);

        // ✅ AUDIT FIX: Accessibility attributes
        this.setAttribute('aria-grabbed', 'true');

        if (isDevelopment) {
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

        if (this !== draggedItem) {
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

        // ✅ P1 UI/UX: Avatar upload event listeners
        setupAvatarEventListeners();

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
        addTrackedEventListener(document, 'keypress', keypressHandler);

        if (isDevelopment) {
            console.log(`✅ Setup ${_eventListeners.length} tracked event listeners`);
        }
    }

    // ===========================
    // AVATAR UPLOAD FUNCTIONALITY
    // ✅ P0 SECURITY: File validation before upload
    // ✅ P1 UI/UX: Preview and feedback
    // ===========================

    /**
     * ✅ P1 UI/UX: Setup avatar upload event listeners
     */
    function setupAvatarEventListeners() {
        const avatarInputs = document.querySelectorAll('.avatar-input');

        avatarInputs.forEach(input => {
            addTrackedEventListener(input, 'change', handleAvatarSelection);
        });

        const removeButtons = document.querySelectorAll('.avatar-remove-btn');
        removeButtons.forEach(btn => {
            addTrackedEventListener(btn, 'click', handleAvatarRemove);
        });
    }

    /**
     * ✅ P0 SECURITY: Validate avatar file
     */
    function validateAvatarFile(file) {
        // Check file type
        if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
            return {
                valid: false,
                error: 'Nur JPG, PNG und WEBP Dateien erlaubt'
            };
        }

        // Check file size (2MB max)
        if (file.size > AVATAR_MAX_SIZE) {
            const sizeMB = (AVATAR_MAX_SIZE / (1024 * 1024)).toFixed(1);
            return {
                valid: false,
                error: `Avatar darf maximal ${sizeMB}MB groß sein`
            };
        }

        return { valid: true };
    }

    /**
     * ✅ P1 UI/UX: Handle avatar selection
     */
    async function handleAvatarSelection(e) {
        const input = e.target;
        const index = parseInt(input.dataset.index);
        const file = input.files[0];

        if (!file) return;

        if (isDevelopment) {
            console.log(`📷 Avatar selected for player ${index + 1}:`, {
                name: file.name,
                type: file.type,
                size: file.size
            });
        }

        // ✅ P0 SECURITY: Validate file
        const validation = validateAvatarFile(file);
        if (!validation.valid) {
            showNotification(validation.error, 'error');
            input.value = ''; // Clear input
            return;
        }

        try {
            // Show preview using FileReader
            await showAvatarPreview(index, file);

            // ✅ P1 STABILITY: Save avatar in state (optional upload to Firebase)
            saveAvatarLocally(index, file);

            showNotification('Avatar ausgewählt ✓', 'success', 2000);

        } catch (error) {
            console.error('Avatar preview error:', error);
            showNotification('Fehler beim Laden des Avatars', 'error');
            input.value = '';
        }
    }

    /**
     * ✅ P1 UI/UX: Show avatar preview using FileReader
     */
    function showAvatarPreview(index, file) {
        return new Promise((resolve, reject) => {
            const preview = document.getElementById(`avatar-preview-${index}`);
            const image = document.getElementById(`avatar-image-${index}`);

            if (!preview || !image) {
                reject(new Error('Preview elements not found'));
                return;
            }

            // ✅ P0 SECURITY: Use FileReader (safe, no direct URL)
            const reader = new FileReader();

            reader.onload = function(e) {
                // ✅ P0 SECURITY: Set src from FileReader result
                image.src = e.target.result;
                image.alt = `Avatar von Spieler ${index + 1}`;

                // Show preview
                preview.classList.remove('hidden');

                resolve();
            };

            reader.onerror = function() {
                reject(new Error('FileReader error'));
            };

            // Read file as Data URL
            reader.readAsDataURL(file);
        });
    }

    /**
     * ✅ P1 STABILITY: Save avatar locally (optional Firebase upload)
     */
    function saveAvatarLocally(index, file) {
        // Get player name
        const input = document.getElementById(`player-input-${index}`);
        const playerName = input ? sanitizePlayerName(input.value) : `Player${index + 1}`;

        // Store in Map for later upload (if needed)
        avatarUploads.set(index, {
            file,
            playerName,
            timestamp: Date.now()
        });

        if (isDevelopment) {
            console.log(`💾 Avatar saved locally for player ${index + 1}`);
        }
    }

    /**
     * ✅ P1 UI/UX: Handle avatar remove
     */
    function handleAvatarRemove(e) {
        e.preventDefault();
        e.stopPropagation();

        const index = parseInt(e.target.dataset.index) || parseInt(e.target.parentElement.dataset.index);

        if (isNaN(index)) return;

        if (isDevelopment) {
            console.log(`🗑️ Removing avatar for player ${index + 1}`);
        }

        // Clear input
        const input = document.getElementById(`avatar-input-${index}`);
        if (input) {
            input.value = '';
        }

        // Hide preview
        const preview = document.getElementById(`avatar-preview-${index}`);
        if (preview) {
            preview.classList.add('hidden');
        }

        // Clear image src
        const image = document.getElementById(`avatar-image-${index}`);
        if (image) {
            image.src = '';
        }

        // Remove from uploads map
        avatarUploads.delete(index);

        showNotification('Avatar entfernt', 'success', 1500);
    }

    /**
     * ✅ P1 STABILITY: Upload avatars to Firebase (optional, called before game start)
     */
    async function uploadAvatarsToFirebase() {
        if (avatarUploads.size === 0) {
            if (isDevelopment) {
                console.log('ℹ️ No avatars to upload');
            }
            return true;
        }

        if (!firebase || !firebase.storage) {
            console.warn('⚠️ Firebase Storage not available, skipping avatar upload');
            return true;
        }

        showNotification('Lade Avatare hoch...', 'info');

        const uploadPromises = [];

        for (const [index, data] of avatarUploads.entries()) {
            const promise = uploadSingleAvatar(index, data);
            uploadPromises.push(promise);
        }

        try {
            const results = await Promise.allSettled(uploadPromises);

            const failures = results.filter(r => r.status === 'rejected');

            if (failures.length > 0) {
                showNotification(
                    `${failures.length} Avatar(s) konnten nicht hochgeladen werden`,
                    'warning',
                    3000
                );
                return false;
            }

            showNotification('Avatare erfolgreich hochgeladen ✓', 'success');
            return true;

        } catch (error) {
            console.error('Avatar upload error:', error);
            showNotification('Fehler beim Hochladen der Avatare', 'error');
            return false;
        }
    }

    /**
     * ✅ P1 STABILITY: Upload single avatar with error handling
     */
    async function uploadSingleAvatar(index, data) {
        const { file, playerName } = data;

        try {
            const timestamp = Date.now();
            const fileName = `${playerName}_${timestamp}.${getFileExtension(file.name)}`;
            const storageRef = firebase.storage().ref(`avatars/${fileName}`);

            // ✅ P1 DSGVO: Set metadata for auto-deletion after 24h
            const metadata = {
                contentType: file.type,
                customMetadata: {
                    playerName: playerName,
                    uploadedAt: timestamp.toString(),
                    deleteAfter: (timestamp + 24 * 60 * 60 * 1000).toString() // 24h
                }
            };

            // Upload file
            const snapshot = await storageRef.put(file, metadata);

            // Get download URL
            const downloadURL = await snapshot.ref.getDownloadURL();

            if (isDevelopment) {
                console.log(`✅ Avatar uploaded for ${playerName}:`, downloadURL);
            }

            // Store URL in gameState
            if (!gameState.avatars) {
                gameState.avatars = {};
            }
            gameState.avatars[playerName] = downloadURL;

            return { success: true, index, url: downloadURL };

        } catch (error) {
            console.error(`❌ Avatar upload failed for player ${index + 1}:`, error);

            // ✅ P1 STABILITY: Show specific error message
            let errorMessage = 'Upload fehlgeschlagen';
            if (error.code === 'storage/unauthorized') {
                errorMessage = 'Keine Berechtigung zum Hochladen';
            } else if (error.code === 'storage/canceled') {
                errorMessage = 'Upload abgebrochen';
            } else if (error.code === 'storage/quota-exceeded') {
                errorMessage = 'Speicherplatz voll';
            }

            showNotification(
                `Avatar ${index + 1}: ${errorMessage}`,
                'error',
                3000
            );

            throw error;
        }
    }

    function getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    // ===========================
    // START GAME
    // ✅ P1 STABILITY: Upload avatars before starting
    // ===========================

    async function startGame() {
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

        // ✅ P1 STABILITY: Upload avatars if any selected
        if (avatarUploads.size > 0) {
            const uploadSuccess = await uploadAvatarsToFirebase();

            if (!uploadSuccess) {
                hideLoading();

                // ✅ P1 STABILITY: Ask user if they want to continue without avatars
                const continueWithoutAvatars = confirm(
                    'Einige Avatare konnten nicht hochgeladen werden.\n\n' +
                    'Möchten Sie ohne Avatare fortfahren?'
                );

                if (!continueWithoutAvatars) {
                    showNotification('Spiel-Start abgebrochen', 'info');
                    return;
                }

                showLoading();
            }
        }

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
    // ✅ P1 STABILITY: Save progress when going back
    // ===========================

    function goBack() {
        if (isDevelopment) {
            console.log('⬅️ Going back to difficulty selection...');
        }

        // ✅ P1 STABILITY: Save current players before going back
        const players = getPlayersList();

        if (players.length > 0) {
            if (gameState.setPlayers) {
                gameState.setPlayers(players);
            } else {
                gameState.players = players;
            }
            gameState.save();

            if (isDevelopment) {
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
        _eventListeners.forEach(({ element, event, handler, options }) => {
            if (element && element.removeEventListener) {
                element.removeEventListener(event, handler, options);
            }
        });

        // Clear the array
        _eventListeners.length = 0;

        if (isDevelopment) {
            console.log('✅ Player setup cleanup completed - all event listeners removed');
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