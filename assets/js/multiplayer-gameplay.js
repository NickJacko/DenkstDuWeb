/**
 * No-Cap Multiplayer Gameplay
 * Handles real-time multiplayer game rounds with Firebase sync
 *
 * @version 8.0.0
 * @requires GameState.js
 * @requires Firebase SDK
 * @requires DOMPurify
 */

// ===== FIREBASE SERVICE CLASS =====
class FirebaseGameService {
    constructor() {
        this.app = null;
        this.auth = null;
        this.database = null;
        this.isInitialized = false;
        this.isConnected = false;
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

    async initialize() {
        try {
            this.log('🔥 Firebase Service - Initialisierung...');

            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK nicht geladen');
            }

            if (!firebase.apps || firebase.apps.length === 0) {
                this.app = firebase.initializeApp(this.config);
            } else {
                this.app = firebase.app();
            }

            // Anonymous Auth
            this.log('🔐 Starte anonyme Authentifizierung...');
            this.auth = firebase.auth();

            try {
                await this.auth.signInAnonymously();
                this.log('✅ Anonym angemeldet');
            } catch (authError) {
                this.log(`❌ Auth Fehler: ${authError.message}`, 'error');
                throw authError;
            }

            this.database = firebase.database();

            // Verbindungsprüfung
            this.log('🔗 Warte auf Datenbankverbindung...');
            let connected = false;
            let attempts = 0;

            while (!connected && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 500));

                try {
                    const connectedRef = this.database.ref('.info/connected');
                    const snapshot = await connectedRef.once('value');
                    connected = snapshot.val() === true;

                    if (connected) {
                        this.log('✅ Datenbankverbindung hergestellt!');
                    } else {
                        attempts++;
                        this.log(`🔄 Verbindungsversuch ${attempts}/10...`);
                    }
                } catch (error) {
                    attempts++;
                }
            }

            this.isConnected = connected;
            this.isInitialized = connected;

            if (this.isConnected) {
                this.log('✅ Firebase vollständig verbunden!');
            } else {
                this.log('❌ Firebase Verbindung fehlgeschlagen');
            }

            return this.isInitialized;

        } catch (error) {
            this.log(`❌ Firebase Fehler: ${error.message}`, 'error');
            this.isInitialized = false;
            this.isConnected = false;
            return false;
        }
    }

    async getGameData(gameId) {
        if (!this.isConnected || !gameId) return null;

        try {
            const gameRef = this.database.ref(`games/${gameId}`);
            const snapshot = await gameRef.once('value');
            return snapshot.exists() ? snapshot.val() : null;
        } catch (error) {
            this.log(`❌ Fehler beim Laden: ${error.message}`, 'error');
            return null;
        }
    }

    listenToGame(gameId, callback) {
        if (!this.isConnected || !gameId) return null;

        try {
            const gameRef = this.database.ref(`games/${gameId}`);
            gameRef.on('value', callback);
            this.listeners.push({ ref: gameRef, type: 'game' });
            return gameRef;
        } catch (error) {
            this.log(`❌ Fehler beim Game Listener: ${error.message}`, 'error');
            return null;
        }
    }

    listenToRound(gameId, roundNumber, callback) {
        if (!this.isConnected || !gameId) return null;

        try {
            const roundRef = this.database.ref(`games/${gameId}/rounds/round_${roundNumber}`);
            roundRef.on('value', callback);
            this.listeners.push({ ref: roundRef, type: 'round' });
            return roundRef;
        } catch (error) {
            this.log(`❌ Fehler beim Round Listener: ${error.message}`, 'error');
            return null;
        }
    }

    async startNewRound(gameId, roundNumber, question) {
        if (!this.isConnected) return false;

        try {
            const roundRef = this.database.ref(`games/${gameId}/rounds/round_${roundNumber}`);
            await roundRef.set({
                question: question,
                answers: {},
                startedAt: firebase.database.ServerValue.TIMESTAMP
            });

            const gameRef = this.database.ref(`games/${gameId}`);
            await gameRef.update({
                currentRound: roundNumber,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });

            this.log(`✅ Round ${roundNumber} started`);
            return true;
        } catch (error) {
            this.log(`❌ Fehler beim Starten der Runde: ${error.message}`, 'error');
            return false;
        }
    }

    async submitAnswer(gameId, roundNumber, playerId, answerData) {
        if (!this.isConnected) throw new Error('Keine Firebase-Verbindung');

        try {
            const answerRef = this.database.ref(`games/${gameId}/rounds/round_${roundNumber}/answers/${playerId}`);
            await answerRef.set({
                ...answerData,
                submittedAt: firebase.database.ServerValue.TIMESTAMP
            });

            this.log(`✅ Answer submitted for round ${roundNumber}`);
            return true;
        } catch (error) {
            this.log(`❌ Fehler beim Absenden: ${error.message}`, 'error');
            throw error;
        }
    }

    cleanup() {
        this.log('🧹 Cleanup...');

        this.listeners.forEach(({ ref }) => {
            try {
                ref.off();
            } catch (error) {
                this.log(`❌ Fehler beim Entfernen: ${error.message}`, 'error');
            }
        });

        this.listeners = [];
        this.log('✅ Cleanup abgeschlossen');
    }

    get isReady() {
        return this.isInitialized && this.isConnected;
    }

    log(message, type = 'info') {
        const colors = {
            info: '#4488ff',
            warning: '#ffaa00',
            error: '#ff4444',
            success: '#00ff00'
        };
        console.log(`%c[Firebase] ${message}`, `color: ${colors[type] || colors.info}`);
    }
}

// ===== QUESTIONS DATABASE =====
const questionsDatabase = {
    fsk0: [
        "Ich habe schon mal... ein ganzes Buch an einem Tag gelesen",
        "Ich habe schon mal... Pizza zum Frühstück gegessen",
        "Ich habe schon mal... mehr als 12 Stunden am Stück geschlafen",
        "Ich habe schon mal... einen ganzen Tag im Pyjama verbracht",
        "Ich habe schon mal... beim Kochen das Essen anbrennen lassen",
        "Ich habe schon mal... mein Handy in die Toilette fallen lassen"
    ],
    fsk16: [
        "Ich habe schon mal... heimlich Süßigkeiten vor dem Abendessen gegessen",
        "Ich habe schon mal... so getan, als wäre ich krank, um nicht zur Schule zu müssen",
        "Ich habe schon mal... bis 3 Uhr morgens Netflix geschaut",
        "Ich habe schon mal... ein Lied so laut gesungen, dass die Nachbarn sich beschwert haben",
        "Ich habe schon mal... vergessen, wo ich mein Auto geparkt habe"
    ],
    fsk18: [
        "Ich habe schon mal... an einem öffentlichen Ort Sex gehabt",
        "Ich habe schon mal... eine Affäre gehabt",
        "Ich habe schon mal... in einer Beziehung betrogen",
        "Ich habe schon mal... Sex mit jemandem gehabt, nur um es auszuprobieren"
    ]
};

// ===== GLOBAL VARIABLES =====
let gameState = null;
let firebaseService = null;
let gameListener = null;
let roundListener = null;
let currentGameData = null;
let currentRoundData = null;
let currentPlayers = {};
let currentQuestion = null;
let userAnswer = null;
let userEstimation = null;
let totalPlayers = 0;
let currentQuestionNumber = 1;
let currentPhase = 'question';

// Overall stats tracking
let overallStats = {
    totalRounds: 0,
    playerStats: {}
};

const categoryNames = {
    'fsk0': '👨‍👩‍👧‍👦 Familie & Freunde',
    'fsk16': '🎉 Party Time',
    'fsk18': '🔥 Heiß & Gewagt'
};

const difficultyMultipliers = {
    'easy': 1,
    'medium': 2,
    'hard': 3
};

// ===== GUARDS & VALIDATION =====
function validateGameState() {
    log('🔍 Validating game state...');

    // Check device mode
    if (!gameState.deviceMode || gameState.deviceMode !== 'multi') {
        log('❌ Invalid device mode - redirecting', 'error');
        showNotification('Kein Multiplayer-Spiel aktiv!', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return false;
    }

    // Check game ID
    if (!gameState.gameId) {
        log('❌ No game ID - redirecting', 'error');
        showNotification('Keine Spiel-ID gefunden!', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return false;
    }

    // Check age verification (Age-Gate)
    const ageVerification = localStorage.getItem('nocap_age_verification');
    if (!ageVerification) {
        log('⚠️ Age verification missing - redirecting to index', 'warning');
        showNotification('Altersverifizierung erforderlich!', 'warning');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return false;
    }

    log('✅ Game state valid');
    return true;
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initializeGameplay();
});

async function initializeGameplay() {
    log('🎮 Initializing multiplayer gameplay...');
    showLoading();

    // Initialize services
    if (typeof GameState === 'undefined') {
        log('❌ GameState class not loaded!', 'error');
        showNotification('Fehler beim Laden der App', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }

    gameState = new GameState();

    // Validate state with guards
    if (!validateGameState()) {
        hideLoading();
        return;
    }

    firebaseService = new FirebaseGameService();

    // Initialize Firebase
    const firebaseReady = await firebaseService.initialize();

    if (firebaseReady) {
        await setupFirebaseListeners();
    } else {
        showNotification('Firebase-Verbindung fehlgeschlagen', 'error');
    }

    // Initialize UI
    updateGameDisplay();
    createNumberGrid();
    updateSubmitButton();

    // Setup event listeners
    setupEventListeners();

    // Show/hide host controls
    if (gameState.isHost) {
        document.getElementById('host-controls').style.display = 'block';
        document.getElementById('player-controls').style.display = 'none';
    } else {
        document.getElementById('host-controls').style.display = 'none';
        document.getElementById('player-controls').style.display = 'block';
    }

    hideLoading();
    log('✅ Gameplay initialized');
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Answer buttons
    document.getElementById('yes-btn').addEventListener('click', () => selectAnswer(true));
    document.getElementById('no-btn').addEventListener('click', () => selectAnswer(false));

    // Submit button
    document.getElementById('submit-btn').addEventListener('click', submitAnswers);

    // Host controls
    const nextQuestionBtn = document.getElementById('next-question-btn');
    if (nextQuestionBtn) {
        nextQuestionBtn.addEventListener('click', nextQuestion);
    }

    const showOverallBtn = document.getElementById('show-overall-btn');
    if (showOverallBtn) {
        showOverallBtn.addEventListener('click', showOverallResults);
    }

    // Overall results controls
    const continueGameBtn = document.getElementById('continue-game-btn');
    if (continueGameBtn) {
        continueGameBtn.addEventListener('click', continueGame);
    }

    const endGameBtn = document.getElementById('end-game-btn');
    if (endGameBtn) {
        endGameBtn.addEventListener('click', endGameForAll);
    }

    log('✅ Event listeners setup complete');
}

// ===== FIREBASE LISTENERS =====
async function setupFirebaseListeners() {
    if (!firebaseService.isReady || !gameState.gameId) {
        log('⚠️ Cannot setup listeners - Firebase not ready');
        return;
    }

    log('🎧 Setting up Firebase listeners...');

    // Listen to game updates
    gameListener = firebaseService.listenToGame(gameState.gameId, (snapshot) => {
        if (snapshot.exists()) {
            currentGameData = snapshot.val();
            log('🎮 Game update received');

            // Update players
            currentPlayers = currentGameData.players || {};
            updatePlayersCount();

            // Check for overall results trigger
            if (currentGameData.showOverallResults && currentPhase !== 'overall-results') {
                log('📊 Overall results triggered by host');

                if (currentGameData.overallStats) {
                    overallStats = currentGameData.overallStats;
                }

                displayOverallResults();
            }

            // Check if overall results were closed (continue game)
            if (currentGameData.showOverallResults === false && currentPhase === 'overall-results') {
                log('▶️ Game continues - triggered by host');
                handleNewRound(currentGameData.currentRound);
            }

            // Check for game end
            if (currentGameData.gameState === 'finished') {
                log('🛑 Game finished by host');
                showNotification('Spiel wurde vom Host beendet! 👋', 'info');

                setTimeout(() => {
                    cleanup();
                    window.location.href = 'index.html';
                }, 3000);
            }

            // Check for round changes
            if (currentGameData.currentRound && currentGameData.currentRound !== currentQuestionNumber && currentPhase !== 'overall-results') {
                handleNewRound(currentGameData.currentRound);
            }
        }
    });

    // Load initial game data
    const initialData = await firebaseService.getGameData(gameState.gameId);
    if (initialData) {
        currentGameData = initialData;
        currentPlayers = initialData.players || {};
        updatePlayersCount();

        if (initialData.currentRound) {
            currentQuestionNumber = initialData.currentRound;
            updateGameDisplay();
            await loadRoundFromFirebase(currentQuestionNumber);
        } else if (gameState.isHost) {
            await startNewRound();
        }
    } else if (gameState.isHost) {
        await startNewRound();
    }

    log('✅ Firebase listeners setup complete');
}

async function loadRoundFromFirebase(roundNumber) {
    if (!firebaseService.isReady) return;

    try {
        log(`📥 Loading round ${roundNumber} from Firebase...`);

        const roundRef = firebaseService.database.ref(`games/${gameState.gameId}/rounds/round_${roundNumber}`);
        const snapshot = await roundRef.once('value');

        if (snapshot.exists()) {
            const roundData = snapshot.val();
            currentQuestion = roundData.question;

            if (currentQuestion) {
                displayQuestion(currentQuestion);
                setupRoundListener(roundNumber);
                log('✅ Question loaded and listener setup');
            }
        } else {
            log('⚠️ Round not found in Firebase');
        }
    } catch (error) {
        log(`❌ Error loading round: ${error.message}`, 'error');
    }
}

function setupRoundListener(roundNumber) {
    // Remove old listener if exists
    if (roundListener) {
        try {
            roundListener.off();
            log('🗑️ Removed old round listener');
        } catch (e) {}
    }

    log(`🎧 Setting up round listener for round ${roundNumber}`);

    roundListener = firebaseService.listenToRound(gameState.gameId, roundNumber, (snapshot) => {
        if (snapshot.exists()) {
            currentRoundData = snapshot.val();

            const answers = currentRoundData.answers || {};
            const answerCount = Object.keys(answers).length;
            const playerCount = Object.keys(currentPlayers).length;

            log(`📊 Round ${roundNumber} listener triggered: ${answerCount}/${playerCount} answers (Phase: ${currentPhase})`);

            // Update waiting status if in waiting phase
            if (currentPhase === 'waiting') {
                updateWaitingStatus(answers);

                // CHECK: All players answered?
                if (answerCount >= playerCount && playerCount >= 2) {
                    log('🎉 ALL PLAYERS ANSWERED! Showing results for EVERYONE...');

                    setTimeout(() => {
                        if (currentPhase === 'waiting') {
                            calculateAndShowResults();
                        }
                    }, 300);
                }
            }
        } else {
            log('⚠️ Round data not found in listener');
        }
    });

    log('✅ Round listener active and waiting for updates');
}

function handleNewRound(roundNumber) {
    if (roundNumber > currentQuestionNumber) {
        currentQuestionNumber = roundNumber;
        updateGameDisplay();
        loadRoundFromFirebase(roundNumber);
        resetForNewQuestion();
        showPhase('question');
        showNotification('Neue Frage gestartet! 🎮', 'success');
    }
}

// ===== GAME FLOW =====
async function startNewRound() {
    if (!gameState.isHost) return;

    log(`🎲 Starting round ${currentQuestionNumber}`);

    // Generate new question
    currentQuestion = generateRandomQuestion();

    // Display question
    displayQuestion(currentQuestion);

    // Start round in Firebase
    if (firebaseService.isReady) {
        await firebaseService.startNewRound(gameState.gameId, currentQuestionNumber, currentQuestion);
        setupRoundListener(currentQuestionNumber);
    }

    log('✅ New round started and listener setup');
}

function generateRandomQuestion() {
    const availableQuestions = [];

    gameState.selectedCategories.forEach(category => {
        if (questionsDatabase[category]) {
            questionsDatabase[category].forEach(q => {
                availableQuestions.push({
                    text: q,
                    category: category
                });
            });
        }
    });

    if (availableQuestions.length === 0) {
        return {
            text: "Ich habe schon mal... etwas Interessantes erlebt",
            category: "fsk0"
        };
    }

    return availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
}

function displayQuestion(question) {
    if (!question) return;

    // Sanitize question text
    const questionTextEl = document.getElementById('question-text');
    questionTextEl.textContent = question.text; // Use textContent for safety

    const categoryEl = document.getElementById('question-category');
    categoryEl.textContent = categoryNames[question.category] || '🎮 Spiel';

    log('📝 Question displayed:', question.text);
}

function resetForNewQuestion() {
    userAnswer = null;
    userEstimation = null;

    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    // Hide personal result box
    const personalBox = document.getElementById('personal-result');
    if (personalBox) {
        personalBox.style.display = 'none';
    }

    // Hide selection display
    const selectionDisplay = document.getElementById('current-selection');
    selectionDisplay.classList.remove('show');
    document.getElementById('selected-number').textContent = '-';

    updateNumberSelection();
    updateSubmitButton();
}

// ===== UI FUNCTIONS =====
function updateGameDisplay() {
    const gameIdEl = document.getElementById('game-id-display');
    gameIdEl.textContent = gameState.gameId;
}

function updatePlayersCount() {
    totalPlayers = Object.keys(currentPlayers).length;

    const playersCountEl = document.getElementById('players-count');
    playersCountEl.textContent = `${totalPlayers} Spieler`;

    const totalPlayersEl = document.getElementById('total-players');
    totalPlayersEl.textContent = totalPlayers;

    // Recreate number grid
    createNumberGrid();
}

function createNumberGrid() {
    const numberGrid = document.getElementById('number-grid');
    numberGrid.innerHTML = '';

    const maxPlayers = totalPlayers || 8;
    for (let i = 0; i <= maxPlayers; i++) {
        const numberBtn = document.createElement('button');
        numberBtn.className = 'number-btn';
        numberBtn.textContent = i;
        numberBtn.id = `number-btn-${i}`;

        // Use addEventListener instead of onclick
        numberBtn.addEventListener('click', () => selectNumber(i));

        numberGrid.appendChild(numberBtn);
    }

    updateNumberSelection();
}

function selectNumber(number) {
    const maxPlayers = totalPlayers || 8;
    if (number >= 0 && number <= maxPlayers) {
        userEstimation = number;
        updateSelectedNumber(number);
        updateNumberSelection();
        updateSubmitButton();

        // Show selection display after selection
        const selectionDisplay = document.getElementById('current-selection');
        selectionDisplay.classList.add('show');
    }
}

function updateSelectedNumber(number) {
    const selectedNumberEl = document.getElementById('selected-number');
    selectedNumberEl.textContent = number;
}

function updateNumberSelection() {
    document.querySelectorAll('.number-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    if (userEstimation !== null) {
        const selectedBtn = document.getElementById(`number-btn-${userEstimation}`);
        if (selectedBtn) {
            selectedBtn.classList.add('selected');
        }
    }
}

function selectAnswer(answer) {
    userAnswer = answer;

    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    const selectedBtn = answer ? document.getElementById('yes-btn') : document.getElementById('no-btn');
    selectedBtn.classList.add('selected');

    updateSubmitButton();
}

function updateSubmitButton() {
    const submitBtn = document.getElementById('submit-btn');
    if (userAnswer !== null && userEstimation !== null) {
        submitBtn.classList.add('enabled');
        submitBtn.disabled = false;
    } else {
        submitBtn.classList.remove('enabled');
        submitBtn.disabled = true;
    }
}

// ===== GAME ACTIONS =====
async function submitAnswers() {
    if (userAnswer === null || userEstimation === null) {
        showNotification('Bitte wähle eine Antwort UND eine Schätzung aus!', 'warning');
        return;
    }

    log('📤 Submitting answers:', { answer: userAnswer, estimation: userEstimation });

    const answerData = {
        playerId: gameState.playerId,
        playerName: gameState.playerName,
        answer: userAnswer,
        estimation: userEstimation,
        isHost: gameState.isHost,
        alcoholMode: gameState.alcoholMode
    };

    try {
        if (firebaseService.isReady) {
            await firebaseService.submitAnswer(
                gameState.gameId,
                currentQuestionNumber,
                gameState.playerId,
                answerData
            );

            log('✅ Answer submitted to Firebase');
        }

        showNotification('Antworten gesendet! 🎯', 'success');
        showPhase('waiting');

        setTimeout(() => {
            checkIfAllAnswered();
        }, 1000);

    } catch (error) {
        log(`❌ Error submitting: ${error.message}`, 'error');
        showNotification('Fehler beim Senden', 'error');
    }
}

async function checkIfAllAnswered() {
    if (!firebaseService.isReady || !currentQuestionNumber) return;

    try {
        const roundRef = firebaseService.database.ref(`games/${gameState.gameId}/rounds/round_${currentQuestionNumber}`);
        const snapshot = await roundRef.once('value');

        if (snapshot.exists()) {
            const roundData = snapshot.val();
            const answers = roundData.answers || {};
            const answerCount = Object.keys(answers).length;
            const playerCount = Object.keys(currentPlayers).length;

            log(`🔍 Manual check: ${answerCount}/${playerCount} answers`);

            if (answerCount >= playerCount && playerCount >= 2 && currentPhase === 'waiting') {
                log('✅ All answered detected in manual check!');
                currentRoundData = roundData;
                calculateAndShowResults();
            }
        }
    } catch (error) {
        log(`❌ Error in manual check: ${error.message}`, 'error');
    }
}

// ===== PHASE MANAGEMENT =====
function showPhase(phase) {
    document.querySelectorAll('.game-phase').forEach(p => {
        p.classList.remove('active');
    });

    document.getElementById(`${phase}-phase`).classList.add('active');
    currentPhase = phase;

    log(`📍 Phase: ${phase}`);
}

// ===== WAITING PHASE =====
function updateWaitingStatus(answers = {}) {
    const statusContainer = document.getElementById('players-status');
    statusContainer.innerHTML = '';

    Object.entries(currentPlayers).forEach(([playerId, player]) => {
        const hasAnswered = answers[playerId] !== undefined;

        const statusItem = document.createElement('div');
        statusItem.className = 'player-status-item';

        // Sanitize player name
        const playerName = DOMPurify.sanitize(player.name || 'Spieler');
        const statusIndicator = hasAnswered ?
            '<span class="status-indicator status-done">✅ Fertig</span>' :
            '<span class="status-indicator status-waiting">⏳ Wartet...</span>';

        statusItem.innerHTML = DOMPurify.sanitize(`
            <span>${playerName}</span>
            ${statusIndicator}
        `);

        statusContainer.appendChild(statusItem);
    });
}

// ===== RESULTS CALCULATION =====
function calculateAndShowResults() {
    if (!currentRoundData || !currentRoundData.answers) {
        log('❌ No round data available');
        return;
    }

    const answers = currentRoundData.answers;
    const actualYesCount = Object.values(answers).filter(a => a.answer === true).length;

    log(`✅ Alle haben geantwortet! Richtige Antwort: ${actualYesCount} Spieler`);

    // Calculate results
    const results = Object.values(answers).map(playerAnswer => {
        const difference = Math.abs(playerAnswer.estimation - actualYesCount);
        const isCorrect = difference === 0;

        let sips = 0;
        if (!isCorrect) {
            const baseSips = difficultyMultipliers[gameState.difficulty] || 2;
            sips = baseSips + Math.floor(difference / 2);
        }

        return {
            playerId: playerAnswer.playerId,
            playerName: playerAnswer.playerName,
            answer: playerAnswer.answer,
            estimation: playerAnswer.estimation,
            difference: difference,
            isCorrect: isCorrect,
            sips: sips,
            alcoholMode: playerAnswer.alcoholMode !== undefined ? playerAnswer.alcoholMode : true
        };
    });

    // SORT BY SIPS (DESCENDING - Most sips first)
    results.sort((a, b) => b.sips - a.sips);

    // UPDATE OVERALL STATS
    overallStats.totalRounds = currentQuestionNumber;

    results.forEach(result => {
        if (!overallStats.playerStats[result.playerId]) {
            overallStats.playerStats[result.playerId] = {
                name: result.playerName,
                totalSips: 0,
                correctGuesses: 0,
                totalGuesses: 0
            };
        }

        const playerStats = overallStats.playerStats[result.playerId];
        playerStats.totalSips += result.sips;
        playerStats.totalGuesses++;
        if (result.isCorrect) {
            playerStats.correctGuesses++;
        }
    });

    displayRoundResults(results, actualYesCount);
    showPhase('results');

    log('📊 Results calculated and displayed for all players');
}

function displayRoundResults(results, actualYesCount) {
    // Show question as title
    if (currentQuestion && currentQuestion.text) {
        const resultsQuestionEl = document.getElementById('results-question-text');
        resultsQuestionEl.textContent = currentQuestion.text;
    }

    const resultsSummaryEl = document.getElementById('results-summary');
    resultsSummaryEl.textContent = `✅ ${actualYesCount} von ${totalPlayers || results.length} Spielern haben mit "Ja" geantwortet`;

    // Find current player's result
    const myResult = results.find(r => r.playerId === gameState.playerId);

    if (myResult) {
        // Show personal result box
        const personalBox = document.getElementById('personal-result');
        personalBox.style.display = 'block';

        document.getElementById('personal-estimation').textContent = myResult.estimation;

        const statusText = myResult.isCorrect ?
            '✅ Richtig geschätzt!' :
            `❌ Falsch (Diff: ${myResult.difference})`;
        const statusEl = document.getElementById('personal-status');
        statusEl.textContent = statusText;
        statusEl.style.color = myResult.isCorrect ? '#4CAF50' : '#f44336';

        const drinkEmoji = myResult.alcoholMode ? '🍺' : '💧';
        const sipsText = myResult.sips === 0 ?
            '🎯 Keine! Perfekt!' :
            `${myResult.sips} ${drinkEmoji}`;
        document.getElementById('personal-sips').textContent = sipsText;
    }

    // Display results grid (sorted by sips - descending)
    const resultsGrid = document.getElementById('results-grid');
    resultsGrid.innerHTML = '';

    results.forEach((result) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';

        // Color coding
        const isMe = result.playerId === gameState.playerId;
        const isCorrect = result.isCorrect;

        if (isMe) {
            resultItem.classList.add('is-me');
        } else if (isCorrect) {
            resultItem.classList.add('correct-not-me');
        } else {
            resultItem.classList.add('wrong');
        }

        const avatar = DOMPurify.sanitize(result.playerName.substring(0, 2).toUpperCase());
        const playerName = DOMPurify.sanitize(result.playerName);
        const drinkEmoji = result.alcoholMode ? '🍺' : '💧';
        const sipsText = result.sips === 0 ? 'Perfekt! 🎯' : `${result.sips} ${drinkEmoji}`;
        const sipsClass = result.sips === 0 ? 'none' : '';

        resultItem.innerHTML = DOMPurify.sanitize(`
            <div class="player-result">
                <div class="player-avatar">${avatar}</div>
                <div class="player-info">
                    <div class="player-name">${playerName}</div>
                    <div class="player-answer">Tipp: ${result.estimation}</div>
                </div>
            </div>
            <div class="sips-penalty ${sipsClass}">${sipsText}</div>
        `);

        resultsGrid.appendChild(resultItem);
    });
}

// ===== GAME CONTROLS =====
async function nextQuestion() {
    if (!gameState.isHost) {
        showNotification('Nur der Host kann weitermachen!', 'warning');
        return;
    }

    currentQuestionNumber++;
    updateGameDisplay();
    resetForNewQuestion();
    showPhase('question');

    await startNewRound();
    showNotification('Neue Frage geladen! 🎮', 'success');
}

async function showOverallResults() {
    if (!gameState.isHost) {
        showNotification('Nur der Host kann die Gesamtergebnisse zeigen!', 'warning');
        return;
    }

    log('📊 Showing overall results...');

    // Notify all players via Firebase
    if (firebaseService.isReady) {
        try {
            const gameRef = firebaseService.database.ref(`games/${gameState.gameId}`);
            await gameRef.update({
                showOverallResults: true,
                overallStats: overallStats,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });

            log('✅ Overall results notification sent to all players');
        } catch (error) {
            log(`❌ Error sending notification: ${error.message}`, 'error');
        }
    }

    // Show for host
    displayOverallResults();
}

function displayOverallResults() {
    log('🏆 Displaying overall results');

    // Update stats
    document.getElementById('total-rounds').textContent = overallStats.totalRounds;
    document.getElementById('total-players-overall').textContent = Object.keys(overallStats.playerStats).length;

    // Create leaderboard
    const leaderboardList = document.getElementById('overall-leaderboard-list');
    leaderboardList.innerHTML = '';

    // Convert to array and sort by total sips (ascending - least sips = winner)
    const leaderboard = Object.values(overallStats.playerStats).sort((a, b) => a.totalSips - b.totalSips);

    leaderboard.forEach((player, index) => {
        const leaderboardItem = document.createElement('div');
        leaderboardItem.className = `leaderboard-item ${index === 0 ? 'winner' : ''}`;

        const rankClass = index === 0 ? 'rank-1' :
            index === 1 ? 'rank-2' :
                index === 2 ? 'rank-3' : 'rank-other';

        const correctText = `${player.correctGuesses} Fragen richtig`;
        const playerName = DOMPurify.sanitize(player.name);

        leaderboardItem.innerHTML = DOMPurify.sanitize(`
            <div class="rank-badge ${rankClass}">${index + 1}</div>
            <div class="leaderboard-player-info">
                <div class="leaderboard-player-name">${playerName}</div>
                <div class="leaderboard-player-stats">
                    <span>🍺 ${player.totalSips} Schlücke</span>
                    <span>🎯 ${correctText}</span>
                </div>
            </div>
        `);

        leaderboardList.appendChild(leaderboardItem);
    });

    // Show/hide controls
    if (gameState.isHost) {
        document.getElementById('overall-host-controls').style.display = 'block';
        document.getElementById('overall-player-controls').style.display = 'none';
    } else {
        document.getElementById('overall-host-controls').style.display = 'none';
        document.getElementById('overall-player-controls').style.display = 'block';
    }

    showPhase('overall-results');
}

async function continueGame() {
    if (!gameState.isHost) {
        showNotification('Nur der Host kann das Spiel fortfahren!', 'warning');
        return;
    }

    log('▶️ Continuing game...');

    // Clear overall results flag
    if (firebaseService.isReady) {
        try {
            const gameRef = firebaseService.database.ref(`games/${gameState.gameId}`);
            await gameRef.update({
                showOverallResults: false,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            log(`❌ Error: ${error.message}`, 'error');
        }
    }

    // Start next question
    currentQuestionNumber++;
    updateGameDisplay();
    resetForNewQuestion();
    showPhase('question');

    await startNewRound();
    showNotification('Spiel wird fortgesetzt! 🎮', 'success');
}

async function endGameForAll() {
    if (!gameState.isHost) {
        showNotification('Nur der Host kann das Spiel beenden!', 'warning');
        return;
    }

    if (!confirm('Spiel wirklich für ALLE Spieler beenden?')) {
        return;
    }

    log('🛑 Ending game for all players...');

    if (firebaseService.isReady) {
        try {
            const gameRef = firebaseService.database.ref(`games/${gameState.gameId}`);
            await gameRef.update({
                gameState: 'finished',
                endedAt: firebase.database.ServerValue.TIMESTAMP,
                finalStats: overallStats
            });

            showNotification('Spiel wurde beendet! 👋', 'success');

            setTimeout(() => {
                cleanup();
                window.location.href = 'index.html';
            }, 2000);

        } catch (error) {
            log(`❌ Error ending game: ${error.message}`, 'error');
            showNotification('Fehler beim Beenden', 'error');
        }
    } else {
        // Offline fallback
        cleanup();
        window.location.href = 'index.html';
    }
}

function cleanup() {
    if (gameListener) {
        try {
            gameListener.off();
        } catch (e) {}
    }
    if (roundListener) {
        try {
            roundListener.off();
        } catch (e) {}
    }
    if (firebaseService) {
        firebaseService.cleanup();
    }
}

// ===== CLEANUP =====
window.addEventListener('beforeunload', cleanup);

// ===== UTILITY FUNCTIONS =====
function showLoading() {
    document.getElementById('loading-screen').classList.add('show');
}

function hideLoading() {
    document.getElementById('loading-screen').classList.remove('show');
}

function showNotification(message, type = 'info') {
    document.querySelectorAll('.toast-notification').forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `toast-notification ${type}`;

    const iconMap = {
        'success': '✅',
        'warning': '⚠️',
        'error': '❌',
        'info': 'ℹ️'
    };

    const sanitizedMessage = DOMPurify.sanitize(message);

    notification.innerHTML = DOMPurify.sanitize(`
        <div class="toast-content">
            <div class="toast-icon">${iconMap[type] || iconMap.info}</div>
            <div class="toast-message">${sanitizedMessage}</div>
        </div>
    `);

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

function log(message, type = 'info') {
    const colors = {
        info: '#4488ff',
        warning: '#ffaa00',
        error: '#ff4444',
        success: '#00ff00'
    };
    console.log(`%c[Gameplay] ${message}`, `color: ${colors[type] || colors.info}`);
}

// ===== DEBUG =====
window.debugGameplay = function() {
    console.log('🔍 === GAMEPLAY DEBUG ===');
    console.log('GameState:', gameState);
    console.log('Firebase:', {
        initialized: firebaseService?.isInitialized,
        connected: firebaseService?.isConnected
    });
    console.log('Current Game Data:', currentGameData);
    console.log('Current Round Data:', currentRoundData);
    console.log('Current Question:', currentQuestion);
    console.log('Players:', currentPlayers);
};

log('✅ No-Cap Multiplayer Gameplay v8.0 - Production Ready - vollständig geladen!');
log('🛠️ Debug: debugGameplay()');