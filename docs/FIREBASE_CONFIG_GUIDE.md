# 🔐 Firebase Configuration Guide

**Version:** 8.0  
**Datum:** 2026-01-11  
**Status:** Production-Ready

---

## 🎯 Übersicht

Diese Anleitung erklärt, wie Firebase-Konfiguration sicher in der No-Cap App verwaltet wird.

**Sicherheitsprinzipien:**
- ✅ **Keine Admin-Keys im Client-Code**
- ✅ **Environment-Variablen für Production**
- ✅ **Meta-Tags als Fallback**
- ✅ **IndexedDB-Cache für Offline-Support**

---

## 🚀 Quick Start

### Option 1: Build-Time Injection (Empfohlen für Production)

#### Schritt 1: `.env` Datei erstellen

Erstelle im Projekt-Root eine `.env`-Datei:

```env
# Firebase Configuration (Client-side only)
VITE_FIREBASE_API_KEY=AIzaSyC_cu_2X2uFCPcxYetxIUHi2v56F1Mz0Vk
VITE_FIREBASE_AUTH_DOMAIN=denkstduwebsite.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://denkstduwebsite-default-rtdb.europe-west1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=denkstduwebsite
VITE_FIREBASE_STORAGE_BUCKET=denkstduwebsite.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=27029260611
VITE_FIREBASE_APP_ID=1:27029260611:web:3c7da4db0bf92e8ce247f6
VITE_FIREBASE_MEASUREMENT_ID=G-BNKNW95HK8

# App Check (ReCAPTCHA v3 Site Key - NOT secret!)
VITE_FIREBASE_APP_CHECK_KEY=6LeEL0UsAAAAABN-JYDFEshwg9Qnmq09IyWzaJ9l
```

**⚠️ Wichtig:**
- ✅ `.env` zur `.gitignore` hinzufügen!
- ✅ Nur Client-side Keys verwenden
- ❌ KEINE Admin SDK Keys hier!

#### Schritt 2: `.gitignore` aktualisieren

```gitignore
# Environment variables
.env
.env.local
.env.production
.env.development

# Firebase Admin credentials (NEVER commit these!)
firebase-adminsdk-*.json
serviceAccountKey.json
```

#### Schritt 3: Build-Konfiguration (Vite)

Erstelle `vite.config.js`:

```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  // Inject environment variables into build
  define: {
    'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(process.env.VITE_FIREBASE_API_KEY),
    'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.VITE_FIREBASE_AUTH_DOMAIN),
    'import.meta.env.VITE_FIREBASE_DATABASE_URL': JSON.stringify(process.env.VITE_FIREBASE_DATABASE_URL),
    'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(process.env.VITE_FIREBASE_PROJECT_ID),
    'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.VITE_FIREBASE_STORAGE_BUCKET),
    'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
    'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(process.env.VITE_FIREBASE_APP_ID),
    'import.meta.env.VITE_FIREBASE_MEASUREMENT_ID': JSON.stringify(process.env.VITE_FIREBASE_MEASUREMENT_ID),
    'import.meta.env.VITE_FIREBASE_APP_CHECK_KEY': JSON.stringify(process.env.VITE_FIREBASE_APP_CHECK_KEY)
  }
});
```

#### Schritt 4: HTML anpassen

In `index.html` (und allen anderen HTML-Dateien) **VOR** `firebase-config.js`:

```html
<!-- Firebase Config Injection (Build-time) -->
<script>
    window.FIREBASE_CONFIG = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
    };

    // App Check Key
    window.FIREBASE_APP_CHECK_KEY = import.meta.env.VITE_FIREBASE_APP_CHECK_KEY;
</script>

<!-- Firebase SDKs -->
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-functions-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-check-compat.js"></script>

<!-- Firebase Config -->
<script src="../assets/js/firebase-config.js"></script>
```

---

### Option 2: Meta Tags (Fallback für Static Hosting)

Wenn kein Build-Process vorhanden ist (z.B. direktes Hosting), nutze Meta-Tags:

```html
<!-- Firebase Configuration via Meta Tags -->
<meta name="firebase-api-key" content="AIzaSyC_cu_2X2uFCPcxYetxIUHi2v56F1Mz0Vk">
<meta name="firebase-auth-domain" content="denkstduwebsite.firebaseapp.com">
<meta name="firebase-database-url" content="https://denkstduwebsite-default-rtdb.europe-west1.firebasedatabase.app">
<meta name="firebase-project-id" content="denkstduwebsite">
<meta name="firebase-storage-bucket" content="denkstduwebsite.appspot.com">
<meta name="firebase-messaging-sender-id" content="27029260611">
<meta name="firebase-app-id" content="1:27029260611:web:3c7da4db0bf92e8ce247f6">
<meta name="firebase-measurement-id" content="G-BNKNW95HK8">
<meta name="firebase-app-check-key" content="6LeEL0UsAAAAABN-JYDFEshwg9Qnmq09IyWzaJ9l">
```

**⚠️ Hinweis:** Meta-Tags sind öffentlich sichtbar, aber das ist OK für Client-side Keys.

---

## 🔐 Security Best Practices

### ✅ Was DARF in Client-Code:

1. **Firebase API Key** (z.B. `AIzaSyC_cu_2X2uFCPcxYetxIUHi2v56F1Mz0Vk`)
   - Ist öffentlich
   - Durch Firebase Security Rules geschützt

2. **App Check ReCAPTCHA Site Key** (z.B. `6LeEL0UsAAAAABN-JYDFEshwg9Qnmq09IyWzaJ9l`)
   - Ist öffentlich (Site Key, nicht Secret Key!)
   - Schützt vor Bots

3. **Project ID, Auth Domain, etc.**
   - Öffentliche Metadaten

### ❌ Was NIEMALS in Client-Code:

1. **Firebase Admin SDK Private Key**
   - Datei: `firebase-adminsdk-*.json`
   - Nur in Cloud Functions/Backend verwenden!

2. **ReCAPTCHA Secret Key**
   - Nur serverseitig verwenden
   - Nie im Browser exponieren

3. **Database Secrets**
   - Nie direkt im Client

---

## 🛡️ Firebase Security Rules

Sicherstellen, dass alle Datenbank-Zugriffe durch Rules geschützt sind:

### Realtime Database Rules (`database.rules.json`):

```json
{
  "rules": {
    "games": {
      "$gameId": {
        ".read": "auth != null",
        ".write": "auth != null && (!data.exists() || data.child('hostId').val() === auth.uid)"
      }
    }
  }
}
```

### Storage Rules (`storage.rules`):

```
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{playerId} {
      allow write: if request.auth != null
                   && request.resource.size < 2 * 1024 * 1024
                   && request.resource.contentType.matches('image/(jpeg|png|webp)');
      
      allow read: if request.auth != null;
    }
  }
}
```

---

## 🔄 App Check Setup

### Schritt 1: ReCAPTCHA v3 Key erstellen

1. Gehe zu [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Erstelle neuen Site Key (v3)
3. Füge Domains hinzu:
   - `localhost` (Development)
   - `no-cap.app` (Production)
   - `denkstduwebsite.web.app` (Firebase Hosting)

### Schritt 2: In Firebase Console registrieren

1. Firebase Console → App Check
2. Wähle deine Web-App
3. ReCAPTCHA v3 aktivieren
4. Site Key eingeben: `6LeEL0UsAAAAABN-JYDFEshwg9Qnmq09IyWzaJ9l`

### Schritt 3: Enforcement aktivieren

Firebase Console → App Check → Enforcement:
- ✅ Realtime Database
- ✅ Cloud Storage
- ✅ Cloud Functions

---

## 🚀 Deployment

### Firebase Hosting

```bash
# Build mit Environment-Variablen
npm run build

# Deploy
firebase deploy --only hosting
```

### Environment-Variablen in CI/CD

**GitHub Actions:**

```yaml
# .github/workflows/deploy.yml
env:
  VITE_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
  VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.FIREBASE_AUTH_DOMAIN }}
  # ... weitere Secrets
```

**GitHub Secrets einrichten:**
1. Repository → Settings → Secrets
2. New repository secret
3. Name: `FIREBASE_API_KEY`
4. Value: `AIzaSyC_cu_2X2uFCPcxYetxIUHi2v56F1Mz0Vk`

---

## 🧪 Testing

### Development Mode

In Development (localhost) wird automatisch die Fallback-Config verwendet:

```javascript
// firebase-config.js lädt automatisch:
{
  apiKey: "AIzaSyC_cu_2X2uFCPcxYetxIUHi2v56F1Mz0Vk",
  // ...
}
```

### Production Test

Teste, ob Config korrekt geladen wird:

```javascript
// Browser Console
console.log(window.FIREBASE_CONFIG);
console.log(window.FIREBASE_APP_CHECK_KEY);
```

**Erwartetes Ergebnis:**
```
✅ Using Firebase config from window.FIREBASE_CONFIG
✅ App Check activated with auto-refresh
```

---

## 📊 Prioritäten-Reihenfolge

`firebase-config.js` lädt Config in dieser Reihenfolge:

1. **window.FIREBASE_CONFIG** (Build-time injection)
2. **Meta Tags** (Static hosting)
3. **IndexedDB Cache** (Offline fallback)
4. **Default Config** (Development only)

---

## 🔍 Troubleshooting

### Problem: "Firebase configuration not found"

**Lösung:**
1. Prüfe, ob `.env` existiert
2. Prüfe, ob Vite Build korrekt konfiguriert
3. Prüfe Browser Console für Fehler

### Problem: "App Check activation failed"

**Lösung:**
1. Prüfe, ob ReCAPTCHA Key korrekt
2. Prüfe, ob Domain in ReCAPTCHA registriert
3. Prüfe Firebase Console → App Check

### Problem: "Domain not whitelisted"

**Lösung:**
1. Füge Domain zu `allowed-domains.json` hinzu
2. Deploy und teste erneut

---

## 📚 Weitere Ressourcen

- [Firebase Web Setup](https://firebase.google.com/docs/web/setup)
- [Firebase App Check](https://firebase.google.com/docs/app-check)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [ReCAPTCHA v3](https://developers.google.com/recaptcha/docs/v3)

---

## ✅ Checkliste für Production

- [ ] `.env` erstellt und zur `.gitignore` hinzugefügt
- [ ] Vite Build-Config erstellt
- [ ] `window.FIREBASE_CONFIG` in HTML injiziert
- [ ] ReCAPTCHA Key registriert
- [ ] App Check in Firebase Console aktiviert
- [ ] Security Rules deployed
- [ ] Test auf Production-Domain erfolgreich
- [ ] Keine Admin-Keys im Repository

---

**Version:** 8.0  
**Status:** ✅ Production-Ready  
**Letzte Aktualisierung:** 2026-01-11

🎉 **Firebase Configuration vollständig dokumentiert!**

