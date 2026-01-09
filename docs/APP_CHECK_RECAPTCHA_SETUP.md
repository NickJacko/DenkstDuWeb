# 🔐 Firebase App Check - reCAPTCHA v3 Setup Anleitung

## ⚠️ AKTUELLER STATUS: APP CHECK DEAKTIVIERT

App Check ist **temporär deaktiviert** (`&& false` in `firebase-config.js` Zeile 519), weil der aktuelle reCAPTCHA Site Key **nicht für `no-cap.app` registriert** ist.

**Fehler:**
```
Invalid reCAPTCHA configuration for app: 1:27029260611:web:3c7da4db0bf92e8ce247f6
```

---

## 📋 Warum ist App Check wichtig?

Firebase App Check schützt deine Backend-Ressourcen (Realtime Database, Cloud Functions) vor:
- 🤖 **Bot-Angriffen** (automatisierte Requests)
- 🚫 **Unautorisiertem Zugriff** (API-Missbrauch)
- 💸 **Kostenfallen** (exzessive Firebase-Nutzung)

**Ohne App Check:**
- Jeder kann direkt auf deine Firebase Database zugreifen
- Cloud Functions können von beliebigen Clients aufgerufen werden
- Erhöhtes Risiko für Spam, Missbrauch und hohe Kosten

---

## 🛠️ Schritt-für-Schritt Anleitung

### 1️⃣ reCAPTCHA v3 Site Key erstellen

**Option A: Firebase Console (empfohlen)**

1. **Firebase Console** öffnen: https://console.firebase.google.com/project/denkstduwebsite
2. **Build** → **App Check** (linkes Menü)
3. **Apps** Tab → Deine Web-App auswählen: `1:27029260611:web:3c7da4db0bf92e8ce247f6`
4. **Register** Button klicken
5. **reCAPTCHA v3** auswählen
6. **reCAPTCHA Secret Key** wird automatisch erstellt
7. **Register** klicken

**Option B: Google reCAPTCHA Admin Console**

1. https://www.google.com/recaptcha/admin öffnen
2. **+ Erstellen** klicken
3. **Label:** `no-cap.app Firebase App Check`
4. **reCAPTCHA-Typ:** `reCAPTCHA v3`
5. **Domains hinzufügen:**
   - `no-cap.app`
   - `www.no-cap.app` (falls verwendet)
   - `localhost` (nur für Tests)
6. **Akzeptieren** & **Senden**
7. **Site Key** und **Secret Key** kopieren

---

### 2️⃣ Site Key in Firebase eintragen (falls Option B)

1. **Firebase Console** → **App Check** → **Apps**
2. Deine Web-App auswählen
3. **Manage reCAPTCHA keys**
4. **Site Key** aus Google reCAPTCHA einfügen
5. **Secret Key** aus Google reCAPTCHA einfügen
6. **Save**

---

### 3️⃣ Site Key im Code aktualisieren

**Datei:** `assets/js/firebase-config.js` (Zeile 524)

```javascript
// Vorher:
const RECAPTCHA_SITE_KEY = '6LeEL0UsAAAAABN-JYDFEshwg9Qnmq09IyWzaJ9l'; // ❌ ALT

// Nachher:
const RECAPTCHA_SITE_KEY = 'DEIN_NEUER_SITE_KEY_AUS_FIREBASE'; // ✅ NEU
```

**Datei:** `assets/js/firebase-init.js` (Zeile 67)

```javascript
// Vorher:
"6LeEL0UsAAAAABN-JYDFEshwg9Qnmq09IyWzaJ9l", // ❌ ALT

// Nachher:
"DEIN_NEUER_SITE_KEY_AUS_FIREBASE", // ✅ NEU
```

---

### 4️⃣ App Check aktivieren

**Datei:** `assets/js/firebase-config.js` (Zeile 519)

```javascript
// Vorher:
if (firebase.appCheck && isProduction && false) { // ❌ DEAKTIVIERT

// Nachher:
if (firebase.appCheck && isProduction) { // ✅ AKTIVIERT
```

**Datei:** `assets/js/firebase-init.js` (Zeile 63)

```javascript
// Vorher:
if (firebase.appCheck && isProduction && false) { // ❌ DEAKTIVIERT

// Nachher:
if (firebase.appCheck && isProduction) { // ✅ AKTIVIERT
```

---

### 5️⃣ Deployment & Test

```bash
# 1. Änderungen committen
git add .
git commit -m "fix: Update reCAPTCHA Site Key for App Check"
git push origin main

# 2. Firebase deployen
firebase deploy --only hosting

# 3. Website testen
# Öffne: https://no-cap.app
# Erwartete Console Logs:
#   ✅ App Check activated (Production)
#   ✅ Firebase initialized
```

**KEIN Fehler mehr:**
```
❌ Invalid reCAPTCHA configuration for app
```

---

## 🧪 Testen

### Localhost (Development)

```javascript
// App Check ist automatisch deaktiviert
console: "⚠️ App Check disabled (Development mode)"
```

### Production (no-cap.app)

```javascript
// App Check ist aktiviert
console: "✅ App Check activated (Production)"
```

**Test im Browser:**
1. Öffne https://no-cap.app
2. **F12** → **Console**
3. Prüfe auf Fehler:
   - ❌ `Invalid reCAPTCHA configuration` → Site Key falsch
   - ✅ `App Check activated` → Alles korrekt

---

## 📊 Enforcement (optional)

Nach erfolgreicher Konfiguration kannst du App Check **erzwingen**:

**Firebase Console:**
1. **App Check** → **APIs** Tab
2. **Realtime Database** → **Enforce**
3. **Cloud Functions** → **Enforce**

**Effekt:**
- Requests ohne gültiges App Check Token werden **blockiert**
- Nur verifizierte Clients (no-cap.app) können auf Firebase zugreifen

⚠️ **WICHTIG:** Erst aktivieren, wenn App Check auf Production **fehlerfrei** läuft!

---

## ❓ Troubleshooting

### Fehler: `Invalid reCAPTCHA configuration`

**Ursache:** Site Key ist nicht für `no-cap.app` registriert

**Lösung:**
1. Google reCAPTCHA Admin Console öffnen
2. Domains prüfen: `no-cap.app` muss in der Liste sein
3. Falls fehlt: Domain hinzufügen und Site Key neu generieren

### Fehler: `AppCheck: Requests throttled`

**Ursache:** Zu viele fehlerhafte Requests (Rate Limit)

**Lösung:**
1. 60 Sekunden warten
2. Site Key aktualisieren
3. Seite neu laden

### Fehler: `Firebase initialization timeout`

**Ursache:** Firebase kann nicht initialisieren, weil App Check blockiert

**Lösung:**
1. App Check temporär deaktivieren (`&& false`)
2. Firebase testen
3. reCAPTCHA korrekt konfigurieren
4. App Check wieder aktivieren

---

## 📚 Weitere Ressourcen

- **Firebase App Check Docs:** https://firebase.google.com/docs/app-check
- **reCAPTCHA v3 Docs:** https://developers.google.com/recaptcha/docs/v3
- **Firebase Console:** https://console.firebase.google.com/project/denkstduwebsite/appcheck

---

**Status:** 🔴 **App Check deaktiviert** (Stand: 2026-01-09)  
**Nächster Schritt:** Site Key für `no-cap.app` registrieren und Code aktualisieren

