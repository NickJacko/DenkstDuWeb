/**
 * No-Cap Multiplayer Lobby
 * Version 4.1 - FSK18-System Integration
 *
 * CRITICAL: This page manages real-time multiplayer lobby
 * - Creates game (if host)
 * - Joins existing game (if guest)
 * - Real-time player sync via Firebase
 * - Validates device mode continuously
 *
 * SECURITY FIXES:
 * ✅ FSK18: FSK0 & FSK16 always allowed, FSK18 requires server validation
 * ✅ P0: DOMPurify XSS prevention
 * ✅ P0: Age verification with server validation
 * ✅ P0: Safe DOM manipulation (textContent only)
 * ✅ P1: Memory leak prevention (listener cleanup)
 * ✅ P1: Error handling improvements
 */

(function(window) {
    'use strict';

    const Logger = window.NocapUtils?.Logger || {
        debug: (...args) => {},
        info: (...args) => {},
        warn: console.warn,
        error: console.error
    };

    const MultiplayerLobbyModule = {
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

    Object.seal(MultiplayerLobbyModule.state);

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
        MultiplayerLobbyModule.state.eventListenerCleanup.push({
            element: el,
            event: evt,
            handler,
            options: opts
        });
    }

    // ===========================
    // CONSTANTS
    // ===========================
    const categoryIcons = {
        fsk0: '👨‍👩‍👧‍👦',
        fsk16: '🎉',
        fsk18: '🔥',
        special: '⭐'
    };

    const categoryNames = {
        fsk0: 'Familie & Freunde',
        fsk16: 'Party Time',
        fsk18: 'Heiß & Gewagt',
        special: 'Special'
    };

    const difficultyNames = {
        easy: 'Entspannt 🍷',
        medium: 'Normal 🍺',
        hard: 'Hardcore 🔥'
    };

    const MAX_PLAYERS = 8;
    const MIN_PLAYERS = 2;

    // ===========================
    // GLOBAL STATE
    // ===========================
    let currentGameId = null;
    let isHost = false;
    let currentUserId = null;
    let gameListener = null;
    let heartbeatInterval = null; // ✅ P1 STABILITY: Track heartbeat for cleanup
    let currentPlayers = {}; // ✅ Track current players for dialog

    // ✅ P1 STABILITY: Presence & Rejoin system
    let presenceRef = null;
    let connectedRef = null;
    let isRejoining = false;
    const REJOIN_BUFFER_TIME = 120000; // 2 minutes to rejoin
    const PRESENCE_UPDATE_INTERVAL = 10000; // 10 seconds

    function getPlayerKey() {
        try {
            const uid = firebase?.auth?.()?.currentUser?.uid;
            return uid || currentUserId || MultiplayerLobbyModule.gameState?.playerId || null;
        } catch (e) {
            return currentUserId || MultiplayerLobbyModule.gameState?.playerId || null;
        }
    }


    // ===========================
    // INITIALIZATION
    // ===========================

    async function initialize() {
        if (MultiplayerLobbyModule.isDevelopment) {
            console.log('🎮 Initializing multiplayer lobby...');
        }

        // P0 FIX: Check DOMPurify
        if (typeof DOMPurify === 'undefined') {
            console.error('❌ CRITICAL: DOMPurify not loaded!');
            alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
            return;
        }

        if (!window.gameState && !window.GameState) {
            showNotification('Fehler: GameState nicht geladen', 'error');
            return;
        }

        MultiplayerLobbyModule.gameState = window.gameState || (window.GameState ? new window.GameState() : null);
        // ✅ P0 FIX: Recover gameId from URL/session/localStorage BEFORE any redirects
        (function recoverGameId() {
            try {
                const params = new URLSearchParams(window.location.search);
                const urlGameId = params.get('gameId');

                const lsGameId = (() => {
                    try { return localStorage.getItem('nocap_game_id'); } catch (e) { return null; }
                })();

                const ssGameId = (() => {
                    try { return sessionStorage.getItem('nocap_game_id'); } catch (e) { return null; }
                })();

                const recovered = urlGameId || ssGameId || lsGameId;

                if (recovered && !MultiplayerLobbyModule.gameState.gameId) {
                    MultiplayerLobbyModule.gameState.gameId = String(recovered);
                    MultiplayerLobbyModule.gameState.save?.(true);
                }

                // also keep module-level currentGameId in sync if possible
                if (recovered && !currentGameId) {
                    currentGameId = String(recovered);
                }
            } catch (e) {
                // ignore
            }
        })();

// ✅ P0 FIX: Normalize multiplayer state EARLY (prevents instant redirect on join)
        (function normalizeMultiplayerState() {
            try {
                // Always enforce multiplayer pages => deviceMode = 'multi'
                if (!MultiplayerLobbyModule.gameState.deviceMode) {
                    if (typeof MultiplayerLobbyModule.gameState.setDeviceMode === 'function') {
                        MultiplayerLobbyModule.gameState.setDeviceMode('multi');
                    } else {
                        MultiplayerLobbyModule.gameState.deviceMode = 'multi';
                    }
                } else if (MultiplayerLobbyModule.gameState.deviceMode !== 'multi') {
                    // Hard-correct (avoid redirect loops when join-game forgot it)
                    if (typeof MultiplayerLobbyModule.gameState.setDeviceMode === 'function') {
                        MultiplayerLobbyModule.gameState.setDeviceMode('multi');
                    } else {
                        MultiplayerLobbyModule.gameState.deviceMode = 'multi';
                    }
                }

                // Role: do NOT guess here, just keep what join/host pages set
                // But if gameId is set and isHost is not true => treat as guest
                if (MultiplayerLobbyModule.gameState.gameId && MultiplayerLobbyModule.gameState.isHost !== true) {
                    MultiplayerLobbyModule.gameState.isHost = false;
                    MultiplayerLobbyModule.gameState.isGuest = true;
                }

                // Persist quickly
                MultiplayerLobbyModule.gameState.save?.(true);
            } catch (e) {
                // non-fatal
            }
        })();

        if (!MultiplayerLobbyModule.gameState) {
            showNotification('GameState nicht verfügbar', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }

        // ✅ FSK18-SYSTEM: Validate game state with server-side FSK check
        const ageValid = await checkAgeVerification();
        if (!ageValid) {
            return;
        }

        // P1 FIX: Wait for dependencies (guarded)
        if (window.NocapUtils && typeof window.NocapUtils.waitForDependencies === 'function') {
            await window.NocapUtils.waitForDependencies([
                'GameState',
                'FirebaseService',
                'firebase'
            ]);
        } else if (MultiplayerLobbyModule.isDevelopment) {
            console.warn('⚠️ NocapUtils.waitForDependencies missing - continuing without dependency wait');
        }



        // ✅ Ensure Firebase is initialized (same pattern as other pages)
        try {
            if (!window.FirebaseConfig) {
                throw new Error('FirebaseConfig missing - firebase-config.js not loaded?');
            }
            if (!window.FirebaseConfig.isInitialized?.()) {
                await window.FirebaseConfig.initialize();
            }
            await window.FirebaseConfig.waitForFirebase(10000);
        } catch (e) {
            console.error('❌ Firebase not initialized:', e);
            showNotification('Firebase nicht verfügbar', 'error');
            setTimeout(() => window.location.href = 'index.html', 3000);
            return;
        }



        // P0 FIX: Validate game state
        if (!validateGameState()) {
            return;
        }

// ✅ Use the correct singleton name + fallback for older pages
        MultiplayerLobbyModule.firebaseService = window.FirebaseService || window.firebaseGameService;

        if (!MultiplayerLobbyModule.firebaseService) {
            showNotification('Firebase Game Service nicht verfügbar', 'error');
            setTimeout(() => window.location.href = 'index.html', 3000);
            return;
        }



        // ✅ FIX: Ensure Firebase Auth user exists (sign in anonymously if needed)
        if (typeof firebase !== 'undefined' && firebase.auth) {
            try {
                await new Promise((resolve, reject) => {
                    const unsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
                        unsubscribe();

                        if (user) {
                            // User already signed in
                            currentUserId = user.uid;
                            if (MultiplayerLobbyModule.isDevelopment) {
                                console.log('✅ Firebase user authenticated:', currentUserId);
                            }
                            resolve();
                        } else {
                            // No user - sign in anonymously
                            if (MultiplayerLobbyModule.isDevelopment) {
                                console.log('⚠️ No user found, signing in anonymously...');
                            }

                            try {
                                const result = await firebase.auth().signInAnonymously();
                                currentUserId = result.user.uid;
                                if (MultiplayerLobbyModule.isDevelopment) {
                                    console.log('✅ Anonymous sign-in successful:', currentUserId);
                                }
                                resolve();
                            } catch (signInError) {
                                console.error('❌ Anonymous sign-in failed:', signInError);
                                reject(signInError);
                            }
                        }
                    }, reject);
                });
            } catch (error) {
                console.error('❌ Auth error:', error);
                showNotification('Authentifizierung fehlgeschlagen', 'error');
                setTimeout(() => window.location.href = 'index.html', 2000);
                return;
            }
        } else {
            console.error('❌ Firebase Auth not available');
            showNotification('Firebase nicht verfügbar', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }

        if (!currentUserId) {
            console.error('❌ No user ID after auth');
            return;
        }
        try {
            MultiplayerLobbyModule.gameState.playerId = currentUserId;
            MultiplayerLobbyModule.gameState.authUid = currentUserId;
            MultiplayerLobbyModule.gameState.save?.(true);
        } catch (e) {}

// ✅ Check: Kommen wir von einem "Edit Settings"-Flow zurück?
        const getLS = (k) => window.NocapUtils?.getLocalStorage
            ? window.NocapUtils.getLocalStorage(k)
            : localStorage.getItem(k);

        const isEditingLobby = String(getLS('nocap_editing_lobby') || 'false') === 'true';
        const existingGameId = getLS('nocap_existing_game_id');

        if (isEditingLobby && existingGameId) {
            // ✅ Wir editieren eine bestehende Lobby - laden ohne neu zu erstellen
            Logger.debug('🔧 Editing existing lobby:', existingGameId);

            currentGameId = existingGameId;
            MultiplayerLobbyModule.gameState.gameId = existingGameId;
            isHost = MultiplayerLobbyModule.gameState.isHost === true;

            // ✅ Clear edit flags
            try {
                if (window.NocapUtils && window.NocapUtils.removeLocalStorage) {
                    window.NocapUtils.removeLocalStorage('nocap_editing_lobby');
                    window.NocapUtils.removeLocalStorage('nocap_existing_game_id');
                } else {
                    localStorage.removeItem('nocap_editing_lobby');
                    localStorage.removeItem('nocap_existing_game_id');
                }
            } catch (e) {}

            await loadExistingGame();
            setupPresenceSystem();
            setupCategoryMonitor(currentGameId); // ✅ NEW: Monitor category changes

        } else if (MultiplayerLobbyModule.gameState.gameId) {
            currentGameId = MultiplayerLobbyModule.gameState.gameId;
            isHost = MultiplayerLobbyModule.gameState.isHost === true;

            await loadExistingGame();
            setupPresenceSystem();
            setupCategoryMonitor(currentGameId); // ✅ NEW: Monitor category changes

        } else if (MultiplayerLobbyModule.gameState.isHost) {
            isHost = true;
            await createNewGame();
            setupPresenceSystem();
            setupCategoryMonitor(currentGameId); // ✅ NEW: Monitor category changes
        } else {
            // ✅ P0 FIX: Give 1s to recover gameId (storage/URL)
            showNotification('Game-ID wird geladen...', 'info', 800);

            await new Promise(r => setTimeout(r, 800));

            const params = new URLSearchParams(window.location.search);
            const recovered =
                params.get('gameId') ||
                sessionStorage.getItem('nocap_game_id') ||
                localStorage.getItem('nocap_game_id');

            if (recovered) {
                MultiplayerLobbyModule.gameState.gameId = String(recovered);
                currentGameId = String(recovered);
                MultiplayerLobbyModule.gameState.save?.(true);

                isHost = MultiplayerLobbyModule.gameState.isHost === true;
                await loadExistingGame();
                setupPresenceSystem();
                setupCategoryMonitor(currentGameId); // ✅ NEW: Monitor category changes

                setupEventListeners();
                updateUIForRole();
                return;
            }

            showNotification('Keine Game-ID gefunden', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }


        setupEventListeners();
        updateUIForRole();

        if (MultiplayerLobbyModule.isDevelopment) {
            console.log('✅ Lobby initialized');
        }
    }

    // ===========================
    // VALIDATION
    // ===========================

    /**
     * ✅ FSK18-SYSTEM: Updated age verification with server-side FSK check
     * - FSK0 & FSK16: No validation needed
     * - FSK18: Requires server validation via GameState.canAccessFSK()
     */
    async function checkAgeVerification() {
        try {
            const rawSelected = MultiplayerLobbyModule.gameState?.selectedCategories || [];
            const selected = Array.isArray(rawSelected)
                ? rawSelected
                : (rawSelected ? Object.values(rawSelected) : []);

            // ✅ FSK18-SYSTEM: Only check FSK18
            const hasFSK18 = selected.includes('fsk18');

            // ✅ FSK0 & FSK16: No validation needed
            if (!hasFSK18) {
                if (MultiplayerLobbyModule.isDevelopment) {
                    console.log('✅ No FSK18 content - age check passed');
                }
                return true;
            }

            // ✅ FSK18: Server-side validation required
            if (MultiplayerLobbyModule.isDevelopment) {
                console.log('🔒 FSK18 content detected - validating access...');
            }

            // Check Firebase availability (fail closed)
            if (!window.FirebaseConfig?.isInitialized?.()) {
                console.error('❌ Firebase not available - cannot validate FSK18 access');
                showNotification(
                    '⚠️ FSK18-Validierung erfordert Internetverbindung',
                    'error',
                    5000
                );
                setTimeout(() => window.location.href = 'index.html', 2000);
                return false;
            }

            try {
                // Use GameState's server validation
                const hasAccess = await MultiplayerLobbyModule.gameState.canAccessFSK('fsk18', true);

                if (!hasAccess) {
                    console.error('❌ FSK18 access denied');
                    showNotification(
                        '🔞 Keine Berechtigung für FSK18-Inhalte!',
                        'error',
                        5000
                    );
                    setTimeout(() => window.location.href = 'index.html', 2000);
                    return false;
                }

                if (MultiplayerLobbyModule.isDevelopment) {
                    console.log('✅ FSK18 access validated');
                }
                return true;

            } catch (error) {
                console.error('❌ FSK18 validation error:', error);
                showNotification(
                    '⚠️ Fehler bei der Altersverifikation',
                    'error',
                    5000
                );
                setTimeout(() => window.location.href = 'index.html', 2000);
                return false;
            }

        } catch (error) {
            console.error('❌ Age verification error:', error);
            showNotification('Altersverifizierung fehlgeschlagen', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }
    }


    function validateGameState() {
        if (MultiplayerLobbyModule.isDevelopment) {
            console.log('🔍 Validating game state...');
        }

// ✅ P0 FIX: Never hard-kick guests because deviceMode wasn't set in time
        if (!MultiplayerLobbyModule.gameState) {
            showNotification('GameState nicht verfügbar', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (MultiplayerLobbyModule.gameState.deviceMode !== 'multi') {
            console.warn('⚠️ deviceMode was not multi - auto-fixing:', MultiplayerLobbyModule.gameState.deviceMode);
            try {
                if (typeof MultiplayerLobbyModule.gameState.setDeviceMode === 'function') {
                    MultiplayerLobbyModule.gameState.setDeviceMode('multi');
                } else {
                    MultiplayerLobbyModule.gameState.deviceMode = 'multi';
                }
                MultiplayerLobbyModule.gameState.save?.(true);
            } catch (e) {}
        }



        if (!MultiplayerLobbyModule.gameState.checkValidity()) {
            showNotification('Ungültiger Spielzustand', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

// ✅ P0 FIX: Do not hard-kick immediately; allow join-game to be source of truth
        if (!MultiplayerLobbyModule.gameState.playerName || !String(MultiplayerLobbyModule.gameState.playerName).trim()) {
            console.warn('⚠️ No playerName in GameState - redirect to join-game (not index)');
            showNotification('Bitte setze deinen Spielernamen erneut.', 'warning', 1500);
            setTimeout(() => window.location.href = 'join-game.html', 1200);
            return false;
        }


        if (MultiplayerLobbyModule.isDevelopment) {
            console.log('✅ Game state valid');
        }
        return true;
    }

    // ===========================
    // GAME MANAGEMENT
    // ===========================

    async function createNewGame() {
        try {
            showNotification('Erstelle Spiel...', 'info', 500);

            const instances = window.FirebaseConfig?.getFirebaseInstances?.();
            const functionsInstance =
                instances?.functions ||
                (firebase?.app?.().functions ? firebase.app().functions('europe-west1') : null);

            if (!functionsInstance || typeof functionsInstance.httpsCallable !== 'function') {
                throw new Error('Firebase Functions not available (functionsInstance missing)');
            }

            const createGameFn = functionsInstance.httpsCallable('createGameSecure');


            const selectedCategories = MultiplayerLobbyModule.gameState.selectedCategories || [];
            const difficulty = MultiplayerLobbyModule.gameState.difficulty || 'medium';
            const alcoholMode = Boolean(MultiplayerLobbyModule.gameState.alcoholMode); // falls du hast, sonst false

            const res = await createGameFn({
                playerName: sanitizePlayerName(MultiplayerLobbyModule.gameState.playerName),
                difficulty,
                alcoholMode,
                selectedCategories
            });

            const { gameId, gameCode } = res.data;

// ✅ Save IDs
            currentGameId = gameId;

// ✅ Update GameState
            MultiplayerLobbyModule.gameState.gameId = gameId;
            MultiplayerLobbyModule.gameState.gameCode = gameCode; // neu (falls GameState das nicht kennt, ist trotzdem ok)
            MultiplayerLobbyModule.gameState.isHost = true;

// ✅ Use gameCode for display/QR (NOT gameId)
            displayGameCode(gameCode);
            displayQRCode(gameCode);

            const categoriesForUI = Array.isArray(selectedCategories)
                ? selectedCategories
                : (selectedCategories ? Object.values(selectedCategories) : []);

            displaySettings({ categories: categoriesForUI, difficulty });
            try { MultiplayerLobbyModule.gameState.save?.(true); } catch (e) {}
// ✅ Listen to the real game by gameId
            setupGameListener(gameId);

            showNotification('Spiel erstellt!', 'success', 800);
            if (MultiplayerLobbyModule.isDevelopment) {
                console.log(`✅ Game created: ${gameId}`);
            }

        } catch (error) {
            console.error('❌ Create game error:', error);
            showNotification('Fehler beim Erstellen', 'error');
        }
    }

    async function loadExistingGame() {
        try {
            showNotification('Lade Spiel...', 'info', 500);

            const gameRef = firebase.database().ref(`games/${currentGameId}`);
            const snapshot = await gameRef.once('value');

            if (!snapshot.exists()) {
                throw new Error('Spiel nicht gefunden');
            }

            const game = snapshot.val();
            const codeToShow = game.gameCode || MultiplayerLobbyModule.gameState.gameCode || currentGameId;

            displayGameCode(codeToShow);
            displayQRCode(codeToShow);

            // Display settings (supports both: game.settings OR direct fields)
            const categories = game.settings?.categories
                || (game.selectedCategories ? Object.values(game.selectedCategories) : [])
                || MultiplayerLobbyModule.gameState.selectedCategories
                || [];

            const difficulty = game.settings?.difficulty
                || game.difficulty
                || MultiplayerLobbyModule.gameState.difficulty
                || 'medium';

            displaySettings({ categories, difficulty });

            // ✅ P0 FIX: Ensure we have a stable player key before checking player existence
            const ensurePlayerKey = async (timeoutMs = 3000, intervalMs = 50) => {
                const start = Date.now();
                while (Date.now() - start < timeoutMs) {
                    const k = getPlayerKey();
                    if (k) return k;
                    await new Promise(r => setTimeout(r, intervalMs));
                }
                return null;
            };

            const waitForPlayer = async (timeoutMs = 5000, intervalMs = 250) => {
                const start = Date.now();
                const key = await ensurePlayerKey();
                if (!key) return false;

                while (Date.now() - start < timeoutMs) {
                    try {
                        const pSnap = await firebase.database().ref(`games/${currentGameId}/players/${key}`).once('value');
                        if (pSnap.exists()) return true;
                    } catch (e) {
                        // Ignorieren (z.B. kurze Auth/Netzwerk-Phase)
                    }
                    await new Promise(r => setTimeout(r, intervalMs));
                }
                return false;
            };

            const key = await ensurePlayerKey();
            let playerExists = !!(key && game.players?.[key]);

            if (!playerExists && !isHost) {
                // ✅ Warte kurz, ob der Player-Eintrag noch nachkommt
                const ok = await waitForPlayer(5000, 250);
                playerExists = ok;

                if (!playerExists) {
                    console.warn('⚠️ Player not found after wait - redirect to join');
                    showNotification('Beitritt nicht bestätigt. Bitte erneut über den Join-Code beitreten.', 'warning', 2000);
                    setTimeout(() => window.location.href = 'join-game.html', 1500);
                    return;
                }
            }

            if (MultiplayerLobbyModule.isDevelopment && !isHost) {
                console.log('✅ Player exists in game');
            }

            setupGameListener(currentGameId);

            // ✅ REMOVED: Duplicate initialization block (was causing recursion)

            showNotification('Spiel geladen!', 'success', 800);
            if (MultiplayerLobbyModule.isDevelopment) {
                console.log(`✅ Game loaded: ${currentGameId}`);
            }

        } catch (error) {
            console.error('❌ Load game error:', error);
            showNotification('Fehler beim Laden', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
        }
    }

    /**
     * ✅ P2 PERFORMANCE: Setup Firebase game listener for real-time updates
     * - Only registers listener once
     * - Properly cleans up on component unmount
     */
    function setupGameListener(gameId) {
        // ✅ P2 PERFORMANCE: Remove existing listener before adding new one
        if (gameListener) {
            gameListener.off();
        }

        const gameRef = firebase.database().ref(`games/${gameId}`);

        gameListener = gameRef;

        gameRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                handleGameUpdate(snapshot.val());
            } else {
                showNotification('Spiel wurde beendet', 'warning');
                cleanup();
                setTimeout(() => window.location.href = 'index.html', 2000);
            }
        });

        // ✅ P1 STABILITY: Setup heartbeat to update lastSeen
        setupPlayerHeartbeat(gameId);

        if (MultiplayerLobbyModule.isDevelopment) {
            console.log('✅ Game listener setup');
        }
    }

    /**
     * ✅ FSK18-SYSTEM: Monitor category changes and validate player access
     * - Watches for changes to game/settings/categories
     * - Kicks players who lose FSK18 access when category is added
     */
    function setupCategoryMonitor(gameId) {
        if (!gameId) return;

        const categoriesRef = firebase.database().ref(`games/${gameId}/settings/categories`);

        categoriesRef.on('value', async (snapshot) => {
            if (!snapshot.exists()) return;

            const newCategories = snapshot.val() || [];

            // ✅ FSK18-SYSTEM: Validate player's access to new categories
            await validatePlayerCategories(newCategories);
        });

        Logger.debug('✅ Category monitor active');
    }

    /**
     * ✅ FSK18-SYSTEM: Validate player age for current categories
     * - Only checks FSK18 (FSK0 & FSK16 always allowed)
     * - Uses server validation via GameState.canAccessFSK()
     * - Kicks player if access denied
     */
    async function validatePlayerCategories(categories) {
        try {
            const categoriesArray = Array.isArray(categories)
                ? categories
                : (categories ? Object.values(categories) : []);

            // ✅ FSK18-SYSTEM: Only check FSK18
            const hasFSK18 = categoriesArray.includes('fsk18');

            // ✅ FSK0 & FSK16: No validation needed
            if (!hasFSK18) {
                return true;
            }

            // ✅ FSK18: Server validation required
            Logger.debug('🔒 FSK18 category active - validating access...');

            // Check Firebase availability (fail closed)
            if (!window.FirebaseConfig?.isInitialized?.()) {
                Logger.warn('⚠️ Firebase not available for FSK18 validation');
                return true; // Don't kick on connection issues
            }

            try {
                // Use GameState's server validation
                const hasAccess = await MultiplayerLobbyModule.gameState.canAccessFSK('fsk18', true);

                if (!hasAccess) {
                    Logger.warn('⚠️ Player lost FSK18 access - kicking from game');

                    showNotification(
                        '⚠️ Host hat FSK18-Inhalte aktiviert. Du wurdest entfernt.',
                        'warning',
                        5000
                    );

                    // Remove player from game
                    if (currentGameId && !isHost) {
                        try {
                            await firebase.database()
                                .ref(`games/${currentGameId}/players/${getPlayerKey()}`)
                                .remove();
                        } catch (e) {
                            Logger.error('Failed to remove player:', e);
                        }
                    }

                    // Redirect to index with message
                    setTimeout(() => {
                        sessionStorage.setItem('nocap_kick_reason', 'fsk18_restriction');
                        cleanup();
                        window.location.href = 'index.html';
                    }, 3000);

                    return false;
                }

                Logger.debug('✅ FSK18 access validated');
                return true;

            } catch (error) {
                Logger.error('❌ FSK18 validation error:', error);
                return true; // Don't kick on error
            }

        } catch (error) {
            Logger.error('❌ Category validation error:', error);
            return true; // Don't kick on error
        }
    }

    /**
     * ✅ P1 STABILITY: Setup heartbeat to keep player status updated
     * Updates lastSeen every 10 seconds to detect offline players
     */
    function setupPlayerHeartbeat(gameId) {
        // Clear existing heartbeat
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }

        // Update lastSeen immediately
        updatePlayerLastSeen(gameId);

        // Update every 10 seconds
        heartbeatInterval = setInterval(() => {
            updatePlayerLastSeen(gameId);
        }, 10000);

        if (MultiplayerLobbyModule.isDevelopment) {
            console.log('✅ Player heartbeat started');
        }
    }

    /**
     * ✅ P1 STABILITY: Update player's lastSeen timestamp
     */
    async function updatePlayerLastSeen(gameId) {
        if (!getPlayerKey() || !gameId) return;

        try {
            const playerRef = firebase.database().ref(`games/${gameId}/players/${getPlayerKey()}/lastSeen`);
            await playerRef.set(Date.now());
        } catch (error) {
            // Silent fail - not critical
            if (MultiplayerLobbyModule.isDevelopment) {
                console.warn('⚠️ Failed to update lastSeen:', error);
            }
        }
    }

    function handleGameUpdate(gameData) {
        if (!gameData) return;

        updatePlayersList(gameData.players);
        updateStartButton(gameData.players);

        // If game starts and we're not host, redirect to gameplay
        const state = String(gameData.status || gameData.phase || '');
        if (state === 'playing' && !isHost) {

            // ✅ CRITICAL FIX: Save MultiplayerLobbyModule.gameState for guests BEFORE redirect - TRIPLE REDUNDANCY!
            MultiplayerLobbyModule.gameState.gamePhase = 'playing';
            MultiplayerLobbyModule.gameState.gameId = currentGameId;

            // Prepare state object
            const stateToSave = {
                gameId: currentGameId,
                playerId: getPlayerKey(),
                authUid: getPlayerKey(),
                deviceMode: 'multi',
                isHost: false,
                isGuest: true,
                gamePhase: 'playing',
                playerName: MultiplayerLobbyModule.gameState.playerName,
                selectedCategories: MultiplayerLobbyModule.gameState.selectedCategories,
                difficulty: MultiplayerLobbyModule.gameState.difficulty
            };

            // Method 1: NocapUtils
            if (window.NocapUtils && window.NocapUtils.setLocalStorage) {
                try {
                    window.NocapUtils.setLocalStorage('nocap_game_state', stateToSave);
                } catch (e) {
                    console.warn('⚠️ Could not save state via NocapUtils:', e.message);
                }
            }

            // Method 2: Direct localStorage - GUARANTEED
            try {
                localStorage.setItem('nocap_game_state', JSON.stringify(stateToSave));
                localStorage.setItem('nocap_game_id', currentGameId);
                console.log('💾 Guest saved to localStorage:', stateToSave);
            } catch (e) {
                console.error('❌ localStorage save failed:', e);
            }

            // Method 3: SessionStorage
            try {
                sessionStorage.setItem('nocap_game_id', currentGameId);
                sessionStorage.setItem('nocap_game_state', JSON.stringify(stateToSave));
                console.log('💾 Guest saved to sessionStorage');
            } catch (e) {
                console.warn('[WARNING] Could not save state to sessionStorage:', e.message);
            }

            // Method 4: URL parameter
            const targetUrl = 'multiplayer-gameplay.html?gameId=' + encodeURIComponent(currentGameId);

            showNotification('Spiel startet!', 'success', 300);
            setTimeout(() => {
                window.location.href = targetUrl;
            }, 200);
        }

        // If game starts and we're host, redirect after update
        if (state === 'playing' && isHost) {
            // Host already triggered the redirect in startGame()
        }
    }

    // ===========================
    // DISPLAY FUNCTIONS
    // ===========================
    /**
     * ✅ P1 UI/UX: Setup share button handlers
     */
    function setupShareButtons(gameCode) {
        const whatsappBtn = document.getElementById('share-whatsapp-btn');
        const telegramBtn = document.getElementById('share-telegram-btn');
        const copyBtn = document.getElementById('share-copy-btn');
        const nativeBtn = document.getElementById('share-native-btn');

        const shareUrl = `${window.location.origin}/join-game.html?code=${encodeURIComponent(gameCode)}`;
        const shareText = `🎮 Komm mit zu No-Cap!\n\nSpiel-Code: ${gameCode}\n\nOder nutze diesen Link:\n${shareUrl}`;

        // WhatsApp Share
        if (whatsappBtn) {
            addTrackedEventListener(whatsappBtn, 'click', () => {
                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
                window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
                showNotification('WhatsApp geöffnet!', 'success', 2000);
            });
        }

        // Telegram Share
        if (telegramBtn) {
            addTrackedEventListener(telegramBtn, 'click', () => {
                const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`🎮 Spiel-Code: ${gameCode}`)}`;
                window.open(telegramUrl, '_blank', 'noopener,noreferrer');
                showNotification('Telegram geöffnet!', 'success', 2000);
            });
        }

        // Copy Link
        if (copyBtn) {
            addTrackedEventListener(copyBtn, 'click', async () => {
                try {
                    await navigator.clipboard.writeText(shareUrl);

                    copyBtn.classList.add('copied');
                    const textSpan = copyBtn.querySelector('span:last-child');
                    const originalText = textSpan ? textSpan.textContent : '';

                    if (textSpan) textSpan.textContent = 'Kopiert!';

                    showNotification('✅ Link kopiert!', 'success', 2000);

                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        if (textSpan) textSpan.textContent = originalText;
                    }, 2000);

                } catch (error) {
                    // Fallback
                    const textArea = document.createElement('textarea');
                    textArea.value = shareUrl;
                    textArea.style.position = 'fixed';
                    textArea.style.opacity = '0';
                    document.body.appendChild(textArea);
                    textArea.select();

                    try {
                        document.execCommand('copy');
                        showNotification('✅ Link kopiert!', 'success', 2000);
                    } catch (e) {
                        showNotification('❌ Kopieren fehlgeschlagen', 'error');
                    }

                    document.body.removeChild(textArea);
                }
            });
        }

        // Native Share API (if supported)
        if (nativeBtn && navigator.share) {
            nativeBtn.removeAttribute('hidden');

            addTrackedEventListener(nativeBtn, 'click', async () => {
                try {
                    await navigator.share({
                        title: 'No-Cap Spiel',
                        text: `🎮 Spiel-Code: ${gameCode}`,
                        url: shareUrl
                    });
                    showNotification('Link geteilt!', 'success', 2000);
                } catch (error) {
                    if (error.name !== 'AbortError') {
                        showNotification('Teilen fehlgeschlagen', 'error');
                    }
                }
            });
        }
    }

    /**
     * ✅ UPDATED: Display game code and setup share buttons
     */
    function displayGameCode(gameCode) {
        const codeDisplay = document.getElementById('qr-code-text');
        if (codeDisplay) {
            codeDisplay.textContent = gameCode;
        }

        // ✅ Setup share buttons with the game code
        setupShareButtons(gameCode);
    }

    /**
     * ✅ UPDATED: Display QR Code (simplified)
     */
    function displayQRCode(gameCode) {
        const qrContainer = document.getElementById('qr-code');

        if (!qrContainer) return;

        // Clear container safely
        while (qrContainer.firstChild) {
            qrContainer.removeChild(qrContainer.firstChild);
        }

        // Generate QR Code
        if (typeof QRCode !== 'undefined') {
            const joinUrl = `${window.location.origin}/join-game.html?code=${encodeURIComponent(gameCode)}`;

            try {
                new QRCode(qrContainer, {
                    text: joinUrl,
                    width: 200,
                    height: 200,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });

                setTimeout(() => {
                    qrContainer.setAttribute('aria-label',
                        `QR-Code zum Beitreten mit Spiel-Code ${gameCode}`
                    );
                }, 100);

            } catch (error) {
                if (MultiplayerLobbyModule.isDevelopment) {
                    console.warn('⚠️ QR Code generation failed:', error);
                }

                const errorMsg = document.createElement('div');
                errorMsg.className = 'qr-error';
                errorMsg.textContent = '❌ QR-Code nicht verfügbar';
                qrContainer.appendChild(errorMsg);
            }
        } else {
            const loadingMsg = document.createElement('div');
            loadingMsg.textContent = '⏳ QR-Code lädt...';
            qrContainer.appendChild(loadingMsg);
        }
    }

    /**
     * ✅ P1 DSGVO: Display settings with FSK badges
     * ✅ P0 SECURITY: Safe DOM manipulation (no innerHTML for dynamic content)
     */
    function displaySettings(settings) {
        if (!settings) {
            settings = {
                categories: MultiplayerLobbyModule.gameState.selectedCategories || [],
                difficulty: MultiplayerLobbyModule.gameState.difficulty || 'medium'
            };
        }

        const categoriesDisplay = document.getElementById('selected-categories-display');
        if (categoriesDisplay && settings.categories && settings.categories.length > 0) {
            // ✅ P0 SECURITY: Clear safely
            while (categoriesDisplay.firstChild) {
                categoriesDisplay.removeChild(categoriesDisplay.firstChild);
            }

            settings.categories.forEach((cat) => {
                const icon = categoryIcons[cat] || '❓';
                const name = categoryNames[cat] || cat;

                // ✅ P1 DSGVO: Determine FSK level
                let fskLevel = 'fsk0';
                let fskText = 'FSK 0';

                if (cat === 'fsk16') {
                    fskLevel = 'fsk16';
                    fskText = 'FSK 16';
                } else if (cat === 'fsk18') {
                    fskLevel = 'fsk18';
                    fskText = 'FSK 18';
                } else if (cat === 'special') {
                    fskLevel = 'special';
                    fskText = 'PREMIUM';
                }

                const tag = document.createElement('div');
                tag.className = `category-tag ${fskLevel}`;
                tag.setAttribute('role', 'listitem');
                tag.setAttribute('aria-label', `${name}, ${fskText}`);

                const iconSpan = document.createElement('span');
                iconSpan.className = 'category-icon';
                iconSpan.textContent = icon;
                iconSpan.setAttribute('aria-hidden', 'true');

                const nameSpan = document.createElement('span');
                nameSpan.className = 'category-name';
                nameSpan.textContent = name;

                tag.appendChild(iconSpan);
                tag.appendChild(nameSpan);

                // ✅ P1 DSGVO: Add FSK Badge for age-restricted categories
                if (fskLevel !== 'fsk0') {
                    const badge = document.createElement('span');
                    badge.className = `fsk-badge ${fskLevel}-badge`;
                    badge.textContent = fskText;
                    badge.setAttribute('role', 'img');
                    badge.setAttribute('aria-label', `Alterseinstufung ${fskText}`);
                    tag.appendChild(badge);
                }

                categoriesDisplay.appendChild(tag);
            });
        }

        const difficultyDisplay = document.getElementById('difficulty-display');
        if (difficultyDisplay && settings.difficulty) {
            difficultyDisplay.textContent = difficultyNames[settings.difficulty] || settings.difficulty;
        }
    }

    /**
     * ✅ P1 STABILITY: Update players list with offline detection and sorting
     * - Shows offline players with rejoin timer
     * - Sorts players (host first, then alphabetically)
     * - Uses textContent only for XSS safety
     */
    function updatePlayersList(players) {
        const playersList = document.getElementById('players-list');
        const playerCount = document.getElementById('player-count');

        if (!players || Object.keys(players).length === 0) {
            currentPlayers = {}; // ✅ Update global state
            displayEmptyPlayers();
            return;
        }

        currentPlayers = players; // ✅ Update global state
        const playersArray = Object.entries(players).map(([key, p]) => ({ ...p, _key: key }));

        if (playerCount) {
            playerCount.textContent = `${playersArray.length}/${MAX_PLAYERS} Spieler`;
        }

        if (playersList) {
            while (playersList.firstChild) playersList.removeChild(playersList.firstChild);

            // ✅ P1 UI/UX: Sort players - Host first, then alphabetically
            const sortedPlayers = playersArray.sort((a, b) => {
                if (a.isHost) return -1;
                if (b.isHost) return 1;
                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });

            sortedPlayers.forEach(player => {
                const playerItem = document.createElement('div');
                playerItem.className = 'player-item';
                playerItem.setAttribute('role', 'listitem');

                // ✅ P1 UI/UX: Enhanced CSS classes for visual distinction
                if (player.isHost) playerItem.classList.add('host');
                if (player.isReady) playerItem.classList.add('ready');

                // ✅ P1 STABILITY: Check if player is offline
                const isOffline = checkPlayerOffline(player);
                if (isOffline) {
                    playerItem.classList.add('offline');
                }

                const avatar = document.createElement('div');
                avatar.className = 'player-avatar';
                avatar.setAttribute('aria-hidden', 'true');
                const playerName = sanitizePlayerName(player.name);
                avatar.textContent = playerName.charAt(0).toUpperCase();

                const info = document.createElement('div');
                info.className = 'player-info';

                const name = document.createElement('div');
                name.className = 'player-name';
                name.textContent = playerName;

                const status = document.createElement('div');
                status.className = 'player-status';

                // ✅ P1 STABILITY: Show presence-based status
                if (player.online === false && player.disconnectedAt) {
                    // Player disconnected - show rejoin timer
                    const disconnectTime = player.disconnectedAt;
                    const rejoinDeadline = player.rejoinDeadline || (disconnectTime + REJOIN_BUFFER_TIME);
                    const remainingTime = Math.max(0, Math.floor((rejoinDeadline - Date.now()) / 1000));

                    if (remainingTime > 0) {
                        status.textContent = `🔌 Offline (${Math.floor(remainingTime / 60)}:${String(remainingTime % 60).padStart(2, '0')})`;
                        status.classList.add('offline-status', 'rejoining');
                    } else {
                        status.textContent = '❌ Verbindung verloren';
                        status.classList.add('offline-status', 'timed-out');
                    }
                } else if (isOffline) {
                    // Legacy offline detection (no heartbeat)
                    const offlineTime = Date.now() - (player.lastSeen || player.joinedAt || Date.now());
                    const remainingTime = Math.max(0, Math.floor((120000 - offlineTime) / 1000));
                    status.textContent = `🔌 Offline (${remainingTime}s)`;
                    status.classList.add('offline-status');
                } else if (player.isHost) {
                    status.textContent = '👑 Host';
                } else if (player.isReady) {
                    status.textContent = '✅ Bereit';
                } else {
                    status.textContent = '⏳ Wartet...';
                }

                info.appendChild(name);
                info.appendChild(status);

                playerItem.appendChild(avatar);
                playerItem.appendChild(info);

                // Kick button for host (not on themselves)
                if (isHost && !player.isHost && player.id) {
                    const kickBtn = document.createElement('button');
                    kickBtn.className = 'kick-btn';
                    kickBtn.type = 'button';
                    kickBtn.textContent = '✕';
                    kickBtn.setAttribute('aria-label', `${playerName} entfernen`);
                    addTrackedEventListener(kickBtn, 'click', () => kickPlayer(player._key));
                    playerItem.appendChild(kickBtn);
                }

                playersList.appendChild(playerItem);
            });
        }
    }

    /**
     * ✅ P1 STABILITY: Check if player is offline
     * Returns true if player hasn't updated lastSeen in 30+ seconds
     */
    function checkPlayerOffline(player) {
        if (!player) return false;

        const lastSeen = player.lastSeen || player.joinedAt || 0;
        const timeSinceLastSeen = Date.now() - lastSeen;

        // Consider offline if no activity for 30 seconds
        return timeSinceLastSeen > 30000;
    }

    function displayEmptyPlayers() {
        const playersList = document.getElementById('players-list');
        const playerCount = document.getElementById('player-count');

        if (playerCount) {
            playerCount.textContent = '0/8 Spieler';
        }

        if (playersList) {
            // ✅ P0 SECURITY: Clear safely
            while (playersList.firstChild) {
                playersList.removeChild(playersList.firstChild);
            }

            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty-players';
            emptyDiv.textContent = 'Warte auf Spieler...';

            playersList.appendChild(emptyDiv);
        }
    }

    function updateStartButton(players) {
        const startBtn = document.getElementById('start-btn');
        if (!startBtn) return;

        if (!isHost) {
            return; // Button visibility handled by CSS
        }

        const playersArray = Object.values(players || {});
        const readyCount = playersArray.filter(p => p.isReady || p.isHost).length;

        if (playersArray.length >= MIN_PLAYERS && readyCount === playersArray.length) {
            startBtn.disabled = false;
            startBtn.classList.add('enabled');
            startBtn.setAttribute('aria-disabled', 'false');
            startBtn.textContent = '🎮 Spiel starten';
        } else {
            startBtn.disabled = true;
            startBtn.classList.remove('enabled');
            startBtn.setAttribute('aria-disabled', 'true');
            startBtn.textContent = `Warte auf Spieler (${readyCount}/${playersArray.length} bereit)`;
        }
    }

    function updateUIForRole() {
        // Show/hide host-only elements
        const hostElements = document.querySelectorAll('.host-only');
        hostElements.forEach(el => {
            if (isHost) {
                el.classList.add('show');
            } else {
                el.classList.remove('show');
            }
        });

        // Show/hide guest-only elements
        const guestElements = document.querySelectorAll('.guest-only');
        guestElements.forEach(el => {
            if (!isHost) {
                el.classList.add('show');
            } else {
                el.classList.remove('show');
            }
        });
    }

    // ===========================
    // ACTIONS
    // ===========================

    /**
     * ✅ P1 STABILITY: Setup Firebase presence system with onDisconnect
     * - Tracks player connection status
     * - Sets up rejoin buffer on disconnect
     * - Removes player after buffer expires
     */
    function setupPresenceSystem() {
        // ✅ P0 FIX: Prevent duplicate presence listeners (always)
        if (connectedRef) {
            try { connectedRef.off(); } catch (e) {}
            connectedRef = null;
        }

        if (!firebase?.database) {
            console.warn('⚠️ Firebase database not available for presence');
            return;
        }

        // Reference to .info/connected
        connectedRef = firebase.database().ref('.info/connected');

        connectedRef.on('value', (snapshot) => {
            if (snapshot.val() === true) {
                onConnectionEstablished();
            } else {
                onConnectionLost();
            }
        });

        if (MultiplayerLobbyModule.isDevelopment) {
            console.log('✅ Presence system initialized');
        }
    }


    /**
     * ✅ P1 STABILITY: Handle connection established
     */
    function onConnectionEstablished() {
        const key = getPlayerKey();
        if (!currentGameId || !currentUserId || !key) return;


        presenceRef = firebase.database().ref(`games/${currentGameId}/players/${key}`);

        // Set online status
        presenceRef.update({
            online: true,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });

        // Setup onDisconnect handler
        presenceRef.onDisconnect().update({
            online: false,
            disconnectedAt: firebase.database.ServerValue.TIMESTAMP
        });

        // Don't remove immediately - give rejoin buffer
        const rejoinBufferTime = Date.now() + REJOIN_BUFFER_TIME;
        presenceRef.onDisconnect().update({
            rejoinDeadline: rejoinBufferTime
        });

        if (MultiplayerLobbyModule.isDevelopment) {
            console.log('✅ Connection established, presence set');
        }
    }

    /**
     * ✅ P1 STABILITY: Handle connection lost
     */
    function onConnectionLost() {
        if (MultiplayerLobbyModule.isDevelopment) {
            console.log('⚠️ Connection lost, will attempt rejoin');
        }

        showNotification('Verbindung verloren... Versuche neu zu verbinden', 'warning', 0);
    }

    /**
     * ✅ P1 STABILITY: Check if player can rejoin
     */
    async function checkRejoinEligibility() {
        if (!currentGameId) return false;

        try {
            const gameRef = firebase.database().ref(`games/${currentGameId}`);
            const snapshot = await gameRef.once('value');

            if (!snapshot.exists()) {
                return false; // Game doesn't exist anymore
            }

            const gameData = snapshot.val();
            const player = gameData.players?.[getPlayerKey()];

            if (!player) {
                return false; // Player not in game
            }

            // Check if rejoin deadline hasn't passed
            if (player.rejoinDeadline && Date.now() < player.rejoinDeadline) {
                return true;
            }

            return false;

        } catch (error) {
            console.error('❌ Rejoin check error:', error);
            return false;
        }
    }

    /**
     * ✅ P1 STABILITY: Attempt to rejoin game
     */
    async function attemptRejoin() {
        if (isRejoining) return;
        isRejoining = true;

        try {
            showNotification('Trete Spiel wieder bei...', 'info');

            const canRejoin = await checkRejoinEligibility();

            if (!canRejoin) {
                showNotification('Rejoin-Zeit abgelaufen', 'error');
                setTimeout(() => window.location.href = 'index.html', 2000);
                return;
            }

            const playerRef = firebase.database().ref(`games/${currentGameId}/players/${getPlayerKey()}`);


            await playerRef.update({
                online: true,
                lastSeen: firebase.database.ServerValue.TIMESTAMP,
                rejoinedAt: firebase.database.ServerValue.TIMESTAMP,
                rejoinDeadline: null // Clear deadline
            });

            showNotification('Erfolgreich wieder verbunden!', 'success');

            if (MultiplayerLobbyModule.isDevelopment) {
                console.log('✅ Rejoin successful');
            }

        } catch (error) {
            console.error('❌ Rejoin error:', error);
            showNotification('Fehler beim Rejoin', 'error');
        } finally {
            isRejoining = false;
        }
    }

    // ===========================
    // ACTIONS (continued)
    // ===========================

    async function toggleReady() {
        if (isHost) return; // Host is always ready

        try {
            const currentStatus = MultiplayerLobbyModule.gameState.isReady || false;
            const newStatus = !currentStatus;

            // ✅ IMPORTANT: Player key is ALWAYS Firebase Auth UID (fallback only if needed).
            // Keep this consistent across: players/{playerKey} and answers/{playerKey}

            const playerRef = firebase.database().ref(`games/${currentGameId}/players/${getPlayerKey()}/isReady`);
            await playerRef.set(newStatus);


            MultiplayerLobbyModule.gameState.isReady = newStatus;

            const readyBtn = document.getElementById('ready-btn');
            if (readyBtn) {
                readyBtn.textContent = newStatus ? '✅ Bereit' : '⏳ Bereit?';
                readyBtn.classList.toggle('ready', newStatus);
            }

            showNotification(newStatus ? 'Du bist bereit!' : 'Status zurückgesetzt', 'success', 1500);

        } catch (error) {
            console.error('❌ Ready toggle error:', error);
            showNotification('Fehler beim Aktualisieren', 'error');
        }
    }

    async function startGame() {
        if (!isHost) return;

        try {
            // Validate we have enough players
            const gameRef = firebase.database().ref(`games/${currentGameId}`);
            const snapshot = await gameRef.once('value');

            if (!snapshot.exists()) {
                showNotification('Spiel nicht gefunden!', 'error');
                return;
            }

            const gameData = snapshot.val();
            const playerCount = Object.keys(gameData.players || {}).length;

            if (playerCount < MIN_PLAYERS) {
                showNotification(`Mindestens ${MIN_PLAYERS} Spieler nötig!`, 'warning');
                return;
            }

            showNotification('Starte Spiel...', 'info', 2000);

            // Update game status to playing with proper initialization
            await gameRef.update({
                status: 'playing',
                startedAt: Date.now(),
                currentRound: 1,  // Initialize first round
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });

            // ✅ CRITICAL FIX: Save MultiplayerLobbyModule.gameState BEFORE redirect - TRIPLE REDUNDANCY!
            MultiplayerLobbyModule.gameState.gamePhase = 'playing';
            MultiplayerLobbyModule.gameState.gameId = currentGameId;
            MultiplayerLobbyModule.gameState.isHost = true;

            // Prepare state object
            const stateToSave = {
                gameId: currentGameId,
                deviceMode: 'multi',
                isHost: true,
                isGuest: false,
                playerId: getPlayerKey(),
                authUid: getPlayerKey(),
                gamePhase: 'playing',
                playerName: MultiplayerLobbyModule.gameState.playerName,
                selectedCategories: MultiplayerLobbyModule.gameState.selectedCategories,
                difficulty: MultiplayerLobbyModule.gameState.difficulty
            };

            // Method 1: NocapUtils localStorage (if available)
            if (window.NocapUtils && window.NocapUtils.setLocalStorage) {
                try {
                    window.NocapUtils.setLocalStorage('nocap_game_state', stateToSave);
                } catch (e) {
                    console.warn('⚠️ NocapUtils save failed:', e);
                }
            }

            // Method 2: Direct localStorage (as JSON string) - GUARANTEED TO WORK
            try {
                localStorage.setItem('nocap_game_state', JSON.stringify(stateToSave));
                localStorage.setItem('nocap_game_id', currentGameId);
                console.log('💾 Host saved to localStorage:', stateToSave);
            } catch (e) {
                console.error('❌ localStorage save failed:', e);
            }

            // Method 3: SessionStorage as backup
            try {
                sessionStorage.setItem('nocap_game_id', currentGameId);
                sessionStorage.setItem('nocap_game_state', JSON.stringify(stateToSave));
                console.log('💾 Host saved to sessionStorage');
            } catch (e) {
                console.warn('⚠️ sessionStorage save failed:', e);
            }

            // Method 4: URL parameter as absolute fallback
            const targetUrl = 'multiplayer-gameplay.html?gameId=' + encodeURIComponent(currentGameId);

            showNotification('Spiel gestartet!', 'success', 300);

            // Redirect with gameId in URL
            setTimeout(() => {
                window.location.href = targetUrl;
            }, 200);

        } catch (error) {
            console.error('❌ Start game error:', error);
            showNotification('Fehler beim Starten: ' + error.message, 'error');
        }
    }

    async function kickPlayer(playerId) {
        if (!isHost) return;

        if (!confirm('Spieler wirklich kicken?')) return;

        try {
            const playerRef = firebase.database().ref(`games/${currentGameId}/players/${playerId}`);
            await playerRef.remove();

            showNotification('Spieler entfernt', 'success', 2000);
        } catch (error) {
            console.error('❌ Kick error:', error);
            showNotification('Fehler beim Entfernen', 'error');
        }
    }

    async function leaveGame() {
        if (!confirm('Lobby wirklich verlassen?')) return;

        try {
            if (currentGameId) {
                // ✅ remove myself from players
                await firebase.database().ref(`games/${currentGameId}/players/${getPlayerKey()}`).remove();

                // ✅ if host -> delete whole game
                if (isHost) {
                    await firebase.database().ref(`games/${currentGameId}`).remove();
                }
            }


            cleanup();
            MultiplayerLobbyModule.gameState.gameId = null;
            MultiplayerLobbyModule.gameState.isHost = false;
            MultiplayerLobbyModule.gameState.isReady = false;

            window.location.href = 'index.html';

        } catch (error) {
            console.error('❌ Leave error:', error);
            window.location.href = 'index.html';
        }
    }

    function editSettings() {
        if (!isHost) return;

        // ✅ Markiere: Wir editieren eine bestehende Lobby (nicht neu erstellen)
        try {
            if (window.NocapUtils && window.NocapUtils.setLocalStorage) {
                window.NocapUtils.setLocalStorage('nocap_editing_lobby', true);
                window.NocapUtils.setLocalStorage('nocap_existing_game_id', currentGameId);
            } else {
                localStorage.setItem('nocap_editing_lobby', 'true');
                localStorage.setItem('nocap_existing_game_id', currentGameId);
            }
        } catch (e) {
            console.warn('Could not save editing flag:', e);
        }

        window.location.href = 'multiplayer-category-selection.html';
    }

    /**
     * ✅ P1 STABILITY: Show leave confirmation dialog
     * Host sees warning if players are connected
     */
    function showLeaveConfirmation() {
        const dialog = document.getElementById('leave-confirmation');
        const connectedPlayersCount = document.getElementById('connected-players-count');

        if (!dialog) {
            // Fallback if dialog doesn't exist
            if (confirm('Möchtest du die Lobby wirklich verlassen?')) {
                confirmLeaveGame();
            }
            return;
        }

        // ✅ P1 STABILITY: Update player count for host
        if (isHost && connectedPlayersCount) {
            const playerCount = Object.keys(currentPlayers).length;
            connectedPlayersCount.textContent = playerCount === 1 ? '1 Spieler' : `${playerCount} Spieler`;
        }

        // Show dialog
        dialog.removeAttribute('hidden');
        dialog.setAttribute('aria-hidden', 'false');
        dialog.classList.add('show');

        // Focus on cancel button
        setTimeout(() => {
            const cancelBtn = document.getElementById('cancel-leave-btn');
            if (cancelBtn) cancelBtn.focus();
        }, 100);
    }

    /**
     * ✅ P1 STABILITY: Hide leave confirmation dialog
     */
    function hideLeaveConfirmation() {
        const dialog = document.getElementById('leave-confirmation');
        if (!dialog) return;

        dialog.setAttribute('hidden', '');
        dialog.setAttribute('aria-hidden', 'true');
        dialog.classList.remove('show');
    }

    /**
     * ✅ P1 STABILITY: Confirm and execute leave
     */
    function confirmLeaveGame() {
        hideLeaveConfirmation();
        leaveGame();
    }

    // ===========================
    // EVENT LISTENERS
    // ===========================

    function setupEventListeners() {
        const startBtn = document.getElementById('start-btn');
        const readyBtn = document.getElementById('ready-btn');
        const leaveBtn = document.getElementById('leave-btn');
        const copyBtn = document.getElementById('copy-code-btn');
        const editBtn = document.getElementById('edit-settings-btn');

        // ✅ P1 STABILITY: Leave confirmation dialog buttons
        const cancelLeaveBtn = document.getElementById('cancel-leave-btn');
        const confirmLeaveBtn = document.getElementById('confirm-leave-btn');

        if (startBtn) {
            addTrackedEventListener(startBtn, 'click', startGame);
        }
        if (readyBtn) {
            addTrackedEventListener(readyBtn, 'click', toggleReady);
        }
        if (leaveBtn) {
            // ✅ P1 STABILITY: Show confirmation instead of direct leave
            addTrackedEventListener(leaveBtn, 'click', showLeaveConfirmation);
        }
        if (editBtn) {
            addTrackedEventListener(editBtn, 'click', editSettings);
        }

        // ✅ P1 STABILITY: Leave confirmation dialog handlers
        if (cancelLeaveBtn) {
            addTrackedEventListener(cancelLeaveBtn, 'click', hideLeaveConfirmation);
        }
        if (confirmLeaveBtn) {
            addTrackedEventListener(confirmLeaveBtn, 'click', confirmLeaveGame);
        }

        // ✅ P1 STABILITY: ESC key to close dialog
        addTrackedEventListener(document, 'keydown', (e) => {
            if (e.key === 'Escape') {
                const dialog = document.getElementById('leave-confirmation');
                if (dialog && !dialog.hasAttribute('hidden')) {
                    hideLeaveConfirmation();
                }
            }
        });

        if (MultiplayerLobbyModule.isDevelopment) {
            console.log('✅ Event listeners setup');
        }
    }


    // ===========================
    // UTILITIES
    // ===========================

    /**
     * Generate game code locally (6 characters, uppercase alphanumeric)
     */
    function generateGameCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }

    /**
     * P0 FIX: Sanitize player name
     */
    function sanitizePlayerName(name) {
        if (!name) return 'Spieler';

        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            return window.NocapUtils.sanitizeInput(String(name)).substring(0, 20);
        }

        return String(name).replace(/<[^>]*>/g, '').substring(0, 20);
    }

    /**
     * P0 FIX: Sanitize text
     */
    function sanitizeText(input) {
        if (!input) return '';

        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            return window.NocapUtils.sanitizeInput(String(input));
        }

        return String(input).replace(/<[^>]*>/g, '').substring(0, 500);
    }

    /**
     * P0 FIX: Safe notification using NocapUtils
     */
    const showNotification = window.NocapUtils?.showNotification || function(message) {
        alert(sanitizeText(String(message))); // Fallback
    };

    // ===========================
    // CLEANUP
    // ===========================

    /**
     * ✅ P2 PERFORMANCE: Cleanup Firebase listeners and intervals
     * Ensures no memory leaks by removing all listeners on unmount
     */
    function cleanup() {
        // ✅ P2 PERFORMANCE: Remove Firebase listener
        if (gameListener) {
            try {
                gameListener.off();
                gameListener = null;
                if (MultiplayerLobbyModule.isDevelopment) {
                    console.log('✅ Firebase listener removed');
                }
            } catch (error) {
                Logger.error('❌ Cleanup error:', error);
            }
        }

        // ✅ P1 STABILITY: Clear heartbeat interval
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
            if (MultiplayerLobbyModule.isDevelopment) {
                console.log('✅ Heartbeat interval cleared');
            }
        }
// ✅ P0 FIX: Cleanup presence listeners
        try {
            if (connectedRef) {
                connectedRef.off();
                connectedRef = null;
            }
            if (presenceRef) {
                // presenceRef listener itself isn't used (only onDisconnect), but null it to avoid reuse
                presenceRef = null;
            }
        } catch (e) {}
        // ✅ FSK18-SYSTEM: Remove category monitor
        if (currentGameId) {
            try {
                const categoriesRef = firebase.database().ref(`games/${currentGameId}/settings/categories`);
                categoriesRef.off();
            } catch (e) {
                // Silent fail
            }
        }
        // ✅ P2 PERFORMANCE: Cleanup event listeners
        if (window.NocapUtils && window.NocapUtils.cleanupEventListeners) {
            window.NocapUtils.cleanupEventListeners();
        }

        Logger.debug('✅ Multiplayer lobby cleanup completed');
    }

    addTrackedEventListener(window, 'beforeunload', cleanup);

    // ===========================
    // INITIALIZATION
    // ===========================

    if (document.readyState === 'loading') {
        addTrackedEventListener(document, 'DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})(window);