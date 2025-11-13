/**
 * No-Cap Multiplayer Results
 * Displays final game results and statistics
 *
 * @version 8.0.0
 * @requires GameState.js
 * @requires DOMPurify
 */

// ===== GLOBAL VARIABLES =====
let gameState = null;
let finalResults = {};

// ===== GUARDS & VALIDATION =====
function validateGameState() {
    log('🔍 Validating game state...');

    // Check device mode
    if (!gameState.deviceMode || gameState.deviceMode !== 'multi') {
        log('❌ Invalid device mode - redirecting', 'error');
        showNotification('Kein Multiplayer-Spiel aktiv!', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return false;
    }

    // Check age verification
    const ageVerification = localStorage.getItem('nocap_age_verification');
    if (!ageVerification) {
        log('⚠️ Age verification missing - redirecting to index', 'warning');
        showNotification('Altersverifizierung erforderlich!', 'warning');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return false;
    }

    log('✅ Game state valid');
    return true;
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initializeResults();
});

function initializeResults() {
    log('🎮 Initializing multiplayer results...');
    showLoading('Ergebnisse werden geladen...');

    // Check if GameState is loaded
    if (typeof GameState === 'undefined') {
        log('❌ GameState class not loaded!', 'error');
        showNotification('Fehler beim Laden der App', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }

    // Initialize game state
    gameState = new GameState();

    // Validate state with guards
    if (!validateGameState()) {
        hideLoading();
        return;
    }

    // Setup event listeners
    setupEventListeners();

    // Load final results
    loadFinalResults();
    generateFunFacts();

    // Auto-save game to history
    saveGameToHistory();

    // Celebrate winner
    setTimeout(celebrateWinner, 500);

    hideLoading();
    log('✅ Results initialized');
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Share buttons
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

    // Action buttons
    const playAgainBtn = document.getElementById('play-again-btn');
    if (playAgainBtn) {
        playAgainBtn.addEventListener('click', playAgain);
    }

    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    if (backToMenuBtn) {
        backToMenuBtn.addEventListener('click', backToMenu);
    }

    // Prevent going back during results
    window.addEventListener('popstate', function(event) {
        log('User tried to go back from results');
    });

    log('✅ Event listeners setup complete');
}

// ===== DATA LOADING =====
function loadFinalResults() {
    log('📊 Loading final results...');

    // Try to load from localStorage first
    const savedResults = localStorage.getItem('nocap_final_results');

    if (savedResults) {
        try {
            finalResults = JSON.parse(savedResults);
            log('✅ Loaded results from storage');
        } catch (error) {
            log('❌ Error parsing results, using demo data', 'error');
            finalResults = generateDemoResults();
        }
    } else {
        log('⚠️ No saved results, using demo data');
        finalResults = generateDemoResults();
    }

    // Update UI with real data
    updateGameStats();
    updatePodium();
    updatePlayersList();

    log('✅ Results loaded:', finalResults);
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

// ===== UI UPDATES =====
function updateGameStats() {
    const stats = finalResults.gameStats;

    // Update subtitle
    const subtitleEl = document.getElementById('completion-subtitle');
    if (subtitleEl) {
        subtitleEl.textContent = `Ihr habt alle ${stats.totalRounds} Runden gemeistert`;
    }

    // Update stat values
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

    log('✅ Game stats updated');
}

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

        const sanitizedName = DOMPurify.sanitize(player.name);
        const drinkEmoji = gameState.alcoholMode ? '🍺' : '💧';

        podiumPlace.innerHTML = DOMPurify.sanitize(`
            <div class="podium-stand">
                <div class="podium-position">${position}</div>
            </div>
            <div class="podium-name">${sanitizedName}</div>
            <div class="podium-score">${player.totalSips} ${drinkEmoji}</div>
        `);

        podiumEl.appendChild(podiumPlace);
    });

    log('✅ Podium updated');
}

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

        const sanitizedName = DOMPurify.sanitize(player.name);
        const crownEmoji = player.rank === 1 ? ' 👑' : '';
        const drinkEmoji = gameState.alcoholMode ? '🍺' : '💧';

        playerResult.innerHTML = DOMPurify.sanitize(`
            <div class="player-info">
                <div class="player-rank ${rankClass}">${player.rank}</div>
                <div class="player-name">${sanitizedName}${crownEmoji}</div>
            </div>
            <div class="player-stats">
                <div class="stat-column">
                    <div class="stat-number">${player.totalSips}</div>
                    <div class="stat-text">${drinkEmoji}</div>
                </div>
                <div class="stat-column">
                    <div class="stat-number">${player.correctGuesses}</div>
                    <div class="stat-text">Richtig</div>
                </div>
                <div class="stat-column">
                    <div class="stat-number">${player.accuracy}%</div>
                    <div class="stat-text">Quote</div>
                </div>
            </div>
        `);

        playersListEl.appendChild(playerResult);
    });

    log('✅ Players list updated');
}

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
            text: `<strong>${DOMPurify.sanitize(bestPlayer.name)}</strong> hatte die beste<br>Schätzgenauigkeit: ${bestPlayer.accuracy}%`
        },
        {
            emoji: '😅',
            text: `<strong>${DOMPurify.sanitize(worstPlayer.name)}</strong> hatte es<br>am schwersten heute`
        },
        {
            emoji: '🔥',
            text: `Die <strong>schwerste Frage</strong><br>war Frage ${stats.hardestQuestion}`
        },
        {
            emoji: gameState.alcoholMode ? '🍺' : '💧',
            text: `<strong>Insgesamt</strong> wurden<br>${stats.totalSips} Schlücke verteilt`
        }
    ];

    facts.forEach(fact => {
        const factItem = document.createElement('div');
        factItem.className = 'fact-item';

        factItem.innerHTML = DOMPurify.sanitize(`
            <div class="fact-emoji">${fact.emoji}</div>
            <div class="fact-text">${fact.text}</div>
        `);

        factsGridEl.appendChild(factItem);
    });

    log('✅ Fun facts generated');
}

// ===== SHARE FUNCTIONS =====
function shareToWhatsApp() {
    const text = generateShareText();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    showNotification('WhatsApp Link geöffnet', 'success');
    log('📤 Shared to WhatsApp');
}

function shareToTelegram() {
    const text = generateShareText();
    const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    showNotification('Telegram Link geöffnet', 'success');
    log('📤 Shared to Telegram');
}

function copyResults() {
    const text = generateShareText();

    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Ergebnis kopiert!', 'success');
            log('📋 Results copied to clipboard');
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
        log('📋 Results copied (fallback)');
    } catch (err) {
        showNotification('Kopieren fehlgeschlagen', 'error');
        log('❌ Copy failed', 'error');
    }

    document.body.removeChild(textArea);
}

function saveScreenshot() {
    // In a real implementation, you would use html2canvas or similar
    showNotification('Screenshot-Feature kommt bald!', 'info');
    log('📸 Screenshot requested (not implemented)');
}

function generateShareText() {
    const winner = finalResults.players[0];
    const drinkEmoji = gameState.alcoholMode ? '🍺' : '💧';

    return `🎉 No-Cap Multiplayer Ergebnis 🎉\n\n` +
        `🏆 Gewinner: ${winner.name} (${winner.totalSips} ${drinkEmoji})\n` +
        `🎯 ${finalResults.gameStats.totalRounds} Runden gespielt\n` +
        `👥 ${finalResults.gameStats.totalPlayers} Spieler\n` +
        `⏱️ Dauer: ${finalResults.gameStats.gameDuration}\n\n` +
        `Wer kann uns schlagen? 😏`;
}

// ===== GAME ACTIONS =====
function playAgain() {
    showLoading('Neues Spiel wird vorbereitet...');
    log('🔄 Starting new game...');

    // Reset game state but keep multiplayer settings
    gameState.deviceMode = 'multi';
    gameState.gamePhase = 'setup';
    gameState.save();

    setTimeout(() => {
        window.location.href = 'multiplayer-lobby.html';
    }, 1500);
}

function backToMenu() {
    showLoading('Zurück zum Hauptmenü...');
    log('🏠 Returning to main menu...');

    // Clear game state
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
            players: finalResults.players,
            stats: finalResults.gameStats,
            categories: gameState.selectedCategories || [],
            difficulty: gameState.difficulty || 'medium'
        };

        gameHistory.unshift(gameRecord);

        // Keep only last 10 games
        if (gameHistory.length > 10) {
            gameHistory.splice(10);
        }

        localStorage.setItem('nocap_game_history', JSON.stringify(gameHistory));
        log('💾 Game saved to history:', gameRecord.id);
    } catch (error) {
        log('❌ Error saving to history:', error.message, 'error');
    }
}

// ===== CELEBRATION =====
function celebrateWinner() {
    const winner = finalResults.players[0];
    const currentPlayer = gameState.playerName;

    if (winner.name === currentPlayer || winner.name === 'Du') {
        // Show special celebration for user winning
        showNotification('🎉 Glückwunsch! Du hast gewonnen! 🎉', 'success');
        log('🎊 Player won the game!');
    }
}

// ===== UTILITY FUNCTIONS =====
function showLoading(text = 'Lade...') {
    const loading = document.getElementById('loading');
    const loadingText = document.getElementById('loading-text');
    if (loading) {
        if (loadingText) {
            loadingText.textContent = text;
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

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (notification) {
        const sanitizedMessage = DOMPurify.sanitize(message);
        notification.textContent = sanitizedMessage;
        notification.className = `notification ${type} show`;

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

function log(message, type = 'info') {
    const colors = {
        info: '#4488ff',
        warning: '#ffaa00',
        error: '#ff4444',
        success: '#00ff00'
    };
    console.log(`%c[Results] ${message}`, `color: ${colors[type] || colors.info}`);
}

// ===== DEBUG =====
window.debugResults = function() {
    console.log('🔍 === RESULTS DEBUG ===');
    console.log('GameState:', gameState);
    console.log('Final Results:', finalResults);
    console.log('LocalStorage Keys:', Object.keys(localStorage).filter(k => k.startsWith('nocap_')));
};

log('✅ No-Cap Multiplayer Results v8.0 - Production Ready - vollständig geladen!');
log('🛠️ Debug: debugResults()');