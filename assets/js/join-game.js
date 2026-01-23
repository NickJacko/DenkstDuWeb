/**
 * No-Cap - Join Game Page
 * Version 5.1 - BUGFIX: FirebaseService Access Error
 * Handles joining existing multiplayer games
 *
 * ✅ P0: Module Pattern - no global variables (XSS prevention)
 * ✅ P0: Event-Listener cleanup on beforeunload
 * ✅ P0: FirebaseService v6.0 integration
 * ✅ P0: Complete input sanitization
 * ✅ P0: Strict validation with textContent
 * ✅ P1: Enhanced A11y with ARIA
 * ✅ P1: Live validation feedback
 * ✅ P1: GameState integration
 *
 * CRITICAL: This page is the "Source of Truth" for Multiplayer Guest Mode
 * - Sets deviceMode = 'multi'
 * - Sets isGuest = true, isHost = false
 * - Uses FirebaseService.joinGame() method
 */

(function(window) {
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

    const JoinGameModule = {
        state: {
            gameState: null,
            firebaseService: null,
            currentGameData: null,
            checkTimeout: null,
            eventListenerCleanup: [],
            isDevelopment: window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('192.168.')
        },

        get gameState() { return this.state.gameState; },
        set gameState(val) { this.state.gameState = val; },

        get firebaseService() { return this.state.firebaseService; },
        set firebaseService(val) { this.state.firebaseService = val; },

        get currentGameData() { return this.state.currentGameData; },
        set currentGameData(val) { this.state.currentGameData = val; },

        get checkTimeout() { return this.state.checkTimeout; },
        set checkTimeout(val) { this.state.checkTimeout = val; },

        get isDevelopment() { return this.state.isDevelopment; }
    };

    Object.seal(JoinGameModule.state);

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
        JoinGameModule.state.eventListenerCleanup.push({element, event, handler, options});
    }
    function readBoolFlag(key) {
        try {
            const v = window.NocapUtils?.getLocalStorage?.(key);
            if (typeof v === 'boolean') return v;
            if (typeof v === 'string') return v === 'true';
            if (typeof v === 'number') return v === 1;
        } catch (e) {}

        try {
            const raw = localStorage.getItem(key);
            if (raw === null) return false;
            if (raw === 'true') return true;
            if (raw === 'false') return false;
            return Boolean(JSON.parse(raw));
        } catch (e) {
            return false;
        }
    }

    // ===========================
    // CONSTANTS
    // ===========================
    const MAX_GAME_CODE_LENGTH = 6;
    const MIN_PLAYER_NAME_LENGTH = 2;
    const MAX_PLAYER_NAME_LENGTH = 20;

    // ✅ P1 STABILITY: Optimized debounce (300ms instead of 800ms)
    const CHECK_DEBOUNCE_MS = 300;

    // ✅ P0 FIX: Strict regex patterns
    const GAME_CODE_REGEX = /^[A-Z0-9]{6}$/;
    const GAME_CODE_CHAR_REGEX = /[^A-Z0-9]/g;

    const categoryData = {
        fsk0: { name: 'Familie & Freunde', icon: '👨‍👩‍👧‍👦' },
        fsk16: { name: 'Party Time', icon: '🎉' },
        fsk18: { name: 'Heiß & Gewagt', icon: '🔥' },
        special: { name: 'Special Edition', icon: '⭐' }
    };

    const difficultyNames = {
        easy: 'Entspannt 😌',
        medium: 'Ausgewogen 🎯',
        hard: 'Hardcore 💀'
    };

    // ===========================
    // INITIALIZATION
    // ===========================
    /**
     * ✅ P0 FIX: Enhanced initialization with proper dependency checks
     * ✅ FSK18-SYSTEM: Simplified age verification (only FSK18 needs validation)
     */
    async function initialize() {
        Logger.debug('🔗 Join Game v5.2 - Initialisierung...');

        try {
            // ✅ P0 FIX: Critical security check
            if (typeof DOMPurify === 'undefined') {
                Logger.error('❌ CRITICAL: DOMPurify not loaded!');
                alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
                return;
            }

            // ✅ BUGFIX: Check for window.GameState (the constructor)
            if (typeof window.GameState === 'undefined') {
                Logger.error('❌ GameState not loaded!');
                showNotification('Fehler: Spieldaten nicht geladen', 'error');
                return;
            }

            // ✅ BUGFIX: Check for window.FirebaseService
            if (typeof window.FirebaseService === 'undefined') {
                Logger.error('❌ FirebaseService not loaded!');
                showNotification('Fehler: Firebase-Service nicht geladen', 'error');
                return;
            }

            // ✅ P1 FIX: Wait for dependencies
            if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
                await window.NocapUtils.waitForDependencies(['GameState', 'FirebaseService']);
            }

            // Initialize services
            JoinGameModule.gameState = new window.GameState();

            // ✅ BUGFIX: FirebaseService is already instantiated on window
            JoinGameModule.firebaseService = window.FirebaseService;

            // ===========================
            // CRITICAL: DEVICE MODE ENFORCEMENT
            // This page is ONLY for multiplayer guest mode
            // ===========================
            Logger.debug('🎮 Enforcing multiplayer guest mode...');

            JoinGameModule.gameState.setDeviceMode('multi');
            JoinGameModule.gameState.isHost = false;
            JoinGameModule.gameState.isGuest = true;

            Logger.debug('✅ Device mode set:', {
                deviceMode: JoinGameModule.gameState.deviceMode,
                isHost: JoinGameModule.gameState.isHost,
                isGuest: JoinGameModule.gameState.isGuest
            });

            // ===========================
            // ✅ FSK18-SYSTEM: Load user age level (no localStorage checks)
            // ===========================

            const readLS = (k) => {
                try {
                    if (window.NocapUtils?.getLocalStorage) {
                        return window.NocapUtils.getLocalStorage(k);
                    }
                    const v = localStorage.getItem(k);
                    if (v === null) return null;
                    try { return JSON.parse(v); } catch (_) { return v; }
                } catch (e) {
                    return null;
                }
            };

            const writeLS = (k, v) => window.NocapUtils?.setLocalStorage
                ? window.NocapUtils.setLocalStorage(k, v)
                : localStorage.setItem(k, (typeof v === 'string' ? v : JSON.stringify(v)));

            const removeLS = (k) => window.NocapUtils?.removeLocalStorage
                ? window.NocapUtils.removeLocalStorage(k)
                : localStorage.removeItem(k);

            // ✅ FSK18-SYSTEM: Get user age level from Firebase token claims
            let userAgeLevel = 0;

            try {
                // Try to get from Firebase token claims first (server-side source of truth)
                if (window.firebase?.auth && window.firebase.auth().currentUser) {
                    const user = window.firebase.auth().currentUser;
                    const tokenResult = await user.getIdTokenResult();

                    if (tokenResult.claims.fsk18 === true) {
                        userAgeLevel = 18;
                    } else {
                        userAgeLevel = 0;
                    }

                    Logger.debug('✅ Age level from token claims:', userAgeLevel);
                }
            } catch (error) {
                Logger.warn('⚠️ Could not get age level from token claims:', error);
            }

            // Fallback: Try localStorage (less reliable)
            if (userAgeLevel === 0) {
                const raw = readLS('nocap_age_verification');
                const verified =
                    raw === true ||
                    raw === 'true' ||
                    (raw && typeof raw === 'object' && raw.verified === true);

                if (verified) {
                    const ageVerification = (raw && typeof raw === 'object') ? raw : {};
                    userAgeLevel = Math.max(
                        0,
                        Number(
                            ageVerification.ageLevel ??
                            ageVerification.userAgeLevel ??
                            readLS('nocap_age_level') ??
                            (ageVerification.isAdult ? 18 : 0)
                        ) || 0
                    );

                    Logger.debug('✅ Age level from localStorage:', userAgeLevel);
                }
            }

            Logger.debug(`📋 User age level: ${userAgeLevel === 0 ? 'nicht verifiziert' : userAgeLevel + '+'}`);
            JoinGameModule.gameState.userAgeLevel = userAgeLevel;

            if (userAgeLevel > 0) {
                writeLS('nocap_age_level', String(userAgeLevel));
            }

            // ✅ FSK18-SYSTEM: Remove old FSK flags (no longer used)
            // FSK16 is always allowed, FSK18 is checked via server
            try {
                removeLS('nocap_allow_fsk16'); // Not used anymore
                removeLS('nocap_allow_fsk18'); // Not used anymore
            } catch (e) {}

            // Save GameState
            if (typeof JoinGameModule.gameState.save === 'function') {
                JoinGameModule.gameState.save();
            }

            Logger.debug('✅ Age verification loaded:', { userAgeLevel });

            // Initialize Firebase
            showLoading('Verbinde mit Server...');

            try {
                // Service instance holen
                JoinGameModule.firebaseService = window.FirebaseService;

                if (!JoinGameModule.firebaseService) {
                    throw new Error('FirebaseService missing');
                }

                // ✅ WICHTIG: Service aktiv initialisieren
                if (!JoinGameModule.firebaseService.isInitialized) {
                    await JoinGameModule.firebaseService.initialize();
                }

                // Optional: User-Check
                if (!JoinGameModule.firebaseService.getCurrentUser()) {
                    await JoinGameModule.firebaseService.signInAnonymously();
                }

                Logger.debug('✅ Firebase ready:', JoinGameModule.firebaseService.getStatus());

                const waitUntilReady = async (timeoutMs = 8000) => {
                    const start = Date.now();
                    while (Date.now() - start < timeoutMs) {
                        if (JoinGameModule.firebaseService && JoinGameModule.firebaseService.isReady) return true;
                        await new Promise(r => setTimeout(r, 100));
                    }
                    return false;
                };

                const ready = await waitUntilReady();
                if (!ready) {
                    throw new Error('Keine Firebase-Verbindung');
                }

            } catch (error) {
                Logger.error('❌ Firebase initialization failed:', error);
                hideLoading();

                const errorMessage = getFirebaseErrorMessage(error);
                showNotification(errorMessage, 'error', 5000);

                setTimeout(() => {
                    if (confirm('Server nicht erreichbar. Erneut versuchen?')) {
                        window.location.reload();
                    } else {
                        window.location.href = 'index.html';
                    }
                }, 3000);
                return;
            } finally {
                hideLoading();
            }

            // Handle URL parameter
            handleUrlParameter();

            // Setup event listeners
            setupEventListeners();

            // Initial validation
            validateForm();

            Logger.debug('✅ Join Game bereit!');

        } catch (error) {
            Logger.error('❌ Initialization error:', error);
            showNotification('Fehler beim Laden', 'error');
        }
    }
    // ===========================
    // URL PARAMETER HANDLING
    // ===========================

    function handleUrlParameter() {
        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('gameId') || urlParams.get('code');

        if (!gameId) {
            return;
        }

        const sanitized = sanitizeGameCode(gameId);

        if (sanitized && sanitized.length === MAX_GAME_CODE_LENGTH) {
            Logger.debug(`📋 URL-Parameter: ${sanitized}`);

            const gameCodeInput = document.getElementById('game-code');
            if (gameCodeInput) {
                gameCodeInput.value = sanitized;

                setTimeout(() => {
                    handleGameCodeInput();
                }, 500);
            }
        } else {
            Logger.warn('⚠️ Invalid gameId in URL');
            showNotification('Ungültiger Spiel-Code in URL', 'warning');
        }
    }

    // ===========================
    // EVENT LISTENERS
    // ===========================

    function setupEventListeners() {
        const gameCodeInput = document.getElementById('game-code');
        if (gameCodeInput) {
            addTrackedEventListener(gameCodeInput, 'input', handleGameCodeInput);
            addTrackedEventListener(gameCodeInput, 'paste', (e) => {
                setTimeout(() => handleGameCodeInput(), 10);
            });
            addTrackedEventListener(gameCodeInput, 'focus', () => {
                gameCodeInput.classList.remove('error');
            });
        }

        const playerNameInput = document.getElementById('player-name');
        if (playerNameInput) {
            addTrackedEventListener(playerNameInput, 'input', handlePlayerNameInput);
            addTrackedEventListener(playerNameInput, 'focus', () => {
                playerNameInput.classList.remove('error');
            });
        }

        const joinBtn = document.getElementById('join-btn');
        if (joinBtn) {
            addTrackedEventListener(joinBtn, 'click', joinGame);
        }

        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            addTrackedEventListener(backBtn, 'click', goBack);
        }

        const form = document.getElementById('join-form');
        if (form) {
            addTrackedEventListener(form, 'submit', (e) => {
                e.preventDefault();
                joinGame();
            });
        }

        addTrackedEventListener(document, 'keypress', (e) => {
            if (e.key === 'Enter') {
                const joinBtn = document.getElementById('join-btn');
                if (joinBtn && !joinBtn.disabled) {
                    e.preventDefault();
                    joinGame();
                }
            }
        });

        Logger.debug('✅ Event listeners setup');
    }

    // ===========================
    // INPUT HANDLING
    // ===========================

    function handleGameCodeInput() {
        const input = document.getElementById('game-code');
        if (!input) return;

        const rawValue = input.value;
        const sanitized = sanitizeGameCode(rawValue);

        if (sanitized !== rawValue) {
            input.value = sanitized;
            Logger.debug(`🛡️ Sanitized: "${rawValue}" → "${sanitized}"`);
        }

        if (JoinGameModule.checkTimeout) {
            clearTimeout(JoinGameModule.checkTimeout);
        }

        input.classList.remove('valid', 'error');
        const gameInfo = document.getElementById('game-info');
        const playerNameStep = document.getElementById('step-player-name');

        if (gameInfo) {
            gameInfo.classList.remove('show');
            gameInfo.classList.add('hidden');
        }

        if (playerNameStep) {
            playerNameStep.classList.add('hidden');
        }

        JoinGameModule.currentGameData = null;
        input.setAttribute('aria-invalid', 'false');

        if (sanitized.length === MAX_GAME_CODE_LENGTH) {
            input.setAttribute('aria-busy', 'true');

            JoinGameModule.checkTimeout = setTimeout(() => {
                checkGameExists(sanitized);
            }, CHECK_DEBOUNCE_MS);
        }

        validateForm();
    }

    function handlePlayerNameInput() {
        const input = document.getElementById('player-name');
        if (!input) return;

        let value = input.value;

        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            value = window.NocapUtils.sanitizeInput(value);
        }

        value = value.replace(/[<>"'&]/g, '');

        if (value.length > MAX_PLAYER_NAME_LENGTH) {
            value = value.substring(0, MAX_PLAYER_NAME_LENGTH);
        }

        input.value = value;

        const trimmed = value.trim();
        if (trimmed.length >= MIN_PLAYER_NAME_LENGTH && trimmed.length <= MAX_PLAYER_NAME_LENGTH) {
            input.classList.remove('error');
            input.classList.add('valid');
            input.setAttribute('aria-invalid', 'false');
        } else if (trimmed.length > 0) {
            input.classList.add('error');
            input.classList.remove('valid');
            input.setAttribute('aria-invalid', 'true');
        } else {
            input.classList.remove('error', 'valid');
            input.setAttribute('aria-invalid', 'false');
        }

        validateForm();
    }

    // ===========================
    // SANITIZATION
    // ===========================

    function sanitizeGameCode(code) {
        if (!code) return '';

        let sanitized = String(code);
        sanitized = sanitized.toUpperCase();

        const before = sanitized;
        sanitized = sanitized.replace(GAME_CODE_CHAR_REGEX, '');

        if (JoinGameModule.isDevelopment && before !== sanitized) {
            const removed = before.split('').filter((c, i) => sanitized[i] !== c);
            Logger.debug(`🛡️ Blocked invalid characters: ${removed.join(', ')}`);
        }

        if (sanitized.length > MAX_GAME_CODE_LENGTH) {
            sanitized = sanitized.substring(0, MAX_GAME_CODE_LENGTH);
        }

        return sanitized;
    }

    // ===========================
    // GAME VALIDATION
    // ===========================
    /**
     * ✅ FSK18-SYSTEM: Check if game exists and validate FSK18 access
     */
    async function checkGameExists(gameCode) {
        const input = document.getElementById('game-code');
        if (!input) return;

        try {
            Logger.debug(`🔍 Checking game: ${gameCode}`);

            if (!GAME_CODE_REGEX.test(gameCode)) {
                throw new Error('Ungültiges Code-Format');
            }

            if (!JoinGameModule.firebaseService) {
                throw new Error('Keine Firebase-Verbindung');
            }

            if (!JoinGameModule.firebaseService.isReady) {
                // ✅ quick retry window
                await new Promise(r => setTimeout(r, 400));
                if (!JoinGameModule.firebaseService.isReady) {
                    throw new Error('Keine Firebase-Verbindung');
                }
            }

            // 1) Mapping holen: gameCodes/{gameCode} -> { gameId, status, categories, difficulty, maxPlayers }
            const codeRef = JoinGameModule.firebaseService.database.ref(`gameCodes/${gameCode}`);
            const codeSnap = await codeRef.once('value');

            if (!codeSnap.exists()) {
                throw new Error('Spiel nicht gefunden');
            }

            const codeData = codeSnap.val() || {};
            const gameId = codeData.gameId;

            if (!gameId) {
                throw new Error('Spiel nicht gefunden');
            }

            const status = String(codeData.status || 'lobby');
            if (status === 'finished') throw new Error('Spiel bereits beendet');
            if (status === 'playing') throw new Error('Spiel läuft bereits');

            // categories: object -> array (normalize to string[])
            const categories = (codeData.categories ? Object.values(codeData.categories) : [])
                .map(c => String(c || '').trim())
                .filter(Boolean);

            // maxPlayers
            const maxPlayers = Number(codeData.maxPlayers || 8);

            // 2) ✅ FSK18-SYSTEM: Check if lobby has FSK18 content
            const hasFSK18 = categories.includes('fsk18');

            // ✅ FSK18-SYSTEM: Only check FSK18 (FSK16 is always allowed)
            if (hasFSK18) {
                const userAgeLevel = JoinGameModule.gameState.userAgeLevel || 0;

                // Not verified at all
                if (userAgeLevel === 0) {
                    throw new Error('AGE_VERIFICATION_REQUIRED_18');
                }

                // Verified but too young
                if (userAgeLevel < 18) {
                    throw new Error('AGE_TOO_YOUNG_18');
                }

                // ✅ FSK18-SYSTEM: Server-side validation
                if (!window.FirebaseConfig?.isInitialized?.()) {
                    throw new Error('Keine Firebase-Verbindung für FSK18-Validierung');
                }

                try {
                    const hasAccess = await JoinGameModule.gameState.canAccessFSK('fsk18', true);

                    if (!hasAccess) {
                        throw new Error('FSK18_ACCESS_DENIED');
                    }

                    Logger.debug('✅ FSK18 server validation passed');

                } catch (validationError) {
                    Logger.error('❌ FSK18 validation failed:', validationError);
                    throw new Error('FSK18_ACCESS_DENIED');
                }
            }

            Logger.debug('✅ Age check passed:', {
                userAgeLevel: JoinGameModule.gameState.userAgeLevel,
                hasFSK18
            });

            // 3) Get player count (optional - for display)
            let players = {};
            try {
                const playersRef = JoinGameModule.firebaseService.database.ref(`games/${gameId}/players`);
                const playersSnap = await playersRef.once('value');
                players = playersSnap.val() || {};

                // Check if game is full
                if (Object.keys(players).length >= maxPlayers) {
                    throw new Error('Spiel ist bereits voll');
                }
            } catch (error) {
                if (error.message === 'Spiel ist bereits voll') {
                    throw error;
                }
                Logger.warn('⚠️ Could not get player count:', error);
            }

            // ✅ Preview-Objekt bauen
            const previewGameData = {
                _gameId: gameId,
                _gameCode: gameCode,
                status,
                settings: {
                    categories,
                    difficulty: codeData.difficulty || 'medium',
                    maxPlayers
                },
                players
            };

            JoinGameModule.currentGameData = previewGameData;
            displayGameInfo(previewGameData);

            input.classList.add('valid');
            input.setAttribute('aria-invalid', 'false');
            showNotification('Spiel gefunden!', 'success', 2000);

            setTimeout(() => {
                const playerNameInput = document.getElementById('player-name');
                if (playerNameInput && !playerNameInput.value.trim()) {
                    playerNameInput.focus();
                    Logger.debug('✅ Auto-focused on player name input');
                }
            }, 100);

        } catch (error) {
            Logger.error('❌ Check failed:', error);

            let userMessage = error.message || 'Fehler beim Prüfen des Spiels';

            if (error.code === 'PERMISSION_DENIED') {
                userMessage = '🔒 Keine Berechtigung. Bitte überprüfe deine Altersverifikation.';
            } else if (error.code === 'UNAVAILABLE') {
                userMessage = '📡 Server vorübergehend nicht erreichbar. Bitte erneut versuchen.';
            } else if (error.message.includes('nicht gefunden') || error.message.includes('not found')) {
                userMessage = '❓ Spiel nicht gefunden. Überprüfe den Spiel-Code.';
            } else if (error.message.includes('voll') || error.message.includes('full')) {
                userMessage = '👥 Dieses Spiel ist bereits voll.';
            } else if (error.message.includes('beendet') || error.message.includes('finished')) {
                userMessage = '🏁 Dieses Spiel ist bereits beendet.';
            } else if (error.message.includes('läuft') || error.message.includes('playing')) {
                userMessage = '🎮 Dieses Spiel läuft bereits.';
            } else if (error.message === 'AGE_VERIFICATION_REQUIRED_18') {
                userMessage = '🔞 Diese Lobby ist ab 18 Jahren. Bitte verifiziere dein Alter in den Einstellungen.';

                setTimeout(() => {
                    if (confirm('Möchtest du jetzt dein Alter verifizieren?')) {
                        // Store return URL
                        const gameCodeInput = document.getElementById('game-code');
                        sessionStorage.setItem('nocap_return_url', window.location.href + '?code=' + gameCodeInput.value);
                        // Open settings
                        const settingsBtn = document.getElementById('settings-btn');
                        if (settingsBtn) {
                            settingsBtn.click();
                        } else {
                            window.location.href = 'index.html#settings';
                        }
                    }
                }, 2000);

            } else if (error.message === 'AGE_TOO_YOUNG_18') {
                userMessage = '🔞 Diese Lobby ist ab 18 Jahren. Du bist noch zu jung für diese Inhalte.';
            } else if (error.message === 'FSK18_ACCESS_DENIED') {
                userMessage = '🔞 Keine Berechtigung für FSK18-Inhalte. Bitte verifiziere dein Alter.';
            } else if (error.message.includes('Alter') || error.message.includes('FSK')) {
                userMessage = error.message;
            } else if (error.message.includes('Verbindung') || error.message.includes('connection')) {
                userMessage = '📡 Keine Firebase-Verbindung. Bitte erneut versuchen.';
            }

            input.classList.add('error');
            input.setAttribute('aria-invalid', 'true');
            showNotification(userMessage, 'error');
            JoinGameModule.currentGameData = null;

            const gameInfo = document.getElementById('game-info');
            const playerNameStep = document.getElementById('step-player-name');

            if (gameInfo) {
                gameInfo.classList.remove('show');
                gameInfo.classList.add('hidden');
            }

            if (playerNameStep) {
                playerNameStep.classList.add('hidden');
            }
        } finally {
            input.setAttribute('aria-busy', 'false');
        }

        validateForm();
    }
    // ===========================
    // GAME INFO DISPLAY
    // ===========================
    /**
     * ✅ FSK18-SYSTEM: Display game info with simplified FSK badge
     */
    function displayGameInfo(gameData) {
        const infoDiv = document.getElementById('game-info');
        const playerNameStep = document.getElementById('step-player-name');

        if (!infoDiv) return;

        Logger.debug('📊 Displaying game info:', gameData);

        const setTextSafe = (id, text) => {
            const elem = document.getElementById(id);
            if (elem) {
                elem.textContent = String(text || '-');
            }
        };

        const maxPlayers = gameData.settings?.maxPlayers || 8;

        if (gameData.players && typeof gameData.players === 'object') {
            const hostPlayer = Object.values(gameData.players).find(p => p && p.isHost);
            const hostName = hostPlayer ? (hostPlayer.name || 'Unbekannt') : 'Unbekannt';
            setTextSafe('game-host-name', hostName);

            const playerCount = Object.keys(gameData.players).length;
            setTextSafe('game-player-count', `${playerCount}/${maxPlayers}`);
        } else {
            setTextSafe('game-host-name', '-');
            setTextSafe('game-player-count', `-/${maxPlayers}`);
        }

        const categoriesArray = gameData.settings?.categories || gameData.selectedCategories || [];
        const categoryNames = categoriesArray
            .map(cat => {
                const categoryInfo = categoryData[cat];
                return categoryInfo ? `${categoryInfo.icon} ${categoryInfo.name}` : cat;
            })
            .join(', ');
        setTextSafe('game-categories', categoryNames || 'Keine Kategorien');

        const difficulty = gameData.settings?.difficulty || gameData.difficulty || 'medium';
        const difficultyText = difficultyNames[difficulty] || 'Standard';
        setTextSafe('game-difficulty', difficultyText);

        // ✅ FSK18-SYSTEM: Simplified FSK badge (only show FSK18 if present)
        const hasFSK18 = categoriesArray.some(cat => cat === 'fsk18');
        const hasFSK16 = categoriesArray.some(cat => cat === 'fsk16');

        const fskElem = document.getElementById('game-fsk-rating');
        if (fskElem) {
            // Clear existing content
            while (fskElem.firstChild) fskElem.removeChild(fskElem.firstChild);

            if (hasFSK18) {
                // ✅ FSK18: Show warning
                const strong = document.createElement('strong');
                strong.textContent = '🔞 FSK 18+';

                const span = document.createElement('span');
                span.className = 'fsk-hint';
                span.textContent = 'Nur für Erwachsene';

                fskElem.appendChild(strong);
                fskElem.appendChild(span);
                fskElem.classList.add('fsk-warning');

            } else if (hasFSK16) {
                // ✅ FSK16: Show info (no warning, always accessible)
                const strong = document.createElement('strong');
                strong.textContent = '🎉 FSK 16+';

                const span = document.createElement('span');
                span.className = 'fsk-hint';
                span.textContent = 'Enthält Party-Inhalte';

                fskElem.appendChild(strong);
                fskElem.appendChild(span);
                fskElem.classList.remove('fsk-warning'); // Not a warning anymore

            } else {
                // ✅ FSK0: Family-friendly
                const strong = document.createElement('strong');
                strong.textContent = '👨‍👩‍👧‍👦 FSK 0';

                const span = document.createElement('span');
                span.className = 'fsk-hint';
                span.textContent = 'Familienfreundlich';

                fskElem.appendChild(strong);
                fskElem.appendChild(span);
                fskElem.classList.remove('fsk-warning');
            }
        }

        infoDiv.classList.remove('hidden');
        infoDiv.classList.add('show');

        if (playerNameStep) {
            playerNameStep.classList.remove('hidden');
        }

        Logger.debug('✅ Game info displayed');
    }

    // ===========================
    // FORM VALIDATION
    // ===========================

    function validateForm() {
        const gameCodeInput = document.getElementById('game-code');
        const playerNameInput = document.getElementById('player-name');
        const joinBtn = document.getElementById('join-btn');

        if (!gameCodeInput || !playerNameInput || !joinBtn) return;

        const gameCode = gameCodeInput.value;
        const playerName = playerNameInput.value.trim();

        const isGameCodeValid = GAME_CODE_REGEX.test(gameCode);
        const isPlayerNameValid =
            playerName.length >= MIN_PLAYER_NAME_LENGTH &&
            playerName.length <= MAX_PLAYER_NAME_LENGTH;
        const hasGameData = JoinGameModule.currentGameData !== null;
        const isFirebaseReady = JoinGameModule.firebaseService && JoinGameModule.firebaseService.isReady;

        const isValid = isGameCodeValid && isPlayerNameValid && hasGameData && isFirebaseReady;

        joinBtn.disabled = !isValid;
        joinBtn.setAttribute('aria-disabled', String(!isValid));

        if (isValid) {
            joinBtn.textContent = '🚀 Beitreten';
        } else if (!isGameCodeValid) {
            joinBtn.textContent = 'Spiel-Code eingeben';
        } else if (!hasGameData) {
            joinBtn.textContent = 'Spiel prüfen...';
        } else if (!isPlayerNameValid) {
            joinBtn.textContent = 'Name eingeben';
        } else {
            joinBtn.textContent = '🚀 Beitreten';
        }
    }

    // ===========================
    // JOIN GAME
    // ===========================
    /**
     * ✅ FSK18-SYSTEM: Join game with server-side FSK validation
     */
    async function joinGame() {
        const gameCodeInput = document.getElementById('game-code');
        const playerNameInput = document.getElementById('player-name');

        if (!gameCodeInput || !playerNameInput) return;

        const gameCode = gameCodeInput.value.toUpperCase();
        const playerName = playerNameInput.value.trim();

        if (!JoinGameModule.currentGameData) {
            showNotification('Spiel-Code ungültig', 'error');
            gameCodeInput.focus();
            return;
        }

        const preview = JoinGameModule.currentGameData || {};
        const cats = (preview.settings?.categories || []).map(c => String(c || '').trim()).filter(Boolean);

        if (!GAME_CODE_REGEX.test(gameCode)) {
            showNotification('Ungültiger Spiel-Code', 'error');
            gameCodeInput.focus();
            return;
        }

        if (playerName.length < MIN_PLAYER_NAME_LENGTH || playerName.length > MAX_PLAYER_NAME_LENGTH) {
            showNotification('Name muss zwischen 2-20 Zeichen lang sein', 'error');
            playerNameInput.focus();
            return;
        }

        if (!JoinGameModule.firebaseService || !JoinGameModule.firebaseService.isReady) {
            showNotification('Firebase nicht verbunden', 'error');
            return;
        }

        Logger.debug(`🔗 Joining: ${gameCode} as ${playerName}`);

        showLoading('Trete Spiel bei...');

        try {
            // ✅ Join securely via FirebaseService
            const svc = JoinGameModule.firebaseService;

            if (!svc) throw new Error('FirebaseService missing');
            if (!svc.isReady) throw new Error('Keine Firebase-Verbindung');

            // Prefer service wrapper if available
            let res;
            if (typeof svc.callCallable === 'function') {
                res = await svc.callCallable('joinGameSecure', { gameCode, playerName }, 'europe-west1');
            } else if (svc.functions && typeof svc.functions.httpsCallable === 'function') {
                const joinGameFn = svc.functions.httpsCallable('joinGameSecure');
                res = await joinGameFn({ gameCode, playerName });
            } else if (window.firebase?.app?.().functions) {
                const joinGameFn = window.firebase.app().functions('europe-west1').httpsCallable('joinGameSecure');
                res = await joinGameFn({ gameCode, playerName });
            } else {
                throw new Error('Functions SDK nicht geladen (firebase-functions-compat fehlt)');
            }

            const { gameId } = (res && res.data) ? res.data : {};
            if (!gameId) throw new Error('Join erfolgreich, aber gameId fehlt');

            // ✅ P0 FIX: Persist gameId immediately
            try {
                localStorage.setItem('nocap_game_id', String(gameId));
                sessionStorage.setItem('nocap_game_id', String(gameId));
            } catch (e) {
                // ignore
            }

            // ✅ FSK18-SYSTEM: Store player's age level in their player data
            const uid =
                (window.firebase?.auth?.()?.currentUser?.uid) ||
                (JoinGameModule.firebaseService?.auth?.currentUser?.uid) ||
                null;

            if (uid) {
                // Use already loaded userAgeLevel
                const userAgeLevel = Number(JoinGameModule.gameState.userAgeLevel || 0);

                // Store age level in player data for host validation
                try {
                    await firebase.database()
                        .ref(`games/${gameId}/players/${uid}/ageLevel`)
                        .set(userAgeLevel);

                    Logger.debug('✅ Player age level stored:', userAgeLevel);
                } catch (error) {
                    Logger.warn('⚠️ Could not store age level:', error);
                }
            }

            // ✅ Save GameState
            JoinGameModule.gameState.gameId = gameId;
            JoinGameModule.gameState.gameCode = gameCode;
            JoinGameModule.gameState.playerId =
                (JoinGameModule.firebaseService?.getCurrentUser?.()?.uid) ||
                (firebase?.auth?.()?.currentUser?.uid) ||
                JoinGameModule.gameState.playerId;

            JoinGameModule.gameState.authUid = JoinGameModule.gameState.playerId;
            JoinGameModule.gameState.setPlayerName(playerName);

            JoinGameModule.gameState.setDeviceMode('multi');
            JoinGameModule.gameState.isHost = false;
            JoinGameModule.gameState.isGuest = true;

            // ✅ categories/difficulty aus preview ziehen
            const gameData = JoinGameModule.currentGameData || {};
            const settings = gameData.settings || {};
            const categories = settings.categories || [];

            // ✅ Reset categories first
            try {
                if (typeof JoinGameModule.gameState.clearCategories === 'function') {
                    JoinGameModule.gameState.clearCategories();
                } else {
                    JoinGameModule.gameState.selectedCategories = [];
                }
            } catch (e) {}

            // ✅ Apply server preview categories
            categories.forEach(cat => JoinGameModule.gameState.addCategory(cat));

            // ✅ Apply difficulty
            JoinGameModule.gameState.setDifficulty(settings.difficulty || 'medium');

            hideLoading();
            showNotification('Erfolgreich beigetreten!', 'success', 500);

            // ✅ P0 FIX: Persist EVERYTHING before redirect
            try {
                const uid =
                    (window.firebase?.auth?.()?.currentUser?.uid) ||
                    (JoinGameModule.firebaseService?.getCurrentUser?.()?.uid) ||
                    JoinGameModule.gameState.playerId ||
                    null;

                const stateToSave = {
                    gameId: String(gameId),
                    gameCode: String(gameCode),
                    deviceMode: 'multi',
                    isHost: false,
                    isGuest: true,
                    playerId: uid,
                    authUid: uid,
                    playerName: playerName,
                    selectedCategories: categories,
                    difficulty: settings.difficulty || 'medium',
                    userAgeLevel: JoinGameModule.gameState.userAgeLevel || 0 // ✅ Store age level
                };

                localStorage.setItem('nocap_game_id', String(gameId));
                sessionStorage.setItem('nocap_game_id', String(gameId));
                localStorage.setItem('nocap_game_state', JSON.stringify(stateToSave));
                sessionStorage.setItem('nocap_game_state', JSON.stringify(stateToSave));
            } catch (e) {
                // ignore
            }

            // Save GameState too
            try { JoinGameModule.gameState.save?.(true); } catch (e) {}

            // ✅ P0 FIX: Pass gameId in URL as final fallback
            setTimeout(() => {
                window.location.href = 'multiplayer-lobby.html?gameId=' + encodeURIComponent(String(gameId));
            }, 50);

        } catch (error) {
            Logger.error('❌ Join failed:', error);
            hideLoading();

            const errorMessage = getFirebaseErrorMessage(error);
            showNotification(errorMessage, 'error');

            if (errorMessage.includes('Code') || errorMessage.includes('gefunden') || errorMessage.includes('nicht gefunden')) {
                gameCodeInput.focus();
            } else if (errorMessage.includes('Name') || errorMessage.includes('verwendet')) {
                playerNameInput.focus();
            } else {
                gameCodeInput.focus();
            }
        }
    }

    // ===========================
    // NAVIGATION
    // ===========================

    function goBack() {
        window.location.href = 'index.html';
    }

    // ===========================
    // UTILITY FUNCTIONS
    // ===========================

    function getFirebaseErrorMessage(error) {
        if (!error) return 'Ein unbekannter Fehler ist aufgetreten';

        const errorCode = error.code;
        const errorMessage = error.message || '';

        if (errorCode === 'auth/network-request-failed') {
            return '📡 Keine Internetverbindung. Bitte überprüfe deine Verbindung.';
        }
        if (errorCode === 'auth/too-many-requests') {
            return '⏳ Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.';
        }
        if (errorCode === 'auth/user-disabled') {
            return '🚫 Dieser Account wurde gesperrt. Kontaktiere den Support.';
        }

        if (errorCode === 'PERMISSION_DENIED' || errorMessage.includes('permission')) {
            return '🔒 Keine Berechtigung. Bitte überprüfe deine Altersverifikation.';
        }
        if (errorCode === 'UNAVAILABLE' || errorMessage.includes('unavailable')) {
            return '📡 Server vorübergehend nicht erreichbar. Bitte versuche es später erneut.';
        }
        if (errorCode === 'NOT_FOUND' || errorMessage.includes('not found')) {
            return '❓ Spiel nicht gefunden. Überprüfe den Spiel-Code.';
        }
        if (errorCode === 'ALREADY_EXISTS' || errorMessage.includes('already exists')) {
            return '⚠️ Dieser Name wird bereits verwendet. Wähle einen anderen Namen.';
        }
        if (errorCode === 'DEADLINE_EXCEEDED' || errorMessage.includes('timeout')) {
            return '⏱️ Zeitüberschreitung. Der Server antwortet nicht. Bitte erneut versuchen.';
        }
        if (errorCode === 'RESOURCE_EXHAUSTED' || errorMessage.includes('quota')) {
            return '📊 Serverlimit erreicht. Bitte versuche es später erneut.';
        }

        if (errorMessage.includes('network') || errorMessage.includes('offline')) {
            return '📡 Netzwerkfehler. Bitte überprüfe deine Internetverbindung.';
        }
        if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
            return '⏱️ Zeitüberschreitung. Server antwortet nicht.';
        }

        if (errorMessage.includes('voll') || errorMessage.includes('full')) {
            return '👥 Dieses Spiel ist bereits voll. Versuche ein anderes Spiel.';
        }
        if (errorMessage.includes('gestartet') || errorMessage.includes('started')) {
            return '🎮 Dieses Spiel wurde bereits gestartet. Du kannst nicht mehr beitreten.';
        }
        if (errorMessage.includes('beendet') || errorMessage.includes('finished')) {
            return '🏁 Dieses Spiel ist bereits beendet.';
        }

        return `❌ Fehler: ${errorMessage || 'Unbekannter Fehler'}`;
    }

    const showLoading = window.NocapUtils?.showLoading || function(message = 'Lädt...') {
        const loading = document.getElementById('loading');
        if (loading) {
            const loadingText = loading.querySelector('.loading-text');
            if (loadingText) loadingText.textContent = message;
            loading.classList.add('show');
        }
    };

    const hideLoading = window.NocapUtils?.hideLoading || function() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.remove('show');
    };

    const showNotification = window.NocapUtils?.showNotification || function(message) {
        alert(String(message));
    };

    // ===========================
    // CLEANUP
    // ===========================

    function cleanup() {
        if (JoinGameModule.checkTimeout) {
            clearTimeout(JoinGameModule.checkTimeout);
            JoinGameModule.checkTimeout = null;
        }

        JoinGameModule.state.eventListenerCleanup.forEach(({element, event, handler, options}) => {
            try {
                element.removeEventListener(event, handler, options);
            } catch (error) {
                // Element may have been removed from DOM
            }
        });
        JoinGameModule.state.eventListenerCleanup = [];

        if (window.NocapUtils && window.NocapUtils.cleanupEventListeners) {
            window.NocapUtils.cleanupEventListeners();
        }

        Logger.debug('✅ Join game cleanup completed');
    }

    window.addEventListener('beforeunload', cleanup);

    // ===========================
    // INITIALIZATION
    // ===========================

    async function waitForFirebase() {
        let attempts = 0;
        const maxAttempts = 150;

        Logger.info('⏳ Waiting for Firebase initialization...');

        while (attempts < maxAttempts) {
            // ✅ immer zuerst deklarieren/initialisieren
            const hasFirebaseInitialized = window.firebaseInitialized === true;
            const hasFirebaseService = typeof window.FirebaseService !== 'undefined';
            const hasFirebaseGlobal = typeof firebase !== 'undefined'; // optional fallback only

            if (JoinGameModule.isDevelopment && attempts % 10 === 0) {
                Logger.debug(`Firebase check attempt ${attempts}:`, {
                    firebaseInitialized: hasFirebaseInitialized,
                    firebaseService: hasFirebaseService,
                    firebaseGlobal: hasFirebaseGlobal
                });
            }

            if (hasFirebaseInitialized && hasFirebaseService) {
                Logger.info('✅ Firebase ready after', attempts * 100, 'ms');
                return true;
            }

            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        Logger.error('❌ Firebase initialization timeout after 15 seconds');
        Logger.error('Final state:', {
            firebaseInitialized: window.firebaseInitialized,
            firebaseService: typeof window.FirebaseService,
            firebase: typeof firebase
        });
        return false;
    }


    async function startApp() {
        const firebaseReady = await waitForFirebase();
        if (firebaseReady) {
            await initialize();
        } else {
            hideLoading();
            showNotification('Firebase konnte nicht geladen werden. Bitte lade die Seite neu.', 'error');

            setTimeout(() => {
                if (confirm('Firebase konnte nicht geladen werden.\n\nSeite neu laden?')) {
                    window.location.reload();
                }
            }, 2000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp);
    } else {
        startApp();
    }

})(window);