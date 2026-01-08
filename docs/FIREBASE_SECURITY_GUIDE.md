# Firebase Security Best Practices

## ✅ Was ist SICHER im Client-Code?

### Firebase Web API Key (`apiKey`)

**WICHTIG**: Der Firebase Web API Key ist **KEIN Secret**!

```javascript
// ✅ SICHER - Darf im Client-Code stehen:
const config = {
    apiKey: "AIzaSyC_cu_2X2uFCPcxYetxIUHi2v56F1Mz0Vk",
    authDomain: "denkstduwebsite.firebaseapp.com",
    projectId: "denkstduwebsite"
    // ... etc
};
```

**Warum ist das sicher?**

1. **Design by Firebase**: Der API Key ist absichtlich öffentlich
2. **Security Rules schützen**: Sicherheit kommt von `database.rules.json` und `firestore.rules`
3. **Domain-Restriction**: Key kann auf erlaubte Domains beschränkt werden
4. **Kein Admin-Zugriff**: Client hat nur User-Permissions

### Was kann jemand mit dem API Key machen?

- ✅ Firebase SDK initialisieren
- ✅ Als User authentifizieren
- ✅ Daten lesen/schreiben (nur was die Rules erlauben!)
- ❌ **NICHT**: Admin-Operationen durchführen
- ❌ **NICHT**: Security Rules umgehen
- ❌ **NICHT**: Andere Projekte zugreifen

## ❌ Was ist GEHEIM und NIEMALS im Client?

### 1. Service Account Keys

```json
// ❌ NIEMALS im Client oder Git!
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "firebase-adminsdk@...",
  // ...
}
```

**Wo speichern?**
- Server-side only (Cloud Functions, Backend)
- Environment variables
- Secret Manager (Google Cloud)
- `.gitignore` hinzufügen!

### 2. Admin SDK Keys

```javascript
// ❌ NIEMALS im Client!
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://...'
});
```

**Verwendung**: Nur in Cloud Functions oder Backend-Server

### 3. Database Secret (Legacy)

```javascript
// ❌ NIEMALS im Client!
const databaseSecret = "abc123XYZ...";
```

**Wo**: Nur server-side mit Admin SDK

### 4. Cloud Functions Environment Secrets

```bash
# ❌ NIEMALS im Client!
STRIPE_SECRET_KEY=sk_live_...
SENDGRID_API_KEY=SG.xxx...
OAUTH_CLIENT_SECRET=abc123...
```

**Wo**: `firebase functions:config:set` oder Secret Manager

## 🔒 Schutz-Mechanismen

### 1. Firebase Security Rules

**Wichtigste Schutzschicht!**

```javascript
// database.rules.json
{
  "rules": {
    "games": {
      "$gameId": {
        // Nur authentifizierte User
        ".read": "auth != null",
        ".write": "auth != null && 
                   (!data.exists() || data.child('hostUid').val() === auth.uid)"
      }
    }
  }
}
```

### 2. Domain-Restriction

**Firebase Console** → Project Settings → API Restrictions:

```
Allowed Domains:
✅ no-cap.app
✅ www.no-cap.app  
✅ denkstduwebsite.web.app
❌ evil-hacker-site.com (blocked!)
```

### 3. .gitignore

```gitignore
# Firebase Secrets (NIEMALS committen!)
serviceAccountKey.json
*-firebase-adminsdk-*.json
.env
.env.local
functions/.env

# Aber OK zu committen:
# .env.example (ohne echte Werte)
# firebase-init.js (mit öffentlichem API Key)
```

## 📋 Checkliste: Vor dem Git Push

- [ ] Keine `serviceAccountKey.json` Dateien
- [ ] Keine `.env` mit echten Secrets
- [ ] Keine `private_key` in Code
- [ ] Keine `STRIPE_SECRET_KEY` oder ähnliches
- [ ] `allowed-domains.json` ist korrekt konfiguriert
- [ ] Security Rules sind deployed
- [ ] Domain-Restriction ist aktiviert

## 🧪 Testen ob alles sicher ist

### Test 1: API Key Exposure

```bash
# Suche nach Service Account Keys im Code
grep -r "private_key" .
grep -r "service_account" .
grep -r "firebase-adminsdk" .

# Sollte NICHTS finden (außer in .gitignore oder Docs)
```

### Test 2: .gitignore Check

```bash
# Prüfe ob Secrets ignoriert werden
git status --ignored

# Sollte zeigen:
# - serviceAccountKey.json (ignored)
# - .env (ignored)
```

### Test 3: Security Rules

```bash
# Deploy und teste Rules
firebase deploy --only database
firebase database:rules:get

# Teste mit Firebase Emulator:
firebase emulators:start
```

## 📚 Weitere Ressourcen

- [Firebase Security Rules Docs](https://firebase.google.com/docs/rules)
- [API Key Best Practices](https://firebase.google.com/docs/projects/api-keys)
- [Service Account Security](https://cloud.google.com/iam/docs/service-accounts)
- [Secret Manager](https://cloud.google.com/secret-manager)

## ✅ Zusammenfassung

| Type | Client OK? | Storage |
|------|-----------|---------|
| **Web API Key** | ✅ YES | Code, Meta Tags, Config |
| **Auth Domain** | ✅ YES | Code, Config |
| **Project ID** | ✅ YES | Code, Config |
| **Service Account** | ❌ NO | Server, Secret Manager |
| **Admin SDK Key** | ❌ NO | Cloud Functions |
| **Database Secret** | ❌ NO | Server-side only |
| **Stripe Secret** | ❌ NO | Cloud Functions, Secrets |

**Regel**: Wenn es "Secret", "Private" oder "Admin" im Namen hat → **NICHT im Client!**

