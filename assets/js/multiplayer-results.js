/**
 * No-Cap Multiplayer Results
 * Displays final game results and statistics
 *
 * @version 8.1.0 - Security Hardened & Production Ready
 * @requires GameState.js
 */

'use strict';

// ===== GLOBAL VARIABLES =====
let gameState = null;
let finalResults = {};

// ===== P0 FIX: INPUT SANITIZATION =====

/**
 * Sanitize text with NocapUtils or fallback
 */
function sanitizeText(input) {
    if (!input) return '';

    if (typeof window.NocapUtils !== 'undefined' && window.NocapUtils.sanitizeInput) {
        return window.NocapUtils.sanitizeInput(String(input));
    }

    return String(input).replace(/<[^>]*>/g, '').substring(0, 500);
}

/**
 * Sanitize player name
 */
function sanitizePlayerName(name) {
    if (!name) return 'Spieler';

    if (typeof window.NocapUtils !== 'undefined' && window.NocapUtils.sanitizeInput) {
        return window.NocapUtils.sanitizeInput(String(name)).substring(0, 20);
    }

    return String(name).replace(/<[^>]*>/g, '').substring(0, 20);
}

// ===== GUARDS & VALIDATION =====

/**
 * P0 FIX: Validate game state with age expiration check
 */
function validateGameState() {
    console.log('🔍 Validating game state...');

    if (!gameState.deviceMode || gameState.deviceMode !== 'multi') {
        console.error('❌ Invalid device mode');
        showNotification('Kein Multiplayer-Spiel aktiv!', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }

    // P0 FIX: Check age verification with expiration
    const ageLevel = parseInt(localStorage.getItem('nocap_age_level')) || 0;
    const ageTimestamp = parseInt(localStorage.getItem('nocap_age_timestamp')) || 0;
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (now - ageTimestamp > maxAge) {
        console.error('❌ Age verification expired');
        showNotification('Altersverifizierung abgelaufen!', 'warning');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }

    console.log('✅ Game state valid');
    return true;
}

// ===== INITIALIZATION =====

function initialize() {
    console.log('🎮 Initializing multiplayer results...');
    showLoading('Ergebnisse werden geladen...');

    if (typeof GameState === 'undefined') {
        console.error('❌ GameState not loaded');
        showNotification('Fehler beim Laden', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
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
    console.log('✅ Results initialized');
}

// ===== EVENT LISTENERS =====

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

    window.addEventListener('popstate', function(event) {
        console.log('User tried to go back from results');
    });

    console.log('✅ Event listeners setup');
}

// ===== DATA LOADING =====

function loadFinalResults() {
    console.log('📊 Loading final results...');

    const savedResults = localStorage.getItem('nocap_final_results');

    if (savedResults) {
        try {
            finalResults = JSON.parse(savedResults);
            console.log('✅ Loaded results from storage');
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

    console.log('✅ Results loaded');
}

function generateDemoResults() {
    return {
        players: [
            {
                name: 'Anna',
                rank: 1,
                totalSips: 12,
                correctGuesses: 8,
                accuracy: 80,
                perfectGuesses: 3
            },
            {
                name: 'Max',
                rank: 2,
                totalSips: 18,
                correctGuesses: 6,
                accuracy: 60,
                perfectGuesses: 2
            },
            {
                name: 'Du',
                rank: 3,
                totalSips: 24,
                correctGuesses: 5,
                accuracy: 50,
                perfectGuesses: 1
            },
            {
                name: 'Lisa',
                rank: 4,
                totalSips: 31,
                correctGuesses: 4,
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

// ===== P0 FIX: UI UPDATES WITH TEXTCONTENT =====

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
        durationEl.textContent = stats.gameDuration;
    }

    const accuracyEl = document.getElementById('accuracy-stat');
    if (accuracyEl) {
        accuracyEl.textContent = `${stats.averageAccuracy}%`;
    }

    console.log('✅ Game stats updated');
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

    console.log('✅ Podium updated');
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

    console.log('✅ Players list updated');
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
    const bestPlayer = players.find(p => p.rank === 1);
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

        const factEmoji = document.createElement('div');
        factEmoji.className = 'fact-emoji';
        factEmoji.textContent = fact.emoji;

        const factText = document.createElement('div');
        factText.className = 'fact-text';

        const titleSpan = document.createElement('strong');
        titleSpan.textContent = fact.title;

        const textNode = document.createTextNode(' ' + fact.text);

        factText.appendChild(titleSpan);
        factText.appendChild(document.createElement('br'));
        factText.appendChild(textNode);

        factItem.appendChild(factEmoji);
        factItem.appendChild(factText);

        factsGridEl.appendChild(factItem);
    });

    console.log('✅ Fun facts generated');
}

// ===== SHARE FUNCTIONS =====

function shareToWhatsApp() {
    const text = generateShareText();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    showNotification('WhatsApp Link geöffnet', 'success');
    console.log('📤 Shared to WhatsApp');
}

function shareToTelegram() {
    const text = generateShareText();
    const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    showNotification('Telegram Link geöffnet', 'success');
    console.log('📤 Shared to Telegram');
}

function copyResults() {
    const text = generateShareText();

    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Ergebnis kopiert!', 'success');
            console.log('📋 Results copied');
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
        console.log('📋 Results copied (fallback)');
    } catch (err) {
        showNotification('Kopieren fehlgeschlagen', 'error');
        console.error('❌ Copy failed:', err);
    }

    document.body.removeChild(textArea);
}

function saveScreenshot() {
    showNotification('Screenshot-Feature kommt bald!', 'info');
    console.log('📸 Screenshot requested (not implemented)');
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

// ===== GAME ACTIONS =====

function playAgain() {
    showLoading('Neues Spiel wird vorbereitet...');
    console.log('🔄 Starting new game...');

    gameState.deviceMode = 'multi';
    gameState.gamePhase = 'setup';
    gameState.save();

    setTimeout(() => {
        window.location.href = 'multiplayer-lobby.html';
    }, 1500);
}

function backToMenu() {
    showLoading('Zurück zum Hauptmenü...');
    console.log('🏠 Returning to main menu...');

    localStorage.removeItem('nocap_game_state');
    localStorage.removeItem('nocap_final_results');

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// ===== HISTORY & STORAGE =====

function saveGameToHistory() {
    try {
        const gameHistory = JSON.parse(localStorage.getItem('nocap_game_history') || '[]');

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

        localStorage.setItem('nocap_game_history', JSON.stringify(gameRecord));
        console.log('💾 Game saved to history');
    } catch (error) {
        console.error('❌ Error saving to history:', error);
    }
}

// ===== CELEBRATION =====

function celebrateWinner() {
    const winner = finalResults.players[0];
    const currentPlayer = gameState.playerName;

    if (winner.name === currentPlayer || winner.name === 'Du') {
        showNotification('🎉 Glückwunsch! Du hast gewonnen! 🎉', 'success');
        console.log('🎊 Player won!');
    }
}

// ===== UTILITY FUNCTIONS =====

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
function showNotification(message, type = 'info') {
    if (typeof window.NocapUtils !== 'undefined' && window.NocapUtils.showNotification) {
        window.NocapUtils.showNotification(message, type);
        return;
    }

    // Fallback
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = sanitizeText(message);
        notification.className = `notification ${type} show`;

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// ===== INITIALIZATION =====

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

console.log('✅ No-Cap Multiplayer Results v8.1 - Production Ready!');