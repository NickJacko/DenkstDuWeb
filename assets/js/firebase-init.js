/**
 * Firebase Configuration Initializer
 * Version 2.0 - External Config Integration
 *
 * ✅ P0 SECURITY: No secrets in this file
 * ✅ CSP-compliant external script - no inline code
 * ✅ Production-hardened with validation
 *
 * SECURITY NOTE:
 * The Firebase Web API Key (apiKey) is NOT a secret!
 * - It's safe to expose in client-side code
 * - It's protected by Firebase Security Rules
 * - It can be domain-restricted in Firebase Console
 *
 * REAL SECRETS (never in client code):
 * - Service Account Keys (.json files)
 * - Admin SDK Private Keys
 * - Cloud Functions Environment Secrets
 * - Database Secret (for server-side)
 *
 * CONFIG SOURCE PRIORITY:
 * 1. window.FIREBASE_CONFIG (set by build process)
 * 2. Meta tags in HTML
 * 3. firebase-config.js (loads from allowed-domains.json)
 */

(function() {
    'use strict';

    // Environment detection
    const isDevelopment = window.location.hostname === 'localhost' ||
                         window.location.hostname.includes('127.0.0.1') ||
                         window.location.hostname.includes('192.168.');

    /**
     * ✅ P0 SECURITY: Get Firebase config from external sources
     * NO hardcoded config in this file!
     */
    function getFirebaseConfig() {
        // Priority 1: window.FIREBASE_CONFIG (set by build process or firebase-config.js)
        if (window.FIREBASE_CONFIG) {
            if (isDevelopment) {
                console.log('✅ Using Firebase config from window.FIREBASE_CONFIG');
            }
            return window.FIREBASE_CONFIG;
        }

        // Priority 2: Meta tags (for static hosting)
        const metaConfig = getConfigFromMetaTags();
        if (metaConfig) {
            if (isDevelopment) {
                console.log('✅ Using Firebase config from meta tags');
            }
            return metaConfig;
        }

        // Priority 3: Wait for firebase-config.js to load
        if (isDevelopment) {
            console.warn('⚠️ No Firebase config found yet. Waiting for firebase-config.js...');
        }
        return null;
    }

    /**
     * Extract Firebase config from HTML meta tags
     */
    function getConfigFromMetaTags() {
        const getMetaContent = (name) => {
            const meta = document.querySelector(`meta[name="firebase-${name}"]`);
            return meta ? meta.getAttribute('content') : null;
        };

        const apiKey = getMetaContent('api-key');
        if (!apiKey) return null;

        return {
            apiKey: apiKey,
            authDomain: getMetaContent('auth-domain'),
            databaseURL: getMetaContent('database-url'),
            projectId: getMetaContent('project-id'),
            storageBucket: getMetaContent('storage-bucket'),
            messagingSenderId: getMetaContent('messaging-sender-id'),
            appId: getMetaContent('app-id'),
            measurementId: getMetaContent('measurement-id')
        };
    }

    /**
     * ✅ P0 SECURITY: Validate config (basic safety checks)
     */
    function validateConfig(config) {
        if (!config || typeof config !== 'object') {
            return false;
        }

        const requiredKeys = ['apiKey', 'authDomain', 'projectId'];
        const isValid = requiredKeys.every(key => config[key] && typeof config[key] === 'string');

        if (!isValid) {
            console.error('❌ Firebase config validation failed - missing required fields');
            return false;
        }

        // ✅ P0 SECURITY: Check that this looks like a Firebase Web API Key
        // (not a service account key or other secret)
        if (!config.apiKey.startsWith('AIza')) {
            console.error('❌ Invalid API key format - this may not be a Firebase Web API Key');
            return false;
        }

        return true;
    }

    /**
     * Wait for Firebase SDK to be loaded
     */
    function waitForFirebase(callback, timeout = 10000) {
        const startTime = Date.now();

        const check = () => {
            if (typeof firebase !== 'undefined' && firebase.initializeApp) {
                callback();
            } else if (Date.now() - startTime < timeout) {
                setTimeout(check, 50);
            } else {
                console.error('❌ Firebase SDK timeout - not loaded within 10 seconds');
            }
        };

        check();
    }

    /**
     * Initialize Firebase with config from external source
     */
    function initializeFirebase() {
        // Get config from external source
        const config = getFirebaseConfig();

        if (!config) {
            if (isDevelopment) {
                console.log('ℹ️ Firebase config not ready. firebase-config.js will handle initialization.');
            }
            return;
        }

        // Validate config
        if (!validateConfig(config)) {
            console.error('❌ Firebase config validation failed');
            return;
        }

        // Wait for Firebase SDK
        waitForFirebase(() => {
            try {
                // Only initialize if not already initialized
                if (!firebase.apps || firebase.apps.length === 0) {
                    firebase.initializeApp(config);

                    if (isDevelopment) {
                        console.log('✅ Firebase initialized by firebase-init.js');
                    }

                    // Optional: Sign in anonymously immediately
                    // (firebase-config.js may also handle this)
                    const autoSignIn = true; // Can be disabled if firebase-config.js handles it

                    if (autoSignIn) {
                        firebase.auth().signInAnonymously()
                            .then(() => {
                                if (isDevelopment) {
                                    console.log('✅ Signed in anonymously');
                                }
                            })
                            .catch(err => {
                                console.warn('⚠️ Anonymous sign-in failed:', err.message);
                            });
                    }

                } else {
                    if (isDevelopment) {
                        console.log('ℹ️ Firebase already initialized (by firebase-config.js or other script)');
                    }
                }
            } catch (error) {
                console.error('❌ Firebase initialization error:', error);
            }
        });
    }

    // ===================================
    // AUTO-INITIALIZATION
    // ===================================

    // Try to initialize immediately if config is available
    initializeFirebase();

    // Also listen for config to become available (if firebase-config.js loads later)
    window.addEventListener('firebase:configLoaded', () => {
        if (isDevelopment) {
            console.log('📡 firebase:configLoaded event received');
        }
        initializeFirebase();
    });

})();


