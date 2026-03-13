/**
 * getQuestionsForGame.js
 * Cloud Function: Loads questions from RTDB with server-side FSK18 age verification.
 * FSK0/FSK16/special: accessible to all authenticated users.
 * FSK18: requires Custom Claim fsk18 === true (set by grantFSK18Access function).
 */

"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");

exports.getQuestionsForGame = functions
    .region("europe-west1")
    .runWith({ memory: "256MB", timeoutSeconds: 15 })
    .https.onCall(async (data, context) => {
        // ── Auth check ────────────────────────────────────────────────────────
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Authentifizierung erforderlich"
            );
        }

        const { categories, count = 20 } = data;

        if (!categories || !Array.isArray(categories) || categories.length === 0) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "categories muss ein nicht-leeres Array sein"
            );
        }

        const validCategories = ["fsk0", "fsk16", "fsk18", "special"];
        const requestedCategories = categories.filter(c => validCategories.includes(c));

        if (requestedCategories.length === 0) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Keine gültigen Kategorien angegeben"
            );
        }

        // ── FSK18 access check ────────────────────────────────────────────────
        const hasFSK18Request = requestedCategories.includes("fsk18");
        if (hasFSK18Request) {
            const token = context.auth.token || {};
            const hasFSK18Claim = token.fsk18 === true;

            if (!hasFSK18Claim) {
                // Remove FSK18 silently — return other categories instead
                const idx = requestedCategories.indexOf("fsk18");
                requestedCategories.splice(idx, 1);

                if (requestedCategories.length === 0) {
                    throw new functions.https.HttpsError(
                        "permission-denied",
                        "Altersverifikation für FSK18-Inhalte erforderlich"
                    );
                }
            }
        }

        // ── Load questions from RTDB ──────────────────────────────────────────
        const db = admin.database();
        const pool = [];

        await Promise.all(
            requestedCategories.map(async (category) => {
                try {
                    const snap = await db.ref(`questions/${category}`).once("value");
                    if (snap.exists()) {
                        snap.forEach((child) => {
                            const q = child.val();
                            if (q && q.text) {
                                pool.push({
                                    id: child.key,
                                    text: q.text,
                                    category: category,
                                    difficulty: q.difficulty || "medium"
                                });
                            }
                        });
                    }
                } catch (e) {
                    // Skip category on error — don't fail entire request
                    console.warn(`getQuestionsForGame: failed to load ${category}:`, e.message);
                }
            })
        );

        if (pool.length === 0) {
            throw new functions.https.HttpsError(
                "not-found",
                "Keine Fragen für die gewählten Kategorien gefunden"
            );
        }

        // ── Shuffle and return up to `count` questions ────────────────────────
        const shuffled = pool.sort(() => Math.random() - 0.5);
        const questions = shuffled.slice(0, Math.min(count, shuffled.length));

        return { questions, total: pool.length };
    });