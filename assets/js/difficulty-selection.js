// ===== NO-CAP DIFFICULTY SELECTION (SINGLE DEVICE MODE) =====
// Version: 2.2 - Security Hardened & Production Ready
// Mode: Single Device - Difficulty Selection with Alcohol Mode

'use strict';

// ===== DIFFICULTY DATA =====
const difficultyNames = {
    easy: 'Entspannt',
    medium: 'Normal',
    hard: 'Hardcore'
};

const difficultyMultipliers = {
    easy: 1,
    medium: 1,
    hard: 2
};

// ===== GLOBAL VARIABLES =====
let gameState = null;
let alcoholMode = false;

// ===== INITIALIZATION =====

function initialize() {
    console.log('⚡ Initializing difficulty selection...');

    // P0 FIX: Check dependencies
    if (typeof GameState === 'undefined') {
        console.error('❌ GameState not found');
        showNotification('Fehler beim Laden. Bitte Seite neu laden.', 'error');
        return;
    }

    gameState = new GameState();

    // Validate prerequisites
    if (!validateGameState()) {
        return;
    }

    // Check alcohol mode
    checkAlcoholMode();

    // P1 FIX: Load difficulty from GameState
    initializeSelection();

    // Setup event listeners
    setupEventListeners();

    hideLoading();

    console.log('✅ Difficulty selection initialized');
}

// ===== VALIDATION & GUARDS =====

/**
 * P0 FIX: Validate categories with FSK-level check
 */
function validateGameState() {
    if (!gameState.selectedCategories || gameState.selectedCategories.length === 0) {
        console.warn('⚠️ No categories selected');
        showNotification('Keine Kategorien ausgewählt!', 'warning');
        setTimeout(() => {
            window.location.href = 'category-selection.html';
        }, 2000);
        return false;
    }

    // P0 FIX: Validate that user can access selected categories
    const ageLevel = parseInt(localStorage.getItem('nocap_age_level')) || 0;
    const hasInvalidCategory = gameState.selectedCategories.some(category => {
        if (category === 'fsk18' && ageLevel < 18) return true;
        if (category === 'fsk16' && ageLevel < 16) return true;
        return false;
    });

    if (hasInvalidCategory) {
        console.error('❌ Invalid categories for age level');
        showNotification('Ungültige Kategorien für dein Alter!', 'error');
        setTimeout(() => {
            window.location.href = 'category-selection.html';
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

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && gameState.difficulty) {
            proceedToDifficulty();
        }
    });
}

// ===== ALCOHOL MODE =====

function checkAlcoholMode() {
    try {
        const alcoholModeStr = localStorage.getItem('nocap_alcohol_mode');
        alcoholMode = alcoholModeStr === 'true';

        console.log(`🍺 Alcohol mode: ${alcoholMode}`);
        updateUIForAlcoholMode();
    } catch (error) {
        console.error('❌ Error checking alcohol mode:', error);
        alcoholMode = false;
        updateUIForAlcoholMode();
    }
}

/**
 * P0 FIX: Safe UI update with textContent
 */
function updateUIForAlcoholMode() {
    const descriptionSubtitle = document.getElementById('description-subtitle');

    if (alcoholMode) {
        if (descriptionSubtitle) {
            descriptionSubtitle.textContent = 'Bestimmt die Anzahl der Schlücke bei falschen Schätzungen';
        }

        updateDifficultyUI('easy', {
            icon: '🍷',
            base: '1 Grundschluck bei falscher Antwort',
            formula: 'Schlücke = Abweichung der Schätzung\nPerfekt für entspannte Runden'
        });

        updateDifficultyUI('medium', {
            icon: '🍺',
            base: 'Abweichung = Schlücke',
            formula: 'Schlücke = Abweichung der Schätzung\nDer Standard für lustige Partyabende'
        });

        updateDifficultyUI('hard', {
            icon: '🔥',
            base: 'Doppelte Abweichung!',
            formula: 'Schlücke = Abweichung × 2\nNur für erfahrene Spieler!'
        });
    } else {
        if (descriptionSubtitle) {
            descriptionSubtitle.textContent = 'Bestimmt die Konsequenz bei falschen Schätzungen';
        }

        updateDifficultyUI('easy', {
            icon: '💧',
            base: '1 Grundpunkt bei falscher Antwort',
            formula: 'Punkte = Abweichung der Schätzung\nPerfekt für entspannte Runden'
        });

        updateDifficultyUI('medium', {
            icon: '🎉',
            base: 'Abweichung = Punkte',
            formula: 'Punkte = Abweichung der Schätzung\nDer Standard für lustige Partyabende'
        });

        updateDifficultyUI('hard', {
            icon: '🔥',
            base: 'Doppelte Abweichung!',
            formula: 'Punkte = Abweichung × 2\nNur für erfahrene Spieler!'
        });
    }
}

/**
 * P0 FIX: Safe content update - use textContent with manual line breaks
 */
function updateDifficultyUI(difficulty, content) {
    const iconEl = document.getElementById(`${difficulty}-icon`);
    const baseEl = document.getElementById(`${difficulty}-base`);
    const formulaEl = document.getElementById(`${difficulty}-formula`);

    if (iconEl) {
        iconEl.textContent = content.icon;
    }

    if (baseEl) {
        baseEl.textContent = content.base;
    }

    if (formulaEl) {
        // P0 FIX: Use textContent and CSS for line breaks
        // OR create separate elements for each line
        const lines = content.formula.split('\n');
        formulaEl.innerHTML = ''; // Clear first

        lines.forEach((line, index) => {
            const lineEl = document.createElement('div');
            lineEl.textContent = line;
            if (index === 0) {
                lineEl.style.fontWeight = 'bold';
            }
            formulaEl.appendChild(lineEl);
        });
    }
}

// ===== P1 FIX: DIFFICULTY SELECTION (FROM GAMESTATE) =====

/**
 * Initialize selection from GameState
 */
function initializeSelection() {
    if (gameState.difficulty) {
        const card = document.querySelector(`[data-difficulty="${gameState.difficulty}"]`);
        if (card) {
            card.classList.add('selected');
            updateContinueButton();
        }
    }
}

/**
 * Get current difficulty from GameState
 */
function getSelectedDifficulty() {
    return gameState.difficulty || null;
}

/**
 * P0 FIX: Validate difficulty before selection
 */
function selectDifficulty(element) {
    const difficulty = element.dataset.difficulty;
    if (!difficulty) return;

    // P0 FIX: Validate difficulty value
    if (!difficultyNames[difficulty]) {
        console.error(`❌ Invalid difficulty: ${difficulty}`);
        return;
    }

    // Remove previous selection
    document.querySelectorAll('.difficulty-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Add selection
    element.classList.add('selected');

    // P1 FIX: Save directly to GameState
    gameState.difficulty = difficulty;
    gameState.save();

    updateContinueButton();

    showNotification(`${difficultyNames[difficulty]} Modus gewählt!`, 'success');

    console.log(`Selected difficulty: ${difficulty}`);
}

function updateContinueButton() {
    const continueBtn = document.getElementById('continueBtn');
    if (!continueBtn) return;

    const difficulty = getSelectedDifficulty();

    if (difficulty) {
        continueBtn.disabled = false;
        continueBtn.setAttribute('aria-disabled', 'false');
        continueBtn.textContent = 'Weiter';
    } else {
        continueBtn.disabled = true;
        continueBtn.setAttribute('aria-disabled', 'true');
        continueBtn.textContent = 'Schwierigkeitsgrad wählen';
    }
}

// ===== NAVIGATION =====

function proceedToDifficulty() {
    const difficulty = getSelectedDifficulty();

    if (!difficulty) {
        showNotification('Bitte wähle einen Schwierigkeitsgrad aus', 'warning');
        return;
    }

    console.log(`🚀 Proceeding with difficulty: ${difficulty}`);

    showLoading();

    // Already saved in GameState
    setTimeout(() => {
        // P0 FIX: Validate device mode before routing
        const deviceMode = gameState.deviceMode;

        if (deviceMode === 'single') {
            window.location.href = 'player-setup.html';
        } else if (deviceMode === 'multi') {
            window.location.href = 'multiplayer-lobby.html';
        } else {
            console.warn('⚠️ Device mode not set, defaulting to single');
            gameState.deviceMode = 'single';
            gameState.save();
            window.location.href = 'player-setup.html';
        }
    }, 500);
}

function goBack() {
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

/**
 * P0 FIX: Safe notification using NocapUtils
 */
function showNotification(message, type = 'info') {
    if (typeof window.NocapUtils !== 'undefined' && window.NocapUtils.showNotification) {
        window.NocapUtils.showNotification(message, type);
        return;
    }

    // Fallback
    const notification = document.getElementById('notification');
    if (!notification) return;

    const sanitizedMessage = String(message).replace(/<[^>]*>/g, '');
    notification.textContent = sanitizedMessage;
    notification.className = `notification ${type} show`;

    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// ===== INITIALIZATION =====

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}