# Firebase Cloud Functions - Quick Reference Card

## 🚀 Schnellübersicht

### Installation & Setup
```bash
cd functions
npm install              # Dependencies installieren
cp .env.example .env     # Environment konfigurieren
npm test                 # Tests ausführen
npm run serve            # Emulators starten
npm run deploy           # Zu Firebase deployen
```

---

## 📞 API Calls (Client-seitig)

### 1️⃣ FSK Validierung
```javascript
const validateFSK = firebase.functions().httpsCallable('validateFSKAccess');
const result = await validateFSK({ category: 'fsk16' });

if (result.data.allowed) {
    // ✅ Zugriff erlaubt
} else {
    // ❌ Zugriff verweigert
    console.log(result.data.message); // "FSK 16 erforderlich"
}
```

**Parameter:** `{ category: 'fsk0' | 'fsk16' | 'fsk18' | 'special' }`  
**Response:** `{ allowed: boolean, category: string, reason?: string, message?: string }`

---

### 2️⃣ Alter verifizieren
```javascript
const setAge = firebase.functions().httpsCallable('setAgeVerification');
const result = await setAge({ 
    ageLevel: 18,
    verificationMethod: 'birthdate' // optional
});

console.log(result.data.fskAccess);
// { fsk0: true, fsk16: true, fsk18: true }

// WICHTIG: Token refresh nach Age Verification!
await firebase.auth().currentUser.getIdToken(true);
```

**Parameter:** `{ ageLevel: number (0-99), verificationMethod?: string }`  
**Response:** `{ success: boolean, ageLevel: number, fskAccess: {...} }`

---

### 3️⃣ Daten exportieren (DSGVO)
```javascript
const exportData = firebase.functions().httpsCallable('exportUserData');
const result = await exportData();

// Als JSON herunterladen
const blob = new Blob([JSON.stringify(result.data, null, 2)], 
    { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'meine-daten.json';
a.click();
```

**Parameter:** keine  
**Response:** `{ exportDate: string, userId: string, data: {...} }`

---

### 4️⃣ Account löschen (DSGVO)
```javascript
const deleteAccount = firebase.functions().httpsCallable('deleteMyAccount');
const result = await deleteAccount({ 
    confirmation: 'DELETE_MY_ACCOUNT' 
});

console.log(result.data.message);
// "Ihr Account wurde vollständig gelöscht."

// User wird automatisch ausgeloggt
await firebase.auth().signOut();
window.location.href = '/';
```

**Parameter:** `{ confirmation: 'DELETE_MY_ACCOUNT' }`  
**Response:** `{ success: boolean, message: string, deletedAt: string }`

---

## 🔒 Sicherheits-Features

| Feature | Status | Details |
|---------|--------|---------|
| **Auth Required** | ✅ | Alle Endpoints authentifiziert |
| **Rate Limiting** | ✅ | 60 Requests/Minute |
| **Token Verification** | ✅ | Firebase Auth Tokens validiert |
| **Custom Claims** | ✅ | fsk16, fsk18 Claims |
| **Input Validation** | ✅ | Alle Parameter validiert |
| **Enhanced Logging** | ✅ | Cloud Logging mit Context |

---

## 📋 Automatische Funktionen

### cleanupOldGames (Scheduled)
- **Läuft:** Jede Stunde
- **Aktion:** Löscht Spiele älter als 24h
- **DSGVO:** Automatische Datenlöschung
- **Kein Aufruf nötig** - Läuft automatisch

### cleanupUserData (Auth Trigger)
- **Trigger:** User-Account gelöscht
- **Aktion:** Löscht User aus DB und allen Games
- **DSGVO:** Vollständige Datenbereinigung
- **Kein Aufruf nötig** - Läuft automatisch

---

## ⚠️ Error Handling

```javascript
try {
    const result = await someFunction();
} catch (error) {
    switch (error.code) {
        case 'unauthenticated':
            // User nicht eingeloggt
            showError('Bitte melden Sie sich an.');
            break;
        case 'permission-denied':
            // Fehlende Berechtigung
            showError('Keine Berechtigung.');
            break;
        case 'invalid-argument':
            // Ungültige Parameter
            showError('Ungültige Eingabe.');
            break;
        case 'failed-precondition':
            // Vorbedingung nicht erfüllt
            showError('Bestätigung erforderlich.');
            break;
        case 'resource-exhausted':
            // Rate Limit überschritten
            showError('Zu viele Anfragen. Bitte warten.');
            break;
        default:
            // Interner Serverfehler
            showError('Ein Fehler ist aufgetreten.');
    }
}
```

---

## 🎨 UI Integration Beispiele

### FSK Badge
```html
<span class="fsk-badge fsk-0">FSK 0</span>
<span class="fsk-badge fsk-16" id="fsk16">FSK 16</span>
<span class="fsk-badge fsk-18" id="fsk18">FSK 18</span>
```

```css
.fsk-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
}
.fsk-badge.fsk-0 { background: #4caf50; color: white; }
.fsk-badge.fsk-16 { background: #ff9800; color: white; }
.fsk-badge.fsk-18 { background: #f44336; color: white; }
```

### Loading State
```javascript
function showLoading(message) {
    const loader = document.getElementById('loader');
    loader.textContent = message;
    loader.style.display = 'block';
}

function hideLoading() {
    document.getElementById('loader').style.display = 'none';
}

// Nutzung
showLoading('Validiere FSK...');
const result = await validateFSKAccess('fsk16');
hideLoading();
```

---

## 🧪 Testing

### Unit Tests ausführen
```bash
cd functions
npm test
```

### Emulator testen
```bash
npm run serve
# Functions verfügbar auf http://localhost:5001
```

### Logs ansehen
```bash
npm run logs
# Oder: Firebase Console → Functions → Logs
```

---

## 📊 Monitoring

### Cloud Logging Filter
```
# Alle Fehler
severity="ERROR"

# Spezifische Function
jsonPayload.functionName="validateFSKAccess"

# Unauthenticated Attempts
jsonPayload.message=~"Unauthenticated"

# FSK Denials
jsonPayload.message=~"FSK.*denied"
```

### Wichtige Metriken
- **Invocations:** Anzahl Aufrufe
- **Execution Time:** Laufzeit (< 10s ziel)
- **Error Rate:** < 1% ziel
- **Memory Usage:** Monitor für Optimierung

---

## 🔐 Best Practices

### ✅ DO's
- ✅ Immer `try/catch` verwenden
- ✅ Loading States zeigen
- ✅ Error Messages user-friendly
- ✅ Token Refresh nach Age Verification
- ✅ FSK Check VOR Content-Laden
- ✅ Offline-Handling implementieren

### ❌ DON'Ts
- ❌ Niemals FSK nur client-seitig prüfen
- ❌ Keine sensiblen Daten im Client cachen
- ❌ Keine Rate Limits ignorieren
- ❌ Keine Error Messages hardcoden
- ❌ Keinen Content ohne FSK-Check laden

---

## 🚨 Wichtige Hinweise

### Rate Limiting
- **Limit:** 60 Requests pro Minute
- **Bei Überschreitung:** HTTP 429 Error
- **Lösung:** Retry mit exponential backoff

### Token Refresh
```javascript
// Nach Age Verification IMMER aufrufen:
await firebase.auth().currentUser.getIdToken(true);
```

### Offline Detection
```javascript
if (!navigator.onLine) {
    showError('Keine Internetverbindung');
    return;
}
```

---

## 📦 Dependencies

### Production
- `firebase-admin` (^12.0.0)
- `firebase-functions` (^4.5.0)
- `express` (^4.18.2)
- `express-rate-limit` (^7.1.5)
- `cors` (^2.8.5)

### Development
- `mocha` (^10.2.0)
- `chai` (^4.3.10)
- `sinon` (^17.0.1)
- `firebase-functions-test` (^3.1.0)

---

## 📞 Support Resources

- 📖 **README.md** - Benutzer-Dokumentation
- 🔒 **SECURITY_DOCUMENTATION.md** - Sicherheits-Details
- 📊 **IMPLEMENTATION_REPORT.md** - Vollständiger Status
- 🔧 **CLIENT_INTEGRATION_GUIDE.md** - Integration Guide
- 📋 **Dieses Cheat Sheet** - Quick Reference

---

## ✅ Deployment Checklist

- [ ] `npm install` ausgeführt
- [ ] `.env` konfiguriert
- [ ] Tests erfolgreich (`npm test`)
- [ ] Security Audit OK (`npm audit`)
- [ ] Firebase Projekt verbunden
- [ ] GitHub Secret `FIREBASE_TOKEN` gesetzt
- [ ] Deployment durchgeführt (`npm run deploy`)
- [ ] Logs geprüft (Firebase Console)
- [ ] Client-Integration getestet

---

**Quick Access Links:**
- 🔗 Firebase Console: https://console.firebase.google.com
- 🔗 Cloud Logging: https://console.cloud.google.com/logs
- 🔗 GitHub Actions: .github/workflows/

**Version:** 1.0.0 | **Erstellt:** 2026-01-12 | **Status:** ✅ Production Ready

