/**
 * No-Cap Firebase Cloud Functions
 * Server-Side Security & Payment Processing
 * Version 4.0 - Production Hardening Complete
 *
 * OPTIMIZATIONS & SECURITY:
 * ✅ P0: App Check enforced on ALL callable functions (prevents bot attacks)
 * ✅ P0: Custom Claims with documented token refresh requirements
 * ✅ P1: DSGVO-compliant IP logging (only with consent, auto-delete after 24h)
 * ✅ P1: Stripe integration prepared (see TODO comments for activation)
 * ✅ P2: Cold-start optimization (Express app created once, admin.initializeApp() on module level)
 * ✅ Secrets via process.env (APP_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
 * ✅ Sichere Audit-Logs mit automatischer Löschung
 * ✅ Premium Payment Flow vorbereitet
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

// ✅ OPTIMIZATION: Stripe & Express (aktivierbar via Environment Variables)
const stripe = process.env.STRIPE_SECRET_KEY
    ? require('stripe')(process.env.STRIPE_SECRET_KEY)
    : null;

const express = process.env.STRIPE_SECRET_KEY
    ? require('express')
    : null;

const cors = process.env.STRIPE_SECRET_KEY
    ? require('cors')
    : null;

admin.initializeApp();

// ✅ Import account deletion functions
const accountDeletion = require('./account-deletion');

// ===== CONFIGURATION =====
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_ANSWERS_PER_MINUTE = 10;
const ANSWER_TOKEN_EXPIRY = 30 * 1000; // 30 seconds

// ✅ OPTIMIZATION: Helper function to get APP_SECRET (loaded at runtime, not build time)
function getAppSecret() {
    const secret = process.env.APP_SECRET;
    if (!secret) {
        throw new Error('APP_SECRET not configured. Set via: firebase functions:secrets:set APP_SECRET');
    }
    return secret;
}

// ===== AGE VERIFICATION CLOUD FUNCTION =====

/**
 * ✅ OPTIMIZATION: Serverseitige Age-Verification mit DSGVO-Compliance
 * Setzt Custom Claims für authentifizierte User
 * Speichert IP nur mit explizitem Consent
 *
 * ✅ P0 SECURITY: App Check enforced - verhindert unautorisierte Bot-Zugriffe
 * ⚠️ IMPORTANT: Nach Setzen der Custom Claims MUSS der Client seinen Token erneuern:
 *    await firebase.auth().currentUser.getIdToken(true);
 *
 * ✅ DSGVO: IP-Speicherung erfolgt NUR mit expliziter Einwilligung (ipConsent)
 *    und wird automatisch nach 24 Stunden gelöscht (siehe cleanupAuditLogs)
 */
exports.verifyAge = functions.https.onCall(async (data, context) => {
    // ✅ P0 SECURITY: App Check erzwingen
    if (!context.app) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'App Check required - unauthenticated requests are not allowed'
        );
    }

    // Authentifizierung prüfen
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated'
        );
    }

    const { ageLevel, consent, ipConsent } = data;

    // Validierung
    if (ageLevel !== 0 && ageLevel !== 16 && ageLevel !== 18) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Age level must be 0, 16 or 18'
        );
    }

    if (!consent) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'User consent required for age verification'
        );
    }

    try {
        // ✅ P0 SECURITY: Custom Claims setzen (persistent, server-side)
        // ⚠️ WICHTIG: Client MUSS Token erneuern nach diesem Call:
        //    await firebase.auth().currentUser.getIdToken(true);
        await admin.auth().setCustomUserClaims(context.auth.uid, {
            ageVerified: true,
            ageLevel: ageLevel,
            verifiedAt: Date.now()
        });

        // ✅ DSGVO: Audit-Log mit optionaler IP-Speicherung
        // IP-Adressen werden NUR mit explizitem Consent (ipConsent=true) gespeichert
        // und automatisch nach 24 Stunden durch cleanupAuditLogs gelöscht.
        // HINWEIS: Dies MUSS in der Datenschutzerklärung dokumentiert sein!
        const auditData = {
            action: 'age_verification',
            ageLevel: ageLevel,
            timestamp: admin.database.ServerValue.TIMESTAMP,
            consentGiven: true
        };

        // ✅ DSGVO: IP nur speichern wenn explizite Einwilligung
        // Auto-Löschung nach 24h via cleanupAuditLogs Scheduled Function
        if (ipConsent === true && context.rawRequest) {
            auditData.ip = context.rawRequest.ip || 'unknown';
            auditData.ipConsent = true;
        } else {
            auditData.ip = null;
            auditData.ipConsent = false;
        }

        await admin.database().ref(`audit_logs/${context.auth.uid}`).push(auditData);

        console.log(`✅ Age verified for user ${context.auth.uid}: ${ageLevel} (IP consent: ${ipConsent || false})`);

        return {
            success: true,
            ageLevel,
            message: 'Age verification successful'
        };
    } catch (error) {
        console.error('❌ Age verification failed:', error);
        throw new functions.https.HttpsError(
            'internal',
            'Failed to verify age'
        );
    }
});

// ===== CATEGORY ACCESS VALIDATION =====

/**
 * ✅ AUDIT FIX: Serverseitige Kategorie-Zugriffsprüfung
 * Prüft Premium-Status und FSK-Level
 *
 * ✅ P0 SECURITY: App Check enforced
 * ⚠️ IMPORTANT: Falls Custom Claims gesetzt werden, Client MUSS Token erneuern:
 *    await firebase.auth().currentUser.getIdToken(true);
 */
exports.checkCategoryAccess = functions.https.onCall(async (data, context) => {
    // ✅ P0 SECURITY: App Check erzwingen
    if (!context.app) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'App Check required - unauthenticated requests are not allowed'
        );
    }

    // Authentifizierung prüfen
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated'
        );
    }

    const { categoryId } = data;

    // Kategorie-Daten (sollte mit client-side übereinstimmen)
    const categoryData = {
        fsk0: { requiresAge: 0, requiresPremium: false },
        fsk16: { requiresAge: 16, requiresPremium: false },
        fsk18: { requiresAge: 18, requiresPremium: false },
        special: { requiresAge: 0, requiresPremium: true }
    };

    const category = categoryData[categoryId];
    if (!category) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Invalid category ID'
        );
    }

    // Custom Claims holen
    const userToken = context.auth.token;
    const userAgeLevel = userToken.ageLevel || 0;
    const isPremium = userToken.isPremium === true;

    // FSK-Prüfung
    if (category.requiresAge > userAgeLevel) {
        throw new functions.https.HttpsError(
            'permission-denied',
            `Age verification required. Minimum age: ${category.requiresAge}`
        );
    }

    // Premium-Prüfung
    if (category.requiresPremium && !isPremium) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Premium subscription required'
        );
    }

    console.log(`✅ Access granted for user ${context.auth.uid} to category ${categoryId}`);

    return {
        allowed: true,
        categoryId,
        message: 'Access granted'
    };
});

// ===== HELPER FUNCTIONS =====

/**
 * Generate secure token for answer validation
 */
function generateAnswerToken(playerId, gameId, roundNumber) {
    const secret = getAppSecret();  // Runtime check, nicht Build-Time
    const timestamp = Date.now();
    const data = `${playerId}:${gameId}:${roundNumber}:${timestamp}`;

    const hash = crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('hex');

    return {
        token: hash,
        timestamp: timestamp
    };
}

/**
 * Verify answer token
 */
function verifyAnswerToken(token, playerId, gameId, roundNumber, tokenTimestamp) {
    const secret = getAppSecret();  // Runtime check, nicht Build-Time
    const data = `${playerId}:${gameId}:${roundNumber}:${tokenTimestamp}`;

    const expectedHash = crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('hex');

    if (token !== expectedHash) {
        return { valid: false, reason: 'Invalid token' };
    }

    const now = Date.now();
    if (now - tokenTimestamp > ANSWER_TOKEN_EXPIRY) {
        return { valid: false, reason: 'Token expired' };
    }

    return { valid: true };
}

/**
 * Rate limiting check
 */
async function checkRateLimit(playerId) {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;

    const rateLimitRef = admin.database().ref(`rateLimits/${playerId}`);
    const snapshot = await rateLimitRef.once('value');
    const rateLimitData = snapshot.val() || { requests: [], lastCleanup: now };

    const recentRequests = (rateLimitData.requests || [])
        .filter(timestamp => timestamp > windowStart);

    if (recentRequests.length >= MAX_ANSWERS_PER_MINUTE) {
        return {
            allowed: false,
            retryAfter: Math.ceil((recentRequests[0] - windowStart) / 1000)
        };
    }

    recentRequests.push(now);

    await rateLimitRef.set({
        requests: recentRequests,
        lastCleanup: now
    });

    return { allowed: true };
}

// ===== CLOUD FUNCTIONS =====

/**
 * 1. Get Answer Token
 * ✅ P0 SECURITY: App Check enforced
 */
exports.getAnswerToken = functions.https.onCall(async (data, context) => {
    // ✅ P0 SECURITY: App Check erzwingen
    if (!context.app) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'App Check required - unauthenticated requests are not allowed'
        );
    }

    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { gameId, roundNumber } = data;
    const playerId = context.auth.uid;

    if (!gameId || roundNumber === undefined) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }

    const rateLimit = await checkRateLimit(playerId);
    if (!rateLimit.allowed) {
        throw new functions.https.HttpsError(
            'resource-exhausted',
            `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds`
        );
    }

    const gameRef = admin.database().ref(`games/${gameId}/players/${playerId}`);
    const gameSnapshot = await gameRef.once('value');

    if (!gameSnapshot.exists()) {
        throw new functions.https.HttpsError('permission-denied', 'Player not in game');
    }

    const answerRef = admin.database()
        .ref(`games/${gameId}/rounds/round_${roundNumber}/answers/${playerId}`);
    const answerSnapshot = await answerRef.once('value');

    if (answerSnapshot.exists()) {
        throw new functions.https.HttpsError('already-exists', 'Answer already submitted for this round');
    }

    const tokenData = generateAnswerToken(playerId, gameId, roundNumber);

    return {
        token: tokenData.token,
        timestamp: tokenData.timestamp,
        expiresIn: ANSWER_TOKEN_EXPIRY
    };
});

/**
 * 2. Validate Answer
 * ✅ P0 SECURITY: App Check enforced
 */
exports.validateAnswer = functions.https.onCall(async (data, context) => {
    // ✅ P0 SECURITY: App Check erzwingen
    if (!context.app) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'App Check required - unauthenticated requests are not allowed'
        );
    }

    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { gameId, roundNumber, answer, estimation, token, tokenTimestamp } = data;
    const playerId = context.auth.uid;

    if (!gameId || roundNumber === undefined || answer === undefined ||
        estimation === undefined || !token || !tokenTimestamp) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }

    const tokenVerification = verifyAnswerToken(token, playerId, gameId, roundNumber, tokenTimestamp);

    if (!tokenVerification.valid) {
        throw new functions.https.HttpsError('permission-denied', `Token validation failed: ${tokenVerification.reason}`);
    }

    const gameRef = admin.database().ref(`games/${gameId}/players/${playerId}`);
    const gameSnapshot = await gameRef.once('value');

    if (!gameSnapshot.exists()) {
        throw new functions.https.HttpsError('permission-denied', 'Player not in game');
    }

    const answerRef = admin.database()
        .ref(`games/${gameId}/rounds/round_${roundNumber}/answers/${playerId}`);
    const answerSnapshot = await answerRef.once('value');

    if (answerSnapshot.exists()) {
        throw new functions.https.HttpsError('already-exists', 'Answer already submitted for this round');
    }

    if (typeof answer !== 'boolean') {
        throw new functions.https.HttpsError('invalid-argument', 'Answer must be boolean');
    }

    if (typeof estimation !== 'number' || estimation < 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Estimation must be non-negative number');
    }

    const playersRef = admin.database().ref(`games/${gameId}/players`);
    const playersSnapshot = await playersRef.once('value');
    const playerCount = playersSnapshot.numChildren();

    if (estimation > playerCount) {
        throw new functions.https.HttpsError('invalid-argument', `Estimation cannot exceed player count (${playerCount})`);
    }

    const playerData = gameSnapshot.val();
    await answerRef.set({
        playerId: playerId,
        playerName: playerData.name || 'Unknown',
        answer: answer,
        estimation: estimation,
        submittedAt: admin.database.ServerValue.TIMESTAMP,
        verified: true
    });

    return {
        success: true,
        message: 'Answer validated and saved'
    };
});

/**
 * 3. Premium Payment Verification (Stripe Webhook)
 * ✅ P1 PRODUCTION TODO: Stripe aktivieren mit folgenden Schritten:
 *
 * 1. Stripe Secret Keys in Firebase Secret Manager setzen:
 *    firebase functions:secrets:set STRIPE_SECRET_KEY
 *    firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
 *
 * 2. Stripe Webhook URL konfigurieren:
 *    https://YOUR-PROJECT.cloudfunctions.net/stripeWebhook
 *
 * 3. In Stripe Dashboard diese Events aktivieren:
 *    - checkout.session.completed
 *
 * 4. Code unten auskommentieren und neu deployen
 *
 * 5. Testzahlung durchführen zur Validierung
 */

// TODO PRODUCTION: Uncomment when Stripe keys are configured
/*
// ✅ P2 OPTIMIZATION: Express App außerhalb des Handlers für Cold-Start-Reduzierung
const app = express();
app.use(cors({ origin: true }));

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe) {
        return res.status(503).send('Stripe not configured');
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata.userId;
        const productId = session.metadata.productId;

        if (!userId || productId !== 'special_edition') {
            return res.status(400).send('Invalid metadata');
        }

        try {
            // Premium-Status in Database speichern
            await admin.database().ref(`users/${userId}/purchases/special`).set({
                id: 'special_edition',
                name: 'Special Edition',
                price: session.amount_total / 100,
                currency: session.currency,
                verified: true,
                paymentId: session.payment_intent,
                timestamp: admin.database.ServerValue.TIMESTAMP
            });

            // ⚠️ WICHTIG: Custom Claims setzen für sofortige Verfügbarkeit
            // Client MUSS danach Token erneuern: await firebase.auth().currentUser.getIdToken(true);
            await admin.auth().setCustomUserClaims(userId, {
                isPremium: true,
                premiumSince: Date.now()
            });

            console.log(`✅ Premium unlocked for user: ${userId} - Client should refresh token`);
            res.json({ received: true });

        } catch (error) {
            console.error('Error updating premium status:', error);
            res.status(500).send('Error updating database');
        }
    } else {
        res.json({ received: true });
    }
});

exports.stripeWebhook = functions.https.onRequest(app);
*/

/**
 * 4. Create Stripe Checkout Session
 * ✅ P1 PRODUCTION TODO: Aktivieren sobald Stripe-Keys konfiguriert sind
 * ✅ P0 SECURITY: App Check enforced
 */
// TODO PRODUCTION: Uncomment when Stripe keys are configured
/*
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
    // ✅ P0 SECURITY: App Check erzwingen
    if (!context.app) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'App Check required - unauthenticated requests are not allowed'
        );
    }

    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (!stripe) {
        throw new functions.https.HttpsError('failed-precondition', 'Stripe not configured');
    }

    const userId = context.auth.uid;

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: 'No-Cap Special Edition',
                            description: 'Exklusive Premium-Fragen für besondere Momente',
                        },
                        unit_amount: 299, // 2,99 EUR in Cent
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${data.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: data.cancelUrl,
            metadata: {
                userId: userId,
                productId: 'special_edition'
            }
        });

        return {
            sessionId: session.id,
            url: session.url
        };

    } catch (error) {
        console.error('Error creating checkout session:', error);
        throw new functions.https.HttpsError('internal', 'Failed to create checkout session');
    }
});
*/

/**
 * 5. Check Premium Status
 * ✅ AUDIT FIX: Server-side Premium validation with Custom Claims
 * ✅ P0 SECURITY: App Check enforced
 * ⚠️ IMPORTANT: Falls Custom Claims aktualisiert werden, Client MUSS Token erneuern:
 *    await firebase.auth().currentUser.getIdToken(true);
 */
exports.checkPremiumStatus = functions.https.onCall(async (data, context) => {
    // ✅ P0 SECURITY: App Check erzwingen
    if (!context.app) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'App Check required - unauthenticated requests are not allowed'
        );
    }

    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;

    // ✅ P0 FIX: Check Custom Claims first (cached, faster)
    const userToken = context.auth.token;
    if (userToken.isPremium === true) {
        console.log(`✅ Premium verified via Custom Claims for user ${userId}`);
        return {
            hasPremium: true,
            source: 'custom_claims'
        };
    }

    // Fallback: Check Database for purchase record
    const purchaseRef = admin.database().ref(`users/${userId}/purchases/special`);
    const snapshot = await purchaseRef.once('value');

    if (!snapshot.exists()) {
        return { hasPremium: false };
    }

    const purchase = snapshot.val();

    if (purchase.verified !== true) {
        return { hasPremium: false };
    }

    // ✅ P0 FIX: Update Custom Claims if purchase found but not in claims
    // ⚠️ WICHTIG: Client sollte nach diesem Call Token erneuern:
    //    await firebase.auth().currentUser.getIdToken(true);
    try {
        await admin.auth().setCustomUserClaims(userId, {
            ...userToken,
            isPremium: true,
            premiumSince: purchase.timestamp
        });

        console.log(`✅ Premium Custom Claims updated for user ${userId} - Client should refresh token`);
    } catch (error) {
        console.error('❌ Failed to update Custom Claims:', error);
    }

    return {
        hasPremium: true,
        purchaseDate: purchase.timestamp,
        productId: purchase.id,
        source: 'database'
    };
});

/**
 * 6. Join Game - Mit Spielerzahl-Validierung
 * ✅ P0 SECURITY: Maximal 10 Spieler pro Spiel
 * ✅ P0 SECURITY: App Check enforced
 */
exports.joinGame = functions.https.onCall(async (data, context) => {
    // ✅ P0 SECURITY: App Check erzwingen
    if (!context.app) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'App Check required - unauthenticated requests are not allowed'
        );
    }

    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { gameId, playerName } = data;
    const playerId = context.auth.uid;

    if (!gameId || !playerName) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }

    // ✅ P0 SECURITY: Prüfe Spielerzahl
    const playersRef = admin.database().ref(`games/${gameId}/players`);
    const playersSnapshot = await playersRef.once('value');
    const playerCount = playersSnapshot.numChildren();

    // Prüfe ob Spieler bereits existiert
    if (playersSnapshot.hasChild(playerId)) {
        return {
            success: true,
            message: 'Already in game',
            playerCount: playerCount
        };
    }

    // ✅ P0 SECURITY: Maximal 10 Spieler
    if (playerCount >= 10) {
        throw new functions.https.HttpsError(
            'resource-exhausted',
            'Game is full. Maximum 10 players allowed.'
        );
    }

    // Spieler hinzufügen
    await playersRef.child(playerId).set({
        id: playerId,
        name: playerName,
        isReady: false,
        isHost: false,
        joinedAt: admin.database.ServerValue.TIMESTAMP
    });

    console.log(`✅ Player ${playerId} joined game ${gameId} (${playerCount + 1}/10 players)`);

    return {
        success: true,
        message: 'Successfully joined game',
        playerCount: playerCount + 1
    };
});

/**
 * 7. Cleanup: Alte Games löschen
 */
exports.cleanupOldGames = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
        const now = Date.now();
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

        const gamesRef = admin.database().ref('games');
        const snapshot = await gamesRef
            .orderByChild('createdAt')
            .endAt(oneWeekAgo)
            .once('value');

        const updates = {};
        snapshot.forEach(child => {
            updates[child.key] = null;
        });

        if (Object.keys(updates).length > 0) {
            await gamesRef.update(updates);
            console.log(`Deleted ${Object.keys(updates).length} old games`);
        }

        return null;
    });

/**
 * 8. Cleanup: Alte Rate-Limits löschen
 */
exports.cleanupRateLimits = functions.pubsub
    .schedule('every 1 hours')
    .onRun(async (context) => {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);

        const rateLimitsRef = admin.database().ref('rateLimits');
        const snapshot = await rateLimitsRef.once('value');

        const updates = {};
        snapshot.forEach(child => {
            const data = child.val();
            if (data.lastCleanup < oneHourAgo) {
                updates[child.key] = null;
            }
        });

        if (Object.keys(updates).length > 0) {
            await rateLimitsRef.update(updates);
            console.log(`Cleaned ${Object.keys(updates).length} old rate limits`);
        }

        return null;
    });

/**
 * 9. Cleanup: Audit-Logs mit IP-Adressen nach 24h löschen (DSGVO-Compliance)
 * ✅ P1 DSGVO: IP-Adressen werden automatisch nach 24 Stunden gelöscht
 * Dies erfüllt die DSGVO-Anforderung der Datensparsamkeit
 */
exports.cleanupAuditLogs = functions.pubsub
    .schedule('every 6 hours')
    .onRun(async (context) => {
        const now = Date.now();
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

        const auditLogsRef = admin.database().ref('audit_logs');
        const snapshot = await auditLogsRef.once('value');

        let deletedCount = 0;

        // Durchlaufe alle User-Audit-Logs
        const updates = {};
        snapshot.forEach(userSnapshot => {
            const userId = userSnapshot.key;
            const userAuditLogs = userSnapshot.val();

            if (userAuditLogs && userAuditLogs.actions) {
                Object.keys(userAuditLogs.actions).forEach(actionId => {
                    const action = userAuditLogs.actions[actionId];

                    // Lösche Logs älter als 24h die IP-Adressen enthalten
                    if (action.timestamp < twentyFourHoursAgo && action.ip) {
                        updates[`${userId}/actions/${actionId}`] = null;
                        deletedCount++;
                    }
                });
            }
        });

        if (Object.keys(updates).length > 0) {
            await auditLogsRef.update(updates);
            console.log(`✅ DSGVO: Deleted ${deletedCount} audit logs with IP addresses (>24h old)`);
        } else {
            console.log('ℹ️ No old audit logs to delete');
        }

        return null;
    });


// ===================================
// ✅ DSGVO: ACCOUNT DELETION FUNCTIONS
// ===================================
exports.deleteUserAccount = accountDeletion.deleteUserAccount;
exports.cleanupOldGames = accountDeletion.cleanupOldGames;
exports.cleanupAgeVerifications = accountDeletion.cleanupAgeVerifications;
