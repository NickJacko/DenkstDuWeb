/**
 * NO-CAP - Utility Functions
 * Version 6.0 - Production-Safe Logger
 *
 * Gemeinsame Hilfsfunktionen für die gesamte App
 *
 * AUDIT FIXES APPLIED:
 * ✅ P0: DOMPurify validation and XSS prevention
 * ✅ P0: Safe DOM manipulation (no innerHTML)
 * ✅ P1: Memory leak prevention (event listener tracking)
 * ✅ P1: Error handling improvements
 * ✅ P2: Accessibility enhancements
 * ✅ P2: Performance optimizations
 *
 * VERSION 6.0 PRODUCTION HARDENING:
 * ✅ PRODUCTION: Logger mit auto-sanitization sensibler Daten
 * ✅ PRODUCTION: Kein console.log-Spam in Production
 * ✅ PRODUCTION: Automatisches Redacting von UIDs, GameCodes, Emails
 */

// ============================================================================
// 🛡️ SECURITY CHECK: DOMPURIFY REQUIRED
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
// 📦 NAMESPACE & SINGLETON PATTERN
// ============================================================================

(function(window) {
    'use strict';

    // Environment detection
    const isDevelopment = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('192.168.');

    // Singleton instances
    let loadingSpinner = null;
    let notificationContainer = null;

    // Event listener tracking (Memory-Leak-Prevention)
    const _eventListeners = [];
    const _activeNotifications = new Set();

    // ============================================================================
    // 📊 PRODUCTION-READY LOGGER
    // ============================================================================

    /**
     * Production-safe logger
     * - Development: Full console output
     * - Production: Only errors/warnings, no sensitive data
     */
    const Logger = {
        /**
         * Debug logging (development only)
         */
        debug(...args) {
            if (isDevelopment) {
                console.log(...args);
            }
        },

        /**
         * Info logging (development only)
         */
        info(...args) {
            if (isDevelopment) {
                console.info(...args);
            }
        },

        /**
         * Warning logging (always)
         */
        warn(...args) {
            console.warn(...args);
        },

        /**
         * Error logging (always, sanitized)
         */
        error(...args) {
            // Sanitize sensitive data from error messages
            const sanitized = args.map(arg => {
                if (typeof arg === 'string') {
                    // Remove potential UIDs, game codes, tokens
                    return arg
                        .replace(/\b[A-Z0-9]{6}\b/g, 'XXXXXX')  // Game codes
                        .replace(/\b[a-zA-Z0-9]{20,}\b/g, 'REDACTED')  // UIDs/Tokens
                        .replace(/\b[\w\.-]+@[\w\.-]+\.\w+\b/g, 'EMAIL_REDACTED');  // Emails
                }
                return arg;
            });
            console.error(...sanitized);
        },

        /**
         * Performance timing (development only)
         */
        time(label) {
            if (isDevelopment && console.time) {
                console.time(label);
            }
        },

        timeEnd(label) {
            if (isDevelopment && console.timeEnd) {
                console.timeEnd(label);
            }
        }
    };

    // ============================================================================
    // 🎨 DOM MANIPULATION - CSP COMPLIANT (No inline styles)
    // ============================================================================

    // ============================================================================
    // 🛡️ P0 SECURITY: CSP-COMPLIANT DYNAMIC STYLES
    // ============================================================================

    // Track dynamically generated CSS classes
    const _dynamicStyleSheet = (() => {
        const style = document.createElement('style');
        style.setAttribute('data-nocap-dynamic', 'true');
        document.head.appendChild(style);
        return style.sheet;
    })();

    /**
     * ✅ P0 SECURITY: Generate dynamic CSS class (CSP-compliant)
     * Instead of setting inline styles, this creates a CSS class and injects it into <head>
     * @param {string} className - Unique class name
     * @param {Object} styles - CSS properties as object
     * @returns {string} The generated class name
     */
    function generateDynamicClass(className, styles) {
        if (!className || !styles || typeof styles !== 'object') {
            Logger.warn('Invalid generateDynamicClass params');
            return '';
        }

        // Build CSS rule
        const cssProperties = Object.entries(styles)
            .map(([prop, value]) => {
                // Convert camelCase to kebab-case
                const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                return `${cssProp}: ${value};`;
            })
            .join(' ');

        const cssRule = `.${className} { ${cssProperties} }`;

        try {
            // Check if rule already exists
            const existingIndex = Array.from(_dynamicStyleSheet.cssRules || [])
                .findIndex(rule => rule.selectorText === `.${className}`);

            if (existingIndex >= 0) {
                // Update existing rule
                _dynamicStyleSheet.deleteRule(existingIndex);
            }

            // Insert new rule
            _dynamicStyleSheet.insertRule(cssRule, _dynamicStyleSheet.cssRules.length);
            Logger.debug(`✅ Generated dynamic class: ${className}`);
            return className;

        } catch (error) {
            Logger.error(`❌ Failed to generate dynamic class: ${error.message}`);
            return '';
        }
    }

    /**
     * ✅ P0 SECURITY: Apply styles via CSS class (CSP-compliant)
     * @param {HTMLElement} element - Target element
     * @param {Object} styles - CSS properties to apply
     * @returns {string} The generated class name
     */
    function applyStyles(element, styles) {
        if (!element || !styles) return '';

        // Generate unique class name
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 5);
        const className = `dynamic-style-${timestamp}-${random}`;

        // Generate CSS class
        const generatedClass = generateDynamicClass(className, styles);

        if (generatedClass) {
            element.classList.add(generatedClass);
            return generatedClass;
        }

        return '';
    }

    // ============================================================================
    // 🎨 ELEMENT VISIBILITY UTILITIES
    // ============================================================================

    /**
     * ✅ CSP-FIX: Show element using CSS class instead of inline style
     * @param {HTMLElement} element - Element to show
     * @param {string} displayType - Display type (flex, block, inline-flex, etc.)
     */
    function showElement(element, displayType = 'block') {
        if (!element) return;
        element.classList.remove('hidden', 'd-none');

        // Set appropriate display class
        switch(displayType) {
            case 'flex':
                element.classList.add('d-flex');
                break;
            case 'inline-flex':
                element.classList.add('d-inline-flex');
                break;
            case 'grid':
                element.classList.add('d-grid');
                break;
            case 'inline-block':
                element.classList.add('d-inline-block');
                break;
            default:
                element.classList.add('d-block');
        }

        element.removeAttribute('aria-hidden');
    }

    /**
     * ✅ CSP-FIX: Hide element using CSS class instead of inline style
     * @param {HTMLElement} element - Element to hide
     */
    function hideElement(element) {
        if (!element) return;
        element.classList.add('hidden');
        element.classList.remove('d-flex', 'd-block', 'd-inline-flex', 'd-grid', 'd-inline-block');
        element.setAttribute('aria-hidden', 'true');
    }

    /**
     * ✅ CSP-FIX: Toggle element visibility
     * @param {HTMLElement} element - Element to toggle
     * @param {boolean} show - Force show (true) or hide (false). If undefined, toggles.
     * @param {string} displayType - Display type when showing
     */
    function toggleElement(element, show, displayType = 'block') {
        if (!element) return;

        if (show === undefined) {
            show = element.classList.contains('hidden');
        }

        if (show) {
            showElement(element, displayType);
        } else {
            hideElement(element);
        }
    }

    /**
     * ✅ CSP-FIX: Add/remove class based on condition
     * @param {HTMLElement} element - Target element
     * @param {string} className - CSS class name
     * @param {boolean} condition - Add if true, remove if false
     */
    function toggleClass(element, className, condition) {
        if (!element) return;

        if (condition) {
            element.classList.add(className);
        } else {
            element.classList.remove(className);
        }
    }

    // ============================================================================
    // 🎨 LOADING & UI FUNCTIONS
    // ============================================================================

    /**
     * Ensure loading spinner exists (Singleton)
     * @returns {HTMLElement} Loading spinner element
     */
    function ensureLoadingSpinner() {
        if (!loadingSpinner) {
            loadingSpinner = document.getElementById('loading');

            // Create if not exists
            if (!loadingSpinner) {
                loadingSpinner = document.createElement('div');
                loadingSpinner.id = 'loading';
                loadingSpinner.className = 'loading-overlay';
                loadingSpinner.setAttribute('role', 'status');
                loadingSpinner.setAttribute('aria-live', 'polite');
                loadingSpinner.setAttribute('aria-hidden', 'true');

                const spinner = document.createElement('div');
                spinner.className = 'spinner';
                spinner.setAttribute('aria-hidden', 'true');

                const srText = document.createElement('span');
                srText.className = 'sr-only';
                srText.textContent = 'Lädt...';

                loadingSpinner.appendChild(spinner);
                loadingSpinner.appendChild(srText);
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
            loading.removeAttribute('aria-hidden');
        }
    }

    /**
     * Hide loading spinner
     */
    function hideLoading() {
        if (loadingSpinner) {
            loadingSpinner.classList.remove('show');
            loadingSpinner.setAttribute('aria-hidden', 'true');
        }
    }

    /**
     * ✅ AUDIT FIX: Notification mit sicherer DOM-Erzeugung (KEIN innerHTML)
     * @param {string} message - Message to display
     * @param {string} type - Notification type (success, error, warning, info)
     * @param {number} duration - Duration in milliseconds
     * @returns {HTMLElement} Notification element
     */
    function showNotification(message, type = 'info', duration = 3000) {
        // Ensure notification container exists
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            notificationContainer.className = 'notification-container';
            notificationContainer.setAttribute('aria-live', 'polite');
            notificationContainer.setAttribute('aria-atomic', 'true');
            document.body.appendChild(notificationContainer);
        }

        // Remove old notifications of same type (prevent spam)
        const existingNotifications = notificationContainer.querySelectorAll(`.notification.${type}`);
        existingNotifications.forEach(n => {
            if (n._hideTimeout) {
                clearTimeout(n._hideTimeout);
            }
            hideNotification(n);
        });

        // ✅ P0 FIX: Sanitize message - plain text only, no HTML allowed
        const sanitizedMessage = sanitizeInput(message);

        // ✅ P0 FIX: Create elements safely without innerHTML
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.setAttribute('role', 'alert');

        const content = document.createElement('div');
        content.className = 'notification-content';

        const icon = document.createElement('span');
        icon.className = 'notification-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = getNotificationIcon(type);

        const text = document.createElement('span');
        text.className = 'notification-text';
        text.textContent = sanitizedMessage; // ✅ P0 FIX: textContent prevents XSS

        const closeBtn = document.createElement('button');
        closeBtn.className = 'notification-close';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Benachrichtigung schließen');
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => {
            if (notification._hideTimeout) {
                clearTimeout(notification._hideTimeout);
            }
            hideNotification(notification);
        });

        content.appendChild(icon);
        content.appendChild(text);
        content.appendChild(closeBtn);
        notification.appendChild(content);

        notificationContainer.appendChild(notification);
        _activeNotifications.add(notification);

        // Show notification with animation
        requestFrame(() => {
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
     * ✅ P1 STABILITY: Wait for required globals to exist.
     * Supports dot-paths like "FirebaseConfig.isInitialized" or
     * "MultiplayerGameplayModule.gameState".
     */
    async function waitForDependencies(deps = [], maxWaitMs = 5000, intervalMs = 50) {
        try {
            if (!Array.isArray(deps) || deps.length === 0) return true;

            const start = Date.now();

            const getByPath = (root, path) => {
                const parts = String(path).split('.').filter(Boolean);
                let cur = root;
                for (const p of parts) {
                    if (cur == null) return undefined;
                    cur = cur[p];
                }
                return cur;
            };

            const isPresent = (path) => {
                const val = getByPath(window, path);
                return typeof val !== 'undefined' && val !== null;
            };

            while (Date.now() - start < maxWaitMs) {
                const missing = deps.filter(d => !isPresent(d));
                if (missing.length === 0) return true;
                await new Promise(r => setTimeout(r, intervalMs));
            }

            if (isDevelopment) Logger.warn('⚠️ waitForDependencies timeout', { deps, maxWaitMs });
            return false;
        } catch (e) {
            if (isDevelopment) Logger.warn('waitForDependencies error', e);
            return false;
        }
    }
    /**
     * Hide notification with animation
     * @param {HTMLElement} notification - Notification element to hide
     */
    function hideNotification(notification) {
        if (!notification || !notification.parentNode) return;

        // ✅ MEMORY LEAK FIX: Clear timeout before hiding
        if (notification._hideTimeout) {
            clearTimeout(notification._hideTimeout);
            notification._hideTimeout = null;
        }

        notification.classList.remove('show');
        _activeNotifications.delete(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }

    /**
     * Get notification icon based on type
     * @param {string} type - Notification type
     * @returns {string} Icon emoji
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
    // 🛡️ SANITIZATION HELPERS - P0 SECURITY FIXES
    // ============================================================================

    /**
     * ✅ P0 FIX: Sanitize user input - STRICT TEXT ONLY
     * Use this for player names, game IDs, and any user-generated text
     * NO HTML ALLOWED - strips all tags
     *
     * @param {*} input - Input to sanitize
     * @returns {string} Sanitized text
     */
    function sanitizeInput(input) {
        if (input === null || input === undefined) return '';

        if (typeof input !== 'string') {
            input = String(input);
        }

        // ✅ P0 FIX: DOMPurify with ALLOWED_TAGS: [] strips ALL HTML
        const sanitized = DOMPurify.sanitize(input, {
            ALLOWED_TAGS: [],
            ALLOWED_ATTR: [],
            KEEP_CONTENT: true
        });

        // ✅ P0 FIX: Additional safety - remove potential XSS patterns
        return sanitized
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/data:text\/html/gi, '')
            .replace(/<script/gi, '')
            .replace(/<\/script>/gi, '')
            .trim()
            .substring(0, 500); // ✅ P0 FIX: Max length to prevent DOS
    }

    /**
     * ✅ P0 FIX: Sanitize HTML for safe innerHTML usage
     * Use ONLY when you explicitly need HTML content
     * For most cases, prefer textContent instead!
     *
     * @param {string} html - HTML to sanitize
     * @returns {string} Sanitized HTML
     */
    function sanitizeHTML(html) {
        if (!html) return '';

        // ✅ P0 FIX: Strict whitelist of allowed tags
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'p', 'br', 'div'],
            ALLOWED_ATTR: ['class'],
            KEEP_CONTENT: true,
            RETURN_TRUSTED_TYPE: false,
            FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover'],
            FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'style', 'form']
        });
    }

    /**
     * ✅ P0 FIX: Set text content safely - USE THIS INSTEAD OF innerHTML
     * This is the safest way to add user content to DOM
     *
     * @param {HTMLElement} element - Target element
     * @param {string} text - Text to set
     */
    function setTextContent(element, text) {
        if (!element) return;
        element.textContent = sanitizeInput(text);
    }

    /**
     * ✅ P0 FIX: Create HTML element with text content safely
     * @param {string} tag - HTML tag name
     * @param {string} text - Text content
     * @param {string} className - CSS class name
     * @returns {HTMLElement} Created element
     */
    function createElementWithText(tag, text, className = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        element.textContent = sanitizeInput(text);
        return element;
    }

    /**
     * ✅ P1 FIX: Create button safely
     * @param {string} text - Button text
     * @param {Function} onClick - Click handler
     * @param {string} className - CSS class name
     * @returns {HTMLButtonElement} Created button
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
    // 📱 MOBILE OPTIMIZATIONS
    // ============================================================================

    /**
     * Initialize mobile optimizations
     */
    function initMobileOptimizations() {
        if (!isMobile()) return;

        // Prevent zoom on input focus (iOS)
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

        // Handle keyboard visibility
        handleVirtualKeyboard();

        if (isDevelopment) {
            console.log('✅ Mobile optimizations initialized');
        }
    }

    /**
     * Check if device is mobile
     * @returns {boolean} True if mobile device
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
        root.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top, 0px)');
        root.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right, 0px)');
        root.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom, 0px)');
        root.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left, 0px)');
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
                window.dispatchEvent(new CustomEvent('nocap:keyboard-open'));
            } else {
                document.body.classList.remove('keyboard-open');
                window.dispatchEvent(new CustomEvent('nocap:keyboard-close'));
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
     * ✅ MEMORY LEAK FIX: Cleanup event listeners (call on page unload)
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

        // ✅ MEMORY LEAK FIX: Clear all notification timeouts before clearing
        _activeNotifications.forEach(notification => {
            if (notification._hideTimeout) {
                clearTimeout(notification._hideTimeout);
                notification._hideTimeout = null;
            }
            // Remove notification from DOM
            if (notification.parentNode) {
                notification.remove();
            }
        });
        _activeNotifications.clear();

        if (isDevelopment) {
            console.log('✅ Event listeners and notifications cleaned up');
        }
    }

    // ============================================================================
    // 🎬 ANIMATION HELPERS
    // ============================================================================

    /**
     * Add entrance animation to elements
     * @param {Array|NodeList} elements - Elements to animate
     * @param {number} delay - Delay between animations in ms
     */
    function addEntranceAnimation(elements, delay = 100) {
        if (!elements) return;

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) return;

        // Convert to array if NodeList
        const elementsArray = Array.isArray(elements) ? elements : Array.from(elements);

        elementsArray.forEach((element, index) => {
            if (!element) return;

            element.classList.add('anim-hidden');

            setTimeout(() => {
                element.classList.remove('anim-hidden');
                element.classList.add('anim-enter');
                setTimeout(() => element.classList.remove('anim-enter'), 500);
            }, index * delay);
        });
    }
    
    /**
     * Animate element removal
     * @param {HTMLElement} element - Element to remove
     * @param {Function} callback - Callback after animation
     */
    function animateRemoval(element, callback) {
        if (!element) return;

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
            if (callback && typeof callback === 'function') {
                callback();
            }
            return;
        }

        element.classList.add('anim-exit');

        setTimeout(() => {
            if (callback && typeof callback === 'function') {
                callback();
            }
        }, 300);
    }

    /**
     * Bounce animation
     * @param {HTMLElement} element - Element to bounce
     */
    function bounceElement(element) {
        if (!element) return;

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) return;

        element.classList.add('anim-bounce');
        setTimeout(() => element.classList.remove('anim-bounce'), 300);
    }
    /**
     * ✅ P1 FIX: Fade transition between elements
     * @param {HTMLElement} hideElement - Element to hide
     * @param {HTMLElement} showElement - Element to show
     * @param {number} duration - Transition duration in ms
     */
    function fadeTransition(hideElement, showElement, duration = 300) {
        if (!hideElement || !showElement) return;

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const actualDuration = prefersReducedMotion ? 0 : duration;

        // ✅ CSP-FIX: Use CSS classes instead of inline styles
        hideElement.classList.add('fade-out');

        setTimeout(() => {
            hideElement.classList.add('hidden');
            hideElement.classList.remove('fade-out');

            // Show element
            showElement.classList.remove('hidden');
            showElement.classList.add('fade-in');

            setTimeout(() => {
                showElement.classList.remove('fade-in');
            }, actualDuration);
        }, actualDuration);
    }

    // ============================================================================
    // ✅ FORM UTILITIES
    // ============================================================================

    /**
     * ✅ P0 FIX: Validate player name with strict rules
     * @param {string} name - Player name to validate
     * @returns {{valid: boolean, message: string, name?: string}} Validation result
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

        // ✅ P0 FIX: Check for dangerous characters
        if (/[<>&"'\/\\=`]/.test(trimmedName)) {
            return { valid: false, message: 'Name enthält ungültige Zeichen' };
        }

        // ✅ P0 FIX: Check for script injection attempts
        if (/script|javascript|onerror|onload|onclick|eval|expression/gi.test(trimmedName)) {
            return { valid: false, message: 'Name enthält nicht erlaubte Wörter' };
        }

        // ✅ P0 FIX: Check for data URIs
        if (/data:|javascript:|vbscript:/gi.test(trimmedName)) {
            return { valid: false, message: 'Name enthält ungültiges Format' };
        }

        return { valid: true, name: sanitizeInput(trimmedName) };
    }

    /**
     * Validate game ID
     * @param {string} gameId - Game ID to validate
     * @returns {{valid: boolean, message?: string, gameId?: string}} Validation result
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
     * Format game ID for display (ABC DEF)
     * @param {string} gameId - Game ID
     * @returns {string} Formatted game ID
     */
    function formatGameIdDisplay(gameId) {
        if (!gameId || gameId.length !== 6) return gameId;
        return gameId.substring(0, 3) + ' ' + gameId.substring(3);
    }

    // ============================================================================
    // 💾 LOCAL STORAGE UTILITIES
    // ============================================================================

    /**
     * ✅ P0 FIX: Safe localStorage get with validation
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if not found
     * @returns {*} Stored value or default
     */
    function getLocalStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            if (!item) return defaultValue;

            const parsed = JSON.parse(item);

            // ✅ P0 FIX: Validate that stored data doesn't contain XSS attempts
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
     * ✅ P0 FIX: Safe localStorage set with sanitization
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @returns {boolean} Success status
     */
    function setLocalStorage(key, value) {
        try {
            // ✅ P0 FIX: Sanitize string values before storing
            const toStore = typeof value === 'string' ? sanitizeInput(value) : value;

            // ✅ P1 FIX: Check size before storing
            const stringified = JSON.stringify(toStore);
            if (stringified.length > 100000) {
                console.warn(`Value too large for key "${key}"`);
                return false;
            }

            localStorage.setItem(key, stringified);
            return true;
        } catch (error) {
            console.warn(`Error writing localStorage key "${key}":`, error);

            // ✅ P1 FIX: Handle quota exceeded
            if (error.name === 'QuotaExceededError') {
                console.warn('Storage quota exceeded, attempting cleanup...');
                clearOldAppData();

                // Retry once
                try {
                    localStorage.setItem(key, JSON.stringify(value));
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
     * @param {string} key - Storage key
     * @returns {boolean} Success status
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
     * @returns {boolean} Success status
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

            if (isDevelopment) {
                console.log(`✅ Cleared ${keysToRemove.length} storage items`);
            }
            return true;
        } catch (error) {
            console.error('Error clearing app storage:', error);
            return false;
        }
    }

    /**
     * ✅ P1 FIX: Clear old/temporary data
     * @returns {number} Number of items cleared
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

        if (isDevelopment && clearedCount > 0) {
            console.log(`✅ Cleared ${clearedCount} old data items`);
        }
        return clearedCount;
    }

    // ============================================================================
    // 🎮 GAME UTILITIES
    // ============================================================================

    /**
     * Calculate sips based on difference and difficulty
     * @param {number} difference - Estimation difference
     * @param {string} difficulty - Difficulty level
     * @returns {number} Number of sips
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
     * ✅ P1 FIX: Generate random game ID (crypto-safe if available)
     * @returns {string} 6-character game ID
     */
    function generateGameId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
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
     * Shuffle array (Fisher-Yates algorithm)
     * @param {Array} array - Array to shuffle
     * @returns {Array} Shuffled array
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
    // 📋 CATEGORY & DIFFICULTY INFO
    // ============================================================================

    /**
     * Get category information
     * @param {string} categoryId - Category ID
     * @returns {Object} Category info
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
     * @param {string} difficultyId - Difficulty ID
     * @returns {Object} Difficulty info
     */
    function getDifficultyInfo(difficultyId) {
        const difficulties = {
            'easy': {
                id: 'easy',
                name: 'Entspannt',
                emoji: '🍺',
                description: 'Abweichung × 1',
                multiplier: 1,
                color: '#4CAF50'
            },
            'medium': {
                id: 'medium',
                name: 'Normal',
                emoji: '🍺🍺',
                description: 'Abweichung × 2 ',
                multiplier: 2,
                color: '#FF9800'
            },
            'hard': {
                id: 'hard',
                name: 'Hardcore',
                emoji: '🍺🍺🍺',
                description: 'Abweichung × 3 ',
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
    // 🌐 NETWORK UTILITIES
    // ============================================================================

    /**
     * Check if user is online
     * @returns {boolean} Online status
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
            document.body.classList.add('online');
            window.dispatchEvent(new CustomEvent('nocap:online'));
        };

        const offlineHandler = () => {
            showNotification('Keine Internetverbindung', 'warning', 5000);
            document.body.classList.remove('online');
            document.body.classList.add('offline');
            window.dispatchEvent(new CustomEvent('nocap:offline'));
        };

        window.addEventListener('online', onlineHandler);
        window.addEventListener('offline', offlineHandler);

        _eventListeners.push({ element: window, event: 'online', handler: onlineHandler });
        _eventListeners.push({ element: window, event: 'offline', handler: offlineHandler });

        // Initial check
        if (isOnline()) {
            document.body.classList.add('online');
        } else {
            document.body.classList.add('offline');
        }
    }

    // ============================================================================
    // 📊 TELEMETRY & LOGGING
    // ============================================================================

    /**
     * ✅ OPTIMIZATION: Log to telemetry service (Production-ready logging)
     * @param {Object} data - Log data
     * @param {string} data.component - Component name
     * @param {string} data.message - Log message
     * @param {string} data.type - Log type (info, warning, error, debug)
     * @param {number} data.timestamp - Timestamp
     * @param {Object} data.state - Additional state data
     */
    function logToTelemetry(data) {
        // Skip in development (use console instead)
        if (isDevelopment) {
            return;
        }

        try {
            // Check if Firebase Analytics is available
            if (window.firebase && window.firebase.analytics) {
                const analytics = window.firebase.analytics();

                // Log event with sanitized data
                analytics.logEvent('app_log', {
                    component: sanitizeInput(data.component || 'Unknown'),
                    message: sanitizeInput(data.message || '').substring(0, 100), // Max 100 chars
                    type: data.type || 'info',
                    timestamp: data.timestamp || Date.now()
                });
            }

            // Fallback: Send to custom endpoint if available
        if (window.NocapConfig && window.NocapConfig.telemetryEndpoint) {
            const hasConsent = window.NocapCookies?.hasAnalyticsConsent?.() === true;
            if (!hasConsent) return;
            fetch(window.NocapConfig.telemetryEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        component: data.component,
                        message: data.message,
                        type: data.type,
                        timestamp: data.timestamp,
                        state: data.state,
                        userAgent: navigator.userAgent,
                        url: window.location.href
                    }),
                    keepalive: true // Ensure request completes even if page unloads
                }).catch(() => {
                    // Silently fail - don't block app
                });
            }

            // Console output only for errors in production
            if (data.type === 'error') {
                console.error(`[${data.component}] ${data.message}`);
            }

        } catch (error) {
            // Silently fail - telemetry should never break the app
            if (isDevelopment) {
                console.warn('Telemetry logging failed:', error);
            }
        }
    }

    /**
     * ✅ OPTIMIZATION: Log error with context
     * @param {string} component - Component name
     * @param {Error|string} error - Error object or message
     * @param {Object} context - Additional context
     */
    function logError(component, error, context = {}) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        // Development: Full console log
        if (isDevelopment) {
            console.error(`[${component}]`, errorMessage, context);
            if (errorStack) {
                console.error('Stack:', errorStack);
            }
            return;
        }

        // Production: Telemetry only
        logToTelemetry({
            component,
            message: errorMessage,
            type: 'error',
            timestamp: Date.now(),
            state: {
                ...context,
                stack: errorStack ? errorStack.substring(0, 500) : undefined, // Limit stack trace
                url: window.location.href,
                userAgent: navigator.userAgent
            }
        });

        // Also log to console for critical errors
        console.error(`[${component}] ${errorMessage}`);
    }

    /**
     * ✅ OPTIMIZATION: Log info message
     * @param {string} component - Component name
     * @param {string} message - Info message
     * @param {Object} context - Additional context
     */
    function logInfo(component, message, context = {}) {
        if (isDevelopment) {
            console.log(`[${component}] ${message}`, context);
            return;
        }

        // Production: Telemetry only
        logToTelemetry({
            component,
            message,
            type: 'info',
            timestamp: Date.now(),
            state: context
        });
    }

    // ============================================================================
    // ⏰ TIME UTILITIES
    // ============================================================================

    /**
     * Format timestamp for display
     * @param {number} timestamp - Timestamp in milliseconds
     * @returns {string} Formatted time string
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
    // 🚨 ERROR HANDLING
    // ============================================================================

    /**
     * ✅ P1 FIX: Global error handler with better error messages
     */
    function setupErrorHandling() {
        const errorHandler = (event) => {
            console.error('Global error:', event.error);

            // Don't show notifications for script loading errors
            if (event.filename && event.filename.includes('.js')) {
                return;
            }

            // Don't show notification in development
            if (!isDevelopment) {
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
     * @param {string} errorCode - Firebase error code
     * @returns {string} User-friendly error message
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
            'resource-exhausted': 'Zu viele Anfragen, bitte warte kurz',
            'invalid-argument': 'Ungültige Eingabe',
            'deadline-exceeded': 'Zeitüberschreitung',
            'aborted': 'Vorgang abgebrochen'
        };

        return messages[errorCode] || 'Ein Fehler ist aufgetreten';
    }

    // ============================================================================
    // ⚡ PERFORMANCE UTILITIES
    // ============================================================================

    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} Debounced function
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
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in ms
     * @returns {Function} Throttled function
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
     * ✅ P1 FIX: Request animation frame wrapper
     * @param {Function} callback - Callback function
     * @returns {number} Frame ID
     */
    function requestFrame(callback) {
        if (typeof requestAnimationFrame !== 'undefined') {
            return requestAnimationFrame(callback);
        } else {
            return setTimeout(callback, 16);
        }
    }
    function readBoolFlag(key) {
        try {
            const v = getLocalStorage(key);
            if (typeof v === 'boolean') return v;
            if (typeof v === 'string') return v === 'true';
            if (typeof v === 'number') return v === 1;
        } catch (e) {}

        try {
            const raw = localStorage.getItem(key);
            if (raw === null) return false;
            if (raw === 'true') return true;
            if (raw === 'false') return false;
            // JSON fallback (z.B. "true")
            return Boolean(JSON.parse(raw));
        } catch (e) {
            return false;
        }
    }
    // ============================================================================
    // ♿ ACCESSIBILITY UTILITIES
    // ============================================================================

    /**
     * Focus management - trap focus within element
     * @param {HTMLElement} element - Element to trap focus in
     * @returns {Function|null} Cleanup function
     */

    function trapFocus(element) {
        if (!element) return null;

        const focusableElements = element.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return null;

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
     * ✅ P0 FIX: Announce to screen readers (XSS-safe)
     * @param {string} message - Message to announce
     * @param {string} priority - Priority level (polite, assertive)
     */
    function announceToScreenReader(message, priority = 'polite') {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', priority);
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';

        document.body.appendChild(announcement);

        // ✅ P0 FIX: Use textContent to prevent XSS
        announcement.textContent = sanitizeInput(message);

        setTimeout(() => {
            if (document.body.contains(announcement)) {
                document.body.removeChild(announcement);
            }
        }, 1000);
    }

    // ============================================================================
    // 🚀 INITIALIZATION
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
                document.querySelectorAll('.modal.show, .modal[style*="display: flex"]').forEach(modal => {
                    modal.dispatchEvent(new CustomEvent('modal-close'));
                });

                // Dispatch global escape event
                window.dispatchEvent(new CustomEvent('nocap:escape'));
            }
        };

        document.addEventListener('keydown', escapeHandler);
        _eventListeners.push({ element: document, event: 'keydown', handler: escapeHandler });

        if (isDevelopment) {
            console.log('%c✅ No-Cap Utils v5.0 initialized (Memory Leak Fixes & Telemetry)',
                'color: #4CAF50; font-weight: bold; font-size: 12px');
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeUtils);
    } else {
        initializeUtils();
    }

    // ============================================================================
    // 🧹 CLEANUP ON PAGE UNLOAD
    // ============================================================================

    window.addEventListener('beforeunload', () => {
        cleanupEventListeners();
    });

    // ============================================================================
    // ⚡ P2 PERFORMANCE: MEMOIZATION
    // ============================================================================

    /**
     * ✅ P2 PERFORMANCE: Generic memoization function
     * @param {Function} fn - Function to memoize
     * @param {Function} keyGenerator - Function to generate cache key from arguments
     * @returns {Function} Memoized function
     */
    function memoize(fn, keyGenerator = (...args) => JSON.stringify(args)) {
        const cache = new Map();

        return function memoized(...args) {
            const key = keyGenerator(...args);

            if (cache.has(key)) {
                Logger.debug(`Cache hit for ${fn.name || 'anonymous'}`);
                return cache.get(key);
            }

            const result = fn.apply(this, args);
            cache.set(key, result);

            // Limit cache size to prevent memory leaks
            if (cache.size > 100) {
                const firstKey = cache.keys().next().value;
                cache.delete(firstKey);
            }

            return result;
        };
    }

    /**
     * ✅ P2 PERFORMANCE: Memoized formatTime
     * Caches results for frequently called time formats
     */
    const formatTime = memoize((seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    });

    /**
     * ✅ P2 PERFORMANCE: Memoized calculateBarWidth
     * Caches width calculations for progress bars
     */
    const calculateBarWidth = memoize((current, total, maxWidth = 100) => {
        if (!total || total <= 0) return 0;
        const percentage = (current / total) * 100;
        return Math.min(percentage, maxWidth);
    }, (current, total, maxWidth) => `${current}-${total}-${maxWidth}`);

    // ============================================================================
    // 🌓 P1 UI/UX: DARK MODE
    // ============================================================================

    /**
     * ✅ P1 UI/UX: Toggle dark mode and persist preference
     * @param {boolean} force - Force dark mode on/off (optional)
     * @returns {boolean} Current dark mode state
     */
    function toggleDarkMode(force) {
        const html = document.documentElement;
        const currentState = html.classList.contains('dark-mode');

        // Determine new state
        const newState = force !== undefined ? force : !currentState;

        // Apply to DOM
        if (newState) {
            html.classList.add('dark-mode');
            document.body.classList.add('dark-mode');
        } else {
            html.classList.remove('dark-mode');
            document.body.classList.remove('dark-mode');
        }

        // ✅ P1 UI/UX: Persist in localStorage
        try {
            localStorage.setItem('nocap_dark_mode', newState.toString());
            Logger.info(`Dark mode ${newState ? 'enabled' : 'disabled'}`);
        } catch (error) {
            Logger.warn('Failed to save dark mode preference:', error);
        }

        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('nocap:darkmode', {
            detail: { enabled: newState }
        }));

        return newState;
    }

    /**
     * ✅ P1 UI/UX: Initialize dark mode from localStorage
     */
    function initDarkMode() {
        try {
            const savedPreference = localStorage.getItem('nocap_dark_mode');

            if (savedPreference === 'true') {
                toggleDarkMode(true);
            } else if (savedPreference === 'false') {
                toggleDarkMode(false);
            } else {
                // No preference saved - check system preference
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    toggleDarkMode(true);
                }
            }
        } catch (error) {
            Logger.warn('Failed to initialize dark mode:', error);
        }
    }

    // Auto-initialize dark mode on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDarkMode);
    } else {
        initDarkMode();
    }

    // ============================================================================
    // 🔥 FIREBASE INITIALIZATION HELPER
    // ============================================================================

    /**
     * ✅ P0 FIX: Wait for Firebase App initialization
     * Prevents "No Firebase App '[DEFAULT]'" errors in multiplayer pages
     * @param {number} maxWaitMs - Maximum wait time in milliseconds (default: 10000)
     * @returns {Promise<boolean>} True if initialized, false if timeout
     */
    async function waitForFirebaseInit(maxWaitMs = 10000) {
        if (typeof firebase === 'undefined') {
            Logger.error('❌ Firebase SDK not loaded');
            return false;
        }

        const startTime = Date.now();
        const checkInterval = 100; // Check every 100ms

        while (Date.now() - startTime < maxWaitMs) {
            // Check if Firebase App is initialized
            if (firebase.apps && firebase.apps.length > 0) {
                if (isDevelopment) {
                    Logger.debug(`✅ Firebase App initialized: ${firebase.app().name}`);
                }
                return true;
            }

            // Wait before next check
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }

        // Timeout
        Logger.error(`❌ Firebase App not initialized after ${maxWaitMs}ms`);
        return false;
    }

    // ============================================================================
    // 🔞 AGE VERIFICATION HELPERS (P1 DSGVO/Jugendschutz)
    // ============================================================================

    /**
     * ✅ P1 DSGVO: Check if age verification is valid
     * Verifies the nocap_age_verification token and checks expiry (7 days)
     *
     * @returns {Object} Validation result
     * @returns {boolean} .isValid - Whether verification is valid
     * @returns {number|null} .age - Verified age (if valid)
     * @returns {number|null} .expiresAt - Expiry timestamp (if valid)
     * @returns {string|null} .reason - Reason for invalidity
     *
     * @example
     * const ageCheck = checkAgeVerification();
     * if (!ageCheck.isValid) {
     *     window.location.href = 'age-gate.html';
     * }
     */
    function checkAgeVerification() {
        try {
            const token = getLocalStorage('nocap_age_verification');

            if (!token) {
                return {
                    isValid: false,
                    age: null,
                    expiresAt: null,
                    reason: 'NO_TOKEN'
                };
            }

            let data = token;

// Backward compatibility: falls alte Version noch String gespeichert hat
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch (error) {
                    Logger.warn('⚠️ Invalid age verification token format');
                    removeLocalStorage('nocap_age_verification');
                    return {
                        isValid: false,
                        age: null,
                        expiresAt: null,
                        reason: 'INVALID_FORMAT'
                    };
                }
            }

            if (!data || typeof data !== 'object') {
                Logger.warn('⚠️ Invalid age verification token type');
                removeLocalStorage('nocap_age_verification');
                return {
                    isValid: false,
                    age: null,
                    expiresAt: null,
                    reason: 'INVALID_FORMAT'
                };
            }


            if (!data.age || !data.verifiedAt || !data.expiresAt) {
                Logger.warn('⚠️ Incomplete age verification data');
                removeLocalStorage('nocap_age_verification');
                return {
                    isValid: false,
                    age: null,
                    expiresAt: null,
                    reason: 'INCOMPLETE_DATA'
                };
            }

            const now = Date.now();
            if (now > data.expiresAt) {
                Logger.info('ℹ️ Age verification expired');
                removeLocalStorage('nocap_age_verification');
                return {
                    isValid: false,
                    age: data.age,
                    expiresAt: data.expiresAt,
                    reason: 'EXPIRED'
                };
            }

            const age = parseInt(data.age);
            if (isNaN(age) || age < 0 || age > 150) {
                Logger.warn('⚠️ Invalid age value');
                removeLocalStorage('nocap_age_verification');
                return {
                    isValid: false,
                    age: null,
                    expiresAt: null,
                    reason: 'INVALID_AGE'
                };
            }

            return {
                isValid: true,
                age: age,
                expiresAt: data.expiresAt,
                reason: null
            };

        } catch (error) {
            Logger.error('❌ Age verification check failed:', error);
            return {
                isValid: false,
                age: null,
                expiresAt: null,
                reason: 'ERROR'
            };
        }
    }

    /**
     * ✅ P1 DSGVO: Get verified age (or null if invalid)
     */
    function getVerifiedAge() {
        const check = checkAgeVerification();
        return check.isValid ? check.age : null;
    }
    /**
     * ✅ FSK18-SYSTEM: Check if user can access FSK level
     * FSK0 & FSK16: Always allowed
     * FSK18: Requires server validation (use GameState.canAccessFSK instead)
     *
     * @param {number|string} fskLevel - FSK level (0, 16, 18)
     * @returns {boolean} True if accessible (client-side check only)
     */
    function canAccessFSK(fskLevel) {
        // Normalize input
        const level = typeof fskLevel === 'string'
            ? parseInt(fskLevel.replace(/\D/g, ''))
            : fskLevel;

        // ✅ FSK18-SYSTEM: FSK0 & FSK16 always allowed (no validation needed)
        if (level === 0 || level === 16) {
            return true;
        }

        // ✅ FSK18-SYSTEM: FSK18 requires server validation
        // This is a CLIENT-SIDE HINT ONLY - server validation is mandatory
        if (level === 18) {
            // ✅ SECURITY: Fail-closed – localStorage ist kein Berechtigungsnachweis.
            // FSK18 muss zwingend über gameState.canAccessFSK('fsk18') server-validiert werden.
            Logger.warn('⚠️ NocapUtils.canAccessFSK(18) ersetzt keine Server-Validierung – Zugriff verweigert.');
            return false;
        }

        // Unknown FSK level - deny access
        return false;
    }
    /**
     * ✅ P1 DSGVO: Set age verification token (valid for 7 days)
     */
    function setAgeVerification(age) {
        try {
            const ageNum = parseInt(age);
            if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
                Logger.warn('⚠️ Invalid age for verification:', age);
                return false;
            }

            const now = Date.now();
            const expiresAt = now + (7 * 24 * 60 * 60 * 1000);

            const token = {
                age: ageNum,
                verifiedAt: now,
                expiresAt: expiresAt,
                version: '1.0'
            };

            setLocalStorage('nocap_age_verification', token);
            Logger.info(`✅ Age verification set: ${ageNum} years (expires in 7 days)`);
            return true;

        } catch (error) {
            Logger.error('❌ Failed to set age verification:', error);
            return false;
        }
    }

    /**
     * ✅ P1 DSGVO: Clear age verification
     */
    function clearAgeVerification() {
        removeLocalStorage('nocap_age_verification');
        Logger.info('🔄 Age verification cleared');
    }

    /**
     * ✅ P1 DSGVO: Check if age verification is valid
     * Verifies the nocap_age_verification token and checks expiry (7 days)
     *
     * ⚠️ DEPRECATED FOR FSK18 VALIDATION
     * This function checks localStorage only. For FSK18 content, use:
     * - GameState.canAccessFSK('fsk18', true) for server-side validation
     * - This function is OK for UI hints (e.g., showing FSK badges)
     *
     * @returns {Object} Validation result
     * @returns {boolean} .isValid - Whether verification is valid
     * @returns {number|null} .age - Verified age (if valid)
     * @returns {number|null} .expiresAt - Expiry timestamp (if valid)
     * @returns {string|null} .reason - Reason for invalidity
     *
     * @example
     * // ❌ DON'T USE FOR FSK18 VALIDATION
     * const ageCheck = checkAgeVerification();
     * if (ageCheck.age >= 18) {
     *     // This is NOT secure for FSK18!
     * }
     *
     * // ✅ USE THIS FOR FSK18 VALIDATION
     * const hasAccess = await gameState.canAccessFSK('fsk18', true);
     * if (hasAccess) {
     *     // Server validated - OK to load FSK18 content
     * }
     */
    function checkAgeVerification() {
        try {
            const token = getLocalStorage('nocap_age_verification');

            if (!token) {
                return {
                    isValid: false,
                    age: null,
                    expiresAt: null,
                    reason: 'NO_TOKEN'
                };
            }

            let data = token;

            // Backward compatibility: falls alte Version noch String gespeichert hat
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch (error) {
                    Logger.warn('⚠️ Invalid age verification token format');
                    removeLocalStorage('nocap_age_verification');
                    return {
                        isValid: false,
                        age: null,
                        expiresAt: null,
                        reason: 'INVALID_FORMAT'
                    };
                }
            }

            if (!data || typeof data !== 'object') {
                Logger.warn('⚠️ Invalid age verification token type');
                removeLocalStorage('nocap_age_verification');
                return {
                    isValid: false,
                    age: null,
                    expiresAt: null,
                    reason: 'INVALID_FORMAT'
                };
            }

            if (!data.age || !data.verifiedAt || !data.expiresAt) {
                Logger.warn('⚠️ Incomplete age verification data');
                removeLocalStorage('nocap_age_verification');
                return {
                    isValid: false,
                    age: null,
                    expiresAt: null,
                    reason: 'INCOMPLETE_DATA'
                };
            }

            const now = Date.now();
            if (now > data.expiresAt) {
                Logger.info('ℹ️ Age verification expired');
                removeLocalStorage('nocap_age_verification');
                return {
                    isValid: false,
                    age: data.age,
                    expiresAt: data.expiresAt,
                    reason: 'EXPIRED'
                };
            }

            const age = parseInt(data.age);
            if (isNaN(age) || age < 0 || age > 150) {
                Logger.warn('⚠️ Invalid age value');
                removeLocalStorage('nocap_age_verification');
                return {
                    isValid: false,
                    age: null,
                    expiresAt: null,
                    reason: 'INVALID_AGE'
                };
            }

            return {
                isValid: true,
                age: age,
                expiresAt: data.expiresAt,
                reason: null
            };

        } catch (error) {
            Logger.error('❌ Age verification check failed:', error);
            return {
                isValid: false,
                age: null,
                expiresAt: null,
                reason: 'ERROR'
            };
        }
    }

    /**
     * ✅ P1 DSGVO: Format age verification expiry for display
     */
    function formatAgeVerificationExpiry() {
        const check = checkAgeVerification();
        if (!check.isValid || !check.expiresAt) return null;

        const date = new Date(check.expiresAt);
        return date.toLocaleString('de-DE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // ============================================================================
    // 📤 EXPORT FUNCTIONS TO GLOBAL SCOPE
    // ============================================================================

    window.NocapUtils = Object.freeze({
        // Version
        version: '6.1', // ✅ FIREBASE FIX: Added waitForFirebaseInit

        // ✅ PRODUCTION: Logger (sanitizes sensitive data)
        Logger,

        // ✅ CSP-FIX: DOM Manipulation (CSS-Class based)
        showElement,
        hideElement,
        toggleElement,
        toggleClass,

        // ✅ P0 SECURITY: CSP-compliant dynamic styles
        generateDynamicClass,
        applyStyles,

        // UI
        showLoading,
        hideLoading,
        showNotification,

        // ✅ P0 FIX: Security - Safe DOM manipulation
        sanitizeInput,
        sanitizeHTML,
        setTextContent,
        createElementWithText,
        createButton,

        // ✅ OPTIMIZATION: Telemetry & Logging
        logToTelemetry,
        logError,
        logInfo,

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
        clearOldAppData,

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

        // ✅ P2 PERFORMANCE: Memoization
        memoize,
        formatTime,
        calculateBarWidth,

        // ✅ P1 UI/UX: Dark Mode
        toggleDarkMode,
        initDarkMode,

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

        // Firebase
        waitForDependencies,
        waitForFirebaseInit,

        // Cleanup
        cleanupEventListeners,

        // Expose DOMPurify
        DOMPurify: typeof DOMPurify !== 'undefined' ? DOMPurify : null,

        // DSGVO/Jugendschutz: Age verification helpers
        checkAgeVerification,
        getVerifiedAge,
        canAccessFSK,
        setAgeVerification,
        clearAgeVerification,
        getAgeVerificationTimeLeft,
        formatAgeVerificationExpiry
    });

    if (isDevelopment) {
        console.log('%c✅ NocapUtils v6.1 exported to window.NocapUtils',
            'color: #2196F3; font-weight: bold; font-size: 12px');
        console.log('   Available functions:', Object.keys(window.NocapUtils).length);
        console.log('   New in v6.1: waitForFirebaseInit() helper');
    }

})(window);

