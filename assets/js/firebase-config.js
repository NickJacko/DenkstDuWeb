// ===== DEPRECATION NOTICE =====
// Diese Datei ist DEPRECATED und wird in Zukunft entfernt!
// Bitte verwende stattdessen firebase-service.js
// Version: 1.5 (Final Legacy Version)

console.warn('⚠️ firebase-config.js is DEPRECATED! Please use firebase-service.js instead.');
console.warn('⚠️ This file will be removed in a future version.');

// Firebase Konfiguration für No-Cap
let firebaseApp = null;
let database = null;

function initFirebase() {
    try {
        console.warn('⚠️ initFirebase() is deprecated. Use FirebaseGameService.initialize() instead.');

        // Firebase Config - SECURE VERSION (same as firebase-auth.js)
        const firebaseConfig = window.FIREBASE_CONFIG || {
            apiKey: "AIzaSyC_cu_2X2uFCPcxYetxIUHi2v56F1Mz0Vk",
            authDomain: "denkstduwebsite.firebaseapp.com",
            databaseURL: "https://denkstduwebsite-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "denkstduwebsite",
            storageBucket: "denkstduwebsite.appspot.com",
            messagingSenderId: "27029260611",
            appId: "1:27029260611:web:3c7da4db0bf92e8ce247f6",
            measurementId: "G-BNKNW95HK8"
        };

        // Warnung wenn Fallback-Config verwendet wird
        if (!window.FIREBASE_CONFIG) {
            console.warn('⚠️ Using fallback Firebase config. Set window.FIREBASE_CONFIG in production!');
        }

        // Firebase initialisieren
        if (!firebaseApp) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
            database = firebase.database();
            console.log('✅ Firebase initialized (via deprecated firebase-config.js)');
        }

        return true;
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
        return false;
    }
}

// ===== LEGACY CLASS: FirebaseGameManager =====
// Diese Klasse wird durch FirebaseGameService ersetzt!
// Bitte migriere zu firebase-service.js
class FirebaseGameManager {
    constructor() {
        console.warn('⚠️ FirebaseGameManager is DEPRECATED! Use FirebaseGameService instead.');
        this.currentGameRef = null;
        this.playersRef = null;
        this.gameId = null;
    }

    // Spiel erstellen
    async createGame(gameSettings) {
        try {
            if (!database) {
                throw new Error('Firebase not initialized');
            }

            // Generiere Game ID
            this.gameId = this.generateGameId();
            this.currentGameRef = database.ref(`games/${this.gameId}`);

            const gameData = {
                gameId: this.gameId,
                gameCreator: gameSettings.creatorName || 'Anonymous',
                categories: gameSettings.categories || ['fsk16'],
                difficulty: gameSettings.difficulty || 'medium',
                maxPlayers: gameSettings.maxPlayers || 8,
                gameState: 'waiting', // waiting, playing, finished
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                settings: {
                    roundsCount: gameSettings.roundsCount || 10,
                    autoDeleteAfter: Date.now() + (24 * 60 * 60 * 1000) // 24h
                },
                players: {},
                currentRound: 0,
                responses: {},
                scores: {}
            };

            await this.currentGameRef.set(gameData);
            console.log(`Game created with ID: ${this.gameId}`);

            return this.gameId;
        } catch (error) {
            console.error('Error creating game:', error);
            throw error;
        }
    }

    // Spiel beitreten
    async joinGame(gameId, playerName) {
        try {
            if (!database) {
                throw new Error('Firebase not initialized');
            }

            this.gameId = gameId;
            this.currentGameRef = database.ref(`games/${gameId}`);

            // Prüfe ob Spiel existiert
            const gameSnapshot = await this.currentGameRef.once('value');
            if (!gameSnapshot.exists()) {
                throw new Error('Spiel nicht gefunden');
            }

            const gameData = gameSnapshot.val();

            // Prüfe ob Spiel noch offen ist
            if (gameData.gameState !== 'waiting') {
                throw new Error('Spiel bereits gestartet');
            }

            // Prüfe Spieler-Limit
            const currentPlayers = Object.keys(gameData.players || {});
            if (currentPlayers.length >= gameData.maxPlayers) {
                throw new Error('Spiel ist voll');
            }

            // Prüfe ob Name bereits vergeben
            if (currentPlayers.some(player =>
                gameData.players[player].name.toLowerCase() === playerName.toLowerCase())) {
                throw new Error('Name bereits vergeben');
            }

            // Spieler hinzufügen
            const playerData = {
                name: playerName,
                joinedAt: firebase.database.ServerValue.TIMESTAMP,
                isReady: false,
                score: 0
            };

            await this.currentGameRef.child(`players/${playerName}`).set(playerData);
            await this.currentGameRef.child(`scores/${playerName}`).set(0);

            console.log(`Player ${playerName} joined game ${gameId}`);
            return gameData;
        } catch (error) {
            console.error('Error joining game:', error);
            throw error;
        }
    }

    // Spiel starten
    async startGame() {
        try {
            if (!this.currentGameRef) {
                throw new Error('No active game');
            }

            await this.currentGameRef.update({
                gameState: 'playing',
                startedAt: firebase.database.ServerValue.TIMESTAMP,
                currentRound: 1
            });

            console.log('Game started');
        } catch (error) {
            console.error('Error starting game:', error);
            throw error;
        }
    }

    // Antwort abgeben
    async submitResponse(roundNumber, playerName, votedCount, isCorrect = null) {
        try {
            if (!this.currentGameRef) {
                throw new Error('No active game');
            }

            const responseData = {
                playerName: playerName,
                votedCount: votedCount,
                isCorrect: isCorrect,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            await this.currentGameRef
                .child(`responses/round_${roundNumber}/${playerName}`)
                .set(responseData);

            console.log(`Response submitted for round ${roundNumber}`);
        } catch (error) {
            console.error('Error submitting response:', error);
            throw error;
        }
    }

    // Runden-Ergebnisse berechnen
    async calculateRoundResults(roundNumber, correctCount) {
        try {
            if (!this.currentGameRef) {
                throw new Error('No active game');
            }

            const responsesSnapshot = await this.currentGameRef
                .child(`responses/round_${roundNumber}`)
                .once('value');

            const responses = responsesSnapshot.val() || {};
            const results = {};

            // Hole Difficulty synchron
            const gameSnapshot = await this.currentGameRef.once('value');
            const gameData = gameSnapshot.val();
            const difficulty = gameData.difficulty;

            let baseSips = 1;
            switch(difficulty) {
                case 'easy': baseSips = 1; break;
                case 'medium': baseSips = 2; break;
                case 'hard': baseSips = 3; break;
            }

            // Berechne Schlücke für jeden Spieler
            Object.entries(responses).forEach(([playerName, response]) => {
                const difference = Math.abs(response.votedCount - correctCount);
                const sips = difference === 0 ? 0 : baseSips + difference;

                results[playerName] = {
                    votedCount: response.votedCount,
                    difference: difference,
                    sips: sips,
                    isExact: difference === 0
                };
            });

            // Speichere Ergebnisse
            await this.currentGameRef
                .child(`roundResults/round_${roundNumber}`)
                .set({
                    correctCount: correctCount,
                    results: results,
                    calculatedAt: firebase.database.ServerValue.TIMESTAMP
                });

            return results;
        } catch (error) {
            console.error('Error calculating round results:', error);
            throw error;
        }
    }

    // Spielstand aktualisieren
    async updateScores(roundResults) {
        try {
            if (!this.currentGameRef) {
                throw new Error('No active game');
            }

            const updates = {};
            Object.entries(roundResults).forEach(([playerName, result]) => {
                // Punkte für exakte Treffer
                if (result.isExact) {
                    updates[`scores/${playerName}`] = firebase.database.ServerValue.increment(10);
                }
                // Punkte für nahe Schätzungen (Abweichung <= 1)
                else if (result.difference <= 1) {
                    updates[`scores/${playerName}`] = firebase.database.ServerValue.increment(5);
                }
            });

            if (Object.keys(updates).length > 0) {
                await this.currentGameRef.update(updates);
            }
        } catch (error) {
            console.error('Error updating scores:', error);
            throw error;
        }
    }

    // Nächste Runde
    async nextRound() {
        try {
            if (!this.currentGameRef) {
                throw new Error('No active game');
            }

            await this.currentGameRef.child('currentRound').transaction(currentRound => {
                return (currentRound || 0) + 1;
            });
        } catch (error) {
            console.error('Error advancing to next round:', error);
            throw error;
        }
    }

    // Spiel beenden
    async endGame() {
        try {
            if (!this.currentGameRef) {
                throw new Error('No active game');
            }

            await this.currentGameRef.update({
                gameState: 'finished',
                finishedAt: firebase.database.ServerValue.TIMESTAMP
            });

            console.log('Game finished');
        } catch (error) {
            console.error('Error ending game:', error);
            throw error;
        }
    }

    // Spiel-Updates abonnieren
    onGameUpdate(callback) {
        if (!this.currentGameRef) {
            console.error('No active game to subscribe to');
            return null;
        }

        return this.currentGameRef.on('value', (snapshot) => {
            const gameData = snapshot.val();
            if (gameData) {
                callback(gameData);
            }
        });
    }

    // Spieler-Updates abonnieren
    onPlayersUpdate(callback) {
        if (!this.currentGameRef) {
            console.error('No active game to subscribe to');
            return null;
        }

        return this.currentGameRef.child('players').on('value', (snapshot) => {
            const players = snapshot.val() || {};
            callback(players);
        });
    }

    // Listener entfernen
    offGameUpdate(callback) {
        if (this.currentGameRef) {
            this.currentGameRef.off('value', callback);
        }
    }

    offPlayersUpdate(callback) {
        if (this.currentGameRef) {
            this.currentGameRef.child('players').off('value', callback);
        }
    }

    // Spiel verlassen
    async leaveGame(playerName) {
        try {
            if (!this.currentGameRef) {
                throw new Error('No active game');
            }

            await this.currentGameRef.child(`players/${playerName}`).remove();
            await this.currentGameRef.child(`scores/${playerName}`).remove();

            console.log(`Player ${playerName} left the game`);
        } catch (error) {
            console.error('Error leaving game:', error);
            throw error;
        }
    }

    // Game ID generieren
    generateGameId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Alte Spiele bereinigen
    static async cleanupOldGames() {
        try {
            if (!database) {
                console.warn('Firebase not initialized for cleanup');
                return;
            }

            const now = Date.now();
            const gamesRef = database.ref('games');

            const snapshot = await gamesRef.once('value');
            const games = snapshot.val() || {};

            const deletePromises = [];
            Object.entries(games).forEach(([gameId, gameData]) => {
                // Lösche Spiele älter als 24h oder mit autoDeleteAfter timestamp
                const deleteAfter = gameData.settings?.autoDeleteAfter ||
                    (gameData.createdAt + 24 * 60 * 60 * 1000);

                if (now > deleteAfter) {
                    console.log(`Deleting old game: ${gameId}`);
                    deletePromises.push(gamesRef.child(gameId).remove());
                }
            });

            await Promise.all(deletePromises);
            if (deletePromises.length > 0) {
                console.log(`Cleaned up ${deletePromises.length} old games`);
            }
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
}

// Globale Instanz (Legacy-Support)
if (typeof window.firebaseGameManager === 'undefined') {
    window.firebaseGameManager = new FirebaseGameManager();
}

// Automatische Bereinigung alle 6 Stunden
const cleanupIntervalId = setInterval(() => {
    FirebaseGameManager.cleanupOldGames();
}, 6 * 60 * 60 * 1000);

// Cleanup-Interval bei Unload entfernen (Memory Leak Prevention)
window.addEventListener('beforeunload', () => {
    clearInterval(cleanupIntervalId);
});

// Bereinigung beim Laden der Seite
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        FirebaseGameManager.cleanupOldGames();
    });
} else {
    FirebaseGameManager.cleanupOldGames();
}

console.log('⚠️ firebase-config.js loaded (DEPRECATED - use firebase-service.js!)');