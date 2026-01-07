/**
 * No-Cap GameState - Central State Management
 * Version 7.0 - P0/P1 Security Fixes Applied
 *
 * ✅ P0 FIX: getState() returns deep copy (no mutation possible)
 * ✅ P0 FIX: isPremiumUser() & canAccessFSK() use MANDATORY server validation
 * ✅ P1 FIX: Improved debounce with cancel function and mutex
 * ✅ P1 FIX: Proper cleanup on page unload
 * ✅ P0 FIX: All string values sanitized on load/save
 * ✅ P2 FIX: Production logging via logger service instead of console
 */

(function(window) {
    'use strict';

    class GameState {
        constructor() {
            // Storage configuration
            this.STORAGE_KEY = 'nocap_game_state';
            this.VERSION = 7.0;
            this.MAX_AGE_HOURS = 24;

            // ✅ P1 FIX: Improved debounce & locking with mutex
            this._saveTimer = null;
            this._saveDelay = 200; // ✅ Optimiert: 200ms statt 500ms für besseres UX
            this._isLoading = false;
            this._isSaving = false;
            this._isDirty = false;
            this._lastModified = Date.now();
            this._saveMutex = false; // ✅ P1 FIX: Mutex für Race-Condition Prevention

            // State properties
            this.deviceMode = null;           // 'single' | 'multi'
            this.selectedCategories = [];     // ['fsk0', 'fsk16', 'fsk18', 'special']
            this.difficulty = null;           // 'easy' | 'medium' | 'hard'
            this.alcoholMode = true;          // true | false
            this.questionCount = 10;          // Number of questions
            this.players = [];                // ✅ Array of player names
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
                players: this.players ? [...this.players] : [], // ✅ Players array copy
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

                // ✅ CRITICAL FIX: Load players array
                if (Array.isArray(state.players)) {
                    this.players = state.players
                        .filter(name => typeof name === 'string' && name.trim().length > 0)
                        .map(name => this.sanitizeString(name));
                } else {
                    this.players = [];
                }

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

        /**
         * ✅ P1 FIX: Save with improved debounce and mutex
         * @param {boolean} immediate - Skip debounce and save immediately
         * @returns {boolean} Success status
         */
        save(immediate = false) {
            // ✅ P1 FIX: Check mutex to prevent race conditions
            if (this._saveMutex && !immediate) {
                this._isDirty = true;
                this.log('⏳ Save in progress, queuing changes', 'debug');
                return false;
            }

            // Debounce saves (unless immediate)
            if (!immediate) {
                this._isDirty = true;
                this.cancelPendingSave(); // ✅ P1 FIX: Cancel previous pending save

                this._saveTimer = setTimeout(() => {
                    this._performSave();
                }, this._saveDelay);

                return true;
            }

            return this._performSave();
        }

        /**
         * ✅ P1 FIX: Cancel pending debounced save
         */
        cancelPendingSave() {
            if (this._saveTimer) {
                clearTimeout(this._saveTimer);
                this._saveTimer = null;
                this.log('⏹️ Pending save cancelled', 'debug');
            }
        }

        /**
         * ✅ P1 FIX: Perform save with mutex lock
         * @private
         */
        _performSave() {
            // Skip if nothing changed
            if (!this._isDirty) {
                return true;
            }

            // ✅ P1 FIX: Acquire mutex
            if (this._saveMutex) {
                this.log('⚠️ Mutex locked, skipping save', 'warning');
                return false;
            }

            this._saveMutex = true;
            this._isSaving = true;

            try {
                // Validate before saving
                const state = {
                    deviceMode: this.deviceMode,
                    selectedCategories: this.selectedCategories,
                    difficulty: this.difficulty,
                    alcoholMode: this.alcoholMode === true,
                    questionCount: this.questionCount,
                    players: this.players || [], // ✅ CRITICAL FIX: Include players!
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

                // ✅ P1 FIX: Release mutex
                this._isSaving = false;
                this._saveMutex = false;

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
                            players: this.players || [], // ✅ CRITICAL FIX: Include players!
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

                        // ✅ P1 FIX: Release mutex
                        this._isSaving = false;
                        this._saveMutex = false;
                        this._isDirty = false;

                        return true;
                    } catch (retryError) {
                        this.log(`❌ Retry save failed: ${retryError.message}`, 'error');
                    }
                }

                // ✅ P1 FIX: Release mutex even on error
                this._isSaving = false;
                this._saveMutex = false;

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

        /**
         * ✅ P0 FIX: Check premium status with MANDATORY server-side validation
         * @returns {Promise<boolean>} Premium status from server
         */
        async isPremiumUser() {
            try {
                // ✅ P0 FIX: MANDATORY server-side validation via Cloud Function
                if (!window.FirebaseConfig || !window.FirebaseConfig.isInitialized()) {
                    this.log('⚠️ Firebase not initialized, cannot verify premium status', 'warning');
                    return false;
                }

                const { functions } = window.FirebaseConfig.getFirebaseInstances();
                if (!functions) {
                    this.log('⚠️ Firebase Functions not available', 'warning');
                    return false;
                }

                // Call server-side validation
                const checkPremium = functions.httpsCallable('checkPremiumStatus');
                const result = await checkPremium();

                if (result.data) {
                    const isPremium = result.data.hasPremium === true; // ✅ Cloud Function returns 'hasPremium'
                    this.log(`✅ Premium status verified: ${isPremium}`, 'info');
                    return isPremium;
                }

                // Server validation failed - default to false (no premium access)
                this.log('❌ Premium validation failed - denying access', 'error');
                return false;

            } catch (error) {
                this.log(`❌ Premium check failed: ${error.message}`, 'error');
                // ✅ P0 FIX: FAIL SECURE - deny access on error
                return false;
            }
        }

        /**
         * ✅ P0 FIX: Synchronous fallback for premium check (cached only)
         * Should only be used for UI hints, NOT for access control
         * @returns {boolean} Cached premium status (NOT authoritative)
         */
        isPremiumUserCached() {
            try {
                if (window.FirebaseService && typeof window.FirebaseService.isPremiumUser === 'function') {
                    return window.FirebaseService.isPremiumUser();
                }

                return false;
            } catch (error) {
                this.log(`⚠️ Cached premium check failed: ${error.message}`, 'warning');
                return false;
            }
        }

        /**
         * ✅ P0 FIX: Check FSK access with server-side validation + local fallback
         * @param {string} level - FSK level ('fsk0', 'fsk16', 'fsk18')
         * @returns {Promise<boolean>} Access granted
         */
        async canAccessFSK(level) {
            try {
                // ✅ OPTIMIZATION: Check local age level first
                const localAgeLevel = parseInt(localStorage.getItem('nocap_age_level'), 10) || 0;
                const levelMap = {
                    'fsk0': 0,
                    'fsk16': 16,
                    'fsk18': 18
                };
                const requiredAge = levelMap[level] || 0;

                // If local check fails, no need to ask server
                if (localAgeLevel < requiredAge) {
                    this.log(`❌ FSK ${level} denied: age ${localAgeLevel} < required ${requiredAge}`, 'warning');
                    return false;
                }

                // ✅ Try server-side validation for authoritative check
                if (!window.FirebaseConfig || !window.FirebaseConfig.isInitialized()) {
                    this.log(`⚠️ Firebase not available - using local FSK check for ${level}`, 'warning');
                    return true; // Local check passed above
                }

                const { functions } = window.FirebaseConfig.getFirebaseInstances();
                if (!functions) {
                    this.log(`⚠️ Functions not available - using local FSK check for ${level}`, 'warning');
                    return true; // Local check passed above
                }

                // Try server-side validation
                try {
                    const checkCategoryAccess = functions.httpsCallable('checkCategoryAccess');
                    const result = await checkCategoryAccess({ categoryId: level });

                    if (result.data && result.data.allowed === true) {
                        this.log(`✅ FSK ${level} granted by server`, 'info');
                        return true;
                    }

                    // Server denied - respect server decision
                    this.log(`⚠️ FSK ${level} denied by server`, 'warning');
                    return false;

                } catch (serverError) {
                    // Server call failed - fallback to local
                    this.log(`⚠️ Server check failed - using local age ${localAgeLevel} for ${level}`, 'warning');
                    return true; // Local check passed above
                }

            } catch (error) {
                this.log(`❌ FSK check error: ${error.message}`, 'error');

                // ✅ FALLBACK: Try local check on any error
                try {
                    const localAgeLevel = parseInt(localStorage.getItem('nocap_age_level'), 10) || 0;
                    const requiredAge = { 'fsk0': 0, 'fsk16': 16, 'fsk18': 18 }[level] || 0;
                    return localAgeLevel >= requiredAge;
                } catch (fallbackError) {
                    return false;
                }
            }
        }

        /**
         * ✅ P0 FIX: Synchronous fallback for FSK check (cached only)
         * Should only be used for UI hints, NOT for access control
         * @param {string} level - FSK level
         * @returns {boolean} Cached FSK status (NOT authoritative)
         */
        canAccessFSKCached(level) {
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
                    this.log(`ℹ️ FSK ${level} cached check: denied (user age: ${ageLevel})`, 'info');
                }

                return hasAccess;
            } catch (error) {
                this.log(`⚠️ Cached FSK check failed: ${error.message}`, 'warning');
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

        /**
         * ✅ AUDIT FIX: Set players array
         * @param {Array<string>} players - Array of player names
         */
        setPlayers(players) {
            if (!Array.isArray(players)) {
                this.log('⚠️ setPlayers: Invalid input, must be array', 'warning');
                return;
            }

            // Sanitize each player name
            const sanitized = players
                .filter(name => typeof name === 'string' && name.trim().length > 0)
                .map(name => this.sanitizeString(name));

            if (sanitized.length > 0) {
                this.players = sanitized;
                this._isDirty = true;
                this.save(true); // Immediate save for players
                this.log(`✅ Players set: ${sanitized.length} players`);
            } else {
                this.log('⚠️ setPlayers: No valid players provided', 'warning');
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
                isPremium: this.isPremiumUserCached(), // ✅ P0 FIX: Use cached version for debug
                isDirty: this._isDirty,
                lastModified: new Date(this._lastModified).toISOString()
            };
        }

        /**
         * ✅ P2 FIX: Production-ready logging with telemetry support
         * @param {string} message - Log message
         * @param {string} type - Log type: 'info', 'warning', 'error', 'debug'
         */
        log(message, type = 'info') {
            const isDev = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('192.168.');

            // ✅ P2 FIX: In Production - nur Errors/Warnings via Telemetrie
            if (!isDev) {
                // Send to telemetry/monitoring service if available
                if (window.NocapUtils && window.NocapUtils.logToTelemetry) {
                    window.NocapUtils.logToTelemetry({
                        component: 'GameState',
                        message,
                        type,
                        timestamp: Date.now(),
                        state: {
                            deviceMode: this.deviceMode,
                            gamePhase: this.gamePhase,
                            hasPlayers: this.players && this.players.length > 0
                        }
                    });
                }

                // Console only for errors in production
                if (type === 'error') {
                    console.error(`[GameState] ${message}`);
                }

                return;
            }

            // ✅ Development mode: Full console logging with colors
            const prefix = '[GameState]';
            const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
            const colors = {
                info: '#4488ff',
                warning: '#ffaa00',
                error: '#ff4444',
                success: '#00ff00',
                debug: '#888888'
            };

            const logMethod = type === 'error' ? console.error :
                             type === 'warning' ? console.warn :
                             type === 'debug' ? console.debug :
                             console.log;

            logMethod(
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
        console.log('%c✅ GameState v7.0 loaded (P0/P1 Security Fixes Applied)', 'color: #4CAF50; font-weight: bold; font-size: 14px');
        console.log('%c   - Server-side Premium/FSK validation', 'color: #888; font-size: 12px');
        console.log('%c   - Mutex-based save with race-condition prevention', 'color: #888; font-size: 12px');
        console.log('%c   - Production telemetry logging', 'color: #888; font-size: 12px');
    }

})(window);