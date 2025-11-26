/**
 * No-Cap Multiplayer Results
 * Version 3.0 - Audit-Fixed & Production Ready
 *
 * Displays final game results and statistics
 */

(function(window) {
    'use strict';

    // ===========================
    // GLOBAL STATE
    // ===========================
    let gameState = null;
    let finalResults = {};

    const isDevelopment = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('192.168.');

    // ===========================
    // P0 FIX: INPUT SANITIZATION
    // ===========================

    function sanitizeText(input) {
        if (!input) return '';

        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            return window.NocapUtils.sanitizeInput(String(input));
        }

        return String(input).replace(/<[^>]*>/g, '').substring(0, 500);
    }

    function sanitizePlayerName(name) {
        if (!name) return 'Spieler';

        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            return window.NocapUtils.sanitizeInput(String(name)).substring(0, 20);
        }

        return String(name).replace(/<[^>]*>/g, '').substring(0, 20);
    }

    // ===========================
    // INITIALIZATION
    // ===========================

    async function initialize() {
        if (isDevelopment) {
            console.log('🎮 Initializing multiplayer results...');
        }

        showLoading('Ergebnisse werden geladen...');

        // P0 FIX: Check DOMPurify
        if (typeof DOMPurify === 'undefined') {
            console.error('❌ CRITICAL: DOMPurify not loaded!');
            alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
            return;
        }

        // Check dependencies
        if (typeof GameState === 'undefined') {
            console.error('❌ GameState not loaded');
            showNotification('Fehler beim Laden', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }

        // P1 FIX: Wait for dependencies
        if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
            await window.NocapUtils.waitForDependencies(['GameState']);
        }

        gameState = new GameState();

        if (!validateGameState()) {
            hideLoading();
            return;
        }

        setupEventListeners();
        loadFinalResults();
        generateFunFacts();
        saveGameToHistory();

        setTimeout(celebrateWinner, 500);

        hideLoading();
        if (isDevelopment) {
            console.log('✅ Results initialized');
        }
    }

    // ===========================
    // VALIDATION
    // ===========================

    function validateGameState() {
        if (isDevelopment) {
            console.log('🔍 Validating game state...');
        }

        if (!gameState || gameState.deviceMode !== 'multi') {
            console.error('❌ Invalid device mode:', gameState?.deviceMode);
            showNotification('Kein Multiplayer-Spiel aktiv!', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        // P0 FIX: Validate age verification with expiration
        let ageLevel = 0;
        let ageTimestamp = 0;

        if (window.NocapUtils && window.NocapUtils.getLocalStorage) {
            ageLevel = parseInt(window.NocapUtils.getLocalStorage('nocap_age_level')) || 0;
            ageTimestamp = parseInt(window.NocapUtils.getLocalStorage('nocap_age_timestamp')) || 0;
        }

        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (now - ageTimestamp > maxAge) {
            console.error('❌ Age verification expired');
            showNotification('Altersverifizierung abgelaufen!', 'warning');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (isDevelopment) {
            console.log('✅ Game state valid');
        }
        return true;
    }

    // ===========================
    // EVENT LISTENERS
    // ===========================

    function setupEventListeners() {
        const shareWhatsAppBtn = document.getElementById('share-whatsapp-btn');
        if (shareWhatsAppBtn) {
            shareWhatsAppBtn.addEventListener('click', shareToWhatsApp);
        }

        const shareTelegramBtn = document.getElementById('share-telegram-btn');
        if (shareTelegramBtn) {
            shareTelegramBtn.addEventListener('click', shareToTelegram);
        }

        const copyResultsBtn = document.getElementById('copy-results-btn');
        if (copyResultsBtn) {
            copyResultsBtn.addEventListener('click', copyResults);
        }

        const saveScreenshotBtn = document.getElementById('save-screenshot-btn');
        if (saveScreenshotBtn) {
            saveScreenshotBtn.addEventListener('click', saveScreenshot);
        }

        const playAgainBtn = document.getElementById('play-again-btn');
        if (playAgainBtn) {
            playAgainBtn.addEventListener('click', playAgain);
        }

        const backToMenuBtn = document.getElementById('back-to-menu-btn');
        if (backToMenuBtn) {
            backToMenuBtn.addEventListener('click', backToMenu);
        }

        if (isDevelopment) {
            console.log('✅ Event listeners setup');
        }
    }

    // ===========================
    // DATA LOADING
    // ===========================

    function loadFinalResults() {
        if (isDevelopment) {
            console.log('📊 Loading final results...');
        }

        let savedResults = null;

        if (window.NocapUtils && window.NocapUtils.getLocalStorage) {
            savedResults = window.NocapUtils.getLocalStorage('final_results');
        }

        if (savedResults) {
            try {
                finalResults = JSON.parse(savedResults);
                if (isDevelopment) {
                    console.log('✅ Loaded results from storage');
                }
            } catch (error) {
                console.error('❌ Error parsing results:', error);
                finalResults = generateDemoResults();
            }
        } else {
            console.warn('⚠️ No saved results, using demo');
            finalResults = generateDemoResults();
        }

        updateGameStats();
        updatePodium();
        updatePlayersList();

        if (isDevelopment) {
            console.log('✅ Results loaded');
        }
    }

    function generateDemoResults() {
        return {
            players: [
                {
                    name: 'Anna',
                    rank: 1,
                    totalSips: 12,
                    correctGuesses: 8,
                    totalGuesses: 10,
                    accuracy: 80,
                    perfectGuesses: 3
                },
                {
                    name: 'Max',
                    rank: 2,
                    totalSips: 18,
                    correctGuesses: 6,
                    totalGuesses: 10,
                    accuracy: 60,
                    perfectGuesses: 2
                },
                {
                    name: 'Du',
                    rank: 3,
                    totalSips: 24,
                    correctGuesses: 5,
                    totalGuesses: 10,
                    accuracy: 50,
                    perfectGuesses: 1
                },
                {
                    name: 'Lisa',
                    rank: 4,
                    totalSips: 31,
                    correctGuesses: 4,
                    totalGuesses: 10,
                    accuracy: 40,
                    perfectGuesses: 0
                }
            ],
            gameStats: {
                totalRounds: 10,
                totalPlayers: 4,
                gameDuration: '15 Min',
                averageAccuracy: 67,
                totalSips: 85,
                hardestQuestion: 7,
                easiestQuestion: 3
            }
        };
    }

    // ===========================
    // P0 FIX: UI UPDATES WITH TEXTCONTENT
    // ===========================

    function updateGameStats() {
        const stats = finalResults.gameStats;

        const subtitleEl = document.getElementById('completion-subtitle');
        if (subtitleEl) {
            subtitleEl.textContent = `Ihr habt alle ${stats.totalRounds} Runden gemeistert`;
        }

        const totalRoundsEl = document.getElementById('total-rounds-stat');
        if (totalRoundsEl) {
            totalRoundsEl.textContent = stats.totalRounds;
        }

        const totalPlayersEl = document.getElementById('total-players-stat');
        if (totalPlayersEl) {
            totalPlayersEl.textContent = stats.totalPlayers;
        }

        const durationEl = document.getElementById('game-duration-stat');
        if (durationEl) {
            durationEl.textContent = sanitizeText(stats.gameDuration);
        }

        const accuracyEl = document.getElementById('accuracy-stat');
        if (accuracyEl) {
            accuracyEl.textContent = `${stats.averageAccuracy}%`;
        }

        if (isDevelopment) {
            console.log('✅ Game stats updated');
        }
    }

    /**
     * P0 FIX: Build podium with textContent
     */
    function updatePodium() {
        const podiumEl = document.getElementById('podium');
        if (!podiumEl) return;

        podiumEl.innerHTML = '';

        const topThree = finalResults.players.slice(0, 3);

        topThree.forEach((player, index) => {
            const position = index + 1;
            const positionClass = position === 1 ? 'first' : position === 2 ? 'second' : 'third';

            const podiumPlace = document.createElement('div');
            podiumPlace.className = `podium-place ${positionClass}`;
            podiumPlace.setAttribute('role', 'listitem');

            const podiumStand = document.createElement('div');
            podiumStand.className = 'podium-stand';

            const podiumPosition = document.createElement('div');
            podiumPosition.className = 'podium-position';
            podiumPosition.textContent = position;

            podiumStand.appendChild(podiumPosition);

            const podiumName = document.createElement('div');
            podiumName.className = 'podium-name';
            podiumName.textContent = sanitizePlayerName(player.name);

            const drinkEmoji = gameState.alcoholMode ? '🍺' : '💧';
            const podiumScore = document.createElement('div');
            podiumScore.className = 'podium-score';
            podiumScore.textContent = `${player.totalSips} ${drinkEmoji}`;

            podiumPlace.appendChild(podiumStand);
            podiumPlace.appendChild(podiumName);
            podiumPlace.appendChild(podiumScore);

            podiumEl.appendChild(podiumPlace);
        });

        if (isDevelopment) {
            console.log('✅ Podium updated');
        }
    }

    /**
     * P0 FIX: Build players list with textContent
     */
    function updatePlayersList() {
        const playersListEl = document.getElementById('players-list');
        if (!playersListEl) return;

        playersListEl.innerHTML = '';

        finalResults.players.forEach((player) => {
            const playerResult = document.createElement('div');
            playerResult.className = 'player-result';
            playerResult.setAttribute('role', 'listitem');

            const rankClass = player.rank === 1 ? 'first' :
                player.rank === 2 ? 'second' :
                    player.rank === 3 ? 'third' : '';

            // Player info section
            const playerInfo = document.createElement('div');
            playerInfo.className = 'player-info';

            const playerRank = document.createElement('div');
            playerRank.className = `player-rank ${rankClass}`;
            playerRank.textContent = player.rank;

            const playerName = document.createElement('div');
            playerName.className = 'player-name';
            const crownEmoji = player.rank === 1 ? ' 👑' : '';
            playerName.textContent = sanitizePlayerName(player.name) + crownEmoji;

            playerInfo.appendChild(playerRank);
            playerInfo.appendChild(playerName);

            // Player stats section
            const playerStats = document.createElement('div');
            playerStats.className = 'player-stats';

            const drinkEmoji = gameState.alcoholMode ? '🍺' : '💧';

            // Stat column 1: Total sips
            const statCol1 = document.createElement('div');
            statCol1.className = 'stat-column';

            const statNum1 = document.createElement('div');
            statNum1.className = 'stat-number';
            statNum1.textContent = player.totalSips;

            const statText1 = document.createElement('div');
            statText1.className = 'stat-text';
            statText1.textContent = drinkEmoji;

            statCol1.appendChild(statNum1);
            statCol1.appendChild(statText1);

            // Stat column 2: Correct guesses
            const statCol2 = document.createElement('div');
            statCol2.className = 'stat-column';

            const statNum2 = document.createElement('div');
            statNum2.className = 'stat-number';
            statNum2.textContent = player.correctGuesses;

            const statText2 = document.createElement('div');
            statText2.className = 'stat-text';
            statText2.textContent = 'Richtig';

            statCol2.appendChild(statNum2);
            statCol2.appendChild(statText2);

            // Stat column 3: Accuracy
            const statCol3 = document.createElement('div');
            statCol3.className = 'stat-column';

            const statNum3 = document.createElement('div');
            statNum3.className = 'stat-number';
            statNum3.textContent = `${player.accuracy}%`;

            const statText3 = document.createElement('div');
            statText3.className = 'stat-text';
            statText3.textContent = 'Quote';

            statCol3.appendChild(statNum3);
            statCol3.appendChild(statText3);

            playerStats.appendChild(statCol1);
            playerStats.appendChild(statCol2);
            playerStats.appendChild(statCol3);

            playerResult.appendChild(playerInfo);
            playerResult.appendChild(playerStats);

            playersListEl.appendChild(playerResult);
        });

        if (isDevelopment) {
            console.log('✅ Players list updated');
        }
    }

    /**
     * P0 FIX: Build fun facts with textContent
     */
    function generateFunFacts() {
        const factsGridEl = document.getElementById('facts-grid');
        if (!factsGridEl) return;

        factsGridEl.innerHTML = '';

        const players = finalResults.players;
        const stats = finalResults.gameStats;
        const bestPlayer = players.find(p => p.rank === 1) || players[0];
        const worstPlayer = players[players.length - 1];

        const facts = [
            {
                emoji: '🎯',
                title: sanitizePlayerName(bestPlayer.name),
                text: `hatte die beste Schätzgenauigkeit: ${bestPlayer.accuracy}%`
            },
            {
                emoji: '😅',
                title: sanitizePlayerName(worstPlayer.name),
                text: 'hatte es am schwersten heute'
            },
            {
                emoji: '🔥',
                title: 'Schwerste Frage',
                text: `war Frage ${stats.hardestQuestion}`
            },
            {
                emoji: gameState.alcoholMode ? '🍺' : '💧',
                title: 'Insgesamt',
                text: `wurden ${stats.totalSips} Schlücke verteilt`
            }
        ];

        facts.forEach(fact => {
            const factItem = document.createElement('div');
            factItem.className = 'fact-item';
            factItem.setAttribute('role', 'listitem');

            const factEmoji = document.createElement('div');
            factEmoji.className = 'fact-emoji';
            factEmoji.textContent = fact.emoji;
            factEmoji.setAttribute('aria-hidden', 'true');

            const factText = document.createElement('div');
            factText.className = 'fact-text';

            const titleStrong = document.createElement('strong');
            titleStrong.textContent = fact.title;

            const br = document.createElement('br');
            const textNode = document.createTextNode(fact.text);

            factText.appendChild(titleStrong);
            factText.appendChild(br);
            factText.appendChild(textNode);

            factItem.appendChild(factEmoji);
            factItem.appendChild(factText);

            factsGridEl.appendChild(factItem);
        });

        if (isDevelopment) {
            console.log('✅ Fun facts generated');
        }
    }

    // ===========================
    // SHARE FUNCTIONS
    // ===========================

    function shareToWhatsApp() {
        const text = generateShareText();
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        showNotification('WhatsApp Link geöffnet', 'success');
        if (isDevelopment) {
            console.log('📤 Shared to WhatsApp');
        }
    }

    function shareToTelegram() {
        const text = generateShareText();
        const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        showNotification('Telegram Link geöffnet', 'success');
        if (isDevelopment) {
            console.log('📤 Shared to Telegram');
        }
    }

    function copyResults() {
        const text = generateShareText();

        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                showNotification('Ergebnis kopiert!', 'success');
                if (isDevelopment) {
                    console.log('📋 Results copied');
                }
            }).catch(() => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();

        try {
            document.execCommand('copy');
            showNotification('Ergebnis kopiert!', 'success');
            if (isDevelopment) {
                console.log('📋 Results copied (fallback)');
            }
        } catch (err) {
            showNotification('Kopieren fehlgeschlagen', 'error');
            console.error('❌ Copy failed:', err);
        }

        document.body.removeChild(textArea);
    }

    function saveScreenshot() {
        showNotification('Screenshot-Feature kommt bald!', 'info');
        if (isDevelopment) {
            console.log('📸 Screenshot requested (not implemented)');
        }
    }

    function generateShareText() {
        const winner = finalResults.players[0];
        const drinkEmoji = gameState.alcoholMode ? '🍺' : '💧';

        return `🎉 No-Cap Multiplayer Ergebnis 🎉\n\n` +
            `🏆 Gewinner: ${sanitizePlayerName(winner.name)} (${winner.totalSips} ${drinkEmoji})\n` +
            `🎯 ${finalResults.gameStats.totalRounds} Runden gespielt\n` +
            `👥 ${finalResults.gameStats.totalPlayers} Spieler\n` +
            `⏱️ Dauer: ${finalResults.gameStats.gameDuration}\n\n` +
            `Wer kann uns schlagen? 😏`;
    }

    // ===========================
    // GAME ACTIONS
    // ===========================

    function playAgain() {
        showLoading('Neues Spiel wird vorbereitet...');
        if (isDevelopment) {
            console.log('🔄 Starting new game...');
        }

        gameState.deviceMode = 'multi';
        gameState.gamePhase = 'setup';
        gameState.save();

        setTimeout(() => {
            window.location.href = 'multiplayer-lobby.html';
        }, 1500);
    }

    function backToMenu() {
        showLoading('Zurück zum Hauptmenü...');
        if (isDevelopment) {
            console.log('🏠 Returning to main menu...');
        }

        if (window.NocapUtils && window.NocapUtils.removeLocalStorage) {
            window.NocapUtils.removeLocalStorage('game_state');
            window.NocapUtils.removeLocalStorage('final_results');
        }

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    }

    // ===========================
    // HISTORY & STORAGE
    // ===========================

    function saveGameToHistory() {
        try {
            let gameHistory = [];

            if (window.NocapUtils && window.NocapUtils.getLocalStorage) {
                const historyStr = window.NocapUtils.getLocalStorage('game_history');
                if (historyStr) {
                    gameHistory = JSON.parse(historyStr);
                }
            }

            const gameRecord = {
                id: Date.now(),
                date: new Date().toISOString(),
                mode: 'multiplayer',
                players: finalResults.players.map(p => ({
                    ...p,
                    name: sanitizePlayerName(p.name)
                })),
                stats: finalResults.gameStats,
                categories: gameState.selectedCategories || [],
                difficulty: gameState.difficulty || 'medium'
            };

            gameHistory.unshift(gameRecord);

            // Keep only last 10 games
            if (gameHistory.length > 10) {
                gameHistory.splice(10);
            }

            if (window.NocapUtils && window.NocapUtils.setLocalStorage) {
                window.NocapUtils.setLocalStorage('game_history', JSON.stringify(gameHistory));
            }

            if (isDevelopment) {
                console.log('💾 Game saved to history');
            }
        } catch (error) {
            console.error('❌ Error saving to history:', error);
        }
    }

    // ===========================
    // CELEBRATION
    // ===========================

    function celebrateWinner() {
        const winner = finalResults.players[0];
        const currentPlayer = gameState.playerName;

        if (winner.name === currentPlayer || winner.name === 'Du') {
            showNotification('🎉 Glückwunsch! Du hast gewonnen! 🎉', 'success');
            if (isDevelopment) {
                console.log('🎊 Player won!');
            }
        }
    }

    // ===========================
    // UTILITIES
    // ===========================

    function showLoading(text = 'Lade...') {
        const loading = document.getElementById('loading');
        const loadingText = document.getElementById('loading-text');
        if (loading) {
            if (loadingText) {
                loadingText.textContent = sanitizeText(text);
            }
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
     * P0 FIX: Safe notification using NocapUtils
     */
    function showNotification(message, type = 'info', duration = 3000) {
        if (window.NocapUtils && window.NocapUtils.showNotification) {
            window.NocapUtils.showNotification(message, type, duration);
            return;
        }

        // Fallback: Toast notification implementation
        const existingToasts = document.querySelectorAll('.toast-notification');
        existingToasts.forEach(toast => toast.remove());

        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 10px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            transform: translateX(400px);
            transition: transform 0.3s ease;
        `;

        const bgColors = {
            success: '#4CAF50',
            error: '#F44336',
            warning: '#FF9800',
            info: '#2196F3'
        };

        toast.style.background = bgColors[type] || bgColors.info;
        toast.textContent = sanitizeText(message);
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);

        setTimeout(() => {
            toast.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    // ===========================
    // CLEANUP
    // ===========================

    function cleanup() {
        if (window.NocapUtils && window.NocapUtils.cleanupEventListeners) {
            window.NocapUtils.cleanupEventListeners();
        }

        if (isDevelopment) {
            console.log('✅ Multiplayer results cleanup completed');
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
