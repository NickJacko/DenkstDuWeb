# ✅ Analyse & Empfehlungen functions/index.js

## 📋 Übersicht

Die Cloud Functions sind gut strukturiert mit Server-Side Security. Es gibt noch einige TODOs die implementiert werden sollten.

---

## 🎯 Aktuelle Implementierung (v2.1)

### ✅ Bereits implementiert

1. **verifyAge()** - Age-Verification mit Custom Claims
2. **checkCategoryAccess()** - FSK & Premium Validation
3. **generateAnswerToken()** - HMAC Token Generation
4. **validateAnswerToken()** - Token Validation
5. **checkPremiumStatus()** - Premium Check mit Fallback
6. **cleanupOldGames()** - Scheduled Cleanup (Cron)
7. **cleanupRateLimits()** - Rate-Limit Cleanup

### ⚠️ TODOs (noch nicht aktiv)

1. **Stripe Webhooks** - Auskommentiert, muss aktiviert werden
2. **APP_SECRET** - Via process.env, muss gesetzt werden
3. **IP-Logging** - DSGVO-konform implementieren
4. **Stripe Payment-Flow** - Vollständig implementieren

---

## 🔒 1. Security-Analyse

### ✅ Gut implementiert

#### Custom Claims (Age & Premium)
```javascript
await admin.auth().setCustomUserClaims(context.auth.uid, {
    ageVerified: true,
    ageLevel: ageLevel,
    verifiedAt: admin.database.ServerValue.TIMESTAMP
});
```

**Vorteil**:
- Server-Side Validation
- Nicht vom Client manipulierbar
- Automatisch in `auth.token` verfügbar

#### HMAC Token-Validierung
```javascript
const secret = process.env.APP_SECRET;
const hmac = crypto.createHmac('sha256', secret);
hmac.update(`${playerId}-${gameId}-${timestamp}`);
const token = hmac.digest('hex');
```

**Vorteil**:
- Verhindert Token-Fälschung
- Zeitbasierte Validierung (30 Sekunden)
- Rate-Limiting (10 Requests/Minute)

#### Audit-Logging
```javascript
await admin.database().ref(`audit_logs/${context.auth.uid}`).push({
    action: 'age_verification',
    ageLevel: ageLevel,
    timestamp: admin.database.ServerValue.TIMESTAMP,
    ip: context.rawRequest ? context.rawRequest.ip : 'unknown'
});
```

**Vorteil**:
- Compliance (DSGVO Dokumentationspflicht)
- Nachvollziehbarkeit
- Missbrauchserkennung

---

## ⚠️ 2. TODOs - Implementierungsempfehlungen

### TODO 1: APP_SECRET setzen

**Aktuell**:
```javascript
const secret = process.env.APP_SECRET;
if (!secret) {
    throw new functions.https.HttpsError(
        'failed-precondition',
        'APP_SECRET not configured'
    );
}
```

**Empfehlung**:
```bash
# 1. Secret generieren (starkes Passwort)
openssl rand -hex 64

# 2. In Firebase Secret Manager setzen
firebase functions:secrets:set APP_SECRET
# → Eingabe: [generiertes Secret]

# 3. Secret in Function nutzen
# functions/index.js wird automatisch process.env.APP_SECRET haben

# 4. Deploy
firebase deploy --only functions
```

**Wichtig**:
- ✅ NIEMALS im Code hardcoden
- ✅ NIEMALS in Git committen
- ✅ Nur via Secret Manager

---

### TODO 2: Stripe-Webhooks aktivieren

**Aktuell** (auskommentiert):
```javascript
// const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
// const express = require('express');
// const cors = require('cors');
```

**Implementierung**:

#### Schritt 1: Secrets setzen
```bash
# 1. Stripe Secret Key setzen
firebase functions:secrets:set STRIPE_SECRET_KEY
# → Eingabe: sk_live_...

# 2. Webhook Secret setzen
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# → Eingabe: whsec_...
```

#### Schritt 2: Code aktivieren
```javascript
// functions/index.js (Zeile 11-13 uncomment)
const stripe = process.env.STRIPE_SECRET_KEY ? 
    require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const express = require('express');
const cors = require('cors');
```

#### Schritt 3: Dependencies installieren
```bash
cd functions
npm install stripe express cors
```

#### Schritt 4: Webhook-Endpoint deployen
```bash
firebase deploy --only functions:stripeWebhook
```

#### Schritt 5: Stripe Dashboard konfigurieren
```
1. https://dashboard.stripe.com/webhooks
2. Add Endpoint: https://YOUR-PROJECT.cloudfunctions.net/stripeWebhook
3. Events auswählen:
   - checkout.session.completed
   - customer.subscription.created
   - customer.subscription.deleted
4. Webhook Secret kopieren → firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

---

### TODO 3: IP-Logging DSGVO-konform

**Aktuell** (speichert immer IP):
```javascript
ip: context.rawRequest ? context.rawRequest.ip : 'unknown'
```

**Problem**: DSGVO verlangt Opt-in für IP-Speicherung

**Lösung**:

#### Option A: IP-Hashing (Pseudonymisierung)
```javascript
// IP-Adresse hashen statt speichern
const hashedIP = context.rawRequest ? 
    crypto.createHash('sha256').update(context.rawRequest.ip).digest('hex').substring(0, 16) : 
    'unknown';

await admin.database().ref(`audit_logs/${context.auth.uid}`).push({
    action: 'age_verification',
    ageLevel: ageLevel,
    timestamp: admin.database.ServerValue.TIMESTAMP,
    ipHash: hashedIP  // Gehashte IP, nicht personenbezogen
});
```

**Vorteil**:
- Kein Personenbezug
- Missbrauchserkennung möglich (gleiche Hash = gleiche IP)
- DSGVO-konform ohne Consent

#### Option B: Consent-Check
```javascript
// Nur speichern wenn User zugestimmt hat
const userConsent = await admin.database()
    .ref(`users/${context.auth.uid}/analyticsConsent`)
    .once('value');

const logData = {
    action: 'age_verification',
    ageLevel: ageLevel,
    timestamp: admin.database.ServerValue.TIMESTAMP
};

// IP nur bei Consent
if (userConsent.val() === true && context.rawRequest) {
    logData.ip = context.rawRequest.ip;
}

await admin.database().ref(`audit_logs/${context.auth.uid}`).push(logData);
```

**Vorteil**:
- DSGVO-konform
- Opt-in statt Opt-out
- Nutzer hat Kontrolle

#### Empfehlung: Option A (IP-Hashing)
```javascript
// Zentrale Funktion für sicheres IP-Logging
function getPrivacyCompliantIP(context) {
    if (!context.rawRequest || !context.rawRequest.ip) {
        return 'unknown';
    }
    
    // SHA-256 Hash der IP (erste 16 Zeichen)
    return crypto.createHash('sha256')
        .update(context.rawRequest.ip)
        .digest('hex')
        .substring(0, 16);
}

// Nutzung in allen Functions
await admin.database().ref(`audit_logs/${context.auth.uid}`).push({
    action: 'age_verification',
    ageLevel: ageLevel,
    timestamp: admin.database.ServerValue.TIMESTAMP,
    ipHash: getPrivacyCompliantIP(context)  // ✅ DSGVO-konform
});
```

---

## 🔐 3. Premium-Flow Implementierung

### Vollständiger Stripe-Flow

#### 1. Checkout-Session erstellen
```javascript
// NEU: Function für Checkout-Session
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (!stripe) {
        throw new functions.https.HttpsError('failed-precondition', 'Stripe not configured');
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'paypal', 'sepa_debit'],
            mode: 'payment',  // Einmalzahlung, oder 'subscription'
            customer_email: context.auth.token.email || undefined,
            client_reference_id: context.auth.uid,
            line_items: [{
                price: process.env.STRIPE_PREMIUM_PRICE_ID,  // Price-ID aus Stripe Dashboard
                quantity: 1
            }],
            success_url: `https://no-cap.app/premium-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `https://no-cap.app/premium-cancel`,
            metadata: {
                userId: context.auth.uid,
                type: 'premium_purchase'
            }
        });

        console.log(`✅ Checkout session created for ${context.auth.uid}`);
        
        return {
            sessionId: session.id,
            url: session.url
        };
    } catch (error) {
        console.error('❌ Checkout session creation failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to create checkout session');
    }
});
```

#### 2. Webhook-Handler
```javascript
// Bereits vorhanden, muss aktiviert werden (Zeile 348+)
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!stripe || !webhookSecret) {
        res.status(500).send('Stripe not configured');
        return;
    }

    // Webhook-Signatur verifizieren
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
        console.error('⚠️ Webhook signature verification failed:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Event-Handling
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata.userId;

        if (userId) {
            try {
                // Premium-Status aktivieren
                await admin.auth().setCustomUserClaims(userId, {
                    isPremium: true,
                    premiumActivatedAt: Date.now()
                });

                // In Database speichern
                await admin.database().ref(`users/${userId}/premium`).set({
                    active: true,
                    activatedAt: admin.database.ServerValue.TIMESTAMP,
                    sessionId: session.id,
                    amountPaid: session.amount_total,
                    currency: session.currency
                });

                // Audit-Log
                await admin.database().ref(`audit_logs/${userId}`).push({
                    action: 'premium_activated',
                    sessionId: session.id,
                    timestamp: admin.database.ServerValue.TIMESTAMP
                });

                console.log(`✅ Premium activated for user ${userId}`);
            } catch (error) {
                console.error(`❌ Failed to activate premium for ${userId}:`, error);
            }
        }
    }

    res.status(200).send('OK');
});
```

---

## 📊 4. Mini-Diff-Checkliste - Status

| TODO | Status | Priorität | Lösung |
|------|--------|-----------|--------|
| APP_SECRET setzen | ⚠️ **TODO** | 🔥 Hoch | Secret Manager |
| Stripe Webhooks aktivieren | ⚠️ **TODO** | ⚠️ Mittel | Code uncomment + Deploy |
| IP-Logging DSGVO-konform | ⚠️ **TODO** | 🔥 Hoch | IP-Hashing implementieren |
| Premium-Flow vollständig | ⚠️ **TODO** | ⚠️ Mittel | Checkout + Webhook |

---

## 🚀 5. Deployment-Schritte

### Schritt 1: Secrets setzen (KRITISCH)

```bash
# 1. APP_SECRET generieren und setzen
openssl rand -hex 64
firebase functions:secrets:set APP_SECRET
# → Paste generiertes Secret

# 2. Stripe Secrets (wenn Premium aktiviert)
firebase functions:secrets:set STRIPE_SECRET_KEY
# → sk_live_... (von Stripe Dashboard)

firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# → whsec_... (nach Webhook-Erstellung)

firebase functions:secrets:set STRIPE_PREMIUM_PRICE_ID
# → price_... (Price-ID aus Stripe)
```

### Schritt 2: IP-Logging anpassen

```javascript
// In JEDER Function mit Audit-Log:
// Ersetze:
ip: context.rawRequest ? context.rawRequest.ip : 'unknown'

// Mit:
ipHash: getPrivacyCompliantIP(context)

// Funktion hinzufügen (oben in index.js):
function getPrivacyCompliantIP(context) {
    if (!context.rawRequest || !context.rawRequest.ip) {
        return 'unknown';
    }
    return crypto.createHash('sha256')
        .update(context.rawRequest.ip)
        .digest('hex')
        .substring(0, 16);
}
```

### Schritt 3: Dependencies installieren

```bash
cd functions
npm install stripe express cors
```

### Schritt 4: Stripe-Code aktivieren

```javascript
// Zeile 11-13: Uncomment
const stripe = process.env.STRIPE_SECRET_KEY ? 
    require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const express = require('express');
const cors = require('cors');
```

### Schritt 5: Deploy

```bash
# Functions deployen
firebase deploy --only functions

# Expected Output:
# ✅ verifyAge
# ✅ checkCategoryAccess
# ✅ generateAnswerToken
# ✅ validateAnswerToken
# ✅ checkPremiumStatus
# ✅ createCheckoutSession (NEU)
# ✅ stripeWebhook (NEU)
# ✅ cleanupOldGames
# ✅ cleanupRateLimits
```

### Schritt 6: Stripe Webhook konfigurieren

```
1. https://dashboard.stripe.com/webhooks
2. Add Endpoint
3. URL: https://YOUR-PROJECT.cloudfunctions.net/stripeWebhook
4. Events: checkout.session.completed
5. Save → Webhook Secret kopieren
6. firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

---

## 🧪 6. Testing

### Test 1: Age-Verification

```javascript
// Client-Side
const verifyAge = firebase.functions().httpsCallable('verifyAge');
const result = await verifyAge({ ageLevel: 18, consent: true });

console.log(result.data);
// Expected: { success: true, ageLevel: 18, message: '...' }

// Check Custom Claim
await firebase.auth().currentUser.getIdToken(true);  // Force refresh
const token = await firebase.auth().currentUser.getIdTokenResult();
console.log(token.claims.ageLevel);  // Should be 18
```

### Test 2: Premium-Checkout

```javascript
// Client-Side
const createCheckout = firebase.functions().httpsCallable('createCheckoutSession');
const result = await createCheckout({});

// Redirect to Stripe
window.location.href = result.data.url;
```

### Test 3: Webhook (Manual)

```bash
# Stripe CLI Test
stripe trigger checkout.session.completed

# Expected:
# → Webhook called
# → Cloud Function logs: "✅ Premium activated for user..."
# → Custom Claim set: isPremium = true
```

---

## ✅ 7. Compliance-Status

| Kategorie | Status | Details |
|-----------|--------|---------|
| 🔒 **Age-Verification** | ✅ 100% | Server-Side Custom Claims |
| 💎 **Premium-Check** | ✅ 90% | Implementiert, Stripe TODO |
| 🛡️ **Token-Security** | ✅ 100% | HMAC + Rate-Limiting |
| 📊 **Audit-Logging** | ⚠️ 80% | IP-Hashing TODO |
| 🔐 **Secrets** | ⚠️ 0% | APP_SECRET muss gesetzt werden |
| 💳 **Stripe-Flow** | ⚠️ 50% | Code vorhanden, nicht aktiv |

**Gesamt-Score**: ⚠️ **75/100** (noch TODOs offen)

---

## 📞 8. Troubleshooting

### Problem: "APP_SECRET not configured"

**Lösung**:
```bash
firebase functions:secrets:set APP_SECRET
# → Paste Secret (openssl rand -hex 64)
firebase deploy --only functions
```

### Problem: Stripe Webhook 401/403

**Ursache**: Webhook Secret falsch

**Lösung**:
```bash
# 1. Secret aus Stripe Dashboard kopieren (whsec_...)
# 2. Neu setzen
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# 3. Redeploy
firebase deploy --only functions:stripeWebhook
```

### Problem: Custom Claims nicht verfügbar

**Ursache**: Token nicht refreshed

**Lösung**:
```javascript
// Force Token Refresh
await firebase.auth().currentUser.getIdToken(true);
```

---

**Status**: ⚠️ **75% Fertig** (TODOs offen)  
**Version**: 2.1  
**Priorität**: 🔥 APP_SECRET setzen (KRITISCH)  
**Datum**: 2026-01-07

---

*Erstellt von GitHub Copilot & JACK129*

