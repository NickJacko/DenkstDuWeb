// ===== NO-CAP LANDING PAGE =====
// Version: 2.0 - Refactored with central GameState
// Landing Page with Age-Gate, Mode Selection & Alcohol Toggle

'use strict';

// ===== GLOBAL VARIABLES =====
let gameState = null;
let ageVerified = false;
let isAdult = false;
let alcoholMode = false;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async function() {
    initLandingPage();
});

async function initLandingPage() {
    log('🧢 No-Cap Landing Page loaded');

    // Load central GameState
    if (typeof GameState === 'undefined') {
        log('❌ GameState not found - Load central version', 'error');
        showNotification('Fehler beim Laden. Bitte Seite neu laden.', 'error');
        return;
    }

    gameState = GameState.load();

    // Initialize Firebase Auth
    await initializeFirebaseAuth();

    // Check for existing age verification
    const hasExistingVerification = checkExistingVerification();

    if (hasExistingVerification) {
        // User already verified, skip modal
        updateUIForVerification();
        hideAgeModal();
        animateCards();
    } else {
        // Show age modal for first-time users
        showAgeModal();
    }

    // Setup event listeners
    setupEventListeners();

    // Handle URL parameters for direct game joining
    handleURLParameters();

    log('✅ Landing page initialized');
}

// ===== FIREBASE AUTHENTICATION =====
async function initializeFirebaseAuth() {
    try {
        // Check if authService is available
        if (typeof authService === 'undefined' || !authService.initialize) {
            log('⚠️ Auth service not available, continuing in offline mode', 'warning');
            return;
        }

        await authService.initialize();
        log('✅ Firebase Auth initialized');

        // Check if user already authenticated
        if (!authService.isUserAuthenticated()) {
            // Automatically sign in anonymously for immediate play
            const result = await authService.signInAnonymously();
            if (result.success) {
                log(`✅ Anonymous user created: ${result.userId}`);
            } else {
                log('❌ Anonymous sign-in failed', 'error');
            }
        } else {
            log(`✅ User already authenticated: ${authService.getUserId()}`);
        }
    } catch (error) {
        log(`❌ Firebase initialization error: ${error.message}`, 'error');
        // App works anyway in offline mode
    }
}

// ===== AGE VERIFICATION =====
function checkExistingVerification() {
    try {
        const savedVerification = localStorage.getItem('nocap_age_verification');
        if (!savedVerification) {
            return false;
        }

        const verification = JSON.parse(savedVerification);
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        // Check if verification is still valid (24 hours)
        if (now - verification.timestamp < oneDay) {
            ageVerified = verification.ageVerified || false;
            isAdult = verification.isAdult || false;
            alcoholMode = verification.alcoholMode || false;

            log('✅ Age verification loaded from storage', 'success');
            log(`📋 Age verified: ${ageVerified}, Is adult: ${isAdult}, Alcohol mode: ${alcoholMode}`);
            return true;
        } else {
            log('⚠️ Age verification expired', 'warning');
            localStorage.removeItem('nocap_age_verification');
            return false;
        }
    } catch (error) {
        log(`❌ Error checking verification: ${error.message}`, 'error');
        return false;
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

    log('✅ Age verification saved', 'success');
    log(`📋 Is adult: ${isAdultUser}, Alcohol mode: ${allowAlcohol}`);
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

        log('✅ UI updated for alcohol-free mode');
    }
}

function showAgeModal() {
    const modal = document.getElementById('age-modal');
    const mainApp = document.getElementById('main-app');

    if (modal) modal.style.display = 'flex';
    if (mainApp) {
        mainApp.style.filter = 'blur(5px)';
        mainApp.style.pointerEvents = 'none';
    }
}

function hideAgeModal() {
    const modal = document.getElementById('age-modal');
    const mainApp = document.getElementById('main-app');

    if (modal) modal.style.display = 'none';
    if (mainApp) {
        mainApp.style.filter = 'none';
        mainApp.style.pointerEvents = 'auto';
    }
}

// ===== EVENT LISTENERS SETUP =====
function setupEventListeners() {
    log('🔧 Setting up event listeners...');

    // Age checkbox handling
    const ageCheckbox = document.getElementById('age-checkbox');
    if (ageCheckbox) {
        ageCheckbox.addEventListener('change', handleAgeCheckbox);
    }

    // Age verification buttons
    const btn18Plus = document.getElementById('btn-18plus');
    if (btn18Plus) {
        btn18Plus.addEventListener('click', handleAdultVerification);
    }

    const btnUnder18 = document.getElementById('btn-under-18');
    if (btnUnder18) {
        btnUnder18.addEventListener('click', handleMinorVerification);
    }

    // Mode selection - using delegation
    document.addEventListener('click', function(e) {
        // Single device mode
        if (e.target.closest('.mode-card:not(.featured):not([onclick*="join"])')) {
            const card = e.target.closest('.mode-card');
            if (card && card.textContent.includes('Ein Gerät')) {
                startSingleDevice();
            }
        }
        // Multiplayer mode (featured card)
        else if (e.target.closest('.mode-card.featured')) {
            startMultiplayer();
        }
        // Join game
        else if (e.target.closest('.mode-card') && e.target.closest('.mode-card').textContent.includes('beitreten')) {
            joinGame();
        }

        // Scroll indicator
        if (e.target.closest('.scroll-indicator')) {
            const gameModes = document.querySelector('.game-modes');
            if (gameModes) {
                gameModes.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

    log('✅ Event listeners setup complete');
}

function handleAgeCheckbox(e) {
    const btn18Plus = document.getElementById('btn-18plus');
    if (!btn18Plus) return;

    btn18Plus.disabled = !e.target.checked;

    if (e.target.checked) {
        btn18Plus.classList.add('enabled');
    } else {
        btn18Plus.classList.remove('enabled');
    }
}

function handleAdultVerification() {
    const checkbox = document.getElementById('age-checkbox');
    if (!checkbox || !checkbox.checked) {
        showNotification('Bitte bestätige zuerst die Checkbox', 'warning');
        return;
    }

    saveVerification(true, true);
    updateUIForVerification();
    hideAgeModal();
    animateCards();
    showNotification('Spiel mit allen Inhalten verfügbar', 'success');

    log('✅ Adult verification completed');
}

function handleMinorVerification() {
    saveVerification(false, false);
    updateUIForVerification();
    hideAgeModal();
    animateCards();
    showNotification('Jugendschutz-Modus aktiviert - FSK 18+ Inhalte sind ausgeblendet', 'info');

    log('✅ Minor verification completed (alcohol-free mode)');
}

// ===== GAME MODE SELECTION =====
function startSingleDevice() {
    if (!ageVerified) {
        showNotification('Bitte bestätige zuerst dein Alter', 'warning');
        return;
    }

    gameState.deviceMode = 'single';
    gameState.save();

    localStorage.setItem('nocap_alcohol_mode', alcoholMode.toString());
    localStorage.setItem('nocap_is_adult', isAdult.toString());

    log('🎮 Starting single device mode');
    window.location.href = 'category-selection.html';
}

function startMultiplayer() {
    if (!ageVerified) {
        showNotification('Bitte bestätige zuerst dein Alter', 'warning');
        return;
    }

    gameState.deviceMode = 'multi';
    gameState.save();

    localStorage.setItem('nocap_alcohol_mode', alcoholMode.toString());
    localStorage.setItem('nocap_is_adult', isAdult.toString());

    log('🌐 Starting multiplayer mode');
    window.location.href = 'multiplayer-category-selection.html';
}

function joinGame() {
    if (!ageVerified) {
        showNotification('Bitte bestätige zuerst dein Alter', 'warning');
        return;
    }

    gameState.deviceMode = 'multi';
    gameState.save();

    localStorage.setItem('nocap_alcohol_mode', alcoholMode.toString());
    localStorage.setItem('nocap_is_adult', isAdult.toString());

    log('🔗 Joining multiplayer game');
    window.location.href = 'join-game.html';
}

// ===== URL PARAMETERS HANDLING =====
function handleURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('gameId');

    if (gameId) {
        log(`🔗 Direct game join detected: ${gameId}`);

        // Wait for age verification, then redirect
        const checkVerification = setInterval(() => {
            if (ageVerified) {
                clearInterval(checkVerification);
                log(`🚀 Redirecting to join-game with ID: ${gameId}`);
                window.location.href = `join-game.html?gameId=${gameId}`;
            }
        }, 100);
    }
}

// ===== ANIMATIONS =====
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

// ===== UTILITY FUNCTIONS =====
function showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.toast-notification').forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `toast-notification ${type}`;

    const iconMap = {
        'success': '✅',
        'warning': '⚠️',
        'error': '❌',
        'info': 'ℹ️'
    };

    const toastContent = document.createElement('div');
    toastContent.className = 'toast-content';

    const toastIcon = document.createElement('div');
    toastIcon.className = 'toast-icon';
    toastIcon.textContent = iconMap[type] || 'ℹ️';

    const toastMessage = document.createElement('div');
    toastMessage.className = 'toast-message';
    toastMessage.textContent = message;

    toastContent.appendChild(toastIcon);
    toastContent.appendChild(toastMessage);
    notification.appendChild(toastContent);

    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function log(message, type = 'info') {
    const colors = {
        info: '#4488ff',
        warning: '#ffaa00',
        error: '#ff4444',
        success: '#00ff00'
    };

    console.log(`%c[Index] ${message}`, `color: ${colors[type] || colors.info}`);
}

// ===== DEBUG FUNCTIONS =====
window.debugIndex = function() {
    console.log('🔍 === INDEX (LANDING PAGE) DEBUG ===');
    console.log('GameState:', gameState?.getDebugInfo?.());
    console.log('Age Verified:', ageVerified);
    console.log('Is Adult:', isAdult);
    console.log('Alcohol Mode:', alcoholMode);
    console.log('LocalStorage:', {
        gameState: localStorage.getItem('nocap_game_state'),
        ageVerification: localStorage.getItem('nocap_age_verification'),
        alcoholMode: localStorage.getItem('nocap_alcohol_mode'),
        isAdult: localStorage.getItem('nocap_is_adult')
    });
};

log('✅ No-Cap Landing Page - JS loaded!');
log('🛠️ Debug: debugIndex()');