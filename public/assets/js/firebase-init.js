(function () {
    "use strict";

    const isDevelopment =
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1" ||
        location.hostname.includes("192.168.");

    const isProduction = !isDevelopment;

    function getFirebaseConfig() {
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
            appCheckKey: getMeta("app-check-key"),
        };

    }

    function validateConfig(config) {
        if (!config || typeof config !== "object") return false;
        if (!config.apiKey || typeof config.apiKey !== "string") return false;
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
        if (!config || !validateConfig(config)) {
            console.error("❌ Firebase config missing/invalid. Check meta tags (firebase-*) in <head>.");
            return;
        }

        waitForFirebase(() => {
            try {
                if (!firebase.apps || firebase.apps.length === 0) {
                    firebase.initializeApp(config);

                    // 🔐 App Check (reCAPTCHA v3) - ✅ No hardcoded fallback key
                    const appCheckKey =
                        window.FIREBASE_APP_CHECK_KEY ||
                        config.appCheckKey ||
                        null;

                    if (firebase.appCheck && appCheckKey) {
                        try {
                            firebase.appCheck().activate(appCheckKey, true);

                            console.log(
                                isDevelopment
                                    ? "✅ Firebase initialized + App Check active (dev)"
                                    : "✅ Firebase initialized + App Check active (prod)"
                            );

                        } catch (error) {
                            console.warn("⚠️ App Check activation failed (continuing without):", error);
                        }
                    } else {
                        // No key or SDK -> run without App Check (non-fatal)
                        if (isProduction) {
                            console.warn("⚠️ App Check not active (missing key or SDK)");
                        } else if (isDevelopment) {
                            console.log("ℹ️ App Check not active in dev (missing key or SDK)");
                        }
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
