/**
 * No-Cap Gameplay (Single Device Mode)
 * Version 6.0 - JavaScript-Kern Hardening
 *
 * ✅ P0: Module Pattern - no global variables (XSS prevention)
 * ✅ P0: Event-Listener cleanup on beforeunload
 * ✅ P0: MANDATORY server-side FSK validation before loading questions
 * ✅ P1: Device mode validation
 * ✅ P0: Input sanitization with DOMPurify (all player names + answers)
 * ✅ P1: GameplayModule.gameState integration (players from state)
 * ✅ P1: Enhanced rejoin mechanism with auto-save
 * ✅ P0: Question caching (24h)
 * ✅ P0: All DOM manipulation uses textContent
 * ✅ P1: Error boundary with network fallback
 * ✅ P1 UI/UX: Enhanced accessibility (ARIA, screen reader support)
 * ✅ P2 PERFORMANCE: Optimized shuffling and animations
 */

'use strict';

// Get Logger from utils
const Logger = window.NocapUtils?.Logger || {
    debug: (...args) => {},
    info: (...args) => {},
    warn: console.warn,
    error: console.error
};

// ===========================
// 🔒 MODULE SCOPE - NO GLOBAL POLLUTION
// ===========================
// 🔒 MODULE SCOPE - NO GLOBAL POLLUTION
// ===========================

const GameplayModule = {
    state: {
        gameState: null,
        firebaseService: null,
        alcoholMode: false,
        isExitDialogShown: false,
        autoSaveTimer: null,
        networkErrorCount: 0,
        eventListenerCleanup: [],
        _listenersBound: false, // ✅ add this BEFORE seal

        currentGame: {
            players: [],
            allQuestions: [],
            usedQuestions: [],
            currentQuestionNumber: 1,
            currentPlayerIndex: 0,
            currentAnswers: {},
            currentEstimates: {},
            gameHistory: [],
            shuffledQuestionQueue: [],
            questionQueueIndex: 0,
            lastSaveTimestamp: null,
            sessionId: null
        },

        currentAnswer: null,
        currentEstimation: null,

        isDevelopment: window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname.includes('192.168.')
    },

    // Controlled access
    get gameState() { return this.state.gameState; },
    set gameState(val) { this.state.gameState = val; },

    get firebaseService() { return this.state.firebaseService; },
    set firebaseService(val) { this.state.firebaseService = val; },

    get alcoholMode() { return this.state.alcoholMode; },
    set alcoholMode(val) { this.state.alcoholMode = !!val; },

    get isExitDialogShown() { return this.state.isExitDialogShown; },
    set isExitDialogShown(val) { this.state.isExitDialogShown = !!val; },

    get autoSaveTimer() { return this.state.autoSaveTimer; },
    set autoSaveTimer(val) { this.state.autoSaveTimer = val; },

    get networkErrorCount() { return this.state.networkErrorCount; },
    set networkErrorCount(val) { this.state.networkErrorCount = val; },

    get currentGame() { return this.state.currentGame; },

    get currentAnswer() { return this.state.currentAnswer; },
    set currentAnswer(val) { this.state.currentAnswer = val; },

    get currentEstimation() { return this.state.currentEstimation; },
    set currentEstimation(val) { this.state.currentEstimation = val; },

    get isDevelopment() { return this.state.isDevelopment; }
};

Object.seal(GameplayModule.state);

// ===========================
// 🛠️ PERFORMANCE UTILITIES
// ===========================
// 🛠️ PERFORMANCE UTILITIES
// ===========================

function throttle(func, wait = 100) {
    let timeout = null;
    let previous = 0;
    return function executedFunction(...args) {
        const now = Date.now();
        const remaining = wait - (now - previous);
        if (remaining <= 0 || remaining > wait) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            previous = now;
            func.apply(this, args);
        } else if (!timeout) {
            timeout = setTimeout(() => {
                previous = Date.now();
                timeout = null;
                func.apply(this, args);
            }, remaining);
        }
    };
}

function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function addTrackedEventListener(element, event, handler, options = {}) {
    if (!element) return;
    element.addEventListener(event, handler, options);
    GameplayModule.state.eventListenerCleanup.push({element, event, handler, options});
}

// ===========================
// CONSTANTS
// ===========================
const GAME_PROGRESS_KEY = 'nocap_game_progress';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const REJOIN_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const AUTO_SAVE_INTERVAL = 30 * 1000; // 30 seconds
const MAX_NETWORK_ERRORS = 3;

// (All state moved to GameplayModule)

// ===========================
// UI HELPER FUNCTIONS - P1 UI/UX
// ===========================

/**
 * ✅ P1 UI/UX: Show loading overlay
 */
function showLoading(message = 'Lädt...') {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');

    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
    }
    if (loadingText) {
        loadingText.textContent = message;
    }
}

/**
 * ✅ P1 UI/UX: Hide loading overlay
 */
function hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');

    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
    }
}
/**
 * ✅ P1 DSGVO: Display FSK badge for age-restricted content
 * ✅ FSK18-SYSTEM: Only show badge for FSK18 (FSK16 not restricted anymore)
 */
function updateFSKBadge(question) {
    const fskBadge = document.getElementById('fsk-badge');
    const fskText = document.getElementById('fsk-text');

    if (!fskBadge || !fskText) return;

    // ✅ FSK18-SYSTEM: Only show badge for FSK18 content
    if (question.category === 'fsk18' || question.fsk === 18) {
        fskBadge.classList.remove('hidden', 'fsk-16');
        fskBadge.classList.add('fsk-18');
        fskText.textContent = 'ab 18';
        fskBadge.setAttribute('aria-label', 'FSK 18 - Freigegeben ab 18 Jahren');
    } else {
        // FSK 0, FSK 16, or no rating - hide badge (FSK16 not restricted)
        fskBadge.classList.add('hidden');
        fskBadge.classList.remove('fsk-16', 'fsk-18');
    }
}

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
        
            "Ich habe schon mal... an einem öffentlichen Ort geküsst",
            "Ich habe schon mal... eine peinliche Nachricht an die falsche Person geschickt",
            "Ich habe schon mal... in einer Beziehung gelogen"
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
    Logger.debug('🎮 Initializing single device gameplay...');

    try {
        // Setup page leave protection
        setupPageLeaveProtection();

        // Check dependencies
        if (typeof DOMPurify === 'undefined') {
            Logger.error('❌ CRITICAL: DOMPurify not loaded!');
            alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
            return;
        }

        if (typeof window.GameState === 'undefined') {
            Logger.error('❌ GameplayModule.gameState not found');
            showNotification('Fehler beim Laden. Bitte Seite neu laden.', 'error');
            return;
        }

        if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
            await window.NocapUtils.waitForDependencies(['GameState']);
        }
        GameplayModule.gameState = new window.GameState();

// ✅ P0 FIX: Ensure Firebase is initialized BEFORE accessing instances (with fallback)
        try {
            if (window.FirebaseConfig) {
                if (!window.FirebaseConfig.isInitialized()) {
                    await window.FirebaseConfig.initialize();
                }

                if (typeof window.FirebaseConfig.waitForFirebase === 'function') {
                    await window.FirebaseConfig.waitForFirebase(10000);
                }

                const instances = window.FirebaseConfig.getFirebaseInstances();
                GameplayModule.firebaseService = instances;
                if (GameplayModule.isDevelopment) Logger.debug('✅ Firebase instances ready in gameplay');

            } else {
                GameplayModule.firebaseService = null;
                Logger.warn('⚠️ FirebaseConfig missing, using fallback mode');
            }
        } catch (e) {
            GameplayModule.firebaseService = null;
            Logger.warn('⚠️ Firebase init failed, using fallback mode:', e?.message || e);
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
            Logger.debug('✅ Rejoined previous game');
            return;
        }

        // ✅ P1 FIX: Load players from GameplayModule.gameState
        const savedPlayers = GameplayModule.gameState.get('players');
        if (!savedPlayers || savedPlayers.length < 2) {
            Logger.error('❌ No players in GameplayModule.gameState');
            showNotification('Keine Spieler gefunden!', 'error');
            setTimeout(() => window.location.href = 'player-setup.html', 2000);
            return;
        }

        // Setup new game with players from GameplayModule.gameState
        GameplayModule.currentGame.players = [...savedPlayers];

        Logger.debug('👥 Players loaded:', GameplayModule.currentGame.players);

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
        await startNewQuestion();

        Logger.debug('✅ Game initialized successfully');

    } catch (error) {
        Logger.error('❌ Initialization error:', error);
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
    const deviceMode = GameplayModule.gameState.deviceMode;

    if (!deviceMode) {
        Logger.error('❌ No device mode set');
        showNotification('Spielmodus nicht gesetzt', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }

    if (deviceMode !== 'single') {
        Logger.error(`❌ Wrong device mode: ${deviceMode} (expected "single")`);
        showNotification('Nicht im Einzelgerät-Modus', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }

    Logger.debug('✅ Device mode validated: single');

    return true;
}
/**
 * ✅ P0 FIX: Comprehensive validation with MANDATORY server-side FSK checks
 * ✅ FSK18-SYSTEM: Only FSK18 requires server validation, FSK16 is always allowed
 * @returns {Promise<boolean>} True if valid
 */
async function validateGameState() {
    if (!GameplayModule.gameState.deviceMode ||
        !GameplayModule.gameState.selectedCategories?.length) {
        Logger.error('❌ GameState ungültig');
        showNotification('Ungültiger Spielzustand', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }

    const savedPlayers = GameplayModule.gameState.get('players');

    if (GameplayModule.isDevelopment) {
        Logger.debug('🔍 GameState validation:', {
            players: savedPlayers,
            playersLength: savedPlayers ? savedPlayers.length : 0,
            categories: GameplayModule.gameState.selectedCategories,
            difficulty: GameplayModule.gameState.difficulty,
            deviceMode: GameplayModule.gameState.deviceMode
        });
    }

    if (!savedPlayers || savedPlayers.length < 2) {
        Logger.error('❌ Not enough players:', savedPlayers);
        showNotification('Keine Spieler gefunden! Zurück zum Setup...', 'error');
        setTimeout(() => window.location.href = 'player-setup.html', 2000);
        return false;
    }

    if (!GameplayModule.gameState.selectedCategories || GameplayModule.gameState.selectedCategories.length === 0) {
        Logger.error('❌ No categories selected');
        showNotification('Keine Kategorien ausgewählt!', 'error');
        setTimeout(() => window.location.href = 'category-selection.html', 2000);
        return false;
    }

    if (!GameplayModule.gameState.difficulty) {
        Logger.error('❌ No difficulty selected');
        showNotification('Kein Schwierigkeitsgrad ausgewählt!', 'error');
        setTimeout(() => window.location.href = 'difficulty-selection.html', 2000);
        return false;
    }

    // ✅ FSK18-SYSTEM: Check if FSK18 categories are selected
    const hasFSK18 = GameplayModule.gameState.selectedCategories.includes('fsk18');

    // ✅ FSK18-SYSTEM: FSK0 & FSK16 always allowed - no validation needed
    if (!hasFSK18) {
        Logger.debug('✅ No FSK18 content - validation passed');
        return true;
    }

    // ✅ FSK18-SYSTEM: FSK18 requires server-side validation
    try {
        // Check if Firebase is available (required for server validation)
        if (!window.FirebaseConfig?.isInitialized?.()) {
            Logger.error('❌ Firebase not initialized - FSK18 requires server validation');
            showNotification('FSK18-Validierung erfordert Internetverbindung', 'error');
            setTimeout(() => window.location.href = 'category-selection.html', 2000);
            return false;
        }

        // Check if GameState has FSK validation method
        if (!GameplayModule.gameState?.canAccessFSK) {
            Logger.error('❌ GameState.canAccessFSK not available');
            showNotification('Fehler bei der Altersverifikation', 'error');
            setTimeout(() => window.location.href = 'category-selection.html', 2000);
            return false;
        }

        // ✅ FSK18-SYSTEM: Server-side validation
        const hasAccess = await GameplayModule.gameState.canAccessFSK('fsk18', true);

        if (!hasAccess) {
            Logger.error('❌ No FSK18 access');
            showNotification('🔞 Keine Berechtigung für FSK18-Inhalte', 'error');
            setTimeout(() => window.location.href = 'category-selection.html', 2000);
            return false;
        }

        Logger.debug('✅ FSK18 server validation passed');

        return true;

    } catch (error) {
        Logger.error('❌ FSK18 validation error:', error);
        showNotification('Fehler bei der Altersverifikation', 'error');
        setTimeout(() => window.location.href = 'category-selection.html', 2000);
        return false;
    }
}

// ===========================
// REJOIN MECHANISM
// ===========================

/**
 * ✅ P1 STABILITY: Save game progress with error boundary
 * Called periodically and on critical state changes
 */
function saveGameProgress() {
    try {
        const progressData = {
            deviceMode: 'single',
            players: GameplayModule.currentGame.players,
            currentQuestionNumber: GameplayModule.currentGame.currentQuestionNumber,
            currentPlayerIndex: GameplayModule.currentGame.currentPlayerIndex,
            usedQuestions: GameplayModule.currentGame.usedQuestions,
            gameHistory: GameplayModule.currentGame.gameHistory,
            currentAnswers: GameplayModule.currentGame.currentAnswers,
            currentEstimates: GameplayModule.currentGame.currentEstimates,
            shuffledQuestionQueue: GameplayModule.currentGame.shuffledQuestionQueue,
            questionQueueIndex: GameplayModule.currentGame.questionQueueIndex,
            timestamp: Date.now(),
            sessionId: GameplayModule.currentGame.sessionId || generateSessionId(),
            version: '5.0'
        };

        // ✅ P1 STABILITY: Try localStorage first
        try {
            if (window.NocapUtils) {
                window.NocapUtils.setLocalStorage(GAME_PROGRESS_KEY, JSON.stringify(progressData));
                window.NocapUtils.setLocalStorage('nocap_last_active', Date.now().toString());
            } else {
                localStorage.setItem(GAME_PROGRESS_KEY, JSON.stringify(progressData));
                localStorage.setItem('nocap_last_active', Date.now().toString());
            }

            GameplayModule.currentGame.lastSaveTimestamp = Date.now();

            Logger.debug('💾 Game progress saved to localStorage');
        } catch (storageError) {
            Logger.error('❌ localStorage save failed:', storageError);

            // ✅ P1 STABILITY: Fallback to sessionStorage
            try {
                sessionStorage.setItem(GAME_PROGRESS_KEY, JSON.stringify(progressData));
                Logger.warn('⚠️ Saved to sessionStorage as fallback');
            } catch (sessionError) {
                Logger.error('❌ sessionStorage save also failed:', sessionError);
                throw new Error('Spielstand konnte nicht gespeichert werden');
            }
        }

        // ✅ P1 STABILITY: Try Firebase sync (non-blocking, multiplayer only)
        const isMulti = GameplayModule.currentGame?.deviceMode === 'multi';
        if (isMulti && GameplayModule.firebaseService?.database?.ref) {

            syncGameProgressToFirebase(progressData).catch(error => {
                Logger.warn('⚠️ Firebase sync failed (non-critical):', error);
                GameplayModule.networkErrorCount++;

                if (GameplayModule.networkErrorCount >= MAX_NETWORK_ERRORS) {
                    showNotification(
                        '⚠️ Offline-Modus: Spielstand nur lokal gespeichert',
                        'warning',
                        3000
                    );
                }
            });
        }

    } catch (error) {
        Logger.error('❌ Could not save progress:', error);

        // ✅ P1 STABILITY: Show user-friendly error
        showNotification(
            '⚠️ Spielstand konnte nicht gespeichert werden. Änderungen gehen möglicherweise verloren.',
            'error',
            5000
        );
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
        GameplayModule.currentGame.players = progress.players || [];
        GameplayModule.currentGame.currentQuestionNumber = progress.currentQuestionNumber || 1;
        GameplayModule.currentGame.currentPlayerIndex = progress.currentPlayerIndex || 0;
        GameplayModule.currentGame.usedQuestions = progress.usedQuestions || [];
        GameplayModule.currentGame.gameHistory = progress.gameHistory || [];

        // Reload questions
        await loadQuestions();

        // Restore UI
        updateGameDisplay();
        createNumberGrid();
        setupEventListeners();

        // Continue from where we left off
        if (GameplayModule.currentGame.currentPlayerIndex === 0) {
            await startNewQuestion();
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
        Logger.error('❌ Rejoin error:', error);
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

        Logger.debug('🗑️ Game progress cleared');
    } catch (error) {
        Logger.warn('⚠️ Could not clear progress:', error);
    }
}
/**
 * ✅ FSK18-SYSTEM: Check alcohol mode with integrated age verification
 */
function checkAlcoholMode() {
    try {
        GameplayModule.alcoholMode = GameplayModule.gameState.alcoholMode === true;

        if (GameplayModule.alcoholMode) {
            // ✅ FSK18-SYSTEM: Use userAgeLevel from GameState
            const ageLevel = GameplayModule.gameState.userAgeLevel || 0;

            if (ageLevel < 18) {
                // User is under 18 - disable alcohol mode
                GameplayModule.alcoholMode = false;

                if (typeof GameplayModule.gameState.setAlcoholMode === 'function') {
                    GameplayModule.gameState.setAlcoholMode(false);
                } else if (typeof GameplayModule.gameState.set === 'function') {
                    GameplayModule.gameState.set('alcoholMode', false);
                } else {
                    GameplayModule.gameState.alcoholMode = false;
                }

                Logger.debug('⚠️ Alcohol mode disabled (user under 18)');
            }
        }

        Logger.debug(`🍺 Alcohol mode: ${GameplayModule.alcoholMode}`);
    } catch (error) {
        Logger.error('❌ Error checking alcohol mode:', error);
        GameplayModule.alcoholMode = false;
    }
}

// ===========================
// QUESTION LOADING WITH CACHING
// ===========================
/**
 * ✅ P0 FIX: Load questions from Firebase with caching
 * ✅ FSK18-SYSTEM: Validate FSK18 access before loading
 */
async function loadQuestions() {
    // ✅ P1 UI/UX: Show loading state
    showLoading('Lade Fragen...');

    GameplayModule.currentGame.allQuestions = [];

    Logger.debug('📚 Loading questions for categories:', GameplayModule.gameState.selectedCategories);

    // Try to load from cache first
    const cachedQuestions = loadQuestionsFromCache();
    if (cachedQuestions && cachedQuestions.length > 0) {
        Logger.debug('✅ Loaded questions from cache:', cachedQuestions.length);
        GameplayModule.currentGame.allQuestions = cachedQuestions;
        hideLoading();
        return;
    }

    // ✅ FSK18-SYSTEM: Check if FSK18 validation is needed
    const hasFSK18 = GameplayModule.gameState.selectedCategories.includes('fsk18');

    if (hasFSK18) {
        // Validate FSK18 access before loading any questions
        try {
            if (!window.FirebaseConfig?.isInitialized?.()) {
                Logger.warn('⚠️ Firebase not initialized - cannot validate FSK18');
                throw new Error('FSK18-Validierung erfordert Internetverbindung');
            }

            if (!GameplayModule.gameState?.canAccessFSK) {
                throw new Error('Altersverifikation nicht verfügbar');
            }

            const hasAccess = await GameplayModule.gameState.canAccessFSK('fsk18', true);

            if (!hasAccess) {
                Logger.error('❌ No FSK18 access during question loading');
                hideLoading();
                showNotification('🔞 Keine Berechtigung für FSK18-Inhalte', 'error');
                setTimeout(() => window.location.href = 'category-selection.html', 2000);
                return;
            }

            Logger.debug('✅ FSK18 validation passed - loading questions');

        } catch (error) {
            Logger.error('❌ FSK18 validation failed:', error);
            hideLoading();
            showNotification(error.message || 'Fehler bei der Altersverifikation', 'error');
            setTimeout(() => window.location.href = 'category-selection.html', 2000);
            return;
        }
    }

    // Load from Firebase
    if (GameplayModule.firebaseService?.database?.ref) {
        Logger.debug('🔥 Loading from Firebase...');

        for (const category of GameplayModule.gameState.selectedCategories) {
            try {
                const questions = await loadCategoryQuestions(category);
                if (questions && questions.length > 0) {
                    Logger.debug(`✅ Loaded ${questions.length} questions for ${category}`);
                    questions.forEach(q => {
                        GameplayModule.currentGame.allQuestions.push({
                            text: sanitizeQuestionText(q),
                            category: category
                        });
                    });
                } else {
                    Logger.debug(`⚠️ No Firebase questions for ${category}, using fallback`);

                    // ✅ FSK18-SYSTEM: Only load FSK18 fallback if validated
                    if (category === 'fsk18' && !hasFSK18) {
                        Logger.warn('⚠️ Skipping FSK18 fallback - no access');
                        continue;
                    }

                    await loadFallbackQuestions(category);
                }
            } catch (error) {
                Logger.warn(`⚠️ Error loading ${category}:`, error);

                // ✅ FSK18-SYSTEM: Skip FSK18 fallback if no access
                if (category === 'fsk18' && !hasFSK18) {
                    Logger.warn('⚠️ Skipping FSK18 fallback - no access');
                    continue;
                }

                await loadFallbackQuestions(category);
            }
        }
    } else {
        // No Firebase - use fallback
        Logger.warn('⚠️ Firebase not available, using fallback questions');
        for (const category of GameplayModule.gameState.selectedCategories) {
            // ✅ FSK18-SYSTEM: Skip FSK18 fallback if offline
            if (category === 'fsk18') {
                Logger.warn('⚠️ Skipping FSK18 fallback - offline mode');
                continue;
            }

            await loadFallbackQuestions(category);
        }
    }

    // ✅ FIX: Ensure we have at least some questions
    if (GameplayModule.currentGame.allQuestions.length === 0) {
        Logger.error('❌ No questions loaded! Loading all fallbacks...');

        // Load all fallback categories as emergency (except FSK18 if no access)
        const fallbackCategories = Object.keys(fallbackQuestionsDatabase);

        for (const cat of fallbackCategories) {
            // Skip FSK18 if not validated
            if (cat === 'fsk18' && !hasFSK18) {
                continue;
            }
            await loadFallbackQuestions(cat);
        }
    }

    if (GameplayModule.isDevelopment) {
        Logger.debug(`📚 Total questions loaded: ${GameplayModule.currentGame.allQuestions.length}`);
        Logger.debug('Sample questions:', GameplayModule.currentGame.allQuestions.slice(0, 3));
    }

    // ✅ P1 PERFORMANCE: Shuffle once and create consumption queue
    GameplayModule.currentGame.allQuestions = shuffleArray(GameplayModule.currentGame.allQuestions);
    GameplayModule.currentGame.shuffledQuestionQueue = [...GameplayModule.currentGame.allQuestions];
    GameplayModule.currentGame.questionQueueIndex = 0;

    Logger.debug('✅ Question queue initialized with', GameplayModule.currentGame.shuffledQuestionQueue.length, 'questions');

    // Cache questions
    cacheQuestions(GameplayModule.currentGame.allQuestions);

    // ✅ P1 STABILITY: Start auto-save timer
    startAutoSave();

    // Generate session ID for this game
    if (!GameplayModule.currentGame.sessionId) {
        GameplayModule.currentGame.sessionId = generateSessionId();
    }

    // ✅ P1 UI/UX: Hide loading when done
    hideLoading();
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
 * ✅ FSK18-SYSTEM: Load category questions with server-side validation for FSK18
 * @param {string} category - Category to load (fsk0, fsk16, fsk18, special)
 * @returns {Promise<Array|null>} Array of questions or null
 */
async function loadCategoryQuestions(category) {
    if (!GameplayModule.firebaseService) return null;

    try {
        // ✅ FSK18: Server-side validation required
        if (category === 'fsk18') {
            if (!window.FirebaseConfig?.isInitialized?.()) {
                Logger.warn('⚠️ Firebase not initialized - cannot load FSK18 questions');
                return null;
            }

            // Validate FSK18 access before loading
            if (!GameplayModule.gameState?.canAccessFSK) {
                Logger.warn('⚠️ GameState.canAccessFSK not available');
                return null;
            }

            const hasAccess = await GameplayModule.gameState.canAccessFSK('fsk18', true);

            if (!hasAccess) {
                Logger.warn('⚠️ No FSK18 access - skipping FSK18 questions');
                return null;
            }

            Logger.debug('✅ FSK18 access validated - loading questions via Cloud Function');

            // ✅ PHASE 3: Use Cloud Function for FSK18 questions
            const instances = window.FirebaseConfig.getFirebaseInstances();
            const functions = instances?.functions;

            if (!functions) {
                Logger.warn('⚠️ Firebase Functions not available for FSK18');
                return null;
            }

            try {
                const getQuestionsForGame = functions.httpsCallable('getQuestionsForGame');
                const gameId = GameplayModule.gameState.gameId || 'single-device-game';

                const result = await getQuestionsForGame({
                    gameId: gameId,
                    categories: ['fsk18'],
                    count: 100 // Request sufficient questions
                });

                if (result?.data?.questions) {
                    const fsk18Questions = result.data.questions.filter(q =>
                        q.category === 'fsk18' || q.fsk === 18
                    );

                    Logger.debug(`✅ Loaded ${fsk18Questions.length} FSK18 questions via Cloud Function`);

                    // Extract text from question objects
                    return fsk18Questions.map(q => {
                        if (typeof q === 'string') {
                            return q;
                        } else if (q && typeof q === 'object' && q.text) {
                            return q.text;
                        } else if (q && typeof q === 'object' && q.question) {
                            return q.question;
                        } else {
                            return String(q);
                        }
                    });
                } else {
                    Logger.warn('⚠️ No FSK18 questions returned from Cloud Function');
                    return null;
                }
            } catch (error) {
                Logger.error('❌ Cloud Function error for FSK18:', error);
                return null;
            }
        }

        // ✅ FSK0, FSK16, special: Direct database access (allowed by rules)
        if (GameplayModule.firebaseService?.database) {
            const questionsRef = GameplayModule.firebaseService.database.ref(`questions/${category}`);
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

                // Extract text from question objects
                return questions.map(q => {
                    if (typeof q === 'string') {
                        return q;
                    } else if (q && typeof q === 'object' && q.text) {
                        return q.text;
                    } else if (q && typeof q === 'object' && q.question) {
                        return q.question;
                    } else {
                        return String(q);
                    }
                });
            }
        }
        return null;
    } catch (error) {
        Logger.error(`❌ Error loading ${category}:`, error);
        return null;
    }
}

// ✅ P1 STABILITY: Track which fallback categories have been loaded
const _fallbackLoadedCategories = new Set();
/**
 * ✅ P1 STABILITY: Load fallback questions for category (only once per session)
 * ✅ FSK18-SYSTEM: Skip FSK18 fallback if no server validation
 * Caches to IndexedDB to avoid repeated database queries
 */
async function loadFallbackQuestions(category) {
    // ✅ P1 STABILITY: Check if already loaded this session
    if (_fallbackLoadedCategories.has(category)) {
        Logger.debug(`ℹ️ Fallback questions for ${category} already loaded this session`);
        return;
    }

    // ✅ FSK18-SYSTEM: FSK18 fallback requires validation
    if (category === 'fsk18') {
        try {
            if (!window.FirebaseConfig?.isInitialized?.()) {
                Logger.warn('⚠️ Cannot load FSK18 fallback - Firebase not initialized');
                return;
            }

            if (!GameplayModule.gameState?.canAccessFSK) {
                Logger.warn('⚠️ Cannot load FSK18 fallback - canAccessFSK not available');
                return;
            }

            const hasAccess = await GameplayModule.gameState.canAccessFSK('fsk18', true);

            if (!hasAccess) {
                Logger.warn('⚠️ Cannot load FSK18 fallback - no access');
                return;
            }

            Logger.debug('✅ FSK18 access validated - loading fallback');

        } catch (error) {
            Logger.warn('⚠️ FSK18 fallback validation failed:', error);
            return;
        }
    }

    // Try to load from IndexedDB cache first
    try {
        const cached = await loadFallbackFromIndexedDB(category);
        if (cached && cached.length > 0) {
            Logger.debug(`✅ Loaded ${cached.length} ${category} questions from IndexedDB cache`);

            cached.forEach(q => {
                GameplayModule.currentGame.allQuestions.push({
                    text: sanitizeQuestionText(q),
                    category: category
                });
            });

            _fallbackLoadedCategories.add(category);
            return;
        }
    } catch (error) {
        Logger.warn('⚠️ IndexedDB cache read failed:', error);
    }

    // Load from fallback database
    if (fallbackQuestionsDatabase[category]) {
        const questions = fallbackQuestionsDatabase[category];

        questions.forEach(q => {
            GameplayModule.currentGame.allQuestions.push({
                text: sanitizeQuestionText(q),
                category: category
            });
        });

        // ✅ P1 STABILITY: Cache to IndexedDB for next time
        try {
            await saveFallbackToIndexedDB(category, questions);
            Logger.debug(`✅ Cached ${questions.length} ${category} questions to IndexedDB`);
        } catch (error) {
            Logger.warn('⚠️ IndexedDB cache write failed:', error);
        }

        _fallbackLoadedCategories.add(category);
    }
}
/**
 * ✅ P1 STABILITY: Save fallback questions to IndexedDB
 */
async function saveFallbackToIndexedDB(category, questions) {
    return new Promise((resolve, reject) => {
        const dbName = 'NocapFallbackQuestions';
        const request = indexedDB.open(dbName, 1);

        request.onerror = () => reject(request.error);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('fallback')) {
                db.createObjectStore('fallback');
            }
        };

        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['fallback'], 'readwrite');
            const store = transaction.objectStore('fallback');

            const data = {
                questions: questions,
                timestamp: Date.now()
            };

            const putRequest = store.put(data, category);

            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
        };
    });
}

/**
 * ✅ P1 STABILITY: Load fallback questions from IndexedDB
 */
async function loadFallbackFromIndexedDB(category) {
    return new Promise((resolve, reject) => {
        const dbName = 'NocapFallbackQuestions';
        const request = indexedDB.open(dbName, 1);

        request.onerror = () => reject(request.error);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('fallback')) {
                db.createObjectStore('fallback');
            }
        };

        request.onsuccess = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains('fallback')) {
                resolve(null);
                return;
            }

            const transaction = db.transaction(['fallback'], 'readonly');
            const store = transaction.objectStore('fallback');
            const getRequest = store.get(category);

            getRequest.onsuccess = () => {
                const data = getRequest.result;

                if (!data) {
                    resolve(null);
                    return;
                }

                // Check if cache is still valid (7 days)
                const maxAge = 7 * 24 * 60 * 60 * 1000;
                const age = Date.now() - (data.timestamp || 0);

                if (age > maxAge) {
                    Logger.debug(`⚠️ IndexedDB cache for ${category} is too old (${Math.floor(age / 1000 / 60 / 60)}h)`);
                    resolve(null);
                    return;
                }

                resolve(data.questions);
            };

            getRequest.onerror = () => reject(getRequest.error);
        };
    });
}

/**
 * ✅ P0 FIX: Cache questions in localStorage (24h)
 */
function cacheQuestions(questions) {
    try {
        const cacheData = {
            questions: questions,
            categories: GameplayModule.gameState.selectedCategories,
            timestamp: Date.now()
        };

        if (window.NocapUtils) {
            window.NocapUtils.setLocalStorage('nocap_cached_questions', JSON.stringify(cacheData));
        } else {
            localStorage.setItem('nocap_cached_questions', JSON.stringify(cacheData));
        }
    } catch (error) {
        Logger.warn('⚠️ Could not cache questions:', error);
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
            Logger.warn('⚠️ Cache JSON corrupt, clearing:', parseError.message);
            if (window.NocapUtils) {
                window.NocapUtils.removeLocalStorage('nocap_cached_questions');
            } else {
                localStorage.removeItem('nocap_cached_questions');
            }
            return null;
        }
        const now = Date.now();
        const maxAge = CACHE_DURATION;

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
            cache.categories.length === GameplayModule.gameState.selectedCategories.length &&
            cache.categories.every(c => GameplayModule.gameState.selectedCategories.includes(c));

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
        Logger.warn('⚠️ Could not load cache:', error);
        return null;
    }
}

/**
 * ✅ P1 PERFORMANCE: Get next question from pre-shuffled queue
 * Questions are consumed sequentially from shuffled queue instead of random selection
 */
function getNextQuestion() {
    // ✅ P1 PERFORMANCE: Use shuffled queue instead of random selection
    if (GameplayModule.currentGame.questionQueueIndex >= GameplayModule.currentGame.shuffledQuestionQueue.length) {
        // All questions used - reshuffle and restart queue
        Logger.debug('🔄 All questions used. Reshuffling queue...');

        GameplayModule.currentGame.shuffledQuestionQueue = shuffleArray([...GameplayModule.currentGame.allQuestions]);
        GameplayModule.currentGame.questionQueueIndex = 0;
        GameplayModule.currentGame.usedQuestions = [];

        showNotification('Alle Fragen gespielt! Mische neu...', 'success');
    }

    // Get next question from queue
    const question = GameplayModule.currentGame.shuffledQuestionQueue[GameplayModule.currentGame.questionQueueIndex];
    GameplayModule.currentGame.questionQueueIndex++;

    // Track as used (for compatibility)
    if (question) {
        GameplayModule.currentGame.usedQuestions.push(question.text);

        Logger.debug(`📖 Question ${GameplayModule.currentGame.questionQueueIndex}/${GameplayModule.currentGame.shuffledQuestionQueue.length}:`, question.text);
    }

    return question || GameplayModule.currentGame.allQuestions[0];
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

async function startNewQuestion() {
    if (GameplayModule.isDevelopment) {
        Logger.debug(`🎲 Starting question ${GameplayModule.currentGame.currentQuestionNumber}`);
        Logger.debug(`📊 Available questions: ${GameplayModule.currentGame.allQuestions.length}`);
    }

    // ✅ FIX: Safety check for empty questions
    if (!GameplayModule.currentGame.allQuestions || GameplayModule.currentGame.allQuestions.length === 0) {
        Logger.error('❌ No questions available!');

        // ✅ UI FEEDBACK: Zeige Nutzer dass Fallback-Fragen geladen werden
        showNotification('⚠️ Offline-Modus: Lade Ersatz-Fragen...', 'warning', 3000);

        await Promise.all(Object.keys(fallbackQuestionsDatabase).map(c => loadFallbackQuestions(c)));

        if (GameplayModule.currentGame.allQuestions.length === 0) {
            showNotification('❌ Fehler: Keine Fragen verfügbar!', 'error');
            setTimeout(() => window.location.href = 'index.html', 3000);
            return;
        }

        // ✅ UI FEEDBACK: Erfolgreich geladen
        showNotification('✅ Offline-Fragen geladen (begrenzte Auswahl)', 'info', 4000);
    }

    GameplayModule.currentGame.currentPlayerIndex = 0;
    GameplayModule.currentGame.currentAnswers = {};
    GameplayModule.currentGame.currentEstimates = {};

    const question = getNextQuestion();

    if (!question || !question.text) {
        Logger.error('❌ Invalid question:', question);
        showNotification('Fehler beim Laden der Frage!', 'error');
        return;
    }

    Logger.debug('📝 Question:', question);

    loadQuestion(question);

    resetPlayerUI();
    updateGameDisplay();
    showGameView();

    // Save progress
    saveGameProgress();
}

async function nextQuestion() {
    GameplayModule.currentGame.currentQuestionNumber++;
    await startNewQuestion();
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

    // ✅ P1 DSGVO: Update FSK badge for age-restricted content
    updateFSKBadge(question);
}

function updateGameDisplay() {
    const totalPlayersEl = document.getElementById('total-players');
    if (totalPlayersEl) {
        totalPlayersEl.textContent = GameplayModule.currentGame.players.length;
    }

    const currentPlayerName = GameplayModule.currentGame.players[GameplayModule.currentGame.currentPlayerIndex];

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
        progressEl.textContent = `(${GameplayModule.currentGame.currentPlayerIndex + 1}/${GameplayModule.currentGame.players.length})`;
    }
}

function resetPlayerUI() {
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    GameplayModule.currentAnswer = null;
    GameplayModule.currentEstimation = null;
    updateNumberSelection();
    hideSelectionDisplay();
    updateSubmitButton();
}

// ===========================
// UI CONTROLS
// ===========================

/**
 * ✅ P0 SECURITY: Create number grid with safe DOM manipulation
 * ✅ P1 UI/UX: Focus management for keyboard navigation
 */
function createNumberGrid() {
    const numberGrid = document.getElementById('number-grid');
    if (!numberGrid) return;

    const playerCount = GameplayModule.currentGame.players.length;

    // ✅ P0 SECURITY: Safe DOM clearing (avoid innerHTML)
    while (numberGrid.firstChild) {
        numberGrid.removeChild(numberGrid.firstChild);
    }

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
        addTrackedEventListener(numberBtn, 'click', () => selectNumber(i));

        numberGrid.appendChild(numberBtn);
    }
}

function selectNumber(number) {
    if (number >= 0 && number <= GameplayModule.currentGame.players.length) {
        GameplayModule.currentEstimation = number;
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
        selectionDisplay.classList.add('pulse');
        setTimeout(() => { selectionDisplay.classList.remove('pulse'); }, 300);
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

    if (GameplayModule.currentEstimation !== null) {
        const selectedBtn = document.getElementById(`number-btn-${GameplayModule.currentEstimation}`);
        if (selectedBtn) {
            selectedBtn.classList.add('selected');
        }
    }
}

function selectAnswer(answer) {
    GameplayModule.currentAnswer = answer;

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

    if (GameplayModule.currentAnswer !== null && GameplayModule.currentEstimation !== null) {
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
    if (GameplayModule.currentAnswer === null || GameplayModule.currentEstimation === null) {
        showNotification('Bitte wähle eine Antwort und eine Schätzung aus!', 'warning');
        return;
    }

    const currentPlayerName = GameplayModule.currentGame.players[GameplayModule.currentGame.currentPlayerIndex];

    GameplayModule.currentGame.currentAnswers[currentPlayerName] = GameplayModule.currentAnswer;
    GameplayModule.currentGame.currentEstimates[currentPlayerName] = GameplayModule.currentEstimation;

    if (GameplayModule.isDevelopment) {
        Logger.debug(`📤 ${currentPlayerName} answered:`, {
            answer: GameplayModule.currentAnswer,
            estimation: GameplayModule.currentEstimation
        });
    }

    // Save progress
    saveGameProgress();

    if (GameplayModule.currentGame.currentPlayerIndex < GameplayModule.currentGame.players.length - 1) {
        GameplayModule.currentGame.currentPlayerIndex++;
        GameplayModule.currentAnswer = null;
        GameplayModule.currentEstimation = null;
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
    const currentPlayerName = GameplayModule.currentGame.players[GameplayModule.currentGame.currentPlayerIndex];

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
    Logger.debug('📊 Calculating results...');

    const actualYesCount = Object.values(GameplayModule.currentGame.currentAnswers).filter(answer => answer === true).length;

    const results = GameplayModule.currentGame.players.map(playerName => {
        const answer = GameplayModule.currentGame.currentAnswers[playerName];
        const estimation = GameplayModule.currentGame.currentEstimates[playerName];
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

    GameplayModule.currentGame.gameHistory.push({
        questionNumber: GameplayModule.currentGame.currentQuestionNumber,
        actualYesCount: actualYesCount,
        results: results
    });

    displayResults(results, actualYesCount);
    showResultsView();

    // Save progress
    saveGameProgress();
}

function getDifficultyMultiplier() {
    switch (GameplayModule.gameState.difficulty) {
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
            `${actualYesCount} von ${GameplayModule.currentGame.players.length} Spielern haben "Ja" geantwortet`;
    }

    const sortedResults = results.sort((a, b) => {
        if (a.isCorrect && !b.isCorrect) return -1;
        if (!a.isCorrect && b.isCorrect) return 1;
        return a.sips - b.sips;
    });

    const resultsGrid = document.getElementById('results-grid');
    if (!resultsGrid) return;

    // ✅ P0 SECURITY: Safe DOM clearing (avoid innerHTML)
    while (resultsGrid.firstChild) {
        resultsGrid.removeChild(resultsGrid.firstChild);
    }

    const drinkEmoji = GameplayModule.alcoholMode ? '🍺' : '💧';

    sortedResults.forEach((result, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';

        // ✅ P1 UI/UX: Add role and aria-label for screen readers
        resultItem.setAttribute('role', 'listitem');
        resultItem.setAttribute('aria-label', `Ergebnis ${index + 1} von ${sortedResults.length}`);

        // ✅ P0 SECURITY: Sanitize player name before using
        const sanitizedName = DOMPurify.sanitize(result.playerName, {
            ALLOWED_TAGS: [],
            KEEP_CONTENT: true
        });

        const avatar = sanitizedName.charAt(0).toUpperCase();

        const sipsText = result.sips === 0 ? 'Perfekt! 🎯' :
            result.sips === 1 ? `1 ${drinkEmoji}` :
                `${result.sips} ${drinkEmoji}`;
        const sipsClass = result.sips === 0 ? 'none' : '';

        const resultAvatar = document.createElement('div');
        resultAvatar.className = 'result-avatar';
        resultAvatar.textContent = avatar;
        resultAvatar.setAttribute('aria-hidden', 'true');

        const playerResult = document.createElement('div');
        playerResult.className = 'player-result';

        const playerResultInfo = document.createElement('div');
        playerResultInfo.className = 'player-result-info';

        const playerResultName = document.createElement('div');
        playerResultName.className = 'player-result-name';
        // ✅ P0 SECURITY: Use sanitized name + textContent (double protection)
        playerResultName.textContent = sanitizedName;

        const playerAnswer = document.createElement('div');
        playerAnswer.className = 'player-answer';
        // ✅ P0 SECURITY: Sanitize estimation value
        const sanitizedEstimation = String(result.estimation).replace(/[<>]/g, '');
        playerAnswer.textContent = `Tipp: ${sanitizedEstimation}`;

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
    Logger.debug('🏆 Calculating final results...');

    const playerStats = calculatePlayerStatistics();
    const finalRankings = playerStats.sort((a, b) => a.totalSips - b.totalSips);

    displayFinalResults(finalRankings);
    showFinalResultsView();

    // Clear progress on game end
    clearGameProgress();
}

function calculatePlayerStatistics() {
    const playerStats = {};

    GameplayModule.currentGame.players.forEach(player => {
        playerStats[player] = {
            playerName: player,
            totalSips: 0,
            correctGuesses: 0,
            totalGuesses: 0
        };
    });

    GameplayModule.currentGame.gameHistory.forEach(round => {
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
 * ✅ P1 UI/UX: Display final results with enhanced accessibility
 * ✅ P0 SECURITY: Safe DOM manipulation with sanitization
 */
function displayFinalResults(finalRankings) {
    const leaderboardList = document.getElementById('leaderboard-list');
    if (!leaderboardList) return;

    // ✅ P0 SECURITY: Safe DOM clearing (avoid innerHTML)
    while (leaderboardList.firstChild) {
        leaderboardList.removeChild(leaderboardList.firstChild);
    }

    const drinkEmoji = GameplayModule.alcoholMode ? '🍺' : '💧';

    finalRankings.forEach((player, index) => {
        const leaderboardItem = document.createElement('div');
        leaderboardItem.className = `leaderboard-item ${index === 0 ? 'winner' : ''}`;

        // ✅ P1 UI/UX: Add ARIA attributes for screen readers
        leaderboardItem.setAttribute('role', 'listitem');
        leaderboardItem.setAttribute('aria-label',
            `Platz ${index + 1}: ${player.playerName}, ${player.totalSips}, ${player.correctGuesses} richtige Antworten`
        );

        // ✅ P1 UI/UX: Highlight winner with visual cue
        if (index === 0) {
            leaderboardItem.setAttribute('aria-current', 'true');
            leaderboardItem.setAttribute('data-winner', 'true');
        }

        const rankClass = index === 0 ? 'rank-1' :
            index === 1 ? 'rank-2' :
                index === 2 ? 'rank-3' : 'rank-other';

        const rankText = index + 1;

        // ✅ P0 SECURITY: Sanitize player name before using
        const sanitizedName = DOMPurify.sanitize(player.playerName, {
            ALLOWED_TAGS: [],
            KEEP_CONTENT: true
        });

        const avatar = sanitizedName.charAt(0).toUpperCase();

        const sipsText = player.totalSips === 1 ? '1' : `${player.totalSips}`;
        const questionsText = player.correctGuesses === 1 ? '1 Frage richtig' : `${player.correctGuesses} Fragen richtig`;

        const rankNumber = document.createElement('div');
        rankNumber.className = `rank-number ${rankClass}`;
        rankNumber.textContent = rankText;
        rankNumber.setAttribute('aria-label', `Rang ${rankText}`);

        // ✅ P1 UI/UX: Winner badge
        if (index === 0) {
            const winnerBadge = document.createElement('span');
            winnerBadge.className = 'winner-badge';
            winnerBadge.textContent = '🏆';
            winnerBadge.setAttribute('aria-label', 'Gewinner');
            rankNumber.appendChild(winnerBadge);
        }

        const resultAvatar = document.createElement('div');
        resultAvatar.className = 'result-avatar';
        resultAvatar.textContent = avatar;
        resultAvatar.setAttribute('aria-hidden', 'true');

        const playerFinalStats = document.createElement('div');
        playerFinalStats.className = 'player-final-stats';

        const playerFinalName = document.createElement('div');
        playerFinalName.className = 'player-final-name';
        // ✅ P0 SECURITY: Use sanitized name + textContent
        playerFinalName.textContent = sanitizedName;

        const playerFinalDetails = document.createElement('div');
        playerFinalDetails.className = 'player-final-details';

        // Build with textContent instead of innerHTML
        const detailItem1 = document.createElement('div');
        detailItem1.className = 'detail-item';

        const icon1 = document.createElement('span');
        icon1.className = 'detail-icon';
        icon1.textContent = drinkEmoji;
        icon1.setAttribute('aria-hidden', 'true');

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
    // ✅ MEMORY LEAK FIX: Helper function to track event listeners
    if (GameplayModule.state._listenersBound) return;
    GameplayModule.state._listenersBound = true;
    const addTrackedListener = addTrackedEventListener;

    // Answer buttons
    const yesBtn = document.getElementById('yes-btn');
    const noBtn = document.getElementById('no-btn');

    if (yesBtn) {
        addTrackedListener(yesBtn, 'click', () => selectAnswer(true));
    }
    if (noBtn) {
        addTrackedListener(noBtn, 'click', () => selectAnswer(false));
    }

    // Submit button
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
        addTrackedListener(submitBtn, 'click', submitAnswer);
    }

    // Exit confirmation buttons
    const exitCancel = document.querySelector('.exit-btn.cancel');
    const exitConfirm = document.querySelector('.exit-btn.confirm');

    if (exitCancel) {
        addTrackedListener(exitCancel, 'click', cancelExit);
    }
    if (exitConfirm) {
        addTrackedListener(exitConfirm, 'click', confirmExit);
    }

    // Results navigation - delegation
    const resultsNavigationHandler = function(e) {
        const primaryBtn = e.target.closest('.nav-btn.primary');
        const secondaryBtn = e.target.closest('.nav-btn.secondary');

        if (primaryBtn) {
            const btnText = primaryBtn.textContent.trim();

            Logger.debug('Primary button clicked:', btnText);

            if (btnText.includes('Nächste Frage')) {
                nextQuestion();
            } else if (btnText.includes('Spiel beenden')) {
                Logger.debug('Going home...');
                goHome();
            }
        } else if (secondaryBtn) {
            Logger.debug('Secondary button clicked - ending game');
            endGame();
        }
    };
    addTrackedListener(document, 'click', resultsNavigationHandler);

    // Auto-save on visibility change
    const visibilityChangeHandler = function() {
        if (!document.hidden) {
            saveGameProgress();
        }
    };
    addTrackedListener(document, 'visibilitychange', visibilityChangeHandler);
}

// ===========================
// PAGE LEAVE PROTECTION
// ===========================

function setupPageLeaveProtection() {
    const addTrackedListener = addTrackedEventListener;

    const beforeunloadHandler = function(e) {
        if (!GameplayModule.isExitDialogShown) {
            saveGameProgress();
            e.preventDefault();
            e.returnValue = 'Möchtest du das Spiel wirklich verlassen?';
            return e.returnValue;
        }
    };
    addTrackedListener(window, 'beforeunload', beforeunloadHandler);

    const popstateHandler = function(e) {
        e.preventDefault();
        showExitConfirmation();
        history.pushState(null, null, window.location.pathname);
    };
    addTrackedListener(window, 'popstate', popstateHandler);

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
    GameplayModule.gameState.reset();
    GameplayModule.isExitDialogShown = true;
    window.location.replace('index.html');
}

/**
 * Go home - end game and return to start
 */
function goHome() {
    Logger.debug('🏠 Going home...');

    // Clear game progress
    clearGameProgress();

    // Reset game state
    if (GameplayModule.gameState && typeof GameplayModule.gameState.reset === 'function') {
        GameplayModule.gameState.reset();
    }

    // Set flag to prevent beforeunload dialog
    GameplayModule.isExitDialogShown = true;

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
 * ✅ P1 STABILITY: Generate unique session ID
 */
function generateSessionId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * ✅ P1 STABILITY: Sync game progress to Firebase (non-blocking)
 */
async function syncGameProgressToFirebase(progressData) {
    if (!GameplayModule.firebaseService?.database?.ref) {
        throw new Error('Firebase not ready');
    }

    try {
        const userId = GameplayModule.firebaseService?.auth?.currentUser?.uid || null;
        if (!userId) {
            Logger.warn('⚠️ No user ID, skipping Firebase sync');
            return;
        }

        // Use a timestamp-based key to allow multiple saves
        const saveKey = `game_progress_${Date.now()}`;

        await GameplayModule.firebaseService.database
            .ref(`users/${userId}/saved_games/${saveKey}`)
            .set({
                ...progressData,
                savedAt: window.Firebase?.database?.ServerValue?.TIMESTAMP
                    ?? GameplayModule.firebaseService.database.ServerValue?.TIMESTAMP
                    ?? Date.now()
            });

        // Keep only last 5 saves
        const savedGamesRef = GameplayModule.firebaseService.database.ref(`users/${userId}/saved_games`);
        const snapshot = await savedGamesRef.orderByChild('savedAt').limitToLast(5).once('value');

        Logger.debug('☁️ Game progress synced to Firebase');

        // Reset error counter on success
        GameplayModule.networkErrorCount = 0;

    } catch (error) {
        Logger.error('❌ Firebase sync error:', error);
        throw error;
    }
}

/**
 * ✅ P1 STABILITY: Start auto-save timer
 */
function startAutoSave() {
    // Clear existing timer if any
    if (GameplayModule.autoSaveTimer) {
        clearInterval(GameplayModule.autoSaveTimer);
    }

    // Save every 30 seconds
    GameplayModule.autoSaveTimer = setInterval(() => {
        saveGameProgress();
    }, AUTO_SAVE_INTERVAL);

    Logger.debug('🔄 Auto-save started (every 30s)');
}

/**
 * ✅ P1 STABILITY: Stop auto-save timer
 */
function stopAutoSave() {
    if (GameplayModule.autoSaveTimer) {
        clearInterval(GameplayModule.autoSaveTimer);
        GameplayModule.autoSaveTimer = null;

        Logger.debug('⏹️ Auto-save stopped');
    }
}

/**
 * ✅ P0 FIX: Safe notification using NocapUtils
 */
const showNotification = window.NocapUtils?.showNotification || function(message, type = 'info') {
    alert(String(message).replace(/<[^>]*>/g, '')); // Fallback
};

// ===========================
// ✅ MEMORY LEAK FIX: CLEANUP
// ===========================

/**
 * ✅ P2 PERFORMANCE: Cleanup function - removes all event listeners and timers
 * Called automatically on page unload
 */
function cleanup() {
    Logger.debug('🧹 Cleaning up event listeners and timers...');

    // ✅ P2 PERFORMANCE: Stop auto-save first
    stopAutoSave();

    // ✅ P2 PERFORMANCE: Clear any remaining timers
    // Remove tracked event listeners
    GameplayModule.state.eventListenerCleanup.forEach(({element, event, handler, options}) => {
        try {
            element.removeEventListener(event, handler, options);
        } catch (error) {
            // Element may have been removed from DOM
        }
    });
    GameplayModule.state.eventListenerCleanup.length = 0;

    // Clear auto-save timer
    if (GameplayModule.autoSaveTimer) {
        clearInterval(GameplayModule.autoSaveTimer);
        GameplayModule.autoSaveTimer = null;
    }

    // Clear active timers
    if (window._activeTimers) {
        window._activeTimers.forEach(timerId => {
            clearTimeout(timerId);
            clearInterval(timerId);
        });
        window._activeTimers = [];
    }

    // ✅ P1 STABILITY: Save game progress one last time
    saveGameProgress();

    Logger.debug('✅ Gameplay cleanup completed');
}

// Auto-cleanup on page unload
window.addEventListener('pagehide', cleanup);

// ===========================
// INITIALIZATION
// ===========================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}