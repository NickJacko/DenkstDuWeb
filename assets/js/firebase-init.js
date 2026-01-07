/**
 * Firebase Configuration Initializer
 * CSP-compliant external script - no inline code
 * Production-hardened with validation
 */

(function() {
    'use strict';

    // Wait for Firebase SDK to be loaded
    function waitForFirebase(callback, timeout = 10000) {
        const startTime = Date.now();

        const check = () => {
            if (typeof firebase !== 'undefined' && firebase.initializeApp) {
                callback();
            } else if (Date.now() - startTime < timeout) {
                setTimeout(check, 50);
            } else {
                console.error('❌ Firebase SDK timeout - not loaded');
            }
        };

        check();
    }

    waitForFirebase(() => {
        // Environment detection
        const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');

        // Firebase Config für denkstduwebsite
        const config = {
            apiKey: "AIzaSyC_cu_2X2uFCPcxYetxIUHi2v56F1Mz0Vk",
            authDomain: "denkstduwebsite.firebaseapp.com",
            databaseURL: "https://denkstduwebsite-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "denkstduwebsite",
            storageBucket: "denkstduwebsite.appspot.com",
            messagingSenderId: "27029260611",
            appId: "1:27029260611:web:3c7da4db0bf92e8ce247f6",
            measurementId: "G-BNKNW95HK8"
        };

        // Validate config before initializing
        const requiredKeys = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
        const isValid = requiredKeys.every(key => config[key] && typeof config[key] === 'string');

        if (!isValid) {
            console.error('❌ Firebase config validation failed');
            return;
        }

        // Initialize Firebase if not already initialized
        try {
            if (!firebase.apps || firebase.apps.length === 0) {
                firebase.initializeApp(config);

                // Sign in anonymously immediately
                firebase.auth().signInAnonymously().then(() => {
                    if (!isProduction) {
                        console.log('✅ Firebase initialized & signed in anonymously');
                    }
                }).catch(err => {
                    console.warn('⚠️ Anonymous sign-in failed:', err.message);
                });
            } else {
                if (!isProduction) {
                    console.log('✅ Firebase already initialized');
                }
            }

            // Freeze config to prevent tampering
            window.FIREBASE_CONFIG = Object.freeze(config);

        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
        }
    });
})();

