# 🆘 Deployment Troubleshooting - FAQ

**No-Cap Web App - Häufige Probleme & Lösungen**

---

## 🔥 Kritische Fehler

### 1. "APP_SECRET not set! Using fallback"

**Fehler**:
```
⚠️ APP_SECRET not set! Using fallback (INSECURE for production!)
Error: User code failed to load. Cannot determine backend specification.
```

**Ursache**: 
Secret wird zur **Build-Time** geladen, aber Firebase Secrets sind nur zur **Runtime** verfügbar.

**Lösung**:
```javascript
// ❌ FALSCH (Build-Time)
const APP_SECRET = process.env.APP_SECRET || 'fallback';

// ✅ RICHTIG (Runtime)
function getAppSecret() {
    const secret = process.env.APP_SECRET;
    if (!secret) {
        throw new Error('APP_SECRET not configured');
    }
    return secret;
}

// In Functions nutzen:
const secret = getAppSecret();
```

**Deployment erneut starten**:
```bash
firebase deploy --only functions
```

---

### 2. "PERMISSION_DENIED" beim Database-Zugriff

**Fehler**:
```javascript
PERMISSION_DENIED: Permission denied
```

**Ursache**: 
- Database Rules blockieren Zugriff
- Custom Claims nicht gesetzt/refreshed

**Lösung**:

#### A) Rules prüfen
```bash
firebase database:get /games/TESTID/.info/rules
```

#### B) Custom Claims refreshen
```javascript
// Nach Age-Verification IMMER Token refreshen
await firebase.auth().currentUser.getIdToken(true);
```

#### C) Als Host einloggen
```javascript
// Nur Host kann Settings ändern
const isHost = auth.currentUser.uid === game.hostId;
```

---

### 3. "Stripe not configured"

**Fehler**:
```
Failed-precondition: Stripe not configured
```

**Ursache**: 
Stripe Secrets nicht gesetzt oder Code nicht aktiviert.

**Lösung**:

#### Schritt 1: Secrets setzen
```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

#### Schritt 2: Code aktivieren
```javascript
// functions/index.js (Zeile 11-13)
const stripe = process.env.STRIPE_SECRET_KEY 
    ? require('stripe')(process.env.STRIPE_SECRET_KEY) 
    : null;
```

#### Schritt 3: Dependencies installieren
```bash
cd functions
npm install stripe express cors
```

#### Schritt 4: Deployen
```bash
firebase deploy --only functions
```

---

## ⚠️ Häufige Warnungen

### 4. "Function cold start timeout"

**Warnung**:
```
Function execution took 10000ms
```

**Ursache**: 
Cold Start - erste Ausführung nach Deployment dauert länger.

**Lösung**:
- Normal, keine Aktion nötig
- Falls häufig: Function warm halten oder Memory erhöhen

```javascript
exports.myFunction = functions
    .runWith({ memory: '512MB' })  // Default: 256MB
    .https.onCall(async (data, context) => { ... });
```

---

### 5. "Deployment takes too long"

**Problem**:
Deployment dauert >10 Minuten.

**Ursache**:
- Große Dependencies
- Viele Functions
- Langsame Internetverbindung

**Lösung**:

#### A) Nur geänderte Functions deployen
```bash
firebase deploy --only functions:verifyAge
```

#### B) Cache löschen
```bash
firebase deploy --force
```

#### C) Functions-Dependencies optimieren
```bash
cd functions
npm prune
npm dedupe
```

---

## 🐛 Runtime-Fehler

### 6. "Token validation failed: Invalid token"

**Fehler** (in Function Logs):
```
Token validation failed: Invalid token
```

**Ursache**:
- Token abgelaufen (>30 Sekunden)
- Falscher APP_SECRET
- Token manipuliert

**Lösung**:

#### A) Token-Expiry prüfen
```javascript
const ANSWER_TOKEN_EXPIRY = 30 * 1000;  // 30 Sekunden

// Falls zu kurz, erhöhen
const ANSWER_TOKEN_EXPIRY = 60 * 1000;  // 60 Sekunden
```

#### B) APP_SECRET prüfen
```bash
firebase functions:secrets:access APP_SECRET
```

#### C) Neue Token anfordern
```javascript
const getToken = firebase.functions().httpsCallable('getAnswerToken');
const newToken = await getToken({ gameId, roundNumber });
```

---

### 7. "Rate limit exceeded"

**Fehler**:
```
Resource-exhausted: Rate limit exceeded. Try again in 45 seconds
```

**Ursache**:
Mehr als 10 Requests pro Minute vom selben Player.

**Lösung**:

#### A) Warten
```
// Nach angezeigter Zeit erneut versuchen
```

#### B) Rate-Limit erhöhen (functions/index.js)
```javascript
const MAX_ANSWERS_PER_MINUTE = 20;  // Default: 10
```

#### C) Rate-Limit-Cleanup manuell triggern
```bash
firebase functions:shell
> cleanupRateLimits()
```

---

## 🔧 Deployment-Fehler

### 8. "Build failed: Cannot find module 'stripe'"

**Fehler**:
```
Error: Cannot find module 'stripe'
```

**Ursache**:
Dependencies nicht installiert.

**Lösung**:
```bash
cd functions
npm install stripe express cors
npm install
cd ..
firebase deploy --only functions
```

---

### 9. "Database Rules syntax error"

**Fehler**:
```
Invalid database rules: Unexpected token
```

**Ursache**:
JSON-Syntax-Fehler in `database.rules.json`.

**Lösung**:

#### A) JSON validieren
```bash
# Online: https://jsonlint.com/
# Oder:
node -e "console.log(JSON.parse(require('fs').readFileSync('database.rules.json')))"
```

#### B) Häufige Fehler
```json
// ❌ FALSCH: Komma am Ende
{
  "rules": {
    ".read": false,
  }
}

// ✅ RICHTIG: Kein Komma
{
  "rules": {
    ".read": false
  }
}
```

---

### 10. "Hosting: File too large"

**Fehler**:
```
File size exceeds 10 MB limit
```

**Ursache**:
Datei in `public/` oder root zu groß.

**Lösung**:

#### A) Ignore-Liste prüfen
```json
// firebase.json
"ignore": [
  "**/node_modules/**",
  "**/*.md",
  "**/backup_*",
  "**/.git/**"
]
```

#### B) Große Dateien entfernen
```bash
# Backup-Files finden
find . -name "backup_*" -size +1M

# Löschen
rm backup_*
```

---

## 📊 Monitoring

### Function Logs anzeigen

```bash
# Alle Logs
firebase functions:log

# Nur Errors
firebase functions:log --only errors

# Specific Function
firebase functions:log --only verifyAge

# Live Logs
firebase functions:log --tail
```

### Deployment-Status

```bash
# Aktuelle Deployments
firebase deploy:list

# Hosting-Channels
firebase hosting:channel:list
```

---

## 🆘 Notfall-Rollback

### Kompletter Rollback

```bash
# 1. Vorherigen Git-Commit finden
git log --oneline -10

# 2. Checkout
git checkout [COMMIT_HASH]

# 3. Deployen
firebase deploy

# 4. Zurück zu main
git checkout main
```

### Nur Functions zurücksetzen

```bash
# Function löschen
firebase functions:delete problemFunction

# Alten Code deployen
git checkout HEAD~1 functions/index.js
firebase deploy --only functions
git checkout main functions/index.js
```

---

## 📞 Support-Ressourcen

- **Firebase Console**: https://console.firebase.google.com/project/denkstduwebsite
- **Firebase Status**: https://status.firebase.google.com/
- **Firebase Docs**: https://firebase.google.com/docs
- **Stack Overflow**: https://stackoverflow.com/questions/tagged/firebase

---

**Letztes Update**: 7. Januar 2026

