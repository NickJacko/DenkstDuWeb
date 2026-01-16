"use strict";

const functions = require("firebase-functions"); // Gen1 only
const admin = require("firebase-admin");

// Init Admin SDK exactly once
if (admin.apps.length === 0) {
    admin.initializeApp();
}

// --------------------
// LOGGER (fixed levels)
// --------------------
const log = {
    info: (functionName, message, data = {}) => {
        functions.logger.info(`[${functionName}] ${message}`, data);
    },
    warn: (functionName, message, data = {}) => {
        functions.logger.warn(`[${functionName}] ${message}`, data);
    },
    error: (functionName, message, error, data = {}) => {
        functions.logger.error(`[${functionName}] ${message}`, {
            error: error?.message || error,
            stack: error?.stack,
            ...data,
        });
    },
    security: (functionName, message, data = {}) => {
        functions.logger.warn(`[SECURITY][${functionName}] ${message}`, data);
    },
};

// --------------------
// AUTH HELPERS (Gen1)
// --------------------
function requireAuth(context) {
    if (!context?.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentifizierung erforderlich");
    }
    return context.auth;
}

function requireClaims(context, requiredClaims = []) {
    const auth = requireAuth(context);
    for (const claim of requiredClaims) {
        if (!auth.token?.[claim]) {
            throw new functions.https.HttpsError("permission-denied", `Fehlende Berechtigung: ${claim}`);
        }
    }
    return auth;
}

/**
 * ✅ P1 DSGVO: Auto-delete expired games
 * Runs every hour and removes games older than 24 hours
 */
exports.cleanupOldGames = functions
    .region("europe-west1")
    .runWith({ memory: "256MB", timeoutSeconds: 60 })
    .pubsub.schedule("0 * * * *")
    .onRun(async () => {
        const now = Date.now();
        const db = admin.database();

        try {
            log.info("cleanupOldGames", "Starting game cleanup...");

            const snapshot = await db.ref("games").once("value");
            const games = snapshot.val();

            if (!games) {
                log.info("cleanupOldGames", "No games to clean up");
                return null;
            }

            const deletions = [];
            let deletedCount = 0;

            Object.keys(games).forEach((gameId) => {
                const game = games[gameId];

                if (game.ttl && game.ttl < now) {
                    deletions.push(db.ref(`games/${gameId}`).remove());
                    deletedCount++;
                } else if (game.createdAt && now - game.createdAt > 24 * 60 * 60 * 1000) {
                    deletions.push(db.ref(`games/${gameId}`).remove());
                    deletedCount++;
                }
            });

            if (deletions.length) {
                await Promise.all(deletions);
                log.info("cleanupOldGames", `Deleted ${deletedCount} expired games`);
            } else {
                log.info("cleanupOldGames", "No expired games found");
            }

            return null;
        } catch (error) {
            log.error("cleanupOldGames", "Error during cleanup", error);
            throw error;
        }
    });

/**
 * ✅ P1 DSGVO: Auto-delete temp files older than 24h
 * Runs daily at 2 AM (Europe/Berlin time)
 */
exports.cleanupTempFiles = functions
    .region("europe-west1")
    .runWith({ memory: "256MB", timeoutSeconds: 120 })
    .pubsub.schedule("0 2 * * *")
    .onRun(async () => {
        const bucket = admin.storage().bucket();
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000;

        try {
            log.info("cleanupTempFiles", "Starting temp files cleanup...");

            const [files] = await bucket.getFiles({ prefix: "temp/" });

            if (!files?.length) {
                log.info("cleanupTempFiles", "No temp files to clean up");
                return null;
            }

            const deletePromises = [];
            let deletedCount = 0;

            for (const file of files) {
                const created = new Date(file.metadata.timeCreated).getTime();
                if (now - created > maxAge) {
                    deletePromises.push(file.delete());
                    deletedCount++;
                }
            }

            if (deletePromises.length) {
                await Promise.all(deletePromises);
                log.info("cleanupTempFiles", `Deleted ${deletedCount} temp files`);
            } else {
                log.info("cleanupTempFiles", "No expired temp files found");
            }

            return null;
        } catch (error) {
            log.error("cleanupTempFiles", "Error during temp files cleanup", error);
            throw error;
        }
    });


/**
 * ✅ P1 DSGVO: Delete user data on account deletion (Gen1 trigger)
 */
exports.cleanupUserData = functions
    .region("europe-west1")
    .auth.user()
    .onDelete(async (user) => {
        const uid = user.uid;
        const db = admin.database();
        const bucket = admin.storage().bucket();

        try {
            log.info("cleanupUserData", "Cleaning up data for deleted user", { uid });

            // 1) User profile
            await db.ref(`users/${uid}`).remove();

            // 2) Avatars
            try {
                const [files] = await bucket.getFiles({ prefix: `avatars/${uid}/` });
                if (files?.length) {
                    await Promise.all(files.map((f) => f.delete()));
                    log.info("cleanupUserData", "Deleted avatar files", { uid, count: files.length });
                }
            } catch (storageError) {
                log.error("cleanupUserData", "Error deleting avatars (non-fatal)", storageError, { uid });
            }

            // 3) Remove user from games / delete hosted games
            const gamesSnapshot = await db.ref("games").once("value");
            const games = gamesSnapshot.val();

            if (games) {
                const updates = {};

                Object.keys(games).forEach((gameId) => {
                    const game = games[gameId];
                    if (game?.players?.[uid]) updates[`games/${gameId}/players/${uid}`] = null;
                    if (game?.hostId === uid) updates[`games/${gameId}`] = null;
                });

                if (Object.keys(updates).length > 0) {
                    await db.ref().update(updates);
                }
            }

            log.info("cleanupUserData", "User data cleanup completed", { uid });
            return null;
        } catch (error) {
            log.error("cleanupUserData", "Error during user data cleanup", error, { uid });
            throw error;
        }
    });

/**
 * ✅ HTTPS endpoint (CORS) validate FSK access (Gen1 HTTPS)
 */
exports.validateFSKAccess = functions
    .region("europe-west1")
    .runWith({ memory: "256MB", timeoutSeconds: 10 })
    .https.onRequest(async (req, res) => {
        const functionName = "validateFSKAccess";

        const allowedOrigins = new Set([
            "https://no-cap.app",
            "https://denkstduwebsite.web.app",
            "https://denkstduwebsite.firebaseapp.com",
            "http://localhost:5000",
        ]);

        const origin = req.headers.origin;
        const normalizedOrigin = typeof origin === "string" ? origin.replace(/\/$/, "") : null;

        if (normalizedOrigin && allowedOrigins.has(normalizedOrigin)) {
            res.setHeader("Access-Control-Allow-Origin", normalizedOrigin);
            res.setHeader("Vary", "Origin");
        }

        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.set("Access-Control-Allow-Credentials", "true");
        res.set("Access-Control-Max-Age", "3600");

        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                log.warn(functionName, "Missing or invalid authorization header");
                return res.status(401).json({ error: "Authentifizierung erforderlich" });
            }

            const idToken = authHeader.split("Bearer ")[1];

            let decodedToken;
            try {
                decodedToken = await admin.auth().verifyIdToken(idToken);
            } catch {
                log.warn(functionName, "Invalid auth token");
                return res.status(401).json({ error: "Ungültiges Authentifizierungs-Token" });
            }

            const uid = decodedToken.uid;
            const { category } = req.body?.data || req.body || {};

            if (!category || typeof category !== "string") {
                log.warn(functionName, "Invalid category parameter", { uid, category });
                return res.status(400).json({ error: "Kategorie ist erforderlich" });
            }

            if (category === "fsk0" || category === "special") {
                return res.status(200).json({ result: { allowed: true, category } });
            }

            const userSnapshot = await admin.database().ref(`users/${uid}`).once("value");
            const userData = userSnapshot.val();

            if (!userData?.ageVerified) {
                return res.status(200).json({
                    result: { allowed: false, reason: "age_not_verified", message: "Altersverifikation erforderlich" },
                });
            }

            const ageLevel = Number(userData.ageLevel || 0);

            if (category === "fsk16" && ageLevel < 16) {
                return res
                    .status(200)
                    .json({ result: { allowed: false, reason: "age_too_young", message: "FSK 16 erforderlich" } });
            }

            if (category === "fsk18" && ageLevel < 18) {
                return res
                    .status(200)
                    .json({ result: { allowed: false, reason: "age_too_young", message: "FSK 18 erforderlich" } });
            }

            return res.status(200).json({ result: { allowed: true, category } });
        } catch (error) {
            log.error(functionName, "FSK validation error", error);
            return res.status(500).json({ error: "Fehler bei der FSK-Validierung" });
        }
    });

/**
 * ✅ Callable Variante (Browser-friendly) (Gen1 Callable)
 */
exports.validateFSKAccessCallable = functions
    .region("europe-west1")
    .runWith({ memory: "256MB", timeoutSeconds: 10 })
    .https.onCall(async (data, context) => {
        const functionName = "validateFSKAccessCallable";

        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Authentifizierung erforderlich");
        }

        const uid = context.auth.uid;
        const category = data?.category;

        if (!category || typeof category !== "string") {
            throw new functions.https.HttpsError("invalid-argument", "Kategorie ist erforderlich");
        }

        if (category === "fsk0" || category === "special") return { allowed: true, category };

        const userSnapshot = await admin.database().ref(`users/${uid}`).once("value");
        const userData = userSnapshot.val();

        if (!userData?.ageVerified) {
            return { allowed: false, reason: "age_not_verified", message: "Altersverifikation erforderlich" };
        }

        const ageLevel = Number(userData.ageLevel || 0);

        if (category === "fsk16" && ageLevel < 16) return { allowed: false, reason: "age_too_young", message: "FSK 16 erforderlich" };
        if (category === "fsk18" && ageLevel < 18) return { allowed: false, reason: "age_too_young", message: "FSK 18 erforderlich" };

        return { allowed: true, category };
    });

/**
 * ✅ P1 DSGVO: Export user data (GDPR Art. 20) (Gen1 Callable)
 */
exports.exportUserData = functions
    .region("europe-west1")
    .runWith({ memory: "512MB", timeoutSeconds: 60 })
    .https.onCall(async (data, context) => {
        const functionName = "exportUserData";

        // Admin-only
        requireClaims(context, ["admin"]);

        const uid = context.auth.uid;
        const db = admin.database();

        try {
            log.info(functionName, "Starting user data export", { uid });

            const userData = {};

            const userSnapshot = await db.ref(`users/${uid}`).once("value");
            userData.profile = userSnapshot.val();

            const gamesSnapshot = await db.ref("games").once("value");
            const games = gamesSnapshot.val();

            userData.games = [];
            if (games) {
                Object.keys(games).forEach((gameId) => {
                    const game = games[gameId];
                    if (game?.players?.[uid]) {
                        userData.games.push({
                            gameId,
                            createdAt: game.createdAt,
                            isHost: game.hostId === uid,
                            playerData: game.players[uid],
                        });
                    }
                });
            }

            return { exportDate: new Date().toISOString(), userId: uid, data: userData };
        } catch (error) {
            log.error(functionName, "User data export error", error, { uid });
            throw new functions.https.HttpsError("internal", "Fehler beim Datenexport");
        }
    });

/**
 * ✅ P0 SECURITY: Set user age verification (Admin only) (Gen1 Callable)
 */
exports.setAgeVerification = functions
    .region("europe-west1")
    .runWith({ memory: "256MB", timeoutSeconds: 10 })
    .https.onCall(async (data, context) => {
        const functionName = "setAgeVerification";

        // ✅ vorher: requireClaims(context, ["admin"]);
        requireAuth(context);

        const uid = context.auth.uid;
        const { ageLevel, verificationMethod } = data || {};

        if (typeof ageLevel !== "number" || ageLevel < 0 || ageLevel > 150) {
            throw new functions.https.HttpsError("invalid-argument", "Ungültiges ageLevel");
        }

        try {
            const db = admin.database();
            await db.ref(`users/${uid}`).update({
                ageVerified: true,
                ageLevel,
                ageVerificationMethod: String(verificationMethod || "unknown"),
                ageVerifiedAt: admin.database.ServerValue.TIMESTAMP,
            });

            // ✅ optional aber empfohlen: Claims mergen statt überschreiben
            const user = await admin.auth().getUser(uid);
            const existing = user.customClaims || {};
            const nextClaims = { ...existing };

            if (ageLevel >= 16) nextClaims.fsk16 = true;
            else delete nextClaims.fsk16;

            if (ageLevel >= 18) nextClaims.fsk18 = true;
            else delete nextClaims.fsk18;

            await admin.auth().setCustomUserClaims(uid, nextClaims);

            log.info(functionName, "Age verification set", { uid, ageLevel });
            return { success: true };
        } catch (error) {
            log.error(functionName, "Failed to set age verification", error, { uid });
            throw new functions.https.HttpsError("internal", "Fehler bei der Altersverifikation");
        }
    });
/**
 * ✅ P0 SECURITY: Check premium status (Gen1 Callable)
 * Returns { hasPremium: boolean }
 */
exports.checkPremiumStatus = functions
    .region("europe-west1")
    .runWith({ memory: "256MB", timeoutSeconds: 10 })
    .https.onCall(async (data, context) => {
        const functionName = "checkPremiumStatus";

        // ✅ nur eingeloggte Nutzer
        requireAuth(context);

        try {
            // 1) Erst Token-Claims prüfen (schnell)
            const token = context.auth.token || {};
            const tokenPremium =
                token.premium === true ||
                token.stripeRole === "premium" ||
                token.stripeRole === "pro";

            if (tokenPremium) {
                return { hasPremium: true };
            }

            // 2) Falls Token noch nicht refreshed: serverseitig aktuellste Claims holen
            const uid = context.auth.uid;
            const user = await admin.auth().getUser(uid);
            const claims = user.customClaims || {};

            const hasPremium =
                claims.premium === true ||
                claims.stripeRole === "premium" ||
                claims.stripeRole === "pro";

            return { hasPremium: hasPremium === true };
        } catch (error) {
            log.error(functionName, "Premium check failed", error, { uid: context?.auth?.uid });
            throw new functions.https.HttpsError("internal", "Premium check failed");
        }
    });

// --------------------
// Re-exports (other files)
// --------------------

// account-deletion exports
exports.scheduleAccountDeletion = require("./account-deletion").scheduleAccountDeletion;
exports.cancelAccountDeletion = require("./account-deletion").cancelAccountDeletion;
exports.processScheduledDeletions = require("./account-deletion").processScheduledDeletions;

// realtime-security exports
exports.validateGameUpdate = require("./realtime-security").validateGameUpdate;
exports.detectRapidUpdates = require("./realtime-security").detectRapidUpdates;
exports.monitorGameDeletion = require("./realtime-security").monitorGameDeletion;
exports.cleanupOldViolations = require("./realtime-security").cleanupOldViolations;

/**
 * ✅ Simple health-check endpoint (Gen1)
 */
exports.ping = functions.https.onRequest((req, res) => {
    res.status(200).send("ok");
});
