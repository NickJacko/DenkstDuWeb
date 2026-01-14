(function () {
    "use strict";

    const isDevelopment =
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1" ||
        location.hostname.includes("192.168.");

    const isProduction = !isDevelopment;

    function getFirebaseConfig() {
        if (window.FIREBASE_CONFIG) return window.FIREBASE_CONFIG;

        const getMeta = (n) =>
            document.querySelector(`meta[name="firebase-${n}"]`)?.content || null;

        const apiKey = getMeta("api-key");
        if (!apiKey) return null;

        return {
            apiKey,
            authDomain: getMeta("auth-domain"),
            databaseURL: getMeta("database-url"),
            projectId: getMeta("project-id"),
            storageBucket: getMeta("storage-bucket"),
            messagingSenderId: getMeta("messaging-sender-id"),
            appId: getMeta("app-id"),
            measurementId: getMeta("measurement-id"),
        };
    }

    function validateConfig(config) {
        if (!config || typeof config !== "object") return false;
        if (!config.apiKey?.startsWith("AIza")) return false;
        return !!(config.authDomain && config.projectId);
    }

    function waitForFirebase(cb, timeout = 10000) {
        const start = Date.now();
        (function check() {
            if (window.firebase?.initializeApp) return cb();
            if (Date.now() - start > timeout) {
                console.error("❌ Firebase SDK timeout");
                return;
            }
            setTimeout(check, 50);
        })();
    }

    function initializeFirebase() {
        const config = getFirebaseConfig();
        if (!config || !validateConfig(config)) return;

        waitForFirebase(() => {
            try {
                if (!firebase.apps || firebase.apps.length === 0) {
                    firebase.initializeApp(config);

                    // 🔐 App Check (reCAPTCHA v3) - TEMPORÄR DEAKTIVIERT
                    // TODO: reCAPTCHA muss in Firebase Console für no-cap.app konfiguriert werden
                    if (firebase.appCheck && isProduction) {
                        try {
                            firebase.appCheck().activate(
                                "6LeEL0UsAAAAABN-JYDFEshwg9Qnmq09IyWzaJ9l", // SITE KEY
                                true
                            );

                            if (isDevelopment) {
                                console.log("✅ Firebase initialized + App Check active (Production)");
                            }
                        } catch (error) {
                            console.warn("⚠️ App Check activation failed:", error);
                            // Non-fatal: Continue without App Check
                        }
                    } else if (isDevelopment) {
                        console.log("⚠️ App Check disabled (Development mode)");
                    } else {
                        console.warn("⚠️ App Check TEMPORARILY DISABLED (reCAPTCHA misconfigured)");
                    }

                    // ✅ FIX: Set global flag for other scripts to detect initialization
                    window.firebaseInitialized = true;

                    if (isDevelopment) {
                        console.log("✅ Firebase initialized");
                    }
                }
            } catch (e) {
                console.error("❌ Firebase init failed", e);
            }
        });
    }

    // ===============================
    // AUTO INIT
    // ===============================
    initializeFirebase();

    window.addEventListener("firebase:configLoaded", initializeFirebase);
})();
