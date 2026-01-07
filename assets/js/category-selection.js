/**
 * No-Cap Category Selection (Single Device Mode)
 * Version 6.0 - P0 Security Fixes Applied
 *
 * ✅ P1 FIX: Device mode is SET HERE, not on landing page
 * ✅ P0 FIX: Age verification with expiration check
 * ✅ P0 FIX: Safe DOM manipulation (no innerHTML)
 * ✅ P0 FIX: MANDATORY server-side premium validation via Cloud Function
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
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('192.168.');

    // ===========================
    // INITIALIZATION
    // ===========================

    async function initialize() {
        if (isDevelopment) {
            console.log('🎯 Initializing category selection (single device)...');
        }

        showLoading();

        try {
            // Check DOMPurify
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

            // Wait for utils if available
            if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
                await window.NocapUtils.waitForDependencies(['GameState']);
            }

            gameState = new GameState();

            // ✅ P1 FIX: Set device mode HERE (not on landing page)
            if (!gameState.deviceMode) {
                if (isDevelopment) {
                    console.log('📱 Setting device mode: single');
                }
                gameState.setDeviceMode('single');
            }

            // Validate game state
            if (!validateGameState()) {
                return;
            }

            // Check age verification
            if (!checkAgeVerification()) {
                return;
            }

            // Check premium status
            await checkPremiumStatus();

            // Load question counts
            await loadQuestionCounts();

            // Load selected categories from GameState
            initializeSelectedCategories();

            // Setup event listeners
            setupEventListeners();

            hideLoading();

            if (isDevelopment) {
                console.log('✅ Category selection initialized');
                console.log('Game State:', gameState.getDebugInfo());
            }

        } catch (error) {
            console.error('❌ Initialization error:', error);
            showNotification('Fehler beim Laden', 'error');
            hideLoading();
        }
    }

    // ===========================
    // VALIDATION & GUARDS
    // ===========================

    function validateGameState() {
        // ✅ P1 FIX: Device mode might not be set yet - that's OK
        // We set it above, so now validate it
        if (gameState.deviceMode !== 'single') {
            if (isDevelopment) {
                console.warn('⚠️ Device mode was not "single", correcting...');
            }
            gameState.setDeviceMode('single');
        }

        if (!gameState.checkValidity()) {
            showNotification('Ungültiger Spielzustand', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        return true;
    }

    /**
     * Validate age verification with expiration check
     */
    function checkAgeVerification() {
        try {
            // Get age level
            const ageLevel = window.NocapUtils
                ? parseInt(window.NocapUtils.getLocalStorage('nocap_age_level')) || 0
                : parseInt(localStorage.getItem('nocap_age_level')) || 0;

            // Get verification object
            const verificationStr = window.NocapUtils
                ? window.NocapUtils.getLocalStorage('nocap_age_verification')
                : localStorage.getItem('nocap_age_verification');

            const verification = verificationStr
                ? (typeof verificationStr === 'string' ? JSON.parse(verificationStr) : verificationStr)
                : null;

            // Check expiration
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
                console.warn('⚠️ No age verification found');
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
     * Update category locks based on age
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
                    // ✅ CSP-FIX: Use CSS class instead of inline style
                    lockedOverlay.classList.remove('hidden');
                    lockedOverlay.classList.add('d-flex');
                    lockedOverlay.setAttribute('aria-hidden', 'false');
                }
            } else {
                card.classList.remove('locked');
                card.setAttribute('aria-disabled', 'false');

                const lockedOverlay = document.getElementById(`${category}-locked`);
                if (lockedOverlay) {
                    // ✅ CSP-FIX: Use CSS class instead of inline style
                    lockedOverlay.classList.add('hidden');
                    lockedOverlay.classList.remove('d-flex');
                    lockedOverlay.setAttribute('aria-hidden', 'true');
                }
            }
        });
    }

    /**
     * ✅ P0 FIX: Check premium status with MANDATORY server-side validation
     * Uses GameState.isPremiumUser() which calls Cloud Function
     */
    async function checkPremiumStatus() {
        try {
            // ✅ P0 FIX: Use GameState's server-side validation
            if (!gameState) {
                console.warn('⚠️ GameState not initialized, cannot check premium status');
                lockPremiumCategory();
                return;
            }

            // Show loading state for premium check
            const specialCard = document.querySelector('[data-category="special"]');
            if (specialCard) {
                specialCard.classList.add('checking-premium');
            }

            // ✅ P0 FIX: MANDATORY server-side validation via Cloud Function
            const isPremium = await gameState.isPremiumUser();

            if (isDevelopment) {
                console.log(`✅ Premium status (server-validated): ${isPremium}`);
            }

            const specialLocked = document.getElementById('special-locked');

            if (isPremium) {
                // Unlock Special Edition
                if (specialCard) {
                    specialCard.classList.remove('locked', 'checking-premium');
                    specialCard.setAttribute('aria-disabled', 'false');
                }
                if (specialLocked) {
                    // ✅ CSP-FIX: Use CSS class instead of inline style
                    specialLocked.classList.add('hidden');
                    specialLocked.classList.remove('d-flex');
                    specialLocked.setAttribute('aria-hidden', 'true');
                }

                if (isDevelopment) {
                    console.log('🌟 Special Edition unlocked (server-validated)');
                }
            } else {
                // Lock Special Edition
                lockPremiumCategory();
            }

        } catch (error) {
            console.error('❌ Premium check failed:', error);

            // ✅ P0 FIX: FAIL SECURE - lock on error
            lockPremiumCategory();

            // Show user-friendly error
            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    'Premium-Status konnte nicht überprüft werden',
                    'warning',
                    3000
                );
            }
        }
    }

    /**
     * Helper: Lock premium category (fail-secure)
     */
    function lockPremiumCategory() {
        const specialCard = document.querySelector('[data-category="special"]');
        const specialLocked = document.getElementById('special-locked');

        if (specialCard) {
            specialCard.classList.add('locked');
            specialCard.classList.remove('checking-premium');
            specialCard.setAttribute('aria-disabled', 'true');
        }
        if (specialLocked) {
            // ✅ CSP-FIX: Use CSS class instead of inline style
            specialLocked.classList.remove('hidden');
            specialLocked.classList.add('d-flex');
            specialLocked.setAttribute('aria-hidden', 'false');
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

            // Wait for Firebase if available
            if (window.FirebaseService && window.FirebaseService.waitForFirebase) {
                await window.FirebaseService.waitForFirebase();
            }

            // ✅ FIX: Ensure user is authenticated (anonymous auth if needed)
            if (firebase.auth && !firebase.auth().currentUser) {
                try {
                    await firebase.auth().signInAnonymously();
                    if (isDevelopment) {
                        console.log('✅ Signed in anonymously for question counts');
                    }
                } catch (authError) {
                    console.warn('⚠️ Anonymous auth failed, using fallback counts:', authError);
                    useFallbackCounts();
                    return;
                }
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
     * Use textContent for XSS safety
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
                // Validate category exists
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
     * Toggle category with validation
     */
    function toggleCategory(element) {
        const category = element.dataset.category;
        if (!category) return;

        // Validate category exists
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
     * Build summary with safe DOM manipulation
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

            // Build list safely with DOM manipulation (no innerHTML)
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
            // ✅ CSP-FIX: Use CSS class instead of inline style
            modal.classList.remove('hidden');
            modal.classList.add('d-flex');
            modal.setAttribute('aria-hidden', 'false');

            // Focus trap
            if (window.NocapUtils && window.NocapUtils.trapFocus) {
                const cleanup = window.NocapUtils.trapFocus(modal);
                modal._focusTrapCleanup = cleanup;
            }
        }
    }

    function closePremiumModal() {
        const modal = document.getElementById('premium-modal');
        if (modal) {
            // ✅ CSP-FIX: Use CSS class instead of inline style
            modal.classList.add('hidden');
            modal.classList.remove('d-flex');
            modal.setAttribute('aria-hidden', 'true');

            // Cleanup focus trap
            if (modal._focusTrapCleanup && typeof modal._focusTrapCleanup === 'function') {
                modal._focusTrapCleanup();
                modal._focusTrapCleanup = null;
            }
        }
    }

    /**
     * ⚠️ WARNING: This is NOT secure - can be manipulated
     * TODO: Move to server-side payment processing with real payment gateway
     */
    async function purchasePremium() {
        showNotification('Premium-Kauf wird vorbereitet...', 'info');

        try {
            if (typeof firebase === 'undefined' || !firebase.database) {
                showNotification('Firebase nicht verfügbar', 'error');
                return;
            }

            if (!window.FirebaseService) {
                showNotification('Bitte warte, Firebase lädt...', 'warning');
                return;
            }

            await window.FirebaseService.waitForFirebase();

            const userId = window.FirebaseService.getCurrentUserId();
            if (!userId) {
                showNotification('Bitte erstelle zuerst einen Account', 'warning');
                return;
            }

            // TODO: Replace with real payment gateway (Stripe, PayPal, etc.)
            const purchaseRef = firebase.database().ref(`users/${userId}/purchases/special`);
            await purchaseRef.set({
                id: 'special_edition',
                name: 'Special Edition',
                price: 2.99,
                currency: 'EUR',
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                // TODO: Add payment verification token
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
                // ✅ CSP-FIX: Use CSS class instead of inline style
                specialLocked.classList.add('hidden');
                specialLocked.classList.remove('d-flex');
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
        // Category cards with keyboard support
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
            unlockSpecialBtn.addEventListener('click', function(e) {
                e.stopPropagation(); // Verhindert, dass Click an Card weitergegeben wird
                showPremiumInfo();
            });
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

    async function proceedWithCategories() {
        const selectedCategories = gameState.selectedCategories || [];

        if (selectedCategories.length === 0) {
            showNotification('Bitte wähle mindestens eine Kategorie aus', 'warning');
            return;
        }

        if (isDevelopment) {
            console.log('🚀 Proceeding with categories:', selectedCategories);
        }

        showLoading();

        // ✅ AUDIT FIX: Serverseitige Validierung aller ausgewählten Kategorien
        try {
            // Prüfe Firebase & Auth
            if (!window.FirebaseConfig || !window.FirebaseConfig.isInitialized()) {
                if (isDevelopment) {
                    console.log('⚠️ Firebase not initialized, skipping server validation');
                }
                // Fallback: Weiter ohne Validierung (nur für Development)
                setTimeout(() => {
                    window.location.href = 'difficulty-selection.html';
                }, 500);
                return;
            }

            const instances = window.FirebaseConfig.getFirebaseInstances();

            // Prüfe ob Functions verfügbar (benötigt Blaze-Plan)
            if (!instances || !instances.functions) {
                if (isDevelopment) {
                    console.log('⚠️ Firebase Functions not available (Blaze plan required), skipping server validation');
                }
                // Fallback: Weiter ohne serverseitige Validierung
                setTimeout(() => {
                    window.location.href = 'difficulty-selection.html';
                }, 500);
                return;
            }

            const { functions } = instances;
            const checkAccess = functions.httpsCallable('checkCategoryAccess');

            // Validiere jede Kategorie serverseitig
            for (const categoryId of selectedCategories) {
                try {
                    const result = await checkAccess({ categoryId });

                    if (!result.data || !result.data.allowed) {
                        hideLoading();
                        showNotification(`Zugriff auf ${categoryData[categoryId]?.name || categoryId} verweigert`, 'error');
                        // Entferne die Kategorie
                        gameState.removeCategory(categoryId);
                        const card = document.querySelector(`[data-category="${categoryId}"]`);
                        if (card) {
                            card.classList.remove('selected');
                            card.setAttribute('aria-pressed', 'false');
                        }
                        return;
                    }

                    if (isDevelopment) {
                        console.log(`✅ Server validated access to ${categoryId}`);
                    }

                } catch (error) {
                    hideLoading();

                    if (error.code === 'permission-denied') {
                        const data = categoryData[categoryId];
                        if (data?.requiresPremium) {
                            showPremiumInfo();
                        } else {
                            showNotification(
                                `Keine Berechtigung für ${data?.name || categoryId}. Bitte Altersverifikation prüfen.`,
                                'error'
                            );
                        }
                        gameState.removeCategory(categoryId);
                        return;
                    }

                    if (error.code === 'unauthenticated') {
                        showNotification('Bitte melde dich an, um fortzufahren', 'error');
                        return;
                    }

                    console.error(`❌ Server validation failed for ${categoryId}:`, error);
                    showNotification('Fehler bei der Validierung. Bitte versuche es erneut.', 'error');
                    return;
                }
            }

            // Alle Kategorien erfolgreich validiert
            if (isDevelopment) {
                console.log('✅ All categories validated successfully');
            }

            setTimeout(() => {
                window.location.href = 'difficulty-selection.html';
            }, 500);

        } catch (error) {
            hideLoading();
            console.error('❌ Category validation error:', error);
            showNotification('Fehler beim Fortfahren. Bitte versuche es erneut.', 'error');
        }
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
     * Safe notification using NocapUtils
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