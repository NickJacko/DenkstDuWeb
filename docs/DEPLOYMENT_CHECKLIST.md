# ✅ Deployment-Checkliste - No-Cap Web App

**Projekt**: No-Cap Party Game  
**Datum**: 7. Januar 2026  
**Ziel**: Production Deployment

---

## 📋 Pre-Deployment Checklist

- [x] Code optimiert (12 Dateien)
- [x] Dokumentation erstellt (10 MD-Dateien)
- [x] APP_SECRET generiert und gesetzt
- [x] Database Rules getestet
- [x] Security Headers konfiguriert
- [ ] Functions deployed
- [ ] Database Rules deployed
- [ ] Hosting deployed
- [ ] Deployment verifiziert

---

## 🚀 Deployment-Schritte

### ✅ 1. APP_SECRET setzen (ERLEDIGT)

```bash
# Secret generiert
-join ((1..128) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })

# Secret gesetzt
firebase functions:secrets:set APP_SECRET
```

**Status**: ✅ Erfolgreich (Secret Version 1 erstellt)

---

### 🔄 2. Functions deployen (IN BEARBEITUNG)

```bash
firebase deploy --only functions
```

**Erwartete Functions**:
- ✅ verifyAge
- ✅ checkCategoryAccess
- ✅ getAnswerToken
- ✅ validateAnswer
- ✅ checkPremiumStatus
- ✅ cleanupOldGames
- ✅ cleanupRateLimits

**Status**: 🔄 Deployment läuft...

---

### ⏳ 3. Database Rules deployen (AUSSTEHEND)

```bash
firebase deploy --only database
```

**Änderungen**:
- Rollenbasierte Kontrolle (Host vs Guest)
- Premium-Validierung (auth.token.isPremium)
- FSK-Validierung (auth.token.ageLevel)
- Delete-Schutz (nur Host)

**Erwartete Ausgabe**:
```
✔ Deploy complete!
Project Console: https://console.firebase.google.com/project/denkstduwebsite
```

---

### ⏳ 4. Hosting deployen (AUSSTEHEND)

```bash
firebase deploy --only hosting
```

**Änderungen**:
- Stripe CSP (Premium-Ready)
- Erweiterte Ignore-Liste
- Deutsche URL-Aliase (/impressum, /datenschutz)
- Optimierte Security Headers

**Erwartete Ausgabe**:
```
✔ Deploy complete!
Hosting URL: https://no-cap.app
```

---

### ⏳ 5. Deployment verifizieren (AUSSTEHEND)

```bash
firebase open hosting:site
```

**Manuelle Tests**:
- [ ] Seite lädt korrekt
- [ ] Age-Verification funktioniert
- [ ] Cookie-Banner wird angezeigt
- [ ] Impressum & Datenschutz erreichbar
- [ ] Multiplayer-Modus funktioniert
- [ ] Database Rules blockieren unbefugte Zugriffe

---

## 🧪 Post-Deployment Tests

### Test 1: Security Headers

```bash
curl -I https://no-cap.app | grep -i "content-security"
```

**Erwartetes Ergebnis**:
- Content-Security-Policy vorhanden
- Stripe-Domains in CSP enthalten
- HSTS aktiv

### Test 2: Age-Verification

```javascript
// Browser Console
const verifyAge = firebase.functions().httpsCallable('verifyAge');
const result = await verifyAge({ ageLevel: 18, consent: true, ipConsent: false });
console.log(result.data);
// Expected: { success: true, ageLevel: 18, message: '...' }
```

### Test 3: Database Rules

```javascript
// Als Guest versuchen Settings zu ändern
const gameRef = firebase.database().ref('games/TESTID/settings/difficulty');
await gameRef.set('hard');
// Expected: PERMISSION_DENIED ❌
```

### Test 4: Custom Claims

```javascript
// Nach Age-Verification
await firebase.auth().currentUser.getIdToken(true);  // Refresh
const token = await firebase.auth().currentUser.getIdTokenResult();
console.log(token.claims.ageLevel);  // Should be 18 ✅
```

---

## 🎯 Rollback-Plan (falls Probleme)

### Schneller Rollback

```bash
# 1. Vorherige Version deployen
git log --oneline -10
git checkout [PREVIOUS_COMMIT_HASH]

# 2. Redeploy
firebase deploy

# 3. Zurück zu main
git checkout main
```

### Selektiver Rollback

```bash
# Nur Functions zurücksetzen
firebase functions:delete verifyAge
firebase deploy --only functions

# Nur Hosting zurücksetzen
firebase hosting:channel:deploy rollback
```

---

## 📊 Deployment-Metriken

### Erwartete Deployment-Zeit

- Functions: ~3-5 Minuten
- Database Rules: ~30 Sekunden
- Hosting: ~2-3 Minuten
- **Total**: ~6-9 Minuten

### Erwartete Größe

- Functions: ~2 MB (Node.js 20, Dependencies)
- Hosting: ~9 MB (optimiert, ohne .md/.git)
- Database Rules: ~15 KB (JSON)

---

## ⚠️ Bekannte Probleme & Lösungen

### Problem: "APP_SECRET not configured"

**Ursache**: Secret nicht gesetzt oder nicht deployed

**Lösung**:
```bash
firebase functions:secrets:set APP_SECRET
firebase deploy --only functions
```

### Problem: Database Rules blockieren legitime Zugriffe

**Ursache**: Custom Claims nicht refreshed

**Lösung**:
```javascript
await firebase.auth().currentUser.getIdToken(true);  // Force refresh
```

### Problem: Hosting zeigt alte Version

**Ursache**: Browser-Cache

**Lösung**:
```bash
# Hard Reload: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
# Oder Cache leeren
```

---

## 📞 Support-Kontakte

- **Firebase Console**: https://console.firebase.google.com/project/denkstduwebsite
- **Deployment-Logs**: `firebase functions:log`
- **Analytics**: Firebase Console → Analytics

---

**Nächster Schritt**: Warten auf Functions-Deployment, dann Database Rules deployen.

