# 🔧 reCAPTCHA App Check - Fehler beheben

## ❌ Aktueller Fehler

```
Invalid reCAPTCHA configuration for app: 1:27029260611:web:3c7da4db0bf92e8ce247f6
```

**Site Key im Code:** `6LeEL0UsAAAAABN-JYDFEshwg9Qnmq09IyWzaJ9l` ✅ **KORREKT**

**Ursache:** Die Domain `no-cap.app` ist **NICHT** in den reCAPTCHA-Einstellungen registriert.

## ✅ Status

```
✅ App in Firebase App Check registriert
✅ Site Key im Code korrekt: 6LeEL0UsAAAAABN-JYDFEshwg9Qnmq09IyWzaJ9l
❌ Domain no-cap.app FEHLT in reCAPTCHA-Konfiguration
```

---

## 🚀 Lösung: Domain registrieren (2 Minuten)

### Schritt 1: Google reCAPTCHA Console öffnen

1. **Öffne:** https://www.google.com/recaptcha/admin
2. **Login** mit deinem Google-Account (gleicher wie Firebase)
3. **Suche** deinen reCAPTCHA Site Key: `6LeEL0UsAAAAABN-JYDFEshwg9Qnmq09IyWzaJ9l`

### Schritt 2: Domains hinzufügen

1. **Klicke** auf deinen reCAPTCHA Key (erscheint in der Liste)
2. **Einstellungen** → **Domains**
3. **Füge hinzu:**
   ```
   no-cap.app
   ```
   
4. **Optional** (für Testing):
   ```
   localhost
   127.0.0.1
   ```

5. **Speichern** klicken

### Schritt 3: Testen (sofort wirksam)

```bash
# 1. Website öffnen (KEIN Deploy nötig, Änderung ist sofort aktiv)
https://no-cap.app

# 2. F12 → Console prüfen
# Erwartetes Ergebnis:
✅ App Check activated (Production)
✅ Firebase initialized

# KEIN Fehler mehr:
❌ Invalid reCAPTCHA configuration  <-- Sollte WEG sein
```

---

## 📋 Alternative: Falls du den Key NICHT in Google reCAPTCHA findest

**Das bedeutet:** Firebase hat einen **eigenen reCAPTCHA Key** erstellt (reCAPTCHA Enterprise).

### Option A: Domain in Firebase Console hinzufügen

1. **Firebase Console:** https://console.firebase.google.com/project/denkstduwebsite/appcheck
2. **Klicke** auf **"DenkstDu"** App
3. **Suche** nach **"Manage domains"** oder **"Domains"**
4. **Füge hinzu:** `no-cap.app`
5. **Speichern**

### Option B: Neuen reCAPTCHA v3 Key erstellen (empfohlen)

Falls du keinen Zugriff auf den aktuellen Key hast:

1. **Google reCAPTCHA Console:** https://www.google.com/recaptcha/admin
2. **+ Neues Label erstellen**
3. **Einstellungen:**
   - Label: `DenkstDu no-cap.app`
   - reCAPTCHA-Typ: **v3**
   - Domains: `no-cap.app`, `localhost`
4. **Senden**
5. **Neuen Site Key kopieren**
6. **Firebase Console** → **App Check** → **DenkstDu** → **Update provider**
7. Neuen Site Key eintragen

**Dann sage mir den NEUEN Key, und ich trage ihn im Code ein!**

### Schritt 3: reCAPTCHA Provider wählen

Du hast **2 Optionen**:

#### Option A: reCAPTCHA v3 (einfacher, automatisch)

1. Wähle: **reCAPTCHA v3**
2. Firebase generiert **automatisch** einen Site Key
3. Klicke **Register**
4. **Site Key kopieren** (beginnt mit `6Le...`)

#### Option B: reCAPTCHA Enterprise (mehr Kontrolle)

1. Wähle: **reCAPTCHA Enterprise**
2. Erstelle zuerst einen Key bei: https://console.cloud.google.com/security/recaptcha
3. **Domain hinzufügen:** `no-cap.app`
4. **Site Key** und **API Key** kopieren
5. Zurück zu Firebase → Site Key eintragen

---

### Schritt 4: Site Key im Code eintragen

**Datei 1:** `assets/js/firebase-config.js` (Zeile 524)

```javascript
// VORHER (Zeile 524):
const RECAPTCHA_SITE_KEY = '6LeEL0UsAAAAABN-JYDFEshwg9Qnmq09IyWzaJ9l'; // ❌ ALT

// NACHHER:
const RECAPTCHA_SITE_KEY = 'DEIN_NEUER_SITE_KEY_AUS_FIREBASE'; // ✅ NEU
```

**Datei 2:** `assets/js/firebase-init.js` (Zeile 67 - falls verwendet)

```javascript
// VORHER:
"6LeEL0UsAAAAABN-JYDFEshwg9Qnmq09IyWzaJ9l", // ❌ ALT

// NACHHER:
"DEIN_NEUER_SITE_KEY_AUS_FIREBASE", // ✅ NEU
```

---

### Schritt 5: Deployen & Testen

```bash
# 1. Änderungen committen
git add .
git commit -m "fix: Update reCAPTCHA Site Key for App Check"

# 2. Firebase deployen
firebase deploy --only hosting

# 3. Website öffnen
# https://no-cap.app
```

**Erwartetes Ergebnis:**

✅ Keine `400 Invalid reCAPTCHA` Fehler mehr  
✅ Console Log: `✅ App Check activated (Production)`  
✅ Firebase Database Verbindung funktioniert  

---

## 🧪 Testen

### Production (no-cap.app)

1. **Öffne:** https://no-cap.app
2. **F12** → **Console**
3. **Erwartete Logs:**
   ```
   ✅ App Check activated (Production)
   ✅ Firebase initialized
   ✅ Auth persistence: INDEXED_DB
   ```

4. **KEINE Fehler:**
   ```
   ❌ Invalid reCAPTCHA configuration  <-- Sollte NICHT erscheinen
   ❌ AppCheck: Requests throttled       <-- Sollte NICHT erscheinen
   ```

### Localhost (Development)

```
⚠️ App Check disabled (Development mode)
✅ Firebase initialized
```

---

## ⚙️ Domains konfigurieren (falls Option B)

Wenn du **reCAPTCHA Enterprise** verwendest:

1. **Google reCAPTCHA Console:** https://www.google.com/recaptcha/admin
2. **Domains hinzufügen:**
   - `no-cap.app`
   - `www.no-cap.app` (falls verwendet)
   - `localhost` (nur für Tests)

---

## ❓ Troubleshooting

### Fehler bleibt bestehen nach Deployment

**Ursache:** Browser-Cache oder Firebase CDN-Cache

**Lösung:**
```bash
# 1. Hard Refresh im Browser
Strg + Shift + R (Windows)
Cmd + Shift + R (Mac)

# 2. Cache löschen
Browser DevTools → Application → Clear Storage → Clear site data

# 3. Firebase Cache löschen
firebase hosting:channel:delete CHANNEL_NAME
```

### Fehler: `AppCheck: Requests throttled`

**Ursache:** Zu viele fehlerhafte Requests (Rate Limit nach 400-Fehler)

**Lösung:**
1. **60 Sekunden warten** (Rate Limit Reset)
2. Site Key aktualisieren
3. Seite neu laden

### Fehler: `Invalid domain for site key`

**Ursache:** `no-cap.app` ist nicht in reCAPTCHA registriert

**Lösung:**
1. Google reCAPTCHA Console öffnen
2. Domain `no-cap.app` hinzufügen
3. Site Key neu generieren (falls nötig)

---

## 📊 App Check Enforcement (optional - später)

**WICHTIG:** Erst aktivieren, wenn App Check **fehlerfrei** läuft!

1. **Firebase Console** → **App Check** → **APIs** Tab
2. **Realtime Database** → **Enforce**
3. **Cloud Functions** → **Enforce**

**Effekt:**
- Requests **ohne** gültiges App Check Token werden blockiert
- Nur verifizierte Clients (no-cap.app) können auf Firebase zugreifen

⚠️ **Vorsicht:** Enforcement blockiert alle nicht-verifizierten Requests (auch alte Clients)!

---

## 📝 Zusammenfassung

**Problem:**
```
Site Key 6LeEL0UsAAAAABN... ist nicht in Firebase App Check registriert
```

**Lösung:**
1. ✅ Firebase Console → App Check → Register
2. ✅ reCAPTCHA v3 wählen
3. ✅ Site Key kopieren
4. ✅ Im Code eintragen (firebase-config.js Zeile 524)
5. ✅ Deploy + Test

**Status nach dem Fix:**
- ✅ App Check schützt vor Bots/Missbrauch
- ✅ Firebase Database funktioniert
- ✅ Keine 400-Fehler mehr

---

## 📚 Weitere Ressourcen

- **Firebase App Check Docs:** https://firebase.google.com/docs/app-check
- **reCAPTCHA v3 Setup:** https://firebase.google.com/docs/app-check/web/recaptcha-provider
- **Firebase Console:** https://console.firebase.google.com/project/denkstduwebsite/appcheck
- **Google reCAPTCHA Admin:** https://www.google.com/recaptcha/admin

---

**Erstellt:** 2026-01-09  
**Problem:** `Invalid reCAPTCHA configuration`  
**Lösung:** Site Key in Firebase Console registrieren

