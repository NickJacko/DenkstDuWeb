# 🚀 Quick Reference - Deployment Commands

**No-Cap Web App - Production Deployment**

---

## ⚡ Schnell-Deployment (Alles auf einmal)

```bash
firebase deploy
```

**Deployed**:
- ✅ Functions (alle 7+)
- ✅ Database Rules
- ✅ Hosting

**Dauer**: ~6-9 Minuten

---

## 🎯 Selektives Deployment

### Nur Functions

```bash
firebase deploy --only functions
```

**Use-Case**: Code-Änderungen in `functions/index.js`

### Nur Database Rules

```bash
firebase deploy --only database
```

**Use-Case**: Änderungen in `database.rules.json`

### Nur Hosting

```bash
firebase deploy --only hosting
```

**Use-Case**: Frontend-Änderungen (HTML/CSS/JS)

### Spezifische Function

```bash
firebase deploy --only functions:verifyAge
firebase deploy --only functions:checkCategoryAccess
```

**Use-Case**: Nur eine Function aktualisieren

---

## 🔐 Secret Management

### Secret setzen

```bash
firebase functions:secrets:set SECRET_NAME
```

**Beispiele**:
```bash
firebase functions:secrets:set APP_SECRET
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

### Secrets anzeigen

```bash
firebase functions:secrets:access APP_SECRET
```

### Secret löschen

```bash
firebase functions:secrets:destroy APP_SECRET
```

---

## 📊 Monitoring & Logs

### Function Logs anzeigen

```bash
# Alle Logs
firebase functions:log

# Nur Errors
firebase functions:log --only errors

# Specific Function
firebase functions:log --only verifyAge

# Live Logs (Tail)
firebase functions:log --tail
```

### Deployment-Status prüfen

```bash
# Aktuelle Deployments
firebase deploy:list

# Hosting-Status
firebase hosting:channel:list
```

---

## 🧪 Testing Commands

### Emulator starten

```bash
firebase emulators:start
```

**Startet**:
- Auth Emulator (Port 9099)
- Database Emulator (Port 9000)
- Hosting Emulator (Port 5000)
- UI Dashboard (Port 4000)

### Emulator mit Daten

```bash
firebase emulators:start --import=./emulator-data --export-on-exit
```

### Function lokal testen

```bash
# Im functions/ Ordner
cd functions
npm test
```

---

## 🔄 Rollback

### Vorherige Version deployen

```bash
# Hosting Rollback
firebase hosting:clone SOURCE_SITE_ID:SOURCE_CHANNEL_ID TARGET_SITE_ID:live

# Oder via Git
git checkout [PREVIOUS_COMMIT]
firebase deploy
git checkout main
```

### Function löschen

```bash
firebase functions:delete functionName
```

---

## 📦 Build & Cleanup

### Dependencies installieren

```bash
# Im Root
npm install

# Functions
cd functions
npm install
```

### Cache löschen

```bash
firebase deploy --force
```

### Alte Functions löschen

```bash
firebase functions:delete oldFunctionName
```

---

## 🌐 Projekt-URLs

### Öffnen im Browser

```bash
# Hosting
firebase open hosting:site

# Console
firebase open console

# Functions
firebase open functions

# Database
firebase open database
```

### URLs anzeigen

```bash
firebase hosting:sites:list
```

---

## 🔧 Konfiguration

### Projekt anzeigen

```bash
firebase projects:list
firebase use
```

### Projekt wechseln

```bash
firebase use [PROJECT_ID]
```

### Config anzeigen

```bash
firebase functions:config:get
```

---

## ⚠️ Häufige Fehler

### "PERMISSION_DENIED"

```bash
# Neu einloggen
firebase login --reauth

# Projekt neu auswählen
firebase use --add
```

### "APP_SECRET not configured"

```bash
firebase functions:secrets:set APP_SECRET
firebase deploy --only functions
```

### "Build failed"

```bash
# Functions-Dependencies prüfen
cd functions
npm install
npm audit fix
```

---

## 📈 Performance

### Function Memory erhöhen

```javascript
// functions/index.js
exports.myFunction = functions
    .runWith({ memory: '2GB', timeoutSeconds: 540 })
    .https.onCall(async (data, context) => { ... });
```

### Deployment beschleunigen

```bash
# Nur geänderte Functions deployen
firebase deploy --only functions:changedFunction

# Parallel deployen
firebase deploy --force
```

---

## 🎯 Produktions-Deployment (Empfohlen)

### Schritt-für-Schritt

```bash
# 1. Secrets setzen (einmalig)
firebase functions:secrets:set APP_SECRET

# 2. Functions deployen
firebase deploy --only functions

# 3. Database Rules deployen
firebase deploy --only database

# 4. Hosting deployen
firebase deploy --only hosting

# 5. Verifizieren
firebase open hosting:site
```

### One-Liner (alles auf einmal)

```bash
firebase deploy && firebase open hosting:site
```

---

**Hinweis**: Alle Commands von C:\Users\JACK129\IdeaProjects\DenkstDuWeb ausführen!

