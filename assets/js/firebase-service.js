/**
 * No-Cap Firebase Game Service
 * Version 4.0 - Audit-Fixed & Security Hardened
 *
 * This is the PRIMARY Firebase service for all game operations.
 * Requires: firebase-config.js, firebase-auth.js, utils.js, GameState.js
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

            // P1 FIX: Track listeners for proper cleanup
            this.listeners = new Map();
            this.connectionListeners = [];
            this.rejoinAttempted = false;

            // P1 FIX: Environment detection
            this.isDevelopment = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('192.168.');
        }

        // ===== P1 FIX: INITIALIZATION WITH DEPENDENCIES =====

        async initialize(gameId = null, callbacks = {}) {
            try {
                if (this.isDevelopment) {
                    console.log('🔥 FirebaseGameService v4.0 - Starting initialization...');
                }

                // P1 FIX: Wait for all dependencies
                await this._waitForDependencies();

                // P1 FIX: Get Firebase instances from FirebaseConfig
                const { auth, database } = window.FirebaseConfig.getFirebaseInstances();
                this.auth = auth;
                this.database = database;

                if (this.isDevelopment) {
                    console.log('✅ Firebase instances ready');
                }

                // P1 FIX: Wait for authentication
                await this._waitForAuth();

                // P1 FIX: Test connection
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

                // P1 FIX: Setup connection monitoring
                this._setupConnectionMonitoring();

                // P1 FIX: Attempt rejoin if applicable
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

                // P1 FIX: User-friendly error
                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(
                        'Firebase-Verbindung fehlgeschlagen',
                        'error'
                    );
                }

                throw error;
            }
        }

        // ===== P1 FIX: WAIT FOR DEPENDENCIES =====

        async _waitForDependencies(timeout = 10000) {
            const startTime = Date.now();

            while (Date.now() - startTime < timeout) {
                if (typeof window.FirebaseConfig !== 'undefined' &&
                    typeof window.NocapUtils !== 'undefined' &&
                    typeof window.GameState !== 'undefined') {

                    // Wait for Firebase to be initialized
                    if (window.FirebaseConfig.isInitialized()) {
                        return true;
                    }
                }

                await this._delay(100);
            }

            throw new Error('Dependencies not loaded (FirebaseConfig, NocapUtils, GameState required)');
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

        // ===== P1 FIX: CONNECTION TESTING =====

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

        // ===== P1 FIX: CONNECTION MONITORING =====

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

                        // P1 FIX: Dispatch custom event
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

        // ===== REJOIN MECHANISM =====

        async attemptRejoin() {
            if (this.rejoinAttempted) return false;
            this.rejoinAttempted = true;

            try {
                // P0 FIX: Use safe localStorage helper
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

                // P1 FIX: Show notification
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

        // P0 FIX: Safe rejoin data storage
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

        // ===== P1 FIX: GAME CODE GENERATION (CRYPTO-SAFE) =====

        generateGameCode() {
            if (window.NocapUtils && window.NocapUtils.generateGameId) {
                return window.NocapUtils.generateGameId();
            }

            // Fallback
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

        // P0 FIX: Safe player ID generation
        generatePlayerId(playerName, isHost = false) {
            // P0 FIX: Sanitize player name
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

        // ===== P0 FIX: CREATE GAME (HOST) =====

        async createGame(gameData) {
            if (!this.isConnected) {
                throw new Error('Keine Firebase-Verbindung. Bitte prüfe deine Internetverbindung.');
            }

            try {
                // P0 FIX: Validate and sanitize input
                const validation = this._validateGameData(gameData);
                if (!validation.valid) {
                    throw new Error(validation.error);
                }

                const gameId = gameData.gameId || this.generateGameCode();
                const hostPlayerId = this.generatePlayerId(gameData.hostName, true);

                if (this.isDevelopment) {
                    console.log(`🎮 Creating game: ${gameId}`);
                }

                // P0 FIX: Sanitize all user input
                const sanitizedHostName = window.NocapUtils
                    ? window.NocapUtils.sanitizeInput(gameData.hostName)
                    : gameData.hostName;

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

                // P1 FIX: Success notification
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

                // P1 FIX: User-friendly error
                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(
                        'Spiel konnte nicht erstellt werden',
                        'error'
                    );
                }

                throw error;
            }
        }

        // P0 FIX: Validate game data
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

        // ===== P0 FIX: JOIN GAME (GUEST) =====

        async joinGame(gameId, playerName) {
            if (!this.isConnected) {
                throw new Error('Keine Firebase-Verbindung. Bitte prüfe deine Internetverbindung.');
            }

            try {
                if (this.isDevelopment) {
                    console.log(`🔄 Joining game: ${gameId}`);
                }

                // P0 FIX: Validate game ID
                const gameIdValidation = window.NocapUtils
                    ? window.NocapUtils.validateGameId(gameId)
                    : { valid: gameId && gameId.length === 6, gameId: gameId };

                if (!gameIdValidation.valid) {
                    throw new Error('Ungültiger Game-Code. Code muss 6 Zeichen haben.');
                }

                // P0 FIX: Validate and sanitize player name
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

                const playerId = this.generatePlayerId(sanitizedName, false);

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

                // P1 FIX: Success notification
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

                // P1 FIX: User-friendly error
                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(
                        error.message,
                        'error'
                    );
                }

                throw error;
            }
        }

        // ===== CONNECT TO GAME =====

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

                // P1 FIX: Setup listeners with proper tracking
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

        // ===== PLAYER MANAGEMENT =====

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

        // ===== GAME CONTROL =====

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

                // P1 FIX: Success notification
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

        // ===== LEAVE & CLEANUP =====

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

        // P1 FIX: Proper cleanup with Map iteration
        cleanup() {
            if (this.isDevelopment) {
                console.log('🧹 FirebaseGameService cleanup...');
            }

            // Set player offline on cleanup
            if (this.currentGameId && this.currentPlayerId) {
                this.setPlayerOnline(this.currentGameId, this.currentPlayerId, false);
            }

            // P1 FIX: Remove all listeners properly
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

        // ===== UTILITY METHODS =====

        async _delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        // ===== STATUS GETTERS =====

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
    }

    // ===== SINGLETON INSTANCE =====

    if (typeof window.firebaseGameService === 'undefined') {
        window.firebaseGameService = new FirebaseGameService();
        window.FirebaseGameService = FirebaseGameService;

        const isDev = window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';

        if (isDev) {
            console.log('%c✅ FirebaseGameService v4.0 loaded (Audit-Fixed)',
                'color: #FF6F00; font-weight: bold; font-size: 12px');
        }
    }

    // ===== P1 FIX: LIFECYCLE HANDLERS =====

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (window.firebaseGameService) {
            window.firebaseGameService.cleanup();
        }
    });

    // P1 FIX: Handle tab visibility changes
    document.addEventListener('visibilitychange', () => {
        if (window.firebaseGameService &&
            window.firebaseGameService.currentGameId &&
            window.firebaseGameService.currentPlayerId) {
            const online = !document.hidden;
            window.firebaseGameService.setPlayerOnline(
                window.firebaseGameService.currentGameId,
                window.firebaseGameService.currentPlayerId,
                online
            );
        }
    });

})(window);