/**
 * NO-CAP Error Boundary
 * Global Error Handling & Telemetry
 * Version 1.0 - Production Hardened
 *
 * ✅ Features:
 * - Global error catching (window.onerror, unhandledrejection)
 * - User-friendly error notifications
 * - Telemetry integration (Sentry, Firebase Analytics)
 * - Error debouncing (prevent spam)
 * - Graceful degradation
 * - Development vs Production modes
 *
 * ✅ Akzeptanzkriterien:
 * 1. Alle ungefangenen Fehler werden abgefangen und gemeldet
 * 2. Errors werden an externen Dienst gesendet
 * 3. App-Abstürze werden verhindert
 */

(function(window) {
    'use strict';

    // ===================================
    // 📊 CONFIGURATION
    // ===================================

    const CONFIG = {
        // Error debouncing (prevent spam)
        DEBOUNCE_TIME: 3000, // 3 seconds

        // Max errors to track in memory
        MAX_ERROR_HISTORY: 50,

        // Show notifications to users
        SHOW_USER_NOTIFICATIONS: true,

        // Send to telemetry (Sentry, Firebase, etc.)
        ENABLE_TELEMETRY: true,

        // Telemetry services
        SENTRY_DSN: null, // Set via init() if using Sentry

        // Development mode (more verbose logging)
        isDevelopment: window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname.includes('192.168.')
    };

    // ===================================
    // 🗄️ STATE
    // ===================================

    const state = {
        initialized: false,
        errorHistory: [],
        lastErrorTime: 0,
        debounceTimer: null,
        errorCount: 0
    };

    // ===================================
    // 🛡️ ERROR HANDLING
    // ===================================

    /**
     * ✅ P0 SECURITY: Handle JavaScript errors (window.onerror)
     * Sanitizes all error data before storage and transmission
     * @param {string} message - Error message
     * @param {string} source - Script URL
     * @param {number} lineno - Line number
     * @param {number} colno - Column number
     * @param {Error} error - Error object
     */
    function handleError(message, source, lineno, colno, error) {
        try {
            // ✅ P0 SECURITY: Create error object with sanitized data
            const errorInfo = {
                message: sanitizeErrorMessage(message || 'Unknown error'),
                source: sanitizeErrorMessage(source || 'Unknown source'),
                lineno: lineno || 0,
                colno: colno || 0,
                stack: sanitizeStackTrace(error?.stack || 'No stack trace'),
                timestamp: Date.now(),
                url: window.location.href,
                userAgent: navigator.userAgent
            };

            // Add to history
            addToErrorHistory(errorInfo);

            // Check if should show (debounce)
            if (shouldShowError()) {
                // Show user notification
                showUserNotification(errorInfo);

                // Send to telemetry
                sendToTelemetry(errorInfo, 'error');
            }

            // Log to console
            if (CONFIG.isDevelopment) {
                console.error('❌ Caught error:', errorInfo);
            }

            // Prevent default browser error handling
            return true;

        } catch (handlerError) {
            console.error('❌ Error in error handler:', handlerError);
            return false;
        }
    }

    /**
     * ✅ P1 STABILITY: Handle unhandled promise rejections
     * ✅ P0 SECURITY: Sanitizes all error data before storage
     * @param {PromiseRejectionEvent} event
     */
    function handleUnhandledRejection(event) {
        try {
            // Extract error info
            const reason = event.reason;

            // ✅ P0 SECURITY: Create error object with sanitized data
            const errorInfo = {
                message: sanitizeErrorMessage(reason?.message || String(reason) || 'Unhandled Promise Rejection'),
                source: 'Promise',
                lineno: 0,
                colno: 0,
                stack: sanitizeStackTrace(reason?.stack || 'No stack trace'),
                timestamp: Date.now(),
                url: window.location.href,
                userAgent: navigator.userAgent,
                type: 'unhandledrejection'
            };

            // Add to history
            addToErrorHistory(errorInfo);

            // Check if should show (debounce)
            if (shouldShowError()) {
                // Show user notification
                showUserNotification(errorInfo);

                // Send to telemetry
                sendToTelemetry(errorInfo, 'unhandledrejection');
            }

            // Log to console
            if (CONFIG.isDevelopment) {
                console.error('❌ Unhandled rejection:', errorInfo);
            }

            // Prevent default
            event.preventDefault();

        } catch (handlerError) {
            console.error('❌ Error in rejection handler:', handlerError);
        }
    }

    // ===================================
    // 📝 ERROR TRACKING
    // ===================================

    /**
     * Add error to history
     * @param {Object} errorInfo
     */
    function addToErrorHistory(errorInfo) {
        state.errorHistory.push(errorInfo);
        state.errorCount++;

        // Limit history size
        if (state.errorHistory.length > CONFIG.MAX_ERROR_HISTORY) {
            state.errorHistory.shift();
        }
    }

    /**
     * ✅ Debounce: Should we show this error?
     * Prevents error spam
     */
    function shouldShowError() {
        const now = Date.now();
        const timeSinceLastError = now - state.lastErrorTime;

        if (timeSinceLastError < CONFIG.DEBOUNCE_TIME) {
            // Too soon, skip
            if (CONFIG.isDevelopment) {
                console.log('⏭️ Error debounced (too frequent)');
            }
            return false;
        }

        state.lastErrorTime = now;
        return true;
    }

    // ===================================
    // 🛡️ P0 SECURITY: SANITIZATION
    // ===================================

    /**
     * ✅ P0 SECURITY: Sanitize error message - remove sensitive data
     * Removes: API keys, tokens, passwords, email addresses, stack traces
     * @param {string} message - Raw error message
     * @returns {string} Sanitized message
     */
    function sanitizeErrorMessage(message) {
        if (!message) return '';

        let sanitized = String(message);

        // ✅ P0 SECURITY: Remove API keys (various patterns)
        sanitized = sanitized.replace(/[A-Za-z0-9]{32,}/g, '[REDACTED_KEY]');
        sanitized = sanitized.replace(/AIza[A-Za-z0-9_-]{35}/g, '[REDACTED_API_KEY]');
        sanitized = sanitized.replace(/sk_[a-z]+_[A-Za-z0-9]{24,}/g, '[REDACTED_SECRET_KEY]');

        // ✅ P0 SECURITY: Remove tokens
        sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [REDACTED_TOKEN]');
        sanitized = sanitized.replace(/token[=:]\s*[A-Za-z0-9\-_.]+/gi, 'token=[REDACTED]');

        // ✅ P0 SECURITY: Remove email addresses
        sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');

        // ✅ P0 SECURITY: Remove file paths (may contain usernames)
        sanitized = sanitized.replace(/[A-Z]:\\[^\s]+/g, '[PATH_REDACTED]');
        sanitized = sanitized.replace(/\/[a-z]+\/[^\s]+/g, '[PATH_REDACTED]');

        // ✅ P0 SECURITY: Remove URLs with credentials
        sanitized = sanitized.replace(/https?:\/\/[^:]+:[^@]+@/g, 'https://[CREDENTIALS_REDACTED]@');

        // ✅ P0 SECURITY: Remove stack trace lines in production
        if (!CONFIG.isDevelopment) {
            sanitized = sanitized.split('\n')[0]; // Only first line
        }

        return sanitized.substring(0, 500); // Max length
    }

    /**
     * ✅ P0 SECURITY: Sanitize stack trace - remove sensitive file paths
     * @param {string} stack - Raw stack trace
     * @returns {string} Sanitized stack trace
     */
    function sanitizeStackTrace(stack) {
        if (!stack) return '';
        if (!CONFIG.isDevelopment) return '[STACK_REDACTED]'; // Never show in production

        let sanitized = String(stack);

        // Remove absolute file paths
        sanitized = sanitized.replace(/[A-Z]:\\[^\s)]+/g, '[PATH]');
        sanitized = sanitized.replace(/\/[a-z]+\/[^\s)]+/g, '[PATH]');

        // Remove webpack URLs
        sanitized = sanitized.replace(/webpack:\/\/[^\s)]+/g, '[WEBPACK]');

        return sanitized.substring(0, 1000); // Max length
    }

    // ===================================
    // 🔔 USER NOTIFICATIONS
    // ===================================

    /**
     * ✅ P1 STABILITY: Show user-friendly error notification with actions
     * @param {Object} errorInfo
     */
    function showUserNotification(errorInfo) {
        if (!CONFIG.SHOW_USER_NOTIFICATIONS) return;

        // Get user-friendly message
        const userMessage = getUserFriendlyMessage(errorInfo);
        const errorId = generateErrorId(errorInfo);

        // ✅ P1 STABILITY: Create error modal with action buttons
        createErrorModal(userMessage, errorId, errorInfo);
    }

    /**
     * ✅ P1 STABILITY: Create error modal with reload and report options
     * @param {string} message - User-friendly message
     * @param {string} errorId - Unique error ID
     * @param {Object} errorInfo - Full error info (for reporting)
     */
    function createErrorModal(message, errorId, errorInfo) {
        // Check if modal already exists
        let modal = document.getElementById('nocap-error-modal');

        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'nocap-error-modal';
            modal.className = 'error-modal';
            modal.setAttribute('role', 'alertdialog');
            modal.setAttribute('aria-labelledby', 'error-modal-title');
            modal.setAttribute('aria-describedby', 'error-modal-desc');
            modal.setAttribute('aria-modal', 'true');

            modal.innerHTML = `
                <div class="error-modal-overlay"></div>
                <div class="error-modal-content">
                    <div class="error-modal-header">
                        <h2 id="error-modal-title">⚠️ Es ist ein Fehler aufgetreten</h2>
                    </div>
                    <div class="error-modal-body">
                        <p id="error-modal-desc" class="error-message"></p>
                        <p class="error-id">Fehler-ID: <code></code></p>
                    </div>
                    <div class="error-modal-actions">
                        <button id="error-reload-btn" class="btn btn-primary">
                            🔄 Seite neu laden
                        </button>
                        <button id="error-report-btn" class="btn btn-secondary">
                            📧 Fehler melden
                        </button>
                        <button id="error-close-btn" class="btn btn-link">
                            ❌ Schließen
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
        }

        // ✅ P0 SECURITY: Set sanitized message (textContent, not innerHTML)
        const messageEl = modal.querySelector('.error-message');
        messageEl.textContent = message;

        const errorIdEl = modal.querySelector('.error-id code');
        errorIdEl.textContent = errorId;

        // Show modal
        modal.style.display = 'flex';
        modal.classList.add('visible');

        // ✅ P1 STABILITY: Setup event handlers
        const reloadBtn = modal.querySelector('#error-reload-btn');
        const reportBtn = modal.querySelector('#error-report-btn');
        const closeBtn = modal.querySelector('#error-close-btn');

        // Reload page
        reloadBtn.onclick = () => {
            window.location.reload();
        };

        // Report error
        reportBtn.onclick = () => {
            reportErrorToSupport(errorInfo, errorId);
        };

        // Close modal
        closeBtn.onclick = () => {
            modal.style.display = 'none';
            modal.classList.remove('visible');
        };

        // Auto-focus on reload button
        reloadBtn.focus();

        // ESC key to close
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeBtn.click();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    /**
     * ✅ P1 STABILITY: Generate unique error ID for tracking
     * @param {Object} errorInfo
     * @returns {string} Error ID
     */
    function generateErrorId(errorInfo) {
        const timestamp = errorInfo.timestamp || Date.now();
        const hash = simpleHash(errorInfo.message + errorInfo.source);
        return `ERR-${timestamp}-${hash}`;
    }

    /**
     * Simple hash function for error IDs
     * @param {string} str
     * @returns {string} 4-char hash
     */
    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36).substring(0, 4).toUpperCase();
    }

    /**
     * ✅ P1 STABILITY: Report error to support (email or feedback form)
     * @param {Object} errorInfo - Full error info
     * @param {string} errorId - Error ID
     */
    function reportErrorToSupport(errorInfo, errorId) {
        try {
            // ✅ P0 SECURITY: Sanitize all data before sending
            const sanitizedReport = {
                errorId: errorId,
                message: sanitizeErrorMessage(errorInfo.message),
                source: sanitizeErrorMessage(errorInfo.source),
                timestamp: errorInfo.timestamp,
                url: window.location.href,
                userAgent: navigator.userAgent,
                // ✅ P0 SECURITY: Stack trace only in development
                stack: CONFIG.isDevelopment ? sanitizeStackTrace(errorInfo.stack) : '[REDACTED]'
            };

            // Create email body
            const emailBody = encodeURIComponent(
                `Fehler-ID: ${sanitizedReport.errorId}\n\n` +
                `Nachricht: ${sanitizedReport.message}\n` +
                `Seite: ${sanitizedReport.url}\n` +
                `Zeit: ${new Date(sanitizedReport.timestamp).toLocaleString()}\n\n` +
                `Bitte beschreibe, was du getan hast, als der Fehler auftrat:\n\n`
            );

            // Open email client or feedback form
            const supportEmail = 'support@no-cap.app'; // Replace with your support email
            window.location.href = `mailto:${supportEmail}?subject=Fehlerbericht ${errorId}&body=${emailBody}`;

            if (CONFIG.isDevelopment) {
                console.log('📧 Error report prepared:', sanitizedReport);
            }

            // Show confirmation
            if (window.NocapUtils?.showNotification) {
                window.NocapUtils.showNotification(
                    'E-Mail-Client geöffnet. Vielen Dank für deine Hilfe!',
                    'success',
                    3000
                );
            }

        } catch (error) {
            console.error('Failed to create error report:', error);

            // Fallback: Copy to clipboard
            const reportText = `Fehler-ID: ${errorId}\nBitte sende diese ID an support@no-cap.app`;

            if (navigator.clipboard) {
                navigator.clipboard.writeText(reportText)
                    .then(() => {
                        alert('Fehler-ID in Zwischenablage kopiert. Bitte sende sie an support@no-cap.app');
                    })
                    .catch(() => {
                        alert(reportText);
                    });
            } else {
                alert(reportText);
            }
        }
    }

    /**
     * ✅ P0 SECURITY: Convert technical error to user-friendly message
     * NEVER shows stack traces, API keys, or sensitive data
     * @param {Object} errorInfo
     * @returns {string} User-friendly message
     */
    function getUserFriendlyMessage(errorInfo) {
        const message = sanitizeErrorMessage(errorInfo.message || '');

        // Common error patterns
        if (message.includes('Network') || message.includes('fetch') || message.includes('Failed to fetch')) {
            return 'Netzwerkfehler. Bitte prüfe deine Internetverbindung.';
        }

        if (message.includes('Firebase') || message.includes('PERMISSION_DENIED')) {
            return 'Verbindungsproblem. Bitte lade die Seite neu.';
        }

        if (message.includes('localStorage') || message.includes('QuotaExceeded')) {
            return 'Speicher voll. Bitte lösche Browser-Daten oder verwende den Inkognito-Modus.';
        }

        if (message.includes('undefined') || message.includes('null') || message.includes('Cannot read property')) {
            return 'Ein unerwarteter Fehler ist aufgetreten. Bitte lade die Seite neu.';
        }

        if (message.includes('timeout') || message.includes('Timeout')) {
            return 'Die Anfrage hat zu lange gedauert. Bitte versuche es erneut.';
        }

        if (message.includes('script') || message.includes('blocked')) {
            return 'Ein Skript konnte nicht geladen werden. Bitte deaktiviere Adblocker.';
        }

        // ✅ P0 SECURITY: Development - show sanitized error
        if (CONFIG.isDevelopment) {
            return `Fehler: ${message.substring(0, 100)}`;
        }

        // ✅ P0 SECURITY: Production - generic message (NEVER show technical details)
        return 'Ein Fehler ist aufgetreten. Wir arbeiten daran! Bitte versuche, die Seite neu zu laden.';
    }

    // ===================================
    // 📡 TELEMETRY
    // ===================================

    /**
     * ✅ Send error to telemetry services
     * @param {Object} errorInfo
     * @param {string} type - 'error' or 'unhandledrejection'
     */
    function sendToTelemetry(errorInfo, type) {
        if (!CONFIG.ENABLE_TELEMETRY) return;

        // 1. Try Sentry
        sendToSentry(errorInfo, type);

        // 2. Try Firebase Analytics
        sendToFirebaseAnalytics(errorInfo, type);

        // 3. Try custom logger (if available)
        sendToCustomLogger(errorInfo, type);
    }

    /**
     * Send to Sentry (if configured)
     */
    function sendToSentry(errorInfo, type) {
        if (!window.Sentry) return;
        if (!CONFIG.SENTRY_DSN) return;

        try {
            if (type === 'error') {
                Sentry.captureException(new Error(errorInfo.message), {
                    extra: errorInfo
                });
            } else {
                Sentry.captureMessage(errorInfo.message, {
                    level: 'error',
                    extra: errorInfo
                });
            }

            if (CONFIG.isDevelopment) {
                console.log('✅ Error sent to Sentry');
            }
        } catch (error) {
            console.warn('⚠️ Failed to send to Sentry:', error);
        }
    }

    /**
     * Send to Firebase Analytics
     */
    function sendToFirebaseAnalytics(errorInfo, type) {
        if (!window.firebase?.analytics) return;

        try {
            firebase.analytics().logEvent('exception', {
                description: errorInfo.message,
                fatal: type === 'error',
                source: errorInfo.source,
                timestamp: errorInfo.timestamp
            });

            if (CONFIG.isDevelopment) {
                console.log('✅ Error logged to Firebase Analytics');
            }
        } catch (error) {
            console.warn('⚠️ Failed to log to Firebase Analytics:', error);
        }
    }

    /**
     * Send to custom logger (NocapUtils)
     */
    function sendToCustomLogger(errorInfo, type) {
        if (!window.NocapUtils?.logError) return;

        try {
            window.NocapUtils.logError(
                'ErrorBoundary',
                new Error(errorInfo.message),
                {
                    ...errorInfo,
                    type: type
                }
            );

            if (CONFIG.isDevelopment) {
                console.log('✅ Error logged to NocapUtils');
            }
        } catch (error) {
            console.warn('⚠️ Failed to log to NocapUtils:', error);
        }
    }

    // ===================================
    // 🚀 INITIALIZATION
    // ===================================

    /**
     * ✅ Initialize Error Boundary
     * @param {Object} options - Configuration options
     */
    function init(options = {}) {
        if (state.initialized) {
            if (CONFIG.isDevelopment) {
                console.log('ℹ️ Error Boundary already initialized');
            }
            return;
        }

        // Merge options
        Object.assign(CONFIG, options);

        // Register global error handlers
        window.onerror = handleError;
        window.onunhandledrejection = handleUnhandledRejection;

        state.initialized = true;

        if (CONFIG.isDevelopment) {
            console.log('✅ Error Boundary initialized');
            console.log('Config:', CONFIG);
        }

        // Initialize Sentry if DSN provided
        if (CONFIG.SENTRY_DSN && window.Sentry) {
            try {
                Sentry.init({
                    dsn: CONFIG.SENTRY_DSN,
                    environment: CONFIG.isDevelopment ? 'development' : 'production',
                    beforeSend(event) {
                        // Don't send in development
                        if (CONFIG.isDevelopment) {
                            console.log('📤 Would send to Sentry (dev):', event);
                            return null;
                        }
                        return event;
                    }
                });

                console.log('✅ Sentry initialized');
            } catch (error) {
                console.warn('⚠️ Sentry initialization failed:', error);
            }
        }
    }

    // Auto-initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => init());
    } else {
        init();
    }

    // ===================================
    // 📤 PUBLIC API
    // ===================================

    /**
     * ✅ Public API for Error Boundary
     */
    window.NocapErrorBoundary = {
        // Initialization
        init: init,

        // Manual error reporting
        reportError: (error, context = {}) => {
            const errorInfo = {
                message: error?.message || String(error),
                stack: error?.stack || 'No stack trace',
                timestamp: Date.now(),
                url: window.location.href,
                userAgent: navigator.userAgent,
                ...context
            };

            addToErrorHistory(errorInfo);
            showUserNotification(errorInfo);
            sendToTelemetry(errorInfo, 'manual');
        },

        // Get error history
        getErrorHistory: () => [...state.errorHistory],

        // Get error count
        getErrorCount: () => state.errorCount,

        // Clear error history
        clearHistory: () => {
            state.errorHistory = [];
            state.errorCount = 0;
            if (CONFIG.isDevelopment) {
                console.log('✅ Error history cleared');
            }
        },

        // Configuration
        configure: (options) => {
            Object.assign(CONFIG, options);
            if (CONFIG.isDevelopment) {
                console.log('✅ Error Boundary reconfigured:', CONFIG);
            }
        },

        // Metadata
        version: '1.0',
        isInitialized: () => state.initialized
    };

    // ===================================
    // 🧪 TESTING HELPERS (Development Only)
    // ===================================

    if (CONFIG.isDevelopment) {
        window.NocapErrorBoundary.test = {
            // Trigger test error
            triggerError: () => {
                throw new Error('Test error from Error Boundary');
            },

            // Trigger test promise rejection
            triggerRejection: () => {
                Promise.reject(new Error('Test rejection from Error Boundary'));
            },

            // Show test notification
            triggerNotification: () => {
                showUserNotification({
                    message: 'This is a test error notification',
                    source: 'test',
                    timestamp: Date.now()
                });
            }
        };
    }

})(window);

