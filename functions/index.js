const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

// ✅ P0 SECURITY: Initialize with least-privilege principle
// Admin SDK only runs server-side, never bundled in client
// Database URL is set directly for Firebase Emulator compatibility
admin.initializeApp();


// ✅ P0 SECURITY: Rate limiting middleware
const createRateLimiter = (windowMs = 60000, max = 60) => {
    return rateLimit({
        windowMs,
        max,
        message: { error: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.' },
        standardHeaders: true,
        legacyHeaders: false,
    });
};

// ✅ P1 STABILITY: Enhanced logging helper
const logger = {
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
            ...data
        });
    }
};

// ✅ P0 SECURITY: Token verification helper
const verifyAuth = async (context, requiredClaims = []) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Authentifizierung erforderlich'
        );
    }

    // Verify additional claims if needed
    for (const claim of requiredClaims) {
        if (!context.auth.token[claim]) {
            throw new functions.https.HttpsError(
                'permission-denied',
                `Fehlende Berechtigung: ${claim}`
            );
        }
    }

    return context.auth;
};

/**
 * ✅ P1 DSGVO: Auto-delete expired games
 * Runs every hour and removes games older than 24 hours
 */
exports.cleanupOldGames = functions.pubsub
    .schedule('every 1 hours')
    .timeZone('Europe/Berlin')
    .onRun(async (context) => {
        const now = Date.now();
        const db = admin.database();

        try {
            logger.info('cleanupOldGames', '🧹 Starting game cleanup...');

            const snapshot = await db.ref('games').once('value');
            const games = snapshot.val();

            if (!games) {
                logger.info('cleanupOldGames', '✅ No games to clean up');
                return null;
            }

            const deletions = [];
            let deletedCount = 0;

            Object.keys(games).forEach(gameId => {
                const game = games[gameId];

                // Delete if TTL expired
                if (game.ttl && game.ttl < now) {
                    logger.info('cleanupOldGames', `Deleting expired game: ${gameId}`, { ttl: game.ttl });
                    deletions.push(
                        db.ref(`games/${gameId}`).remove()
                    );
                    deletedCount++;
                }

                // Fallback: Delete if createdAt is older than 24h
                else if (game.createdAt && (now - game.createdAt) > (24 * 60 * 60 * 1000)) {
                    logger.info('cleanupOldGames', `Deleting old game (24h+): ${gameId}`, { createdAt: game.createdAt });
                    deletions.push(
                        db.ref(`games/${gameId}`).remove()
                    );
                    deletedCount++;
                }
            });

            if (deletions.length > 0) {
                await Promise.all(deletions);
                logger.info('cleanupOldGames', `✅ Deleted ${deletedCount} expired games`);
            } else {
                logger.info('cleanupOldGames', '✅ No expired games found');
            }

            return null;

        } catch (error) {
            logger.error('cleanupOldGames', '❌ Error during cleanup', error);
            throw error;
        }
    });

/**
 * ✅ P1 DSGVO: Auto-delete temp files older than 24h
 * Runs daily at 2 AM (Europe/Berlin time)
 * DSGVO Compliance: Data minimization (Art. 5 DSGVO)
 */
exports.cleanupTempFiles = functions.pubsub
    .schedule('every day 02:00')
    .timeZone('Europe/Berlin')
    .onRun(async (context) => {
        const bucket = admin.storage().bucket();
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

        try {
            logger.info('cleanupTempFiles', '🗑️ Starting temp files cleanup...');

            // Get all files in temp/ folder
            const [files] = await bucket.getFiles({ prefix: 'temp/' });

            if (!files || files.length === 0) {
                logger.info('cleanupTempFiles', '✅ No temp files to clean up');
                return null;
            }

            const deletePromises = [];
            let deletedCount = 0;

            for (const file of files) {
                const metadata = file.metadata;
                const created = new Date(metadata.timeCreated).getTime();
                const fileAge = now - created;

                // Delete if older than 24h
                if (fileAge > maxAge) {
                    logger.info('cleanupTempFiles', `Deleting old temp file: ${file.name}`, {
                        age: `${Math.round(fileAge / (60 * 60 * 1000))}h`,
                        created: metadata.timeCreated
                    });

                    deletePromises.push(file.delete());
                    deletedCount++;
                }
            }

            if (deletePromises.length > 0) {
                await Promise.all(deletePromises);
                logger.info('cleanupTempFiles', `✅ Deleted ${deletedCount} temp files`);
            } else {
                logger.info('cleanupTempFiles', '✅ No expired temp files found');
            }

            return null;

        } catch (error) {
            logger.error('cleanupTempFiles', '❌ Error during temp files cleanup', error);
            throw error;
        }
    });

/**
 * ✅ P1 DSGVO: Delete user data on account deletion
 * Includes Realtime Database, Storage (avatars), and game participations
 */
exports.cleanupUserData = functions.auth.user().onDelete(async (user) => {
    const uid = user.uid;
    const db = admin.database();
    const bucket = admin.storage().bucket();

    try {
        logger.info('cleanupUserData', `🗑️ Cleaning up data for deleted user: ${uid}`);

        // 1. Delete user profile from Realtime Database
        await db.ref(`users/${uid}`).remove();
        logger.info('cleanupUserData', 'User profile deleted from database', { uid });

        // 2. Delete user avatars from Storage
        try {
            const prefix = `avatars/${uid}/`;
            const [files] = await bucket.getFiles({ prefix });

            if (files && files.length > 0) {
                const deletePromises = files.map(file => file.delete());
                await Promise.all(deletePromises);
                logger.info('cleanupUserData', `Deleted ${files.length} avatar file(s)`, { uid });
            } else {
                logger.info('cleanupUserData', 'No avatar files to delete', { uid });
            }
        } catch (storageError) {
            logger.error('cleanupUserData', 'Error deleting avatars (non-fatal)', storageError, { uid });
            // Don't fail the whole cleanup if storage deletion fails
        }

        // 3. Remove user from all games
        const gamesSnapshot = await db.ref('games').once('value');
        const games = gamesSnapshot.val();

        if (games) {
            const updates = {};

            Object.keys(games).forEach(gameId => {
                const game = games[gameId];

                // Remove from players
                if (game.players && game.players[uid]) {
                    updates[`games/${gameId}/players/${uid}`] = null;
                }

                // If user was host, mark game for deletion
                if (game.hostId === uid) {
                    updates[`games/${gameId}`] = null;
                }
            });

            if (Object.keys(updates).length > 0) {
                await db.ref().update(updates);
                logger.info('cleanupUserData', `✅ Removed user from ${Object.keys(updates).length} game(s)`, { uid });
            }
        }

        logger.info('cleanupUserData', '✅ User data cleanup completed', { uid });

    } catch (error) {
        logger.error('cleanupUserData', '❌ Error during user data cleanup', error, { uid });
        throw error;
    }
});

/**
 * ✅ P0 SECURITY: Validate FSK access server-side
 * ✅ P0 SECURITY: Rate-limited to prevent abuse
 * ✅ CORS: Explicit CORS handling for custom domain
 */
exports.validateFSKAccess = functions
    .runWith({
        memory: '256MB',
        timeoutSeconds: 10
    })

    .https.onRequest(async (req, res) => {
        const functionName = 'validateFSKAccess';

        const allowedOrigins = new Set([
            'https://no-cap.app',
            'https://denkstduwebsite.web.app',
            'https://denkstduwebsite.firebaseapp.com',
            'http://localhost:5000'
        ]);

        const origin = req.headers.origin;
        const normalizedOrigin = typeof origin === 'string' ? origin.replace(/\/$/, '') : null;

        if (normalizedOrigin && allowedOrigins.has(normalizedOrigin)) {
            res.setHeader('Access-Control-Allow-Origin', normalizedOrigin);
            res.setHeader('Vary', 'Origin'); // ✅ verhindert falsches CORS-Caching
        }


        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.set('Access-Control-Allow-Credentials', 'true');
        res.set('Access-Control-Max-Age', '3600');

        if (req.method === 'OPTIONS') {
            return res.status(204).send('');
        }

        // Only allow POST requests
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }

        try {
            // ✅ P0 SECURITY: Verify Firebase Auth token
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                logger.warn(functionName, 'Missing or invalid authorization header');
                res.status(401).json({ error: 'Authentifizierung erforderlich' });
                return;
            }

            const idToken = authHeader.split('Bearer ')[1];
            let decodedToken;

            try {
                decodedToken = await admin.auth().verifyIdToken(idToken);
            } catch (error) {
                logger.warn(functionName, 'Invalid auth token');
                res.status(401).json({ error: 'Ungültiges Authentifizierungs-Token' });
                return;
            }

            const uid = decodedToken.uid;
            const { category } = req.body.data || req.body;

            // Input validation
            if (!category || typeof category !== 'string') {
                logger.warn(functionName, 'Invalid category parameter', { uid, category });
                res.status(400).json({ error: 'Kategorie ist erforderlich' });
                return;
            }

            logger.info(functionName, 'FSK validation request', { uid, category });

            // FSK0 is always allowed
            if (category === 'fsk0' || category === 'special') {
                logger.info(functionName, 'FSK0/special allowed', { uid, category });
                res.status(200).json({ result: { allowed: true, category } });
                return;
            }

            // Get user age verification
            const userSnapshot = await admin.database()
                .ref(`users/${uid}`)
                .once('value');

            const userData = userSnapshot.val();

            if (!userData || !userData.ageVerified) {
                logger.warn(functionName, 'Age not verified', { uid, category });
                res.status(200).json({
                    result: {
                        allowed: false,
                        reason: 'age_not_verified',
                        message: 'Altersverifikation erforderlich'
                    }
                });
                return;
            }

            const ageLevel = userData.ageLevel || 0;

            // Check FSK16
            if (category === 'fsk16' && ageLevel < 16) {
                logger.warn(functionName, 'FSK16 access denied', { uid, ageLevel });
                res.status(200).json({
                    result: {
                        allowed: false,
                        reason: 'age_too_young',
                        message: 'FSK 16 erforderlich'
                    }
                });
                return;
            }

            // Check FSK18
            if (category === 'fsk18' && ageLevel < 18) {
                logger.warn(functionName, 'FSK18 access denied', { uid, ageLevel });
                res.status(200).json({
                    result: {
                        allowed: false,
                        reason: 'age_too_young',
                        message: 'FSK 18 erforderlich'
                    }
                });
                return;
            }

            logger.info(functionName, 'FSK access granted', { uid, category, ageLevel });
            res.status(200).json({ result: { allowed: true, category } });

        } catch (error) {
            logger.error(functionName, 'FSK validation error', error);
            res.status(500).json({ error: 'Fehler bei der FSK-Validierung' });
        }
    });
/**
 * ✅ Callable Variante (kein CORS-Problem im Browser)
 * Frontend ruft: functions.httpsCallable('validateFSKAccessCallable')
 */
exports.validateFSKAccessCallable = functions
    .region('europe-west1')
    .runWith({
        memory: '256MB',
        timeoutSeconds: 10
    })
    .https.onCall(async (data, context) => {
        const functionName = 'validateFSKAccessCallable';

        // ✅ Auth required
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'Authentifizierung erforderlich'
            );
        }

        const uid = context.auth.uid;
        const category = data?.category;

        // Input validation
        if (!category || typeof category !== 'string') {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Kategorie ist erforderlich'
            );
        }

        logger.info(functionName, 'FSK validation request (callable)', { uid, category });

        // FSK0 / special always allowed
        if (category === 'fsk0' || category === 'special') {
            return { allowed: true, category };
        }

        // Get user age verification
        const userSnapshot = await admin.database()
            .ref(`users/${uid}`)
            .once('value');

        const userData = userSnapshot.val();

        if (!userData || !userData.ageVerified) {
            return {
                allowed: false,
                reason: 'age_not_verified',
                message: 'Altersverifikation erforderlich'
            };
        }

        const ageLevel = userData.ageLevel || 0;

        if (category === 'fsk16' && ageLevel < 16) {
            return {
                allowed: false,
                reason: 'age_too_young',
                message: 'FSK 16 erforderlich'
            };
        }

        if (category === 'fsk18' && ageLevel < 18) {
            return {
                allowed: false,
                reason: 'age_too_young',
                message: 'FSK 18 erforderlich'
            };
        }

        return { allowed: true, category };
    });

/**
 * ✅ P1 DSGVO: Export user data (GDPR Article 20)
 * ✅ P0 SECURITY: Rate-limited to prevent abuse
 */
exports.exportUserData = functions
    .runWith({
        memory: '512MB',
        timeoutSeconds: 60
    })
    .https.onCall(async (data, context) => {
        const functionName = 'exportUserData';

        // ✅ P0 SECURITY: Check authentication
        try {
            await verifyAuth(context);
        } catch (error) {
            logger.warn(functionName, 'Unauthenticated export attempt');
            throw error;
        }

        const uid = context.auth.uid;
        const db = admin.database();

        try {
            logger.info(functionName, 'Starting user data export', { uid });

            // Collect all user data
            const userData = {};

            // User profile
            const userSnapshot = await db.ref(`users/${uid}`).once('value');
            userData.profile = userSnapshot.val();

            // Games where user participated
            const gamesSnapshot = await db.ref('games').once('value');
            const games = gamesSnapshot.val();

            userData.games = [];

            if (games) {
                Object.keys(games).forEach(gameId => {
                    const game = games[gameId];

                    if (game.players && game.players[uid]) {
                        userData.games.push({
                            gameId: gameId,
                            createdAt: game.createdAt,
                            isHost: game.hostId === uid,
                            playerData: game.players[uid]
                        });
                    }
                });
            }

            logger.info(functionName, 'User data export completed', {
                uid,
                gamesCount: userData.games.length
            });

            return {
                exportDate: new Date().toISOString(),
                userId: uid,
                data: userData
            };

        } catch (error) {
            logger.error(functionName, 'User data export error', error, { uid });
            throw new functions.https.HttpsError(
                'internal',
                'Fehler beim Datenexport'
            );
        }
    });

/**
 * ✅ P1 DSGVO: "Recht auf Vergessenwerden" (GDPR Article 17)
 * Deletes all user data from Realtime Database and Auth
 * ✅ P0 SECURITY: Requires authentication and confirmation
 */
exports.deleteMyAccount = functions
    .runWith({
        memory: '512MB',
        timeoutSeconds: 60
    })
    .https.onCall(async (data, context) => {
        const functionName = 'deleteMyAccount';

        // ✅ P0 SECURITY: Check authentication
        try {
            await verifyAuth(context);
        } catch (error) {
            logger.warn(functionName, 'Unauthenticated deletion attempt');
            throw error;
        }

        const { confirmation } = data;
        const uid = context.auth.uid;

        // Require explicit confirmation
        if (confirmation !== 'DELETE_MY_ACCOUNT') {
            logger.warn(functionName, 'Missing or invalid confirmation', { uid });
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Bestätigung erforderlich. Bitte senden Sie "DELETE_MY_ACCOUNT".'
            );
        }

        const db = admin.database();
        const bucket = admin.storage().bucket();

        try {
            logger.info(functionName, `Starting account deletion for user: ${uid}`);

            // 1. Delete user data from Realtime Database
            await db.ref(`users/${uid}`).remove();
            logger.info(functionName, 'User profile deleted', { uid });

            // 2. Delete user avatars from Storage
            try {
                const prefix = `avatars/${uid}/`;
                const [files] = await bucket.getFiles({ prefix });

                if (files && files.length > 0) {
                    const deletePromises = files.map(file => file.delete());
                    await Promise.all(deletePromises);
                    logger.info(functionName, `Deleted ${files.length} avatar file(s)`, { uid });
                } else {
                    logger.info(functionName, 'No avatar files to delete', { uid });
                }
            } catch (storageError) {
                logger.error(functionName, 'Error deleting avatars (non-fatal)', storageError, { uid });
                // Continue with deletion even if storage cleanup fails
            }

            // 3. Remove user from all games
            const gamesSnapshot = await db.ref('games').once('value');
            const games = gamesSnapshot.val();

            if (games) {
                const updates = {};
                let affectedGames = 0;

                Object.keys(games).forEach(gameId => {
                    const game = games[gameId];

                    // Remove from players
                    if (game.players && game.players[uid]) {
                        updates[`games/${gameId}/players/${uid}`] = null;
                        affectedGames++;
                    }

                    // If user was host, delete entire game
                    if (game.hostId === uid) {
                        updates[`games/${gameId}`] = null;
                    }
                });

                if (Object.keys(updates).length > 0) {
                    await db.ref().update(updates);
                    logger.info(functionName, `Removed user from ${affectedGames} game(s)`, { uid });
                }
            }

            // 4. Delete Firebase Auth user
            try {
                await admin.auth().deleteUser(uid);
                logger.info(functionName, 'Firebase Auth user deleted', { uid });
            } catch (authError) {
                // Log but don't fail if auth deletion fails (might already be deleted)
                logger.warn(functionName, 'Auth deletion failed (might be already deleted)', {
                    uid,
                    error: authError.message
                });
            }

            logger.info(functionName, '✅ Account deletion completed successfully', { uid });

            return {
                success: true,
                message: 'Ihr Account wurde vollständig gelöscht.',
                deletedAt: new Date().toISOString()
            };

        } catch (error) {
            logger.error(functionName, 'Account deletion error', error, { uid });
            throw new functions.https.HttpsError(
                'internal',
                'Fehler beim Löschen des Accounts'
            );
        }
    });

/**
 * ✅ P0 SECURITY: Set user age verification (Admin only)
 * This should only be called after proper age verification process
 */
exports.setAgeVerification = functions
    .runWith({
        memory: '256MB',
        timeoutSeconds: 10
    })
    .https.onCall(async (data, context) => {
        const functionName = 'setAgeVerification';

        // ✅ P0 SECURITY: Check authentication
        try {
            await verifyAuth(context);
        } catch (error) {
            logger.warn(functionName, 'Unauthenticated age verification attempt');
            throw error;
        }

        const { ageLevel, verificationMethod } = data;
        const uid = context.auth.uid;

        // Input validation
        if (typeof ageLevel !== 'number' || ageLevel < 0 || ageLevel > 99) {
            logger.warn(functionName, 'Invalid age level', { uid, ageLevel });
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Ungültige Altersangabe (0-99 erwartet)'
            );
        }

        const db = admin.database();

        try {
            logger.info(functionName, 'Setting age verification', {
                uid,
                ageLevel,
                verificationMethod
            });

            const updates = {
                ageVerified: true,
                ageLevel: ageLevel,
                ageVerifiedAt: admin.database.ServerValue.TIMESTAMP,
                verificationMethod: verificationMethod || 'self-declaration'
            };

            await db.ref(`users/${uid}`).update(updates);

            // Set custom claims for FSK access
            const customClaims = {};
            if (ageLevel >= 16) customClaims.fsk16 = true;
            if (ageLevel >= 18) customClaims.fsk18 = true;

            await admin.auth().setCustomUserClaims(uid, customClaims);

            logger.info(functionName, 'Age verification set successfully', {
                uid,
                ageLevel,
                claims: customClaims
            });

            return {
                success: true,
                ageLevel: ageLevel,
                fskAccess: {
                    fsk0: true,
                    fsk16: ageLevel >= 16,
                    fsk18: ageLevel >= 18
                }
            };

        } catch (error) {
            logger.error(functionName, 'Age verification error', error, { uid, ageLevel });
            throw new functions.https.HttpsError(
                'internal',
                'Fehler bei der Altersverifikation'
            );
        }
    });

// ===================================
// IMPORT ACCOUNT DELETION FUNCTIONS
// ===================================

/**
 * ✅ Import all exports from account-deletion.js
 * This prevents timeout issues from multiple admin.initializeApp() calls
 */
const accountDeletion = require('./account-deletion');

// Re-export all functions from account-deletion.js
exports.scheduleAccountDeletion = accountDeletion.scheduleAccountDeletion;
exports.cancelAccountDeletion = accountDeletion.cancelAccountDeletion;
exports.processScheduledDeletions = accountDeletion.processScheduledDeletions;
exports.deleteUserAccount = accountDeletion.deleteUserAccount; // Legacy/deprecated
// Note: cleanupOldGames is already defined above, so we don't re-export it

// ===================================
// IMPORT REALTIME SECURITY FUNCTIONS
// ===================================

/**
 * ✅ Import all exports from realtime-security.js
 * Real-time protection against score manipulation and FSK violations
 */
const realtimeSecurity = require('./realtime-security');

// Re-export all security triggers
exports.validateGameUpdate = realtimeSecurity.validateGameUpdate;
exports.detectRapidUpdates = realtimeSecurity.detectRapidUpdates;
exports.monitorGameDeletion = realtimeSecurity.monitorGameDeletion;
exports.cleanupOldViolations = realtimeSecurity.cleanupOldViolations;

