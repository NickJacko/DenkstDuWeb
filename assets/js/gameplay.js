// ===== NO-CAP GAMEPLAY (SINGLE DEVICE MODE) =====
// Version: 2.0 - Refactored with central GameState
// Mode: Single Device - Endless Gameplay

'use strict';

// ===== FIREBASE SERVICE =====
class FirebaseService {
    constructor() {
        this.app = null;
        this.database = null;
        this.isInitialized = false;
        this.isConnected = false;
        this.config = {
            apiKey: "AIzaSyAcUgQ6rHZXQvKsMQmzMPr77Hk-W4R2Zt0",
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
            log('🔥 Initializing Firebase...');

            if (typeof firebase === 'undefined') {
                log('⚠️ Firebase SDK not loaded, using fallback mode', 'warning');
                return false;
            }

            if (!firebase.apps || firebase.apps.length === 0) {
                this.app = firebase.initializeApp(this.config);
            } else {
                this.app = firebase.app();
            }

            this.database = firebase.database();
            this.isInitialized = true;

            // Test connection
            const connectedRef = this.database.ref('.info/connected');
            const snapshot = await connectedRef.once('value');
            this.isConnected = snapshot.val() === true;

            log(`✅ Firebase ${this.isConnected ? 'connected' : 'initialized (offline)'}`);
            return true;

        } catch (error) {
            log(`❌ Firebase initialization failed: ${error.message}`, 'error');
            return false;
        }
    }

    async loadQuestionsFromCategory(category) {
        if (!this.isInitialized || !this.isConnected) {
            return null;
        }

        try {
            const questionsRef = this.database.ref(`questions/${category}`);
            const snapshot = await questionsRef.once('value');

            if (snapshot.exists()) {
                const questionsObj = snapshot.val();
                return Object.values(questionsObj);
            }
            return null;
        } catch (error) {
            log(`❌ Error loading ${category} questions: ${error.message}`, 'error');
            return null;
        }
    }
}

// ===== FALLBACK QUESTIONS DATABASE =====
const fallbackQuestionsDatabase = {
    fsk0: [
        "Ich habe schon mal... ein ganzes Buch an einem Tag gelesen",
        "Ich habe schon mal... Pizza zum Frühstück gegessen",
        "Ich habe schon mal... mehr als 12 Stunden am Stück geschlafen",
        "Ich habe schon mal... einen ganzen Tag im Pyjama verbracht",
        "Ich habe schon mal... beim Kochen das Essen anbrennen lassen"
    ],
    fsk16: [
        "Ich habe schon mal... so getan, als wäre ich krank, um nicht zur Schule zu müssen",
        "Ich habe schon mal... bis 3 Uhr morgens Netflix geschaut",
        "Ich habe schon mal... ein Lied so laut gesungen, dass die Nachbarn sich beschwert haben",
        "Ich habe schon mal... vergessen, wo ich mein Auto geparkt habe"
    ],
    fsk18: [
        "Ich habe schon mal... an einem öffentlichen Ort Sex gehabt",
        "Ich habe schon mal... eine Affäre gehabt",
        "Ich habe schon mal... in einer Beziehung betrogen"
    ]
};

// ===== GLOBAL VARIABLES =====
let gameState = null;
let firebaseService = null;
let alcoholMode = false;
let isExitDialogShown = false;

let currentGame = {
    players: [],
    allQuestions: [],
    usedQuestions: [],
    currentQuestionNumber: 1,
    currentPlayerIndex: 0,
    currentAnswers: {},
    currentEstimates: {},
    gameHistory: []
};

let currentAnswer = null;
let currentEstimation = null;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initializeGame();
});

async function initializeGame() {
    log('🎮 Initializing endless single device gameplay...');

    // Setup page leave protection
    setupPageLeaveProtection();

    // Check alcohol mode
    checkAlcoholMode();

    // Load central GameState
    if (typeof GameState === 'undefined') {
        log('❌ GameState not found - Load central version', 'error');
        showNotification('Fehler beim Laden. Bitte Seite neu laden.', 'error');
        return;
    }

    gameState = GameState.load();

    // Debug: Log loaded state
    log('📊 Loaded GameState:', {
        deviceMode: gameState.deviceMode,
        categories: gameState.selectedCategories,
        difficulty: gameState.difficulty,
        players: gameState.players,
        playersCount: gameState.players ? gameState.players.length : 0
    });

    // Initialize Firebase
    firebaseService = new FirebaseService();
    await firebaseService.initialize();

    // Validate game state
    if (!validateGameState()) {
        return; // Redirects handled in function
    }

    // Setup game
    currentGame.players = [...gameState.players];
    await generateAllQuestions();

    // Initialize UI
    updateGameDisplay();
    createNumberGrid();

    // Setup event listeners
    setupEventListeners();

    // Start first question
    startNewQuestion();

    log('✅ Endless game initialized:', {
        players: currentGame.players,
        categories: gameState.selectedCategories,
        difficulty: gameState.difficulty,
        totalQuestions: currentGame.allQuestions.length
    });
}

// ===== VALIDATION & GUARDS =====
function validateGameState() {
    // Check device mode
    if (gameState.deviceMode !== 'single') {
        log('❌ Not in single device mode', 'error');
        showNotification('Nicht im Einzelgerät-Modus. Weiterleitung...', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }

    // Check players
    if (!gameState.players || gameState.players.length < 2) {
        log('❌ Not enough players', 'error');
        showNotification('Keine Spieler gefunden!', 'error');
        setTimeout(() => window.location.href = 'player-setup.html', 2000);
        return false;
    }

    // Check categories
    if (!gameState.selectedCategories || gameState.selectedCategories.length === 0) {
        log('❌ No categories selected', 'error');
        showNotification('Keine Kategorien ausgewählt!', 'error');
        setTimeout(() => window.location.href = 'category-selection.html', 2000);
        return false;
    }

    // Check difficulty
    if (!gameState.difficulty) {
        log('❌ No difficulty selected', 'error');
        showNotification('Kein Schwierigkeitsgrad ausgewählt!', 'error');
        setTimeout(() => window.location.href = 'difficulty-selection.html', 2000);
        return false;
    }

    return true;
}

// ===== EVENT LISTENERS SETUP =====
function setupEventListeners() {
    log('🔧 Setting up event listeners...');

    // Answer buttons
    const yesBtn = document.getElementById('yes-btn');
    const noBtn = document.getElementById('no-btn');

    if (yesBtn) {
        yesBtn.addEventListener('click', () => selectAnswer(true));
    }
    if (noBtn) {
        noBtn.addEventListener('click', () => selectAnswer(false));
    }

    // Submit button
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitAnswer);
    }

    // Exit confirmation buttons
    const exitCancel = document.querySelector('.exit-btn.cancel');
    const exitConfirm = document.querySelector('.exit-btn.confirm');

    if (exitCancel) {
        exitCancel.addEventListener('click', cancelExit);
    }
    if (exitConfirm) {
        exitConfirm.addEventListener('click', confirmExit);
    }

    // Results navigation buttons - using delegation since they might be hidden/shown
    document.addEventListener('click', function(e) {
        if (e.target.closest('.nav-btn.primary')) {
            const btn = e.target.closest('.nav-btn.primary');
            if (btn.textContent.includes('Nächste Frage')) {
                nextQuestion();
            } else if (btn.textContent.includes('Spiel beenden')) {
                goHome();
            }
        } else if (e.target.closest('.nav-btn.secondary')) {
            endGame();
        }
    });

    log('✅ Event listeners setup complete');
}

// ===== PAGE LEAVE PROTECTION =====
function setupPageLeaveProtection() {
    window.addEventListener('beforeunload', function(e) {
        if (!isExitDialogShown) {
            e.preventDefault();
            e.returnValue = 'Möchtest du das Spiel wirklich verlassen? Der Fortschritt geht verloren.';
            return e.returnValue;
        }
    });

    window.addEventListener('popstate', function(e) {
        e.preventDefault();
        showExitConfirmation();
        history.pushState(null, null, window.location.pathname);
    });

    history.pushState(null, null, window.location.pathname);
}

function showExitConfirmation() {
    const exitDialog = document.getElementById('exit-confirmation');
    if (exitDialog) {
        exitDialog.classList.add('show');
    }
}

function cancelExit() {
    const exitDialog = document.getElementById('exit-confirmation');
    if (exitDialog) {
        exitDialog.classList.remove('show');
    }
}

function confirmExit() {
    try {
        localStorage.clear();
        sessionStorage.clear();
        isExitDialogShown = true;
        window.location.replace('index.html');
    } catch (error) {
        log(`Exit error: ${error.message}`, 'error');
        window.location.href = 'index.html?t=' + Date.now();
    }
}

function goHome() {
    try {
        localStorage.clear();
        sessionStorage.clear();
        isExitDialogShown = true;
        window.location.replace('index.html');
    } catch (error) {
        window.location.href = 'index.html?t=' + Date.now();
    }
}

// ===== ALCOHOL MODE CHECK =====
function checkAlcoholMode() {
    try {
        const alcoholModeStr = localStorage.getItem('nocap_alcohol_mode');
        alcoholMode = alcoholModeStr === 'true';
        log(`🍺 Alcohol mode: ${alcoholMode}`);
    } catch (error) {
        log(`❌ Error checking alcohol mode: ${error.message}`, 'error');
        alcoholMode = false;
    }
}

// ===== QUESTION GENERATION =====
async function generateAllQuestions() {
    currentGame.allQuestions = [];

    // Try to load questions from Firebase first
    for (const category of gameState.selectedCategories) {
        const firebaseQuestions = await firebaseService.loadQuestionsFromCategory(category);

        if (firebaseQuestions && firebaseQuestions.length > 0) {
            log(`✅ Loaded ${firebaseQuestions.length} questions from Firebase for ${category}`);
            firebaseQuestions.forEach(q => {
                currentGame.allQuestions.push({
                    text: q,
                    category: category
                });
            });
        } else {
            // Fallback to local questions
            log(`⚠️ Using fallback questions for ${category}`, 'warning');
            if (fallbackQuestionsDatabase[category]) {
                fallbackQuestionsDatabase[category].forEach(q => {
                    currentGame.allQuestions.push({
                        text: q,
                        category: category
                    });
                });
            }
        }
    }

    // Shuffle questions
    currentGame.allQuestions = shuffleArray(currentGame.allQuestions);

    log(`📚 Total questions loaded: ${currentGame.allQuestions.length}`);
}

function getNextQuestion() {
    if (currentGame.usedQuestions.length >= currentGame.allQuestions.length) {
        currentGame.usedQuestions = [];
        currentGame.allQuestions = shuffleArray(currentGame.allQuestions);
        showNotification('Alle Fragen gespielt! Mische neu...', 'success');
    }

    for (let question of currentGame.allQuestions) {
        if (!currentGame.usedQuestions.includes(question.text)) {
            currentGame.usedQuestions.push(question.text);
            return question;
        }
    }

    return currentGame.allQuestions[0];
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// ===== GAME FLOW =====
function startNewQuestion() {
    log(`🎲 Starting question ${currentGame.currentQuestionNumber}`);

    currentGame.currentPlayerIndex = 0;
    currentGame.currentAnswers = {};
    currentGame.currentEstimates = {};

    const question = getNextQuestion();
    loadQuestion(question);

    resetPlayerUI();
    updateGameDisplay();
    showGameView();
}

function nextQuestion() {
    currentGame.currentQuestionNumber++;
    startNewQuestion();
    showNotification('Neue Frage geladen! 🎮', 'success');
}

function endGame() {
    showFinalResults();
}

function loadQuestion(question) {
    const categoryNames = {
        'fsk0': '👨‍👩‍👧‍👦 Familie & Freunde',
        'fsk16': '🎉 Party Time',
        'fsk18': '🔥 Heiß & Gewagt'
    };

    const questionText = document.getElementById('question-text');
    const questionCategory = document.getElementById('question-category');

    if (questionText) {
        questionText.textContent = question.text;
    }
    if (questionCategory) {
        questionCategory.textContent = categoryNames[question.category] || '🎮 Spiel';
    }
}

function updateGameDisplay() {
    const totalPlayersEl = document.getElementById('total-players');
    if (totalPlayersEl) {
        totalPlayersEl.textContent = currentGame.players.length;
    }

    const currentPlayerName = currentGame.players[currentGame.currentPlayerIndex];

    const playerNameEl = document.getElementById('current-player-name');
    const avatarEl = document.getElementById('current-avatar');
    const progressEl = document.getElementById('player-progress');

    if (playerNameEl) {
        playerNameEl.textContent = currentPlayerName;
    }
    if (avatarEl) {
        avatarEl.textContent = currentPlayerName.charAt(0).toUpperCase();
    }
    if (progressEl) {
        progressEl.textContent = `(${currentGame.currentPlayerIndex + 1}/${currentGame.players.length})`;
    }
}

function resetPlayerUI() {
    // Reset answer buttons
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    // Reset estimation to unselected state
    currentAnswer = null;
    currentEstimation = null;
    updateNumberSelection();
    hideSelectionDisplay();
    updateSubmitButton();
}

// ===== UI CONTROLS =====
function createNumberGrid() {
    const numberGrid = document.getElementById('number-grid');
    if (!numberGrid) return;

    const playerCount = currentGame.players.length;
    numberGrid.innerHTML = '';

    // Dynamische Grid-Klasse basierend auf Anzahl
    if (playerCount <= 6) {
        numberGrid.className = 'number-grid small';
    } else if (playerCount <= 10) {
        numberGrid.className = 'number-grid medium';
    } else {
        numberGrid.className = 'number-grid large';
    }

    for (let i = 0; i <= playerCount; i++) {
        const numberBtn = document.createElement('button');
        numberBtn.className = 'number-btn';
        numberBtn.textContent = i;
        numberBtn.id = `number-btn-${i}`;
        numberBtn.addEventListener('click', () => selectNumber(i));

        numberGrid.appendChild(numberBtn);
    }
}

function selectNumber(number) {
    if (number >= 0 && number <= currentGame.players.length) {
        currentEstimation = number;
        updateSelectedNumber(number);
        showSelectionDisplay();
        updateNumberSelection();
        updateSubmitButton();

        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }
}

function updateSelectedNumber(number) {
    const selectedNumberEl = document.getElementById('selected-number');
    if (selectedNumberEl) {
        selectedNumberEl.textContent = number;
    }

    const selectionDisplay = document.querySelector('.selection-display');
    if (selectionDisplay) {
        // Smooth bounce animation
        selectionDisplay.style.transform = 'scale(1.08)';
        setTimeout(() => {
            selectionDisplay.style.transform = 'scale(1)';
        }, 300);
    }
}

function showSelectionDisplay() {
    const selectionEl = document.getElementById('current-selection');
    if (selectionEl) {
        // Kleine Verzögerung für smooth animation
        requestAnimationFrame(() => {
            selectionEl.classList.add('visible');
        });
    }
}

function hideSelectionDisplay() {
    const selectionEl = document.getElementById('current-selection');
    if (selectionEl) {
        selectionEl.classList.remove('visible');
    }
}

function updateNumberSelection() {
    document.querySelectorAll('.number-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    if (currentEstimation !== null) {
        const selectedBtn = document.getElementById(`number-btn-${currentEstimation}`);
        if (selectedBtn) {
            selectedBtn.classList.add('selected');
        }
    }
}

function selectAnswer(answer) {
    currentAnswer = answer;

    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    const selectedBtn = answer ? document.getElementById('yes-btn') : document.getElementById('no-btn');
    if (selectedBtn) {
        selectedBtn.classList.add('selected');
    }

    updateSubmitButton();
}

function updateSubmitButton() {
    const submitBtn = document.getElementById('submit-btn');
    if (!submitBtn) return;

    if (currentAnswer !== null && currentEstimation !== null) {
        submitBtn.classList.add('enabled');
        submitBtn.disabled = false;
    } else {
        submitBtn.classList.remove('enabled');
        submitBtn.disabled = true;
    }
}

// ===== GAME ACTIONS =====
function submitAnswer() {
    if (currentAnswer === null || currentEstimation === null) {
        showNotification('Bitte wähle eine Antwort und eine Schätzung aus!', 'warning');
        return;
    }

    const currentPlayerName = currentGame.players[currentGame.currentPlayerIndex];

    currentGame.currentAnswers[currentPlayerName] = currentAnswer;
    currentGame.currentEstimates[currentPlayerName] = currentEstimation;

    log(`📤 ${currentPlayerName} answered:`, {
        answer: currentAnswer,
        estimation: currentEstimation
    });

    if (currentGame.currentPlayerIndex < currentGame.players.length - 1) {
        currentGame.currentPlayerIndex++;
        currentAnswer = null;
        currentEstimation = null;
        resetPlayerUI();
        updateGameDisplay();
        showPlayerChangePopup();
    } else {
        showResults();
    }
}

// ===== PLAYER CHANGE POPUP =====
function showPlayerChangePopup() {
    const currentPlayerName = currentGame.players[currentGame.currentPlayerIndex];

    const popupName = document.getElementById('popup-name');
    const popupAvatar = document.getElementById('popup-avatar');

    if (popupName) {
        popupName.textContent = currentPlayerName;
    }
    if (popupAvatar) {
        popupAvatar.textContent = currentPlayerName.charAt(0).toUpperCase();
    }

    const popup = document.getElementById('player-change-popup');
    if (popup) {
        popup.classList.add('show');
    }

    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
    }

    setTimeout(() => {
        if (popup) {
            popup.classList.remove('show');
        }
    }, 2000);
}

// ===== RESULTS =====
function showResults() {
    log('📊 Calculating results...');

    const actualYesCount = Object.values(currentGame.currentAnswers).filter(answer => answer === true).length;

    const results = currentGame.players.map(playerName => {
        const answer = currentGame.currentAnswers[playerName];
        const estimation = currentGame.currentEstimates[playerName];
        const difference = Math.abs(estimation - actualYesCount);
        const isCorrect = difference === 0;

        let sips = 0;
        if (!isCorrect) {
            const baseSips = getDifficultyMultiplier();
            sips = baseSips + difference;
        }

        return {
            playerName: playerName,
            answer: answer,
            estimation: estimation,
            difference: difference,
            isCorrect: isCorrect,
            sips: sips
        };
    });

    currentGame.gameHistory.push({
        questionNumber: currentGame.currentQuestionNumber,
        actualYesCount: actualYesCount,
        results: results
    });

    displayResults(results, actualYesCount);
    showResultsView();
}

function getDifficultyMultiplier() {
    switch (gameState.difficulty) {
        case 'easy': return 1;
        case 'hard': return 3;
        default: return 2;
    }
}

function displayResults(results, actualYesCount) {
    const resultsSummary = document.getElementById('results-summary');
    if (resultsSummary) {
        resultsSummary.textContent =
            `${actualYesCount} von ${currentGame.players.length} Spielern haben "Ja" geantwortet`;
    }

    const sortedResults = results.sort((a, b) => {
        if (a.isCorrect && !b.isCorrect) return -1;
        if (!a.isCorrect && b.isCorrect) return 1;
        return a.sips - b.sips;
    });

    const resultsGrid = document.getElementById('results-grid');
    if (!resultsGrid) return;

    resultsGrid.innerHTML = '';

    // Emoji basierend auf Alcohol Mode
    const drinkEmoji = alcoholMode ? '🍺' : '💧';

    sortedResults.forEach(result => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';

        const avatar = result.playerName.charAt(0).toUpperCase();

        // Singular/Plural bei Schlücken
        const sipsText = result.sips === 0 ? 'Perfekt! 🎯' :
            result.sips === 1 ? `1 Schluck ${drinkEmoji}` :
                `${result.sips} Schlücke ${drinkEmoji}`;
        const sipsClass = result.sips === 0 ? 'none' : '';

        const resultAvatar = document.createElement('div');
        resultAvatar.className = 'result-avatar';
        resultAvatar.textContent = avatar;

        const playerResult = document.createElement('div');
        playerResult.className = 'player-result';

        const playerResultInfo = document.createElement('div');
        playerResultInfo.className = 'player-result-info';

        const playerResultName = document.createElement('div');
        playerResultName.className = 'player-result-name';
        playerResultName.textContent = result.playerName;

        const playerAnswer = document.createElement('div');
        playerAnswer.className = 'player-answer';
        playerAnswer.textContent = `Tipp: ${result.estimation}`;

        playerResultInfo.appendChild(playerResultName);
        playerResultInfo.appendChild(playerAnswer);

        playerResult.appendChild(resultAvatar);
        playerResult.appendChild(playerResultInfo);

        const sipsPenalty = document.createElement('div');
        sipsPenalty.className = `sips-penalty ${sipsClass}`;
        sipsPenalty.textContent = sipsText;

        resultItem.appendChild(playerResult);
        resultItem.appendChild(sipsPenalty);

        resultsGrid.appendChild(resultItem);
    });
}

function showResultsView() {
    const answerSection = document.getElementById('answer-section');
    const estimationSection = document.getElementById('estimation-section');
    const submitSection = document.getElementById('submit-section');
    const currentPlayerCard = document.querySelector('.current-player-card');
    const resultsSection = document.getElementById('results-section');

    if (answerSection) answerSection.style.display = 'none';
    if (estimationSection) estimationSection.style.display = 'none';
    if (submitSection) submitSection.style.display = 'none';
    if (currentPlayerCard) currentPlayerCard.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'flex';

    showNotification('Ergebnisse werden angezeigt...', 'success', 2000);
}

function showGameView() {
    const answerSection = document.getElementById('answer-section');
    const estimationSection = document.getElementById('estimation-section');
    const submitSection = document.getElementById('submit-section');
    const currentPlayerCard = document.querySelector('.current-player-card');
    const resultsSection = document.getElementById('results-section');

    if (answerSection) answerSection.style.display = 'block';
    if (estimationSection) estimationSection.style.display = 'flex';
    if (submitSection) submitSection.style.display = 'block';
    if (currentPlayerCard) currentPlayerCard.style.display = 'flex';
    if (resultsSection) resultsSection.style.display = 'none';
}

// ===== FINAL RESULTS =====
function showFinalResults() {
    log('🏆 Calculating final results...');

    const playerStats = calculatePlayerStatistics();
    const finalRankings = playerStats.sort((a, b) => a.totalSips - b.totalSips);

    displayFinalResults(finalRankings);
    showFinalResultsView();
}

function calculatePlayerStatistics() {
    const playerStats = {};

    currentGame.players.forEach(player => {
        playerStats[player] = {
            playerName: player,
            totalSips: 0,
            correctGuesses: 0,
            totalGuesses: 0
        };
    });

    currentGame.gameHistory.forEach(round => {
        round.results.forEach(result => {
            const stats = playerStats[result.playerName];
            if (stats) {
                stats.totalSips += result.sips;
                stats.totalGuesses++;
                if (result.isCorrect) {
                    stats.correctGuesses++;
                }
            }
        });
    });

    return Object.values(playerStats);
}

function displayFinalResults(finalRankings) {
    const leaderboardList = document.getElementById('leaderboard-list');
    if (!leaderboardList) return;

    leaderboardList.innerHTML = '';

    // Emoji basierend auf Alcohol Mode
    const drinkEmoji = alcoholMode ? '🍺' : '💧';

    finalRankings.forEach((player, index) => {
        const leaderboardItem = document.createElement('div');
        leaderboardItem.className = `leaderboard-item ${index === 0 ? 'winner' : ''}`;

        const rankClass = index === 0 ? 'rank-1' :
            index === 1 ? 'rank-2' :
                index === 2 ? 'rank-3' : 'rank-other';

        const rankText = index + 1;
        const avatar = player.playerName.charAt(0).toUpperCase();

        // Singular/Plural bei Schlücken und Fragen
        const sipsText = player.totalSips === 1 ? '1 Schluck' : `${player.totalSips} Schlücke`;
        const questionsText = player.correctGuesses === 1 ? '1 Frage richtig' : `${player.correctGuesses} Fragen richtig`;

        // Build elements
        const rankNumber = document.createElement('div');
        rankNumber.className = `rank-number ${rankClass}`;
        rankNumber.textContent = rankText;

        const resultAvatar = document.createElement('div');
        resultAvatar.className = 'result-avatar';
        resultAvatar.textContent = avatar;

        const playerFinalStats = document.createElement('div');
        playerFinalStats.className = 'player-final-stats';

        const playerFinalName = document.createElement('div');
        playerFinalName.className = 'player-final-name';
        playerFinalName.textContent = player.playerName;

        const playerFinalDetails = document.createElement('div');
        playerFinalDetails.className = 'player-final-details';

        const detailItem1 = document.createElement('div');
        detailItem1.className = 'detail-item';
        detailItem1.innerHTML = `
            <span class="detail-icon">${drinkEmoji}</span>
            <span>${sipsText}</span>
        `;

        const detailItem2 = document.createElement('div');
        detailItem2.className = 'detail-item';
        detailItem2.innerHTML = `
            <span class="detail-icon">🎯</span>
            <span>${questionsText}</span>
        `;

        playerFinalDetails.appendChild(detailItem1);
        playerFinalDetails.appendChild(detailItem2);

        playerFinalStats.appendChild(playerFinalName);
        playerFinalStats.appendChild(playerFinalDetails);

        leaderboardItem.appendChild(rankNumber);
        leaderboardItem.appendChild(resultAvatar);
        leaderboardItem.appendChild(playerFinalStats);

        leaderboardList.appendChild(leaderboardItem);
    });

    showNotification(
        `🏆 ${finalRankings[0].playerName} hat gewonnen!`,
        'success',
        3000
    );
}

function showFinalResultsView() {
    const questionCard = document.querySelector('.question-card');
    const answerSection = document.getElementById('answer-section');
    const estimationSection = document.getElementById('estimation-section');
    const submitSection = document.getElementById('submit-section');
    const currentPlayerCard = document.querySelector('.current-player-card');
    const resultsSection = document.getElementById('results-section');
    const finalResultsSection = document.getElementById('final-results-section');

    if (questionCard) questionCard.style.display = 'none';
    if (answerSection) answerSection.style.display = 'none';
    if (estimationSection) estimationSection.style.display = 'none';
    if (submitSection) submitSection.style.display = 'none';
    if (currentPlayerCard) currentPlayerCard.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'none';
    if (finalResultsSection) finalResultsSection.style.display = 'flex';
}

// ===== UTILITY FUNCTIONS =====
function showNotification(message, type = 'info', duration = 3000) {
    // Remove existing notifications
    document.querySelectorAll('.toast-notification').forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `toast-notification ${type}`;

    const iconMap = {
        'success': '✅',
        'warning': '⚠️',
        'error': '❌',
        'info': 'ℹ️'
    };

    const toastContent = document.createElement('div');
    toastContent.className = 'toast-content';

    const toastIcon = document.createElement('div');
    toastIcon.className = 'toast-icon';
    toastIcon.textContent = iconMap[type] || 'ℹ️';

    const toastMessage = document.createElement('div');
    toastMessage.className = 'toast-message';
    toastMessage.textContent = message;

    toastContent.appendChild(toastIcon);
    toastContent.appendChild(toastMessage);
    notification.appendChild(toastContent);

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, duration);
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

// ===== DEBUG FUNCTIONS =====
window.debugGameplay = function() {
    console.log('🔍 === GAMEPLAY DEBUG ===');
    console.log('GameState:', gameState?.getDebugInfo?.());
    console.log('Current Game:', currentGame);
    console.log('Current Answer:', currentAnswer);
    console.log('Current Estimation:', currentEstimation);
    console.log('Alcohol Mode:', alcoholMode);
    console.log('Firebase:', {
        initialized: firebaseService?.isInitialized,
        connected: firebaseService?.isConnected
    });
};

log('✅ No-Cap Gameplay - JS loaded!');
log('🛠️ Debug: debugGameplay()');