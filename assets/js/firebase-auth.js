// firebase-auth.js
// Firebase Authentication Service für No-Cap
// Version 3.0 - Audit-Fixed & Security Hardened

(function(window) {
    'use strict';

    class FirebaseAuthService {
        constructor() {
            this.currentUser = null;
            this.isAnonymous = false;
            this.isAuthenticated = false;
            this.initialized = false;

            // P1 FIX: Track auth state listener for cleanup
            this._authStateUnsubscribe = null;

            // P1 FIX: Environment detection
            this.isDevelopment = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('192.168.');
        }

        // ===== P1 FIX: INITIALIZE WITH FIREBASE-CONFIG =====
        async initialize() {
            try {
                // P1 FIX: Wait for FirebaseConfig to be ready
                if (typeof window.FirebaseConfig === 'undefined') {
                    throw new Error('FirebaseConfig not loaded. Include firebase-config.js before firebase-auth.js');
                }

                // Wait for Firebase to be initialized
                await window.FirebaseConfig.waitForFirebase();

                // Get Firebase instances
                const { auth } = window.FirebaseConfig.getFirebaseInstances();

                // P1 FIX: Setup auth state observer with cleanup tracking
                this._authStateUnsubscribe = auth.onAuthStateChanged((user) => {
                    this._handleAuthStateChange(user);
                });

                this.initialized = true;

                if (this.isDevelopment) {
                    console.log('✅ FirebaseAuthService initialized');
                }

                return true;

            } catch (error) {
                console.error('❌ FirebaseAuthService initialization failed:', error);
                this.initialized = false;

                // P1 FIX: User-friendly error
                if (window.NocapUtils && window.NocapUtils.showNotification) {
                    window.NocapUtils.showNotification(
                        'Authentifizierung konnte nicht gestartet werden',
                        'error'
                    );
                }

                return false;
            }
        }

        // ===== P1 FIX: HANDLE AUTH STATE CHANGES =====
        _handleAuthStateChange(user) {
            if (user) {
                this.currentUser = user;
                this.isAnonymous = user.isAnonymous;
                this.isAuthenticated = true;

                if (this.isDevelopment) {
                    console.log('✅ User authenticated:', {
                        uid: user.uid.substring(0, 8) + '...',
                        isAnonymous: user.isAnonymous,
                        email: user.email
                    });
                }

                // P1 FIX: Save profile safely
                this._updateUserProfile(user);

                // P1 FIX: Dispatch custom event
                window.dispatchEvent(new CustomEvent('nocap:authStateChanged', {
                    detail: { user, isAnonymous: user.isAnonymous }
                }));

            } else {
                this.currentUser = null;
                this.isAnonymous = false;
                this.isAuthenticated = false;

                if (this.isDevelopment) {
                    console.log('⚠️ No user authenticated');
                }

                // P1 FIX: Clear stored profile
                this._clearUserProfile();

                // P1 FIX: Dispatch custom event
                window.dispatchEvent(new CustomEvent('nocap:authStateChanged', {
                    detail: { user: null, isAnonymous: false }
                }));
            }
        }

        // ===== OPTION 1: ANONYMOUS LOGIN =====
        async signInAnonymously() {
            try {
                if (!this.initialized) {
                    throw new Error('Service not initialized');
                }

                // P1 FIX: Check if already authenticated
                if (this.isAuthenticated && !this.isAnonymous) {
                    if (this.isDevelopment) {
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

                if (this.isDevelopment) {
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

                // P1 FIX: User-friendly error
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

        // ===== OPTION 2: EMAIL/PASSWORD REGISTRATION =====
        async createAccountWithEmail(email, password) {
            try {
                if (!this.initialized) {
                    throw new Error('Service not initialized');
                }

                // P0 FIX: Strict input validation
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

                // P0 FIX: Sanitize email before using
                const sanitizedEmail = window.NocapUtils
                    ? window.NocapUtils.sanitizeInput(email.toLowerCase().trim())
                    : email.toLowerCase().trim();

                // Upgrade anonymous account if applicable
                if (this.isAnonymous && this.currentUser) {
                    const credential = auth.EmailAuthProvider.credential(
                        sanitizedEmail,
                        password
                    );
                    const userCredential = await this.currentUser.linkWithCredential(credential);

                    if (this.isDevelopment) {
                        console.log('✅ Anonymous account upgraded:',
                            userCredential.user.uid.substring(0, 8) + '...');
                    }

                    // P1 FIX: Success notification
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

                    if (this.isDevelopment) {
                        console.log('✅ New account created:',
                            userCredential.user.uid.substring(0, 8) + '...');
                    }

                    // P1 FIX: Success notification
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

                // P1 FIX: User-friendly error
                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(errorMessage, 'error');
                }

                return {
                    success: false,
                    error: errorMessage
                };
            }
        }

        // ===== OPTION 3: EMAIL/PASSWORD LOGIN =====
        async signInWithEmail(email, password) {
            try {
                if (!this.initialized) {
                    throw new Error('Service not initialized');
                }

                // P0 FIX: Strict input validation
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

                // P0 FIX: Sanitize email before using
                const sanitizedEmail = window.NocapUtils
                    ? window.NocapUtils.sanitizeInput(email.toLowerCase().trim())
                    : email.toLowerCase().trim();

                const userCredential = await auth.signInWithEmailAndPassword(
                    sanitizedEmail,
                    password
                );

                if (this.isDevelopment) {
                    console.log('✅ Email sign-in successful:',
                        userCredential.user.uid.substring(0, 8) + '...');
                }

                // P1 FIX: Success notification
                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(
                        'Erfolgreich angemeldet!',
                        'success'
                    );
                }

                return {
                    success: true,
                    userId: userCredential.user.uid
                };

            } catch (error) {
                console.error('❌ Email sign-in failed:', error);

                const errorMessage = this.getErrorMessage(error.code);

                // P1 FIX: User-friendly error
                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(errorMessage, 'error');
                }

                return {
                    success: false,
                    error: errorMessage
                };
            }
        }

        // ===== OPTION 4: GOOGLE LOGIN =====
        async signInWithGoogle() {
            try {
                if (!this.initialized) {
                    throw new Error('Service not initialized');
                }

                const { auth } = window.FirebaseConfig.getFirebaseInstances();
                const provider = new auth.GoogleAuthProvider();

                // Upgrade anonymous account if applicable
                if (this.isAnonymous && this.currentUser) {
                    const userCredential = await this.currentUser.linkWithPopup(provider);

                    if (this.isDevelopment) {
                        console.log('✅ Anonymous account upgraded with Google:',
                            userCredential.user.uid.substring(0, 8) + '...');
                    }

                    // P1 FIX: Success notification
                    if (window.NocapUtils) {
                        window.NocapUtils.showNotification(
                            'Mit Google angemeldet!',
                            'success'
                        );
                    }

                    return {
                        success: true,
                        userId: userCredential.user.uid,
                        upgraded: true
                    };

                } else {
                    const userCredential = await auth.signInWithPopup(provider);

                    if (this.isDevelopment) {
                        console.log('✅ Google sign-in successful:',
                            userCredential.user.uid.substring(0, 8) + '...');
                    }

                    // P1 FIX: Success notification
                    if (window.NocapUtils) {
                        window.NocapUtils.showNotification(
                            'Mit Google angemeldet!',
                            'success'
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

                // P1 FIX: User-friendly error (nur wenn nicht abgebrochen)
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

        // ===== LOGOUT =====
        async signOut() {
            try {
                if (!this.initialized) {
                    throw new Error('Service not initialized');
                }

                const { auth } = window.FirebaseConfig.getFirebaseInstances();
                await auth.signOut();

                if (this.isDevelopment) {
                    console.log('✅ Sign-out successful');
                }

                // P1 FIX: Success notification
                if (window.NocapUtils) {
                    window.NocapUtils.showNotification(
                        'Erfolgreich abgemeldet',
                        'success'
                    );
                }

                return { success: true };

            } catch (error) {
                console.error('❌ Sign-out failed:', error);

                // P1 FIX: User-friendly error
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

        // ===== P0 FIX: SAFE USER PROFILE UPDATE =====
        _updateUserProfile(user) {
            try {
                // P0 FIX: Sanitize all user data before storing
                const profile = {
                    userId: user.uid,
                    email: user.email ? (window.NocapUtils ? window.NocapUtils.sanitizeInput(user.email) : user.email) : null,
                    isAnonymous: user.isAnonymous === true,
                    createdAt: user.metadata.creationTime,
                    lastSignIn: user.metadata.lastSignInTime,
                    timestamp: Date.now()
                };

                // P0 FIX: Use safe localStorage helper
                if (window.NocapUtils && window.NocapUtils.setLocalStorage) {
                    window.NocapUtils.setLocalStorage('nocap_user_auth', profile);
                } else {
                    localStorage.setItem('nocap_user_auth', JSON.stringify(profile));
                }

                // P0 FIX: Only save to database for non-anonymous users with consent
                if (!user.isAnonymous && this._hasPrivacyConsent()) {
                    this._saveUserToDatabase(profile);
                }

            } catch (error) {
                console.error('❌ Failed to update user profile:', error);
            }
        }

        // ===== P1 FIX: CLEAR USER PROFILE =====
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

        // ===== P0 FIX: SAVE USER TO DATABASE (SERVER-SIDE VALIDATION NEEDED) =====
        async _saveUserToDatabase(profile) {
            try {
                // P0 FIX: Validation
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

                // P0 FIX: Only store necessary data
                await userRef.set({
                    email: profile.email || null,
                    isAnonymous: profile.isAnonymous === true,
                    createdAt: profile.createdAt,
                    lastSignIn: profile.lastSignIn,
                    ageVerified: this._getAgeVerification(),
                    lastUpdate: firebase.database.ServerValue.TIMESTAMP
                }, { merge: true });

                if (this.isDevelopment) {
                    console.log('✅ User profile saved to database');
                }

            } catch (error) {
                console.error('❌ Failed to save user to database:', error);
            }
        }

        // ===== P1 FIX: CHECK PRIVACY CONSENT =====
        _hasPrivacyConsent() {
            try {
                return localStorage.getItem('nocap_privacy_consent') === 'true';
            } catch (error) {
                return false;
            }
        }

        // ===== P0 FIX: SAFE AGE VERIFICATION =====
        _getAgeVerification() {
            try {
                const ageLevel = parseInt(localStorage.getItem('nocap_age_level'), 10);
                return !isNaN(ageLevel) && ageLevel >= 18;
            } catch (error) {
                console.error('Error reading age verification:', error);
                return false;
            }
        }

        // ===== P0 FIX: STRICT EMAIL VALIDATION =====
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

            // P0 FIX: Strict email regex
            const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

            if (!emailRegex.test(trimmed)) {
                return { valid: false, message: 'Ungültige E-Mail-Adresse' };
            }

            // P0 FIX: Block dangerous patterns
            if (/[<>'"`;(){}[\]\\]/.test(trimmed)) {
                return { valid: false, message: 'E-Mail enthält ungültige Zeichen' };
            }

            return { valid: true, email: trimmed };
        }

        // ===== P0 FIX: STRICT PASSWORD VALIDATION =====
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

            // P1 FIX: Check for common weak passwords
            const weakPasswords = ['123456', 'password', '12345678', 'qwerty', 'abc123'];
            if (weakPasswords.includes(password.toLowerCase())) {
                return {
                    valid: false,
                    message: 'Passwort ist zu schwach. Wähle ein sichereres Passwort.'
                };
            }

            return { valid: true };
        }

        // ===== STATUS CHECKS =====

        isInitialized() {
            return this.initialized;
        }

        getUserId() {
            return this.currentUser ? this.currentUser.uid : null;
        }

        isUserAnonymous() {
            return this.isAnonymous;
        }

        isUserAuthenticated() {
            return this.isAuthenticated;
        }

        getCurrentUser() {
            return this.currentUser;
        }

        getUserDisplayName() {
            if (!this.currentUser) return null;

            // P0 FIX: Sanitize display name
            const name = this.currentUser.displayName ||
                this.currentUser.email ||
                'Anonymer Spieler';

            return window.NocapUtils
                ? window.NocapUtils.sanitizeInput(name)
                : name;
        }

        // P1 FIX: Check if user has premium status
        isPremiumUser() {
            // P0 WARNING: This MUST be validated server-side!
            // Client-side check is NOT authoritative
            if (!this.isAuthenticated || this.isAnonymous) {
                return false;
            }

            // TODO: Check custom claims or database for actual premium status
            return false;
        }

        // ===== ERROR MESSAGES =====

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
                'auth/requires-recent-login': 'Diese Aktion erfordert eine erneute Anmeldung'
            };

            return errors[errorCode] || 'Ein Fehler ist aufgetreten';
        }

        // ===== P1 FIX: CLEANUP =====
        cleanup() {
            if (this._authStateUnsubscribe) {
                this._authStateUnsubscribe();
                this._authStateUnsubscribe = null;
            }

            this.currentUser = null;
            this.isAnonymous = false;
            this.isAuthenticated = false;
            this.initialized = false;

            if (this.isDevelopment) {
                console.log('✅ FirebaseAuthService cleanup completed');
            }
        }
    }

    // ===== SINGLETON INSTANCE =====
    if (typeof window.authService === 'undefined') {
        window.authService = new FirebaseAuthService();

        // P1 FIX: Auto-initialize when firebase-config is ready
        if (window.FirebaseConfig && window.FirebaseConfig.isInitialized()) {
            window.authService.initialize();
        } else {
            // Wait for firebase:connection event
            window.addEventListener('firebase:connection', async (event) => {
                if (event.detail.connected && !window.authService.isInitialized()) {
                    await window.authService.initialize();
                }
            }, { once: true });
        }

        const isDev = window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';

        if (isDev) {
            console.log('%c✅ FirebaseAuthService v3.0 loaded',
                'color: #FF6F00; font-weight: bold; font-size: 12px');
        }
    }

    // P1 FIX: Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (window.authService) {
            window.authService.cleanup();
        }
    });

    // ===== EXPORT =====
    window.FirebaseAuthService = FirebaseAuthService;

})(window);