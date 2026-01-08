/**
 * Firebase Cloud Function: Account Deletion
 * DSGVO-konformes Löschen von Benutzerdaten
 *
 * Trigger: HTTPS Callable Function
 * Authentifizierung: Erforderlich
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Admin SDK (if not already done in index.js)
if (!admin.apps.length) {
    admin.initializeApp();
}

/**
 * ✅ DSGVO Art. 17: Recht auf Löschung ("Recht auf Vergessenwerden")
 *
 * Diese Funktion löscht ALLE Daten eines Benutzers:
 * - Firebase Auth Account
 * - Realtime Database Daten
 * - Storage Dateien (Avatare)
 * - Custom Claims
 *
 * @param {object} data - { userId: string, confirmationToken: string }
 * @param {object} context - Firebase Auth Context
 */
exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
    try {
        // ✅ SECURITY: Check if user is authenticated
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'User must be authenticated to delete account'
            );
        }

        const requestingUserId = context.auth.uid;
        const targetUserId = data.userId || requestingUserId;

        // ✅ SECURITY: Users can only delete their own account
        // (unless admin - check custom claim)
        const isAdmin = context.auth.token.admin === true;
        if (targetUserId !== requestingUserId && !isAdmin) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'You can only delete your own account'
            );
        }

        console.log(`🗑️ Starting account deletion for user: ${targetUserId}`);

        // ===================================
        // 1. Delete Firebase Auth Account
        // ===================================
        try {
            await admin.auth().deleteUser(targetUserId);
            console.log(`✅ Deleted Auth account: ${targetUserId}`);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log(`ℹ️ Auth account already deleted: ${targetUserId}`);
            } else {
                throw error;
            }
        }

        // ===================================
        // 2. Delete Realtime Database Data
        // ===================================
        const db = admin.database();

        // Delete user's games (as host)
        const gamesRef = db.ref('games');
        const userGamesSnapshot = await gamesRef
            .orderByChild('hostId')
            .equalTo(targetUserId)
            .once('value');

        const deleteGamePromises = [];
        userGamesSnapshot.forEach((gameSnapshot) => {
            deleteGamePromises.push(gameSnapshot.ref.remove());
        });

        await Promise.all(deleteGamePromises);
        console.log(`✅ Deleted ${deleteGamePromises.length} games hosted by user`);

        // Delete user's player data from all games
        const allGamesSnapshot = await gamesRef.once('value');
        const deletePlayerPromises = [];

        allGamesSnapshot.forEach((gameSnapshot) => {
            const players = gameSnapshot.child('players').val();
            if (players && players[targetUserId]) {
                deletePlayerPromises.push(
                    gameSnapshot.ref.child(`players/${targetUserId}`).remove()
                );
            }
        });

        await Promise.all(deletePlayerPromises);
        console.log(`✅ Removed user from ${deletePlayerPromises.length} games`);

        // Delete age verification data
        const ageVerificationRef = db.ref(`ageVerifications/${targetUserId}`);
        await ageVerificationRef.remove();
        console.log(`✅ Deleted age verification data`);

        // ===================================
        // 3. Delete Storage Files (Avatars)
        // ===================================
        try {
            const bucket = admin.storage().bucket();
            const [files] = await bucket.getFiles({
                prefix: `avatars/${targetUserId}/`
            });

            const deleteFilePromises = files.map(file => file.delete());
            await Promise.all(deleteFilePromises);
            console.log(`✅ Deleted ${files.length} storage files`);
        } catch (error) {
            console.warn(`⚠️ Storage deletion error (may not exist):`, error.message);
        }

        // ===================================
        // 4. Log deletion (for audit trail)
        // ===================================
        const deletionLogRef = db.ref('deletionLogs').push();
        await deletionLogRef.set({
            userId: targetUserId,
            deletedAt: admin.database.ServerValue.TIMESTAMP,
            deletedBy: requestingUserId,
            isAdmin: isAdmin || false
        });

        console.log(`✅ Account deletion completed for user: ${targetUserId}`);

        return {
            success: true,
            message: 'Account and all associated data have been deleted',
            deletedData: {
                authAccount: true,
                gamesHosted: deleteGamePromises.length,
                gamesParticipated: deletePlayerPromises.length,
                storageFiles: files ? files.length : 0,
                ageVerification: true
            }
        };

    } catch (error) {
        console.error(`❌ Account deletion error:`, error);

        throw new functions.https.HttpsError(
            'internal',
            `Account deletion failed: ${error.message}`
        );
    }
});

/**
 * ✅ Helper Function: Schedule automatic deletion of old games
 * Runs daily at midnight (UTC)
 * Deletes games older than 24 hours
 */
exports.cleanupOldGames = functions.pubsub.schedule('0 0 * * *')
    .timeZone('Europe/Berlin')
    .onRun(async (context) => {
        console.log('🧹 Starting automatic game cleanup...');

        const db = admin.database();
        const gamesRef = db.ref('games');
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);

        try {
            const snapshot = await gamesRef.once('value');
            const deletePromises = [];

            snapshot.forEach((gameSnapshot) => {
                const game = gameSnapshot.val();
                const createdAt = game.createdAt || 0;

                if (createdAt < oneDayAgo) {
                    deletePromises.push(gameSnapshot.ref.remove());
                }
            });

            await Promise.all(deletePromises);
            console.log(`✅ Deleted ${deletePromises.length} old games`);

            return null;
        } catch (error) {
            console.error('❌ Cleanup error:', error);
            return null;
        }
    });

/**
 * ✅ Helper Function: Cleanup old age verification data
 * Runs daily at 1 AM (UTC)
 * Deletes age verifications older than 30 days
 */
exports.cleanupAgeVerifications = functions.pubsub.schedule('0 1 * * *')
    .timeZone('Europe/Berlin')
    .onRun(async (context) => {
        console.log('🧹 Starting age verification cleanup...');

        const db = admin.database();
        const ageVerificationsRef = db.ref('ageVerifications');
        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

        try {
            const snapshot = await ageVerificationsRef.once('value');
            const deletePromises = [];

            snapshot.forEach((verificationSnapshot) => {
                const verification = verificationSnapshot.val();
                const verifiedAt = verification.timestamp || 0;

                if (verifiedAt < thirtyDaysAgo) {
                    deletePromises.push(verificationSnapshot.ref.remove());
                }
            });

            await Promise.all(deletePromises);
            console.log(`✅ Deleted ${deletePromises.length} old age verifications`);

            return null;
        } catch (error) {
            console.error('❌ Age verification cleanup error:', error);
            return null;
        }
    });

