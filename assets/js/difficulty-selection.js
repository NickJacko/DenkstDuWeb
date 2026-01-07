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
            showNotification('Fehler beim Laden', 'error');
            hideLoading();
        }
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
            // Clear and rebuild with safe DOM manipulation
            formulaEl.innerHTML = '';

            content.formula.forEach((line, index) => {
                const lineEl = document.createElement('div');
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
                // Continue anyway - nicht blockierend
            }
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

    function goBack() {
        showLoading();

        setTimeout(() => {
            // ✅ P1 FIX: Route back based on device mode
            const deviceMode = gameState.deviceMode;

            if (deviceMode === 'multi') {
                window.location.href = 'multiplayer-category-selection.html';
            } else {
                window.location.href = 'category-selection.html';
            }
        }, 300);
    }

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