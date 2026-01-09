(function () {
    "use strict";

    const isDevelopment =
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1" ||
        location.hostname.includes("192.168.");

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

                    // 🔐 App Check (reCAPTCHA v3)
                    if (firebase.appCheck) {
                        if (isDevelopment) {
                            self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
                        }

                        firebase.appCheck().activate(
                            "6LeEL0UsAAAAABN-JYDFEshwg9Qnmq09IyWzaJ9l", // SITE KEY
                            true
                        );
                    }

                    if (isDevelopment) {
                        console.log("✅ Firebase initialized + App Check active");
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
