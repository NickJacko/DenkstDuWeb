/**
 * No-Cap Firebase Configuration & Initialization
 * Version 3.0 - Minimal Bootstrap
 *
 * This file ONLY initializes Firebase SDK
 * All game operations are in firebase-service.js
 */

'use strict';

// ===== FIREBASE CONFIG =====
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

// ===== INITIALIZE FIREBASE =====
try {
    if (typeof firebase === 'undefined') {
        throw new Error('Firebase SDK not loaded');
    }

    // Initialize Firebase App
    if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase App initialized');
    } else {
        console.log('✅ Firebase App already initialized');
    }

    // Sign in anonymously
    firebase.auth().signInAnonymously().then(() => {
        console.log('✅ Firebase Auth: Anonymous sign-in successful');
    }).catch((error) => {
        console.warn('⚠️ Firebase Auth error:', error.message);
    });

} catch (error) {
    console.error('❌ Firebase initialization error:', error);
}

// Export globals for compatibility
window.firebaseApp = firebase.app();
window.firebaseAuth = firebase.auth();
window.firebaseDatabase = firebase.database();

console.log('✅ Firebase configuration loaded');