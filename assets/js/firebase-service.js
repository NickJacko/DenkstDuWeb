/**
 * No-Cap Firebase Game Service
 * Version 5.0 - Production Ready (Audit-Fixed)
 *
 * ✅ P0 FIX: ID collision checks implemented
 * ✅ P0 FIX: No dependency on firebase-config.js
 * ✅ P1 FIX: Comprehensive error handling with try/catch
 * ✅ P1 FIX: Proper listener cleanup with Map tracking
 *
 * IMPORTANT: Requires database.rules.json to be deployed!
 */

'use strict';

(function(window) {

    class FirebaseGameService {
        constructor() {
            this.app = null;
            this.auth = null;
            this.database = null;
            this.isInitialized = false;
            this.isConnected = false;
            this.gameRef = null;
            this.playersRef = null;
            this.currentGameId = null;
            this.currentPlayerId = null;

            // Listener tracking for cleanup
            this.listeners = new Map();
            this.connectionListeners = [];
            this.rejoinAttempted = false;

            // Environment detection
            this.isDevelopment = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('192.168.');

            // ✅ P0 FIX: Collision tracking
            this._generationAttempts = new Map();
            this.MAX_GENERATION_ATTEMPTS = 5;
        }

        // ===========================
        // INITIALIZATION
        // ===========================

        async initialize(gameId = null, callbacks = {}) {
            try {
                if (this.isDevelopment) {
                    console.log('🔥 FirebaseGameService v5.0 - Starting initialization...');
                }

                // ✅ P1 FIX: Wait for Firebase SDK only (no firebase-config.js)
                await this._waitForFirebaseSDK();

                // ✅ P0 FIX: Direct Firebase initialization (no deprecated config)
                if (!firebase || !firebase.apps || firebase.apps.length === 0) {
                    throw new Error('Firebase SDK not initialized');
                }

                this.app = firebase.app();
                this.auth = firebase.auth();
                this.database = firebase.database();

                if (this.isDevelopment) {
                    console.log('✅ Firebase instances ready');
                }

                // Wait for authentication
                await this._waitForAuth();

                // Test connection with retry
                this.isConnected = await this._testConnectionWithRetry();

                if (!this.isConnected) {
                    console.warn('⚠️ Firebase offline - Limited functionality');

                    if (window.NocapUtils) {
                        window.NocapUtils.showNotification(
                            'Offline-Modus aktiv',
                            'warning',
                            3000
                        );
                    }
                } else if (this.isDevelopment) {
                    console.log('✅ Firebase connection successful');
                }

                // Setup connection monitoring
                this._setupConnectionMonitoring();

                // Attempt rejoin if applicable
                if (this.isConnected && !gameId) {
                    const rejoinSuccess = await this.attemptRejoin();
                    if (rejoinSuccess && this.isDevelopment) {
                        console.log('✅ Automatic rejoin successful');
                    }
                }

                // Connect to specific game if provided
                if (this.isConnected && gameId) {
                    if (this.isDevelopment) {
                        console.log(`🎮 Connecting to game: ${gameId}`);
                    }
                    await this.connectToGame(gameId, callbacks);
                }

                this.isInitialized = true;

                if (this.isDevelopment) {
                    console.log(`🎉 FirebaseGameService ready! ${gameId ? `(Game: ${gameId})` : ''}`);
                }

                return this.isInitialized;

            } catch (error) {
                console.error('❌ Firebase initialization failed:', error);
                this.isInitialized = false;
                this.isConnected = false;

                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(
                        'Firebase-Verbindung fehlgeschlagen',
                        'error'
                    );
                }

                throw error;
            }
        }

        /**
         * ✅ P0 FIX: Wait for Firebase SDK without firebase-config.js
         */
        async _waitForFirebaseSDK(timeout = 10000) {
            const startTime = Date.now();

            while (Date.now() - startTime < timeout) {
                if (typeof firebase !== 'undefined' &&
                    firebase.apps &&
                    firebase.apps.length > 0) {
                    return true;
                }

                await this._delay(100);
            }

            throw new Error('Firebase SDK not loaded');
        }

        async _waitForAuth(maxWaitTime = 5000) {
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    console.warn('⚠️ Auth timeout - continuing anyway');
                    resolve(false);
                }, maxWaitTime);

                if (this.auth.currentUser) {
                    clearTimeout(timeout);
                    if (this.isDevelopment) {
                        console.log('✅ Auth ready (user already signed in)');
                    }
                    resolve(true);
                    return;
                }

                const unsubscribe = this.auth.onAuthStateChanged((user) => {
                    if (user) {
                        clearTimeout(timeout);
                        unsubscribe();
                        if (this.isDevelopment) {
                            console.log('✅ Auth ready (user signed in)');
                        }
                        resolve(true);
                    }
                });
            });
        }

        // ===========================
        // CONNECTION MANAGEMENT
        // ===========================

        async _testConnectionWithRetry(maxRetries = 3, timeoutMs = 5000) {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                if (this.isDevelopment) {
                    console.log(`🔄 Connection attempt ${attempt}/${maxRetries}...`);
                }

                try {
                    const connected = await this._performConnectionTest(timeoutMs);
                    if (connected) {
                        if (this.isDevelopment) {
                            console.log(`✅ Connected on attempt ${attempt}`);
                        }
                        return true;
                    }
                } catch (error) {
                    console.warn(`⚠️ Attempt ${attempt} failed:`, error.message);
                }

                if (attempt < maxRetries) {
                    await this._delay(1000 * attempt);
                }
            }

            return false;
        }

        async _performConnectionTest(timeoutMs = 5000) {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`Timeout after ${timeoutMs}ms`));
                }, timeoutMs);

                try {
                    const connectedRef = this.database.ref('.info/connected');

                    connectedRef.once('value', (snapshot) => {
                        clearTimeout(timeout);
                        const isConnected = snapshot.val() === true;
                        resolve(isConnected);
                    }, (error) => {
                        clearTimeout(timeout);
                        reject(error);
                    });

                } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
            });
        }

        _setupConnectionMonitoring() {
            if (!this.database) return;

            try {
                const connectedRef = this.database.ref('.info/connected');

                const connectionListener = connectedRef.on('value', (snapshot) => {
                    const wasConnected = this.isConnected;
                    this.isConnected = snapshot.val() === true;

                    if (wasConnected !== this.isConnected) {
                        if (this.isDevelopment) {
                            console.log(`🔄 Connection: ${this.isConnected ? '✅ Online' : '⚠️ Offline'}`);
                        }

                        this._notifyConnectionChange(this.isConnected);

                        window.dispatchEvent(new CustomEvent('nocap:firebaseConnection', {
                            detail: { connected: this.isConnected }
                        }));

                        // Auto-rejoin on reconnection
                        if (this.isConnected && this.currentGameId && this.currentPlayerId) {
                            this.updatePlayerStatus(this.currentGameId, this.currentPlayerId, {
                                isOnline: true,
                                reconnectedAt: firebase.database.ServerValue.TIMESTAMP
                            });
                        }
                    }
                });

                this.listeners.set('connection', { ref: connectedRef, listener: connectionListener });

            } catch (error) {
                console.error('❌ Error setting up connection monitoring:', error);
            }
        }

        onConnectionChange(callback) {
            if (typeof callback === 'function') {
                this.connectionListeners.push(callback);
            }
        }

        _notifyConnectionChange(connected) {
            this.connectionListeners.forEach(callback => {
                try {
                    callback(connected);
                } catch (error) {
                    console.error('❌ Error notifying connection change:', error);
                }
            });
        }

        // ===========================
        // REJOIN MECHANISM
        // ===========================

        async attemptRejoin() {
            if (this.rejoinAttempted) return false;
            this.rejoinAttempted = true;

            try {
                const gameId = window.NocapUtils
                    ? window.NocapUtils.getLocalStorage('nocap_currentGameId')
                    : localStorage.getItem('nocap_currentGameId');

                const playerId = window.NocapUtils
                    ? window.NocapUtils.getLocalStorage('nocap_currentPlayerId')
                    : localStorage.getItem('nocap_currentPlayerId');

                if (!gameId || !playerId) {
                    if (this.isDevelopment) {
                        console.log('ℹ️ No rejoin data found');
                    }
                    return false;
                }

                if (this.isDevelopment) {
                    console.log(`🔄 Attempting rejoin: ${gameId}`);
                }

                // Check if game still exists
                const gameRef = this.database.ref(`games/${gameId}`);
                const snapshot = await gameRef.once('value');

                if (!snapshot.exists()) {
                    console.warn('⚠️ Game no longer exists');
                    this.clearRejoinData();
                    return false;
                }

                const gameData = snapshot.val();

                // Check if player still in game
                if (!gameData.players || !gameData.players[playerId]) {
                    console.warn('⚠️ Player no longer in game');
                    this.clearRejoinData();
                    return false;
                }

                // Set player as online
                await this.updatePlayerStatus(gameId, playerId, {
                    isOnline: true,
                    rejoined: true,
                    rejoinedAt: firebase.database.ServerValue.TIMESTAMP
                });

                // Restore connection
                this.currentGameId = gameId;
                this.currentPlayerId = playerId;
                this.gameRef = gameRef;

                if (this.isDevelopment) {
                    console.log('✅ Rejoin successful');
                }

                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(
                        'Spiel wiederhergestellt',
                        'success',
                        2000
                    );
                }

                return true;

            } catch (error) {
                console.error('❌ Rejoin failed:', error);
                this.clearRejoinData();
                return false;
            }
        }

        saveRejoinData(gameId, playerId, playerName) {
            try {
                if (window.NocapUtils) {
                    window.NocapUtils.setLocalStorage('nocap_currentGameId', gameId);
                    window.NocapUtils.setLocalStorage('nocap_currentPlayerId', playerId);
                    window.NocapUtils.setLocalStorage('nocap_playerName', playerName);
                    window.NocapUtils.setLocalStorage('nocap_lastActive', Date.now());
                } else {
                    localStorage.setItem('nocap_currentGameId', gameId);
                    localStorage.setItem('nocap_currentPlayerId', playerId);
                    localStorage.setItem('nocap_playerName', playerName);
                    localStorage.setItem('nocap_lastActive', Date.now().toString());
                }
            } catch (error) {
                console.warn('⚠️ Could not save rejoin data:', error);
            }
        }

        clearRejoinData() {
            try {
                if (window.NocapUtils) {
                    window.NocapUtils.removeLocalStorage('nocap_currentGameId');
                    window.NocapUtils.removeLocalStorage('nocap_currentPlayerId');
                    window.NocapUtils.removeLocalStorage('nocap_playerName');
                    window.NocapUtils.removeLocalStorage('nocap_lastActive');
                } else {
                    localStorage.removeItem('nocap_currentGameId');
                    localStorage.removeItem('nocap_currentPlayerId');
                    localStorage.removeItem('nocap_playerName');
                    localStorage.removeItem('nocap_lastActive');
                }
            } catch (error) {
                console.warn('⚠️ Could not clear rejoin data:', error);
            }
        }

        // ===========================
        // ✅ P0 FIX: ID GENERATION WITH COLLISION CHECK
        // ===========================

        /**
         * Generate game code with collision check
         */
        async generateGameCode() {
            const key = 'gameCode';
            let attempts = 0;

            while (attempts < this.MAX_GENERATION_ATTEMPTS) {
                const code = this._generateRandomCode();

                // ✅ P0 FIX: Check if code already exists
                const exists = await this._checkGameIdExists(code);

                if (!exists) {
                    this._generationAttempts.delete(key);
                    return code;
                }

                attempts++;
                if (this.isDevelopment) {
                    console.warn(`⚠️ Game code collision (attempt ${attempts}/${this.MAX_GENERATION_ATTEMPTS})`);
                }
            }

            throw new Error('Failed to generate unique game code after multiple attempts');
        }

        /**
         * ✅ P0 FIX: Check if game ID exists in database
         */
        async _checkGameIdExists(gameId) {
            try {
                const gameRef = this.database.ref(`games/${gameId}`);
                const snapshot = await gameRef.once('value');
                return snapshot.exists();
            } catch (error) {
                console.error('❌ Error checking game ID:', error);
                // On error, assume it might exist (safer)
                return true;
            }
        }

        /**
         * Generate random 6-character code (crypto-safe)
         */
        _generateRandomCode() {
            if (window.NocapUtils && window.NocapUtils.generateGameId) {
                return window.NocapUtils.generateGameId();
            }

            // Fallback with crypto
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let code = '';

            if (window.crypto && window.crypto.getRandomValues) {
                const array = new Uint8Array(6);
                window.crypto.getRandomValues(array);
                for (let i = 0; i < 6; i++) {
                    code += chars[array[i] % chars.length];
                }
            } else {
                for (let i = 0; i < 6; i++) {
                    code += chars[Math.floor(Math.random() * chars.length)];
                }
            }

            return code;
        }

        /**
         * ✅ P0 FIX: Generate player ID with collision check
         */
        async generatePlayerId(playerName, isHost = false, gameId = null) {
            const key = `player_${playerName}_${isHost}`;
            let attempts = 0;

            while (attempts < this.MAX_GENERATION_ATTEMPTS) {
                const playerId = this._generatePlayerIdString(playerName, isHost);

                // ✅ P0 FIX: Check if player ID exists in game
                if (gameId) {
                    const exists = await this._checkPlayerIdExists(gameId, playerId);

                    if (!exists) {
                        this._generationAttempts.delete(key);
                        return playerId;
                    }

                    attempts++;
                    if (this.isDevelopment) {
                        console.warn(`⚠️ Player ID collision (attempt ${attempts}/${this.MAX_GENERATION_ATTEMPTS})`);
                    }
                } else {
                    // No game ID to check against, return generated ID
                    return playerId;
                }
            }

            throw new Error('Failed to generate unique player ID after multiple attempts');
        }

        /**
         * ✅ P0 FIX: Check if player ID exists in game
         */
        async _checkPlayerIdExists(gameId, playerId) {
            try {
                const playerRef = this.database.ref(`games/${gameId}/players/${playerId}`);
                const snapshot = await playerRef.once('value');
                return snapshot.exists();
            } catch (error) {
                console.error('❌ Error checking player ID:', error);
                return true; // Safer to assume it exists
            }
        }

        /**
         * Generate player ID string (without collision check)
         */
        _generatePlayerIdString(playerName, isHost = false) {
            const sanitized = window.NocapUtils
                ? window.NocapUtils.sanitizeInput(playerName || 'player')
                : (playerName || 'player');

            const safeName = sanitized
                .replace(/[^a-zA-Z0-9]/g, '')
                .toLowerCase()
                .substring(0, 10);

            const prefix = isHost ? 'host' : 'guest';
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 8);
            const extraRandom = Math.random().toString(36).substring(2, 6);

            return `${prefix}_${safeName}_${timestamp}_${random}${extraRandom}`;
        }

        // ===========================
        // CREATE GAME
        // ===========================

        async createGame(gameData) {
            if (!this.isConnected) {
                throw new Error('Keine Firebase-Verbindung. Bitte prüfe deine Internetverbindung.');
            }

            try {
                // Validate input
                const validation = this._validateGameData(gameData);
                if (!validation.valid) {
                    throw new Error(validation.error);
                }

                // ✅ P0 FIX: Generate unique game ID with collision check
                const gameId = await this.generateGameCode();

                // Sanitize host name
                const sanitizedHostName = window.NocapUtils
                    ? window.NocapUtils.sanitizeInput(gameData.hostName)
                    : gameData.hostName;

                // ✅ P0 FIX: Generate unique player ID with collision check
                const hostPlayerId = await this.generatePlayerId(sanitizedHostName, true, gameId);

                if (this.isDevelopment) {
                    console.log(`🎮 Creating game: ${gameId}`);
                }

                const gameObject = {
                    gameId: gameId,
                    gameState: 'lobby',
                    createdAt: firebase.database.ServerValue.TIMESTAMP,
                    lastUpdate: firebase.database.ServerValue.TIMESTAMP,
                    categories: gameData.categories || [],
                    difficulty: gameData.difficulty || 'medium',
                    alcoholMode: gameData.alcoholMode === true,
                    maxPlayers: 8,
                    currentRound: 0,
                    hostId: hostPlayerId,

                    players: {
                        [hostPlayerId]: {
                            id: hostPlayerId,
                            name: sanitizedHostName,
                            isHost: true,
                            isReady: true,
                            isOnline: true,
                            joinedAt: firebase.database.ServerValue.TIMESTAMP,
                            lastSeen: firebase.database.ServerValue.TIMESTAMP
                        }
                    },

                    settings: {
                        questionsPerGame: gameData.questionCount || 10,
                        timePerQuestion: 30,
                        showResults: true,
                        allowSpectators: false
                    }
                };

                const gameRef = this.database.ref(`games/${gameId}`);
                await gameRef.set(gameObject);

                if (this.isDevelopment) {
                    console.log(`✅ Game created: ${gameId}`);
                }

                this.currentGameId = gameId;
                this.currentPlayerId = hostPlayerId;
                this.gameRef = gameRef;

                // Save for rejoin
                this.saveRejoinData(gameId, hostPlayerId, sanitizedHostName);

                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(
                        'Spiel erstellt!',
                        'success',
                        2000
                    );
                }

                return {
                    gameId: gameId,
                    playerId: hostPlayerId,
                    gameRef: gameRef
                };

            } catch (error) {
                console.error('❌ Error creating game:', error);

                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(
                        error.message || 'Spiel konnte nicht erstellt werden',
                        'error'
                    );
                }

                throw error;
            }
        }

        _validateGameData(gameData) {
            if (!gameData) {
                return { valid: false, error: 'Spieledaten fehlen' };
            }

            if (!gameData.hostName || typeof gameData.hostName !== 'string') {
                return { valid: false, error: 'Host-Name erforderlich' };
            }

            const validation = window.NocapUtils
                ? window.NocapUtils.validatePlayerName(gameData.hostName)
                : { valid: true };

            if (!validation.valid) {
                return { valid: false, error: validation.message };
            }

            if (!Array.isArray(gameData.categories) || gameData.categories.length === 0) {
                return { valid: false, error: 'Mindestens eine Kategorie erforderlich' };
            }

            const validDifficulties = ['easy', 'medium', 'hard'];
            if (gameData.difficulty && !validDifficulties.includes(gameData.difficulty)) {
                return { valid: false, error: 'Ungültige Schwierigkeit' };
            }

            return { valid: true };
        }

        // ===========================
        // JOIN GAME
        // ===========================

        async joinGame(gameId, playerName) {
            if (!this.isConnected) {
                throw new Error('Keine Firebase-Verbindung. Bitte prüfe deine Internetverbindung.');
            }

            try {
                if (this.isDevelopment) {
                    console.log(`🔄 Joining game: ${gameId}`);
                }

                // Validate game ID
                const gameIdValidation = window.NocapUtils
                    ? window.NocapUtils.validateGameId(gameId)
                    : { valid: gameId && gameId.length === 6, gameId: gameId };

                if (!gameIdValidation.valid) {
                    throw new Error('Ungültiger Game-Code. Code muss 6 Zeichen haben.');
                }

                // Validate player name
                const nameValidation = window.NocapUtils
                    ? window.NocapUtils.validatePlayerName(playerName)
                    : { valid: true, name: playerName };

                if (!nameValidation.valid) {
                    throw new Error(nameValidation.message);
                }

                const cleanGameId = gameIdValidation.gameId.toUpperCase();
                const sanitizedName = nameValidation.name;

                const gameRef = this.database.ref(`games/${cleanGameId}`);
                const gameSnapshot = await gameRef.once('value');

                if (!gameSnapshot.exists()) {
                    throw new Error('Spiel nicht gefunden. Bitte prüfe den Code.');
                }

                const gameData = gameSnapshot.val();

                if (gameData.gameState !== 'lobby') {
                    throw new Error('Spiel bereits gestartet. Beitreten nicht möglich.');
                }

                const currentPlayerCount = gameData.players ? Object.keys(gameData.players).length : 0;
                if (currentPlayerCount >= gameData.maxPlayers) {
                    throw new Error(`Spiel ist voll. Maximum ${gameData.maxPlayers} Spieler.`);
                }

                // Check if name is already taken
                const existingPlayers = gameData.players || {};
                const nameTaken = Object.values(existingPlayers).some(
                    p => p.name.toLowerCase() === sanitizedName.toLowerCase()
                );
                if (nameTaken) {
                    throw new Error('Name bereits vergeben. Bitte wähle einen anderen Namen.');
                }

                // ✅ P0 FIX: Generate unique player ID with collision check
                const playerId = await this.generatePlayerId(sanitizedName, false, cleanGameId);

                const playerRef = gameRef.child(`players/${playerId}`);
                await playerRef.set({
                    id: playerId,
                    name: sanitizedName,
                    isHost: false,
                    isReady: false,
                    isOnline: true,
                    joinedAt: firebase.database.ServerValue.TIMESTAMP,
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });

                if (this.isDevelopment) {
                    console.log(`✅ Successfully joined: ${cleanGameId}`);
                }

                this.currentGameId = cleanGameId;
                this.currentPlayerId = playerId;
                this.gameRef = gameRef;

                // Save for rejoin
                this.saveRejoinData(cleanGameId, playerId, sanitizedName);

                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(
                        'Spiel beigetreten!',
                        'success',
                        2000
                    );
                }

                return {
                    gameId: cleanGameId,
                    playerId: playerId,
                    gameRef: gameRef,
                    gameData: gameData
                };

            } catch (error) {
                console.error('❌ Error joining game:', error);

                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(
                        error.message,
                        'error'
                    );
                }

                throw error;
            }
        }

        // ===========================
        // GAME CONNECTION
        // ===========================

        async connectToGame(gameId, callbacks = {}) {
            if (!this.isConnected || !gameId) {
                return false;
            }

            try {
                if (this.isDevelopment) {
                    console.log(`🔗 Connecting to game: ${gameId}`);
                }

                this.currentGameId = gameId;
                this.gameRef = this.database.ref(`games/${gameId}`);

                const snapshot = await this.gameRef.once('value');
                if (!snapshot.exists()) {
                    console.warn(`⚠️ Game ${gameId} does not exist`);
                    return false;
                }

                // Setup listeners with tracking
                if (callbacks.onGameUpdate && typeof callbacks.onGameUpdate === 'function') {
                    const gameListener = this.gameRef.on('value', callbacks.onGameUpdate);
                    this.listeners.set(`game_${gameId}`, {
                        ref: this.gameRef,
                        listener: gameListener
                    });
                }

                if (callbacks.onPlayersUpdate && typeof callbacks.onPlayersUpdate === 'function') {
                    const playersRef = this.gameRef.child('players');
                    const playersListener = playersRef.on('value', callbacks.onPlayersUpdate);
                    this.listeners.set(`players_${gameId}`, {
                        ref: playersRef,
                        listener: playersListener
                    });
                }

                if (this.isDevelopment) {
                    console.log(`✅ Connected to game: ${gameId}`);
                }

                return true;

            } catch (error) {
                console.error(`❌ Error connecting to game ${gameId}:`, error);
                return false;
            }
        }

        // ===========================
        // PLAYER MANAGEMENT
        // ===========================

        async updatePlayerStatus(gameId, playerId, updates) {
            if (!this.isConnected) {
                console.warn('⚠️ Offline - Status wird bei Reconnect synchronisiert');
                return false;
            }

            try {
                const playerRef = this.database.ref(`games/${gameId}/players/${playerId}`);

                const updatesWithTimestamp = {
                    ...updates,
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                };

                await playerRef.update(updatesWithTimestamp);
                return true;
            } catch (error) {
                console.error('❌ Error updating player status:', error);
                return false;
            }
        }

        async setPlayerOnline(gameId, playerId, online = true) {
            return this.updatePlayerStatus(gameId, playerId, { isOnline: online });
        }

        async setPlayerReady(gameId, playerId, ready = true) {
            return this.updatePlayerStatus(gameId, playerId, { isReady: ready });
        }

        async removePlayer(gameId, playerId) {
            if (!this.isConnected) return false;

            try {
                const playerRef = this.database.ref(`games/${gameId}/players/${playerId}`);
                await playerRef.remove();

                if (this.isDevelopment) {
                    console.log(`🗑️ Player removed: ${playerId}`);
                }
                return true;
            } catch (error) {
                console.error('❌ Error removing player:', error);
                return false;
            }
        }

        // ===========================
        // GAME CONTROL
        // ===========================

        async startGame(gameId) {
            if (!this.isConnected) {
                throw new Error('Keine Firebase-Verbindung');
            }

            try {
                const gameRef = this.database.ref(`games/${gameId}`);
                await gameRef.update({
                    gameState: 'playing',
                    startedAt: firebase.database.ServerValue.TIMESTAMP,
                    lastUpdate: firebase.database.ServerValue.TIMESTAMP
                });

                if (this.isDevelopment) {
                    console.log(`🚀 Game started: ${gameId}`);
                }

                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(
                        'Spiel gestartet!',
                        'success',
                        2000
                    );
                }

                return true;

            } catch (error) {
                console.error('❌ Error starting game:', error);

                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(
                        'Spiel konnte nicht gestartet werden',
                        'error'
                    );
                }

                throw error;
            }
        }

        async updateGameSettings(gameId, settings) {
            if (!this.isConnected) return false;

            try {
                const settingsRef = this.database.ref(`games/${gameId}/settings`);
                await settingsRef.update(settings);

                const gameRef = this.database.ref(`games/${gameId}/lastUpdate`);
                await gameRef.set(firebase.database.ServerValue.TIMESTAMP);

                return true;
            } catch (error) {
                console.error('❌ Error updating game settings:', error);
                return false;
            }
        }

        async deleteGame(gameId) {
            if (!this.isConnected) return false;

            try {
                const gameRef = this.database.ref(`games/${gameId}`);
                await gameRef.remove();

                if (this.isDevelopment) {
                    console.log(`🗑️ Game deleted: ${gameId}`);
                }

                this.clearRejoinData();
                return true;
            } catch (error) {
                console.error('❌ Error deleting game:', error);
                return false;
            }
        }

        // ===========================
        // LEAVE & CLEANUP
        // ===========================

        async leaveGame(gameId, playerId) {
            if (this.isDevelopment) {
                console.log(`👋 Leaving game: ${gameId}`);
            }

            // Mark player as offline
            await this.setPlayerOnline(gameId, playerId, false);

            // Clear rejoin data
            this.clearRejoinData();

            return true;
        }

        cleanup() {
            if (this.isDevelopment) {
                console.log('🧹 FirebaseGameService cleanup...');
            }

            // Set player offline
            if (this.currentGameId && this.currentPlayerId) {
                this.setPlayerOnline(this.currentGameId, this.currentPlayerId, false);
            }

            // Remove all listeners
            this.listeners.forEach(({ ref, listener }, key) => {
                try {
                    ref.off('value', listener);
                } catch (error) {
                    console.error(`❌ Error removing listener ${key}:`, error);
                }
            });

            this.listeners.clear();
            this.connectionListeners = [];
            this.gameRef = null;
            this.currentGameId = null;
            this.currentPlayerId = null;

            if (this.isDevelopment) {
                console.log('✅ FirebaseGameService cleaned up');
            }
        }

        // ===========================
        // UTILITY
        // ===========================

        async _delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        get isReady() {
            return this.isInitialized && this.isConnected;
        }

        getStatus() {
            return {
                initialized: this.isInitialized,
                connected: this.isConnected,
                currentGameId: this.currentGameId,
                currentPlayerId: this.currentPlayerId,
                hasGameRef: !!this.gameRef,
                listenersCount: this.listeners.size,
                connectionListenersCount: this.connectionListeners.length,
                canRejoin: !!(this.currentGameId && this.currentPlayerId)
            };
        }

        /**
         * Get current user ID (for premium checks)
         */
        getCurrentUserId() {
            try {
                if (this.auth && this.auth.currentUser) {
                    return this.auth.currentUser.uid;
                }
                return null;
            } catch (error) {
                console.error('❌ Error getting user ID:', error);
                return null;
            }
        }

        /**
         * Anonymous sign-in helper
         */
        async signInAnonymously() {
            try {
                if (this.auth.currentUser) {
                    return { success: true, user: this.auth.currentUser };
                }

                const result = await this.auth.signInAnonymously();
                return { success: true, user: result.user };
            } catch (error) {
                console.error('❌ Anonymous sign-in failed:', error);
                return { success: false, error: error.message };
            }
        }

        /**
         * Wait for Firebase to be ready (for other scripts)
         */
        async waitForFirebase(timeout = 10000) {
            const startTime = Date.now();

            while (Date.now() - startTime < timeout) {
                if (this.isInitialized) {
                    return true;
                }
                await this._delay(100);
            }

            throw new Error('Firebase service not ready');
        }
    }

    // ===========================
    // SINGLETON & LIFECYCLE
    // ===========================

    if (typeof window.FirebaseService === 'undefined') {
        window.FirebaseService = new FirebaseGameService();

        const isDev = window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';

        if (isDev) {
            console.log('%c✅ FirebaseGameService v5.0 loaded (Collision Check Fix)',
                'color: #FF6F00; font-weight: bold; font-size: 12px');
        }
    }

    // Cleanup on unload
    window.addEventListener('beforeunload', () => {
        if (window.FirebaseService) {
            window.FirebaseService.cleanup();
        }
    });

    // Handle visibility changes
    document.addEventListener('visibilitychange', () => {
        if (window.FirebaseService &&
            window.FirebaseService.currentGameId &&
            window.FirebaseService.currentPlayerId) {
            const online = !document.hidden;
            window.FirebaseService.setPlayerOnline(
                window.FirebaseService.currentGameId,
                window.FirebaseService.currentPlayerId,
                online
            );
        }
    });

})(window);