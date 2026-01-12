# 🚀 Deployment Checkliste - Firebase Cloud Functions

## Pre-Deployment

### ✅ Lokale Vorbereitung

- [x] **Dependencies installiert**
  ```bash
  cd functions
  npm install
  ```
  **Status:** ✅ Erledigt (0 vulnerabilities)

- [x] **Environment Variables konfiguriert**
  ```bash
  cp .env.example .env
  # FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
  ```
  **Datei:** `.env` (nicht im Git!)

- [ ] **Tests erfolgreich**
  ```bash
  npm test
  ```
  **Erwartung:** Alle Tests grün ✅

- [x] **Security Audit bestanden**
  ```bash
  npm audit
  ```
  **Status:** ✅ 0 vulnerabilities

- [ ] **Code Review abgeschlossen**
  - Alle Sicherheitsfeatures implementiert?
  - Logging korrekt?
  - Error Handling vollständig?

---

## Firebase Konfiguration

### ✅ Firebase Projekt Setup

- [ ] **Projekt erstellt/ausgewählt**
  ```bash
  firebase projects:list
  firebase use your-project-id
  ```

- [ ] **Billing aktiviert** (erforderlich für Cloud Functions)
  - Firebase Console → Project Settings → Usage and Billing
  - Blaze Plan (Pay-as-you-go) erforderlich

- [ ] **Realtime Database URL gesetzt**
  ```bash
  # In .env:
  FIREBASE_DATABASE_URL=https://YOUR-PROJECT.firebaseio.com
  ```

- [ ] **Service Account Berechtigungen geprüft**
  - Google Cloud Console → IAM & Admin → Service Accounts
  - Least-privilege Prinzip beachten

---

## Testing

### ✅ Lokale Tests

- [ ] **Emulators getestet**
  ```bash
  npm run serve
  # Functions auf http://localhost:5001
  ```

- [ ] **Unit Tests durchgeführt**
  ```bash
  npm test
  ```
  **Erwartete Tests:**
  - ✅ validateFSKAccess (alle Altersgruppen)
  - ✅ Authentication (reject unauthenticated)
  - ✅ Input Validation
  - ✅ DSGVO Functions

- [ ] **Manuelles Testing**
  - [ ] FSK Validation für fsk0, fsk16, fsk18
  - [ ] Age Verification setzen
  - [ ] Datenexport durchführen
  - [ ] Account-Löschung (Test-Account!)
  - [ ] Error Handling (offline, invalid input)

---

## Security Check

### ✅ Sicherheitsüberprüfung

- [x] **Admin SDK mit Least-Privilege** ✅
  - Application Default Credentials
  - Nur server-seitig

- [x] **Alle Endpoints authentifiziert** ✅
  - `verifyAuth()` auf allen HTTP Functions

- [x] **Rate Limiting vorbereitet** ✅
  - Express Rate Limit Middleware
  - 60 req/min Default

- [x] **Input Validation** ✅
  - Alle Parameter validiert
  - Type Checking

- [x] **Enhanced Logging** ✅
  - Cloud Logging Integration
  - Structured Logs

- [ ] **Secrets Management**
  - Keine .env im Git
  - Service Account Keys sicher

---

## Deployment

### ✅ Firebase Deployment

- [ ] **Deployment durchführen**
  ```bash
  npm run deploy
  # Oder: firebase deploy --only functions
  ```

- [ ] **Deployment erfolgreich**
  - Alle Functions deployed
  - Keine Fehler im Log

- [ ] **Functions überprüfen**
  - Firebase Console → Functions
  - Alle 6 Functions sichtbar:
    - ✅ cleanupOldGames (Scheduled)
    - ✅ cleanupUserData (Auth Trigger)
    - ✅ validateFSKAccess
    - ✅ setAgeVerification
    - ✅ exportUserData
    - ✅ deleteMyAccount

---

## Post-Deployment

### ✅ Verifikation

- [ ] **Logs prüfen**
  ```bash
  npm run logs
  # Oder: Firebase Console → Functions → Logs
  ```

- [ ] **Cloud Logging Setup**
  - Google Cloud Console → Logging
  - Filter eingerichtet
  - Alerts konfiguriert (optional)

- [ ] **Live Testing**
  - [ ] Production URL testen
  - [ ] FSK Validation aufrufen
  - [ ] Logs erscheinen in Console
  - [ ] Error Handling funktioniert

- [ ] **Monitoring einrichten**
  - Firebase Console → Functions → Dashboard
  - Metrics beobachten:
    - Invocations
    - Execution Time
    - Error Rate
    - Memory Usage

---

## CI/CD Setup

### ✅ GitHub Actions

- [ ] **Firebase Token generieren**
  ```bash
  firebase login:ci
  # Kopiere den generierten Token
  ```

- [ ] **GitHub Secret hinzufügen**
  - Repository → Settings → Secrets and Variables → Actions
  - Name: `FIREBASE_TOKEN`
  - Value: [generierter Token]

- [ ] **Workflow testen**
  - Push zu main/develop
  - GitHub Actions Tab prüfen
  - Pipeline erfolgreich? ✅

- [ ] **Auto-Deployment verifizieren**
  - Push zu main
  - Functions automatisch deployed? ✅

---

## Client Integration

### ✅ Frontend Updates

- [ ] **Client Code aktualisiert**
  - FSK Validation Calls hinzugefügt
  - Age Verification Flow implementiert
  - Datenexport Button hinzugefügt
  - Account-Löschung implementiert

- [ ] **Error Handling**
  - Try/Catch überall
  - User-friendly Messages
  - Loading States

- [ ] **UI/UX**
  - FSK Badges angezeigt
  - Altersverifikation sichtbar
  - DSGVO Links vorhanden

- [ ] **Integration Testing**
  - [ ] FSK-gesperrter Content wird blockiert
  - [ ] Age Verification funktioniert
  - [ ] Token Refresh nach Verification
  - [ ] Datenexport Download funktioniert
  - [ ] Account-Löschung funktioniert

---

## DSGVO Compliance

### ✅ Datenschutz

- [x] **Recht auf Vergessenwerden** ✅
  - `deleteMyAccount()` Function
  - Vollständige Datenlöschung

- [x] **Recht auf Datenportabilität** ✅
  - `exportUserData()` Function
  - JSON Export

- [x] **Automatische Löschung** ✅
  - `cleanupOldGames` (stündlich)
  - `cleanupUserData` (Auth Trigger)

- [ ] **Datenschutzerklärung aktualisiert**
  - Cloud Functions erwähnt
  - Datenverarbeitung dokumentiert
  - User-Rechte aufgelistet

- [ ] **Einwilligungen eingeholt**
  - Cookie Banner (falls nötig)
  - Age Verification Consent
  - DSGVO-konformes Opt-in

---

## Jugendschutz

### ✅ FSK Compliance

- [x] **Server-seitige Validierung** ✅
  - `validateFSKAccess()` Function
  - Client kann nicht manipulieren

- [x] **Altersverifikation** ✅
  - `setAgeVerification()` Function
  - Custom Claims (fsk16, fsk18)

- [ ] **Content Management**
  - FSK-Ratings in Database
  - Content korrekt klassifiziert
  - Nur verifizierte Nutzer haben Zugriff

- [ ] **Audit Trail**
  - Logs für FSK-Zugriffe
  - Age Verification Historie
  - Monitoring aktiv

---

## Performance & Monitoring

### ✅ Optimierung

- [ ] **Performance Metrics**
  - Execution Time < 10s
  - Memory Usage < 80%
  - Cold Start Zeit akzeptabel

- [ ] **Error Rate**
  - < 1% Error Rate Ziel
  - Monitoring Alerts eingerichtet

- [ ] **Costs Monitoring**
  - Firebase Console → Usage
  - Budget Alerts eingerichtet
  - Keine unerwarteten Kosten

---

## Dokumentation

### ✅ Docs aktualisiert

- [x] **README.md** ✅
- [x] **SECURITY_DOCUMENTATION.md** ✅
- [x] **IMPLEMENTATION_REPORT.md** ✅
- [x] **CLIENT_INTEGRATION_GUIDE.md** ✅
- [x] **QUICK_REFERENCE.md** ✅
- [x] **Diese Checkliste** ✅

- [ ] **Team informiert**
  - Deployment kommuniziert
  - Docs geteilt
  - Training durchgeführt (falls nötig)

---

## Rollback Plan

### ⚠️ Für Notfälle

- [ ] **Alte Version dokumentiert**
  - Git Tag für aktuelle Version
  - Rollback-Kommando bereit

- [ ] **Rollback testen**
  ```bash
  # Falls Probleme auftreten:
  firebase deploy --only functions --force
  # Oder: Previous version aus Git
  ```

- [ ] **Monitoring für Probleme**
  - Error Spikes beobachten
  - User Reports sammeln
  - Schnell reagieren können

---

## Final Check

### ✅ Vor Go-Live

- [ ] **Alle Tests grün** ✅
- [ ] **Security Audit bestanden** ✅
- [ ] **Deployment erfolgreich** 
- [ ] **Live Testing OK** 
- [ ] **Monitoring aktiv** 
- [ ] **Team bereit** 
- [ ] **Rollback Plan vorhanden** 

---

## 🎉 GO LIVE!

**Wenn alle Checkboxen markiert sind:**

```bash
# Final Deployment
cd functions
npm test && npm run deploy

# Verify
npm run logs

# Celebrate! 🎉
```

---

## Support & Troubleshooting

### Häufige Probleme

**Problem:** "Permission denied"
```bash
firebase login
firebase use your-project-id
```

**Problem:** "Billing not enabled"
→ Firebase Console → Upgrade to Blaze Plan

**Problem:** "Functions not deploying"
```bash
firebase deploy --only functions --debug
```

**Problem:** "Tests failing"
```bash
rm -rf node_modules
npm install
npm test
```

---

## Kontakte

- **Firebase Console:** https://console.firebase.google.com
- **Cloud Console:** https://console.cloud.google.com
- **Support:** Firebase Support Chat
- **Docs:** https://firebase.google.com/docs/functions

---

**Version:** 1.0.0  
**Erstellt:** 2026-01-12  
**Letztes Update:** 2026-01-12  
**Status:** Ready for Deployment

