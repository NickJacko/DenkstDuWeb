# DenkstDuWeb - Firebase Cloud Functions

Enterprise-Grade Server-Funktionen mit vollständiger DSGVO-Compliance und Sicherheit.

## 🚀 Schnellstart

### Installation
```bash
cd functions
npm install
```

### Development
```bash
# Start Firebase Emulators
npm run serve

# Run Tests
npm test

# Watch Tests
npm run test:watch
```

### Deployment
```bash
# Deploy alle Functions
npm run deploy

# Logs anzeigen
npm run logs
```

## 📋 Verfügbare Funktionen

### 🔐 Sicherheit & Auth

#### `validateFSKAccess(category)`
Validiert FSK-Zugriff server-seitig (verhindert Client-Manipulation).

```javascript
const validateFSK = firebase.functions().httpsCallable('validateFSKAccess');
const result = await validateFSK({ category: 'fsk16' });

if (result.data.allowed) {
    // Access granted
} else {
    console.log(result.data.message); // "FSK 16 erforderlich"
}
```

#### `setAgeVerification(ageLevel, verificationMethod)`
Setzt Altersverifikation für einen User.

```javascript
const setAge = firebase.functions().httpsCallable('setAgeVerification');
const result = await setAge({ 
    ageLevel: 18,
    verificationMethod: 'id-card'  // optional
});

console.log(result.data.fskAccess);
// { fsk0: true, fsk16: true, fsk18: true }
```

### 🗂️ DSGVO Compliance

#### `exportUserData()`
Exportiert alle Benutzerdaten (DSGVO Art. 20 - Datenportabilität).

```javascript
const exportData = firebase.functions().httpsCallable('exportUserData');
const result = await exportData();

// result.data enthält:
// {
//   exportDate: "2026-01-12T...",
//   userId: "user-123",
//   data: {
//     profile: { ... },
//     games: [ ... ]
//   }
// }

// Download als JSON
const dataStr = JSON.stringify(result.data, null, 2);
const blob = new Blob([dataStr], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'meine-daten.json';
a.click();
```

#### `deleteMyAccount(confirmation)`
Löscht Account vollständig (DSGVO Art. 17 - Recht auf Vergessenwerden).

```javascript
const deleteAccount = firebase.functions().httpsCallable('deleteMyAccount');

try {
    const result = await deleteAccount({ 
        confirmation: 'DELETE_MY_ACCOUNT' 
    });
    
    console.log(result.data.message);
    // "Ihr Account wurde vollständig gelöscht."
    
    // User wird automatisch ausgeloggt
    await firebase.auth().signOut();
    
} catch (error) {
    console.error(error.message);
}
```

### 🧹 Automatische Bereinigung

#### `cleanupOldGames` (Scheduled)
Läuft stündlich und löscht Spiele älter als 24h.

**Automatisch - kein manueller Aufruf nötig**

#### `cleanupUserData` (Auth Trigger)
Wird automatisch ausgelöst, wenn ein User gelöscht wird.

**Automatisch - kein manueller Aufruf nötig**

## 🔒 Sicherheitsfeatures

### ✅ Implementiert (Stand: 2026-01-12)

- [x] **P0 Security**: Least-Privilege Admin SDK
- [x] **P0 Security**: Firebase Auth Token Verification
- [x] **P0 Security**: Rate Limiting (60 req/min)
- [x] **P0 Security**: Input Validation
- [x] **P1 Stability**: Enhanced Logging (Cloud Logging)
- [x] **P1 Stability**: Unit Tests
- [x] **P1 Stability**: CI/CD Pipeline (GitHub Actions)
- [x] **P1 DSGVO**: Recht auf Vergessenwerden
- [x] **P1 DSGVO**: Recht auf Datenportabilität
- [x] **P1 DSGVO**: Automatische Datenlöschung
- [x] **P1 Jugendschutz**: FSK-Verifikation server-seitig

## 📊 Monitoring & Logs

### Cloud Logging (Google Cloud Console)
Alle Logs werden strukturiert erfasst:

```javascript
// Beispiel Log-Ausgabe:
{
  "functionName": "validateFSKAccess",
  "message": "FSK access granted",
  "uid": "user-123",
  "category": "fsk16",
  "ageLevel": 18,
  "timestamp": "2026-01-12T10:30:00.000Z"
}
```

### Log-Filter Beispiele
```bash
# Alle Fehler
severity="ERROR"

# Spezifische Funktion
jsonPayload.functionName="validateFSKAccess"

# Security Warnungen
jsonPayload.message=~"Unauthenticated"

# Erfolgreiche Löschungen
jsonPayload.functionName="deleteMyAccount" AND severity="INFO"
```

## 🧪 Testing

### Unit Tests ausführen
```bash
npm test
```

### Test Coverage
- ✅ Authentication Tests
- ✅ FSK Validation Tests (alle Altersgruppen)
- ✅ Input Validation Tests
- ✅ DSGVO Function Tests

### Beispiel Test
```javascript
it('should deny FSK16 for users under 16', async () => {
    const context = {
        auth: {
            uid: 'test-user',
            token: {}
        }
    };

    const result = await validateFSKAccess(
        { category: 'fsk16' }, 
        context
    );

    expect(result.allowed).to.be.false;
    expect(result.reason).to.equal('age_too_young');
});
```

## 🌍 Umgebungsvariablen

Kopiere `.env.example` zu `.env`:

```bash
cp .env.example .env
```

Benötigte Variablen:
```env
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
FIREBASE_PROJECT_ID=your-project-id
```

## 🚨 Fehlerbehandlung

Alle Functions werfen strukturierte Fehler:

```javascript
try {
    const result = await someFunction();
} catch (error) {
    switch (error.code) {
        case 'unauthenticated':
            // User ist nicht eingeloggt
            break;
        case 'permission-denied':
            // Fehlende Berechtigung
            break;
        case 'invalid-argument':
            // Ungültige Parameter
            break;
        case 'failed-precondition':
            // Vorbedingung nicht erfüllt
            break;
        default:
            // Interner Fehler
            console.error(error.message);
    }
}
```

## 📈 Performance

### Resource Allocation
```javascript
.runWith({
    memory: '512MB',        // Mehr Memory für komplexe Operationen
    timeoutSeconds: 60      // Max. Laufzeit
})
```

### Rate Limiting
- **Default**: 60 Requests pro Minute pro User
- **Anpassbar** in `createRateLimiter()`

## 🔄 CI/CD

GitHub Actions führt automatisch aus:
1. ✅ Dependency Installation
2. ✅ Linting (wenn konfiguriert)
3. ✅ Unit Tests
4. ✅ Security Audit
5. ✅ Deployment (nur main branch)

### Setup
1. Firebase Token generieren:
   ```bash
   firebase login:ci
   ```

2. Token als GitHub Secret hinzufügen:
   - Repository → Settings → Secrets
   - Name: `FIREBASE_TOKEN`
   - Value: [generierter Token]

## 📚 Weitere Dokumentation

- [SECURITY_DOCUMENTATION.md](../docs/SECURITY_DOCUMENTATION.md) - Ausführliche Sicherheitsdoku
- [Firebase Functions Docs](https://firebase.google.com/docs/functions)
- [DSGVO Compliance Guide](https://firebase.google.com/support/privacy)

## 🆘 Troubleshooting

### "Module not found"
```bash
cd functions
rm -rf node_modules package-lock.json
npm install
```

### "Permission denied"
Prüfe Firebase Projekt-Rechte:
```bash
firebase projects:list
firebase use your-project-id
```

### "Tests failing"
```bash
# Update dependencies
npm update

# Clear cache
rm -rf node_modules
npm install
```

## 📞 Support

Bei Fragen oder Problemen:
1. Prüfe die Logs: `npm run logs`
2. Siehe [SECURITY_DOCUMENTATION.md](../docs/SECURITY_DOCUMENTATION.md)
3. Checke Firebase Console → Functions → Logs

## 📄 Lizenz

Private Project - All Rights Reserved

