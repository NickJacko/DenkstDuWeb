// ===== NO-CAP MULTIPLAYER DIFFICULTY SELECTION =====
// Version: 2.2 - Security Hardened & Production Ready

'use strict';

// ===== DIFFICULTY DATA =====
const difficultyData = {
    easy: {
        name: 'Entspannt',
        icon: '🍷',
        description: 'Perfekt für lockere Runden',
        penalty: '1 Punkt bei falscher Schätzung',
        formula: 'Punkte = Abweichung',
        multiplier: 1,
        color: '#4CAF50'
    },
    medium: {
        name: 'Normal',
        icon: '🍺',
        description: 'Der Standard für lustige Abende',
        penalty: 'Abweichung = Punkte',
        formula: 'Punkte = Abweichung',
        multiplier: 1,
        color: '#FF9800'
    },
    hard: {
        name: 'Hardcore',
        icon: '🔥',
        description: 'Nur für Profis!',
        penalty: 'Doppelte Abweichung!',
        formula: 'Punkte = Abweichung × 2',
        multiplier: 2,
        color: '#F44336'
    }
};

// ===== CATEGORY DATA =====
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

// ===== GLOBAL STATE =====
let gameState = null;
let firebaseService = null;
let alcoholMode = false;

// ===== P0 FIX: INPUT SANITIZATION =====

/**
 * Sanitize text with NocapUtils or fallback
 */
function sanitizeText(input) {
    if (!input) return '';

    if (typeof window.NocapUtils !== 'undefined' && window.NocapUtils.sanitizeInput) {
        return window.NocapUtils.sanitizeInput(String(input));
    }

    return String(input).replace(/<[^>]*>/g, '').substring(0, 500);
}

// ===== INITIALIZATION =====

async function initialize() {
    console.log('🎮 Initializing multiplayer difficulty selection...');

    if (typeof GameState === 'undefined') {
        showNotification('Fehler: GameState nicht gefunden', 'error');
        return;
    }

    gameState = new GameState();

    if (!validateGameState()) {
        return;
    }

    checkAlcoholMode();
    updateAlcoholModeUI();

    // P0 FIX: Use global firebaseGameService
    if (typeof window.firebaseGameService !== 'undefined') {
        firebaseService = window.firebaseGameService;
    } else {
        console.error('❌ Firebase service not available');
        showNotification('Firebase nicht verfügbar', 'error');
        setTimeout(() => window.location.href = 'multiplayer-lobby.html', 3000);
        return;
    }

    displaySelectedCategories();
    renderDifficultyCards();
    setupEventListeners();

    // P1 FIX: Load from GameState
    if (gameState.difficulty) {
        const card = document.querySelector(`[data-difficulty="${gameState.difficulty}"]`);
        if (card) {
            card.classList.add('selected');
            updateContinueButton();
        }
    }

    console.log('✅ Initialized');
}

// ===== VALIDATION =====

/**
 * P0 FIX: Validate game state with FSK checks
 */
function validateGameState() {
    if (!gameState || gameState.deviceMode !== 'multi') {
        showNotification('Falscher Spielmodus', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }

    if (!gameState.selectedCategories || gameState.selectedCategories.length === 0) {
        showNotification('Keine Kategorien ausgewählt', 'error');
        setTimeout(() => window.location.href = 'multiplayer-category-selection.html', 2000);
        return false;
    }

    if (!gameState.gameId) {
        showNotification('Keine Game-ID gefunden', 'error');
        setTimeout(() => window.location.href = 'multiplayer-lobby.html', 2000);
        return false;
    }

    // P0 FIX: Validate FSK access
    const ageLevel = parseInt(localStorage.getItem('nocap_age_level')) || 0;
    const hasInvalidCategory = gameState.selectedCategories.some(cat => {
        if (cat === 'fsk18' && ageLevel < 18) return true;
        if (cat === 'fsk16' && ageLevel < 16) return true;
        return false;
    });

    if (hasInvalidCategory) {
        console.error('❌ Invalid categories for age level');
        showNotification('Ungültige Kategorien für dein Alter!', 'error');
        setTimeout(() => window.location.href = 'multiplayer-category-selection.html', 2000);
        return false;
    }

    return true;
}

// ===== ALCOHOL MODE =====

function checkAlcoholMode() {
    try {
        const alcoholModeStr = localStorage.getItem('nocap_alcohol_mode');
        alcoholMode = alcoholModeStr === 'true';
        console.log(`🍺 Alcohol mode: ${alcoholMode}`);
    } catch (error) {
        console.error('❌ Error checking alcohol mode:', error);
        alcoholMode = false;
    }
}

function updateAlcoholModeUI() {
    const subtitle = document.getElementById('difficulty-subtitle');
    if (subtitle) {
        subtitle.textContent = alcoholMode
            ? 'Bestimmt die Anzahl der Schlücke bei falschen Schätzungen'
            : 'Bestimmt die Konsequenz bei falschen Schätzungen';
    }

    // Update difficulty data
    if (alcoholMode) {
        difficultyData.easy.penalty = '1 Schluck bei falscher Schätzung';
        difficultyData.medium.penalty = 'Abweichung = Schlücke';
        difficultyData.hard.penalty = 'Doppelte Schlücke!';
    } else {
        difficultyData.easy.penalty = '1 Punkt bei falscher Schätzung';
        difficultyData.medium.penalty = 'Abweichung = Punkte';
        difficultyData.hard.penalty = 'Doppelte Punkte!';
    }
}

// ===== P0 FIX: DISPLAY CATEGORIES WITH TEXTCONTENT =====

/**
 * Display selected categories with safe DOM manipulation
 */
function displaySelectedCategories() {
    const container = document.getElementById('selected-categories-display');
    if (!container) return;

    container.innerHTML = '';

    gameState.selectedCategories.forEach(cat => {
        const icon = categoryIcons[cat] || '❓';
        const name = categoryNames[cat] || cat;

        const tag = document.createElement('div');
        tag.className = 'category-tag';

        const iconSpan = document.createElement('span');
        iconSpan.className = 'tag-icon';
        iconSpan.textContent = icon;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'tag-name';
        nameSpan.textContent = name;

        tag.appendChild(iconSpan);
        tag.appendChild(nameSpan);

        container.appendChild(tag);
    });

    console.log('✅ Categories displayed');
}

// ===== P0 FIX: RENDER CARDS WITH TEXTCONTENT =====

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
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `${data.name} Schwierigkeitsgrad wählen`);

        const header = document.createElement('div');
        header.className = 'difficulty-header';

        const icon = document.createElement('div');
        icon.className = 'difficulty-icon';
        icon.textContent = data.icon;

        const name = document.createElement('h3');
        name.className = 'difficulty-name';
        name.textContent = data.name;

        header.appendChild(icon);
        header.appendChild(name);

        const description = document.createElement('p');
        description.className = 'difficulty-description';
        description.textContent = data.description;

        const penalty = document.createElement('div');
        penalty.className = 'difficulty-penalty';
        penalty.textContent = data.penalty;

        const formula = document.createElement('div');
        formula.className = 'difficulty-formula';
        formula.textContent = data.formula;

        card.appendChild(header);
        card.appendChild(description);
        card.appendChild(penalty);
        card.appendChild(formula);

        card.addEventListener('click', () => selectDifficulty(key));

        // Keyboard support
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectDifficulty(key);
            }
        });

        grid.appendChild(card);
    });

    console.log('✅ Difficulty cards rendered');
}

// ===== DIFFICULTY SELECTION =====

/**
 * P0 FIX: Select difficulty with validation
 */
function selectDifficulty(difficulty) {
    // P0 FIX: Validate difficulty
    if (!difficultyData[difficulty]) {
        console.error(`❌ Invalid difficulty: ${difficulty}`);
        return;
    }

    document.querySelectorAll('.difficulty-card').forEach(card => {
        card.classList.remove('selected');
        card.setAttribute('aria-selected', 'false');
    });

    const selectedCard = document.querySelector(`[data-difficulty="${difficulty}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
        selectedCard.setAttribute('aria-selected', 'true');
    }

    gameState.difficulty = difficulty;
    gameState.save();

    updateContinueButton();
    showNotification(`${difficultyData[difficulty].name} gewählt!`, 'success');

    console.log(`Selected difficulty: ${difficulty}`);
}

function updateContinueButton() {
    const btn = document.getElementById('continue-btn');
    if (!btn) return;

    if (gameState.difficulty) {
        btn.disabled = false;
        btn.classList.add('enabled');
        btn.setAttribute('aria-disabled', 'false');
        btn.textContent = 'Weiter';
    } else {
        btn.disabled = true;
        btn.classList.remove('enabled');
        btn.setAttribute('aria-disabled', 'true');
        btn.textContent = 'Schwierigkeitsgrad wählen';
    }
}

// ===== EVENT LISTENERS =====

function setupEventListeners() {
    const backBtn = document.querySelector('.back-button');
    const continueBtn = document.getElementById('continue-btn');

    if (backBtn) {
        backBtn.addEventListener('click', goBack);
    }

    if (continueBtn) {
        continueBtn.addEventListener('click', proceed);
    }

    console.log('✅ Event listeners setup');
}

// ===== NAVIGATION =====

async function proceed() {
    if (!gameState.difficulty) {
        showNotification('Bitte wähle einen Schwierigkeitsgrad', 'warning');
        return;
    }

    try {
        showNotification('Speichere Einstellungen...', 'info');

        // Update Firebase
        if (firebaseService && gameState.gameId) {
            const gameRef = firebase.database().ref(`games/${gameState.gameId}/settings/difficulty`);
            await gameRef.set(gameState.difficulty);
        }

        showNotification('Einstellungen gespeichert!', 'success');

        setTimeout(() => {
            window.location.href = 'multiplayer-lobby.html';
        }, 500);

    } catch (error) {
        console.error('❌ Proceed error:', error);
        showNotification('Fehler beim Speichern', 'error');
    }
}

function goBack() {
    window.location.href = 'multiplayer-category-selection.html';
}

// ===== UTILITIES =====

/**
 * P0 FIX: Safe notification using NocapUtils
 */
function showNotification(message, type = 'info') {
    if (typeof window.NocapUtils !== 'undefined' && window.NocapUtils.showNotification) {
        window.NocapUtils.showNotification(message, type);
        return;
    }

    // Fallback
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = sanitizeText(message);

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===== INITIALIZATION =====

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

console.log('✅ Multiplayer Difficulty Selection v2.2 - Production Ready!');