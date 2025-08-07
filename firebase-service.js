// Firebase Service für DenkstDu
class FirebaseService {
    constructor() {
        this.app = null;
        this.database = null;
        this.isInitialized = false;
        this.currentGameRef = null;
        this.gameId = null;
        
        // Firebase Konfiguration
        this.config = {
            apiKey: "AIzaSyC_cu_2X2uFCPcxYetxIUHi2v56F1Mz0Vk",
            authDomain: "denkstduwebsite.firebaseapp.com",
            databaseURL: "https://denkstduwebsite-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "denkstduwebsite",
            storageBucket: "denkstduwebsite.firebasestorage.app",
            messagingSenderId: "27029260611",
            appId: "1:27029260611:web:3c7da4db0bf92e8ce247f6",
            measurementId: "G-BNKNW95HK8"
        };
    }

    // Firebase initialisieren
    async initialize() {
        try {
            // Prüfen ob Firebase SDK verfügbar ist
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK not loaded');
            }

            // Firebase App initialisieren (falls noch nicht geschehen)
            if (!firebase.apps || firebase.apps.length === 0) {
                this.app = firebase.initializeApp(this.config);
            } else {
                this.app = firebase.app();
            }

            // Realtime Database Referenz erstellen
            this.database = firebase.database();

            // Verbindung testen
            const connected = await this.testConnection();
            this.isInitialized = connected;
            
            console.log('Firebase initialized:', this.isInitialized);
            return this.isInitialized;

        } catch (error) {
            console.error('Firebase initialization failed:', error);
            this.isInitialized = false;
            return false;
        }
    }

    // Verbindung testen
    async testConnection() {
        try {
            const connectedRef = this.database.ref('.info/connected');
            
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    resolve(false);
                }, 5000);

                connectedRef.once('value', (snapshot) => {
                    clearTimeout(timeout);
                    resolve(snapshot.val() === true);
                }, (error) => {
                    clearTimeout(timeout);
                    console.error('Connection test failed:', error);
                    resolve(false);
                });
            });
        } catch (error) {
            console.error('Connection test error:', error);
            return false;
        }
    }

    // Neues Spiel erstellen
    async createGame(gameData) {
        try {
            if (!this.isInitialized) {
                throw new Error('Firebase not initialized');
            }

            // Game ID generieren
            this.gameId = this.generateGameId();

            // Game Daten vorbereiten
            const gameObject = {
                ...gameData,
                gameId: this.gameId,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                gameState: 'lobby',
                currentRound: 0,
                maxPlayers: 8
            };

            // Game in Firebase erstellen
            this.currentGameRef = this.database.ref(`games/${this.gameId}`);
            await this.currentGameRef.set(gameObject);

            console.log('Game created with ID:', this.gameId);
            return {
                gameId: this.gameId,
                gameRef: this.currentGameRef
            };

        } catch (error) {
            console.error('Error creating game:', error);
            throw error;
        }
    }

    // Spiel beitreten
    async joinGame(gameId, playerData) {
        try {
            if (!this.isInitialized) {
                throw new Error('Firebase not initialized');
            }

            // Game Referenz erstellen
            const gameRef = this.database.ref(`games/${gameId}`);
            
            // Prüfen ob Spiel existiert
            const gameSnapshot = await gameRef.once('value');
            if (!gameSnapshot.exists()) {
                throw new Error('Game not found');
            }

            const gameData = gameSnapshot.val();
            
            // Prüfen ob Spiel noch offen ist
            if (gameData.gameState !== 'lobby') {
                throw new Error('Game already started');
            }

            // Player hinzufügen
            const playerKey = this.generatePlayerId();
            await gameRef.child(`players/${playerKey}`).set({
                ...playerData,
                playerId: playerKey,
                joinedAt: firebase.database.ServerValue.TIMESTAMP,
                isReady: false
            });

            this.gameId = gameId;
            this.currentGameRef = gameRef;

            console.log('Joined game:', gameId);
            return { gameId, gameRef, playerId: playerKey };

        } catch (error) {
            console.error('Error joining game:', error);
            throw error;
        }
    }

    // Fragen aus Firebase laden
    async loadQuestions(categories) {
        try {
            if (!this.isInitialized) {
                throw new Error('Firebase not initialized');
            }

            const questions = [];
            
            // Fragen für jede Kategorie laden
            for (const category of categories) {
                const questionsSnapshot = await this.database.ref(`questions/${category}`).once('value');
                
                if (questionsSnapshot.exists()) {
                    const categoryQuestions = questionsSnapshot.val();
                    
                    // Fragen mit Kategorie-Info erweitern
                    categoryQuestions.forEach(questionText => {
                        questions.push({
                            text: questionText,
                            category: category,
                            categoryIcon: this.getCategoryIcon(category)
                        });
                    });
                }
            }

            // Fragen mischen
            return this.shuffleArray(questions);

        } catch (error) {
            console.error('Error loading questions:', error);
            throw error;
        }
    }

    // Antwort abgeben
    async submitAnswer(roundNumber, playerData) {
        try {
            if (!this.currentGameRef) {
                throw new Error('No active game');
            }

            const answerRef = this.currentGameRef.child(`rounds/${roundNumber}/answers/${playerData.playerId}`);
            
            await answerRef.set({
                answer: playerData.answer,
                estimation: playerData.estimation,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });

            console.log('Answer submitted for round', roundNumber);
            return true;

        } catch (error) {
            console.error('Error submitting answer:', error);
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
            return true;

        } catch (error) {
            console.error('Error starting game:', error);
            throw error;
        }
    }

    // Event Listener für Spieler-Updates
    onPlayersChanged(callback) {
        if (!this.currentGameRef) return;

        this.currentGameRef.child('players').on('value', (snapshot) => {
            const players = snapshot.val() || {};
            callback(players);
        });
    }

    // Event Listener für Game State Changes
    onGameStateChanged(callback) {
        if (!this.currentGameRef) return;

        this.currentGameRef.child('gameState').on('value', (snapshot) => {
            const gameState = snapshot.val();
            callback(gameState);
        });
    }

    // Listeners entfernen
    removeListeners() {
        if (this.currentGameRef) {
            this.currentGameRef.off();
        }
    }

    // Game ID generieren
    generateGameId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Player ID generieren
    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substring(2, 9);
    }

    // Array mischen (Fisher-Yates)
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Kategorie Icon bestimmen
    getCategoryIcon(category) {
        const icons = {
            'fsk0': '👨‍👩‍👧‍👦',
            'fsk16': '🎉',
            'fsk18': '🔥'
        };
        return icons[category] || '❓';
    }

    // Spiel verlassen/löschen
    async leaveGame() {
        try {
            if (this.currentGameRef) {
                // Alle Listener entfernen
                this.removeListeners();
                
                // Game löschen (nur Host kann das)
                await this.currentGameRef.remove();
                
                this.currentGameRef = null;
                this.gameId = null;
            }
        } catch (error) {
            console.error('Error leaving game:', error);
        }
    }

    // Verbindungsstatus prüfen
    isConnected() {
        return this.isInitialized;
    }
}

// Global verfügbare Instanz
window.firebaseService = new FirebaseService();