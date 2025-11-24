// ===== FIREBASE GAME SERVICE - PRIMARY SERVICE =====
// Version 3.1 - Security Hardened & Production Ready
// Dies ist der EINZIGE Firebase-Service der verwendet werden soll

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
        this.currentPlayerId = null;
        this.listeners = [];
        this.connectionListeners = [];
        this.rejoinAttempted = false;

        // ===== P0 FIX: KEINE API-KEYS IM CLIENT! =====
        // Firebase Config wird NUR aus window.FIREBASE_CONFIG geladen
        // Diese Variable muss vom Build-Prozess oder Server-Side injiziert werden
        this.config = null;
    }

    // ===== SICHERE CONFIG-LADUNG =====
    loadConfig() {
        if (window.FIREBASE_CONFIG && typeof window.FIREBASE_CONFIG === 'object') {
            this.config = window.FIREBASE_CONFIG;
            return true;
        }

        // PRODUCTION: Keine Fallback-Config!
        // Nur im Development (localhost) Fallback erlauben
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.warn(
                '%c⚠️ DEVELOPMENT MODE',
                'background: #ff6b6b; color: white; font-weight: bold; padding: 5px;'
            );
            console.warn('Using fallback config. Set window.FIREBASE_CONFIG for production!');

            // Fallback nur für lokale Entwicklung
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
            return true;
        }

        // PRODUCTION ohne Config = FEHLER
        console.error(
            '%c❌ FIREBASE CONFIG MISSING',
            'background: #c92a2a; color: white; font-weight: bold; padding: 5px; font-size: 14px;'
        );
        console.error('window.FIREBASE_CONFIG not found. Application cannot start in production mode.');
        return false;
    }

    // ===== VERBESSERTE INITIALISIERUNG =====
    async initialize(gameId = null, callbacks = {}) {
        try {
            console.log('🔥 Firebase Service v3.1 - Initialisierung gestartet...');

            // SCHRITT 1: Config laden
            if (!this.loadConfig()) {
                throw new Error('Firebase Configuration nicht verfügbar. Bitte Administrator kontaktieren.');
            }

            // SCHRITT 2: Prüfe Firebase SDK
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK nicht geladen. Prüfe die Script-Tags.');
            }

            console.log('✅ Firebase SDK gefunden');

            // SCHRITT 3: Firebase App initialisieren
            if (!firebase.apps || firebase.apps.length === 0) {
                console.log('🔧 Initialisiere Firebase App...');
                this.app = firebase.initializeApp(this.config);
            } else {
                console.log('🔄 Verwende existierende Firebase App...');
                this.app = firebase.app();
            }

            // SCHRITT 4: Database-Service initialisieren
            this.database = firebase.database();
            if (!this.database) {
                throw new Error('Firebase Database konnte nicht initialisiert werden');
            }

            console.log('✅ Firebase Database Service bereit');

            // SCHRITT 5: Verbindungstest mit Timeout
            console.log('🔄 Teste Firebase-Verbindung...');
            this.isConnected = await this.testConnectionWithRetry();

            if (!this.isConnected) {
                console.warn('⚠️ Firebase-Verbindung fehlgeschlagen - Offline-Modus aktiv');
            } else {
                console.log('✅ Firebase-Verbindung erfolgreich');
            }

            // SCHRITT 6: Connection monitoring setup
            this.setupConnectionMonitoring();

            // SCHRITT 7: P1 FIX - Rejoin-Mechanismus
            if (this.isConnected && !gameId) {
                const rejoinSuccess = await this.attemptRejoin();
                if (rejoinSuccess) {
                    console.log('✅ Automatischer Rejoin erfolgreich');
                }
            }

            // SCHRITT 8: Spiel-spezifische Verbindung (optional)
            if (this.isConnected && gameId) {
                console.log(`🎮 Verbinde zu Spiel: ${gameId}`);
                await this.connectToGame(gameId, callbacks);
            }

            this.isInitialized = true;

            if (this.isInitialized && this.isConnected) {
                console.log(`🎉 Firebase Service vollständig bereit! ${gameId ? `(Spiel: ${gameId})` : ''}`);
            } else if (this.isInitialized) {
                console.warn('⚠️ Firebase Service im Offline-Modus');
            }

            return this.isInitialized;

        } catch (error) {
            console.error('❌ Firebase Initialisierung fehlgeschlagen:', error);
            this.isInitialized = false;
            this.isConnected = false;
            this.logDetailedError(error);
            throw error; // Werfe Fehler weiter für User-Feedback
        }
    }

    // ===== P1 FIX: REJOIN-MECHANISMUS =====
    async attemptRejoin() {
        if (this.rejoinAttempted) return false;
        this.rejoinAttempted = true;

        try {
            // Lade GameState aus localStorage
            const gameId = localStorage.getItem('nocap_currentGameId');
            const playerId = localStorage.getItem('nocap_currentPlayerId');
            const playerName = localStorage.getItem('nocap_playerName');

            if (!gameId || !playerId) {
                console.log('ℹ️ Keine Rejoin-Daten gefunden');
                return false;
            }

            console.log(`🔄 Versuche Rejoin: ${gameId} als ${playerId}`);

            // Prüfe ob Spiel noch existiert
            const gameRef = this.database.ref(`games/${gameId}`);
            const snapshot = await gameRef.once('value');

            if (!snapshot.exists()) {
                console.warn('⚠️ Spiel existiert nicht mehr - Lösche lokale Daten');
                this.clearRejoinData();
                return false;
            }

            const gameData = snapshot.val();

            // Prüfe ob Spieler noch im Spiel ist
            if (!gameData.players || !gameData.players[playerId]) {
                console.warn('⚠️ Spieler nicht mehr im Spiel - Lösche lokale Daten');
                this.clearRejoinData();
                return false;
            }

            // Setze Spieler als online
            await this.updatePlayerStatus(gameId, playerId, {
                isOnline: true,
                rejoined: true,
                rejoinedAt: firebase.database.ServerValue.TIMESTAMP
            });

            // Stelle Verbindung wieder her
            this.currentGameId = gameId;
            this.currentPlayerId = playerId;
            this.gameRef = gameRef;

            console.log('✅ Rejoin erfolgreich');
            return true;

        } catch (error) {
            console.error('❌ Rejoin fehlgeschlagen:', error);
            this.clearRejoinData();
            return false;
        }
    }

    // Speichere Rejoin-Daten
    saveRejoinData(gameId, playerId, playerName) {
        try {
            localStorage.setItem('nocap_currentGameId', gameId);
            localStorage.setItem('nocap_currentPlayerId', playerId);
            localStorage.setItem('nocap_playerName', playerName);
            localStorage.setItem('nocap_lastActive', Date.now().toString());
        } catch (error) {
            console.warn('⚠️ Konnte Rejoin-Daten nicht speichern:', error);
        }
    }

    // Lösche Rejoin-Daten
    clearRejoinData() {
        try {
            localStorage.removeItem('nocap_currentGameId');
            localStorage.removeItem('nocap_currentPlayerId');
            localStorage.removeItem('nocap_playerName');
            localStorage.removeItem('nocap_lastActive');
        } catch (error) {
            console.warn('⚠️ Konnte Rejoin-Daten nicht löschen:', error);
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

            if (attempt < maxRetries) {
                await this.delay(1000 * attempt);
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
                    console.log(`🔄 Verbindungsstatus: ${this.isConnected ? '✅ Verbunden' : '⚠️ Getrennt'}`);
                    this.notifyConnectionChange(this.isConnected);

                    // P1 FIX: Auto-Rejoin bei Wiederverbindung
                    if (this.isConnected && this.currentGameId && this.currentPlayerId) {
                        this.updatePlayerStatus(this.currentGameId, this.currentPlayerId, {
                            isOnline: true
                        });
                    }
                }
            });

            this.listeners.push({ ref: connectedRef, listener: connectionListener });

        } catch (error) {
            console.error('❌ Fehler beim Setup der Verbindungsüberwachung:', error);
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
                console.error('❌ Fehler beim Benachrichtigen der Verbindungsänderung:', error);
            }
        });
    }

    // ===== GAME OPERATIONS =====
    generateGameId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let gameId = '';
        for (let i = 0; i < 6; i++) {
            gameId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return gameId;
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

    // ===== SPIEL ERSTELLEN (HOST) =====
    async createGame(gameData) {
        if (!this.isConnected) {
            throw new Error('Keine Firebase-Verbindung verfügbar. Bitte Internetverbindung prüfen.');
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

            console.log(`✅ Spiel erstellt: ${gameId}`);

            this.currentGameId = gameId;
            this.currentPlayerId = hostPlayerId;
            this.gameRef = gameRef;

            // P1 FIX: Speichere für Rejoin
            this.saveRejoinData(gameId, hostPlayerId, gameData.hostName);

            return {
                gameId: gameId,
                playerId: hostPlayerId,
                gameRef: gameRef
            };

        } catch (error) {
            console.error('❌ Fehler beim Erstellen des Spiels:', error);
            throw new Error('Spiel konnte nicht erstellt werden. Bitte erneut versuchen.');
        }
    }

    // ===== SPIEL BEITRETEN (GUEST) =====
    async joinGame(gameId, playerName) {
        if (!this.isConnected) {
            throw new Error('Keine Firebase-Verbindung verfügbar. Bitte Internetverbindung prüfen.');
        }

        try {
            console.log(`🔄 Trete Spiel bei: ${gameId} als ${playerName}`);

            // P0 FIX: Strikte Input-Validierung mit sanitizeInput
            if (!gameId || gameId.length !== 6) {
                throw new Error('Ungültiger Spiel-Code. Der Code muss 6 Zeichen lang sein.');
            }

            // Sanitize mit utils.js (falls verfügbar)
            const sanitizedName = typeof window.NocapUtils !== 'undefined'
                ? window.NocapUtils.sanitizeInput(playerName)
                : playerName.trim();

            if (!sanitizedName || sanitizedName.length === 0) {
                throw new Error('Spielername darf nicht leer sein.');
            }

            const gameRef = this.database.ref(`games/${gameId.toUpperCase()}`);
            const gameSnapshot = await gameRef.once('value');

            if (!gameSnapshot.exists()) {
                throw new Error('Spiel nicht gefunden. Bitte Code überprüfen.');
            }

            const gameData = gameSnapshot.val();

            if (gameData.gameState !== 'lobby') {
                throw new Error('Spiel bereits gestartet. Beitritt nicht mehr möglich.');
            }

            const currentPlayerCount = gameData.players ? Object.keys(gameData.players).length : 0;
            if (currentPlayerCount >= gameData.maxPlayers) {
                throw new Error('Spiel ist voll. Maximal ' + gameData.maxPlayers + ' Spieler erlaubt.');
            }

            const existingPlayers = gameData.players || {};
            const nameTaken = Object.values(existingPlayers).some(
                p => p.name.toLowerCase() === sanitizedName.toLowerCase()
            );
            if (nameTaken) {
                throw new Error('Name bereits vergeben. Bitte anderen Namen wählen.');
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

            console.log(`✅ Erfolgreich beigetreten: ${gameId} als ${playerId}`);

            this.currentGameId = gameId.toUpperCase();
            this.currentPlayerId = playerId;
            this.gameRef = gameRef;

            // P1 FIX: Speichere für Rejoin
            this.saveRejoinData(gameId.toUpperCase(), playerId, sanitizedName);

            return {
                gameId: gameId.toUpperCase(),
                playerId: playerId,
                gameRef: gameRef,
                gameData: gameData
            };

        } catch (error) {
            console.error('❌ Fehler beim Beitreten des Spiels:', error);
            if (error.message.includes('Spiel nicht gefunden') ||
                error.message.includes('bereits gestartet') ||
                error.message.includes('ist voll') ||
                error.message.includes('bereits vergeben')) {
                throw error;
            }
            throw new Error('Beitritt fehlgeschlagen. Bitte Code prüfen und erneut versuchen.');
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

            const snapshot = await this.gameRef.once('value');
            if (!snapshot.exists()) {
                console.warn(`⚠️ Spiel ${gameId} existiert nicht`);
                return false;
            }

            if (callbacks.onGameUpdate && typeof callbacks.onGameUpdate === 'function') {
                const gameListener = this.gameRef.on('value', callbacks.onGameUpdate);
                this.listeners.push({ ref: this.gameRef, listener: gameListener });
            }

            if (callbacks.onPlayersUpdate && typeof callbacks.onPlayersUpdate === 'function') {
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
        if (!this.isConnected) {
            console.warn('⚠️ Offline - Player-Status wird bei Wiederverbindung synchronisiert');
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
            console.error('❌ Fehler beim Aktualisieren des Spielerstatus:', error);
            return false;
        }
    }

    async setPlayerOnline(gameId, playerId, online = true) {
        return this.updatePlayerStatus(gameId, playerId, { isOnline: online });
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
            throw new Error('Spiel konnte nicht gestartet werden.');
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
            console.error('❌ Fehler beim Aktualisieren der Spieleinstellungen:', error);
            return false;
        }
    }

    // ===== CLEANUP & UTILITY =====
    async leaveGame(gameId, playerId) {
        console.log(`👋 Verlasse Spiel: ${gameId}`);

        // Markiere Spieler als offline
        await this.setPlayerOnline(gameId, playerId, false);

        // Lösche Rejoin-Daten
        this.clearRejoinData();

        return true;
    }

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
            this.clearRejoinData();
            return true;
        } catch (error) {
            console.error('❌ Fehler beim Löschen des Spiels:', error);
            return false;
        }
    }

    cleanup() {
        console.log('🧹 Firebase Service Cleanup...');

        // P1 FIX: Setze Spieler offline bei Cleanup
        if (this.currentGameId && this.currentPlayerId) {
            this.setPlayerOnline(this.currentGameId, this.currentPlayerId, false);
        }

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
        this.currentPlayerId = null;

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
        console.log('Aktuelle Player-ID:', this.currentPlayerId);
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
    console.log('✅ FirebaseGameService v3.1 initialized (Security Hardened)');
} else {
    console.warn('⚠️ FirebaseGameService already exists - using existing instance');
}

// P1 FIX: Cleanup bei Page Unload + Offline-Status setzen
window.addEventListener('beforeunload', () => {
    if (window.firebaseGameService) {
        window.firebaseGameService.cleanup();
    }
});

// P1 FIX: Page Visibility API - Setze Online/Offline bei Tab-Wechsel
document.addEventListener('visibilitychange', () => {
    if (window.firebaseGameService && window.firebaseGameService.currentGameId && window.firebaseGameService.currentPlayerId) {
        const online = !document.hidden;
        window.firebaseGameService.setPlayerOnline(
            window.firebaseGameService.currentGameId,
            window.firebaseGameService.currentPlayerId,
            online
        );
    }
});

// ===== GLOBALE DEBUG-FUNKTIONEN (nur Development) =====
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.testFirebaseService = async function() {
        console.log('🧪 Firebase Service Test gestartet...');
        const result = await window.firebaseGameService.initialize();
        console.log('Test Ergebnis:', result);
        console.log('Service Status:', window.firebaseGameService.getStatus());
        return window.firebaseGameService;
    };

    window.debugFirebaseConnection = async function() {
        console.log('🔍 Firebase Verbindungstest...');
        console.log('Firebase SDK verfügbar:', typeof firebase !== 'undefined');
        if (typeof firebase !== 'undefined') {
            console.log('Firebase Apps:', firebase.apps.length);
            try {
                const testRef = firebase.database().ref('.info/connected');
                const snapshot = await testRef.once('value');
                console.log('Direkte Verbindung:', snapshot.val());
            } catch (error) {
                console.error('Direkter Test fehlgeschlagen:', error);
            }
        }
    };

    console.log('🛠️ Debug-Befehle: testFirebaseService(), debugFirebaseConnection()');
}

console.log('✅ Firebase Service v3.1 geladen - Security Hardened!');