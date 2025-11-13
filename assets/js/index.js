/**
 * No-Cap Landing Page - Main Script
 * Handles age verification, game mode selection, and Firebase initialization
 */

// ===========================
// GLOBAL STATE
// ===========================
let ageVerified = false;
let isAdult = false;
let alcoholMode = false;
let gameState = null;

// ===========================
// AGE VERIFICATION
// ===========================

/**
 * Show age verification modal
 */
function showAgeModal() {
    const modal = document.getElementById('age-modal');
    const mainApp = document.getElementById('main-app');

    if (modal && mainApp) {
        modal.style.display = 'flex';
        mainApp.style.filter = 'blur(5px)';
        mainApp.style.pointerEvents = 'none';
    }
}

/**
 * Hide age verification modal
 */
function hideAgeModal() {
    const modal = document.getElementById('age-modal');
    const mainApp = document.getElementById('main-app');

    if (modal && mainApp) {
        modal.style.display = 'none';
        mainApp.style.filter = 'none';
        mainApp.style.pointerEvents = 'auto';
    }
}

/**
 * Save age verification to localStorage
 */
function saveVerification(isAdultUser, allowAlcohol) {
    const verification = {
        ageVerified: true,
        isAdult: isAdultUser,
        alcoholMode: allowAlcohol,
        timestamp: Date.now()
    };

    try {
        localStorage.setItem('nocap_age_verification', JSON.stringify(verification));
        ageVerified = true;
        isAdult = isAdultUser;
        alcoholMode = allowAlcohol;

        console.log('✅ Age verification saved:', verification);
    } catch (error) {
        console.error('❌ Could not save age verification:', error);
    }
}

/**
 * Load age verification from localStorage
 */
function loadVerification() {
    try {
        const saved = localStorage.getItem('nocap_age_verification');

        if (!saved) {
            return false;
        }

        const verification = JSON.parse(saved);
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        // Check if verification is still valid (24 hours)
        if (verification.timestamp && now - verification.timestamp < oneDay) {
            ageVerified = verification.ageVerified || false;
            isAdult = verification.isAdult || false;
            alcoholMode = verification.alcoholMode || false;

            console.log('✅ Age verification loaded:', verification);
            return true;
        } else {
            console.log('⚠️ Age verification expired');
            localStorage.removeItem('nocap_age_verification');
            return false;
        }
    } catch (error) {
        console.error('❌ Could not load age verification:', error);
        return false;
    }
}

/**
 * Update UI based on age verification (alcohol-free mode)
 */
function updateUIForVerification() {
    if (!alcoholMode) {
        // Update UI for alcohol-free mode
        const drinkIcon = document.getElementById('drink-icon');
        const drinkText = document.getElementById('drink-text');
        const step4Text = document.getElementById('step4-text');

        if (drinkIcon) {
            drinkIcon.textContent = '🎯';
        }

        if (drinkText) {
            drinkText.textContent = 'Bekomme Challenges bei falschen Schätzungen';
        }

        if (step4Text) {
            step4Text.textContent = 'Wer falsch lag, bekommt eine Challenge!';
        }
    }
}

// ===========================
// FIREBASE INITIALIZATION
// ===========================

/**
 * Initialize Firebase authentication
 */
async function initializeFirebase() {
    if (!window.authService) {
        console.warn('⚠️ Firebase authService not available');
        return;
    }

    try {
        await authService.initialize();
        console.log('✅ Firebase Auth initialized');

        // Check if user is already authenticated
        if (!authService.isUserAuthenticated()) {
            // Automatically sign in anonymously for immediate gameplay
            const result = await authService.signInAnonymously();
            if (result.success) {
                console.log('✅ Anonymous user created:', result.userId);
            } else {
                console.error('❌ Anonymous sign-in failed');
            }
        } else {
            console.log('✅ User already authenticated:', authService.getUserId());
        }
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        // App continues to work in offline mode
    }
}

// ===========================
// GAME MODE SELECTION
// ===========================

/**
 * Start single device mode
 */
function startSingleDevice() {
    if (!ageVerified) {
        showNotification('Bitte bestätige zuerst dein Alter', 'warning');
        return;
    }

    // Set device mode
    gameState.deviceMode = 'single';
    gameState.alcoholMode = alcoholMode;
    gameState.save();

    // Save age settings
    localStorage.setItem('nocap_alcohol_mode', alcoholMode.toString());
    localStorage.setItem('nocap_is_adult', isAdult.toString());

    console.log('🎮 Starting single device mode');
    window.location.href = 'category-selection.html';
}

/**
 * Start multiplayer mode
 */
function startMultiplayer() {
    if (!ageVerified) {
        showNotification('Bitte bestätige zuerst dein Alter', 'warning');
        return;
    }

    // Set device mode
    gameState.deviceMode = 'multi';
    gameState.alcoholMode = alcoholMode;
    gameState.save();

    // Save age settings
    localStorage.setItem('nocap_alcohol_mode', alcoholMode.toString());
    localStorage.setItem('nocap_is_adult', isAdult.toString());

    console.log('🌐 Starting multiplayer mode');
    window.location.href = 'multiplayer-category-selection.html';
}

/**
 * Join existing game
 */
function joinGame() {
    if (!ageVerified) {
        showNotification('Bitte bestätige zuerst dein Alter', 'warning');
        return;
    }

    // Set device mode
    gameState.deviceMode = 'multi';
    gameState.alcoholMode = alcoholMode;
    gameState.isGuest = true;
    gameState.save();

    // Save age settings
    localStorage.setItem('nocap_alcohol_mode', alcoholMode.toString());
    localStorage.setItem('nocap_is_adult', isAdult.toString());

    console.log('🔗 Joining multiplayer game');
    window.location.href = 'join-game.html';
}

// ===========================
// NOTIFICATION SYSTEM
// ===========================

/**
 * Show toast notification
 */
function showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.toast-notification').forEach(n => n.remove());

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `toast-notification ${type}`;

    // Get icon based on type
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    else if (type === 'warning') icon = '⚠️';
    else if (type === 'error') icon = '❌';

    // Sanitize message
    const sanitizedMessage = DOMPurify.sanitize(message, { ALLOWED_TAGS: [] });

    // Build notification HTML
    const html = `
        <div class="toast-content">
            <div class="toast-icon">${icon}</div>
            <div class="toast-message">${sanitizedMessage}</div>
        </div>
    `;

    notification.innerHTML = DOMPurify.sanitize(html);

    // Add to DOM
    document.body.appendChild(notification);

    // Show with animation
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

// ===========================
// ANIMATION HELPERS
// ===========================

/**
 * Animate mode cards on page load
 */
function animateCards() {
    setTimeout(() => {
        document.querySelectorAll('.mode-card').forEach((card, index) => {
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

/**
 * Smooth scroll to section
 */
function smoothScrollTo(target) {
    const element = document.querySelector(target);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// ===========================
// URL PARAMETER HANDLING
// ===========================

/**
 * Handle direct game join via URL parameter
 */
function handleDirectJoin() {
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('gameId');

    if (gameId) {
        console.log('🔗 Direct join detected for game:', gameId);

        // Wait for age verification
        const checkInterval = setInterval(() => {
            if (ageVerified) {
                clearInterval(checkInterval);
                window.location.href = `join-game.html?gameId=${encodeURIComponent(gameId)}`;
            }
        }, 100);

        // Timeout after 10 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!ageVerified) {
                console.warn('⚠️ Age verification timeout for direct join');
            }
        }, 10000);
    }
}

// ===========================
// EVENT LISTENERS
// ===========================

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Age checkbox
    const ageCheckbox = document.getElementById('age-checkbox');
    const btn18Plus = document.getElementById('btn-18plus');

    if (ageCheckbox && btn18Plus) {
        ageCheckbox.addEventListener('change', function() {
            btn18Plus.disabled = !this.checked;

            if (this.checked) {
                btn18Plus.classList.add('enabled');
            } else {
                btn18Plus.classList.remove('enabled');
            }
        });
    }

    // 18+ button
    if (btn18Plus) {
        btn18Plus.addEventListener('click', function() {
            const checkbox = document.getElementById('age-checkbox');
            if (checkbox && checkbox.checked) {
                saveVerification(true, true);
                updateUIForVerification();
                hideAgeModal();
                animateCards();
                showNotification('Spiel mit allen Inhalten verfügbar', 'success');
            }
        });
    }

    // Under 18 button
    const btnUnder18 = document.getElementById('btn-under-18');
    if (btnUnder18) {
        btnUnder18.addEventListener('click', function() {
            saveVerification(false, false);
            updateUIForVerification();
            hideAgeModal();
            animateCards();
            showNotification('Jugendschutz-Modus aktiviert - FSK 18+ Inhalte sind ausgeblendet', 'info');
        });
    }

    // Game mode buttons
    const btnSingle = document.getElementById('btn-single');
    if (btnSingle) {
        btnSingle.addEventListener('click', startSingleDevice);
    }

    const btnMulti = document.getElementById('btn-multi');
    if (btnMulti) {
        btnMulti.addEventListener('click', startMultiplayer);
    }

    const btnJoin = document.getElementById('btn-join');
    if (btnJoin) {
        btnJoin.addEventListener('click', joinGame);
    }

    // Mode cards (click on card itself)
    const modeSingle = document.getElementById('mode-single');
    if (modeSingle) {
        modeSingle.addEventListener('click', function(e) {
            if (e.target.tagName !== 'BUTTON') {
                startSingleDevice();
            }
        });
    }

    const modeMulti = document.getElementById('mode-multi');
    if (modeMulti) {
        modeMulti.addEventListener('click', function(e) {
            if (e.target.tagName !== 'BUTTON') {
                startMultiplayer();
            }
        });
    }

    const modeJoin = document.getElementById('mode-join');
    if (modeJoin) {
        modeJoin.addEventListener('click', function(e) {
            if (e.target.tagName !== 'BUTTON') {
                joinGame();
            }
        });
    }

    // Scroll indicator
    const scrollIndicator = document.getElementById('scroll-indicator');
    if (scrollIndicator) {
        scrollIndicator.addEventListener('click', function() {
            smoothScrollTo('.game-modes');
        });
    }
}

// ===========================
// INITIALIZATION
// ===========================

/**
 * Main initialization function
 */
async function initialize() {
    console.log('🧢 No-Cap Landing Page loading...');

    // Initialize GameState
    if (typeof GameState !== 'undefined') {
        gameState = new GameState();
        console.log('✅ GameState initialized');
    } else {
        console.error('❌ GameState class not found!');
        showNotification('Fehler beim Laden der Spieldaten', 'error');
        return;
    }

    // Check for existing age verification
    if (loadVerification()) {
        updateUIForVerification();
        hideAgeModal();
        animateCards();
    } else {
        showAgeModal();
    }

    // Setup event listeners
    setupEventListeners();

    // Initialize Firebase
    await initializeFirebase();

    // Handle direct game join via URL
    handleDirectJoin();

    console.log('✅ No-Cap Landing Page ready!');
}

// ===========================
// DOM READY
// ===========================

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}