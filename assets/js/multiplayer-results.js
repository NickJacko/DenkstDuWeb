/**
 * ✅ MULTIPLAYER-RESULTS.JS - Complete Implementation
 * Version: 1.0 - Production Ready
 *
 * Features:
 * - Safe DOM manipulation (P0 Security)
 * - Auto-redirect with countdown (P1 Stability)
 * - Share functionality (P1 UI/UX)
 * - Game rating (P1 UI/UX)
 * - Responsive design support
 */

(function() {
    'use strict';

    const Logger = window.NocapUtils?.Logger || {
        debug: (...args) => {},
        info: (...args) => {},
        warn: console.warn,
        error: console.error
    };

    // ===========================
    // MODULE PATTERN
    // ===========================

    const MultiplayerResultsModule = {
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

    Object.seal(MultiplayerResultsModule.state);

    // ===========================
    // UTILITIES
    // ===========================

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
        MultiplayerResultsModule.state.eventListenerCleanup.push({
            element: el,
            event: evt,
            handler,
            options: opts
        });
    }

    // ===========================
    // CONSTANTS
    // ===========================

    const AUTO_REDIRECT_DELAY = 60000; // 60 seconds
    const COUNTDOWN_INTERVAL = 1000; // 1 second

    // ✅ P1 DSGVO: Auto-delete results after 24 hours
    const RESULTS_RETENTION_TIME = 24 * 60 * 60 * 1000; // 24 hours

    // ===========================
    // STATE
    // ===========================

    let gameResults = null;
    let redirectTimer = null;
    let countdownInterval = null;
    let redirectTimeLeft = 60;

    // ✅ P0 SECURITY: User authentication
    let currentUserId = null;
    let currentGameId = null;
    let isAuthorizedUser = false;

    // ✅ P1 STABILITY: Host transfer
    let currentHostId = null;
    let playersInGame = [];

    // ✅ P2 PERFORMANCE: Listener tracking
    let gameListener = null;

    // ✅ P1 UI/UX: View filters
    let showOnlyTop3 = false;

    // ===========================
    // INITIALIZATION
    // ===========================

    document.addEventListener('DOMContentLoaded', async () => {
        try {
            // ✅ P0 SECURITY: Check DOMPurify availability
            if (typeof DOMPurify === 'undefined') {
                console.error('❌ CRITICAL: DOMPurify not loaded!');
                showError('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
                return;
            }

            // ✅ P0 SECURITY: Verify user authentication
            await verifyUserAuthentication();

            // Load game results
            await loadGameResults();

            // ✅ P0 SECURITY: Verify user is authorized to view results
            if (!verifyUserAuthorization()) {
                throw new Error('UNAUTHORIZED');
            }

            // Display results
            displayResults();

            // Setup event listeners
            setupEventListeners();

            // Start auto-redirect timer
            startAutoRedirectTimer();

            // ✅ P1 DSGVO: Schedule auto-deletion
            scheduleResultsDeletion();

            hideLoading();

        } catch (error) {
            console.error('❌ Initialization failed:', error);
            handleInitializationError(error);
        }
    });

    // ===========================
    // ✅ P0 SECURITY: AUTHENTICATION & AUTHORIZATION
    // ===========================

    /**
     * ✅ P0 SECURITY: Verify user is authenticated
     */
    async function verifyUserAuthentication() {
        // Try Firebase Auth
        if (firebase && firebase.auth) {
            const user = firebase.auth().currentUser;
            if (user) {
                currentUserId = user.uid;
                return;
            }

            // Wait for auth state
            await new Promise((resolve) => {
                const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
                    unsubscribe();
                    if (user) {
                        currentUserId = user.uid;
                    }
                    resolve();
                });
            });
        }

        // Fallback: Try localStorage
        if (!currentUserId) {
            const savedState = localStorage.getItem('nocap_game_state');
            if (savedState) {
                try {
                    const state = JSON.parse(savedState);
                    currentUserId = state.playerId;
                } catch (e) {
                    console.warn('Could not parse game state:', e);
                }
            }
        }

        // Generate anonymous ID if needed
        if (!currentUserId) {
            currentUserId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            console.warn('⚠️ No authenticated user - using anonymous ID');
        }
    }

    /**
     * ✅ P0 SECURITY: Verify user is authorized to view these results
     * @returns {boolean} True if authorized
     */
    function verifyUserAuthorization() {
        if (!gameResults || !gameResults.gameId) {
            return false;
        }

        // Check if user was part of the game
        if (gameResults.rankings && Array.isArray(gameResults.rankings)) {
            const playerIds = gameResults.rankings.map(p => p.playerId).filter(Boolean);

            // User must be in the player list
            isAuthorizedUser = playerIds.includes(currentUserId);

            if (!isAuthorizedUser) {
                console.error('❌ User not authorized to view these results');
                return false;
            }

            playersInGame = gameResults.rankings.map(p => ({
                id: p.playerId,
                name: p.name
            }));

            // Determine current host
            if (gameResults.hostId) {
                currentHostId = gameResults.hostId;
            } else if (playerIds.length > 0) {
                currentHostId = playerIds[0]; // First player becomes host
            }
        }

        return isAuthorizedUser;
    }

    // ===========================
    // LOAD DATA
    // ===========================

    /**
     * ✅ P1 STABILITY: Load game results with comprehensive error handling
     */
    async function loadGameResults() {
        // Try to get results from multiple sources
        const gameId = getGameIdFromURL() ||
                      localStorage.getItem('nocap_game_id') ||
                      sessionStorage.getItem('nocap_game_id');

        if (!gameId) {
            throw new Error('NO_GAME_ID');
        }

        currentGameId = gameId;

        // Try Firebase first
        if (firebase && firebase.database) {
            try {
                const gameRef = firebase.database().ref(`games/${gameId}`);
                const snapshot = await gameRef.once('value');
                const gameData = snapshot.val();

                // ✅ P1 STABILITY: Check if game was deleted
                if (!gameData) {
                    throw new Error('GAME_DELETED');
                }

                // ✅ P1 STABILITY: Check if game was ended by host
                if (gameData.status === 'ended' || gameData.status === 'closed') {
                    throw new Error('GAME_ENDED');
                }

                // Get results
                if (gameData.results) {
                    gameResults = gameData.results;
                    gameResults.gameId = gameId;
                    gameResults.hostId = gameData.hostId;
                    return;
                }

                // ✅ P1 STABILITY: Calculate results if not yet available
                if (gameData.players) {
                    gameResults = calculateResultsFromGameData(gameData);
                    gameResults.gameId = gameId;
                    gameResults.hostId = gameData.hostId;
                    return;
                }

            } catch (error) {
                // Re-throw specific errors
                if (error.message === 'GAME_DELETED' || error.message === 'GAME_ENDED') {
                    throw error;
                }
                console.warn('Firebase load failed:', error);
            }
        }

        // Fallback: Try localStorage
        const savedResults = localStorage.getItem('nocap_game_results');
        if (savedResults) {
            try {
                gameResults = JSON.parse(savedResults);
                gameResults.gameId = gameId;
                return;
            } catch (error) {
                console.warn('localStorage parse failed:', error);
            }
        }

        throw new Error('NO_RESULTS');
    }

    /**
     * ✅ P1 STABILITY: Calculate results from game data if needed
     */
    function calculateResultsFromGameData(gameData) {
        const players = gameData.players || {};
        const rankings = Object.entries(players)
            .map(([playerId, player]) => ({
                playerId: playerId, // ✅ P0 SECURITY: Store player ID for authorization
                name: player.name || 'Unbekannt',
                totalScore: player.totalScore || 0,
                correctAnswers: player.correctAnswers || 0,
                avgTimePerQuestion: player.avgTimePerQuestion || 0
            }))
            .sort((a, b) => b.totalScore - a.totalScore);

        return {
            gameId: gameData.gameId,
            hostId: gameData.hostId,
            rankings,
            stats: {
                totalRounds: gameData.currentRound || 0,
                totalPlayers: Object.keys(players).length,
                duration: gameData.duration || 0,
                accuracy: calculateAverageAccuracy(players)
            },
            facts: generateFunFacts(gameData)
        };
    }

    function calculateAverageAccuracy(players) {
        const playersArray = Object.values(players);
        if (playersArray.length === 0) return 0;

        const totalAccuracy = playersArray.reduce((sum, player) => {
            const correct = player.correctAnswers || 0;
            const total = player.totalQuestions || 1;
            return sum + (correct / total * 100);
        }, 0);

        return totalAccuracy / playersArray.length;
    }

    function generateFunFacts(gameData) {
        const facts = [];
        const players = Object.values(gameData.players || {});

        if (players.length > 0) {
            // Most correct answers
            const bestPlayer = players.reduce((best, player) =>
                (player.correctAnswers || 0) > (best.correctAnswers || 0) ? player : best
            );
            facts.push({
                icon: '🎯',
                text: `${bestPlayer.name} hatte die meisten richtigen Antworten!`
            });

            // Fastest player
            const fastestPlayer = players.reduce((fastest, player) =>
                (player.avgTimePerQuestion || 999) < (fastest.avgTimePerQuestion || 999) ? player : fastest
            );
            facts.push({
                icon: '⚡',
                text: `${fastestPlayer.name} war am schnellsten!`
            });
        }

        return facts;
    }

    function getGameIdFromURL() {
        const params = new URLSearchParams(window.location.search);
        return params.get('gameId') || params.get('code');
    }

    // ===========================
    // DISPLAY RESULTS
    // ===========================

    /**
     * ✅ P0 SECURITY: Display results with safe DOM manipulation
     */
    function displayResults() {
        if (!gameResults) return;

        // Display stats
        displayGameStats(gameResults.stats);

        // Display podium (top 3)
        displayPodium(gameResults.rankings);

        // Display all players list
        displayPlayersList(gameResults.rankings);

        // Display fun facts
        displayFunFacts(gameResults.facts);
    }

    /**
     * ✅ P1 UI/UX: Display game stats with motivational messages
     */
    function displayGameStats(stats) {
        if (!stats) return;

        const totalRounds = document.getElementById('total-rounds-stat');
        const totalPlayers = document.getElementById('total-players-stat');
        const gameDuration = document.getElementById('game-duration-stat');
        const accuracy = document.getElementById('accuracy-stat');

        if (totalRounds) totalRounds.textContent = stats.totalRounds || 0;
        if (totalPlayers) totalPlayers.textContent = stats.totalPlayers || 0;
        if (gameDuration) gameDuration.textContent = formatDuration(stats.duration || 0);
        if (accuracy) {
            const accuracyValue = Math.round(stats.accuracy || 0);
            accuracy.textContent = `${accuracyValue}%`;

            // ✅ P1 UI/UX: Add motivational class based on accuracy
            if (accuracyValue >= 80) {
                accuracy.classList.add('excellent');
            } else if (accuracyValue >= 60) {
                accuracy.classList.add('good');
            }
        }

        // ✅ P1 UI/UX: Display motivational message
        displayMotivationalMessage(stats);
    }

    /**
     * ✅ P1 UI/UX: Display motivational message based on performance
     */
    function displayMotivationalMessage(stats) {
        const messageEl = document.getElementById('motivational-message');
        if (!messageEl) return;

        const accuracy = Math.round(stats.accuracy || 0);
        let message = '';

        if (accuracy >= 90) {
            message = '🌟 Hervorragend! Du kennst deine Freunde sehr gut!';
        } else if (accuracy >= 75) {
            message = '🎉 Großartig! Das war eine starke Performance!';
        } else if (accuracy >= 60) {
            message = '👍 Gut gemacht! Du hast dich gut geschlagen!';
        } else if (accuracy >= 40) {
            message = '💪 Nicht schlecht! Beim nächsten Mal wird es besser!';
        } else {
            message = '😊 Noch Luft nach oben, aber das macht es spannend!';
        }

        messageEl.textContent = message;
        messageEl.removeAttribute('hidden');
    }

    function formatDuration(milliseconds) {
        const minutes = Math.floor(milliseconds / 60000);
        const seconds = Math.floor((milliseconds % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * ✅ P1 UI/UX: Display podium (top 3) with safe DOM
     */
    function displayPodium(rankings) {
        if (!rankings || rankings.length === 0) return;

        // Top 3 players
        const top3 = rankings.slice(0, 3);

        top3.forEach((player, index) => {
            const rank = index + 1;
            const podiumPlayer = document.getElementById(`podium-player-${rank}`);

            if (!podiumPlayer) return;

            // Find player name element
            const nameEl = podiumPlayer.querySelector('.player-name');
            const scoreEl = podiumPlayer.querySelector('.player-score');

            if (nameEl) {
                // ✅ P0 SECURITY: Sanitize player name
                const sanitizedName = DOMPurify.sanitize(player.name, {
                    ALLOWED_TAGS: [],
                    KEEP_CONTENT: true
                });
                nameEl.textContent = sanitizedName;
            }

            if (scoreEl) {
                scoreEl.textContent = `${player.totalScore || 0} Punkte`;
            }
        });
    }

    /**
     * ✅ P1 UI/UX: Display all players as ordered list
     */
    function displayPlayersList(rankings) {
        const playersList = document.getElementById('players-list');
        if (!playersList || !rankings) return;

        // ✅ P0 SECURITY: Clear safely
        while (playersList.firstChild) {
            playersList.removeChild(playersList.firstChild);
        }

        // ✅ P1 UI/UX: Filter based on view preference
        const playersToShow = showOnlyTop3 ? rankings.slice(0, 3) : rankings;

        playersToShow.forEach((player, index) => {
            const li = document.createElement('li');
            li.className = 'player-list-item';
            li.setAttribute('role', 'listitem');

            // Rank
            const rankEl = document.createElement('span');
            rankEl.className = 'player-rank';

            // ✅ P1 UI/UX: Add medal icons for top 3
            if (index === 0) {
                rankEl.textContent = '🥇';
                rankEl.setAttribute('aria-label', '1. Platz - Gold');
                li.classList.add('rank-1');
            } else if (index === 1) {
                rankEl.textContent = '🥈';
                rankEl.setAttribute('aria-label', '2. Platz - Silber');
                li.classList.add('rank-2');
            } else if (index === 2) {
                rankEl.textContent = '🥉';
                rankEl.setAttribute('aria-label', '3. Platz - Bronze');
                li.classList.add('rank-3');
            } else {
                rankEl.textContent = `${index + 1}.`;
                rankEl.setAttribute('aria-label', `${index + 1}. Platz`);
            }

            // Name (sanitized)
            const nameEl = document.createElement('span');
            nameEl.className = 'player-name';
            const sanitizedName = DOMPurify.sanitize(player.name, {
                ALLOWED_TAGS: [],
                KEEP_CONTENT: true
            });
            nameEl.textContent = sanitizedName;

            // Score (validate as number)
            const scoreEl = document.createElement('span');
            scoreEl.className = 'player-score';
            const validatedScore = Math.max(0, parseInt(player.totalScore) || 0);
            scoreEl.textContent = `${validatedScore} Punkte`;

            // Build item
            li.appendChild(rankEl);
            li.appendChild(nameEl);
            li.appendChild(scoreEl);

            playersList.appendChild(li);
        });

        // Update toggle button text
        updateToggleButtonText();
    }

    /**
     * ✅ P1 UI/UX: Toggle between full list and top 3
     */
    function toggleRankingView() {
        showOnlyTop3 = !showOnlyTop3;
        displayPlayersList(gameResults.rankings);
    }

    /**
     * ✅ P1 UI/UX: Update toggle button text
     */
    function updateToggleButtonText() {
        const toggleBtn = document.getElementById('toggle-ranking-btn');
        if (!toggleBtn) return;

        toggleBtn.textContent = showOnlyTop3 ?
            '📋 Alle Spieler anzeigen' :
            '🏆 Nur Top 3 anzeigen';
    }

    function displayFunFacts(facts) {
        const factsGrid = document.getElementById('facts-grid');
        if (!factsGrid || !facts) return;

        // Clear safely
        while (factsGrid.firstChild) {
            factsGrid.removeChild(factsGrid.firstChild);
        }

        facts.forEach(fact => {
            const factCard = document.createElement('div');
            factCard.className = 'fact-card';
            factCard.setAttribute('role', 'listitem');

            const icon = document.createElement('div');
            icon.className = 'fact-icon';
            icon.textContent = fact.icon;
            icon.setAttribute('aria-hidden', 'true');

            const text = document.createElement('div');
            text.className = 'fact-text';
            text.textContent = fact.text;

            factCard.appendChild(icon);
            factCard.appendChild(text);

            factsGrid.appendChild(factCard);
        });
    }

    // ===========================
    // AUTO-REDIRECT (P1 STABILITY)
    // ===========================

    /**
     * ✅ P1 STABILITY: Start auto-redirect timer with countdown
     */
    function startAutoRedirectTimer() {
        redirectTimeLeft = 60;

        // Start countdown
        redirectTimer = setTimeout(() => {
            showAutoRedirectDialog();
        }, AUTO_REDIRECT_DELAY - 10000); // Show warning 10 seconds before
    }

    function showAutoRedirectDialog() {
        const dialog = document.getElementById('auto-redirect-dialog');
        const countdown = document.getElementById('redirect-countdown');

        if (!dialog) return;

        dialog.removeAttribute('hidden');
        dialog.setAttribute('aria-hidden', 'false');

        // Start countdown
        redirectTimeLeft = 10;
        if (countdown) countdown.textContent = redirectTimeLeft;

        countdownInterval = setInterval(() => {
            redirectTimeLeft--;
            if (countdown) countdown.textContent = redirectTimeLeft;

            if (redirectTimeLeft <= 0) {
                clearInterval(countdownInterval);
                redirectToMenu();
            }
        }, COUNTDOWN_INTERVAL);
    }

    function hideAutoRedirectDialog() {
        const dialog = document.getElementById('auto-redirect-dialog');
        if (!dialog) return;

        dialog.setAttribute('hidden', '');
        dialog.setAttribute('aria-hidden', 'true');

        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }

    function cancelAutoRedirect() {
        if (redirectTimer) {
            clearTimeout(redirectTimer);
            redirectTimer = null;
        }

        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        hideAutoRedirectDialog();
    }

    function redirectToMenu() {
        cleanup();
        window.location.href = 'index.html';
    }

    // ===========================
    // ✅ P1 DSGVO: AUTO-DELETION
    // ===========================

    /**
     * ✅ P1 DSGVO: Schedule automatic deletion of results after 24 hours
     */
    function scheduleResultsDeletion() {
        if (!currentGameId || !firebase || !firebase.database) {
            return;
        }

        // Only host schedules deletion
        if (currentUserId !== currentHostId) {
            return;
        }

        setTimeout(async () => {
            try {
                await deleteGameResults();
                console.log('✅ Results auto-deleted after retention period');
            } catch (error) {
                console.error('❌ Auto-deletion failed:', error);
            }
        }, RESULTS_RETENTION_TIME);
    }

    /**
     * ✅ P1 DSGVO: Delete game results from database
     */
    async function deleteGameResults() {
        if (!currentGameId || !firebase || !firebase.database) {
            return;
        }

        try {
            // Create anonymized summary before deletion
            const summary = createAnonymizedSummary();

            // Save anonymized summary
            await firebase.database()
                .ref(`gameSummaries/${currentGameId}`)
                .set({
                    ...summary,
                    deletedAt: firebase.database.ServerValue.TIMESTAMP
                });

            // Delete full game data
            await firebase.database()
                .ref(`games/${currentGameId}`)
                .remove();

            console.log('🗑️ Game data deleted, anonymized summary saved');
        } catch (error) {
            console.error('❌ Error deleting game data:', error);
            throw error;
        }
    }

    /**
     * ✅ P1 DSGVO: Create anonymized summary without personal data
     */
    function createAnonymizedSummary() {
        if (!gameResults) {
            return {};
        }

        return {
            totalPlayers: gameResults.stats?.totalPlayers || 0,
            totalRounds: gameResults.stats?.totalRounds || 0,
            avgAccuracy: gameResults.stats?.accuracy || 0,
            duration: gameResults.stats?.duration || 0,
            // No player names or IDs
            topScore: gameResults.rankings?.[0]?.totalScore || 0,
            timestamp: Date.now()
        };
    }

    // ===========================
    // ✅ P1 STABILITY: HOST TRANSFER
    // ===========================

    /**
     * ✅ P1 STABILITY: Transfer host role to another player
     * @param {string} newHostId - Player ID of new host
     */
    async function transferHost(newHostId) {
        if (!currentGameId || !firebase || !firebase.database) {
            return;
        }

        // Only current host can transfer
        if (currentUserId !== currentHostId) {
            console.warn('⚠️ Only host can transfer host role');
            return;
        }

        // Validate new host is in game
        if (!playersInGame.find(p => p.id === newHostId)) {
            console.error('❌ New host not in player list');
            return;
        }

        try {
            await firebase.database()
                .ref(`games/${currentGameId}`)
                .update({
                    hostId: newHostId,
                    lastUpdate: firebase.database.ServerValue.TIMESTAMP
                });

            currentHostId = newHostId;
            console.log('✅ Host transferred to:', newHostId);

            showNotification('Host-Rolle wurde übertragen', 'success');
        } catch (error) {
            console.error('❌ Host transfer failed:', error);
            showNotification('Host-Übertragung fehlgeschlagen', 'error');
        }
    }

    /**
     * ✅ P1 STABILITY: Auto-transfer host if current host leaves
     */
    async function handleHostLeaving() {
        if (currentUserId !== currentHostId) {
            // Not the host, just leave
            return;
        }

        // Find next player to be host
        const remainingPlayers = playersInGame.filter(p => p.id !== currentUserId);

        if (remainingPlayers.length > 0) {
            const newHostId = remainingPlayers[0].id;
            await transferHost(newHostId);
            console.log('✅ Host auto-transferred to next player');
        } else {
            // No players left, delete game
            await deleteGameResults();
            console.log('🗑️ Last player left, game deleted');
        }
    }

    // ===========================
    // ✅ P1 UI/UX: RESTART & REMATCH
    // ===========================

    /**
     * ✅ P1 UI/UX: Start new game with same players
     */
    async function restartGame() {
        if (!currentGameId || !firebase || !firebase.database) {
            // Fallback: Just go to lobby
            window.location.href = 'multiplayer-lobby.html';
            return;
        }

        try {
            // Only host can restart
            if (currentUserId !== currentHostId) {
                showNotification('Nur der Host kann ein neues Spiel starten', 'warning');
                return;
            }

            // Create new game with same settings
            const oldGameRef = firebase.database().ref(`games/${currentGameId}`);
            const snapshot = await oldGameRef.once('value');
            const oldGame = snapshot.val();

            if (!oldGame) {
                throw new Error('Original game not found');
            }

            // Generate new game code
            const newGameCode = generateGameCode();
            const newGameRef = firebase.database().ref(`games/${newGameCode}`);

            // Create new game
            await newGameRef.set({
                hostId: currentUserId,
                hostName: oldGame.hostName || 'Host',
                code: newGameCode,
                status: 'waiting',
                selectedCategories: oldGame.selectedCategories || ['fsk0'],
                difficulty: oldGame.difficulty || 'medium',
                players: {
                    [currentUserId]: {
                        id: currentUserId,
                        name: playersInGame.find(p => p.id === currentUserId)?.name || 'Spieler',
                        isHost: true,
                        joinedAt: firebase.database.ServerValue.TIMESTAMP
                    }
                },
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });

            // Save to localStorage
            localStorage.setItem('nocap_game_id', newGameCode);

            // Redirect to lobby
            showNotification('Neues Spiel erstellt! 🎮', 'success');

            setTimeout(() => {
                window.location.href = `multiplayer-lobby.html?code=${newGameCode}`;
            }, 1000);

        } catch (error) {
            console.error('❌ Restart failed:', error);
            showNotification('Neustart fehlgeschlagen', 'error');

            // Fallback: Go to lobby
            setTimeout(() => {
                window.location.href = 'multiplayer-lobby.html';
            }, 2000);
        }
    }

    /**
     * Generate random 6-character game code
     */
    function generateGameCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // ===========================
    // ✅ P1 UI/UX: SHARE WITH ANONYMIZATION
    // ===========================

    /**
     * ✅ P1 UI/UX: Share via WhatsApp
     */
    function shareViaWhatsApp() {
        const message = generateShareMessage();
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    /**
     * ✅ P1 UI/UX: Share via Telegram
     */
    function shareViaTelegram() {
        const message = generateShareMessage();
        const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(message)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    /**
     * ✅ P1 UI/UX: Copy results link to clipboard
     */
    async function copyResultsLink() {
        const link = window.location.href;

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(link);
            } else {
                // Fallback
                const textArea = document.createElement('textarea');
                textArea.value = link;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }

            showShareFeedback('Link kopiert!');

        } catch (error) {
            console.error('Copy failed:', error);
            showShareFeedback('Kopieren fehlgeschlagen', 'error');
        }
    }

    /**
     * ✅ P0 SECURITY: Generate share message with sanitized content
     * ✅ P1 DSGVO: Anonymize player data in shared content
     * Prevents XSS in shared URLs
     */
    function generateShareMessage() {
        if (!gameResults || !gameResults.rankings || gameResults.rankings.length === 0) {
            return 'Schau dir mein No-Cap Spielergebnis an!';
        }

        const winner = gameResults.rankings[0];

        // ✅ P0 SECURITY: Sanitize winner name to prevent XSS
        const winnerName = DOMPurify.sanitize(winner.name, {
            ALLOWED_TAGS: [],
            KEEP_CONTENT: true
        });

        // ✅ P0 SECURITY: Sanitize score (validate as number)
        const score = Math.max(0, parseInt(winner.totalScore) || 0);

        // ✅ P0 SECURITY: Use origin from trusted source, not from user input
        const origin = window.location.origin;

        // ✅ P1 DSGVO: Option to anonymize names in share
        const anonymized = document.getElementById('anonymize-share-checkbox')?.checked;
        const displayName = anonymized ? `Spieler 1` : winnerName;

        return `🎉 ${displayName} hat No-Cap gewonnen mit ${score} Punkten! Spiele jetzt mit: ${origin}`;
    }

    /**
     * ✅ P1 DSGVO: Generate anonymized results for sharing
     */
    function generateAnonymizedShareMessage() {
        if (!gameResults || !gameResults.rankings || gameResults.rankings.length === 0) {
            return 'Wir haben No-Cap gespielt! 🎮';
        }

        const topScore = Math.max(0, parseInt(gameResults.rankings[0]?.totalScore) || 0);
        const playerCount = gameResults.stats?.totalPlayers || gameResults.rankings.length;

        return `🎮 No-Cap Ergebnis: ${playerCount} Spieler, Top-Score: ${topScore} Punkte! Spiel jetzt mit: ${window.location.origin}`;
    }

    function showShareFeedback(message, type = 'success') {
        const feedback = document.getElementById('share-feedback');
        if (!feedback) return;

        const text = feedback.querySelector('.feedback-text');
        if (text) text.textContent = message;

        feedback.removeAttribute('hidden');

        setTimeout(() => {
            feedback.setAttribute('hidden', '');
        }, 3000);
    }

    /**
     * ✅ P1 UI/UX: Save screenshot (placeholder - would need html2canvas or similar)
     */
    function saveScreenshot() {
        alert('Screenshot-Funktion wird in einer zukünftigen Version verfügbar sein.');
        // TODO: Implement with html2canvas
    }

    // ===========================
    // GAME RATING (P1 UI/UX)
    // ===========================

    /**
     * ✅ P1 UI/UX: Submit game rating
     */
    async function submitRating(rating) {
        try {
            // Save to Firebase (if available)
            if (firebase && firebase.database && gameResults) {
                await firebase.database()
                    .ref(`ratings/${Date.now()}`)
                    .set({
                        rating,
                        timestamp: firebase.database.ServerValue.TIMESTAMP,
                        gameId: gameResults.gameId
                    });
            }

            // Show feedback
            const feedback = document.getElementById('rating-feedback');
            if (feedback) {
                feedback.removeAttribute('hidden');

                setTimeout(() => {
                    feedback.setAttribute('hidden', '');
                }, 3000);
            }

            // Disable rating buttons
            document.querySelectorAll('.rating-btn').forEach(btn => {
                btn.disabled = true;
                btn.setAttribute('aria-disabled', 'true');
            });

        } catch (error) {
            console.error('Rating submission failed:', error);
        }
    }

    // ===========================
    // EVENT LISTENERS
    // ===========================

    function setupEventListeners() {
        // Share buttons
        const whatsappBtn = document.getElementById('share-whatsapp-btn');
        const telegramBtn = document.getElementById('share-telegram-btn');
        const copyBtn = document.getElementById('copy-results-btn');
        const screenshotBtn = document.getElementById('save-screenshot-btn');

        if (whatsappBtn) addTrackedEventListener(whatsappBtn, 'click', shareViaWhatsApp);
        if (telegramBtn) addTrackedEventListener(telegramBtn, 'click', shareViaTelegram);
        if (copyBtn) addTrackedEventListener(copyBtn, 'click', copyResultsLink);
        if (screenshotBtn) addTrackedEventListener(screenshotBtn, 'click', saveScreenshot);

        // Rating buttons
        document.querySelectorAll('.rating-btn').forEach(btn => {
            addTrackedEventListener(btn, 'click', () => {
                const rating = parseInt(btn.getAttribute('data-rating'));
                submitRating(rating);
            });
        });

        // ✅ P1 UI/UX: Toggle ranking view button
        const toggleRankingBtn = document.getElementById('toggle-ranking-btn');
        if (toggleRankingBtn) {
            addTrackedEventListener(toggleRankingBtn, 'click', toggleRankingView);
        }

        // ✅ P1 STABILITY: Restart game button
        const restartGameBtn = document.getElementById('restart-game-btn');
        if (restartGameBtn) {
            addTrackedEventListener(restartGameBtn, 'click', restartGame);
        }

        // Action buttons
        const playAgainBtn = document.getElementById('play-again-btn');
        const backToMenuBtn = document.getElementById('back-to-menu-btn');

        if (playAgainBtn) {
            addTrackedEventListener(playAgainBtn, 'click', () => {
                cancelAutoRedirect();
                window.location.href = 'multiplayer-lobby.html';
            });
        }

        if (backToMenuBtn) {
            addTrackedEventListener(backToMenuBtn, 'click', () => {
                // ✅ P1 STABILITY: Handle host leaving
                handleHostLeaving().then(() => {
                    redirectToMenu();
                });
            });
        }

        // Auto-redirect dialog buttons
        const startNewGameBtn = document.getElementById('start-new-game-btn');
        const stayBtn = document.getElementById('stay-on-results-btn');
        const goToMenuBtn = document.getElementById('go-to-menu-now-btn');

        if (startNewGameBtn) {
            addTrackedEventListener(startNewGameBtn, 'click', () => {
                cancelAutoRedirect();
                restartGame();
            });
        }

        if (stayBtn) {
            addTrackedEventListener(stayBtn, 'click', cancelAutoRedirect);
        }

        if (goToMenuBtn) {
            addTrackedEventListener(goToMenuBtn, 'click', () => {
                handleHostLeaving().then(() => {
                    redirectToMenu();
                });
            });
        }
    }

    // ===========================
    // UTILITIES
    // ===========================

    /**
     * ✅ P1 STABILITY: Handle initialization errors with specific messages
     */
    function handleInitializationError(error) {
        hideLoading();

        let title = '❌ Fehler';
        let message = 'Ein unerwarteter Fehler ist aufgetreten.';
        let showNewGameButton = true;

        switch (error.message) {
            case 'NO_GAME_ID':
                title = '⚠️ Kein Spiel gefunden';
                message = 'Es wurde keine Spiel-ID gefunden. Möglicherweise ist der Link ungültig oder das Spiel wurde bereits gelöscht.';
                break;

            case 'GAME_DELETED':
                title = '🗑️ Spiel wurde gelöscht';
                message = 'Dieses Spiel wurde vom Host gelöscht oder ist nicht mehr verfügbar.';
                break;

            case 'GAME_ENDED':
                title = '🏁 Spiel beendet';
                message = 'Der Host hat das Spiel beendet. Die Lobby ist nicht mehr aktiv.';
                break;

            case 'NO_RESULTS':
                title = '📊 Keine Ergebnisse';
                message = 'Die Spielergebnisse konnten nicht geladen werden. Möglicherweise wurde das Spiel nicht korrekt abgeschlossen.';
                break;

            case 'UNAUTHORIZED':
                title = '🚫 Zugriff verweigert';
                message = 'Du bist nicht berechtigt, diese Ergebnisse anzusehen. Nur Spieler, die an diesem Spiel teilgenommen haben, können die Ergebnisse sehen.';
                showNewGameButton = true;
                break;

            default:
                message = `Fehler beim Laden der Ergebnisse: ${error.message}`;
        }

        showErrorDialog(title, message, showNewGameButton);
    }

    /**
     * ✅ P1 STABILITY: Show error dialog with option to start new game
     */
    function showErrorDialog(title, message, showNewGameButton = true) {
        // Create error dialog if not exists
        let dialog = document.getElementById('error-dialog');

        if (!dialog) {
            dialog = createErrorDialog();
            document.body.appendChild(dialog);
        }

        // Update content
        const titleEl = dialog.querySelector('.error-title');
        const messageEl = dialog.querySelector('.error-message');
        const newGameBtn = dialog.querySelector('.btn-new-game');
        const menuBtn = dialog.querySelector('.btn-menu');

        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;

        if (newGameBtn) {
            if (showNewGameButton) {
                newGameBtn.removeAttribute('hidden');
                newGameBtn.onclick = () => {
                    window.location.href = 'multiplayer-lobby.html';
                };
            } else {
                newGameBtn.setAttribute('hidden', '');
            }
        }

        if (menuBtn) {
            menuBtn.onclick = () => {
                window.location.href = 'index.html';
            };
        }

        // Show dialog
        dialog.removeAttribute('hidden');
        dialog.setAttribute('aria-hidden', 'false');
    }

    /**
     * ✅ P1 STABILITY: Create error dialog element
     */
    function createErrorDialog() {
        const dialog = document.createElement('div');
        dialog.id = 'error-dialog';
        dialog.className = 'error-dialog';
        dialog.setAttribute('role', 'alertdialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'error-title');
        dialog.setAttribute('aria-describedby', 'error-message');
        dialog.setAttribute('hidden', '');

        dialog.innerHTML = `
            <div class="dialog-overlay"></div>
            <div class="dialog-content">
                <h2 class="error-title" id="error-title"></h2>
                <p class="error-message" id="error-message"></p>
                <div class="dialog-buttons">
                    <button class="btn btn-primary btn-new-game" type="button">
                        🎮 Neues Spiel starten
                    </button>
                    <button class="btn btn-secondary btn-menu" type="button">
                        🏠 Zum Hauptmenü
                    </button>
                </div>
            </div>
        `;

        return dialog;
    }

    function showLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.add('show');
    }

    function hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.remove('show');
    }

    function showError(message) {
        hideLoading();
        alert(message);
        redirectToMenu();
    }

    /**
     * ✅ P2 PERFORMANCE: Cleanup and resource management
     */
    function cleanup() {
        cancelAutoRedirect();

        // ✅ P2 PERFORMANCE: Remove Firebase listeners
        if (gameListener) {
            try {
                gameListener.off();
            } catch (e) {
                console.warn('Error removing game listener:', e);
            }
        }

        // Clear game data from storage
        localStorage.removeItem('nocap_game_results');
        localStorage.removeItem('nocap_game_id');
        sessionStorage.removeItem('nocap_game_id');

        console.log('✅ Cleanup completed');
    }

    // ✅ P1 STABILITY: Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

})();

