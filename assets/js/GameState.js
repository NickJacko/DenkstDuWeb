// ===== NO-CAP GAMESTATE - ZENTRALE KLASSE =====
// Version: 4.0 (Refactored & Secured)
// Diese Datei wird in ALLE HTML-Dateien eingebunden

(function(window) {
    'use strict';

    class GameState {
        constructor() {
            // EINHEITLICHE KEY-KONVENTION (nocap_*)
            this.STORAGE_KEY = 'nocap_game_state';
            this.VERSION = 4;
            this.MAX_AGE_HOURS = 24;

            // State Properties
            this.deviceMode = null;           // 'single' | 'multi'
            this.selectedCategories = [];     // ['fsk0', 'fsk16', 'fsk18', 'special']
            this.difficulty = null;           // 'easy' | 'medium' | 'hard'
            this.alcoholMode = true;          // true | false
            this.questionCount = 10;          // Anzahl Fragen
            this.playerName = '';             // Name des aktuellen Spielers
            this.gameId = null;               // 6-stelliger Game-Code
            this.playerId = null;             // Eindeutige Player-ID
            this.isHost = false;              // Ist dieser User der Host?
            this.isGuest = false;             // Ist dieser User ein Gast?
            this.gamePhase = 'lobby';         // 'lobby' | 'playing' | 'results'
            this.timestamp = Date.now();      // Wann wurde State erstellt

            // Auto-Load beim Instanziieren
            this.load();
        }

        // ===== LOAD STATE FROM LOCALSTORAGE =====
        load() {
            try {
                // WICHTIG: Migration von alten Keys ZUERST
                this.migrateOldKeys();

                const saved = localStorage.getItem(this.STORAGE_KEY);
                if (!saved) {
                    this.log('ℹ️ No saved state found');
                    return false;
                }

                const state = JSON.parse(saved);

                // Prüfe Alter des State (max 24h)
                if (this.isStateExpired(state)) {
                    this.log('⚠️ Saved state too old, cleared');
                    this.clearStorage();
                    return false;
                }

                // Lade alle Properties
                this.deviceMode = state.deviceMode || null;
                this.selectedCategories = state.selectedCategories || [];
                this.difficulty = state.difficulty || null;
                this.alcoholMode = state.alcoholMode !== undefined ? state.alcoholMode : true;
                this.questionCount = state.questionCount || 10;
                this.playerName = state.playerName || '';
                this.gameId = state.gameId || null;
                this.playerId = state.playerId || null;
                this.isHost = state.isHost || false;
                this.isGuest = state.isGuest || false;
                this.gamePhase = state.gamePhase || 'lobby';
                this.timestamp = state.timestamp || Date.now();

                this.log('✅ State loaded from localStorage');
                return true;

            } catch (error) {
                this.log(`❌ Load failed: ${error.message}`, 'error');
                this.clearStorage();
                return false;
            }
        }

        // ===== SAVE STATE TO LOCALSTORAGE =====
        save() {
            try {
                const state = {
                    deviceMode: this.deviceMode,
                    selectedCategories: this.selectedCategories,
                    difficulty: this.difficulty,
                    alcoholMode: this.alcoholMode,
                    questionCount: this.questionCount,
                    playerName: this.playerName,
                    gameId: this.gameId,
                    playerId: this.playerId,
                    isHost: this.isHost,
                    isGuest: this.isGuest,
                    gamePhase: this.gamePhase,
                    timestamp: Date.now(),
                    version: this.VERSION
                };

                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
                this.log('✅ State saved successfully');
                return true;

            } catch (error) {
                this.log(`❌ Save failed: ${error.message}`, 'error');
                return false;
            }
        }

        // ===== CLEAR STATE =====
        clearStorage() {
            localStorage.removeItem(this.STORAGE_KEY);
            this.log('🗑️ Storage cleared');
        }

        // ===== CHECK IF STATE IS EXPIRED =====
        isStateExpired(state) {
            if (!state.timestamp) return true;
            const ageHours = (Date.now() - state.timestamp) / (1000 * 60 * 60);
            return ageHours > this.MAX_AGE_HOURS;
        }

        // ===== MIGRATION FROM OLD KEYS =====
        migrateOldKeys() {
            const migrations = [
                { old: 'denkstdu_game_state', new: 'nocap_game_state' }
            ];

            migrations.forEach(({ old, new: newKey }) => {
                if (old === newKey) return; // Skip if same

                const oldData = localStorage.getItem(old);
                if (oldData) {
                    try {
                        localStorage.setItem(newKey, oldData);
                        localStorage.removeItem(old);
                        this.log(`✅ Migrated: ${old} → ${newKey}`);
                    } catch (error) {
                        this.log(`❌ Migration failed for ${old}: ${error.message}`, 'error');
                    }
                }
            });
        }

        // ===== VALIDATION FOR MULTIPLAYER =====
        isValidForMultiplayer() {
            return (
                this.deviceMode === 'multi' &&
                this.selectedCategories.length > 0 &&
                this.gameId &&
                this.playerId &&
                this.difficulty
            );
        }

        // ===== VALIDATION FOR SINGLE DEVICE =====
        isValidForSingleDevice() {
            return (
                this.deviceMode === 'single' &&
                this.selectedCategories.length > 0 &&
                this.difficulty
            );
        }

        // ===== GENERATE PLAYER ID =====
        generatePlayerId(isHost = false) {
            const timestamp = Date.now();
            const random = Math.random().toString(36).substr(2, 4);
            const safeName = (this.playerName || 'player')
                .replace(/[^a-zA-Z0-9]/g, '')
                .toLowerCase()
                .substr(0, 10);
            const prefix = isHost ? 'host' : 'guest';

            this.playerId = `${prefix}_${safeName}_${timestamp}_${random}`;
            this.save();

            this.log(`✅ Player ID generated: ${this.playerId}`);
            return this.playerId;
        }

        // ===== DEBUG INFORMATION =====
        getDebugInfo() {
            return {
                deviceMode: this.deviceMode,
                isHost: this.isHost,
                isGuest: this.isGuest,
                gameId: this.gameId,
                playerId: this.playerId,
                categories: this.selectedCategories,
                difficulty: this.difficulty,
                alcoholMode: this.alcoholMode,
                questionCount: this.questionCount,
                playerName: this.playerName,
                gamePhase: this.gamePhase,
                validMulti: this.isValidForMultiplayer(),
                validSingle: this.isValidForSingleDevice(),
                timestamp: this.timestamp,
                ageMinutes: Math.floor((Date.now() - this.timestamp) / 1000 / 60),
                version: this.VERSION
            };
        }

        // ===== LOGGING =====
        log(message, type = 'info') {
            const prefix = '[GameState]';
            const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
            const colors = {
                info: '#4488ff',
                warning: '#ffaa00',
                error: '#ff4444',
                success: '#00ff00'
            };

            console.log(
                `%c${prefix} [${timestamp}] ${message}`,
                `color: ${colors[type] || colors.info}`
            );
        }
    }

    // ===== EXPORT AS GLOBAL CLASS =====
    window.GameState = GameState;

    // Auto-log on load
    console.log('%c✅ GameState v4.0 loaded', 'color: #4CAF50; font-weight: bold');

})(window);