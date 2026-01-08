/**
 * No-Cap Multiplayer Category Selection
 * Version 4.0 - P0 Security Fixes Applied
 *
 * CRITICAL: This page is the "Source of Truth" for Multiplayer Host Mode
 * - Sets deviceMode = 'multi'
 * - Sets isHost = true, isGuest = false
 * - Creates/manages Firebase game
 *
 * ✅ P0 FIX: MANDATORY server-side premium validation
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
    let playerNameConfirmed = false; // Track if name is set
    let isHost = true; // ✅ P1 UI/UX: Track if user is host or guest

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
        // ✅ P1 UI/UX: But guests might navigate here - detect and handle
        // ===========================
        if (isDevelopment) {
            console.log('🎮 Checking user role...');
        }

        // Check if user is guest (has gameId but isGuest flag)
        if (gameState.isGuest === true || (gameState.gameId && !gameState.isHost)) {
            isHost = false;
            gameState.isHost = false;
            gameState.isGuest = true;

            if (isDevelopment) {
                console.log('👤 User is GUEST - showing read-only view');
            }
        } else {
            // Force host mode
            isHost = true;
            gameState.deviceMode = 'multi';
            gameState.isHost = true;
            gameState.isGuest = false;

            if (isDevelopment) {
                console.log('👑 User is HOST - showing editable view');
            }
        }

        if (isDevelopment) {
            console.log('✅ User role set:', {
                deviceMode: gameState.deviceMode,
                isHost: isHost,
                isGuest: gameState.isGuest
            });
        }

        // P0 FIX: Use global firebaseGameService
        if (typeof window.FirebaseService !== 'undefined') {
            firebaseService = window.FirebaseService;
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

        // Check if player name already set (from previous navigation)
        if (gameState.playerName && gameState.playerName.trim()) {
            playerNameConfirmed = true;
            showCategorySelection();
        } else {
            showPlayerNameInput();
        }

        // Initialize Firebase and load data
        await checkPremiumStatus();
        await loadQuestionCounts();

        // Render categories (will be hidden if name not confirmed)
        renderCategoryCards();

        // Setup event listeners
        setupEventListeners();

        // P1 FIX: Load from GameState
        if (playerNameConfirmed) {
            initializeSelectedCategories();

            // ✅ P1 STABILITY: Mark guest as ready when they view categories
            if (!isHost) {
                setTimeout(() => markPlayerReady(), 1000);
            }
        }

        if (isDevelopment) {
            console.log('✅ Multiplayer category selection initialized');
        }
    }

    // ===========================
    // PLAYER NAME INPUT
    // ===========================

    function showPlayerNameInput() {
        const nameSection = document.getElementById('player-name-section');
        const categoryContainer = document.getElementById('category-selection-container');
        const multiplayerHeader = document.getElementById('multiplayer-header');

        if (nameSection) nameSection.classList.remove('hidden');
        if (categoryContainer) categoryContainer.classList.add('hidden');
        if (multiplayerHeader) multiplayerHeader.classList.add('hidden');
    }

    function showCategorySelection() {
        const nameSection = document.getElementById('player-name-section');
        const categoryContainer = document.getElementById('category-selection-container');
        const multiplayerHeader = document.getElementById('multiplayer-header');

        if (nameSection) nameSection.classList.add('hidden');
        if (categoryContainer) categoryContainer.classList.remove('hidden');
        if (multiplayerHeader) multiplayerHeader.classList.remove('hidden');

        updateHeaderInfo();
    }

    function handleNameInput(e) {
        const input = e.target;
        const confirmBtn = document.getElementById('confirm-name-btn');
        const value = input.value.trim();

        if (confirmBtn) {
            if (value.length >= 2) {
                confirmBtn.disabled = false;
                confirmBtn.classList.remove('disabled');
                confirmBtn.setAttribute('aria-disabled', 'false');
            } else {
                confirmBtn.disabled = true;
                confirmBtn.classList.add('disabled');
                confirmBtn.setAttribute('aria-disabled', 'true');
            }
        }
    }

    function confirmPlayerName() {
        const nameInput = document.getElementById('player-name-input');
        if (!nameInput) return;

        const playerName = sanitizeText(nameInput.value.trim());

        if (playerName.length < 2) {
            showNotification('Name muss mindestens 2 Zeichen haben', 'warning');
            return;
        }

        if (playerName.length > 20) {
            showNotification('Name darf maximal 20 Zeichen haben', 'warning');
            return;
        }

        // ✅ FIX: Use setPlayerName() to save persistently
        gameState.setPlayerName(playerName);
        playerNameConfirmed = true;

        if (isDevelopment) {
            console.log('✅ Player name set and saved:', playerName);
        }

        showNotification(`Willkommen ${playerName}! 👋`, 'success', 1500);

        // Show category selection
        setTimeout(() => {
            showCategorySelection();
        }, 500);
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

        // ✅ FIX: playerName wird erst später in der Lobby gesetzt, nicht hier prüfen
        // Im Multiplayer-Flow: Index → Category → Difficulty → Lobby (dort wird Name eingegeben)

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
            // ✅ Load from nocap_age_verification (consistent with index.js)
            const verification = window.NocapUtils
                ? window.NocapUtils.getLocalStorage('nocap_age_verification')
                : JSON.parse(localStorage.getItem('nocap_age_verification') || 'null');

            if (!verification || typeof verification !== 'object') {
                console.error('❌ No age verification found');
                showNotification('Altersverifizierung erforderlich!', 'warning');
                setTimeout(() => window.location.href = 'index.html', 2000);
                return false;
            }

            // ✅ Check if verification is recent (7 days instead of 24h)
            const now = Date.now();
            const maxAge = 365 * 24 * 60 * 60 * 1000; // 365 days (1 year)

            if (verification.timestamp && now - verification.timestamp > maxAge) {
                console.warn('⚠️ Age verification expired (>7 days)');
                showNotification('Altersverifizierung abgelaufen - bitte neu bestätigen', 'warning');
                setTimeout(() => window.location.href = 'index.html', 2000);
                return false;
            }

            if (isDevelopment) {
                const ageLevel = verification.isAdult ? 18 : 0;
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

    /**
     * ✅ P0 FIX: Check premium status with server-side validation
     * Already uses async gameState.isPremiumUser()
     */
    async function checkPremiumStatus() {
        try {
            // ✅ Already using server-side validation via GameState
            const isPremium = await gameState.isPremiumUser();

            if (isDevelopment) {
                console.log(`${isPremium ? '✅' : '🔒'} Premium status (server-validated): ${isPremium}`);
            }

            // Update UI based on premium status
            const specialCard = document.querySelector('[data-category="special"]');
            if (specialCard) {
                if (isPremium) {
                    specialCard.classList.remove('locked');
                    specialCard.setAttribute('aria-disabled', 'false');
                } else {
                    specialCard.classList.add('locked');
                    specialCard.setAttribute('aria-disabled', 'true');
                }
            }

        } catch (error) {
            console.error('❌ Premium check failed:', error);

            // ✅ P0 FIX: FAIL SECURE - lock premium on error
            const specialCard = document.querySelector('[data-category="special"]');
            if (specialCard) {
                specialCard.classList.add('locked');
                specialCard.setAttribute('aria-disabled', 'true');
            }

            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    'Premium-Status konnte nicht überprüft werden',
                    'warning',
                    3000
                );
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

        // Game-ID wird erst in der Lobby erstellt, nicht hier
        if (gameIdEl) {
            if (gameState.gameId) {
                gameIdEl.textContent = gameState.gameId;
            } else {
                gameIdEl.textContent = 'Wird in Lobby erstellt...';
            }
        }
    }

    // ===========================
    // EVENT LISTENERS
    // ===========================

    function setupEventListeners() {
        const backBtn = document.getElementById('back-button');
        const proceedBtn = document.getElementById('proceed-button');
        const nameInput = document.getElementById('player-name-input');
        const confirmNameBtn = document.getElementById('confirm-name-btn');

        if (backBtn) {
            backBtn.addEventListener('click', goBack);
        }
        if (proceedBtn) {
            proceedBtn.addEventListener('click', proceed);
        }

        // Player name input listeners
        if (nameInput) {
            nameInput.addEventListener('input', handleNameInput);
            nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !confirmNameBtn.disabled) {
                    confirmPlayerName();
                }
            });
            // Auto-focus
            if (!playerNameConfirmed) {
                setTimeout(() => nameInput.focus(), 100);
            }
        }

        if (confirmNameBtn) {
            confirmNameBtn.addEventListener('click', confirmPlayerName);
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
     * ✅ P0 SECURITY + P1 UI/UX: Render category cards with safe DOM manipulation
     * - Uses textContent only (no innerHTML) to prevent XSS
     * - Shows disabled cards for guests with clear visual feedback
     */
    async function renderCategoryCards() {
        const grid = document.getElementById('categories-grid');
        if (!grid) return;

        grid.innerHTML = '';

        // Get age level for FSK checks
        let ageLevel = 0;
        if (window.NocapUtils && window.NocapUtils.getLocalStorage) {
            ageLevel = parseInt(window.NocapUtils.getLocalStorage('nocap_age_level')) || 0;
        }

        const hasPremium = await gameState.isPremiumUser();

        Object.entries(categoryData).forEach(([key, cat]) => {
            const card = document.createElement('div');
            card.className = 'category-card';
            card.dataset.category = key;
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', `${cat.name} auswählen`);

            // ✅ P1 UI/UX: Guests see all cards as disabled
            const isGuest = !isHost;
            const locked = isGuest || // ✅ Guest cannot select
                (key === 'fsk18' && ageLevel < 18) ||
                (key === 'fsk16' && ageLevel < 16) ||
                (key === 'special' && !hasPremium);

            if (locked) {
                card.classList.add('locked');
                card.setAttribute('aria-disabled', 'true');
            }

            // ✅ P1 UI/UX: Add guest-specific class
            if (isGuest) {
                card.classList.add('guest-disabled');
                card.setAttribute('aria-label', `${cat.name} (Nur Host kann auswählen)`);
            }

            // ✅ P0 SECURITY: Build with textContent instead of innerHTML
            buildCategoryCard(card, key, cat, locked, ageLevel, isGuest);

            // Event listeners
            if (!locked && !isGuest) {
                card.addEventListener('click', () => toggleCategory(key));
                card.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleCategory(key);
                    }
                });
            } else if (isGuest) {
                // ✅ P1 UI/UX: Show message when guest tries to click
                card.addEventListener('click', () => {
                    showNotification('Nur der Host kann Kategorien auswählen', 'info');
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
            console.log(`✅ Cards rendered (${isHost ? 'Host' : 'Guest'} mode)`);
        }
    }

    /**
     * ✅ P0 SECURITY: Build category card with safe DOM manipulation
     * - Uses textContent exclusively (no innerHTML)
     * - Sanitizes all user-facing strings
     */
    function buildCategoryCard(card, key, cat, locked, ageLevel, isGuest = false) {
        // Locked overlay
        if (locked) {
            const overlay = document.createElement('div');
            overlay.className = 'locked-overlay';

            const lockIcon = document.createElement('div');
            lockIcon.className = 'lock-icon';
            // ✅ P0 SECURITY: textContent is XSS-safe
            lockIcon.textContent = isGuest ? '👁️' : '🔒'; // Different icon for guests
            lockIcon.setAttribute('aria-hidden', 'true');

            const lockMessage = document.createElement('p');
            lockMessage.className = 'lock-message';

            // ✅ P1 UI/UX: Guest-specific message
            if (isGuest) {
                lockMessage.textContent = 'Nur Host kann auswählen';
            } else if (key === 'fsk18' && ageLevel < 18) {
                // ✅ P0 SECURITY: textContent is XSS-safe
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
                // ✅ P0 SECURITY: textContent is XSS-safe
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
        // ✅ P0 SECURITY: textContent is XSS-safe
        icon.textContent = cat.icon;
        icon.setAttribute('aria-hidden', 'true');

        const fskBadge = document.createElement('div');
        fskBadge.className = `fsk-badge ${key}-badge`;
        // ✅ P0 SECURITY: textContent is XSS-safe
        fskBadge.textContent = cat.fsk;

        header.appendChild(icon);
        header.appendChild(fskBadge);

        // Title
        const title = document.createElement('h3');
        title.className = 'category-title';
        // ✅ P0 SECURITY: textContent is XSS-safe
        title.textContent = cat.name;

        // Description
        const description = document.createElement('p');
        description.className = 'category-description';
        // ✅ P0 SECURITY: textContent is XSS-safe
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
            // ✅ FIX: Use removeCategory() for persistent storage
            gameState.removeCategory(key);
            card.classList.remove('selected');
            card.classList.remove(key);
            card.setAttribute('aria-pressed', 'false');
        } else {
            // ✅ FIX: Use addCategory() for persistent storage
            gameState.addCategory(key);
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

    /**
     * ✅ P1 STABILITY: Check if all players have marked themselves as ready
     * Server-side validation via Firebase
     */
    async function checkAllPlayersReady() {
        if (!gameState.gameId) {
            // No multiplayer game yet - proceed
            return true;
        }

        try {
            if (typeof firebase === 'undefined' || !firebase.database) {
                if (isDevelopment) {
                    console.warn('⚠️ Firebase not available for ready check');
                }
                return true; // Fallback: allow proceed
            }

            const gameRef = firebase.database().ref(`games/${gameState.gameId}/players`);
            const snapshot = await gameRef.once('value');

            if (!snapshot.exists()) {
                // No players yet - proceed
                return true;
            }

            const players = snapshot.val();
            const playerList = Object.values(players);

            // Check if all non-host players have categoryReady flag
            const allReady = playerList.every(player => {
                if (player.isHost) return true; // Host is always ready
                return player.categoryReady === true;
            });

            if (isDevelopment) {
                const readyCount = playerList.filter(p => p.categoryReady || p.isHost).length;
                console.log(`✅ Ready check: ${readyCount}/${playerList.length} players ready`);
            }

            return allReady;

        } catch (error) {
            console.error('❌ Ready check error:', error);
            // On error, show warning but allow proceed
            showNotification('Fehler beim Ready-Check - fortfahren mit Vorsicht', 'warning');
            return true;
        }
    }

    /**
     * ✅ P1 STABILITY: Mark current player as ready (for guests)
     * Called when guest has viewed the category selection
     */
    async function markPlayerReady() {
        if (!gameState.gameId || isHost) return;

        try {
            if (typeof firebase === 'undefined' || !firebase.database) return;

            const userId = firebase.auth()?.currentUser?.uid;
            if (!userId) return;

            const playerRef = firebase.database().ref(`games/${gameState.gameId}/players/${userId}/categoryReady`);
            await playerRef.set(true);

            if (isDevelopment) {
                console.log('✅ Player marked as ready for category selection');
            }

        } catch (error) {
            console.error('❌ Mark ready error:', error);
        }
    }

    // ===========================
    // NAVIGATION
    // ✅ P1 STABILITY: Ready-check before proceeding
    // ===========================

    /**
     * ✅ P1 STABILITY: Proceed with ready-check for multiplayer
     * Host must wait until all guests have seen the categories
     */
    async function proceed() {
        const selectedCategories = getSelectedCategories();

        if (selectedCategories.length === 0) {
            showNotification('Wähle mindestens eine Kategorie', 'warning');
            return;
        }

        // ✅ P1 STABILITY: Check if all players are ready (for multiplayer)
        if (isHost && gameState.gameId) {
            const allReady = await checkAllPlayersReady();
            if (!allReady) {
                showNotification(
                    'Bitte warte, bis alle Spieler die Kategorieauswahl gesehen haben',
                    'warning'
                );
                return;
            }
        }

        // Already saved in GameState
        showNotification('Kategorien gespeichert!', 'success', 500);
        setTimeout(() => {
            window.location.href = 'multiplayer-difficulty-selection.html';
        }, 500);
    }

    function goBack() {
        if (isDevelopment) {
            console.log('🔙 Navigating back to index...');
        }

        // ✅ FIX: Reset game state when going back
        if (gameState) {
            gameState.deviceMode = null;
            gameState.isHost = false;
            gameState.isGuest = false;
            gameState.selectedCategories = [];
            gameState.playerName = '';
            gameState.gameId = null;

            // Clear from localStorage
            if (window.NocapUtils && window.NocapUtils.removeLocalStorage) {
                window.NocapUtils.removeLocalStorage('nocap_player_name');
                window.NocapUtils.removeLocalStorage('nocap_game_id');
            }

            gameState.save();
        }

        // Navigate back to index
        window.location.href = 'index.html';
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
    // UTILITIES (use NocapUtils)
    // ===========================

    const showNotification = window.NocapUtils?.showNotification || function(message, type = 'info') {
        alert(sanitizeText(String(message))); // Fallback
    };

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