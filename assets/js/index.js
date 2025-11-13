/**
 * No-Cap Landing Page Logic
 * Refactored to follow CSP best practices
 * - No inline scripts
 * - DOMPurify for safe HTML injection
 * - Central GameState usage
 * - nocap_* localStorage keys only
 */

(function() {
    'use strict';

    // ==================== STATE MANAGEMENT ====================
    let ageVerified = false;
    let isAdult = false;
    let alcoholMode = false;
    let gameState = null;

    // ==================== INITIALIZATION ====================
    document.addEventListener('DOMContentLoaded', async function() {
        console.log('🧢 No-Cap Landing Page loaded (refactored)');

        try {
            // Initialize central GameState
            gameState = GameState.load();
            console.log('✅ GameState loaded:', gameState);
        } catch (error) {
            console.error('❌ GameState initialization failed:', error);
            gameState = new GameState();
        }

        // Initialize Firebase Auth
        await initializeFirebase();

        // Check existing age verification
        checkAgeVerification();

        // Setup event listeners
        setupEventListeners();
    });

    // ==================== FIREBASE INITIALIZATION ====================
    async function initializeFirebase() {
        try {
            if (typeof authService !== 'undefined') {
                await authService.initialize();
                console.log('✅ Firebase Auth initialized');

                // Auto-sign in anonymously if not authenticated
                if (!authService.isUserAuthenticated()) {
                    const result = await authService.signInAnonymously();
                    if (result.success) {
                        console.log('✅ Anonymous user created:', result.userId);
                    } else {
                        console.error('❌ Anonymous sign-in failed');
                    }
                } else {
                    console.log('✅ User already authenticated:', authService.getUserId());
                }
            } else {
                console.warn('⚠️ authService not available - offline mode');
            }
        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
            // App works in offline mode
        }
    }

    // ==================== AGE VERIFICATION ====================
    function checkAgeVerification() {
        const savedVerification = localStorage.getItem('nocap_age_verification');

        if (savedVerification) {
            try {
                const verification = JSON.parse(savedVerification);
                const now = Date.now();
                const oneDay = 24 * 60 * 60 * 1000;

                if (now - verification.timestamp < oneDay) {
                    ageVerified = verification.ageVerified || false;
                    isAdult = verification.isAdult || false;
                    alcoholMode = verification.alcoholMode || false;

                    updateUIForVerification();
                    hideAgeModal();
                    animateCards();
                    return;
                }
            } catch (error) {
                console.error('❌ Error parsing age verification:', error);
                localStorage.removeItem('nocap_age_verification');
            }
        }

        // Show age modal if no valid verification
        showAgeModal();
    }

    function showAgeModal() {
        const modal = document.getElementById('age-modal');
        const mainApp = document.getElementById('main-app');

        if (modal && mainApp) {
            modal.style.display = 'flex';
            mainApp.style.filter = 'blur(5px)';
            mainApp.style.pointerEvents = 'none';
        }
    }

    function hideAgeModal() {
        const modal = document.getElementById('age-modal');
        const mainApp = document.getElementById('main-app');

        if (modal && mainApp) {
            modal.style.display = 'none';
            mainApp.style.filter = 'none';
            mainApp.style.pointerEvents = 'auto';
        }
    }

    function saveVerification(isAdultUser, allowAlcohol) {
        const verification = {
            ageVerified: true,
            isAdult: isAdultUser,
            alcoholMode: allowAlcohol,
            timestamp: Date.now()
        };

        localStorage.setItem('nocap_age_verification', JSON.stringify(verification));

        ageVerified = true;
        isAdult = isAdultUser;
        alcoholMode = allowAlcohol;
    }

    function updateUIForVerification() {
        if (!alcoholMode) {
            // Update UI for alcohol-free mode
            const drinkIcon = document.getElementById('drink-icon');
            const drinkText = document.getElementById('drink-text');
            const step4Text = document.getElementById('step4-text');

            if (drinkIcon) drinkIcon.textContent = '🎯';
            if (drinkText) drinkText.textContent = 'Bekomme Challenges bei falschen Schätzungen';
            if (step4Text) step4Text.textContent = 'Wer falsch lag, bekommt eine Challenge!';
        }
    }

    // ==================== EVENT LISTENERS ====================
    function setupEventListeners() {
        // Age checkbox
        const ageCheckbox = document.getElementById('age-checkbox');
        if (ageCheckbox) {
            ageCheckbox.addEventListener('change', handleAgeCheckboxChange);
        }

        // Age verification buttons
        const btn18Plus = document.getElementById('btn-18plus');
        if (btn18Plus) {
            btn18Plus.addEventListener('click', handle18PlusClick);
        }

        const btnUnder18 = document.getElementById('btn-under-18');
        if (btnUnder18) {
            btnUnder18.addEventListener('click', handleUnder18Click);
        }

        // Game mode cards
        const modeSingle = document.getElementById('mode-single');
        if (modeSingle) {
            modeSingle.addEventListener('click', () => startGameMode('single'));
        }

        const modeMulti = document.getElementById('mode-multi');
        if (modeMulti) {
            modeMulti.addEventListener('click', () => startGameMode('multi'));
        }

        const modeJoin = document.getElementById('mode-join');
        if (modeJoin) {
            modeJoin.addEventListener('click', () => startGameMode('join'));
        }

        // Scroll indicator
        const scrollIndicator = document.getElementById('scroll-indicator');
        if (scrollIndicator) {
            scrollIndicator.addEventListener('click', handleScrollClick);
        }

        // Handle direct game join via URL
        handleDirectJoin();
    }

    // ==================== EVENT HANDLERS ====================
    function handleAgeCheckboxChange(e) {
        const btn18Plus = document.getElementById('btn-18plus');
        if (!btn18Plus) return;

        btn18Plus.disabled = !e.target.checked;

        if (e.target.checked) {
            btn18Plus.classList.add('enabled');
        } else {
            btn18Plus.classList.remove('enabled');
        }
    }

    function handle18PlusClick() {
        const ageCheckbox = document.getElementById('age-checkbox');
        if (!ageCheckbox || !ageCheckbox.checked) {
            showNotification('Bitte bestätige zuerst die Checkbox', 'warning');
            return;
        }

        saveVerification(true, true);
        updateUIForVerification();
        hideAgeModal();
        animateCards();
        showNotification('Spiel mit allen Inhalten verfügbar', 'success');
    }

    function handleUnder18Click() {
        saveVerification(false, false);
        updateUIForVerification();
        hideAgeModal();
        animateCards();
        showNotification('Jugendschutz-Modus aktiviert - FSK 18+ Inhalte sind ausgeblendet', 'info');
    }

    function handleScrollClick() {
        const gameModesSection = document.querySelector('.game-modes');
        if (gameModesSection) {
            gameModesSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // ==================== GAME MODE SELECTION ====================
    function startGameMode(mode) {
        if (!ageVerified) {
            showNotification('Bitte bestätige zuerst dein Alter', 'warning');
            return;
        }

        // Save age-related settings
        localStorage.setItem('nocap_alcohol_mode', alcoholMode.toString());
        localStorage.setItem('nocap_is_adult', isAdult.toString());

        switch (mode) {
            case 'single':
                startSingleDevice();
                break;
            case 'multi':
                startMultiplayer();
                break;
            case 'join':
                joinGame();
                break;
            default:
                console.error('Unknown game mode:', mode);
        }
    }

    function startSingleDevice() {
        gameState.setDeviceMode('single');
        console.log('🎮 Starting single device mode');
        window.location.href = 'category-selection.html';
    }

    function startMultiplayer() {
        gameState.setDeviceMode('multi');
        console.log('🌐 Starting multiplayer mode');
        window.location.href = 'multiplayer-category-selection.html';
    }

    function joinGame() {
        gameState.setDeviceMode('multi');
        console.log('🔗 Joining multiplayer game');
        window.location.href = 'join-game.html';
    }

    // ==================== DIRECT JOIN HANDLING ====================
    function handleDirectJoin() {
        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('gameId');

        if (gameId) {
            // Wait for age verification, then redirect
            const checkInterval = setInterval(() => {
                if (ageVerified) {
                    clearInterval(checkInterval);
                    window.location.href = `join-game.html?gameId=${gameId}`;
                }
            }, 100);

            // Timeout after 30 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                if (!ageVerified) {
                    showNotification('Bitte bestätige dein Alter, um dem Spiel beizutreten', 'warning');
                }
            }, 30000);
        }
    }

    // ==================== ANIMATIONS ====================
    function animateCards() {
        setTimeout(() => {
            const cards = document.querySelectorAll('.mode-card');
            cards.forEach((card, index) => {
                setTimeout(() => {
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(30px)';
                    card.style.transition = 'all 0.6s ease';

                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    }, 100);
                }, index * 200);
            });
        }, 500);
    }

    // ==================== NOTIFICATIONS ====================
    function showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.toast-notification').forEach(n => n.remove());

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `toast-notification ${type}`;

        // Icon based on type
        const iconMap = {
            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️'
        };
        const icon = iconMap[type] || 'ℹ️';

        // Sanitize message using DOMPurify
        const sanitizedMessage = DOMPurify.sanitize(message);

        // Build notification HTML
        const notificationHTML = `
            <div class="toast-content">
                <div class="toast-icon">${icon}</div>
                <div class="toast-message">${sanitizedMessage}</div>
            </div>
        `;

        notification.innerHTML = DOMPurify.sanitize(notificationHTML);

        // Add to DOM
        document.body.appendChild(notification);

        // Show animation
        setTimeout(() => notification.classList.add('show'), 100);

        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // ==================== UTILITY FUNCTIONS ====================
    function validateGameState() {
        if (!gameState) {
            console.error('❌ GameState not initialized');
            return false;
        }
        return true;
    }

    // ==================== EXPORTS (for debugging) ====================
    window.NoCap = window.NoCap || {};
    window.NoCap.index = {
        ageVerified: () => ageVerified,
        isAdult: () => isAdult,
        alcoholMode: () => alcoholMode,
        gameState: () => gameState,
        showNotification: showNotification
    };

})();