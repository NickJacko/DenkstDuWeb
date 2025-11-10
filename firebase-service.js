// ===== FirebaseGameService v2.1 (UID-basiert & Rules-kompatibel) =====
// - Nutzt auth.uid als einzig gültigen Schlüssel für Spieler
// - Schreibt ownerUid/members/playerOrder beim Erstellen/Beitreten
// - Startet Spiel mit currentRound/currentTurn
// - Presence: onDisconnect setzt isOnline:false, lastSeen
// - Verbessertes Init & Connection-Monitoring
// Voraussetzungen im HTML (einbinden, gleiche Version!):
// <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>

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
        this.currentUid = null;

        // Firebase-Konfiguration (deine Projektwerte)
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

    // ===== Public: Kurzer Status =====
    get isReady() {
        return this.isInitialized && this.isConnected;
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            connected: this.isConnected,
            currentGameId: this.currentGameId,
            hasGameRef: !!this.gameRef,
            listenersCount: this.listeners.length,
            uid: this.currentUid || (firebase.auth?.currentUser?.uid ?? null)
        };
    }

    // ===== INITIALISIERUNG =====
    async initialize(gameId = null, callbacks = {}) {
        try {
            console.log('🔥 Firebase Service v2.1 – Initialisierung…');

            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK nicht geladen. Prüfe die Script-Tags.');
            }

            // App
            if (!firebase.apps || firebase.apps.length === 0) {
                this.app = firebase.initializeApp(this.config);
            } else {
                this.app = firebase.app();
            }

            // Database
            this.database = firebase.database();
            if (!this.database) throw new Error('Firebase Database konnte nicht initialisiert werden');

            // Auth sicherstellen (anonym, wenn nötig)
            if (!firebase.auth) {
                throw new Error('Firebase Auth SDK nicht geladen. Bitte firebase-auth-compat.js einbinden.');
            }
            await this.ensureAuth();
            console.log('✅ Authentifiziert als UID:', this.getUid());

            // Verbindung testen
            this.isConnected = await this.testConnectionWithRetry(3, 8000);
            if (!this.isConnected) throw new Error('Firebase-Verbindung fehlgeschlagen');

            // Monitoring aktivieren
            this.setupConnectionMonitoring();

            // Optional direkt mit Spiel verbinden
            let gameOk = true;
            if (gameId) {
                gameOk = await this.connectToGame(gameId, callbacks);
            }

            this.isInitialized = this.isConnected && gameOk;
            console.log(this.isInitialized ? '🎉 Firebase Service bereit' : '⚠️ Firebase Service nur teilweise bereit');

            return this.isInitialized;
        } catch (err) {
            console.error('❌ Firebase Initialisierung fehlgeschlagen:', err);
            this.isInitialized = false;
            this.isConnected = false;
            this.logDetailedError(err);
            return false;
        }
    }

    // ===== AUTH-HELPER (NEU) =====
    async ensureAuth() {
        // Bereits angemeldet?
        if (firebase.auth().currentUser) {
            this.currentUid = firebase.auth().currentUser.uid;
            return this.currentUid;
        }
        // Anonym anmelden
        const cred = await firebase.auth().signInAnonymously();
        this.currentUid = cred.user.uid;
        return this.currentUid;
    }

    getUid() {
        if (!this.currentUid && firebase.auth && firebase.auth().currentUser) {
            this.currentUid = firebase.auth().currentUser.uid;
        }
        return this.currentUid;
    }

    safeName(name) {
        return (name || 'player').toString().trim().slice(0, 20);
    }

    // ===== VERBINDUNGSTEST =====
    async testConnectionWithRetry(maxRetries = 3, timeoutMs = 8000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const ok = await this.performConnectionTest(timeoutMs);
                if (ok) return true;
            } catch (e) {
                console.warn(`⚠️ Verbindungsversuch ${attempt}/${maxRetries} fehlgeschlagen:`, e?.message || e);
            }
            if (attempt < maxRetries) await this.delay(1000 * attempt);
        }
        return false;
    }

    async performConnectionTest(timeoutMs = 8000) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error(`Timeout nach ${timeoutMs}ms`)), timeoutMs);
            try {
                const connectedRef = this.database.ref('.info/connected');
                connectedRef.once('value', snap => {
                    clearTimeout(timeout);
                    resolve(snap.val() === true);
                }, err => {
                    clearTimeout(timeout);
                    reject(err);
                });
            } catch (e) {
                clearTimeout(timeout);
                reject(e);
            }
        });
    }

    // ===== VERBINDUNGSÜBERWACHUNG =====
    setupConnectionMonitoring() {
        if (!this.database) return;
        try {
            const connectedRef = this.database.ref('.info/connected');
            const listener = connectedRef.on('value', (snapshot) => {
                const before = this.isConnected;
                this.isConnected = snapshot.val() === true;
                if (before !== this.isConnected) {
                    console.log(`🔄 Verbindungsstatus: ${this.isConnected ? 'Verbunden' : 'Getrennt'}`);
                    this.notifyConnectionChange(this.isConnected);
                }
            });
            this.listeners.push({ ref: connectedRef, listener });
        } catch (e) {
            console.error('❌ Fehler beim Setup der Verbindungsüberwachung:', e);
        }
    }

    onConnectionChange(cb) {
        this.connectionListeners.push(cb);
    }

    notifyConnectionChange(connected) {
        this.connectionListeners.forEach(cb => {
            try { cb(connected); } catch (e) { console.error('❌ onConnectionChange-Callback Fehler:', e); }
        });
    }

    // ===== UTILS =====
    generateGameId() {
        return Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    delay(ms) {
        return new Promise(res => setTimeout(res, ms));
    }

    // ===== GAME: CREATE / JOIN / CONNECT =====
    async createGame(gameData) {
        if (!this.isConnected) throw new Error('Keine Firebase-Verbindung verfügbar');

        const authUid = firebase.auth().currentUser && firebase.auth().currentUser.uid;
        if (!authUid) throw new Error('auth.uid fehlt – anonyme Auth nicht aktiv?');

        try {
            const gameId = gameData.gameId || this.generateGameId();
            const displayPlayerId = this.generatePlayerId(gameData.hostName || 'Host', true);
            const now = firebase.database.ServerValue.TIMESTAMP;

            const gameObject = {
                gameId,
                gameState: 'lobby',
                createdAt: now,
                lastUpdate: now,
                categories: gameData.categories || [],
                difficulty: gameData.difficulty || 'medium',
                maxPlayers: 8,
                currentRound: 0,
                ownerUid: authUid,

                players: {
                    [authUid]: {
                        id: displayPlayerId,
                        name: gameData.hostName || 'Host',
                        isHost: true,
                        isReady: true,
                        isOnline: true,
                        joinedAt: now
                    }
                },

                members: {
                    [authUid]: true
                },

                playerOrder: [authUid],

                settings: {
                    questionsPerGame: 10,
                    timePerQuestion: 30,
                    showResults: true,
                    allowSpectators: false
                }
            };

            const gameRef = this.database.ref(`games/${gameId}`);
            await gameRef.set(gameObject);

            this.currentGameId = gameId;
            this.gameRef = gameRef;

            return { gameId, playerUid: authUid, gameRef };
        } catch (error) {
            console.error('❌ Fehler beim Erstellen des Spiels:', error);
            throw error;
        }
    }

    async joinGame(gameId, playerName) {
        if (!this.isConnected) throw new Error('Keine Firebase-Verbindung verfügbar');

        const authUid = firebase.auth().currentUser && firebase.auth().currentUser.uid;
        if (!authUid) throw new Error('auth.uid fehlt – anonyme Auth nicht aktiv?');

        try {
            const gameRef = this.database.ref(`games/${gameId}`);
            const gameSnapshot = await gameRef.once('value');
            if (!gameSnapshot.exists()) throw new Error('Spiel nicht gefunden');

            const gameData = gameSnapshot.val();

            if (gameData.gameState !== 'lobby') throw new Error('Spiel bereits gestartet');

            const currentPlayerCount = gameData.players ? Object.keys(gameData.players).length : 0;
            if (currentPlayerCount >= (gameData.maxPlayers || 8)) throw new Error('Spiel ist voll');

            const displayPlayerId = this.generatePlayerId(playerName || 'Player', false);
            const now = firebase.database.ServerValue.TIMESTAMP;

            // Spieler unter UID anlegen
            await gameRef.child(`players/${authUid}`).set({
                id: displayPlayerId,
                name: playerName || 'Player',
                isHost: false,
                isReady: false,
                isOnline: true,
                joinedAt: now
            });

            // Mitgliedschaft setzen (self-write)
            await gameRef.child(`members/${authUid}`).set(true);

            // playerOrder anfügen (einfach gehalten)
            const orderRef = gameRef.child('playerOrder');
            const orderSnap = await orderRef.once('value');
            const order = Array.isArray(orderSnap.val()) ? orderSnap.val() : [];
            if (!order.includes(authUid)) {
                order.push(authUid);
                await orderRef.set(order);
            }

            this.currentGameId = gameId;
            this.gameRef = gameRef;

            return { gameId, playerUid: authUid, gameData };
        } catch (error) {
            console.error('❌ Fehler beim Beitreten des Spiels:', error);
            throw error;
        }
    }


    async connectToGame(gameId, callbacks = {}) {
        if (!this.isConnected || !gameId) return false;

        try {
            this.currentGameId = gameId;
            this.gameRef = this.database.ref(`games/${gameId}`);

            const snapshot = await this.gameRef.once('value');
            if (!snapshot.exists()) {
                console.warn(`⚠️ Spiel ${gameId} existiert nicht`);
                return false;
            }

            // Listener setzen
            if (callbacks.onGameUpdate) {
                const l = this.gameRef.on('value', callbacks.onGameUpdate);
                this.listeners.push({ ref: this.gameRef, listener: l });
            }
            if (callbacks.onPlayersUpdate) {
                const pr = this.gameRef.child('players');
                const l = pr.on('value', callbacks.onPlayersUpdate);
                this.listeners.push({ ref: pr, listener: l });
            }

            // Presence (onDisconnect)
            try {
                await this.ensureAuth();
                const uid = this.getUid();
                if (uid) {
                    const presRef = this.database.ref(`games/${gameId}/players/${uid}`);
                    presRef.onDisconnect().update({
                        isOnline: false,
                        lastSeen: firebase.database.ServerValue.TIMESTAMP
                    });
                }
            } catch (e) {
                console.warn('Presence setup skipped:', e);
            }

            console.log(`✅ Verbunden mit Spiel: ${gameId}`);
            return true;
        } catch (e) {
            console.error(`❌ Fehler beim Verbinden zu Spiel ${gameId}:`, e);
            return false;
        }
    }

    // ===== PLAYER MANAGEMENT =====
    async updatePlayerStatus(gameId, playerId /* = uid */, updates) {
        if (!this.isConnected) return false;
        // playerId sollte uid sein – für Konsistenz:
        const uid = playerId || this.getUid();
        try {
            const playerRef = this.database.ref(`games/${gameId}/players/${uid}`);
            await playerRef.update({
                ...updates,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
            return true;
        } catch (e) {
            console.error('❌ Fehler beim Aktualisieren des Spielerstatus:', e);
            return false;
        }
    }

    async setPlayerOnline(gameId, playerId /* = uid */, online = true) {
        return this.updatePlayerStatus(gameId, playerId, { isOnline: online });
    }

    async setPlayerReady(gameId, playerId /* = uid */, ready = true) {
        return this.updatePlayerStatus(gameId, playerId, { isReady: ready });
    }

    // ===== GAME CONTROL =====
    async startGame(gameId) {
        if (!this.isConnected) throw new Error('Keine Firebase-Verbindung verfügbar');
        const gameRef = this.database.ref(`games/${gameId}`);

        // Host-only (wird durch Rules erzwungen)
        await gameRef.update({
            gameState: 'playing',
            currentRound: 1,
            currentTurn: 0,
            startedAt: firebase.database.ServerValue.TIMESTAMP,
            lastUpdate: firebase.database.ServerValue.TIMESTAMP
        });

        console.log(`🚀 Spiel gestartet: ${gameId}`);
        return true;
    }

    async updateGameSettings(gameId, settings) {
        if (!this.isConnected) return false;
        try {
            const settingsRef = this.database.ref(`games/${gameId}/settings`);
            await settingsRef.update(settings);
            await this.database.ref(`games/${gameId}/lastUpdate`)
                .set(firebase.database.ServerValue.TIMESTAMP);
            return true;
        } catch (e) {
            console.error('❌ Fehler beim Aktualisieren der Spieleinstellungen:', e);
            return false;
        }
    }

    // ===== CLEANUP =====
    async removePlayer(gameId, playerId /* = uid */) {
        if (!this.isConnected) return false;
        const uid = playerId || this.getUid();
        try {
            const playerRef = this.database.ref(`games/${gameId}/players/${uid}`);
            await playerRef.remove();
            // members/order optional bereinigen (nicht zwingend)
            return true;
        } catch (e) {
            console.error('❌ Fehler beim Entfernen des Spielers:', e);
            return false;
        }
    }

    async deleteGame(gameId) {
        if (!this.isConnected) return false;
        try {
            await this.database.ref(`games/${gameId}`).remove();
            return true;
        } catch (e) {
            console.error('❌ Fehler beim Löschen des Spiels:', e);
            return false;
        }
    }

    cleanup() {
        console.log('🧹 Firebase Service Cleanup…');
        this.listeners.forEach(({ ref, listener }) => {
            try { ref.off('value', listener); } catch (e) { /* ignore */ }
        });
        this.listeners = [];
        this.connectionListeners = [];
        this.gameRef = null;
        this.currentGameId = null;
        console.log('✅ Cleanup ok');
    }

    // ===== DEBUG =====
    logDetailedError(error) {
        console.group('🔍 Firebase Fehlerdetails:');
        console.error('Fehler:', error);
        console.log('Firebase App:', this.app);
        console.log('Firebase Database:', this.database);
        console.log('Verbindungsstatus:', this.isConnected);
        console.log('Initialisiert:', this.isInitialized);
        console.log('Aktuelle Spiel-ID:', this.currentGameId);
        console.log('UID:', this.currentUid);
        console.groupEnd();
    }
}

// ===== GLOBALE DEBUG-FUNKTIONEN (optional) =====
window.testFirebaseService = async function () {
    console.log('🧪 Firebase Service Test…');
    const service = new FirebaseGameService();
    const ok = await service.initialize();
    console.log('Init ok:', ok, 'Status:', service.getStatus());
    return service;
};

window.debugFirebaseConnection = async function () {
    console.log('🔍 Direkter Verbindungstest…');
    console.log('SDK verfügbar:', typeof firebase !== 'undefined');
    if (typeof firebase === 'undefined') return;

    console.log('Firebase Apps:', firebase.apps.length);
    try {
        const testApp = firebase.initializeApp(new FirebaseGameService().config, 'test-app');
        const db = firebase.database(testApp);
        const snap = await db.ref('.info/connected').once('value');
        console.log('Direkte Verbindung:', snap.val());
        await testApp.delete();
    } catch (e) {
        console.error('Direkter Test fehlgeschlagen:', e);
    }
};

console.log('✅ FirebaseGameService v2.1 geladen');
