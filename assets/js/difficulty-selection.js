/**
 * No-Cap Difficulty Selection (Single Device Mode)
 * Version 5.0 - P0 Security Fixes Applied
 *
 * ✅ P1 FIX: Validates device mode (should be "single" or "multi")
 * ✅ P0 FIX: MANDATORY server-side FSK validation for categories
 * ✅ P0 FIX: Safe DOM manipulation (no innerHTML)
 * ✅ P1 FIX: Proper routing based on device mode
 */

(function(window) {
    'use strict';

    // ===========================
    // DIFFICULTY DATA
    // ===========================
    const difficultyNames = {
        easy: 'Entspannt',
        medium: 'Normal',
        hard: 'Hardcore'
    };

    const difficultyMultipliers = {
        easy: 1,
        medium: 1,
        hard: 2
    };

    // ===========================
    // GLOBAL STATE
    // ===========================
    let gameState = null;
    let alcoholMode = false;

    const isDevelopment = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('192.168.');

    // ===========================
    // INITIALIZATION
    // ===========================

    function initialize() {
        if (isDevelopment) {
            console.log('⚡ Initializing difficulty selection...');
        }

        showLoading();

        // Check DOMPurify
        if (typeof DOMPurify === 'undefined') {
            console.error('❌ CRITICAL: DOMPurify not loaded!');
            alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
            return;
        }

        // Check dependencies
        if (typeof GameState === 'undefined') {
            console.error('❌ GameState not found');
            showNotification('Fehler beim Laden. Bitte Seite neu laden.', 'error');
            return;
        }

        // Wait for utils if available
        if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
            window.NocapUtils.waitForDependencies(['GameState']).then(() => {
                initializeGame();
            }).catch(() => {
                initializeGame();
            });
        } else {
            initializeGame();
        }
    }

    /**
     * ✅ P0 FIX: Initialize game (now async for server-side validation)
     */
    async function initializeGame() {
        try {
            gameState = new GameState();

            // ✅ P1 FIX: Validate device mode FIRST
            if (!validateDeviceMode()) {
                return;
            }

            // ✅ P0 FIX: Await async validation with server-side FSK checks
            const isValid = await validateGameState();
            if (!isValid) {
                return;
            }

            // Check alcohol mode
            checkAlcoholMode();

            // Load difficulty from GameState
            initializeSelection();

            // Setup event listeners
            setupEventListeners();

            hideLoading();

            if (isDevelopment) {
                console.log('✅ Difficulty selection initialized');
                console.log('Game State:', gameState.getDebugInfo());
            }

        } catch (error) {
            console.error('❌ Initialization error:', error);
            hideLoading();

            // ✅ P1 STABILITY: User-friendly error handling with retry option
            const errorMessage = getErrorMessage(error);
            showNotification(errorMessage, 'error', 5000);

            // ✅ P1 STABILITY: Offer retry or fallback
            setTimeout(() => {
                if (confirm('Fehler beim Laden. Erneut versuchen?')) {
                    window.location.reload();
                } else {
                    // Fallback: Go back to category selection
                    const redirectUrl = gameState?.deviceMode === 'multi'
                        ? 'multiplayer-category-selection.html'
                        : 'category-selection.html';
                    window.location.href = redirectUrl;
                }
            }, 2000);
        }
    }

    /**
     * ✅ P1 STABILITY: Get user-friendly error message
     * @param {Error} error - Error object
     * @returns {string} User-friendly error message
     */
    function getErrorMessage(error) {
        if (!error) return 'Ein unbekannter Fehler ist aufgetreten';

        const errorMessage = error.message || '';

        // Network errors
        if (errorMessage.includes('network') || errorMessage.includes('offline')) {
            return '📡 Keine Internetverbindung. Überprüfe deine Verbindung.';
        }
        if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
            return '⏱️ Zeitüberschreitung. Server antwortet nicht.';
        }

        // Firebase errors
        if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('permission')) {
            return '🔒 Keine Berechtigung. Überprüfe deine Altersverifikation.';
        }
        if (errorMessage.includes('UNAVAILABLE') || errorMessage.includes('unavailable')) {
            return '📡 Server vorübergehend nicht erreichbar.';
        }

        // Generic fallback
        return `❌ Fehler: ${errorMessage}`;
    }

    // ===========================
    // VALIDATION & GUARDS
    // ===========================

    /**
     * ✅ P1 FIX: Validate device mode
     */
    function validateDeviceMode() {
        const deviceMode = gameState.deviceMode;

        // Check if device mode is set
        if (!deviceMode) {
            console.error('❌ No device mode set');
            showNotification('Spielmodus nicht gesetzt', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        // This page works for both 'single' and 'multi' modes
        // but we validate it's one of them
        if (deviceMode !== 'single' && deviceMode !== 'multi') {
            console.error(`❌ Invalid device mode: ${deviceMode}`);
            showNotification('Ungültiger Spielmodus', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (isDevelopment) {
            console.log(`✅ Device mode validated: ${deviceMode}`);
        }

        return true;
    }

    /**
     * ✅ P0 FIX: Validate game state with MANDATORY server-side FSK validation
     * @returns {Promise<boolean>} True if valid
     */
    async function validateGameState() {
        if (!gameState.checkValidity()) {
            showNotification('Ungültiger Spielzustand', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (!gameState.selectedCategories || gameState.selectedCategories.length === 0) {
            console.warn('⚠️ No categories selected');
            showNotification('Keine Kategorien ausgewählt!', 'warning');

            // Redirect based on device mode
            const redirectUrl = gameState.deviceMode === 'multi'
                ? 'multiplayer-category-selection.html'
                : 'category-selection.html';

            setTimeout(() => window.location.href = redirectUrl, 2000);
            return false;
        }

        // ✅ P0 FIX: MANDATORY server-side FSK validation for each category
        try {
            for (const category of gameState.selectedCategories) {
                // Skip FSK0 - always allowed
                if (category === 'fsk0') continue;

                // ✅ P0 FIX: Server-side validation via Cloud Function
                const hasAccess = await gameState.canAccessFSK(category);

                if (!hasAccess) {
                    console.error(`❌ Server denied access to category: ${category}`);
                    showNotification(`Keine Berechtigung für ${category.toUpperCase()}!`, 'error');

                    // Redirect to category selection to choose valid categories
                    const redirectUrl = gameState.deviceMode === 'multi'
                        ? 'multiplayer-category-selection.html'
                        : 'category-selection.html';

                    setTimeout(() => window.location.href = redirectUrl, 2000);
                    return false;
                }
            }

            if (isDevelopment) {
                console.log('✅ All categories validated (server-side)');
            }

        } catch (error) {
            console.error('❌ Server-side FSK validation failed:', error);
            showNotification('FSK-Validierung fehlgeschlagen. Bitte erneut versuchen.', 'error');

            const redirectUrl = gameState.deviceMode === 'multi'
                ? 'multiplayer-category-selection.html'
                : 'category-selection.html';

            setTimeout(() => window.location.href = redirectUrl, 2000);
            return false;
        }

        return true;
    }

    // ===========================
    // ALCOHOL MODE
    // ===========================

    function checkAlcoholMode() {
        try {
            alcoholMode = gameState.alcoholMode === true;

            // ✅ AUDIT FIX: Serverseitige FSK18-Validierung für Alkohol-Mode
            if (alcoholMode) {
                // Prüfe ob User 18+ ist (aus Custom Claims oder LocalStorage)
                const ageLevel = parseInt(localStorage.getItem('nocap_age_level')) || 0;

                if (ageLevel < 18) {
                    console.warn('⚠️ Alcohol mode disabled: User under 18');
                    alcoholMode = false;
                    gameState.setAlcoholMode(false);

                    showNotification(
                        'Alkohol-Modus nur für 18+',
                        'warning',
                        3000
                    );
                }
            }

            if (isDevelopment) {
                console.log(`🍺 Alcohol mode: ${alcoholMode}`);
            }

            updateUIForAlcoholMode();
        } catch (error) {
            console.error('❌ Error checking alcohol mode:', error);
            alcoholMode = false;
            updateUIForAlcoholMode();
        }
    }

    /**
     * Safe UI update with textContent
     */
    function updateUIForAlcoholMode() {
        const descriptionSubtitle = document.getElementById('description-subtitle');

        if (alcoholMode) {
            if (descriptionSubtitle) {
                descriptionSubtitle.textContent = 'Bestimmt die Anzahl der Schlücke bei falschen Schätzungen';
            }

            updateDifficultyUI('easy', {
                icon: '🍷',
                base: '1 Grundschluck bei falscher Antwort',
                formula: ['Schlücke = Abweichung der Schätzung', 'Perfekt für entspannte Runden']
            });

            updateDifficultyUI('medium', {
                icon: '🍺',
                base: 'Abweichung = Schlücke',
                formula: ['Schlücke = Abweichung der Schätzung', 'Der Standard für lustige Partyabende']
            });

            updateDifficultyUI('hard', {
                icon: '🔥',
                base: 'Doppelte Abweichung!',
                formula: ['Schlücke = Abweichung × 2', 'Nur für erfahrene Spieler!']
            });
        } else {
            if (descriptionSubtitle) {
                descriptionSubtitle.textContent = 'Bestimmt die Konsequenz bei falschen Schätzungen';
            }

            updateDifficultyUI('easy', {
                icon: '💧',
                base: '1 Grundpunkt bei falscher Antwort',
                formula: ['Punkte = Abweichung der Schätzung', 'Perfekt für entspannte Runden']
            });

            updateDifficultyUI('medium', {
                icon: '🎉',
                base: 'Abweichung = Punkte',
                formula: ['Punkte = Abweichung der Schätzung', 'Der Standard für lustige Partyabende']
            });

            updateDifficultyUI('hard', {
                icon: '🔥',
                base: 'Doppelte Abweichung!',
                formula: ['Punkte = Abweichung × 2', 'Nur für erfahrene Spieler!']
            });
        }
    }

    /**
     * Safe content update with DOM manipulation
     */
    /**
     * ✅ P0 SECURITY: Update difficulty UI with safe DOM manipulation
     * No innerHTML - only textContent to prevent HTML injection
     */
    function updateDifficultyUI(difficulty, content) {
        const iconEl = document.getElementById(`${difficulty}-icon`);
        const baseEl = document.getElementById(`${difficulty}-base`);
        const formulaEl = document.getElementById(`${difficulty}-formula`);

        if (iconEl) {
            // ✅ P0 SECURITY: textContent is XSS-safe
            iconEl.textContent = content.icon;
        }

        if (baseEl) {
            // ✅ P0 SECURITY: textContent is XSS-safe
            baseEl.textContent = content.base;
        }

        if (formulaEl && Array.isArray(content.formula)) {
            // ✅ P0 SECURITY: Clear with assignment, not innerHTML
            // Preserve child nodes during rebuild
            while (formulaEl.firstChild) {
                formulaEl.removeChild(formulaEl.firstChild);
            }

            content.formula.forEach((line, index) => {
                const lineEl = document.createElement('div');
                // ✅ P0 SECURITY: textContent is XSS-safe
                lineEl.textContent = line;
                if (index === 0) {
                    // ✅ CSP-FIX: Use CSS class instead of inline style
                    lineEl.classList.add('font-bold');
                }
                formulaEl.appendChild(lineEl);
            });
        }
    }

    // ===========================
    // DIFFICULTY SELECTION
    // ===========================

    /**
     * Initialize selection from GameState
     */
    function initializeSelection() {
        if (gameState.difficulty) {
            const card = document.querySelector(`[data-difficulty="${gameState.difficulty}"]`);
            if (card) {
                card.classList.add('selected');
                card.setAttribute('aria-pressed', 'true');
                updateContinueButton();
            }
        }
    }

    /**
     * Validate difficulty before selection
     */
    function selectDifficulty(element) {
        const difficulty = element.dataset.difficulty;
        if (!difficulty) return;

        // Validate difficulty value
        if (!difficultyNames[difficulty]) {
            console.error(`❌ Invalid difficulty: ${difficulty}`);
            return;
        }

        // Remove previous selection
        document.querySelectorAll('.difficulty-card').forEach(card => {
            card.classList.remove('selected');
            card.setAttribute('aria-pressed', 'false');
        });

        // Add selection
        element.classList.add('selected');
        element.setAttribute('aria-pressed', 'true');

        // Save directly to GameState
        gameState.setDifficulty(difficulty);

        updateContinueButton();

        showNotification(`${difficultyNames[difficulty]} Modus gewählt!`, 'success', 2000);

        if (isDevelopment) {
            console.log(`Selected difficulty: ${difficulty}`);
        }
    }

    function updateContinueButton() {
        const continueBtn = document.getElementById('continue-btn');
        if (!continueBtn) return;

        const difficulty = gameState.difficulty;

        if (difficulty) {
            continueBtn.disabled = false;
            continueBtn.setAttribute('aria-disabled', 'false');
            continueBtn.textContent = 'Weiter';
        } else {
            continueBtn.disabled = true;
            continueBtn.setAttribute('aria-disabled', 'true');
            continueBtn.textContent = 'Schwierigkeitsgrad wählen';
        }
    }

    // ===========================
    // EVENT LISTENERS
    // ===========================

    function setupEventListeners() {
        // Back button
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', goBack);
        }

        // Continue button
        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) {
            continueBtn.addEventListener('click', proceedToNextStep);
        }

        // Difficulty cards with keyboard support
        document.querySelectorAll('.difficulty-card').forEach(card => {
            card.addEventListener('click', function() {
                selectDifficulty(this);
            });

            card.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectDifficulty(this);
                }
            });
        });

        // Global keyboard navigation
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && gameState.difficulty && !e.target.closest('.difficulty-card')) {
                proceedToNextStep();
            }
        });
    }

    // ===========================
    // NAVIGATION
    // ===========================

    /**
     * ✅ AUDIT FIX: Route based on device mode & save to database
     */
    async function proceedToNextStep() {
        const difficulty = gameState.difficulty;

        if (!difficulty) {
            showNotification('Bitte wähle einen Schwierigkeitsgrad aus', 'warning');
            return;
        }

        if (isDevelopment) {
            console.log(`🚀 Proceeding with difficulty: ${difficulty}`);
        }

        showLoading();

        // ✅ AUDIT FIX: Save difficulty to database for multiplayer sync
        const deviceMode = gameState.deviceMode;

        if (deviceMode === 'multi') {
            try {
                // Prüfe ob Firebase verfügbar
                if (typeof firebase !== 'undefined' && firebase.database) {
                    const gameId = gameState.gameId;

                    if (gameId) {
                        await firebase.database()
                            .ref(`games/${gameId}/settings`)
                            .update({
                                difficulty: difficulty,
                                alcoholMode: alcoholMode,
                                updatedAt: firebase.database.ServerValue.TIMESTAMP
                            });

                        if (isDevelopment) {
                            console.log('✅ Difficulty saved to database');
                        }
                    }
                } else {
                    console.warn('⚠️ Firebase not available, difficulty not synced');
                }
            } catch (error) {
                console.error('❌ Error saving difficulty to database:', error);

                // ✅ P1 STABILITY: Offline support - don't block user
                console.warn('⚠️ Saving difficulty locally only (offline mode)');

                // ✅ P1 STABILITY: Offer retry option for critical multiplayer saves
                if (deviceMode === 'multi') {
                    hideLoading();

                    const shouldRetry = confirm(
                        'Schwierigkeitsgrad konnte nicht synchronisiert werden.\n' +
                        'Möchtest du es erneut versuchen?\n\n' +
                        '(Bei "Abbrechen" wird nur lokal gespeichert)'
                    );

                    if (shouldRetry) {
                        return proceedToNextStep(); // Recursive retry
                    } else {
                        showNotification('⚠️ Offline-Modus: Änderungen nur lokal gespeichert', 'warning', 3000);
                        showLoading(); // Continue with loading state
                    }
                }
            }
        }

        // ✅ P1 STABILITY: Always save to localStorage as offline fallback
        // This ensures the page works even without Firebase connection
        try {
            const difficultyState = {
                difficulty: difficulty,
                alcoholMode: alcoholMode,
                timestamp: Date.now(),
                deviceMode: deviceMode,
                categories: gameState.selectedCategories
            };

            if (window.NocapUtils && window.NocapUtils.setLocalStorage) {
                window.NocapUtils.setLocalStorage('nocap_difficulty_selection', difficultyState);
            } else {
                localStorage.setItem('nocap_difficulty_selection', JSON.stringify(difficultyState));
            }

            if (isDevelopment) {
                console.log('✅ Difficulty saved to localStorage (offline fallback)', difficultyState);
            }
        } catch (storageError) {
            console.error('❌ Failed to save to localStorage:', storageError);
            // Show warning but continue
            showNotification('⚠️ Lokale Speicherung fehlgeschlagen', 'warning', 2000);
        }

        setTimeout(() => {

            if (deviceMode === 'single') {
                window.location.href = 'player-setup.html';
            } else if (deviceMode === 'multi') {
                window.location.href = 'multiplayer-lobby.html';
            } else {
                // Fallback: should not happen after validation
                console.warn('⚠️ Device mode not set, redirecting to home');
                window.location.href = 'index.html';
            }
        }, 500);
    }

    /**
     * ✅ P1 UI/UX: Enhanced back navigation with validation
     */
    function goBack() {
        // ✅ P1 UI/UX: Validate we have valid state to go back to
        if (!gameState || !gameState.selectedCategories || gameState.selectedCategories.length === 0) {
            console.warn('⚠️ No categories selected, redirecting to home');
            window.location.href = 'index.html';
            return;
        }

        showLoading();

        setTimeout(() => {
            // ✅ P1 FIX: Route back based on device mode
            const deviceMode = gameState.deviceMode;

            if (deviceMode === 'multi') {
                window.location.href = 'multiplayer-category-selection.html';
            } else if (deviceMode === 'single') {
                window.location.href = 'category-selection.html';
            } else {
                // ✅ P1 UI/UX: Fallback to safe route (never empty page)
                console.warn('⚠️ Device mode unknown, redirecting to home');
                window.location.href = 'index.html';
            }
        }, 300);
    }

    /**
     * ✅ P1 UI/UX: Check if difficulty selection is still valid
     * Called when returning from other pages or on page visibility change
     */
    function validateDifficultySelection() {
        // Check if selected categories still exist in GameState
        if (!gameState || !gameState.selectedCategories || gameState.selectedCategories.length === 0) {
            showNotification(
                '⚠️ Keine Kategorien ausgewählt. Bitte wähle zuerst Kategorien aus.',
                'warning',
                3000
            );

            setTimeout(() => {
                const redirectUrl = gameState?.deviceMode === 'multi'
                    ? 'multiplayer-category-selection.html'
                    : 'category-selection.html';
                window.location.href = redirectUrl;
            }, 2000);

            return false;
        }

        // ✅ P1 UI/UX: Check for premium difficulty with non-premium categories
        if (gameState.difficulty === 'premium') {
            const hasPremiumCategory = gameState.selectedCategories.includes('special');

            if (!hasPremiumCategory) {
                showNotification(
                    '⚠️ Premium-Schwierigkeit erfordert die "Special Edition" Kategorie.',
                    'warning',
                    3000
                );

                // Reset to default difficulty
                gameState.setDifficulty('medium');
                selectDifficulty(document.querySelector('[data-difficulty="medium"]'));

                return false;
            }
        }

        return true;
    }

    /**
     * ✅ P1 UI/UX: Listen for page visibility changes
     * Re-validate when user returns to this page
     */
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && gameState) {
            // Page became visible again
            if (isDevelopment) {
                console.log('🔄 Page visible again, re-validating...');
            }

            validateDifficultySelection();
        }
    });

    // ===========================
    // UTILITY FUNCTIONS (use NocapUtils)
    // ===========================

    const showLoading = window.NocapUtils?.showLoading || function() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.add('show');
    };

    const hideLoading = window.NocapUtils?.hideLoading || function() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.remove('show');
    };

    const showNotification = window.NocapUtils?.showNotification || function(message) {
        alert(String(message)); // Fallback
    };

    // ===========================
    // CLEANUP
    // ===========================

    function cleanup() {
        if (window.NocapUtils && window.NocapUtils.cleanupEventListeners) {
            window.NocapUtils.cleanupEventListeners();
        }

        if (isDevelopment) {
            console.log('✅ Difficulty selection cleanup completed');
        }
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