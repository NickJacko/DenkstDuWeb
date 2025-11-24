/**
 * No-Cap Firebase Cloud Functions
 * Server-Side Security & Payment Processing
 * Version 2.0 - Using .env instead of deprecated functions.config()
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

// ===== NEW: Load from .env instead of functions.config() =====
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const express = require('express');
const cors = require('cors');

admin.initializeApp();

// ===== CONFIGURATION =====
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_ANSWERS_PER_MINUTE = 10;
const ANSWER_TOKEN_EXPIRY = 30 * 1000; // 30 seconds

// ===== HELPER FUNCTIONS =====

/**
 * Generate secure token for answer validation
 */
function generateAnswerToken(playerId, gameId, roundNumber) {
    // ===== NEW: Use process.env instead of functions.config() =====
    const secret = process.env.APP_SECRET;
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
    // ===== NEW: Use process.env instead of functions.config() =====
    const secret = process.env.APP_SECRET;
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
 */
const app = express();
app.use(cors({ origin: true }));

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    // ===== NEW: Use process.env instead of functions.config() =====
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

/**
 * 4. Create Stripe Checkout Session
 */
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
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

/**
 * 5. Check Premium Status
 */
exports.checkPremiumStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;
    const purchaseRef = admin.database().ref(`users/${userId}/purchases/special`);
    const snapshot = await purchaseRef.once('value');

    if (!snapshot.exists()) {
        return { hasPremium: false };
    }

    const purchase = snapshot.val();

    if (purchase.verified !== true) {
        return { hasPremium: false };
    }

    return {
        hasPremium: true,
        purchaseDate: purchase.timestamp,
        productId: purchase.id
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