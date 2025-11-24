// No-Cap - Utility Functions
// Version 3.0 - Audit-Fixed & Production Ready
// Gemeinsame Hilfsfunktionen für die gesamte App

// ============================================================================
// SECURITY CHECK: DOMPurify REQUIRED
// ============================================================================

(function checkDOMPurify() {
    if (typeof DOMPurify === 'undefined') {
        console.error(
            '❌ CRITICAL SECURITY ERROR: DOMPurify is not loaded!\n' +
            'This is a security requirement. Add to your HTML:\n' +
            '<script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>'
        );
        throw new Error('DOMPurify is required for security. Application cannot start.');
    }
})();

// ============================================================================
// NAMESPACE & SINGLETON PATTERN
// ============================================================================

(function(window) {
    'use strict';

    // P1 FIX: Singleton für Loading-Spinner und Notifications
    let loadingSpinner = null;
    let notificationContainer = null;

    // P1 FIX: Tracking für Event-Listener (Memory-Leak-Prevention)
    const _eventListeners = [];

    // ============================================================================
    // LOADING & UI FUNCTIONS
    // ============================================================================

    /**
     * P1 FIX: Singleton Loading Spinner
     */
    function ensureLoadingSpinner() {
        if (!loadingSpinner) {
            loadingSpinner = document.getElementById('loading');

            // Create if not exists
            if (!loadingSpinner) {
                loadingSpinner = document.createElement('div');
                loadingSpinner.id = 'loading';
                loadingSpinner.className = 'loading-overlay';

                const spinner = document.createElement('div');
                spinner.className = 'spinner';
                loadingSpinner.appendChild(spinner);

                document.body.appendChild(loadingSpinner);
            }
        }
        return loadingSpinner;
    }

    /**
     * Show loading spinner
     */
    function showLoading() {
        const loading = ensureLoadingSpinner();
        if (loading) {
            loading.classList.add('show');
        }
    }

    /**
     * Hide loading spinner
     */
    function hideLoading() {
        if (loadingSpinner) {
            loadingSpinner.classList.remove('show');
        }
    }

    /**
     * P0 FIX: Notification mit sicherer DOM-Erzeugung (KEIN innerHTML)
     */
    function showNotification(message, type = 'info', duration = 3000) {
        // P1 FIX: Ensure notification container exists
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            notificationContainer.className = 'notification-container';
            document.body.appendChild(notificationContainer);
        }

        // Remove old notifications of same type
        const existingNotifications = notificationContainer.querySelectorAll(`.notification.${type}`);
        existingNotifications.forEach(n => {
            if (n._hideTimeout) {
                clearTimeout(n._hideTimeout);
            }
            n.remove();
        });

        // P0 FIX: Sanitize message - plain text only, no HTML allowed
        const sanitizedMessage = sanitizeInput(message);

        // P0 FIX: Create elements safely without innerHTML
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'polite');

        const content = document.createElement('div');
        content.className = 'notification-content';

        const icon = document.createElement('span');
        icon.className = 'notification-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = getNotificationIcon(type);

        const text = document.createElement('span');
        text.className = 'notification-text';
        text.textContent = sanitizedMessage; // P0 FIX: textContent prevents XSS

        const closeBtn = document.createElement('button');
        closeBtn.className = 'notification-close';
        closeBtn.setAttribute('aria-label', 'Benachrichtigung schließen');
        closeBtn.textContent = '×';
        closeBtn.onclick = () => {
            if (notification._hideTimeout) {
                clearTimeout(notification._hideTimeout);
            }
            hideNotification(notification);
        };

        content.appendChild(icon);
        content.appendChild(text);
        content.appendChild(closeBtn);
        notification.appendChild(content);

        notificationContainer.appendChild(notification);

        // Show notification with animation
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // Auto hide
        const hideTimeout = setTimeout(() => {
            hideNotification(notification);
        }, duration);

        notification._hideTimeout = hideTimeout;

        return notification;
    }

    /**
     * P1 FIX: Separate hide function
     */
    function hideNotification(notification) {
        if (!notification || !notification.parentNode) return;

        notification.classList.remove('show');

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }

    /**
     * Get notification icon
     */
    function getNotificationIcon(type) {
        const icons = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }

    // ============================================================================
    // SANITIZATION HELPERS - P0 SECURITY FIXES
    // ============================================================================

    /**
     * P0 FIX: Sanitize user input - STRICT TEXT ONLY
     * Use this for player names, game IDs, and any user-generated text
     * NO HTML ALLOWED - strips all tags
     */
    function sanitizeInput(input) {
        if (!input) return '';

        if (typeof input !== 'string') {
            input = String(input);
        }

        // P0 FIX: DOMPurify with ALLOWED_TAGS: [] strips ALL HTML
        const sanitized = DOMPurify.sanitize(input, {
            ALLOWED_TAGS: [],
            ALLOWED_ATTR: [],
            KEEP_CONTENT: true
        });

        // P0 FIX: Additional safety - remove potential XSS patterns
        return sanitized
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/data:text\/html/gi, '')
            .trim()
            .substring(0, 500); // P0 FIX: Max length to prevent DOS
    }

    /**
     * P0 FIX: Sanitize HTML for safe innerHTML usage
     * Use ONLY when you explicitly need HTML content
     * For most cases, prefer textContent instead!
     */
    function sanitizeHTML(html) {
        if (!html) return '';

        // P0 FIX: Strict whitelist of allowed tags
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'p', 'br', 'div'],
            ALLOWED_ATTR: ['class'],
            KEEP_CONTENT: true,
            RETURN_TRUSTED_TYPE: false,
            FORBID_ATTR: ['style', 'onerror', 'onload'],
            FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link']
        });
    }

    /**
     * P0 FIX: Create text node safely - USE THIS INSTEAD OF innerHTML
     * This is the safest way to add user content to DOM
     */
    function setTextContent(element, text) {
        if (!element) return;
        element.textContent = sanitizeInput(text);
    }

    /**
     * P0 FIX: Create HTML element with text content safely
     */
    function createElementWithText(tag, text, className = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        element.textContent = sanitizeInput(text);
        return element;
    }

    /**
     * P1 FIX: Create button safely
     */
    function createButton(text, onClick, className = '') {
        const button = document.createElement('button');
        button.type = 'button';
        if (className) button.className = className;
        button.textContent = sanitizeInput(text);

        if (typeof onClick === 'function') {
            button.addEventListener('click', onClick);
        }

        return button;
    }

    // ============================================================================
    // MOBILE OPTIMIZATIONS
    // ============================================================================

    /**
     * Initialize mobile optimizations
     */
    function initMobileOptimizations() {
        // Prevent zoom on input focus (iOS)
        if (isMobile()) {
            const touchHandler = () => {};
            document.addEventListener('touchstart', touchHandler, { passive: true });
            _eventListeners.push({
                element: document,
                event: 'touchstart',
                handler: touchHandler,
                options: { passive: true }
            });

            // Add viewport meta tag if not present
            if (!document.querySelector('meta[name="viewport"]')) {
                const meta = document.createElement('meta');
                meta.name = 'viewport';
                meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
                document.head.appendChild(meta);
            }

            // Handle safe area insets
            handleSafeAreaInsets();

            // Handle orientation changes
            const orientationHandler = handleOrientationChange;
            window.addEventListener('orientationchange', orientationHandler);
            _eventListeners.push({
                element: window,
                event: 'orientationchange',
                handler: orientationHandler
            });

            // Prevent bounce scrolling on iOS
            const touchMoveHandler = function(e) {
                if (e.target === document.body) {
                    e.preventDefault();
                }
            };
            document.body.addEventListener('touchmove', touchMoveHandler, { passive: false });
            _eventListeners.push({
                element: document.body,
                event: 'touchmove',
                handler: touchMoveHandler,
                options: { passive: false }
            });
        }

        // Handle keyboard visibility
        handleVirtualKeyboard();
    }

    /**
     * Check if device is mobile
     */
    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    /**
     * Handle safe area insets (for devices with notches)
     */
    function handleSafeAreaInsets() {
        const root = document.documentElement;

        // Add CSS custom properties for safe areas
        root.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top)');
        root.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right)');
        root.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom)');
        root.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left)');
    }

    /**
     * Handle orientation changes
     */
    function handleOrientationChange() {
        // Force repaint to fix layout issues
        setTimeout(() => {
            window.scrollTo(0, 0);

            // Dispatch custom event
            window.dispatchEvent(new CustomEvent('nocap:orientationchange'));
        }, 100);
    }

    /**
     * Handle virtual keyboard
     */
    function handleVirtualKeyboard() {
        const initialViewportHeight = window.innerHeight;

        const resizeHandler = () => {
            const currentHeight = window.innerHeight;
            const heightDifference = initialViewportHeight - currentHeight;

            // If height decreased significantly, keyboard is probably open
            if (heightDifference > 150) {
                document.body.classList.add('keyboard-open');
            } else {
                document.body.classList.remove('keyboard-open');
            }
        };

        window.addEventListener('resize', resizeHandler);
        _eventListeners.push({
            element: window,
            event: 'resize',
            handler: resizeHandler
        });
    }

    /**
     * P1 FIX: Cleanup event listeners (call on page unload)
     */
    function cleanupEventListeners() {
        _eventListeners.forEach(({ element, event, handler, options }) => {
            try {
                element.removeEventListener(event, handler, options);
            } catch (error) {
                console.warn('Error removing event listener:', error);
            }
        });
        _eventListeners.length = 0;

        // Clear notification timeouts
        if (notificationContainer) {
            notificationContainer.querySelectorAll('.notification').forEach(n => {
                if (n._hideTimeout) {
                    clearTimeout(n._hideTimeout);
                }
            });
        }
    }

    // ============================================================================
    // ANIMATION HELPERS
    // ============================================================================

    /**
     * Add entrance animation to elements
     */
    function addEntranceAnimation(elements, delay = 100) {
        if (!elements) return;

        // Convert to array if NodeList
        const elementsArray = Array.isArray(elements) ? elements : Array.from(elements);

        elementsArray.forEach((element, index) => {
            if (!element) return;

            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';

            setTimeout(() => {
                element.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, index * delay);
        });
    }

    /**
     * Animate element removal
     */
    function animateRemoval(element, callback) {
        if (!element) return;

        element.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        element.style.opacity = '0';
        element.style.transform = 'translateX(-20px)';

        setTimeout(() => {
            if (callback && typeof callback === 'function') {
                callback();
            }
        }, 300);
    }

    /**
     * Bounce animation
     */
    function bounceElement(element) {
        if (!element) return;

        element.style.transition = 'transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        element.style.transform = 'scale(1.1)';

        setTimeout(() => {
            element.style.transform = 'scale(1)';
        }, 150);
    }

    /**
     * P1 FIX: Fade transition between elements
     */
    function fadeTransition(hideElement, showElement, duration = 300) {
        if (!hideElement || !showElement) return;

        // Fade out
        hideElement.style.transition = `opacity ${duration}ms ease`;
        hideElement.style.opacity = '0';

        setTimeout(() => {
            hideElement.style.display = 'none';

            // Fade in
            showElement.style.display = 'block';
            showElement.style.opacity = '0';

            requestAnimationFrame(() => {
                showElement.style.transition = `opacity ${duration}ms ease`;
                showElement.style.opacity = '1';
            });
        }, duration);
    }

    // ============================================================================
    // FORM UTILITIES
    // ============================================================================

    /**
     * P0 FIX: Validate player name with strict rules
     */
    function validatePlayerName(name) {
        if (!name || typeof name !== 'string') {
            return { valid: false, message: 'Name ist erforderlich' };
        }

        const trimmedName = name.trim();

        if (trimmedName.length < 2) {
            return { valid: false, message: 'Name muss mindestens 2 Zeichen haben' };
        }

        if (trimmedName.length > 20) {
            return { valid: false, message: 'Name darf maximal 20 Zeichen haben' };
        }

        // P0 FIX: Check for dangerous characters
        if (/[<>&"'\/\\=`]/.test(trimmedName)) {
            return { valid: false, message: 'Name enthält ungültige Zeichen' };
        }

        // P0 FIX: Check for script injection attempts
        if (/script|javascript|onerror|onload/gi.test(trimmedName)) {
            return { valid: false, message: 'Name enthält nicht erlaubte Wörter' };
        }

        return { valid: true, name: sanitizeInput(trimmedName) };
    }

    /**
     * Validate game ID
     */
    function validateGameId(gameId) {
        if (!gameId || typeof gameId !== 'string') {
            return { valid: false, message: 'Game ID ist erforderlich' };
        }

        const cleanId = gameId.toUpperCase().replace(/[^A-Z0-9]/g, '');

        if (cleanId.length !== 6) {
            return { valid: false, message: 'Game ID muss 6 Zeichen haben' };
        }

        return { valid: true, gameId: cleanId };
    }

    /**
     * Format game ID for display
     */
    function formatGameIdDisplay(gameId) {
        if (!gameId || gameId.length !== 6) return gameId;
        return gameId.substring(0, 3) + ' ' + gameId.substring(3);
    }

    // ============================================================================
    // LOCAL STORAGE UTILITIES
    // ============================================================================

    /**
     * P0 FIX: Safe localStorage get with validation
     */
    function getLocalStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            if (!item) return defaultValue;

            const parsed = JSON.parse(item);

            // P0 FIX: Validate that stored data doesn't contain XSS attempts
            if (typeof parsed === 'string') {
                return sanitizeInput(parsed);
            }

            return parsed;
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
            return defaultValue;
        }
    }

    /**
     * P0 FIX: Safe localStorage set with sanitization
     */
    function setLocalStorage(key, value) {
        try {
            // P0 FIX: Sanitize string values before storing
            const toStore = typeof value === 'string' ? sanitizeInput(value) : value;

            // P1 FIX: Check size before storing
            const stringified = JSON.stringify(toStore);
            if (stringified.length > 100000) {
                console.warn(`Value too large for key "${key}"`);
                return false;
            }

            localStorage.setItem(key, stringified);
            return true;
        } catch (error) {
            console.warn(`Error writing localStorage key "${key}":`, error);

            // P1 FIX: Handle quota exceeded
            if (error.name === 'QuotaExceededError') {
                console.warn('Storage quota exceeded, attempting cleanup...');
                clearOldAppData();

                // Retry once
                try {
                    localStorage.setItem(key, JSON.stringify(toStore));
                    return true;
                } catch (retryError) {
                    console.error('Retry failed:', retryError);
                }
            }

            return false;
        }
    }

    /**
     * Remove localStorage item
     */
    function removeLocalStorage(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn(`Error removing localStorage key "${key}":`, error);
            return false;
        }
    }

    /**
     * Clear all app-related storage
     */
    function clearAppStorage() {
        try {
            // Remove all nocap_* keys
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('nocap_')) {
                    keysToRemove.push(key);
                }
            }

            keysToRemove.forEach(key => localStorage.removeItem(key));

            console.log(`✅ Cleared ${keysToRemove.length} storage items`);
            return true;
        } catch (error) {
            console.error('Error clearing app storage:', error);
            return false;
        }
    }

    /**
     * P1 FIX: Clear old/temporary data
     */
    function clearOldAppData() {
        const tempKeys = [
            'nocap_temp_',
            'nocap_cached_',
            'nocap_debug_'
        ];

        let clearedCount = 0;
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && tempKeys.some(prefix => key.startsWith(prefix))) {
                localStorage.removeItem(key);
                clearedCount++;
            }
        }

        console.log(`✅ Cleared ${clearedCount} old data items`);
        return clearedCount;
    }

    // ============================================================================
    // GAME UTILITIES
    // ============================================================================

    /**
     * Calculate sips based on difference and difficulty
     */
    function calculateSips(difference, difficulty = 'medium') {
        const baseValues = {
            'easy': 1,
            'medium': 2,
            'hard': 3
        };

        const base = baseValues[difficulty] || 2;
        return difference === 0 ? 0 : base * Math.abs(difference);
    }

    /**
     * P1 FIX: Generate random game ID (crypto-safe if available)
     */
    function generateGameId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let id = '';

        // Use crypto.getRandomValues if available (more secure)
        if (window.crypto && window.crypto.getRandomValues) {
            const array = new Uint8Array(6);
            window.crypto.getRandomValues(array);

            for (let i = 0; i < 6; i++) {
                id += chars.charAt(array[i] % chars.length);
            }
        } else {
            // Fallback to Math.random
            for (let i = 0; i < 6; i++) {
                id += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        }

        return id;
    }

    /**
     * Shuffle array (Fisher-Yates)
     */
    function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // ============================================================================
    // CATEGORY & DIFFICULTY INFO
    // ============================================================================

    /**
     * Get category information
     */
    function getCategoryInfo(categoryId) {
        const categories = {
            'fsk0': {
                id: 'fsk0',
                name: 'Familie & Freunde',
                icon: '👨‍👩‍👧‍👦',
                color: '#4CAF50',
                description: 'Harmlose Fragen für alle',
                requiredAge: 0
            },
            'fsk16': {
                id: 'fsk16',
                name: 'Party & Frech',
                icon: '🎉',
                color: '#FF9800',
                description: 'Lustige Party-Fragen',
                requiredAge: 16
            },
            'fsk18': {
                id: 'fsk18',
                name: 'Intim & Tabu',
                icon: '🔞',
                color: '#F44336',
                description: 'Nur für Erwachsene',
                requiredAge: 18
            },
            'special': {
                id: 'special',
                name: 'Special Edition',
                icon: '⭐',
                color: '#9C27B0',
                description: 'Premium Inhalte',
                requiredAge: 0,
                premium: true
            }
        };

        return categories[categoryId] || {
            id: categoryId,
            name: 'Unbekannt',
            icon: '❓',
            color: '#9E9E9E',
            description: 'Unbekannte Kategorie',
            requiredAge: 0
        };
    }

    /**
     * Get difficulty information
     */
    function getDifficultyInfo(difficultyId) {
        const difficulties = {
            'easy': {
                id: 'easy',
                name: 'Entspannt',
                emoji: '🍺',
                description: 'Abweichung × 1 Schluck',
                multiplier: 1,
                color: '#4CAF50'
            },
            'medium': {
                id: 'medium',
                name: 'Normal',
                emoji: '🍺🍺',
                description: 'Abweichung × 2 Schlücke',
                multiplier: 2,
                color: '#FF9800'
            },
            'hard': {
                id: 'hard',
                name: 'Hardcore',
                emoji: '🍺🍺🍺',
                description: 'Abweichung × 3 Schlücke',
                multiplier: 3,
                color: '#F44336'
            }
        };

        return difficulties[difficultyId] || {
            id: difficultyId,
            name: 'Unbekannt',
            emoji: '❓',
            description: 'Unbekannte Schwierigkeit',
            multiplier: 2,
            color: '#9E9E9E'
        };
    }

    // ============================================================================
    // NETWORK UTILITIES
    // ============================================================================

    /**
     * Check if user is online
     */
    function isOnline() {
        return navigator.onLine;
    }

    /**
     * Initialize network status listeners
     */
    function initNetworkListeners() {
        const onlineHandler = () => {
            showNotification('Verbindung wiederhergestellt', 'success', 2000);
            document.body.classList.remove('offline');
            window.dispatchEvent(new CustomEvent('nocap:online'));
        };

        const offlineHandler = () => {
            showNotification('Keine Internetverbindung', 'warning', 5000);
            document.body.classList.add('offline');
            window.dispatchEvent(new CustomEvent('nocap:offline'));
        };

        window.addEventListener('online', onlineHandler);
        window.addEventListener('offline', offlineHandler);

        _eventListeners.push({ element: window, event: 'online', handler: onlineHandler });
        _eventListeners.push({ element: window, event: 'offline', handler: offlineHandler });

        // Initial check
        if (!isOnline()) {
            document.body.classList.add('offline');
        }
    }

    // ============================================================================
    // TIME UTILITIES
    // ============================================================================

    /**
     * Format timestamp for display
     */
    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return 'Gerade eben';
        } else if (diffMins < 60) {
            return `Vor ${diffMins} Min`;
        } else if (diffHours < 24) {
            return `Vor ${diffHours} Std`;
        } else if (diffDays < 7) {
            return `Vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
        } else {
            return date.toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        }
    }

    // ============================================================================
    // ERROR HANDLING
    // ============================================================================

    /**
     * P1 FIX: Global error handler with better error messages
     */
    function setupErrorHandling() {
        const errorHandler = (event) => {
            console.error('Global error:', event.error);

            // Don't show notifications for script loading errors
            if (event.filename && event.filename.includes('.js')) {
                return;
            }

            // Don't show notification in development
            if (window.location.hostname !== 'localhost' &&
                window.location.hostname !== '127.0.0.1') {
                showNotification('Ein unerwarteter Fehler ist aufgetreten', 'error');
            }
        };

        const rejectionHandler = (event) => {
            console.error('Unhandled promise rejection:', event.reason);

            // Handle specific Firebase errors
            if (event.reason && event.reason.code) {
                const message = getFirebaseErrorMessage(event.reason.code);
                showNotification(message, 'error');
                event.preventDefault(); // Prevent default error handling
            } else if (event.reason instanceof Error) {
                showNotification('Verbindungsfehler aufgetreten', 'error');
            }
        };

        window.addEventListener('error', errorHandler);
        window.addEventListener('unhandledrejection', rejectionHandler);

        _eventListeners.push({ element: window, event: 'error', handler: errorHandler });
        _eventListeners.push({ element: window, event: 'unhandledrejection', handler: rejectionHandler });
    }

    /**
     * Get user-friendly Firebase error messages
     */
    function getFirebaseErrorMessage(errorCode) {
        const messages = {
            'permission-denied': 'Keine Berechtigung für diese Aktion',
            'unavailable': 'Service momentan nicht verfügbar',
            'network-request-failed': 'Netzwerkfehler - Prüfe deine Internetverbindung',
            'timeout': 'Zeitüberschreitung - Versuche es erneut',
            'cancelled': 'Vorgang wurde abgebrochen',
            'already-exists': 'Eintrag existiert bereits',
            'not-found': 'Nicht gefunden',
            'failed-precondition': 'Voraussetzungen nicht erfüllt',
            'unauthenticated': 'Nicht angemeldet',
            'resource-exhausted': 'Zu viele Anfragen, bitte warte kurz'
        };

        return messages[errorCode] || 'Ein Fehler ist aufgetreten';
    }

    // ============================================================================
    // PERFORMANCE UTILITIES
    // ============================================================================

    /**
     * Debounce function
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function
     */
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * P1 FIX: Request animation frame wrapper
     */
    function requestFrame(callback) {
        if (typeof requestAnimationFrame !== 'undefined') {
            return requestAnimationFrame(callback);
        } else {
            return setTimeout(callback, 16);
        }
    }

    // ============================================================================
    // ACCESSIBILITY UTILITIES
    // ============================================================================

    /**
     * Focus management - trap focus within element
     */
    function trapFocus(element) {
        if (!element) return null;

        const focusableElements = element.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        const keydownHandler = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstFocusable) {
                        lastFocusable.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastFocusable) {
                        firstFocusable.focus();
                        e.preventDefault();
                    }
                }
            }

            if (e.key === 'Escape') {
                element.dispatchEvent(new CustomEvent('modal-close'));
            }
        };

        element.addEventListener('keydown', keydownHandler);

        // Focus first element
        if (firstFocusable) {
            requestFrame(() => firstFocusable.focus());
        }

        // Return cleanup function
        return () => {
            element.removeEventListener('keydown', keydownHandler);
        };
    }

    /**
     * P0 FIX: Announce to screen readers (XSS-safe)
     */
    function announceToScreenReader(message, priority = 'polite') {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', priority);
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';

        document.body.appendChild(announcement);

        // P0 FIX: Use textContent to prevent XSS
        announcement.textContent = sanitizeInput(message);

        setTimeout(() => {
            if (document.body.contains(announcement)) {
                document.body.removeChild(announcement);
            }
        }, 1000);
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /**
     * Initialize utilities when DOM is loaded
     */
    function initializeUtils() {
        setupErrorHandling();
        initNetworkListeners();

        // Add common keyboard shortcuts
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                // Close any open modals
                document.querySelectorAll('.modal.show').forEach(modal => {
                    modal.dispatchEvent(new CustomEvent('modal-close'));
                });

                // Dispatch global escape event
                window.dispatchEvent(new CustomEvent('nocap:escape'));
            }
        };

        document.addEventListener('keydown', escapeHandler);
        _eventListeners.push({ element: document, event: 'keydown', handler: escapeHandler });

        const isDev = window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';

        if (isDev) {
            console.log('%c✅ No-Cap Utils v3.0 initialized (Audit-Fixed)',
                'color: #4CAF50; font-weight: bold');
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeUtils);
    } else {
        initializeUtils();
    }

    // ============================================================================
    // CLEANUP ON PAGE UNLOAD
    // ============================================================================

    window.addEventListener('beforeunload', () => {
        cleanupEventListeners();
    });

    // ============================================================================
    // EXPORT FUNCTIONS TO GLOBAL SCOPE
    // ============================================================================

    window.NocapUtils = {
        // Version
        version: '3.0',

        // UI
        showLoading,
        hideLoading,
        showNotification,

        // P0 FIX: Security - Safe DOM manipulation
        sanitizeInput,
        sanitizeHTML,
        setTextContent,
        createElementWithText,
        createButton,

        // Mobile
        initMobileOptimizations,
        isMobile,

        // Validation
        validatePlayerName,
        validateGameId,
        formatGameIdDisplay,

        // Storage
        getLocalStorage,
        setLocalStorage,
        removeLocalStorage,
        clearAppStorage,

        // Game
        calculateSips,
        generateGameId,
        shuffleArray,
        getCategoryInfo,
        getDifficultyInfo,

        // Network
        isOnline,

        // Time
        formatTimestamp,

        // Performance
        debounce,
        throttle,
        requestFrame,

        // Accessibility
        trapFocus,
        announceToScreenReader,

        // Animation
        addEntranceAnimation,
        animateRemoval,
        bounceElement,
        fadeTransition,

        // Error handling
        getFirebaseErrorMessage,

        // Cleanup
        cleanupEventListeners
    };

    // P1 FIX: Make DOMPurify accessible via utils
    if (typeof DOMPurify !== 'undefined') {
        window.NocapUtils.DOMPurify = DOMPurify;
    }

    const isDev = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

    if (isDev) {
        console.log('%c✅ NocapUtils v3.0 exported to window.NocapUtils',
            'color: #2196F3; font-weight: bold');
    }

})(window);