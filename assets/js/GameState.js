// ===== NO-CAP GAMESTATE - ZENTRALE KLASSE =====
// Version: 5.0 - Security Hardened & Audit-Fixed
// Alle localStorage-Zugriffe MÜSSEN über diese Klasse laufen

(function(window) {
    'use strict';

    class GameState {
        constructor() {
            // EINHEITLICHE KEY-KONVENTION (nocap_*)
            this.STORAGE_KEY = 'nocap_game_state';
            this.VERSION = 5.0;
            this.MAX_AGE_HOURS = 24;

            // P1 FIX: Debounce-Timer für Save-Operationen
            this._saveTimer = null;
            this._saveDelay = 300; // 300ms debounce

            // P1 FIX: Lock-Mechanismus gegen Race-Conditions
            this._isLoading = false;
            this._isSaving = false;

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

            // P1 FIX: Track letzte Änderung für Debounce-Optimierung
            this._lastModified = Date.now();
            this._isDirty = false;

            // Auto-Load beim Instanziieren
            this.load();
        }

        // ===== P0 FIX: LOAD STATE WITH VALIDATION & LOCK =====
        load() {
            // P1 FIX: Prevent concurrent loads
            if (this._isLoading) {
                this.log('⚠️ Load already in progress', 'warning');
                return false;
            }

            this._isLoading = true;

            try {
                // WICHTIG: Migration von alten Keys ZUERST
                this.migrateOldKeys();

                const saved = localStorage.getItem(this.STORAGE_KEY);
                if (!saved) {
                    this.log('ℹ️ No saved state found');
                    this._isLoading = false;
                    return false;
                }

                const state = JSON.parse(saved);

                // P0 FIX: Validiere State-Struktur
                if (!this.validateStateStructure(state)) {
                    this.log('⚠️ Invalid state structure, cleared', 'warning');
                    this.clearStorage();
                    this._isLoading = false;
                    return false;
                }

                // Prüfe Alter des State (max 24h)
                if (this.isStateExpired(state)) {
                    this.log('⚠️ Saved state too old, cleared', 'warning');
                    this.clearStorage();
                    this._isLoading = false;
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

                this._isDirty = false;
                this.log('✅ State loaded and validated');
                this._isLoading = false;
                return true;

            } catch (error) {
                this.log(`❌ Load failed: ${error.message}`, 'error');
                this.clearStorage();
                this._isLoading = false;
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
            return value
                .replace(/[<>&"'`]/g, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+=/gi, '')
                .trim()
                .substring(0, 200); // P0 FIX: Max length
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
            const num = parseInt(value, 10);
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
                .filter(cat => allowedCategories.includes(cat))
                .slice(0, 4); // P0 FIX: Max 4 categories
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

        // ===== P1 FIX: SAVE WITH DEBOUNCE =====
        save(immediate = false) {
            // P1 FIX: Prevent concurrent saves
            if (this._isSaving && !immediate) {
                this._isDirty = true;
                return false;
            }

            // P1 FIX: Debounce saves (außer wenn immediate=true)
            if (!immediate) {
                this._isDirty = true;
                clearTimeout(this._saveTimer);

                this._saveTimer = setTimeout(() => {
                    this._performSave();
                }, this._saveDelay);

                return true;
            }

            return this._performSave();
        }

        // ===== INTERNAL: PERFORM ACTUAL SAVE =====
        _performSave() {
            // Skip if nothing changed
            if (!this._isDirty) {
                return true;
            }

            this._isSaving = true;

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
                    this._isSaving = false;
                    return false;
                }

                localStorage.setItem(this.STORAGE_KEY, stateString);
                this._lastModified = Date.now();
                this._isDirty = false;
                this.log('✅ State saved successfully');
                this._isSaving = false;
                return true;

            } catch (error) {
                this.log(`❌ Save failed: ${error.message}`, 'error');

                // P1 FIX: Handle QuotaExceededError
                if (error.name === 'QuotaExceededError') {
                    this.log('⚠️ Storage quota exceeded, clearing old data', 'warning');
                    this.clearOldData();

                    // Retry save after clearing
                    try {
                        const stateString = JSON.stringify({
                            deviceMode: this.deviceMode,
                            selectedCategories: this.selectedCategories,
                            difficulty: this.difficulty,
                            alcoholMode: this.alcoholMode,
                            questionCount: this.questionCount,
                            playerName: this.sanitizeString(this.playerName),
                            gameId: this.sanitizeGameId(this.gameId),
                            playerId: this.sanitizeString(this.playerId),
                            isHost: this.isHost,
                            isGuest: this.isGuest,
                            gamePhase: this.gamePhase,
                            timestamp: Date.now(),
                            version: this.VERSION
                        });
                        localStorage.setItem(this.STORAGE_KEY, stateString);
                        this.log('✅ Retry save successful');
                        this._isSaving = false;
                        this._isDirty = false;
                        return true;
                    } catch (retryError) {
                        this.log(`❌ Retry save failed: ${retryError.message}`, 'error');
                    }
                }

                this._isSaving = false;
                return false;
            }
        }

        // ===== P1 FIX: CLEAR OLD DATA =====
        clearOldData() {
            try {
                // Clear only nocap_* keys that are not critical
                const keysToCheck = [
                    'nocap_game_history',
                    'nocap_cached_questions',
                    'nocap_temp_answers',
                    'nocap_debug_log'
                ];

                let clearedCount = 0;
                keysToCheck.forEach(key => {
                    if (localStorage.getItem(key)) {
                        localStorage.removeItem(key);
                        clearedCount++;
                    }
                });

                this.log(`✅ Cleared ${clearedCount} old data entries`);
                return clearedCount;
            } catch (error) {
                this.log(`❌ Clear old data failed: ${error.message}`, 'error');
                return 0;
            }
        }

        // ===== CLEAR STATE =====
        clearStorage() {
            try {
                // Cancel pending saves
                clearTimeout(this._saveTimer);

                localStorage.removeItem(this.STORAGE_KEY);
                this._isDirty = false;
                this.log('🗑️ Storage cleared');
                return true;
            } catch (error) {
                this.log(`❌ Clear storage failed: ${error.message}`, 'error');
                return false;
            }
        }

        // ===== P1 FIX: CHECK VALIDITY (muss auf jeder Seite aufgerufen werden) =====
        checkValidity() {
            const info = this.getDebugInfo();

            // Check if state is too old
            if (info.ageMinutes > (this.MAX_AGE_HOURS * 60)) {
                this.log('⚠️ State expired', 'warning');
                return false;
            }

            // Check if basic structure is valid
            if (!this.deviceMode) {
                this.log('⚠️ No device mode set', 'warning');
                return false;
            }

            return true;
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

            let migratedCount = 0;

            migrations.forEach(({ old, new: newKey }) => {
                if (old === newKey) return;

                const oldData = localStorage.getItem(old);
                if (oldData) {
                    try {
                        // P0 FIX: Validate data before migrating
                        JSON.parse(oldData); // Check if valid JSON

                        // Only migrate if new key doesn't exist
                        if (!localStorage.getItem(newKey)) {
                            localStorage.setItem(newKey, oldData);
                            migratedCount++;
                        }

                        localStorage.removeItem(old);
                        this.log(`✅ Migrated: ${old} → ${newKey}`);
                    } catch (error) {
                        this.log(`❌ Migration failed for ${old}: ${error.message}`, 'error');
                        localStorage.removeItem(old);
                    }
                }
            });

            if (migratedCount > 0) {
                this.log(`✅ Migrated ${migratedCount} keys`);
            }
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
            const random = Math.random().toString(36).substring(2, 8);
            const extraRandom = Math.random().toString(36).substring(2, 6);

            // P0 FIX: Sanitize player name
            const safeName = this.sanitizeString(this.playerName || 'player')
                .replace(/[^a-zA-Z0-9]/g, '')
                .toLowerCase()
                .substring(0, 10);

            const prefix = isHost ? 'host' : 'guest';

            this.playerId = `${prefix}_${safeName}_${timestamp}_${random}${extraRandom}`;
            this.save(true); // Immediate save

            this.log(`✅ Player ID generated: ${this.playerId.substring(0, 20)}...`);
            return this.playerId;
        }

        // ===== P1 FIX: CHECK PREMIUM STATUS =====
        isPremiumUser() {
            // P0 FIX: Premium status MUST be validated server-side
            // This is only a client-side indicator, NOT authoritative
            try {
                // Check if authService has premium status
                if (window.authService && typeof window.authService.isPremiumUser === 'function') {
                    return window.authService.isPremiumUser();
                }

                // Fallback: Check Firebase directly (still not secure!)
                if (window.firebase && window.firebase.auth && window.firebase.auth()) {
                    const user = window.firebase.auth().currentUser;
                    if (user && user.getIdTokenResult) {
                        // TODO: Check custom claims for premiumStatus
                        // This requires server-side implementation
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
                // P0 FIX: This should be validated server-side
                const ageLevel = parseInt(localStorage.getItem('nocap_age_level'), 10) || 0;

                const levelMap = {
                    'fsk0': 0,
                    'fsk16': 16,
                    'fsk18': 18
                };

                const requiredAge = levelMap[level] || 0;
                const hasAccess = ageLevel >= requiredAge;

                if (!hasAccess) {
                    this.log(`⚠️ FSK ${level} access denied (user age: ${ageLevel})`, 'warning');
                }

                return hasAccess;
            } catch (error) {
                this.log(`⚠️ FSK check failed: ${error.message}`, 'warning');
                return false;
            }
        }

        // ===== P1 FIX: SETTERS WITH AUTO-SAVE =====
        setDeviceMode(mode) {
            const sanitized = this.sanitizeValue(mode, ['single', 'multi']);
            if (sanitized && sanitized !== this.deviceMode) {
                this.deviceMode = sanitized;
                this._isDirty = true;
                this.save();
            }
        }

        setDifficulty(difficulty) {
            const sanitized = this.sanitizeValue(difficulty, ['easy', 'medium', 'hard']);
            if (sanitized && sanitized !== this.difficulty) {
                this.difficulty = sanitized;
                this._isDirty = true;
                this.save();
            }
        }

        setAlcoholMode(enabled) {
            const value = enabled === true;
            if (value !== this.alcoholMode) {
                this.alcoholMode = value;
                this._isDirty = true;
                this.save();
            }
        }

        setPlayerName(name) {
            const sanitized = this.sanitizeString(name);
            if (sanitized !== this.playerName) {
                this.playerName = sanitized;
                this._isDirty = true;
                this.save();
            }
        }

        setGameId(gameId) {
            const sanitized = this.sanitizeGameId(gameId);
            if (sanitized !== this.gameId) {
                this.gameId = sanitized;
                this._isDirty = true;
                this.save();
            }
        }

        addCategory(category) {
            const sanitized = this.sanitizeValue(category, ['fsk0', 'fsk16', 'fsk18', 'special']);
            if (sanitized && !this.selectedCategories.includes(sanitized)) {
                this.selectedCategories.push(sanitized);
                this._isDirty = true;
                this.save();
            }
        }

        removeCategory(category) {
            const index = this.selectedCategories.indexOf(category);
            if (index > -1) {
                this.selectedCategories.splice(index, 1);
                this._isDirty = true;
                this.save();
            }
        }

        toggleCategory(category) {
            if (this.selectedCategories.includes(category)) {
                this.removeCategory(category);
            } else {
                this.addCategory(category);
            }
        }

        // ===== DEBUG INFORMATION =====
        getDebugInfo() {
            return {
                deviceMode: this.deviceMode,
                isHost: this.isHost,
                isGuest: this.isGuest,
                gameId: this.gameId,
                playerId: this.playerId ? this.playerId.substring(0, 20) + '...' : null,
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
                isPremium: this.isPremiumUser(),
                isDirty: this._isDirty,
                lastModified: new Date(this._lastModified).toISOString()
            };
        }

        // ===== LOGGING =====
        log(message, type = 'info') {
            // P2 FIX: Logging nur im Development-Mode
            const isDev = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('192.168.');

            if (!isDev) {
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
                `color: ${colors[type] || colors.info}; font-weight: ${type === 'error' ? 'bold' : 'normal'}`
            );
        }

        // ===== P1 FIX: CLEANUP ON PAGE UNLOAD =====
        cleanup() {
            clearTimeout(this._saveTimer);

            // Perform final save if dirty
            if (this._isDirty) {
                this._performSave();
            }

            this.log('✅ Cleanup completed');
        }
    }

    // ===== EXPORT AS GLOBAL CLASS =====
    window.GameState = GameState;

    // ===== P1 FIX: INSTALL CLEANUP HANDLER =====
    window.addEventListener('beforeunload', () => {
        if (window.gameState && typeof window.gameState.cleanup === 'function') {
            window.gameState.cleanup();
        }
    });

    // Auto-log on load (only in development)
    const isDev = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('192.168.');

    if (isDev) {
        console.log('%c✅ GameState v5.0 loaded (Audit-Fixed)', 'color: #4CAF50; font-weight: bold; font-size: 14px');
    }

})(window);