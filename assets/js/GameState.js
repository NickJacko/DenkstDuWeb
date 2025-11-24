// ===== NO-CAP GAMESTATE - ZENTRALE KLASSE =====
// Version: 4.1 - Security Hardened & Production Ready
// Diese Datei wird in ALLE HTML-Dateien eingebunden

(function(window) {
    'use strict';

    class GameState {
        constructor() {
            // EINHEITLICHE KEY-KONVENTION (nocap_*)
            this.STORAGE_KEY = 'nocap_game_state';
            this.VERSION = 4.1;
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

        // ===== P0 FIX: LOAD STATE WITH VALIDATION =====
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

                // P0 FIX: Validiere State-Struktur
                if (!this.validateStateStructure(state)) {
                    this.log('⚠️ Invalid state structure, cleared', 'warning');
                    this.clearStorage();
                    return false;
                }

                // Prüfe Alter des State (max 24h)
                if (this.isStateExpired(state)) {
                    this.log('⚠️ Saved state too old, cleared', 'warning');
                    this.clearStorage();
                    return false;
                }

                // P0 FIX: Sanitize alle String-Werte beim Laden
                this.deviceMode = this.sanitizeValue(state.deviceMode, ['single', 'multi']);
                this.selectedCategories = this.sanitizeCategories(state.selectedCategories);
                this.difficulty = this.sanitizeValue(state.difficulty, ['easy', 'medium', 'hard']);
                this.alcoholMode = state.alcoholMode === true;
                this.questionCount = this.sanitizeNumber(state.questionCount, 1, 50, 10);
                this.playerName = this.sanitizeString(state.playerName);
                this.gameId = this.sanitizeGameId(state.gameId);
                this.playerId = this.sanitizeString(state.playerId);
                this.isHost = state.isHost === true;
                this.isGuest = state.isGuest === true;
                this.gamePhase = this.sanitizeValue(state.gamePhase, ['lobby', 'playing', 'results'], 'lobby');
                this.timestamp = this.sanitizeNumber(state.timestamp, 0, Date.now(), Date.now());

                this.log('✅ State loaded and validated');
                return true;

            } catch (error) {
                this.log(`❌ Load failed: ${error.message}`, 'error');
                this.clearStorage();
                return false;
            }
        }

        // ===== P0 FIX: VALIDATE STATE STRUCTURE =====
        validateStateStructure(state) {
            if (!state || typeof state !== 'object') {
                return false;
            }

            // Version check
            if (state.version && state.version < 4) {
                this.log('⚠️ Outdated state version', 'warning');
                return false;
            }

            return true;
        }

        // ===== P0 FIX: SANITIZATION HELPERS =====

        /**
         * Sanitize string values (prevent XSS in stored data)
         */
        sanitizeString(value) {
            if (!value || typeof value !== 'string') {
                return '';
            }

            // Use NocapUtils if available, otherwise basic sanitization
            if (typeof window.NocapUtils !== 'undefined' && window.NocapUtils.sanitizeInput) {
                return window.NocapUtils.sanitizeInput(value);
            }

            // Fallback: Remove dangerous characters
            return value.replace(/[<>&"']/g, '').trim();
        }

        /**
         * Sanitize enum values (only allow specific values)
         */
        sanitizeValue(value, allowedValues, defaultValue = null) {
            if (!value || typeof value !== 'string') {
                return defaultValue;
            }

            const sanitized = value.toLowerCase().trim();
            return allowedValues.includes(sanitized) ? sanitized : defaultValue;
        }

        /**
         * Sanitize number values
         */
        sanitizeNumber(value, min, max, defaultValue) {
            const num = parseInt(value);
            if (isNaN(num) || num < min || num > max) {
                return defaultValue;
            }
            return num;
        }

        /**
         * Sanitize categories array
         */
        sanitizeCategories(categories) {
            if (!Array.isArray(categories)) {
                return [];
            }

            const allowedCategories = ['fsk0', 'fsk16', 'fsk18', 'special'];
            return categories
                .filter(cat => typeof cat === 'string')
                .map(cat => cat.toLowerCase().trim())
                .filter(cat => allowedCategories.includes(cat));
        }

        /**
         * Sanitize Game ID (6 uppercase alphanumeric)
         */
        sanitizeGameId(gameId) {
            if (!gameId || typeof gameId !== 'string') {
                return null;
            }

            const cleaned = gameId.toUpperCase().replace(/[^A-Z0-9]/g, '');
            return cleaned.length === 6 ? cleaned : null;
        }

        // ===== SAVE STATE TO LOCALSTORAGE =====
        save() {
            try {
                // P0 FIX: Validate before saving
                const state = {
                    deviceMode: this.deviceMode,
                    selectedCategories: this.selectedCategories,
                    difficulty: this.difficulty,
                    alcoholMode: this.alcoholMode === true,
                    questionCount: this.questionCount,
                    playerName: this.sanitizeString(this.playerName),
                    gameId: this.sanitizeGameId(this.gameId),
                    playerId: this.sanitizeString(this.playerId),
                    isHost: this.isHost === true,
                    isGuest: this.isGuest === true,
                    gamePhase: this.gamePhase,
                    timestamp: Date.now(),
                    version: this.VERSION
                };

                // P0 FIX: Additional security - check state size
                const stateString = JSON.stringify(state);
                if (stateString.length > 10000) {
                    this.log('⚠️ State too large, not saving', 'warning');
                    return false;
                }

                localStorage.setItem(this.STORAGE_KEY, stateString);
                this.log('✅ State saved successfully');
                return true;

            } catch (error) {
                this.log(`❌ Save failed: ${error.message}`, 'error');

                // P1 FIX: Handle QuotaExceededError
                if (error.name === 'QuotaExceededError') {
                    this.log('⚠️ Storage quota exceeded, clearing old data', 'warning');
                    this.clearOldData();
                }

                return false;
            }
        }

        // ===== P1 FIX: CLEAR OLD DATA =====
        clearOldData() {
            try {
                // Clear only nocap_* keys that are not critical
                const keysToCheck = ['nocap_game_history', 'nocap_cached_questions'];
                keysToCheck.forEach(key => {
                    localStorage.removeItem(key);
                });
                this.log('✅ Old data cleared');
            } catch (error) {
                this.log(`❌ Clear old data failed: ${error.message}`, 'error');
            }
        }

        // ===== CLEAR STATE =====
        clearStorage() {
            try {
                localStorage.removeItem(this.STORAGE_KEY);
                this.log('🗑️ Storage cleared');
            } catch (error) {
                this.log(`❌ Clear storage failed: ${error.message}`, 'error');
            }
        }

        // ===== CHECK IF STATE IS EXPIRED =====
        isStateExpired(state) {
            if (!state.timestamp || typeof state.timestamp !== 'number') {
                return true;
            }

            const ageHours = (Date.now() - state.timestamp) / (1000 * 60 * 60);
            return ageHours > this.MAX_AGE_HOURS;
        }

        // ===== MIGRATION FROM OLD KEYS =====
        migrateOldKeys() {
            const migrations = [
                { old: 'denkstdu_game_state', new: 'nocap_game_state' },
                { old: 'denkstdu_age_verification', new: 'nocap_age_verification' },
                { old: 'denkstdu_alcohol_mode', new: 'nocap_alcohol_mode' }
            ];

            migrations.forEach(({ old, new: newKey }) => {
                if (old === newKey) return;

                const oldData = localStorage.getItem(old);
                if (oldData) {
                    try {
                        // P0 FIX: Validate data before migrating
                        JSON.parse(oldData); // Check if valid JSON

                        localStorage.setItem(newKey, oldData);
                        localStorage.removeItem(old);
                        this.log(`✅ Migrated: ${old} → ${newKey}`);
                    } catch (error) {
                        this.log(`❌ Migration failed for ${old}: ${error.message}`, 'error');
                        localStorage.removeItem(old);
                    }
                }
            });
        }

        // ===== VALIDATION FOR MULTIPLAYER =====
        isValidForMultiplayer() {
            return (
                this.deviceMode === 'multi' &&
                Array.isArray(this.selectedCategories) &&
                this.selectedCategories.length > 0 &&
                this.gameId !== null &&
                this.playerId !== null &&
                this.difficulty !== null
            );
        }

        // ===== VALIDATION FOR SINGLE DEVICE =====
        isValidForSingleDevice() {
            return (
                this.deviceMode === 'single' &&
                Array.isArray(this.selectedCategories) &&
                this.selectedCategories.length > 0 &&
                this.difficulty !== null
            );
        }

        // ===== P0 FIX: GENERATE PLAYER ID (SECURE) =====
        generatePlayerId(isHost = false) {
            const timestamp = Date.now();
            const random = Math.random().toString(36).substr(2, 6);
            const extraRandom = Math.random().toString(36).substr(2, 4);

            // P0 FIX: Sanitize player name
            const safeName = this.sanitizeString(this.playerName || 'player')
                .replace(/[^a-zA-Z0-9]/g, '')
                .toLowerCase()
                .substr(0, 10);

            const prefix = isHost ? 'host' : 'guest';

            this.playerId = `${prefix}_${safeName}_${timestamp}_${random}${extraRandom}`;
            this.save();

            this.log(`✅ Player ID generated: ${this.playerId.substr(0, 20)}...`);
            return this.playerId;
        }

        // ===== P1 FIX: CHECK PREMIUM STATUS =====
        isPremiumUser() {
            // P0 FIX: Premium status MUST be validated server-side
            // This is only a client-side indicator, NOT authoritative
            try {
                // Check if authService has premium status
                if (window.authService && typeof window.authService.getUserId === 'function') {
                    const userId = window.authService.getUserId();
                    if (userId) {
                        // TODO: This should query Firebase with proper rules
                        // For now, return false (no premium)
                        return false;
                    }
                }
                return false;
            } catch (error) {
                this.log(`⚠️ Premium check failed: ${error.message}`, 'warning');
                return false;
            }
        }

        // ===== P1 FIX: CHECK FSK ACCESS =====
        canAccessFSK(level) {
            try {
                const ageLevel = parseInt(localStorage.getItem('nocap_age_level')) || 0;

                const levelMap = {
                    'fsk0': 0,
                    'fsk16': 16,
                    'fsk18': 18
                };

                const requiredAge = levelMap[level] || 0;
                return ageLevel >= requiredAge;
            } catch (error) {
                this.log(`⚠️ FSK check failed: ${error.message}`, 'warning');
                return false;
            }
        }

        // ===== DEBUG INFORMATION =====
        getDebugInfo() {
            return {
                deviceMode: this.deviceMode,
                isHost: this.isHost,
                isGuest: this.isGuest,
                gameId: this.gameId,
                playerId: this.playerId ? this.playerId.substr(0, 20) + '...' : null,
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
                version: this.VERSION,
                isPremium: this.isPremiumUser()
            };
        }

        // ===== LOGGING =====
        log(message, type = 'info') {
            // P2 FIX: Logging nur im Development-Mode
            if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                // In production: nur Errors loggen
                if (type !== 'error') return;
            }

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

    // Auto-log on load (only in development)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('%c✅ GameState v4.1 loaded (Security Hardened)', 'color: #4CAF50; font-weight: bold');
    }

})(window);