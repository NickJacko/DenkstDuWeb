/**
 * NO-CAP Firebase Authentication Service
 * Version 4.0 - Full Audit Compliance & Production Ready
 *
 * AUDIT FIXES APPLIED:
 * ✅ P0: Strict email/password validation with XSS prevention
 * ✅ P0: All user data sanitized before storage
 * ✅ P0: Server-side validation warnings added
 * ✅ P1: Proper initialization with firebase-config.js
 * ✅ P1: Auth state listener cleanup
 * ✅ P1: Enhanced error handling
 * ✅ P2: GDPR compliance checks
 */

(function(window) {
    'use strict';

    class FirebaseAuthService {
        constructor() {
            // ===================================
            // 📊 STATE
            // ===================================

            this.currentUser = null;
            this.isAnonymous = false;
            this.isAuthenticated = false;
            this.initialized = false;

            // ===================================
            // 🔒 INTERNAL
            // ===================================

            // Auth state listener for cleanup
            this._authStateUnsubscribe = null;

            // Environment detection
            this._isDevelopment = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('192.168.');

            // Initialization promise (prevent multiple inits)
            this._initPromise = null;
        }

        // ===================================
        // 🚀 INITIALIZATION
        // ===================================

        /**
         * ✅ P1 FIX: Initialize with FirebaseConfig
         * @returns {Promise<boolean>} Success status
         */
        async initialize() {
            // Return existing promise if initialization in progress
            if (this._initPromise) {
                return this._initPromise;
            }

            // Return immediately if already initialized
            if (this.initialized) {
                return Promise.resolve(true);
            }

            // Start initialization
            this._initPromise = (async () => {
                try {
                    // ✅ P1 FIX: Check for FirebaseConfig
                    if (typeof window.FirebaseConfig === 'undefined') {
                        throw new Error('FirebaseConfig not loaded. Include firebase-config.js before firebase-auth.js');
                    }

                    // Wait for Firebase to be initialized
                    await window.FirebaseConfig.waitForFirebase(10000);

                    if (!window.FirebaseConfig.isInitialized()) {
                        throw new Error('FirebaseConfig not initialized');
                    }

                    // Get Firebase instances
                    const { auth } = window.FirebaseConfig.getFirebaseInstances();

                    // ✅ P1 FIX: Setup auth state observer with cleanup tracking
                    this._authStateUnsubscribe = auth.onAuthStateChanged((user) => {
                        this._handleAuthStateChange(user);
                    });

                    this.initialized = true;

                    if (this._isDevelopment) {
                        console.log('✅ FirebaseAuthService initialized');
                    }

                    return true;

                } catch (error) {
                    console.error('❌ FirebaseAuthService initialization failed:', error);
                    this.initialized = false;

                    // User-friendly error
                    if (window.NocapUtils && window.NocapUtils.showNotification) {
                        window.NocapUtils.showNotification(
                            'Authentifizierung konnte nicht gestartet werden',
                            'error'
                        );
                    }

                    return false;
                } finally {
                    this._initPromise = null;
                }
            })();

            return this._initPromise;
        }

        // ===================================
        // 👤 AUTH STATE MANAGEMENT
        // ===================================

        /**
         * ✅ P1 FIX: Handle auth state changes
         * @private
         * @param {Object|null} user - Firebase user object
         */
        _handleAuthStateChange(user) {
            if (user) {
                this.currentUser = user;
                this.isAnonymous = user.isAnonymous;
                this.isAuthenticated = true;

                if (this._isDevelopment) {
                    console.log('✅ User authenticated:', {
                        uid: user.uid.substring(0, 8) + '...',
                        isAnonymous: user.isAnonymous,
                        email: user.email
                    });
                }

                // ✅ P0 FIX: Save profile safely
                this._updateUserProfile(user);

                // Dispatch custom event
                window.dispatchEvent(new CustomEvent('nocap:authStateChanged', {
                    detail: { user, isAnonymous: user.isAnonymous }
                }));

            } else {
                this.currentUser = null;
                this.isAnonymous = false;
                this.isAuthenticated = false;

                if (this._isDevelopment) {
                    console.log('⚠️ No user authenticated');
                }

                // Clear stored profile
                this._clearUserProfile();

                // Dispatch custom event
                window.dispatchEvent(new CustomEvent('nocap:authStateChanged', {
                    detail: { user: null, isAnonymous: false }
                }));
            }
        }

        // ===================================
        // 🔐 AUTHENTICATION METHODS
        // ===================================

        /**
         * Sign in anonymously
         * @returns {Promise<Object>} Result object
         */
        async signInAnonymously() {
            try {
                if (!this.initialized) {
                    await this.initialize();
                }

                // Check if already authenticated
                if (this.isAuthenticated && !this.isAnonymous) {
                    if (this._isDevelopment) {
                        console.log('ℹ️ User already signed in (non-anonymous)');
                    }
                    return {
                        success: true,
                        userId: this.currentUser.uid,
                        isAnonymous: false,
                        alreadySignedIn: true
                    };
                }

                const { auth } = window.FirebaseConfig.getFirebaseInstances();
                const userCredential = await auth.signInAnonymously();

                if (this._isDevelopment) {
                    console.log('✅ Anonymous sign-in successful:',
                        userCredential.user.uid.substring(0, 8) + '...');
                }

                return {
                    success: true,
                    userId: userCredential.user.uid,
                    isAnonymous: true
                };

            } catch (error) {
                console.error('❌ Anonymous sign-in failed:', error);

                // User-friendly error
                if (window.NocapUtils && window.NocapUtils.showNotification) {
                    const message = this.getErrorMessage(error.code);
                    window.NocapUtils.showNotification(message, 'error');
                }

                return {
                    success: false,
                    error: this.getErrorMessage(error.code)
                };
            }
        }

        /**
         * ✅ P0 FIX: Create account with email/password
         * @param {string} email - Email address
         * @param {string} password - Password
         * @returns {Promise<Object>} Result object
         */
        async createAccountWithEmail(email, password) {
            try {
                if (!this.initialized) {
                    await this.initialize();
                }

                // ✅ P0 FIX: Strict input validation
                const emailValidation = this.validateEmail(email);
                if (!emailValidation.valid) {
                    return {
                        success: false,
                        error: emailValidation.message
                    };
                }

                const passwordValidation = this.validatePassword(password);
                if (!passwordValidation.valid) {
                    return {
                        success: false,
                        error: passwordValidation.message
                    };
                }

                const { auth } = window.FirebaseConfig.getFirebaseInstances();

                // ✅ P0 FIX: Sanitize email before using
                const sanitizedEmail = emailValidation.email;

                // Upgrade anonymous account if applicable
                if (this.isAnonymous && this.currentUser) {
                    const credential = firebase.auth.EmailAuthProvider.credential(
                        sanitizedEmail,
                        password
                    );
                    const userCredential = await this.currentUser.linkWithCredential(credential);

                    if (this._isDevelopment) {
                        console.log('✅ Anonymous account upgraded:',
                            userCredential.user.uid.substring(0, 8) + '...');
                    }

                    // Success notification
                    if (window.NocapUtils) {
                        window.NocapUtils.showNotification(
                            'Account erfolgreich erstellt!',
                            'success'
                        );
                    }

                    return {
                        success: true,
                        userId: userCredential.user.uid,
                        upgraded: true
                    };

                } else {
                    // Create new account
                    const userCredential = await auth.createUserWithEmailAndPassword(
                        sanitizedEmail,
                        password
                    );

                    if (this._isDevelopment) {
                        console.log('✅ New account created:',
                            userCredential.user.uid.substring(0, 8) + '...');
                    }

                    // Success notification
                    if (window.NocapUtils) {
                        window.NocapUtils.showNotification(
                            'Account erfolgreich erstellt!',
                            'success'
                        );
                    }

                    return {
                        success: true,
                        userId: userCredential.user.uid,
                        upgraded: false
                    };
                }

            } catch (error) {
                console.error('❌ Account creation failed:', error);

                const errorMessage = this.getErrorMessage(error.code);

                // User-friendly error
                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(errorMessage, 'error');
                }

                return {
                    success: false,
                    error: errorMessage
                };
            }
        }

        /**
         * ✅ P0 FIX: Sign in with email/password
         * @param {string} email - Email address
         * @param {string} password - Password
         * @returns {Promise<Object>} Result object
         */
        async signInWithEmail(email, password) {
            try {
                if (!this.initialized) {
                    await this.initialize();
                }

                // ✅ P0 FIX: Strict input validation
                const emailValidation = this.validateEmail(email);
                if (!emailValidation.valid) {
                    return {
                        success: false,
                        error: emailValidation.message
                    };
                }

                if (!password || password.length === 0) {
                    return {
                        success: false,
                        error: 'Passwort erforderlich'
                    };
                }

                const { auth } = window.FirebaseConfig.getFirebaseInstances();

                // ✅ P0 FIX: Use validated email
                const sanitizedEmail = emailValidation.email;

                const userCredential = await auth.signInWithEmailAndPassword(
                    sanitizedEmail,
                    password
                );

                if (this._isDevelopment) {
                    console.log('✅ Email sign-in successful:',
                        userCredential.user.uid.substring(0, 8) + '...');
                }

                // Success notification
                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(
                        'Erfolgreich angemeldet!',
                        'success',
                        2000
                    );
                }

                return {
                    success: true,
                    userId: userCredential.user.uid
                };

            } catch (error) {
                console.error('❌ Email sign-in failed:', error);

                const errorMessage = this.getErrorMessage(error.code);

                // User-friendly error
                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(errorMessage, 'error');
                }

                return {
                    success: false,
                    error: errorMessage
                };
            }
        }

        /**
         * Sign in with Google
         * @returns {Promise<Object>} Result object
         */
        async signInWithGoogle() {
            try {
                if (!this.initialized) {
                    await this.initialize();
                }

                const { auth } = window.FirebaseConfig.getFirebaseInstances();
                const provider = new firebase.auth.GoogleAuthProvider();

                // Upgrade anonymous account if applicable
                if (this.isAnonymous && this.currentUser) {
                    const userCredential = await this.currentUser.linkWithPopup(provider);

                    if (this._isDevelopment) {
                        console.log('✅ Anonymous account upgraded with Google:',
                            userCredential.user.uid.substring(0, 8) + '...');
                    }

                    // Success notification
                    if (window.NocapUtils) {
                        window.NocapUtils.showNotification(
                            'Mit Google angemeldet!',
                            'success',
                            2000
                        );
                    }

                    return {
                        success: true,
                        userId: userCredential.user.uid,
                        upgraded: true
                    };

                } else {
                    const userCredential = await auth.signInWithPopup(provider);

                    if (this._isDevelopment) {
                        console.log('✅ Google sign-in successful:',
                            userCredential.user.uid.substring(0, 8) + '...');
                    }

                    // Success notification
                    if (window.NocapUtils) {
                        window.NocapUtils.showNotification(
                            'Mit Google angemeldet!',
                            'success',
                            2000
                        );
                    }

                    return {
                        success: true,
                        userId: userCredential.user.uid
                    };
                }

            } catch (error) {
                console.error('❌ Google sign-in failed:', error);

                const errorMessage = this.getErrorMessage(error.code);

                // User-friendly error (nur wenn nicht abgebrochen)
                if (error.code !== 'auth/popup-closed-by-user' &&
                    error.code !== 'auth/cancelled-popup-request') {
                    if (window.NocapUtils) {
                        window.NocapUtils.showNotification(errorMessage, 'error');
                    }
                }

                return {
                    success: false,
                    error: errorMessage
                };
            }
        }

        /**
         * Sign out current user
         * @returns {Promise<Object>} Result object
         */
        async signOut() {
            try {
                if (!this.initialized) {
                    throw new Error('Service not initialized');
                }

                const { auth } = window.FirebaseConfig.getFirebaseInstances();
                await auth.signOut();

                if (this._isDevelopment) {
                    console.log('✅ Sign-out successful');
                }

                // Success notification
                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(
                        'Erfolgreich abgemeldet',
                        'success',
                        2000
                    );
                }

                return { success: true };

            } catch (error) {
                console.error('❌ Sign-out failed:', error);

                // User-friendly error
                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(
                        'Abmeldung fehlgeschlagen',
                        'error'
                    );
                }

                return {
                    success: false,
                    error: error.message
                };
            }
        }

        // ===================================
        // 💾 USER PROFILE MANAGEMENT
        // ===================================

        /**
         * ✅ P0 FIX: Safe user profile update
         * @private
         * @param {Object} user - Firebase user object
         */
        _updateUserProfile(user) {
            try {
                // ✅ P0 FIX: Sanitize all user data before storing
                const profile = {
                    userId: user.uid,
                    email: user.email ? this._sanitizeEmail(user.email) : null,
                    displayName: user.displayName ? this._sanitizeString(user.displayName) : null,
                    isAnonymous: user.isAnonymous === true,
                    createdAt: user.metadata.creationTime,
                    lastSignIn: user.metadata.lastSignInTime,
                    timestamp: Date.now()
                };

                // Use safe localStorage helper
                if (window.NocapUtils && window.NocapUtils.setLocalStorage) {
                    window.NocapUtils.setLocalStorage('nocap_user_auth', profile);
                } else {
                    localStorage.setItem('nocap_user_auth', JSON.stringify(profile));
                }

                // ✅ P0 WARNING: Only save to database for non-anonymous users with consent
                if (!user.isAnonymous && this._hasPrivacyConsent()) {
                    this._saveUserToDatabase(profile);
                }

            } catch (error) {
                console.error('❌ Failed to update user profile:', error);
            }
        }

        /**
         * Clear user profile from storage
         * @private
         */
        _clearUserProfile() {
            try {
                if (window.NocapUtils && window.NocapUtils.removeLocalStorage) {
                    window.NocapUtils.removeLocalStorage('nocap_user_auth');
                } else {
                    localStorage.removeItem('nocap_user_auth');
                }
            } catch (error) {
                console.error('❌ Failed to clear user profile:', error);
            }
        }

        /**
         * ✅ P0 WARNING: Save user to database (SERVER-SIDE VALIDATION REQUIRED)
         * @private
         * @param {Object} profile - User profile object
         */
        async _saveUserToDatabase(profile) {
            try {
                // ✅ P0 FIX: Validation
                if (!profile.userId) {
                    throw new Error('userId is required');
                }

                if (profile.email) {
                    const emailValidation = this.validateEmail(profile.email);
                    if (!emailValidation.valid) {
                        throw new Error('Invalid email format');
                    }
                }

                const { database } = window.FirebaseConfig.getFirebaseInstances();
                const userRef = database.ref(`users/${profile.userId}`);

                // ✅ P0 FIX: Only store necessary data
                await userRef.update({
                    email: profile.email || null,
                    displayName: profile.displayName || null,
                    isAnonymous: profile.isAnonymous === true,
                    createdAt: profile.createdAt,
                    lastSignIn: profile.lastSignIn,
                    ageVerified: this._getAgeVerification(),
                    lastUpdate: firebase.database.ServerValue.TIMESTAMP
                });

                if (this._isDevelopment) {
                    console.log('✅ User profile saved to database');
                }

            } catch (error) {
                console.error('❌ Failed to save user to database:', error);
            }
        }

        // ===================================
        // ✅ PRIVACY & COMPLIANCE
        // ===================================

        /**
         * Check if user has given privacy consent
         * @private
         * @returns {boolean} Consent status
         */
        _hasPrivacyConsent() {
            try {
                return localStorage.getItem('nocap_privacy_consent') === 'true';
            } catch (error) {
                return false;
            }
        }

        /**
         * ✅ P0 FIX: Safe age verification check
         * @private
         * @returns {boolean} Age verification status
         */
        _getAgeVerification() {
            try {
                const ageLevel = parseInt(localStorage.getItem('nocap_age_level'), 10);
                return !isNaN(ageLevel) && ageLevel >= 18;
            } catch (error) {
                console.error('Error reading age verification:', error);
                return false;
            }
        }

        // ===================================
        // ✅ P0 FIX: VALIDATION HELPERS
        // ===================================

        /**
         * ✅ P0 FIX: Strict email validation
         * @param {string} email - Email to validate
         * @returns {Object} Validation result
         */
        validateEmail(email) {
            if (!email || typeof email !== 'string') {
                return { valid: false, message: 'E-Mail-Adresse erforderlich' };
            }

            const trimmed = email.trim().toLowerCase();

            if (trimmed.length === 0) {
                return { valid: false, message: 'E-Mail-Adresse erforderlich' };
            }

            if (trimmed.length > 254) {
                return { valid: false, message: 'E-Mail-Adresse zu lang' };
            }

            // ✅ P0 FIX: Strict email regex (RFC 5322 simplified)
            const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

            if (!emailRegex.test(trimmed)) {
                return { valid: false, message: 'Ungültige E-Mail-Adresse' };
            }

            // ✅ P0 FIX: Block dangerous patterns (XSS prevention)
            if (/[<>'"`;(){}[\]\\]/.test(trimmed)) {
                return { valid: false, message: 'E-Mail enthält ungültige Zeichen' };
            }

            // ✅ P0 FIX: Block script injection attempts
            if (/javascript:|data:|vbscript:/gi.test(trimmed)) {
                return { valid: false, message: 'E-Mail enthält ungültiges Format' };
            }

            return { valid: true, email: trimmed };
        }

        /**
         * ✅ P0 FIX: Strict password validation
         * @param {string} password - Password to validate
         * @returns {Object} Validation result
         */
        validatePassword(password) {
            if (!password || typeof password !== 'string') {
                return { valid: false, message: 'Passwort erforderlich' };
            }

            if (password.length < 6) {
                return {
                    valid: false,
                    message: 'Passwort muss mindestens 6 Zeichen haben'
                };
            }

            if (password.length > 128) {
                return {
                    valid: false,
                    message: 'Passwort zu lang (max. 128 Zeichen)'
                };
            }

            // Check for common weak passwords
            const weakPasswords = ['123456', 'password', '12345678', 'qwerty', 'abc123', 'password123'];
            if (weakPasswords.includes(password.toLowerCase())) {
                return {
                    valid: false,
                    message: 'Passwort ist zu schwach. Wähle ein sichereres Passwort.'
                };
            }

            return { valid: true };
        }

        /**
         * ✅ P0 FIX: Sanitize string value
         * @private
         * @param {string} value - Value to sanitize
         * @returns {string} Sanitized string
         */
        _sanitizeString(value) {
            if (!value || typeof value !== 'string') {
                return '';
            }

            if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
                return window.NocapUtils.sanitizeInput(value);
            }

            // Fallback sanitization
            return value
                .replace(/[<>&"'`]/g, '')
                .replace(/javascript:/gi, '')
                .trim()
                .substring(0, 200);
        }

        /**
         * ✅ P0 FIX: Sanitize email value
         * @private
         * @param {string} email - Email to sanitize
         * @returns {string} Sanitized email
         */
        _sanitizeEmail(email) {
            const validation = this.validateEmail(email);
            return validation.valid ? validation.email : '';
        }

        // ===================================
        // 📊 STATUS CHECKS
        // ===================================

        /**
         * Check if service is initialized
         * @returns {boolean} Initialization status
         */
        isInitialized() {
            return this.initialized;
        }

        /**
         * Get current user ID
         * @returns {string|null} User ID or null
         */
        getUserId() {
            return this.currentUser ? this.currentUser.uid : null;
        }

        /**
         * Check if current user is anonymous
         * @returns {boolean} Anonymous status
         */
        isUserAnonymous() {
            return this.isAnonymous;
        }

        /**
         * Check if user is authenticated
         * @returns {boolean} Authentication status
         */
        isUserAuthenticated() {
            return this.isAuthenticated;
        }

        /**
         * Get current user object
         * @returns {Object|null} Firebase user object
         */
        getCurrentUser() {
            return this.currentUser;
        }

        /**
         * Get user display name (sanitized)
         * @returns {string|null} Display name
         */
        getUserDisplayName() {
            if (!this.currentUser) return null;

            const name = this.currentUser.displayName ||
                this.currentUser.email ||
                'Anonymer Spieler';

            return this._sanitizeString(name);
        }

        /**
         * ⚠️ Check if user has premium status
         * WARNING: This MUST be validated server-side!
         * @returns {boolean} Premium status (client-side only)
         */
        isPremiumUser() {
            // ⚠️ P0 WARNING: Client-side check is NOT authoritative
            // This MUST be validated server-side via custom claims or database
            if (!this.isAuthenticated || this.isAnonymous) {
                return false;
            }

            // TODO: Check custom claims or database for actual premium status
            // For now, always return false until server-side validation is implemented
            return false;
        }

        // ===================================
        // 🚨 ERROR HANDLING
        // ===================================

        /**
         * Get user-friendly error message
         * @param {string} errorCode - Firebase error code
         * @returns {string} Error message
         */
        getErrorMessage(errorCode) {
            const errors = {
                'auth/email-already-in-use': 'Diese E-Mail wird bereits verwendet',
                'auth/invalid-email': 'Ungültige E-Mail-Adresse',
                'auth/operation-not-allowed': 'Diese Operation ist nicht erlaubt',
                'auth/weak-password': 'Das Passwort ist zu schwach (mind. 6 Zeichen)',
                'auth/user-disabled': 'Dieser Account wurde deaktiviert',
                'auth/user-not-found': 'Kein Account mit dieser E-Mail gefunden',
                'auth/wrong-password': 'Falsches Passwort',
                'auth/popup-closed-by-user': 'Login-Fenster wurde geschlossen',
                'auth/cancelled-popup-request': 'Login wurde abgebrochen',
                'auth/credential-already-in-use': 'Diese Anmeldedaten werden bereits verwendet',
                'auth/invalid-credential': 'Ungültige Anmeldedaten',
                'auth/network-request-failed': 'Netzwerkfehler - Prüfe deine Internetverbindung',
                'auth/too-many-requests': 'Zu viele Anfragen. Bitte warte kurz.',
                'auth/requires-recent-login': 'Diese Aktion erfordert eine erneute Anmeldung',
                'auth/timeout': 'Zeitüberschreitung - Versuche es erneut'
            };

            return errors[errorCode] || 'Ein Fehler ist aufgetreten';
        }

        // ===================================
        // 🧹 CLEANUP
        // ===================================

        /**
         * Cleanup resources and listeners
         */
        cleanup() {
            // Remove auth state listener
            if (this._authStateUnsubscribe) {
                this._authStateUnsubscribe();
                this._authStateUnsubscribe = null;
            }

            // Reset state
            this.currentUser = null;
            this.isAnonymous = false;
            this.isAuthenticated = false;
            this.initialized = false;
            this._initPromise = null;

            if (this._isDevelopment) {
                console.log('✅ FirebaseAuthService cleanup completed');
            }
        }
    }

    // ===================================
    // 📤 SINGLETON INSTANCE & EXPORT
    // ===================================

    // Create singleton instance
    if (typeof window.authService === 'undefined') {
        window.authService = new FirebaseAuthService();

        // Auto-initialize when firebase-config is ready
        if (window.FirebaseConfig && window.FirebaseConfig.isInitialized()) {
            window.authService.initialize().catch(err => {
                console.error('Auto-initialization failed:', err);
            });
        } else {
            // Wait for firebase:connection event
            const initHandler = async (event) => {
                if (event.detail.connected && !window.authService.isInitialized()) {
                    await window.authService.initialize();
                }
            };

            window.addEventListener('firebase:connection', initHandler, { once: true });
        }

        // Development logging
        if (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname.includes('192.168.')) {

            console.log(
                '%c✅ FirebaseAuthService v4.0 loaded',
                'color: #FF6F00; font-weight: bold; font-size: 12px; padding: 4px 8px; background: #FFF3E0; border-radius: 4px;'
            );
        }
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (window.authService) {
            window.authService.cleanup();
        }
    });

    // Export class
    window.FirebaseAuthService = FirebaseAuthService;

})(window);