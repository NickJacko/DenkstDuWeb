/**
 * No-Cap Firebase Initialization with Auto-Auth
 * Version 2.0 - Silent Authentication Layer
 *
 * ✅ Initializes Firebase from meta tags
 * ✅ Automatically ensures authentication (anonymous if needed)
 * ✅ No UI blocking - runs silently in background
 * ✅ Sets up auth state monitoring
 *
 * CHANGES FROM v1.0:
 * - Added automatic ensureAuth() call after Firebase init
 * - Added auth state listener setup
 * - Added authService integration
 */

(function () {
    "use strict";

    const isDevelopment =
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1" ||
        location.hostname.includes("192.168.");

    const isProduction = !isDevelopment;

    /**
     * Get Firebase configuration from meta tags
     */
    function getFirebaseConfig() {
        const getMeta = (n) =>
            document.querySelector(`meta[name="firebase-${n}"]`)?.content || null;

        const apiKey = getMeta("api-key");
        if (!apiKey) return null;

        return {
            apiKey,
            authDomain: getMeta("auth-domain"),
            databaseURL: getMeta("database-url"),
            projectId: getMeta("project-id"),
            storageBucket: getMeta("storage-bucket"),
            messagingSenderId: getMeta("messaging-sender-id"),
            appId: getMeta("app-id"),
            measurementId: getMeta("measurement-id"),
            appCheckKey: getMeta("app-check-key"),
        };
    }

    /**
     * Validate Firebase configuration
     */
    function validateConfig(config) {
        if (!config || typeof config !== "object") return false;
        if (!config.apiKey || typeof config.apiKey !== "string") return false;
        return !!(config.authDomain && config.projectId);
    }

    /**
     * Wait for Firebase SDK to load
     */
    function waitForFirebase(cb, timeout = 10000) {
        const start = Date.now();
        (function check() {
            if (window.firebase?.initializeApp) return cb();
            if (Date.now() - start > timeout) {
                console.error("❌ Firebase SDK timeout");
                return;
            }
            setTimeout(check, 50);
        })();
    }

    /**
     * ✅ NEW: Wait for authService to be ready
     */
    function waitForAuthService(timeout = 5000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();

            (function check() {
                // Check if authService exists and is initialized
                if (window.authService && window.authService.initialized) {
                    resolve(window.authService);
                    return;
                }

                // Timeout
                if (Date.now() - start > timeout) {
                    reject(new Error('AuthService timeout'));
                    return;
                }

                // Check again in 100ms
                setTimeout(check, 100);
            })();
        });
    }

    /**
     * ✅ NEW: Setup automatic authentication after Firebase init
     */
    async function setupAutoAuth() {
        try {
            if (isDevelopment) {
                console.log('🔐 Setting up auto-auth...');
            }

            // Wait for authService to be ready
            const authService = await waitForAuthService(5000);

            // Ensure user is authenticated (creates anonymous if needed)
            await authService.ensureAuth();

            if (isDevelopment) {
                const uid = authService.getUid();
                const isAnon = authService.isAnonymous();
                console.log(`✅ Auto-auth completed: ${isAnon ? 'Anonymous' : 'Authenticated'} (${uid?.substring(0, 8)}...)`);
            }

            // Dispatch event for other modules
            window.dispatchEvent(new CustomEvent('firebase:authReady', {
                detail: {
                    uid: authService.getUid(),
                    isAnonymous: authService.isAnonymous(),
                    timestamp: Date.now()
                }
            }));

        } catch (error) {
            console.warn('⚠️ Auto-auth failed (non-fatal):', error.message);

            // Non-fatal: App continues without auth
            // User can manually trigger auth later if needed

            if (isDevelopment) {
                console.log('ℹ️ App will continue without authentication');
            }
        }
    }

    /**
     * Initialize Firebase
     */
    function initializeFirebase() {
        const config = getFirebaseConfig();
        if (!config || !validateConfig(config)) {
            console.error("❌ Firebase config missing/invalid. Check meta tags (firebase-*) in <head>.");
            return;
        }

        waitForFirebase(() => {
            try {
                if (!firebase.apps || firebase.apps.length === 0) {
                    firebase.initializeApp(config);

                    // 🔐 App Check (reCAPTCHA v3) - ✅ No hardcoded fallback key
                    const appCheckKey =
                        window.FIREBASE_APP_CHECK_KEY ||
                        config.appCheckKey ||
                        null;

                    if (firebase.appCheck && appCheckKey) {
                        try {
                            firebase.appCheck().activate(appCheckKey, true);

                            console.log(
                                isDevelopment
                                    ? "✅ Firebase initialized + App Check active (dev)"
                                    : "✅ Firebase initialized + App Check active (prod)"
                            );

                        } catch (error) {
                            console.warn("⚠️ App Check activation failed (continuing without):", error);
                        }
                    } else {
                        // No key or SDK -> run without App Check (non-fatal)
                        if (isProduction) {
                            console.warn("⚠️ App Check not active (missing key or SDK)");
                        } else if (isDevelopment) {
                            console.log("ℹ️ App Check not active in dev (missing key or SDK)");
                        }
                    }

                    // ✅ FIX: Set global flag for other scripts to detect initialization
                    window.firebaseInitialized = true;

                    if (isDevelopment) {
                        console.log("✅ Firebase initialized");
                    }

                    // ✅ NEW: Dispatch init event
                    window.dispatchEvent(new CustomEvent('firebase:initialized', {
                        detail: { timestamp: Date.now() }
                    }));

                    // ✅ NEW: Setup auto-auth after successful init
                    // Use setTimeout to allow other scripts (authService) to load
                    setTimeout(() => {
                        setupAutoAuth();
                    }, 100);
                }
            } catch (e) {
                console.error("❌ Firebase init failed", e);
            }
        });
    }

    // ===============================
    // AUTO INIT
    // ===============================
    initializeFirebase();

    // ✅ NEW: Also setup auto-auth when config is loaded dynamically
    window.addEventListener("firebase:configLoaded", () => {
        initializeFirebase();

        // Setup auto-auth after re-init
        setTimeout(() => {
            setupAutoAuth();
        }, 100);
    });

    // ===============================
    // ✅ NEW: PUBLIC API
    // ===============================
    window.FirebaseInit = Object.freeze({
        version: '2.0',

        /**
         * Check if Firebase is initialized
         */
        isInitialized() {
            return window.firebaseInitialized === true;
        },

        /**
         * Check if auth is ready
         */
        isAuthReady() {
            return window.authService?.initialized === true;
        },

        /**
         * Wait for Firebase to be ready
         */
        async waitForFirebase(timeout = 10000) {
            const start = Date.now();

            while (!window.firebaseInitialized) {
                if (Date.now() - start > timeout) {
                    throw new Error('Firebase initialization timeout');
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            return true;
        },

        /**
         * Wait for auth to be ready
         */
        async waitForAuth(timeout = 10000) {
            const start = Date.now();

            while (!window.authService?.initialized) {
                if (Date.now() - start > timeout) {
                    throw new Error('Auth initialization timeout');
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            return window.authService;
        },

        /**
         * Get current user UID (convenience method)
         */
        getUid() {
            return window.authService?.getUid() || null;
        },

        /**
         * Check if user is anonymous (convenience method)
         */
        isAnonymous() {
            return window.authService?.isAnonymous() || false;
        }
    });

    // ===============================
    // DEVELOPMENT LOGGING
    // ===============================
    if (isDevelopment) {
        console.log(
            '%c✅ FirebaseInit v2.0 loaded (with Auto-Auth)',
            'color: #FF6F00; font-weight: bold; font-size: 12px'
        );
    }
})();