# Firebase-Service.js - Implementierungsplan & Checkliste

**Datum:** 11. Januar 2026  
**Status:** Bereit zur Implementierung  

---

## ✅ Erledigte Aufgaben

### 1. Database Rules erstellt
- **Datei:** `database.rules.json` ✅
- **Features:**
  - Nur authentifizierte Benutzer
  - Host-Prüfungen für Phase/Scores
  - Spieler können nur eigene Daten ändern
  - FSK-Validierung
  - TTL-Support

### 2. Cloud Functions erstellt
- **Datei:** `functions/index.js` ✅
- **Functions:**
  - `cleanupOldGames` - Auto-Delete nach 24h
  - `cleanupUserData` - Löscht Daten bei Account-Löschung
  - `validateFSKAccess` - Server-seitige FSK-Validierung
  - `exportUserData` - DSGVO-konforme Datenexport

### 3. Vollständiger Implementation Guide
- **Datei:** `FIREBASE_SERVICE_COMPLETE_GUIDE.md` ✅
- **Inhalt:**
  - Security-Validator Code
  - Connection-Manager mit Reconnect
  - Error-Handler
  - Listener-Manager
  - Abort-Manager
  - Event-System
  - Cache-Manager
  - Alle Code-Beispiele

---

## ⚠️ Noch zu implementieren in firebase-service.js

### Code-Blöcke zum Hinzufügen:

#### 1. SecurityValidator (Zeile ~50)
```javascript
const SecurityValidator = {
    sanitizeGameId(gameId) { /* ... */ },
    sanitizeGameCode(code) { /* ... */ },
    sanitizePlayerName(name) { /* ... */ },
    sanitizeCategory(category) { /* ... */ },
    sanitizeDifficulty(difficulty) { /* ... */ },
    sanitizePhase(phase) { /* ... */ }
};
```

#### 2. ConnectionManager (Zeile ~100)
```javascript
const ConnectionManager = {
    status: 'disconnected',
    reconnectAttempts: 0,
    initialize() { /* ... */ },
    onConnected() { /* ... */ },
    onDisconnected() { /* ... */ },
    scheduleReconnect() { /* ... */ }
};
```

#### 3. ErrorHandler (Zeile ~200)
```javascript
const ErrorHandler = {
    handleError(error, context) { /* ... */ },
    getUserFriendlyMessage(error) { /* ... */ }
};
```

#### 4. ListenerManager (Zeile ~250)
```javascript
const ListenerManager = {
    listeners: new Map(),
    register(key, ref, callback) { /* ... */ },
    unregister(key) { /* ... */ },
    unregisterAll() { /* ... */ }
};
```

#### 5. AbortManager (Zeile ~300)
```javascript
const AbortManager = {
    controllers: new Map(),
    create(key) { /* ... */ },
    abort(key) { /* ... */ },
    abortAll() { /* ... */ }
};
```

#### 6. EventEmitter (Zeile ~350)
```javascript
const EventEmitter = {
    callbacks: {},
    on(event, callback) { /* ... */ },
    off(event, callback) { /* ... */ },
    emit(event, data) { /* ... */ }
};
```

#### 7. CacheManager (Zeile ~400)
```javascript
const CacheManager = {
    cache: new Map(),
    set(key, value, ttl) { /* ... */ },
    get(key) { /* ... */ },
    has(key) { /* ... */ },
    clear() { /* ... */ }
};
```

### Existierende Funktionen zu erweitern:

#### createGame() - Sanitization hinzufügen
```javascript
async createGame(gameCode, hostId) {
    const sanitizedCode = SecurityValidator.sanitizeGameCode(gameCode);
    const sanitizedHostId = SecurityValidator.sanitizeGameId(hostId);
    
    // ... existing code ...
    
    await database.ref(`games/${gameId}`).set({
        // ... existing fields ...
        createdAt: getServerTimestamp(),  // ✅ Server timestamp
        ttl: Date.now() + (24 * 60 * 60 * 1000)  // ✅ 24h TTL
    });
}
```

#### joinGame() - Sanitization + Error Handling
```javascript
async joinGame(gameCode, playerData) {
    const sanitizedCode = SecurityValidator.sanitizeGameCode(gameCode);
    const sanitizedName = SecurityValidator.sanitizePlayerName(playerData.name);
    
    return await safeFirebaseCall(async () => {
        // ... existing code ...
    }, { operation: 'joinGame', gameCode: sanitizedCode });
}
```

#### Alle Listener mit ListenerManager registrieren
```javascript
// VORHER:
gameRef.on('value', callback);

// NACHHER:
ListenerManager.register('game_' + gameId, gameRef, callback);
```

---

## 📋 Deployment-Checkliste

### 1. Database Rules
```powershell
# Deploy Rules
firebase deploy --only database

# Test Rules
firebase emulators:start --only database
```

### 2. Cloud Functions
```powershell
# Install Dependencies
cd functions
npm install

# Deploy Functions
firebase deploy --only functions

# Test Functions
firebase emulators:start --only functions
```

### 3. Code-Änderungen
```powershell
# Backup existing file
cp assets/js/firebase-service.js assets/js/firebase-service.js.backup

# Implement changes from FIREBASE_SERVICE_COMPLETE_GUIDE.md
# Test locally
firebase emulators:start

# Deploy
firebase deploy --only hosting
```

---

## 🧪 Testing

### Security Tests
```javascript
// Test 1: Unauthorized write (should fail)
await testUnauthorizedWrite();

// Test 2: Non-host score update (should fail)
await testNonHostScoreUpdate();

// Test 3: Input sanitization
await testInputSanitization();
```

### Connection Tests
```javascript
// Test reconnect logic
await testReconnectLogic();

// Test offline handling
await testOfflineMode();
```

### DSGVO Tests
```javascript
// Test auto-delete (24h simulation)
await testAutoDelete();

// Test manual delete
await testManualDelete();

// Test data export
await testDataExport();
```

---

## 📊 Metriken & Monitoring

### Firebase Console überwachen:
- ✅ Database Rules Hits (sollten alle validiert sein)
- ✅ Cloud Functions Executions
- ✅ Error Rates
- ✅ Database Size (sollte durch Auto-Delete konstant bleiben)

### Performance-Metriken:
- ✅ Average Read/Write Time
- ✅ Cache Hit Rate
- ✅ Reconnect Frequency
- ✅ Error Rate

---

## 🔒 Sicherheits-Audit

### Vor Deployment prüfen:
- [ ] Database Rules deployed?
- [ ] Alle Inputs sanitisiert?
- [ ] FSK-Validierung serverseitig?
- [ ] Keine Secrets im Code?
- [ ] Error-Messages nicht zu detailliert?
- [ ] Rate-Limiting aktiv?

---

## 📚 Dokumentation

### Für Entwickler:
- `FIREBASE_SERVICE_COMPLETE_GUIDE.md` - Vollständige Implementation
- `database.rules.json` - Sicherheitsregeln
- `functions/index.js` - Cloud Functions

### Für Nutzer:
- Privacy Policy aktualisieren:
  - "Spieldaten werden nach 24 Stunden automatisch gelöscht"
  - "Sie können Ihre Daten jederzeit exportieren oder löschen"
  - "Keine personenbezogenen Daten außer Pseudonymen"

---

## 🎯 Nächste Schritte

### Sofort:
1. ✅ Database Rules deployen
2. ✅ Cloud Functions deployen
3. ⚠️ firebase-service.js Code hinzufügen

### Diese Woche:
4. ⚠️ Alle Tests durchführen
5. ⚠️ Privacy Policy aktualisieren
6. ⚠️ Monitoring einrichten

### Kontinuierlich:
7. ⚠️ Database Size überwachen
8. ⚠️ Error Logs prüfen
9. ⚠️ Performance optimieren

---

**Erstellt:** 11. Januar 2026  
**Version:** 8.0  
**Status:** ✅ Bereit zur Implementierung

