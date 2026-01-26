/**
 * NO-CAP Firebase Authentication Service
 * Version 5.0 - Silent Auth Layer with ensureAuth()
 *
 * NEW IN v5.0:
 * ✅ ensureAuth() - Silent authentication (creates anonymous if needed)
 * ✅ getUid() - Get current user UID (convenience method)
 * ✅ isAnonymous() - Check if current user is anonymous
 * ✅ Auto-initialization improved
 * ✅ Better integration with FirebaseInit.js
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

            // ✅ P1 STABILITY: Auth-ready promise (resolves when user is authenticated)
            this._authReadyPromise = null;
            this._authReadyResolve = null;
            this._authReadyReject = null;

            // ✅ P1 STABILITY: Auth state observers (Observer Pattern)
            this._observers = new Set();

            // ✅ P0 SECURITY: Track auth requirements per page
            this._authRequired = false;
        }

        // ===================================
        // 🚀 INITIALIZATION
        // ===================================

        /**
         * ✅ P1 FIX: Initialize with FirebaseConfig
         * ✅ P0 SECURITY: Creates auth-ready promise for required auth flows
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

            // ✅ P1 STABILITY: Create auth-ready promise (only once)
            if (!this._authReadyPromise) {
                this._authReadyPromise = new Promise((resolve, reject) => {
                    this._authReadyResolve = resolve;
                    this._authReadyReject = reject;
                });
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

                    // ✅ P0: Ensure compat/global firebase object exists when used later
                    if (!window.firebase || !window.firebase.auth || !window.firebase.database) {
                        throw new Error('Global firebase compat SDK not available (window.firebase missing)');
                    }

                    // Get Firebase instances
                    const { auth } = window.FirebaseConfig.getFirebaseInstances();

                    // ✅ P1 FIX: Setup auth state observer with cleanup tracking
                    this._authStateUnsubscribe = auth.onAuthStateChanged(
                        (user) => this._handleAuthStateChange(user),
                        (error) => this._handleAuthError(error)
                    );

                    this.initialized = true;

                    if (this._isDevelopment) {
                        console.log('✅ FirebaseAuthService initialized');
                    }

                    return true;

                } catch (error) {
                    console.error('❌ FirebaseAuthService initialization failed:', error);
                    this.initialized = false;

                    // ✅ P1 STABILITY: Reject auth-ready promise
                    if (this._authReadyReject) {
                        this._authReadyReject(error);
                    }

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
        // ✅ NEW: ENSURE AUTH (SILENT)
        // ===================================

        /**
         * ✅ NEW v5.0: Ensure user is authenticated (creates anonymous if needed)
         * This runs silently - no UI impact
         *
         * USAGE:
         * - Called automatically by FirebaseInit.js on page load
         * - Can be called manually when auth is needed
         * - Creates anonymous account if no user exists
         * - Returns existing user if already authenticated
         *
         * @returns {Promise<Object>} Firebase user object
         *
         * @example
         * // Ensure auth before doing something
         * await authService.ensureAuth();
         * const uid = authService.getUid();
         */
        async ensureAuth() {
            try {
                // Initialize if needed
                if (!this.initialized) {
                    await this.initialize();
                }

                // Already signed in? Return existing user
                if (this.isAuthenticated && this.currentUser) {
                    if (this._isDevelopment) {
                        console.log('ℹ️ User already authenticated:', {
                            uid: this.currentUser.uid.substring(0, 8) + '...',
                            isAnonymous: this.currentUser.isAnonymous
                        });
                    }
                    return this.currentUser;
                }

                // Get auth instance
                const { auth } = window.FirebaseConfig.getFirebaseInstances();

                if (!auth) {
                    throw new Error('Firebase Auth not available');
                }

                // Sign in anonymously (silent)
                const result = await auth.signInAnonymously();
                this.currentUser = result.user;
                this.isAnonymous = true;
                this.isAuthenticated = true;

                if (this._isDevelopment) {
                    console.log('✅ Anonymous sign-in (ensureAuth):',
                        result.user.uid.substring(0, 8) + '...');
                }

                return this.currentUser;

            } catch (error) {
                console.error('❌ ensureAuth failed:', error);

                // ✅ P0 SECURITY: User-friendly error handling
                const errorMessage = this.getErrorMessage(error.code) || error.message;

                if (window.NocapUtils && window.NocapUtils.showNotification) {
                    window.NocapUtils.showNotification(
                        'Authentifizierung fehlgeschlagen',
                        'error'
                    );
                }

                throw error;
            }
        }

        // ===================================
        // ✅ NEW: CONVENIENCE METHODS
        // ===================================

        /**
         * ✅ NEW v5.0: Get current user UID
         * @returns {string|null} User UID or null
         *
         * @example
         * const uid = authService.getUid();
         * if (uid) {
         *     console.log('Current user:', uid);
         * }
         */
        getUid() {
            return this.currentUser?.uid || null;
        }

        /**
         * ✅ NEW v5.0: Check if user is anonymous
         * @returns {boolean} True if anonymous
         *
         * @example
         * if (authService.isAnonymous()) {
         *     console.log('User is anonymous - show upgrade prompt');
         * }
         */
        isAnonymous() {
            return this.currentUser?.isAnonymous || false;
        }

        /**
         * ✅ ENHANCED: Check if user is authenticated (convenience wrapper)
         * @returns {boolean} True if authenticated
         */
        isAuthenticated() {
            return this.isAuthenticated && this.currentUser !== null;
        }

        // ===========================
        // 👤 AUTH STATE MANAGEMENT
        // ✅ P1 STABILITY: Observer Pattern
        // ===========================

        /**
         * ✅ P1 STABILITY: Register observer for auth state changes
         * @param {Function} callback - Callback function (user, isAnonymous) => void
         * @returns {Function} Unsubscribe function
         *
         * @example
         * const unsubscribe = authService.onAuthStateChanged((user, isAnonymous) => {
         *     if (user) {
         *         console.log('User logged in:', user.uid);
         *     } else {
         *         console.log('User logged out');
         *     }
         * });
         *
         * // Later: unsubscribe()
         */
        onAuthStateChanged(callback) {
            if (typeof callback !== 'function') {
                console.error('❌ onAuthStateChanged requires a callback function');
                return () => {};
            }

            // Add to observers
            this._observers.add(callback);

            // Call immediately with current state
            if (this.initialized) {
                try {
                    callback(this.currentUser, this.isAnonymous);
                } catch (error) {
                    console.error('❌ Observer callback error:', error);
                }
            }

            // Return unsubscribe function
            return () => {
                this._observers.delete(callback);
            };
        }

        /**
         * ✅ P1 STABILITY: Handle auth state changes and notify observers
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

                // ✅ P1 STABILITY: Resolve auth-ready promise
                if (this._authReadyResolve) {
                    this._authReadyResolve(user);
                    this._authReadyResolve = null;
                    this._authReadyReject = null;
                }

                // ✅ P1 STABILITY: Notify all observers
                this._notifyObservers(user, user.isAnonymous);

                // Dispatch custom event (for backward compatibility)
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

                // ✅ P0 SECURITY: If auth is required, redirect or sign in anonymously
                if (this._authRequired) {
                    if (this._isDevelopment) {
                        console.log('🔐 Auth required - attempting anonymous sign-in');
                    }
                    this.signInAnonymously().catch(error => {
                        console.error('❌ Auto anonymous sign-in failed:', error);
                        if (this._authReadyReject) {
                            this._authReadyReject(error);
                        }
                    });
                } else {
                    // ✅ P1 STABILITY: Resolve with null if auth not required
                    if (this._authReadyResolve) {
                        this._authReadyResolve(null);
                        this._authReadyResolve = null;
                        this._authReadyReject = null;
                    }
                }

                // ✅ P1 STABILITY: Notify all observers
                this._notifyObservers(null, false);

                // Dispatch custom event
                window.dispatchEvent(new CustomEvent('nocap:authStateChanged', {
                    detail: { user: null, isAnonymous: false }
                }));
            }
        }

        /**
         * ✅ P1 STABILITY: Handle auth errors
         * @private
         */
        _handleAuthError(error) {
            console.error('❌ Auth state change error:', error);

            // Reject auth-ready promise
            if (this._authReadyReject) {
                this._authReadyReject(error);
                this._authReadyResolve = null;
                this._authReadyReject = null;
            }

            // Show user-friendly error
            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    'Authentifizierungsfehler aufgetreten',
                    'error'
                );
            }
        }

        /**
         * ✅ P1 STABILITY: Notify all registered observers
         * @private
         */
        _notifyObservers(user, isAnonymous) {
            this._observers.forEach(callback => {
                try {
                    callback(user, isAnonymous);
                } catch (error) {
                    console.error('❌ Observer callback error:', error);
                }
            });
        }

        // ===================================
        // 🔐 AUTH REQUIREMENTS
        // ✅ P0 SECURITY: Enforce authentication
        // ===================================

        /**
         * ✅ P0 SECURITY: Require authentication for current page
         * Ensures user is authenticated (anonymous or real) before proceeding
         *
         * @param {Object} options - Options
         * @param {boolean} options.allowAnonymous - Allow anonymous users (default: true)
         * @param {string} options.redirectTo - Redirect URL if auth fails (default: 'index.html')
         * @param {number} options.timeout - Max wait time in ms (default: 10000)
         * @returns {Promise<Object>} User object
         *
         * @example
         * // In multiplayer-lobby.js
         * try {
         *     const user = await authService.requireAuth({
         *         allowAnonymous: true,
         *         timeout: 5000
         *     });
         *     console.log('User ready:', user.uid);
         * } catch (error) {
         *     // User will be redirected or error shown
         * }
         */
        async requireAuth(options = {}) {
            const {
                allowAnonymous = true,
                redirectTo = 'index.html',
                timeout = 10000
            } = options;

            this._authRequired = true;

            try {
                // Initialize if needed
                if (!this.initialized) {
                    await this.initialize();
                }

                // Wait for auth state to be determined
                const user = await this.waitForAuth(timeout);

                // Check if user exists
                if (!user) {
                    throw new Error('NO_USER');
                }

                // Check if anonymous is allowed
                if (!allowAnonymous && user.isAnonymous) {
                    throw new Error('ANONYMOUS_NOT_ALLOWED');
                }

                if (this._isDevelopment) {
                    console.log('✅ Auth requirement satisfied:', {
                        uid: user.uid.substring(0, 8) + '...',
                        isAnonymous: user.isAnonymous
                    });
                }

                return user;

            } catch (error) {
                console.error('❌ Auth requirement failed:', error);

                // Show error to user
                if (window.NocapUtils && window.NocapUtils.showNotification) {
                    let message = 'Anmeldung erforderlich';

                    if (error.message === 'ANONYMOUS_NOT_ALLOWED') {
                        message = 'Du musst dich mit einem Account anmelden';
                    } else if (error.message === 'TIMEOUT') {
                        message = 'Anmeldung fehlgeschlagen - Zeitüberschreitung';
                    }

                    window.NocapUtils.showNotification(message, 'error', 3000);
                }

                setTimeout(() => {
                    // nur redirecten, wenn immer noch kein User da ist
                    if (!this.isAuthenticated || !this.currentUser) {
                        window.location.href = redirectTo;
                    }
                }, 1500);

                throw error;
            }
        }

        /**
         * ✅ P0 SECURITY: Wait for user to be authenticated
         * Returns a promise that resolves when user is authenticated
         *
         * @param {number} timeout - Max wait time in ms (default: 10000)
         * @returns {Promise<Object>} User object or null
         *
         * @example
         * const user = await authService.waitForAuth(5000);
         * if (user) {
         *     // User is authenticated
         * }
         */
        async waitForAuth(timeout = 10000) {
            // Return immediately if already authenticated
            if (this.isAuthenticated && this.currentUser) {
                return this.currentUser;
            }

            // Initialize if needed
            if (!this.initialized) {
                await this.initialize();
            }

            // ✅ P1 STABILITY: Ensure auth-ready promise exists (can be null after cleanup/errors)
            if (!this._authReadyPromise) {
                this._authReadyPromise = new Promise((resolve, reject) => {
                    this._authReadyResolve = resolve;
                    this._authReadyReject = reject;
                });
            }

            // Wait for auth-ready promise with timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('TIMEOUT')), timeout);
            });

            try {
                const user = await Promise.race([
                    this._authReadyPromise,
                    timeoutPromise
                ]);

                return user;

            } catch (error) {
                if (error.message === 'TIMEOUT') {
                    console.error('❌ Auth timeout after', timeout, 'ms');
                }
                throw error;
            }
        }

        /**
         * ✅ P0 SECURITY: Sign in anonymously with comprehensive error handling
         * @returns {Promise<Object>} Result object
         *
         * @example
         * try {
         *     const result = await authService.signInAnonymously();
         *     if (result.success) {
         *         console.log('Signed in:', result.userId);
         *     }
         * } catch (error) {
         *     console.error('Sign-in failed:', error);
         * }
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

                if (!auth) {
                    throw new Error('Firebase Auth not available');
                }

                // ✅ P0 SECURITY: Sign in anonymously with error handling
                let userCredential;
                try {
                    userCredential = await auth.signInAnonymously();
                } catch (signInError) {
                    // Handle specific errors
                    if (signInError.code === 'auth/operation-not-allowed') {
                        throw new Error('Anonymous authentication is disabled. Please contact support.');
                    }
                    throw signInError;
                }

                if (!userCredential || !userCredential.user) {
                    throw new Error('Sign-in succeeded but no user returned');
                }

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

                // ✅ P0 SECURITY: User-friendly error handling
                const errorMessage = this.getErrorMessage(error.code) || error.message;

                if (window.NocapUtils && window.NocapUtils.showNotification) {
                    window.NocapUtils.showNotification(errorMessage, 'error');
                }

                // ✅ P1 STABILITY: Reject auth-ready promise if pending
                if (this._authReadyReject) {
                    this._authReadyReject(error);
                    this._authReadyResolve = null;
                    this._authReadyReject = null;
                }

                return {
                    success: false,
                    error: errorMessage
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
                    const credential = window.firebase.auth.EmailAuthProvider.credential(
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
         * ✅ P0 SECURITY + P1 GDPR: Sign in with Google (minimal scopes)
         * Only requests profile and email - no contacts, drive, or other data
         * @returns {Promise<Object>} Result object
         */
        async signInWithGoogle() {
            try {
                if (!this.initialized) {
                    await this.initialize();
                }

                const { auth } = window.FirebaseConfig.getFirebaseInstances();

                // ✅ P0 SECURITY: Only initialize Google provider (remove unused providers)
                // ✅ P1 GDPR: Minimal scope - only profile and email
                const provider = new window.firebase.auth.GoogleAuthProvider();

                // ✅ P1 GDPR: Explicitly set minimal scopes
                // Default scopes are already minimal (profile, email), but we make it explicit
                provider.setCustomParameters({
                    prompt: 'select_account', // Allow account selection
                });

                // ✅ P1 GDPR: Do NOT add additional scopes
                // NO: provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
                // NO: provider.addScope('https://www.googleapis.com/auth/drive.readonly');
                // We only use the default scopes: profile, email (implicit)

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
        // 🔄 P1 STABILITY: TOKEN & CLAIMS REFRESH
        // ===================================

        /**
         * ✅ P1 STABILITY: Refresh authentication token to get updated custom claims
         * Call this after server-side claim updates (e.g., premium activation)
         * @param {boolean} forceRefresh - Force token refresh even if not expired
         * @returns {Promise<Object>} Result object with updated token
         */
        async refreshAuthToken(forceRefresh = true) {
            try {
                if (!this.initialized) {
                    await this.initialize();
                }

                if (!this.isAuthenticated) {
                    return {
                        success: false,
                        error: 'No user authenticated'
                    };
                }

                const { auth } = window.FirebaseConfig.getFirebaseInstances();
                const user = auth.currentUser;

                if (!user) {
                    return {
                        success: false,
                        error: 'No current user'
                    };
                }

                // ✅ P1 STABILITY: Force token refresh to get updated custom claims
                const token = await user.getIdToken(forceRefresh);

                if (this._isDevelopment) {
                    console.log('✅ Auth token refreshed');

                    // Decode token to show custom claims (dev only)
                    try {
                        const tokenResult = await user.getIdTokenResult(forceRefresh);
                        console.log('Custom claims:', tokenResult.claims);
                    } catch (e) {
                        // Ignore decode errors
                    }
                }

                // Dispatch event for components to react to claim updates
                window.dispatchEvent(new CustomEvent('nocap:tokenRefreshed', {
                    detail: { userId: user.uid }
                }));

                return {
                    success: true,
                    token: token
                };

            } catch (error) {
                console.error('❌ Token refresh failed:', error);

                return {
                    success: false,
                    error: error.message
                };
            }
        }

        /**
         * ✅ P1 STABILITY: Get current custom claims
         * @returns {Promise<Object>} Custom claims object
         */
        async getCustomClaims() {
            try {
                if (!this.initialized) {
                    await this.initialize();
                }

                if (!this.isAuthenticated) {
                    return {};
                }

                const { auth } = window.FirebaseConfig.getFirebaseInstances();
                const user = auth.currentUser;

                if (!user) {
                    return {};
                }

                const tokenResult = await user.getIdTokenResult();
                return tokenResult.claims || {};

            } catch (error) {
                console.error('❌ Failed to get custom claims:', error);
                return {};
            }
        }

        /**
         * ✅ P1 STABILITY: Check if user has specific claim
         * @param {string} claimName - Name of the claim to check
         * @returns {Promise<boolean>} True if claim exists and is truthy
         */
        async hasClaim(claimName) {
            const claims = await this.getCustomClaims();
            return claims[claimName] === true;
        }

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
                    lastUpdate: window.firebase.database.ServerValue.TIMESTAMP
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
         * ✅ P1 STABILITY: Check if user has premium status (with custom claims)
         * WARNING: This checks custom claims which MUST be set server-side!
         * @returns {Promise<boolean>} Premium status
         */
        async isPremiumUser() {
            // ⚠️ P0 WARNING: Anonymous users cannot have premium
            if (!this.isAuthenticated || this.isAnonymous) {
                return false;
            }

            try {
                // ✅ P1 STABILITY: Check custom claims (set by server)
                const claims = await this.getCustomClaims();

                // Check for premium claim (server-side validation required)
                if (claims.premium === true) {
                    return true;
                }

                // Fallback: Check for stripeRole claim (if using Stripe)
                if (claims.stripeRole === 'premium' || claims.stripeRole === 'pro') {
                    return true;
                }

                return false;

            } catch (error) {
                console.error('❌ Failed to check premium status:', error);
                return false;
            }
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

            // ✅ P1 STABILITY: Clear all observers
            this._observers.clear();

            // Reset state
            this.currentUser = null;
            this.isAnonymous = false;
            this.isAuthenticated = false;
            this.initialized = false;
            this._initPromise = null;
            this._authReadyPromise = null;
            this._authReadyResolve = null;
            this._authReadyReject = null;
            this._authRequired = false;

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
                '%c✅ FirebaseAuthService v5.0 loaded (with ensureAuth)',
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