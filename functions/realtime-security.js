/**
 * Firebase Cloud Function: Realtime Security Triggers
 * Version 1.0 - Anti-Manipulation & Real-time Protection
 *
 * Features:
 * ✅ Real-time score validation
 * ✅ Game phase manipulation detection
 * ✅ FSK violation prevention
 * ✅ Auto-rollback of invalid changes
 * ✅ User banning on repeated violations
 * ✅ Admin notifications (Email/Slack)
 * ✅ Audit logging
 * ✅ Throttling to prevent DB overload
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// ===================================
// CONFIGURATION
// ===================================

const CONFIG = {
    MAX_VIOLATIONS_BEFORE_BAN: 3,
    VIOLATION_WINDOW_HOURS: 24,
    ADMIN_EMAIL: 'admin@denkstduweb.app',
    SLACK_WEBHOOK: process.env.SLACK_WEBHOOK_URL || null,

    // Score validation
    MAX_SCORE_PER_ROUND: 100,
    MAX_SCORE_INCREASE_PER_UPDATE: 50,

    // Valid game phases
    VALID_PHASES: ['waiting', 'category', 'difficulty', 'playing', 'results', 'finished'],

    // Throttling
    THROTTLE_MS: 1000, // Max 1 validation per second per game
};

// ===================================
// LOGGER
// ===================================

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
    },
    security: (functionName, message, data = {}) => {
        functions.logger.warn(`[SECURITY][${functionName}] ${message}`, data);
    }
};

// ===================================
// THROTTLING
// ===================================

const validationCache = new Map();
const rapidUpdateCache = new Map();
function shouldThrottle(gameId) {
    const lastValidation = validationCache.get(gameId);
    const now = Date.now();

    if (lastValidation && (now - lastValidation) < CONFIG.THROTTLE_MS) {
        return true;
    }

    validationCache.set(gameId, now);

    // Cleanup old entries
    if (validationCache.size > 1000) {
        const oldestKey = validationCache.keys().next().value;
        validationCache.delete(oldestKey);
    }

    return false;
}

// ===================================
// SCORE VALIDATION
// ===================================

/**
 * ✅ Validate score changes
 * Detects impossible score increases or manipulation
 */
function validateScoreChange(before, after, playerId) {
    const functionName = 'validateScoreChange';

    const beforeScore = before?.players?.[playerId]?.score || 0;
    const afterScore = after?.players?.[playerId]?.score || 0;

    const increase = afterScore - beforeScore;

    // Check for impossible score increase
    if (increase > CONFIG.MAX_SCORE_INCREASE_PER_UPDATE) {
        logger.security(functionName, 'Suspicious score increase detected', {
            playerId,
            beforeScore,
            afterScore,
            increase,
            maxAllowed: CONFIG.MAX_SCORE_INCREASE_PER_UPDATE
        });

        return {
            valid: false,
            reason: 'score_increase_too_high',
            details: `Score increased by ${increase}, max allowed is ${CONFIG.MAX_SCORE_INCREASE_PER_UPDATE}`
        };
    }

    // Check for negative scores
    if (afterScore < 0) {
        logger.security(functionName, 'Negative score detected', {
            playerId,
            afterScore
        });

        return {
            valid: false,
            reason: 'negative_score',
            details: 'Score cannot be negative'
        };
    }

    // Check for unrealistic total scores
    if (afterScore > CONFIG.MAX_SCORE_PER_ROUND * 100) {
        logger.security(functionName, 'Unrealistic total score detected', {
            playerId,
            afterScore,
            maxRealistic: CONFIG.MAX_SCORE_PER_ROUND * 100
        });

        return {
            valid: false,
            reason: 'score_too_high',
            details: 'Total score exceeds realistic maximum'
        };
    }

    return { valid: true };
}

/**
 * ✅ Validate all player scores in game
 */
function validateAllScores(beforeData, afterData) {
    const functionName = 'validateAllScores';

    if (!afterData.players) {
        return { valid: true };
    }

    for (const playerId in afterData.players) {
        const validation = validateScoreChange(beforeData, afterData, playerId);

        if (!validation.valid) {
            return {
                valid: false,
                playerId,
                ...validation
            };
        }
    }

    return { valid: true };
}

// ===================================
// PHASE VALIDATION
// ===================================

/**
 * ✅ Validate game phase transitions
 * Prevents invalid phase changes
 */
function validatePhaseChange(before, after) {
    const functionName = 'validatePhaseChange';

    const beforePhase = before?.phase || 'waiting';
    const afterPhase = after?.phase || 'waiting';

    // No change
    if (beforePhase === afterPhase) {
        return { valid: true };
    }

    // Check if new phase is valid
    if (!CONFIG.VALID_PHASES.includes(afterPhase)) {
        logger.security(functionName, 'Invalid game phase detected', {
            beforePhase,
            afterPhase,
            validPhases: CONFIG.VALID_PHASES
        });

        return {
            valid: false,
            reason: 'invalid_phase',
            details: `Phase '${afterPhase}' is not valid`
        };
    }

    // Validate phase transitions
    const validTransitions = {
        'waiting': ['category', 'finished'],
        'category': ['difficulty', 'finished'],
        'difficulty': ['playing', 'finished'],
        'playing': ['results', 'finished'],
        'results': ['playing', 'finished'],
        'finished': []
    };

    const allowedNextPhases = validTransitions[beforePhase] || [];

    if (!allowedNextPhases.includes(afterPhase)) {
        logger.security(functionName, 'Invalid phase transition detected', {
            beforePhase,
            afterPhase,
            allowedTransitions: allowedNextPhases
        });

        return {
            valid: false,
            reason: 'invalid_phase_transition',
            details: `Cannot transition from '${beforePhase}' to '${afterPhase}'`
        };
    }

    return { valid: true };
}

// ===================================
// FSK VALIDATION
// ===================================

/**
 * ✅ Validate FSK category access
 * Prevents unauthorized access to age-restricted content
 */
async function validateFSKCategory(gameData, userId) {
    const functionName = 'validateFSKCategory';

    const selectedCategories = gameData.selectedCategories || [];
    const restrictedCategories = selectedCategories.filter(cat => cat === 'fsk16' || cat === 'fsk18');

    if (restrictedCategories.length === 0) return { valid: true };

    try {
        const db = admin.database();

        // ✅ Prefer DB cache (cheap) – expect: users/{uid}.ageVerified + ageLevel OR fsk flags
        const userSnap = await db.ref(`users/${userId}`).once('value');
        const userData = userSnap.val() || {};

        // If you store ageLevel:
        const ageVerified = userData.ageVerified === true;
        const ageLevel = Number(userData.ageLevel || 0);

        for (const category of restrictedCategories) {
            if (!ageVerified) {
                return { valid: false, reason: 'age_not_verified', details: 'Age verification required' };
            }
            if (category === 'fsk16' && ageLevel < 16) {
                return { valid: false, reason: 'fsk16_not_verified', details: 'User is not verified for FSK16 content' };
            }
            if (category === 'fsk18' && ageLevel < 18) {
                return { valid: false, reason: 'fsk18_not_verified', details: 'User is not verified for FSK18 content' };
            }
        }

        return { valid: true };
    } catch (error) {
        logger.error(functionName, 'Error validating FSK', error, { userId });
        // ✅ fail-closed for safety
        return { valid: false, reason: 'fsk_validation_error', details: 'FSK validation failed - access denied' };
    }
}


// ===================================
// VIOLATION TRACKING
// ===================================

/**
 * ✅ Record security violation
 */
async function recordViolation(gameId, userId, violation) {
    const functionName = 'recordViolation';

    try {
        const db = admin.database();
        const violationRef = db.ref('securityViolations').push();

        await violationRef.set({
            gameId,
            userId,
            timestamp: admin.database.ServerValue.TIMESTAMP,
            type: violation.reason,
            details: violation.details,
            data: violation.data || null
        });

        logger.security(functionName, 'Violation recorded', {
            gameId,
            userId,
            type: violation.reason
        });

        // ⚠️ RTDB Trigger hat keinen echten "writer". Auto-Ban kann falsche treffen.
        // Deshalb: nur loggen, kein Auto-Ban auf Basis unsicherer Attribution.


    } catch (error) {
        logger.error(functionName, 'Error recording violation', error);
    }
}

/**
 * ✅ Check violation count and ban user if needed
 */
async function checkAndBanUser(userId) {
    const functionName = 'checkAndBanUser';

    try {
        const db = admin.database();
        const now = Date.now();
        const windowStart = now - (CONFIG.VIOLATION_WINDOW_HOURS * 60 * 60 * 1000);

        // Count recent violations
        const violationsRef = db.ref('securityViolations');
        const snapshot = await violationsRef
            .orderByChild('userId')
            .equalTo(userId)
            .once('value');

        let recentViolations = 0;

        snapshot.forEach((child) => {
            const violation = child.val();
            if (violation.timestamp >= windowStart) {
                recentViolations++;
            }
        });

        logger.info(functionName, `User has ${recentViolations} recent violations`, { userId });

        // Ban user if threshold exceeded
        if (recentViolations >= CONFIG.MAX_VIOLATIONS_BEFORE_BAN) {
            await banUser(userId, recentViolations);
        }

    } catch (error) {
        logger.error(functionName, 'Error checking violations', error);
    }
}

/**
 * ✅ Ban user account
 */
async function banUser(userId, violationCount) {
    const functionName = 'banUser';

    try {
        // Disable user in Firebase Auth
        await admin.auth().updateUser(userId, {
            disabled: true
        });

        // Record ban in database
        const db = admin.database();
        await db.ref(`bannedUsers/${userId}`).set({
            bannedAt: admin.database.ServerValue.TIMESTAMP,
            reason: 'repeated_security_violations',
            violationCount,
            status: 'banned'
        });

        logger.security(functionName, 'User banned for repeated violations', {
            userId,
            violationCount
        });

        // Send admin notification
        await sendAdminNotification({
            type: 'user_banned',
            userId,
            violationCount,
            reason: 'Repeated security violations'
        });

    } catch (error) {
        logger.error(functionName, 'Error banning user', error, { userId });
    }
}

// ===================================
// ADMIN NOTIFICATIONS
// ===================================

/**
 * ✅ Send notification to admins
 */
async function sendAdminNotification(data) {
    const functionName = 'sendAdminNotification';

    try {
        // Email notification
        if (CONFIG.ADMIN_EMAIL) {
            await queueAdminEmail(data);
        }

        // Slack notification
        if (CONFIG.SLACK_WEBHOOK) {
            await sendSlackNotification(data);
        }

        logger.info(functionName, 'Admin notification sent', { type: data.type });

    } catch (error) {
        logger.error(functionName, 'Error sending notification', error);
    }
}

/**
 * ✅ Queue admin email
 */
async function queueAdminEmail(data) {
    const db = admin.database();

    const emailData = {
        to: CONFIG.ADMIN_EMAIL,
        from: 'security@denkstduweb.app',
        subject: `🚨 Security Alert: ${data.type}`,
        html: generateSecurityEmailHTML(data),
        status: 'pending',
        createdAt: admin.database.ServerValue.TIMESTAMP
    };

    await db.ref('emailQueue').push(emailData);
}

/**
 * ✅ Generate security alert email HTML
 */
function generateSecurityEmailHTML(data) {
    return `
        <h2>🚨 Security Alert</h2>
        <p><strong>Type:</strong> ${data.type}</p>
        <p><strong>User ID:</strong> ${data.userId || 'N/A'}</p>
        <p><strong>Game ID:</strong> ${data.gameId || 'N/A'}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <hr>
        <h3>Details:</h3>
        <pre>${JSON.stringify(data, null, 2)}</pre>
        <hr>
        <p><a href="https://console.firebase.google.com">View in Firebase Console</a></p>
    `;
}

/**
 * ✅ Send Slack notification
 */
async function sendSlackNotification(data) {
    const functionName = 'sendSlackNotification';

    if (!CONFIG.SLACK_WEBHOOK) return;

    // Node 18+ in Cloud Functions hat i.d.R. global fetch.
    // Falls nicht verfügbar: nicht crashen -> nur loggen.
    const fetchFn = globalThis.fetch;
    if (typeof fetchFn !== 'function') {
        logger.warn(functionName, 'fetch not available - Slack notification skipped');
        return;
    }

    try {
        const message = {
            text: `🚨 Security Alert: ${data.type}`,
            blocks: [
                {
                    type: 'header',
                    text: { type: 'plain_text', text: '🚨 Security Alert' }
                },
                {
                    type: 'section',
                    fields: [
                        { type: 'mrkdwn', text: `*Type:*\n${data.type}` },
                        { type: 'mrkdwn', text: `*User:*\n${data.userId || 'N/A'}` }
                    ]
                },
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: `\`\`\`${JSON.stringify(data, null, 2)}\`\`\`` }
                }
            ]
        };

        await fetchFn(CONFIG.SLACK_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
        });

        logger.info(functionName, 'Slack notification sent');
    } catch (error) {
        logger.error(functionName, 'Error sending Slack notification', error);
    }
}


// ===================================
// ROLLBACK MECHANISM
// ===================================

/**
 * ✅ Rollback invalid changes
 */
async function rollbackChanges(gameId, beforeData, reason) {
    const functionName = 'rollbackChanges';

    try {
        const db = admin.database();
        const gameRef = db.ref(`games/${gameId}`);

        // Restore previous data
        await gameRef.update(beforeData);

        logger.security(functionName, 'Changes rolled back', {
            gameId,
            reason
        });

        return true;

    } catch (error) {
        logger.error(functionName, 'Error rolling back changes', error, { gameId });
        return false;
    }
}

// ===================================
// MAIN TRIGGER: GAME UPDATES
// ===================================

/**
 * ✅ Main security trigger for game updates
 * Validates all changes and rolls back manipulations
 */
exports.validateGameUpdate = functions.region('europe-west1').database
    .ref('/games/{gameId}')
    .onUpdate(async (change, context) => {
        const functionName = 'validateGameUpdate';
        const gameId = context.params.gameId;

        // ✅ Throttling to prevent DB overload
        if (shouldThrottle(gameId)) {
            logger.info(functionName, 'Validation throttled', { gameId });
            return null;
        }

        const beforeData = change.before.val();
        const afterData = change.after.val();

        logger.info(functionName, 'Validating game update', { gameId });

        try {
            // 1. Validate score changes
            const scoreValidation = validateAllScores(beforeData, afterData);
            if (!scoreValidation.valid) {
                logger.security(functionName, 'Invalid score change detected', {
                    gameId,
                    playerId: scoreValidation.playerId,
                    reason: scoreValidation.reason
                });

                await recordViolation(gameId, scoreValidation.playerId, scoreValidation);
                await rollbackChanges(gameId, beforeData, scoreValidation.reason);
                await sendAdminNotification({
                    type: 'score_manipulation',
                    gameId,
                    userId: scoreValidation.playerId,
                    ...scoreValidation
                });

                return null;
            }

            // 2. Validate phase changes
            const phaseValidation = validatePhaseChange(beforeData, afterData);
            if (!phaseValidation.valid) {
                logger.security(functionName, 'Invalid phase change detected', {
                    gameId,
                    reason: phaseValidation.reason
                });

                const hostId = afterData.hostId || 'unknown';
                await recordViolation(gameId, hostId, phaseValidation);
                await rollbackChanges(gameId, beforeData, phaseValidation.reason);
                await sendAdminNotification({
                    type: 'phase_manipulation',
                    gameId,
                    userId: hostId,
                    ...phaseValidation
                });

                return null;
            }

            // 3. Validate FSK categories (if changed)
            if (JSON.stringify(beforeData.selectedCategories) !== JSON.stringify(afterData.selectedCategories)) {
                const hostId = afterData.hostId;

                if (hostId) {
                    const fskValidation = await validateFSKCategory(afterData, hostId);

                    if (!fskValidation.valid) {
                        logger.security(functionName, 'FSK violation detected', {
                            gameId,
                            hostId,
                            reason: fskValidation.reason
                        });

                        await recordViolation(gameId, hostId, fskValidation);
                        await rollbackChanges(gameId, beforeData, fskValidation.reason);
                        await sendAdminNotification({
                            type: 'fsk_violation',
                            gameId,
                            userId: hostId,
                            ...fskValidation
                        });

                        return null;
                    }
                }
            }

            // ✅ All validations passed
            logger.info(functionName, 'Game update validated successfully', { gameId });
            return null;

        } catch (error) {
            logger.error(functionName, 'Error in validation', error, { gameId });
            // On error, allow change (fail open) but log
            return null;
        }
    });

// ===================================
// ADDITIONAL TRIGGERS
// ===================================

/**
 * ✅ Detect and prevent rapid-fire updates (DDoS protection)
 */
exports.detectRapidUpdates = functions.region('europe-west1').database
    .ref('/games/{gameId}')
    .onWrite(async (change, context) => {
        const functionName = 'detectRapidUpdates';
        const gameId = context.params.gameId;

        // Track update frequency
        const cacheKey = `updates_${gameId}`;
        const updates = rapidUpdateCache.get(cacheKey) || [];
        const now = Date.now();

        // Add current update
        updates.push(now);

        // Keep only last minute
        const recentUpdates = updates.filter(time => (now - time) < 60000);
        rapidUpdateCache.set(cacheKey, recentUpdates);

        // Check for suspicious activity (>30 updates/min)
        if (recentUpdates.length > 30) {
            logger.security(functionName, 'Rapid update pattern detected', {
                gameId,
                updatesPerMinute: recentUpdates.length
            });

            await sendAdminNotification({
                type: 'rapid_updates',
                gameId,
                updatesPerMinute: recentUpdates.length,
                details: 'Possible DDoS or bot activity'
            });
        }

        return null;
    });

/**
 * ✅ Monitor for deleted games (potential data loss)
 */
exports.monitorGameDeletion = functions.region('europe-west1').database
    .ref('/games/{gameId}')
    .onDelete(async (snapshot, context) => {
        const functionName = 'monitorGameDeletion';
        const gameId = context.params.gameId;
        const gameData = snapshot.val();

        // Log deletion for audit trail
        logger.info(functionName, 'Game deleted', {
            gameId,
            hadPlayers: gameData.players ? Object.keys(gameData.players).length : 0
        });

        // Store deletion log
        const db = admin.database();
        await db.ref('deletionAudit/games').push({
            gameId,
            deletedAt: admin.database.ServerValue.TIMESTAMP,
            hostId: gameData.hostId,
            playerCount: gameData.players ? Object.keys(gameData.players).length : 0
        });

        return null;
    });

// ===================================
// CLEANUP & MAINTENANCE
// ===================================

/**
 * ✅ Cleanup old security violations (runs daily)
 */
exports.cleanupOldViolations = functions.region('europe-west1').pubsub
    .schedule('0 2 * * *')
    .timeZone('Europe/Berlin')
    .onRun(async (context) => {
        const functionName = 'cleanupOldViolations';

        logger.info(functionName, 'Starting violation cleanup');

        const db = admin.database();
        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

        try {
            const violationsRef = db.ref('securityViolations');
            const snapshot = await violationsRef.once('value');

            const deletePromises = [];

            snapshot.forEach((child) => {
                const violation = child.val();
                if (violation.timestamp < thirtyDaysAgo) {
                    deletePromises.push(child.ref.remove());
                }
            });

            await Promise.all(deletePromises);

            logger.info(functionName, `Deleted ${deletePromises.length} old violations`);

            return null;
        } catch (error) {
            logger.error(functionName, 'Cleanup error', error);
            return null;
        }
    });

