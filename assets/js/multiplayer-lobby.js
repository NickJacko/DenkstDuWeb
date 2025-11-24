// ===== NO-CAP MULTIPLAYER LOBBY =====
// Version: 4.2 - Security Hardened & Production Ready

'use strict';

// ===== P0 FIX: AGE-GATE GUARD WITH 24H EXPIRATION =====

/**
 * P0 FIX: Check age verification with 24h expiration
 */
function checkAgeVerification() {
    const ageLevel = parseInt(localStorage.getItem('nocap_age_level')) || 0;
    const ageTimestamp = parseInt(localStorage.getItem('nocap_age_timestamp')) || 0;
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (now - ageTimestamp > maxAge) {
        console.log('❌ Age verification expired');
        localStorage.removeItem('nocap_age_level');
        localStorage.removeItem('nocap_age_timestamp');
        window.location.href = 'index.html';
        return false;
    }

    // P0 FIX: Validate FSK access
    const gameState = new GameState();
    if (gameState.selectedCategories && gameState.selectedCategories.length > 0) {
        const hasInvalidCategory = gameState.selectedCategories.some(cat => {
            if (cat === 'fsk18' && ageLevel < 18) return true;
            if (cat === 'fsk16' && ageLevel < 16) return true;
            return false;
        });

        if (hasInvalidCategory) {
            console.log('❌ FSK-18 requires adult verification');
            alert('Diese Inhalte sind nur für dein Alter freigegeben!');
            window.location.href = 'index.html';
            return false;
        }
    }

    console.log('✅ Age verification valid');
    return true;
}

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
    special: 'Special'
};

// ===== GLOBAL STATE =====
let gameState = null;
let firebaseService = null;
let currentGameId = null;
let isHost = false;
let currentUserId = null;

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

/**
 * Sanitize player name
 */
function sanitizePlayerName(name) {
    if (!name) return 'Spieler';

    if (typeof window.NocapUtils !== 'undefined' && window.NocapUtils.sanitizeInput) {
        return window.NocapUtils.sanitizeInput(String(name)).substring(0, 20);
    }

    return String(name).replace(/<[^>]*>/g, '').substring(0, 20);
}

// ===== INITIALIZATION =====

async function initialize() {
    console.log('🎮 Initializing multiplayer lobby...');

    // P0 FIX: Check age verification first
    if (!checkAgeVerification()) {
        return;
    }

    // Check dependencies
    if (typeof GameState === 'undefined') {
        showNotification('Fehler: GameState nicht gefunden', 'error');
        return;
    }

    gameState = new GameState();

    if (!validateGameState()) {
        return;
    }

    // P0 FIX: Use global firebaseGameService
    if (typeof window.firebaseGameService !== 'undefined') {
        firebaseService = window.firebaseGameService;
    } else {
        console.error('❌ Firebase service not available');
        showNotification('Firebase nicht verfügbar', 'error');
        setTimeout(() => window.location.href = 'index.html', 3000);
        return;
    }

    currentUserId = firebase.auth().currentUser?.uid;

    if (gameState.gameId) {
        currentGameId = gameState.gameId;
        isHost = gameState.isHost || false;
        await loadExistingGame();
    } else if (gameState.isHost) {
        isHost = true;
        await createNewGame();
    } else {
        showNotification('Keine Game-ID gefunden', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }

    setupEventListeners();
    updateUIForRole();

    console.log('✅ Lobby initialized');
}

// ===== VALIDATION =====

function validateGameState() {
    if (!gameState || gameState.deviceMode !== 'multi') {
        showNotification('Falscher Spielmodus', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }

    if (!gameState.playerName) {
        showNotification('Kein Spielername gesetzt', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }

    return true;
}

// ===== GAME MANAGEMENT =====

async function createNewGame() {
    try {
        showNotification('Erstelle Spiel...', 'info');

        // P0 FIX: Generate game code locally
        const gameId = generateGameCode();
        currentGameId = gameId;

        const settings = {
            categories: gameState.selectedCategories || [],
            difficulty: gameState.difficulty || 'medium'
        };

        const gameData = {
            gameId: gameId,
            hostId: currentUserId,
            settings: settings,
            players: {
                [currentUserId]: {
                    id: currentUserId,
                    name: sanitizePlayerName(gameState.playerName),
                    isHost: true,
                    isReady: false,
                    joinedAt: Date.now()
                }
            },
            status: 'lobby',
            createdAt: Date.now(),
            lastActivity: Date.now()
        };

        const gameRef = firebase.database().ref(`games/${gameId}`);
        await gameRef.set(gameData);

        gameState.gameId = gameId;
        gameState.isHost = true;
        gameState.save();

        displayGameCode(gameId);
        displayQRCode(gameId);
        displaySettings(settings);

        setupGameListener(gameId);

        showNotification('Spiel erstellt!', 'success');
        console.log(`✅ Game created: ${gameId}`);

    } catch (error) {
        console.error('❌ Create game error:', error);
        showNotification('Fehler beim Erstellen', 'error');
    }
}

async function loadExistingGame() {
    try {
        showNotification('Lade Spiel...', 'info');

        const gameRef = firebase.database().ref(`games/${currentGameId}`);
        const snapshot = await gameRef.once('value');

        if (!snapshot.exists()) {
            throw new Error('Spiel nicht gefunden');
        }

        const game = snapshot.val();

        displayGameCode(currentGameId);
        displayQRCode(currentGameId);
        displaySettings(game.settings);

        setupGameListener(currentGameId);

        showNotification('Spiel geladen!', 'success');
        console.log(`✅ Game loaded: ${currentGameId}`);

    } catch (error) {
        console.error('❌ Load game error:', error);
        showNotification('Fehler beim Laden', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
    }
}

/**
 * Setup Firebase game listener
 */
function setupGameListener(gameId) {
    const gameRef = firebase.database().ref(`games/${gameId}`);

    gameRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            handleGameUpdate(snapshot.val());
        }
    });
}

function handleGameUpdate(gameData) {
    if (!gameData) return;

    updatePlayersList(gameData.players);
    updateStartButton(gameData.players);

    if (gameData.status === 'playing' && !isHost) {
        showNotification('Spiel startet!', 'success');
        setTimeout(() => {
            window.location.href = 'multiplayer-gameplay.html';
        }, 1000);
    }
}

// ===== DISPLAY FUNCTIONS =====

function displayGameCode(gameId) {
    const codeDisplay = document.getElementById('game-code-display');
    if (codeDisplay) {
        codeDisplay.textContent = gameId;
    }
}

function displayQRCode(gameId) {
    const qrContainer = document.getElementById('qr-code');
    if (qrContainer && typeof QRCode !== 'undefined') {
        qrContainer.innerHTML = '';
        const joinUrl = `${window.location.origin}/join-game.html?code=${gameId}`;
        new QRCode(qrContainer, {
            text: joinUrl,
            width: 200,
            height: 200
        });
    }
}

/**
 * P0 FIX: Display settings with textContent only
 */
function displaySettings(settings) {
    if (!settings) {
        settings = {
            categories: gameState.selectedCategories || [],
            difficulty: gameState.difficulty || 'medium'
        };
    }

    const categoriesDisplay = document.getElementById('selected-categories-display');
    if (categoriesDisplay && settings.categories) {
        // P0 FIX: Build with DOM elements instead of innerHTML
        categoriesDisplay.innerHTML = '';

        settings.categories.forEach(cat => {
            const icon = categoryIcons[cat] || '❓';
            const name = categoryNames[cat] || cat;

            const tagDiv = document.createElement('div');
            tagDiv.className = 'category-tag';

            const iconSpan = document.createElement('span');
            iconSpan.textContent = icon;

            const nameSpan = document.createElement('span');
            nameSpan.textContent = name;

            tagDiv.appendChild(iconSpan);
            tagDiv.appendChild(nameSpan);

            categoriesDisplay.appendChild(tagDiv);
        });
    }

    const difficultyDisplay = document.getElementById('difficulty-display');
    if (difficultyDisplay && settings.difficulty) {
        const diffNames = { easy: 'Entspannt', medium: 'Normal', hard: 'Hardcore' };
        difficultyDisplay.textContent = diffNames[settings.difficulty] || settings.difficulty;
    }
}

/**
 * P0 FIX: Update players list with textContent only
 */
function updatePlayersList(players) {
    const playersList = document.getElementById('players-list');
    const playerCount = document.getElementById('player-count');

    if (!players || Object.keys(players).length === 0) {
        displayEmptyPlayers();
        return;
    }

    const playersArray = Object.values(players);

    if (playerCount) {
        playerCount.textContent = `${playersArray.length}/8 Spieler`;
    }

    if (playersList) {
        playersList.innerHTML = '';

        playersArray.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            if (player.isHost) playerItem.classList.add('host');
            if (player.isReady) playerItem.classList.add('ready');

            const avatar = document.createElement('div');
            avatar.className = 'player-avatar';
            // P0 FIX: Sanitize player name
            avatar.textContent = sanitizePlayerName(player.name).charAt(0).toUpperCase();

            const info = document.createElement('div');
            info.className = 'player-info';

            const name = document.createElement('div');
            name.className = 'player-name';
            // P0 FIX: Sanitize player name
            name.textContent = sanitizePlayerName(player.name);

            const status = document.createElement('div');
            status.className = 'player-status';
            status.textContent = player.isHost ? '👑 Host' : (player.isReady ? '✅ Bereit' : '⏳ Wartet...');

            info.appendChild(name);
            info.appendChild(status);

            playerItem.appendChild(avatar);
            playerItem.appendChild(info);

            if (isHost && !player.isHost) {
                const kickBtn = document.createElement('button');
                kickBtn.className = 'kick-btn';
                kickBtn.textContent = '✕';
                kickBtn.setAttribute('aria-label', `${sanitizePlayerName(player.name)} entfernen`);
                kickBtn.addEventListener('click', () => kickPlayer(player.id));
                playerItem.appendChild(kickBtn);
            }

            playersList.appendChild(playerItem);
        });
    }
}

function displayEmptyPlayers() {
    const playersList = document.getElementById('players-list');
    const playerCount = document.getElementById('player-count');

    if (playerCount) {
        playerCount.textContent = '0/8 Spieler';
    }

    if (playersList) {
        playersList.innerHTML = '';

        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-players';
        emptyDiv.textContent = 'Warte auf Spieler...';

        playersList.appendChild(emptyDiv);
    }
}

function updateStartButton(players) {
    const startBtn = document.getElementById('start-btn');
    if (!startBtn) return;

    if (!isHost) {
        startBtn.style.display = 'none';
        return;
    }

    startBtn.style.display = 'block';

    const playersArray = Object.values(players || {});
    const readyCount = playersArray.filter(p => p.isReady || p.isHost).length;

    if (playersArray.length >= 2 && readyCount === playersArray.length) {
        startBtn.disabled = false;
        startBtn.classList.add('enabled');
        startBtn.setAttribute('aria-disabled', 'false');
        startBtn.textContent = 'Spiel starten';
    } else {
        startBtn.disabled = true;
        startBtn.classList.remove('enabled');
        startBtn.setAttribute('aria-disabled', 'true');
        startBtn.textContent = `Warte auf Spieler (${readyCount}/${playersArray.length} bereit)`;
    }
}

function updateUIForRole() {
    const hostControls = document.querySelectorAll('.host-only');
    hostControls.forEach(el => {
        el.style.display = isHost ? 'block' : 'none';
    });

    const readyBtn = document.getElementById('ready-btn');
    if (readyBtn) {
        readyBtn.style.display = isHost ? 'none' : 'block';
    }
}

// ===== ACTIONS =====

async function toggleReady() {
    if (isHost) return;

    try {
        const currentStatus = gameState.isReady || false;
        const newStatus = !currentStatus;

        const playerRef = firebase.database().ref(`games/${currentGameId}/players/${currentUserId}/isReady`);
        await playerRef.set(newStatus);

        gameState.isReady = newStatus;
        gameState.save();

        const readyBtn = document.getElementById('ready-btn');
        if (readyBtn) {
            readyBtn.textContent = newStatus ? '✅ Bereit' : 'Bereit?';
            readyBtn.classList.toggle('ready', newStatus);
        }

        showNotification(newStatus ? 'Du bist bereit!' : 'Status zurückgesetzt', 'success');

    } catch (error) {
        console.error('❌ Ready toggle error:', error);
        showNotification('Fehler beim Aktualisieren', 'error');
    }
}

async function startGame() {
    if (!isHost) return;

    try {
        showNotification('Starte Spiel...', 'info');

        const gameRef = firebase.database().ref(`games/${currentGameId}`);
        await gameRef.update({
            status: 'playing',
            startedAt: Date.now()
        });

        gameState.gamePhase = 'playing';
        gameState.save();

        showNotification('Spiel gestartet!', 'success');

        setTimeout(() => {
            window.location.href = 'multiplayer-gameplay.html';
        }, 1000);

    } catch (error) {
        console.error('❌ Start game error:', error);
        showNotification('Fehler beim Starten', 'error');
    }
}

async function kickPlayer(playerId) {
    if (!isHost || !confirm('Spieler wirklich kicken?')) return;

    try {
        const playerRef = firebase.database().ref(`games/${currentGameId}/players/${playerId}`);
        await playerRef.remove();

        showNotification('Spieler entfernt', 'success');
    } catch (error) {
        console.error('❌ Kick error:', error);
        showNotification('Fehler beim Entfernen', 'error');
    }
}

async function leaveGame() {
    if (!confirm('Lobby wirklich verlassen?')) return;

    try {
        if (currentGameId && currentUserId) {
            const playerRef = firebase.database().ref(`games/${currentGameId}/players/${currentUserId}`);
            await playerRef.remove();
        }

        cleanup();
        gameState.gameId = null;
        gameState.isHost = false;
        gameState.save();

        window.location.href = 'index.html';

    } catch (error) {
        console.error('❌ Leave error:', error);
        window.location.href = 'index.html';
    }
}

// ===== EVENT LISTENERS =====

function setupEventListeners() {
    const startBtn = document.getElementById('start-btn');
    const readyBtn = document.getElementById('ready-btn');
    const leaveBtn = document.getElementById('leave-btn');
    const copyBtn = document.getElementById('copy-code-btn');

    if (startBtn) {
        startBtn.addEventListener('click', startGame);
    }
    if (readyBtn) {
        readyBtn.addEventListener('click', toggleReady);
    }
    if (leaveBtn) {
        leaveBtn.addEventListener('click', leaveGame);
    }
    if (copyBtn) {
        copyBtn.addEventListener('click', copyGameCode);
    }

    window.addEventListener('beforeunload', cleanup);

    console.log('✅ Event listeners setup');
}

function copyGameCode() {
    const code = document.getElementById('game-code-display')?.textContent;
    if (!code) return;

    navigator.clipboard.writeText(code).then(() => {
        showNotification('Code kopiert!', 'success');
    }).catch(() => {
        showNotification('Kopieren fehlgeschlagen', 'error');
    });
}

// ===== UTILITIES =====

/**
 * Generate game code locally
 */
function generateGameCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
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

/**
 * Cleanup Firebase listeners
 */
function cleanup() {
    if (currentGameId) {
        try {
            const gameRef = firebase.database().ref(`games/${currentGameId}`);
            gameRef.off();
        } catch (error) {
            console.error('❌ Cleanup error:', error);
        }
    }
}

// ===== INITIALIZATION =====

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

console.log('✅ Multiplayer Lobby v4.2 - Production Ready!');