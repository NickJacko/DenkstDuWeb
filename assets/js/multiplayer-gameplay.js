/**
 * No-Cap Multiplayer Gameplay
 * Version 3.0 - Audit-Fixed & Production Ready with Real-Time Sync
 *
 * CRITICAL: Complex 4-phase gameplay with Firebase real-time synchronization
 * - Phase 1: Question & Answer
 * - Phase 2: Waiting for others
 * - Phase 3: Round Results
 * - Phase 4: Overall Results
 */

(function(window) {
    'use strict';

    // ===========================
    // CONSTANTS & FALLBACK QUESTIONS
    // ===========================
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
            "Ich habe schon mal... so getan, als wäre ich krank",
            "Ich habe schon mal... bis 3 Uhr morgens Netflix geschaut",
            "Ich habe schon mal... vergessen, wo ich mein Auto geparkt habe"
        ],
        fsk18: [
            "Ich habe schon mal... an einem öffentlichen Ort geküsst",
            "Ich habe schon mal... eine peinliche Nachricht an die falsche Person geschickt",
            "Ich habe schon mal... in einer Beziehung gelogen"
        ]
    };

    const categoryNames = {
        'fsk0': '👨‍👩‍👧‍👦 Familie & Freunde',
        'fsk16': '🎉 Party Time',
        'fsk18': '🔥 Heiß & Gewagt',
        'special': '⭐ Special Edition'
    };

    const difficultyMultipliers = {
        'easy': 1,
        'medium': 1,
        'hard': 2
    };

    // ===========================
    // GLOBAL STATE
    // ===========================
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
    let hasSubmittedThisRound = false; // P0: Anti-cheat

    // Overall stats tracking
    let overallStats = {
        totalRounds: 0,
        playerStats: {}
    };

    const isDevelopment = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

    // ===========================
    // P0 FIX: INPUT SANITIZATION
    // ===========================

    function sanitizeText(input) {
        if (!input) return '';

        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            return window.NocapUtils.sanitizeInput(String(input));
        }

        return String(input).replace(/<[^>]*>/g, '').substring(0, 500);
    }

    function sanitizePlayerName(name) {
        if (!name) return 'Spieler';

        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            return window.NocapUtils.sanitizeInput(String(name)).substring(0, 20);
        }

        return String(name).replace(/<[^>]*>/g, '').substring(0, 20);
    }

    // ===========================
    // INITIALIZATION
    // ===========================

    async function initialize() {
        if (isDevelopment) {
            console.log('🎮 Initializing multiplayer gameplay...');
        }

        showLoading();

        // P0 FIX: Check DOMPurify
        if (typeof DOMPurify === 'undefined') {
            console.error('❌ CRITICAL: DOMPurify not loaded!');
            alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
            return;
        }

        // Check dependencies
        if (typeof GameState === 'undefined') {
            console.error('❌ GameState not loaded');
            showNotification('Fehler beim Laden', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }

        // P1 FIX: Wait for dependencies
        if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
            await window.NocapUtils.waitForDependencies(['GameState', 'firebaseGameService', 'firebase']);
        }

        gameState = new GameState();

        // Validate state
        if (!validateGameState()) {
            hideLoading();
            return;
        }

        // P0 FIX: Use global firebaseGameService
        if (typeof window.firebaseGameService !== 'undefined') {
            firebaseService = window.firebaseGameService;
        } else {
            console.error('❌ Firebase service not available');
            showNotification('Firebase nicht verfügbar', 'error');
            hideLoading();
            return;
        }

        // Setup Firebase listeners
        await setupFirebaseListeners();

        // Initialize UI
        updateGameDisplay();
        createNumberGrid();
        updateSubmitButton();

        // Setup event listeners
        setupEventListeners();

        // Show/hide role-based controls
        updateUIForRole();

        hideLoading();
        if (isDevelopment) {
            console.log('✅ Gameplay initialized');
        }
    }

    // ===========================
    // VALIDATION
    // ===========================

    function validateGameState() {
        if (isDevelopment) {
            console.log('🔍 Validating game state...');
        }

        if (!gameState || gameState.deviceMode !== 'multi') {
            console.error('❌ Invalid device mode:', gameState?.deviceMode);
            showNotification('Kein Multiplayer-Spiel aktiv!', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (!gameState.gameId) {
            console.error('❌ No game ID');
            showNotification('Keine Spiel-ID gefunden!', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        // P0 FIX: Validate age verification with expiration
        let ageLevel = 0;
        let ageTimestamp = 0;

        if (window.NocapUtils && window.NocapUtils.getLocalStorage) {
            ageLevel = parseInt(window.NocapUtils.getLocalStorage('nocap_age_level')) || 0;
            ageTimestamp = parseInt(window.NocapUtils.getLocalStorage('age_timestamp')) || 0;
        }

        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (now - ageTimestamp > maxAge) {
            console.error('❌ Age verification expired');
            showNotification('Altersverifizierung abgelaufen!', 'warning');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        // P0 FIX: Validate FSK access for selected categories
        if (gameState.selectedCategories && gameState.selectedCategories.length > 0) {
            const hasInvalidCategory = gameState.selectedCategories.some(cat => {
                if (cat === 'fsk18' && ageLevel < 18) return true;
                if (cat === 'fsk16' && ageLevel < 16) return true;
                return false;
            });

            if (hasInvalidCategory) {
                console.error('❌ Invalid categories for age level');
                showNotification('Ungültige Kategorien für dein Alter!', 'error');
                setTimeout(() => window.location.href = 'index.html', 2000);
                return false;
            }
        }

        if (isDevelopment) {
            console.log('✅ Game state valid');
        }
        return true;
    }

    // ===========================
    // EVENT LISTENERS
    // ===========================

    function setupEventListeners() {
        // Answer buttons
        const yesBtn = document.getElementById('yes-btn');
        const noBtn = document.getElementById('no-btn');

        if (yesBtn) yesBtn.addEventListener('click', () => selectAnswer(true));
        if (noBtn) noBtn.addEventListener('click', () => selectAnswer(false));

        // Submit button
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', submitAnswers);
        }

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

        if (isDevelopment) {
            console.log('✅ Event listeners setup');
        }
    }

    // ===========================
    // FIREBASE LISTENERS - REAL-TIME SYNC
    // ===========================

    async function setupFirebaseListeners() {
        if (!firebaseService || !gameState.gameId) {
            console.warn('⚠️ Cannot setup listeners');
            return;
        }

        if (isDevelopment) {
            console.log('🎧 Setting up Firebase listeners...');
        }

        try {
            const gameRef = firebase.database().ref(`games/${gameState.gameId}`);

            gameListener = gameRef.on('value', (snapshot) => {
                if (snapshot.exists()) {
                    currentGameData = snapshot.val();
                    if (isDevelopment) {
                        console.log('🎮 Game update received');
                    }

                    // Update players
                    currentPlayers = currentGameData.players || {};
                    updatePlayersCount();

                    // Check for overall results
                    if (currentGameData.showOverallResults && currentPhase !== 'overall-results') {
                        if (isDevelopment) {
                            console.log('📊 Overall results triggered');
                        }
                        if (currentGameData.overallStats) {
                            overallStats = currentGameData.overallStats;
                        }
                        displayOverallResults();
                    }

                    // Check if results closed
                    if (currentGameData.showOverallResults === false && currentPhase === 'overall-results') {
                        if (isDevelopment) {
                            console.log('▶️ Game continues');
                        }
                        handleNewRound(currentGameData.currentRound);
                    }

                    // Check for game end
                    if (currentGameData.gameState === 'finished') {
                        if (isDevelopment) {
                            console.log('🛑 Game finished');
                        }
                        showNotification('Spiel beendet! 👋', 'info', 3000);
                        setTimeout(() => {
                            cleanup();
                            window.location.href = 'index.html';
                        }, 3000);
                    }

                    // Check for round changes
                    if (currentGameData.currentRound &&
                        currentGameData.currentRound !== currentQuestionNumber &&
                        currentPhase !== 'overall-results') {
                        handleNewRound(currentGameData.currentRound);
                    }
                }
            });

            // Load initial game data
            const initialData = await gameRef.once('value');
            if (initialData.exists()) {
                currentGameData = initialData.val();
                currentPlayers = currentGameData.players || {};
                updatePlayersCount();

                if (currentGameData.currentRound) {
                    currentQuestionNumber = currentGameData.currentRound;
                    updateGameDisplay();
                    await loadRoundFromFirebase(currentQuestionNumber);
                } else if (gameState.isHost) {
                    await startNewRound();
                }
            } else if (gameState.isHost) {
                await startNewRound();
            }

            if (isDevelopment) {
                console.log('✅ Firebase listeners setup');
            }
        } catch (error) {
            console.error('❌ Error setting up listeners:', error);
        }
    }

    async function loadRoundFromFirebase(roundNumber) {
        try {
            if (isDevelopment) {
                console.log(`📥 Loading round ${roundNumber}...`);
            }

            const roundRef = firebase.database().ref(`games/${gameState.gameId}/rounds/round_${roundNumber}`);
            const snapshot = await roundRef.once('value');

            if (snapshot.exists()) {
                const roundData = snapshot.val();
                currentQuestion = roundData.question;

                if (currentQuestion) {
                    displayQuestion(currentQuestion);
                    setupRoundListener(roundNumber);
                    if (isDevelopment) {
                        console.log('✅ Round loaded');
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error loading round:', error);
        }
    }

    function setupRoundListener(roundNumber) {
        // Remove old listener
        if (roundListener) {
            try {
                firebase.database().ref(`games/${gameState.gameId}/rounds/round_${roundNumber - 1}`).off();
            } catch (e) {}
        }

        if (isDevelopment) {
            console.log(`🎧 Setting up round listener for round ${roundNumber}`);
        }

        const roundRef = firebase.database().ref(`games/${gameState.gameId}/rounds/round_${roundNumber}`);

        roundListener = roundRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                currentRoundData = snapshot.val();

                const answers = currentRoundData.answers || {};
                const answerCount = Object.keys(answers).length;
                const playerCount = Object.keys(currentPlayers).length;

                if (isDevelopment) {
                    console.log(`📊 Round update: ${answerCount}/${playerCount} answers`);
                }

                // Update waiting status
                if (currentPhase === 'waiting') {
                    updateWaitingStatus(answers);

                    // Check if all answered
                    if (answerCount >= playerCount && playerCount >= 2) {
                        if (isDevelopment) {
                            console.log('🎉 All players answered!');
                        }
                        setTimeout(() => {
                            if (currentPhase === 'waiting') {
                                calculateAndShowResults();
                            }
                        }, 300);
                    }
                }
            }
        });

        if (isDevelopment) {
            console.log('✅ Round listener active');
        }
    }

    function handleNewRound(roundNumber) {
        if (roundNumber > currentQuestionNumber) {
            currentQuestionNumber = roundNumber;
            hasSubmittedThisRound = false; // Reset anti-cheat
            updateGameDisplay();
            loadRoundFromFirebase(roundNumber);
            resetForNewQuestion();
            showPhase('question');
            showNotification('Neue Frage! 🎮', 'success', 2000);
        }
    }

    // ===========================
    // GAME FLOW
    // ===========================

    async function startNewRound() {
        if (!gameState.isHost) return;

        if (isDevelopment) {
            console.log(`🎲 Starting round ${currentQuestionNumber}`);
        }

        // Generate question
        currentQuestion = generateRandomQuestion();

        // Display question
        displayQuestion(currentQuestion);

        // Start round in Firebase
        try {
            const roundRef = firebase.database().ref(`games/${gameState.gameId}/rounds/round_${currentQuestionNumber}`);
            await roundRef.set({
                question: currentQuestion,
                answers: {},
                startedAt: firebase.database.ServerValue.TIMESTAMP
            });

            const gameRef = firebase.database().ref(`games/${gameState.gameId}`);
            await gameRef.update({
                currentRound: currentQuestionNumber,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });

            setupRoundListener(currentQuestionNumber);
            if (isDevelopment) {
                console.log('✅ New round started');
            }
        } catch (error) {
            console.error('❌ Error starting round:', error);
        }
    }

    function generateRandomQuestion() {
        const availableQuestions = [];

        if (!gameState.selectedCategories || gameState.selectedCategories.length === 0) {
            // Fallback to all categories
            Object.keys(questionsDatabase).forEach(category => {
                questionsDatabase[category].forEach(q => {
                    availableQuestions.push({
                        text: sanitizeText(q),
                        category: category
                    });
                });
            });
        } else {
            gameState.selectedCategories.forEach(category => {
                if (questionsDatabase[category]) {
                    questionsDatabase[category].forEach(q => {
                        availableQuestions.push({
                            text: sanitizeText(q),
                            category: category
                        });
                    });
                }
            });
        }

        if (availableQuestions.length === 0) {
            return {
                text: "Ich habe schon mal... etwas Interessantes erlebt",
                category: "fsk0"
            };
        }

        return availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    }

    /**
     * P0 FIX: Display question with textContent only
     */
    function displayQuestion(question) {
        if (!question) return;

        const questionTextEl = document.getElementById('question-text');
        const categoryEl = document.getElementById('question-category');

        if (questionTextEl) {
            questionTextEl.textContent = sanitizeText(question.text);
        }

        if (categoryEl) {
            categoryEl.textContent = categoryNames[question.category] || '🎮 Spiel';
        }

        if (isDevelopment) {
            console.log('📝 Question displayed');
        }
    }

    function resetForNewQuestion() {
        userAnswer = null;
        userEstimation = null;
        hasSubmittedThisRound = false;

        document.querySelectorAll('.answer-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.setAttribute('aria-checked', 'false');
        });

        const personalBox = document.getElementById('personal-result');
        if (personalBox) {
            personalBox.style.display = 'none';
        }

        const selectionDisplay = document.getElementById('current-selection');
        if (selectionDisplay) {
            selectionDisplay.classList.remove('show');
        }

        const selectedNumber = document.getElementById('selected-number');
        if (selectedNumber) {
            selectedNumber.textContent = '-';
        }

        updateNumberSelection();
        updateSubmitButton();
    }

    // ===========================
    // UI FUNCTIONS
    // ===========================

    function updateGameDisplay() {
        const roundEl = document.getElementById('current-round');
        if (roundEl) {
            roundEl.textContent = currentQuestionNumber;
        }
    }

    function updatePlayersCount() {
        totalPlayers = Object.keys(currentPlayers).length;

        const playersCountEl = document.getElementById('players-count');
        if (playersCountEl) {
            playersCountEl.textContent = `${totalPlayers} Spieler`;
        }

        const totalPlayersEl = document.getElementById('total-players');
        if (totalPlayersEl) {
            totalPlayersEl.textContent = totalPlayers;
        }

        createNumberGrid();
    }

    function createNumberGrid() {
        const numberGrid = document.getElementById('number-grid');
        if (!numberGrid) return;

        numberGrid.innerHTML = '';

        const maxPlayers = totalPlayers || 8;
        for (let i = 0; i <= maxPlayers; i++) {
            const numberBtn = document.createElement('button');
            numberBtn.className = 'number-btn';
            numberBtn.type = 'button';
            numberBtn.textContent = i;
            numberBtn.id = `number-btn-${i}`;
            numberBtn.setAttribute('role', 'radio');
            numberBtn.setAttribute('aria-checked', 'false');
            numberBtn.setAttribute('aria-label', `${i} Spieler schätzen`);
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

            const selectionDisplay = document.getElementById('current-selection');
            if (selectionDisplay) {
                selectionDisplay.classList.add('show');
            }

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
    }

    function updateNumberSelection() {
        document.querySelectorAll('.number-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.setAttribute('aria-checked', 'false');
        });

        if (userEstimation !== null) {
            const selectedBtn = document.getElementById(`number-btn-${userEstimation}`);
            if (selectedBtn) {
                selectedBtn.classList.add('selected');
                selectedBtn.setAttribute('aria-checked', 'true');
            }
        }
    }

    function selectAnswer(answer) {
        userAnswer = answer;

        document.querySelectorAll('.answer-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.setAttribute('aria-checked', 'false');
        });

        const selectedBtn = answer ?
            document.getElementById('yes-btn') :
            document.getElementById('no-btn');

        if (selectedBtn) {
            selectedBtn.classList.add('selected');
            selectedBtn.setAttribute('aria-checked', 'true');
        }

        updateSubmitButton();
    }

    function updateSubmitButton() {
        const submitBtn = document.getElementById('submit-btn');
        if (!submitBtn) return;

        // P0: Disable if already submitted
        if (hasSubmittedThisRound) {
            submitBtn.classList.remove('enabled');
            submitBtn.disabled = true;
            submitBtn.setAttribute('aria-disabled', 'true');
            submitBtn.textContent = '✅ Bereits abgesendet';
            return;
        }

        if (userAnswer !== null && userEstimation !== null) {
            submitBtn.classList.add('enabled');
            submitBtn.disabled = false;
            submitBtn.setAttribute('aria-disabled', 'false');
            submitBtn.textContent = '📤 Antworten absenden';
        } else {
            submitBtn.classList.remove('enabled');
            submitBtn.disabled = true;
            submitBtn.setAttribute('aria-disabled', 'true');
            submitBtn.textContent = '📤 Antworten absenden';
        }
    }

    function updateUIForRole() {
        const hostElements = document.querySelectorAll('.host-only');
        hostElements.forEach(el => {
            if (gameState.isHost) {
                el.classList.add('show');
            } else {
                el.classList.remove('show');
            }
        });

        const guestElements = document.querySelectorAll('.guest-only');
        guestElements.forEach(el => {
            if (!gameState.isHost) {
                el.classList.add('show');
            } else {
                el.classList.remove('show');
            }
        });
    }
    // ===========================
    // P0 FIX: GAME ACTIONS WITH ANTI-CHEAT
    // ===========================

    /**
     * P0 FIX: Submit with anti-cheat check
     */
    async function submitAnswers() {
        // P0: Anti-cheat - prevent double submission
        if (hasSubmittedThisRound) {
            showNotification('Du hast bereits abgesendet!', 'warning');
            return;
        }

        if (userAnswer === null || userEstimation === null) {
            showNotification('Bitte wähle Antwort UND Schätzung!', 'warning');
            return;
        }

        if (isDevelopment) {
            console.log('📤 Submitting answers:', { answer: userAnswer, estimation: userEstimation });
        }

        // P0: Validate estimation range
        if (userEstimation < 0 || userEstimation > totalPlayers) {
            showNotification('Ungültige Schätzung!', 'error');
            return;
        }

        const answerData = {
            playerId: gameState.playerId || firebase.auth().currentUser?.uid,
            playerName: sanitizePlayerName(gameState.playerName),
            answer: userAnswer,
            estimation: userEstimation,
            isHost: gameState.isHost,
            timestamp: Date.now()
        };

        try {
            const answerRef = firebase.database().ref(
                `games/${gameState.gameId}/rounds/round_${currentQuestionNumber}/answers/${answerData.playerId}`
            );

            await answerRef.set({
                ...answerData,
                submittedAt: firebase.database.ServerValue.TIMESTAMP
            });

            // P0: Mark as submitted
            hasSubmittedThisRound = true;

            if (isDevelopment) {
                console.log('✅ Answer submitted');
            }
            showNotification('Antworten gesendet! 🎯', 'success', 2000);
            showPhase('waiting');
            updateSubmitButton();

            setTimeout(() => {
                checkIfAllAnswered();
            }, 1000);

        } catch (error) {
            console.error('❌ Error submitting:', error);
            showNotification('Fehler beim Senden', 'error');
            hasSubmittedThisRound = false; // Allow retry on error
        }
    }

    async function checkIfAllAnswered() {
        try {
            const roundRef = firebase.database().ref(
                `games/${gameState.gameId}/rounds/round_${currentQuestionNumber}`
            );
            const snapshot = await roundRef.once('value');

            if (snapshot.exists()) {
                const roundData = snapshot.val();
                const answers = roundData.answers || {};
                const answerCount = Object.keys(answers).length;
                const playerCount = Object.keys(currentPlayers).length;

                if (isDevelopment) {
                    console.log(`🔍 Check: ${answerCount}/${playerCount} answers`);
                }

                if (answerCount >= playerCount && playerCount >= 2 && currentPhase === 'waiting') {
                    if (isDevelopment) {
                        console.log('✅ All answered!');
                    }
                    currentRoundData = roundData;
                    calculateAndShowResults();
                }
            }
        } catch (error) {
            console.error('❌ Error checking:', error);
        }
    }

    // ===========================
    // PHASE MANAGEMENT
    // ===========================

    function showPhase(phase) {
        document.querySelectorAll('.game-phase').forEach(p => {
            p.classList.remove('active');
        });

        const phaseEl = document.getElementById(`${phase}-phase`);
        if (phaseEl) {
            phaseEl.classList.add('active');
        }

        currentPhase = phase;
        if (isDevelopment) {
            console.log(`📍 Phase: ${phase}`);
        }
    }

    // ===========================
    // P0 FIX: WAITING PHASE WITH SAFE DOM
    // ===========================

    /**
     * P0 FIX: Update waiting status with textContent
     */
    function updateWaitingStatus(answers = {}) {
        const statusContainer = document.getElementById('players-status');
        if (!statusContainer) return;

        statusContainer.innerHTML = '';

        Object.entries(currentPlayers).forEach(([playerId, player]) => {
            const hasAnswered = answers[playerId] !== undefined;

            const statusItem = document.createElement('div');
            statusItem.className = 'player-status-item';
            statusItem.setAttribute('role', 'listitem');

            const nameSpan = document.createElement('span');
            nameSpan.textContent = sanitizePlayerName(player.name || 'Spieler');

            const statusSpan = document.createElement('span');
            statusSpan.className = `status-indicator ${hasAnswered ? 'status-done' : 'status-waiting'}`;
            statusSpan.textContent = hasAnswered ? '✅ Fertig' : '⏳ Wartet...';

            statusItem.appendChild(nameSpan);
            statusItem.appendChild(statusSpan);
            statusContainer.appendChild(statusItem);
        });
    }

    // ===========================
    // RESULTS CALCULATION
    // ===========================

    function calculateAndShowResults() {
        if (!currentRoundData || !currentRoundData.answers) {
            console.error('❌ No round data');
            return;
        }

        const answers = currentRoundData.answers;
        const actualYesCount = Object.values(answers).filter(a => a.answer === true).length;

        if (isDevelopment) {
            console.log(`✅ Results: ${actualYesCount} said yes`);
        }

        // Calculate results
        const results = Object.values(answers).map(playerAnswer => {
            const difference = Math.abs(playerAnswer.estimation - actualYesCount);
            const isCorrect = difference === 0;

            let sips = 0;
            if (!isCorrect) {
                const multiplier = difficultyMultipliers[gameState.difficulty] || 1;
                sips = difference * multiplier;
            }

            return {
                playerId: playerAnswer.playerId,
                playerName: sanitizePlayerName(playerAnswer.playerName),
                answer: playerAnswer.answer,
                estimation: playerAnswer.estimation,
                difference: difference,
                isCorrect: isCorrect,
                sips: sips
            };
        });

        // Sort by sips (descending)
        results.sort((a, b) => b.sips - a.sips);

        // Update overall stats
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

        if (isDevelopment) {
            console.log('📊 Results displayed');
        }
    }

    /**
     * P0 FIX: Display results with textContent only
     */
    function displayRoundResults(results, actualYesCount) {
        // Show question
        if (currentQuestion && currentQuestion.text) {
            const resultsQuestionEl = document.getElementById('results-question-text');
            if (resultsQuestionEl) {
                resultsQuestionEl.textContent = sanitizeText(currentQuestion.text);
            }
        }

        const resultsSummaryEl = document.getElementById('results-summary');
        if (resultsSummaryEl) {
            resultsSummaryEl.textContent =
                `✅ ${actualYesCount} von ${totalPlayers || results.length} Spielern haben mit "Ja" geantwortet`;
        }

        // Find current player's result
        const currentPlayerId = gameState.playerId || firebase.auth().currentUser?.uid;
        const myResult = results.find(r => r.playerId === currentPlayerId);

        if (myResult) {
            const personalBox = document.getElementById('personal-result');
            if (personalBox) {
                personalBox.style.display = 'block';
            }

            const estEl = document.getElementById('personal-estimation');
            if (estEl) {
                estEl.textContent = myResult.estimation;
            }

            const statusText = myResult.isCorrect ?
                '✅ Richtig geschätzt!' :
                `❌ Falsch (Diff: ${myResult.difference})`;

            const statusEl = document.getElementById('personal-status');
            if (statusEl) {
                statusEl.textContent = statusText;
                statusEl.style.color = myResult.isCorrect ? '#4CAF50' : '#f44336';
            }

            const sipsText = myResult.sips === 0 ?
                '🎯 Keine! Perfekt!' :
                `${myResult.sips} 🍺`;

            const sipsEl = document.getElementById('personal-sips');
            if (sipsEl) {
                sipsEl.textContent = sipsText;
            }
        }

        // Display results grid
        const resultsGrid = document.getElementById('results-grid');
        if (!resultsGrid) return;

        resultsGrid.innerHTML = '';

        results.forEach((result) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            resultItem.setAttribute('role', 'listitem');

            const isMe = result.playerId === currentPlayerId;
            if (isMe) resultItem.classList.add('is-me');
            else if (result.isCorrect) resultItem.classList.add('correct-not-me');
            else resultItem.classList.add('wrong');

            const avatar = result.playerName.substring(0, 2).toUpperCase();
            const sipsText = result.sips === 0 ? 'Perfekt! 🎯' : `${result.sips} 🍺`;

            // P0 FIX: Build with textContent
            const playerResult = document.createElement('div');
            playerResult.className = 'player-result';

            const playerAvatar = document.createElement('div');
            playerAvatar.className = 'player-avatar';
            playerAvatar.textContent = avatar;
            playerAvatar.setAttribute('aria-hidden', 'true');

            const playerInfo = document.createElement('div');
            playerInfo.className = 'player-info';

            const playerName = document.createElement('div');
            playerName.className = 'player-name';
            playerName.textContent = result.playerName;

            const playerAnswer = document.createElement('div');
            playerAnswer.className = 'player-answer';
            playerAnswer.textContent = `Tipp: ${result.estimation}`;

            playerInfo.appendChild(playerName);
            playerInfo.appendChild(playerAnswer);

            playerResult.appendChild(playerAvatar);
            playerResult.appendChild(playerInfo);

            const sipsPenalty = document.createElement('div');
            sipsPenalty.className = `sips-penalty ${result.sips === 0 ? 'none' : ''}`;
            sipsPenalty.textContent = sipsText;

            resultItem.appendChild(playerResult);
            resultItem.appendChild(sipsPenalty);

            resultsGrid.appendChild(resultItem);
        });
    }

    // ===========================
    // GAME CONTROLS
    // ===========================

    async function nextQuestion() {
        if (!gameState.isHost) {
            showNotification('Nur der Host kann weitermachen!', 'warning');
            return;
        }

        currentQuestionNumber++;
        hasSubmittedThisRound = false; // Reset anti-cheat
        updateGameDisplay();
        resetForNewQuestion();
        showPhase('question');

        await startNewRound();
        showNotification('Neue Frage! 🎮', 'success', 2000);
    }

    async function showOverallResults() {
        if (!gameState.isHost) {
            showNotification('Nur der Host kann die Gesamtergebnisse zeigen!', 'warning');
            return;
        }

        if (isDevelopment) {
            console.log('📊 Showing overall results...');
        }

        try {
            const gameRef = firebase.database().ref(`games/${gameState.gameId}`);
            await gameRef.update({
                showOverallResults: true,
                overallStats: overallStats,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });

            if (isDevelopment) {
                console.log('✅ Overall results notification sent');
            }
        } catch (error) {
            console.error('❌ Error:', error);
        }

        displayOverallResults();
    }

    /**
     * P0 FIX: Display overall results with textContent
     */
    function displayOverallResults() {
        if (isDevelopment) {
            console.log('🏆 Displaying overall results');
        }

        const totalRoundsEl = document.getElementById('total-rounds');
        if (totalRoundsEl) {
            totalRoundsEl.textContent = overallStats.totalRounds;
        }

        const totalPlayersEl = document.getElementById('total-players-overall');
        if (totalPlayersEl) {
            totalPlayersEl.textContent = Object.keys(overallStats.playerStats).length;
        }

        const leaderboardList = document.getElementById('overall-leaderboard-list');
        if (!leaderboardList) return;

        leaderboardList.innerHTML = '';

        // Sort by total sips (ascending)
        const leaderboard = Object.values(overallStats.playerStats).sort((a, b) => a.totalSips - b.totalSips);

        leaderboard.forEach((player, index) => {
            const leaderboardItem = document.createElement('div');
            leaderboardItem.className = `leaderboard-item ${index === 0 ? 'winner' : ''}`;
            leaderboardItem.setAttribute('role', 'listitem');

            const rankClass = index === 0 ? 'rank-1' :
                index === 1 ? 'rank-2' :
                    index === 2 ? 'rank-3' : 'rank-other';

            // P0 FIX: Build with textContent
            const rankBadge = document.createElement('div');
            rankBadge.className = `rank-badge ${rankClass}`;
            rankBadge.textContent = index + 1;
            rankBadge.setAttribute('aria-label', `Platz ${index + 1}`);

            const playerInfoDiv = document.createElement('div');
            playerInfoDiv.className = 'leaderboard-player-info';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'leaderboard-player-name';
            nameDiv.textContent = sanitizePlayerName(player.name);

            const statsDiv = document.createElement('div');
            statsDiv.className = 'leaderboard-player-stats';

            const sipsSpan = document.createElement('span');
            sipsSpan.textContent = `🍺 ${player.totalSips} Schlücke`;

            const correctSpan = document.createElement('span');
            correctSpan.textContent = `🎯 ${player.correctGuesses}/${player.totalGuesses} richtig`;

            statsDiv.appendChild(sipsSpan);
            statsDiv.appendChild(correctSpan);

            playerInfoDiv.appendChild(nameDiv);
            playerInfoDiv.appendChild(statsDiv);

            leaderboardItem.appendChild(rankBadge);
            leaderboardItem.appendChild(playerInfoDiv);

            leaderboardList.appendChild(leaderboardItem);
        });

        showPhase('overall-results');
    }

    async function continueGame() {
        if (!gameState.isHost) {
            showNotification('Nur der Host kann fortfahren!', 'warning');
            return;
        }

        if (isDevelopment) {
            console.log('▶️ Continuing game...');
        }

        try {
            const gameRef = firebase.database().ref(`games/${gameState.gameId}`);
            await gameRef.update({
                showOverallResults: false,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('❌ Error:', error);
        }

        currentQuestionNumber++;
        hasSubmittedThisRound = false;
        updateGameDisplay();
        resetForNewQuestion();
        showPhase('question');

        await startNewRound();
        showNotification('Spiel wird fortgesetzt! 🎮', 'success', 2000);
    }

    async function endGameForAll() {
        if (!gameState.isHost) {
            showNotification('Nur der Host kann beenden!', 'warning');
            return;
        }

        if (!confirm('Spiel wirklich für ALLE beenden?')) {
            return;
        }

        if (isDevelopment) {
            console.log('🛑 Ending game...');
        }

        try {
            const gameRef = firebase.database().ref(`games/${gameState.gameId}`);
            await gameRef.update({
                gameState: 'finished',
                endedAt: firebase.database.ServerValue.TIMESTAMP,
                finalStats: overallStats
            });

            showNotification('Spiel beendet! 👋', 'success', 2000);

            setTimeout(() => {
                cleanup();
                window.location.href = 'index.html';
            }, 2000);

        } catch (error) {
            console.error('❌ Error ending game:', error);
            showNotification('Fehler beim Beenden', 'error');
        }
    }

    // ===========================
    // UTILITIES
    // ===========================

    function showLoading() {
        const loading = document.getElementById('loading-screen');
        if (loading) {
            loading.classList.add('show');
        }
    }

    function hideLoading() {
        const loading = document.getElementById('loading-screen');
        if (loading) {
            loading.classList.remove('show');
        }
    }

    /**
     * P0 FIX: Safe notification using NocapUtils
     */
    function showNotification(message, type = 'info', duration = 3000) {
        if (window.NocapUtils && window.NocapUtils.showNotification) {
            window.NocapUtils.showNotification(message, type, duration);
            return;
        }

        // Fallback implementation
        document.querySelectorAll('.toast-notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `toast-notification ${type}`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'polite');

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
        toastIcon.textContent = iconMap[type] || '✅';
        toastIcon.setAttribute('aria-hidden', 'true');

        const toastMessage = document.createElement('div');
        toastMessage.className = 'toast-message';
        toastMessage.textContent = sanitizeText(message);

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

    // ===========================
    // CLEANUP
    // ===========================

    function cleanup() {
        if (gameListener) {
            try {
                firebase.database().ref(`games/${gameState.gameId}`).off();
            } catch (e) {}
        }
        if (roundListener) {
            try {
                firebase.database().ref(`games/${gameState.gameId}/rounds/round_${currentQuestionNumber}`).off();
            } catch (e) {}
        }

        if (window.NocapUtils && window.NocapUtils.cleanupEventListeners) {
            window.NocapUtils.cleanupEventListeners();
        }

        if (isDevelopment) {
            console.log('✅ Multiplayer gameplay cleanup completed');
        }
    }

    window.addEventListener('beforeunload', cleanup);

    // ===========================
    // INITIALIZATION
    // ===========================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})(window);
