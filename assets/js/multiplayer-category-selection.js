/**
 * No-Cap Multiplayer Category Selection
 * Version: 8.2 - Security Hardened & Production Ready
 */

'use strict';

// ===== CATEGORY DATA =====
const categoryData = {
    fsk0: {
        name: 'Familie & Freunde', icon: '👨‍👩‍👧‍👦', color: '#4CAF50', fsk: 'FSK 0', ageRange: 'Ab 0 Jahren',
        description: 'Lustige und harmlose Fragen für die ganze Familie',
        examples: ['...gemeinsam mit der Familie verreist?', '...im Supermarkt etwas vergessen?']
    },
    fsk16: {
        name: 'Party Time', icon: '🎉', color: '#FF9800', fsk: 'FSK 16', ageRange: 'Ab 16 Jahren',
        description: 'Freche und witzige Fragen für Partys mit Freunden',
        examples: ['...auf einer Party eingeschlafen?', '...den Namen vergessen?']
    },
    fsk18: {
        name: 'Heiß & Gewagt', icon: '🔥', color: '#F44336', fsk: 'FSK 18', ageRange: 'Nur Erwachsene',
        description: 'Intime und pikante Fragen nur für Erwachsene',
        examples: ['...an einem öffentlichen Ort...?', '...mit jemandem...?']
    },
    special: {
        name: 'Special Edition', icon: '⭐', color: '#FFD700', fsk: 'Premium', ageRange: 'Exklusiv',
        description: 'Exklusive Premium-Fragen für besondere Momente',
        examples: ['Premium Inhalte', 'Exklusive Fragen']
    }
};

// ===== GLOBAL STATE =====
let gameState = null;
let firebaseService = null;
let questionCounts = { fsk0: 200, fsk16: 300, fsk18: 250, special: 150 };

// ===== P0 FIX: INPUT SANITIZATION =====

/**
 * Sanitize text with NocapUtils or fallback
 */
function sanitizeText(input) {
    if (!input) return '';

    if (typeof window.NocapUtils !== 'undefined' && window.NocapUtils.sanitizeInput) {
        return window.NocapUtils.sanitizeInput(String(input));
    }

    return String(input).replace(/<[^>]*>/g, '').substring(0, 500);
}

// ===== INITIALIZATION =====

async function initialize() {
    console.log('🌐 Initializing category selection...');

    if (typeof GameState === 'undefined') {
        showNotification('Fehler beim Laden', 'error');
        return;
    }

    gameState = new GameState();

    if (!validateGameState()) {
        return;
    }

    // P0 FIX: Use global firebaseGameService
    if (typeof window.firebaseGameService !== 'undefined') {
        firebaseService = window.firebaseGameService;
    } else {
        console.error('❌ Firebase service not available');
        showNotification('Firebase nicht verfügbar', 'error');
        setTimeout(() => window.location.href = 'index.html', 3000);
        return;
    }

    // P0 FIX: Check age verification with expiration
    if (!checkAgeVerification()) {
        return;
    }

    await checkPremiumStatus();
    await loadQuestionCounts();
    renderCategoryCards();
    setupEventListeners();

    // P1 FIX: Load from GameState
    initializeSelectedCategories();

    console.log('✅ Initialized');
}

// ===== VALIDATION =====

function validateGameState() {
    console.log('🔍 Validating game state...');

    if (!gameState || gameState.deviceMode !== 'multi') {
        showNotification('Falscher Spielmodus', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }

    if (!gameState.playerName || gameState.playerName.trim() === '') {
        showNotification('Kein Spielername gesetzt', 'error');
        setTimeout(() => window.location.href = 'multiplayer-lobby.html', 2000);
        return false;
    }

    console.log('✅ Game state valid');
    return true;
}

// ===== P0 FIX: AGE VERIFICATION WITH EXPIRATION =====

/**
 * Check age verification with 24h expiration
 */
function checkAgeVerification() {
    try {
        const ageLevel = parseInt(localStorage.getItem('nocap_age_level')) || 0;
        const ageTimestamp = parseInt(localStorage.getItem('nocap_age_timestamp')) || 0;
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (now - ageTimestamp > maxAge) {
            console.error('❌ Age verification expired');
            localStorage.removeItem('nocap_age_level');
            localStorage.removeItem('nocap_age_timestamp');
            showNotification('Altersverifizierung abgelaufen!', 'warning');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        console.log(`✅ Age verification: ${ageLevel}+`);
        return true;

    } catch (error) {
        console.error('❌ Age verification error:', error);
        showNotification('Altersverifizierung erforderlich!', 'warning');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }
}

// ===== PREMIUM & QUESTION COUNTS =====

async function checkPremiumStatus() {
    try {
        const isPremium = await gameState.isPremiumUser();
        console.log(`${isPremium ? '✅' : '🔒'} Premium status: ${isPremium}`);
    } catch (error) {
        console.warn('⚠️ Premium check error:', error);
    }
}

async function loadQuestionCounts() {
    try {
        if (!firebaseService || typeof firebase === 'undefined') {
            console.warn('⚠️ Firebase not available, using defaults');
            return;
        }

        const questionsRef = firebase.database().ref('questions');
        const snapshot = await questionsRef.once('value');

        if (snapshot.exists()) {
            const questions = snapshot.val();
            Object.keys(categoryData).forEach(key => {
                if (questions[key]) {
                    if (Array.isArray(questions[key])) {
                        questionCounts[key] = questions[key].length;
                    } else if (typeof questions[key] === 'object') {
                        questionCounts[key] = Object.keys(questions[key]).length;
                    }
                }
            });
            console.log('✅ Question counts loaded');
        }
    } catch (error) {
        console.warn('⚠️ Question counts error:', error);
    }
}

// ===== EVENT LISTENERS =====

function setupEventListeners() {
    const backBtn = document.querySelector('.back-button');
    const proceedBtn = document.getElementById('proceed-button');

    if (backBtn) {
        backBtn.addEventListener('click', goBack);
    }
    if (proceedBtn) {
        proceedBtn.addEventListener('click', proceed);
    }

    console.log('✅ Event listeners setup');
}

// ===== P1 FIX: INITIALIZE SELECTED CATEGORIES =====

/**
 * Initialize selected categories from GameState
 */
function initializeSelectedCategories() {
    if (gameState.selectedCategories && Array.isArray(gameState.selectedCategories)) {
        gameState.selectedCategories.forEach(key => {
            // P0 FIX: Validate category exists
            if (!categoryData[key]) {
                console.warn(`⚠️ Invalid category: ${key}`);
                return;
            }

            const card = document.querySelector(`[data-category="${key}"]`);
            if (card && !card.classList.contains('locked')) {
                card.classList.add('selected');
            }
        });
        updateSelectionSummary();
    }
}

// ===== P0 FIX: RENDER CARDS WITH TEXTCONTENT =====

/**
 * Render category cards with safe DOM manipulation
 */
function renderCategoryCards() {
    const grid = document.getElementById('categories-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Get age level for FSK checks
    const ageLevel = parseInt(localStorage.getItem('nocap_age_level')) || 0;
    const hasPremium = false; // TODO: Check from gameState

    Object.entries(categoryData).forEach(([key, cat]) => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.dataset.category = key;

        const locked = (key === 'fsk18' && ageLevel < 18) ||
            (key === 'fsk16' && ageLevel < 16) ||
            (key === 'special' && !hasPremium);

        if (locked) {
            card.classList.add('locked');
        }

        // P0 FIX: Build with textContent instead of innerHTML
        buildCategoryCard(card, key, cat, locked, ageLevel);

        // Event listeners
        if (!locked) {
            card.addEventListener('click', () => toggleCategory(key));
        } else if (key === 'fsk18' && ageLevel < 18) {
            card.addEventListener('click', () => showNotification('Du musst 18+ sein', 'warning'));
        } else if (key === 'fsk16' && ageLevel < 16) {
            card.addEventListener('click', () => showNotification('Du musst 16+ sein', 'warning'));
        } else if (key === 'special') {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.unlock-btn')) {
                    e.stopPropagation();
                    showPremiumInfo();
                }
            });
        }

        grid.appendChild(card);
    });

    console.log('✅ Cards rendered');
}

/**
 * P0 FIX: Build category card with safe DOM manipulation
 */
function buildCategoryCard(card, key, cat, locked, ageLevel) {
    // Locked overlay
    if (locked) {
        const overlay = document.createElement('div');
        overlay.className = 'locked-overlay';

        const lockIcon = document.createElement('div');
        lockIcon.className = 'lock-icon';
        lockIcon.textContent = '🔒';

        const lockMessage = document.createElement('p');
        lockMessage.className = 'lock-message';

        if (key === 'fsk18' && ageLevel < 18) {
            lockMessage.textContent = 'Nur für Erwachsene (18+)';
        } else if (key === 'fsk16' && ageLevel < 16) {
            lockMessage.textContent = 'Ab 16 Jahren';
        } else if (key === 'special') {
            lockMessage.textContent = 'Premium Inhalt';

            const unlockBtn = document.createElement('button');
            unlockBtn.className = 'unlock-btn';
            unlockBtn.textContent = '💎 Freischalten';
            overlay.appendChild(unlockBtn);
        }

        overlay.appendChild(lockIcon);
        overlay.appendChild(lockMessage);
        card.appendChild(overlay);

        // Premium badge
        if (key === 'special') {
            const badge = document.createElement('div');
            badge.className = 'premium-badge';
            badge.textContent = '👑 PREMIUM';
            card.appendChild(badge);
        }
    }

    // Header
    const header = document.createElement('div');
    header.className = 'category-header';

    const icon = document.createElement('div');
    icon.className = 'category-icon';
    icon.textContent = cat.icon;

    const fskBadge = document.createElement('div');
    fskBadge.className = `fsk-badge ${key}-badge`;
    fskBadge.textContent = cat.fsk;

    header.appendChild(icon);
    header.appendChild(fskBadge);

    // Title
    const title = document.createElement('h3');
    title.className = 'category-title';
    title.textContent = cat.name;

    // Description
    const description = document.createElement('p');
    description.className = 'category-description';
    description.textContent = cat.description;

    // Examples
    const examplesDiv = document.createElement('div');
    examplesDiv.className = 'category-examples';

    const examplesQuestions = document.createElement('div');
    examplesQuestions.className = 'example-questions';

    cat.examples.forEach(ex => {
        const exampleDiv = document.createElement('div');
        exampleDiv.className = 'example-question';
        exampleDiv.textContent = sanitizeText(ex);
        examplesQuestions.appendChild(exampleDiv);
    });

    examplesDiv.appendChild(examplesQuestions);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'category-footer';

    const ageRange = document.createElement('span');
    ageRange.className = 'age-range';
    ageRange.textContent = cat.ageRange;

    const questionCount = document.createElement('span');
    questionCount.className = 'question-count';
    questionCount.textContent = `~${questionCounts[key]} Fragen`;

    footer.appendChild(ageRange);
    footer.appendChild(questionCount);

    // Assemble card
    card.appendChild(header);
    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(examplesDiv);
    card.appendChild(footer);
}

// ===== CATEGORY SELECTION =====

/**
 * P0 FIX: Toggle category with validation
 */
function toggleCategory(key) {
    const card = document.querySelector(`[data-category="${key}"]`);
    if (!card || card.classList.contains('locked')) return;

    // P0 FIX: Validate category exists
    if (!categoryData[key]) {
        console.error(`❌ Invalid category: ${key}`);
        return;
    }

    const selectedCategories = getSelectedCategories();

    if (selectedCategories.includes(key)) {
        // Remove
        gameState.selectedCategories = selectedCategories.filter(c => c !== key);
        card.classList.remove('selected');
    } else {
        // Add
        gameState.selectedCategories = [...selectedCategories, key];
        card.classList.add('selected');
    }

    gameState.save();
    updateSelectionSummary();
    syncWithFirebase();
}

/**
 * Get selected categories from GameState
 */
function getSelectedCategories() {
    return gameState.selectedCategories || [];
}

/**
 * P0 FIX: Update selection summary with textContent
 */
function updateSelectionSummary() {
    const summary = document.getElementById('selection-summary');
    const title = document.getElementById('summary-title');
    const list = document.getElementById('selected-categories');
    const total = document.getElementById('total-questions');
    const btn = document.getElementById('proceed-button');

    const selectedCategories = getSelectedCategories();

    if (selectedCategories.length > 0) {
        if (summary) summary.classList.add('show');
        if (btn) {
            btn.classList.add('enabled');
            btn.disabled = false;
            btn.setAttribute('aria-disabled', 'false');
        }

        if (title) {
            title.textContent = `${selectedCategories.length} Kategorie${selectedCategories.length > 1 ? 'n' : ''} ausgewählt`;
        }

        // P0 FIX: Build list with textContent
        if (list) {
            list.innerHTML = '';

            selectedCategories.forEach(c => {
                const data = categoryData[c];
                if (!data) return;

                const tag = document.createElement('div');
                tag.className = 'selected-category-tag';

                const iconSpan = document.createElement('span');
                iconSpan.textContent = data.icon;

                const nameSpan = document.createElement('span');
                nameSpan.textContent = data.name;

                tag.appendChild(iconSpan);
                tag.appendChild(nameSpan);
                list.appendChild(tag);
            });
        }

        if (total) {
            const totalQ = selectedCategories.reduce((sum, c) => sum + (questionCounts[c] || 0), 0);
            total.textContent = totalQ;
        }
    } else {
        if (summary) summary.classList.remove('show');
        if (btn) {
            btn.classList.remove('enabled');
            btn.disabled = true;
            btn.setAttribute('aria-disabled', 'true');
        }
    }
}

async function syncWithFirebase() {
    if (!firebaseService || !gameState.gameId) return;

    try {
        const gameRef = firebase.database().ref(`games/${gameState.gameId}/settings/categories`);
        await gameRef.set(gameState.selectedCategories);
    } catch (error) {
        console.error('❌ Sync error:', error);
    }
}

// ===== NAVIGATION =====

function proceed() {
    const selectedCategories = getSelectedCategories();

    if (selectedCategories.length === 0) {
        showNotification('Wähle mindestens eine Kategorie', 'warning');
        return;
    }

    // Already saved in GameState
    showNotification('Kategorien gespeichert!', 'success');
    setTimeout(() => {
        window.location.href = 'multiplayer-difficulty-selection.html';
    }, 500);
}

function goBack() {
    window.location.href = 'multiplayer-lobby.html';
}

// ===== PREMIUM =====

function showPremiumInfo() {
    showNotification('Premium-Funktion kommt bald!', 'info');
}

// ===== UTILITIES =====

/**
 * P0 FIX: Safe notification using NocapUtils
 */
function showNotification(message, type = 'info') {
    if (typeof window.NocapUtils !== 'undefined' && window.NocapUtils.showNotification) {
        window.NocapUtils.showNotification(message, type);
        return;
    }

    // Fallback
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = sanitizeText(message);

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===== INITIALIZATION =====

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

console.log('✅ Multiplayer Category Selection v8.2 - Production Ready!');