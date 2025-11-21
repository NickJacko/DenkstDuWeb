// ===== NO-CAP CATEGORY SELECTION (SINGLE DEVICE MODE) =====
// Version: 3.1 - Security Hardened with XSS Protection & Encoding Fixed
// Mode: Single Device - Category Selection with Age-Gate & Premium

'use strict';

// ===== CATEGORY DATA =====
const categoryData = {
    fsk0: {
        name: 'Familie & Freunde',
        icon: '👨‍👩‍👧‍👦',
        color: '#4CAF50'
    },
    fsk16: {
        name: 'Party Time',
        icon: '🎉',
        color: '#FF9800'
    },
    fsk18: {
        name: 'Heiß & Gewagt',
        icon: '🔥',
        color: '#F44336'
    },
    special: {
        name: 'Special Edition',
        icon: '⭐',
        color: '#FFD700'
    }
};

// ===== GLOBAL VARIABLES =====
let gameState = null;
let selectedCategories = [];
let isAdult = false;
let hasPremium = false;
let questionCounts = {
    fsk0: 0,
    fsk16: 0,
    fsk18: 0,
    special: 0
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initCategorySelection();
});

async function initCategorySelection() {
    log('🎯 Initializing category selection...');

    showLoading();

    // Load central GameState
    if (typeof GameState === 'undefined') {
        log('❌ GameState not found - Load central version', 'error');
        showNotification('Fehler beim Laden. Bitte Seite neu laden.', 'error');
        return;
    }

    gameState = new GameState();

    // Validate game state
    if (!validateGameState()) {
        return;
    }

    // Check age verification
    checkAgeVerification();

    // Check premium status (Firebase optional)
    await checkPremiumStatus();

    // Load question counts from Firebase
    await loadQuestionCounts();

    // Load previously selected categories if any
    if (gameState.selectedCategories && gameState.selectedCategories.length > 0) {
        selectedCategories = [...gameState.selectedCategories];
        selectedCategories.forEach(category => {
            const card = document.querySelector(`[data-category="${category}"]`);
            if (card && !card.classList.contains('locked')) {
                card.classList.add('selected');
            }
        });
        updateSelectionSummary();
    }

    // Setup event listeners
    setupEventListeners();

    hideLoading();

    log('✅ Category selection initialized');
    log('📋 Current state:', {
        deviceMode: gameState.deviceMode,
        selectedCategories: gameState.selectedCategories,
        isAdult: isAdult,
        hasPremium: hasPremium
    });
}

// ===== VALIDATION & GUARDS =====
function validateGameState() {
    // Check device mode
    if (gameState.deviceMode !== 'single') {
        log('❌ Wrong device mode, redirecting to index', 'error');
        showNotification('Falscher Spielmodus. Zurück zur Startseite...', 'warning');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return false;
    }
    return true;
}

function checkAgeVerification() {
    try {
        // Load from localStorage
        const ageData = localStorage.getItem('nocap_age_verification');

        if (!ageData) {
            log('⚠️ No age verification found, redirecting', 'warning');
            window.location.href = 'index.html';
            return;
        }

        const verification = JSON.parse(ageData);
        isAdult = verification.isAdult || false;

        log(`✅ Age verification loaded: ${isAdult ? '18+' : 'U18'}`);

        // Lock FSK18 category if not adult
        if (!isAdult) {
            const fsk18Card = document.querySelector('[data-category="fsk18"]');
            if (fsk18Card) {
                fsk18Card.classList.add('locked');
            }

            const fsk18Locked = document.getElementById('fsk18-locked');
            if (fsk18Locked) {
                fsk18Locked.style.display = 'flex';
            }
        }

    } catch (error) {
        log(`❌ Error loading age verification: ${error.message}`, 'error');
        window.location.href = 'index.html';
    }
}

async function checkPremiumStatus() {
    try {
        // Check if Firebase is available
        if (typeof firebase === 'undefined' || !firebase.database) {
            log('⚠️ Firebase not available, premium check skipped');
            return;
        }

        // Check if authService is available
        if (typeof authService === 'undefined' || !authService.getUserId) {
            log('⚠️ Auth service not available, premium check skipped');
            return;
        }

        const userId = authService.getUserId();
        if (!userId) {
            log('⚠️ No user ID, premium check skipped');
            return;
        }

        // Check for premium purchase
        const purchaseRef = firebase.database().ref(`users/${userId}/purchases/special`);
        const snapshot = await purchaseRef.once('value');

        if (snapshot.exists()) {
            hasPremium = true;
            log('✅ Premium status: Active');

            // Unlock special category
            const specialCard = document.querySelector('[data-category="special"]');
            if (specialCard) {
                specialCard.classList.remove('locked');
            }

            const specialLocked = document.getElementById('special-locked');
            if (specialLocked) {
                specialLocked.style.display = 'none';
            }
        } else {
            log('ℹ️ Premium status: Not purchased');
        }

    } catch (error) {
        log(`⚠️ Premium check error: ${error.message}`, 'warning');
        // Continue without premium
    }
}

async function loadQuestionCounts() {
    try {
        // Check if Firebase is available
        if (typeof firebase === 'undefined' || !firebase.database) {
            log('⚠️ Firebase not available, using fallback counts');
            useFallbackCounts();
            return;
        }

        const questionsRef = firebase.database().ref('questions');
        const snapshot = await questionsRef.once('value');

        if (snapshot.exists()) {
            const questions = snapshot.val();

            Object.keys(categoryData).forEach(category => {
                const categoryQuestions = questions[category];
                if (categoryQuestions && Array.isArray(categoryQuestions)) {
                    questionCounts[category] = categoryQuestions.length;
                } else {
                    questionCounts[category] = getFallbackCount(category);
                }

                updateQuestionCountUI(category, questionCounts[category]);
            });

            log('✅ Question counts loaded from Firebase');
        } else {
            log('⚠️ No questions found in Firebase, using fallbacks');
            useFallbackCounts();
        }

    } catch (error) {
        log(`⚠️ Error loading question counts: ${error.message}`, 'warning');
        useFallbackCounts();
    }
}

function useFallbackCounts() {
    Object.keys(categoryData).forEach(category => {
        questionCounts[category] = getFallbackCount(category);
        updateQuestionCountUI(category, questionCounts[category]);
    });
    log('✅ Using fallback question counts');
}

function getFallbackCount(category) {
    const fallbacks = { fsk0: 200, fsk16: 300, fsk18: 250, special: 150 };
    return fallbacks[category] || 0;
}

function updateQuestionCountUI(category, count) {
    const countElement = document.querySelector(`[data-category-count="${category}"]`);
    if (countElement) {
        // XSS-SAFE: textContent instead of innerHTML
        countElement.textContent = `~${count} Fragen`;
    }
}

// ===== CATEGORY SELECTION =====
function toggleCategory(element) {
    const category = element.dataset.category;
    if (!category) return;

    // Validate category exists in categoryData
    if (!categoryData[category]) {
        log(`❌ Invalid category: ${category}`, 'error');
        return;
    }

    // Check if category is locked
    if (element.classList.contains('locked')) {
        if (category === 'fsk18') {
            showNotification('Du musst 18+ sein für diese Kategorie', 'warning');
        } else if (category === 'special') {
            showPremiumInfo();
        }
        return;
    }

    // Toggle selection
    if (selectedCategories.includes(category)) {
        // Remove category
        selectedCategories = selectedCategories.filter(c => c !== category);
        element.classList.remove('selected');
        showNotification(`${categoryData[category].name} entfernt`, 'info');
    } else {
        // Add category
        selectedCategories.push(category);
        element.classList.add('selected');
        showNotification(`${categoryData[category].name} ausgewählt!`, 'success');
    }

    updateSelectionSummary();
}

// ===== SELECTION SUMMARY =====
function updateSelectionSummary() {
    const summaryElement = document.getElementById('selection-summary');
    const categoriesListElement = document.getElementById('selected-categories-list');
    const totalQuestionsElement = document.getElementById('total-questions');
    const continueBtn = document.getElementById('continue-btn');
    const continueHint = document.querySelector('.continue-hint');

    if (!summaryElement || !categoriesListElement || !totalQuestionsElement || !continueBtn || !continueHint) {
        return;
    }

    if (selectedCategories.length === 0) {
        summaryElement.style.display = 'none';
        continueBtn.disabled = true;
        continueHint.textContent = 'Wähle mindestens eine Kategorie aus';
    } else {
        summaryElement.style.display = 'block';
        continueBtn.disabled = false;
        continueHint.textContent = `${selectedCategories.length} Kategorie${selectedCategories.length > 1 ? 'n' : ''} ausgewählt`;

        // XSS-SAFE: Build list using DOM manipulation instead of innerHTML
        categoriesListElement.innerHTML = ''; // Clear first

        selectedCategories.forEach(category => {
            const data = categoryData[category];
            if (!data) return; // Skip invalid categories

            // Create tag element
            const tag = document.createElement('div');
            tag.className = 'selected-category-tag';

            const iconSpan = document.createElement('span');
            iconSpan.textContent = data.icon;

            const nameSpan = document.createElement('span');
            nameSpan.textContent = data.name;

            tag.appendChild(iconSpan);
            tag.appendChild(nameSpan);
            categoriesListElement.appendChild(tag);
        });

        // Calculate total questions
        const totalQuestions = selectedCategories.reduce((sum, category) => {
            return sum + (questionCounts[category] || 0);
        }, 0);
        totalQuestionsElement.textContent = totalQuestions;
    }

    // Save to game state
    gameState.selectedCategories = [...selectedCategories];
    gameState.save();
}

// ===== PREMIUM MODAL =====
function showPremiumInfo(event) {
    if (event) {
        event.stopPropagation();
    }
    const modal = document.getElementById('premium-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closePremiumModal() {
    const modal = document.getElementById('premium-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function purchasePremium() {
    showNotification('Premium-Kauf wird vorbereitet...', 'info');

    try {
        // Check if Firebase and auth are available
        if (typeof firebase === 'undefined' || !firebase.database) {
            showNotification('Firebase nicht verfügbar. Bitte später versuchen.', 'error');
            return;
        }

        if (typeof authService === 'undefined' || !authService.getUserId) {
            showNotification('Bitte erstelle zuerst einen Account', 'warning');
            return;
        }

        const userId = authService.getUserId();
        if (!userId) {
            showNotification('Bitte erstelle zuerst einen Account', 'warning');
            return;
        }

        // Simulate purchase (replace with real payment gateway)
        const purchaseRef = firebase.database().ref(`users/${userId}/purchases/special`);
        await purchaseRef.set({
            id: 'special_edition',
            name: 'Special Edition',
            price: 2.99,
            currency: 'EUR',
            timestamp: Date.now()
        });

        hasPremium = true;

        // Unlock special category
        const specialCard = document.querySelector('[data-category="special"]');
        if (specialCard) {
            specialCard.classList.remove('locked');
            const lockedOverlay = document.getElementById('special-locked');
            if (lockedOverlay) {
                lockedOverlay.style.display = 'none';
            }
        }

        closePremiumModal();
        showNotification('Premium freigeschaltet! 🎉', 'success');

        log('✅ Premium purchased successfully');

    } catch (error) {
        log(`❌ Purchase error: ${error.message}`, 'error');
        showNotification('Fehler beim Kauf. Bitte versuche es später erneut.', 'error');
    }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Category cards
    document.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', function() {
            toggleCategory(this);
        });
    });

    // Continue button
    const continueBtn = document.getElementById('continue-btn');
    if (continueBtn) {
        continueBtn.addEventListener('click', proceedWithCategories);
    }

    // Back button
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', goBack);
    }

    // Premium modal
    const closePremiumBtn = document.getElementById('close-premium-modal');
    if (closePremiumBtn) {
        closePremiumBtn.addEventListener('click', closePremiumModal);
    }

    const purchasePremiumBtn = document.getElementById('purchase-premium-btn');
    if (purchasePremiumBtn) {
        purchasePremiumBtn.addEventListener('click', purchasePremium);
    }

    // ESC key closes modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closePremiumModal();
        }
    });
}

// ===== NAVIGATION =====
function proceedWithCategories() {
    if (selectedCategories.length === 0) {
        showNotification('Bitte wähle mindestens eine Kategorie aus', 'warning');
        return;
    }

    log('🚀 Proceeding with categories:', selectedCategories);

    showLoading();

    // Save categories to game state
    gameState.selectedCategories = [...selectedCategories];
    gameState.save();

    setTimeout(() => {
        window.location.href = 'difficulty-selection.html';
    }, 500);
}

function goBack() {
    log('⬅️ Going back to index');
    showLoading();
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 300);
}

// ===== UTILITY FUNCTIONS =====
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

// XSS-SAFE: Notification using DOM manipulation
function showNotification(message, type = 'info', duration = 3000) {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const notificationContent = document.createElement('div');
    notificationContent.className = 'notification-content';

    const notificationText = document.createElement('span');
    notificationText.className = 'notification-text';
    // XSS-SAFE: Sanitize message by removing HTML tags and using textContent
    const sanitizedMessage = String(message).replace(/<[^>]*>/g, '');
    notificationText.textContent = sanitizedMessage;

    notificationContent.appendChild(notificationText);
    notification.appendChild(notificationContent);

    const container = document.getElementById('notification-container') || document.body;
    container.appendChild(notification);

    // Show animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Auto remove
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, duration);
}

function log(message, type = 'info') {
    const colors = {
        info: '#4488ff',
        warning: '#ffaa00',
        error: '#ff4444',
        success: '#00ff00'
    };

    console.log(`%c[CategorySelection] ${message}`, `color: ${colors[type] || colors.info}`);
}

// ===== DEBUG FUNCTIONS =====
window.debugCategorySelection = function() {
    console.log('🔍 === CATEGORY SELECTION DEBUG ===');
    console.log('GameState:', gameState?.getDebugInfo?.());
    console.log('Selected Categories:', selectedCategories);
    console.log('Question Counts:', questionCounts);
    console.log('Is Adult:', isAdult);
    console.log('Has Premium:', hasPremium);
    console.log('LocalStorage:', localStorage.getItem('nocap_game_state'));
};

log('✅ No-Cap Category Selection v3.1 - XSS Protected & Encoding Fixed!');
log('🛠️ Debug: debugCategorySelection()');