/**
 * No-Cap Firebase Cloud Functions
 * Server-Side Security & Payment Processing
 * Version 3.0 - DSGVO-Compliant + Stripe Ready
 *
 * OPTIMIZATIONS:
 * ✅ Secrets via process.env (APP_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
 * ✅ IP-Speicherung nur mit Consent (DSGVO)
 * ✅ Sichere Audit-Logs
 * ✅ Stripe Webhooks vorbereitet
 * ✅ Premium Payment Flow
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
 */
exports.verifyAge = functions.https.onCall(async (data, context) => {
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
        // Custom Claims setzen (persistent, server-side)
        await admin.auth().setCustomUserClaims(context.auth.uid, {
            ageVerified: true,
            ageLevel: ageLevel,
            verifiedAt: Date.now()
        });

        // ✅ DSGVO: Audit-Log mit optionaler IP-Speicherung
        const auditData = {
            action: 'age_verification',
            ageLevel: ageLevel,
            timestamp: admin.database.ServerValue.TIMESTAMP,
            consentGiven: true
        };

        // ✅ DSGVO: IP nur speichern wenn explizite Einwilligung
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
 */
exports.checkCategoryAccess = functions.https.onCall(async (data, context) => {
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
 */
exports.getAnswerToken = functions.https.onCall(async (data, context) => {
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
 */
exports.validateAnswer = functions.https.onCall(async (data, context) => {
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
 * TEMPORARILY DISABLED - Enable when Stripe is configured
 */
/*
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
            await admin.database().ref(`users/${userId}/purchases/special`).set({
                id: 'special_edition',
                name: 'Special Edition',
                price: session.amount_total / 100,
                currency: session.currency,
                verified: true,
                paymentId: session.payment_intent,
                timestamp: admin.database.ServerValue.TIMESTAMP
            });

            console.log(`Premium unlocked for user: ${userId}`);
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
 * TEMPORARILY DISABLED - Enable when Stripe is configured
 */
/*
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
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
                        unit_amount: 299,
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
 */
exports.checkPremiumStatus = functions.https.onCall(async (data, context) => {
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
    try {
        await admin.auth().setCustomUserClaims(userId, {
            ...userToken,
            isPremium: true,
            premiumSince: purchase.timestamp
        });

        console.log(`✅ Premium Custom Claims updated for user ${userId}`);
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
 * 6. Cleanup: Alte Games löschen
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
 * 7. Cleanup: Alte Rate-Limits löschen
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