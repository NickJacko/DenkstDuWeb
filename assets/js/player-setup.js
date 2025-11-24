// ===== NO-CAP PLAYER SETUP (SINGLE DEVICE MODE) =====
// Version: 2.2 - Security Hardened & Production Ready
// Mode: Single Device (No Firebase needed)

'use strict';

// ===== GLOBAL VARIABLES =====
let gameState = null;
let alcoholMode = false;
let questionCounts = {
    fsk0: 0,
    fsk16: 0,
    fsk18: 0,
    special: 0
};
const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;

// Drag and drop state
let draggedItem = null;

// ===== INITIALIZATION =====

async function initialize() {
    console.log('👥 Initializing player setup...');

    showLoading();

    // P0 FIX: Check for required dependencies
    if (typeof GameState === 'undefined') {
        console.error('❌ GameState not found');
        showNotification('Fehler beim Laden. Bitte Seite neu laden.', 'error');
        return;
    }

    // Use central GameState
    gameState = new GameState();

    // Check alcohol mode
    checkAlcoholMode();

    // Validate prerequisites
    if (!validatePrerequisites()) {
        return;
    }

    // Load question counts
    await loadQuestionCounts();

    // P1 FIX: Load players from GameState (not separate array)
    initializePlayerInputs();

    // Update UI
    updateGameSummary();
    updateUI();

    // Setup event listeners
    setupEventListeners();

    hideLoading();

    console.log('✅ Player setup initialized');
}

// ===== VALIDATION & GUARDS =====

function validatePrerequisites() {
    if (gameState.deviceMode !== 'single') {
        console.error('❌ Not in single device mode');
        showNotification('Nicht im Einzelgerät-Modus', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return false;
    }

    if (!gameState.selectedCategories || gameState.selectedCategories.length === 0) {
        console.error('❌ No categories selected');
        showNotification('Keine Kategorien ausgewählt!', 'error');
        setTimeout(() => {
            window.location.href = 'category-selection.html';
        }, 2000);
        return false;
    }

    if (!gameState.difficulty) {
        console.error('❌ No difficulty selected');
        showNotification('Kein Schwierigkeitsgrad ausgewählt!', 'error');
        setTimeout(() => {
            window.location.href = 'difficulty-selection.html';
        }, 2000);
        return false;
    }

    return true;
}

// ===== EVENT LISTENERS SETUP =====

function setupEventListeners() {
    // Back button
    const backBtn = document.querySelector('.back-button');
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
                // P0 FIX: Sanitize with NocapUtils
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

// ===== P0 FIX: INPUT SANITIZATION =====

/**
 * Sanitize player name with NocapUtils or fallback
 */
function sanitizePlayerName(input) {
    if (!input) return '';

    // P0 FIX: Use NocapUtils if available
    if (typeof window.NocapUtils !== 'undefined' && window.NocapUtils.sanitizeInput) {
        return window.NocapUtils.sanitizeInput(input).substring(0, 15);
    }

    // Fallback sanitization
    let sanitized = String(input).replace(/<[^>]*>/g, '');
    sanitized = sanitized.replace(/[^a-zA-Z0-9äöüÄÖÜß\s\-_.,!?]/g, '');

    return sanitized.substring(0, 15);
}

// ===== ALCOHOL MODE CHECK =====

function checkAlcoholMode() {
    try {
        const alcoholModeStr = localStorage.getItem('nocap_alcohol_mode');
        alcoholMode = alcoholModeStr === 'true';

        const difficultyIcon = document.getElementById('difficulty-icon');
        if (difficultyIcon) {
            difficultyIcon.textContent = alcoholMode ? '🍺' : '💧';
        }
    } catch (error) {
        console.error('Error checking alcohol mode:', error);
        alcoholMode = false;
    }
}

// ===== QUESTION COUNTS FROM FIREBASE =====

async function loadQuestionCounts() {
    try {
        console.log('📊 Loading question counts...');

        if (typeof firebase === 'undefined' || !firebase.database) {
            console.warn('⚠️ Firebase not available, using fallback counts');
            useFallbackCounts();
            return;
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
        console.log('✅ Question counts loaded');

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

// ===== P1 FIX: PLAYER INPUT MANAGEMENT (NO GLOBAL ARRAY) =====

/**
 * Initialize player inputs from GameState
 */
function initializePlayerInputs() {
    // P1 FIX: Check if players exist in GameState
    if (gameState.players && Array.isArray(gameState.players) && gameState.players.length > 0) {
        console.log('🔄 Loading previous players from GameState');

        const inputs = document.querySelectorAll('.player-input');

        gameState.players.forEach((playerName, index) => {
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
    }
}

/**
 * Get current players list from inputs (no global array)
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
 * Update players in GameState from inputs
 */
function updatePlayersFromInputs() {
    const players = getPlayersList();

    // P1 FIX: Always update GameState, not separate array
    gameState.players = players;
    gameState.save();
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

    const numberDiv = document.createElement('div');
    numberDiv.className = 'player-number';
    numberDiv.textContent = newIndex + 1;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'player-input';
    input.placeholder = `Spieler ${newIndex + 1}...`;
    input.maxLength = 15;
    input.dataset.index = newIndex;
    input.setAttribute('aria-label', `Spieler ${newIndex + 1} Name`);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-player-btn';
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

    console.log(`➕ Added player input #${newIndex + 1}`);
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

    console.log(`➖ Removed player input #${index + 1}`);
}

// ===== UPDATE UI =====

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

// ===== P0 FIX: PLAYERS PREVIEW WITH DRAG & DROP =====

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
            // P0 FIX: Use textContent for XSS safety
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

// ===== DRAG & DROP FUNCTIONALITY =====

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

        showNotification('Reihenfolge aktualisiert!', 'success');
        console.log(`🔄 Reordered: ${fromIndex + 1} → ${toIndex + 1}`);
    }

    return false;
}

// ===== UPDATE BUTTONS =====

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

// ===== GAME SUMMARY =====

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

    // P0 FIX: Use textContent
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

// ===== VALIDATION =====

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

// ===== START GAME =====

function startGame() {
    console.log('🚀 Starting game...');

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

    // P1 FIX: Save directly to GameState (already done in updatePlayersFromInputs)
    gameState.players = players;
    gameState.gamePhase = 'playing';
    gameState.save();

    showNotification('Spiel wird gestartet...', 'success');

    setTimeout(() => {
        window.location.href = 'gameplay.html';
    }, 1500);
}

// ===== NAVIGATION =====

function goBack() {
    showLoading();
    setTimeout(() => {
        window.location.href = 'difficulty-selection.html';
    }, 300);
}

// ===== UTILITY FUNCTIONS =====

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
 * P0 FIX: Safe notification using NocapUtils
 */
function showNotification(message, type = 'info', duration = 3000) {
    if (typeof window.NocapUtils !== 'undefined' && window.NocapUtils.showNotification) {
        window.NocapUtils.showNotification(message, type);
        return;
    }

    // Fallback
    document.querySelectorAll('.notification').forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const textSpan = document.createElement('span');
    textSpan.className = 'notification-text';
    textSpan.textContent = sanitizePlayerName(message);

    notification.appendChild(textSpan);

    const container = document.getElementById('notification-container') || document.body;
    container.appendChild(notification);

    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, duration);
}

// ===== INITIALIZATION =====

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}