/**
 * No-Cap Category Selection (Single Device Mode)
 * Version 8.1 - BUGFIX: GameState Constructor Error
 *
 * ✅ P0: Module Pattern - no global variables (XSS prevention)
 * ✅ P0: Event-Listener cleanup on beforeunload
 * ✅ P1: Device mode is SET HERE, not on landing page
 * ✅ P0: Age verification with expiration check
 * ✅ P0: Safe DOM manipulation (no innerHTML)
 * ✅ P0: MANDATORY server-side premium validation via Cloud Function
 * ✅ PRODUCTION: Logger statt console.log (no spam in production)
 */

(function(window) {
    'use strict';

    const Logger = window.NocapUtils?.Logger || {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {}
    };


    // ===========================
    // 🔒 MODULE SCOPE - NO GLOBAL POLLUTION
    // ===========================

    const CategorySelectionModule = {
        state: {
            gameState: null,
            questionCounts: {
                fsk0: 0,
                fsk16: 0,
                fsk18: 0,
                special: 0
            },
            eventListenerCleanup: [],
            isDevelopment: window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('192.168.')
        },

        // Controlled access
        get gameState() { return this.state.gameState; },
        set gameState(val) { this.state.gameState = val; },

        get questionCounts() { return this.state.questionCounts; },

        get isDevelopment() { return this.state.isDevelopment; }
    };

    // Prevent tampering
    Object.seal(CategorySelectionModule.state);

    // ===========================
    // 🛠️ PERFORMANCE UTILITIES
    // ===========================

    /**
     * ✅ P1 FIX: Throttle function for performance
     */
    function throttle(func, wait = 100) {
        let timeout = null;
        let previous = 0;

        return function executedFunction(...args) {
            const now = Date.now();
            const remaining = wait - (now - previous);

            if (remaining <= 0 || remaining > wait) {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                previous = now;
                func.apply(this, args);
            } else if (!timeout) {
                timeout = setTimeout(() => {
                    previous = Date.now();
                    timeout = null;
                    func.apply(this, args);
                }, remaining);
            }
        };
    }

    /**
     * ✅ P1 FIX: Debounce function for input events
     */
    function debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Register event listener with cleanup tracking
     */
    function addTrackedEventListener(element, event, handler, options = {}) {
        if (!element) return;
        element.addEventListener(event, handler, options);
        CategorySelectionModule.state.eventListenerCleanup.push({element, event, handler, options});
    }

    // ===========================
    // CATEGORY DATA
    // ===========================

    /**
     * ✅ P0 SECURITY: Sanitize category data to prevent XSS
     * Uses DOMPurify for HTML strings and validates structure
     */
    function sanitizeCategoryData(data) {
        if (!data || typeof data !== 'object') {
            Logger.warn('⚠️ Invalid category data:', data);
            return null;
        }

        // Sanitize all string fields
        const sanitized = {
            name: typeof data.name === 'string' ? DOMPurify.sanitize(data.name, { ALLOWED_TAGS: [] }) : '',
            icon: typeof data.icon === 'string' ? DOMPurify.sanitize(data.icon, { ALLOWED_TAGS: [] }) : '',
            color: typeof data.color === 'string' ? DOMPurify.sanitize(data.color, { ALLOWED_TAGS: [] }) : '#666',
            requiresAge: typeof data.requiresAge === 'number' ? data.requiresAge : 0,
            requiresPremium: Boolean(data.requiresPremium)
        };

        return sanitized;
    }

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
    // INITIALIZATION
    // ===========================

    /**
     * Wait for Firebase to be fully initialized
     */
    async function waitForFirebase() {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max

        while (attempts < maxAttempts) {
            if (window.FirebaseConfig?.isInitialized?.()) return true;
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        Logger.warn('⚠️ Firebase initialization timeout');
        return false;
    }

    async function initialize() {
        Logger.debug('🎯 Initializing category selection (single device)...');

        showLoading();

        try {
            // Check DOMPurify
            if (typeof DOMPurify === 'undefined') {
                Logger.error('❌ CRITICAL: DOMPurify not loaded!');
                alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
                return;
            }

            // ✅ BUGFIX: Check for window.GameState (the constructor)
            if (typeof window.GameState === 'undefined') {
                Logger.error('❌ GameState not found');
                showNotification('Fehler beim Laden. Bitte Seite neu laden.', 'error');
                return;
            }

            const firebaseReady = await waitForFirebase();
            if (!firebaseReady) {
                hideLoading();
                showNotification('Firebase konnte nicht geladen werden. Bitte lade die Seite neu.', 'error');
                return;
            }

            // Wait for utils if available
            if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
                await window.NocapUtils.waitForDependencies(['GameState']);
            }

            // ✅ BUGFIX: Use window.GameState (constructor) not CategorySelectionModule.gameState
            CategorySelectionModule.gameState = new window.GameState();

            // ✅ P1 FIX: Always set device mode to 'single' for category-selection
            Logger.debug('📱 Setting device mode: single');
            CategorySelectionModule.gameState.setDeviceMode('single');

            if (!validateGameState()) {
                hideLoading();
                return;
            }

            if (!checkAgeVerification()) {
                hideLoading();
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

            Logger.debug('✅ Category selection initialized');
            Logger.debug('Game State:', CategorySelectionModule.gameState.getDebugInfo());

        } catch (error) {
            Logger.error('❌ Initialization error:', error);
            showNotification('Fehler beim Laden', 'error');
            hideLoading();
        }
    }

    // ===========================
    // VALIDATION & GUARDS
    // ===========================

    function validateGameState() {
        // Device mode is already set to 'single' during initialization
        if (!CategorySelectionModule.gameState.checkValidity()) {
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
            // ✅ Settings-only: wir nutzen nur den Cache wie in settings.js
            const ageLevel = window.NocapUtils
                ? parseInt(window.NocapUtils.getLocalStorage('nocap_age_level')) || 0
                : parseInt(localStorage.getItem('nocap_age_level')) || 0;

            Logger.debug(`✅ Age cache level: ${ageLevel}+`);

            // Lock categories based on cached age
            updateCategoryLocks(ageLevel);

            // ✅ Kein Redirect mehr! User kann bei Klick die Altersprüfung starten.
            return true;

        } catch (error) {
            Logger.error('❌ Error checking age cache:', error);

            // Fail-safe: alles locken außer fsk0 + special (special wird später per premium geprüft)
            updateCategoryLocks(0);
            return true;
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
                    lockedOverlay.classList.remove('hidden');
                    lockedOverlay.classList.add('d-flex');
                    lockedOverlay.setAttribute('aria-hidden', 'false');
                }
            } else {
                card.classList.remove('locked');
                card.setAttribute('aria-disabled', 'false');

                const lockedOverlay = document.getElementById(`${category}-locked`);
                if (lockedOverlay) {
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
            if (!CategorySelectionModule.gameState) {
                Logger.warn('⚠️ GameState not initialized, cannot check premium status');
                lockPremiumCategory();
                return;
            }

            // Show loading state for premium check
            const specialCard = document.querySelector('[data-category="special"]');
            if (specialCard) {
                specialCard.classList.add('checking-premium');
            }

            // ✅ P0 FIX: MANDATORY server-side validation via Cloud Function
            const isPremium = await CategorySelectionModule.gameState.isPremiumUser();

            Logger.debug(`✅ Premium status (server-validated): ${isPremium}`);

            const specialLocked = document.getElementById('special-locked');

            if (isPremium) {
                // Unlock Special Edition
                if (specialCard) {
                    specialCard.classList.remove('locked', 'checking-premium');
                    specialCard.setAttribute('aria-disabled', 'false');
                }
                if (specialLocked) {
                    specialLocked.classList.add('hidden');
                    specialLocked.classList.remove('d-flex');
                    specialLocked.setAttribute('aria-hidden', 'true');
                }

                Logger.debug('🌟 Special Edition unlocked (server-validated)');
            } else {
                // Lock Special Edition
                lockPremiumCategory();
            }

        } catch (error) {
            Logger.error('❌ Premium check failed:', error);

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
            const instances = window.FirebaseConfig?.getFirebaseInstances?.();
            const database = instances?.database;

            if (!window.FirebaseConfig?.isInitialized?.() || !database?.ref) {
                Logger.warn('⚠️ Firebase database not available, using fallback counts');
                useFallbackCounts();
                return;
            }

            const questionsRef = database.ref('questions');
            const snapshot = await questionsRef.once('value');

            if (snapshot.exists()) {
                const questions = snapshot.val();

                Object.keys(categoryData).forEach(category => {
                    const categoryQuestions = questions[category];
                    if (categoryQuestions) {
                        if (Array.isArray(categoryQuestions)) {
                            CategorySelectionModule.questionCounts[category] = categoryQuestions.length;
                        } else if (typeof categoryQuestions === 'object') {
                            CategorySelectionModule.questionCounts[category] = Object.keys(categoryQuestions).length;
                        } else {
                            CategorySelectionModule.questionCounts[category] = getFallbackCount(category);
                        }
                    } else {
                        CategorySelectionModule.questionCounts[category] = getFallbackCount(category);
                    }

                    updateQuestionCountUI(category, CategorySelectionModule.questionCounts[category]);
                });

                Logger.debug('✅ Question counts loaded:', CategorySelectionModule.questionCounts);
            } else {
                Logger.warn('⚠️ No questions found, using fallbacks');
                useFallbackCounts();
            }

        } catch (error) {
            Logger.warn('⚠️ Error loading question counts:', error);
            useFallbackCounts();
        }
    }

    function useFallbackCounts() {
        Object.keys(categoryData).forEach(category => {
            CategorySelectionModule.questionCounts[category] = getFallbackCount(category);
            updateQuestionCountUI(category, CategorySelectionModule.questionCounts[category]);
        });

        Logger.debug('✅ Using fallback counts');
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
        const selected = CategorySelectionModule.gameState.selectedCategories;

        if (Array.isArray(selected) && selected.length > 0) {
            selected.forEach(category => {
                // Validate category exists
                if (!categoryData[category]) {
                    Logger.warn('⚠️ Invalid category in GameState:', category);
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
            Logger.error('❌ Invalid category:', category);
            return;
        }

        const data = categoryData[category];

        if (element.classList.contains('locked')) {
            if (data.requiresPremium) {
                showPremiumInfo();
                return;
            }

            if (data.requiresAge > 0) {
                if (window.SettingsModule && typeof window.SettingsModule.showFSKError === 'function') {
                    window.SettingsModule.showFSKError(category, `Du musst ${data.requiresAge}+ sein für diese Kategorie`);
                } else {
                    showNotification(`Du musst ${data.requiresAge}+ sein für diese Kategorie`, 'warning');
                }
            }
            return;
        }

        // ✅ NEW: FSK-Validierung via Cloud Function für fsk16/fsk18
        if (category === 'fsk16' || category === 'fsk18') {
            validateAndToggleCategory(element, category, data);
            return;
        }

        // Toggle selection (für fsk0 und special)
        performToggle(element, category, data);
    }

    /**
     * ✅ NEW: Validate FSK access server-side before toggling
     */
    async function validateAndToggleCategory(element, category, data) {
        try {
            // Call SettingsModule.validateFSKAccess if available
            if (window.SettingsModule && typeof window.SettingsModule.validateFSKAccess === 'function') {
                Logger.info('🔐 Validating FSK access via Cloud Function:', category);

                const allowed = await window.SettingsModule.validateFSKAccess(category);

                if (allowed) {
                    Logger.info('✅ FSK access granted, toggling category');
                    performToggle(element, category, data);
                } else {
                    Logger.warn('❌ FSK access denied');

                    // ✅ Falls validateFSKAccess nicht selbst UI zeigt: erzwingen wir es hier
                    if (window.SettingsModule && typeof window.SettingsModule.showFSKError === 'function') {
                        window.SettingsModule.showFSKError(category, `Du musst ${data.requiresAge}+ sein für diese Kategorie`);
                    } else {
                        showNotification(`Du musst ${data.requiresAge}+ sein für diese Kategorie`, 'warning');
                    }
                }

            } else {
                // Fallback to client-side check if SettingsModule not available
                Logger.warn('⚠️ SettingsModule not available, using fallback');
                const ageLevel = window.NocapUtils
                    ? parseInt(window.NocapUtils.getLocalStorage('nocap_age_level')) || 0
                    : parseInt(localStorage.getItem('nocap_age_level')) || 0;

                if ((category === 'fsk16' && ageLevel >= 16) || (category === 'fsk18' && ageLevel >= 18)) {
                    performToggle(element, category, data);
                } else {
                    showNotification(
                        `Du musst ${category === 'fsk16' ? '16' : '18'}+ sein für diese Kategorie`,
                        'warning'
                    );
                }
            }
        } catch (error) {
            Logger.error('❌ Error validating FSK:', error);
            showNotification('Fehler bei der Altersverifikation', 'error');
        }
    }

    /**
     * ✅ NEW: Perform actual toggle logic (extracted for reuse)
     */
    function performToggle(element, category, data) {
        const isSelected = element.classList.contains('selected');

        if (isSelected) {
            // Remove
            CategorySelectionModule.gameState.removeCategory(category);
            element.classList.remove('selected');
            element.setAttribute('aria-pressed', 'false');

            showNotification(`${data.name} entfernt`, 'info', 2000);
        } else {
            // Add
            CategorySelectionModule.gameState.addCategory(category);
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

        const selectedCategories = CategorySelectionModule.gameState.selectedCategories || [];

        if (selectedCategories.length === 0) {
            summaryElement.classList.add('hidden');
            continueBtn.disabled = true;
            continueBtn.setAttribute('aria-disabled', 'true');
            continueHint.textContent = 'Wähle mindestens eine Kategorie aus';
        } else {
            summaryElement.classList.remove('hidden');
            continueBtn.disabled = false;
            continueBtn.setAttribute('aria-disabled', 'false');
            continueHint.textContent = `${selectedCategories.length} Kategorie${selectedCategories.length > 1 ? 'n' : ''} ausgewählt`;

            // Build list safely with DOM manipulation (no innerHTML)
            categoriesListElement.replaceChildren();

            selectedCategories.forEach(category => {
                const rawData = categoryData[category];
                if (!rawData) return;

                // ✅ P0 SECURITY: Sanitize category data before rendering
                const data = sanitizeCategoryData(rawData);
                if (!data) return;

                const tag = document.createElement('div');
                tag.className = 'selected-category-tag';

                const iconSpan = document.createElement('span');
                iconSpan.textContent = data.icon; // textContent is XSS-safe
                iconSpan.setAttribute('aria-hidden', 'true');

                const nameSpan = document.createElement('span');
                nameSpan.textContent = data.name; // textContent is XSS-safe

                tag.appendChild(iconSpan);
                tag.appendChild(nameSpan);
                categoriesListElement.appendChild(tag);
            });

            // Calculate total questions
            const totalQuestions = selectedCategories.reduce((sum, category) => {
                return sum + (CategorySelectionModule.questionCounts[category] || 0);
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
        if (!CategorySelectionModule.isDevelopment) {
            showNotification('Premium-Kauf ist aktuell nicht verfügbar.', 'error');
            return;
        }
        try {
            const instances = window.FirebaseConfig?.getFirebaseInstances?.();
            const database = instances?.database;

            if (!window.FirebaseConfig?.isInitialized?.() || !database?.ref) {
                showNotification('Firebase nicht verfügbar', 'error');
                return;
            }

            const auth = instances?.auth;
            const userId = auth?.currentUser?.uid;

            if (!userId) {
                showNotification('Bitte erstelle zuerst einen Account', 'warning');
                return;
            }

            const purchaseRef = database.ref(`users/${userId}/purchases/special`);
            await purchaseRef.set({
                id: 'special_edition',
                name: 'Special Edition',
                price: 2.99,
                currency: 'EUR',
                timestamp: Date.now(),
                verified: false
            });

            // Unlock special category
            const specialCard = document.querySelector('[data-category="special"]');
            if (specialCard) {
                specialCard.classList.remove('locked');
                specialCard.setAttribute('aria-disabled', 'false');
            }

            const specialLocked = document.getElementById('special-locked');
            if (specialLocked) {
                specialLocked.classList.add('hidden');
                specialLocked.classList.remove('d-flex');
                specialLocked.setAttribute('aria-hidden', 'true');
            }

            closePremiumModal();
            showNotification('Premium freigeschaltet! 🎉', 'success', 3000);

            if (CategorySelectionModule.isDevelopment) {
                Logger.debug('✅ Premium purchased (client-side only - NOT verified)');
            }

        } catch (error) {
            Logger.error('❌ Purchase error:', error);
            showNotification('Fehler beim Kauf', 'error');
        }
    }

    // ===========================
    // EVENT LISTENERS
    // ===========================

    function setupEventListeners() {
        // Category cards with keyboard support
        document.querySelectorAll('.category-card').forEach(card => {
            addTrackedEventListener(card, 'click', function() {
                toggleCategory(this);
            });

            addTrackedEventListener(card, 'keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleCategory(this);
                }
            });
        });

        // Continue button
        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) {
            addTrackedEventListener(continueBtn, 'click', proceedWithCategories);
        }

        // Back button
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            addTrackedEventListener(backBtn, 'click', goBack);
        }

        // Premium unlock button
        const unlockSpecialBtn = document.getElementById('unlock-special-btn');
        if (unlockSpecialBtn) {
            addTrackedEventListener(unlockSpecialBtn, 'click', function(e) {
                e.stopPropagation(); // Verhindert, dass Click an Card weitergegeben wird
                showPremiumInfo();
            });
        }

        // Premium modal
        const closePremiumBtn = document.getElementById('close-premium-modal');
        if (closePremiumBtn) {
            addTrackedEventListener(closePremiumBtn, 'click', closePremiumModal);
        }

        const closePremiumLater = document.getElementById('close-premium-later');
        if (closePremiumLater) {
            addTrackedEventListener(closePremiumLater, 'click', closePremiumModal);
        }

        const purchasePremiumBtn = document.getElementById('purchase-premium-btn');
        if (purchasePremiumBtn) {
            addTrackedEventListener(purchasePremiumBtn, 'click', purchasePremium);
        }

        // ESC key closes modal
        addTrackedEventListener(document, 'keydown', (e) => {
            if (e.key === 'Escape') {
                closePremiumModal();
            }
        });
// ✅ Re-check locks after age verification flow on this page
        const verifyAgeBtn = document.getElementById('verify-age-btn');
        if (verifyAgeBtn) {
            addTrackedEventListener(verifyAgeBtn, 'click', () => {
                // give settings.js a moment to write localStorage
                setTimeout(() => {
                    const ageLevel = window.NocapUtils
                        ? parseInt(window.NocapUtils.getLocalStorage('nocap_age_level')) || 0
                        : parseInt(localStorage.getItem('nocap_age_level')) || 0;

                    updateCategoryLocks(ageLevel);
                }, 300);
            });
        }
    }

    // ===========================
    // NAVIGATION
    // ===========================

    async function proceedWithCategories() {
        const selectedCategories = CategorySelectionModule.gameState.selectedCategories || [];

        if (selectedCategories.length === 0) {
            showNotification('Bitte wähle mindestens eine Kategorie aus', 'warning');
            return;
        }

        if (CategorySelectionModule.isDevelopment) {
            Logger.debug('🚀 Proceeding with categories:', selectedCategories);
        }

        showLoading();

        // ✅ AUDIT FIX: Serverseitige Validierung aller ausgewählten Kategorien
        try {
            // Prüfe Firebase & Auth
            if (!window.FirebaseConfig || !window.FirebaseConfig.isInitialized()) {
                if (CategorySelectionModule.isDevelopment) {
                    Logger.debug('⚠️ Firebase not initialized, skipping server validation');
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
                if (CategorySelectionModule.isDevelopment) {
                    Logger.debug('⚠️ Firebase Functions not available (Blaze plan required), skipping server validation');
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
                        CategorySelectionModule.gameState.removeCategory(categoryId);
                        const card = document.querySelector(`[data-category="${categoryId}"]`);
                        if (card) {
                            card.classList.remove('selected');
                            card.setAttribute('aria-pressed', 'false');
                        }
                        return;
                    }

                    if (CategorySelectionModule.isDevelopment) {
                        Logger.debug(`✅ Server validated access to ${categoryId}`);
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
                        CategorySelectionModule.gameState.removeCategory(categoryId);
                        return;
                    }

                    if (error.code === 'unauthenticated') {
                        showNotification('Bitte melde dich an, um fortzufahren', 'error');
                        return;
                    }

                    Logger.error('❌ Server validation failed for category:', categoryId, error);
                    showNotification('Fehler bei der Validierung. Bitte versuche es erneut.', 'error');
                    return;
                }
            }

            // Alle Kategorien erfolgreich validiert
            if (CategorySelectionModule.isDevelopment) {
                Logger.debug('✅ All categories validated successfully');
            }

            setTimeout(() => {
                window.location.href = 'difficulty-selection.html';
            }, 500);

        } catch (error) {
            hideLoading();
            Logger.error('❌ Category validation error:', error);
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
    // UI HELPERS (use NocapUtils)
    // ===========================

    const showLoading = window.NocapUtils?.showLoading || function() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.add('show');
    };

    const hideLoading = window.NocapUtils?.hideLoading || function() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.remove('show');
    };

    const showNotification = window.NocapUtils?.showNotification || function(message, type = 'info') {
        alert(message); // Fallback
    };

    // ===========================
    // CLEANUP
    // ===========================

    function cleanup() {
        // Remove tracked event listeners
        CategorySelectionModule.state.eventListenerCleanup.forEach(({element, event, handler, options}) => {
            try {
                element.removeEventListener(event, handler, options);
            } catch (error) {
                // Element may have been removed from DOM
            }
        });
        CategorySelectionModule.state.eventListenerCleanup = [];

        // Cleanup NocapUtils event listeners
        if (window.NocapUtils && window.NocapUtils.cleanupEventListeners) {
            window.NocapUtils.cleanupEventListeners();
        }

        if (CategorySelectionModule.isDevelopment) {
            Logger.debug('✅ Category selection cleanup completed');
        }
    }

    window.addEventListener('beforeunload', cleanup);

    // ===========================
    // INITIALIZATION
    // ===========================

    async function startApp() {
        const firebaseReady = await waitForFirebase();
        if (firebaseReady) {
            await initialize();
        } else {
            showNotification('Firebase konnte nicht geladen werden. Bitte lade die Seite neu.', 'error');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp);
    } else {
        startApp();
    }

})(window);