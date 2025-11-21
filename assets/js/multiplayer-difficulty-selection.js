// ===== NO-CAP MULTIPLAYER DIFFICULTY SELECTION =====
// Version: 2.1 - Security Hardened with XSS Protection & Encoding Fixed

'use strict';

// SECURITY NOTE: All innerHTML usages protected
// - Line ~449: innerHTML with DOMPurify.sanitize() - SAFE
// - Line ~620: Helper function (controlled content) - SAFE

// ===== FIREBASE SERVICE CLASS =====
class FirebaseGameService {
    constructor() {
        this.app = null;
        this.database = null;
        this.isInitialized = false;
        this.isConnected = false;
        this.currentGameId = null;
        this.listeners = [];
        this.connectionListeners = [];
        this.retryAttempts = 0;
        this.maxRetries = 3;

        this.config = {
            apiKey: "AIzaSyC_cu_2X2uFCPcxYetxIUHi2v56F1Mz0Vk",
            authDomain: "denkstduwebsite.firebaseapp.com",
            databaseURL: "https://denkstduwebsite-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "denkstduwebsite",
            storageBucket: "denkstduwebsite.appspot.com",
            messagingSenderId: "27029260611",
            appId: "1:27029260611:web:3c7da4db0bf92e8ce247f6",
            measurementId: "G-BNKNW95HK8"
        };
    }

    async initialize() {
        try {
            this.log('🔥 Firebase Service - Initialisierung gestartet...');

            if (typeof firebase === 'undefined') {
                this.log('❌ Firebase SDK nicht gefunden', 'error');
                throw new Error('Firebase SDK nicht geladen');
            }

            this.log('✅ Firebase SDK geladen');

            if (!firebase.apps || firebase.apps.length === 0) {
                this.log('🔧 Initialisiere Firebase App...');
                this.app = firebase.initializeApp(this.config);
                this.log('✅ Firebase App initialisiert');
            } else {
                this.log('ℹ️ Firebase App bereits initialisiert');
                this.app = firebase.app();
            }

            this.database = firebase.database();
            this.log('✅ Database Referenz erstellt');

            const connectedRef = this.database.ref('.info/connected');
            const snapshot = await connectedRef.once('value');
            this.isConnected = snapshot.val() === true;

            this.isInitialized = true;
            this.log(`✅ Firebase ${this.isConnected ? 'verbunden' : 'initialisiert (offline)'}`);

            return true;

        } catch (error) {
            this.log(`❌ Firebase Init Fehler: ${error.message}`, 'error');
            this.isInitialized = false;
            this.isConnected = false;
            return false;
        }
    }

    async updateGameSettings(gameId, difficulty) {
        if (!this.isConnected) {
            throw new Error('Nicht verbunden');
        }

        try {
            await this.database.ref(`games/${gameId}/settings/difficulty`).set(difficulty);
            this.log(`✅ Difficulty gesetzt: ${difficulty}`);
        } catch (error) {
            this.log(`❌ Update Fehler: ${error.message}`, 'error');
            throw error;
        }
    }

    cleanup() {
        this.log('🧹 Cleanup...');
        this.listeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                try {
                    unsubscribe();
                } catch (e) {
                    this.log(`Cleanup error: ${e.message}`, 'error');
                }
            }
        });
        this.listeners = [];
    }

    log(message, type = 'info') {
        const colors = { info: '#4488ff', warning: '#ffaa00', error: '#ff4444', success: '#00ff00' };
        console.log(`%c[FirebaseService] ${message}`, `color: ${colors[type] || colors.info}`);
    }
}

// ===== DIFFICULTY DATA =====
const difficultyData = {
    easy: {
        name: 'Entspannt',
        icon: '🍷',
        description: 'Perfekt für lockere Runden',
        penalty: '1 Punkt bei falscher Schätzung',
        formula: 'Punkte = Abweichung',
        color: '#4CAF50'
    },
    medium: {
        name: 'Normal',
        icon: '🍺',
        description: 'Der Standard für lustige Abende',
        penalty: 'Abweichung = Punkte',
        formula: 'Punkte = Abweichung',
        color: '#FF9800'
    },
    hard: {
        name: 'Hardcore',
        icon: '🔥',
        description: 'Nur für Profis!',
        penalty: 'Doppelte Abweichung!',
        formula: 'Punkte = Abweichung × 2',
        color: '#F44336'
    }
};

// ===== CATEGORY DATA FOR DISPLAY =====
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
let selectedDifficulty = null;
let alcoholMode = false;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', init);

async function init() {
    log('🎮 Initializing multiplayer difficulty selection...');

    // Check dependencies
    if (typeof GameState === 'undefined') {
        showNotification('Fehler: GameState nicht gefunden', 'error');
        return;
    }

    if (typeof DOMPurify === 'undefined') {
        console.error('SECURITY: DOMPurify not loaded!');
        showNotification('Sicherheitsmodul fehlt', 'error');
        return;
    }

    gameState = GameState.load();

    if (!validateGameState()) return;

    checkAlcoholMode();
    updateAlcoholModeUI();

    firebaseService = new FirebaseGameService();
    const connected = await firebaseService.initialize();

    if (!connected) {
        showNotification('Firebase Verbindung fehlgeschlagen', 'error');
        setTimeout(() => window.location.href = 'multiplayer-lobby.html', 3000);
        return;
    }

    displaySelectedCategories();
    renderDifficultyCards();
    setupEventListeners();

    if (gameState.difficulty) {
        selectedDifficulty = gameState.difficulty;
        const card = document.querySelector(`[data-difficulty="${selectedDifficulty}"]`);
        if (card) {
            card.classList.add('selected');
            updateContinueButton();
        }
    }

    log('✅ Initialized');
}

// ===== VALIDATION =====
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

    return true;
}

// ===== ALCOHOL MODE =====
function checkAlcoholMode() {
    try {
        const alcoholModeStr = localStorage.getItem('nocap_alcohol_mode');
        alcoholMode = alcoholModeStr === 'true';
        log(`🍺 Alcohol mode: ${alcoholMode}`);
    } catch (error) {
        log(`❌ Error checking alcohol mode: ${error.message}`, 'error');
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

    // Update difficulty data based on alcohol mode
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

// ===== DISPLAY CATEGORIES =====
function displaySelectedCategories() {
    const container = document.getElementById('selected-categories-display');
    if (!container) return;

    const categoriesHTML = gameState.selectedCategories.map(cat => {
        const icon = categoryIcons[cat] || '❓';
        const name = categoryNames[cat] || cat;
        return createCategoryTag(icon, name);
    }).join('');

    // SECURITY: DOMPurify.sanitize() protects dynamic content
    if (typeof DOMPurify !== 'undefined') {
        container.innerHTML = DOMPurify.sanitize(categoriesHTML, {
            ALLOWED_TAGS: ['div', 'span'],
            ALLOWED_ATTR: ['class']
        });
    } else {
        log('⚠️ DOMPurify not available, using innerHTML directly', 'warning');
        container.innerHTML = categoriesHTML;
    }

    log('✅ Categories displayed');
}

function createCategoryTag(icon, name) {
    return `<div class="category-tag"><span class="tag-icon">${icon}</span><span class="tag-name">${name}</span></div>`;
}

// ===== RENDER DIFFICULTY CARDS =====
function renderDifficultyCards() {
    const grid = document.getElementById('difficulty-grid');
    if (!grid) return;

    grid.innerHTML = '';

    Object.entries(difficultyData).forEach(([key, data]) => {
        const card = document.createElement('div');
        card.className = 'difficulty-card';
        card.dataset.difficulty = key;

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

        grid.appendChild(card);
    });

    log('✅ Difficulty cards rendered');
}

// ===== DIFFICULTY SELECTION =====
function selectDifficulty(difficulty) {
    if (!difficultyData[difficulty]) {
        log(`❌ Invalid difficulty: ${difficulty}`, 'error');
        return;
    }

    document.querySelectorAll('.difficulty-card').forEach(card => {
        card.classList.remove('selected');
    });

    const selectedCard = document.querySelector(`[data-difficulty="${difficulty}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }

    selectedDifficulty = difficulty;
    gameState.difficulty = difficulty;
    gameState.save();

    updateContinueButton();
    showNotification(`${difficultyData[difficulty].name} gewählt!`, 'success');

    log(`Selected difficulty: ${difficulty}`);
}

function updateContinueButton() {
    const btn = document.getElementById('continue-btn');
    if (!btn) return;

    if (selectedDifficulty) {
        btn.disabled = false;
        btn.classList.add('enabled');
        btn.textContent = 'Weiter';
    } else {
        btn.disabled = true;
        btn.classList.remove('enabled');
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

    log('✅ Event listeners setup');
}

// ===== NAVIGATION =====
async function proceed() {
    if (!selectedDifficulty) {
        showNotification('Bitte wähle einen Schwierigkeitsgrad', 'warning');
        return;
    }

    try {
        showNotification('Speichere Einstellungen...', 'info');

        await firebaseService.updateGameSettings(gameState.gameId, selectedDifficulty);

        gameState.difficulty = selectedDifficulty;
        gameState.save();

        showNotification('Einstellungen gespeichert!', 'success');

        setTimeout(() => {
            window.location.href = 'multiplayer-lobby.html';
        }, 500);

    } catch (error) {
        log(`❌ Proceed error: ${error.message}`, 'error');
        showNotification('Fehler beim Speichern', 'error');
    }
}

function goBack() {
    if (firebaseService) {
        firebaseService.cleanup();
    }
    window.location.href = 'multiplayer-category-selection.html';
}

// ===== UTILITIES =====
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    // XSS-SAFE: Sanitize message
    const sanitizedMessage = String(message).replace(/<[^>]*>/g, '');
    notification.textContent = sanitizedMessage;

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function log(message, type = 'info') {
    const colors = { info: '#4488ff', warning: '#ffaa00', error: '#ff4444', success: '#00ff00' };
    console.log(`%c[MultiDifficultySelect] ${message}`, `color: ${colors[type] || colors.info}`);
}

// ===== DEBUG =====
window.debugMultiDifficultySelection = function() {
    console.log('🔍 === MULTI DIFFICULTY SELECTION DEBUG ===');
    console.log('GameState:', gameState?.getDebugInfo?.());
    console.log('Selected Difficulty:', selectedDifficulty);
    console.log('Alcohol Mode:', alcoholMode);
    console.log('Firebase:', {
        initialized: firebaseService?.isInitialized,
        connected: firebaseService?.isConnected
    });
};

log('✅ Multiplayer Difficulty Selection v2.1 - Loaded!');