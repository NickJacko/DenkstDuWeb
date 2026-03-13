/**
 * No-Cap Multiplayer Gameplay
 * Version 3.1 - BUGFIX: Module Pattern & addEventListener
 *
 * CRITICAL: Complex 4-phase gameplay with Firebase real-time synchronization
 * - Phase 1: Question & Answer
 * - Phase 2: Waiting for others
 * - Phase 3: Round Results
 * - Phase 4: Overall Results
 */

(function(window) {
    'use strict';


    const Logger = window.NocapUtils?.Logger || {
        debug: (...args) => {},
        info: (...args) => {},
        warn: console.warn,
        error: console.error
    };

    const MultiplayerGameplayModule = {
        state: {
            gameState: null,
            firebaseService: null,
            eventListenerCleanup: [],
            isDevelopment: window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('192.168.')
        },

        get gameState() { return this.state.gameState; },
        set gameState(val) { this.state.gameState = val; },

        get firebaseService() { return this.state.firebaseService; },
        set firebaseService(val) { this.state.firebaseService = val; },

        get isDevelopment() { return this.state.isDevelopment; }
    };

    Object.seal(MultiplayerGameplayModule.state);

    function throttle(func, wait = 100) {
        let timeout = null;
        let previous = 0;
        return function(...args) {
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
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function addTrackedEventListener(el, evt, handler, opts = {}) {
        if (!el) return;
        el.addEventListener(evt, handler, opts);
        MultiplayerGameplayModule.state.eventListenerCleanup.push({
            element: el,
            event: evt,
            handler,
            options: opts
        });
    }

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
    let gameListener = null;
    let roundListener = null;
    let roundListenerRef = null; // Store the Firebase ref for proper cleanup
    let currentGameData = null;
    let currentRoundData = null;
    let currentPlayers = {};
    let currentQuestion = null;
    let userAnswer = null;
    let userEstimation = null;
    let totalPlayers = 0;
    let currentQuestionNumber = 0;
    let currentPhase = 'question';
    let hasSubmittedThisRound = false; // P0: Anti-cheat
    let timerSyncRef = null;
    let timerSyncCb = null;

    let connectedRef = null;
    let connectedCb = null;

    // Overall stats tracking
    let overallStats = {
        totalRounds: 0,
        playerStats: {}
    };

    // ✅ P2 PERFORMANCE: Track event listeners for cleanup
    const _phaseListeners = new Map(); // Listeners specific to each phase

    // ✅ P1 STABILITY: Reconnection and offline support
    let connectionState = 'connected';
    let reconnectAttempts = 0;
    let maxReconnectAttempts = 5;
    let offlineGameState = null; // Cached state for reconnection

    // ✅ P1 UI/UX: Timer management with server sync
    let questionTimer = null;
    let timerAnimationFrame = null;
    let timerStartTime = null;
    let timerDuration = 30000; // 30 seconds default (ms internally)
    let isPaused = false;
    let pausedTimeRemaining = 0;

    // ✅ P1 DSGVO: Data cleanup tracking
    let answerCleanupScheduled = false;
    const ANSWER_RETENTION_TIME = 10 * 60 * 1000; // 10 minutes (safe margin after round ends)

    

    // ===========================
    // ✅ P1 STABILITY: ERROR HANDLING
    // ===========================

    /**
     * ✅ P1 STABILITY: Monitor Firebase connection status
     */
    function setupConnectionMonitoring() {
        const _db = window.FirebaseConfig?.getFirebaseInstances?.()?.database;
        if (!_db?.ref) return;
        connectedRef = _db.ref('.info/connected');
        connectedCb = (snapshot) => {
            if (snapshot.val() === true) {
                if (connectionState === 'disconnected') {
                    console.log('✅ Reconnected to Firebase');
                    handleReconnection();
                }
                connectionState = 'connected';
                reconnectAttempts = 0;
                updateConnectionUI(true);
            } else {
                console.warn('⚠️ Disconnected from Firebase');
                connectionState = 'disconnected';
                handleDisconnection();
                updateConnectionUI(false);
            }
        };
        connectedRef.on('value', connectedCb);
    }

    /**
     * ✅ P1 STABILITY: Handle disconnection - save state offline
     */
    function handleDisconnection() {
        // Cache current game state for recovery
        offlineGameState = {
            gameId: MultiplayerGameplayModule.gameState.gameId,
            playerId: MultiplayerGameplayModule.gameState.playerId,
            playerName: MultiplayerGameplayModule.gameState.playerName,
            isHost: MultiplayerGameplayModule.gameState.isHost,
            currentQuestionNumber,
            currentPhase,
            userAnswer,
            userEstimation,
            hasSubmittedThisRound,
            currentQuestion,
            timestamp: Date.now()
        };

        // Save to localStorage
        if (window.NocapUtils && window.NocapUtils.setLocalStorage) {
            window.NocapUtils.setLocalStorage('nocap_offline_state', offlineGameState);
        } else {
            try {
                localStorage.setItem('nocap_offline_state', JSON.stringify(offlineGameState));
            } catch (e) {
                console.warn('⚠️ Could not save offline state:', e);
            }
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('💾 Offline state saved:', offlineGameState);
        }

        showNotification('Verbindung unterbrochen - Daten werden lokal gespeichert', 'warning', 5000);
    }

    /**
     * ✅ P1 STABILITY: Handle reconnection - restore state
     */
    async function handleReconnection() {
        showNotification('Verbindung wiederhergestellt! Synchronisiere...', 'info', 3000);

        // Try to restore from cached state
        if (!offlineGameState) {
            // Load from localStorage
            if (window.NocapUtils && window.NocapUtils.getLocalStorage) {
                offlineGameState = window.NocapUtils.getLocalStorage('nocap_offline_state');
            } else {
                try {
                    const stored = localStorage.getItem('nocap_offline_state');
                    if (stored) {
                        offlineGameState = JSON.parse(stored);
                    }
                } catch (e) {
                    console.warn('⚠️ Could not load offline state:', e);
                }
            }
        }

        if (offlineGameState) {
            // Check if state is still valid (less than 10 minutes old)
            const age = Date.now() - offlineGameState.timestamp;
            if (age < 10 * 60 * 1000) {
                // Restore state
                currentQuestionNumber = offlineGameState.currentQuestionNumber;
                currentPhase = offlineGameState.currentPhase;
                userAnswer = offlineGameState.userAnswer;
                userEstimation = offlineGameState.userEstimation;
                hasSubmittedThisRound = offlineGameState.hasSubmittedThisRound;
                currentQuestion = offlineGameState.currentQuestion;

                if (MultiplayerGameplayModule.isDevelopment) {
                    console.log('✅ Restored from offline state:', offlineGameState);
                }

                // Reload current round from Firebase
                await loadRoundFromFirebase(currentQuestionNumber);

                // Restore UI
                updateGameDisplay();
                showPhase(currentPhase);

                showNotification('Spielstand wiederhergestellt! ✅', 'success', 3000);
            } else {
                console.warn('⚠️ Offline state too old, discarding');
                offlineGameState = null;
            }
        }

        // Clear offline state
        if (window.NocapUtils && window.NocapUtils.removeLocalStorage) {
            window.NocapUtils.removeLocalStorage('nocap_offline_state');
        } else {
            try {
                localStorage.removeItem('nocap_offline_state');
            } catch (e) {
                console.warn('[WARNING] Could not remove offline state from localStorage:', e.message);
            }
        }
    }

    /**
     * ✅ P1 UI/UX: Update connection indicator
     */
    function updateConnectionUI(isConnected) {
        const indicator = document.getElementById('connection-indicator');
        if (!indicator) return;

        if (isConnected) {
            indicator.classList.remove('disconnected');
            indicator.classList.add('connected');
            indicator.textContent = '🟢 Verbunden';
            indicator.setAttribute('aria-label', 'Mit Server verbunden');
        } else {
            indicator.classList.remove('connected');
            indicator.classList.add('disconnected');
            indicator.textContent = '🔴 Offline';
            indicator.setAttribute('aria-label', 'Vom Server getrennt');
        }
    }

    /**
     * ✅ P1 STABILITY: Handle Firebase errors with user-friendly UI feedback
     * @param {Error} error - The error object
     * @param {string} operation - Description of the operation that failed
     * @param {boolean} fatal - Whether this is a fatal error (redirects to lobby)
     */
    function handleFirebaseError(error, operation = 'Firebase operation', fatal = false) {
        console.error(`❌ ${operation} failed:`, error);

        // Get user-friendly error message
        const message = getFirebaseErrorMessage(error, operation);

        // Show notification to user
        if (window.NocapUtils && window.NocapUtils.showNotification) {
            window.NocapUtils.showNotification(message, 'error', fatal ? 10000 : 5000);
        } else {
            alert(message);
        }

        // Log to telemetry if available
        if (window.NocapUtils && window.NocapUtils.logError && !MultiplayerGameplayModule.isDevelopment) {
            window.NocapUtils.logError('MultiplayerGameplay', error, {
                operation,
                gameId: MultiplayerGameplayModule.gameState.gameId,
                isHost: MultiplayerGameplayModule.gameState.isHost
            });
        }

        // Handle fatal errors
        if (fatal) {
            setTimeout(() => {
                window.location.href = '/multiplayer-lobby.html';
            }, 3000);
        }
    }

    /**
     * Get user-friendly error message for Firebase errors
     */
    function getFirebaseErrorMessage(error, operation) {
        const errorCode = error?.code || '';

        const messages = {
            'PERMISSION_DENIED': 'Keine Berechtigung für diese Aktion',
            'permission-denied': 'Keine Berechtigung für diese Aktion',
            'NETWORK_ERROR': 'Netzwerkfehler - Prüfe deine Internetverbindung',
            'network-request-failed': 'Netzwerkfehler - Prüfe deine Internetverbindung',
            'TIMEOUT': `${operation} dauert zu lange`,
            'timeout': `${operation} dauert zu lange`,
            'NOT_FOUND': 'Spiel nicht gefunden',
            'not-found': 'Spiel nicht gefunden',
            'UNAVAILABLE': 'Firebase nicht verfügbar',
            'unavailable': 'Firebase nicht verfügbar'
        };

        return messages[errorCode] || `${operation} fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`;
    }

    // ===========================
    // P0 FIX: INPUT SANITIZATION
    // ===========================

    /**
     * ✅ P0 SECURITY: Sanitize with DOMPurify (required for XSS protection)
     * @param {string} input - The input to sanitize
     * @param {boolean} allowHtml - Whether to allow safe HTML (default: false)
     * @returns {string} Sanitized text
     */
    function sanitizeWithDOMPurify(input, allowHtml = false) {
        if (!input) return '';

        if (typeof DOMPurify === 'undefined') {
            console.error('❌ CRITICAL: DOMPurify not available!');
            // Fallback to aggressive stripping
            return String(input).replace(/<[^>]*>/g, '').substring(0, 500);
        }

        if (allowHtml) {
            // Allow only safe HTML tags
            return DOMPurify.sanitize(input, {
                ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span'],
                ALLOWED_ATTR: []
            });
        }

        // Strip all HTML
        return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
    }

    function sanitizeText(input) {
        if (!input) return '';

        // Use DOMPurify first
        const purified = sanitizeWithDOMPurify(input, false);

        // Additional fallback with NocapUtils
        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            return window.NocapUtils.sanitizeInput(purified).substring(0, 500);
        }

        return purified.substring(0, 500);
    }

    function sanitizePlayerName(name) {
        if (!name) return 'Spieler';

        // Use DOMPurify first
        const purified = sanitizeWithDOMPurify(name, false);

        // Additional fallback with NocapUtils
        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            return window.NocapUtils.sanitizeInput(purified).substring(0, 20);
        }

        return purified.substring(0, 20);
    }
    function getPlayerKey() {
        // Always use live auth.uid — must match $uid in DB Rules
        const uid = firebase.auth().currentUser?.uid;
        if (uid) return uid;
        return MultiplayerGameplayModule.gameState?.playerId || null;
    }


    // ===========================
    // INITIALIZATION
    // ===========================

    async function initialize() {
        if (MultiplayerGameplayModule.isDevelopment) {
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
        if (typeof window.GameState === 'undefined') {
            console.error('❌ MultiplayerGameplayModule.gameState not loaded');
            showNotification('Fehler beim Laden', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }
// ✅ Ensure Firebase is initialized (consistent with other pages)
        try {
            if (!window.FirebaseConfig) {
                throw new Error('FirebaseConfig missing - firebase-config.js not loaded?');
            }
            if (!window.FirebaseConfig.isInitialized?.()) {
                await window.FirebaseConfig.initialize();
            }
            if (window.FirebaseConfig.waitForFirebase) {
                await window.FirebaseConfig.waitForFirebase(10000);
            }

        } catch (e) {
            console.error('❌ Firebase not initialized:', e);
            showNotification('Firebase nicht verfügbar', 'error');
            hideLoading();
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }

        // P1 FIX: Wait for dependencies
        if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
            await window.NocapUtils.waitForDependencies(['GameState', 'FirebaseConfig', 'firebase']);
        }

        MultiplayerGameplayModule.gameState = new window.GameState();

        // ✅ CRITICAL FIX: Restore MultiplayerGameplayModule.gameState from multiple sources
        let stateRestored = false;

        // Method 1: Try NocapUtils
        if (window.NocapUtils && window.NocapUtils.getLocalStorage) {
            const savedState = window.NocapUtils.getLocalStorage('nocap_game_state');
            if (savedState && typeof savedState === 'object' && savedState.gameId) {
                if (MultiplayerGameplayModule.isDevelopment) {
                    console.log('🔄 Restoring from NocapUtils:', savedState);
                }
                restoreGameState(savedState);
                stateRestored = true;
            }
        }

        // Method 2: Try direct localStorage
        if (!stateRestored) {
            try {
                const savedStateStr = localStorage.getItem('nocap_game_state');
                if (savedStateStr) {
                    const savedState = JSON.parse(savedStateStr);
                    if (savedState && savedState.gameId) {
                        if (MultiplayerGameplayModule.isDevelopment) {
                            console.log('🔄 Restoring from localStorage:', savedState);
                        }
                        restoreGameState(savedState);
                        stateRestored = true;
                    }
                }
            } catch (e) {
                console.warn('⚠️ Could not parse localStorage:', e);
            }
        }

        // Method 3: Try MultiplayerGameplayModule.gameState's own properties (might be set already)
        if (!stateRestored && MultiplayerGameplayModule.gameState.gameId && MultiplayerGameplayModule.gameState.deviceMode) {
            if (MultiplayerGameplayModule.isDevelopment) {
                console.log('✅ MultiplayerGameplayModule.gameState already initialized');
            }
            stateRestored = true;
        }

        // ✅ FALLBACK: If still no state, try to recover from sessionStorage or URL
        if (!stateRestored) {
            console.warn('⚠️ No saved state found - attempting recovery');

            // Try sessionStorage
            try {
                const sessionState = sessionStorage.getItem('nocap_game_id');
                if (sessionState) {
                    MultiplayerGameplayModule.gameState.gameId = sessionState;
                    MultiplayerGameplayModule.gameState.setDeviceMode('multi');
                    console.log('📝 Recovered gameId from sessionStorage:', sessionState);
                    stateRestored = true;
                }
            } catch (e) {
                console.warn('[WARNING] Could not recover state from sessionStorage:', e.message);
            }

            // Try URL params
            if (!stateRestored) {
                const urlParams = new URLSearchParams(window.location.search);
                const urlGameId = urlParams.get('gameId');
                if (urlGameId) {
                    MultiplayerGameplayModule.gameState.gameId = urlGameId;
                    MultiplayerGameplayModule.gameState.setDeviceMode('multi');
                    console.log('📝 Recovered gameId from URL:', urlGameId);
                    stateRestored = true;
                }
            }
        }

        // ✅ ABSOLUTE FALLBACK: If nothing worked, just set multi mode (will fail validation)
        if (!MultiplayerGameplayModule.gameState.deviceMode) {
            console.warn('⚠️ Setting deviceMode to multi as absolute fallback');
            MultiplayerGameplayModule.gameState.setDeviceMode('multi');
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('✅ MultiplayerGameplayModule.gameState after restore:', {
                deviceMode: MultiplayerGameplayModule.gameState.deviceMode,
                gameId: MultiplayerGameplayModule.gameState.gameId,
                isHost: MultiplayerGameplayModule.gameState.isHost,
                playerId: MultiplayerGameplayModule.gameState.playerId,
                stateRestored: stateRestored
            });
        }

        // Helper function to restore state
        function restoreGameState(savedState) {
            if (savedState.gameId) MultiplayerGameplayModule.gameState.gameId = savedState.gameId;
            if (savedState.playerId) MultiplayerGameplayModule.gameState.playerId = savedState.playerId;
            if (savedState.playerName) MultiplayerGameplayModule.gameState.playerName = savedState.playerName;
            if (savedState.isHost !== undefined) MultiplayerGameplayModule.gameState.isHost = savedState.isHost;
            if (savedState.isGuest !== undefined) MultiplayerGameplayModule.gameState.isGuest = savedState.isGuest;
            if (savedState.gamePhase) MultiplayerGameplayModule.gameState.gamePhase = savedState.gamePhase;
            if (savedState.selectedCategories) MultiplayerGameplayModule.gameState.selectedCategories = savedState.selectedCategories;
            if (savedState.difficulty) MultiplayerGameplayModule.gameState.difficulty = savedState.difficulty;
            if (savedState.deviceMode) MultiplayerGameplayModule.gameState.setDeviceMode(savedState.deviceMode);
        }

        // Validate state
        if (!validateGameState()) {
            hideLoading();
            return;
        }

        // P0 FIX: Use global firebaseGameService
        if (typeof window.FirebaseService !== 'undefined') {
            MultiplayerGameplayModule.firebaseService = window.FirebaseService;

        } else {
            console.error('❌ Firebase service not available');
            showNotification('Firebase nicht verfügbar', 'error');
            hideLoading();
            return;
        }
        // ✅ Ensure auth is ready (otherwise currentUser can be null on first load)
        await new Promise((resolve) => {
            try {
                const unsub = firebase.auth().onAuthStateChanged(() => {
                    try { unsub(); } catch (_) {}
                    resolve();
                });
                // safety timeout
                setTimeout(resolve, 3000);
            } catch (_) {
                resolve();
            }
        });

// ✅ FIX: Recover missing playerId from Firebase Auth (needed after sessionStorage recovery)
        // Wait for auth state to be ready (currentUser can be null during init)
        let authedUser = firebase.auth().currentUser;
        if (!authedUser) {
            try {
                authedUser = await new Promise((resolve) => {
                    const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
                        unsubscribe();
                        resolve(user);
                    });
                    setTimeout(() => resolve(null), 5000); // 5s timeout
                });
            } catch (e) {
                console.warn('⚠️ Auth state wait failed:', e.message);
            }
        }

        if (authedUser && authedUser.uid) {
            MultiplayerGameplayModule.gameState.playerId = authedUser.uid;
        }

        // ✅ FIX: Re-register player in DB if missing (after auth UID change on reload)
        try {
            const u = authedUser;
            if (u && MultiplayerGameplayModule.gameState.gameId) {
                const gameId = MultiplayerGameplayModule.gameState.gameId;

                // Read hostId from DB to determine role correctly
                const hostSnap = await firebase.database()
                    .ref(`games/${gameId}/hostId`).once('value');
                const hostId = hostSnap.val();
                const isHost = hostId === u.uid;

                // Update gameState role now (before setupFirebaseListeners)
                MultiplayerGameplayModule.gameState.isHost = isHost;
                MultiplayerGameplayModule.gameState.isGuest = !isHost;

                const playerRef = firebase.database().ref(`games/${gameId}/players/${u.uid}`);
                const snap = await playerRef.once('value');
                if (!snap.exists()) {
                    await playerRef.set({
                        name: MultiplayerGameplayModule.gameState.playerName || (isHost ? 'Host' : 'Spieler'),
                        playerId: u.uid,
                        isHost,
                        isGuest: !isHost,
                        joinedAt: Date.now(),
                        rejoinedAt: Date.now(),
                        online: true
                    });
                    console.log('✅ Player re-registered in DB as', isHost ? 'host' : 'guest');
                }
            }
        } catch (e) {
            console.warn('⚠️ Re-register failed:', e.message);
        }

        // Setup Firebase listeners
        await setupFirebaseListeners();

        // ✅ P1 STABILITY: Setup connection monitoring
        setupConnectionMonitoring();

        // Initialize UI
        updateGameDisplay();
        createNumberGrid();
        updateSubmitButton();

        // Setup event listeners
        setupEventListeners();

        // Show/hide role-based controls
        updateUIForRole();

        hideLoading();
        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('✅ Gameplay initialized');
        }
    }

    // ===========================
    // VALIDATION
    // ===========================

    function validateGameState() {
        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('🔍 Validating game state...');
        }

        if (!MultiplayerGameplayModule.gameState || MultiplayerGameplayModule.gameState.deviceMode !== 'multi') {
            console.error('❌ Invalid device mode:', MultiplayerGameplayModule.gameState?.deviceMode);
            showNotification('Kein Multiplayer-Spiel aktiv!', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (!MultiplayerGameplayModule.gameState.gameId) {
            console.error('❌ No game ID');
            showNotification('Keine Spiel-ID gefunden!', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        // ✅ FSK18-SYSTEM: Simplified validation - no kick in gameplay
        // Just log warnings about FSK18 content
        try {
            const rawSelected = MultiplayerGameplayModule.gameState.selectedCategories || [];
            const selectedCategories = Array.isArray(rawSelected)
                ? rawSelected
                : (rawSelected ? Object.values(rawSelected) : []);

            const hasFSK18 = selectedCategories.includes('fsk18');

            if (hasFSK18 && MultiplayerGameplayModule.isDevelopment) {
                console.log('🔒 FSK18 content in game - questions will be validated per-question');
            }
        } catch (e) {
            console.warn('⚠️ Could not check categories:', e);
        }

        if (MultiplayerGameplayModule.isDevelopment) {
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

        if (yesBtn) addTrackedEventListener(yesBtn, 'click', () => selectAnswer(true));
        if (noBtn) addTrackedEventListener(noBtn, 'click', () => selectAnswer(false));

        // Submit button
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) {
            addTrackedEventListener(submitBtn, 'click', submitAnswers);
        }

        // Host controls
        const nextQuestionBtn = document.getElementById('next-question-btn');
        if (nextQuestionBtn) {
            addTrackedEventListener(nextQuestionBtn, 'click', nextQuestion);
        }

        const showOverallBtn = document.getElementById('show-overall-btn');
        if (showOverallBtn) {
            addTrackedEventListener(showOverallBtn, 'click', showOverallResults);
        }

        // Pause button
        const pauseTimerBtn = document.getElementById('pause-timer-btn');
        if (pauseTimerBtn) {
            addTrackedEventListener(pauseTimerBtn, 'click', pauseTimer);
        }

        // Overall results controls
        const continueGameBtn = document.getElementById('continue-game-btn');
        if (continueGameBtn) {
            addTrackedEventListener(continueGameBtn, 'click', continueGame);
        }

        const endGameBtn = document.getElementById('end-game-btn');
        if (endGameBtn) {
            addTrackedEventListener(endGameBtn, 'click', endGameForAll);
        }

        // ✅ P1 UI/UX: Keyboard shortcuts
        setupKeyboardShortcuts();

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('✅ Event listeners setup');
        }
    }

    /**
     * ✅ P1 UI/UX: Setup keyboard shortcuts for accessibility
     */
    function setupKeyboardShortcuts() {
        addTrackedEventListener(document, 'keydown', (e) => {
            // Only in question phase
            if (currentPhase !== 'question' || hasSubmittedThisRound) return;

            // Number keys 0-9 for estimation
            if (e.key >= '0' && e.key <= '9') {
                const number = parseInt(e.key);
                const maxPlayers = totalPlayers || 8;
                if (number <= maxPlayers) {
                    selectNumber(number);
                    e.preventDefault();
                }
            }

            // Y for Yes
            if (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'j') {
                selectAnswer(true);
                e.preventDefault();
            }

            // N for No
            if (e.key.toLowerCase() === 'n') {
                selectAnswer(false);
                e.preventDefault();
            }

            // Enter to submit
            if (e.key === 'Enter' && userAnswer !== null && userEstimation !== null) {
                submitAnswers();
                e.preventDefault();
            }
        });

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('⌨️ Keyboard shortcuts enabled');
        }
    }

    // ===========================
    // ✅ P2 PERFORMANCE: LISTENER MANAGEMENT
    // ===========================

    /**
     * ✅ P2 PERFORMANCE: Cleanup listeners for a specific phase
     * @param {string} phase - The phase to cleanup listeners for
     */
    function cleanupPhaseListeners(phase) {
        const listeners = _phaseListeners.get(phase);
        if (!listeners) return;

        listeners.forEach(({ element, event, handler }) => {
            if (element && element.removeEventListener) {
                element.removeEventListener(event, handler);
            }
        });

        _phaseListeners.delete(phase);

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log(`🧹 Cleaned up ${listeners.length} listeners for phase: ${phase}`);
        }
    }

    /**
     * ✅ P2 PERFORMANCE: Add phase-specific event listener
     * @param {string} phase - The phase this listener belongs to
     * @param {Element} element - DOM element
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    function addPhaseListener(phase, element, event, handler) {
        if (!element) return;

        addTrackedEventListener(element, event, handler);

        if (!_phaseListeners.has(phase)) {
            _phaseListeners.set(phase, []);
        }

        _phaseListeners.get(phase).push({ element, event, handler });

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log(`📌 Added ${event} listener for phase: ${phase}`);
        }
    }

    // ===========================
    // ✅ P1 UI/UX: TIMER MANAGEMENT WITH SERVER SYNC
    // ===========================

    /**
     * ✅ P1 UI/UX: Start countdown timer with server timestamp
     * @param {number} serverStartTime - Server timestamp when timer started
     * @param {number} duration - Duration in milliseconds
     */
    function startTimer(serverStartTime, duration = timerDuration) {
        stopTimer(); // Clear any existing timer

        timerStartTime = serverStartTime || Date.now();
        timerDuration = duration;
        isPaused = false;

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('⏱️ Starting timer:', { serverStartTime, duration });
        }

        updateTimerDisplay();
    }

    /**
     * ✅ P2 PERFORMANCE: Update timer using requestAnimationFrame
     */
    function updateTimerDisplay() {
        if (isPaused) return;

        const now = Date.now();
        const elapsed = now - timerStartTime;
        const remaining = Math.max(0, timerDuration - elapsed);

        // Update progress bar
        const progressBar = document.getElementById('timer-progress');
        if (progressBar) {
            const percentage = (remaining / timerDuration) * 100;
            progressBar.style.width = `${percentage}%`;

            // Color coding
            if (percentage > 50) {
                progressBar.style.backgroundColor = '#4caf50'; // green
            } else if (percentage > 25) {
                progressBar.style.backgroundColor = '#ff9800'; // orange
            } else {
                progressBar.style.backgroundColor = '#f44336'; // red
            }
        }

        // Update text display
        const timerText = document.getElementById('timer-text');
        if (timerText) {
            const seconds = Math.ceil(remaining / 1000);
            timerText.textContent = `${seconds}s`;
        }

        // Timer expired
        if (remaining <= 0) {
            stopTimer();
            handleTimerExpired();
            return;
        }

        // Continue animation
        timerAnimationFrame = requestAnimationFrame(updateTimerDisplay);
    }

    /**
     * ✅ P1 UI/UX: Stop timer
     */
    function stopTimer() {
        if (timerAnimationFrame) {
            cancelAnimationFrame(timerAnimationFrame);
            timerAnimationFrame = null;
        }

        if (questionTimer) {
            clearTimeout(questionTimer);
            questionTimer = null;
        }
    }

    /**
     * ✅ P1 UI/UX: Pause timer (HOST ONLY)
     */
    async function pauseTimer() {
        if (!validateHostRole('Timer pausieren')) {
            return;
        }

        if (isPaused) {
            // Resume
            isPaused = false;
            timerStartTime = Date.now() - (timerDuration - pausedTimeRemaining);

            try {
                await firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}`).update({
                    timerPaused: false,
                    timerStartTime: firebase.database.ServerValue.TIMESTAMP,
                    timerRemaining: pausedTimeRemaining
                });

                showNotification('Timer fortgesetzt ▶️', 'info', 2000);
                updateTimerDisplay();
            } catch (error) {
                handleFirebaseError(error, 'Timer fortsetzen', false);
            }
        } else {
            // Pause
            isPaused = true;
            const now = Date.now();
            const elapsed = now - timerStartTime;
            pausedTimeRemaining = Math.max(0, timerDuration - elapsed);

            stopTimer();

            try {
                await firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}`).update({
                    timerPaused: true,
                    timerRemaining: pausedTimeRemaining
                });

                showNotification('Timer pausiert ⏸️', 'warning', 2000);
            } catch (error) {
                handleFirebaseError(error, 'Timer pausieren', false);
            }
        }

        updatePauseButton();
    }

    /**
     * ✅ P1 UI/UX: Update pause button state
     */
    function updatePauseButton() {
        const pauseBtn = document.getElementById('pause-timer-btn');
        if (!pauseBtn) return;

        if (isPaused) {
            pauseBtn.textContent = '▶️ Fortsetzen';
            pauseBtn.classList.add('paused');
        } else {
            pauseBtn.textContent = '⏸️ Pausieren';
            pauseBtn.classList.remove('paused');
        }
    }

    /**
     * ✅ P1 UI/UX: Handle timer expiration
     */
    function handleTimerExpired() {
        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('⏱️ Timer expired!');
        }

        showNotification('Zeit abgelaufen! ⏰', 'warning', 3000);

        // Auto-submit if not submitted yet
        if (!hasSubmittedThisRound && userAnswer !== null && userEstimation !== null) {
            submitAnswers();
        } else if (!hasSubmittedThisRound) {
            showNotification('Du hast nicht rechtzeitig geantwortet!', 'error', 3000);
            // Submit empty answer to not block others
            if (userAnswer === null) userAnswer = false;
            if (userEstimation === null) userEstimation = 0;
            submitAnswers();
        }
    }

    // ===========================
    // ✅ P0 SECURITY: HOST VALIDATION
    // ===========================

    /**
     * ✅ P0 SECURITY: Validate that current user is the host before executing host-only operations
     * @param {string} operation - Description of the operation (for error messages)
     * @returns {boolean} True if user is host, false otherwise
     */
    function validateHostRole(operation = 'Diese Aktion') {
        if (!MultiplayerGameplayModule.gameState.isHost) {
            console.warn(`⚠️ Guest attempted host operation: ${operation}`);

            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    'Nur der Host kann diese Aktion ausführen',
                    'warning',
                    3000
                );
            } else {
                alert('Nur der Host kann diese Aktion ausführen');
            }

            // Log security event in production
            if (window.NocapUtils && window.NocapUtils.logError && !MultiplayerGameplayModule.isDevelopment) {
                window.NocapUtils.logError('MultiplayerGameplay',
                    new Error(`Unauthorized host operation: ${operation}`), {
                    operation,
                    gameId: MultiplayerGameplayModule.gameState.gameId,
                    playerId: MultiplayerGameplayModule.gameState.playerId
                });
            }

            return false;
        }

        return true;
    }

    // ===========================
    // ✅ P1 DSGVO: DATA MINIMIZATION & CLEANUP
    // ===========================

    /**
     * ✅ P1 DSGVO: Schedule automatic deletion of answer data
     * @param {number} roundNumber - The round number to clean up
     */
    function scheduleAnswerCleanup(roundNumber) {
        if (answerCleanupScheduled) return;
        if (!MultiplayerGameplayModule.gameState.isHost) return; // Only host performs cleanup

        answerCleanupScheduled = true;

        setTimeout(async () => {
            try {
                const roundRef = firebase.database().ref(
                    `games/${MultiplayerGameplayModule.gameState.gameId}/rounds/round_${roundNumber}/answers`
                );

                // Get answers for aggregation
                const snapshot = await roundRef.once('value');
                if (snapshot.exists()) {
                    const answers = snapshot.val();

                    // Create anonymized summary
                    const summary = {
                        totalAnswers: Object.keys(answers).length,
                        yesCount: Object.values(answers).filter(a => a.answer === true).length,
                        aggregatedAt: Date.now()
                    };

                    // Save summary
                    await firebase.database()
                        .ref(`games/${MultiplayerGameplayModule.gameState.gameId}/rounds/round_${roundNumber}/summary`)
                        .set(summary);

                    // Delete individual answers (DSGVO data minimization)
                    await roundRef.remove();

                    if (MultiplayerGameplayModule.isDevelopment) {
                        console.log(`🗑️ Cleaned up answers for round ${roundNumber}`);
                    }
                }

                answerCleanupScheduled = false;
            } catch (error) {
                console.error('❌ Error cleaning up answers:', error);
                answerCleanupScheduled = false;
            }
        }, ANSWER_RETENTION_TIME);
    }

    /**
     * ✅ FSK18-SYSTEM: Verify age for FSK18 questions with server validation
     * - FSK0 & FSK16: Always allowed
     * - FSK18: Requires server validation via GameState.canAccessFSK()
     * @param {string} category - Question category
     * @returns {Promise<boolean>} True if user is allowed to see this question
     */
    async function verifyAgeForQuestion(category) {
        // FSK0 & FSK16: Always allowed
        if (category !== 'fsk18') {
            return true;
        }

        // FSK18: Server validation required
        if (!window.FirebaseConfig?.isInitialized?.()) {
            // Fail closed - no Firebase = no FSK18
            return false;
        }

        try {
            // Use GameState's server validation
            const hasAccess = await MultiplayerGameplayModule.gameState.canAccessFSK('fsk18', true);

            if (!hasAccess && MultiplayerGameplayModule.isDevelopment) {
                console.log('❌ FSK18 access denied for question');
            }

            return hasAccess;
        } catch (error) {
            console.error('❌ FSK18 validation error:', error);
            return false; // Fail closed on error
        }
    }

    // ===========================
    // FIREBASE LISTENERS - REAL-TIME SYNC
    // ===========================

    async function setupFirebaseListeners() {
        if (!MultiplayerGameplayModule.firebaseService || !MultiplayerGameplayModule.gameState.gameId) {
            console.error('❌ Cannot setup listeners - missing service or gameId');
            handleFirebaseError(
                new Error('Service or GameID missing'),
                'Listener-Setup',
                true // fatal
            );
            return;
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('🎧 Setting up Firebase listeners...');
        }

        try {
            const gameRef = firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}`);

            // ✅ P1 STABILITY: Error handler for listener
            gameRef.on('value', (snapshot) => {
                try {
                    if (!snapshot.exists()) {
                        console.warn('⚠️ Game not found');
                        handleFirebaseError(new Error('Game not found'), 'Spiel-Synchronisation', false);
                        cleanup();
                        setTimeout(() => window.location.href = 'index.html', 2000);
                        return;
                    }

                    currentGameData = snapshot.val();
                    currentPlayers = currentGameData.players || {};
                    updatePlayersCount();

                    // ✅ FIX: Determine role from DB (source of truth) on EVERY update
                    try {
                        const uid = firebase.auth().currentUser?.uid || MultiplayerGameplayModule.gameState.playerId;
                        if (uid && currentGameData.hostId) {
                            const isHostNow = currentGameData.hostId === uid;
                            MultiplayerGameplayModule.gameState.isHost = isHostNow;
                            MultiplayerGameplayModule.gameState.isGuest = !isHostNow;
                            MultiplayerGameplayModule.gameState.playerId = uid;

                            // ✅ Recover categories from DB if missing
                            if (!MultiplayerGameplayModule.gameState.selectedCategories?.length && currentGameData.settings?.categories) {
                                const cats = currentGameData.settings.categories;
                                MultiplayerGameplayModule.gameState.selectedCategories =
                                    Array.isArray(cats) ? cats : Object.values(cats);
                            }
                            if (!MultiplayerGameplayModule.gameState.difficulty && currentGameData.settings?.difficulty) {
                                MultiplayerGameplayModule.gameState.difficulty = currentGameData.settings.difficulty;
                            }

                            // ✅ Persist (MERGE, not overwrite)
                            try {
                                const existing = JSON.parse(localStorage.getItem('nocap_game_state') || '{}');
                                localStorage.setItem('nocap_game_state', JSON.stringify({
                                    ...existing,
                                    gameId: MultiplayerGameplayModule.gameState.gameId,
                                    playerId: uid,
                                    isHost: isHostNow,
                                    isGuest: !isHostNow,
                                    deviceMode: 'multi',
                                    selectedCategories: MultiplayerGameplayModule.gameState.selectedCategories,
                                    difficulty: MultiplayerGameplayModule.gameState.difficulty
                                }));
                            } catch (_) {}
                        }
                    } catch (e) {
                        console.warn('⚠️ Could not determine host role:', e.message);
                    }

                    // Overall results
                    if (currentGameData.showOverallResults && currentPhase !== 'overall-results') {
                        if (currentGameData.overallStats) overallStats = currentGameData.overallStats;
                        displayOverallResults();
                    }

                    // Continue after overall
                    if (currentGameData.showOverallResults === false && currentPhase === 'overall-results') {
                        handleNewRound(currentGameData.currentRound);
                    }

                    // Game end
                    if (currentGameData.gameState === 'finished') {
                        showNotification('Spiel beendet! 👋', 'info', 3000);
                        setTimeout(() => {
                            cleanup();
                            window.location.href = 'index.html';
                        }, 3000);
                        return;
                    }

                    // ✅ Round sync (fix for guests loading before host sets currentRound)
                    if (currentGameData.currentRound && currentPhase !== 'overall-results') {
                        const round = Number(currentGameData.currentRound) || 0;

                        // If we haven't loaded anything yet (e.g., guest joined early), force-load current round
                        if (!currentQuestion || round !== currentQuestionNumber) {
                            handleNewRound(round);
                        }
                    }
                } catch (error) {
                    handleFirebaseError(error, 'Spiel-Update verarbeiten', false);
                }
            }, (error) => {
                handleFirebaseError(error, 'Echtzeit-Synchronisation', true);
            });


            gameListener = gameRef;

            // Load initial game data
            const initialData = await gameRef.once('value');
            if (initialData.exists()) {
                currentGameData = initialData.val();
                currentPlayers = currentGameData.players || {};
// ✅ FIX: Determine role from DB (source of truth) after recovery
                try {
                    const uid = firebase.auth().currentUser?.uid || MultiplayerGameplayModule.gameState.playerId;
                    if (uid && currentGameData.hostId) {
                        const isHostNow = currentGameData.hostId === uid;
                        MultiplayerGameplayModule.gameState.isHost = isHostNow;
                        MultiplayerGameplayModule.gameState.isGuest = !isHostNow;
                        MultiplayerGameplayModule.gameState.playerId = uid;

                        // ✅ Recover selectedCategories + difficulty from DB settings if missing
                        if (!MultiplayerGameplayModule.gameState.selectedCategories?.length && currentGameData.settings) {
                            const cats = currentGameData.settings.categories;
                            if (cats) {
                                MultiplayerGameplayModule.gameState.selectedCategories =
                                    Array.isArray(cats) ? cats : Object.values(cats);
                            }
                        }
                        if (!MultiplayerGameplayModule.gameState.difficulty && currentGameData.settings?.difficulty) {
                            MultiplayerGameplayModule.gameState.difficulty = currentGameData.settings.difficulty;
                        }

                        // Persist for next reload
                        try {
                            const existing = JSON.parse(localStorage.getItem('nocap_game_state') || '{}');
                            localStorage.setItem('nocap_game_state', JSON.stringify({
                                ...existing,
                                gameId: MultiplayerGameplayModule.gameState.gameId,
                                playerId: uid,
                                isHost: isHostNow,
                                isGuest: !isHostNow,
                                deviceMode: 'multi',
                                selectedCategories: MultiplayerGameplayModule.gameState.selectedCategories,
                                difficulty: MultiplayerGameplayModule.gameState.difficulty
                            }));
                        } catch (_) {}
                    }
                } catch (e) {
                    console.warn('⚠️ Could not determine host role:', e.message);
                }

                // Check if game is actually in playing status
                if (currentGameData.status !== 'playing') {
                    console.warn('⚠️ Game not in playing status');
                    showNotification('Spiel wurde noch nicht gestartet!', 'warning');
                    setTimeout(() => window.location.href = 'multiplayer-lobby.html', 2000);
                    return;
                }

                updatePlayersCount();

                if (currentGameData.currentRound) {
                    // Check if round actually exists in DB - if not, host must create it
                    const roundSnap = await firebase.database()
                        .ref(`games/${MultiplayerGameplayModule.gameState.gameId}/rounds/round_${currentGameData.currentRound}`)
                        .once('value');

                    if (roundSnap.exists()) {
                        handleNewRound(currentGameData.currentRound);
                    } else if (MultiplayerGameplayModule.gameState.isHost) {
                        currentQuestionNumber = Number(currentGameData.currentRound) || 1;
                        await startNewRound();
                    } else {
                        // Guest: wait for host to create the round
                        handleNewRound(currentGameData.currentRound);
                    }
                } else if (MultiplayerGameplayModule.gameState.isHost) {
                    // ✅ Host starts first round
                    currentQuestionNumber = 1;        // set round number
                    await startNewRound();            // creates /rounds/round_1 + sets currentRound
                } else {
                    // ✅ Guest: wait until host sets currentRound (gameRef.on('value') will call handleNewRound)
                    if (MultiplayerGameplayModule.isDevelopment) {
                        console.log('⏳ Waiting for host to start the first round...');
                    }
                }

            } else {
                console.error('❌ Game data not found');
                showNotification('Spiel nicht gefunden!', 'error');
                setTimeout(() => window.location.href = 'index.html', 2000);
                return;
            }

            if (MultiplayerGameplayModule.isDevelopment) {
                console.log('✅ Firebase listeners setup');
            }
        } catch (error) {
            console.error('❌ Error setting up listeners:', error);
            showNotification('Verbindungsfehler!', 'error');
            setTimeout(() => window.location.href = 'index.html', 3000);
        }
    }
    async function loadRoundFromFirebase(roundNumber) {
        try {
            if (MultiplayerGameplayModule.isDevelopment) {
                console.log(`📥 Loading round ${roundNumber}...`);
            }

            const roundRef = firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}/rounds/round_${roundNumber}`);
            const snapshot = await roundRef.once('value');

            if (!snapshot.exists()) {
                console.warn(`⚠️ Round ${roundNumber} not in DB yet - retrying in 1s...`);
                setTimeout(() => loadRoundFromFirebase(roundNumber), 1000);
                return;
            }

            const roundData = snapshot.val();
            if (!roundData || !roundData.question) {
                console.warn('⚠️ Round exists but no question yet - retrying in 1s...');
                setTimeout(() => loadRoundFromFirebase(roundNumber), 1000);
                return;
            }

            if (snapshot.exists()) {
                currentQuestion = roundData.question;

                // ✅ FSK18-SYSTEM: Verify age for loaded question with server validation
                if (currentQuestion && currentQuestion.category === 'fsk18') {
                    const hasAccess = await verifyAgeForQuestion('fsk18');

                    if (!hasAccess) {
                        // Block FSK18 content - show fallback question
                        currentQuestion = {
                            text: "Diese Frage ist für dein Alter nicht freigegeben",
                            category: "fsk0"
                        };

                        if (MultiplayerGameplayModule.isDevelopment) {
                            console.log('🔒 FSK18 question blocked - showing fallback');
                        }
                    }
                }

                if (currentQuestion) {
                    displayQuestion(currentQuestion);
                    setupRoundListener(roundNumber);

                    // ✅ P1 UI/UX: Sync timer from server
                    const gameSnapshot = await firebase.database()
                        .ref(`games/${MultiplayerGameplayModule.gameState.gameId}`)
                        .once('value');

                    if (gameSnapshot.exists()) {
                        const gameData = gameSnapshot.val();

                        if (gameData.timerPaused) {
                            isPaused = true;
                            pausedTimeRemaining = gameData.timerRemaining || 0;
                            updatePauseButton();
                        } else if (gameData.timerStartTime && roundData.timerDuration) {
                            startTimer(gameData.timerStartTime, roundData.timerDuration);
                        }
                    }

                    if (MultiplayerGameplayModule.isDevelopment) {
                        console.log('✅ Round loaded');
                    }
                }
            }
        } catch (error) {
            // Permission denied = player not yet in /players/ (re-register race condition)
            // Retry after 1.5s to give re-register time to complete
            if (error.code === 'PERMISSION_DENIED' || (error.message && error.message.includes('permission'))) {
                console.warn('⚠️ Round read permission denied - retrying after re-register...');
                setTimeout(() => loadRoundFromFirebase(roundNumber), 1500);
            } else {
                console.error('❌ Error loading round:', error);
            }
        }
    }

    function setupRoundListener(roundNumber) {
        // Remove old listener using stored reference
        if (roundListener && roundListenerRef) {
            try {
                roundListenerRef.off('value', roundListener);
                if (MultiplayerGameplayModule.isDevelopment) {
                    console.log('[DEBUG] Removed previous round listener');
                }
            } catch (e) {
                console.warn('[WARNING] Could not remove previous round listener:', e.message);
            }
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log(`🎧 Setting up round listener for round ${roundNumber}`);
        }

        const roundRef = firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}/rounds/round_${roundNumber}`);
        roundListenerRef = roundRef; // Store reference for cleanup

        roundListener = roundRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                currentRoundData = snapshot.val();

                const answers = currentRoundData.answers || {};
                const answerCount = Object.keys(answers).length;
                const playerCount = Object.keys(currentPlayers).length;

                if (MultiplayerGameplayModule.isDevelopment) {
                    console.log(`📊 Round update: ${answerCount}/${playerCount} answers`);
                }

// ✅ Always update waiting UI when applicable
                if (currentPhase === 'waiting') {
                    updateWaitingStatus(answers);
                }

// ✅ CRITICAL: If I have submitted and all answers are in, show results (independent of currentPhase)
                const myKey = getPlayerKey();
                const iHaveAnswered = !!(myKey && answers && answers[myKey]);

// ✅ recovery: if my answer exists in DB, treat as submitted (after reload)
                if (iHaveAnswered && !hasSubmittedThisRound) {
                    hasSubmittedThisRound = true;
                    try { updateSubmitButton(); } catch(_) {}
                }


                if (hasSubmittedThisRound && iHaveAnswered && answerCount >= playerCount && playerCount >= 2) {
                    currentRoundData = currentRoundData || {};
                    currentRoundData.answers = answers;

                    // small debounce to allow last write to settle
                    setTimeout(() => {
                        // don't block by phase — but avoid double-show
                        if (currentPhase !== 'results' && currentPhase !== 'overall-results') {
                            calculateAndShowResults();
                        }
                    }, 250);
                }

            }
        });

// ✅ P1 UI/UX: Listen for timer pause events (REGISTER ONCE)
        if (!timerSyncRef) {
            timerSyncRef = firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}`);
            timerSyncCb = (snapshot) => {
                if (snapshot.exists() && !MultiplayerGameplayModule.gameState.isHost) {
                    const gameData = snapshot.val();

                    if (gameData.timerPaused !== isPaused) {
                        if (gameData.timerPaused) {
                            isPaused = true;
                            pausedTimeRemaining = gameData.timerRemaining || 0;
                            stopTimer();
                            showNotification('⏸️ Timer pausiert vom Host', 'info', 2000);
                        } else if (gameData.timerStartTime) {
                            isPaused = false;
                            startTimer(gameData.timerStartTime, gameData.timerRemaining || timerDuration);
                            showNotification('▶️ Timer fortgesetzt', 'info', 2000);
                        }
                        updatePauseButton();
                    }
                }
            };

            timerSyncRef.on('value', timerSyncCb);
        }


        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('✅ Round listener active');
        }
    }
    function handleNewRound(roundNumber) {
        const rn = Number(roundNumber) || 0;
        if (rn <= 0) return;

        const missingRoundData = !currentRoundData;
        const missingQuestion = !currentQuestion || !currentQuestion.text;
        const missingListener = !roundListenerRef;

        const shouldLoad = (rn !== currentQuestionNumber) || missingQuestion || missingRoundData || missingListener;

        if (!shouldLoad) return;

        currentQuestionNumber = rn;
        hasSubmittedThisRound = false;

        stopTimer();
        updateGameDisplay();
        resetForNewQuestion();
        showPhase('question');

        loadRoundFromFirebase(rn);
    }

    // ===========================
    // GAME FLOW
    // ===========================

    async function startNewRound() {
        if (!MultiplayerGameplayModule.gameState.isHost) return;

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log(`🎲 Starting round ${currentQuestionNumber}`);
        }

        // ✅ PHASE 3: Load question via Cloud Function (FSK18-safe)
        currentQuestion = await loadQuestionFromCloudFunction();

        // ✅ FSK18-SYSTEM: Double-check with client-side validation
        if (currentQuestion.category === 'fsk18') {
            const hasAccess = await verifyAgeForQuestion('fsk18');

            if (!hasAccess) {
                // Fallback to safe question
                currentQuestion = {
                    text: "Ich habe schon mal... etwas Lustiges erlebt",
                    category: "fsk0"
                };

                if (MultiplayerGameplayModule.isDevelopment) {
                    console.log('🔒 FSK18 question blocked for host - using fallback');
                }
            }
        }

        // Display question
        displayQuestion(currentQuestion);

        // Start round in Firebase with server timestamp
        try {
            const roundRef = firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}/rounds/round_${currentQuestionNumber}`);
            await roundRef.set({
                question: currentQuestion,
                startedAt: Date.now(),
                timerDuration: timerDuration
            });

            const gameRef = firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}`);
            await gameRef.update({
                currentRound: currentQuestionNumber,
                timerStartTime: firebase.database.ServerValue.TIMESTAMP,
                timerPaused: false,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });

            // ✅ P1 UI/UX: Start timer with server sync
            const serverTime = await getServerTimestamp();
            startTimer(serverTime, timerDuration);

            setupRoundListener(currentQuestionNumber);
            if (MultiplayerGameplayModule.isDevelopment) {
                console.log('✅ New round started');
            }
        } catch (error) {
            console.error('❌ Error starting round:', error);
        }
    }

    /**
     * ✅ P1 UI/UX: Get server timestamp for timer sync
     */
    async function getServerTimestamp() {
        try {
            const ref = firebase.database().ref('.info/serverTimeOffset');
            const snapshot = await ref.once('value');
            const offset = snapshot.val() || 0;
            return Date.now() + offset;
        } catch (e) {
            return Date.now();
        }
    }

    /**
     * ✅ PHASE 3: Load questions from Cloud Function for FSK18
     * FSK0 & FSK16 can still use local fallback
     * @returns {Promise<Object>} Question object {text, category}
     */
    function generateRandomQuestionLocal(categories) {
        const fallbackQuestionsDatabase = {
            fsk0: [
                "Ich habe schon mal... ein ganzes Buch an einem Tag gelesen",
                "Ich habe schon mal... Pizza zum Frühstück gegessen",
                "Ich habe schon mal... mehr als 12 Stunden am Stück geschlafen",
                "Ich habe schon mal... einen ganzen Tag im Pyjama verbracht",
                "Ich habe schon mal... beim Kochen das Essen anbrennen lassen",
                "Ich habe schon mal... eine Nacht komplett durchgemacht",
                "Ich habe schon mal... einen fremden Hund gestreichelt",
                "Ich habe schon mal... im Regen getanzt",
                "Ich habe schon mal... etwas Wichtiges vergessen",
                "Ich habe schon mal... im Kino geweint"
            ],
            fsk16: [
                "Ich habe schon mal... so getan, als wäre ich krank, um nicht zur Schule zu müssen",
                "Ich habe schon mal... bis 3 Uhr morgens Netflix geschaut",
                "Ich habe schon mal... vergessen, wo ich mein Auto geparkt habe",
                "Ich habe schon mal... jemandem etwas erzählt, das nicht ganz der Wahrheit entsprach",
                "Ich habe schon mal... einen Test nicht bestanden",
                "Ich habe schon mal... jemanden aus Versehen ignoriert",
                "Ich habe schon mal... Geld für etwas Sinnloses ausgegeben",
                "Ich habe schon mal... eine Party verlassen ohne mich zu verabschieden"
            ]
        };

        const validCategories = (categories || ['fsk0']).filter(c => c !== 'fsk18' && fallbackQuestionsDatabase[c]);
        if (validCategories.length === 0) validCategories.push('fsk0');

        const randomCategory = validCategories[Math.floor(Math.random() * validCategories.length)];
        const pool = fallbackQuestionsDatabase[randomCategory];
        const text = pool[Math.floor(Math.random() * pool.length)];

        return { text, category: randomCategory };
    }

    async function loadQuestionFromCloudFunction() {
        const rawSelected = MultiplayerGameplayModule.gameState.selectedCategories || [];
        const selectedCategories = Array.isArray(rawSelected)
            ? rawSelected
            : (rawSelected ? Object.values(rawSelected) : []);

        // No categories selected — hard fallback
        if (selectedCategories.length === 0) {
            console.warn('⚠️ No categories in gameState — using emergency fallback');
            return { text: 'Ich habe schon mal... etwas Interessantes erlebt', category: 'fsk0' };
        }

        const hasFSK18 = selectedCategories.includes('fsk18');

        // ── FSK18: Cloud Function (server-side age check) ──────────────────────
        if (hasFSK18) {
            try {
                const instances = window.FirebaseConfig?.getFirebaseInstances?.();
                const functions = instances?.functions;
                if (functions) {
                    const getQuestionsForGame = functions.httpsCallable('getQuestionsForGame');
                    const result = await getQuestionsForGame({
                        gameId: MultiplayerGameplayModule.gameState.gameId || 'multiplayer-game',
                        categories: selectedCategories,
                        count: 50
                    });
                    if (result?.data?.questions?.length > 0) {
                        const questions = result.data.questions;
                        const q = questions[Math.floor(Math.random() * questions.length)];
                        return {
                            text: sanitizeText(q.text || q.question || 'Ich habe schon mal...'),
                            category: q.category || 'fsk0'
                        };
                    }
                }
            } catch (e) {
                console.warn('⚠️ FSK18 Cloud Function failed, falling back to non-FSK18:', e.message);
            }
            // FSK18 failed — fall through to RTDB with FSK18 removed
        }

        // ── FSK0 / FSK16 / special: Direct RTDB read ──────────────────────────
        const safeCategories = selectedCategories.filter(c => c !== 'fsk18');
        if (safeCategories.length === 0) safeCategories.push('fsk0');

        try {
            const db = firebase.database();

            // Load all questions for selected categories in parallel
            const snapshots = await Promise.all(
                safeCategories.map(cat => db.ref(`questions/${cat}`).once('value'))
            );

            // Flatten into one pool
            const pool = [];
            snapshots.forEach((snap, i) => {
                if (snap.exists()) {
                    const cat = safeCategories[i];
                    Object.values(snap.val()).forEach(q => {
                        if (q.text) pool.push({ text: q.text, category: cat });
                    });
                }
            });

            if (pool.length > 0) {
                // Avoid repeating the last question
                const filtered = pool.filter(q => q.text !== currentQuestion?.text);
                const source = filtered.length > 0 ? filtered : pool;
                return source[Math.floor(Math.random() * source.length)];
            }

            console.warn('⚠️ RTDB returned no questions — using local fallback');
        } catch (e) {
            console.warn('⚠️ RTDB question load failed:', e.message);
        }

        // ── Last resort: hardcoded fallback ───────────────────────────────────
        return generateRandomQuestionLocal(safeCategories);
    }
    /**
     * P0 FIX: Display question with textContent only
     * ✅ P1 UI/UX: Add progress indicator
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

        // ✅ P1 UI/UX: Update progress indicator
        const progressEl = document.getElementById('question-progress');
        if (progressEl) {
            progressEl.textContent = `Frage ${currentQuestionNumber}`;
        }

        if (MultiplayerGameplayModule.isDevelopment) {
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
            // ✅ CSP FIX: Use CSS class instead of inline style
            personalBox.classList.add('hidden');
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
            addTrackedEventListener(numberBtn, 'click', () => selectNumber(i));

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
        // ✅ P1 UI/UX: Don't allow changes after submission
        if (hasSubmittedThisRound) {
            showNotification('Du hast bereits abgesendet!', 'warning', 2000);
            return;
        }

        userAnswer = answer;

        // ✅ P1 UI/UX: Clear previous selection and highlight new one
        document.querySelectorAll('.answer-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.setAttribute('aria-checked', 'false');
            btn.disabled = false;
        });

        const selectedBtn = answer ?
            document.getElementById('yes-btn') :
            document.getElementById('no-btn');

        if (selectedBtn) {
            selectedBtn.classList.add('selected');
            selectedBtn.setAttribute('aria-checked', 'true');
        }

        // ✅ P1 UI/UX: Provide haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(50);
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
            if (MultiplayerGameplayModule.gameState.isHost) {
                el.classList.add('show');
            } else {
                el.classList.remove('show');
            }
        });

        const guestElements = document.querySelectorAll('.guest-only');
        guestElements.forEach(el => {
            if (!MultiplayerGameplayModule.gameState.isHost) {
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
     * ✅ P1 DSGVO: Schedule data cleanup
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

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('📤 Submitting answers:', { answer: userAnswer, estimation: userEstimation });
        }

        // P0: Validate estimation range
        if (userEstimation < 0 || userEstimation > totalPlayers) {
            showNotification('Ungültige Schätzung!', 'error');
            return;
        }

        const playerKey = getPlayerKey();
        if (!playerKey) {
            showNotification('Spieler-ID fehlt – bitte Lobby neu öffnen', 'error');
            return;
        }

        if (!currentQuestionNumber || currentQuestionNumber < 1) {
            showNotification('Frage wird noch geladen...', 'warning');
            return;
        }

        const answerData = {
            playerId: playerKey,
            playerName: sanitizePlayerName(MultiplayerGameplayModule.gameState.playerName),
            answer: userAnswer,
            estimation: userEstimation,
            isHost: MultiplayerGameplayModule.gameState.isHost,
            timestamp: Date.now()
        };

        try {
            const answerRef = firebase.database().ref(
                `games/${MultiplayerGameplayModule.gameState.gameId}/rounds/round_${currentQuestionNumber}/answers/${playerKey}`
            );

            await answerRef.set({
                answer: userAnswer,
                estimation: userEstimation,
                submittedAt: Date.now(),
                playerId: playerKey,
                playerName: sanitizePlayerName(MultiplayerGameplayModule.gameState.playerName),
                isHost: MultiplayerGameplayModule.gameState.isHost || false
            });
// ✅ Ensure round listener exists (guest might have joined before round was loaded)
            if (!roundListenerRef) {
                setupRoundListener(currentQuestionNumber);
            }
            // P0: Mark as submitted
            hasSubmittedThisRound = true;

            // ✅ P1 UI/UX: Disable answer buttons
            document.querySelectorAll('.answer-btn').forEach(btn => {
                btn.disabled = true;
            });

            // ✅ P1 UI/UX: Stop timer for this player
            stopTimer();

            // ✅ P1 DSGVO: Schedule cleanup (host only)
            if (MultiplayerGameplayModule.gameState.isHost) {
                scheduleAnswerCleanup(currentQuestionNumber);
            }

            if (MultiplayerGameplayModule.isDevelopment) {
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
                `games/${MultiplayerGameplayModule.gameState.gameId}/rounds/round_${currentQuestionNumber}`
            );
            const snapshot = await roundRef.once('value');

            if (snapshot.exists()) {
                const roundData = snapshot.val();
                const answers = roundData.answers || {};
                const answerCount = Object.keys(answers).length;
                const playerCount = Object.keys(currentPlayers).length;

                if (MultiplayerGameplayModule.isDevelopment) {
                    console.log(`🔍 Check: ${answerCount}/${playerCount} answers`);
                }

                if (answerCount >= playerCount && playerCount >= 2 && currentPhase === 'waiting') {
                    if (MultiplayerGameplayModule.isDevelopment) {
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
        if (MultiplayerGameplayModule.isDevelopment) {
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
            const hasAnswered = !!answers[playerId] || !!answers[player.uid] || !!answers[player.playerId];

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

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log(`✅ Results: ${actualYesCount} said yes`);
        }

        // Calculate results
        const results = Object.values(answers).map(playerAnswer => {
            const difference = Math.abs(playerAnswer.estimation - actualYesCount);
            const isCorrect = difference === 0;

            let sips = 0;
            if (!isCorrect) {
                const multiplier = difficultyMultipliers[MultiplayerGameplayModule.gameState.difficulty] || 1;
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

        if (MultiplayerGameplayModule.isDevelopment) {
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
        const currentPlayerId = getPlayerKey();

        const myResult = results.find(r => r.playerId === currentPlayerId);

        if (myResult) {
            const personalBox = document.getElementById('personal-result');
            if (personalBox) {
                // ✅ CSP FIX: Use CSS class instead of inline style
                personalBox.classList.remove('hidden');
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
                // ✅ CSP FIX: Use CSS classes instead of inline style
                statusEl.classList.remove('status-correct', 'status-incorrect');
                statusEl.classList.add(myResult.isCorrect ? 'status-correct' : 'status-incorrect');
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

    /**
     * ✅ P0 SECURITY: Next question (HOST ONLY)
     */
    async function nextQuestion() {
        // ✅ P0 SECURITY: Validate host role
        if (!validateHostRole('Nächste Frage starten')) {
            return;
        }

        try {
            currentQuestionNumber++;
            hasSubmittedThisRound = false; // Reset anti-cheat

            // ✅ P1 UI/UX: Stop and reset timer
            stopTimer();
            isPaused = false;
            pausedTimeRemaining = 0;

            updateGameDisplay();
            resetForNewQuestion();
            showPhase('question');

            await startNewRound();
            showNotification('Neue Frage! 🎮', 'success', 2000);
        } catch (error) {
            handleFirebaseError(error, 'Nächste Frage laden', false);
        }
    }

    /**
     * ✅ P0 SECURITY: Show overall results (HOST ONLY)
     */
    async function showOverallResults() {
        // ✅ P0 SECURITY: Validate host role
        if (!validateHostRole('Gesamtergebnisse anzeigen')) {
            return;
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('📊 Showing overall results...');
        }

        try {
            const gameRef = firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}`);
            await gameRef.update({
                showOverallResults: true,
                overallStats: overallStats,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });

            if (MultiplayerGameplayModule.isDevelopment) {
                console.log('✅ Overall results notification sent');
            }

            displayOverallResults();
        } catch (error) {
            handleFirebaseError(error, 'Gesamtergebnisse anzeigen', false);
        }
    }

    /**
     * P0 FIX: Display overall results with textContent
     */
    function displayOverallResults() {
        if (MultiplayerGameplayModule.isDevelopment) {
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
            sipsSpan.textContent = `🍺 ${player.totalSips} `;

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

    /**
     * ✅ P0 SECURITY: Continue game (HOST ONLY)
     */
    async function continueGame() {
        // ✅ P0 SECURITY: Validate host role
        if (!validateHostRole('Spiel fortsetzen')) {
            return;
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('▶️ Continuing game...');
        }

        try {
            const gameRef = firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}`);
            await gameRef.update({
                showOverallResults: false,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });

            currentQuestionNumber++;
            hasSubmittedThisRound = false;

            // ✅ P1 UI/UX: Stop and reset timer
            stopTimer();
            isPaused = false;
            pausedTimeRemaining = 0;

            updateGameDisplay();
            resetForNewQuestion();
            showPhase('question');

            await startNewRound();
            showNotification('Spiel wird fortgesetzt! 🎮', 'success', 2000);
        } catch (error) {
            handleFirebaseError(error, 'Spiel fortsetzen', false);
        }
    }

    /**
     * ✅ P0 SECURITY: End game for all (HOST ONLY)
     */
    async function endGameForAll() {
        // ✅ P0 SECURITY: Validate host role
        if (!validateHostRole('Spiel beenden')) {
            return;
        }

        if (!confirm('Spiel wirklich für ALLE beenden?')) {
            return;
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('🛑 Ending game...');
        }

        try {
            const gameRef = firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}`);
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
            handleFirebaseError(error, 'Spiel beenden', false);
        }
    }

    // ===========================
    // UTILITIES
    // ===========================
    // UTILITIES (use NocapUtils)
    // ===========================

    const showLoading = window.NocapUtils?.showLoading || function() {
        const loading = document.getElementById('loading-screen');
        if (loading) loading.classList.add('show');
    };

    const hideLoading = window.NocapUtils?.hideLoading || function() {
        const loading = document.getElementById('loading-screen');
        if (loading) loading.classList.remove('show');
    };

    const showNotification = window.NocapUtils?.showNotification || function(message, type = 'info') {
        alert(message); // Fallback
    };

    // ===========================
    // CLEANUP
    // ===========================

    function cleanup() {
        // ✅ P1 UI/UX: Stop timers
        stopTimer();
        // ✅ Remove tracked DOM listeners
        MultiplayerGameplayModule.state.eventListenerCleanup.forEach(({ element, event, handler, options }) => {
            try {
                element?.removeEventListener?.(event, handler, options);
            } catch (e) {}
        });
        MultiplayerGameplayModule.state.eventListenerCleanup = [];

        // Clean up game listener using stored reference
        if (gameListener) {
            try {
                gameListener.off(); // gameListener is the Firebase ref itself
                if (MultiplayerGameplayModule.isDevelopment) {
                    console.log('[DEBUG] Removed game listener');
                }
            } catch (e) {
                console.warn('[WARNING] Could not remove game listener during cleanup:', e.message);
            }
            gameListener = null;
        }

        // Clean up round listener using stored reference
        if (roundListener && roundListenerRef) {
            try {
                roundListenerRef.off('value', roundListener);
                if (MultiplayerGameplayModule.isDevelopment) {
                    console.log('[DEBUG] Removed round listener');
                }
            } catch (e) {
                console.warn('[WARNING] Could not remove round listener during cleanup:', e.message);
            }
            roundListener = null;
            roundListenerRef = null;
        }

        // ✅ P2 PERFORMANCE: Cleanup phase listeners
        _phaseListeners.forEach((listeners, phase) => {
            cleanupPhaseListeners(phase);
        });

        if (window.NocapUtils && window.NocapUtils.cleanupEventListeners) {
            window.NocapUtils.cleanupEventListeners();
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('✅ Multiplayer gameplay cleanup completed');
        }
        // ✅ Remove timer sync listener (registered once)
        if (timerSyncRef && timerSyncCb) {
            try {
                timerSyncRef.off('value', timerSyncCb);
            } catch (e) {
                console.warn('[WARNING] Could not remove timer sync listener:', e.message);
            }
            timerSyncRef = null;
            timerSyncCb = null;
        }
        if (connectedRef && connectedCb) {
            try {
                connectedRef.off('value', connectedCb);
            } catch (e) {
                console.warn('[WARNING] Could not remove connectedRef listener:', e.message);
            }
            connectedRef = null;
            connectedCb = null;
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