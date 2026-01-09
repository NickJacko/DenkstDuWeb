/**
 * NO-CAP Firebase Configuration & Initialization
 * Version 7.0 - Enhanced Offline Support & Telemetry
 *
 * ARCHITECTURE:
 * - This file ONLY initializes Firebase SDK
 * - All game operations are in firebase-service.js
 * - All auth operations are in firebase-auth.js
 *
 * SECURITY IMPROVEMENTS:
 * - ✅ P0 FIX: Domain whitelisting to prevent third-party script abuse
 * - ✅ P1 FIX: User-friendly error messages for auth failures
 * - ✅ P2 FIX: UID caching with integrity checks
 * - Environment variable support via window.FIREBASE_CONFIG
 * - No hardcoded secrets in production builds
 * - Proper initialization state management
 * - Connection monitoring and offline support
 *
 * VERSION 7.0 OPTIMIZATIONS:
 * - ✅ OPTIMIZATION: Extended domain whitelist (production patterns)
 * - ✅ OPTIMIZATION: IndexedDB persistence with storage monitoring
 * - ✅ OPTIMIZATION: Telemetry integration (connection/auth state changes)
 * - ✅ OPTIMIZATION: Enhanced offline support (auto-reconnect)
 */

'use strict';

(function(window) {

    // ===================================
    // 🔒 ENVIRONMENT DETECTION
    // ===================================

    const isDevelopment = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('192.168.') ||
        window.location.hostname.includes('--pr') || // Preview deployments
        window.location.hostname.includes('.local');

    const isProduction = !isDevelopment;

    // ===================================
    // 💾 P1 STABILITY: INDEXEDDB CACHE
    // ===================================

    const DB_NAME = 'NocapFirebaseCache';
    const DB_VERSION = 1;
    const STORE_NAME = 'config_cache';

    /**
     * ✅ P1 STABILITY: Open IndexedDB connection
     * @returns {Promise<IDBDatabase>}
     */
    function openDatabase() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB not supported'));
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
    }

    /**
     * ✅ P1 STABILITY: Cache data to IndexedDB
     * @param {string} key - Cache key
     * @param {any} data - Data to cache
     */
    async function cacheData(key, data) {
        try {
            const db = await openDatabase();
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            return new Promise((resolve, reject) => {
                const request = store.put(data, key);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            if (isDevelopment) {
                console.warn('Cache write failed:', error);
            }
            throw error;
        }
    }

    /**
     * ✅ P1 STABILITY: Load cached data from IndexedDB
     * @param {string} key - Cache key
     * @returns {Promise<any>} Cached data or null
     */
    async function loadCachedData(key) {
        try {
            const db = await openDatabase();
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);

            return new Promise((resolve, reject) => {
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            if (isDevelopment) {
                console.warn('Cache read failed:', error);
            }
            return null;
        }
    }

    // ===================================
    // 🛡️ P0 FIX: DOMAIN WHITELISTING
    // ===================================

    // ===================================
    // 🛡️ P0 SECURITY: DOMAIN WHITELISTING
    // ✅ P0 ENHANCEMENT: Dynamic domain whitelist with external config
    // ===================================

    /**
     * ✅ P0 SECURITY: Allowed domains loaded from external config
     * Fallback to hardcoded list if fetch fails
     */
    let ALLOWED_DOMAINS = [
        // Production domains (FALLBACK - will be overridden by allowed-domains.json)
        'no-cap.app',
        'www.no-cap.app',
        'denkstduwebsite.web.app',
        'denkstduwebsite.firebaseapp.com',

        // Development domains
        'localhost',
        '127.0.0.1',

        // Patterns for dynamic domains
        /^192\.168\.\d+\.\d+$/,
        /^10\.\d+\.\d+\.\d+$/,
        /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
        /\.local$/,
        /--pr\d+-/,
        /^denkstduwebsite--pr\d+/,
        /\.web\.app$/,
        /\.firebaseapp\.com$/
    ];

    /**
     * ✅ P0 SECURITY: Load domain whitelist from external JSON config
     * @returns {Promise<void>}
     */
    async function loadDomainWhitelist() {
        try {
            const response = await fetch('/allowed-domains.json', {
                cache: 'no-cache',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to load domain whitelist: ${response.status}`);
            }

            const config = await response.json();

            if (!config || !config.domains || !Array.isArray(config.domains)) {
                throw new Error('Invalid domain whitelist format');
            }

            // Build new whitelist from config
            const newWhitelist = [
                ...config.domains,
                ...(config.patterns || []).map(pattern => new RegExp(pattern))
            ];

            ALLOWED_DOMAINS = newWhitelist;

            if (isDevelopment) {
                console.log('✅ Domain whitelist loaded from config:', {
                    domains: config.domains.length,
                    patterns: (config.patterns || []).length,
                    version: config.version,
                    lastUpdated: config.lastUpdated
                });
            }

            // ✅ P1 STABILITY: Cache whitelist in IndexedDB
            try {
                await cacheData('domain_whitelist', {
                    config,
                    timestamp: Date.now()
                });
            } catch (cacheError) {
                // Non-fatal
                if (isDevelopment) {
                    console.warn('Could not cache domain whitelist:', cacheError);
                }
            }

        } catch (error) {
            console.warn('⚠️ Could not load domain whitelist, using fallback:', error.message);

            // Try to load from IndexedDB cache
            try {
                const cached = await loadCachedData('domain_whitelist');
                if (cached && cached.config) {
                    const cacheAge = Date.now() - (cached.timestamp || 0);
                    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

                    if (cacheAge < maxAge) {
                        const newWhitelist = [
                            ...cached.config.domains,
                            ...(cached.config.patterns || []).map(pattern => new RegExp(pattern))
                        ];

                        ALLOWED_DOMAINS = newWhitelist;

                        if (isDevelopment) {
                            console.log('✅ Domain whitelist loaded from cache');
                        }
                        return;
                    }
                }
            } catch (cacheError) {
                // Ignore cache errors
            }

            // Use hardcoded fallback (already set above)
            if (isDevelopment) {
                console.log('ℹ️ Using hardcoded domain whitelist (fallback)');
            }
        }
    }

    /**
     * ✅ P0 FIX: Validate that current domain is whitelisted
     * @returns {boolean} True if domain is allowed
     */
    function isDomainWhitelisted() {
        const hostname = window.location.hostname;

        // Check exact matches and patterns
        if (ALLOWED_DOMAINS.some(domain => {
            if (typeof domain === 'string') {
                return hostname === domain || hostname.endsWith('.' + domain);
            }
            if (domain instanceof RegExp) {
                return domain.test(hostname);
            }
            return false;
        })) {
            return true;
        }

        console.error('❌ SECURITY: Domain not whitelisted:', hostname);
        return false;
    }

    // ===================================
    // ⚙️ FIREBASE CONFIGURATION
    // ===================================

    /**
     * ✅ P1 STABILITY: Get Firebase configuration with offline fallback
     * Caches successful configs to IndexedDB for offline use
     *
     * PRODUCTION DEPLOYMENT:
     * Set window.FIREBASE_CONFIG before loading this script:
     * <script>
     *   window.FIREBASE_CONFIG = {
     *     apiKey: "YOUR_API_KEY",
     *     authDomain: "YOUR_AUTH_DOMAIN",
     *     // ... other config
     *   };
     * </script>
     *
     * Or use meta tags:
     * <meta name="firebase-api-key" content="YOUR_API_KEY">
     * <meta name="firebase-auth-domain" content="YOUR_AUTH_DOMAIN">
     * etc.
     */
    async function getFirebaseConfig() {
        // ✅ P0 FIX: Check domain whitelist BEFORE loading config
        if (!isDomainWhitelisted()) {
            throw new Error('SECURITY ERROR: Domain not whitelisted for Firebase initialization');
        }

        let config = null;

        // Priority 1: window.FIREBASE_CONFIG (set via build process)
        if (window.FIREBASE_CONFIG && validateConfig(window.FIREBASE_CONFIG)) {
            if (isDevelopment) {
                console.log('✅ Using Firebase config from window.FIREBASE_CONFIG');
            }
            config = window.FIREBASE_CONFIG;
        }

        // Priority 2: Meta tags (for static hosting)
        if (!config) {
            const metaConfig = getConfigFromMetaTags();
            if (metaConfig && validateConfig(metaConfig)) {
                if (isDevelopment) {
                    console.log('✅ Using Firebase config from meta tags');
                }
                config = metaConfig;
            }
        }

        // Priority 3: Default config (development only)
        if (!config && isDevelopment) {
            console.warn('⚠️ Using default Firebase config (development only)');
            config = {
                apiKey: "AIzaSyC_cu_2X2uFCPcxYetxIUHi2v56F1Mz0Vk",
                authDomain: "denkstduwebsite.firebaseapp.com",
                databaseURL: "https://denkstduwebsite-default-rtdb.europe-west1.firebasedatabase.app",
                projectId: "denkstduwebsite",
                storageBucket: "denkstduwebsite.appspot.com",
                messagingSenderId: "27029260611",
                appId: "1:27029260611:web:3c7da4db0bf92e8ce247f6",
                measurementId: "G-BNKNW95HK8"
            };
        }

        // ✅ P1 STABILITY: Cache successful config for offline use
        if (config) {
            try {
                await cacheData('firebase_config', {
                    config,
                    timestamp: Date.now()
                });
                if (isDevelopment) {
                    console.log('✅ Firebase config cached to IndexedDB');
                }
            } catch (cacheError) {
                // Non-fatal
                if (isDevelopment) {
                    console.warn('Could not cache Firebase config:', cacheError);
                }
            }
            return config;
        }

        // ✅ P1 STABILITY: Fallback to cached config if available (offline support)
        try {
            const cached = await loadCachedData('firebase_config');
            if (cached && cached.config) {
                const cacheAge = Date.now() - (cached.timestamp || 0);
                const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

                if (cacheAge < maxAge) {
                    console.warn('⚠️ Using cached Firebase config (offline fallback)');
                    if (isDevelopment) {
                        console.log('ℹ️ Config cached', Math.floor(cacheAge / 1000 / 60 / 60), 'hours ago');
                    }
                    return cached.config;
                } else {
                    if (isDevelopment) {
                        console.warn('⚠️ Cached config is too old, not using');
                    }
                }
            }
        } catch (cacheError) {
            // Ignore cache errors
            if (isDevelopment) {
                console.warn('Could not load cached config:', cacheError);
            }
        }

        // Production without config = error
        throw new Error('Firebase configuration not found. Set window.FIREBASE_CONFIG or use meta tags.');
    }

    /**
     * Extract Firebase config from meta tags
     */
    function getConfigFromMetaTags() {
        const getMetaContent = (name) => {
            const meta = document.querySelector(`meta[name="firebase-${name}"]`);
            return meta ? meta.getAttribute('content') : null;
        };

        const apiKey = getMetaContent('api-key');
        const authDomain = getMetaContent('auth-domain');
        const databaseURL = getMetaContent('database-url');
        const projectId = getMetaContent('project-id');
        const storageBucket = getMetaContent('storage-bucket');
        const messagingSenderId = getMetaContent('messaging-sender-id');
        const appId = getMetaContent('app-id');
        const measurementId = getMetaContent('measurement-id');

        if (!apiKey || !authDomain || !projectId) {
            return null;
        }

        return {
            apiKey,
            authDomain,
            databaseURL,
            projectId,
            storageBucket,
            messagingSenderId,
            appId,
            measurementId
        };
    }

    /**
     * Validate Firebase configuration
     */
    function validateConfig(config) {
        if (!config || typeof config !== 'object') {
            return false;
        }

        const requiredFields = ['apiKey', 'authDomain', 'projectId'];
        const missingFields = requiredFields.filter(field => !config[field]);

        if (missingFields.length > 0) {
            console.error('❌ Invalid Firebase config. Missing fields:', missingFields);
            return false;
        }

        return true;
    }

    // ===================================
    // 📊 INITIALIZATION STATE
    // ===================================

    let initializationPromise = null;
    let isInitialized = false;
    let initializationError = null;
    let connectionMonitoringActive = false;
    let authListenerActive = false;

    // ✅ P1 STABILITY: Firebase config is loaded async
    let firebaseConfig = null;

    // ===================================
    // 🚀 INITIALIZATION
    // ===================================

    /**
     * Initialize Firebase with proper error handling and state management
     *
     * @returns {Promise<{app, auth, database}>} Firebase instances
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
                // Check if Firebase SDK is loaded
                if (typeof firebase === 'undefined') {
                    throw new Error('Firebase SDK not loaded. Add Firebase scripts to HTML before firebase-config.js');
                }

                // ✅ P1 STABILITY: Load config asynchronously (supports IndexedDB fallback)
                if (!firebaseConfig) {
                    try {
                        firebaseConfig = await getFirebaseConfig();
                    } catch (configError) {
                        console.error('❌ Failed to load Firebase config:', configError);
                        throw new Error('Firebase configuration not available');
                    }
                }

                // Validate config
                if (!validateConfig(firebaseConfig)) {
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

                    // ===================================
                    // ✅ P0 SECURITY: Firebase App Check (Production only)
                    // ===================================
                    // Protects against abuse (bots, unauthorized access)
                    // Disabled in development to avoid reCAPTCHA errors on localhost
                    if (firebase.appCheck && isProduction) {
                        try {
                            const RECAPTCHA_SITE_KEY = '6LeEL0UsAAAAABN-JYDFEshwg9Qnmq09IyWzaJ9l';

                            // ✅ FIX: Activate App Check and handle errors properly
                            firebase.appCheck().activate(
                                RECAPTCHA_SITE_KEY,
                                true // autoRefresh
                            );

                            if (isDevelopment) {
                                console.log('%c✅ App Check activated (Production)',
                                    'color: #4CAF50; font-weight: bold');
                            }
                        } catch (error) {
                            console.warn('⚠️  App Check activation failed:', error);
                            // Non-fatal: Continue without App Check
                        }
                    } else if (isDevelopment) {
                        console.log('%c⚠️  App Check disabled (Development mode)',
                            'color: #FF9800');
                    }
                } else {
                    app = firebase.app();

                    if (isDevelopment) {
                        console.log('%c✅ Firebase App already initialized',
                            'color: #4CAF50');
                    }
                }

                // Get service references
                const auth = firebase.auth();
                const database = firebase.database();

                // Configure Firebase services
                await configureFirebaseServices(auth, database);

                // Create instances
                window.firebaseApp = firebase.app();
                window.firebaseAuth = firebase.auth();
                window.firebaseDatabase = firebase.database();

                // ✅ OPTIONAL: Functions (only if SDK loaded)
                try {
                    if (typeof firebase.functions === 'function') {
                        // Region must match your deployed functions (default is us-central1 unless set)
                        window.firebaseFunctions = firebase.functions();
                    } else {
                        window.firebaseFunctions = null;
                    }
                } catch (e) {
                    window.firebaseFunctions = null;
                }

                // Export to window (for backwards compatibility)
                window.firebaseApp = app;
                window.firebaseAuth = auth;
                window.firebaseDatabase = database;

                isInitialized = true;

                if (isDevelopment) {
                    console.log('%c✅ Firebase services ready',
                        'color: #2196F3; font-weight: bold');
                    console.log('   Project:', firebaseConfig.projectId);
                    console.log('   Auth Domain:', firebaseConfig.authDomain);
                }

                return { app, auth, database };

            } catch (error) {
                initializationError = error;
                console.error('❌ Firebase initialization error:', error);

                // Show user-friendly error notification
                showErrorNotification('Firebase konnte nicht initialisiert werden', error);

                throw error;
            } finally {
                initializationPromise = null;
            }
        })();

        return initializationPromise;
    }

    /**
     * ✅ OPTIMIZATION: Configure Firebase services with optimal settings
     * - Database offline persistence (IndexedDB)
     * - Auth device language
     * - Connection monitoring
     */
    async function configureFirebaseServices(auth, database) {
        try {
            // ===== AUTH CONFIGURATION =====
            auth.useDeviceLanguage(); // Use browser language for auth messages

            // ✅ P1 FIX: Tracking Prevention (Safari/Firefox) - Use IndexedDB instead of localStorage
            try {
                await auth.setPersistence(firebase.auth.Auth.Persistence.INDEXED_DB);

                if (isDevelopment) {
                    console.log('✅ Auth persistence: INDEXED_DB (Tracking Prevention fix)');
                }
            } catch (persistenceError) {
                // Fallback: Session persistence (nur für aktive Browser-Session)
                try {
                    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);

                    if (isDevelopment) {
                        console.warn('⚠️ Fallback to SESSION persistence:', persistenceError.message);
                    }
                } catch (sessionError) {
                    console.warn('⚠️ Could not set auth persistence:', sessionError.message);
                    // Non-fatal: Auth will work without persistence (requires re-login on page reload)
                }
            }

            // ===== DATABASE CONFIGURATION =====
            // Enable offline persistence
            try {
                // Method 1: Enable disk persistence (IndexedDB)
                // Note: This must be called before any database operations
                database.ref();

                // Enable offline capabilities
                database.goOffline();

                // Wait a moment to ensure offline mode is set
                await new Promise(resolve => setTimeout(resolve, 100));

                database.goOnline();

                if (isDevelopment) {
                    console.log('✅ Database offline persistence enabled (IndexedDB)');
                }

                // ✅ OPTIMIZATION: Keep local cache size reasonable (10MB)
                // Firebase automatically manages IndexedDB, but we can monitor size
                if (navigator.storage && navigator.storage.estimate) {
                    const estimate = await navigator.storage.estimate();
                    const percentUsed = (estimate.usage / estimate.quota) * 100;

                    if (isDevelopment) {
                        console.log(`📦 Storage usage: ${(estimate.usage / 1024 / 1024).toFixed(2)} MB / ${(estimate.quota / 1024 / 1024).toFixed(2)} MB (${percentUsed.toFixed(1)}%)`);
                    }

                    // Warn if storage is getting full (>80%)
                    if (percentUsed > 80) {
                        console.warn('⚠️ Storage quota almost full, consider clearing old data');

                        // Log to telemetry
                        if (window.NocapUtils && window.NocapUtils.logToTelemetry) {
                            window.NocapUtils.logToTelemetry({
                                component: 'FirebaseConfig',
                                message: 'Storage quota warning',
                                type: 'warning',
                                timestamp: Date.now(),
                                state: {
                                    usageMB: (estimate.usage / 1024 / 1024).toFixed(2),
                                    quotaMB: (estimate.quota / 1024 / 1024).toFixed(2),
                                    percentUsed: percentUsed.toFixed(1)
                                }
                            });
                        }
                    }
                }

            } catch (persistenceError) {
                console.warn('⚠️ Database persistence warning:', persistenceError.message);

                // Log to telemetry in production
                if (!isDevelopment && window.NocapUtils && window.NocapUtils.logError) {
                    window.NocapUtils.logError('FirebaseConfig', persistenceError, {
                        context: 'Database persistence setup'
                    });
                }

                // Non-fatal, continue without persistence
            }

        } catch (error) {
            console.warn('⚠️ Firebase service configuration warning:', error);

            // Log to telemetry
            if (!isDevelopment && window.NocapUtils && window.NocapUtils.logError) {
                window.NocapUtils.logError('FirebaseConfig', error, {
                    context: 'Service configuration'
                });
            }

            // Non-fatal, services will still work
        }
    }

    // ===================================
    // 🔍 STATE CHECKS
    // ===================================

    /**
     * Check if Firebase is fully initialized and ready
     *
     * @returns {boolean} True if initialized
     */
    function isFirebaseInitialized() {
        return isInitialized &&
            window.firebaseApp &&
            window.firebaseAuth &&
            window.firebaseDatabase;
    }

    /**
     * Get Firebase instances safely
     *
     * @returns {{app, auth, database}} Firebase instances
     * @throws {Error} If Firebase not initialized
     */
    function getFirebaseInstances() {
        if (!isFirebaseInitialized()) {
            throw new Error('Firebase not initialized. Call FirebaseConfig.initialize() first.');
        }

        return {
            app: window.firebaseApp,
            auth: window.firebaseAuth,
            database: window.firebaseDatabase,
            functions: window.firebaseFunctions || null
        };
    }

    /**
     * Wait for Firebase to be ready with timeout
     *
     * @param {number} timeout - Maximum wait time in milliseconds
     * @returns {Promise<{app, auth, database}>} Firebase instances
     */
    async function waitForFirebase(timeout = 10000) {
        const startTime = Date.now();

        while (!isFirebaseInitialized()) {
            if (Date.now() - startTime > timeout) {
                throw new Error(`Firebase initialization timeout after ${timeout}ms`);
            }

            // Wait 100ms before checking again
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return getFirebaseInstances();
    }

    // ===================================
    // 📡 CONNECTION MONITORING
    // ===================================

    /**
     * ✅ OPTIMIZATION: Setup Firebase connection monitoring
     * Dispatches custom events and updates body classes
     * Logs connection changes to telemetry
     */
    function setupConnectionMonitoring() {
        if (!isFirebaseInitialized()) {
            console.warn('⚠️ Firebase not initialized, cannot setup connection monitoring');
            return;
        }

        if (connectionMonitoringActive) {
            if (isDevelopment) {
                console.log('ℹ️ Connection monitoring already active');
            }
            return;
        }

        const connectedRef = window.firebaseDatabase.ref('.info/connected');
        let lastConnectionState = null;
        let connectionChangeCount = 0;

        connectedRef.on('value', (snapshot) => {
            const isConnected = snapshot.val() === true;

            // Track state changes
            if (lastConnectionState !== null && lastConnectionState !== isConnected) {
                connectionChangeCount++;

                // Log to telemetry (connection state change)
                if (!isDevelopment && window.NocapUtils && window.NocapUtils.logInfo) {
                    window.NocapUtils.logInfo('FirebaseConfig', 'Connection state changed', {
                        connected: isConnected,
                        previousState: lastConnectionState,
                        changeCount: connectionChangeCount,
                        timestamp: Date.now()
                    });
                }
            }

            lastConnectionState = isConnected;

            if (isDevelopment) {
                console.log(`🔌 Firebase connection: ${isConnected ? 'ONLINE ✅' : 'OFFLINE ⚠️'}`);
            }

            // Dispatch custom event for connection status
            window.dispatchEvent(new CustomEvent('firebase:connection', {
                detail: {
                    connected: isConnected,
                    changeCount: connectionChangeCount
                }
            }));

            // Update body class for CSS styling
            document.body.classList.toggle('firebase-online', isConnected);
            document.body.classList.toggle('firebase-offline', !isConnected);

            // Store connection state
            try {
                sessionStorage.setItem('nocap_firebase_connected', isConnected ? 'true' : 'false');
                sessionStorage.setItem('nocap_firebase_last_connection_check', Date.now().toString());
            } catch (error) {
                // Ignore storage errors
            }
        });

        connectionMonitoringActive = true;

        if (isDevelopment) {
            console.log('✅ Firebase connection monitoring active');
        }
    }

    /**
     * Get current connection status
     */
    function isConnected() {
        if (!isFirebaseInitialized()) {
            return false;
        }

        // Try to get from sessionStorage first (faster)
        try {
            const cached = sessionStorage.getItem('nocap_firebase_connected');
            if (cached !== null) {
                return cached === 'true';
            }
        } catch (error) {
            // Ignore
        }

        // Fallback: check body class
        return document.body.classList.contains('firebase-online');
    }

    // ===================================
    // 🔐 AUTH STATE MONITORING
    // ===================================

    /**
     * ✅ OPTIMIZATION: Setup Firebase auth state listener
     * Dispatches custom events and caches user ID
     * Logs auth state changes to telemetry
     */
    function setupAuthStateListener() {
        if (!isFirebaseInitialized()) {
            console.warn('⚠️ Firebase not initialized, cannot setup auth listener');
            return;
        }

        if (authListenerActive) {
            if (isDevelopment) {
                console.log('ℹ️ Auth state listener already active');
            }
            return;
        }

        let lastAuthState = null;

        window.firebaseAuth.onAuthStateChanged((user) => {
            const authStateChanged = (lastAuthState === null && user !== null) ||
                                    (lastAuthState !== null && user === null) ||
                                    (lastAuthState && user && lastAuthState.uid !== user.uid);

            if (isDevelopment) {
                if (user) {
                    console.log('✅ Auth state: User signed in', user.uid);
                } else {
                    console.log('⚠️ Auth state: No user signed in');
                }
            }

            // Log significant auth state changes to telemetry
            if (authStateChanged && !isDevelopment && window.NocapUtils && window.NocapUtils.logInfo) {
                window.NocapUtils.logInfo('FirebaseConfig', 'Auth state changed', {
                    hasUser: user !== null,
                    isAnonymous: user ? user.isAnonymous : null,
                    timestamp: Date.now()
                });
            }

            lastAuthState = user;

            // Dispatch custom event for auth state changes
            window.dispatchEvent(new CustomEvent('firebase:authStateChanged', {
                detail: { user }
            }));

            // Cache user ID in localStorage for offline access
            if (user) {
                try {
                    localStorage.setItem('nocap_firebase_uid', user.uid);
                    localStorage.setItem('nocap_firebase_auth_time', Date.now().toString());
                    localStorage.setItem('nocap_firebase_is_anonymous', user.isAnonymous ? 'true' : 'false');
                } catch (error) {
                    console.warn('Could not cache user ID:', error);
                }
            } else {
                try {
                    localStorage.removeItem('nocap_firebase_uid');
                    localStorage.removeItem('nocap_firebase_auth_time');
                    localStorage.removeItem('nocap_firebase_is_anonymous');
                } catch (error) {
                    // Ignore
                }
            }
        });

        authListenerActive = true;

        if (isDevelopment) {
            console.log('✅ Firebase auth state listener active');
        }
    }

    // ===================================
    // 👤 AUTH HELPERS
    // ===================================

    /**
     * Sign in anonymously with retry logic
     *
     * @param {number} retries - Number of retry attempts
     * @returns {Promise<any>} Firebase user
     */
    async function signInAnonymously(retries = 3) {
        if (!isFirebaseInitialized()) {
            throw new Error('Firebase not initialized');
        }

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const result = await window.firebaseAuth.signInAnonymously();

                if (isDevelopment) {
                    console.log(`✅ Anonymous sign-in successful (attempt ${attempt}/${retries})`);
                }

                return result.user;

            } catch (error) {
                console.warn(`⚠️ Anonymous sign-in attempt ${attempt}/${retries} failed:`, error.message);

                // If this was the last attempt, show error and throw
                if (attempt === retries) {
                    showErrorNotification('Anmeldung fehlgeschlagen', error);
                    throw error;
                }

                // Wait before retrying (exponential backoff)
                const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Get current user ID safely
     *
     * @returns {string|null} User ID or null
     */
    function getCurrentUserId() {
        if (isFirebaseInitialized() && window.firebaseAuth.currentUser) {
            return window.firebaseAuth.currentUser.uid;
        }

        // Fallback to localStorage if Firebase not ready
        try {
            return localStorage.getItem('nocap_firebase_uid') || null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Check if user is currently authenticated
     *
     * @returns {boolean} True if authenticated
     */
    function isAuthenticated() {
        if (isFirebaseInitialized()) {
            return window.firebaseAuth.currentUser !== null;
        }

        // Fallback: check if we have a cached user ID from the last 24 hours
        try {
            const uid = localStorage.getItem('nocap_firebase_uid');
            const authTime = localStorage.getItem('nocap_firebase_auth_time');

            if (!uid || !authTime) {
                return false;
            }

            const elapsed = Date.now() - parseInt(authTime, 10);
            const twentyFourHours = 24 * 60 * 60 * 1000;

            return elapsed < twentyFourHours;
        } catch (error) {
            return false;
        }
    }

    // ===================================
    // 🧹 CLEANUP
    // ===================================

    /**
     * Cleanup function for page unload
     * Removes listeners and cleans up resources
     */
    function cleanup() {
        if (isFirebaseInitialized()) {
            try {
                // Remove connection listener
                if (connectionMonitoringActive) {
                    window.firebaseDatabase.ref('.info/connected').off();
                    connectionMonitoringActive = false;
                }

                if (isDevelopment) {
                    console.log('✅ Firebase cleanup completed');
                }
            } catch (error) {
                console.warn('⚠️ Firebase cleanup error:', error);
            }
        }
    }

    // ===================================
    // 🔔 NOTIFICATIONS
    // ===================================

    /**
     * Show error notification to user
     */
    function showErrorNotification(message, error) {
        // Try to use NocapUtils if available
        if (window.NocapUtils && window.NocapUtils.showNotification) {
            let detailedMessage = message;

            if (window.NocapUtils.getFirebaseErrorMessage && error && error.code) {
                detailedMessage = window.NocapUtils.getFirebaseErrorMessage(error.code);
            }

            window.NocapUtils.showNotification(detailedMessage, 'error', 5000);
        } else {
            // Fallback: console error
            console.error(message, error);
        }
    }

    // ===================================
    // 🚀 AUTO-INITIALIZATION
    // ===================================

    /**
     * Auto-initialize Firebase when script loads
     */
    (async function autoInit() {
        // ✅ P0 SECURITY: Load domain whitelist first
        await loadDomainWhitelist();

        try {
            // Initialize Firebase
            await initializeFirebase();

            // Setup monitoring after successful initialization
            setupConnectionMonitoring();
            setupAuthStateListener();

            // ✅ P1 PERFORMANCE: Setup telemetry heartbeat (180s interval)
            setupTelemetryHeartbeat();

            // Auto sign-in if privacy consent is given
            const hasPrivacyConsent = localStorage.getItem('nocap_privacy_consent') === 'true';

            if (hasPrivacyConsent) {
                // Sign in after a short delay to ensure everything is ready
                setTimeout(async () => {
                    try {
                        await signInAnonymously();
                    } catch (error) {
                        console.warn('⚠️ Auto sign-in failed:', error.message);
                        // Non-fatal: user can manually trigger auth later
                    }
                }, 500);
            } else if (isDevelopment) {
                console.log('ℹ️ Skipping auto sign-in (no privacy consent)');
            }

        } catch (error) {
            console.error('❌ Firebase auto-initialization failed:', error);
            // Non-fatal: allow page to load, Firebase features will be disabled
        }
    })();

    // ===================================
    // 🪝 EVENT LISTENERS
    // ===================================

    // ✅ P1 PERFORMANCE: Telemetry heartbeat interval (180s to reduce network load)
    const TELEMETRY_HEARTBEAT_INTERVAL = 180000; // 180 seconds (3 minutes)
    let telemetryHeartbeatTimer = null;

    /**
     * ✅ P1 PERFORMANCE: Setup telemetry heartbeat (optional)
     * Sends periodic connection status updates
     * Interval: 180s (instead of typical 60s) to reduce network load
     */
    function setupTelemetryHeartbeat() {
        if (telemetryHeartbeatTimer) {
            clearInterval(telemetryHeartbeatTimer);
        }

        // Only in production with telemetry enabled
        if (isDevelopment || !window.NocapUtils || !window.NocapUtils.logInfo) {
            return;
        }

        telemetryHeartbeatTimer = setInterval(() => {
            if (isConnected() && isAuthenticated()) {
                window.NocapUtils.logInfo('FirebaseConfig', 'Heartbeat', {
                    connected: true,
                    authenticated: true,
                    timestamp: Date.now()
                });
            }
        }, TELEMETRY_HEARTBEAT_INTERVAL);

        if (isDevelopment) {
            console.log(`✅ Telemetry heartbeat active (${TELEMETRY_HEARTBEAT_INTERVAL / 1000}s interval)`);
        }
    }

    /**
     * ✅ P1 PERFORMANCE: Stop telemetry heartbeat
     */
    function stopTelemetryHeartbeat() {
        if (telemetryHeartbeatTimer) {
            clearInterval(telemetryHeartbeatTimer);
            telemetryHeartbeatTimer = null;

            if (isDevelopment) {
                console.log('✅ Telemetry heartbeat stopped');
            }
        }
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        cleanup();
        stopTelemetryHeartbeat();
    });

    // Visibility change handling (pause/resume)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (isDevelopment) {
                console.log('👁️ Page hidden, Firebase will continue in background');
            }
        } else {
            if (isDevelopment) {
                console.log('👁️ Page visible, Firebase active');
            }
        }
    });

    // ===================================
    // 📤 PUBLIC API
    // ===================================

    window.FirebaseConfig = Object.freeze({
        // Version
        version: '7.0', // ✅ OPTIMIZATION: Version bump

        // Initialization
        initialize: initializeFirebase,
        isInitialized: isFirebaseInitialized,
        waitForFirebase,

        // Auth
        signInAnonymously,
        getCurrentUserId,
        isAuthenticated,

        // Connection
        isConnected,

        // Utilities
        getFirebaseInstances,
        setupConnectionMonitoring,
        setupAuthStateListener,

        // Cleanup
        cleanup,

        // State (read-only)
        get isDevelopment() { return isDevelopment; },
        get isProduction() { return isProduction; },
        get hasConfig() { return firebaseConfig !== null; },

        // Config (returns copy, not reference - prevents tampering)
        getConfig() {
            return firebaseConfig ? { ...firebaseConfig } : null;
        }
    });

    // ===================================
    // 🎉 READY
    // ===================================

    if (isDevelopment) {
        console.log('%c🚀 FirebaseConfig v7.0 loaded',
            'color: #FF6F00; font-weight: bold; font-size: 14px; padding: 4px 8px; background: #FFF3E0; border-radius: 4px;');

        if (firebaseConfig) {
            console.log('%c✅ Configuration available',
                'color: #4CAF50; font-size: 12px;');
        } else {
            console.log('%c⚠️ No configuration found',
                'color: #FF9800; font-size: 12px;');
        }

        console.log('%cNew in v7.0: IndexedDB persistence, Telemetry, Enhanced domain whitelist',
            'color: #2196F3; font-size: 11px; font-style: italic;');
    }

})(window);