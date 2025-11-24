/**
 * No-Cap - Join Game Page
 * Version 2.0 - Security Hardened & Production Ready
 * Handles joining existing multiplayer games
 */

// ===========================
// GLOBAL VARIABLES
// ===========================
let gameState = null;
let firebaseService = null;
let currentGameData = null;
let checkTimeout = null;

const categoryData = {
    fsk0: { name: 'Familie & Freunde', icon: '👨‍👩‍👧‍👦' },
    fsk16: { name: 'Party Time', icon: '🎉' },
    fsk18: { name: 'Heiß & Gewagt', icon: '🔥' },
    special: { name: 'Special Edition', icon: '⭐' }
};

const difficultyNames = {
    easy: 'Entspannt 😌',
    medium: 'Ausgewogen 🎯',
    hard: 'Hardcore 💀'
};

// ===========================
// INITIALIZATION
// ===========================

/**
 * Main initialization function
 */
async function initialize() {
    console.log('🔗 Join Game - Initialisierung...');

    // P0 FIX: Check for required dependencies
    if (typeof GameState === 'undefined') {
        console.error('❌ GameState not loaded!');
        showNotification('Fehler: Spieldaten nicht geladen', 'error');
        return;
    }

    if (typeof window.firebaseGameService === 'undefined') {
        console.error('❌ FirebaseGameService not loaded!');
        showNotification('Fehler: Firebase-Service nicht geladen', 'error');
        return;
    }

    // Use global services
    gameState = new GameState();
    firebaseService = window.firebaseGameService;

    // P1 FIX: Check age verification
    if (!checkAgeVerification()) {
        showNotification('Altersverifikation erforderlich', 'warning');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }

    // Initialize Firebase
    showLoading();

    try {
        const initialized = await firebaseService.initialize();

        if (!initialized) {
            throw new Error('Firebase-Verbindung fehlgeschlagen');
        }

        console.log('✅ Firebase bereit');

        // P0 FIX: Check URL parameter with validation
        handleUrlParameter();

    } catch (error) {
        console.error('❌ Initialization failed:', error);
        showNotification('Verbindung fehlgeschlagen. Bitte Seite neu laden.', 'error');
    } finally {
        hideLoading();
    }

    // Setup event listeners
    setupEventListeners();

    console.log('✅ Join Game bereit!');
}

/**
 * P1 FIX: Check age verification
 */
function checkAgeVerification() {
    try {
        const ageLevel = parseInt(localStorage.getItem('nocap_age_level')) || 0;
        const ageVerified = localStorage.getItem('nocap_age_verification');

        if (!ageVerified) {
            return false;
        }

        const verification = JSON.parse(ageVerified);
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        // Check if still valid
        if (verification.timestamp && now - verification.timestamp < oneDay) {
            return true;
        }

        return false;
    } catch (error) {
        console.error('Age verification check failed:', error);
        return false;
    }
}

/**
 * P0 FIX: Handle URL parameter with strict validation
 */
function handleUrlParameter() {
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('gameId') || urlParams.get('code');

    if (!gameId) {
        return;
    }

    // P0 FIX: Validate and sanitize gameId
    const sanitized = typeof window.NocapUtils !== 'undefined'
        ? window.NocapUtils.sanitizeInput(gameId)
        : gameId.replace(/[^A-Z0-9]/gi, '');

    const cleaned = sanitized.toUpperCase().substring(0, 6);

    if (cleaned.length === 6) {
        console.log(`📋 URL-Parameter: ${cleaned}`);

        const gameCodeInput = document.getElementById('game-code');
        if (gameCodeInput) {
            gameCodeInput.value = cleaned;

            // Trigger check after short delay
            setTimeout(() => {
                handleGameCodeInput();
            }, 500);
        }
    } else {
        console.warn('⚠️ Invalid gameId in URL');
        showNotification('Ungültiger Spiel-Code in URL', 'warning');
    }
}

// ===========================
// EVENT LISTENERS
// ===========================

function setupEventListeners() {
    // Game code input
    const gameCodeInput = document.getElementById('game-code');
    if (gameCodeInput) {
        gameCodeInput.addEventListener('input', handleGameCodeInput);
        gameCodeInput.addEventListener('paste', (e) => {
            setTimeout(() => handleGameCodeInput(), 10);
        });
    }

    // Player name input
    const playerNameInput = document.getElementById('player-name');
    if (playerNameInput) {
        playerNameInput.addEventListener('input', validateForm);
    }

    // Join button
    const joinBtn = document.getElementById('join-btn');
    if (joinBtn) {
        joinBtn.addEventListener('click', joinGame);
    }

    // Back button
    const backBtn = document.querySelector('.back-button');
    if (backBtn) {
        backBtn.addEventListener('click', goBack);
    }
}

// ===========================
// GAME CODE HANDLING
// ===========================

/**
 * P0 FIX: Handle game code input with sanitization
 */
function handleGameCodeInput() {
    const input = document.getElementById('game-code');
    if (!input) return;

    // P0 FIX: Sanitize input
    let value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (value.length > 6) {
        value = value.substring(0, 6);
    }

    input.value = value;

    // Clear previous timeout
    if (checkTimeout) {
        clearTimeout(checkTimeout);
    }

    // Reset UI
    input.classList.remove('valid', 'error');
    const gameInfo = document.getElementById('game-info');
    if (gameInfo) {
        gameInfo.classList.remove('show');
    }

    // Check if complete
    if (value.length === 6) {
        checkTimeout = setTimeout(() => {
            checkGameExists(value);
        }, 800);
    }

    validateForm();
}

/**
 * P0 FIX: Check if game exists with server validation
 */
async function checkGameExists(gameCode) {
    const input = document.getElementById('game-code');
    if (!input) return;

    try {
        console.log(`🔍 Checking game: ${gameCode}`);

        // P0 FIX: Check Firebase connection
        if (!firebaseService || !firebaseService.isReady) {
            throw new Error('Keine Firebase-Verbindung');
        }

        // P0 FIX: Validate game code format
        if (!/^[A-Z0-9]{6}$/.test(gameCode)) {
            throw new Error('Ungültiges Code-Format');
        }

        // Query Firebase
        const gameRef = firebase.database().ref(`games/${gameCode}`);
        const snapshot = await gameRef.once('value');

        if (!snapshot.exists()) {
            throw new Error('Spiel nicht gefunden');
        }

        const gameData = snapshot.val();

        // P0 FIX: Validate game state
        if (gameData.gameState === 'finished') {
            throw new Error('Spiel bereits beendet');
        }

        if (gameData.gameState === 'playing') {
            throw new Error('Spiel läuft bereits');
        }

        // P1 FIX: Check FSK restrictions
        const categories = gameData.categories || gameData.selectedCategories || [];
        const hasFSK18 = categories.includes('fsk18');

        if (hasFSK18 && gameState && !gameState.canAccessFSK('fsk18')) {
            throw new Error('Du musst mindestens 18 Jahre alt sein für dieses Spiel');
        }

        // P1 FIX: Check max players
        const playerCount = gameData.players ? Object.keys(gameData.players).length : 0;
        const maxPlayers = gameData.maxPlayers || 8;

        if (playerCount >= maxPlayers) {
            throw new Error(`Spiel ist voll (${maxPlayers}/${maxPlayers})`);
        }

        // Success
        currentGameData = gameData;
        displayGameInfo(gameData);
        input.classList.add('valid');
        showNotification('Spiel gefunden!', 'success');

    } catch (error) {
        console.error('❌ Check failed:', error.message);
        input.classList.add('error');
        showNotification(error.message, 'error');
        currentGameData = null;
    }

    validateForm();
}

/**
 * Display game information
 */
function displayGameInfo(gameData) {
    const infoDiv = document.getElementById('game-info');
    if (!infoDiv) return;

    console.log('📊 Displaying game info');

    // P0 FIX: Use textContent instead of innerHTML
    const setTextSafe = (id, text) => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.textContent = text || '-';
        }
    };

    // Host
    const hostPlayer = Object.values(gameData.players || {}).find(p => p.isHost);
    const hostName = hostPlayer ? hostPlayer.name : 'Unbekannt';
    setTextSafe('info-host', hostName);

    // Difficulty
    const difficultyText = difficultyNames[gameData.difficulty] || 'Standard';
    setTextSafe('info-difficulty', difficultyText);

    // Players
    const playerCount = gameData.players ? Object.keys(gameData.players).length : 0;
    const maxPlayers = gameData.maxPlayers || 8;
    setTextSafe('info-players', `${playerCount}/${maxPlayers}`);

    // Categories
    const categoriesArray = gameData.categories || gameData.selectedCategories || [];
    const categories = categoriesArray
        .map(cat => categoryData[cat]?.icon || '❓')
        .join(' ');
    setTextSafe('info-categories', categories || '-');

    // Status
    const statusNames = {
        waiting: 'Wartet',
        lobby: 'Lobby',
        playing: 'Läuft',
        finished: 'Beendet'
    };
    setTextSafe('info-status', statusNames[gameData.gameState] || 'Lobby');

    infoDiv.classList.add('show');
}

/**
 * Validate form inputs
 */
function validateForm() {
    const gameCodeInput = document.getElementById('game-code');
    const playerNameInput = document.getElementById('player-name');
    const joinBtn = document.getElementById('join-btn');

    if (!gameCodeInput || !playerNameInput || !joinBtn) return;

    const gameCode = gameCodeInput.value;
    const playerName = playerNameInput.value.trim();

    // P0 FIX: Strict validation
    const isValid =
        /^[A-Z0-9]{6}$/.test(gameCode) &&
        playerName.length >= 2 &&
        playerName.length <= 20 &&
        currentGameData !== null &&
        firebaseService &&
        firebaseService.isReady;

    joinBtn.disabled = !isValid;
    joinBtn.setAttribute('aria-disabled', !isValid);
}

// ===========================
// JOIN GAME
// ===========================

/**
 * P0 FIX: Join game with validation
 */
async function joinGame() {
    const gameCodeInput = document.getElementById('game-code');
    const playerNameInput = document.getElementById('player-name');

    if (!gameCodeInput || !playerNameInput) return;

    const gameCode = gameCodeInput.value.toUpperCase();
    const playerName = playerNameInput.value.trim();

    // P0 FIX: Validate inputs
    if (!currentGameData) {
        showNotification('Spiel-Code ungültig', 'error');
        return;
    }

    // P0 FIX: Validate player name with utils
    const nameValidation = typeof window.NocapUtils !== 'undefined'
        ? window.NocapUtils.validatePlayerName(playerName)
        : { valid: playerName.length >= 2 && playerName.length <= 20, name: playerName };

    if (!nameValidation.valid) {
        showNotification(nameValidation.message || 'Ungültiger Name', 'error');
        return;
    }

    if (!firebaseService || !firebaseService.isReady) {
        showNotification('Firebase nicht verbunden', 'error');
        return;
    }

    console.log(`🔗 Joining: ${gameCode} as ${nameValidation.name}`);
    showLoading();

    try {
        // P0 FIX: Use firebaseService.joinGame (with sanitization)
        const result = await firebaseService.joinGame(gameCode, nameValidation.name);

        console.log('✅ Successfully joined!');

        // Setup game state
        gameState.gameId = gameCode;
        gameState.playerId = result.playerId;
        gameState.playerName = nameValidation.name;
        gameState.deviceMode = 'multi';
        gameState.isHost = false;
        gameState.isGuest = true;
        gameState.selectedCategories = result.gameData.categories || result.gameData.selectedCategories || [];
        gameState.difficulty = result.gameData.difficulty || 'medium';
        gameState.gamePhase = 'lobby';
        gameState.save();

        console.log('✅ Game state saved');

        hideLoading();
        showNotification('Erfolgreich beigetreten!', 'success');

        // Redirect to lobby
        setTimeout(() => {
            window.location.href = 'multiplayer-lobby.html';
        }, 1500);

    } catch (error) {
        console.error('❌ Join failed:', error);
        hideLoading();

        // P0 FIX: User-friendly error messages
        const errorMessage = error.message.includes('bereits vergeben')
            ? 'Dieser Name ist bereits vergeben'
            : error.message.includes('voll')
                ? 'Das Spiel ist bereits voll'
                : error.message.includes('gestartet')
                    ? 'Das Spiel wurde bereits gestartet'
                    : 'Fehler beim Beitreten';

        showNotification(errorMessage, 'error');
    }
}

/**
 * Go back to home
 */
function goBack() {
    window.location.href = 'index.html';
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
 * P0 FIX: Safe notification function
 */
function showNotification(message, type = 'info') {
    // Use NocapUtils if available
    if (typeof window.NocapUtils !== 'undefined' && window.NocapUtils.showNotification) {
        window.NocapUtils.showNotification(message, type);
        return;
    }

    // Fallback
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.className = `notification ${type} show`;

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// ===========================
// CLEANUP
// ===========================

window.addEventListener('beforeunload', () => {
    if (checkTimeout) {
        clearTimeout(checkTimeout);
    }
});

// ===========================
// INITIALIZATION
// ===========================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}