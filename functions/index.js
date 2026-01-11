const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

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
            console.log('🧹 Starting game cleanup...');

            const snapshot = await db.ref('games').once('value');
            const games = snapshot.val();

            if (!games) {
                console.log('✅ No games to clean up');
                return null;
            }

            const deletions = [];
            let deletedCount = 0;

            Object.keys(games).forEach(gameId => {
                const game = games[gameId];

                // Delete if TTL expired
                if (game.ttl && game.ttl < now) {
                    console.log(`Deleting expired game: ${gameId}`);
                    deletions.push(
                        db.ref(`games/${gameId}`).remove()
                    );
                    deletedCount++;
                }

                // Fallback: Delete if createdAt is older than 24h
                else if (game.createdAt && (now - game.createdAt) > (24 * 60 * 60 * 1000)) {
                    console.log(`Deleting old game (24h+): ${gameId}`);
                    deletions.push(
                        db.ref(`games/${gameId}`).remove()
                    );
                    deletedCount++;
                }
            });

            if (deletions.length > 0) {
                await Promise.all(deletions);
                console.log(`✅ Deleted ${deletedCount} expired games`);
            } else {
                console.log('✅ No expired games found');
            }

            return null;

        } catch (error) {
            console.error('❌ Error during cleanup:', error);
            throw error;
        }
    });

/**
 * ✅ P1 DSGVO: Delete user data on account deletion
 */
exports.cleanupUserData = functions.auth.user().onDelete(async (user) => {
    const uid = user.uid;
    const db = admin.database();

    try {
        console.log(`🗑️ Cleaning up data for deleted user: ${uid}`);

        // Delete user data
        await db.ref(`users/${uid}`).remove();

        // Remove user from all games
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
                console.log(`✅ Removed user from ${Object.keys(updates).length} game(s)`);
            }
        }

        console.log('✅ User data cleanup completed');

    } catch (error) {
        console.error('❌ Error during user data cleanup:', error);
        throw error;
    }
});

/**
 * ✅ P0 SECURITY: Validate FSK access server-side
 */
exports.validateFSKAccess = functions.https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated'
        );
    }

    const { category } = data;
    const uid = context.auth.uid;

    try {
        // FSK0 is always allowed
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

        // Check FSK16
        if (category === 'fsk16' && ageLevel < 16) {
            return {
                allowed: false,
                reason: 'age_too_young',
                message: 'FSK 16 erforderlich'
            };
        }

        // Check FSK18
        if (category === 'fsk18' && ageLevel < 18) {
            return {
                allowed: false,
                reason: 'age_too_young',
                message: 'FSK 18 erforderlich'
            };
        }

        return { allowed: true, category };

    } catch (error) {
        console.error('FSK validation error:', error);
        throw new functions.https.HttpsError(
            'internal',
            'Fehler bei der FSK-Validierung'
        );
    }
});

/**
 * ✅ P1 DSGVO: Export user data (GDPR Article 20)
 */
exports.exportUserData = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated'
        );
    }

    const uid = context.auth.uid;
    const db = admin.database();

    try {
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

        return {
            exportDate: new Date().toISOString(),
            userId: uid,
            data: userData
        };

    } catch (error) {
        console.error('User data export error:', error);
        throw new functions.https.HttpsError(
            'internal',
            'Fehler beim Datenexport'
        );
    }
});

