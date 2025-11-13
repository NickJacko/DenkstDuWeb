// ===== NO-CAP MULTIPLAYER LOBBY =====
// Version: 4.0 (Refactored & Secured)
// Alle Scripts ausgelagert, XSS-gesichert, mit Reconnect-Logik

(function() {
    'use strict';

    // ===== AGE-GATE GUARD =====
    function checkAgeVerification() {
        const verification = localStorage.getItem('nocap_age_verification');

        if (!verification) {
            console.log('âŒ Keine Age-Verification gefunden â†’ Redirect');
            window.location.href = '/index.html';
            return false;
        }

        try {
            const data = JSON.parse(verification);
            const ageMs = Date.now() - new Date(data.timestamp).getTime();
            const ageHours = ageMs / (1000 * 60 * 60);

            if (ageHours > 168) { // 7 Tage
                console.log('âš ï¸ Age-Verification abgelaufen');
                localStorage.removeItem('nocap_age_verification');
                window.location.href = '/index.html';
                return false;
            }

            const gameState = new GameState();
            if (gameState.selectedCategories && gameState.selectedCategories.includes('fsk18')) {
                if (!data.isAdult) {
                    console.log('âŒ FSK-18-Inhalte nur fÃ¼r Erwachsene!');
                    alert('âš ï¸ FSK-18-Inhalte sind nur fÃ¼r Erwachsene zugÃ¤nglich!');
                    window.location.href = '/index.html';
                    return false;
                }
            }

            console.log('âœ… Age-Verification erfolgreich');
            return true;

        } catch (error) {
            console.error('âŒ Age-Verification Fehler:', error);
            window.location.href = '/index.html';
            return false;
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
                this.log('ðŸ”¥ Firebase Service - Initialisierung...');

                if (typeof firebase === 'undefined') {
                    throw new Error('Firebase SDK nicht geladen');
                }

                if (!firebase.apps || firebase.apps.length === 0) {
                    this.app = firebase.initializeApp(this.config);
                } else {
                    this.app = firebase.app();
                }

                this.log('ðŸ” Starte anonyme Authentifizierung...');
                this.auth = firebase.auth();

                try {
                    await this.auth.signInAnonymously();
                    this.log('âœ… Anonym angemeldet');
                } catch (authError) {
                    this.log(`âŒ Auth Fehler: ${authError.message}`, 'error');
                    throw authError;
                }

                this.database = firebase.database();
                this.log('ðŸ”— Warte auf Datenbankverbindung...');

                let connected = false;
                let attempts = 0;
                const maxAttempts = 10;

                while (!connected && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 500));

                    try {
                        const connectedRef = this.database.ref('.info/connected');
                        const snapshot = await connectedRef.once('value');
                        connected = snapshot.val() === true;

                        if (connected) {
                            this.log('âœ… Datenbankverbindung hergestellt!');
                        } else {
                            attempts++;
                            this.log(`ðŸ”„ Verbindungsversuch ${attempts}/${maxAttempts}...`);
                        }
                    } catch (error) {
                        attempts++;
                        this.log(`âš ï¸ Verbindungsfehler (Versuch ${attempts}/${maxAttempts})`);
                    }
                }

                this.isConnected = connected;

                if (this.isConnected) {
                    this.isInitialized = true;
                    this.log('âœ… Firebase vollstÃ¤ndig verbunden und bereit!');
                } else {
                    this.log('âŒ Firebase Verbindung fehlgeschlagen');
                    this.isInitialized = false;
                }

                return this.isInitialized;

            } catch (error) {
                this.log(`âŒ Firebase Fehler: ${error.message}`, 'error');
                this.isInitialized = false;
                this.isConnected = false;
                return false;
            }
        }

        async getGameData(gameId) {
            if (!this.isConnected || !gameId) return null;

            try {
                const gameRef = this.database.ref(`games/${gameId}`);
                const snapshot = await gameRef.once('value');
                return snapshot.exists() ? snapshot.val() : null;
            } catch (error) {
                this.log(`âŒ Fehler beim Laden: ${error.message}`, 'error');
                return null;
            }
        }

        setupGameListener(gameId, callback) {
            if (!this.isConnected || !gameId) return null;

            try {
                const gameRef = this.database.ref(`games/${gameId}`);
                const listener = gameRef.on('value', callback);
                this.listeners.push({ ref: gameRef, listener: listener });
                this.log(`âœ… Game listener setup fÃ¼r ${gameId}`);
                return listener;
            } catch (error) {
                this.log(`âŒ Fehler beim Setup: ${error.message}`, 'error');
                return null;
            }
        }

        async setPlayerOnline(gameId, playerId, online = true) {
            if (!this.isConnected) return false;

            try {
                const playerRef = this.database.ref(`games/${gameId}/players/${playerId}`);
                await playerRef.update({
                    isOnline: online,
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
                this.log(`âœ… Player ${playerId} status: ${online ? 'online' : 'offline'}`);
                return true;
            } catch (error) {
                this.log(`âŒ Fehler beim Setzen: ${error.message}`, 'error');
                return false;
            }
        }

        async startGame(gameId) {
            if (!this.isConnected) throw new Error('Keine Firebase-Verbindung');

            try {
                const gameRef = this.database.ref(`games/${gameId}`);
                await gameRef.update({
                    gameState: 'playing',
                    startedAt: firebase.database.ServerValue.TIMESTAMP,
                    lastUpdate: firebase.database.ServerValue.TIMESTAMP
                });

                this.log(`ðŸš€ Spiel gestartet: ${gameId}`);
                return true;

            } catch (error) {
                this.log(`âŒ Fehler beim Starten: ${error.message}`, 'error');
                throw error;
            }
        }

        cleanup() {
            this.log('ðŸ§¹ Cleanup...');
            this.listeners.forEach(({ ref, listener }) => {
                try {
                    ref.off('value', listener);
                } catch (error) {
                    this.log(`âŒ Listener-Fehler: ${error.message}`, 'error');
                }
            });
            this.listeners = [];
            this.currentGameId = null;
        }

        get isReady() {
            return this.isInitialized && this.isConnected;
        }

        log(message, type = 'info') {
            console.log(`[Firebase] ${message}`);
        }
    }

    // ===== RECONNECT MANAGER =====
    class ReconnectManager {
        constructor(firebaseService, gameState) {
            this.firebaseService = firebaseService;
            this.gameState = gameState;
            this.reconnectAttempts = 0;
            this.maxAttempts = 3;
            this.isReconnecting = false;
        }

        async attemptReconnect() {
            if (this.isReconnecting) return false;
            if (this.reconnectAttempts >= this.maxAttempts) {
                showNotification('Verbindung fehlgeschlagen. Bitte Seite neu laden.', 'error');
                return false;
            }

            this.isReconnecting = true;
            this.reconnectAttempts++;

            log(`ðŸ”„ Reconnect-Versuch ${this.reconnectAttempts}/${this.maxAttempts}...`);
            showNotification(`Verbinde neu... (${this.reconnectAttempts}/${this.maxAttempts})`, 'info');

            try {
                await this.firebaseService.initialize();

                if (this.gameState.gameId && this.gameState.playerId) {
                    await this.firebaseService.setPlayerOnline(
                        this.gameState.gameId,
                        this.gameState.playerId,
                        true
                    );
                }

                showNotification('âœ… Erfolgreich verbunden!', 'success');
                this.reconnectAttempts = 0;
                this.isReconnecting = false;
                return true;

            } catch (error) {
                console.error('Reconnect failed:', error);
                this.isReconnecting = false;
                await new Promise(resolve => setTimeout(resolve, 2000 * this.reconnectAttempts));
                return this.attemptReconnect();
            }
        }

        reset() {
            this.reconnectAttempts = 0;
            this.isReconnecting = false;
        }
    }

    // ===== GLOBAL VARIABLES =====
    let gameState = null;
    let firebaseService = null;
    let reconnectManager = null;
    let gameListener = null;
    let currentGameData = null;
    let shareLink = '';
    let pollingInterval = null;
    let lastPlayerCount = 0;

    // Category data
    const categoryData = {
        fsk0: {
            name: 'Familie & Freunde',
            icon: 'ðŸ‘¨â€ðŸ‘©â€ðŸ‘§â€ðŸ‘¦',
            color: '#4CAF50'
        },
        fsk16: {
            name: 'Party Time',
            icon: 'ðŸŽ‰',
            color: '#FF9800'
        },
        fsk18: {
            name: 'HeiÃŸ & Gewagt',
            icon: 'ðŸ”¥',
            color: '#F44336'
        },
        special: {
            name: 'Special Edition',
            icon: 'â­',
            color: '#FFD700'
        }
    };

    const difficultyNames = {
        easy: 'Entspannt ðŸ˜Œ',
        medium: 'Ausgewogen ðŸŽ¯',
        hard: 'Hardcore ðŸ’€'
    };

    // ===== INITIALIZATION =====
    document.addEventListener('DOMContentLoaded', function() {
        // Age-Gate prÃ¼fen ZUERST
        if (!checkAgeVerification()) {
            return;
        }

        initMultiplayerLobby();
    });

    async function initMultiplayerLobby() {
        log('ðŸŒ Multiplayer Lobby - Initialisierung gestartet...');

        try {
            gameState = new GameState();
            firebaseService = new FirebaseGameService();
            reconnectManager = new ReconnectManager(firebaseService, gameState);

            log('ðŸ“Š Initial GameState:', gameState.getDebugInfo());

            if (!validateGameState()) {
                return;
            }

            showLoading();
            await firebaseService.initialize();
            hideLoading();

            if (firebaseService.isReady) {
                log('âœ… Firebase bereit und verbunden!');

                await loadGameDataFromFirebase();
                await ensurePlayerInFirebase();
                await loadGameDataFromFirebase();

                if (currentGameData) {
                    updateGameDisplay();
                    updateHostControls();
                    generateShareLink();
                    updateFromFirebaseData(currentGameData);
                } else {
                    log('âŒ Keine Spieldaten');
                }

                await setupGameListener();
                setupConnectionMonitoring();

                if (gameState.playerId) {
                    await firebaseService.setPlayerOnline(gameState.gameId, gameState.playerId, true);
                }
            } else {
                log('âš ï¸ Firebase nicht verfÃ¼gbar - Offline-Modus');
                startLocalFallback();
            }

            setupEventListeners();
            log('âœ… Multiplayer Lobby bereit!');

        } catch (error) {
            log(`âŒ Initialisierung fehlgeschlagen: ${error.message}`, 'error');
            console.error('Init Error:', error);
            hideLoading();
            startLocalFallback();
        }
    }

    // ===== CONNECTION MONITORING =====
    function setupConnectionMonitoring() {
        if (!firebaseService.database) return;

        try {
            const connectedRef = firebaseService.database.ref('.info/connected');
            connectedRef.on('value', (snapshot) => {
                const wasConnected = firebaseService.isConnected;
                firebaseService.isConnected = snapshot.val() === true;

                if (wasConnected && !firebaseService.isConnected) {
                    log('ðŸ“¡ Verbindung verloren - starte Reconnect');
                    reconnectManager.attemptReconnect();
                } else if (!wasConnected && firebaseService.isConnected) {
                    log('ðŸ“¡ Verbindung wiederhergestellt');
                    reconnectManager.reset();
                }
            });
            log('âœ… Connection Monitoring aktiv');
        } catch (error) {
            log('âŒ Connection Monitoring Fehler:', error);
        }
    }

    // ===== EVENT LISTENERS SETUP =====
    function setupEventListeners() {
        // Settings Button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', goBack);
        }

        // Share Button
        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', showShareModal);
        }

        // Start Button
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', startGame);
        }

        // Modal Close
        const closeModalBtn = document.getElementById('close-modal-btn');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeShareModal);
        }

        // WhatsApp Share
        const whatsappBtn = document.getElementById('whatsapp-btn');
        if (whatsappBtn) {
            whatsappBtn.addEventListener('click', shareViaWhatsApp);
        }

        // Copy Link
        const copyBtn = document.getElementById('copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', copyShareLink);
        }

        log('âœ… Event Listeners setup');
    }

    // ===== PLAYER MANAGEMENT =====
    async function ensurePlayerInFirebase() {
        if (!firebaseService.isReady || !currentGameData) return;

        try {
            if (currentGameData.players && currentGameData.players[gameState.playerId]) {
                log(`âœ… Spieler existiert bereits: ${gameState.playerId}`);
                return;
            }

            log(`âš ï¸ Spieler fehlt - fÃ¼ge hinzu: ${gameState.playerId}`);

            const playerRef = firebaseService.database.ref(`games/${gameState.gameId}/players/${gameState.playerId}`);
            await playerRef.set({
                id: gameState.playerId,
                name: gameState.playerName || 'Spieler',
                isHost: gameState.isHost,
                isReady: false,
                isOnline: true,
                joinedAt: firebase.database.ServerValue.TIMESTAMP
            });

            log(`âœ… Spieler hinzugefÃ¼gt: ${gameState.playerId}`);
            await loadGameDataFromFirebase();

        } catch (error) {
            log(`âŒ Fehler beim HinzufÃ¼gen: ${error.message}`, 'error');
        }
    }

    async function loadGameDataFromFirebase() {
        log('ðŸ“¥ Lade Spieldaten aus Firebase...');

        try {
            const gameData = await firebaseService.getGameData(gameState.gameId);

            if (!gameData) {
                log('âŒ Spiel nicht gefunden!');
                showNotification('Spiel nicht gefunden', 'error');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
                return;
            }

            log('ðŸ“¦ Firebase Game Data geladen');

            gameState.difficulty = gameData.difficulty || gameState.difficulty;
            gameState.selectedCategories = gameData.categories || gameData.selectedCategories || gameState.selectedCategories;

            if (gameData.players && gameState.playerId) {
                const playerData = gameData.players[gameState.playerId];
                if (playerData) {
                    gameState.isHost = playerData.isHost || false;
                    gameState.isGuest = !playerData.isHost;
                    gameState.playerName = playerData.name || gameState.playerName;
                }
            }

            gameState.save();
            currentGameData = gameData;

            if (gameData.players) {
                lastPlayerCount = Object.keys(gameData.players).length;
            }

        } catch (error) {
            log(`âŒ Fehler beim Laden: ${error.message}`, 'error');
        }
    }

    function validateGameState() {
        if (gameState.deviceMode !== 'multi') {
            log('âŒ Nicht im Multiplayer-Modus');
            showNotification('Nicht im Multiplayer-Modus', 'warning');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return false;
        }

        if (!gameState.gameId) {
            log('âŒ Keine Game ID');
            showNotification('Keine Spiel-ID gefunden', 'error');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return false;
        }

        if (!gameState.playerId) {
            log('âš ï¸ Keine Player ID - generiere neue');
            gameState.generatePlayerId(gameState.isHost);
        }

        return true;
    }

    // ===== GAME LISTENER =====
    async function setupGameListener() {
        if (!firebaseService.isReady || !gameState.gameId) {
            log('âš ï¸ Kann Listener nicht setup');
            return;
        }

        try {
            log(`ðŸŽ§ Setup Game Listener fÃ¼r: ${gameState.gameId}`);

            gameListener = firebaseService.setupGameListener(gameState.gameId, (snapshot) => {
                if (snapshot.exists()) {
                    const newGameData = snapshot.val();
                    const newPlayerCount = newGameData.players ? Object.keys(newGameData.players).length : 0;

                    if (newPlayerCount !== lastPlayerCount) {
                        log(`ðŸ“¡ Spieler-Update: ${lastPlayerCount} â†’ ${newPlayerCount}`);
                        lastPlayerCount = newPlayerCount;
                    }

                    currentGameData = newGameData;
                    updateGameDisplay();
                    updateFromFirebaseData(newGameData);

                    if (newGameData.gameState === 'playing') {
                        handleGameStarted();
                    }
                } else {
                    log('âš ï¸ Spiel nicht mehr vorhanden');
                    showNotification('Spiel wurde beendet', 'warning');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 3000);
                }
            });

            let retries = 0;
            let initialData = null;

            while (retries < 3 && !initialData) {
                initialData = await firebaseService.getGameData(gameState.gameId);
                if (!initialData) {
                    log(`âš ï¸ Retry ${retries + 1}/3...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    retries++;
                }
            }

            if (initialData) {
                currentGameData = initialData;
                updateGameDisplay();
                updateFromFirebaseData(initialData);
                log('âœ… Initial Data geladen');
            }

            startPlayerListPolling();

        } catch (error) {
            log(`âŒ Listener Setup Fehler: ${error.message}`, 'error');
        }
    }

    // ===== POLLING =====
    function startPlayerListPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
        }

        log('â±ï¸ Starte Polling (alle 3 Sekunden)');

        pollingInterval = setInterval(async () => {
            if (!firebaseService.isReady || !gameState.gameId) {
                return;
            }

            try {
                const freshData = await firebaseService.getGameData(gameState.gameId);
                if (freshData) {
                    const newPlayerCount = freshData.players ? Object.keys(freshData.players).length : 0;
                    const oldPlayerCount = currentGameData?.players ? Object.keys(currentGameData.players).length : 0;

                    if (newPlayerCount !== oldPlayerCount) {
                        log(`ðŸ”„ Polling: Ã„nderung erkannt (${oldPlayerCount} â†’ ${newPlayerCount})`);
                        lastPlayerCount = newPlayerCount;
                        currentGameData = freshData;
                        updateGameDisplay();
                        updateFromFirebaseData(freshData);
                    } else {
                        currentGameData = freshData;
                        updateFromFirebaseData(freshData);
                    }
                }
            } catch (error) {
                console.debug(`Polling Fehler: ${error.message}`);
            }
        }, 3000);
    }

    function stopPlayerListPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
            log('â¹ï¸ Polling gestoppt');
        }
    }

    // ===== UPDATE FUNCTIONS (MIT XSS-SCHUTZ!) =====
    function updateFromFirebaseData(gameData) {
        log(`ðŸ”„ Update from Firebase`);

        if (gameData.players) {
            updatePlayersDisplay(gameData.players);
        } else {
            showEmptyPlayersList();
        }

        updateStartButton(gameData.players || {});
    }

    function updateGameDisplay() {
        // Game ID (SICHER - kein User-Input)
        const gameIdEl = document.getElementById('game-id');
        if (gameIdEl) {
            gameIdEl.textContent = gameState.gameId || 'LÃ¤dt...';
        }

        // Host Name (SICHER - textContent)
        let hostName = 'LÃ¤dt...';
        if (currentGameData && currentGameData.players) {
            const hostPlayer = Object.values(currentGameData.players).find(p => p.isHost);
            hostName = hostPlayer ? hostPlayer.name : (gameState.playerName || 'Unbekannt');
        } else if (gameState.playerName) {
            hostName = gameState.playerName;
        }
        const hostNameEl = document.getElementById('host-name');
        if (hostNameEl) {
            hostNameEl.textContent = hostName;
        }

        // Difficulty (SICHER - kein User-Input)
        const difficultyDisplay = document.getElementById('difficulty-display');
        if (difficultyDisplay) {
            if (gameState.difficulty) {
                difficultyDisplay.textContent = difficultyNames[gameState.difficulty] || gameState.difficulty;
            } else if (currentGameData && currentGameData.difficulty) {
                difficultyDisplay.textContent = difficultyNames[currentGameData.difficulty] || currentGameData.difficulty;
            } else {
                difficultyDisplay.textContent = 'LÃ¤dt...';
            }
        }

        // Categories (SICHER - mit DOMPurify)
        const categoriesDisplay = document.getElementById('categories-display');
        if (categoriesDisplay) {
            let categories = gameState.selectedCategories;

            if ((!categories || categories.length === 0) && currentGameData) {
                categories = currentGameData.categories || currentGameData.selectedCategories || [];
            }

            if (categories && categories.length > 0) {
                const categoriesHTML = categories.map(category => {
                    const data = categoryData[category];
                    if (!data) return '';
                    return `
                        <div class="category-tag">
                            <span class="icon">${data.icon}</span>
                            <span>${data.name}</span>
                        </div>
                    `;
                }).join('');

                // XSS-SCHUTZ: DOMPurify.sanitize()
                categoriesDisplay.innerHTML = DOMPurify.sanitize(categoriesHTML);
            } else {
                categoriesDisplay.innerHTML = '<span style="color: rgba(255,255,255,0.5);">LÃ¤dt...</span>';
            }
        }
    }

    function updatePlayersDisplay(players) {
        const playersList = document.getElementById('players-list');
        const playerCount = document.getElementById('player-count');

        if (!playersList || !playerCount) return;

        const playersArray = Object.entries(players || {}).map(([id, data]) => ({
            id: id,
            name: data.name,
            isHost: data.isHost || false,
            isOnline: data.isOnline || false,
            isReady: data.isReady || false,
            isMe: id === gameState.playerId
        }));

        playerCount.textContent = `${playersArray.length}/8 Spieler`;

        if (playersArray.length === 0) {
            showEmptyPlayersList();
            return;
        }

        playersArray.sort((a, b) => {
            if (a.isHost && !b.isHost) return -1;
            if (!a.isHost && b.isHost) return 1;
            return a.name.localeCompare(b.name);
        });

        // XSS-SCHUTZ: Erstelle Elemente mit textContent statt innerHTML
        playersList.innerHTML = ''; // Leeren

        playersArray.forEach(player => {
            // Container
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            if (player.isHost) playerItem.classList.add('host');
            if (player.isMe) playerItem.classList.add('me');

            // Player Info Container
            const playerInfo = document.createElement('div');
            playerInfo.className = 'player-info';

            // Avatar
            const playerAvatar = document.createElement('div');
            playerAvatar.className = 'player-avatar';
            playerAvatar.textContent = player.name.charAt(0).toUpperCase(); // SICHER!

            // Details Container
            const playerDetails = document.createElement('div');
            playerDetails.className = 'player-details';

            // Name
            const playerName = document.createElement('div');
            playerName.className = 'player-name';
            playerName.textContent = player.name; // SICHER!

            // Role
            const playerRole = document.createElement('div');
            playerRole.className = 'player-role';
            if (player.isHost) {
                playerRole.textContent = 'ðŸ‘‘ Host';
            } else if (player.isMe) {
                playerRole.textContent = 'ðŸ‘¤ Du';
            } else {
                playerRole.textContent = 'ðŸ‘¤ Spieler';
            }

            playerDetails.appendChild(playerName);
            playerDetails.appendChild(playerRole);

            // Status Container
            const playerStatus = document.createElement('div');
            playerStatus.className = 'player-status';

            // Status Indicator
            const statusIndicator = document.createElement('div');
            statusIndicator.className = `status-indicator ${player.isOnline ? 'status-online' : 'status-offline'}`;

            // Status Text
            const statusText = document.createElement('span');
            statusText.className = 'status-text';
            statusText.textContent = player.isOnline ? 'Online' : 'Offline';

            playerStatus.appendChild(statusIndicator);
            playerStatus.appendChild(statusText);

            // Zusammenbauen
            playerInfo.appendChild(playerAvatar);
            playerInfo.appendChild(playerDetails);
            playerItem.appendChild(playerInfo);
            playerItem.appendChild(playerStatus);
            playersList.appendChild(playerItem);
        });
    }

    function showEmptyPlayersList() {
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

        const playerCount = Object.keys(players || {}).length;

        if (gameState.isHost && playerCount >= 2) {
            startBtn.disabled = false;
            startBtn.classList.add('enabled');
            startBtn.textContent = `ðŸš€ Spiel starten (${playerCount} Spieler)`;
        } else {
            startBtn.disabled = true;
            startBtn.classList.remove('enabled');
            if (gameState.isHost) {
                startBtn.textContent = playerCount < 2
                    ? `â³ Warte auf Spieler (${playerCount}/2 min.)`
                    : `ðŸš€ Spiel starten (${playerCount} Spieler)`;
            } else {
                startBtn.textContent = 'Warte auf Host...';
            }
        }
    }

    function updateHostControls() {
        const settingsBtn = document.getElementById('settings-btn');
        if (!settingsBtn) return;

        log(`ðŸŽ® Updating controls - isHost: ${gameState.isHost}`);

        if (gameState.isHost) {
            settingsBtn.classList.add('show');
        } else {
            settingsBtn.classList.remove('show');
        }
    }

    function generateShareLink() {
        const baseUrl = window.location.origin + window.location.pathname.replace('multiplayer-lobby.html', '');
        shareLink = `${baseUrl}join-game.html?code=${gameState.gameId}`;
        log(`ðŸ”— Share Link: ${shareLink}`);
    }

    function startLocalFallback() {
        log('ðŸ”„ Starte lokalen Fallback');

        const localPlayers = {
            [gameState.playerId]: {
                name: gameState.playerName,
                isHost: gameState.isHost,
                isOnline: true,
                isReady: true
            }
        };

        updatePlayersDisplay(localPlayers);
        updateStartButton(localPlayers);
    }

    // ===== GAME CONTROL =====
    async function startGame() {
        if (!gameState.isHost) {
            showNotification('Nur der Host kann das Spiel starten', 'warning');
            return;
        }

        log('ðŸš€ Starte Spiel...');
        showLoading();

        try {
            if (firebaseService.isReady) {
                await firebaseService.startGame(gameState.gameId);
                log('âœ… Spiel gestartet');
            } else {
                log('â„¹ï¸ Offline - starte lokal');
                setTimeout(() => {
                    handleGameStarted();
                }, 1000);
            }

        } catch (error) {
            log(`âŒ Fehler: ${error.message}`, 'error');
            showNotification('Fehler beim Starten', 'error');
            hideLoading();
        }
    }

    function handleGameStarted() {
        log('ðŸŽ® Spiel gestartet - Weiterleitung...');

        stopPlayerListPolling();

        gameState.gamePhase = 'playing';
        gameState.save();

        showNotification('Spiel startet! ðŸŽ®', 'success');

        setTimeout(() => {
            window.location.href = 'multiplayer-gameplay.html';
        }, 2000);
    }

    // ===== SHARE FUNCTIONS =====
    function showShareModal() {
        const modal = document.getElementById('share-modal');
        const display = document.getElementById('share-link-display');

        if (display) display.textContent = shareLink;
        if (modal) modal.classList.add('show');
    }

    function closeShareModal() {
        const modal = document.getElementById('share-modal');
        if (modal) modal.classList.remove('show');
    }

    function shareViaWhatsApp() {
        const message = encodeURIComponent(`Hey! Komm in mein No-Cap Spiel!\n\n${shareLink}\n\nSpiel-ID: ${gameState.gameId}`);
        const whatsappUrl = `https://wa.me/?text=${message}`;
        window.open(whatsappUrl, '_blank');
        showNotification('WhatsApp geÃ¶ffnet! ðŸ’¬', 'success');
    }

    async function copyShareLink() {
        try {
            await navigator.clipboard.writeText(shareLink);
            showNotification('Link kopiert! ðŸ“‹', 'success');
        } catch (error) {
            const textArea = document.createElement('textarea');
            textArea.value = shareLink;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('Link kopiert! ðŸ“‹', 'success');
        }
    }

    // ===== UTILITY FUNCTIONS =====
    function goBack() {
        if (!gameState.isHost) {
            showNotification('Nur der Host kann Einstellungen Ã¤ndern', 'warning');
            return;
        }

        log('â¬…ï¸ ZurÃ¼ck zur Schwierigkeitsauswahl');

        stopPlayerListPolling();

        if (firebaseService && gameState.playerId) {
            firebaseService.setPlayerOnline(gameState.gameId, gameState.playerId, false);
        }

        if (firebaseService) {
            firebaseService.cleanup();
        }

        showLoading();

        setTimeout(() => {
            window.location.href = 'multiplayer-difficulty-selection.html';
        }, 300);
    }

    function showLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.add('show');
    }

    function hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.remove('show');
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

    function log(message, type = 'info') {
        const colors = {
            info: '#4488ff',
            warning: '#ffaa00',
            error: '#ff4444',
            success: '#00ff00'
        };

        console.log(`%c[Lobby] ${message}`, `color: ${colors[type] || colors.info}`);
    }

    // ===== CLEANUP =====
    window.addEventListener('beforeunload', function() {
        stopPlayerListPolling();

        if (firebaseService && gameState && gameState.playerId) {
            firebaseService.setPlayerOnline(gameState.gameId, gameState.playerId, false);
        }

        if (firebaseService) {
            firebaseService.cleanup();
        }
    });

    // ===== DEBUG =====
    window.debugLobby = function() {
        console.log('ðŸ” === LOBBY DEBUG ===');
        console.log('GameState:', gameState?.getDebugInfo());
        console.log('Firebase:', {
            initialized: firebaseService?.isInitialized,
            connected: firebaseService?.isConnected,
            ready: firebaseService?.isReady
        });
        console.log('Game Data:', currentGameData);
        console.log('Polling:', !!pollingInterval);
        console.log('Share Link:', shareLink);
    };

    log('âœ… No-Cap Multiplayer Lobby v4.0 geladen!');
    log('ðŸ› ï¸ Debug: debugLobby()');

})();