/**
 * No-Cap Difficulty Selection (Single Device Mode)
 * Version 6.3 - FSK18 Server-Side Validation
 *
 * ✅ P0 SECURITY: FSK0 & FSK16 always unlocked (no verification)
 * ✅ P0 SECURITY: FSK18 requires server-side validation (fail closed)
 * ✅ P0: Module Pattern - no global variables (XSS prevention)
 * ✅ P0: Event-Listener cleanup on beforeunload
 * ✅ P1: Validates device mode (should be "single" or "multi")
 * ✅ P0: Safe DOM manipulation (no innerHTML)
 * ✅ P1: Proper routing based on device mode
 * ✅ NEW: Rechtlich sichere Texte (keine "Schlücke" Animierung)
 */

(function(window) {
    'use strict';

    const Logger = window.NocapUtils?.Logger || {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {}
    };

    // ===========================
    // 🔒 MODULE SCOPE - NO GLOBAL POLLUTION
    // ===========================

    const DifficultySelectionModule = {
        state: {
            gameState: null,
            alcoholMode: false,
            questionCountsCache: null,
            eventListenerCleanup: [],
            isDevelopment: window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('192.168.')
        },

        get gameState() { return this.state.gameState; },
        set gameState(val) { this.state.gameState = val; },

        get alcoholMode() { return this.state.alcoholMode; },
        set alcoholMode(val) { this.state.alcoholMode = !!val; },

        get questionCountsCache() { return this.state.questionCountsCache; },
        set questionCountsCache(val) { this.state.questionCountsCache = val; },

        get isDevelopment() { return this.state.isDevelopment; }
    };

    Object.seal(DifficultySelectionModule.state);

    // ===========================
    // 🛠️ PERFORMANCE UTILITIES
    // ===========================

    function throttle(func, wait = 100) {
        let timeout = null;
        let previous = 0;
        return function executedFunction(...args) {
            const now = Date.now();
            const remaining = wait - (now - previous);
            if (remaining <= 0 || remaining > wait) {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                previous = now;
                func.apply(this, args);
            } else if (!timeout) {
                timeout = setTimeout(() => {
                    previous = Date.now();
                    timeout = null;
                    func.apply(this, args);
                }, remaining);
            }
        };
    }

    function debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function addTrackedEventListener(element, event, handler, options = {}) {
        if (!element) return;
        element.addEventListener(event, handler, options);
        DifficultySelectionModule.state.eventListenerCleanup.push({element, event, handler, options});
    }

    // ===========================
    // DIFFICULTY DATA
    // ===========================
    const difficultyNames = {
        easy: 'Entspannt',
        medium: 'Normal',
        hard: 'Hardcore'
    };

    // ✅ P1 STABILITY: Fallback difficulty limits for offline mode
    const FALLBACK_DIFFICULTY_LIMITS = {
        fsk0: { easy: 50, medium: 100, hard: 150 },
        fsk16: { easy: 50, medium: 120, hard: 180 },
        fsk18: { easy: 40, medium: 100, hard: 150 },
        special: { easy: 30, medium: 50, hard: 80 }
    };

    // ===========================
    // INITIALIZATION
    // ===========================
    async function waitForFirebaseInit(timeoutMs = 8000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (window.FirebaseConfig?.isInitialized?.()) return true;
            await new Promise(r => setTimeout(r, 100));
        }
        return false;
    }

    async function initialize() {
        Logger.debug('⚡ Initializing difficulty selection...');

        showLoading();

        const firebaseReady = await waitForFirebaseInit();
        if (!firebaseReady) {
            Logger.warn('⚠️ Firebase not ready – continuing in offline mode (UI still works)');
        }

        // Check DOMPurify
        if (typeof DOMPurify === 'undefined') {
            hideLoading();
            Logger.error('❌ CRITICAL: DOMPurify not loaded!');
            alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
            return;
        }

        // ✅ BUGFIX: Check for window.GameState (the constructor)
        if (typeof window.GameState === 'undefined') {
            hideLoading();
            Logger.error('❌ GameState not found');
            showNotification('Fehler beim Laden. Bitte Seite neu laden.', 'error');
            return;
        }

        try {
            if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
                await window.NocapUtils.waitForDependencies(['GameState']);
            }
        } catch (e) {
            // ignore and continue
        }

        await initializeGame();
    }

    /**
     * ✅ P0 FIX: Initialize game (now async for server-side validation)
     */
    async function initializeGame() {
        try {
            DifficultySelectionModule.gameState = new window.GameState();

            // ✅ UI sofort klickbar machen
            setupEventListeners();
            initializeSelection();
            updateContinueButton();
            hideLoading();

            // ✅ Ab hier darf Validation/Network auch failen - UI bleibt trotzdem bedienbar
            if (!validateDeviceMode()) return;

            const isValid = await validateGameState();
            if (!isValid) return;

            checkAlcoholMode();
            await loadQuestionCounts();

            Logger.debug('✅ Difficulty selection initialized');
        } catch (error) {
            Logger.error('❌ Initialization error:', error);
            hideLoading();

            const errorMessage = getErrorMessage(error);
            showNotification(errorMessage, 'error', 5000);

            setTimeout(() => {
                if (confirm('Fehler beim Laden. Erneut versuchen?')) {
                    window.location.reload();
                } else {
                    const redirectUrl = DifficultySelectionModule.gameState?.deviceMode === 'multi'
                        ? 'multiplayer-category-selection.html'
                        : 'category-selection.html';
                    window.location.href = redirectUrl;
                }
            }, 2000);
        }
    }

    function getErrorMessage(error) {
        if (!error) return 'Ein unbekannter Fehler ist aufgetreten';

        const errorMessage = error.message || '';

        if (errorMessage.includes('network') || errorMessage.includes('offline')) {
            return '📡 Keine Internetverbindung. Überprüfe deine Verbindung.';
        }
        if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
            return '⏱️ Zeitüberschreitung. Server antwortet nicht.';
        }
        if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('permission')) {
            return '🔒 Keine Berechtigung. Überprüfe deine Altersverifikation.';
        }
        if (errorMessage.includes('UNAVAILABLE') || errorMessage.includes('unavailable')) {
            return '📡 Server vorübergehend nicht erreichbar.';
        }

        return `❌ Fehler: ${errorMessage}`;
    }

    // ===========================
    // VALIDATION & GUARDS
    // ===========================

    function validateDeviceMode() {
        const deviceMode = DifficultySelectionModule.gameState.deviceMode;

        if (!deviceMode) {
            Logger.error('❌ No device mode set');
            showNotification('Spielmodus nicht gesetzt', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (deviceMode !== 'single' && deviceMode !== 'multi') {
            Logger.error(`❌ Invalid device mode: ${deviceMode}`);
            showNotification('Ungültiger Spielmodus', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        Logger.debug(`✅ Device mode validated: ${deviceMode}`);

        return true;
    }

    /**
     * ✅ NEW: Validate game state with FSK18 server-side validation
     * FSK0 & FSK16: No validation needed (always allowed)
     * FSK18: Requires server-side validation
     */
    async function validateGameState() {
        const firebaseOk = !!window.FirebaseConfig?.isInitialized?.();

        if (!DifficultySelectionModule.gameState.checkValidity()) {
            showNotification('Ungültiger Spielzustand', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (!DifficultySelectionModule.gameState.selectedCategories ||
            DifficultySelectionModule.gameState.selectedCategories.length === 0) {
            Logger.warn('⚠️ No categories selected');
            showNotification('Keine Kategorien ausgewählt!', 'warning');

            const redirectUrl = DifficultySelectionModule.gameState.deviceMode === 'multi'
                ? 'multiplayer-category-selection.html'
                : 'category-selection.html';

            setTimeout(() => window.location.href = redirectUrl, 2000);
            return false;
        }

        // ✅ Check if any FSK18 categories are selected
        const hasFSK18 = DifficultySelectionModule.gameState.selectedCategories.includes('fsk18');

        // ✅ FSK0 & FSK16 don't need validation
        if (!hasFSK18) {
            Logger.debug('✅ No FSK18 categories selected, validation skipped');
            return true;
        }

        // ✅ Firebase offline: Fail closed for FSK18
        if (!firebaseOk) {
            Logger.error('❌ Firebase offline, cannot validate FSK18');
            showNotification('🔞 FSK18-Validierung erfordert Internetverbindung', 'error', 3000);

            const redirectUrl = DifficultySelectionModule.gameState.deviceMode === 'multi'
                ? 'multiplayer-category-selection.html'
                : 'category-selection.html';

            setTimeout(() => window.location.href = redirectUrl, 2000);
            return false;
        }

        // ✅ Server-side validation for FSK18
        try {
            Logger.debug('🔍 Validating FSK18 access via server...');

            // Use GameState for server validation
            const hasAccess = await DifficultySelectionModule.gameState.canAccessFSK('fsk18', true);

            if (!hasAccess) {
                Logger.error('❌ Server denied FSK18 access');
                showNotification('🔞 Keine Berechtigung für FSK18-Inhalte!', 'error');

                const redirectUrl = DifficultySelectionModule.gameState.deviceMode === 'multi'
                    ? 'multiplayer-category-selection.html'
                    : 'category-selection.html';

                setTimeout(() => window.location.href = redirectUrl, 2000);
                return false;
            }

            Logger.debug('✅ FSK18 access validated (server-side)');
            return true;

        } catch (error) {
            Logger.error('❌ Server-side FSK18 validation failed:', error);
            showNotification('FSK18-Validierung fehlgeschlagen. Bitte erneut versuchen.', 'error');

            const redirectUrl = DifficultySelectionModule.gameState.deviceMode === 'multi'
                ? 'multiplayer-category-selection.html'
                : 'category-selection.html';

            setTimeout(() => window.location.href = redirectUrl, 2000);
            return false;
        }
    }

    // ===========================
    // QUESTION COUNTS & FALLBACK
    // ===========================

    async function loadQuestionCounts() {
        try {
            const instances = window.FirebaseConfig?.getFirebaseInstances?.();
            const database = instances?.database;

            if (window.FirebaseConfig?.isInitialized?.() && database?.ref) {
                DifficultySelectionModule.questionCountsCache = await loadCountsFromFirebase(database);
                if (DifficultySelectionModule.questionCountsCache) {
                    Logger.debug('✅ Question counts loaded from Firebase:', DifficultySelectionModule.questionCountsCache);
                    updateDifficultyCardsWithCounts();
                    return;
                }
            }

            Logger.warn('⚠️ Firebase not available, loading fallback counts');
            await loadCountsFromLocalFile();

        } catch (error) {
            Logger.error('❌ Error loading question counts:', error);
            await loadCountsFromLocalFile();
        }
    }

    async function loadCountsFromFirebase(database) {
        try {
            const counts = {};
            const categories = DifficultySelectionModule.gameState.selectedCategories || [];

            for (const category of categories) {
                const snapshot = await database.ref(`questions/${category}`).once('value');

                if (snapshot.exists()) {
                    const q = snapshot.val();
                    counts[category] = Array.isArray(q) ? q.length : (q ? Object.keys(q).length : 0);
                } else {
                    counts[category] = FALLBACK_DIFFICULTY_LIMITS[category]?.medium || 50;
                }
            }

            return counts;
        } catch (error) {
            Logger.error('❌ Error loading from Firebase:', error);
            return null;
        }
    }

    async function loadCountsFromLocalFile() {
        try {
            const response = await fetch('/assets/data/difficulty-limits.json');

            if (response.ok) {
                const data = await response.json();
                DifficultySelectionModule.questionCountsCache = data.counts || FALLBACK_DIFFICULTY_LIMITS;

                Logger.debug('✅ Question counts loaded from local file:', DifficultySelectionModule.questionCountsCache);
            } else {
                throw new Error('Local file not found');
            }
        } catch (error) {
            Logger.warn('⚠️ Could not load local file, using hardcoded fallback');
            DifficultySelectionModule.questionCountsCache = FALLBACK_DIFFICULTY_LIMITS;
        }

        updateDifficultyCardsWithCounts();
    }

    function updateDifficultyCardsWithCounts() {
        if (!DifficultySelectionModule.questionCountsCache) return;

        const categories = DifficultySelectionModule.gameState.selectedCategories || [];

        ['easy', 'medium', 'hard'].forEach(difficulty => {
            const card = document.querySelector(`[data-difficulty="${difficulty}"]`);
            if (!card) return;

            let totalQuestions = 0;
            let hasInsufficientQuestions = false;

            categories.forEach(category => {
                const categoryLimits = DifficultySelectionModule.questionCountsCache[category];
                if (categoryLimits) {
                    const count = typeof categoryLimits === 'object'
                        ? categoryLimits[difficulty]
                        : categoryLimits;
                    totalQuestions += count || 0;

                    if (count < 10) {
                        hasInsufficientQuestions = true;
                    }
                }
            });

            const countEl = card.querySelector('.question-count');
            if (countEl) {
                countEl.textContent = `${totalQuestions} Fragen verfügbar`;
            }
        });
    }

    // ===========================
    // ALCOHOL MODE - NEUE TEXTE
    // ===========================

    function checkAlcoholMode() {
        try {
            DifficultySelectionModule.alcoholMode = DifficultySelectionModule.gameState.alcoholMode === true;

            if (!DifficultySelectionModule.alcoholMode) {
                updateUIForAlcoholMode();
                return;
            }

            const ageLevel = window.NocapUtils
                ? parseInt(window.NocapUtils.getLocalStorage('nocap_age_level')) || 0
                : parseInt(localStorage.getItem('nocap_age_level')) || 0;

            if (ageLevel < 18) {
                Logger.warn('⚠️ Alcohol mode disabled: User under 18');
                DifficultySelectionModule.alcoholMode = false;
                DifficultySelectionModule.gameState.setAlcoholMode(false);

                const alcoholToggle = document.getElementById('alcohol-toggle');
                if (alcoholToggle) alcoholToggle.checked = false;
            }

            Logger.debug(`🍺 Alcohol mode: ${DifficultySelectionModule.alcoholMode}`);
            updateUIForAlcoholMode();
        } catch (error) {
            Logger.error('❌ Error checking alcohol mode:', error);
            DifficultySelectionModule.alcoholMode = false;

            const alcoholToggle = document.getElementById('alcohol-toggle');
            if (alcoholToggle) alcoholToggle.checked = false;

            updateUIForAlcoholMode();
        }
    }

    /**
     * ✅ NEW: Rechtlich sichere UI-Updates (keine "Schlücke"-Animierung)
     */
    function updateUIForAlcoholMode() {
        const descriptionSubtitle = document.getElementById('description-subtitle');

        // ✅ Rechtlich sicher: "Punkte" statt "Schlücke"
        if (descriptionSubtitle) {
            descriptionSubtitle.textContent = 'Bestimmt die Konsequenz bei Fehlschätzungen';
        }

        // ✅ Icons bleiben gleich, aber Texte rechtlich sicher
        updateDifficultyUI('easy', {
            icon: '🍹',
            base: '1 Punkt pro Abweichung',
            formula: ['Für gemütliche Runden']
        });

        updateDifficultyUI('medium', {
            icon: '🍺',
            base: 'Abweichung = Punkte',
            formula: ['Ausgewogene Herausforderung']
        });

        updateDifficultyUI('hard', {
            icon: '🍻',
            base: 'Abweichung × 2 = Punkte',
            formula: ['Maximale Herausforderung!']
        });
    }

    /**
     * ✅ P0 SECURITY: Update difficulty UI with safe DOM manipulation
     */
    function updateDifficultyUI(difficulty, content) {
        const iconEl = document.getElementById(`${difficulty}-icon`);
        const baseEl = document.getElementById(`${difficulty}-base`);
        const formulaEl = document.getElementById(`${difficulty}-formula`);

        if (iconEl) {
            iconEl.textContent = content.icon;
        }

        if (baseEl) {
            baseEl.textContent = content.base;
        }

        if (formulaEl && Array.isArray(content.formula)) {
            while (formulaEl.firstChild) {
                formulaEl.removeChild(formulaEl.firstChild);
            }

            content.formula.forEach((line, index) => {
                const lineEl = document.createElement('div');
                lineEl.textContent = line;
                if (index === 0) {
                    lineEl.classList.add('font-bold');
                }
                formulaEl.appendChild(lineEl);
            });
        }
    }

    // ===========================
    // DIFFICULTY SELECTION
    // ===========================

    function initializeSelection() {
        if (DifficultySelectionModule.gameState.difficulty) {
            const card = document.querySelector(`[data-difficulty="${DifficultySelectionModule.gameState.difficulty}"]`);
            if (card) {
                card.classList.add('selected');
                card.setAttribute('aria-checked', 'true');
                updateContinueButton();
            }
        }
    }

    function selectDifficulty(element) {
        const difficulty = element.dataset.difficulty;
        if (!difficulty) return;

        if (!difficultyNames[difficulty]) {
            Logger.error(`❌ Invalid difficulty: ${difficulty}`);
            return;
        }

        document.querySelectorAll('.difficulty-card').forEach(card => {
            card.classList.remove('selected');
            card.setAttribute('aria-checked', 'false');
        });

        element.classList.add('selected');
        element.setAttribute('aria-checked', 'true');

        DifficultySelectionModule.gameState.setDifficulty(difficulty);

        updateContinueButton();

        showNotification(`${difficultyNames[difficulty]} Modus gewählt!`, 'success', 2000);

        Logger.debug(`Selected difficulty: ${difficulty}`);
    }

    function updateContinueButton() {
        const continueBtn = document.getElementById('continue-btn');
        if (!continueBtn) return;

        const difficulty = DifficultySelectionModule.gameState.difficulty;

        if (difficulty) {
            continueBtn.disabled = false;
            continueBtn.setAttribute('aria-disabled', 'false');
            continueBtn.classList.add('enabled');
            continueBtn.textContent = 'Weiter';
        } else {
            continueBtn.disabled = true;
            continueBtn.setAttribute('aria-disabled', 'true');
            continueBtn.classList.remove('enabled');
            continueBtn.textContent = 'Schwierigkeitsgrad wählen';
        }
    }

    // ===========================
    // EVENT LISTENERS
    // ===========================

    function setupEventListeners() {
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            addTrackedEventListener(backBtn, 'click', goBack);
        }

        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) {
            addTrackedEventListener(continueBtn, 'click', proceedToNextStep);
        }

        const difficultyCards = document.querySelectorAll('.difficulty-card');
        difficultyCards.forEach((card, index) => {
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'radio');
            if (!card.hasAttribute('aria-checked')) {
                card.setAttribute('aria-checked', 'false');
            }
            addTrackedEventListener(card, 'click', function() {
                if (!this.classList.contains('disabled')) {
                    selectDifficulty(this);
                }
            });

            addTrackedEventListener(card, 'keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!this.classList.contains('disabled')) {
                        selectDifficulty(this);
                    }
                } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    focusNextCard(index, difficultyCards);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    focusPreviousCard(index, difficultyCards);
                }
            });
        });

        addTrackedEventListener(document, 'keydown', function(e) {
            if (e.key === 'Enter' &&
                DifficultySelectionModule.gameState.difficulty &&
                !e.target.closest('.difficulty-card')) {
                proceedToNextStep();
            }
        });

        const alcoholToggle = document.getElementById('alcohol-toggle');
        if (alcoholToggle) {
            addTrackedEventListener(alcoholToggle, 'change', handleAlcoholToggle);
        }
    }

    function handleAlcoholToggle(event) {
        const isEnabled = event.target.checked;

        const ageLevel = window.NocapUtils
            ? parseInt(window.NocapUtils.getLocalStorage('nocap_age_level')) || 0
            : parseInt(localStorage.getItem('nocap_age_level')) || 0;

        if (isEnabled && ageLevel < 18) {
            event.target.checked = false;
            return;
        }

        DifficultySelectionModule.alcoholMode = isEnabled;
        DifficultySelectionModule.gameState.setAlcoholMode(isEnabled);

        updateUIForAlcoholMode();

        const warning = document.getElementById('alcohol-warning');
        if (warning) {
            if (isEnabled) {
                warning.classList.remove('hidden');
            } else {
                warning.classList.add('hidden');
            }
        }

        showNotification(
            isEnabled ? '🍺 Alkohol-Modus aktiviert' : '💧 Alkohol-Modus deaktiviert',
            'info',
            2000
        );
    }

    function focusNextCard(currentIndex, cards) {
        let nextIndex = (currentIndex + 1) % cards.length;
        let attempts = 0;

        while (cards[nextIndex].classList.contains('disabled') && attempts < cards.length) {
            nextIndex = (nextIndex + 1) % cards.length;
            attempts++;
        }

        if (!cards[nextIndex].classList.contains('disabled')) {
            cards[nextIndex].focus();
        }
    }

    function focusPreviousCard(currentIndex, cards) {
        let prevIndex = (currentIndex - 1 + cards.length) % cards.length;
        let attempts = 0;

        while (cards[prevIndex].classList.contains('disabled') && attempts < cards.length) {
            prevIndex = (prevIndex - 1 + cards.length) % cards.length;
            attempts++;
        }

        if (!cards[prevIndex].classList.contains('disabled')) {
            cards[prevIndex].focus();
        }
    }

    // ===========================
    // NAVIGATION
    // ===========================

    async function proceedToNextStep() {
        const difficulty = DifficultySelectionModule.gameState.difficulty;

        if (!difficulty) {
            showNotification('Bitte wähle einen Schwierigkeitsgrad aus', 'warning');
            return;
        }

        Logger.debug(`🚀 Proceeding with difficulty: ${difficulty}`);

        showLoading();

        const deviceMode = DifficultySelectionModule.gameState.deviceMode;

        if (deviceMode === 'multi') {
            try {
                const instances = window.FirebaseConfig?.getFirebaseInstances?.();
                const database = instances?.database;

                if (window.FirebaseConfig?.isInitialized?.() && database?.ref) {
                    const gameId = DifficultySelectionModule.gameState.gameId;
                    if (gameId) {
                        await database.ref(`games/${gameId}/settings`).update({
                            difficulty,
                            alcoholMode: DifficultySelectionModule.alcoholMode,
                            updatedAt: Date.now()
                        });
                    }
                } else {
                    Logger.warn('⚠️ Firebase not available, difficulty not synced');
                }

            } catch (error) {
                Logger.error('❌ Error saving difficulty to database:', error);

                Logger.warn('⚠️ Saving difficulty locally only (offline mode)');

                if (deviceMode === 'multi') {
                    hideLoading();

                    const shouldRetry = confirm(
                        'Schwierigkeitsgrad konnte nicht synchronisiert werden.\n' +
                        'Möchtest du es erneut versuchen?\n\n' +
                        '(Bei "Abbrechen" wird nur lokal gespeichert)'
                    );

                    if (shouldRetry) {
                        return proceedToNextStep();
                    } else {
                        showNotification('⚠️ Offline-Modus: Änderungen nur lokal gespeichert', 'warning', 3000);
                        showLoading();
                    }
                }
            }
        }

        try {
            const difficultyState = {
                difficulty: difficulty,
                alcoholMode: DifficultySelectionModule.alcoholMode,
                timestamp: Date.now(),
                deviceMode: deviceMode,
                categories: DifficultySelectionModule.gameState.selectedCategories
            };

            if (window.NocapUtils && window.NocapUtils.setLocalStorage) {
                window.NocapUtils.setLocalStorage('nocap_difficulty_selection', difficultyState);
            } else {
                localStorage.setItem('nocap_difficulty_selection', JSON.stringify(difficultyState));
            }

            Logger.debug('✅ Difficulty saved to localStorage (offline fallback)', difficultyState);
        } catch (storageError) {
            Logger.error('❌ Failed to save to localStorage:', storageError);
            showNotification('⚠️ Lokale Speicherung fehlgeschlagen', 'warning', 2000);
        }

        setTimeout(() => {
            if (deviceMode === 'single') {
                window.location.href = 'player-setup.html';
            } else if (deviceMode === 'multi') {
                window.location.href = 'multiplayer-lobby.html';
            } else {
                Logger.warn('⚠️ Device mode not set, redirecting to home');
                window.location.href = 'index.html';
            }
        }, 500);
    }

    function goBack() {
        if (!DifficultySelectionModule.gameState ||
            !DifficultySelectionModule.gameState.selectedCategories ||
            DifficultySelectionModule.gameState.selectedCategories.length === 0) {
            Logger.warn('⚠️ No categories selected, redirecting to home');
            window.location.href = 'index.html';
            return;
        }

        showLoading();

        setTimeout(() => {
            const deviceMode = DifficultySelectionModule.gameState.deviceMode;

            if (deviceMode === 'multi') {
                window.location.href = 'multiplayer-category-selection.html';
            } else if (deviceMode === 'single') {
                window.location.href = 'category-selection.html';
            } else {
                Logger.warn('⚠️ Device mode unknown, redirecting to home');
                window.location.href = 'index.html';
            }
        }, 300);
    }

    // ===========================
    // UTILITY FUNCTIONS
    // ===========================

    const showLoading = window.NocapUtils?.showLoading || function() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'flex';
            loading.classList.add('show');
        }
    };

    const hideLoading = window.NocapUtils?.hideLoading || function() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.remove('show');
            loading.style.display = 'none';
        }
    };

    const showNotification = window.NocapUtils?.showNotification || function(message) {
        alert(String(message));
    };

    // ===========================
    // CLEANUP
    // ===========================

    function cleanup() {
        DifficultySelectionModule.state.eventListenerCleanup.forEach(({element, event, handler, options}) => {
            try {
                element.removeEventListener(event, handler, options);
            } catch (error) {
                // Element may have been removed from DOM
            }
        });
        DifficultySelectionModule.state.eventListenerCleanup = [];

        if (window.NocapUtils && window.NocapUtils.cleanupEventListeners) {
            window.NocapUtils.cleanupEventListeners();
        }

        Logger.debug('✅ Difficulty selection cleanup completed');
    }

    window.addEventListener('beforeunload', cleanup);

    // ===========================
    // INITIALIZATION
    // ===========================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})(window);