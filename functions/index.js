"use strict";

const functions = require("firebase-functions/v1"); // Gen1 only
const admin = require("firebase-admin");

// Init Admin SDK exactly once (robust for tests/stubs)
const hasAppsArray = Array.isArray(admin.apps);

if (!hasAppsArray || admin.apps.length === 0) {
    if (typeof admin.initializeApp === 'function') {
        admin.initializeApp();
    }
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
 * ✅ FSK0 & FSK16: Always allowed (no verification)
 * ✅ FSK18: Requires age verification
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

            // ✅ FSK0 & FSK16 always allowed (no verification needed)
            if (category === "fsk0" || category === "fsk16" || category === "special") {
                return res.status(200).json({ result: { allowed: true, category } });
            }

            // ✅ FSK18 requires age verification
            if (category === "fsk18") {
                const userSnapshot = await admin.database().ref(`users/${uid}`).once("value");
                const userData = userSnapshot.val();

                if (!userData?.ageVerified) {
                    return res.status(200).json({
                        result: {
                            allowed: false,
                            reason: "age_not_verified",
                            message: "Altersverifikation erforderlich"
                        },
                    });
                }

                const ageLevel = Number(userData.ageLevel || 0);

                if (ageLevel < 18) {
                    return res.status(200).json({
                        result: {
                            allowed: false,
                            reason: "age_too_young",
                            message: "FSK 18 erforderlich"
                        }
                    });
                }

                return res.status(200).json({ result: { allowed: true, category } });
            }

            // Unknown category
            return res.status(400).json({ error: "Unbekannte Kategorie" });

        } catch (error) {
            log.error(functionName, "FSK validation error", error);
            return res.status(500).json({ error: "Fehler bei der FSK-Validierung" });
        }
    });

/**
 * ✅ Callable Variante (Browser-friendly) (Gen1 Callable)
 * ✅ FSK0 & FSK16: Always allowed (no verification)
 * ✅ FSK18: Requires age verification
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

        // ✅ FSK0 & FSK16 always allowed (no verification needed)
        if (category === "fsk0" || category === "fsk16" || category === "special") {
            return { allowed: true, category };
        }

        // ✅ FSK18 requires age verification
        if (category === "fsk18") {
            const userSnapshot = await admin.database().ref(`users/${uid}`).once("value");
            const userData = userSnapshot.val();

            if (!userData?.ageVerified) {
                return {
                    allowed: false,
                    reason: "age_not_verified",
                    message: "Altersverifikation erforderlich"
                };
            }

            const ageLevel = Number(userData.ageLevel || 0);

            if (ageLevel < 18) {
                return {
                    allowed: false,
                    reason: "age_too_young",
                    message: "FSK 18 erforderlich"
                };
            }

            return { allowed: true, category };
        }

        // Unknown category
        throw new functions.https.HttpsError("invalid-argument", "Unbekannte Kategorie");
    });

/**
 * ✅ P1 DSGVO: Export user data (GDPR Art. 20) (Gen1 Callable)
 */
exports.exportUserData = functions
    .region("europe-west1")
    .runWith({ memory: "512MB", timeoutSeconds: 60 })
    .https.onCall(async (data, context) => {
        const functionName = "exportUserData";

        // User can export their own data
        requireAuth(context);

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
 * ✅ P0 SECURITY: Set user age verification (Gen1 Callable)
 * ✅ FSK16 is NO LONGER stored in custom claims (always allowed)
 * ✅ FSK18 requires age >= 18
 */
exports.setAgeVerification = functions
    .region("europe-west1")
    .runWith({ memory: "256MB", timeoutSeconds: 10 })
    .https.onCall(async (data, context) => {
        const functionName = "setAgeVerification";

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

            // ✅ Set custom claims - ONLY FSK18 needs a claim
            const user = await admin.auth().getUser(uid);
            const existing = user.customClaims || {};
            const nextClaims = { ...existing };

            // ✅ FSK16 is NO LONGER stored (always allowed)
            delete nextClaims.fsk16;

            // ✅ FSK18 only if 18+
            if (ageLevel >= 18) {
                nextClaims.fsk18 = true;
            } else {
                delete nextClaims.fsk18;
            }

            await admin.auth().setCustomUserClaims(uid, nextClaims);

            log.info(functionName, "Age verification set", { uid, ageLevel, fsk18: ageLevel >= 18 });

            return {
                success: true,
                fskAccess: {
                    fsk0: true,
                    fsk16: true,
                    fsk18: ageLevel >= 18
                }
            };
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

        requireAuth(context);

        try {
            // 1) Token-Claims prüfen (schnell)
            const token = context.auth.token || {};
            const tokenPremium =
                token.premium === true ||
                token.stripeRole === "premium" ||
                token.stripeRole === "pro";

            if (tokenPremium) {
                return { hasPremium: true };
            }

            // 2) Fallback: Serverseitig aktuellste Claims holen
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

/**
 * ✅ P0 SECURITY: Check access for a category (Gen1 Callable)
 * ✅ FSK0 & FSK16: Always allowed (no verification)
 * ✅ FSK18: Requires fsk18 claim
 * ✅ special: Requires premium
 */
exports.checkCategoryAccess = functions
    .region("europe-west1")
    .runWith({ memory: "256MB", timeoutSeconds: 10 })
    .https.onCall(async (data, context) => {
        const functionName = "checkCategoryAccess";

        requireAuth(context);

        const categoryId = String(data?.categoryId || "").trim();

        if (!categoryId) {
            throw new functions.https.HttpsError("invalid-argument", "categoryId fehlt");
        }

        const allowedCategories = new Set(["fsk0", "fsk16", "fsk18", "special"]);
        if (!allowedCategories.has(categoryId)) {
            throw new functions.https.HttpsError("invalid-argument", "Unbekannte Kategorie");
        }

        try {
            // Token-Claims
            const token = context.auth.token || {};

            // ✅ FSK0 & FSK16 always allowed
            if (categoryId === "fsk0" || categoryId === "fsk16") {
                return { allowed: true };
            }

            // ✅ special requires premium
            if (categoryId === "special") {
                const tokenPremium =
                    token.premium === true ||
                    token.stripeRole === "premium" ||
                    token.stripeRole === "pro";

                if (tokenPremium) return { allowed: true };

                // Fallback: Server-side claims
                const uid = context.auth.uid;
                const user = await admin.auth().getUser(uid);
                const claims = user.customClaims || {};

                const hasPremium =
                    claims.premium === true ||
                    claims.stripeRole === "premium" ||
                    claims.stripeRole === "pro";

                if (hasPremium) return { allowed: true };

                throw new functions.https.HttpsError("permission-denied", "Premium erforderlich");
            }

            // ✅ FSK18 requires fsk18 claim
            if (categoryId === "fsk18") {
                const tokenFsk18 = token.fsk18 === true;

                if (tokenFsk18) return { allowed: true };

                // Fallback: Server-side claims
                const uid = context.auth.uid;
                const user = await admin.auth().getUser(uid);
                const claims = user.customClaims || {};

                if (claims.fsk18 === true) return { allowed: true };

                throw new functions.https.HttpsError("permission-denied", "FSK18 nicht erlaubt");
            }

            // Default deny
            return { allowed: false };

        } catch (error) {
            log.error(functionName, "Category access check failed", error, {
                uid: context?.auth?.uid,
                categoryId
            });

            if (error instanceof functions.https.HttpsError) throw error;
            throw new functions.https.HttpsError("internal", "Category access check failed");
        }
    });

// --------------------
// SECURE MULTIPLAYER: create/join via Callable
// --------------------

// helper: random game code (6 chars A-Z0-9)
function generateGameCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing I/O/1/0
    let out = "";
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

// helper: normalize & validate categories
function normalizeCategories(input) {
    const allowed = new Set(["fsk0", "fsk16", "fsk18", "special"]);
    const arr = Array.isArray(input) ? input : [];
    const cleaned = arr.map(v => String(v || "").trim()).filter(Boolean);

    if (!cleaned.length) {
        throw new functions.https.HttpsError("invalid-argument", "selectedCategories darf nicht leer sein");
    }

    for (const c of cleaned) {
        if (!allowed.has(c)) {
            throw new functions.https.HttpsError("invalid-argument", `Unbekannte Kategorie: ${c}`);
        }
    }

    // de-dupe
    return Array.from(new Set(cleaned));
}

/**
 * ✅ Helper: Assert category is allowed for user
 * ✅ FSK0 & FSK16: Always allowed (no check)
 * ✅ FSK18: Requires fsk18 claim
 * ✅ special: Requires premium
 */
async function assertCategoryAllowed(categoryId, context) {
    // ✅ FSK0 & FSK16 always allowed (no age check)
    if (categoryId === "fsk0" || categoryId === "fsk16") {
        return true;
    }

    const token = context.auth?.token || {};

    // ✅ special requires premium
    if (categoryId === "special") {
        const tokenPremium =
            token.premium === true ||
            token.stripeRole === "premium" ||
            token.stripeRole === "pro";

        if (tokenPremium) return true;

        // Fallback: latest server claims
        const user = await admin.auth().getUser(context.auth.uid);
        const claims = user.customClaims || {};
        const hasPremium =
            claims.premium === true ||
            claims.stripeRole === "premium" ||
            claims.stripeRole === "pro";

        if (hasPremium) return true;

        throw new functions.https.HttpsError("permission-denied", "Premium erforderlich");
    }

    // ✅ FSK18 requires fsk18 claim
    if (categoryId === "fsk18") {
        const tokenFsk18 = token.fsk18 === true;

        if (tokenFsk18) return true;

        // Fallback: Server claims
        const user = await admin.auth().getUser(context.auth.uid);
        const claims = user.customClaims || {};

        if (claims.fsk18 === true) return true;

        throw new functions.https.HttpsError("permission-denied", "FSK18 nicht erlaubt");
    }

    // Default deny
    throw new functions.https.HttpsError("permission-denied", "Kategorie nicht erlaubt");
}

/**
 * ✅ Secure: Create multiplayer game (Gen1 Callable)
 */
exports.createGameSecure = functions
    .region("europe-west1")
    .runWith({ memory: "256MB", timeoutSeconds: 10 })
    .https.onCall(async (data, context) => {
        const functionName = "createGameSecure";
        requireAuth(context);

        const uid = context.auth.uid;
        const playerName = String(data?.playerName || "").trim();
        const difficulty = String(data?.difficulty || "easy").trim();
        const alcoholMode = Boolean(data?.alcoholMode);

        if (playerName.length < 2 || playerName.length > 15) {
            throw new functions.https.HttpsError("invalid-argument", "playerName muss 2-15 Zeichen haben");
        }

        if (!["easy", "medium", "hard"].includes(difficulty)) {
            throw new functions.https.HttpsError("invalid-argument", "Ungültige difficulty");
        }

        const selectedCategories = normalizeCategories(data?.selectedCategories);

        // ✅ Enforce access for each selected category
        for (const c of selectedCategories) {
            await assertCategoryAllowed(c, context);
        }

        const db = admin.database();
        const now = Date.now();
        const ttl = now + 24 * 60 * 60 * 1000;

        // Create unique gameId
        const gameRef = db.ref("games").push();
        const gameId = gameRef.key;

        // Ensure unique gameCode
        let gameCode = null;
        for (let attempt = 0; attempt < 5; attempt++) {
            const candidate = generateGameCode();
            const snap = await db.ref(`gameCodes/${candidate}`).once("value");
            if (!snap.exists()) {
                gameCode = candidate;
                break;
            }
        }
        if (!gameCode) {
            log.error(functionName, "Could not generate unique gameCode", null, { uid });
            throw new functions.https.HttpsError("internal", "GameCode konnte nicht erzeugt werden");
        }

        // Premium check
        const token = context.auth.token || {};
        const isPremium =
            token.premium === true ||
            token.stripeRole === "premium" ||
            token.stripeRole === "pro";

        const settings = {
            categories: selectedCategories,
            difficulty,
            alcoholMode,
            maxPlayers: 8
        };

        const gameData = {
            hostId: uid,
            gameCode,
            status: "lobby",
            phase: "lobby",
            settings,
            createdAt: now,
            lastActivity: now,
            ttl,
            players: {
                [uid]: {
                    name: playerName,
                    isHost: true,
                    isReady: false,
                    isPremium: Boolean(isPremium),
                    joinedAt: now
                }
            }
        };

        await gameRef.set(gameData);

        // RTDB format for categories
        const categoriesObj = {};
        selectedCategories.forEach((c, i) => (categoriesObj[String(i)] = c));

        await db.ref(`gameCodes/${gameCode}`).set({
            gameId,
            hostId: uid,
            status: "lobby",
            maxPlayers: 8,
            categories: categoriesObj,
            difficulty,
            createdAt: now
        });

        log.info(functionName, "Game created", { uid, gameId, gameCode, selectedCategories });
        return { gameId, gameCode };
    });

/**
 * ✅ Secure: Join multiplayer game via code (Gen1 Callable)
 */
exports.joinGameSecure = functions
    .region("europe-west1")
    .runWith({ memory: "256MB", timeoutSeconds: 10 })
    .https.onCall(async (data, context) => {
        const functionName = "joinGameSecure";
        requireAuth(context);

        const uid = context.auth.uid;
        const gameCode = String(data?.gameCode || "").trim().toUpperCase();
        const playerName = String(data?.playerName || "").trim();

        if (!gameCode || !/^[A-Z0-9]{6}$/.test(gameCode)) {
            throw new functions.https.HttpsError("invalid-argument", "Ungültiger gameCode");
        }
        if (playerName.length < 2 || playerName.length > 15) {
            throw new functions.https.HttpsError("invalid-argument", "playerName muss 2-15 Zeichen haben");
        }

        const db = admin.database();

        // 1) Code -> gameId
        const codeSnap = await db.ref(`gameCodes/${gameCode}`).once("value");
        if (!codeSnap.exists()) {
            throw new functions.https.HttpsError("not-found", "Spiel nicht gefunden");
        }

        const codeData = codeSnap.val();
        const gameId = codeData.gameId;
        if (!gameId) {
            throw new functions.https.HttpsError("not-found", "Spiel nicht gefunden");
        }

        // 2) Game laden
        const gameSnap = await db.ref(`games/${gameId}`).once("value");
        if (!gameSnap.exists()) {
            throw new functions.https.HttpsError("not-found", "Spiel nicht gefunden");
        }
        const game = gameSnap.val() || {};

        // Categories
        const categories = Array.isArray(game.settings?.categories)
            ? game.settings.categories
            : (game.selectedCategories ? Object.values(game.selectedCategories) : []);

        // ✅ Enforce access
        for (const c of categories) {
            await assertCategoryAllowed(String(c), context);
        }

        // ✅ Lobby-Status prüfen
        const status = String(game.status || game.phase || "lobby");
        if (status !== "lobby") {
            throw new functions.https.HttpsError("failed-precondition", "Beitritt nur in der Lobby möglich");
        }

        const now = Date.now();

        const token = context.auth.token || {};
        const isPremium =
            token.premium === true ||
            token.stripeRole === "premium" ||
            token.stripeRole === "pro";

        // Write player
        await db.ref(`games/${gameId}/players/${uid}`).set({
            name: playerName,
            isHost: false,
            isReady: false,
            isPremium: Boolean(isPremium),
            joinedAt: now
        });

        // Update activity
        await db.ref(`games/${gameId}/lastActivity`).set(now);

        log.info(functionName, "Player joined", { uid, gameId, gameCode });
        return { gameId };
    });

// --------------------
// Lazy-load (prevents deploy discovery timeout)
// --------------------
let accountDeletion, realtimeSecurity;

// Account Deletion Functions
exports.scheduleAccountDeletion = functions
    .region("europe-west1")
    .https.onCall(async (data, context) => {
        if (!accountDeletion) {
            accountDeletion = require("./account-deletion");
        }
        return accountDeletion.scheduleAccountDeletion(data, context);
    });

exports.cancelAccountDeletion = functions
    .region("europe-west1")
    .https.onCall(async (data, context) => {
        if (!accountDeletion) {
            accountDeletion = require("./account-deletion");
        }
        return accountDeletion.cancelAccountDeletion(data, context);
    });

exports.processScheduledDeletions = functions
    .region("europe-west1")
    .runWith({ memory: "512MB", timeoutSeconds: 120 })
    .pubsub.schedule("0 3 * * *") // 3 AM täglich
    .onRun(async () => {
        if (!accountDeletion) {
            accountDeletion = require("./account-deletion");
        }
        return accountDeletion.processScheduledDeletions();
    });

// Realtime Security Functions
exports.validateGameUpdate = functions
    .region("europe-west1")
    .database.ref("games/{gameId}")
    .onUpdate(async (change, context) => {
        if (!realtimeSecurity) {
            realtimeSecurity = require("./realtime-security");
        }
        return realtimeSecurity.validateGameUpdate(change, context);
    });

exports.detectRapidUpdates = functions
    .region("europe-west1")
    .database.ref("games/{gameId}")
    .onWrite(async (snap, context) => {
        if (!realtimeSecurity) {
            realtimeSecurity = require("./realtime-security");
        }
        return realtimeSecurity.detectRapidUpdates(snap, context);
    });

exports.monitorGameDeletion = functions
    .region("europe-west1")
    .database.ref("games/{gameId}")
    .onDelete(async (snap, context) => {
        if (!realtimeSecurity) {
            realtimeSecurity = require("./realtime-security");
        }
        return realtimeSecurity.monitorGameDeletion(snap, context);
    });

exports.cleanupOldViolations = functions
    .region("europe-west1")
    .runWith({ memory: "256MB", timeoutSeconds: 60 })
    .pubsub.schedule("0 4 * * *") // 4 AM täglich
    .onRun(async () => {
        if (!realtimeSecurity) {
            realtimeSecurity = require("./realtime-security");
        }
        return realtimeSecurity.cleanupOldViolations();
    });

/**
 * ✅ Simple health-check endpoint (Gen1)
 */
exports.ping = functions.https.onRequest((req, res) => {
    res.status(200).send("ok");
});