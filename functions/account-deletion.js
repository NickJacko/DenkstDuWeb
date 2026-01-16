"use strict";

const functions = require("firebase-functions"); // Gen1 only
const admin = require("firebase-admin");

if (admin.apps.length === 0) admin.initializeApp();

const CONFIG = {
    GRACE_PERIOD_HOURS: 48,
    // In Gen1: Nutze "firebase functions:config:set deletion.secret=..." ODER env var.
    DELETION_SECRET: process.env.DELETION_SECRET || null,
    EMAIL_SENDER: "noreply@denkstduweb.app",
    EMAIL_SUPPORT: "support@denkstduweb.app",
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
};

// --------------------
// AUTH / AUTHZ (Gen1)
// --------------------
function verifyAuthorization(context, targetUserId, secret = null) {
    const fn = "verifyAuthorization";

    if (secret && CONFIG.DELETION_SECRET && secret === CONFIG.DELETION_SECRET) {
        log.info(fn, "Authorized via secret token");
        return { authorized: true, isScheduled: true, isAdmin: false };
    }

    if (!context?.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentifizierung erforderlich");
    }

    const requestingUserId = context.auth.uid;
    const isAdmin = context.auth.token?.admin === true;

    if (targetUserId !== requestingUserId && !isAdmin) {
        throw new functions.https.HttpsError("permission-denied", "Sie können nur Ihren eigenen Account löschen");
    }

    return { authorized: true, isScheduled: false, isAdmin };
}

// Email queue (placeholder)
async function queueEmail(emailData) {
    try {
        await admin.database().ref("emailQueue").push({
            ...emailData,
            status: "pending",
            createdAt: admin.database.ServerValue.TIMESTAMP,
        });
    } catch {
        // non-fatal
    }
}

function generateDeletionScheduledEmail(userName, deletionDate) {
    return `
    <h2>Account-Löschung geplant</h2>
    <p>Hallo ${userName || "dort"},</p>
    <p><strong>Geplante Löschung:</strong> ${new Date(deletionDate).toLocaleString("de-DE")}</p>
    <p>Sie haben noch <strong>${CONFIG.GRACE_PERIOD_HOURS} Stunden</strong> Zeit, um die Löschung abzubrechen.</p>
    <hr>
    <p style="color:#666;font-size:12px;">Bei Fragen: ${CONFIG.EMAIL_SUPPORT}</p>
  `;
}

function generateCancellationEmail(userName) {
    return `
    <h2>Account-Löschung abgebrochen</h2>
    <p>Hallo ${userName || "dort"},</p>
    <p>Die Löschung wurde erfolgreich <strong>abgebrochen</strong>.</p>
    <hr>
    <p style="color:#666;font-size:12px;">Bei Fragen: ${CONFIG.EMAIL_SUPPORT}</p>
  `;
}

async function sendDeletionEmail(userEmail, userName, deletionDate, isCancellation = false) {
    if (!userEmail) return;

    const emailData = {
        to: userEmail,
        from: CONFIG.EMAIL_SENDER,
        subject: isCancellation ? "✅ Account-Löschung abgebrochen" : "⚠️ Account-Löschung geplant",
        html: isCancellation
            ? generateCancellationEmail(userName)
            : generateDeletionScheduledEmail(userName, deletionDate),
    };

    await queueEmail(emailData);
}

// ----------------------------
// ✅ Gen1 callable: scheduleAccountDeletion
// ----------------------------
exports.scheduleAccountDeletion = functions
    .region("europe-west1")
    .runWith({ memory: "256MB", timeoutSeconds: 60 })
    .https.onCall(async (data, context) => {
        const fn = "scheduleAccountDeletion";

        // optional: allow secret flow (if you ever call it server-to-server)
        const secret = data?.secret || null;

        verifyAuthorization(context, context.auth?.uid, secret);

        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Authentifizierung erforderlich");
        }

        const userId = context.auth.uid;
        const { confirmation } = data || {};

        if (confirmation !== "DELETE_MY_ACCOUNT") {
            throw new functions.https.HttpsError(
                "failed-precondition",
                'Bestätigung erforderlich: "DELETE_MY_ACCOUNT" senden.'
            );
        }

        const deletionDate = Date.now() + CONFIG.GRACE_PERIOD_HOURS * 60 * 60 * 1000;

        const userRecord = await admin.auth().getUser(userId);
        const userEmail = userRecord.email;
        const userName = userRecord.displayName;

        await admin.database().ref(`deletionRequests/${userId}`).set({
            userId,
            requestedAt: admin.database.ServerValue.TIMESTAMP,
            scheduledFor: deletionDate,
            status: "scheduled",
            email: userEmail || null,
            userName: userName || null,
            canCancelUntil: deletionDate,
        });

        await sendDeletionEmail(userEmail, userName, deletionDate, false);

        return {
            success: true,
            message: "Account-Löschung wurde geplant",
            scheduledFor: deletionDate,
            gracePeriodHours: CONFIG.GRACE_PERIOD_HOURS,
            canCancelUntil: deletionDate,
        };
    });

// ----------------------------
// ✅ Gen1 callable: cancelAccountDeletion
// ----------------------------
exports.cancelAccountDeletion = functions
    .region("europe-west1")
    .runWith({ memory: "256MB", timeoutSeconds: 60 })
    .https.onCall(async (data, context) => {
        const fn = "cancelAccountDeletion";

        // optional secret (server-to-server), otherwise user auth
        const secret = data?.secret || null;

        verifyAuthorization(context, context.auth?.uid, secret);

        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Authentifizierung erforderlich");
        }

        const userId = context.auth.uid;
        const db = admin.database();
        const ref = db.ref(`deletionRequests/${userId}`);
        const snap = await ref.once("value");

        if (!snap.exists()) {
            throw new functions.https.HttpsError("not-found", "Keine geplante Löschung gefunden");
        }

        const deletionRequest = snap.val();
        if (Date.now() > deletionRequest.canCancelUntil) {
            throw new functions.https.HttpsError("deadline-exceeded", "Karenzzeit abgelaufen. Abbruch nicht mehr möglich.");
        }

        await ref.update({ status: "cancelled", cancelledAt: admin.database.ServerValue.TIMESTAMP });

        await sendDeletionEmail(deletionRequest.email, deletionRequest.userName, null, true);

        return { success: true, message: "Account-Löschung wurde abgebrochen" };
    });

// ----------------------------
// ✅ Gen1 schedule: processScheduledDeletions
// ----------------------------
exports.processScheduledDeletions = functions
    .region("europe-west1")
    .runWith({ memory: "256MB", timeoutSeconds: 540 })
    .pubsub.schedule("0 * * * *")
    .onRun(async () => {
        const fn = "processScheduledDeletions";

        const db = admin.database();
        const now = Date.now();

        try {
            const snapshot = await db
                .ref("deletionRequests")
                .orderByChild("status")
                .equalTo("scheduled")
                .once("value");

            if (!snapshot.exists()) return null;

            const deletions = [];
            snapshot.forEach((child) => {
                const req = child.val();
                if (req?.scheduledFor && req.scheduledFor <= now) deletions.push(req.userId);
            });

            for (const uid of deletions) {
                try {
                    await executeAccountDeletion(uid);
                } catch (err) {
                    log.error(fn, "Failed to delete account", err, { uid });
                }
            }

            return null;
        } catch (err) {
            log.error(fn, "Scheduled deletion processing error", err);
            return null;
        }
    });

async function executeAccountDeletion(userId) {
    const db = admin.database();

    // Remove user profile
    await db.ref(`users/${userId}`).remove();

    // Remove from games / delete hosted games
    const gamesSnap = await db.ref("games").once("value");
    if (gamesSnap.exists()) {
        const updates = {};
        gamesSnap.forEach((g) => {
            const game = g.val();
            const gameId = g.key;

            if (game?.players?.[userId]) updates[`games/${gameId}/players/${userId}`] = null;
            if (game?.hostId === userId) updates[`games/${gameId}`] = null;
        });

        if (Object.keys(updates).length) await db.ref().update(updates);
    }

    // Remove age verification record
    await db.ref(`ageVerifications/${userId}`).remove();

    // Delete avatars
    try {
        const bucket = admin.storage().bucket();
        const [files] = await bucket.getFiles({ prefix: `avatars/${userId}/` });
        if (files?.length) await Promise.allSettled(files.map((f) => f.delete()));
    } catch {
        // non-fatal
    }

    // Delete auth user
    try {
        await admin.auth().deleteUser(userId);
    } catch (err) {
        if (err?.code !== "auth/user-not-found") throw err;
    }

    // Mark request completed
    await db.ref(`deletionRequests/${userId}`).update({
        status: "completed",
        completedAt: admin.database.ServerValue.TIMESTAMP,
    });

    // Anonymous log
    await db.ref("deletionLogs").push({
        deletedAt: admin.database.ServerValue.TIMESTAMP,
        source: "scheduled",
        gracePeriodHours: CONFIG.GRACE_PERIOD_HOURS,
    });
}
