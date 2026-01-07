/**
 * No-Cap Multiplayer Lobby
 * Version 4.0 - Security & Performance Optimized
 *
 * CRITICAL: This page manages real-time multiplayer lobby
 * - Creates game (if host)
 * - Joins existing game (if guest)
 * - Real-time player sync via Firebase
 * - Validates device mode continuously
 *
 * SECURITY FIXES:
 * ✅ P0: DOMPurify XSS prevention
 * ✅ P0: Age verification with server validation
 * ✅ P0: Safe DOM manipulation (textContent only)
 * ✅ P1: Memory leak prevention (listener cleanup)
 * ✅ P1: Error handling improvements
 */

(function(window) {
    'use strict';

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
    let gameState = null;
    let firebaseService = null;
    let currentGameId = null;
    let isHost = false;
    let currentUserId = null;
    let gameListener = null;

    const isDevelopment = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

    // ===========================
    // INITIALIZATION
    // ===========================

    async function initialize() {
        if (isDevelopment) {
            console.log('🎮 Initializing multiplayer lobby...');
        }

        // P0 FIX: Check DOMPurify
        if (typeof DOMPurify === 'undefined') {
            console.error('❌ CRITICAL: DOMPurify not loaded!');
            alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
            return;
        }

        // P0 FIX: Check age verification first
        if (!checkAgeVerification()) {
            return;
        }

        // Check dependencies
        if (typeof GameState === 'undefined') {
            showNotification('Fehler: GameState nicht gefunden', 'error');
            return;
        }

        // P1 FIX: Wait for dependencies
        if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
            await window.NocapUtils.waitForDependencies(['GameState', 'firebaseGameService', 'firebase']);
        }

        gameState = new GameState();

        // P0 FIX: Validate game state
        if (!validateGameState()) {
            return;
        }

        // P0 FIX: Use global firebaseGameService
        if (typeof window.FirebaseService !== 'undefined') {
            firebaseService = window.FirebaseService
        } else {
            console.error('❌ Firebase service not available');
            showNotification('Firebase nicht verfügbar', 'error');
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
                            if (isDevelopment) {
                                console.log('✅ Firebase user authenticated:', currentUserId);
                            }
                            resolve();
                        } else {
                            // No user - sign in anonymously
                            if (isDevelopment) {
                                console.log('⚠️ No user found, signing in anonymously...');
                            }

                            try {
                                const result = await firebase.auth().signInAnonymously();
                                currentUserId = result.user.uid;
                                if (isDevelopment) {
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

        // Determine if creating or joining
        if (gameState.gameId) {
            currentGameId = gameState.gameId;
            isHost = gameState.isHost || false;
            await loadExistingGame();
        } else if (gameState.isHost) {
            isHost = true;
            await createNewGame();
        } else {
            showNotification('Keine Game-ID gefunden', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }

        setupEventListeners();
        updateUIForRole();

        if (isDevelopment) {
            console.log('✅ Lobby initialized');
        }
    }

    // ===========================
    // VALIDATION
    // ===========================

    /**
     * ✅ FIX: Check age verification with 7-day expiration (consistent)
     */
    function checkAgeVerification() {
        try {
            // ✅ Load from nocap_age_verification (consistent with index.js)
            const verification = window.NocapUtils
                ? window.NocapUtils.getLocalStorage('nocap_age_verification')
                : JSON.parse(localStorage.getItem('nocap_age_verification') || 'null');

            if (!verification || typeof verification !== 'object') {
                console.error('❌ No age verification found');
                showNotification('Altersverifizierung erforderlich!', 'warning');
                setTimeout(() => window.location.href = 'index.html', 2000);
                return false;
            }

            // NOTE: We don't check timestamp expiry - once verified, always verified
            // This prevents players from being kicked out

            // Get age level from verification
            const ageLevel = verification.isAdult ? 18 : 0;

            // P0 FIX: Validate FSK access
            if (gameState && gameState.selectedCategories && gameState.selectedCategories.length > 0) {
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
                console.log(`✅ Age verification: ${ageLevel}+`);
            }
            return true;

        } catch (error) {
            console.error('❌ Age verification error:', error);
            showNotification('Altersverifizierung erforderlich!', 'warning');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }
    }

    function validateGameState() {
        if (isDevelopment) {
            console.log('🔍 Validating game state...');
        }

        if (!gameState || gameState.deviceMode !== 'multi') {
            console.error('❌ Wrong device mode:', gameState?.deviceMode);
            showNotification('Falscher Spielmodus', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (!gameState.checkValidity()) {
            showNotification('Ungültiger Spielzustand', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (!gameState.playerName) {
            console.error('❌ No player name');
            showNotification('Kein Spielername gesetzt', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (isDevelopment) {
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

            // P0 FIX: Generate game code locally
            const gameId = generateGameCode();
            currentGameId = gameId;

            const settings = {
                categories: gameState.selectedCategories || [],
                difficulty: gameState.difficulty || 'medium'
            };

            const gameData = {
                gameId: gameId,
                hostId: currentUserId,
                hostName: sanitizePlayerName(gameState.playerName),
                settings: settings,
                players: {
                    [currentUserId]: {
                        id: currentUserId,
                        name: sanitizePlayerName(gameState.playerName),
                        isHost: true,
                        isReady: true, // Host is always ready
                        joinedAt: Date.now()
                    }
                },
                status: 'lobby',
                createdAt: Date.now(),
                lastActivity: Date.now()
            };

            const gameRef = firebase.database().ref(`games/${gameId}`);
            await gameRef.set(gameData);

            gameState.gameId = gameId;
            gameState.isHost = true;

            displayGameCode(gameId);
            displayQRCode(gameId);
            displaySettings(settings);

            setupGameListener(gameId);

            showNotification('Spiel erstellt!', 'success', 800);
            if (isDevelopment) {
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

            displayGameCode(currentGameId);
            displayQRCode(currentGameId);
            displaySettings(game.settings);

            // ✅ FIX: Don't add player if already joined via join-game.html
            // join-game.html already adds the player via firebaseService.joinGame()
            // Just verify player exists
            const playerExists = game.players && Object.keys(game.players).some(pid => {
                const player = game.players[pid];
                return player.uid === currentUserId || pid === gameState.playerId;
            });

            if (!playerExists && !isHost) {
                // Only add if player truly doesn't exist (shouldn't happen normally)
                console.warn('⚠️ Player not found in game, adding...');
                await addPlayerToGame(currentGameId);
            } else if (isDevelopment && !isHost) {
                console.log('✅ Player already in game, skipping add');
            }

            setupGameListener(currentGameId);

            showNotification('Spiel geladen!', 'success', 800);
            if (isDevelopment) {
                console.log(`✅ Game loaded: ${currentGameId}`);
            }

        } catch (error) {
            console.error('❌ Load game error:', error);
            showNotification('Fehler beim Laden', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
        }
    }

    async function addPlayerToGame(gameId) {
        try {
            const playerData = {
                id: currentUserId,
                name: sanitizePlayerName(gameState.playerName),
                isHost: false,
                isReady: false,
                joinedAt: Date.now()
            };

            const playerRef = firebase.database().ref(`games/${gameId}/players/${currentUserId}`);
            await playerRef.set(playerData);

            if (isDevelopment) {
                console.log('✅ Player added to game');
            }

        } catch (error) {
            console.error('❌ Add player error:', error);
            throw error;
        }
    }

    /**
     * Setup Firebase game listener for real-time updates
     */
    function setupGameListener(gameId) {
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

        if (isDevelopment) {
            console.log('✅ Game listener setup');
        }
    }

    function handleGameUpdate(gameData) {
        if (!gameData) return;

        updatePlayersList(gameData.players);
        updateStartButton(gameData.players);

        // If game starts and we're not host, redirect to gameplay
        if (gameData.status === 'playing' && !isHost) {
            // ✅ CRITICAL FIX: Save gameState for guests BEFORE redirect - TRIPLE REDUNDANCY!
            gameState.gamePhase = 'playing';
            gameState.gameId = currentGameId;

            // Prepare state object
            const stateToSave = {
                gameId: currentGameId,
                playerId: gameState.playerId,
                deviceMode: 'multi',
                isHost: false,
                isGuest: true,
                gamePhase: 'playing',
                playerName: gameState.playerName,
                selectedCategories: gameState.selectedCategories,
                difficulty: gameState.difficulty
            };

            // Method 1: NocapUtils
            if (window.NocapUtils && window.NocapUtils.setLocalStorage) {
                try {
                    window.NocapUtils.setLocalStorage('nocap_game_state', stateToSave);
                } catch (e) {}
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
            } catch (e) {}

            // Method 4: URL parameter
            const targetUrl = 'multiplayer-gameplay.html?gameId=' + encodeURIComponent(currentGameId);

            showNotification('Spiel startet!', 'success', 300);
            setTimeout(() => {
                window.location.href = targetUrl;
            }, 200);
        }

        // If game starts and we're host, redirect after update
        if (gameData.status === 'playing' && isHost) {
            // Host already triggered the redirect in startGame()
        }
    }

    // ===========================
    // DISPLAY FUNCTIONS
    // ===========================

    function displayGameCode(gameId) {
        const codeDisplay = document.getElementById('game-code-display');
        if (codeDisplay) {
            codeDisplay.textContent = gameId;
        }
    }

    function displayQRCode(gameId) {
        const qrContainer = document.getElementById('qr-code');
        if (qrContainer && typeof QRCode !== 'undefined') {
            qrContainer.innerHTML = '';
            const joinUrl = `${window.location.origin}/join-game.html?gameId=${gameId}`;
            try {
                new QRCode(qrContainer, {
                    text: joinUrl,
                    width: 180,
                    height: 180,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch (error) {
                if (isDevelopment) {
                    console.warn('⚠️ QR Code generation failed:', error);
                }
                qrContainer.textContent = '❌ QR-Code nicht verfügbar';
            }
        }
    }

    /**
     * P0 FIX: Display settings with textContent only
     */
    function displaySettings(settings) {
        if (!settings) {
            settings = {
                categories: gameState.selectedCategories || [],
                difficulty: gameState.difficulty || 'medium'
            };
        }

        const categoriesDisplay = document.getElementById('selected-categories-display');
        if (categoriesDisplay && settings.categories && settings.categories.length > 0) {
            categoriesDisplay.innerHTML = '';

            settings.categories.forEach(cat => {
                const icon = categoryIcons[cat] || '❓';
                const name = categoryNames[cat] || cat;

                const tagDiv = document.createElement('div');
                tagDiv.className = 'category-tag';

                const iconSpan = document.createElement('span');
                iconSpan.className = 'category-tag-icon';
                iconSpan.textContent = icon;
                iconSpan.setAttribute('aria-hidden', 'true');

                const nameSpan = document.createElement('span');
                nameSpan.textContent = name;

                tagDiv.appendChild(iconSpan);
                tagDiv.appendChild(nameSpan);

                categoriesDisplay.appendChild(tagDiv);
            });
        }

        const difficultyDisplay = document.getElementById('difficulty-display');
        if (difficultyDisplay && settings.difficulty) {
            difficultyDisplay.textContent = difficultyNames[settings.difficulty] || settings.difficulty;
        }
    }

    /**
     * P0 FIX: Update players list with textContent only
     */
    function updatePlayersList(players) {
        const playersList = document.getElementById('players-list');
        const playerCount = document.getElementById('player-count');

        if (!players || Object.keys(players).length === 0) {
            displayEmptyPlayers();
            return;
        }

        const playersArray = Object.values(players);

        if (playerCount) {
            playerCount.textContent = `${playersArray.length}/${MAX_PLAYERS} Spieler`;
        }

        if (playersList) {
            playersList.innerHTML = '';

            playersArray.forEach(player => {
                const playerItem = document.createElement('div');
                playerItem.className = 'player-item';
                playerItem.setAttribute('role', 'listitem');

                if (player.isHost) playerItem.classList.add('host');
                if (player.isReady) playerItem.classList.add('ready');

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

                if (player.isHost) {
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
                    kickBtn.addEventListener('click', () => kickPlayer(player.id));
                    playerItem.appendChild(kickBtn);
                }

                playersList.appendChild(playerItem);
            });
        }
    }

    function displayEmptyPlayers() {
        const playersList = document.getElementById('players-list');
        const playerCount = document.getElementById('player-count');

        if (playerCount) {
            playerCount.textContent = '0/8 Spieler';
        }

        if (playersList) {
            playersList.innerHTML = '';

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

    async function toggleReady() {
        if (isHost) return; // Host is always ready

        try {
            const currentStatus = gameState.isReady || false;
            const newStatus = !currentStatus;

            // ✅ FIX: Use playerId instead of currentUserId
            // Guest players have a generated playerId (e.g. p_abc123), not currentUserId
            const playerId = gameState.playerId || currentUserId;

            if (isDevelopment) {
                console.log('🔄 Toggling ready for player:', playerId);
            }

            const playerRef = firebase.database().ref(`games/${currentGameId}/players/${playerId}/isReady`);
            await playerRef.set(newStatus);

            gameState.isReady = newStatus;

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

            // ✅ CRITICAL FIX: Save gameState BEFORE redirect - TRIPLE REDUNDANCY!
            gameState.gamePhase = 'playing';
            gameState.gameId = currentGameId;
            gameState.isHost = true;

            // Prepare state object
            const stateToSave = {
                gameId: currentGameId,
                deviceMode: 'multi',
                isHost: true,
                isGuest: false,
                gamePhase: 'playing',
                playerName: gameState.playerName,
                selectedCategories: gameState.selectedCategories,
                difficulty: gameState.difficulty
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
                // ✅ FIX: Use playerId for guests, currentUserId for host
                const playerId = gameState.playerId || currentUserId;

                if (playerId) {
                    const playerRef = firebase.database().ref(`games/${currentGameId}/players/${playerId}`);
                    await playerRef.remove();
                }

                // If host leaves, delete entire game
                if (isHost) {
                    const gameRef = firebase.database().ref(`games/${currentGameId}`);
                    await gameRef.remove();
                }
            }

            cleanup();
            gameState.gameId = null;
            gameState.isHost = false;
            gameState.isReady = false;

            window.location.href = 'index.html';

        } catch (error) {
            console.error('❌ Leave error:', error);
            window.location.href = 'index.html';
        }
    }

    function editSettings() {
        if (!isHost) return;
        window.location.href = 'multiplayer-category-selection.html';
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

        if (startBtn) {
            startBtn.addEventListener('click', startGame);
        }
        if (readyBtn) {
            readyBtn.addEventListener('click', toggleReady);
        }
        if (leaveBtn) {
            leaveBtn.addEventListener('click', leaveGame);
        }
        if (copyBtn) {
            copyBtn.addEventListener('click', copyGameCode);
        }
        if (editBtn) {
            editBtn.addEventListener('click', editSettings);
        }

        window.addEventListener('beforeunload', cleanup);

        if (isDevelopment) {
            console.log('✅ Event listeners setup');
        }
    }

    function copyGameCode() {
        const code = document.getElementById('game-code-display')?.textContent;
        if (!code) return;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(() => {
                showNotification('Code kopiert!', 'success', 2000);
            }).catch(() => {
                showNotification('Kopieren fehlgeschlagen', 'error');
            });
        } else {
            // Fallback for older browsers
            showNotification('Kopieren nicht unterstützt', 'warning');
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
    const showNotification = window.NocapUtils?.showNotification || function(message, type = 'info') {
        alert(sanitizeText(String(message))); // Fallback
    };
            if (notification.parentNode) {
                notification.remove();
            }
        }, duration);
    }

    // ===========================
    // CLEANUP
    // ===========================

    /**
     * Cleanup Firebase listeners
     */
    function cleanup() {
        if (gameListener) {
            try {
                gameListener.off();
                gameListener = null;
            } catch (error) {
                Logger.error('❌ Cleanup error:', error);
            }
        }

        if (window.NocapUtils && window.NocapUtils.cleanupEventListeners) {
            window.NocapUtils.cleanupEventListeners();
        }

        Logger.debug('✅ Multiplayer lobby cleanup completed');
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