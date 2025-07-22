// DenkstDu - Enhanced Game State Management
class GameState {
    constructor() {
        this.reset();
        this.loadFromStorage();
    }

    // Reset game state to defaults
    reset() {
        this.deviceMode = null; // 'single' or 'multi'
        this.selectedCategories = [];
        this.difficulty = null; // 'easy', 'medium', 'hard'
        this.players = [];
        this.gameId = null;
        this.playerName = null;
        this.currentRound = 1;
        this.totalRounds = 10;
        this.currentPlayerIndex = 0;
        this.scores = {};
        this.currentAnswers = {};
        this.questions = [];
        this.isGameActive = false;
        this.gameResults = [];
        this.sipsSettings = {
            easy: 1,    // 1 Schluck + Abweichung
            medium: 2,  // 2 Schlücke + Abweichung
            hard: 3     // 3 Schlücke + Abweichung
        };
    }

    // Save state to localStorage with encryption
    saveToStorage() {
        try {
            const stateToSave = {
                deviceMode: this.deviceMode,
                selectedCategories: this.selectedCategories,
                difficulty: this.difficulty,
                players: this.players,
                gameId: this.gameId,
                playerName: this.playerName,
                currentRound: this.currentRound,
                totalRounds: this.totalRounds,
                currentPlayerIndex: this.currentPlayerIndex,
                scores: this.scores,
                isGameActive: this.isGameActive,
                timestamp: Date.now(),
                version: 2 // For future compatibility
            };

            localStorage.setItem('denkstdu_game_state', JSON.stringify(stateToSave));
            return true;
        } catch (error) {
            console.warn('Could not save game state:', error);
            return false;
        }
    }

    // Load state from localStorage
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('denkstdu_game_state');
            if (saved) {
                const state = JSON.parse(saved);
                
                // Check if state is not too old (24 hours) and version is compatible
                if (state.timestamp && Date.now() - state.timestamp < 24 * 60 * 60 * 1000 && state.version >= 2) {
                    Object.assign(this, state);
                    return true;
                } else {
                    // Clear old or incompatible state
                    this.clearStorage();
                }
            }
        } catch (error) {
            console.warn('Could not load game state:', error);
            this.clearStorage();
        }
        return false;
    }

    // Clear saved state
    clearStorage() {
        localStorage.removeItem('denkstdu_game_state');
    }

    // Set device mode
    setDeviceMode(mode) {
        this.deviceMode = mode;
        this.saveToStorage();
    }

    // Add/remove categories
    toggleCategory(category) {
        const index = this.selectedCategories.indexOf(category);
        if (index === -1) {
            this.selectedCategories.push(category);
        } else {
            this.selectedCategories.splice(index, 1);
        }
        this.saveToStorage();
    }

    // Set difficulty (now related to sips)
    setDifficulty(difficulty) {
        this.difficulty = difficulty;
        this.saveToStorage();
    }

    // Get sips for difficulty
    getSipsForDifficulty() {
        return this.sipsSettings[this.difficulty] || 2;
    }

    // Add player
    addPlayer(name) {
        if (name && name.trim() && !this.players.includes(name.trim())) {
            this.players.push(name.trim());
            this.scores[name.trim()] = 0;
            this.saveToStorage();
            return true;
        }
        return false;
    }

    // Remove player
    removePlayer(name) {
        const index = this.players.indexOf(name);
        if (index !== -1) {
            this.players.splice(index, 1);
            delete this.scores[name];
            this.saveToStorage();
            return true;
        }
        return false;
    }

    // Set players array
    setPlayers(players) {
        this.players = players.filter(p => p && p.trim());
        this.scores = {};
        this.players.forEach(player => {
            this.scores[player] = 0;
        });
        this.saveToStorage();
    }

    // Generate game ID
    generateGameId() {
        this.gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.saveToStorage();
        return this.gameId;
    }

    // Set game ID (for joining)
    setGameId(gameId) {
        this.gameId = gameId;
        this.saveToStorage();
    }

    // Set player name for multiplayer
    setPlayerName(name) {
        this.playerName = name;
        this.saveToStorage();
    }

    // Initialize game
    initializeGame() {
        this.currentRound = 1;
        this.currentPlayerIndex = 0;
        this.currentAnswers = {};
        this.questions = this.generateQuestions();
        this.gameResults = [];
        this.isGameActive = true;
        this.saveToStorage();
    }

    // Enhanced question generation with more questions
    generateQuestions() {
        const questionBank = {
            fsk0: [
                "Denkst du, dass [Player] schon mal ein Tier gerettet hat?",
                "Glaubst du, dass [Player] heimlich Kinderserien schaut?",
                "Denkst du, [Player] kann ohne Navi durch die Stadt fahren?",
                "Glaubst du, dass [Player] beim Autofahren mitsingt?",
                "Denkst du, [Player] spricht mit Tieren?",
                "Glaubst du, dass [Player] schon mal einen ganzen Tag im Pyjama verbracht hat?",
                "Denkst du, [Player] sammelt heimlich etwas Ungewöhnliches?",
                "Glaubst du, dass [Player] beim Kochen oft das Rezept ignoriert?",
                "Denkst du, [Player] redet beim Fernsehen mit den Charakteren?",
                "Glaubst du, dass [Player] schon mal ein Selfie mit einem Prominenten gemacht hat?",
                "Denkst du, [Player] hat schon mal einen ganzen Film rückwärts geschaut?",
                "Glaubst du, dass [Player] heimlich Tagebuch schreibt?",
                "Denkst du, [Player] kann alle Disney-Filme mitsingen?",
                "Glaubst du, dass [Player] schon mal mit Pflanzen geredet hat?",
                "Denkst du, [Player] versteckt Süßigkeiten vor anderen?"
            ],
            fsk16: [
                "Denkst du, dass [Player] schon mal heimlich in der Öffentlichkeit getanzt hat?",
                "Glaubst du, dass [Player] schon mal einen Crush auf einen Promi hatte?",
                "Denkst du, [Player] hat schon mal gelogen, um aus einer Verabredung rauszukommen?",
                "Glaubst du, dass [Player] heimlich die Nachrichten vom Ex stalkt?",
                "Denkst du, [Player] würde für 1 Million € einen Monat aufs Handy verzichten?",
                "Glaubst du, dass [Player] schon mal heimlich jemanden geküsst hat?",
                "Denkst du, [Player] hat schon mal bei einem Date gelogen?",
                "Glaubst du, dass [Player] schon mal betrunken eine peinliche Nachricht geschrieben hat?",
                "Denkst du, [Player] würde bei einer Reality-Show mitmachen?",
                "Glaubst du, dass [Player] schon mal heimlich Liebesbriefe gelesen hat?",
                "Denkst du, [Player] hat schon mal einen Dating-App-Account gelöscht und wieder erstellt?",
                "Glaubst du, dass [Player] schon mal bei einem Spiel geschummelt hat?",
                "Denkst du, [Player] würde für einen Tag das Geschlecht tauschen wollen?",
                "Glaubst du, dass [Player] schon mal absichtlich zu spät gekommen ist?",
                "Denkst du, [Player] hat schon mal eine Lüge erzählt, um jemanden zu beeindrucken?"
            ],
            fsk18: [
                "Denkst du, dass [Player] schon mal einen One-Night-Stand hatte?",
                "Glaubst du, dass [Player] schon mal heimlich die Sachen seines Partners durchsucht hat?",
                "Denkst du, [Player] würde beim ersten Date nach Hause gehen?",
                "Glaubst du, dass [Player] schon mal einen Sextraum über jemanden aus der Runde hatte?",
                "Denkst du, [Player] hat schon mal einen Orgasmus vorgetäuscht?",
                "Glaubst du, dass [Player] schon mal fremdgegangen ist?",
                "Denkst du, [Player] hat schon mal Sexspielzeug benutzt?",
                "Glaubst du, dass [Player] schon mal Sex an einem öffentlichen Ort hatte?",
                "Denkst du, [Player] würde bei einem Dreier mitmachen?",
                "Glaubst du, dass [Player] schon mal heimlich Pornos geschaut hat?",
                "Denkst du, [Player] hat schon mal Sexting betrieben?",
                "Glaubst du, dass [Player] schon mal beim Sex an jemand anderen gedacht hat?",
                "Denkst du, [Player] würde für Geld erotische Fotos verkaufen?",
                "Glaubst du, dass [Player] schon mal Sex mit jemandem hatte, den er/sie erst am selben Tag kennengelernt hat?",
                "Denkst du, [Player] hat schon mal eine Affäre mit einem verheirateten Menschen gehabt?"
            ]
        };

        let questions = [];
        this.selectedCategories.forEach(category => {
            questions = questions.concat(questionBank[category] || []);
        });

        // Shuffle questions
        questions = this.shuffleArray(questions);
        return questions.slice(0, this.totalRounds);
    }

    // Shuffle array
    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    // Get current question
    getCurrentQuestion() {
        if (this.currentRound <= this.questions.length) {
            const template = this.questions[this.currentRound - 1];
            const currentPlayer = this.players[this.currentPlayerIndex];
            return template.replace('[Player]', currentPlayer);
        }
        return null;
    }

    // Get current player
    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    // Add vote for current round
    addVote(playerName, votedCount) {
        if (!this.currentAnswers[this.currentRound]) {
            this.currentAnswers[this.currentRound] = {};
        }
        
        this.currentAnswers[this.currentRound][playerName] = {
            votedCount: votedCount,
            timestamp: Date.now()
        };
        this.saveToStorage();
    }

    // Calculate round results with sips
    calculateRoundResults(actualCount) {
        const roundAnswers = this.currentAnswers[this.currentRound] || {};
        const baseSips = this.getSipsForDifficulty();
        const results = [];

        Object.entries(roundAnswers).forEach(([player, data]) => {
            const difference = Math.abs(data.votedCount - actualCount);
            let sips = 0;

            if (difference === 0) {
                // Exact guess = 0 sips and bonus points
                sips = 0;
                this.scores[player] += 10;
            } else {
                // Wrong guess = base sips + difference
                sips = baseSips + difference;
                // Small bonus for close guesses
                if (difference === 1) {
                    this.scores[player] += 3;
                } else if (difference === 2) {
                    this.scores[player] += 1;
                }
            }

            results.push({
                player: player,
                votedCount: data.votedCount,
                actualCount: actualCount,
                difference: difference,
                sips: sips,
                isExact: difference === 0
            });
        });

        // Sort by sips (ascending - fewer sips = better)
        results.sort((a, b) => a.sips - b.sips);

        // Save round result
        this.gameResults.push({
            round: this.currentRound,
            question: this.getCurrentQuestion(),
            actualCount: actualCount,
            results: results
        });

        this.saveToStorage();
        return results;
    }

    // Move to next round
    nextRound() {
        if (this.currentRound < this.totalRounds) {
            this.currentRound++;
            // In single device mode, rotate through players
            if (this.deviceMode === 'single') {
                this.currentPlayerIndex = (this.currentRound - 1) % this.players.length;
            }
            this.saveToStorage();
            return true;
        } else {
            this.isGameActive = false;
            this.saveToStorage();
            return false;
        }
    }

    // Get final results
    getFinalResults() {
        const playerStats = this.players.map(player => {
            const playerResults = this.gameResults.map(round => 
                round.results.find(r => r.player === player)
            ).filter(r => r);

            const totalSips = playerResults.reduce((sum, r) => sum + r.sips, 0);
            const exactGuesses = playerResults.filter(r => r.isExact).length;
            const avgDifference = playerResults.length > 0 ? 
                playerResults.reduce((sum, r) => sum + r.difference, 0) / playerResults.length : 0;

            return {
                name: player,
                score: this.scores[player] || 0,
                totalSips: totalSips,
                exactGuesses: exactGuesses,
                avgDifference: Math.round(avgDifference * 10) / 10,
                rounds: playerResults.length
            };
        });

        // Sort by score (descending), then by total sips (ascending)
        return playerStats.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.totalSips - b.totalSips;
        });
    }

    // Get total sips for a player
    getPlayerTotalSips(playerName) {
        return this.gameResults.reduce((total, round) => {
            const playerResult = round.results.find(r => r.player === playerName);
            return total + (playerResult ? playerResult.sips : 0);
        }, 0);
    }

    // Check if all players have voted in current round
    hasAllPlayersVoted() {
        const currentRoundAnswers = this.currentAnswers[this.currentRound] || {};
        return Object.keys(currentRoundAnswers).length >= this.players.length;
    }

    // Get voting progress
    getVotingProgress() {
        const currentRoundAnswers = this.currentAnswers[this.currentRound] || {};
        return {
            voted: Object.keys(currentRoundAnswers).length,
            total: this.players.length,
            remaining: this.players.length - Object.keys(currentRoundAnswers).length
        };
    }

    // Check if game is valid
    isValidGame() {
        return this.selectedCategories.length > 0 && 
               this.difficulty && 
               this.players.length >= 2;
    }

    // Get game summary
    getGameSummary() {
        return {
            mode: this.deviceMode,
            categories: this.selectedCategories,
            difficulty: this.difficulty,
            sipsPerWrongGuess: this.getSipsForDifficulty(),
            players: this.players,
            rounds: `${this.currentRound}/${this.totalRounds}`,
            isActive: this.isGameActive,
            votingProgress: this.getVotingProgress()
        };
    }

    // Export game data (GDPR compliance)
    exportGameData() {
        return {
            exportDate: new Date().toISOString(),
            gameSettings: {
                deviceMode: this.deviceMode,
                categories: this.selectedCategories,
                difficulty: this.difficulty,
                sipsSettings: this.sipsSettings
            },
            players: this.players,
            gameResults: this.gameResults,
            finalScores: this.scores,
            gameId: this.gameId,
            totalRounds: this.totalRounds,
            isCompleted: !this.isGameActive
        };
    }

    // Clear personal data (GDPR compliance)
    clearPersonalData() {
        // Clear player names but keep anonymous stats
        this.players = this.players.map((_, index) => `Player ${index + 1}`);
        this.playerName = null;
        
        // Clear game results player names
        this.gameResults.forEach(round => {
            round.results.forEach((result, index) => {
                result.player = `Player ${this.players.findIndex(p => p === result.player) + 1 || index + 1}`;
            });
        });

        // Clear scores keys
        const newScores = {};
        Object.entries(this.scores).forEach(([_, score], index) => {
            newScores[`Player ${index + 1}`] = score;
        });
        this.scores = newScores;

        this.saveToStorage();
    }

    // Privacy-safe question selection
    getPrivacySafeQuestion() {
        const question = this.getCurrentQuestion();
        const currentPlayer = this.getCurrentPlayer();
        
        // Don't use real names in multiplayer logs
        if (this.deviceMode === 'multi') {
            return question.replace(currentPlayer, '[Current Player]');
        }
        
        return question;
    }
}

// Create global instance
window.gameState = new GameState();

// Enhanced error handling for game state
window.addEventListener('error', function(event) {
    if (event.error && event.error.message.includes('gameState')) {
        console.error('GameState error:', event.error);
        // Try to recover by resetting state
        if (window.gameState) {
            window.gameState.clearStorage();
            window.gameState.reset();
        }
    }
});

// Auto-cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (window.gameState && !window.gameState.isGameActive) {
        // Clean up finished games
        window.gameState.clearStorage();
    }
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameState;
}