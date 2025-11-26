/**
 * No-Cap GameState - Central State Management
 * Version 6.0 - Production Ready (Deep Copy Fix)
 *
 * ✅ P0 FIX: getState() returns deep copy (no mutation possible)
 * ✅ P1 FIX: Debounced saves with lock mechanism
 * ✅ P1 FIX: Proper cleanup on page unload
 * ✅ P0 FIX: All string values sanitized on load/save
 */

(function(window) {
    'use strict';

    class GameState {
        constructor() {
            // Storage configuration
            this.STORAGE_KEY = 'nocap_game_state';
            this.VERSION = 6.0;
            this.MAX_AGE_HOURS = 24;

            // Debounce & locking
            this._saveTimer = null;
            this._saveDelay = 300; // 300ms debounce
            this._isLoading = false;
            this._isSaving = false;
            this._isDirty = false;
            this._lastModified = Date.now();

            // State properties
            this.deviceMode = null;           // 'single' | 'multi'
            this.selectedCategories = [];     // ['fsk0', 'fsk16', 'fsk18', 'special']
            this.difficulty = null;           // 'easy' | 'medium' | 'hard'
            this.alcoholMode = true;          // true | false
            this.questionCount = 10;          // Number of questions
            this.playerName = '';             // Current player name
            this.gameId = null;               // 6-digit game code
            this.playerId = null;             // Unique player ID
            this.isHost = false;              // Is this user the host?
            this.isGuest = false;             // Is this user a guest?
            this.gamePhase = 'lobby';         // 'lobby' | 'playing' | 'results'
            this.timestamp = Date.now();      // When state was created

            // Auto-load on instantiation
            this.load();
        }

        // ===========================
        // P0 FIX: DEEP COPY GETTER
        // ===========================

        /**
         * ✅ P0 FIX: Return deep copy of state to prevent external mutation
         */
        getState() {
            // Return a DEEP COPY, not a reference
            return {
                deviceMode: this.deviceMode,
                selectedCategories: [...this.selectedCategories], // Array copy
                difficulty: this.difficulty,
                alcoholMode: this.alcoholMode,
                questionCount: this.questionCount,
                playerName: this.playerName,
                gameId: this.gameId,
                playerId: this.playerId,
                isHost: this.isHost,
                isGuest: this.isGuest,
                gamePhase: this.gamePhase,
                timestamp: this.timestamp,
                version: this.VERSION
            };
        }

        /**
         * Get specific state property safely
         */
        get(key) {
            if (this.hasOwnProperty(key)) {
                // Return copy for arrays
                if (Array.isArray(this[key])) {
                    return [...this[key]];
                }
                // Return copy for objects
                if (this[key] && typeof this[key] === 'object') {
                    return { ...this[key] };
                }
                // Return primitive value
                return this[key];
            }
            return undefined;
        }

        // ===========================
        // LOAD STATE
        // ===========================

        load() {
            // Prevent concurrent loads
            if (this._isLoading) {
                this.log('⚠️ Load already in progress', 'warning');
                return false;
            }

            this._isLoading = true;

            try {
                // Migrate old keys first
                this.migrateOldKeys();

                const saved = localStorage.getItem(this.STORAGE_KEY);
                if (!saved) {
                    this.log('ℹ️ No saved state found');
                    this._isLoading = false;
                    return false;
                }

                const state = JSON.parse(saved);

                // Validate state structure
                if (!this.validateStateStructure(state)) {
                    this.log('⚠️ Invalid state structure, cleared', 'warning');
                    this.clearStorage();
                    this._isLoading = false;
                    return false;
                }

                // Check if state is expired (max 24h)
                if (this.isStateExpired(state)) {
                    this.log('⚠️ Saved state too old, cleared', 'warning');
                    this.clearStorage();
                    this._isLoading = false;
                    return false;
                }

                // Sanitize all values on load
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

        // ===========================
        // VALIDATION
        // ===========================

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

        isStateExpired(state) {
            if (!state.timestamp || typeof state.timestamp !== 'number') {
                return true;
            }

            const ageHours = (Date.now() - state.timestamp) / (1000 * 60 * 60);
            return ageHours > this.MAX_AGE_HOURS;
        }

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

        // ===========================
        // SANITIZATION HELPERS
        // ===========================

        sanitizeString(value) {
            if (!value || typeof value !== 'string') {
                return '';
            }

            // Use NocapUtils if available
            if (typeof window.NocapUtils !== 'undefined' && window.NocapUtils.sanitizeInput) {
                return window.NocapUtils.sanitizeInput(value);
            }

            // Fallback: Remove dangerous characters
            return value
                .replace(/[<>&"'`]/g, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+=/gi, '')
                .trim()
                .substring(0, 200); // Max length
        }

        sanitizeValue(value, allowedValues, defaultValue = null) {
            if (!value || typeof value !== 'string') {
                return defaultValue;
            }

            const sanitized = value.toLowerCase().trim();
            return allowedValues.includes(sanitized) ? sanitized : defaultValue;
        }

        sanitizeNumber(value, min, max, defaultValue) {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < min || num > max) {
                return defaultValue;
            }
            return num;
        }

        sanitizeCategories(categories) {
            if (!Array.isArray(categories)) {
                return [];
            }

            const allowedCategories = ['fsk0', 'fsk16', 'fsk18', 'special'];
            return categories
                .filter(cat => typeof cat === 'string')
                .map(cat => cat.toLowerCase().trim())
                .filter(cat => allowedCategories.includes(cat))
                .slice(0, 4); // Max 4 categories
        }

        sanitizeGameId(gameId) {
            if (!gameId || typeof gameId !== 'string') {
                return null;
            }

            const cleaned = gameId.toUpperCase().replace(/[^A-Z0-9]/g, '');
            return cleaned.length === 6 ? cleaned : null;
        }

        // ===========================
        // SAVE STATE
        // ===========================

        save(immediate = false) {
            // Prevent concurrent saves
            if (this._isSaving && !immediate) {
                this._isDirty = true;
                return false;
            }

            // Debounce saves (unless immediate)
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

        _performSave() {
            // Skip if nothing changed
            if (!this._isDirty) {
                return true;
            }

            this._isSaving = true;

            try {
                // Validate before saving
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

                // Check state size
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

                // Handle QuotaExceededError
                if (error.name === 'QuotaExceededError') {
                    this.log('⚠️ Storage quota exceeded, clearing old data', 'warning');
                    this.clearOldData();

                    // Retry save
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

        // ===========================
        // STORAGE MANAGEMENT
        // ===========================

        clearOldData() {
            try {
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

        clearStorage() {
            try {
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

        // ===========================
        // MIGRATION
        // ===========================

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
                        JSON.parse(oldData); // Validate JSON

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

        // ===========================
        // VALIDATION HELPERS
        // ===========================

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

        isValidForSingleDevice() {
            return (
                this.deviceMode === 'single' &&
                Array.isArray(this.selectedCategories) &&
                this.selectedCategories.length > 0 &&
                this.difficulty !== null
            );
        }

        // ===========================
        // PLAYER & GAME MANAGEMENT
        // ===========================

        generatePlayerId(isHost = false) {
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 8);
            const extraRandom = Math.random().toString(36).substring(2, 6);

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

        isPremiumUser() {
            // ⚠️ CLIENT-SIDE ONLY - must be validated server-side
            try {
                if (window.FirebaseService && typeof window.FirebaseService.isPremiumUser === 'function') {
                    return window.FirebaseService.isPremiumUser();
                }

                return false;
            } catch (error) {
                this.log(`⚠️ Premium check failed: ${error.message}`, 'warning');
                return false;
            }
        }

        canAccessFSK(level) {
            // ⚠️ CLIENT-SIDE ONLY - must be validated server-side
            try {
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

        // ===========================
        // SETTERS WITH AUTO-SAVE
        // ===========================

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

        // ===========================
        // DEBUG & LOGGING
        // ===========================

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

        log(message, type = 'info') {
            const isDev = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('192.168.');

            if (!isDev && type !== 'error') {
                return; // Only errors in production
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

        // ===========================
        // CLEANUP
        // ===========================

        cleanup() {
            clearTimeout(this._saveTimer);

            // Perform final save if dirty
            if (this._isDirty) {
                this._performSave();
            }

            this.log('✅ Cleanup completed');
        }
    }

    // ===========================
    // EXPORT & SETUP
    // ===========================

    window.GameState = GameState;

    // Install cleanup handler
    window.addEventListener('beforeunload', () => {
        if (window.gameState && typeof window.gameState.cleanup === 'function') {
            window.gameState.cleanup();
        }
    });

    // Development mode logging
    const isDev = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('192.168.');

    if (isDev) {
        console.log('%c✅ GameState v6.0 loaded (Deep Copy Fix)', 'color: #4CAF50; font-weight: bold; font-size: 14px');
    }

})(window);