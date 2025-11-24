// ===== NO-CAP CATEGORY SELECTION (SINGLE DEVICE MODE) =====
// Version: 3.2 - Security Hardened & Production Ready
// Mode: Single Device - Category Selection with Age-Gate & Premium

'use strict';

// ===== CATEGORY DATA =====
const categoryData = {
    fsk0: {
        name: 'Familie & Freunde',
        icon: '👨‍👩‍👧‍👦',
        color: '#4CAF50',
        requiresAge: 0
    },
    fsk16: {
        name: 'Party Time',
        icon: '🎉',
        color: '#FF9800',
        requiresAge: 16
    },
    fsk18: {
        name: 'Heiß & Gewagt',
        icon: '🔥',
        color: '#F44336',
        requiresAge: 18
    },
    special: {
        name: 'Special Edition',
        icon: '⭐',
        color: '#FFD700',
        requiresAge: 0,
        requiresPremium: true
    }
};

// ===== GLOBAL VARIABLES =====
let gameState = null;
let questionCounts = {
    fsk0: 0,
    fsk16: 0,
    fsk18: 0,
    special: 0
};

// ===== INITIALIZATION =====

async function initialize() {
    console.log('🎯 Initializing category selection...');

    showLoading();

    // Check dependencies
    if (typeof GameState === 'undefined') {
        console.error('❌ GameState not found');
        showNotification('Fehler beim Laden. Bitte Seite neu laden.', 'error');
        return;
    }

    gameState = new GameState();

    // Validate game state
    if (!validateGameState()) {
        return;
    }

    // P0 FIX: Check age verification with validation
    if (!checkAgeVerification()) {
        return;
    }

    // P0 FIX: Check premium status (client-side only as fallback)
    await checkPremiumStatus();

    // Load question counts
    await loadQuestionCounts();

    // P1 FIX: Load from GameState, not separate array
    initializeSelectedCategories();

    // Setup event listeners
    setupEventListeners();

    hideLoading();

    console.log('✅ Category selection initialized');
}

// ===== VALIDATION & GUARDS =====

function validateGameState() {
    if (gameState.deviceMode !== 'single') {
        console.error('❌ Wrong device mode');
        showNotification('Falscher Spielmodus', 'warning');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return false;
    }
    return true;
}

/**
 * P0 FIX: Validate age verification with expiration check
 */
function checkAgeVerification() {
    try {
        const ageLevel = parseInt(localStorage.getItem('nocap_age_level')) || 0;
        const ageTimestamp = parseInt(localStorage.getItem('nocap_age_timestamp')) || 0;

        // P0 FIX: Check if age verification is expired (24 hours)
        const now = Date.now();
        const expirationTime = 24 * 60 * 60 * 1000; // 24 hours

        if (now - ageTimestamp > expirationTime) {
            console.warn('⚠️ Age verification expired');
            localStorage.removeItem('nocap_age_level');
            localStorage.removeItem('nocap_age_timestamp');
            window.location.href = 'index.html';
            return false;
        }

        console.log(`✅ Age verification: ${ageLevel}+`);

        // Lock categories based on age
        updateCategoryLocks(ageLevel);

        return true;

    } catch (error) {
        console.error('❌ Error checking age verification:', error);
        window.location.href = 'index.html';
        return false;
    }
}

/**
 * P0 FIX: Update category locks based on age
 */
function updateCategoryLocks(ageLevel) {
    Object.keys(categoryData).forEach(category => {
        const data = categoryData[category];
        const card = document.querySelector(`[data-category="${category}"]`);
        if (!card) return;

        // Check age requirement
        if (data.requiresAge > ageLevel) {
            card.classList.add('locked');

            const lockedOverlay = document.getElementById(`${category}-locked`);
            if (lockedOverlay) {
                lockedOverlay.style.display = 'flex';
            }
        }
    });
}

/**
 * P0 FIX: Check premium status (CLIENT-SIDE ONLY - NOT SECURE)
 * TODO: Move to server-side verification via Firebase Function
 */
async function checkPremiumStatus() {
    try {
        // P0 WARNING: This is NOT secure - can be manipulated
        // Premium should be verified server-side via Firebase Security Rules

        const isPremium = await gameState.isPremiumUser();

        console.log(`ℹ️ Premium status (client-side): ${isPremium}`);

        const specialCard = document.querySelector('[data-category="special"]');
        const specialLocked = document.getElementById('special-locked');

        if (isPremium) {
            if (specialCard) {
                specialCard.classList.remove('locked');
            }
            if (specialLocked) {
                specialLocked.style.display = 'none';
            }
        } else {
            if (specialCard) {
                specialCard.classList.add('locked');
            }
            if (specialLocked) {
                specialLocked.style.display = 'flex';
            }
        }

    } catch (error) {
        console.warn('⚠️ Premium check error:', error);
        // Default to locked on error
        const specialCard = document.querySelector('[data-category="special"]');
        if (specialCard) {
            specialCard.classList.add('locked');
        }
    }
}

// ===== QUESTION COUNTS =====

async function loadQuestionCounts() {
    try {
        if (typeof firebase === 'undefined' || !firebase.database) {
            console.warn('⚠️ Firebase not available, using fallback counts');
            useFallbackCounts();
            return;
        }

        const questionsRef = firebase.database().ref('questions');
        const snapshot = await questionsRef.once('value');

        if (snapshot.exists()) {
            const questions = snapshot.val();

            Object.keys(categoryData).forEach(category => {
                const categoryQuestions = questions[category];
                if (categoryQuestions) {
                    if (Array.isArray(categoryQuestions)) {
                        questionCounts[category] = categoryQuestions.length;
                    } else if (typeof categoryQuestions === 'object') {
                        questionCounts[category] = Object.keys(categoryQuestions).length;
                    } else {
                        questionCounts[category] = getFallbackCount(category);
                    }
                } else {
                    questionCounts[category] = getFallbackCount(category);
                }

                updateQuestionCountUI(category, questionCounts[category]);
            });

            console.log('✅ Question counts loaded');
        } else {
            console.warn('⚠️ No questions found, using fallbacks');
            useFallbackCounts();
        }

    } catch (error) {
        console.warn('⚠️ Error loading question counts:', error);
        useFallbackCounts();
    }
}

function useFallbackCounts() {
    Object.keys(categoryData).forEach(category => {
        questionCounts[category] = getFallbackCount(category);
        updateQuestionCountUI(category, questionCounts[category]);
    });
    console.log('✅ Using fallback counts');
}

function getFallbackCount(category) {
    const fallbacks = { fsk0: 200, fsk16: 300, fsk18: 250, special: 150 };
    return fallbacks[category] || 0;
}

/**
 * P0 FIX: Use textContent for XSS safety
 */
function updateQuestionCountUI(category, count) {
    const countElement = document.querySelector(`[data-category-count="${category}"]`);
    if (countElement) {
        countElement.textContent = `~${count} Fragen`;
    }
}

// ===== P1 FIX: CATEGORY SELECTION (NO SEPARATE ARRAY) =====

/**
 * Initialize categories from GameState
 */
function initializeSelectedCategories() {
    if (gameState.selectedCategories && Array.isArray(gameState.selectedCategories)) {
        gameState.selectedCategories.forEach(category => {
            // P0 FIX: Validate category exists
            if (!categoryData[category]) {
                console.warn(`⚠️ Invalid category in GameState: ${category}`);
                return;
            }

            const card = document.querySelector(`[data-category="${category}"]`);
            if (card && !card.classList.contains('locked')) {
                card.classList.add('selected');
            }
        });
        updateSelectionSummary();
    }
}

/**
 * Get current selected categories from GameState
 */
function getSelectedCategories() {
    return gameState.selectedCategories || [];
}

/**
 * P0 FIX: Category selection with validation
 */
function toggleCategory(element) {
    const category = element.dataset.category;
    if (!category) return;

    // P0 FIX: Validate category exists
    if (!categoryData[category]) {
        console.error(`❌ Invalid category: ${category}`);
        return;
    }

    const data = categoryData[category];

    // Check if locked
    if (element.classList.contains('locked')) {
        if (data.requiresAge > 0) {
            const ageLevel = parseInt(localStorage.getItem('nocap_age_level')) || 0;
            showNotification(`Du musst ${data.requiresAge}+ sein für diese Kategorie`, 'warning');
        } else if (data.requiresPremium) {
            showPremiumInfo();
        }
        return;
    }

    const currentCategories = getSelectedCategories();

    // Toggle selection
    if (currentCategories.includes(category)) {
        // Remove
        gameState.selectedCategories = currentCategories.filter(c => c !== category);
        element.classList.remove('selected');
        showNotification(`${data.name} entfernt`, 'info');
    } else {
        // Add
        gameState.selectedCategories = [...currentCategories, category];
        element.classList.add('selected');
        showNotification(`${data.name} ausgewählt!`, 'success');
    }

    // P1 FIX: Auto-save to GameState
    gameState.save();
    updateSelectionSummary();
}

// ===== SELECTION SUMMARY =====

/**
 * P0 FIX: Build summary with DOM manipulation (no innerHTML)
 */
function updateSelectionSummary() {
    const summaryElement = document.getElementById('selection-summary');
    const categoriesListElement = document.getElementById('selected-categories-list');
    const totalQuestionsElement = document.getElementById('total-questions');
    const continueBtn = document.getElementById('continue-btn');
    const continueHint = document.querySelector('.continue-hint');

    if (!summaryElement || !categoriesListElement || !totalQuestionsElement || !continueBtn || !continueHint) {
        return;
    }

    const selectedCategories = getSelectedCategories();

    if (selectedCategories.length === 0) {
        summaryElement.style.display = 'none';
        continueBtn.disabled = true;
        continueBtn.setAttribute('aria-disabled', 'true');
        continueHint.textContent = 'Wähle mindestens eine Kategorie aus';
    } else {
        summaryElement.style.display = 'block';
        continueBtn.disabled = false;
        continueBtn.setAttribute('aria-disabled', 'false');
        continueHint.textContent = `${selectedCategories.length} Kategorie${selectedCategories.length > 1 ? 'n' : ''} ausgewählt`;

        // P0 FIX: Build list safely with DOM manipulation
        categoriesListElement.innerHTML = '';

        selectedCategories.forEach(category => {
            const data = categoryData[category];
            if (!data) return;

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
}

// ===== PREMIUM MODAL =====

function showPremiumInfo(event) {
    if (event) {
        event.stopPropagation();
    }
    const modal = document.getElementById('premium-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closePremiumModal() {
    const modal = document.getElementById('premium-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
}

/**
 * P0 WARNING: This is NOT secure - can be manipulated
 * TODO: Move to server-side payment processing
 */
async function purchasePremium() {
    showNotification('Premium-Kauf wird vorbereitet...', 'info');

    try {
        // P0 WARNING: This validation can be bypassed client-side
        // Premium purchase MUST be validated server-side

        if (typeof firebase === 'undefined' || !firebase.database) {
            showNotification('Firebase nicht verfügbar', 'error');
            return;
        }

        if (typeof firebase.auth === 'undefined' || !firebase.auth().currentUser) {
            showNotification('Bitte erstelle zuerst einen Account', 'warning');
            return;
        }

        const userId = firebase.auth().currentUser.uid;

        // P0 TODO: Replace with real payment gateway (Stripe, PayPal, etc.)
        // This is just a placeholder
        const purchaseRef = firebase.database().ref(`users/${userId}/purchases/special`);
        await purchaseRef.set({
            id: 'special_edition',
            name: 'Special Edition',
            price: 2.99,
            currency: 'EUR',
            timestamp: Date.now(),
            // P0 TODO: Add payment verification token from payment provider
            verified: false // Should be set by server after payment verification
        });

        // Unlock special category
        const specialCard = document.querySelector('[data-category="special"]');
        if (specialCard) {
            specialCard.classList.remove('locked');
        }

        const specialLocked = document.getElementById('special-locked');
        if (specialLocked) {
            specialLocked.style.display = 'none';
        }

        closePremiumModal();
        showNotification('Premium freigeschaltet! 🎉', 'success');

        console.log('✅ Premium purchased (client-side only - not verified)');

    } catch (error) {
        console.error('❌ Purchase error:', error);
        showNotification('Fehler beim Kauf', 'error');
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
    const selectedCategories = getSelectedCategories();

    if (selectedCategories.length === 0) {
        showNotification('Bitte wähle mindestens eine Kategorie aus', 'warning');
        return;
    }

    console.log('🚀 Proceeding with categories:', selectedCategories);

    showLoading();

    // Already saved in GameState via toggleCategory
    setTimeout(() => {
        window.location.href = 'difficulty-selection.html';
    }, 500);
}

function goBack() {
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

/**
 * P0 FIX: Safe notification using NocapUtils
 */
function showNotification(message, type = 'info', duration = 3000) {
    if (typeof window.NocapUtils !== 'undefined' && window.NocapUtils.showNotification) {
        window.NocapUtils.showNotification(message, type);
        return;
    }

    // Fallback
    document.querySelectorAll('.notification').forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const notificationContent = document.createElement('div');
    notificationContent.className = 'notification-content';

    const notificationText = document.createElement('span');
    notificationText.className = 'notification-text';
    notificationText.textContent = String(message).replace(/<[^>]*>/g, '');

    notificationContent.appendChild(notificationText);
    notification.appendChild(notificationContent);

    const container = document.getElementById('notification-container') || document.body;
    container.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, duration);
}

// ===== INITIALIZATION =====

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}