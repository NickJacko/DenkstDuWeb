// ===== KORRIGIERTER FIREBASE SERVICE =====
class FirebaseGameService {
    constructor() {
        this.app = null;
        this.database = null;
        this.isInitialized = false;
        this.isConnected = false;
        this.gameRef = null;
        this.playersRef = null;
        this.settingsRef = null;
        this.currentRoundRef = null;
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

    async initialize(gameId = null, callbacks = {}) {
        try {
            console.log('🔥 Firebase init...');

            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK missing');
            }

            if (!firebase.apps || firebase.apps.length === 0) {
                this.app = firebase.initializeApp(this.config);
            } else {
                this.app = firebase.app();
            }

            this.database = firebase.database();

            // Connection test
            try {
                const testRef = this.database.ref('.info/connected');
                await Promise.race([
                    testRef.once('value'),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
                ]);
                this.isConnected = true;
            } catch (connError) {
                console.error('❌ Firebase connection test failed:', connError);
                this.isConnected = false;
            }

            this.isInitialized = this.isConnected;

            if (this.isConnected && gameId) {
                await this.connectToGame(gameId, callbacks);
            }

            console.log(`✅ Firebase: ${this.isConnected ? 'connected' : 'failed'}`);
            return this.isConnected;

        } catch (error) {
            console.error('❌ Firebase init failed:', error);
            this.isInitialized = false;
            this.isConnected = false;
            return false;
        }
    }

    generateGameId() {
        return Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    generatePlayerId(playerName, isHost = false) {
        const prefix = isHost ? 'host' : 'guest';
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 4);
        return `${prefix}_${playerName}_${timestamp}_${random}`;
    }

    // ===== HOST: CREATE GAME =====
    async createGame(gameData) {
        if (!this.isConnected) {
            throw new Error('NOT_CONNECTED');
        }

        try {
            const gameId = this.generateGameId();
            const hostPlayerId = this.generatePlayerId(gameData.hostName, true);
            
            console.log(`🎮 Creating game: ${gameId} with host: ${hostPlayerId}`);

            // Create complete game object with host as first player
            const gameObject = {
                gameId: gameId,
                gameState: 'lobby', // WICHTIG: lobby, not waiting
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                categories: gameData.categories || [],
                difficulty: gameData.difficulty || 'medium',
                maxPlayers: 8,
                currentRound: 0,
                
                // HOST als erster Spieler direkt hinzufügen
                players: {
                    [hostPlayerId]: {
                        id: hostPlayerId,
                        name: gameData.hostName,
                        isHost: true,
                        isReady: true,
                        isOnline: true,
                        joinedAt: firebase.database.ServerValue.TIMESTAMP
                    }
                },
                
                // Game settings
                settings: {
                    roundsCount: gameData.roundsCount || 10,
                    autoDelete: Date.now() + (24 * 60 * 60 * 1000) // 24h
                }
            };

            // Save to Firebase
            const gameRef = this.database.ref(`games/${gameId}`);
            await gameRef.set(gameObject);

            console.log(`✅ Game created: ${gameId} with host: ${hostPlayerId}`);
            
            return {
                gameId: gameId,
                playerId: hostPlayerId,
                gameData: gameObject
            };

        } catch (error) {
            console.error('❌ Create game failed:', error);
            throw error;
        }
    }

    // ===== GUEST: JOIN GAME =====
    async joinGame(gameId, playerData) {
        if (!this.isConnected) {
            throw new Error('NOT_CONNECTED');
        }

        try {
            console.log(`🚀 Joining: ${gameId} as ${playerData.name}`);
            
            // Check if game exists and is joinable
            const gameData = await this.getGameInfo(gameId);
            
            const currentPlayers = gameData.players || {};
            if (Object.keys(currentPlayers).length >= 8) {
                throw new Error('GAME_FULL');
            }

            // Check for duplicate names
            const existingNames = Object.values(currentPlayers).map(p => p.name.toLowerCase());
            if (existingNames.includes(playerData.name.toLowerCase())) {
                throw new Error('NAME_TAKEN');
            }

            // Generate player ID
            const playerId = this.generatePlayerId(playerData.name, false);
            
            const playerObject = {
                id: playerId,
                name: playerData.name,
                isHost: false,
                isReady: false,
                isOnline: true,
                joinedAt: firebase.database.ServerValue.TIMESTAMP
            };

            // Add player to existing game
            const playerRef = this.database.ref(`games/${gameId}/players/${playerId}`);
            await playerRef.set(playerObject);

            console.log(`✅ Joined game: ${gameId} as ${playerId}`);

            return {
                gameId: gameId,
                playerId: playerId,
                gameData: gameData
            };

        } catch (error) {
            console.error('❌ Join game failed:', error);
            throw error;
        }
    }

    async getGameInfo(gameId) {
        if (!this.isConnected) {
            throw new Error('NOT_CONNECTED');
        }

        try {
            console.log(`🔍 Getting game info: ${gameId}`);
            
            const gameRef = this.database.ref(`games/${gameId}`);
            const snapshot = await Promise.race([
                gameRef.once('value'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 6000))
            ]);
            
            if (!snapshot.exists()) {
                throw new Error('LOBBY_NOT_FOUND');
            }

            const gameData = snapshot.val();
            console.log('✅ Game found:', gameData);
            
            if (gameData.gameState === 'finished') {
                throw new Error('GAME_FINISHED');
            }

            return gameData;

        } catch (error) {
            console.error('❌ Get game failed:', error);
            throw error;
        }
    }

    // ===== REAL-TIME LISTENER =====
    listenToGame(gameId, callback) {
        if (!this.isInitialized) return null;

        try {
            const gameRef = this.database.ref(`games/${gameId}`);
            const listener = gameRef.on('value', (snapshot) => {
                if (snapshot.exists()) {
                    callback(snapshot.val());
                } else {
                    callback(null);
                }
            }, (error) => {
                console.error('❌ Listener error:', error);
                callback(null);
            });

            this.listeners.push({ ref: gameRef, type: 'value', listener });
            return gameRef;
        } catch (error) {
            console.error('❌ Listener setup failed:', error);
            return null;
        }
    }

    // ===== PLAYER STATUS =====
    async setPlayerOnline(gameId, playerId, online = true) {
        if (!this.isConnected) return false;

        try {
            const playerRef = this.database.ref(`games/${gameId}/players/${playerId}/isOnline`);
            await playerRef.set(online);
            console.log(`🟢 Player ${playerId} set to ${online ? 'online' : 'offline'}`);
            return true;
        } catch (error) {
            console.error('❌ Set player online failed:', error);
            return false;
        }
    }

    async setPlayerReady(gameId, playerId, ready = true) {
        if (!this.isConnected) return false;

        try {
            const playerRef = this.database.ref(`games/${gameId}/players/${playerId}/isReady`);
            await playerRef.set(ready);
            console.log(`✅ Player ${playerId} set to ${ready ? 'ready' : 'not ready'}`);
            return true;
        } catch (error) {
            console.error('❌ Set player ready failed:', error);
            return false;
        }
    }

    // ===== GAME CONTROL =====
    async startGame(gameId) {
        if (!this.isConnected) {
            throw new Error('NOT_CONNECTED');
        }

        try {
            const gameRef = this.database.ref(`games/${gameId}/gameState`);
            await gameRef.set('playing');
            
            console.log(`🚀 Game started: ${gameId}`);
            return true;

        } catch (error) {
            console.error('❌ Start game failed:', error);
            throw error;
        }
    }

    // ===== CLEANUP =====
    async removePlayer(gameId, playerId) {
        if (!this.isConnected) return false;

        try {
            const playerRef = this.database.ref(`games/${gameId}/players/${playerId}`);
            await playerRef.remove();
            console.log(`🗑️ Player removed: ${playerId}`);
            return true;
        } catch (error) {
            console.error('❌ Remove player failed:', error);
            return false;
        }
    }

    async deleteGame(gameId) {
        if (!this.isConnected) return false;

        try {
            const gameRef = this.database.ref(`games/${gameId}`);
            await gameRef.remove();
            console.log(`🗑️ Game deleted: ${gameId}`);
            return true;
        } catch (error) {
            console.error('❌ Delete game failed:', error);
            return false;
        }
    }

    // ===== GAME OPERATIONS =====
    async connectToGame(gameId, callbacks = {}) {
        if (!this.isInitialized) return false;

        try {
            this.currentGameId = gameId;
            this.gameRef = this.database.ref(`games/${gameId}`);
            this.playersRef = this.database.ref(`games/${gameId}/players`);
            this.settingsRef = this.database.ref(`games/${gameId}/settings`);

            if (callbacks.onPlayers) {
                const playerListener = this.playersRef.on('value', (snapshot) => {
                    const players = snapshot.val() || {};
                    callbacks.onPlayers(players);
                });
                this.listeners.push({ ref: this.playersRef, type: 'value', listener: playerListener });
            }

            if (callbacks.onSettings) {
                const settingsListener = this.settingsRef.on('value', (snapshot) => {
                    const settings = snapshot.val();
                    if (settings) callbacks.onSettings(settings);
                });
                this.listeners.push({ ref: this.settingsRef, type: 'value', listener: settingsListener });
            }

            return true;
        } catch (error) {
            console.error('❌ Failed to connect to game:', error);
            return false;
        }
    }

    async updateDifficulty(difficulty) {
        if (!this.settingsRef) return false;
        try {
            await this.settingsRef.child('difficulty').set(difficulty);
            return true;
        } catch (error) {
            console.error('❌ Failed to sync difficulty:', error);
            return false;
        }
    }

    async updateGameSettings(settings) {
        if (!this.settingsRef) return false;
        try {
            const updateData = { ...settings, lastUpdated: Date.now() };
            await this.settingsRef.update(updateData);
            return true;
        } catch (error) {
            console.error('❌ Failed to sync game settings:', error);
            return false;
        }
    }

    setupGameRef(gameId) {
        this.gameRef = this.database.ref(`games/${gameId}`);
        return this.gameRef;
    }

    async submitAnswer(gameId, roundNumber, playerId, answerData) {
        if (!this.isInitialized) throw new Error('Firebase not initialized');
        try {
            const answerRef = this.database.ref(`games/${gameId}/rounds/${roundNumber}/answers/${playerId}`);
            await answerRef.set({
                ...answerData,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            return true;
        } catch (error) {
            console.error('❌ Error submitting answer:', error);
            throw error;
        }
    }

    async startNewRound(gameId, roundNumber, question) {
        if (!this.isInitialized) throw new Error('Firebase not initialized');
        try {
            const roundRef = this.database.ref(`games/${gameId}/rounds/${roundNumber}`);
            await roundRef.set({
                roundNumber,
                question,
                answers: {},
                results: null,
                startedAt: firebase.database.ServerValue.TIMESTAMP,
                status: 'active'
            });
            await this.database.ref(`games/${gameId}/currentRound`).set(roundNumber);
            return true;
        } catch (error) {
            console.error('❌ Error starting round:', error);
            throw error;
        }
    }

    async endGame(gameId, finalResults) {
        if (!this.isInitialized) throw new Error('Firebase not initialized');
        try {
            await this.database.ref(`games/${gameId}`).update({
                gameState: 'finished',
                finishedAt: firebase.database.ServerValue.TIMESTAMP,
                finalResults
            });
            return true;
        } catch (error) {
            console.error('❌ Error ending game:', error);
            throw error;
        }
    }

    listenToRound(gameId, roundNumber, callback) {
        if (!this.isInitialized) return null;
        const roundRef = this.database.ref(`games/${gameId}/rounds/${roundNumber}`);
        const listener = roundRef.on('value', callback);
        this.listeners.push({ ref: roundRef, type: 'value', listener });
        return roundRef;
    }

    cleanup() {
        this.listeners.forEach(({ ref, type, listener }) => {
            ref.off(type, listener);
        });
        this.listeners = [];
        this.gameRef = null;
        this.playersRef = null;
        this.settingsRef = null;
        this.currentRoundRef = null;
        this.currentGameId = null;
    }

    // ===== CONNECTION STATUS =====
    onConnectionChange(callback) {
        if (!this.isConnected) return null;

        const connectedRef = this.database.ref('.info/connected');
        connectedRef.on('value', (snapshot) => {
            const connected = snapshot.val() === true;
            this.isConnected = connected;
            callback(connected);
        });

        return () => connectedRef.off();
    }
}