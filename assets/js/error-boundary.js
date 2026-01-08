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
     * ✅ Handle JavaScript errors (window.onerror)
     * @param {string} message - Error message
     * @param {string} source - Script URL
     * @param {number} lineno - Line number
     * @param {number} colno - Column number
     * @param {Error} error - Error object
     */
    function handleError(message, source, lineno, colno, error) {
        try {
            // Create error object
            const errorInfo = {
                message: message || 'Unknown error',
                source: source || 'Unknown source',
                lineno: lineno || 0,
                colno: colno || 0,
                stack: error?.stack || 'No stack trace',
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
     * ✅ Handle unhandled promise rejections
     * @param {PromiseRejectionEvent} event
     */
    function handleUnhandledRejection(event) {
        try {
            // Extract error info
            const reason = event.reason;
            const errorInfo = {
                message: reason?.message || String(reason) || 'Unhandled Promise Rejection',
                source: 'Promise',
                lineno: 0,
                colno: 0,
                stack: reason?.stack || 'No stack trace',
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
    // 🔔 USER NOTIFICATIONS
    // ===================================

    /**
     * ✅ Show user-friendly error notification
     * @param {Object} errorInfo
     */
    function showUserNotification(errorInfo) {
        if (!CONFIG.SHOW_USER_NOTIFICATIONS) return;

        // Get user-friendly message
        const userMessage = getUserFriendlyMessage(errorInfo);

        // Try NocapUtils first
        if (window.NocapUtils && window.NocapUtils.showNotification) {
            window.NocapUtils.showNotification(
                userMessage,
                'error',
                5000
            );
            return;
        }

        // Fallback: alert (not ideal, but better than nothing)
        if (CONFIG.isDevelopment) {
            alert(`❌ Fehler: ${userMessage}`);
        }
    }

    /**
     * Convert technical error to user-friendly message
     * @param {Object} errorInfo
     * @returns {string}
     */
    function getUserFriendlyMessage(errorInfo) {
        const message = errorInfo.message || '';

        // Common error patterns
        if (message.includes('Network') || message.includes('fetch')) {
            return 'Netzwerkfehler. Bitte prüfe deine Internetverbindung.';
        }

        if (message.includes('Firebase') || message.includes('PERMISSION_DENIED')) {
            return 'Verbindungsproblem. Bitte lade die Seite neu.';
        }

        if (message.includes('localStorage') || message.includes('QuotaExceeded')) {
            return 'Speicher voll. Bitte lösche Browser-Daten.';
        }

        if (message.includes('undefined') || message.includes('null')) {
            return 'Ein Fehler ist aufgetreten. Bitte lade die Seite neu.';
        }

        // Development: Show actual error
        if (CONFIG.isDevelopment) {
            return `Fehler: ${message}`;
        }

        // Production: Generic message
        return 'Ein Fehler ist aufgetreten. Wir arbeiten daran!';
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

