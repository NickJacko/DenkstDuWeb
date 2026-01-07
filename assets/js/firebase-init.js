/**
 * Firebase Configuration Initializer
 * CSP-compliant external script - no inline code
 * Production-hardened with validation
 */

(function() {
    'use strict';

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

    // Validate config before exposing
    const requiredKeys = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
    const isValid = requiredKeys.every(key => config[key] && typeof config[key] === 'string');

    if (!isValid) {
        console.error('❌ Firebase config validation failed');
        return;
    }

    // Freeze config to prevent tampering
    window.FIREBASE_CONFIG = Object.freeze(config);

    // Production-safe logging
    if (!isProduction) {
        console.log('✅ Firebase Config initialized');
    }
})();

