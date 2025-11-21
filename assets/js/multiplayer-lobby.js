// ===== NO-CAP MULTIPLAYER LOBBY =====
// Version: 4.1 - Security Hardened with XSS Protection & Encoding Fixed
// Alle Scripts ausgelagert, XSS-gesichert, mit Reconnect-Logik

(function() {
    'use strict';

    // SECURITY NOTE: XSS Protection Review
    // - Line ~727: innerHTML with DOMPurify.sanitize() - SAFE
    // - Line ~763: innerHTML = '' (clearing) - SAFE
    // - Line ~835: innerHTML with static content - SAFE
    // - All player names: textContent only (XSS-SAFE)

    // ===== AGE-GATE GUARD =====
    function checkAgeVerification() {
        const verification = localStorage.getItem('nocap_age_verification');

        if (!verification) {
            console.log('Keine Age-Verification gefunden → Redirect');
            window.location.href = '/index.html';
            return false;
        }

        try {
            const data = JSON.parse(verification);
            const ageMs = Date.now() - new Date(data.timestamp).getTime();
            const ageHours = ageMs / (1000 * 60 * 60);

            if (ageHours > 168) { // 7 Tage
                console.log('Age-Verification abgelaufen');
                localStorage.removeItem('nocap_age_verification');
                window.location.href = '/index.html';
                return false;
            }

            const gameState = new GameState();
            if (gameState.selectedCategories && gameState.selectedCategories.includes('fsk18')) {
                if (!data.isAdult) {
                    console.log('FSK-18-Inhalte nur für Erwachsene!');
                    alert('FSK-18-Inhalte sind nur für Erwachsene zugänglich!');
                    window.location.href = '/index.html';
                    return false;
                }
            }

            console.log('Age-Verification erfolgreich');
            return true;

        } catch (error) {
            console.error('Age-Verification Fehler:', error);
            window.location.href = '/index.html';
            return false;
        }
    }

    // ===== FIREBASE SERVICE CLASS =====
    class FirebaseGameService {
        constructor() {
            this.app = null;
            this.database = null;
            this.auth = null;
            this.isInitialized = false;
            this.isConnected = false;
            this.currentGameId = null;
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
                this.log('🔥 Firebase Service initialisieren...');

                if (typeof firebase === 'undefined') {
                    throw new Error('Firebase SDK nicht geladen');
                }

                if (!firebase.apps || firebase.apps.length === 0) {
                    this.app = firebase.initializeApp(this.config);
                } else {
                    this.app = firebase.app();
                }

                this.auth = firebase.auth();

                try {
                    await this.auth.signInAnonymously();
                    this.log('✅ Anonym angemeldet');
                } catch (authError) {
                    this.log(`❌ Auth Fehler: ${authError.message}`, 'error');
                    throw authError;
                }

                this.database = firebase.database();

                const connectedRef = this.database.ref('.info/connected');
                const snapshot = await connectedRef.once('value');
                this.isConnected = snapshot.val() === true;
                this.isInitialized = true;

                this.log(`✅ Firebase ${this.isConnected ? 'verbunden' : 'initialisiert'}`);
                return true;

            } catch (error) {
                this.log(`❌ Firebase Fehler: ${error.message}`, 'error');
                this.isInitialized = false;
                this.isConnected = false;
                return false;
            }
        }

        async createGame(hostName, settings) {
            if (!this.isConnected) throw new Error('Nicht verbunden');

            const gameId = this.generateGameCode();
            const userId = this.auth.currentUser?.uid;

            const gameData = {
                gameId,
                hostId: userId,
                settings: settings || {},
                players: {
                    [userId]: {
                        id: userId,
                        name: hostName,
                        isHost: true,
                        isReady: false,
                        joinedAt: Date.now()
                    }
                },
                status: 'lobby',
                createdAt: Date.now(),
                lastActivity: Date.now()
            };

            await this.database.ref(`games/${gameId}`).set(gameData);
            this.currentGameId = gameId;
            this.log(`✅ Spiel erstellt: ${gameId}`);

            return gameId;
        }

        async joinGame(gameId, playerName) {
            if (!this.isConnected) throw new Error('Nicht verbunden');

            const userId = this.auth.currentUser?.uid;
            const gameRef = this.database.ref(`games/${gameId}`);
            const snapshot = await gameRef.once('value');

            if (!snapshot.exists()) {
                throw new Error('Spiel nicht gefunden');
            }

            const game = snapshot.val();

            if (game.status !== 'lobby') {
                throw new Error('Spiel bereits gestartet');
            }

            const playerCount = Object.keys(game.players || {}).length;
            if (playerCount >= 8) {
                throw new Error('Spiel ist voll');
            }

            await gameRef.child(`players/${userId}`).set({
                id: userId,
                name: playerName,
                isHost: false,
                isReady: false,
                joinedAt: Date.now()
            });

            this.currentGameId = gameId;
            this.log(`✅ Spiel beigetreten: ${gameId}`);

            return gameId;
        }

        listenToGameUpdates(gameId, callback) {
            const gameRef = this.database.ref(`games/${gameId}`);
            const listener = gameRef.on('value', snapshot => {
                if (snapshot.exists()) {
                    callback(snapshot.val());
                }
            });

            this.listeners.push(() => gameRef.off('value', listener));
            return () => gameRef.off('value', listener);
        }

        async updatePlayerReady(gameId, playerId, isReady) {
            await this.database.ref(`games/${gameId}/players/${playerId}/isReady`).set(isReady);
        }

        async startGame(gameId) {
            await this.database.ref(`games/${gameId}/status`).set('playing');
            await this.database.ref(`games/${gameId}/startedAt`).set(Date.now());
        }

        async leaveGame(gameId, playerId) {
            await this.database.ref(`games/${gameId}/players/${playerId}`).remove();
        }

        generateGameCode() {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let code = '';
            for (let i = 0; i < 6; i++) {
                code += chars[Math.floor(Math.random() * chars.length)];
            }
            return code;
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

    // ===== INITIALIZATION =====
    async function init() {
        log('🎮 Initializing multiplayer lobby...');

        if (!checkAgeVerification()) return;

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

        firebaseService = new FirebaseGameService();
        const connected = await firebaseService.initialize();

        if (!connected) {
            showNotification('Firebase Verbindung fehlgeschlagen', 'error');
            setTimeout(() => window.location.href = 'index.html', 3000);
            return;
        }

        currentUserId = firebaseService.auth.currentUser?.uid;

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

        log('✅ Lobby initialized');
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

            const settings = {
                categories: gameState.selectedCategories || [],
                difficulty: gameState.difficulty || 'medium'
            };

            currentGameId = await firebaseService.createGame(gameState.playerName, settings);

            gameState.gameId = currentGameId;
            gameState.isHost = true;
            gameState.save();

            displayGameCode(currentGameId);
            displayQRCode(currentGameId);
            displaySettings();

            firebaseService.listenToGameUpdates(currentGameId, handleGameUpdate);

            showNotification('Spiel erstellt!', 'success');
            log(`✅ Game created: ${currentGameId}`);

        } catch (error) {
            log(`❌ Create game error: ${error.message}`, 'error');
            showNotification('Fehler beim Erstellen', 'error');
        }
    }

    async function loadExistingGame() {
        try {
            showNotification('Lade Spiel...', 'info');

            const gameRef = firebaseService.database.ref(`games/${currentGameId}`);
            const snapshot = await gameRef.once('value');

            if (!snapshot.exists()) {
                throw new Error('Spiel nicht gefunden');
            }

            const game = snapshot.val();

            displayGameCode(currentGameId);
            displayQRCode(currentGameId);
            displaySettings(game.settings);

            firebaseService.listenToGameUpdates(currentGameId, handleGameUpdate);

            showNotification('Spiel geladen!', 'success');
            log(`✅ Game loaded: ${currentGameId}`);

        } catch (error) {
            log(`❌ Load game error: ${error.message}`, 'error');
            showNotification('Fehler beim Laden', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
        }
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

    function displaySettings(settings) {
        if (!settings) {
            settings = {
                categories: gameState.selectedCategories || [],
                difficulty: gameState.difficulty || 'medium'
            };
        }

        const categoriesDisplay = document.getElementById('selected-categories-display');
        if (categoriesDisplay && settings.categories) {
            const categoriesHTML = settings.categories.map(cat => {
                const icon = categoryIcons[cat] || '❓';
                const name = categoryNames[cat] || cat;
                return `<div class="category-tag"><span>${icon}</span><span>${name}</span></div>`;
            }).join('');

            // SECURITY: DOMPurify.sanitize() protects dynamic content
            if (typeof DOMPurify !== 'undefined') {
                categoriesDisplay.innerHTML = DOMPurify.sanitize(categoriesHTML, {
                    ALLOWED_TAGS: ['div', 'span'],
                    ALLOWED_ATTR: ['class']
                });
            } else {
                categoriesDisplay.innerHTML = '<span style="color: rgba(255,255,255,0.5);">Lädt...</span>';
            }
        }

        const difficultyDisplay = document.getElementById('difficulty-display');
        if (difficultyDisplay && settings.difficulty) {
            const diffNames = { easy: 'Entspannt', medium: 'Normal', hard: 'Hardcore' };
            difficultyDisplay.textContent = diffNames[settings.difficulty] || settings.difficulty;
        }
    }

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
            // XSS-SCHUTZ: Erstelle Elemente mit textContent statt innerHTML
            playersList.innerHTML = ''; // Leeren

            playersArray.forEach(player => {
                const playerItem = document.createElement('div');
                playerItem.className = 'player-item';
                if (player.isHost) playerItem.classList.add('host');
                if (player.isReady) playerItem.classList.add('ready');

                const avatar = document.createElement('div');
                avatar.className = 'player-avatar';
                avatar.textContent = player.name.charAt(0).toUpperCase();

                const info = document.createElement('div');
                info.className = 'player-info';

                const name = document.createElement('div');
                name.className = 'player-name';
                name.textContent = player.name;

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
                    kickBtn.onclick = () => kickPlayer(player.id);
                    playerItem.appendChild(kickBtn);
                }

                playersList.appendChild(playerItem);
            });
        }
    }

    function displayEmptyPlayers() {
        const playersList = document.getElementById('players-list');
        const playerCount = document.getElementById('player-count');

        if (playerCount) playerCount.textContent = '0/8 Spieler';
        if (playersList) {
            playersList.innerHTML = `
                <div class="empty-players">
                    Warte auf Spieler...
                </div>
            `;
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
            startBtn.textContent = 'Spiel starten';
        } else {
            startBtn.disabled = true;
            startBtn.classList.remove('enabled');
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

            await firebaseService.updatePlayerReady(currentGameId, currentUserId, newStatus);

            gameState.isReady = newStatus;
            gameState.save();

            const readyBtn = document.getElementById('ready-btn');
            if (readyBtn) {
                readyBtn.textContent = newStatus ? '✅ Bereit' : 'Bereit?';
                readyBtn.classList.toggle('ready', newStatus);
            }

            showNotification(newStatus ? 'Du bist bereit!' : 'Status zurückgesetzt', 'success');

        } catch (error) {
            log(`❌ Ready toggle error: ${error.message}`, 'error');
            showNotification('Fehler beim Aktualisieren', 'error');
        }
    }

    async function startGame() {
        if (!isHost) return;

        try {
            showNotification('Starte Spiel...', 'info');

            await firebaseService.startGame(currentGameId);

            gameState.gamePhase = 'playing';
            gameState.save();

            showNotification('Spiel gestartet!', 'success');

            setTimeout(() => {
                window.location.href = 'multiplayer-gameplay.html';
            }, 1000);

        } catch (error) {
            log(`❌ Start game error: ${error.message}`, 'error');
            showNotification('Fehler beim Starten', 'error');
        }
    }

    async function kickPlayer(playerId) {
        if (!isHost || !confirm('Spieler wirklich kicken?')) return;

        try {
            await firebaseService.leaveGame(currentGameId, playerId);
            showNotification('Spieler entfernt', 'success');
        } catch (error) {
            log(`❌ Kick error: ${error.message}`, 'error');
            showNotification('Fehler beim Entfernen', 'error');
        }
    }

    async function leaveGame() {
        if (!confirm('Lobby wirklich verlassen?')) return;

        try {
            if (currentGameId && currentUserId) {
                await firebaseService.leaveGame(currentGameId, currentUserId);
            }

            firebaseService.cleanup();
            gameState.gameId = null;
            gameState.isHost = false;
            gameState.save();

            window.location.href = 'index.html';

        } catch (error) {
            log(`❌ Leave error: ${error.message}`, 'error');
            window.location.href = 'index.html';
        }
    }

    // ===== EVENT LISTENERS =====
    function setupEventListeners() {
        const startBtn = document.getElementById('start-btn');
        const readyBtn = document.getElementById('ready-btn');
        const leaveBtn = document.getElementById('leave-btn');
        const copyBtn = document.getElementById('copy-code-btn');

        if (startBtn) startBtn.addEventListener('click', startGame);
        if (readyBtn) readyBtn.addEventListener('click', toggleReady);
        if (leaveBtn) leaveBtn.addEventListener('click', leaveGame);
        if (copyBtn) copyBtn.addEventListener('click', copyGameCode);

        window.addEventListener('beforeunload', () => {
            if (firebaseService) {
                firebaseService.cleanup();
            }
        });

        log('✅ Event listeners setup');
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
        console.log(`%c[MultiLobby] ${message}`, `color: ${colors[type] || colors.info}`);
    }

    // ===== INIT =====
    document.addEventListener('DOMContentLoaded', init);

    log('✅ Multiplayer Lobby v4.1 - Loaded!');

})();