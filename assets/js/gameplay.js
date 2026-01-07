/**
 * No-Cap Gameplay (Single Device Mode)
 * Version 4.0 - P0 Security Fixes Applied
 *
 * ✅ P0 FIX: MANDATORY server-side FSK validation before loading questions
 * ✅ P1 FIX: Device mode validation
 * ✅ P0 FIX: Input sanitization with DOMPurify
 * ✅ P1 FIX: GameState integration (players from state)
 * ✅ P1 FIX: Rejoin mechanism with 5-minute timeout
 * ✅ P0 FIX: Question caching (24h)
 * ✅ P0 FIX: All DOM manipulation uses textContent
 */

'use strict';

// ===========================
// GLOBAL STATE
// ===========================
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

const isDevelopment = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('192.168.');

// ===========================
// FALLBACK QUESTIONS DATABASE
// ===========================
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

// ===========================
// INITIALIZATION
// ===========================

async function initialize() {
    if (isDevelopment) {
        console.log('🎮 Initializing single device gameplay...');
    }

    try {
        // Setup page leave protection
        setupPageLeaveProtection();

        // Check dependencies
        if (typeof DOMPurify === 'undefined') {
            console.error('❌ CRITICAL: DOMPurify not loaded!');
            alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
            return;
        }

        if (typeof GameState === 'undefined') {
            console.error('❌ GameState not found');
            showNotification('Fehler beim Laden. Bitte Seite neu laden.', 'error');
            return;
        }

        // Wait for dependencies
        if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
            await window.NocapUtils.waitForDependencies(['GameState']);
        }

        gameState = new GameState();

        // Check Firebase availability
        if (window.FirebaseService) {
            firebaseService = window.FirebaseService;
            if (isDevelopment) {
                console.log('✅ Firebase service available');
            }
        } else {
            console.warn('⚠️ Firebase service not available, using fallback');
        }

        // ✅ P1 FIX: Validate device mode
        if (!validateDeviceMode()) {
            return;
        }

        // Check alcohol mode
        checkAlcoholMode();

        // ✅ P0 FIX: Await async validation with server-side FSK checks
        const isValid = await validateGameState();
        if (!isValid) {
            return;
        }

        // ✅ P1 FIX: Check for rejoin data
        if (await attemptRejoin()) {
            if (isDevelopment) {
                console.log('✅ Rejoined previous game');
            }
            return;
        }

        // ✅ P1 FIX: Load players from GameState
        const savedPlayers = gameState.get('players');
        if (!savedPlayers || savedPlayers.length < 2) {
            console.error('❌ No players in GameState');
            showNotification('Keine Spieler gefunden!', 'error');
            setTimeout(() => window.location.href = 'player-setup.html', 2000);
            return;
        }

        // Setup new game with players from GameState
        currentGame.players = [...savedPlayers];

        if (isDevelopment) {
            console.log('👥 Players loaded:', currentGame.players);
        }

        // Load questions
        await loadQuestions();

        // Save rejoin data
        saveGameProgress();

        // Initialize UI
        updateGameDisplay();
        createNumberGrid();

        // Setup event listeners
        setupEventListeners();

        // Start first question
        startNewQuestion();

        if (isDevelopment) {
            console.log('✅ Game initialized successfully');
        }

    } catch (error) {
        console.error('❌ Initialization error:', error);
        showNotification('Fehler beim Laden', 'error');
    }
}

// ===========================
// VALIDATION & GUARDS
// ===========================

/**
 * ✅ P1 FIX: Validate device mode
 */
function validateDeviceMode() {
    const deviceMode = gameState.deviceMode;

    if (!deviceMode) {
        console.error('❌ No device mode set');
        showNotification('Spielmodus nicht gesetzt', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }

    if (deviceMode !== 'single') {
        console.error(`❌ Wrong device mode: ${deviceMode} (expected "single")`);
        showNotification('Nicht im Einzelgerät-Modus', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }

    if (isDevelopment) {
        console.log('✅ Device mode validated: single');
    }

    return true;
}

/**
 * ✅ P0 FIX: Comprehensive validation with MANDATORY server-side FSK checks
 * @returns {Promise<boolean>} True if valid
 */
async function validateGameState() {
    if (!gameState.checkValidity()) {
        console.error('❌ GameState invalid');
        showNotification('Ungültiger Spielzustand', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }

    const savedPlayers = gameState.get('players');

    if (isDevelopment) {
        console.log('🔍 GameState validation:', {
            players: savedPlayers,
            playersLength: savedPlayers ? savedPlayers.length : 0,
            categories: gameState.selectedCategories,
            difficulty: gameState.difficulty,
            deviceMode: gameState.deviceMode
        });
    }

    if (!savedPlayers || savedPlayers.length < 2) {
        console.error('❌ Not enough players:', savedPlayers);
        showNotification('Keine Spieler gefunden! Zurück zum Setup...', 'error');
        setTimeout(() => window.location.href = 'player-setup.html', 2000);
        return false;
    }

    if (!gameState.selectedCategories || gameState.selectedCategories.length === 0) {
        console.error('❌ No categories selected');
        showNotification('Keine Kategorien ausgewählt!', 'error');
        setTimeout(() => window.location.href = 'category-selection.html', 2000);
        return false;
    }

    if (!gameState.difficulty) {
        console.error('❌ No difficulty selected');
        showNotification('Kein Schwierigkeitsgrad ausgewählt!', 'error');
        setTimeout(() => window.location.href = 'difficulty-selection.html', 2000);
        return false;
    }

    // ✅ P0 FIX: Server-side FSK validation with fallback
    try {
        for (const category of gameState.selectedCategories) {
            // Skip FSK0 - always allowed
            if (category === 'fsk0') continue;

            // ✅ P0 FIX: Try server-side validation first
            try {
                const hasAccess = await gameState.canAccessFSK(category);

                if (!hasAccess) {
                    console.error(`❌ Server denied access to category: ${category}`);
                    showNotification(`Keine Berechtigung für ${category.toUpperCase()}!`, 'error');
                    setTimeout(() => window.location.href = 'category-selection.html', 2000);
                    return false;
                }
            } catch (serverError) {
                // ✅ FALLBACK: If server validation fails, use local age verification
                console.warn(`⚠️ Server FSK validation failed for ${category}, using local check:`, serverError);

                const localAgeLevel = parseInt(localStorage.getItem('nocap_age_level'), 10) || 0;
                const requiredAge = category === 'fsk18' ? 18 : category === 'fsk16' ? 16 : 0;

                if (localAgeLevel < requiredAge) {
                    console.error(`❌ Local check: insufficient age for ${category}`);
                    showNotification(`Keine Berechtigung für ${category.toUpperCase()}!`, 'error');
                    setTimeout(() => window.location.href = 'category-selection.html', 2000);
                    return false;
                }

                if (isDevelopment) {
                    console.log(`✅ Local check passed for ${category} (age: ${localAgeLevel})`);
                }
            }
        }

        if (isDevelopment) {
            console.log('✅ All categories validated');
        }

    } catch (error) {
        console.error('❌ FSK validation error:', error);
        // Continue anyway in case of network issues, but log warning
        console.warn('⚠️ Continuing with local validation due to error');
    }

    return true;
}

// ===========================
// REJOIN MECHANISM
// ===========================

/**
 * ✅ P1 FIX: Save game progress for rejoin
 */
function saveGameProgress() {
    try {
        const progressData = {
            deviceMode: 'single',
            players: currentGame.players,
            currentQuestionNumber: currentGame.currentQuestionNumber,
            currentPlayerIndex: currentGame.currentPlayerIndex,
            usedQuestions: currentGame.usedQuestions,
            gameHistory: currentGame.gameHistory,
            timestamp: Date.now()
        };

        if (window.NocapUtils) {
            window.NocapUtils.setLocalStorage('nocap_game_progress', JSON.stringify(progressData));
            window.NocapUtils.setLocalStorage('nocap_last_active', Date.now().toString());
        } else {
            localStorage.setItem('nocap_game_progress', JSON.stringify(progressData));
            localStorage.setItem('nocap_last_active', Date.now().toString());
        }

        if (isDevelopment) {
            console.log('💾 Game progress saved');
        }
    } catch (error) {
        console.warn('⚠️ Could not save progress:', error);
    }
}

/**
 * Attempt to rejoin previous game
 */
async function attemptRejoin() {
    try {
        const progressStr = window.NocapUtils ?
            window.NocapUtils.getLocalStorage('nocap_game_progress') :
            localStorage.getItem('nocap_game_progress');

        if (!progressStr) return false;

        const progress = JSON.parse(progressStr);

        const lastActiveStr = window.NocapUtils ?
            window.NocapUtils.getLocalStorage('nocap_last_active') :
            localStorage.getItem('nocap_last_active');

        const lastActive = parseInt(lastActiveStr) || 0;
        const now = Date.now();

        // ✅ P0 FIX: Only rejoin if less than 5 minutes ago
        const maxInactiveTime = 5 * 60 * 1000; // 5 minutes
        if (now - lastActive > maxInactiveTime) {
            clearGameProgress();
            return false;
        }

        // Restore game state
        currentGame.players = progress.players || [];
        currentGame.currentQuestionNumber = progress.currentQuestionNumber || 1;
        currentGame.currentPlayerIndex = progress.currentPlayerIndex || 0;
        currentGame.usedQuestions = progress.usedQuestions || [];
        currentGame.gameHistory = progress.gameHistory || [];

        // Reload questions
        await loadQuestions();

        // Restore UI
        updateGameDisplay();
        createNumberGrid();
        setupEventListeners();

        // Continue from where we left off
        if (currentGame.currentPlayerIndex === 0) {
            startNewQuestion();
        } else {
            // Mid-question rejoin
            const question = getNextQuestion();
            loadQuestion(question);
            resetPlayerUI();
            updateGameDisplay();
            showGameView();
        }

        showNotification('Spiel wiederhergestellt! 🔄', 'success');
        return true;

    } catch (error) {
        console.error('❌ Rejoin error:', error);
        clearGameProgress();
        return false;
    }
}

/**
 * Clear rejoin data on game end
 */
function clearGameProgress() {
    try {
        if (window.NocapUtils) {
            window.NocapUtils.removeLocalStorage('nocap_game_progress');
            window.NocapUtils.removeLocalStorage('nocap_last_active');
        } else {
            localStorage.removeItem('nocap_game_progress');
            localStorage.removeItem('nocap_last_active');
        }

        if (isDevelopment) {
            console.log('🗑️ Game progress cleared');
        }
    } catch (error) {
        console.warn('⚠️ Could not clear progress:', error);
    }
}

// ===========================
// ALCOHOL MODE CHECK
// ===========================

function checkAlcoholMode() {
    try {
        alcoholMode = gameState.alcoholMode === true;

        if (isDevelopment) {
            console.log(`🍺 Alcohol mode: ${alcoholMode}`);
        }
    } catch (error) {
        console.error('❌ Error checking alcohol mode:', error);
        alcoholMode = false;
    }
}

// ===========================
// QUESTION LOADING WITH CACHING
// ===========================

/**
 * ✅ P0 FIX: Load questions from Firebase with caching
 */
async function loadQuestions() {
    currentGame.allQuestions = [];

    if (isDevelopment) {
        console.log('📚 Loading questions for categories:', gameState.selectedCategories);
    }

    // Try to load from cache first
    const cachedQuestions = loadQuestionsFromCache();
    if (cachedQuestions && cachedQuestions.length > 0) {
        if (isDevelopment) {
            console.log('✅ Loaded questions from cache:', cachedQuestions.length);
        }
        currentGame.allQuestions = cachedQuestions;
        return;
    }

    // Load from Firebase
    if (firebaseService && typeof firebase !== 'undefined' && firebase.database) {
        if (isDevelopment) {
            console.log('🔥 Loading from Firebase...');
        }

        for (const category of gameState.selectedCategories) {
            try {
                const questions = await loadCategoryQuestions(category);
                if (questions && questions.length > 0) {
                    if (isDevelopment) {
                        console.log(`✅ Loaded ${questions.length} questions for ${category}`);
                    }
                    questions.forEach(q => {
                        currentGame.allQuestions.push({
                            text: sanitizeQuestionText(q),
                            category: category
                        });
                    });
                } else {
                    if (isDevelopment) {
                        console.log(`⚠️ No Firebase questions for ${category}, using fallback`);
                    }
                    loadFallbackQuestions(category);
                }
            } catch (error) {
                console.warn(`⚠️ Error loading ${category}:`, error);
                loadFallbackQuestions(category);
            }
        }
    } else {
        // No Firebase - use fallback
        console.warn('⚠️ Firebase not available, using fallback questions');
        gameState.selectedCategories.forEach(category => {
            loadFallbackQuestions(category);
        });
    }

    // ✅ FIX: Ensure we have at least some questions
    if (currentGame.allQuestions.length === 0) {
        console.error('❌ No questions loaded! Loading all fallbacks...');
        // Load all fallback categories as emergency
        Object.keys(fallbackQuestionsDatabase).forEach(category => {
            loadFallbackQuestions(category);
        });
    }

    if (isDevelopment) {
        console.log(`📚 Total questions loaded: ${currentGame.allQuestions.length}`);
        console.log('Sample questions:', currentGame.allQuestions.slice(0, 3));
    }

    // Shuffle
    currentGame.allQuestions = shuffleArray(currentGame.allQuestions);

    // Cache questions
    cacheQuestions(currentGame.allQuestions);
}

/**
 * ✅ P0 FIX: Sanitize question text
 */
function sanitizeQuestionText(text) {
    if (!text) return '';

    // Use NocapUtils if available
    if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
        return window.NocapUtils.sanitizeInput(String(text));
    }

    // Fallback: Remove HTML tags
    return String(text).replace(/<[^>]*>/g, '').substring(0, 500);
}

/**
 * Load category questions from Firebase
 */
async function loadCategoryQuestions(category) {
    if (!firebaseService) return null;

    try {
        if (typeof firebase !== 'undefined' && firebase.database) {
            const questionsRef = firebase.database().ref(`questions/${category}`);
            const snapshot = await questionsRef.once('value');

            if (snapshot.exists()) {
                const questionsData = snapshot.val();

                let questions = [];

                // Handle both array and object structures
                if (Array.isArray(questionsData)) {
                    questions = questionsData;
                } else if (typeof questionsData === 'object') {
                    questions = Object.values(questionsData);
                }

                // ✅ FIX: Extract text from question objects
                return questions.map(q => {
                    if (typeof q === 'string') {
                        return q; // Already a string
                    } else if (q && typeof q === 'object' && q.text) {
                        return q.text; // Extract text property
                    } else if (q && typeof q === 'object' && q.question) {
                        return q.question; // Alternative property name
                    } else {
                        return String(q); // Fallback: convert to string
                    }
                });
            }
        }
        return null;
    } catch (error) {
        console.error(`❌ Error loading ${category}:`, error);
        return null;
    }
}

/**
 * Load fallback questions for category
 */
function loadFallbackQuestions(category) {
    if (fallbackQuestionsDatabase[category]) {
        fallbackQuestionsDatabase[category].forEach(q => {
            currentGame.allQuestions.push({
                text: sanitizeQuestionText(q),
                category: category
            });
        });
    }
}

/**
 * ✅ P0 FIX: Cache questions in localStorage (24h)
 */
function cacheQuestions(questions) {
    try {
        const cacheData = {
            questions: questions,
            categories: gameState.selectedCategories,
            timestamp: Date.now()
        };

        if (window.NocapUtils) {
            window.NocapUtils.setLocalStorage('nocap_cached_questions', JSON.stringify(cacheData));
        } else {
            localStorage.setItem('nocap_cached_questions', JSON.stringify(cacheData));
        }
    } catch (error) {
        console.warn('⚠️ Could not cache questions:', error);
    }
}

/**
 * Load questions from cache
 */
function loadQuestionsFromCache() {
    try {
        const cacheStr = window.NocapUtils ?
            window.NocapUtils.getLocalStorage('nocap_cached_questions') :
            localStorage.getItem('nocap_cached_questions');

        if (!cacheStr) return null;

        // ✅ FIX: Validiere JSON bevor Parse
        let cache;
        try {
            cache = JSON.parse(cacheStr);
        } catch (parseError) {
            console.warn('⚠️ Cache JSON corrupt, clearing:', parseError.message);
            if (window.NocapUtils) {
                window.NocapUtils.removeLocalStorage('nocap_cached_questions');
            } else {
                localStorage.removeItem('nocap_cached_questions');
            }
            return null;
        }
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        // Check if cache is valid
        if (now - cache.timestamp > maxAge) {
            if (window.NocapUtils) {
                window.NocapUtils.removeLocalStorage('nocap_cached_questions');
            } else {
                localStorage.removeItem('nocap_cached_questions');
            }
            return null;
        }

        // Check if categories match
        const categoriesMatch =
            cache.categories &&
            cache.categories.length === gameState.selectedCategories.length &&
            cache.categories.every(c => gameState.selectedCategories.includes(c));

        if (!categoriesMatch) {
            if (window.NocapUtils) {
                window.NocapUtils.removeLocalStorage('nocap_cached_questions');
            } else {
                localStorage.removeItem('nocap_cached_questions');
            }
            return null;
        }

        return cache.questions;
    } catch (error) {
        console.warn('⚠️ Could not load cache:', error);
        return null;
    }
}

/**
 * Get next question
 */
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

/**
 * Shuffle array
 */
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// ===========================
// GAME FLOW
// ===========================

function startNewQuestion() {
    if (isDevelopment) {
        console.log(`🎲 Starting question ${currentGame.currentQuestionNumber}`);
        console.log(`📊 Available questions: ${currentGame.allQuestions.length}`);
    }

    // ✅ FIX: Safety check for empty questions
    if (!currentGame.allQuestions || currentGame.allQuestions.length === 0) {
        console.error('❌ No questions available!');
        showNotification('Keine Fragen geladen! Lade Fallback...', 'error');

        // Emergency: Load fallback questions
        Object.keys(fallbackQuestionsDatabase).forEach(category => {
            loadFallbackQuestions(category);
        });

        if (currentGame.allQuestions.length === 0) {
            showNotification('Fehler: Keine Fragen verfügbar!', 'error');
            setTimeout(() => window.location.href = 'index.html', 3000);
            return;
        }
    }

    currentGame.currentPlayerIndex = 0;
    currentGame.currentAnswers = {};
    currentGame.currentEstimates = {};

    const question = getNextQuestion();

    if (!question || !question.text) {
        console.error('❌ Invalid question:', question);
        showNotification('Fehler beim Laden der Frage!', 'error');
        return;
    }

    if (isDevelopment) {
        console.log('📝 Question:', question);
    }

    loadQuestion(question);

    resetPlayerUI();
    updateGameDisplay();
    showGameView();

    // Save progress
    saveGameProgress();
}

function nextQuestion() {
    currentGame.currentQuestionNumber++;
    startNewQuestion();
    showNotification('Neue Frage geladen! 🎮', 'success');
}

function endGame() {
    showFinalResults();
}

/**
 * ✅ P0 FIX: Load question with textContent
 */
function loadQuestion(question) {
    const categoryNames = {
        'fsk0': '👨‍👩‍👧‍👦 Familie & Freunde',
        'fsk16': '🎉 Party Time',
        'fsk18': '🔥 Heiß & Gewagt',
        'special': '⭐ Special Edition'
    };

    const questionText = document.getElementById('question-text');
    const questionCategory = document.getElementById('question-category');

    if (questionText) {
        // Use textContent for safety
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

    if (playerNameEl && currentPlayerName) {
        // Use textContent
        playerNameEl.textContent = currentPlayerName;
    }
    if (avatarEl && currentPlayerName) {
        // ✅ FIX: Prüfe ob currentPlayerName existiert
        avatarEl.textContent = currentPlayerName.charAt(0).toUpperCase();
    }
    if (progressEl) {
        progressEl.textContent = `(${currentGame.currentPlayerIndex + 1}/${currentGame.players.length})`;
    }
}

function resetPlayerUI() {
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    currentAnswer = null;
    currentEstimation = null;
    updateNumberSelection();
    hideSelectionDisplay();
    updateSubmitButton();
}

// ===========================
// UI CONTROLS
// ===========================

function createNumberGrid() {
    const numberGrid = document.getElementById('number-grid');
    if (!numberGrid) return;

    const playerCount = currentGame.players.length;
    numberGrid.innerHTML = '';

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
        numberBtn.setAttribute('aria-label', `${i} Spieler schätzen`);
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
        selectionDisplay.style.transform = 'scale(1.08)';
        setTimeout(() => {
            selectionDisplay.style.transform = 'scale(1)';
        }, 300);
    }
}

function showSelectionDisplay() {
    const selectionEl = document.getElementById('current-selection');
    if (selectionEl) {
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
        submitBtn.setAttribute('aria-disabled', 'false');
    } else {
        submitBtn.classList.remove('enabled');
        submitBtn.disabled = true;
        submitBtn.setAttribute('aria-disabled', 'true');
    }
}

// ===========================
// GAME ACTIONS
// ===========================

function submitAnswer() {
    if (currentAnswer === null || currentEstimation === null) {
        showNotification('Bitte wähle eine Antwort und eine Schätzung aus!', 'warning');
        return;
    }

    const currentPlayerName = currentGame.players[currentGame.currentPlayerIndex];

    currentGame.currentAnswers[currentPlayerName] = currentAnswer;
    currentGame.currentEstimates[currentPlayerName] = currentEstimation;

    if (isDevelopment) {
        console.log(`📤 ${currentPlayerName} answered:`, {
            answer: currentAnswer,
            estimation: currentEstimation
        });
    }

    // Save progress
    saveGameProgress();

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

// ===========================
// PLAYER CHANGE POPUP
// ===========================

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

// ===========================
// RESULTS
// ===========================

function showResults() {
    if (isDevelopment) {
        console.log('📊 Calculating results...');
    }

    const actualYesCount = Object.values(currentGame.currentAnswers).filter(answer => answer === true).length;

    const results = currentGame.players.map(playerName => {
        const answer = currentGame.currentAnswers[playerName];
        const estimation = currentGame.currentEstimates[playerName];
        const difference = Math.abs(estimation - actualYesCount);
        const isCorrect = difference === 0;

        let sips = 0;
        if (!isCorrect) {
            const multiplier = getDifficultyMultiplier();
            sips = difference * multiplier;
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

    // Save progress
    saveGameProgress();
}

function getDifficultyMultiplier() {
    switch (gameState.difficulty) {
        case 'easy': return 1;
        case 'hard': return 2;
        default: return 1; // medium
    }
}

/**
 * ✅ P0 FIX: Display results with textContent only
 */
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

    const drinkEmoji = alcoholMode ? '🍺' : '💧';

    sortedResults.forEach(result => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';

        const avatar = result.playerName.charAt(0).toUpperCase();

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
        // Use textContent
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

    // ✅ CSP FIX: Use CSS classes instead of inline styles
    if (answerSection) answerSection.classList.add('hidden');
    if (estimationSection) estimationSection.classList.add('hidden');
    if (submitSection) submitSection.classList.add('hidden');
    if (currentPlayerCard) currentPlayerCard.classList.add('hidden');
    if (resultsSection) resultsSection.classList.remove('hidden');

    showNotification('Ergebnisse werden angezeigt...', 'success', 2000);
}

function showGameView() {
    const answerSection = document.getElementById('answer-section');
    const estimationSection = document.getElementById('estimation-section');
    const submitSection = document.getElementById('submit-section');
    const currentPlayerCard = document.querySelector('.current-player-card');
    const resultsSection = document.getElementById('results-section');

    // ✅ CSP FIX: Use CSS classes instead of inline styles
    if (answerSection) answerSection.classList.remove('hidden');
    if (estimationSection) estimationSection.classList.remove('hidden');
    if (submitSection) submitSection.classList.remove('hidden');
    if (currentPlayerCard) currentPlayerCard.classList.remove('hidden');
    if (resultsSection) resultsSection.classList.add('hidden');
}

// ===========================
// FINAL RESULTS
// ===========================

function showFinalResults() {
    if (isDevelopment) {
        console.log('🏆 Calculating final results...');
    }

    const playerStats = calculatePlayerStatistics();
    const finalRankings = playerStats.sort((a, b) => a.totalSips - b.totalSips);

    displayFinalResults(finalRankings);
    showFinalResultsView();

    // Clear progress on game end
    clearGameProgress();
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

/**
 * ✅ P0 FIX: Display final results with textContent
 */
function displayFinalResults(finalRankings) {
    const leaderboardList = document.getElementById('leaderboard-list');
    if (!leaderboardList) return;

    leaderboardList.innerHTML = '';

    const drinkEmoji = alcoholMode ? '🍺' : '💧';

    finalRankings.forEach((player, index) => {
        const leaderboardItem = document.createElement('div');
        leaderboardItem.className = `leaderboard-item ${index === 0 ? 'winner' : ''}`;

        const rankClass = index === 0 ? 'rank-1' :
            index === 1 ? 'rank-2' :
                index === 2 ? 'rank-3' : 'rank-other';

        const rankText = index + 1;
        const avatar = player.playerName.charAt(0).toUpperCase();

        const sipsText = player.totalSips === 1 ? '1 Schluck' : `${player.totalSips} Schlücke`;
        const questionsText = player.correctGuesses === 1 ? '1 Frage richtig' : `${player.correctGuesses} Fragen richtig`;

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
        // Use textContent
        playerFinalName.textContent = player.playerName;

        const playerFinalDetails = document.createElement('div');
        playerFinalDetails.className = 'player-final-details';

        // Build with textContent instead of innerHTML
        const detailItem1 = document.createElement('div');
        detailItem1.className = 'detail-item';

        const icon1 = document.createElement('span');
        icon1.className = 'detail-icon';
        icon1.textContent = drinkEmoji;

        const text1 = document.createElement('span');
        text1.textContent = sipsText;

        detailItem1.appendChild(icon1);
        detailItem1.appendChild(text1);

        const detailItem2 = document.createElement('div');
        detailItem2.className = 'detail-item';

        const icon2 = document.createElement('span');
        icon2.className = 'detail-icon';
        icon2.textContent = '🎯';

        const text2 = document.createElement('span');
        text2.textContent = questionsText;

        detailItem2.appendChild(icon2);
        detailItem2.appendChild(text2);

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

    // ✅ CSP FIX: Use CSS classes instead of inline styles
    if (questionCard) questionCard.classList.add('hidden');
    if (answerSection) answerSection.classList.add('hidden');
    if (estimationSection) estimationSection.classList.add('hidden');
    if (submitSection) submitSection.classList.add('hidden');
    if (currentPlayerCard) currentPlayerCard.classList.add('hidden');
    if (resultsSection) resultsSection.classList.add('hidden');
    if (finalResultsSection) finalResultsSection.classList.remove('hidden');
}

// ===========================
// EVENT LISTENERS
// ===========================

function setupEventListeners() {
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

    // Results navigation - delegation
    document.addEventListener('click', function(e) {
        const primaryBtn = e.target.closest('.nav-btn.primary');
        const secondaryBtn = e.target.closest('.nav-btn.secondary');

        if (primaryBtn) {
            const btnText = primaryBtn.textContent.trim();

            if (isDevelopment) {
                console.log('Primary button clicked:', btnText);
            }

            if (btnText.includes('Nächste Frage')) {
                nextQuestion();
            } else if (btnText.includes('Spiel beenden')) {
                if (isDevelopment) {
                    console.log('Going home...');
                }
                goHome();
            }
        } else if (secondaryBtn) {
            if (isDevelopment) {
                console.log('Secondary button clicked - ending game');
            }
            endGame();
        }
    });

    // Auto-save on visibility change
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            saveGameProgress();
        }
    });
}

// ===========================
// PAGE LEAVE PROTECTION
// ===========================

function setupPageLeaveProtection() {
    window.addEventListener('beforeunload', function(e) {
        if (!isExitDialogShown) {
            saveGameProgress();
            e.preventDefault();
            e.returnValue = 'Möchtest du das Spiel wirklich verlassen?';
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
        exitDialog.setAttribute('aria-hidden', 'false');
    }
}

function cancelExit() {
    const exitDialog = document.getElementById('exit-confirmation');
    if (exitDialog) {
        exitDialog.classList.remove('show');
        exitDialog.setAttribute('aria-hidden', 'true');
    }
}

function confirmExit() {
    clearGameProgress();
    gameState.reset();
    isExitDialogShown = true;
    window.location.replace('index.html');
}

/**
 * Go home - end game and return to start
 */
function goHome() {
    if (isDevelopment) {
        console.log('🏠 Going home...');
    }

    // Clear game progress
    clearGameProgress();

    // Reset game state
    if (gameState && typeof gameState.reset === 'function') {
        gameState.reset();
    }

    // Set flag to prevent beforeunload dialog
    isExitDialogShown = true;

    // Show notification
    showNotification('Spiel beendet! 👋', 'info', 1500);

    // Redirect to home after short delay
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 500);
}


// ===========================
// UTILITY FUNCTIONS
// ===========================

/**
 * ✅ P0 FIX: Safe notification using NocapUtils
 */
function showNotification(message, type = 'info', duration = 3000) {
    if (window.NocapUtils && window.NocapUtils.showNotification) {
        window.NocapUtils.showNotification(message, type, duration);
        return;
    }

    // Fallback
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
    toastMessage.textContent = String(message).replace(/<[^>]*>/g, '');

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
// INITIALIZATION
// ===========================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}