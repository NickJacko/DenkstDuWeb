// ===== NO-CAP CATEGORY SELECTION (SINGLE DEVICE MODE) =====
// Version: 2.0 - Refactored with central GameState
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

    gameState = GameState.load();

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
        log('❌ Not in single device mode', 'error');
        showNotification('Nicht im Einzelgerät-Modus. Weiterleitung...', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }

    return true;
}

// ===== EVENT LISTENERS SETUP =====
function setupEventListeners() {
    log('🔧 Setting up event listeners...');

    // Back button
    const backBtn = document.querySelector('.back-button');
    if (backBtn) {
        backBtn.addEventListener('click', goBack);
    }

    // Continue button
    const continueBtn = document.getElementById('continue-btn');
    if (continueBtn) {
        continueBtn.addEventListener('click', proceedWithCategories);
    }

    // Category cards - using delegation
    const categoryGrid = document.getElementById('category-grid');
    if (categoryGrid) {
        categoryGrid.addEventListener('click', function(e) {
            const card = e.target.closest('.category-card');
            if (card) {
                // Check if clicked on unlock button
                const unlockBtn = e.target.closest('.unlock-btn');
                if (unlockBtn) {
                    showPremiumInfo(e);
                    return;
                }
                toggleCategory(card);
            }
        });
    }

    // Modal close buttons
    const closeModalBtns = document.querySelectorAll('.close-btn');
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', closePremiumModal);
    });

    // Premium modal buttons
    const laterBtn = document.querySelector('.btn-outline');
    if (laterBtn && laterBtn.textContent.includes('Später')) {
        laterBtn.addEventListener('click', closePremiumModal);
    }

    const buyBtn = document.querySelector('.btn-premium');
    if (buyBtn) {
        buyBtn.addEventListener('click', purchasePremium);
    }

    log('✅ Event listeners setup complete');
}

// ===== AGE VERIFICATION =====
function checkAgeVerification() {
    try {
        const verification = localStorage.getItem('nocap_age_verification');
        if (verification) {
            const data = JSON.parse(verification);
            isAdult = data.isAdult || false;

            // Lock FSK 18 if user is under 18
            if (!isAdult) {
                const fsk18Card = document.querySelector('[data-category="fsk18"]');
                if (fsk18Card) {
                    fsk18Card.classList.add('locked');
                    const lockedOverlay = document.getElementById('fsk18-locked');
                    if (lockedOverlay) {
                        lockedOverlay.style.display = 'flex';
                    }
                }
                log('🔒 FSK 18 locked (user under 18)');
            } else {
                log('✅ FSK 18 unlocked (user 18+)');
            }
        } else {
            // If no verification found, lock FSK 18
            const fsk18Card = document.querySelector('[data-category="fsk18"]');
            if (fsk18Card) {
                fsk18Card.classList.add('locked');
                const lockedOverlay = document.getElementById('fsk18-locked');
                if (lockedOverlay) {
                    lockedOverlay.style.display = 'flex';
                }
            }
            log('⚠️ No age verification found, FSK 18 locked', 'warning');
        }
    } catch (error) {
        log(`❌ Error checking age verification: ${error.message}`, 'error');
    }
}

// ===== PREMIUM STATUS =====
async function checkPremiumStatus() {
    try {
        // Check if Firebase is available
        if (typeof firebase === 'undefined' || !firebase.database) {
            log('⚠️ Firebase not available, premium locked', 'warning');
            return;
        }

        // Check if auth service is available
        if (typeof authService === 'undefined' || !authService.getUserId) {
            log('⚠️ Auth service not available, premium locked', 'warning');
            return;
        }

        const userId = authService.getUserId();
        if (!userId) {
            log('⚠️ No user ID, premium locked', 'warning');
            return;
        }

        // Check in Firebase if user has premium
        const userRef = firebase.database().ref(`users/${userId}/purchases/special`);
        const snapshot = await userRef.once('value');

        if (snapshot.exists()) {
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
            log('✅ Premium unlocked');
        } else {
            log('🔒 Premium locked (not purchased)');
        }
    } catch (error) {
        log(`❌ Error checking premium status: ${error.message}`, 'error');
    }
}

// ===== QUESTION COUNTS =====
async function loadQuestionCounts() {
    try {
        // Check if Firebase is available
        if (typeof firebase === 'undefined' || !firebase.database) {
            log('⚠️ Firebase not available, using fallback counts', 'warning');
            useFallbackCounts();
            return;
        }

        const categories = ['fsk0', 'fsk16', 'fsk18', 'special'];

        for (const category of categories) {
            try {
                const questionsRef = firebase.database().ref(`questions/${category}`);
                const snapshot = await questionsRef.once('value');

                if (snapshot.exists()) {
                    const questions = snapshot.val();
                    const count = Object.keys(questions).length;
                    questionCounts[category] = count;

                    // Update UI
                    updateQuestionCountUI(category, count);

                    log(`✅ ${category}: ${count} questions`);
                } else {
                    // Fallback for this category
                    const fallbackCount = getFallbackCount(category);
                    questionCounts[category] = fallbackCount;
                    updateQuestionCountUI(category, fallbackCount);
                    log(`⚠️ No questions for ${category}, using fallback: ${fallbackCount}`, 'warning');
                }
            } catch (error) {
                log(`⚠️ Error loading ${category}: ${error.message}`, 'warning');
                const fallbackCount = getFallbackCount(category);
                questionCounts[category] = fallbackCount;
                updateQuestionCountUI(category, fallbackCount);
            }
        }

        // Update Special count in premium modal
        const specialCountEl = document.getElementById('special-question-count');
        if (specialCountEl) {
            specialCountEl.textContent = `${questionCounts.special}+`;
        }

        log('✅ Question counts loaded');

    } catch (error) {
        log(`❌ Error loading question counts: ${error.message}`, 'error');
        useFallbackCounts();
    }
}

function useFallbackCounts() {
    const fallbackCounts = {
        fsk0: 200,
        fsk16: 300,
        fsk18: 250,
        special: 150
    };

    Object.assign(questionCounts, fallbackCounts);

    Object.keys(fallbackCounts).forEach(category => {
        updateQuestionCountUI(category, fallbackCounts[category]);
    });

    log('📊 Using fallback question counts');
}

function getFallbackCount(category) {
    const fallbacks = { fsk0: 200, fsk16: 300, fsk18: 250, special: 150 };
    return fallbacks[category] || 0;
}

function updateQuestionCountUI(category, count) {
    const countElement = document.querySelector(`[data-category-count="${category}"]`);
    if (countElement) {
        countElement.innerHTML = `~${count} Fragen`;
    }
}

// ===== CATEGORY SELECTION =====
function toggleCategory(element) {
    const category = element.dataset.category;
    if (!category) return;

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

        // Build category list
        const categoriesHTML = selectedCategories.map(category => {
            const data = categoryData[category];
            return `
                <div class="selected-category-tag">
                    <span>${data.icon}</span>
                    <span>${data.name}</span>
                </div>
            `;
        }).join('');

        // Use DOMPurify if available
        if (typeof DOMPurify !== 'undefined') {
            categoriesListElement.innerHTML = DOMPurify.sanitize(categoriesHTML);
        } else {
            categoriesListElement.innerHTML = categoriesHTML;
        }

        // Calculate total questions
        const totalQuestions = selectedCategories.reduce((sum, category) => {
            return sum + questionCounts[category];
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

function showNotification(message, type = 'info', duration = 3000) {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const notificationContent = document.createElement('div');
    notificationContent.className = 'notification-content';

    const notificationText = document.createElement('span');
    notificationText.className = 'notification-text';
    notificationText.textContent = message;

    notificationContent.appendChild(notificationText);
    notification.appendChild(notificationContent);

    const container = document.getElementById('notification-container');
    if (container) {
        container.appendChild(notification);

        // Auto remove
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, duration);
    }
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

log('✅ No-Cap Category Selection - JS loaded!');
log('🛠️ Debug: debugCategorySelection()');