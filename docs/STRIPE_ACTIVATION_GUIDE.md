# Stripe Integration - Aktivierungsanleitung

## 🎯 Übersicht

Die Stripe-Integration für Premium-Zahlungen ist vollständig vorbereitet und muss nur noch aktiviert werden.

## ✅ Voraussetzungen

- Firebase Projekt erstellt
- Stripe Account erstellt
- Firebase CLI installiert (`npm install -g firebase-tools`)
- Zugriff auf Firebase Console

---

## 🔧 Schritt 1: Stripe Secret Keys setzen

### 1.1 Stripe API Keys holen

1. Gehe zu [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Kopiere den **Secret Key** (beginnt mit `sk_test_...` oder `sk_live_...`)
3. Gehe zu [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
4. Erstelle einen neuen Webhook (URL siehe unten)
5. Kopiere den **Webhook Signing Secret** (beginnt mit `whsec_...`)

### 1.2 Secrets in Firebase setzen

```powershell
# Im Projektverzeichnis ausführen
firebase functions:secrets:set STRIPE_SECRET_KEY
# Eingeben: sk_test_... oder sk_live_...

firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# Eingeben: whsec_...
```

**⚠️ WICHTIG:** Verwende im Test-Modus `sk_test_...` und für Production `sk_live_...`

---

## 🌐 Schritt 2: Stripe Webhook URL konfigurieren

### 2.1 Cloud Function URL ermitteln

Nach dem ersten Deployment (siehe Schritt 4) erhältst du die URL:

```
https://REGION-PROJECT-ID.cloudfunctions.net/stripeWebhook
```

Beispiel:
```
https://us-central1-denkstduwebsite.cloudfunctions.net/stripeWebhook
```

### 2.2 Webhook in Stripe Dashboard erstellen

1. Gehe zu [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Klicke auf **"Add endpoint"**
3. Endpoint URL: `https://REGION-PROJECT-ID.cloudfunctions.net/stripeWebhook`
4. Wähle Event: **`checkout.session.completed`**
5. Klicke auf **"Add endpoint"**
6. Kopiere den **Signing Secret** (falls noch nicht geschehen)

---

## 📝 Schritt 3: Code aktivieren

### 3.1 functions/index.js bearbeiten

Entferne die Kommentare `/*` und `*/` um folgende Bereiche:

**Zeile ~376-448:** Stripe Webhook Handler
```javascript
// TODO PRODUCTION: Uncomment when Stripe keys are configured
/*
const app = express();
...
exports.stripeWebhook = functions.https.onRequest(app);
*/
```

**Zeile ~454-505:** Create Checkout Session
```javascript
// TODO PRODUCTION: Uncomment when Stripe keys are configured
/*
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
...
});
*/
```

---

## 🚀 Schritt 4: Functions deployen

```powershell
# Functions deployen (mit neuen Secrets)
firebase deploy --only functions

# Warten bis Deployment abgeschlossen ist
# Die URL für stripeWebhook wird angezeigt
```

---

## 🧪 Schritt 5: Testzahlung durchführen

### 5.1 Test-Kreditkarte verwenden

Stripe Test-Mode Kreditkarten:
- **Erfolgreiche Zahlung:** `4242 4242 4242 4242`
- **CVC:** Beliebige 3 Ziffern (z.B. `123`)
- **Ablaufdatum:** Beliebiges zukünftiges Datum

### 5.2 Checkout-Flow testen

1. In der App auf **"Premium kaufen"** klicken
2. Stripe Checkout öffnet sich
3. Testkreditkarte eingeben
4. Zahlung abschließen
5. Prüfen ob Premium-Status aktiviert wurde

### 5.3 Logs überprüfen

```powershell
# Firebase Functions Logs anzeigen
firebase functions:log

# Erfolgreiche Zahlung sollte zeigen:
# ✅ Premium unlocked for user: USER_ID - Client should refresh token
```

---

## 🔐 Schritt 6: Production-Modus aktivieren

### 6.1 Stripe auf Live-Modus umstellen

1. Gehe zu Stripe Dashboard
2. Wechsle von **Test-Modus** zu **Live-Modus** (Toggle oben rechts)
3. Hole neue **Live API Keys** (`sk_live_...`)
4. Erstelle neuen **Live Webhook** mit gleicher URL

### 6.2 Live Secrets setzen

```powershell
firebase functions:secrets:set STRIPE_SECRET_KEY
# Eingeben: sk_live_... (LIVE KEY!)

firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# Eingeben: whsec_... (LIVE WEBHOOK SECRET!)
```

### 6.3 Erneut deployen

```powershell
firebase deploy --only functions
```

---

## ✅ Akzeptanzkriterien (Checkliste)

- [ ] Stripe Account erstellt
- [ ] `STRIPE_SECRET_KEY` in Firebase Secret Manager gesetzt
- [ ] `STRIPE_WEBHOOK_SECRET` in Firebase Secret Manager gesetzt
- [ ] Webhook URL in Stripe Dashboard konfiguriert
- [ ] Event `checkout.session.completed` aktiviert
- [ ] Code in `functions/index.js` auskommentiert
- [ ] Functions deployed (`firebase deploy --only functions`)
- [ ] Testzahlung erfolgreich durchgeführt
- [ ] Premium-Status in Database gespeichert
- [ ] Custom Claims aktualisiert
- [ ] Logs zeigen erfolgreiche Zahlung
- [ ] Live-Modus aktiviert (für Production)

---

## 🛡️ Sicherheitshinweise

### App Check

Alle Payment-Functions sind mit **App Check** geschützt:
```javascript
if (!context.app) {
    throw new functions.https.HttpsError(
        'unauthenticated',
        'App Check required'
    );
}
```

Dies verhindert unautorisierte API-Aufrufe von Bots.

### Custom Claims Token Refresh

Nach erfolgreicher Zahlung werden Custom Claims gesetzt. **Der Client MUSS seinen Token erneuern:**

```javascript
// Nach erfolgreicher Zahlung
await firebase.auth().currentUser.getIdToken(true);
```

Dies ist bereits in der Client-Implementierung vorhanden.

---

## 📞 Support

Bei Problemen:

1. **Logs prüfen:** `firebase functions:log`
2. **Stripe Dashboard:** [Webhooks > Events](https://dashboard.stripe.com/webhooks)
3. **Firebase Console:** [Functions > Logs](https://console.firebase.google.com/)

---

## 💰 Preise

Aktueller Preis für **Special Edition:**
- **2,99 EUR** (299 Cent)

Anpassbar in `functions/index.js` Zeile ~471:
```javascript
unit_amount: 299, // 2,99 EUR in Cent
```

---

**Status:** ✅ Vorbereitet, aktivierbar mit obigen Schritten
**Version:** 4.0 - Production Ready

