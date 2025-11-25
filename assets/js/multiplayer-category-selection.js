/**
 * No-Cap Multiplayer Category Selection
 * Version 3.0 - Audit-Fixed & Production Ready with Device Mode Enforcement
 *
 * CRITICAL: This page is the "Source of Truth" for Multiplayer Host Mode
 * - Sets deviceMode = 'multi'
 * - Sets isHost = true, isGuest = false
 * - Creates/manages Firebase game
 */

(function(window) {
    'use strict';

    // ===========================
    // CONSTANTS
    // ===========================
    const categoryData = {
        fsk0: {
            name: 'Familie & Freunde',
            icon: '👨‍👩‍👧‍👦',
            color: '#4CAF50',
            fsk: 'FSK 0',
            ageRange: 'Ab 0 Jahren',
            description: 'Lustige und harmlose Fragen für die ganze Familie',
            examples: ['...gemeinsam mit der Familie verreist?', '...im Supermarkt etwas vergessen?']
        },
        fsk16: {
            name: 'Party Time',
            icon: '🎉',
            color: '#FF9800',
            fsk: 'FSK 16',
            ageRange: 'Ab 16 Jahren',
            description: 'Freche und witzige Fragen für Partys mit Freunden',
            examples: ['...auf einer Party eingeschlafen?', '...den Namen vergessen?']
        },
        fsk18: {
            name: 'Heiß & Gewagt',
            icon: '🔥',
            color: '#F44336',
            fsk: 'FSK 18',
            ageRange: 'Nur Erwachsene',
            description: 'Intime und pikante Fragen nur für Erwachsene',
            examples: ['...an einem öffentlichen Ort...?', '...mit jemandem...?']
        },
        special: {
            name: 'Special Edition',
            icon: '⭐',
            color: '#FFD700',
            fsk: 'Premium',
            ageRange: 'Exklusiv',
            description: 'Exklusive Premium-Fragen für besondere Momente',
            examples: ['Premium Inhalte', 'Exklusive Fragen']
        }
    };

    // ===========================
    // GLOBAL STATE
    // ===========================
    let gameState = null;
    let firebaseService = null;
    let questionCounts = { fsk0: 200, fsk16: 300, fsk18: 250, special: 150 };

    const isDevelopment = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

    // ===========================
    // INITIALIZATION
    // ===========================

    async function initialize() {
        if (isDevelopment) {
            console.log('🌐 Initializing multiplayer category selection...');
        }

        // P0 FIX: Check DOMPurify
        if (typeof DOMPurify === 'undefined') {
            console.error('❌ CRITICAL: DOMPurify not loaded!');
            alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
            return;
        }

        // P0 FIX: Check dependencies
        if (typeof GameState === 'undefined') {
            showNotification('Fehler beim Laden', 'error');
            return;
        }

        // P1 FIX: Wait for dependencies
        if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
            await window.NocapUtils.waitForDependencies(['GameState', 'firebaseGameService']);
        }

        gameState = new GameState();

        // ===========================
        // CRITICAL: DEVICE MODE ENFORCEMENT
        // This page is ONLY for multiplayer host mode
        // ===========================
        if (isDevelopment) {
            console.log('🎮 Enforcing multiplayer host mode...');
        }

        gameState.deviceMode = 'multi';
        gameState.isHost = true;
        gameState.isGuest = false;

        if (isDevelopment) {
            console.log('✅ Device mode set:', {
                deviceMode: gameState.deviceMode,
                isHost: gameState.isHost,
                isGuest: gameState.isGuest
            });
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

        // Validate game state
        if (!validateGameState()) {
            return;
        }

        // Update UI with player info
        updateHeaderInfo();

        // Initialize Firebase and load data
        await checkPremiumStatus();
        await loadQuestionCounts();

        // Render categories
        renderCategoryCards();

        // Setup event listeners
        setupEventListeners();

        // P1 FIX: Load from GameState
        initializeSelectedCategories();

        if (isDevelopment) {
            console.log('✅ Multiplayer category selection initialized');
        }
    }

    // ===========================
    // VALIDATION
    // ===========================

    function validateGameState() {
        if (isDevelopment) {
            console.log('🔍 Validating game state...');
        }

        // P0 FIX: Strict device mode check
        if (!gameState || gameState.deviceMode !== 'multi') {
            console.error('❌ Wrong device mode:', gameState?.deviceMode);
            showNotification('Falscher Spielmodus', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        // P0 FIX: Verify host status
        if (!gameState.isHost) {
            console.error('❌ Not host');
            showNotification('Du bist nicht der Host', 'error');
            setTimeout(() => window.location.href = 'multiplayer-lobby.html', 2000);
            return false;
        }

        if (!gameState.checkValidity()) {
            showNotification('Ungültiger Spielzustand', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (!gameState.playerName || gameState.playerName.trim() === '') {
            console.error('❌ No player name');
            showNotification('Kein Spielername gesetzt', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (isDevelopment) {
            console.log('✅ Game state valid');
        }
        return true;
    }

    // ===========================
    // AGE VERIFICATION
    // ===========================

    /**
     * P0 FIX: Check age verification with 24h expiration
     */
    function checkAgeVerification() {
        try {
            let ageLevel = 0;
            let ageTimestamp = 0;

            if (window.NocapUtils && window.NocapUtils.getLocalStorage) {
                ageLevel = parseInt(window.NocapUtils.getLocalStorage('age_level')) || 0;
                ageTimestamp = parseInt(window.NocapUtils.getLocalStorage('age_timestamp')) || 0;
            }

            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours

            if (now - ageTimestamp > maxAge) {
                console.error('❌ Age verification expired');
                if (window.NocapUtils) {
                    window.NocapUtils.setLocalStorage('age_level', null);
                    window.NocapUtils.setLocalStorage('age_timestamp', null);
                }
                showNotification('Altersverifizierung abgelaufen!', 'warning');
                setTimeout(() => window.location.href = 'index.html', 2000);
                return false;
            }

            if (isDevelopment) {
                console.log(`✅ Age verification: ${ageLevel}+`);
            }
            return true;

        } catch (error) {
            console.error('❌ Age verification error:', error);
            showNotification('Altersverifizierung erforderlich!', 'warning');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }
    }

    // ===========================
    // PREMIUM & QUESTION COUNTS
    // ===========================

    async function checkPremiumStatus() {
        try {
            const isPremium = await gameState.isPremiumUser();
            if (isDevelopment) {
                console.log(`${isPremium ? '✅' : '🔒'} Premium status: ${isPremium}`);
            }
        } catch (error) {
            if (isDevelopment) {
                console.warn('⚠️ Premium check error:', error);
            }
        }
    }

    async function loadQuestionCounts() {
        try {
            if (!firebaseService || typeof firebase === 'undefined') {
                if (isDevelopment) {
                    console.warn('⚠️ Firebase not available, using defaults');
                }
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
                if (isDevelopment) {
                    console.log('✅ Question counts loaded:', questionCounts);
                }
            }
        } catch (error) {
            if (isDevelopment) {
                console.warn('⚠️ Question counts error:', error);
            }
        }
    }

    // ===========================
    // HEADER INFO
    // ===========================

    function updateHeaderInfo() {
        const hostNameEl = document.getElementById('host-name');
        const gameIdEl = document.getElementById('game-id-display');

        if (hostNameEl && gameState.playerName) {
            hostNameEl.textContent = gameState.playerName;
        }

        if (gameIdEl && gameState.gameId) {
            gameIdEl.textContent = gameState.gameId;
        } else if (gameIdEl) {
            gameIdEl.textContent = 'Wird erstellt...';
        }
    }

    // ===========================
    // EVENT LISTENERS
    // ===========================

    function setupEventListeners() {
        const backBtn = document.getElementById('back-button');
        const proceedBtn = document.getElementById('proceed-button');

        if (backBtn) {
            backBtn.addEventListener('click', goBack);
        }
        if (proceedBtn) {
            proceedBtn.addEventListener('click', proceed);
        }

        if (isDevelopment) {
            console.log('✅ Event listeners setup');
        }
    }

    // ===========================
    // INITIALIZE SELECTED CATEGORIES
    // ===========================

    /**
     * P1 FIX: Initialize selected categories from GameState
     */
    function initializeSelectedCategories() {
        if (gameState.selectedCategories && Array.isArray(gameState.selectedCategories)) {
            gameState.selectedCategories.forEach(key => {
                // P0 FIX: Validate category exists
                if (!categoryData[key]) {
                    if (isDevelopment) {
                        console.warn(`⚠️ Invalid category: ${key}`);
                    }
                    return;
                }

                const card = document.querySelector(`[data-category="${key}"]`);
                if (card && !card.classList.contains('locked')) {
                    card.classList.add('selected');
                    card.classList.add(key);
                }
            });
            updateSelectionSummary();
        }
    }

    // ===========================
    // P0 FIX: RENDER CARDS WITH TEXTCONTENT
    // ===========================

    /**
     * Render category cards with safe DOM manipulation
     */
    function renderCategoryCards() {
        const grid = document.getElementById('categories-grid');
        if (!grid) return;

        grid.innerHTML = '';

        // Get age level for FSK checks
        let ageLevel = 0;
        if (window.NocapUtils && window.NocapUtils.getLocalStorage) {
            ageLevel = parseInt(window.NocapUtils.getLocalStorage('age_level')) || 0;
        }

        const hasPremium = false; // TODO: Check from gameState

        Object.entries(categoryData).forEach(([key, cat]) => {
            const card = document.createElement('div');
            card.className = 'category-card';
            card.dataset.category = key;
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', `${cat.name} auswählen`);

            const locked = (key === 'fsk18' && ageLevel < 18) ||
                (key === 'fsk16' && ageLevel < 16) ||
                (key === 'special' && !hasPremium);

            if (locked) {
                card.classList.add('locked');
                card.setAttribute('aria-disabled', 'true');
            }

            // P0 FIX: Build with textContent instead of innerHTML
            buildCategoryCard(card, key, cat, locked, ageLevel);

            // Event listeners
            if (!locked) {
                card.addEventListener('click', () => toggleCategory(key));
                card.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleCategory(key);
                    }
                });
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

        if (isDevelopment) {
            console.log('✅ Cards rendered');
        }
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
            lockIcon.setAttribute('aria-hidden', 'true');

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
                unlockBtn.type = 'button';
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
                badge.setAttribute('aria-hidden', 'true');
                card.appendChild(badge);
            }
        }

        // Header
        const header = document.createElement('div');
        header.className = 'category-header';

        const icon = document.createElement('div');
        icon.className = 'category-icon';
        icon.textContent = cat.icon;
        icon.setAttribute('aria-hidden', 'true');

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

    // ===========================
    // CATEGORY SELECTION
    // ===========================

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
            card.classList.remove(key);
            card.setAttribute('aria-pressed', 'false');
        } else {
            // Add
            gameState.selectedCategories = [...selectedCategories, key];
            card.classList.add('selected');
            card.classList.add(key);
            card.setAttribute('aria-pressed', 'true');
        }

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
                    iconSpan.setAttribute('aria-hidden', 'true');

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
            if (isDevelopment) {
                console.error('❌ Sync error:', error);
            }
        }
    }

    // ===========================
    // NAVIGATION
    // ===========================

    function proceed() {
        const selectedCategories = getSelectedCategories();

        if (selectedCategories.length === 0) {
            showNotification('Wähle mindestens eine Kategorie', 'warning');
            return;
        }

        // Already saved in GameState
        showNotification('Kategorien gespeichert!', 'success', 500);
        setTimeout(() => {
            window.location.href = 'multiplayer-difficulty-selection.html';
        }, 500);
    }

    function goBack() {
        window.location.href = 'multiplayer-lobby.html';
    }

    // ===========================
    // PREMIUM
    // ===========================

    function showPremiumInfo() {
        showNotification('Premium-Funktion kommt bald!', 'info');
    }

    // ===========================
    // P0 FIX: INPUT SANITIZATION
    // ===========================

    /**
     * Sanitize text with NocapUtils or fallback
     */
    function sanitizeText(input) {
        if (!input) return '';

        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            return window.NocapUtils.sanitizeInput(String(input));
        }

        return String(input).replace(/<[^>]*>/g, '').substring(0, 500);
    }

    // ===========================
    // UTILITIES
    // ===========================

    /**
     * P0 FIX: Safe notification using NocapUtils
     */
    function showNotification(message, type = 'info', duration = 3000) {
        if (window.NocapUtils && window.NocapUtils.showNotification) {
            window.NocapUtils.showNotification(message, type, duration);
            return;
        }

        // Fallback implementation
        const container = document.body;

        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'polite');
        notification.textContent = sanitizeText(String(message));

        // Inline styles for fallback
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.padding = '15px 25px';
        notification.style.borderRadius = '10px';
        notification.style.fontWeight = '600';
        notification.style.zIndex = '10001';
        notification.style.maxWidth = '300px';
        notification.style.color = 'white';

        if (type === 'success') notification.style.background = '#4CAF50';
        if (type === 'error') notification.style.background = '#f44336';
        if (type === 'warning') notification.style.background = '#ff9800';
        if (type === 'info') notification.style.background = '#2196F3';

        container.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
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
            console.log('✅ Multiplayer category selection cleanup completed');
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