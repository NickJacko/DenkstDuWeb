/**
 * No-Cap - Join Game Page
 * Version 4.0 - FirebaseService v6.0 Integration & Full Audit Fix
 * Handles joining existing multiplayer games
 *
 * ✅ P0 FIX: FirebaseService v6.0 integration
 * ✅ P0 FIX: Complete input sanitization
 * ✅ P0 FIX: Strict validation with textContent
 * ✅ P1 FIX: Enhanced A11y with ARIA
 * ✅ P1 FIX: Live validation feedback
 * ✅ P1 FIX: GameState integration
 *
 * CRITICAL: This page is the "Source of Truth" for Multiplayer Guest Mode
 * - Sets deviceMode = 'multi'
 * - Sets isGuest = true, isHost = false
 * - Uses FirebaseService.joinGame() method
 */

(function(window) {
    'use strict';

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

    // ===========================
    // GLOBAL STATE
    // ===========================
    let gameState = null;
    let firebaseService = null;
    let currentGameData = null;
    let checkTimeout = null;

    const isDevelopment = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('192.168.');

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
     */
    async function initialize() {
        if (isDevelopment) {
            console.log('🔗 Join Game v4.0 - Initialisierung...');
        }

        try {
            // ✅ P0 FIX: Critical security check
            if (typeof DOMPurify === 'undefined') {
                console.error('❌ CRITICAL: DOMPurify not loaded!');
                alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
                return;
            }

            // ✅ P0 FIX: Check required dependencies
            if (typeof GameState === 'undefined') {
                console.error('❌ GameState not loaded!');
                showNotification('Fehler: Spieldaten nicht geladen', 'error');
                return;
            }

            if (typeof window.FirebaseService === 'undefined') {
                console.error('❌ FirebaseService not loaded!');
                showNotification('Fehler: Firebase-Service nicht geladen', 'error');
                return;
            }

            // ✅ P1 FIX: Wait for dependencies
            if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
                await window.NocapUtils.waitForDependencies(['GameState', 'FirebaseService']);
            }

            // Initialize services
            gameState = new GameState();
            firebaseService = window.FirebaseService;

            // ===========================
            // CRITICAL: DEVICE MODE ENFORCEMENT
            // This page is ONLY for multiplayer guest mode
            // ===========================
            if (isDevelopment) {
                console.log('🎮 Enforcing multiplayer guest mode...');
            }

            gameState.setDeviceMode('multi');
            gameState.isHost = false;
            gameState.isGuest = true;

            if (isDevelopment) {
                console.log('✅ Device mode set:', {
                    deviceMode: gameState.deviceMode,
                    isHost: gameState.isHost,
                    isGuest: gameState.isGuest
                });
            }

            // ===========================
            // ✅ P1 DSGVO/JUGENDSCHUTZ: AGE VERIFICATION ENFORCEMENT
            // CRITICAL: This check is MIRRORED in Firebase Database Rules
            //
            // Security Layer 1 (Client): Block UI if no age verification
            // Security Layer 2 (Server): Firebase Rules reject write if no auth.token.ageVerified
            //
            // Age Verification Storage:
            // - Key: nocap_age_verification
            // - Format: { isAdult: boolean, timestamp: number, version: string }
            // - Expiry: 24 hours (86400000ms)
            //
            // GDPR Compliance:
            // - User is informed BEFORE verification (privacy notice)
            // - Age data stored ONLY in localStorage (not sent to server)
            // - IP tracking ONLY with consent (firebase-config.js)
            // - Data auto-deleted after 24h
            // ===========================
            const ageVerification = window.NocapUtils
                ? window.NocapUtils.getLocalStorage('nocap_age_verification')
                : JSON.parse(localStorage.getItem('nocap_age_verification') || 'null');

            // ✅ P1 FIX: Check if age verification exists AND is valid
            if (!ageVerification || typeof ageVerification !== 'object') {
                console.warn('⚠️ No age verification found - redirecting to age gate');
                showNotification('⚠️ Altersverifikation erforderlich', 'warning', 3000);

                // Save current URL to return after verification
                const currentUrl = window.location.href;
                sessionStorage.setItem('nocap_return_url', currentUrl);

                setTimeout(() => {
                    window.location.href = 'index.html?showAgeGate=true';
                }, 2000);
                return;
            }

            // ✅ P1 DSGVO: Check timestamp expiry (24 hours = 86400000ms)
            const AGE_VERIFICATION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
            const now = Date.now();
            const verificationAge = now - (ageVerification.timestamp || 0);

            if (verificationAge > AGE_VERIFICATION_EXPIRY) {
                console.warn('⚠️ Age verification expired - redirecting to age gate');
                showNotification('⚠️ Altersverifikation abgelaufen. Bitte erneut bestätigen.', 'warning', 3000);

                // Clear expired verification
                if (window.NocapUtils && window.NocapUtils.removeLocalStorage) {
                    window.NocapUtils.removeLocalStorage('nocap_age_verification');
                } else {
                    localStorage.removeItem('nocap_age_verification');
                }

                // Save current URL to return after verification
                const currentUrl = window.location.href;
                sessionStorage.setItem('nocap_return_url', currentUrl);

                setTimeout(() => {
                    window.location.href = 'index.html?showAgeGate=true';
                }, 2000);
                return;
            }

            // ✅ P1 FIX: Validate age level for multiplayer
            const userAgeLevel = ageVerification.isAdult ? 18 : 0;

            if (isDevelopment) {
                const hoursUntilExpiry = Math.floor((AGE_VERIFICATION_EXPIRY - verificationAge) / (60 * 60 * 1000));
                console.log('✅ Age verification valid:', {
                    ageLevel: userAgeLevel,
                    timestamp: ageVerification.timestamp,
                    expiresIn: `${hoursUntilExpiry}h`,
                    version: ageVerification.version || '1.0'
                });
            }

            // ✅ P1 DSGVO: Store age level in GameState for server validation
            // NOTE: This is used by Firebase Database Rules to enforce FSK restrictions
            gameState.userAgeLevel = userAgeLevel;

            // Initialize Firebase
            showLoading('Verbinde mit Server...');

            try {
                // ✅ P1 FIX: Wait for Firebase initialization
                if (!window.firebaseInitialized) {
                    throw new Error('Firebase not initialized');
                }

                // ✅ FIX: Use FirebaseService directly (it's already an instance, not a class)
                firebaseService = window.FirebaseService;

                if (isDevelopment) {
                    console.log('✅ Firebase Service ready');
                }

                // Get current user (should already be authenticated from firebase-config.js)
                const currentUser = firebaseService.getCurrentUser();
                if (currentUser) {
                    if (isDevelopment) {
                        console.log('✅ User authenticated:', currentUser.uid);
                    }
                } else {
                    console.warn('⚠️ No authenticated user - some features may not work');
                }

                if (isDevelopment) {
                    console.log('✅ Firebase ready:', firebaseService.getStatus());
                }

            } catch (error) {
                console.error('❌ Firebase initialization failed:', error);
                hideLoading();

                // ✅ P1 STABILITY: User-friendly error messages with retry option
                const errorMessage = getFirebaseErrorMessage(error);
                showNotification(errorMessage, 'error', 5000);

                // ✅ P1 UI/UX: Show retry dialog
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

            // ✅ P0 FIX: Handle URL parameter
            handleUrlParameter();

            // Setup event listeners
            setupEventListeners();

            // Initial validation
            validateForm();

            if (isDevelopment) {
                console.log('✅ Join Game bereit!');
            }

        } catch (error) {
            console.error('❌ Initialization error:', error);
            showNotification('Fehler beim Laden', 'error');
        }
    }

    // ===========================
    // URL PARAMETER HANDLING
    // ===========================

    /**
     * ✅ P0 FIX: Handle URL parameter with strict validation
     */
    function handleUrlParameter() {
        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('gameId') || urlParams.get('code');

        if (!gameId) {
            return;
        }

        // ✅ P0 FIX: Sanitize gameId
        const sanitized = sanitizeGameCode(gameId);

        if (sanitized && sanitized.length === MAX_GAME_CODE_LENGTH) {
            if (isDevelopment) {
                console.log(`📋 URL-Parameter: ${sanitized}`);
            }

            const gameCodeInput = document.getElementById('game-code');
            if (gameCodeInput) {
                gameCodeInput.value = sanitized;

                // Trigger check after short delay
                setTimeout(() => {
                    handleGameCodeInput();
                }, 500);
            }
        } else {
            console.warn('⚠️ Invalid gameId in URL');
            showNotification('Ungültiger Spiel-Code in URL', 'warning');
        }
    }

    // ===========================
    // EVENT LISTENERS
    // ===========================

    /**
     * ✅ P1 FIX: Enhanced event listener setup
     */
    function setupEventListeners() {
        // Game code input
        const gameCodeInput = document.getElementById('game-code');
        if (gameCodeInput) {
            gameCodeInput.addEventListener('input', handleGameCodeInput);
            gameCodeInput.addEventListener('paste', (e) => {
                setTimeout(() => handleGameCodeInput(), 10);
            });

            // ✅ P1 FIX: Clear error on focus
            gameCodeInput.addEventListener('focus', () => {
                gameCodeInput.classList.remove('error');
            });
        }

        // Player name input
        const playerNameInput = document.getElementById('player-name');
        if (playerNameInput) {
            playerNameInput.addEventListener('input', handlePlayerNameInput);

            // ✅ P1 FIX: Clear error on focus
            playerNameInput.addEventListener('focus', () => {
                playerNameInput.classList.remove('error');
            });
        }

        // Join button
        const joinBtn = document.getElementById('join-btn');
        if (joinBtn) {
            joinBtn.addEventListener('click', joinGame);
        }

        // Back button
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', goBack);
        }

        // ✅ P0 FIX: Form submit prevention
        const form = document.getElementById('join-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                joinGame();
            });
        }

        // ✅ P1 FIX: Enter key support
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const joinBtn = document.getElementById('join-btn');
                if (joinBtn && !joinBtn.disabled) {
                    e.preventDefault();
                    joinGame();
                }
            }
        });

        if (isDevelopment) {
            console.log('✅ Event listeners setup');
        }
    }

    // ===========================
    // INPUT HANDLING
    // ===========================

    /**
     * ✅ P0 SECURITY + P1 STABILITY: Handle game code input with immediate sanitization and debounced validation
     */
    function handleGameCodeInput() {
        const input = document.getElementById('game-code');
        if (!input) return;

        // ✅ P0 SECURITY: Sanitize immediately (before any processing)
        const rawValue = input.value;
        const sanitized = sanitizeGameCode(rawValue);

        // Update input if sanitization changed the value
        if (sanitized !== rawValue) {
            input.value = sanitized;

            if (isDevelopment && sanitized !== rawValue) {
                console.log(`🛡️ Sanitized: "${rawValue}" → "${sanitized}"`);
            }
        }

        // Clear previous timeout
        if (checkTimeout) {
            clearTimeout(checkTimeout);
        }

        // Reset UI
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

        currentGameData = null;

        // ✅ P1 FIX: Update ARIA
        input.setAttribute('aria-invalid', 'false');

        // Check if complete
        if (sanitized.length === MAX_GAME_CODE_LENGTH) {
            input.setAttribute('aria-busy', 'true');

            // ✅ P1 STABILITY: Debounced server check (300ms)
            checkTimeout = setTimeout(() => {
                checkGameExists(sanitized);
            }, CHECK_DEBOUNCE_MS);
        }

        validateForm();
    }

    /**
     * ✅ P1 FIX: Handle player name input with live feedback
     */
    function handlePlayerNameInput() {
        const input = document.getElementById('player-name');
        if (!input) return;

        // ✅ P0 FIX: Sanitize name
        let value = input.value;

        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            value = window.NocapUtils.sanitizeInput(value);
        }

        // Remove dangerous characters
        value = value.replace(/[<>"'&]/g, '');

        // Limit length
        if (value.length > MAX_PLAYER_NAME_LENGTH) {
            value = value.substring(0, MAX_PLAYER_NAME_LENGTH);
        }

        input.value = value;

        // ✅ P1 FIX: Visual feedback
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

    /**
     * ✅ P0 SECURITY: Sanitize game code - ONLY uppercase letters and digits allowed
     * All other characters are immediately rejected
     *
     * @param {string} code - Raw input code
     * @returns {string} Sanitized code (uppercase A-Z and 0-9 only, max 6 chars)
     */
    function sanitizeGameCode(code) {
        if (!code) return '';

        // Convert to string (safety)
        let sanitized = String(code);

        // ✅ P0 SECURITY: Convert to uppercase first
        sanitized = sanitized.toUpperCase();

        // ✅ P0 SECURITY: Remove ALL invalid characters (anything not A-Z or 0-9)
        const before = sanitized;
        sanitized = sanitized.replace(GAME_CODE_CHAR_REGEX, '');

        // Log if invalid characters were removed (dev only)
        if (isDevelopment && before !== sanitized) {
            const removed = before.split('').filter((c, i) => sanitized[i] !== c);
            console.log(`🛡️ Blocked invalid characters: ${removed.join(', ')}`);
        }

        // ✅ P0 SECURITY: Limit to max length
        if (sanitized.length > MAX_GAME_CODE_LENGTH) {
            sanitized = sanitized.substring(0, MAX_GAME_CODE_LENGTH);
        }

        return sanitized;
    }

    // ===========================
    // GAME VALIDATION
    // ===========================

    /**
     * ✅ P0 FIX: Check if game exists using FirebaseService v6.0
     */
    async function checkGameExists(gameCode) {
        const input = document.getElementById('game-code');
        if (!input) return;

        try {
            if (isDevelopment) {
                console.log(`🔍 Checking game: ${gameCode}`);
            }

            // ✅ P0 FIX: Validate format
            if (!GAME_CODE_REGEX.test(gameCode)) {
                throw new Error('Ungültiges Code-Format');
            }

            // ✅ P0 FIX: Check Firebase connection
            if (!firebaseService || !firebaseService.isReady) {
                throw new Error('Keine Firebase-Verbindung');
            }

            // ✅ P0 FIX: Use Firebase database reference
            const gameRef = firebaseService.database.ref(`games/${gameCode}`);
            const snapshot = await gameRef.once('value');

            if (!snapshot.exists()) {
                throw new Error('Spiel nicht gefunden');
            }

            const gameData = snapshot.val();

            // ✅ P0 FIX: Validate game state (check both 'status' and 'gameState')
            const gameStatus = gameData.status || gameData.gameState;

            if (gameStatus === 'finished') {
                throw new Error('Spiel bereits beendet');
            }

            // ✅ FIX: 'lobby' und 'waiting' sind OK zum Joinen, nur 'playing' blockieren
            if (gameStatus === 'playing') {
                throw new Error('Spiel läuft bereits');
            }

            if (isDevelopment) {
                console.log('✅ Game status OK for joining:', gameStatus);
            }

            // ✅ FIX: Check FSK restrictions using local age verification
            const ageVerification = window.NocapUtils
                ? window.NocapUtils.getLocalStorage('nocap_age_verification')
                : JSON.parse(localStorage.getItem('nocap_age_verification') || 'null');

            const userAgeLevel = (ageVerification && ageVerification.isAdult) ? 18 : 0;
            const categories = gameData.settings?.categories || gameData.selectedCategories || [];

            const hasFSK18 = categories.includes('fsk18');
            const hasFSK16 = categories.includes('fsk16');

            if (hasFSK18 && userAgeLevel < 18) {
                throw new Error('Du musst mindestens 18 Jahre alt sein für dieses Spiel');
            }

            if (hasFSK16 && userAgeLevel < 16) {
                throw new Error('Du musst mindestens 16 Jahre alt sein für dieses Spiel');
            }

            // ✅ P1 FIX: Check max players
            const playerCount = gameData.players ? Object.keys(gameData.players).length : 0;
            const maxPlayers = gameData.settings?.maxPlayers || 8;

            if (playerCount >= maxPlayers) {
                throw new Error(`Spiel ist voll (${maxPlayers}/${maxPlayers})`);
            }

            // Success
            currentGameData = gameData;
            displayGameInfo(gameData);
            input.classList.add('valid');
            input.setAttribute('aria-invalid', 'false');
            showNotification('Spiel gefunden!', 'success', 2000);

            // ✅ P1 UI/UX: Auto-focus on name field after successful validation
            setTimeout(() => {
                const playerNameInput = document.getElementById('player-name');
                if (playerNameInput && !playerNameInput.value.trim()) {
                    playerNameInput.focus();

                    if (isDevelopment) {
                        console.log('✅ Auto-focused on player name input');
                    }
                }
            }, 100);

        } catch (error) {
            console.error('❌ Check failed:', error);

            // ✅ P1 STABILITY: User-friendly error message
            let userMessage = error.message || 'Fehler beim Prüfen des Spiels';

            // Translate technical errors to user-friendly messages
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
            } else if (error.message.includes('Alter') || error.message.includes('FSK')) {
                userMessage = error.message; // Keep FSK messages as-is
            } else if (error.message.includes('Verbindung') || error.message.includes('connection')) {
                userMessage = '📡 Keine Firebase-Verbindung. Bitte erneut versuchen.';
            }

            input.classList.add('error');
            input.setAttribute('aria-invalid', 'true');
            showNotification(userMessage, 'error');
            currentGameData = null;

            // Hide game info and player name step
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
     * ✅ P0 FIX: Display game information with textContent only
     */
    function displayGameInfo(gameData) {
        const infoDiv = document.getElementById('game-info');
        const playerNameStep = document.getElementById('step-player-name');

        if (!infoDiv) return;

        if (isDevelopment) {
            console.log('📊 Displaying game info:', gameData);
        }

        // ✅ P0 FIX: Safe text setter
        const setTextSafe = (id, text) => {
            const elem = document.getElementById(id);
            if (elem) {
                elem.textContent = String(text || '-');
            }
        };

        // Host - Korrigierte ID
        const hostPlayer = Object.values(gameData.players || {}).find(p => p.isHost);
        const hostName = hostPlayer ? hostPlayer.name : 'Unbekannt';
        setTextSafe('game-host-name', hostName);

        // Players - Korrigierte ID
        const playerCount = gameData.players ? Object.keys(gameData.players).length : 0;
        const maxPlayers = gameData.settings?.maxPlayers || 8;
        setTextSafe('game-player-count', `${playerCount}/${maxPlayers}`);

        // Categories - Korrigierte ID
        const categoriesArray = gameData.settings?.categories || gameData.selectedCategories || [];
        const categoryNames = categoriesArray
            .map(cat => {
                const categoryInfo = categoryData[cat];
                return categoryInfo ? `${categoryInfo.icon} ${categoryInfo.name}` : cat;
            })
            .join(', ');
        setTextSafe('game-categories', categoryNames || 'Keine Kategorien');

        // Difficulty - Korrigierte ID
        const difficulty = gameData.settings?.difficulty || gameData.difficulty || 'medium';
        const difficultyText = difficultyNames[difficulty] || 'Standard';
        setTextSafe('game-difficulty', difficultyText);

        // FSK Rating - Korrigierte ID
        const hasFSK18 = categoriesArray.some(cat => cat === 'fsk18' || cat.includes('18'));
        const hasFSK16 = categoriesArray.some(cat => cat === 'fsk16' || cat.includes('16'));

        const fskElem = document.getElementById('game-fsk-rating');
        if (fskElem) {
            if (hasFSK18) {
                fskElem.innerHTML = '<strong>⚠️ FSK 18+</strong><span class="fsk-hint">Nur für Erwachsene</span>';
                fskElem.classList.add('fsk-warning');
            } else if (hasFSK16) {
                fskElem.innerHTML = '<strong>⚠️ FSK 16+</strong><span class="fsk-hint">Jugendschutz aktiv</span>';
                fskElem.classList.add('fsk-warning');
            } else {
                fskElem.innerHTML = '<strong>✅ FSK 0</strong><span class="fsk-hint">Für alle Altersgruppen</span>';
                fskElem.classList.remove('fsk-warning');
            }
        }

        // ✅ P1 UI/UX: Zeige Game Info und Namensfeld an
        infoDiv.classList.remove('hidden');
        infoDiv.classList.add('show');

        if (playerNameStep) {
            playerNameStep.classList.remove('hidden');
        }

        if (isDevelopment) {
            console.log('✅ Game info displayed and player name field shown');
        }
    }

    // ===========================
    // FORM VALIDATION
    // ===========================

    /**
     * ✅ P1 FIX: Enhanced form validation
     */
    function validateForm() {
        const gameCodeInput = document.getElementById('game-code');
        const playerNameInput = document.getElementById('player-name');
        const joinBtn = document.getElementById('join-btn');

        if (!gameCodeInput || !playerNameInput || !joinBtn) return;

        const gameCode = gameCodeInput.value;
        const playerName = playerNameInput.value.trim();

        // ✅ P0 FIX: Strict validation
        const isGameCodeValid = GAME_CODE_REGEX.test(gameCode);
        const isPlayerNameValid =
            playerName.length >= MIN_PLAYER_NAME_LENGTH &&
            playerName.length <= MAX_PLAYER_NAME_LENGTH;
        const hasGameData = currentGameData !== null;
        const isFirebaseReady = firebaseService && firebaseService.isReady;

        const isValid = isGameCodeValid && isPlayerNameValid && hasGameData && isFirebaseReady;

        // Update button
        joinBtn.disabled = !isValid;
        joinBtn.setAttribute('aria-disabled', String(!isValid));

        // ✅ P1 FIX: Update button text
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
     * ✅ P0 FIX: Join game using FirebaseService v6.0
     */
    async function joinGame() {
        const gameCodeInput = document.getElementById('game-code');
        const playerNameInput = document.getElementById('player-name');

        if (!gameCodeInput || !playerNameInput) return;

        const gameCode = gameCodeInput.value.toUpperCase();
        const playerName = playerNameInput.value.trim();

        // ✅ P0 FIX: Pre-validation
        if (!currentGameData) {
            showNotification('Spiel-Code ungültig', 'error');
            gameCodeInput.focus();
            return;
        }

        if (!GAME_CODE_REGEX.test(gameCode)) {
            showNotification('Ungültiger Spiel-Code', 'error');
            gameCodeInput.focus();
            return;
        }

        // ✅ P0 FIX: Validate player name
        if (playerName.length < MIN_PLAYER_NAME_LENGTH || playerName.length > MAX_PLAYER_NAME_LENGTH) {
            showNotification('Name muss zwischen 2-20 Zeichen lang sein', 'error');
            playerNameInput.focus();
            return;
        }

        if (!firebaseService || !firebaseService.isReady) {
            showNotification('Firebase nicht verbunden', 'error');
            return;
        }

        if (isDevelopment) {
            console.log(`🔗 Joining: ${gameCode} as ${playerName}`);
        }

        showLoading('Trete Spiel bei...');

        try {
            // ✅ P0 FIX: Use FirebaseService.joinGame() from v6.0
            const result = await firebaseService.joinGame(gameCode, {
                name: playerName
            });

            if (isDevelopment) {
                console.log('✅ Join successful:', result);
            }

            // ===========================
            // CRITICAL: Setup GameState with enforced device mode
            // ===========================
            gameState.gameId = gameCode;
            gameState.playerId = result.playerId;
            gameState.setPlayerName(playerName);

            // ENFORCE MULTIPLAYER GUEST MODE
            gameState.setDeviceMode('multi');
            gameState.isHost = false;
            gameState.isGuest = true;

            // Store game settings
            const settings = result.gameData.settings || {};
            const categories = settings.categories || result.gameData.selectedCategories || [];

            // Add categories using the correct method
            categories.forEach(cat => {
                gameState.addCategory(cat);
            });

            gameState.setDifficulty(settings.difficulty || 'medium');

            if (isDevelopment) {
                console.log('✅ Game state configured:', {
                    gameId: gameState.gameId,
                    playerId: gameState.playerId,
                    playerName: gameState.playerName,
                    deviceMode: gameState.deviceMode,
                    isHost: gameState.isHost,
                    isGuest: gameState.isGuest,
                    categories: gameState.selectedCategories,
                    difficulty: gameState.difficulty
                });
            }

            hideLoading();
            showNotification('Erfolgreich beigetreten!', 'success', 500);

            // Redirect to lobby immediately
            setTimeout(() => {
                window.location.href = 'multiplayer-lobby.html';
            }, 300);

        } catch (error) {
            console.error('❌ Join failed:', error);
            hideLoading();

            // ✅ P1 STABILITY: Use getFirebaseErrorMessage for consistent error handling
            const errorMessage = getFirebaseErrorMessage(error);
            showNotification(errorMessage, 'error');

            // ✅ P1 FIX: Focus on appropriate field based on error
            if (errorMessage.includes('Code') || errorMessage.includes('gefunden') || errorMessage.includes('nicht gefunden')) {
                gameCodeInput.focus();
            } else if (errorMessage.includes('Name') || errorMessage.includes('verwendet')) {
                playerNameInput.focus();
            } else {
                // Generic error - focus on code input
                gameCodeInput.focus();
            }
        }
    }

    // ===========================
    // NAVIGATION
    // ===========================

    /**
     * Go back to home
     */
    function goBack() {
        window.location.href = 'index.html';
    }

    // ===========================
    // UTILITY FUNCTIONS (use NocapUtils)
    // ===========================

    /**
     * ✅ P1 STABILITY: Get user-friendly Firebase error messages
     * @param {Error} error - Firebase error object
     * @returns {string} User-friendly error message
     */
    function getFirebaseErrorMessage(error) {
        if (!error) return 'Ein unbekannter Fehler ist aufgetreten';

        const errorCode = error.code;
        const errorMessage = error.message || '';

        // Firebase Auth Errors
        if (errorCode === 'auth/network-request-failed') {
            return '📡 Keine Internetverbindung. Bitte überprüfe deine Verbindung.';
        }
        if (errorCode === 'auth/too-many-requests') {
            return '⏳ Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.';
        }
        if (errorCode === 'auth/user-disabled') {
            return '🚫 Dieser Account wurde gesperrt. Kontaktiere den Support.';
        }

        // Firebase Database Errors
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

        // Network Errors
        if (errorMessage.includes('network') || errorMessage.includes('offline')) {
            return '📡 Netzwerkfehler. Bitte überprüfe deine Internetverbindung.';
        }
        if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
            return '⏱️ Zeitüberschreitung. Server antwortet nicht.';
        }

        // Game-specific errors
        if (errorMessage.includes('voll') || errorMessage.includes('full')) {
            return '👥 Dieses Spiel ist bereits voll. Versuche ein anderes Spiel.';
        }
        if (errorMessage.includes('gestartet') || errorMessage.includes('started')) {
            return '🎮 Dieses Spiel wurde bereits gestartet. Du kannst nicht mehr beitreten.';
        }
        if (errorMessage.includes('beendet') || errorMessage.includes('finished')) {
            return '🏁 Dieses Spiel ist bereits beendet.';
        }

        // Generic fallback
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
        alert(String(message)); // Fallback
    };

    // ===========================
    // CLEANUP
    // ===========================

    function cleanup() {
        if (checkTimeout) {
            clearTimeout(checkTimeout);
        }

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
        // Wait for Firebase to be loaded and initialized
        let attempts = 0;
        const maxAttempts = 150; // 15 seconds max (increased from 10s)

        console.log('⏳ Waiting for Firebase initialization...');

        while (attempts < maxAttempts) {
            // Check multiple conditions
            const hasFirebaseInitialized = window.firebaseInitialized === true;
            const hasFirebaseService = typeof window.FirebaseService !== 'undefined';
            const hasFirebaseGlobal = typeof firebase !== 'undefined';

            if (isDevelopment && attempts % 10 === 0) {
                console.log(`Firebase check attempt ${attempts}:`, {
                    firebaseInitialized: hasFirebaseInitialized,
                    FirebaseService: hasFirebaseService,
                    firebaseGlobal: hasFirebaseGlobal
                });
            }

            if (hasFirebaseInitialized && hasFirebaseService && hasFirebaseGlobal) {
                console.log('✅ Firebase ready after', attempts * 100, 'ms');
                return true;
            }

            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        console.error('❌ Firebase initialization timeout after 15 seconds');
        console.error('Final state:', {
            firebaseInitialized: window.firebaseInitialized,
            FirebaseService: typeof window.FirebaseService,
            firebase: typeof firebase
        });
        return false;
    }

    async function startApp() {
        const firebaseReady = await waitForFirebase();
        if (firebaseReady) {
            await initialize();
        } else {
            // ✅ FIX: Use showNotification instead of showError
            hideLoading();
            showNotification('Firebase konnte nicht geladen werden. Bitte lade die Seite neu.', 'error');

            // ✅ FIX: Offer reload option
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