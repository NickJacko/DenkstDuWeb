/**
 * No-Cap Difficulty Selection (Single Device Mode)
 * Version 3.0 - Audit-Fixed & Production Ready
 * Handles difficulty selection with alcohol mode adaptation
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
        window.location.hostname === '127.0.0.1';

    // ===========================
    // INITIALIZATION
    // ===========================

    function initialize() {
        if (isDevelopment) {
            console.log('⚡ Initializing difficulty selection...');
        }

        showLoading();

        // P0 FIX: Check DOMPurify
        if (typeof DOMPurify === 'undefined') {
            console.error('❌ CRITICAL: DOMPurify not loaded!');
            alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
            return;
        }

        // P0 FIX: Check dependencies
        if (typeof GameState === 'undefined') {
            console.error('❌ GameState not found');
            showNotification('Fehler beim Laden. Bitte Seite neu laden.', 'error');
            return;
        }

        // P1 FIX: Wait for utils if available
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

    function initializeGame() {
        gameState = new GameState();

        // Validate prerequisites
        if (!validateGameState()) {
            return;
        }

        // Check alcohol mode
        checkAlcoholMode();

        // P1 FIX: Load difficulty from GameState
        initializeSelection();

        // Setup event listeners
        setupEventListeners();

        hideLoading();

        if (isDevelopment) {
            console.log('✅ Difficulty selection initialized');
        }
    }

    // ===========================
    // VALIDATION & GUARDS
    // ===========================

    /**
     * P0 FIX: Validate game state and categories
     */
    function validateGameState() {
        if (!gameState.checkValidity()) {
            showNotification('Ungültiger Spielzustand', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (!gameState.selectedCategories || gameState.selectedCategories.length === 0) {
            console.warn('⚠️ No categories selected');
            showNotification('Keine Kategorien ausgewählt!', 'warning');
            setTimeout(() => window.location.href = 'category-selection.html', 2000);
            return false;
        }

        // P0 FIX: Validate age access to selected categories
        const ageLevel = window.NocapUtils
            ? parseInt(window.NocapUtils.getLocalStorage('nocap_age_level')) || 0
            : parseInt(localStorage.getItem('nocap_age_level')) || 0;

        const hasInvalidCategory = gameState.selectedCategories.some(category => {
            if (category === 'fsk18' && ageLevel < 18) return true;
            if (category === 'fsk16' && ageLevel < 16) return true;
            return false;
        });

        if (hasInvalidCategory) {
            console.error('❌ Invalid categories for age level');
            showNotification('Ungültige Kategorien für dein Alter!', 'error');
            setTimeout(() => window.location.href = 'category-selection.html', 2000);
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
     * P0 FIX: Safe UI update with textContent
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
     * P0 FIX: Safe content update with DOM manipulation
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
            // P0 FIX: Clear and rebuild with safe DOM manipulation
            formulaEl.innerHTML = '';

            content.formula.forEach((line, index) => {
                const lineEl = document.createElement('div');
                lineEl.textContent = line;
                if (index === 0) {
                    lineEl.style.fontWeight = 'bold';
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
     * P0 FIX: Validate difficulty before selection
     */
    function selectDifficulty(element) {
        const difficulty = element.dataset.difficulty;
        if (!difficulty) return;

        // P0 FIX: Validate difficulty value
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

        // P1 FIX: Save directly to GameState
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
            continueBtn.addEventListener('click', proceedToDifficulty);
        }

        // P1 FIX: Difficulty cards with keyboard support
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
                proceedToDifficulty();
            }
        });
    }

    // ===========================
    // NAVIGATION
    // ===========================

    function proceedToDifficulty() {
        const difficulty = gameState.difficulty;

        if (!difficulty) {
            showNotification('Bitte wähle einen Schwierigkeitsgrad aus', 'warning');
            return;
        }

        if (isDevelopment) {
            console.log(`🚀 Proceeding with difficulty: ${difficulty}`);
        }

        showLoading();

        setTimeout(() => {
            // P0 FIX: Validate device mode before routing
            const deviceMode = gameState.deviceMode;

            if (deviceMode === 'single') {
                window.location.href = 'player-setup.html';
            } else if (deviceMode === 'multi') {
                window.location.href = 'multiplayer-lobby.html';
            } else {
                console.warn('⚠️ Device mode not set, defaulting to single');
                gameState.setDeviceMode('single');
                window.location.href = 'player-setup.html';
            }
        }, 500);
    }

    function goBack() {
        showLoading();
        setTimeout(() => {
            window.location.href = 'category-selection.html';
        }, 300);
    }

    // ===========================
    // UTILITY FUNCTIONS
    // ===========================

    function showLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.add('show');
        }
    }

    function hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.remove('show');
        }
    }

    /**
     * P0 FIX: Safe notification using NocapUtils
     */
    function showNotification(message, type = 'info', duration = 3000) {
        if (window.NocapUtils && window.NocapUtils.showNotification) {
            window.NocapUtils.showNotification(message, type, duration);
            return;
        }

        // Fallback: Create notification element
        const container = document.body;

        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'polite');

        const notificationText = document.createElement('span');
        notificationText.textContent = String(message);

        notification.appendChild(notificationText);
        container.appendChild(notification);

        // Position it (fallback style)
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.padding = '15px 20px';
        notification.style.borderRadius = '10px';
        notification.style.color = 'white';
        notification.style.fontWeight = '600';
        notification.style.zIndex = '10001';
        notification.style.transform = 'translateX(400px)';
        notification.style.transition = 'transform 0.3s ease';

        if (type === 'success') notification.style.background = '#4CAF50';
        if (type === 'error') notification.style.background = '#F44336';
        if (type === 'warning') notification.style.background = '#FF9800';
        if (type === 'info') notification.style.background = '#2196F3';

        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });

        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, duration);
    }

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
