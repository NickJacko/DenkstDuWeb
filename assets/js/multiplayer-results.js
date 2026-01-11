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

    // ===========================
    // CONSTANTS
    // ===========================

    const AUTO_REDIRECT_DELAY = 60000; // 60 seconds
    const COUNTDOWN_INTERVAL = 1000; // 1 second

    // ===========================
    // STATE
    // ===========================

    let gameResults = null;
    let redirectTimer = null;
    let countdownInterval = null;
    let redirectTimeLeft = 60;

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

            // Load game results
            await loadGameResults();

            // Display results
            displayResults();

            // Setup event listeners
            setupEventListeners();

            // Start auto-redirect timer
            startAutoRedirectTimer();

            hideLoading();

        } catch (error) {
            console.error('❌ Initialization failed:', error);
            handleInitializationError(error);
        }
    });

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
                    return;
                }

                // ✅ P1 STABILITY: Calculate results if not yet available
                if (gameData.players) {
                    gameResults = calculateResultsFromGameData(gameData);
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
        const rankings = Object.values(players)
            .map(player => ({
                name: player.name || 'Unbekannt',
                totalScore: player.totalScore || 0,
                correctAnswers: player.correctAnswers || 0,
                avgTimePerQuestion: player.avgTimePerQuestion || 0
            }))
            .sort((a, b) => b.totalScore - a.totalScore);

        return {
            gameId: gameData.gameId,
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

        rankings.forEach((player, index) => {
            const li = document.createElement('li');
            li.className = 'player-list-item';
            li.setAttribute('role', 'listitem');

            // Rank
            const rankEl = document.createElement('span');
            rankEl.className = 'player-rank';
            rankEl.textContent = `${index + 1}.`;

            // Name (sanitized)
            const nameEl = document.createElement('span');
            nameEl.className = 'player-name';
            const sanitizedName = DOMPurify.sanitize(player.name, {
                ALLOWED_TAGS: [],
                KEEP_CONTENT: true
            });
            nameEl.textContent = sanitizedName;

            // Score
            const scoreEl = document.createElement('span');
            scoreEl.className = 'player-score';
            scoreEl.textContent = `${player.totalScore || 0} Punkte`;

            // Build item
            li.appendChild(rankEl);
            li.appendChild(nameEl);
            li.appendChild(scoreEl);

            playersList.appendChild(li);
        });
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
    // SHARE FUNCTIONALITY (P1 UI/UX)
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

        return `🎉 ${winnerName} hat No-Cap gewonnen mit ${score} Punkten! Spiele jetzt mit: ${origin}`;
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

        if (whatsappBtn) whatsappBtn.addEventListener('click', shareViaWhatsApp);
        if (telegramBtn) telegramBtn.addEventListener('click', shareViaTelegram);
        if (copyBtn) copyBtn.addEventListener('click', copyResultsLink);
        if (screenshotBtn) screenshotBtn.addEventListener('click', saveScreenshot);

        // Rating buttons
        document.querySelectorAll('.rating-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const rating = parseInt(btn.getAttribute('data-rating'));
                submitRating(rating);
            });
        });

        // Action buttons
        const playAgainBtn = document.getElementById('play-again-btn');
        const backToMenuBtn = document.getElementById('back-to-menu-btn');

        if (playAgainBtn) {
            playAgainBtn.addEventListener('click', () => {
                cancelAutoRedirect();
                window.location.href = 'multiplayer-lobby.html';
            });
        }

        if (backToMenuBtn) {
            backToMenuBtn.addEventListener('click', redirectToMenu);
        }

        // Auto-redirect dialog buttons
        const startNewGameBtn = document.getElementById('start-new-game-btn');
        const stayBtn = document.getElementById('stay-on-results-btn');
        const goToMenuBtn = document.getElementById('go-to-menu-now-btn');

        if (startNewGameBtn) {
            startNewGameBtn.addEventListener('click', () => {
                cancelAutoRedirect();
                window.location.href = 'multiplayer-lobby.html';
            });
        }

        if (stayBtn) {
            stayBtn.addEventListener('click', cancelAutoRedirect);
        }

        if (goToMenuBtn) {
            goToMenuBtn.addEventListener('click', redirectToMenu);
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

    function cleanup() {
        cancelAutoRedirect();

        // Clear game data from storage
        localStorage.removeItem('nocap_game_results');
        localStorage.removeItem('nocap_game_id');
        sessionStorage.removeItem('nocap_game_id');
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

})();

