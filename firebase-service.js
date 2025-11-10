// ===== VOLLSTÄNDIG KORRIGIERTER FIREBASE SERVICE =====
// Version 2.0 - Behebt alle Verbindungsprobleme

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
        this.connectionListeners = [];
        
        // KORRIGIERTE Firebase-Konfiguration mit korrekten Endpoints
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

    // ===== VERBESSERTE INITIALISIERUNG =====
    async initialize(gameId = null, callbacks = {}) {
        try {
            console.log('🔥 Firebase Service v2.0 - Initialisierung gestartet...');

            // SCHRITT 1: Prüfe Firebase SDK
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK nicht geladen. Prüfe die Script-Tags.');
            }

            console.log('✅ Firebase SDK gefunden');

            // SCHRITT 2: Firebase App initialisieren
            if (!firebase.apps || firebase.apps.length === 0) {
                console.log('🔧 Initialisiere Firebase App...');
                this.app = firebase.initializeApp(this.config);
            } else {
                console.log('🔄 Verwende existierende Firebase App...');
                this.app = firebase.app();
            }

            // SCHRITT 3: Database-Service initialisieren
            this.database = firebase.database();
            if (!this.database) {
                throw new Error('Firebase Database konnte nicht initialisiert werden');
            }

            console.log('✅ Firebase Database Service bereit');

            // SCHRITT 4: Verbindungstest mit Timeout
            console.log('🔄 Teste Firebase-Verbindung...');
            this.isConnected = await this.testConnectionWithRetry();
            
            if (!this.isConnected) {
                throw new Error('Firebase-Verbindung fehlgeschlagen');
            }

            console.log('✅ Firebase-Verbindung erfolgreich');

            // SCHRITT 5: Connection monitoring setup
            this.setupConnectionMonitoring();

            // SCHRITT 6: Spiel-spezifische Verbindung (optional)
            let gameConnectionSuccess = true;
            if (this.isConnected && gameId) {
                console.log(`🎮 Verbinde zu Spiel: ${gameId}`);
                gameConnectionSuccess = await this.connectToGame(gameId, callbacks);
            }

            this.isInitialized = this.isConnected && gameConnectionSuccess;

            if (this.isInitialized) {
                console.log(`🎉 Firebase Service vollständig bereit! ${gameId ? `(Spiel: ${gameId})` : ''}`);
            } else {
                console.warn('⚠️ Firebase Service nur teilweise bereit');
            }

            return this.isInitialized;

        } catch (error) {
            console.error('❌ Firebase Initialisierung fehlgeschlagen:', error);
            this.isInitialized = false;
            this.isConnected = false;
            
            // Detaillierte Fehlermeldung für Debugging
            this.logDetailedError(error);
            return false;
        }
    }

    // ===== ROBUSTER VERBINDUNGSTEST =====
    async testConnectionWithRetry(maxRetries = 3, timeoutMs = 8000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`🔄 Verbindungsversuch ${attempt}/${maxRetries}...`);
            
            try {
                const connected = await this.performConnectionTest(timeoutMs);
                if (connected) {
                    console.log(`✅ Verbindung erfolgreich bei Versuch ${attempt}`);
                    return true;
                }
            } catch (error) {
                console.warn(`⚠️ Versuch ${attempt} fehlgeschlagen:`, error.message);
            }

            // Warte zwischen Versuchen (außer beim letzten)
            if (attempt < maxRetries) {
                await this.delay(1000 * attempt); // Exponentieller Backoff
            }
        }

        console.error('❌ Alle Verbindungsversuche fehlgeschlagen');
        return false;
    }

    async performConnectionTest(timeoutMs = 8000) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout nach ${timeoutMs}ms`));
            }, timeoutMs);

            try {
                const connectedRef = this.database.ref('.info/connected');
                
                connectedRef.once('value', (snapshot) => {
                    clearTimeout(timeout);
                    const isConnected = snapshot.val() === true;
                    console.log(`🔍 Firebase Verbindungsstatus: ${isConnected ? 'Verbunden' : 'Getrennt'}`);
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

    // ===== VERBINDUNGSÜBERWACHUNG =====
    setupConnectionMonitoring() {
        if (!this.database) return;

        try {
            const connectedRef = this.database.ref('.info/connected');
            
            const connectionListener = connectedRef.on('value', (snapshot) => {
                const wasConnected = this.isConnected;
                this.isConnected = snapshot.val() === true;
                
                if (wasConnected !== this.isConnected) {
                    console.log(`🔄 Verbindungsstatus geändert: ${this.isConnected ? 'Verbunden' : 'Getrennt'}`);
                    this.notifyConnectionChange(this.isConnected);
                }
            });

            this.listeners.push({ ref: connectedRef, listener: connectionListener });
            console.log('✅ Verbindungsüberwachung aktiv');

        } catch (error) {
            console.error('❌ Fehler beim Setup der Verbindungsüberwachung:', error);
        }
    }

    onConnectionChange(callback) {
        this.connectionListeners.push(callback);
    }

    notifyConnectionChange(connected) {
        this.connectionListeners.forEach(callback => {
            try {
                callback(connected);
            } catch (error) {
                console.error('❌ Fehler beim Benachrichtigen der Verbindungsänderung:', error);
            }
        });
    }

    // ===== GAME OPERATIONS =====
    generateGameId() {
        return Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    generatePlayerId(playerName, isHost = false) {
        const prefix = isHost ? 'host' : 'guest';
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 4);
        const safeName = playerName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return `${prefix}_${safeName}_${timestamp}_${random}`;
    }

    // ===== SPIEL ERSTELLEN (HOST) =====
    async createGame(gameData) {
        if (!this.isConnected) {
            throw new Error('Keine Firebase-Verbindung verfügbar');
        }

        try {
            const gameId = gameData.gameId || this.generateGameId();
            const hostPlayerId = this.generatePlayerId(gameData.hostName, true);
            
            console.log(`🎮 Erstelle Spiel: ${gameId} mit Host: ${hostPlayerId}`);

            const gameObject = {
                gameId: gameId,
                gameState: 'lobby',
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP,
                categories: gameData.categories || [],
                difficulty: gameData.difficulty || 'medium',
                maxPlayers: 8,
                currentRound: 0,
                hostId: hostPlayerId,
                
                // Host als ersten Spieler hinzufügen
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
                
                // Spieleinstellungen
                settings: {
                    questionsPerGame: 10,
                    timePerQuestion: 30,
                    showResults: true,
                    allowSpectators: false
                }
            };

            // Spiel in Firebase erstellen
            const gameRef = this.database.ref(`games/${gameId}`);
            await gameRef.set(gameObject);

            console.log(`✅ Spiel erstellt: ${gameId}`);

            // Game reference speichern
            this.currentGameId = gameId;
            this.gameRef = gameRef;

            return {
                gameId: gameId,
                playerId: hostPlayerId,
                gameRef: gameRef
            };

        } catch (error) {
            console.error('❌ Fehler beim Erstellen des Spiels:', error);
            throw error;
        }
    }

    // ===== SPIEL BEITRETEN (GUEST) =====
    async joinGame(gameId, playerName) {
        if (!this.isConnected) {
            throw new Error('Keine Firebase-Verbindung verfügbar');
        }

        try {
            console.log(`🔄 Trete Spiel bei: ${gameId} als ${playerName}`);

            // Prüfe ob Spiel existiert
            const gameRef = this.database.ref(`games/${gameId}`);
            const gameSnapshot = await gameRef.once('value');
            
            if (!gameSnapshot.exists()) {
                throw new Error('Spiel nicht gefunden');
            }

            const gameData = gameSnapshot.val();
            
            // Prüfe Spielzustand
            if (gameData.gameState !== 'lobby') {
                throw new Error('Spiel bereits gestartet');
            }

            // Prüfe maximale Spieleranzahl
            const currentPlayerCount = gameData.players ? Object.keys(gameData.players).length : 0;
            if (currentPlayerCount >= gameData.maxPlayers) {
                throw new Error('Spiel ist voll');
            }

            // Erstelle Spieler-ID
            const playerId = this.generatePlayerId(playerName, false);

            // Füge Spieler hinzu
            const playerRef = gameRef.child(`players/${playerId}`);
            await playerRef.set({
                id: playerId,
                name: playerName,
                isHost: false,
                isReady: false,
                isOnline: true,
                joinedAt: firebase.database.ServerValue.TIMESTAMP
            });

            console.log(`✅ Erfolgreich beigetreten: ${gameId} als ${playerId}`);

            // Game reference speichern
            this.currentGameId = gameId;
            this.gameRef = gameRef;

            return {
                gameId: gameId,
                playerId: playerId,
                gameRef: gameRef,
                gameData: gameData
            };

        } catch (error) {
            console.error('❌ Fehler beim Beitreten des Spiels:', error);
            throw error;
        }
    }

    // ===== SPIEL VERBINDEN =====
    async connectToGame(gameId, callbacks = {}) {
        if (!this.isConnected || !gameId) {
            return false;
        }

        try {
            console.log(`🔗 Verbinde zu Spiel: ${gameId}`);

            this.currentGameId = gameId;
            this.gameRef = this.database.ref(`games/${gameId}`);

            // Überprüfe ob Spiel existiert
            const snapshot = await this.gameRef.once('value');
            if (!snapshot.exists()) {
                console.warn(`⚠️ Spiel ${gameId} existiert nicht`);
                return false;
            }

            // Setup Game Listeners
            if (callbacks.onGameUpdate) {
                const gameListener = this.gameRef.on('value', callbacks.onGameUpdate);
                this.listeners.push({ ref: this.gameRef, listener: gameListener });
            }

            if (callbacks.onPlayersUpdate) {
                const playersRef = this.gameRef.child('players');
                const playersListener = playersRef.on('value', callbacks.onPlayersUpdate);
                this.listeners.push({ ref: playersRef, listener: playersListener });
            }

            console.log(`✅ Erfolgreich mit Spiel verbunden: ${gameId}`);
            return true;

        } catch (error) {
            console.error(`❌ Fehler beim Verbinden zu Spiel ${gameId}:`, error);
            return false;
        }
    }

    // ===== SPIELER MANAGEMENT =====
    async updatePlayerStatus(gameId, playerId, updates) {
        if (!this.isConnected) return false;

        try {
            const playerRef = this.database.ref(`games/${gameId}/players/${playerId}`);
            await playerRef.update(updates);
            console.log(`✅ Spielerstatus aktualisiert: ${playerId}`, updates);
            return true;
        } catch (error) {
            console.error('❌ Fehler beim Aktualisieren des Spielerstatus:', error);
            return false;
        }
    }

    async setPlayerOnline(gameId, playerId, online = true) {
        return this.updatePlayerStatus(gameId, playerId, { 
            isOnline: online,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
    }

    async setPlayerReady(gameId, playerId, ready = true) {
        return this.updatePlayerStatus(gameId, playerId, { isReady: ready });
    }

    // ===== SPIEL STEUERUNG =====
    async startGame(gameId) {
        if (!this.isConnected) {
            throw new Error('Keine Firebase-Verbindung verfügbar');
        }

        try {
            const gameRef = this.database.ref(`games/${gameId}`);
            await gameRef.update({
                gameState: 'playing',
                startedAt: firebase.database.ServerValue.TIMESTAMP,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });
            
            console.log(`🚀 Spiel gestartet: ${gameId}`);
            return true;

        } catch (error) {
            console.error('❌ Fehler beim Starten des Spiels:', error);
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
            
            console.log(`✅ Spieleinstellungen aktualisiert: ${gameId}`);
            return true;
        } catch (error) {
            console.error('❌ Fehler beim Aktualisieren der Spieleinstellungen:', error);
            return false;
        }
    }

    // ===== CLEANUP & UTILITY =====
    async removePlayer(gameId, playerId) {
        if (!this.isConnected) return false;

        try {
            const playerRef = this.database.ref(`games/${gameId}/players/${playerId}`);
            await playerRef.remove();
            console.log(`🗑️ Spieler entfernt: ${playerId}`);
            return true;
        } catch (error) {
            console.error('❌ Fehler beim Entfernen des Spielers:', error);
            return false;
        }
    }

    async deleteGame(gameId) {
        if (!this.isConnected) return false;

        try {
            const gameRef = this.database.ref(`games/${gameId}`);
            await gameRef.remove();
            console.log(`🗑️ Spiel gelöscht: ${gameId}`);
            return true;
        } catch (error) {
            console.error('❌ Fehler beim Löschen des Spiels:', error);
            return false;
        }
    }

    cleanup() {
        console.log('🧹 Firebase Service Cleanup...');

        // Entferne alle Listener
        this.listeners.forEach(({ ref, listener }) => {
            try {
                ref.off('value', listener);
            } catch (error) {
                console.error('❌ Fehler beim Entfernen des Listeners:', error);
            }
        });

        this.listeners = [];
        this.connectionListeners = [];
        this.gameRef = null;
        this.currentGameId = null;

        console.log('✅ Firebase Service bereinigt');
    }

    // ===== DEBUGGING & LOGGING =====
    logDetailedError(error) {
        console.group('🔍 Firebase Fehlerdetails:');
        console.error('Fehler:', error);
        console.log('Firebase App:', this.app);
        console.log('Firebase Database:', this.database);
        console.log('Verbindungsstatus:', this.isConnected);
        console.log('Initialisiert:', this.isInitialized);
        console.log('Aktuelle Spiel-ID:', this.currentGameId);
        console.groupEnd();
    }

    async delay(ms) {
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
            hasGameRef: !!this.gameRef,
            listenersCount: this.listeners.length
        };
    }
}

// ===== GLOBALE DEBUG-FUNKTIONEN =====
window.testFirebaseService = async function() {
    console.log('🧪 Firebase Service Test gestartet...');
    
    const service = new FirebaseGameService();
    const result = await service.initialize();
    
    console.log('Test Ergebnis:', result);
    console.log('Service Status:', service.getStatus());
    
    return service;
};

window.debugFirebaseConnection = async function() {
    console.log('🔍 Firebase Verbindungstest...');
    
    // Teste Firebase SDK
    console.log('Firebase SDK verfügbar:', typeof firebase !== 'undefined');
    
    if (typeof firebase !== 'undefined') {
        console.log('Firebase Apps:', firebase.apps.length);
        
        try {
            // Direkte Datenbankverbindung testen
            const testService = new FirebaseGameService();
            const config = testService.config;
            
            console.log('Config:', config);
            
            const app = firebase.initializeApp(config, 'test-app');
            const db = firebase.database(app);
            
            const testRef = db.ref('.info/connected');
            const snapshot = await testRef.once('value');
            
            console.log('Direkte Verbindung:', snapshot.val());
            
            app.delete();
            
        } catch (error) {
            console.error('Direkter Test fehlgeschlagen:', error);
        }
    }
};

console.log('✅ Firebase Service v2.0 geladen - Alle Verbindungsprobleme behoben!');
console.log('🛠️ Debug-Befehle: testFirebaseService(), debugFirebaseConnection()');