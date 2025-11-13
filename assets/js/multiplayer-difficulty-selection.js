// ===== NO-CAP MULTIPLAYER DIFFICULTY SELECTION =====
// Version: 2.0 - Refactored with central GameState

'use strict';

// ===== IMPROVED FIREBASE SERVICE CLASS =====
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

            this.log('🔧 Hole Database-Referenz...');
            this.database = firebase.database();
            this.log('✅ Database-Referenz erhalten');

            await new Promise(resolve => setTimeout(resolve, 300));

            this.log('🔧 Teste Verbindung...');
            this.isConnected = await this.testConnectionWithTimeout(10000);

            if (this.isConnected) {
                this.log('✅ Firebase-Verbindung erfolgreich!');
                this.setupConnectionMonitoring();
                this.isInitialized = true;
                this.retryAttempts = 0;
            } else {
                this.log('⚠️ Firebase-Verbindung fehlgeschlagen', 'warning');
                this.isInitialized = false;
            }

            return this.isInitialized;

        } catch (error) {
            this.log(`❌ Firebase Initialisierung fehlgeschlagen: ${error.message}`, 'error');
            console.error('Firebase Error Details:', error);
            this.isInitialized = false;
            this.isConnected = false;
            return false;
        }
    }

    async testConnectionWithTimeout(timeout = 10000) {
        return new Promise(async (resolve) => {
            const timeoutId = setTimeout(() => {
                this.log('⚠️ Verbindungstest Timeout nach 10 Sekunden', 'warning');
                resolve(false);
            }, timeout);

            try {
                const connectedRef = this.database.ref('.info/connected');
                const snapshot = await connectedRef.once('value');
                clearTimeout(timeoutId);
                const connected = snapshot.val() === true;
                this.log(`🔍 Verbindungstest: ${connected ? 'Verbunden' : 'Nicht verbunden'}`);
                resolve(connected);
            } catch (error) {
                clearTimeout(timeoutId);
                this.log(`❌ Verbindungstest Fehler: ${error.message}`, 'error');
                resolve(false);
            }
        });
    }

    setupConnectionMonitoring() {
        try {
            this.log('🔧 Setup Verbindungsüberwachung...');
            const connectedRef = this.database.ref('.info/connected');

            const connectionListener = connectedRef.on('value', (snapshot) => {
                const wasConnected = this.isConnected;
                this.isConnected = snapshot.val() === true;

                if (wasConnected !== this.isConnected) {
                    this.log(`🔄 Verbindungsstatus geändert: ${this.isConnected ? 'Verbunden ✅' : 'Getrennt ❌'}`);
                    this.notifyConnectionChange(this.isConnected);
                }
            });

            this.listeners.push({ ref: connectedRef, listener: connectionListener });
            this.log('✅ Verbindungsüberwachung aktiv');

        } catch (error) {
            this.log(`❌ Fehler beim Setup der Verbindungsüberwachung: ${error.message}`, 'error');
        }
    }

    async retry() {
        if (this.retryAttempts < this.maxRetries) {
            this.retryAttempts++;
            this.log(`🔄 Verbindungsversuch ${this.retryAttempts}/${this.maxRetries}...`);
            return await this.initialize();
        } else {
            this.log('❌ Maximale Anzahl an Versuchen erreicht', 'error');
            return false;
        }
    }

    onConnectionChange(callback) {
        this.connectionListeners.push(callback);
    }

    notifyConnectionChange(connected) {
        this.connectionListeners.forEach(callback => {
            try {
                callback(connected);
            } catch (error) {
                this.log(`❌ Fehler beim Benachrichtigen: ${error.message}`, 'error');
            }
        });
    }

    async updateGameSettings(gameId, settings) {
        if (!this.isConnected || !gameId) {
            this.log('⚠️ Kann nicht aktualisieren - Offline oder keine Game ID');
            return false;
        }

        try {
            const gameRef = this.database.ref(`games/${gameId}`);
            await gameRef.update({
                ...settings,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });

            this.log(`✅ Spieleinstellungen aktualisiert: ${gameId}`);
            return true;
        } catch (error) {
            this.log(`❌ Fehler beim Aktualisieren: ${error.message}`, 'error');
            return false;
        }
    }

    cleanup() {
        this.log('🧹 Firebase Service Cleanup...');

        this.listeners.forEach(({ ref, listener }) => {
            try {
                ref.off('value', listener);
            } catch (error) {
                this.log(`❌ Fehler beim Entfernen des Listeners: ${error.message}`, 'error');
            }
        });

        this.listeners = [];
        this.connectionListeners = [];
        this.currentGameId = null;

        this.log('✅ Cleanup abgeschlossen');
    }

    get isReady() {
        return this.isInitialized && this.isConnected;
    }

    log(message, type = 'info') {
        const colors = {
            info: '#4488ff',
            warning: '#ffaa00',
            error: '#ff4444',
            success: '#00ff00'
        };
        console.log(`%c[Firebase] ${message}`, `color: ${colors[type] || colors.info}`);
    }
}

// ===== GLOBAL VARIABLES =====
let gameState = null;
let firebaseService = null;
let selectedDifficulty = null;

// Category data
const categoryData = {
    fsk0: {
        name: 'Familie & Freunde',
        icon: '👨‍👩‍👧‍👦',
        color: '#4CAF50'
    },
    fsk16: {
        name: 'Party Time',
        icon: '🎉',
        color: '#FF9800'
    },
    fsk18: {
        name: 'Heiß & Gewagt',
        icon: '🔥',
        color: '#F44336'
    },
    special: {
        name: 'Special Edition',
        icon: '⭐',
        color: '#FFD700'
    }
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initMultiplayerDifficultySelection();
});

async function initMultiplayerDifficultySelection() {
    log('🎯 Multiplayer Difficulty Selection - Initialisierung gestartet...');

    try {
        // SCHRITT 1: Central GameState laden
        if (typeof GameState === 'undefined') {
            log('❌ GameState nicht gefunden - Lade zentrale Version', 'error');
            showNotification('Fehler beim Laden. Bitte Seite neu laden.', 'error');
            return;
        }

        gameState = GameState.load();
        firebaseService = new FirebaseGameService();

        // SCHRITT 1.5: UI SOFORT aktualisieren mit geladenen Daten
        log('📊 GameState Debug:', gameState.getDebugInfo());

        displayGameInfo();
        displaySelectedCategories();
        loadPreviousDifficulty();

        // SCHRITT 1.6: Setup Event Listeners for UI
        setupEventListeners();

        // SCHRITT 2: State validieren
        if (!validateGameState()) {
            return;
        }

        // SCHRITT 3: Event Listeners setup
        setupEventListeners();

        // SCHRITT 4: Firebase initialisieren (im Hintergrund)
        log('🔥 Starte Firebase-Initialisierung...');
        updateConnectionStatus('connecting', '🔄 Verbinde mit Firebase...');

        await new Promise(resolve => setTimeout(resolve, 500));

        let firebaseReady = await firebaseService.initialize();

        if (!firebaseReady && firebaseService.retryAttempts < firebaseService.maxRetries) {
            log('🔄 Erster Versuch fehlgeschlagen, starte automatisches Retry...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            firebaseReady = await firebaseService.retry();
        }

        if (firebaseReady) {
            log('✅ Firebase bereit und verbunden!');
            updateConnectionStatus('connected', '✅ Verbunden');
            setupConnectionStatus();
        } else {
            log('⚠️ Firebase konnte nicht verbinden - Offline-Modus aktiv');
            updateConnectionStatus('disconnected', '⚠️ Offline (Klicken zum Neu-Verbinden)');
        }

        log('✅ Multiplayer Difficulty Selection bereit!');

    } catch (error) {
        log(`❌ Initialisierung fehlgeschlagen: ${error.message}`, 'error');
        console.error('Init Error:', error);
        updateConnectionStatus('disconnected', '❌ Fehler (Klicken zum Neu-Verbinden)');
    }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    log('🔧 Setup Event Listeners...');

    // Connection Status Click
    const connectionStatus = document.getElementById('connection-status');
    if (connectionStatus) {
        connectionStatus.addEventListener('click', retryFirebaseConnection);
    }

    // Difficulty Cards Click
    const difficultyCards = document.querySelectorAll('.difficulty-card');
    difficultyCards.forEach(card => {
        card.addEventListener('click', function() {
            const difficulty = this.getAttribute('data-difficulty');
            selectDifficulty(difficulty, this);
        });
    });

    // Back Button
    const backBtn = document.querySelector('.btn-outline');
    if (backBtn) {
        backBtn.addEventListener('click', goBack);
    }

    // Continue Button
    const continueBtn = document.getElementById('continue-btn');
    if (continueBtn) {
        continueBtn.addEventListener('click', proceedToLobby);
    }

    log('✅ Event Listeners setup complete');
}

async function retryFirebaseConnection() {
    if (!firebaseService || firebaseService.isConnected) {
        return;
    }

    log('🔄 Versuche Firebase neu zu verbinden...');
    updateConnectionStatus('connecting', '🔄 Neu-Verbindung...');

    const success = await firebaseService.retry();

    if (success) {
        updateConnectionStatus('connected', '✅ Verbunden');
        showNotification('Erfolgreich verbunden! 🎉', 'success');
    } else {
        updateConnectionStatus('disconnected', '❌ Verbindung fehlgeschlagen');
        showNotification('Verbindung fehlgeschlagen', 'error');
    }
}

// ===== VALIDATION & GUARDS =====
function validateGameState() {
    if (gameState.deviceMode !== 'multi') {
        log('❌ Nicht im Multiplayer-Modus', 'error');
        showNotification('Nicht im Multiplayer-Modus. Weiterleitung...', 'warning');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return false;
    }

    if (!gameState.selectedCategories || gameState.selectedCategories.length === 0) {
        log('❌ Keine Kategorien ausgewählt', 'error');
        showNotification('Keine Kategorien ausgewählt. Zurück zur Kategorieauswahl...', 'warning');
        setTimeout(() => {
            window.location.href = 'multiplayer-category-selection.html';
        }, 2000);
        return false;
    }

    if (!gameState.gameId) {
        log('❌ Keine Spiel-ID gefunden', 'error');
        showNotification('Keine Spiel-ID gefunden. Zurück zur Kategorieauswahl...', 'warning');
        setTimeout(() => {
            window.location.href = 'multiplayer-category-selection.html';
        }, 2000);
        return false;
    }

    return true;
}

function setupConnectionStatus() {
    firebaseService.onConnectionChange((connected) => {
        updateConnectionStatus(
            connected ? 'connected' : 'disconnected',
            connected ? '✅ Verbunden' : '⚠️ Offline'
        );
    });
}

// ===== UI DISPLAY FUNCTIONS =====
function displayGameInfo() {
    log(`🏷️ Display Game Info - Host: ${gameState.playerName}, Game ID: ${gameState.gameId}`);

    const hostNameEl = document.getElementById('host-name');
    const gameIdEl = document.getElementById('game-id');

    if (hostNameEl) {
        hostNameEl.textContent = gameState.playerName || 'Unbekannt';
    }

    if (gameIdEl) {
        gameIdEl.textContent = gameState.gameId || 'N/A';
    }

    log(`✅ Game Info displayed`);
}

function displaySelectedCategories() {
    log(`📂 Display Categories - Categories: [${gameState.selectedCategories.join(', ')}]`);

    const categoriesContainer = document.getElementById('categories-display');

    if (!categoriesContainer) {
        log('❌ Categories container not found!', 'error');
        return;
    }

    if (!gameState.selectedCategories || gameState.selectedCategories.length === 0) {
        log('⚠️ No categories found in GameState', 'warning');
        categoriesContainer.textContent = 'Keine Kategorien';
        categoriesContainer.style.color = 'rgba(255,255,255,0.5)';
        return;
    }

    log(`✅ Displaying ${gameState.selectedCategories.length} categories`);

    // Use DOMPurify if available, otherwise use textContent
    const categoriesHTML = gameState.selectedCategories.map(category => {
        const data = categoryData[category];
        if (!data) {
            log(`⚠️ Unknown category: ${category}`, 'warning');
            return `<div class="category-tag">${escapeHtml(category)}</div>`;
        }
        return `
            <div class="category-tag">
                <span>${escapeHtml(data.icon)}</span>
                <span>${escapeHtml(data.name)}</span>
            </div>
        `;
    }).join('');

    if (typeof DOMPurify !== 'undefined') {
        categoriesContainer.innerHTML = DOMPurify.sanitize(categoriesHTML);
    } else {
        categoriesContainer.innerHTML = categoriesHTML;
    }
}

function loadPreviousDifficulty() {
    if (gameState.difficulty) {
        log(`🔄 Loading previous difficulty: ${gameState.difficulty}`);
        const difficultyCard = document.querySelector(`[data-difficulty="${gameState.difficulty}"]`);
        if (difficultyCard) {
            selectDifficulty(gameState.difficulty, difficultyCard);
        }
    }
}

// ===== DIFFICULTY SELECTION =====
function selectDifficulty(difficulty, element) {
    log(`🎯 Schwierigkeit ausgewählt: ${difficulty}`);

    // Remove previous selection
    document.querySelectorAll('.difficulty-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Add current selection
    element.classList.add('selected');
    selectedDifficulty = difficulty;

    // Update game state
    gameState.setDifficulty(difficulty);

    // Show notification
    const difficultyNames = {
        easy: 'Entspannt',
        medium: 'Ausgewogen',
        hard: 'Hardcore'
    };

    showNotification(`${difficultyNames[difficulty]} ausgewählt!`, 'success');

    // Update UI
    updateContinueButton();
}

function updateContinueButton() {
    const continueBtn = document.getElementById('continue-btn');

    if (selectedDifficulty) {
        continueBtn.disabled = false;
        continueBtn.classList.add('enabled');
        continueBtn.textContent = 'Zur Lobby';
    } else {
        continueBtn.disabled = true;
        continueBtn.classList.remove('enabled');
        continueBtn.textContent = 'Schwierigkeit auswählen';
    }
}

async function syncWithFirebase() {
    if (firebaseService && firebaseService.isReady && gameState.gameId) {
        try {
            log('🔄 Synchronisiere mit Firebase...');
            await firebaseService.updateGameSettings(gameState.gameId, {
                difficulty: selectedDifficulty,
                categories: gameState.selectedCategories
            });
            log('✅ Schwierigkeit mit Firebase synchronisiert');
            return true;
        } catch (error) {
            log(`❌ Firebase-Sync fehlgeschlagen: ${error.message}`, 'error');
            return false;
        }
    } else {
        log('ℹ️ Firebase nicht verfügbar - nur lokale Speicherung');
        return false;
    }
}

// ===== NAVIGATION =====
async function proceedToLobby() {
    if (!selectedDifficulty) {
        showNotification('Bitte wähle eine Schwierigkeit aus', 'warning');
        return;
    }

    log(`🚀 Weiter zur Lobby mit Einstellungen: ${JSON.stringify(gameState.getDebugInfo())}`);

    showLoading();

    try {
        // Sync with Firebase silently
        await syncWithFirebase();

        // Set game phase to lobby
        gameState.gamePhase = 'lobby';
        gameState.save();

        showNotification('Einstellungen gespeichert! 🚀', 'success');

        setTimeout(() => {
            window.location.href = 'multiplayer-lobby.html';
        }, 1000);

    } catch (error) {
        log(`❌ Fehler beim Weiterleiten: ${error.message}`, 'error');
        showNotification('Fehler beim Fortfahren', 'error');
        hideLoading();
    }
}

function goBack() {
    log('⬅️ Zurück zur Kategorieauswahl');

    if (firebaseService) {
        firebaseService.cleanup();
    }

    showLoading();

    setTimeout(() => {
        window.location.href = 'multiplayer-category-selection.html';
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

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (!notification) return;

    notification.textContent = message;
    notification.className = `notification ${type} show`;

    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function updateConnectionStatus(status, message = '') {
    const statusEl = document.getElementById('connection-status');
    if (!statusEl) return;

    statusEl.textContent = message || status;
    statusEl.className = `connection-status ${status}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function log(message, type = 'info') {
    const colors = {
        info: '#4488ff',
        warning: '#ffaa00',
        error: '#ff4444',
        success: '#00ff00'
    };

    console.log(`%c[MultiDifficulty] ${message}`, `color: ${colors[type] || colors.info}`);
}

// ===== CLEANUP =====
window.addEventListener('beforeunload', function() {
    if (firebaseService) {
        firebaseService.cleanup();
    }
});

// ===== DEBUG FUNCTIONS =====
window.debugDifficultySelection = function() {
    console.log('🔍 === DIFFICULTY SELECTION DEBUG ===');
    console.log('GameState:', gameState?.getDebugInfo());
    console.log('Selected Difficulty:', selectedDifficulty);
    console.log('Firebase Status:', {
        initialized: firebaseService?.isInitialized,
        connected: firebaseService?.isConnected,
        ready: firebaseService?.isReady,
        retryAttempts: firebaseService?.retryAttempts
    });
    console.log('LocalStorage:', localStorage.getItem('nocap_game_state'));
};

window.forceRetry = function() {
    retryFirebaseConnection();
};

log('✅ No-Cap Multiplayer Difficulty Selection - JS geladen!');
log('🛠️ Debug: debugDifficultySelection() | forceRetry()');