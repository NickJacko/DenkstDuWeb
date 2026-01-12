# 🚀 Quick Start - Account Deletion mit 48h Karenzzeit

## Für User

### Account löschen (mit 48h Karenzzeit)

1. **Einloggen** und Settings öffnen (⚙️)
2. **Runterscrollen** zur "Gefahrenzone"
3. **"Account löschen"** klicken
4. **Bestätigen:**
   - Dialog: "Wirklich?"
   - Eingabe: "LÖSCHEN"
5. **E-Mail erhalten** mit Löschdatum
6. **48 Stunden Zeit** zum Abbrechen

### Löschung abbrechen

1. **Settings öffnen** (innerhalb 48h)
2. **"Löschung abbrechen"** Button erscheint
3. **Klicken** und bestätigen
4. **Fertig!** Account bleibt erhalten

---

## Für Entwickler

### Setup

1. **Secret konfigurieren:**
   ```bash
   firebase functions:config:set deletion.secret="YOUR_SECRET_KEY"
   ```

2. **Functions deployen:**
   ```bash
   cd functions
   firebase deploy --only functions
   ```

3. **Fertig!** Scheduler läuft automatisch.

### Client-Integration

```javascript
// Löschung planen (48h Karenzzeit)
const scheduleDelete = firebase.functions().httpsCallable('scheduleAccountDeletion');
await scheduleDelete({ confirmation: 'DELETE_MY_ACCOUNT' });

// Löschung abbrechen
const cancelDelete = firebase.functions().httpsCallable('cancelAccountDeletion');
await cancelDelete();
```

### Monitoring

```bash
# Logs ansehen
firebase functions:log

# Oder in Console:
https://console.firebase.google.com → Functions → Logs
```

---

## Wichtige Punkte

✅ **48 Stunden Karenzzeit** - User kann abbrechen  
✅ **E-Mail Benachrichtigungen** - Bei jedem Schritt  
✅ **Automatische Ausführung** - Via Cron Job (stündlich)  
✅ **DSGVO-konform** - Anonymisierte Logs  
✅ **Vollständige Löschung** - Auth + DB + Storage  

---

## Support

**Dokumentation:**
- `ACCOUNT_DELETION_COMPLETE.md` - Vollständige Doku
- `functions/account-deletion.js` - Source Code

**Bei Problemen:**
- Logs prüfen: `firebase functions:log`
- Database prüfen: `deletionRequests/{userId}`

---

**Version:** 2.0  
**Status:** ✅ Production Ready

