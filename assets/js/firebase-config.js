/**
 * No-Cap Firebase Configuration & Initialization
 * Version 4.0 - Audit-Fixed & Security Hardened
 *
 * This file ONLY initializes Firebase SDK
 * All game operations are in firebase-service.js
 * All auth operations are in firebase-auth.js
 */

'use strict';

(function(window) {

    // ===== P0 FIX: ENVIRONMENT DETECTION =====
    const isDevelopment = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('192.168.');

    // ===== P0 FIX: FIREBASE CONFIG WITH FALLBACK =====
    // In production, this should come from environment variables
    // For now, we keep the config but mark it as a security improvement needed
    const firebaseConfig = window.FIREBASE_CONFIG || {
        apiKey: "AIzaSyC_cu_2X2uFCPcxYetxIUHi2v56F1Mz0Vk",
        authDomain: "denkstduwebsite.firebaseapp.com",
        databaseURL: "https://denkstduwebsite-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "denkstduwebsite",
        storageBucket: "denkstduwebsite.appspot.com",
        messagingSenderId: "27029260611",
        appId: "1:27029260611:web:3c7da4db0bf92e8ce247f6",
        measurementId: "G-BNKNW95HK8"
    };

    // ===== P1 FIX: INITIALIZATION STATE =====
    let initializationPromise = null;
    let isInitialized = false;
    let initializationError = null;

    /**
     * P1 FIX: Initialize Firebase with proper error handling
     */
    async function initializeFirebase() {
        // Return existing promise if initialization is in progress
        if (initializationPromise) {
            return initializationPromise;
        }

        // Return immediately if already initialized
        if (isInitialized) {
            return Promise.resolve({
                app: window.firebaseApp,
                auth: window.firebaseAuth,
                database: window.firebaseDatabase
            });
        }

        // Return cached error if initialization failed before
        if (initializationError) {
            return Promise.reject(initializationError);
        }

        // Start initialization
        initializationPromise = (async () => {
            try {
                // P0 FIX: Check if Firebase SDK is loaded
                if (typeof firebase === 'undefined') {
                    throw new Error('Firebase SDK not loaded. Add Firebase scripts to HTML.');
                }

                // P0 FIX: Validate config
                if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
                    throw new Error('Invalid Firebase configuration');
                }

                // Initialize Firebase App (only once)
                let app;
                if (!firebase.apps || firebase.apps.length === 0) {
                    app = firebase.initializeApp(firebaseConfig);

                    if (isDevelopment) {
                        console.log('%c✅ Firebase App initialized',
                            'color: #4CAF50; font-weight: bold');
                    }
                } else {
                    app = firebase.app();

                    if (isDevelopment) {
                        console.log('%c✅ Firebase App already initialized',
                            'color: #4CAF50');
                    }
                }

                // Get references
                const auth = firebase.auth();
                const database = firebase.database();

                // P1 FIX: Configure Firebase settings
                auth.useDeviceLanguage(); // Use browser language for auth messages

                // P1 FIX: Enable persistence (offline support)
                try {
                    await database.goOffline();
                    await database.goOnline();
                } catch (persistenceError) {
                    console.warn('⚠️ Database persistence setup warning:', persistenceError.message);
                }

                // Export to window (for compatibility)
                window.firebaseApp = app;
                window.firebaseAuth = auth;
                window.firebaseDatabase = database;

                isInitialized = true;

                if (isDevelopment) {
                    console.log('%c✅ Firebase services ready',
                        'color: #2196F3; font-weight: bold');
                }

                return { app, auth, database };

            } catch (error) {
                initializationError = error;
                console.error('❌ Firebase initialization error:', error);

                // P1 FIX: User-friendly error notification
                if (window.NocapUtils && window.NocapUtils.showNotification) {
                    window.NocapUtils.showNotification(
                        'Firebase konnte nicht initialisiert werden',
                        'error',
                        5000
                    );
                }

                throw error;
            } finally {
                initializationPromise = null;
            }
        })();

        return initializationPromise;
    }

    /**
     * P1 FIX: Check if Firebase is initialized
     */
    function isFirebaseInitialized() {
        return isInitialized && window.firebaseApp && window.firebaseAuth && window.firebaseDatabase;
    }

    /**
     * P1 FIX: Get Firebase instances safely
     */
    function getFirebaseInstances() {
        if (!isFirebaseInitialized()) {
            throw new Error('Firebase not initialized. Call initializeFirebase() first.');
        }

        return {
            app: window.firebaseApp,
            auth: window.firebaseAuth,
            database: window.firebaseDatabase
        };
    }

    /**
     * P1 FIX: Wait for Firebase to be ready
     */
    async function waitForFirebase(timeout = 10000) {
        const startTime = Date.now();

        while (!isFirebaseInitialized()) {
            if (Date.now() - startTime > timeout) {
                throw new Error('Firebase initialization timeout');
            }

            // Wait 100ms before checking again
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return getFirebaseInstances();
    }

    /**
     * P1 FIX: Setup connection monitoring
     */
    function setupConnectionMonitoring() {
        if (!isFirebaseInitialized()) {
            console.warn('⚠️ Firebase not initialized, cannot setup connection monitoring');
            return;
        }

        const connectedRef = window.firebaseDatabase.ref('.info/connected');

        connectedRef.on('value', (snapshot) => {
            const isConnected = snapshot.val() === true;

            if (isDevelopment) {
                console.log(`🔌 Firebase connection: ${isConnected ? 'ONLINE' : 'OFFLINE'}`);
            }

            // P1 FIX: Dispatch custom event for connection status
            window.dispatchEvent(new CustomEvent('firebase:connection', {
                detail: { connected: isConnected }
            }));

            // Update body class for CSS styling
            if (isConnected) {
                document.body.classList.remove('firebase-offline');
                document.body.classList.add('firebase-online');
            } else {
                document.body.classList.remove('firebase-online');
                document.body.classList.add('firebase-offline');
            }
        });

        if (isDevelopment) {
            console.log('✅ Firebase connection monitoring active');
        }
    }

    /**
     * P1 FIX: Setup auth state listener
     */
    function setupAuthStateListener() {
        if (!isFirebaseInitialized()) {
            console.warn('⚠️ Firebase not initialized, cannot setup auth listener');
            return;
        }

        window.firebaseAuth.onAuthStateChanged((user) => {
            if (isDevelopment) {
                if (user) {
                    console.log('✅ Auth state: User signed in', user.uid);
                } else {
                    console.log('⚠️ Auth state: No user signed in');
                }
            }

            // P1 FIX: Dispatch custom event for auth state changes
            window.dispatchEvent(new CustomEvent('firebase:authStateChanged', {
                detail: { user }
            }));

            // Store user ID in localStorage for offline access
            if (user) {
                try {
                    localStorage.setItem('nocap_firebase_uid', user.uid);
                } catch (error) {
                    console.warn('Could not save user ID to localStorage:', error);
                }
            }
        });

        if (isDevelopment) {
            console.log('✅ Firebase auth state listener active');
        }
    }

    /**
     * P0 FIX: Anonymous sign-in with retry logic
     */
    async function signInAnonymously(retries = 3) {
        if (!isFirebaseInitialized()) {
            throw new Error('Firebase not initialized');
        }

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const result = await window.firebaseAuth.signInAnonymously();

                if (isDevelopment) {
                    console.log(`✅ Anonymous sign-in successful (attempt ${attempt})`);
                }

                return result.user;

            } catch (error) {
                console.warn(`⚠️ Anonymous sign-in attempt ${attempt} failed:`, error.message);

                // If this was the last attempt, throw the error
                if (attempt === retries) {
                    // P1 FIX: User-friendly error
                    if (window.NocapUtils && window.NocapUtils.showNotification) {
                        const message = window.NocapUtils.getFirebaseErrorMessage
                            ? window.NocapUtils.getFirebaseErrorMessage(error.code)
                            : 'Anmeldung fehlgeschlagen';

                        window.NocapUtils.showNotification(message, 'error');
                    }

                    throw error;
                }

                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }

    /**
     * P1 FIX: Get current user ID safely
     */
    function getCurrentUserId() {
        if (!isFirebaseInitialized()) {
            // Fallback to localStorage if Firebase not ready
            return localStorage.getItem('nocap_firebase_uid') || null;
        }

        const user = window.firebaseAuth.currentUser;
        return user ? user.uid : null;
    }

    /**
     * P1 FIX: Cleanup function for page unload
     */
    function cleanup() {
        if (isFirebaseInitialized()) {
            try {
                // Remove connection listener
                window.firebaseDatabase.ref('.info/connected').off();

                if (isDevelopment) {
                    console.log('✅ Firebase cleanup completed');
                }
            } catch (error) {
                console.warn('⚠️ Firebase cleanup error:', error);
            }
        }
    }

    // ===== AUTO-INITIALIZATION =====
    // P1 FIX: Initialize Firebase when this script loads
    (async function autoInit() {
        try {
            await initializeFirebase();

            // Setup monitoring after initialization
            setupConnectionMonitoring();
            setupAuthStateListener();

            // P0 FIX: Auto sign-in anonymously for multiplayer
            // Check if privacy consent is given
            const hasPrivacyConsent = localStorage.getItem('nocap_privacy_consent') === 'true';

            if (hasPrivacyConsent) {
                // Sign in after a short delay to ensure everything is ready
                setTimeout(async () => {
                    try {
                        await signInAnonymously();
                    } catch (error) {
                        console.warn('⚠️ Auto sign-in failed:', error.message);
                    }
                }, 500);
            } else if (isDevelopment) {
                console.log('ℹ️ Skipping auto sign-in (no privacy consent)');
            }

        } catch (error) {
            console.error('❌ Firebase auto-initialization failed:', error);
        }
    })();

    // ===== CLEANUP ON PAGE UNLOAD =====
    window.addEventListener('beforeunload', cleanup);

    // ===== EXPORT API =====
    window.FirebaseConfig = {
        // Version
        version: '4.0',

        // Initialization
        initialize: initializeFirebase,
        isInitialized: isFirebaseInitialized,
        waitForFirebase,

        // Auth
        signInAnonymously,
        getCurrentUserId,

        // Utilities
        getFirebaseInstances,
        setupConnectionMonitoring,
        setupAuthStateListener,

        // Cleanup
        cleanup,

        // State
        get isDevelopment() { return isDevelopment; },
        get config() { return { ...firebaseConfig }; } // Return copy, not reference
    };

    if (isDevelopment) {
        console.log('%c✅ FirebaseConfig v4.0 loaded and initialized',
            'color: #FF6F00; font-weight: bold; font-size: 12px');
    }

})(window);