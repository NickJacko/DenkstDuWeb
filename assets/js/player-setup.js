// ===== NO-CAP PLAYER SETUP (SINGLE DEVICE MODE) =====
// Version: 2.0 - Refactored with central GameState
// Mode: Single Device (No Firebase needed)

'use strict';

// ===== GLOBAL VARIABLES =====
let gameState = null;
let playersList = [];
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
document.addEventListener('DOMContentLoaded', function() {
    initPlayerSetup();
});

async function initPlayerSetup() {
    log('👥 Initializing player setup...');

    showLoading();

    // STEP 1: Load central GameState
    if (typeof GameState === 'undefined') {
        log('❌ GameState not found - Load central version', 'error');
        showNotification('Fehler beim Laden. Bitte Seite neu laden.', 'error');
        return;
    }

    gameState = GameState.load();

    // STEP 2: Check alcohol mode
    checkAlcoholMode();

    // STEP 3: Validate prerequisites
    if (!validatePrerequisites()) {
        return; // Redirects handled in function
    }

    // STEP 4: Load question counts from Firebase
    await loadQuestionCounts();

    // STEP 5: Load previous players if available
    if (gameState.players && gameState.players.length > 0) {
        loadPreviousPlayers();
    }

    // STEP 6: Update UI
    updateGameSummary();
    updateUI();

    // STEP 7: Setup event listeners
    setupEventListeners();

    hideLoading();

    log('✅ Player setup initialized');
    log('📋 Current game state:', gameState.getDebugInfo());
}

// ===== VALIDATION & GUARDS =====
function validatePrerequisites() {
    // Check device mode
    if (gameState.deviceMode !== 'single') {
        log('❌ Not in single device mode', 'error');
        showNotification('Nicht im Einzelgerät-Modus. Weiterleitung...', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return false;
    }

    // Check if categories selected
    if (!gameState.selectedCategories || gameState.selectedCategories.length === 0) {
        log('❌ No categories selected', 'error');
        showNotification('Keine Kategorien ausgewählt! Weiterleitung...', 'error');
        setTimeout(() => {
            window.location.href = 'category-selection.html';
        }, 2000);
        return false;
    }

    // Check if difficulty selected
    if (!gameState.difficulty) {
        log('❌ No difficulty selected', 'error');
        showNotification('Kein Schwierigkeitsgrad ausgewählt! Weiterleitung...', 'error');
        setTimeout(() => {
            window.location.href = 'difficulty-selection.html';
        }, 2000);
        return false;
    }

    return true;
}

// ===== EVENT LISTENERS SETUP =====
function setupEventListeners() {
    log('🔧 Setting up event listeners...');

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
                updatePlayersList();
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
            } else if (playersList.length >= MIN_PLAYERS) {
                startGame();
            }
        }
    });

    log('✅ Event listeners setup complete');
}

// ===== ALCOHOL MODE CHECK =====
function checkAlcoholMode() {
    try {
        const alcoholModeStr = localStorage.getItem('nocap_alcohol_mode');
        alcoholMode = alcoholModeStr === 'true';
        log(`🍺 Alcohol mode: ${alcoholMode}`);

        // Update difficulty icon
        const difficultyIcon = document.getElementById('difficulty-icon');
        if (difficultyIcon) {
            difficultyIcon.textContent = alcoholMode ? '🍺' : '💧';
        }
    } catch (error) {
        log(`❌ Error checking alcohol mode: ${error.message}`, 'error');
        alcoholMode = false;
    }
}

// ===== QUESTION COUNTS FROM FIREBASE =====
async function loadQuestionCounts() {
    try {
        log('📊 Loading question counts from Firebase...');

        // Check if Firebase is available
        if (typeof firebase === 'undefined' || !firebase.database) {
            log('⚠️ Firebase not available, using fallback counts', 'warning');
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
                    log(`✅ ${category}: ${questionCounts[category]} questions`);
                } else {
                    log(`⚠️ ${category}: No data, using fallback`, 'warning');
                    questionCounts[category] = getFallbackCount(category);
                }
            } catch (error) {
                log(`⚠️ Error loading ${category}: ${error.message}`, 'warning');
                questionCounts[category] = getFallbackCount(category);
            }
        }

        updateTotalQuestions();
        log('✅ Question counts loaded');

    } catch (error) {
        log(`❌ Error loading question counts: ${error.message}`, 'error');
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

// ===== UPDATE TOTAL QUESTIONS =====
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

// ===== LOAD PREVIOUS PLAYERS =====
function loadPreviousPlayers() {
    log('🔄 Loading previous players...');

    const inputs = document.querySelectorAll('.player-input');

    gameState.players.forEach((playerName, index) => {
        if (index < inputs.length) {
            inputs[index].value = playerName;
        } else {
            // Need to add more inputs
            while (document.querySelectorAll('.player-input').length <= index) {
                addPlayerInput();
            }
            const newInputs = document.querySelectorAll('.player-input');
            if (newInputs[index]) {
                newInputs[index].value = playerName;
            }
        }
    });

    updatePlayersList();
    log(`✅ Loaded ${gameState.players.length} previous players`);
}

// ===== PLAYER INPUT MANAGEMENT =====
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

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-player-btn';
    removeBtn.textContent = '×';
    removeBtn.dataset.index = newIndex;
    removeBtn.style.display = newIndex < 2 ? 'none' : 'flex';

    newRow.appendChild(numberDiv);
    newRow.appendChild(input);
    newRow.appendChild(removeBtn);

    inputsList.appendChild(newRow);
    updateAddButton();

    input.focus();

    log(`➕ Added player input #${newIndex + 1}`);
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
        removeBtn.dataset.index = newIndex;
        removeBtn.style.display = newIndex < 2 ? 'none' : 'flex';
    });

    updatePlayersList();
    updateUI();
    updateAddButton();

    log(`➖ Removed player input #${index + 1}`);
}

// ===== UPDATE PLAYERS LIST =====
function updatePlayersList() {
    const inputs = document.querySelectorAll('.player-input');
    playersList = [];

    inputs.forEach(input => {
        const name = input.value.trim();
        if (name) {
            playersList.push(name);
        }
    });
}

// ===== UPDATE UI =====
function updateUI() {
    // Update player count badge
    const currentCount = document.getElementById('current-count');
    if (currentCount) {
        currentCount.textContent = playersList.length;
    }

    // Update start button state
    const startBtn = document.getElementById('start-btn');
    const startHint = document.getElementById('start-hint');

    if (playersList.length >= MIN_PLAYERS) {
        if (startBtn) {
            startBtn.disabled = false;
        }
        if (startHint) {
            startHint.textContent = `${playersList.length} Spieler bereit - Los geht's!`;
        }
    } else {
        if (startBtn) {
            startBtn.disabled = true;
        }
        if (startHint) {
            const needed = MIN_PLAYERS - playersList.length;
            startHint.textContent = `Noch ${needed} Spieler nötig`;
        }
    }

    updatePlayersPreview();
    updateAddButton();
    updateRemoveButtons();
}

// ===== PLAYERS PREVIEW WITH DRAG & DROP =====
function updatePlayersPreview() {
    const preview = document.getElementById('players-preview');
    const playersOrder = document.getElementById('players-order');

    if (!preview || !playersOrder) return;

    if (playersList.length > 0) {
        preview.style.display = 'block';

        // Clear and rebuild
        playersOrder.innerHTML = '';

        playersList.forEach((name, index) => {
            const item = document.createElement('div');
            item.className = 'player-order-item';
            item.draggable = true;
            item.dataset.index = index;

            const numberDiv = document.createElement('div');
            numberDiv.className = 'player-order-number';
            numberDiv.textContent = index + 1;

            const nameSpan = document.createElement('span');
            nameSpan.textContent = name;

            const handleSpan = document.createElement('span');
            handleSpan.className = 'drag-handle';
            handleSpan.textContent = '☰';

            item.appendChild(numberDiv);
            item.appendChild(nameSpan);
            item.appendChild(handleSpan);

            playersOrder.appendChild(item);
        });

        // Setup drag & drop
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
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
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

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    if (draggedItem !== this) {
        const fromIndex = parseInt(draggedItem.dataset.index);
        const toIndex = parseInt(this.dataset.index);

        // Reorder players list
        const [movedPlayer] = playersList.splice(fromIndex, 1);
        playersList.splice(toIndex, 0, movedPlayer);

        // Update inputs to match new order
        const inputs = document.querySelectorAll('.player-input');
        playersList.forEach((name, index) => {
            if (inputs[index]) {
                inputs[index].value = name;
            }
        });

        // Update preview
        updateUI();
        showNotification('Reihenfolge aktualisiert!', 'success');

        log(`🔄 Reordered: moved player from position ${fromIndex + 1} to ${toIndex + 1}`);
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
        if (btnText) {
            btnText.textContent = `Maximum erreicht (${MAX_PLAYERS})`;
        }
    } else {
        addBtn.disabled = false;
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

    // Update categories
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

    // Update difficulty
    const difficultySummary = document.getElementById('difficulty-summary');
    if (difficultySummary) {
        if (gameState.difficulty) {
            difficultySummary.textContent = difficultyNames[gameState.difficulty] || gameState.difficulty;
        } else {
            difficultySummary.textContent = 'Nicht ausgewählt';
        }
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

function validatePlayerNames() {
    const names = playersList.map(name => name.toLowerCase());
    const uniqueNames = new Set(names);

    if (names.length !== uniqueNames.size) {
        showNotification('Jeder Spieler braucht einen einzigartigen Namen!', 'error');
        return false;
    }

    for (let name of playersList) {
        if (name.length < 2 || name.length > 15) {
            showNotification('Namen müssen zwischen 2-15 Zeichen lang sein!', 'error');
            return false;
        }
    }

    return true;
}

// ===== START GAME =====
function startGame() {
    log('🚀 Starting game...');

    updatePlayersList();

    if (playersList.length < MIN_PLAYERS) {
        showNotification(`Mindestens ${MIN_PLAYERS} Spieler nötig!`, 'warning');
        return;
    }

    if (!validatePlayerNames()) {
        return;
    }

    if (!gameState.selectedCategories || gameState.selectedCategories.length === 0) {
        showNotification('Keine Kategorien ausgewählt!', 'error');
        setTimeout(() => {
            window.location.href = 'category-selection.html';
        }, 2000);
        return;
    }

    if (!gameState.difficulty) {
        showNotification('Kein Schwierigkeitsgrad ausgewählt!', 'error');
        setTimeout(() => {
            window.location.href = 'difficulty-selection.html';
        }, 2000);
        return;
    }

    showLoading();

    // Save players to GameState
    gameState.players = [...playersList];
    gameState.gamePhase = 'playing';
    gameState.save();

    showNotification('Spiel wird gestartet...', 'success');

    log('✅ Game state saved:', gameState.getDebugInfo());

    setTimeout(() => {
        window.location.href = 'gameplay.html';
    }, 1500);
}

// ===== NAVIGATION =====
function goBack() {
    log('⬅️ Going back to difficulty selection');
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

function showNotification(message, type = 'info', duration = 3000) {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const textSpan = document.createElement('span');
    textSpan.className = 'notification-text';
    textSpan.textContent = message;

    notification.appendChild(textSpan);

    const container = document.getElementById('notification-container');
    if (container) {
        container.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, duration);
    }
}

function log(message, type = 'info') {
    const colors = {
        info: '#4488ff',
        warning: '#ffaa00',
        error: '#ff4444',
        success: '#00ff00'
    };

    console.log(`%c[PlayerSetup] ${message}`, `color: ${colors[type] || colors.info}`);
}

// ===== DEBUG FUNCTIONS =====
window.debugPlayerSetup = function() {
    console.log('🔍 === PLAYER SETUP DEBUG ===');
    console.log('GameState:', gameState?.getDebugInfo());
    console.log('Players List:', playersList);
    console.log('Alcohol Mode:', alcoholMode);
    console.log('Question Counts:', questionCounts);
    console.log('LocalStorage:', localStorage.getItem('nocap_game_state'));
};

log('✅ No-Cap Player Setup - JS loaded!');
log('🛠️ Debug: debugPlayerSetup()');