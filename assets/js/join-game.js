// ===== AGE GATE =====
function checkAgeGate() {
    const ageConfirmed = localStorage.getItem('nocap_age_confirmed');

    if (ageConfirmed === 'true') {
        log('âœ… Alter bereits bestÃ¤tigt');
        return true;
    } else {
        log('âš ï¸ AltersbestÃ¤tigung erforderlich');
        document.getElementById('age-gate').classList.add('show');
        return false;
    }
}

function confirmAge(isAdult) {
    if (isAdult) {
        localStorage.setItem('nocap_age_confirmed', 'true');
        document.getElementById('age-gate').classList.remove('show');
        log('âœ… Alter bestÃ¤tigt');

        // Continue with initialization
        continueInitialization();
    } else {
        showNotification('Du musst mindestens 18 Jahre alt sein.', 'warning');
        setTimeout(() => {
            window.location.href = 'https://www.google.com';
        }, 2000);
    }
}

// ===== GAMESTATE CLASS =====
class GameState {
    constructor() {
        this.deviceMode = null;
        this.selectedCategories = [];
        this.difficulty = null;
        this.playerName = '';
        this.gameId = null;
        this.playerId = null;
        this.isHost = false;
        this.isGuest = false;
        this.gamePhase = 'lobby';
        this.timestamp = Date.now();
        this.load();
    }

    load() {
        try {
            const saved = localStorage.getItem('nocap_game_state');
            if (saved) {
                const state = JSON.parse(saved);
                if (state.timestamp && Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
                    Object.assign(this, state);
                    this.log('âœ… State loaded');
                }
            }
        } catch (error) {
            this.log(`âŒ Load failed: ${error.message}`, 'error');
        }
    }

    save() {
        try {
            const state = {
                deviceMode: this.deviceMode,
                selectedCategories: this.selectedCategories,
                difficulty: this.difficulty,
                playerName: this.playerName,
                gameId: this.gameId,
                playerId: this.playerId,
                isHost: this.isHost,
                isGuest: this.isGuest,
                gamePhase: this.gamePhase,
                timestamp: Date.now(),
                version: 3
            };
            localStorage.setItem('nocap_game_state', JSON.stringify(state));
            this.log('âœ… State saved');
            return true;
        } catch (error) {
            this.log(`âŒ Save failed: ${error.message}`, 'error');
            return false;
        }
    }

    clearStorage() {
        localStorage.removeItem('nocap_game_state');
        this.log('ðŸ—‘ï¸ Storage cleared');
    }

    log(message, type = 'info') {
        console.log(`[GameState] ${message}`);
    }
}

// ===== FIREBASE SERVICE CLASS =====
class FirebaseGameService {
    constructor() {
        this.app = null;
        this.auth = null;
        this.database = null;
        this.isInitialized = false;
        this.isConnected = false;
        this.listeners = [];

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
            this.log('ðŸ”¥ Firebase Service - Initialisierung...');

            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK nicht geladen');
            }

            if (!firebase.apps || firebase.apps.length === 0) {
                this.app = firebase.initializeApp(this.config);
                this.log('âœ… Firebase App initialisiert');
            } else {
                this.app = firebase.app();
                this.log('â„¹ï¸ Firebase App bereits initialisiert');
            }

            // WICHTIG: Anonymous Auth
            this.log('ðŸ” Starte anonyme Authentifizierung...');
            this.auth = firebase.auth();

            try {
                const userCredential = await this.auth.signInAnonymously();
                this.log(`âœ… Anonym angemeldet: ${userCredential.user.uid}`);
            } catch (authError) {
                this.log(`âŒ Auth Fehler: ${authError.message}`, 'error');
                throw authError;
            }

            this.database = firebase.database();
            this.log('âœ… Database-Referenz erhalten');

            await new Promise(resolve => setTimeout(resolve, 1000));

            this.isConnected = await this.testConnectionWithTimeout(15000);

            if (this.isConnected) {
                this.isInitialized = true;
                this.log('âœ… Firebase verbunden und bereit');
                return true;
            } else {
                this.log('âš ï¸ Erster Verbindungsversuch fehlgeschlagen, versuche erneut...');
                await new Promise(resolve => setTimeout(resolve, 1500));

                this.isConnected = await this.testConnectionWithTimeout(15000);

                if (this.isConnected) {
                    this.isInitialized = true;
                    this.log('âœ… Firebase verbunden nach Retry');
                    return true;
                } else {
                    this.log('âŒ Firebase Verbindung fehlgeschlagen');
                    return false;
                }
            }

        } catch (error) {
            this.log(`âŒ Firebase Fehler: ${error.message}`, 'error');
            console.error('Firebase Init Error:', error);
            this.isInitialized = false;
            this.isConnected = false;
            return false;
        }
    }

    async testConnectionWithTimeout(timeout = 15000) {
        return new Promise(async (resolve) => {
            const timeoutId = setTimeout(() => {
                this.log('âš ï¸ Verbindungstest Timeout', 'warning');
                resolve(false);
            }, timeout);

            try {
                const connectedRef = this.database.ref('.info/connected');
                const snapshot = await connectedRef.once('value');
                clearTimeout(timeoutId);

                const connected = snapshot.val() === true;
                this.log(`ðŸ” Verbindungstest: ${connected ? 'Verbunden âœ…' : 'Nicht verbunden âŒ'}`);
                resolve(connected);
            } catch (error) {
                clearTimeout(timeoutId);
                this.log(`âŒ Verbindungstest Fehler: ${error.message}`, 'error');
                resolve(false);
            }
        });
    }

    async getGameData(gameId) {
        if (!this.isReady) {
            this.log('âš ï¸ getGameData: Firebase nicht bereit');
            return null;
        }

        if (!gameId) {
            this.log('âš ï¸ getGameData: Keine gameId');
            return null;
        }

        try {
            this.log(`ðŸ” Suche Spiel mit ID: ${gameId}`);
            const gameRef = this.database.ref(`games/${gameId}`);

            const snapshot = await gameRef.once('value');

            if (snapshot.exists()) {
                const data = snapshot.val();
                this.log('âœ… Spieldaten gefunden');
                console.log('Game Data Structure:', data);
                return data;
            } else {
                this.log('âš ï¸ Kein Spiel gefunden mit dieser ID');
                return null;
            }
        } catch (error) {
            this.log(`âŒ Fehler beim Laden: ${error.message}`, 'error');
            console.error('getGameData Error:', error);
            return null;
        }
    }

    async joinGame(gameId, playerName) {
        if (!this.isConnected) {
            throw new Error('Keine Firebase-Verbindung');
        }

        try {
            this.log(`ðŸš€ Trete Spiel bei: ${gameId} als ${playerName}`);

            const playerId = `guest_${playerName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

            const playerRef = this.database.ref(`games/${gameId}/players/${playerId}`);
            await playerRef.set({
                name: playerName,
                isHost: false,
                isOnline: true,
                isReady: false,
                joinedAt: firebase.database.ServerValue.TIMESTAMP
            });

            this.log(`âœ… Player ${playerId} hinzugefÃ¼gt`);

            const gameData = await this.getGameData(gameId);

            this.log(`âœ… Erfolgreich beigetreten`);

            return {
                playerId: playerId,
                gameData: gameData
            };

        } catch (error) {
            this.log(`âŒ Fehler beim Beitreten: ${error.message}`, 'error');
            console.error('joinGame Error:', error);
            throw error;
        }
    }

    cleanup() {
        this.log('ðŸ§¹ Cleanup...');
        this.listeners.forEach(({ ref, listener }) => {
            try {
                ref.off('value', listener);
            } catch (error) {
                this.log(`âŒ Fehler beim Entfernen: ${error.message}`, 'error');
            }
        });
        this.listeners = [];
    }

    get isReady() {
        return this.isInitialized && this.isConnected;
    }

    log(message, type = 'info', data = null) {
        const colors = {
            info: '#4488ff',
            warning: '#ffaa00',
            error: '#ff4444',
            success: '#00ff00'
        };
        console.log(`%c[Firebase] ${message}`, `color: ${colors[type] || colors.info}`);
        if (data) {
            console.log(data);
        }
    }
}

// ===== GLOBAL VARIABLES =====
let gameState = null;
let firebaseService = null;
let currentGameData = null;
let checkTimeout = null;
let firebaseInitialized = false;
let pendingGameCode = null;

const categoryData = {
    fsk0: { name: 'Familie & Freunde', icon: 'ðŸ‘¨â€ðŸ‘©â€ðŸ‘§â€ðŸ‘¦' },
    fsk16: { name: 'Party Time', icon: 'ðŸŽ‰' },
    fsk18: { name: 'HeiÃŸ & Gewagt', icon: 'ðŸ”¥' },
    special: { name: 'Special Edition', icon: 'â­' }
};

const difficultyNames = {
    easy: 'Entspannt ðŸ˜Œ',
    medium: 'Ausgewogen ðŸŽ¯',
    hard: 'Hardcore ðŸ’€'
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initJoinGame();
});

async function initJoinGame() {
    log('ðŸŽ® Join Game - Initialisierung...');

    gameState = new GameState();
    gameState.clearStorage();

    // Check for URL parameter FIRST
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code && code.length === 6) {
        pendingGameCode = code.toUpperCase();
        log(`ðŸ”— URL-Parameter gefunden: ${pendingGameCode}`);
    }

    // Check age gate
    const ageConfirmed = checkAgeGate();

    if (ageConfirmed) {
        await continueInitialization();
    }
}

async function continueInitialization() {
    log('â–¶ï¸ Setze Initialisierung fort...');

    firebaseService = new FirebaseGameService();

    log('â³ Firebase wird initialisiert...');
    showLoading();

    firebaseInitialized = await firebaseService.initialize();

    hideLoading();

    if (firebaseInitialized) {
        log('âœ… Firebase bereit');

        // NOW apply pending game code if exists
        if (pendingGameCode) {
            const gameCodeInput = document.getElementById('game-code');
            gameCodeInput.value = pendingGameCode;

            setTimeout(() => {
                handleGameCodeInput();
            }, 500);
        }
    } else {
        log('âŒ Firebase nicht verfÃ¼gbar');
        showNotification('Verbindung zu Firebase fehlgeschlagen. Bitte Seite neu laden.', 'error');
    }

    log('âœ… Join Game bereit!');
}

// ===== GAME CODE HANDLING =====
function handleGameCodeInput() {
    const input = document.getElementById('game-code');
    let value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (value.length > 6) {
        value = value.substring(0, 6);
    }

    input.value = value;

    if (checkTimeout) {
        clearTimeout(checkTimeout);
    }

    input.classList.remove('valid', 'error');
    document.getElementById('game-info').classList.remove('show');

    if (value.length === 6) {
        checkTimeout = setTimeout(() => {
            checkGameExists(value);
        }, 800);
    }

    validateForm();
}

async function checkGameExists(gameCode) {
    const input = document.getElementById('game-code');

    try {
        log(`ðŸ” Checking game: ${gameCode}`);

        if (!firebaseService.isReady) {
            throw new Error('Firebase nicht verbunden. Bitte warten oder Seite neu laden.');
        }

        const gameData = await firebaseService.getGameData(gameCode);

        if (!gameData) {
            throw new Error('Spiel nicht gefunden');
        }

        if (gameData.gameState === 'finished') {
            throw new Error('Spiel bereits beendet');
        }

        if (gameData.gameState === 'playing') {
            throw new Error('Spiel lÃ¤uft bereits');
        }

        currentGameData = gameData;

        displayGameInfo(gameData);
        input.classList.add('valid');

        showNotification('Spiel gefunden! âœ…', 'success');
        validateForm();

    } catch (error) {
        log(`âŒ Check failed: ${error.message}`, 'error');
        input.classList.add('error');
        showNotification(error.message, 'error');
        currentGameData = null;
        validateForm();
    }
}

function displayGameInfo(gameData) {
    const infoDiv = document.getElementById('game-info');

    log('ðŸ“Š Displaying game info:', gameData);

    // Host
    const hostPlayer = Object.values(gameData.players || {}).find(p => p.isHost);
    document.getElementById('info-host').textContent = hostPlayer ? hostPlayer.name : 'Unbekannt';

    // Difficulty
    document.getElementById('info-difficulty').textContent =
        difficultyNames[gameData.difficulty] || 'Standard';

    // Players
    const playerCount = gameData.players ? Object.keys(gameData.players).length : 0;
    document.getElementById('info-players').textContent = `${playerCount}/8`;

    // Categories - UNTERSTÃœTZT BEIDE FORMATE
    const categoriesArray = gameData.categories || gameData.selectedCategories || [];
    log('ðŸ“‹ Categories found:', categoriesArray);

    const categories = categoriesArray
        .map(cat => {
            const catData = categoryData[cat];
            if (!catData) {
                log(`âš ï¸ Unknown category: ${cat}`, 'warning');
                return cat;
            }
            return catData.icon;
        })
        .join(' ');
    document.getElementById('info-categories').textContent = categories || '-';

    // Status
    const statusNames = {
        waiting: 'Wartet',
        lobby: 'Lobby',
        playing: 'LÃ¤uft',
        finished: 'Beendet'
    };
    document.getElementById('info-status').textContent = statusNames[gameData.gameState] || 'Lobby';

    infoDiv.classList.add('show');
}

function validateForm() {
    const gameCode = document.getElementById('game-code').value;
    const playerName = document.getElementById('player-name').value.trim();
    const joinBtn = document.getElementById('join-btn');

    const isValid = gameCode.length === 6 &&
        playerName.length >= 2 &&
        currentGameData !== null &&
        firebaseService.isReady;

    joinBtn.disabled = !isValid;
}

// ===== JOIN GAME =====
async function joinGame() {
    const gameCode = document.getElementById('game-code').value.toUpperCase();
    const playerName = document.getElementById('player-name').value.trim();

    if (!currentGameData) {
        showNotification('Spiel-Code ungÃ¼ltig', 'error');
        return;
    }

    if (playerName.length < 2) {
        showNotification('Name zu kurz (min. 2 Zeichen)', 'error');
        return;
    }

    if (!firebaseService.isReady) {
        showNotification('Firebase nicht verbunden', 'error');
        return;
    }

    log(`ðŸš€ Joining game: ${gameCode} as ${playerName}`);
    showLoading();

    try {
        const joinResult = await firebaseService.joinGame(gameCode, playerName);

        log('âœ… Successfully joined!');
        log('Join Result:', joinResult);

        // Setup game state - UNTERSTÃœTZT BEIDE FORMATE
        gameState.gameId = gameCode;
        gameState.playerId = joinResult.playerId;
        gameState.playerName = playerName;
        gameState.deviceMode = 'multi';
        gameState.isHost = false;
        gameState.isGuest = true;
        // WICHTIG: Beide Formate unterstÃ¼tzen
        gameState.selectedCategories = joinResult.gameData.categories || joinResult.gameData.selectedCategories || [];
        gameState.difficulty = joinResult.gameData.difficulty || 'medium';
        gameState.gamePhase = 'lobby';
        gameState.timestamp = Date.now();

        log('ðŸ’¾ Saving game state:', gameState);
        gameState.save();

        log('âœ… Game state saved');

        hideLoading();
        showNotification('Erfolgreich beigetreten! ðŸŽ‰', 'success');

        setTimeout(() => {
            window.location.href = 'multiplayer-lobby.html';
        }, 1500);

    } catch (error) {
        log(`âŒ Join failed: ${error.message}`, 'error');
        hideLoading();
        showNotification('Fehler beim Beitreten: ' + error.message, 'error');
    }
}

function goBack() {
    if (firebaseService) {
        firebaseService.cleanup();
    }
    window.location.href = 'index.html';
}

// ===== UTILITY FUNCTIONS =====
function showLoading() {
    document.getElementById('loading').classList.add('show');
}

function hideLoading() {
    document.getElementById('loading').classList.remove('show');
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
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
    console.log(`%c[JoinGame] ${message}`, `color: ${colors[type] || colors.info}`);
}

// ===== CLEANUP =====
window.addEventListener('beforeunload', function() {
    if (firebaseService) {
        firebaseService.cleanup();
    }
});

// ===== DEBUG =====
window.debugJoinGame = function() {
    console.log('ðŸ” === JOIN GAME DEBUG ===');
    console.log('GameState:', gameState);
    console.log('Current Game Data:', currentGameData);
    console.log('Firebase Status:', {
        initialized: firebaseService?.isInitialized,
        connected: firebaseService?.isConnected,
        ready: firebaseService?.isReady,
        auth: firebaseService?.auth?.currentUser
    });
    console.log('Firebase Initialized Flag:', firebaseInitialized);
    console.log('Pending Game Code:', pendingGameCode);
};

log('âœ… No-Cap Join Game - vollstÃ¤ndig geladen!');
log('ðŸ› ï¸ Debug: debugJoinGame()');