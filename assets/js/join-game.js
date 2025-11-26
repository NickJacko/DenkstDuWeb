/**
 * No-Cap - Join Game Page
 * Version 3.0 - Audit-Fixed & Production Ready with Device Mode Enforcement
 * Handles joining existing multiplayer games
 *
 * CRITICAL: This page is the "Source of Truth" for Multiplayer Guest Mode
 * - Sets deviceMode = 'multi'
 * - Sets isGuest = true, isHost = false
 * - Parses gameId from URL
 */

(function(window) {
    'use strict';

    // ===========================
    // CONSTANTS
    // ===========================
    const MAX_GAME_CODE_LENGTH = 6;
    const MIN_PLAYER_NAME_LENGTH = 2;
    const MAX_PLAYER_NAME_LENGTH = 20;
    const CHECK_DEBOUNCE_MS = 800;

    // ===========================
    // GLOBAL STATE
    // ===========================
    let gameState = null;
    let firebaseService = null;
    let currentGameData = null;
    let checkTimeout = null;

    const isDevelopment = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

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
     * Main initialization function
     */
    async function initialize() {
        if (isDevelopment) {
            console.log('🔗 Join Game - Initialisierung...');
        }

        // P0 FIX: Check DOMPurify
        if (typeof DOMPurify === 'undefined') {
            console.error('❌ CRITICAL: DOMPurify not loaded!');
            alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
            return;
        }

        // P0 FIX: Check for required dependencies
        if (typeof GameState === 'undefined') {
            console.error('❌ GameState not loaded!');
            showNotification('Fehler: Spieldaten nicht geladen', 'error');
            return;
        }

        if (typeof window.FirebaseService === 'undefined') {
            console.error('❌ FirebaseGameService not loaded!');
            showNotification('Fehler: Firebase-Service nicht geladen', 'error');
            return;
        }

        // P1 FIX: Wait for dependencies
        if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
            await window.NocapUtils.waitForDependencies(['GameState', 'firebaseGameService']);
        }

        // Use global services
        gameState = new GameState();
        firebaseService = window.FirebaseService;

        // ===========================
        // CRITICAL: DEVICE MODE ENFORCEMENT
        // This page is ONLY for multiplayer guest mode
        // ===========================
        if (isDevelopment) {
            console.log('🎮 Enforcing multiplayer guest mode...');
        }

        gameState.deviceMode = 'multi';
        gameState.isHost = false;
        gameState.isGuest = true;

        if (isDevelopment) {
            console.log('✅ Device mode set:', {
                deviceMode: gameState.deviceMode,
                isHost: gameState.isHost,
                isGuest: gameState.isGuest
            });
        }

        // P1 FIX: Check age verification
        if (!checkAgeVerification()) {
            showNotification('Altersverifikation erforderlich', 'warning');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }

        // Initialize Firebase
        showLoading();

        try {
            // P1 FIX: Wait for Firebase with timeout
            const initialized = await Promise.race([
                firebaseService.initialize(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Firebase Timeout')), 10000)
                )
            ]);

            if (!initialized) {
                throw new Error('Firebase-Verbindung fehlgeschlagen');
            }

            if (isDevelopment) {
                console.log('✅ Firebase bereit');
            }

            // P0 FIX: Check URL parameter with validation
            handleUrlParameter();

        } catch (error) {
            console.error('❌ Initialization failed:', error);
            showNotification('Verbindung fehlgeschlagen. Bitte Seite neu laden.', 'error');
        } finally {
            hideLoading();
        }

        // Setup event listeners
        setupEventListeners();

        if (isDevelopment) {
            console.log('✅ Join Game bereit!');
        }
    }

    // ===========================
    // AGE VERIFICATION
    // ===========================

    /**
     * P1 FIX: Check age verification with expiration
     */
    function checkAgeVerification() {
        try {
            let ageLevel = 0;
            let ageVerified = null;

            if (window.NocapUtils && window.NocapUtils.getLocalStorage) {
                ageLevel = parseInt(window.NocapUtils.getLocalStorage('nocap_age_level')) || 0;
                const verifiedStr = window.NocapUtils.getLocalStorage('nocap_age_verification')
                if (verifiedStr) {
                    ageVerified = JSON.parse(verifiedStr);
                }
            }

            if (!ageVerified) {
                return false;
            }

            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;

            // Check if still valid (24 hours)
            if (ageVerified.timestamp && now - ageVerified.timestamp < oneDay) {
                return true;
            }

            return false;
        } catch (error) {
            console.error('Age verification check failed:', error);
            return false;
        }
    }

    // ===========================
    // URL PARAMETER HANDLING
    // ===========================

    /**
     * P0 FIX: Handle URL parameter with strict validation
     */
    function handleUrlParameter() {
        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('gameId') || urlParams.get('code');

        if (!gameId) {
            return;
        }

        // P0 FIX: Validate and sanitize gameId
        const sanitized = window.NocapUtils && window.NocapUtils.sanitizeInput
            ? window.NocapUtils.sanitizeInput(gameId)
            : gameId.replace(/[^A-Z0-9]/gi, '');

        const cleaned = sanitized.toUpperCase().substring(0, MAX_GAME_CODE_LENGTH);

        if (cleaned.length === MAX_GAME_CODE_LENGTH) {
            if (isDevelopment) {
                console.log(`📋 URL-Parameter: ${cleaned}`);
            }

            const gameCodeInput = document.getElementById('game-code');
            if (gameCodeInput) {
                gameCodeInput.value = cleaned;

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

    function setupEventListeners() {
        // Game code input
        const gameCodeInput = document.getElementById('game-code');
        if (gameCodeInput) {
            gameCodeInput.addEventListener('input', handleGameCodeInput);
            gameCodeInput.addEventListener('paste', () => {
                setTimeout(() => handleGameCodeInput(), 10);
            });
        }

        // Player name input
        const playerNameInput = document.getElementById('player-name');
        if (playerNameInput) {
            playerNameInput.addEventListener('input', validateForm);
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

        // Form submit prevention
        const form = document.getElementById('join-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                joinGame();
            });
        }

        // Enter key support
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const joinBtn = document.getElementById('join-btn');
                if (joinBtn && !joinBtn.disabled) {
                    joinGame();
                }
            }
        });
    }

    // ===========================
    // GAME CODE HANDLING
    // ===========================

    /**
     * P0 FIX: Handle game code input with sanitization
     */
    function handleGameCodeInput() {
        const input = document.getElementById('game-code');
        if (!input) return;

        // P0 FIX: Sanitize input
        let value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

        if (value.length > MAX_GAME_CODE_LENGTH) {
            value = value.substring(0, MAX_GAME_CODE_LENGTH);
        }

        input.value = value;

        // Clear previous timeout
        if (checkTimeout) {
            clearTimeout(checkTimeout);
        }

        // Reset UI
        input.classList.remove('valid', 'error');
        const gameInfo = document.getElementById('game-info');
        if (gameInfo) {
            gameInfo.classList.remove('show');
        }

        // Check if complete
        if (value.length === MAX_GAME_CODE_LENGTH) {
            checkTimeout = setTimeout(() => {
                checkGameExists(value);
            }, CHECK_DEBOUNCE_MS);
        }

        validateForm();
    }

    // ===========================
    // GAME VALIDATION
    // ===========================

    /**
     * P0 FIX: Check if game exists with server validation
     */
    async function checkGameExists(gameCode) {
        const input = document.getElementById('game-code');
        if (!input) return;

        try {
            if (isDevelopment) {
                console.log(`🔍 Checking game: ${gameCode}`);
            }

            // P0 FIX: Check Firebase connection
            if (!firebaseService || !firebaseService.isReady) {
                throw new Error('Keine Firebase-Verbindung');
            }

            // P0 FIX: Validate game code format
            if (!/^[A-Z0-9]{6}$/.test(gameCode)) {
                throw new Error('Ungültiges Code-Format');
            }

            // Query Firebase
            const gameRef = firebase.database().ref(`games/${gameCode}`);
            const snapshot = await gameRef.once('value');

            if (!snapshot.exists()) {
                throw new Error('Spiel nicht gefunden');
            }

            const gameData = snapshot.val();

            // P0 FIX: Validate game state
            if (gameData.gameState === 'finished') {
                throw new Error('Spiel bereits beendet');
            }

            if (gameData.gameState === 'playing') {
                throw new Error('Spiel läuft bereits');
            }

            // P1 FIX: Check FSK restrictions
            const categories = gameData.categories || gameData.selectedCategories || [];
            const hasFSK18 = categories.includes('fsk18');
            const hasFSK16 = categories.includes('fsk16');

            let ageLevel = 0;
            if (window.NocapUtils && window.NocapUtils.getLocalStorage) {
                ageLevel = parseInt(window.NocapUtils.getLocalStorage('nocap_age_level')) || 0;
            }

            if (hasFSK18 && ageLevel < 18) {
                throw new Error('Du musst mindestens 18 Jahre alt sein für dieses Spiel');
            }

            if (hasFSK16 && ageLevel < 16) {
                throw new Error('Du musst mindestens 16 Jahre alt sein für dieses Spiel');
            }

            // P1 FIX: Check max players
            const playerCount = gameData.players ? Object.keys(gameData.players).length : 0;
            const maxPlayers = gameData.maxPlayers || 8;

            if (playerCount >= maxPlayers) {
                throw new Error(`Spiel ist voll (${maxPlayers}/${maxPlayers})`);
            }

            // Success
            currentGameData = gameData;
            displayGameInfo(gameData);
            input.classList.add('valid');
            showNotification('Spiel gefunden!', 'success', 2000);

        } catch (error) {
            console.error('❌ Check failed:', error.message);
            input.classList.add('error');
            showNotification(error.message, 'error');
            currentGameData = null;
        }

        validateForm();
    }

    // ===========================
    // GAME INFO DISPLAY
    // ===========================

    /**
     * P0 FIX: Display game information with textContent
     */
    function displayGameInfo(gameData) {
        const infoDiv = document.getElementById('game-info');
        if (!infoDiv) return;

        if (isDevelopment) {
            console.log('📊 Displaying game info');
        }

        // P0 FIX: Use textContent instead of innerHTML
        const setTextSafe = (id, text) => {
            const elem = document.getElementById(id);
            if (elem) {
                elem.textContent = text || '-';
            }
        };

        // Host
        const hostPlayer = Object.values(gameData.players || {}).find(p => p.isHost);
        const hostName = hostPlayer ? hostPlayer.name : 'Unbekannt';
        setTextSafe('info-host', hostName);

        // Difficulty
        const difficultyText = difficultyNames[gameData.difficulty] || 'Standard';
        setTextSafe('info-difficulty', difficultyText);

        // Players
        const playerCount = gameData.players ? Object.keys(gameData.players).length : 0;
        const maxPlayers = gameData.maxPlayers || 8;
        setTextSafe('info-players', `${playerCount}/${maxPlayers}`);

        // Categories
        const categoriesArray = gameData.categories || gameData.selectedCategories || [];
        const categories = categoriesArray
            .map(cat => categoryData[cat]?.icon || '❓')
            .join(' ');
        setTextSafe('info-categories', categories || '-');

        // Status
        const statusNames = {
            waiting: 'Wartet',
            lobby: 'Lobby',
            playing: 'Läuft',
            finished: 'Beendet'
        };
        setTextSafe('info-status', statusNames[gameData.gameState] || 'Lobby');

        infoDiv.classList.add('show');
    }

    // ===========================
    // FORM VALIDATION
    // ===========================

    /**
     * Validate form inputs
     */
    function validateForm() {
        const gameCodeInput = document.getElementById('game-code');
        const playerNameInput = document.getElementById('player-name');
        const joinBtn = document.getElementById('join-btn');

        if (!gameCodeInput || !playerNameInput || !joinBtn) return;

        const gameCode = gameCodeInput.value;
        const playerName = playerNameInput.value.trim();

        // P0 FIX: Strict validation
        const isValid =
            /^[A-Z0-9]{6}$/.test(gameCode) &&
            playerName.length >= MIN_PLAYER_NAME_LENGTH &&
            playerName.length <= MAX_PLAYER_NAME_LENGTH &&
            currentGameData !== null &&
            firebaseService &&
            firebaseService.isReady;

        joinBtn.disabled = !isValid;
        joinBtn.setAttribute('aria-disabled', !isValid);
    }

    // ===========================
    // JOIN GAME
    // ===========================

    /**
     * P0 FIX: Join game with validation and device mode enforcement
     */
    async function joinGame() {
        const gameCodeInput = document.getElementById('game-code');
        const playerNameInput = document.getElementById('player-name');

        if (!gameCodeInput || !playerNameInput) return;

        const gameCode = gameCodeInput.value.toUpperCase();
        const playerName = playerNameInput.value.trim();

        // P0 FIX: Validate inputs
        if (!currentGameData) {
            showNotification('Spiel-Code ungültig', 'error');
            return;
        }

        // P0 FIX: Validate player name with utils
        let validatedName = playerName;
        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            validatedName = window.NocapUtils.sanitizeInput(playerName);
        }

        if (validatedName.length < MIN_PLAYER_NAME_LENGTH || validatedName.length > MAX_PLAYER_NAME_LENGTH) {
            showNotification('Name muss zwischen 2-20 Zeichen lang sein', 'error');
            return;
        }

        if (!firebaseService || !firebaseService.isReady) {
            showNotification('Firebase nicht verbunden', 'error');
            return;
        }

        if (isDevelopment) {
            console.log(`🔗 Joining: ${gameCode} as ${validatedName}`);
        }

        showLoading();

        try {
            // P0 FIX: Use firebaseService.joinGame (with sanitization)
            const result = await firebaseService.joinGame(gameCode, validatedName);

            if (isDevelopment) {
                console.log('✅ Successfully joined!');
            }

            // ===========================
            // CRITICAL: Setup game state with enforced device mode
            // ===========================
            gameState.gameId = gameCode;
            gameState.playerId = result.playerId;
            gameState.playerName = validatedName;

            // ENFORCE MULTIPLAYER GUEST MODE
            gameState.deviceMode = 'multi';
            gameState.isHost = false;
            gameState.isGuest = true;

            gameState.selectedCategories = result.gameData.categories || result.gameData.selectedCategories || [];
            gameState.difficulty = result.gameData.difficulty || 'medium';
            gameState.gamePhase = 'lobby';

            if (isDevelopment) {
                console.log('✅ Game state configured:', {
                    deviceMode: gameState.deviceMode,
                    isHost: gameState.isHost,
                    isGuest: gameState.isGuest,
                    gameId: gameState.gameId,
                    playerId: gameState.playerId
                });
            }

            hideLoading();
            showNotification('Erfolgreich beigetreten!', 'success', 1500);

            // Redirect to lobby
            setTimeout(() => {
                window.location.href = 'multiplayer-lobby.html';
            }, 1500);

        } catch (error) {
            console.error('❌ Join failed:', error);
            hideLoading();

            // P0 FIX: User-friendly error messages
            const errorMessage = error.message.includes('bereits vergeben')
                ? 'Dieser Name ist bereits vergeben'
                : error.message.includes('voll')
                    ? 'Das Spiel ist bereits voll'
                    : error.message.includes('gestartet')
                        ? 'Das Spiel wurde bereits gestartet'
                        : 'Fehler beim Beitreten';

            showNotification(errorMessage, 'error');
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
    // UTILITY FUNCTIONS
    // ===========================

    function showLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.add('show');
        }
    }

    function hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.remove('show');
        }
    }

    /**
     * P0 FIX: Safe notification function
     */
    function showNotification(message, type = 'info', duration = 3000) {
        // Use NocapUtils if available
        if (window.NocapUtils && window.NocapUtils.showNotification) {
            window.NocapUtils.showNotification(message, type, duration);
            return;
        }

        // Fallback implementation
        const container = document.body;

        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'polite');
        notification.textContent = String(message).replace(/<[^>]*>/g, '');

        // Inline styles for fallback
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.padding = '15px 25px';
        notification.style.borderRadius = '10px';
        notification.style.fontWeight = '600';
        notification.style.zIndex = '10001';
        notification.style.maxWidth = '300px';
        notification.style.color = 'white';

        if (type === 'success') notification.style.background = '#4CAF50';
        if (type === 'error') notification.style.background = '#f44336';
        if (type === 'warning') notification.style.background = '#ff9800';
        if (type === 'info') notification.style.background = '#2196F3';

        container.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, duration);
    }

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

        if (isDevelopment) {
            console.log('✅ Join game cleanup completed');
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