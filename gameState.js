// DenkstDu - Enhanced Game State Management für Schätzspiel
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
        this.currentQuestionIndex = 0;
        this.questions = [];
        this.isGameActive = false;
        
        // Schätzspiel-spezifische Daten
        this.currentVotes = {}; // {playerName: 'yes'/'no'}
        this.currentEstimations = {}; // {playerName: number}
        this.roundResults = []; // Historie aller Runden
        this.playerStats = {}; // Gesamtstatistiken pro Spieler
        
        this.sipsSettings = {
            easy: 1,    // 1 Basis-Schluck + Abweichung
            medium: 2,  // 2 Basis-Schlücke + Abweichung
            hard: 3     // 3 Basis-Schlücke + Abweichung
        };
    }

    // Save state to localStorage
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
                currentQuestionIndex: this.currentQuestionIndex,
                questions: this.questions,
                isGameActive: this.isGameActive,
                currentVotes: this.currentVotes,
                currentEstimations: this.currentEstimations,
                roundResults: this.roundResults,
                playerStats: this.playerStats,
                timestamp: Date.now(),
                version: 3 // Updated version for estimation game
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
                if (state.timestamp && Date.now() - state.timestamp < 24 * 60 * 60 * 1000 && state.version >= 3) {
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

    // Set difficulty (affects base sips)
    setDifficulty(difficulty) {
        this.difficulty = difficulty;
        this.saveToStorage();
    }

    // Get base sips for difficulty
    getBaseSips() {
        return this.sipsSettings[this.difficulty] || 2;
    }

    // Add player
    addPlayer(name) {
        if (name && name.trim() && !this.players.includes(name.trim())) {
            const playerName = name.trim();
            this.players.push(playerName);
            this.initializePlayerStats(playerName);
            this.saveToStorage();
            return true;
        }
        return false;
    }

    // Initialize player statistics
    initializePlayerStats(playerName) {
        this.playerStats[playerName] = {
            totalSips: 0,
            exactGuesses: 0,
            totalGuesses: 0,
            averageDeviation: 0,
            bestRound: null,
            worstRound: null
        };
    }

    // Remove player
    removePlayer(name) {
        const index = this.players.indexOf(name);
        if (index !== -1) {
            this.players.splice(index, 1);
            delete this.playerStats[name];
            this.saveToStorage();
            return true;
        }
        return false;
    }

    // Set players array
    setPlayers(players) {
        this.players = players.filter(p => p && p.trim());
        this.playerStats = {};
        this.players.forEach(player => {
            this.initializePlayerStats(player);
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
        this.currentQuestionIndex = 0;
        this.questions = this.generateQuestions();
        this.roundResults = [];
        this.currentVotes = {};
        this.currentEstimations = {};
        this.isGameActive = true;
        
        // Initialize all player stats
        this.players.forEach(player => {
            this.initializePlayerStats(player);
        });
        
        this.saveToStorage();
    }

    // Enhanced question generation
    generateQuestions() {
        const questionBank = {
            fsk0: [
                "Hast du schon mal ein Tier gerettet?",
                "Schaust du heimlich Kinderserien?",
                "Kannst du ohne Navi durch die Stadt fahren?",
                "Singst du beim Autofahren mit?",
                "Sprichst du mit Tieren?",
                "Hast du schon mal einen ganzen Tag im Pyjama verbracht?",
                "Sammelst du heimlich etwas Ungewöhnliches?",
                "Ignorierst du beim Kochen oft das Rezept?",
                "Redest du beim Fernsehen mit den Charakteren?",
                "Hast du schon mal ein Selfie mit einem Prominenten gemacht?",
                "Hast du schon mal einen ganzen Film rückwärts geschaut?",
                "Schreibst du heimlich Tagebuch?",
                "Kannst du alle Disney-Filme mitsingen?",
                "Hast du schon mal mit Pflanzen geredet?",
                "Versteckst du Süßigkeiten vor anderen?",
                "Hast du schon mal im Supermarkt etwas fallen lassen und es nicht aufgehoben?",
                "Tanzt du alleine in deinem Zimmer?",
                "Hast du schon mal Essen vom Boden aufgehoben und gegessen?",
                "Redest du mit dir selbst im Spiegel?",
                "Hast du schon mal so getan, als würdest du telefonieren, um peinliche Situationen zu vermeiden?"
            ],
            fsk16: [
                "Hast du schon mal heimlich in der Öffentlichkeit getanzt?",
                "Hattest du schon mal einen Crush auf einen Promi?",
                "Hast du schon mal gelogen, um aus einer Verabredung rauszukommen?",
                "Stalkst du heimlich die Nachrichten vom Ex?",
                "Würdest du für 1 Million € einen Monat aufs Handy verzichten?",
                "Hast du schon mal heimlich jemanden geküsst?",
                "Hast du schon mal bei einem Date gelogen?",
                "Hast du schon mal betrunken eine peinliche Nachricht geschrieben?",
                "Würdest du bei einer Reality-Show mitmachen?",
                "Hast du schon mal heimlich Liebesbriefe gelesen?",
                "Hast du schon mal einen Dating-App-Account gelöscht und wieder erstellt?",
                "Hast du schon mal bei einem Spiel geschummelt?",
                "Würdest du für einen Tag das Geschlecht tauschen wollen?",
                "Bist du schon mal absichtlich zu spät gekommen?",
                "Hast du schon mal eine Lüge erzählt, um jemanden zu beeindrucken?",
                "Hast du schon mal so getan, als hättest du eine Nachricht nicht gesehen?",
                "Warst du schon mal heimlich neidisch auf einen Freund?",
                "Hast du schon mal eine Party verlassen, ohne dich zu verabschieden?",
                "Hast du schon mal jemanden bei Social Media entfolgt, weil er/sie zu viel gepostet hat?",
                "Hast du schon mal vorgegeben, krank zu sein, um nicht zur Arbeit/Schule zu müssen?"
            ],
            fsk18: [
                "Hattest du schon mal einen One-Night-Stand?",
                "Hast du schon mal heimlich die Sachen deines Partners durchsucht?",
                "Würdest du beim ersten Date nach Hause gehen?",
                "Hattest du schon mal einen Sextraum über jemanden aus dieser Runde?",
                "Hast du schon mal einen Orgasmus vorgetäuscht?",
                "Bist du schon mal fremdgegangen?",
                "Hast du schon mal Sexspielzeug benutzt?",
                "Hattest du schon mal Sex an einem öffentlichen Ort?",
                "Würdest du bei einem Dreier mitmachen?",
                "Schaust du heimlich Pornos?",
                "Hast du schon mal Sexting betrieben?",
                "Hast du schon mal beim Sex an jemand anderen gedacht?",
                "Würdest du für Geld erotische Fotos verkaufen?",
                "Hattest du schon mal Sex mit jemandem, den du erst am selben Tag kennengelernt hast?",
                "Hattest du schon mal eine Affäre mit einem verheirateten Menschen?",
                "Hast du schon mal beim Sex einen Namen falsch gesagt?",
                "Würdest du mit einem/einer Ex schlafen, obwohl du in einer Beziehung bist?",
                "Hast du schon mal Dirty Talk probiert?",
                "Warst du schon mal in einem Sexshop?",
                "Hast du schon mal eine Sexhotline angerufen?"
            ]
        };

        let questions = [];
        this.selectedCategories.forEach(category => {
            if (questionBank[category]) {
                questions = questions.concat(questionBank[category]);
            }
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
        if (this.currentQuestionIndex < this.questions.length) {
            return this.questions[this.currentQuestionIndex];
        }
        return null;
    }

    // Submit vote for current question
    submitVote(playerName, vote) {
        this.currentVotes[playerName] = vote;
        this.saveToStorage();
    }

    // Submit estimation for current question
    submitEstimation(playerName, estimation) {
        this.currentEstimations[playerName] = estimation;
        this.saveToStorage();
    }

    // Check if all players have voted
    hasAllPlayersVoted() {
        return Object.keys(this.currentVotes).length >= this.players.length;
    }

    // Check if all players have estimated
    hasAllPlayersEstimated() {
        return Object.keys(this.currentEstimations).length >= this.players.length;
    }

    // Calculate round results
    calculateRoundResults() {
        // Count actual "yes" votes
        const actualYesCount = Object.values(this.currentVotes).filter(vote => vote === 'yes').length;
        const baseSips = this.getBaseSips();
        
        const playerResults = {};
        
        // Calculate results for each player
        Object.entries(this.currentEstimations).forEach(([playerName, estimation]) => {
            const difference = Math.abs(estimation - actualYesCount);
            let sips = 0;
            
            if (difference === 0) {
                // Exakte Schätzung = 0 Schlücke
                sips = 0;
                this.playerStats[playerName].exactGuesses++;
            } else {
                // Falsche Schätzung = Basis-Schlücke + Abweichung
                sips = baseSips + difference;
            }
            
            // Update player statistics
            this.playerStats[playerName].totalSips += sips;
            this.playerStats[playerName].totalGuesses++;
            
            playerResults[playerName] = {
                vote: this.currentVotes[playerName] || 'no',
                estimation: estimation,
                actualCount: actualYesCount,
                difference: difference,
                sips: sips,
                isExact: difference === 0
            };
        });

        // Create round result
        const roundResult = {
            round: this.currentRound,
            question: this.getCurrentQuestion(),
            actualYesCount: actualYesCount,
            totalPlayers: this.players.length,
            playerResults: playerResults,
            timestamp: Date.now()
        };

        // Add to results history
        this.roundResults.push(roundResult);
        
        // Update player statistics averages
        this.updatePlayerAverages();
        
        this.saveToStorage();
        return roundResult;
    }

    // Update player averages
    updatePlayerAverages() {
        Object.keys(this.playerStats).forEach(playerName => {
            const stats = this.playerStats[playerName];
            if (stats.totalGuesses > 0) {
                const totalDeviation = this.roundResults.reduce((sum, round) => {
                    const playerResult = round.playerResults[playerName];
                    return sum + (playerResult ? playerResult.difference : 0);
                }, 0);
                stats.averageDeviation = Math.round((totalDeviation / stats.totalGuesses) * 10) / 10;
            }
        });
    }

    // Move to next round
    nextRound() {
        if (this.currentRound < this.totalRounds && this.currentQuestionIndex < this.questions.length - 1) {
            this.currentRound++;
            this.currentQuestionIndex++;
            this.currentVotes = {};
            this.currentEstimations = {};
            this.saveToStorage();
            return true;
        } else {
            this.isGameActive = false;
            this.saveToStorage();
            return false;
        }
    }

    // Get final results with rankings
    getFinalResults() {
        const playerRankings = this.players.map(playerName => {
            const stats = this.playerStats[playerName];
            const playerRounds = this.roundResults.map(round => round.playerResults[playerName]).filter(r => r);
            
            return {
                name: playerName,
                totalSips: stats.totalSips,
                exactGuesses: stats.exactGuesses,
                totalGuesses: stats.totalGuesses,
                averageDeviation: stats.averageDeviation,
                exactPercentage: stats.totalGuesses > 0 ? Math.round((stats.exactGuesses / stats.totalGuesses) * 100) : 0,
                bestGuess: playerRounds.reduce((best, round) => {
                    return round.difference < best.difference ? round : best;
                }, { difference: Infinity }),
                worstGuess: playerRounds.reduce((worst, round) => {
                    return round.difference > worst.difference ? round : worst;
                }, { difference: -1 })
            };
        });

        // Sort by total sips (ascending = better), then by exact guesses (descending = better)
        playerRankings.sort((a, b) => {
            if (a.totalSips !== b.totalSips) {
                return a.totalSips - b.totalSips;
            }
            return b.exactGuesses - a.exactGuesses;
        });

        return {
            rankings: playerRankings,
            gameStats: {
                totalRounds: this.roundResults.length,
                totalQuestions: this.questions.length,
                averageYesVotes: this.roundResults.length > 0 ? 
                    Math.round((this.roundResults.reduce((sum, round) => sum + round.actualYesCount, 0) / this.roundResults.length) * 10) / 10 : 0,
                mostYesVotes: Math.max(...this.roundResults.map(r => r.actualYesCount), 0),
                leastYesVotes: Math.min(...this.roundResults.map(r => r.actualYesCount), 0),
                winner: playerRankings[0],
                mostDrinks: playerRankings.reduce((most, player) => 
                    player.totalSips > most.totalSips ? player : most),
                bestGuesser: playerRankings.reduce((best, player) => 
                    player.exactGuesses > best.exactGuesses ? player : best)
            }
        };
    }

    // Get voting progress for current round
    getVotingProgress() {
        return {
            voted: Object.keys(this.currentVotes).length,
            total: this.players.length,
            remaining: this.players.length - Object.keys(this.currentVotes).length,
            percentage: this.players.length > 0 ? 
                Math.round((Object.keys(this.currentVotes).length / this.players.length) * 100) : 0
        };
    }

    // Get estimation progress for current round
    getEstimationProgress() {
        return {
            estimated: Object.keys(this.currentEstimations).length,
            total: this.players.length,
            remaining: this.players.length - Object.keys(this.currentEstimations).length,
            percentage: this.players.length > 0 ? 
                Math.round((Object.keys(this.currentEstimations).length / this.players.length) * 100) : 0
        };
    }

    // Check if player has voted in current round
    hasPlayerVoted(playerName) {
        return this.currentVotes.hasOwnProperty(playerName);
    }

    // Check if player has estimated in current round
    hasPlayerEstimated(playerName) {
        return this.currentEstimations.hasOwnProperty(playerName);
    }

    // Get player's current round vote
    getPlayerVote(playerName) {
        return this.currentVotes[playerName] || null;
    }

    // Get player's current round estimation
    getPlayerEstimation(playerName) {
        return this.currentEstimations[playerName] || null;
    }

    // Get current round summary
    getCurrentRoundSummary() {
        return {
            round: this.currentRound,
            question: this.getCurrentQuestion(),
            votingProgress: this.getVotingProgress(),
            estimationProgress: this.getEstimationProgress(),
            phase: this.determineCurrentPhase()
        };
    }

    // Determine current game phase
    determineCurrentPhase() {
        if (!this.isGameActive) {
            return 'finished';
        }
        
        if (!this.hasAllPlayersVoted()) {
            return 'voting';
        } else if (!this.hasAllPlayersEstimated()) {
            return 'estimation';
        } else {
            return 'results';
        }
    }

    // Get round history for a specific player
    getPlayerRoundHistory(playerName) {
        return this.roundResults.map(round => {
            const playerResult = round.playerResults[playerName];
            return {
                round: round.round,
                question: round.question,
                vote: playerResult ? playerResult.vote : null,
                estimation: playerResult ? playerResult.estimation : null,
                actualCount: round.actualYesCount,
                difference: playerResult ? playerResult.difference : null,
                sips: playerResult ? playerResult.sips : 0,
                isExact: playerResult ? playerResult.isExact : false
            };
        });
    }

    // Get best and worst performing rounds
    getRoundHighlights() {
        if (this.roundResults.length === 0) return null;

        const highlights = {
            mostYesVotes: null,
            leastYesVotes: null,
            hardestToGuess: null,
            easiestToGuess: null
        };

        let maxYes = -1;
        let minYes = Infinity;
        let maxDeviation = -1;
        let minDeviation = Infinity;

        this.roundResults.forEach(round => {
            // Track yes votes
            if (round.actualYesCount > maxYes) {
                maxYes = round.actualYesCount;
                highlights.mostYesVotes = round;
            }
            if (round.actualYesCount < minYes) {
                minYes = round.actualYesCount;
                highlights.leastYesVotes = round;
            }

            // Calculate average deviation for this round
            const playerResults = Object.values(round.playerResults);
            const avgDeviation = playerResults.length > 0 ? 
                playerResults.reduce((sum, result) => sum + result.difference, 0) / playerResults.length : 0;

            if (avgDeviation > maxDeviation) {
                maxDeviation = avgDeviation;
                highlights.hardestToGuess = round;
            }
            if (avgDeviation < minDeviation) {
                minDeviation = avgDeviation;
                highlights.easiestToGuess = round;
            }
        });

        return highlights;
    }

    // Check if game is valid to start
    isValidGame() {
        return this.selectedCategories.length > 0 && 
               this.difficulty && 
               this.players.length >= 2 &&
               this.questions.length > 0;
    }

    // Get game summary for display
    getGameSummary() {
        return {
            mode: this.deviceMode,
            categories: this.selectedCategories,
            difficulty: this.difficulty,
            baseSips: this.getBaseSips(),
            players: this.players,
            currentRound: this.currentRound,
            totalRounds: this.totalRounds,
            questionsGenerated: this.questions.length,
            isActive: this.isGameActive,
            phase: this.determineCurrentPhase(),
            votingProgress: this.getVotingProgress(),
            estimationProgress: this.getEstimationProgress()
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
                baseSips: this.getBaseSips()
            },
            players: this.players,
            questions: this.questions,
            roundResults: this.roundResults,
            playerStats: this.playerStats,
            gameId: this.gameId,
            totalRounds: this.totalRounds,
            isCompleted: !this.isGameActive,
            finalResults: this.isGameActive ? null : this.getFinalResults()
        };
    }

    // Clear personal data (GDPR compliance)
    clearPersonalData() {
        // Replace player names with anonymous identifiers
        const playerMapping = {};
        this.players.forEach((player, index) => {
            playerMapping[player] = `Player ${index + 1}`;
        });

        // Update player array
        this.players = Object.values(playerMapping);

        // Update player stats
        const newPlayerStats = {};
        Object.entries(this.playerStats).forEach(([oldName, stats]) => {
            const newName = playerMapping[oldName];
            if (newName) {
                newPlayerStats[newName] = stats;
            }
        });
        this.playerStats = newPlayerStats;

        // Update round results
        this.roundResults.forEach(round => {
            const newPlayerResults = {};
            Object.entries(round.playerResults).forEach(([oldName, result]) => {
                const newName = playerMapping[oldName];
                if (newName) {
                    newPlayerResults[newName] = result;
                }
            });
            round.playerResults = newPlayerResults;
        });

        // Update current votes and estimations
        const newCurrentVotes = {};
        Object.entries(this.currentVotes).forEach(([oldName, vote]) => {
            const newName = playerMapping[oldName];
            if (newName) {
                newCurrentVotes[newName] = vote;
            }
        });
        this.currentVotes = newCurrentVotes;

        const newCurrentEstimations = {};
        Object.entries(this.currentEstimations).forEach(([oldName, estimation]) => {
            const newName = playerMapping[oldName];
            if (newName) {
                newCurrentEstimations[newName] = estimation;
            }
        });
        this.currentEstimations = newCurrentEstimations;

        // Clear player name
        this.playerName = null;

        this.saveToStorage();
    }

    // Reset for new round (keeps game settings, clears round data)
    resetForNewRound() {
        this.currentRound = 1;
        this.currentQuestionIndex = 0;
        this.currentVotes = {};
        this.currentEstimations = {};
        this.roundResults = [];
        this.isGameActive = true;
        
        // Reset player stats
        this.players.forEach(player => {
            this.initializePlayerStats(player);
        });

        // Generate new questions
        this.questions = this.generateQuestions();
        
        this.saveToStorage();
    }

    // Get category display info
    getCategoryInfo() {
        const categoryInfo = {
            'fsk0': {
                name: 'Familie & Freunde',
                emoji: '👨‍👩‍👧‍👦',
                description: 'Harmlose Fragen für alle Altersgruppen',
                color: '#4CAF50'
            },
            'fsk16': {
                name: 'Party Time',
                emoji: '🎉',
                description: 'Unterhaltsame und lustige Fragen',
                color: '#FF9800'
            },
            'fsk18': {
                name: 'Heiß & Gewagt',
                emoji: '🔥',
                description: 'Nur für Erwachsene',
                color: '#F44336'
            }
        };

        return this.selectedCategories.map(category => categoryInfo[category] || {
            name: 'Unbekannt',
            emoji: '❓',
            description: 'Unbekannte Kategorie',
            color: '#9E9E9E'
        });
    }

    // Get difficulty display info
    getDifficultyInfo() {
        const difficultyInfo = {
            'easy': {
                name: 'Entspannt',
                emoji: '🍺',
                description: '1 Schluck + Abweichung',
                color: '#4CAF50'
            },
            'medium': {
                name: 'Standard',
                emoji: '🍺🍺',
                description: '2 Schlücke + Abweichung',
                color: '#FF9800'
            },
            'hard': {
                name: 'Hardcore',
                emoji: '🍺🍺🍺',
                description: '3 Schlücke + Abweichung',
                color: '#F44336'
            }
        };

        return difficultyInfo[this.difficulty] || {
            name: 'Unbekannt',
            emoji: '❓',
            description: 'Unbekannte Schwierigkeit',
            color: '#9E9E9E'
        };
    }

    // Performance analytics
    getPerformanceAnalytics() {
        if (this.roundResults.length === 0) return null;

        const analytics = {
            totalRounds: this.roundResults.length,
            averageYesRate: 0,
            mostPopularAnswer: null,
            hardestQuestion: null,
            easiestQuestion: null,
            playerPerformance: {}
        };

        // Calculate average yes rate
        const totalYesVotes = this.roundResults.reduce((sum, round) => sum + round.actualYesCount, 0);
        analytics.averageYesRate = Math.round((totalYesVotes / (this.roundResults.length * this.players.length)) * 100);

        // Find hardest and easiest questions
        let maxAvgDeviation = -1;
        let minAvgDeviation = Infinity;

        this.roundResults.forEach(round => {
            const deviations = Object.values(round.playerResults).map(result => result.difference);
            const avgDeviation = deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;

            if (avgDeviation > maxAvgDeviation) {
                maxAvgDeviation = avgDeviation;
                analytics.hardestQuestion = {
                    question: round.question,
                    round: round.round,
                    avgDeviation: Math.round(avgDeviation * 10) / 10,
                    actualYes: round.actualYesCount
                };
            }

            if (avgDeviation < minAvgDeviation) {
                minAvgDeviation = avgDeviation;
                analytics.easiestQuestion = {
                    question: round.question,
                    round: round.round,
                    avgDeviation: Math.round(avgDeviation * 10) / 10,
                    actualYes: round.actualYesCount
                };
            }
        });

        // Player performance analysis
        this.players.forEach(playerName => {
            const stats = this.playerStats[playerName];
            const playerHistory = this.getPlayerRoundHistory(playerName);
            
            analytics.playerPerformance[playerName] = {
                rank: 0, // Will be calculated after sorting
                totalSips: stats.totalSips,
                exactGuesses: stats.exactGuesses,
                accuracy: stats.totalGuesses > 0 ? Math.round((stats.exactGuesses / stats.totalGuesses) * 100) : 0,
                averageDeviation: stats.averageDeviation,
                consistency: this.calculatePlayerConsistency(playerHistory),
                improvement: this.calculatePlayerImprovement(playerHistory)
            };
        });

        return analytics;
    }

    // Calculate player consistency (lower variance = more consistent)
    calculatePlayerConsistency(playerHistory) {
        if (playerHistory.length < 2) return 0;

        const deviations = playerHistory.map(round => round.difference || 0);
        const average = deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;
        const variance = deviations.reduce((sum, dev) => sum + Math.pow(dev - average, 2), 0) / deviations.length;
        
        // Convert to consistency score (0-100, higher = more consistent)
        return Math.max(0, Math.round(100 - (variance * 10)));
    }

    // Calculate if player is improving over time
    calculatePlayerImprovement(playerHistory) {
        if (playerHistory.length < 3) return 0;

        const firstHalf = playerHistory.slice(0, Math.floor(playerHistory.length / 2));
        const secondHalf = playerHistory.slice(Math.floor(playerHistory.length / 2));

        const firstHalfAvg = firstHalf.reduce((sum, round) => sum + (round.difference || 0), 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, round) => sum + (round.difference || 0), 0) / secondHalf.length;

        // Positive value means improvement (lower deviation in second half)
        return Math.round((firstHalfAvg - secondHalfAvg) * 10) / 10;
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
        // Clean up finished games after some time
        setTimeout(() => {
            window.gameState.clearStorage();
        }, 5 * 60 * 1000); // 5 minutes
    }
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameState;
}