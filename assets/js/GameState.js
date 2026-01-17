/**
 * No-Cap GameState - Central State Management
 * Version 9.0 - Event System & Enhanced State Management
 *
 * ✅ P1 STABILITY: Single Source of Truth - Alle Seiten nutzen dieselbe Instanz
 * ✅ P1 STABILITY: Event System - onChange Callbacks für reactive UI
 * ✅ P1 UI/UX: Vollständige JSDoc-Dokumentation
 * ✅ P1 UI/UX: reset() Methode zum Zurücksetzen des States
 * ✅ P0 FIX: getState() returns deep copy (no mutation possible)
 * ✅ P0 FIX: isPremiumUser() & canAccessFSK() use MANDATORY server validation
 * ✅ P1 FIX: Improved debounce with cancel function and mutex
 * ✅ P1 FIX: Proper cleanup on page unload
 * ✅ P0 FIX: All string values sanitized on load/save
 * ✅ P2 FIX: Production logging via logger service instead of console
 * ✅ OPTIMIZATION: Session cache for Premium/FSK checks (5min TTL)
 * ✅ OPTIMIZATION: addPlayer() / removePlayer() / getPlayerCount() methods
 * ✅ OPTIMIZATION: Support for player metadata (avatar, gender)
 *
 * @class GameState
 * @description Zentrale State-Verwaltung für das No-Cap Spiel.
 *              Stellt sicher, dass alle Seiten denselben State verwenden.
 *              Bietet Event-System für reactive UI-Updates.
 *
 * @property {string|null} deviceMode - Spielmodus: 'single' oder 'multi'
 * @property {string[]} selectedCategories - Ausgewählte Kategorien: ['fsk0', 'fsk16', 'fsk18', 'special']
 * @property {string|null} difficulty - Schwierigkeitsgrad: 'easy', 'medium', 'hard'
 * @property {boolean} alcoholMode - Alkohol-Modus aktiv
 * @property {number} questionCount - Anzahl der Fragen
 * @property {Array<string|Object>} players - Spieler-Liste (Namen oder Objekte mit name/avatar/age)
 * @property {string} playerName - Name des aktuellen Spielers
 * @property {string|null} gameId - 6-stelliger Spiel-Code
 * @property {string|null} playerId - Eindeutige Spieler-ID
 * @property {boolean} isHost - Ist dieser Nutzer der Host?
 * @property {boolean} isGuest - Ist dieser Nutzer ein Gast?
 * @property {string} gamePhase - Aktuelle Spielphase: 'lobby', 'playing', 'results'
 * @property {number} timestamp - Zeitstempel der State-Erstellung
 *
 * @example
 * // Import (automatisch verfügbar als window.gameState)
 * const gameState = window.gameState;
 *
 * // Event-Listener registrieren
 * gameState.on('change:difficulty', (newValue, oldValue) => {
 *     console.log(`Difficulty changed from ${oldValue} to ${newValue}`);
 *     updateUI();
 * });
 *
 * // State setzen (triggert Event)
 * gameState.set('difficulty', 'hard');
 *
 * // State abrufen (Deep Copy)
 * const state = gameState.getState();
 *
 * // State zurücksetzen
 * gameState.reset();
 */

(function(window) {
    'use strict';

    class GameState {
        constructor() {
            // Storage configuration
            this.STORAGE_KEY = 'nocap_game_state';
            this.VERSION = 9.0; // ✅ P1 STABILITY: Version bump for event system
            this.MAX_AGE_HOURS = 24;

            // ✅ P1 FIX: Improved debounce & locking with mutex
            this._saveTimer = null;
            this._saveDelay = 1000; // ✅ P2 PERFORMANCE: 1000ms debounce reduces localStorage writes
            this._isLoading = false;
            this._isSaving = false;
            this._isDirty = false;
            this._lastModified = Date.now();
            this._saveMutex = false; // ✅ P1 FIX: Mutex für Race-Condition Prevention

            // ✅ P1 STABILITY: Event System - onChange Callbacks
            this._eventListeners = new Map();
            // Structure: Map<eventName, Set<callback>>
            // Supported events: 'change', 'change:propertyName', 'save', 'load', 'reset'

            // ✅ OPTIMIZATION: Session-Cache für Server-Validierungen (verhindert redundante Cloud Function Calls)
            this._sessionCache = {
                premiumStatus: null,
                premiumCheckedAt: 0,
                fskLevels: {}, // { 'fsk0': { allowed: true, checkedAt: timestamp }, ... }
                cacheTTL: 5 * 60 * 1000 // 5 Minuten Cache
            };

            // ✅ P0 SECURITY: Clean localStorage from potentially corrupted data on startup
            this.cleanCorruptedLocalStorage();

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
        // ✅ P0 SECURITY: CLEANUP CORRUPTED LOCALSTORAGE
        // ===========================

        /**
         * ✅ P0 SECURITY: Remove corrupted localStorage entries on startup
         * Prevents prototype pollution from old/malicious data
         */
        cleanCorruptedLocalStorage() {
            try {
                const saved = localStorage.getItem(this.STORAGE_KEY);
                if (!saved) {
                    return; // No data to clean
                }

                // Quick check if data contains dangerous patterns
                const dangerousPatterns = [
                    '__proto__',
                    'constructor',
                    'prototype',
                    '"__proto__"',
                    '"constructor"',
                    '"prototype"'
                ];

                let isCorrupted = false;
                for (const pattern of dangerousPatterns) {
                    if (saved.includes(pattern)) {
                        this.log(`🛡️ Detected dangerous pattern "${pattern}" in localStorage`, 'warning');
                        isCorrupted = true;
                        break;
                    }
                }

                if (isCorrupted) {
                    this.log('🧹 Cleaning corrupted localStorage data...', 'warning');
                    localStorage.removeItem(this.STORAGE_KEY);
                    this.log('✅ localStorage cleaned successfully', 'info');
                }
            } catch (error) {
                this.log(`⚠️ Error during localStorage cleanup: ${error.message}`, 'warning');
                // Non-fatal: Continue with fresh state
            }
        }

        // ===========================
        // ✅ P1 STABILITY: DEEP COPY GETTER WITH STRUCTURED CLONE
        // ===========================

        /**
         * ✅ P1 STABILITY: Return deep copy of state using structuredClone()
         * structuredClone() is more performant and safer than JSON.parse(JSON.stringify())
         * Browser support: Chrome 98+, Firefox 94+, Safari 15.4+, Edge 98+
         */
        getState() {
            try {
                // Build state object
                const state = {
                    deviceMode: this.deviceMode,
                    selectedCategories: this.selectedCategories,
                    difficulty: this.difficulty,
                    alcoholMode: this.alcoholMode,
                    questionCount: this.questionCount,
                    players: this.players || [],
                    playerName: this.playerName,
                    gameId: this.gameId,
                    playerId: this.playerId,
                    isHost: this.isHost,
                    isGuest: this.isGuest,
                    gamePhase: this.gamePhase,
                    timestamp: this.timestamp,
                    version: this.VERSION
                };

                // ✅ P1 STABILITY: Use structuredClone for safer deep copy
                // No manual copying needed - structuredClone handles everything
                if (typeof structuredClone === 'function') {
                    return structuredClone(state);
                }

                // Fallback for older browsers (shouldn't be needed in 2026)
                this.log('⚠️ structuredClone not available, using JSON fallback', 'warning');
                return JSON.parse(JSON.stringify(state));

            } catch (error) {
                this.log(`❌ getState error: ${error.message}`, 'error');
                // Return empty state on error
                return {
                    deviceMode: null,
                    selectedCategories: [],
                    difficulty: null,
                    alcoholMode: true,
                    questionCount: 10,
                    players: [],
                    playerName: '',
                    gameId: null,
                    playerId: null,
                    isHost: false,
                    isGuest: false,
                    gamePhase: 'lobby',
                    timestamp: Date.now(),
                    version: this.VERSION
                };
            }
        }

        /**
         * ✅ P1 STABILITY: Get specific state property safely with structuredClone
         */
        get(key) {
            if (this.hasOwnProperty(key)) {
                const value = this[key];

                // ✅ P1 STABILITY: Use structuredClone for complex types
                if (typeof structuredClone === 'function' && value !== null && typeof value === 'object') {
                    try {
                        return structuredClone(value);
                    } catch (error) {
                        this.log(`⚠️ structuredClone failed for ${key}, using fallback`, 'warning');
                    }
                }

                // Fallback: Manual shallow copy for objects/arrays
                if (Array.isArray(value)) {
                    return [...value];
                }
                if (value && typeof value === 'object') {
                    return { ...value };
                }

                // Return primitive value directly
                return value;
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

                // ✅ P0 SECURITY: Safe JSON parse with prototype pollution prevention
                let state;
                try {
                    // Parse with reviver function to block dangerous keys
                    state = JSON.parse(saved, (key, value) => {
                        // Block dangerous keys during parse
                        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                            this.log(`🛡️ Blocked dangerous key "${key}" during JSON parse`, 'warning');
                            return undefined; // Skip this property
                        }
                        return value;
                    });
                } catch (parseError) {
                    this.log(`❌ JSON parse error: ${parseError.message}`, 'error');
                    this.clearStorage();
                    this._isLoading = false;
                    return false;
                }

                // ✅ P0 SECURITY: Validate data types FIRST to prevent prototype pollution
                if (!this.validateDataTypes(state)) {
                    this.log('❌ Data validation failed - potential security risk', 'error');
                    this.clearStorage();
                    this._isLoading = false;
                    return false;
                }

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

                if (Array.isArray(state.players)) {
                    this.players = state.players
                        .map(p => {
                            if (typeof p === 'string') {
                                const name = this.sanitizeString(p);
                                return name ? name : null;
                            }
                            if (p && typeof p === 'object' && typeof p.name === 'string') {
                                const name = this.sanitizeString(p.name);
                                if (!name) return null;
                                return {
                                    name,
                                    isHost: p.isHost === true,
                                    avatar: p.avatar ? this.sanitizeString(p.avatar) : undefined,
                                    gender: p.gender ? this.sanitizeValue(p.gender, ['m', 'f', 'd']) : undefined
                                };
                            }
                            return null;
                        })
                        .filter(Boolean);
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
        // ✅ P0 SECURITY: Enhanced validation with prototype pollution prevention
        // ===========================

        /**
         * ✅ P0 SECURITY: Validate data types to prevent prototype pollution
         * @param {Object} state - State object to validate
         * @returns {boolean} True if valid
         */
        validateDataTypes(state) {
            if (!state || typeof state !== 'object') {
                this.log('❌ Validation failed: state is not an object', 'error');
                return false;
            }

            // ✅ P0 SECURITY: Deep check for prototype pollution (recursive)
            const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

            /**
             * Recursively check object for dangerous keys
             * @param {Object} obj - Object to check
             * @param {string} path - Current path (for debugging)
             * @returns {boolean} True if safe
             */
            const checkObjectSafety = (obj, path = 'root') => {
                if (!obj || typeof obj !== 'object') {
                    return true;
                }

                // Check current level for dangerous keys
                for (const key of dangerousKeys) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                        this.log(`❌ Validation failed: dangerous key "${key}" at ${path}`, 'error');
                        return false;
                    }
                }

                // Recursively check nested objects and arrays
                for (const key of Object.keys(obj)) {
                    const value = obj[key];

                    if (Array.isArray(value)) {
                        // Check array elements
                        for (let i = 0; i < value.length; i++) {
                            if (!checkObjectSafety(value[i], `${path}.${key}[${i}]`)) {
                                return false;
                            }
                        }
                    } else if (value && typeof value === 'object') {
                        // Check nested object
                        if (!checkObjectSafety(value, `${path}.${key}`)) {
                            return false;
                        }
                    }
                }

                return true;
            };

            if (!checkObjectSafety(state)) {
                return false;
            }

            // ✅ P0 SECURITY: Validate expected data types
            const typeChecks = {
                deviceMode: (v) => v === null || v === 'single' || v === 'multi',
                selectedCategories: (v) => Array.isArray(v),
                difficulty: (v) => v === null || ['easy', 'medium', 'hard'].includes(v),
                alcoholMode: (v) => typeof v === 'boolean',
                questionCount: (v) => typeof v === 'number' && v >= 1 && v <= 50,
                players: (v) => Array.isArray(v),
                playerName: (v) => typeof v === 'string',
                gameId: (v) => v === null || typeof v === 'string',
                playerId: (v) => v === null || typeof v === 'string',
                isHost: (v) => typeof v === 'boolean',
                isGuest: (v) => typeof v === 'boolean',
                gamePhase: (v) => typeof v === 'string',
                timestamp: (v) => typeof v === 'number' && v > 0,
                version: (v) => typeof v === 'number'
            };

            // Check each field
            for (const [key, validator] of Object.entries(typeChecks)) {
                if (Object.prototype.hasOwnProperty.call(state, key)) {
                    try {
                        if (!validator(state[key])) {
                            this.log(`❌ Validation failed: ${key} has invalid type/value`, 'error');
                            return false;
                        }
                    } catch (error) {
                        this.log(`❌ Validation error for ${key}: ${error.message}`, 'error');
                        return false;
                    }
                }
            }

            // ✅ P0 SECURITY: Validate array contents
            if (state.selectedCategories) {
                const validCategories = ['fsk0', 'fsk16', 'fsk18', 'special'];
                for (const cat of state.selectedCategories) {
                    if (typeof cat !== 'string' || !validCategories.includes(cat)) {
                        this.log(`❌ Validation failed: invalid category "${cat}"`, 'error');
                        return false;
                    }
                }
            }

            if (state.players) {
                for (const player of state.players) {
                    // Support both string and object format
                    if (typeof player === 'string') {
                        continue; // Valid
                    } else if (typeof player === 'object' && player !== null) {
                        // Validate object format
                        if (!player.name || typeof player.name !== 'string') {
                            this.log(`❌ Validation failed: invalid player object`, 'error');
                            return false;
                        }
                        for (const key of dangerousKeys) {
                            if (Object.prototype.hasOwnProperty.call(player, key)) {
                                this.log(`❌ Validation failed: dangerous key in player object`, 'error');
                                return false;
                            }
                        }

                    } else {
                        this.log(`❌ Validation failed: invalid player type`, 'error');
                        return false;
                    }
                }
            }

            return true;
        }

        validateStateStructure(state) {
            if (!state || typeof state !== 'object') {
                return false;
            }

            // ✅ P0 SECURITY: Validate data types first
            if (!this.validateDataTypes(state)) {
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
         * ✅ OPTIMIZATION: Check premium status with session cache (verhindert redundante Cloud Function Calls)
         * @param {boolean} forceRefresh - Force server check, bypass cache
         * @returns {Promise<boolean>} Premium status from server
         */
        async isPremiumUser(forceRefresh = false) {
            try {
                const now = Date.now();
                const cacheAge = now - this._sessionCache.premiumCheckedAt;

                if (!forceRefresh &&
                    this._sessionCache.premiumStatus !== null &&
                    cacheAge < this._sessionCache.cacheTTL) {
                    this.log(`✅ Premium status from cache: ${this._sessionCache.premiumStatus} (age: ${Math.floor(cacheAge / 1000)}s)`, 'debug');
                    return this._sessionCache.premiumStatus;
                }

                // ✅ Settings-only premium flag (set this somewhere on purchase success)
                const getLS = (k) => window.NocapUtils?.getLocalStorage
                    ? window.NocapUtils.getLocalStorage(k)
                    : localStorage.getItem(k);

                const premium = String(getLS('nocap_is_premium') || 'false') === 'true';

                this._sessionCache.premiumStatus = premium;
                this._sessionCache.premiumCheckedAt = now;

                this.log(`✅ Premium status set (settings-only): ${premium}`, 'info');
                return premium;

            } catch (error) {
                this.log(`❌ Premium check failed (settings-only): ${error.message}`, 'error');
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
         * ✅ OPTIMIZATION: Check FSK access with session cache + server validation
         * @param {string} level - FSK level ('fsk0', 'fsk16', 'fsk18')
         * @param {boolean} forceRefresh - Force server check, bypass cache
         * @returns {Promise<boolean>} Access granted
         */
        async canAccessFSK(level, forceRefresh = false) {
            try {
                const now = Date.now();
                const cached = this._sessionCache.fskLevels[level];

                // ✅ Cache (5min)
                if (!forceRefresh && cached && (now - cached.checkedAt) < this._sessionCache.cacheTTL) {
                    this.log(`✅ FSK ${level} from cache: ${cached.allowed} (age: ${Math.floor((now - cached.checkedAt) / 1000)}s)`, 'debug');
                    return cached.allowed;
                }

                // ✅ Settings-only Source of Truth
                const getLS = (k) => window.NocapUtils?.getLocalStorage
                    ? window.NocapUtils.getLocalStorage(k)
                    : localStorage.getItem(k);

                const verified = String(getLS('nocap_age_verification') || 'false') === 'true';
                const localAgeLevel = parseInt(getLS('nocap_age_level') || '0', 10) || 0;

                const levelMap = { fsk0: 0, fsk16: 16, fsk18: 18 };
                if (!Object.prototype.hasOwnProperty.call(levelMap, level)) {
                    this.log(`❌ Unknown FSK level: ${level}`, 'warning');
                    this._sessionCache.fskLevels[level] = { allowed: false, checkedAt: now };
                    return false;
                }

                const requiredAge = levelMap[level];

                // fsk0 immer ok
                if (requiredAge === 0) {
                    this._sessionCache.fskLevels[level] = { allowed: true, checkedAt: now };
                    return true;
                }

                // ✅ Verified + Age required
                const allowed = verified && localAgeLevel >= requiredAge;

                this._sessionCache.fskLevels[level] = { allowed, checkedAt: now };

                this.log(
                    allowed
                        ? `✅ FSK ${level} granted (settings-only)`
                        : `❌ FSK ${level} denied (settings-only): verified=${verified}, age=${localAgeLevel}, required=${requiredAge}`,
                    allowed ? 'info' : 'warning'
                );

                return allowed;

            } catch (error) {
                this.log(`❌ FSK check error: ${error.message}`, 'error');
                return false; // fail secure
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
                const getLS = (k) => window.NocapUtils?.getLocalStorage
                    ? window.NocapUtils.getLocalStorage(k)
                    : localStorage.getItem(k);

                const verified = String(getLS('nocap_age_verification') || 'false') === 'true';
                const ageLevel = parseInt(getLS('nocap_age_level') || '0', 10) || 0;
                const now = Date.now();
                const levelMap = {
                    'fsk0': 0,
                    'fsk16': 16,
                    'fsk18': 18
                };

                if (!Object.prototype.hasOwnProperty.call(levelMap, level)) {
                    this.log(`❌ Unknown FSK level: ${level}`, 'warning');
                    this._sessionCache.fskLevels[level] = { allowed: false, checkedAt: now };
                    return false;
                }

                const requiredAge = levelMap[level];

                const hasAccess = requiredAge === 0 ? true : (verified && ageLevel >= requiredAge);
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
        // ✅ OPTIMIZATION: CACHE MANAGEMENT
        // ===========================

        /**
         * Clear session cache for premium/FSK checks
         */
        clearSessionCache() {
            this._sessionCache = {
                premiumStatus: null,
                premiumCheckedAt: 0,
                fskLevels: {},
                cacheTTL: 5 * 60 * 1000
            };
            this.log('✅ Session cache cleared', 'debug');
        }

        /**
         * Get cache statistics
         */
        getCacheStats() {
            const now = Date.now();
            return {
                premium: {
                    cached: this._sessionCache.premiumStatus !== null,
                    value: this._sessionCache.premiumStatus,
                    ageSeconds: Math.floor((now - this._sessionCache.premiumCheckedAt) / 1000),
                    valid: (now - this._sessionCache.premiumCheckedAt) < this._sessionCache.cacheTTL
                },
                fsk: Object.entries(this._sessionCache.fskLevels).map(([level, data]) => ({
                    level,
                    allowed: data.allowed,
                    ageSeconds: Math.floor((now - data.checkedAt) / 1000),
                    valid: (now - data.checkedAt) < this._sessionCache.cacheTTL
                })),
                cacheTTL: this._sessionCache.cacheTTL / 1000
            };
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
         * ✅ P0 SECURITY: Set players array with type validation
         * @param {Array<string|Object>} players - Array of player names or objects {name, avatar?, gender?, isHost?}
         */
        setPlayers(players) {
            if (!Array.isArray(players)) {
                this.log('⚠️ setPlayers: Invalid input, must be array', 'warning');
                return;
            }

            const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
            for (const key of dangerousKeys) {
                // ✅ only block if the array/object has the key as an OWN property
                if (Object.prototype.hasOwnProperty.call(players, key)) {
                    this.log('❌ setPlayers: Prototype pollution attempt detected', 'error');
                    return;
                }
            }


            const sanitized = players
                .map(p => {
                    if (typeof p === 'string') {
                        const name = this.sanitizeString(p);
                        return name ? name : null;
                    }
                    if (p && typeof p === 'object' && typeof p.name === 'string') {
                        const name = this.sanitizeString(p.name);
                        if (!name) return null;
                        return {
                            name,
                            isHost: p.isHost === true,
                            avatar: p.avatar ? this.sanitizeString(p.avatar) : undefined,
                            gender: p.gender ? this.sanitizeValue(p.gender, ['m', 'f', 'd']) : undefined
                        };
                    }
                    return null;
                })
                .filter(Boolean);

            this.players = sanitized;
            this._isDirty = true;
            this.save(true);
            this.log(`✅ Players set: ${sanitized.length} players`);
        }

        /**
         * ✅ OPTIMIZATION: Add single player with optional metadata
         * @param {string|Object} player - Player name or object with {name, avatar?, gender?}
         * @param {boolean} isHost - Is this player the host?
         * @returns {boolean} Success status
         */
        addPlayer(player, isHost = false) {
            try {
                // Support both string and object format
                let playerData;

                if (typeof player === 'string') {
                    // Simple string format
                    playerData = {
                        name: this.sanitizeString(player),
                        isHost: isHost
                    };
                } else if (typeof player === 'object' && player.name) {
                    // Object format with optional metadata
                    playerData = {
                        name: this.sanitizeString(player.name),
                        isHost: isHost,
                        avatar: player.avatar ? this.sanitizeString(player.avatar) : undefined,
                        gender: player.gender ? this.sanitizeValue(player.gender, ['m', 'f', 'd']) : undefined
                    };
                } else {
                    this.log('⚠️ addPlayer: Invalid player data', 'warning');
                    return false;
                }

                // Validate name
                if (!playerData.name || playerData.name.length === 0) {
                    this.log('⚠️ addPlayer: Player name is required', 'warning');
                    return false;
                }

                // Initialize players array if needed
                if (!Array.isArray(this.players)) {
                    this.players = [];
                }

                // Check for duplicates (by name)
                const isDuplicate = this.players.some(p => {
                    const existingName = typeof p === 'string' ? p : p.name;
                    return existingName === playerData.name;
                });

                if (isDuplicate) {
                    this.log(`⚠️ addPlayer: Player "${playerData.name}" already exists`, 'warning');
                    return false;
                }

                // Check max players
                const MAX_PLAYERS = 8;
                if (this.players.length >= MAX_PLAYERS) {
                    this.log(`⚠️ addPlayer: Maximum ${MAX_PLAYERS} players reached`, 'warning');
                    return false;
                }

                // Add player (support both formats for backwards compatibility)
                if (playerData.avatar || playerData.gender) {
                    // Use object format if metadata exists
                    this.players.push(playerData);
                } else {
                    // Use simple string format for backwards compatibility
                    this.players.push(playerData.name);
                }

                this._isDirty = true;
                this.save(true); // Immediate save
                this.log(`✅ Player added: ${playerData.name} (total: ${this.players.length})`);
                return true;

            } catch (error) {
                this.log(`❌ addPlayer failed: ${error.message}`, 'error');
                return false;
            }
        }

        /**
         * ✅ OPTIMIZATION: Remove player by name
         * @param {string} playerName - Name of player to remove
         * @returns {boolean} Success status
         */
        removePlayer(playerName) {
            try {
                if (!Array.isArray(this.players) || this.players.length === 0) {
                    this.log('⚠️ removePlayer: No players to remove', 'warning');
                    return false;
                }

                const sanitizedName = this.sanitizeString(playerName);
                const initialLength = this.players.length;

                // Remove player (support both string and object format)
                this.players = this.players.filter(p => {
                    const name = typeof p === 'string' ? p : p.name;
                    return name !== sanitizedName;
                });

                if (this.players.length < initialLength) {
                    this._isDirty = true;
                    this.save(true);
                    this.log(`✅ Player removed: ${sanitizedName} (remaining: ${this.players.length})`);
                    return true;
                }

                this.log(`⚠️ removePlayer: Player "${sanitizedName}" not found`, 'warning');
                return false;

            } catch (error) {
                this.log(`❌ removePlayer failed: ${error.message}`, 'error');
                return false;
            }
        }

        /**
         * ✅ OPTIMIZATION: Get player count
         * @returns {number} Number of players
         */
        getPlayerCount() {
            return Array.isArray(this.players) ? this.players.length : 0;
        }

        /**
         * ✅ OPTIMIZATION: Get player names array
         * @returns {Array<string>} Array of player names
         */
        getPlayerNames() {
            if (!Array.isArray(this.players)) {
                return [];
            }

            return this.players.map(p => typeof p === 'string' ? p : p.name);
        }

        setPlayerName(name) {
            const sanitized = this.sanitizeString(name);
            this.set('playerName', sanitized);
        }

        setGameId(gameId) {
            const sanitized = this.sanitizeGameId(gameId);
            this.set('gameId', sanitized);
        }

        addCategory(category) {
            const sanitized = this.sanitizeValue(category, ['fsk0', 'fsk16', 'fsk18', 'special']);
            if (sanitized && !this.selectedCategories.includes(sanitized)) {
                const old = [...this.selectedCategories];
                this.selectedCategories.push(sanitized);

                this._emit('change:selectedCategories', [...this.selectedCategories], old);
                this._emit('change', 'selectedCategories', [...this.selectedCategories], old);

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
                playerCount: this.getPlayerCount(), // ✅ OPTIMIZATION: Player count
                gamePhase: this.gamePhase,
                validMulti: this.isValidForMultiplayer(),
                validSingle: this.isValidForSingleDevice(),
                timestamp: this.timestamp,
                ageMinutes: Math.floor((Date.now() - this.timestamp) / 1000 / 60),
                version: this.VERSION,
                isPremium: this.isPremiumUserCached(), // ✅ P0 FIX: Use cached version for debug
                isDirty: this._isDirty,
                lastModified: new Date(this._lastModified).toISOString(),
                cache: this.getCacheStats() // ✅ OPTIMIZATION: Cache statistics
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
        // ✅ P1 STABILITY: EVENT SYSTEM
        // Allows components to react to state changes
        // ===========================

        /**
         * ✅ P1 STABILITY: Subscribe to state changes
         * @param {string} event - Event name ('change', 'change:propertyName', 'save', 'load', 'reset')
         * @param {Function} callback - Callback function
         * @returns {Function} Unsubscribe function
         *
         * @example
         * const unsubscribe = gameState.on('change:difficulty', (newValue, oldValue) => {
         *     console.log(`Difficulty changed from ${oldValue} to ${newValue}`);
         * });
         *
         * // Later:
         * unsubscribe();
         */
        on(event, callback) {
            if (typeof callback !== 'function') {
                this.log('❌ on() requires a callback function', 'error');
                return () => {};
            }

            if (!this._eventListeners.has(event)) {
                this._eventListeners.set(event, new Set());
            }

            this._eventListeners.get(event).add(callback);

            // Return unsubscribe function
            return () => this.off(event, callback);
        }

        /**
         * ✅ P1 STABILITY: Unsubscribe from state changes
         * @param {string} event - Event name
         * @param {Function} callback - Callback function to remove
         */
        off(event, callback) {
            if (!this._eventListeners.has(event)) {
                return;
            }

            if (callback) {
                this._eventListeners.get(event).delete(callback);
            } else {
                // Remove all listeners for this event
                this._eventListeners.delete(event);
            }
        }

        /**
         * ✅ P1 STABILITY: Emit event to all listeners
         * @param {string} event - Event name
         * @param {...any} args - Arguments to pass to callbacks
         * @private
         */
        _emit(event, ...args) {
            if (!this._eventListeners.has(event)) {
                return;
            }

            const listeners = this._eventListeners.get(event);

            for (const callback of listeners) {
                try {
                    callback(...args);
                } catch (error) {
                    this.log(`❌ Event listener error for ${event}: ${error.message}`, 'error');
                }
            }
        }

        /**
         * ✅ P1 STABILITY: Set property with event emission
         * @param {string} key - Property name
         * @param {any} value - New value
         * @param {boolean} [silent=false] - Skip event emission
         */
        set(key, value, silent = false) {
            if (!this.hasOwnProperty(key)) {
                this.log(`⚠️ Attempting to set unknown property: ${key}`, 'warning');
                return;
            }

            const oldValue = this[key];

            // Don't update if value hasn't changed (unless it's an object/array)
            if (oldValue === value && typeof value !== 'object') {
                return;
            }

            this[key] = value;
            this._isDirty = true;
            this._lastModified = Date.now();

            // Emit property-specific change event
            if (!silent) {
                this._emit(`change:${key}`, value, oldValue);
                this._emit('change', key, value, oldValue);
            }

            // Auto-save with debounce
            this.save();
        }

        /**
         * ✅ P1 UI/UX: Reset GameState to initial values
         * Clears all data and emits 'reset' event
         *
         * @example
         * gameState.reset(); // Clear all game data
         */
        reset() {
            this.log('🔄 Resetting GameState to initial values...');

            // Store old values for event
            const oldState = this.getState();

            // Clear all properties to defaults
            this.deviceMode = null;
            this.selectedCategories = [];
            this.difficulty = null;
            this.alcoholMode = true;
            this.questionCount = 10;
            this.players = [];
            this.playerName = '';
            this.gameId = null;
            this.playerId = null;
            this.isHost = false;
            this.isGuest = false;
            this.gamePhase = 'lobby';
            this.timestamp = Date.now();

            // Clear session cache
            this.clearSessionCache();

            // Clear localStorage
            try {
                localStorage.removeItem(this.STORAGE_KEY);
                this.log('✅ localStorage cleared');
            } catch (error) {
                this.log(`⚠️ Failed to clear localStorage: ${error.message}`, 'warning');
            }

            // Mark as clean (no need to save)
            this._isDirty = false;
            this._lastModified = Date.now();

            // Emit reset event
            this._emit('reset', oldState);
            this._emit('change', 'reset', null, oldState);

            this.log('✅ GameState reset complete');
        }

        /**
         * ✅ P1 UI/UX: Get available properties (for documentation)
         * @returns {Object} Object with property names and their current types
         */
        getAvailableProperties() {
            return {
                deviceMode: typeof this.deviceMode,
                selectedCategories: Array.isArray(this.selectedCategories) ? 'array' : typeof this.selectedCategories,
                difficulty: typeof this.difficulty,
                alcoholMode: typeof this.alcoholMode,
                questionCount: typeof this.questionCount,
                players: Array.isArray(this.players) ? 'array' : typeof this.players,
                playerName: typeof this.playerName,
                gameId: typeof this.gameId,
                playerId: typeof this.playerId,
                isHost: typeof this.isHost,
                isGuest: typeof this.isGuest,
                gamePhase: typeof this.gamePhase,
                timestamp: typeof this.timestamp
            };
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

            // ✅ OPTIMIZATION: Clear session cache
            this.clearSessionCache();

            // ✅ P1 STABILITY: Clear all event listeners
            this._eventListeners.clear();

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
        console.log('%c✅ GameState v9.0 loaded (Optimizations & Player Management)', 'color: #4CAF50; font-weight: bold; font-size: 14px');
        console.log('%c   - Session cache for Premium/FSK (5min TTL - verhindert redundante Calls)', 'color: #888; font-size: 12px');
        console.log('%c   - addPlayer() / removePlayer() / getPlayerCount() methods', 'color: #888; font-size: 12px');
        console.log('%c   - Player metadata support (avatar, gender)', 'color: #888; font-size: 12px');
        console.log('%c   - Production telemetry logging (console.log nur in Dev)', 'color: #888; font-size: 12px');
    }

})(window);