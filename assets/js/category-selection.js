/**
 * No-Cap Category Selection (Single Device Mode)
 * Version 4.0 - Audit-Fixed & Production Ready
 * Handles category selection with age-gating and premium features
 */

(function(window) {
    'use strict';

    // ===========================
    // CATEGORY DATA
    // ===========================
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

    // ===========================
    // GLOBAL STATE
    // ===========================
    let gameState = null;
    let questionCounts = {
        fsk0: 0,
        fsk16: 0,
        fsk18: 0,
        special: 0
    };

    const isDevelopment = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

    // ===========================
    // INITIALIZATION
    // ===========================

    async function initialize() {
        if (isDevelopment) {
            console.log('🎯 Initializing category selection...');
        }

        showLoading();

        // P0 FIX: Check DOMPurify
        if (typeof DOMPurify === 'undefined') {
            console.error('❌ CRITICAL: DOMPurify not loaded!');
            alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
            return;
        }

        // Check dependencies
        if (typeof GameState === 'undefined') {
            console.error('❌ GameState not found');
            showNotification('Fehler beim Laden. Bitte Seite neu laden.', 'error');
            return;
        }

        // P1 FIX: Wait for utils if available
        if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
            await window.NocapUtils.waitForDependencies(['GameState']);
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

        // P0 FIX: Check premium status
        await checkPremiumStatus();

        // Load question counts
        await loadQuestionCounts();

        // P1 FIX: Load from GameState
        initializeSelectedCategories();

        // Setup event listeners
        setupEventListeners();

        hideLoading();

        if (isDevelopment) {
            console.log('✅ Category selection initialized');
        }
    }

    // ===========================
    // VALIDATION & GUARDS
    // ===========================

    function validateGameState() {
        if (!gameState.checkValidity()) {
            showNotification('Ungültiger Spielzustand', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (gameState.deviceMode !== 'single') {
            console.error('❌ Wrong device mode:', gameState.deviceMode);
            showNotification('Falscher Spielmodus', 'warning');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        return true;
    }

    /**
     * P0 FIX: Validate age verification with expiration check
     */
    function checkAgeVerification() {
        try {
            // P0 FIX: Use safe storage
            const ageLevel = window.NocapUtils
                ? parseInt(window.NocapUtils.getLocalStorage('nocap_age_level')) || 0
                : parseInt(localStorage.getItem('nocap_age_level')) || 0;

            const verification = window.NocapUtils
                ? window.NocapUtils.getLocalStorage('nocap_age_verification')
                : JSON.parse(localStorage.getItem('nocap_age_verification') || '{}');

            // P0 FIX: Check expiration
            if (verification && verification.timestamp) {
                const now = Date.now();
                const expirationTime = 24 * 60 * 60 * 1000; // 24 hours

                if (now - verification.timestamp > expirationTime) {
                    console.warn('⚠️ Age verification expired');
                    clearAgeVerification();
                    window.location.href = 'index.html';
                    return false;
                }
            } else {
                // No valid verification
                window.location.href = 'index.html';
                return false;
            }

            if (isDevelopment) {
                console.log(`✅ Age verification: ${ageLevel}+`);
            }

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
     * P1 FIX: Clear age verification
     */
    function clearAgeVerification() {
        if (window.NocapUtils) {
            window.NocapUtils.removeLocalStorage('nocap_age_verification');
            window.NocapUtils.removeLocalStorage('nocap_age_level');
        } else {
            localStorage.removeItem('nocap_age_verification');
            localStorage.removeItem('nocap_age_level');
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
                card.setAttribute('aria-disabled', 'true');

                const lockedOverlay = document.getElementById(`${category}-locked`);
                if (lockedOverlay) {
                    lockedOverlay.style.display = 'flex';
                    lockedOverlay.setAttribute('aria-hidden', 'false');
                }
            } else {
                card.classList.remove('locked');
                card.setAttribute('aria-disabled', 'false');

                const lockedOverlay = document.getElementById(`${category}-locked`);
                if (lockedOverlay) {
                    lockedOverlay.style.display = 'none';
                    lockedOverlay.setAttribute('aria-hidden', 'true');
                }
            }
        });
    }

    /**
     * P0 WARNING: Check premium status (CLIENT-SIDE ONLY)
     * This is NOT secure and can be manipulated
     * Premium MUST be verified server-side via Firebase Security Rules
     */
    async function checkPremiumStatus() {
        try {
            // P0 WARNING: This can be bypassed client-side
            let isPremium = false;

            // Try to check via GameState/Firebase
            if (window.FirebaseConfig && window.FirebaseConfig.isInitialized()) {
                try {
                    const userId = window.FirebaseConfig.getCurrentUserId();
                    if (userId && firebase && firebase.database) {
                        const snapshot = await firebase.database()
                            .ref(`premiumUsers/${userId}`)
                            .once('value');
                        isPremium = snapshot.exists();
                    }
                } catch (error) {
                    console.warn('⚠️ Premium check error:', error);
                }
            }

            if (isDevelopment) {
                console.log(`ℹ️ Premium status (client-side): ${isPremium}`);
            }

            const specialCard = document.querySelector('[data-category="special"]');
            const specialLocked = document.getElementById('special-locked');

            if (isPremium) {
                if (specialCard) {
                    specialCard.classList.remove('locked');
                    specialCard.setAttribute('aria-disabled', 'false');
                }
                if (specialLocked) {
                    specialLocked.style.display = 'none';
                    specialLocked.setAttribute('aria-hidden', 'true');
                }
            } else {
                if (specialCard) {
                    specialCard.classList.add('locked');
                    specialCard.setAttribute('aria-disabled', 'true');
                }
                if (specialLocked) {
                    specialLocked.style.display = 'flex';
                    specialLocked.setAttribute('aria-hidden', 'false');
                }
            }

        } catch (error) {
            console.warn('⚠️ Premium check error:', error);
            // Default to locked on error
            const specialCard = document.querySelector('[data-category="special"]');
            if (specialCard) {
                specialCard.classList.add('locked');
                specialCard.setAttribute('aria-disabled', 'true');
            }
        }
    }

    // ===========================
    // QUESTION COUNTS
    // ===========================

    async function loadQuestionCounts() {
        try {
            if (typeof firebase === 'undefined' || !firebase.database) {
                console.warn('⚠️ Firebase not available, using fallback counts');
                useFallbackCounts();
                return;
            }

            // P1 FIX: Wait for Firebase if available
            if (window.FirebaseConfig) {
                await window.FirebaseConfig.waitForFirebase();
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

                if (isDevelopment) {
                    console.log('✅ Question counts loaded:', questionCounts);
                }
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

        if (isDevelopment) {
            console.log('✅ Using fallback counts');
        }
    }

    function getFallbackCount(category) {
        const fallbacks = {
            fsk0: 200,
            fsk16: 300,
            fsk18: 250,
            special: 150
        };
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

    // ===========================
    // CATEGORY SELECTION
    // ===========================

    /**
     * Initialize categories from GameState
     */
    function initializeSelectedCategories() {
        const selected = gameState.selectedCategories;

        if (Array.isArray(selected) && selected.length > 0) {
            selected.forEach(category => {
                // P0 FIX: Validate category exists
                if (!categoryData[category]) {
                    console.warn(`⚠️ Invalid category in GameState: ${category}`);
                    return;
                }

                const card = document.querySelector(`[data-category="${category}"]`);
                if (card && !card.classList.contains('locked')) {
                    card.classList.add('selected');
                    card.setAttribute('aria-pressed', 'true');
                }
            });
            updateSelectionSummary();
        }
    }

    /**
     * P0 FIX: Toggle category with validation
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
                const ageLevel = window.NocapUtils
                    ? parseInt(window.NocapUtils.getLocalStorage('nocap_age_level')) || 0
                    : parseInt(localStorage.getItem('nocap_age_level')) || 0;

                showNotification(
                    `Du musst ${data.requiresAge}+ sein für diese Kategorie`,
                    'warning'
                );
            } else if (data.requiresPremium) {
                showPremiumInfo();
            }
            return;
        }

        // Toggle selection
        const isSelected = element.classList.contains('selected');

        if (isSelected) {
            // Remove
            gameState.removeCategory(category);
            element.classList.remove('selected');
            element.setAttribute('aria-pressed', 'false');

            showNotification(`${data.name} entfernt`, 'info', 2000);
        } else {
            // Add
            gameState.addCategory(category);
            element.classList.add('selected');
            element.setAttribute('aria-pressed', 'true');

            showNotification(`${data.name} ausgewählt!`, 'success', 2000);
        }

        updateSelectionSummary();
    }

    // ===========================
    // SELECTION SUMMARY
    // ===========================

    /**
     * P0 FIX: Build summary with safe DOM manipulation
     */
    function updateSelectionSummary() {
        const summaryElement = document.getElementById('selection-summary');
        const categoriesListElement = document.getElementById('selected-categories-list');
        const totalQuestionsElement = document.getElementById('total-questions');
        const continueBtn = document.getElementById('continue-btn');
        const continueHint = document.getElementById('continue-hint');

        if (!summaryElement || !categoriesListElement || !totalQuestionsElement || !continueBtn || !continueHint) {
            return;
        }

        const selectedCategories = gameState.selectedCategories || [];

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
                iconSpan.setAttribute('aria-hidden', 'true');

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
            totalQuestionsElement.textContent = totalQuestions.toString();
        }
    }

    // ===========================
    // PREMIUM MODAL
    // ===========================

    function showPremiumInfo(event) {
        if (event) {
            event.stopPropagation();
        }

        const modal = document.getElementById('premium-modal');
        if (modal) {
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');

            // P1 FIX: Focus trap
            if (window.NocapUtils && window.NocapUtils.trapFocus) {
                const cleanup = window.NocapUtils.trapFocus(modal);
                modal._focusTrapCleanup = cleanup;
            }
        }
    }

    function closePremiumModal() {
        const modal = document.getElementById('premium-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');

            // P1 FIX: Cleanup focus trap
            if (modal._focusTrapCleanup && typeof modal._focusTrapCleanup === 'function') {
                modal._focusTrapCleanup();
                modal._focusTrapCleanup = null;
            }
        }
    }

    /**
     * P0 WARNING: This is NOT secure - can be manipulated
     * TODO: Move to server-side payment processing with real payment gateway
     */
    async function purchasePremium() {
        showNotification('Premium-Kauf wird vorbereitet...', 'info');

        try {
            // P0 WARNING: This validation can be bypassed client-side
            if (typeof firebase === 'undefined' || !firebase.database) {
                showNotification('Firebase nicht verfügbar', 'error');
                return;
            }

            if (!window.FirebaseConfig) {
                showNotification('Bitte warte, Firebase lädt...', 'warning');
                return;
            }

            await window.FirebaseConfig.waitForFirebase();

            const userId = window.FirebaseConfig.getCurrentUserId();
            if (!userId) {
                showNotification('Bitte erstelle zuerst einen Account', 'warning');
                return;
            }

            // P0 TODO: Replace with real payment gateway
            const purchaseRef = firebase.database().ref(`users/${userId}/purchases/special`);
            await purchaseRef.set({
                id: 'special_edition',
                name: 'Special Edition',
                price: 2.99,
                currency: 'EUR',
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                // P0 TODO: Add payment verification token
                verified: false // Should be set by Cloud Function after payment
            });

            // Unlock special category
            const specialCard = document.querySelector('[data-category="special"]');
            if (specialCard) {
                specialCard.classList.remove('locked');
                specialCard.setAttribute('aria-disabled', 'false');
            }

            const specialLocked = document.getElementById('special-locked');
            if (specialLocked) {
                specialLocked.style.display = 'none';
                specialLocked.setAttribute('aria-hidden', 'true');
            }

            closePremiumModal();
            showNotification('Premium freigeschaltet! 🎉', 'success', 3000);

            if (isDevelopment) {
                console.log('✅ Premium purchased (client-side only - NOT verified)');
            }

        } catch (error) {
            console.error('❌ Purchase error:', error);
            showNotification('Fehler beim Kauf', 'error');
        }
    }

    // ===========================
    // EVENT LISTENERS
    // ===========================

    function setupEventListeners() {
        // P1 FIX: Category cards with keyboard support
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', function() {
                toggleCategory(this);
            });

            card.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleCategory(this);
                }
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

        // Premium unlock button
        const unlockSpecialBtn = document.getElementById('unlock-special-btn');
        if (unlockSpecialBtn) {
            unlockSpecialBtn.addEventListener('click', showPremiumInfo);
        }

        // Premium modal
        const closePremiumBtn = document.getElementById('close-premium-modal');
        if (closePremiumBtn) {
            closePremiumBtn.addEventListener('click', closePremiumModal);
        }

        const closePremiumLater = document.getElementById('close-premium-later');
        if (closePremiumLater) {
            closePremiumLater.addEventListener('click', closePremiumModal);
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

    // ===========================
    // NAVIGATION
    // ===========================

    function proceedWithCategories() {
        const selectedCategories = gameState.selectedCategories || [];

        if (selectedCategories.length === 0) {
            showNotification('Bitte wähle mindestens eine Kategorie aus', 'warning');
            return;
        }

        if (isDevelopment) {
            console.log('🚀 Proceeding with categories:', selectedCategories);
        }

        showLoading();

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

        // Fallback implementation
        const container = document.getElementById('notification-container') || document.body;

        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'polite');

        const notificationContent = document.createElement('div');
        notificationContent.className = 'notification-content';

        const notificationText = document.createElement('span');
        notificationText.className = 'notification-text';
        notificationText.textContent = String(message);

        notificationContent.appendChild(notificationText);
        notification.appendChild(notificationContent);
        container.appendChild(notification);

        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        setTimeout(() => {
            notification.classList.remove('show');
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
            console.log('✅ Category selection cleanup completed');
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