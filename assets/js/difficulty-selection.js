// ===== NO-CAP DIFFICULTY SELECTION (SINGLE DEVICE MODE) =====
// Version: 2.1 - Security hardened with DOMPurify, encoding fixed
// Mode: Single Device - Difficulty Selection with Alcohol Mode

'use strict';

// ===== GLOBAL VARIABLES =====
let gameState = null;
let selectedDifficulty = null;
let alcoholMode = false;

// ===== DIFFICULTY DATA =====
const difficultyNames = {
    easy: 'Entspannt',
    medium: 'Normal',
    hard: 'Hardcore'
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initDifficultySelection();
});

function initDifficultySelection() {
    log('⚡ Initializing difficulty selection...');

    // Load central GameState
    if (typeof GameState === 'undefined') {
        log('❌ GameState not found - Load central version', 'error');
        showNotification('Fehler beim Laden. Bitte Seite neu laden.', 'error');
        return;
    }

    // Check if DOMPurify is available
    if (typeof DOMPurify === 'undefined') {
        log('❌ DOMPurify not found - Security risk!', 'error');
        console.error('SECURITY: DOMPurify library is required but not loaded!');
    }

    gameState = GameState.load();

    // Validation: Check if categories are selected
    if (!validateGameState()) {
        return; // Redirects handled in function
    }

    // Check alcohol mode and update UI
    checkAlcoholMode();

    // Load previously selected difficulty if any
    if (gameState.difficulty) {
        selectedDifficulty = gameState.difficulty;
        const card = document.querySelector(`[data-difficulty="${selectedDifficulty}"]`);
        if (card) {
            card.classList.add('selected');
            updateContinueButton();
        }
    }

    // Setup event listeners
    setupEventListeners();

    hideLoading();

    log('✅ Difficulty selection initialized');
    log('📋 Current state:', {
        deviceMode: gameState.deviceMode,
        categories: gameState.selectedCategories,
        difficulty: gameState.difficulty,
        alcoholMode: alcoholMode
    });
}

// ===== VALIDATION & GUARDS =====
function validateGameState() {
    // Check if categories are selected
    if (!gameState.selectedCategories || gameState.selectedCategories.length === 0) {
        log('⚠️ No categories selected, redirecting...', 'warning');
        showNotification('Keine Kategorien ausgewählt! Weiterleitung...', 'warning');
        setTimeout(() => {
            window.location.href = 'category-selection.html';
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

    // Continue button
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
        continueBtn.addEventListener('click', proceedToDifficulty);
    }

    // Difficulty cards - using delegation
    const difficultyGrid = document.querySelector('.difficulty-grid');
    if (difficultyGrid) {
        difficultyGrid.addEventListener('click', function(e) {
            const card = e.target.closest('.difficulty-card');
            if (card) {
                selectDifficulty(card);
            }
        });
    }

    log('✅ Event listeners setup complete');
}

// ===== ALCOHOL MODE =====
function checkAlcoholMode() {
    try {
        const alcoholModeStr = localStorage.getItem('nocap_alcohol_mode');
        alcoholMode = alcoholModeStr === 'true';
        log(`🍺 Alcohol mode: ${alcoholMode}`);

        updateUIForAlcoholMode();
    } catch (error) {
        log(`❌ Error checking alcohol mode: ${error.message}`, 'error');
        alcoholMode = false;
        updateUIForAlcoholMode();
    }
}

function updateUIForAlcoholMode() {
    const descriptionSubtitle = document.getElementById('description-subtitle');

    if (alcoholMode) {
        // Alkohol-Modus: Schlücke und Alkohol-Icons
        if (descriptionSubtitle) {
            descriptionSubtitle.textContent = 'Bestimmt die Anzahl der Schlücke bei falschen Schätzungen';
        }

        // Easy
        updateDifficultyUI('easy', {
            icon: '🍷',
            base: '1 Grundschluck bei falscher Antwort',
            formula: 'Schlücke = Abweichung der Schätzung<br>Perfekt für entspannte Runden'
        });

        // Medium
        updateDifficultyUI('medium', {
            icon: '🍺',
            base: 'Abweichung = Schlücke',
            formula: 'Schlücke = Abweichung der Schätzung<br>Der Standard für lustige Partyabende'
        });

        // Hard
        updateDifficultyUI('hard', {
            icon: '🔥',
            base: 'Doppelte Abweichung!',
            formula: 'Schlücke = Abweichung × 2<br>Nur für erfahrene Spieler!'
        });

        log('✅ UI updated for alcohol mode');
    } else {
        // Alkoholfrei-Modus: Punkte und alternative Icons
        if (descriptionSubtitle) {
            descriptionSubtitle.textContent = 'Bestimmt die Konsequenz bei falschen Schätzungen';
        }

        // Easy
        updateDifficultyUI('easy', {
            icon: '💧',
            base: '1 Grundpunkt bei falscher Antwort',
            formula: 'Punkte = Abweichung der Schätzung<br>Perfekt für entspannte Runden'
        });

        // Medium
        updateDifficultyUI('medium', {
            icon: '🎉',
            base: 'Abweichung = Punkte',
            formula: 'Punkte = Abweichung der Schätzung<br>Der Standard für lustige Partyabende'
        });

        // Hard
        updateDifficultyUI('hard', {
            icon: '🔥',
            base: 'Doppelte Abweichung!',
            formula: 'Punkte = Abweichung × 2<br>Nur für erfahrene Spieler!'
        });

        log('✅ UI updated for alcohol-free mode');
    }
}

function updateDifficultyUI(difficulty, content) {
    const iconEl = document.getElementById(`${difficulty}-icon`);
    const baseEl = document.getElementById(`${difficulty}-base`);
    const formulaEl = document.getElementById(`${difficulty}-formula`);

    // XSS Protection: Sanitize HTML content before inserting
    if (iconEl) iconEl.textContent = content.icon;
    if (baseEl) baseEl.textContent = content.base;
    if (formulaEl) {
        // Use DOMPurify for HTML content with line breaks
        if (typeof DOMPurify !== 'undefined') {
            formulaEl.innerHTML = DOMPurify.sanitize(content.formula, {
                ALLOWED_TAGS: ['br'],
                ALLOWED_ATTR: []
            });
        } else {
            // Fallback: Use textContent (removes <br> but safer)
            formulaEl.textContent = content.formula.replace(/<br>/g, ' ');
            console.warn('DOMPurify not available - falling back to textContent');
        }
    }
}

// ===== DIFFICULTY SELECTION =====
function selectDifficulty(element) {
    const difficulty = element.dataset.difficulty;
    if (!difficulty) return;

    // Validate difficulty value
    if (!difficultyNames[difficulty]) {
        log(`❌ Invalid difficulty: ${difficulty}`, 'error');
        return;
    }

    // Remove previous selection
    document.querySelectorAll('.difficulty-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Add selection to clicked card
    element.classList.add('selected');
    selectedDifficulty = difficulty;

    // Save to game state
    gameState.difficulty = difficulty;
    gameState.save();

    // Update continue button
    updateContinueButton();

    // Show success notification
    showNotification(`${difficultyNames[difficulty]} Modus gewählt!`, 'success');

    log(`Selected difficulty: ${difficulty}`);
}

function updateContinueButton() {
    const continueBtn = document.getElementById('continueBtn');
    if (!continueBtn) return;

    if (selectedDifficulty) {
        continueBtn.disabled = false;
        continueBtn.textContent = 'Weiter';
    } else {
        continueBtn.disabled = true;
        continueBtn.textContent = 'Schwierigkeitsgrad wählen';
    }
}

// ===== NAVIGATION =====
function proceedToDifficulty() {
    if (!selectedDifficulty) {
        showNotification('Bitte wähle einen Schwierigkeitsgrad aus', 'warning');
        return;
    }

    log(`🚀 Proceeding with difficulty: ${selectedDifficulty}`);

    showLoading();

    // Save difficulty to game state
    gameState.difficulty = selectedDifficulty;
    gameState.save();

    setTimeout(() => {
        // Route based on device mode
        if (gameState.deviceMode === 'single') {
            // Single device: go to player setup
            window.location.href = 'player-setup.html';
        } else if (gameState.deviceMode === 'multi') {
            // Multiplayer: go to multiplayer lobby
            window.location.href = 'multiplayer-lobby.html';
        } else {
            // Fallback if deviceMode is not set
            log('⚠️ Device mode not set, defaulting to single device', 'warning');
            window.location.href = 'player-setup.html';
        }
    }, 500);
}

function goBack() {
    log('⬅️ Going back to category selection');
    showLoading();
    setTimeout(() => {
        window.location.href = 'category-selection.html';
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

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;

    // XSS Protection: Use textContent instead of innerHTML
    // Sanitize message to prevent any script injection
    const sanitizedMessage = String(message).replace(/<[^>]*>/g, '');
    notification.textContent = sanitizedMessage;
    notification.className = `notification ${type} show`;

    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function log(message, type = 'info') {
    const colors = {
        info: '#4488ff',
        warning: '#ffaa00',
        error: '#ff4444',
        success: '#00ff00'
    };

    console.log(`%c[DifficultySelection] ${message}`, `color: ${colors[type] || colors.info}`);
}

// ===== DEBUG FUNCTIONS =====
window.debugDifficultySelection = function() {
    console.log('🔍 === DIFFICULTY SELECTION DEBUG ===');
    console.log('GameState:', gameState?.getDebugInfo?.());
    console.log('Selected Difficulty:', selectedDifficulty);
    console.log('Alcohol Mode:', alcoholMode);
    console.log('LocalStorage:', localStorage.getItem('nocap_game_state'));
    console.log('DOMPurify available:', typeof DOMPurify !== 'undefined');
};

log('✅ No-Cap Difficulty Selection - JS loaded!');
log('🛠️ Debug: debugDifficultySelection()');