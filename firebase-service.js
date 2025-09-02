// ===== KORRIGIERTER FIREBASE SERVICE =====
class FirebaseGameService {
    constructor() {
        this.app = null;
        this.database = null;
        this.isInitialized = false;
        this.isConnected = false;
        
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
            const testRef = this.database.ref('.info/connected');
            const snapshot = await Promise.race([
                testRef.once('value'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
            ]);
            
            this.isConnected = snapshot.val() === true;
            this.isInitialized = this.isConnected;
            
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
        if (!this.isConnected) {
            console.error('❌ Cannot listen - not connected');
            return null;
        }

        try {
            console.log(`🎧 Setting up listener for: ${gameId}`);
            
            const gameRef = this.database.ref(`games/${gameId}`);
            
            const listener = gameRef.on('value', (snapshot) => {
                if (snapshot.exists()) {
                    const gameData = snapshot.val();
                    console.log('🔄 Game update received:', {
                        gameState: gameData.gameState,
                        playerCount: gameData.players ? Object.keys(gameData.players).length : 0
                    });
                    callback(gameData);
                } else {
                    console.log('❌ Game no longer exists');
                    callback(null);
                }
            }, (error) => {
                console.error('❌ Listener error:', error);
                callback(null);
            });

            return () => {
                console.log(`🔇 Removing listener for: ${gameId}`);
                gameRef.off('value', listener);
            };

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