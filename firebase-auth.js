// firebase-auth.js
// Firebase Authentication Service für No-Cap
// Version 2.0 - Security Hardened

class FirebaseAuthService {
    constructor() {
        this.currentUser = null;
        this.isAnonymous = false;
        this.isAuthenticated = false;
        this.initialized = false;

        // Firebase Config - SECURE VERSION
        // Lädt Config aus globalem window.FIREBASE_CONFIG (wird von Build-Script injiziert)
        // Fallback für lokale Entwicklung (mit Warnung)
        this.firebaseConfig = window.FIREBASE_CONFIG || {
            apiKey: "AIzaSyC_cu_2X2uFCPcxYetxIUHi2v56F1Mz0Vk",
            authDomain: "denkstduwebsite.firebaseapp.com",
            databaseURL: "https://denkstduwebsite-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "denkstduwebsite",
            storageBucket: "denkstduwebsite.appspot.com",
            messagingSenderId: "27029260611",
            appId: "1:27029260611:web:3c7da4db0bf92e8ce247f6",
            measurementId: "G-BNKNW95HK8"
        };

        // Warnung wenn Fallback-Config verwendet wird
        if (!window.FIREBASE_CONFIG) {
            console.warn('⚠️ Using fallback Firebase config. Set window.FIREBASE_CONFIG in production!');
        }
    }

    // Firebase initialisieren
    async initialize() {
        try {
            // Prüfe ob Firebase bereits initialisiert ist
            if (!firebase.apps.length) {
                firebase.initializeApp(this.firebaseConfig);
                console.log('✅ Firebase initialized');
            } else {
                console.log('✅ Firebase app already initialized');
            }

            // Auth State Observer
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    this.currentUser = user;
                    this.isAnonymous = user.isAnonymous;
                    this.isAuthenticated = true;
                    console.log('✅ User authenticated:', {
                        uid: user.uid,
                        isAnonymous: user.isAnonymous,
                        email: user.email
                    });
                    this.updateUserProfile(user);
                } else {
                    this.currentUser = null;
                    this.isAnonymous = false;
                    this.isAuthenticated = false;
                    console.log('⚠️ No user authenticated');
                }
            });

            this.initialized = true;
            return true;
        } catch (error) {
            console.error('❌ Firebase initialization failed:', error);
            this.initialized = false;
            return false;
        }
    }

    // OPTION 1: Anonymer Login (automatisch beim Start)
    async signInAnonymously() {
        try {
            const userCredential = await firebase.auth().signInAnonymously();
            console.log('✅ Anonymous sign-in successful:', userCredential.user.uid);
            return {
                success: true,
                userId: userCredential.user.uid,
                isAnonymous: true
            };
        } catch (error) {
            console.error('❌ Anonymous sign-in failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // OPTION 2: E-Mail/Passwort Registrierung
    async createAccountWithEmail(email, password) {
        try {
            // Input-Validierung
            if (!this.validateEmail(email)) {
                return {
                    success: false,
                    error: 'Ungültige E-Mail-Adresse.'
                };
            }
            if (!this.validatePassword(password)) {
                return {
                    success: false,
                    error: 'Passwort muss mindestens 6 Zeichen lang sein.'
                };
            }

            // Wenn bereits anonym eingeloggt, upgrade zu permanent account
            if (this.isAnonymous) {
                const credential = firebase.auth.EmailAuthProvider.credential(email, password);
                const userCredential = await this.currentUser.linkWithCredential(credential);
                console.log('✅ Anonymous account upgraded:', userCredential.user.uid);
                return {
                    success: true,
                    userId: userCredential.user.uid,
                    upgraded: true
                };
            } else {
                // Neuen Account erstellen
                const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
                console.log('✅ New account created:', userCredential.user.uid);
                return {
                    success: true,
                    userId: userCredential.user.uid,
                    upgraded: false
                };
            }
        } catch (error) {
            console.error('❌ Account creation failed:', error);
            return {
                success: false,
                error: this.getErrorMessage(error.code)
            };
        }
    }

    // OPTION 3: E-Mail/Passwort Login
    async signInWithEmail(email, password) {
        try {
            // Input-Validierung
            if (!this.validateEmail(email)) {
                return {
                    success: false,
                    error: 'Ungültige E-Mail-Adresse.'
                };
            }
            if (!password) {
                return {
                    success: false,
                    error: 'Passwort erforderlich.'
                };
            }

            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            console.log('✅ Email sign-in successful:', userCredential.user.uid);
            return {
                success: true,
                userId: userCredential.user.uid
            };
        } catch (error) {
            console.error('❌ Email sign-in failed:', error);
            return {
                success: false,
                error: this.getErrorMessage(error.code)
            };
        }
    }

    // OPTION 4: Google Login
    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();

            // Wenn bereits anonym eingeloggt, upgrade
            if (this.isAnonymous) {
                const userCredential = await this.currentUser.linkWithPopup(provider);
                console.log('✅ Anonymous account upgraded with Google:', userCredential.user.uid);
                return {
                    success: true,
                    userId: userCredential.user.uid,
                    upgraded: true
                };
            } else {
                const userCredential = await firebase.auth().signInWithPopup(provider);
                console.log('✅ Google sign-in successful:', userCredential.user.uid);
                return {
                    success: true,
                    userId: userCredential.user.uid
                };
            }
        } catch (error) {
            console.error('❌ Google sign-in failed:', error);
            return {
                success: false,
                error: this.getErrorMessage(error.code)
            };
        }
    }

    // Logout
    async signOut() {
        try {
            await firebase.auth().signOut();
            console.log('✅ Sign-out successful');
            return { success: true };
        } catch (error) {
            console.error('❌ Sign-out failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // User Profile in localStorage und Firebase speichern
    updateUserProfile(user) {
        const profile = {
            userId: user.uid,
            email: user.email,
            isAnonymous: user.isAnonymous,
            createdAt: user.metadata.creationTime,
            lastSignIn: user.metadata.lastSignInTime,
            timestamp: Date.now()
        };

        // In localStorage speichern
        localStorage.setItem('nocap_user_auth', JSON.stringify(profile));

        // Optional: In Realtime DB speichern
        if (!user.isAnonymous) {
            this.saveUserToDatabase(profile);
        }
    }

    // User Daten in Realtime DB speichern
    async saveUserToDatabase(profile) {
        try {
            // Validierung der Daten
            if (!profile.userId) {
                throw new Error('userId is required');
            }
            if (profile.email && !this.validateEmail(profile.email)) {
                throw new Error('Invalid email format');
            }

            const userRef = firebase.database().ref(`users/${profile.userId}`);
            await userRef.set({
                email: profile.email,
                isAnonymous: profile.isAnonymous,
                createdAt: profile.createdAt,
                lastSignIn: profile.lastSignIn,
                isAdult: this.getAgeVerification(),
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });
            console.log('✅ User profile saved to database');
        } catch (error) {
            console.error('❌ Failed to save user to database:', error);
        }
    }

    // Altersverifikation aus localStorage holen
    getAgeVerification() {
        try {
            const verification = localStorage.getItem('nocap_age_verification');
            if (verification) {
                return JSON.parse(verification).isAdult || false;
            }
        } catch (error) {
            console.error('Error reading age verification:', error);
        }
        return false;
    }

    // Validation Helpers
    validateEmail(email) {
        if (!email) return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validatePassword(password) {
        return password && password.length >= 6;
    }

    // Status Checks
    isInitialized() {
        return this.initialized;
    }

    // User ID abrufen
    getUserId() {
        return this.currentUser ? this.currentUser.uid : null;
    }

    // Prüfen ob User anonym ist
    isUserAnonymous() {
        return this.isAnonymous;
    }

    // Prüfen ob User eingeloggt ist
    isUserAuthenticated() {
        return this.isAuthenticated;
    }

    // Get Current User
    getCurrentUser() {
        return this.currentUser;
    }

    // Get User Display Name
    getUserDisplayName() {
        if (!this.currentUser) return null;
        return this.currentUser.displayName || this.currentUser.email || 'Anonymer Spieler';
    }

    // Error Messages in Deutsch
    getErrorMessage(errorCode) {
        const errors = {
            'auth/email-already-in-use': 'Diese E-Mail wird bereits verwendet.',
            'auth/invalid-email': 'Ungültige E-Mail-Adresse.',
            'auth/operation-not-allowed': 'Diese Operation ist nicht erlaubt.',
            'auth/weak-password': 'Das Passwort ist zu schwach (mind. 6 Zeichen).',
            'auth/user-disabled': 'Dieser Account wurde deaktiviert.',
            'auth/user-not-found': 'Kein Account mit dieser E-Mail gefunden.',
            'auth/wrong-password': 'Falsches Passwort.',
            'auth/popup-closed-by-user': 'Login-Fenster wurde geschlossen.',
            'auth/cancelled-popup-request': 'Login wurde abgebrochen.',
            'auth/credential-already-in-use': 'Diese Anmeldedaten werden bereits verwendet.'
        };
        return errors[errorCode] || 'Ein unbekannter Fehler ist aufgetreten.';
    }
}

// Singleton Instance - Wird global verfügbar gemacht
if (typeof window.authService === 'undefined') {
    window.authService = new FirebaseAuthService();
    console.log('✅ FirebaseAuthService v2.0 initialized');
}

// Fallback für direkten Zugriff
const authService = window.authService;

// Export für Verwendung in anderen Dateien (Node.js/Module-Kompatibilität)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = authService;
}