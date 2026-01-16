"use strict";

/**
 * Firebase Cloud Function: Realtime Security Triggers (Gen1 RTDB)
 */

const admin = require("firebase-admin");
const functions = require("firebase-functions/v1"); // Gen1

if (admin.apps.length === 0) admin.initializeApp();

const CONFIG = {
  MAX_VIOLATIONS_BEFORE_BAN: 3,
  VIOLATION_WINDOW_HOURS: 24,
  ADMIN_EMAIL: "admin@denkstduweb.app",
  SLACK_WEBHOOK: process.env.SLACK_WEBHOOK_URL || null,

  MAX_SCORE_PER_ROUND: 100,
  MAX_SCORE_INCREASE_PER_UPDATE: 50,

  VALID_PHASES: ["waiting", "category", "difficulty", "playing", "results", "finished"],

  THROTTLE_MS: 1000,
};

// --------------------
// LOGGER (Gen1 logger)
// --------------------
const log = {
  info: (fn, msg, data = {}) => functions.logger.info(`[${fn}] ${msg}`, data),
  warn: (fn, msg, data = {}) => functions.logger.warn(`[${fn}] ${msg}`, data),
  error: (fn, msg, err, data = {}) =>
    functions.logger.error(`[${fn}] ${msg}`, {
      error: err?.message || err,
      stack: err?.stack,
      ...data,
    }),
  security: (fn, msg, data = {}) => functions.logger.warn(`[SECURITY][${fn}] ${msg}`, data),
};

const validationCache = new Map();
const rapidUpdateCache = new Map();

function shouldThrottle(key) {
  const last = validationCache.get(key);
  const now = Date.now();
  if (last && now - last < CONFIG.THROTTLE_MS) return true;

  validationCache.set(key, now);
  if (validationCache.size > 2000) validationCache.delete(validationCache.keys().next().value);
  return false;
}

function validateScoreChange(before, after, playerId) {
  const beforeScore = before?.players?.[playerId]?.score || 0;
  const afterScore = after?.players?.[playerId]?.score || 0;
  const increase = afterScore - beforeScore;

  if (increase > CONFIG.MAX_SCORE_INCREASE_PER_UPDATE) {
    return { valid: false, reason: "score_increase_too_high", details: `Score +${increase} too high` };
  }
  if (afterScore < 0) {
    return { valid: false, reason: "negative_score", details: "Score cannot be negative" };
  }
  if (afterScore > CONFIG.MAX_SCORE_PER_ROUND * 100) {
    return { valid: false, reason: "score_too_high", details: "Total score exceeds realistic maximum" };
  }
  return { valid: true };
}

function validateAllScores(beforeData, afterData) {
  if (!afterData?.players) return { valid: true };

  for (const playerId in afterData.players) {
    const validation = validateScoreChange(beforeData, afterData, playerId);
    if (!validation.valid) return { valid: false, playerId, ...validation };
  }
  return { valid: true };
}

function validatePhaseChange(before, after) {
  const beforePhase = before?.phase || "waiting";
  const afterPhase = after?.phase || "waiting";
  if (beforePhase === afterPhase) return { valid: true };

  if (!CONFIG.VALID_PHASES.includes(afterPhase)) {
    return { valid: false, reason: "invalid_phase", details: `Phase '${afterPhase}' is not valid` };
  }

  const validTransitions = {
    waiting: ["category", "finished"],
    category: ["difficulty", "finished"],
    difficulty: ["playing", "finished"],
    playing: ["results", "finished"],
    results: ["playing", "finished"],
    finished: [],
  };

  const allowed = validTransitions[beforePhase] || [];
  if (!allowed.includes(afterPhase)) {
    return {
      valid: false,
      reason: "invalid_phase_transition",
      details: `Cannot transition from '${beforePhase}' to '${afterPhase}'`,
    };
  }
  return { valid: true };
}

async function validateFSKCategory(gameData, userId) {
  const selectedCategories = Array.isArray(gameData?.selectedCategories) ? gameData.selectedCategories : [];
  const restricted = selectedCategories.filter((c) => c === "fsk16" || c === "fsk18");
  if (restricted.length === 0) return { valid: true };

  try {
    const userSnap = await admin.database().ref(`users/${userId}`).once("value");
    const userData = userSnap.val() || {};
    const ageVerified = userData.ageVerified === true;
    const ageLevel = Number(userData.ageLevel || 0);

    for (const category of restricted) {
      if (!ageVerified) return { valid: false, reason: "age_not_verified", details: "Age verification required" };
      if (category === "fsk16" && ageLevel < 16)
        return { valid: false, reason: "fsk16_not_verified", details: "FSK16 required" };
      if (category === "fsk18" && ageLevel < 18)
        return { valid: false, reason: "fsk18_not_verified", details: "FSK18 required" };
    }
    return { valid: true };
  } catch (err) {
    log.error("validateFSKCategory", "Error validating FSK", err, { userId });
    return { valid: false, reason: "fsk_validation_error", details: "FSK validation failed - access denied" };
  }
}

async function recordViolation(gameId, userId, violation) {
  try {
    await admin.database().ref("securityViolations").push({
      gameId,
      userId: userId || null,
      timestamp: admin.database.ServerValue.TIMESTAMP,
      type: violation.reason,
      details: violation.details,
      writerUnknown: true,
      attribution: "best_effort",
    });
  } catch (err) {
    log.error("recordViolation", "Error recording violation", err);
  }
}

async function queueAdminEmail(data) {
  const emailData = {
    to: CONFIG.ADMIN_EMAIL,
    from: "security@denkstduweb.app",
    subject: `🚨 Security Alert: ${data.type}`,
    html: `
<h2>🚨 Security Alert</h2>
<pre>${JSON.stringify(data, null, 2)}</pre>
    `,
    status: "pending",
    createdAt: admin.database.ServerValue.TIMESTAMP,
  };
  await admin.database().ref("emailQueue").push(emailData);
}

async function sendSlackNotification(data) {
  if (!CONFIG.SLACK_WEBHOOK) return;

  const fetchFn = globalThis.fetch;
  if (typeof fetchFn !== "function") return;

  try {
    await fetchFn(CONFIG.SLACK_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `🚨 Security Alert: ${data.type}`, data }),
    });
  } catch (err) {
    log.error("sendSlackNotification", "Error sending slack webhook", err);
  }
}

async function sendAdminNotification(data) {
  try {
    if (CONFIG.ADMIN_EMAIL) await queueAdminEmail(data);
    if (CONFIG.SLACK_WEBHOOK) await sendSlackNotification(data);
  } catch (err) {
    log.error("sendAdminNotification", "Error sending notification", err);
  }
}

async function rollbackChanges(gameId, beforeData, reason) {
  try {
    await admin.database().ref(`games/${gameId}`).update({
      ...beforeData,
      _security: {
        ...(beforeData?._security || {}),
        rolledBackAt: admin.database.ServerValue.TIMESTAMP,
        rollbackReason: reason,
      },
    });
    return true;
  } catch (err) {
    log.error("rollbackChanges", "Error rolling back changes", err, { gameId });
    return false;
  }
}

// ----------------------------
// MAIN TRIGGER: onUpdate
// ----------------------------
exports.validateGameUpdate = functions
  .region("europe-west1")
  .database.ref("/games/{gameId}")
  .onUpdate(async (change, context) => {
    const fn = "validateGameUpdate";
    const gameId = context.params.gameId;

    if (shouldThrottle(`validate_${gameId}`)) return null;

    const beforeData = change.before.val();
    const afterData = change.after.val();

    const rolledBackAt = afterData?._security?.rolledBackAt;
    const prevRolledBackAt = beforeData?._security?.rolledBackAt;
    if (rolledBackAt && rolledBackAt !== prevRolledBackAt) return null;

    try {
      const scoreValidation = validateAllScores(beforeData, afterData);
      if (!scoreValidation.valid) {
        await recordViolation(gameId, scoreValidation.playerId, scoreValidation);
        await rollbackChanges(gameId, beforeData, scoreValidation.reason);
        await sendAdminNotification({
          type: "score_manipulation",
          gameId,
          userId: scoreValidation.playerId,
          ...scoreValidation,
        });
        return null;
      }

      const phaseValidation = validatePhaseChange(beforeData, afterData);
      if (!phaseValidation.valid) {
        const hostId = afterData?.hostId || null;
        await recordViolation(gameId, hostId, phaseValidation);
        await rollbackChanges(gameId, beforeData, phaseValidation.reason);
        await sendAdminNotification({
          type: "phase_manipulation",
          gameId,
          userId: hostId,
          ...phaseValidation,
        });
        return null;
      }

      const beforeCats = Array.isArray(beforeData?.selectedCategories) ? beforeData.selectedCategories : [];
      const afterCats = Array.isArray(afterData?.selectedCategories) ? afterData.selectedCategories : [];
      const catsChanged = beforeCats.length !== afterCats.length || beforeCats.some((c, i) => c !== afterCats[i]);

      if (catsChanged) {
        const hostId = afterData?.hostId;
        if (hostId) {
          const fskValidation = await validateFSKCategory(afterData, hostId);
          if (!fskValidation.valid) {
            await recordViolation(gameId, hostId, fskValidation);
            await rollbackChanges(gameId, beforeData, fskValidation.reason);
            await sendAdminNotification({
              type: "fsk_violation",
              gameId,
              userId: hostId,
              ...fskValidation,
            });
            return null;
          }
        }
      }

      return null;
    } catch (err) {
      log.error(fn, "Error in validation", err, { gameId });
      return null;
    }
  });

// ----------------------------
// Additional triggers
// ----------------------------
exports.detectRapidUpdates = functions
  .region("europe-west1")
  .database.ref("/games/{gameId}")
  .onWrite(async (change, context) => {
    const gameId = context.params.gameId;
    const cacheKey = `updates_${gameId}`;
    const now = Date.now();

    const updates = rapidUpdateCache.get(cacheKey) || [];
    updates.push(now);

    const recent = updates.filter((t) => now - t < 60000);
    rapidUpdateCache.set(cacheKey, recent);
    if (rapidUpdateCache.size > 2000) rapidUpdateCache.delete(rapidUpdateCache.keys().next().value);

    if (recent.length > 30) {
      await sendAdminNotification({ type: "rapid_updates", gameId, updatesPerMinute: recent.length });
    }

    return null;
  });

exports.monitorGameDeletion = functions
  .region("europe-west1")
  .database.ref("/games/{gameId}")
  .onDelete(async (snapshot, context) => {
    const gameId = context.params.gameId;
    const gameData = snapshot.val();

    await admin.database().ref("deletionAudit/games").push({
      gameId,
      deletedAt: admin.database.ServerValue.TIMESTAMP,
      hostId: gameData?.hostId || null,
      playerCount: gameData?.players ? Object.keys(gameData.players).length : 0,
    });

    return null;
  });

exports.cleanupOldViolations = functions
    .region("europe-west1")
    .runWith({ memory: "256MB", timeoutSeconds: 300 })
    .pubsub.schedule("0 2 * * *")
    .onRun(async () => {
        const now = Date.now();
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

        const snapshot = await admin.database().ref("securityViolations").once("value");
        if (!snapshot.exists()) return null;

        const deletePromises = [];
        snapshot.forEach((child) => {
            const v = child.val();
            if (v?.timestamp && v.timestamp < thirtyDaysAgo) deletePromises.push(child.ref.remove());
        });

        await Promise.allSettled(deletePromises);
        return null;
    });
