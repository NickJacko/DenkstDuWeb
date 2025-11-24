/**
 * No-Cap Firebase Game Service
 * Version 3.2 - Production Ready & Security Hardened
 *
 * This is the PRIMARY Firebase service for all game operations.
 * Requires firebase-config.js to be loaded first!
 */

'use strict';

class FirebaseGameService {
    constructor() {
        this.app = null;
        this.auth = null;
        this.database = null;
        this.isInitialized = false;
        this.isConnected = false;
        this.gameRef = null;
        this.playersRef = null;
        this.settingsRef = null;
        this.currentRoundRef = null;
        this.currentGameId = null;
        this.currentPlayerId = null;
        this.listeners = [];
        this.connectionListeners = [];
        this.rejoinAttempted = false;
    }

    // ===== INITIALIZATION =====

    async initialize(gameId = null, callbacks = {}) {
        try {
            console.log('🔥 FirebaseGameService v3.2 - Starting initialization...');

            // STEP 1: Check Firebase SDK
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK not loaded. Include Firebase scripts before this file.');
            }

            // STEP 2: Use existing Firebase App (initialized by firebase-config.js)
            if (!firebase.apps || firebase.apps.length === 0) {
                throw new Error('Firebase App not initialized. Load firebase-config.js first!');
            }

            this.app = firebase.app();
            this.auth = firebase.auth();
            this.database = firebase.database();

            console.log('✅ Firebase SDK ready');

            // STEP 3: Wait for authentication
            await this.waitForAuth();

            // STEP 4: Test connection with retry
            console.log('🔄 Testing Firebase connection...');
            this.isConnected = await this.testConnectionWithRetry();

            if (!this.isConnected) {
                console.warn('⚠️ Firebase connection failed - Offline mode active');
            } else {
                console.log('✅ Firebase connection successful');
            }

            // STEP 5: Setup connection monitoring
            this.setupConnectionMonitoring();

            // STEP 6: Attempt rejoin (if applicable)
            if (this.isConnected && !gameId) {
                const rejoinSuccess = await this.attemptRejoin();
                if (rejoinSuccess) {
                    console.log('✅ Automatic rejoin successful');
                }
            }

            // STEP 7: Connect to specific game (if gameId provided)
            if (this.isConnected && gameId) {
                console.log(`🎮 Connecting to game: ${gameId}`);
                await this.connectToGame(gameId, callbacks);
            }

            this.isInitialized = true;

            if (this.isInitialized && this.isConnected) {
                console.log(`🎉 FirebaseGameService ready! ${gameId ? `(Game: ${gameId})` : ''}`);
            } else if (this.isInitialized) {
                console.warn('⚠️ FirebaseGameService in offline mode');
            }

            return this.isInitialized;

        } catch (error) {
            console.error('❌ Firebase initialization failed:', error);
            this.isInitialized = false;
            this.isConnected = false;
            this.logDetailedError(error);
            throw error;
        }
    }

    async waitForAuth(maxWaitTime = 5000) {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.warn('⚠️ Auth timeout - continuing anyway');
                resolve(false);
            }, maxWaitTime);

            if (this.auth.currentUser) {
                clearTimeout(timeout);
                console.log('✅ Auth ready (user already signed in)');
                resolve(true);
                return;
            }

            const unsubscribe = this.auth.onAuthStateChanged((user) => {
                if (user) {
                    clearTimeout(timeout);
                    unsubscribe();
                    console.log('✅ Auth ready (user signed in)');
                    resolve(true);
                }
            });
        });
    }

    // ===== REJOIN MECHANISM =====

    async attemptRejoin() {
        if (this.rejoinAttempted) return false;
        this.rejoinAttempted = true;

        try {
            const gameId = localStorage.getItem('nocap_currentGameId');
            const playerId = localStorage.getItem('nocap_currentPlayerId');
            const playerName = localStorage.getItem('nocap_playerName');

            if (!gameId || !playerId) {
                console.log('ℹ️ No rejoin data found');
                return false;
            }

            console.log(`🔄 Attempting rejoin: ${gameId} as ${playerId}`);

            // Check if game still exists
            const gameRef = this.database.ref(`games/${gameId}`);
            const snapshot = await gameRef.once('value');

            if (!snapshot.exists()) {
                console.warn('⚠️ Game no longer exists - clearing local data');
                this.clearRejoinData();
                return false;
            }

            const gameData = snapshot.val();

            // Check if player still in game
            if (!gameData.players || !gameData.players[playerId]) {
                console.warn('⚠️ Player no longer in game - clearing local data');
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

            console.log('✅ Rejoin successful');
            return true;

        } catch (error) {
            console.error('❌ Rejoin failed:', error);
            this.clearRejoinData();
            return false;
        }
    }

    saveRejoinData(gameId, playerId, playerName) {
        try {
            localStorage.setItem('nocap_currentGameId', gameId);
            localStorage.setItem('nocap_currentPlayerId', playerId);
            localStorage.setItem('nocap_playerName', playerName);
            localStorage.setItem('nocap_lastActive', Date.now().toString());
        } catch (error) {
            console.warn('⚠️ Could not save rejoin data:', error);
        }
    }

    clearRejoinData() {
        try {
            localStorage.removeItem('nocap_currentGameId');
            localStorage.removeItem('nocap_currentPlayerId');
            localStorage.removeItem('nocap_playerName');
            localStorage.removeItem('nocap_lastActive');
        } catch (error) {
            console.warn('⚠️ Could not clear rejoin data:', error);
        }
    }

    // ===== CONNECTION TESTING =====

    async testConnectionWithRetry(maxRetries = 3, timeoutMs = 8000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`🔄 Connection attempt ${attempt}/${maxRetries}...`);

            try {
                const connected = await this.performConnectionTest(timeoutMs);
                if (connected) {
                    console.log(`✅ Connected on attempt ${attempt}`);
                    return true;
                }
            } catch (error) {
                console.warn(`⚠️ Attempt ${attempt} failed:`, error.message);
            }

            if (attempt < maxRetries) {
                await this.delay(1000 * attempt);
            }
        }

        console.error('❌ All connection attempts failed');
        return false;
    }

    async performConnectionTest(timeoutMs = 8000) {
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

    // ===== CONNECTION MONITORING =====

    setupConnectionMonitoring() {
        if (!this.database) return;

        try {
            const connectedRef = this.database.ref('.info/connected');

            const connectionListener = connectedRef.on('value', (snapshot) => {
                const wasConnected = this.isConnected;
                this.isConnected = snapshot.val() === true;

                if (wasConnected !== this.isConnected) {
                    console.log(`🔄 Connection status: ${this.isConnected ? '✅ Connected' : '⚠️ Disconnected'}`);
                    this.notifyConnectionChange(this.isConnected);

                    // Auto-rejoin on reconnection
                    if (this.isConnected && this.currentGameId && this.currentPlayerId) {
                        this.updatePlayerStatus(this.currentGameId, this.currentPlayerId, {
                            isOnline: true
                        });
                    }
                }
            });

            this.listeners.push({ ref: connectedRef, listener: connectionListener, type: 'connection' });

        } catch (error) {
            console.error('❌ Error setting up connection monitoring:', error);
        }
    }

    onConnectionChange(callback) {
        if (typeof callback === 'function') {
            this.connectionListeners.push(callback);
        }
    }

    notifyConnectionChange(connected) {
        this.connectionListeners.forEach(callback => {
            try {
                callback(connected);
            } catch (error) {
                console.error('❌ Error notifying connection change:', error);
            }
        });
    }

    // ===== GAME ID & PLAYER ID GENERATION =====

    generateGameCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }

    generatePlayerId(playerName, isHost = false) {
        const prefix = isHost ? 'host' : 'guest';
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6);
        const safeName = (playerName || 'player')
            .replace(/[^a-zA-Z0-9]/g, '')
            .toLowerCase()
            .substring(0, 10);
        return `${prefix}_${safeName}_${timestamp}_${random}`;
    }

    // ===== CREATE GAME (HOST) =====

    async createGame(gameData) {
        if (!this.isConnected) {
            throw new Error('No Firebase connection. Please check your internet connection.');
        }

        try {
            const gameId = gameData.gameId || this.generateGameCode();
            const hostPlayerId = this.generatePlayerId(gameData.hostName, true);

            console.log(`🎮 Creating game: ${gameId} with host: ${hostPlayerId}`);

            const gameObject = {
                gameId: gameId,
                gameState: 'lobby',
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP,
                categories: gameData.categories || [],
                difficulty: gameData.difficulty || 'medium',
                alcoholMode: gameData.alcoholMode !== undefined ? gameData.alcoholMode : true,
                maxPlayers: 8,
                currentRound: 0,
                hostId: hostPlayerId,

                players: {
                    [hostPlayerId]: {
                        id: hostPlayerId,
                        name: gameData.hostName,
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

            console.log(`✅ Game created: ${gameId}`);

            this.currentGameId = gameId;
            this.currentPlayerId = hostPlayerId;
            this.gameRef = gameRef;

            // Save for rejoin
            this.saveRejoinData(gameId, hostPlayerId, gameData.hostName);

            return {
                gameId: gameId,
                playerId: hostPlayerId,
                gameRef: gameRef
            };

        } catch (error) {
            console.error('❌ Error creating game:', error);
            throw new Error('Could not create game. Please try again.');
        }
    }

    // ===== JOIN GAME (GUEST) =====

    async joinGame(gameId, playerName) {
        if (!this.isConnected) {
            throw new Error('No Firebase connection. Please check your internet connection.');
        }

        try {
            console.log(`🔄 Joining game: ${gameId} as ${playerName}`);

            // Input validation
            if (!gameId || gameId.length !== 6) {
                throw new Error('Invalid game code. Code must be 6 characters long.');
            }

            // Sanitize player name
            const sanitizedName = typeof window.NocapUtils !== 'undefined'
                ? window.NocapUtils.sanitizeInput(playerName)
                : playerName.trim();

            if (!sanitizedName || sanitizedName.length < 2) {
                throw new Error('Player name must be at least 2 characters long.');
            }

            if (sanitizedName.length > 20) {
                throw new Error('Player name must be at most 20 characters long.');
            }

            const gameRef = this.database.ref(`games/${gameId.toUpperCase()}`);
            const gameSnapshot = await gameRef.once('value');

            if (!gameSnapshot.exists()) {
                throw new Error('Game not found. Please check the code.');
            }

            const gameData = gameSnapshot.val();

            if (gameData.gameState !== 'lobby') {
                throw new Error('Game already started. Cannot join.');
            }

            const currentPlayerCount = gameData.players ? Object.keys(gameData.players).length : 0;
            if (currentPlayerCount >= gameData.maxPlayers) {
                throw new Error(`Game is full. Maximum ${gameData.maxPlayers} players allowed.`);
            }

            // Check if name is already taken
            const existingPlayers = gameData.players || {};
            const nameTaken = Object.values(existingPlayers).some(
                p => p.name.toLowerCase() === sanitizedName.toLowerCase()
            );
            if (nameTaken) {
                throw new Error('Name already taken. Please choose a different name.');
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

            console.log(`✅ Successfully joined: ${gameId} as ${playerId}`);

            this.currentGameId = gameId.toUpperCase();
            this.currentPlayerId = playerId;
            this.gameRef = gameRef;

            // Save for rejoin
            this.saveRejoinData(gameId.toUpperCase(), playerId, sanitizedName);

            return {
                gameId: gameId.toUpperCase(),
                playerId: playerId,
                gameRef: gameRef,
                gameData: gameData
            };

        } catch (error) {
            console.error('❌ Error joining game:', error);

            // Re-throw with user-friendly message if not already friendly
            if (error.message.includes('not found') ||
                error.message.includes('already started') ||
                error.message.includes('is full') ||
                error.message.includes('already taken') ||
                error.message.includes('Invalid')) {
                throw error;
            }

            throw new Error('Failed to join game. Please check the code and try again.');
        }
    }

    // ===== CONNECT TO GAME =====

    async connectToGame(gameId, callbacks = {}) {
        if (!this.isConnected || !gameId) {
            return false;
        }

        try {
            console.log(`🔗 Connecting to game: ${gameId}`);

            this.currentGameId = gameId;
            this.gameRef = this.database.ref(`games/${gameId}`);

            const snapshot = await this.gameRef.once('value');
            if (!snapshot.exists()) {
                console.warn(`⚠️ Game ${gameId} does not exist`);
                return false;
            }

            // Setup listeners
            if (callbacks.onGameUpdate && typeof callbacks.onGameUpdate === 'function') {
                const gameListener = this.gameRef.on('value', callbacks.onGameUpdate);
                this.listeners.push({ ref: this.gameRef, listener: gameListener, type: 'game' });
            }

            if (callbacks.onPlayersUpdate && typeof callbacks.onPlayersUpdate === 'function') {
                const playersRef = this.gameRef.child('players');
                const playersListener = playersRef.on('value', callbacks.onPlayersUpdate);
                this.listeners.push({ ref: playersRef, listener: playersListener, type: 'players' });
            }

            console.log(`✅ Successfully connected to game: ${gameId}`);
            return true;

        } catch (error) {
            console.error(`❌ Error connecting to game ${gameId}:`, error);
            return false;
        }
    }

    // ===== PLAYER MANAGEMENT =====

    async updatePlayerStatus(gameId, playerId, updates) {
        if (!this.isConnected) {
            console.warn('⚠️ Offline - Player status will sync on reconnection');
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
            console.log(`🗑️ Player removed: ${playerId}`);
            return true;
        } catch (error) {
            console.error('❌ Error removing player:', error);
            return false;
        }
    }

    // ===== GAME CONTROL =====

    async startGame(gameId) {
        if (!this.isConnected) {
            throw new Error('No Firebase connection available');
        }

        try {
            const gameRef = this.database.ref(`games/${gameId}`);
            await gameRef.update({
                gameState: 'playing',
                startedAt: firebase.database.ServerValue.TIMESTAMP,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });

            console.log(`🚀 Game started: ${gameId}`);
            return true;

        } catch (error) {
            console.error('❌ Error starting game:', error);
            throw new Error('Could not start game.');
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
            console.log(`🗑️ Game deleted: ${gameId}`);
            this.clearRejoinData();
            return true;
        } catch (error) {
            console.error('❌ Error deleting game:', error);
            return false;
        }
    }

    // ===== LEAVE & CLEANUP =====

    async leaveGame(gameId, playerId) {
        console.log(`👋 Leaving game: ${gameId}`);

        // Mark player as offline
        await this.setPlayerOnline(gameId, playerId, false);

        // Clear rejoin data
        this.clearRejoinData();

        return true;
    }

    cleanup() {
        console.log('🧹 FirebaseGameService cleanup...');

        // Set player offline on cleanup
        if (this.currentGameId && this.currentPlayerId) {
            this.setPlayerOnline(this.currentGameId, this.currentPlayerId, false);
        }

        // Remove all listeners
        this.listeners.forEach(({ ref, listener }) => {
            try {
                ref.off('value', listener);
            } catch (error) {
                console.error('❌ Error removing listener:', error);
            }
        });

        this.listeners = [];
        this.connectionListeners = [];
        this.gameRef = null;
        this.currentGameId = null;
        this.currentPlayerId = null;

        console.log('✅ FirebaseGameService cleaned up');
    }

    // ===== UTILITY METHODS =====

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    logDetailedError(error) {
        console.group('🔍 Firebase Error Details:');
        console.error('Error:', error);
        console.log('Firebase App:', this.app);
        console.log('Firebase Auth:', this.auth);
        console.log('Firebase Database:', this.database);
        console.log('Connection Status:', this.isConnected);
        console.log('Initialized:', this.isInitialized);
        console.log('Current Game ID:', this.currentGameId);
        console.log('Current Player ID:', this.currentPlayerId);
        console.groupEnd();
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
            listenersCount: this.listeners.length,
            connectionListenersCount: this.connectionListeners.length,
            canRejoin: !!(this.currentGameId && this.currentPlayerId)
        };
    }
}

// ===== SINGLETON INSTANCE =====

if (typeof window.firebaseGameService === 'undefined') {
    window.firebaseGameService = new FirebaseGameService();
    window.FirebaseGameService = FirebaseGameService;
    console.log('✅ FirebaseGameService v3.2 initialized (Production Ready)');
} else {
    console.warn('⚠️ FirebaseGameService already exists - using existing instance');
}

// ===== LIFECYCLE HANDLERS =====

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.firebaseGameService) {
        window.firebaseGameService.cleanup();
    }
});

// Handle tab visibility changes
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

// ===== DEBUG FUNCTIONS (Development only) =====

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.debugFirebase = function() {
        console.log('🔍 Firebase Debug Info:');
        console.log('Status:', window.firebaseGameService.getStatus());
        console.log('Firebase Apps:', firebase.apps.length);
        console.log('Auth User:', firebase.auth().currentUser);
        return window.firebaseGameService;
    };

    console.log('🛠️ Debug command: debugFirebase()');
}

console.log('✅ FirebaseGameService v3.2 loaded - Production Ready!');