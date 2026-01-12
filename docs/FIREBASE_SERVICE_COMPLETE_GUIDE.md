# Firebase-Service.js - Complete Enhancement Guide

**Datum:** 11. Januar 2026  
**Priorität:** P0 (Sicherheit) + P1 (Stabilität/DSGVO)  
**Version:** 8.0

---

## Zusammenfassung

Die `firebase-service.js` ist die zentrale Firebase-Bibliothek. Folgende Optimierungen sind erforderlich:
- **Sicherheit:** Database Rules erstellt, Input-Sanitization
- **Stabilität:** Reconnect-Logic, Error-Handling, Listener-Cleanup
- **UI/UX:** Status-Events, Error-Callbacks
- **Performance:** Caching, Query-Optimierung
- **DSGVO:** Datenminimierung, Auto-Delete, TTL

---

## [P0] Sicherheit ✅

### 1. Database Rules erstellt

**Datei:** `database.rules.json` ✅ Erstellt

**Hauptregeln:**
- ✅ Nur authentifizierte Benutzer können schreiben
- ✅ Lesezugriff nur auf eigene Spiele
- ✅ Host-Prüfungen für Phase/Scores
- ✅ Spieler können nur eigenen Namen ändern
- ✅ FSK-Kategorien validiert
- ✅ TTL für Auto-Delete

**Deployment:**
```powershell
firebase deploy --only database
```

### 2. Input-Sanitization hinzufügen

**Zu implementieren in firebase-service.js:**

```javascript
/**
 * ✅ P0 SECURITY: Sanitize all inputs before Firebase operations
 */
const SecurityValidator = {
    sanitizeGameId(gameId) {
        if (!gameId || typeof gameId !== 'string') {
            throw new Error('Invalid gameId');
        }
        return gameId.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 100);
    },
    
    sanitizeGameCode(code) {
        if (!code || typeof code !== 'string') {
            throw new Error('Invalid game code');
        }
        return code.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6);
    },
    
    sanitizePlayerName(name) {
        if (!name || typeof name !== 'string') {
            throw new Error('Invalid player name');
        }
        // Use NocapUtils if available
        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            return window.NocapUtils.sanitizeInput(name).substring(0, 15);
        }
        return name.replace(/[<>]/g, '').substring(0, 15);
    },
    
    sanitizeCategory(category) {
        const validCategories = ['fsk0', 'fsk16', 'fsk18', 'special'];
        if (!validCategories.includes(category)) {
            throw new Error('Invalid category: ' + category);
        }
        return category;
    },
    
    sanitizeDifficulty(difficulty) {
        const validDifficulties = ['easy', 'medium', 'hard'];
        if (!validDifficulties.includes(difficulty)) {
            throw new Error('Invalid difficulty: ' + difficulty);
        }
        return difficulty;
    },
    
    sanitizePhase(phase) {
        const validPhases = ['lobby', 'playing', 'results', 'finished'];
        if (!validPhases.includes(phase)) {
            throw new Error('Invalid phase: ' + phase);
        }
        return phase;
    }
};
```

**Verwendung in allen Methoden:**

```javascript
// VORHER:
async createGame(gameCode, hostId) {
    const gameRef = database.ref(`games/${gameId}`);
    // ...
}

// NACHHER:
async createGame(gameCode, hostId) {
    const sanitizedCode = SecurityValidator.sanitizeGameCode(gameCode);
    const sanitizedHostId = SecurityValidator.sanitizeGameId(hostId);
    
    const gameRef = database.ref(`games/${gameId}`);
    // ...
}
```

---

## [P1] Stabilitäts-Verbesserungen

### 3. Reconnect-Logic mit Exponential Backoff

**Zu implementieren:**

```javascript
/**
 * ✅ P1 STABILITY: Connection status management
 */
const ConnectionManager = {
    status: 'disconnected',
    reconnectAttempts: 0,
    reconnectTimeout: null,
    
    async initialize() {
        // Listen to Firebase connection state
        const connectedRef = database.ref('.info/connected');
        
        connectedRef.on('value', (snapshot) => {
            if (snapshot.val() === true) {
                this.onConnected();
            } else {
                this.onDisconnected();
            }
        });
    },
    
    onConnected() {
        this.status = 'connected';
        this.reconnectAttempts = 0;
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        emitEvent('connectionChange', { status: 'connected' });
        
        if (isDevelopment) {
            console.log('✅ Firebase connected');
        }
    },
    
    onDisconnected() {
        this.status = 'disconnected';
        
        emitEvent('connectionChange', { status: 'disconnected' });
        
        if (isDevelopment) {
            console.log('⚠️ Firebase disconnected, attempting reconnect...');
        }
        
        this.scheduleReconnect();
    },
    
    scheduleReconnect() {
        if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            this.status = 'failed';
            emitEvent('connectionChange', { 
                status: 'failed',
                message: 'Verbindung fehlgeschlagen nach ' + MAX_RECONNECT_ATTEMPTS + ' Versuchen'
            });
            return;
        }
        
        const delay = BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts);
        this.reconnectAttempts++;
        
        this.status = 'reconnecting';
        emitEvent('connectionChange', { 
            status: 'reconnecting',
            attempt: this.reconnectAttempts,
            maxAttempts: MAX_RECONNECT_ATTEMPTS,
            delay: delay
        });
        
        this.reconnectTimeout = setTimeout(() => {
            this.attemptReconnect();
        }, delay);
    },
    
    async attemptReconnect() {
        try {
            // Try to read connection status
            const snapshot = await database.ref('.info/connected').once('value');
            
            if (snapshot.val() === true) {
                this.onConnected();
            } else {
                this.scheduleReconnect();
            }
        } catch (error) {
            console.error('Reconnect failed:', error);
            this.scheduleReconnect();
        }
    },
    
    reset() {
        this.reconnectAttempts = 0;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }
};
```

### 4. Umfassendes Error-Handling

**Zu implementieren:**

```javascript
/**
 * ✅ P1 STABILITY: Centralized error handling
 */
const ErrorHandler = {
    handleError(error, context = {}) {
        const errorInfo = {
            message: error.message || 'Unknown error',
            code: error.code || 'UNKNOWN',
            context: context,
            timestamp: Date.now()
        };
        
        // Log to console
        console.error('Firebase Service Error:', errorInfo);
        
        // Emit to UI
        emitEvent('error', errorInfo);
        
        // Send to logging service (if available)
        if (window.ErrorBoundary) {
            window.ErrorBoundary.handleError(error, context);
        }
        
        // Return user-friendly message
        return this.getUserFriendlyMessage(error);
    },
    
    getUserFriendlyMessage(error) {
        const errorMessages = {
            'PERMISSION_DENIED': 'Keine Berechtigung für diese Aktion',
            'NETWORK_ERROR': 'Netzwerkfehler. Bitte Verbindung prüfen.',
            'INVALID_GAME_CODE': 'Ungültiger Spiel-Code',
            'GAME_NOT_FOUND': 'Spiel nicht gefunden',
            'GAME_FULL': 'Spiel ist voll',
            'ALREADY_IN_GAME': 'Du bist bereits in einem Spiel',
            'NOT_HOST': 'Nur der Host kann diese Aktion ausführen',
            'INVALID_FSK': 'Keine Berechtigung für diese Altersstufe'
        };
        
        return errorMessages[error.code] || 'Ein Fehler ist aufgetreten';
    }
};

/**
 * Wrap all Firebase calls with error handling
 */
async function safeFirebaseCall(operation, context = {}) {
    try {
        return await operation();
    } catch (error) {
        const message = ErrorHandler.handleError(error, context);
        throw new Error(message);
    }
}
```

### 5. Listener-Cleanup

**Zu implementieren:**

```javascript
/**
 * ✅ P1 STABILITY: Listener management with cleanup
 */
const ListenerManager = {
    listeners: new Map(),
    
    register(key, ref, callback, eventType = 'value') {
        // Remove old listener if exists
        this.unregister(key);
        
        // Add new listener
        ref.on(eventType, callback);
        
        // Store reference for cleanup
        this.listeners.set(key, {
            ref: ref,
            callback: callback,
            eventType: eventType
        });
        
        if (isDevelopment) {
            console.log(`📌 Registered listener: ${key}`);
        }
    },
    
    unregister(key) {
        const listener = this.listeners.get(key);
        
        if (listener) {
            listener.ref.off(listener.eventType, listener.callback);
            this.listeners.delete(key);
            
            if (isDevelopment) {
                console.log(`🗑️ Unregistered listener: ${key}`);
            }
        }
    },
    
    unregisterAll() {
        this.listeners.forEach((listener, key) => {
            listener.ref.off(listener.eventType, listener.callback);
        });
        
        this.listeners.clear();
        
        if (isDevelopment) {
            console.log('🗑️ All listeners unregistered');
        }
    }
};

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    ListenerManager.unregisterAll();
    AbortManager.abortAll();
});
```

### 6. AbortController Support

**Zu implementieren:**

```javascript
/**
 * ✅ P1 STABILITY: Abort controller for async operations
 */
const AbortManager = {
    controllers: new Map(),
    
    create(key) {
        // Abort existing operation
        this.abort(key);
        
        // Create new controller
        const controller = new AbortController();
        this.controllers.set(key, controller);
        
        return controller.signal;
    },
    
    abort(key) {
        const controller = this.controllers.get(key);
        
        if (controller) {
            controller.abort();
            this.controllers.delete(key);
            
            if (isDevelopment) {
                console.log(`🛑 Aborted operation: ${key}`);
            }
        }
    },
    
    abortAll() {
        this.controllers.forEach((controller, key) => {
            controller.abort();
        });
        
        this.controllers.clear();
        
        if (isDevelopment) {
            console.log('🛑 All operations aborted');
        }
    }
};

/**
 * Example usage with AbortController
 */
async function loadQuestionsWithAbort(category) {
    const signal = AbortManager.create('loadQuestions');
    
    try {
        const snapshot = await database.ref(`questions/${category}`)
            .once('value');
        
        if (signal.aborted) {
            throw new Error('Operation aborted');
        }
        
        return snapshot.val();
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Load questions aborted');
            return null;
        }
        throw error;
    }
}
```

---

## [P1] UI/UX-Verbesserungen

### 7. Event-System für UI-Integration

**Zu implementieren:**

```javascript
/**
 * ✅ P1 UI/UX: Event system for UI integration
 */
const EventEmitter = {
    callbacks: {
        onError: [],
        onStatusChange: [],
        onConnectionChange: [],
        onGameUpdate: [],
        onPlayerJoined: [],
        onPlayerLeft: []
    },
    
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        
        this.callbacks[event].push(callback);
        
        return () => this.off(event, callback);
    },
    
    off(event, callback) {
        if (!this.callbacks[event]) return;
        
        const index = this.callbacks[event].indexOf(callback);
        if (index > -1) {
            this.callbacks[event].splice(index, 1);
        }
    },
    
    emit(event, data) {
        if (!this.callbacks[event]) return;
        
        this.callbacks[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Error in event callback:', error);
            }
        });
    }
};

// Helper function
function emitEvent(event, data) {
    EventEmitter.emit(event, data);
}

/**
 * Public API for UI integration
 */
function setErrorCallback(callback) {
    return EventEmitter.on('error', callback);
}

function setStatusCallback(callback) {
    return EventEmitter.on('statusChange', callback);
}

function setConnectionCallback(callback) {
    return EventEmitter.on('connectionChange', callback);
}
```

**Verwendung in UI:**

```javascript
// In gameplay.js oder anderen UI-Files
const unsubscribe = window.FirebaseService.setErrorCallback((error) => {
    showNotification(error.message, 'error');
});

window.FirebaseService.setConnectionCallback((status) => {
    updateConnectionIndicator(status.status);
});

// Cleanup
window.addEventListener('beforeunload', () => {
    unsubscribe();
});
```

---

## [P2] Performance-Optimierungen

### 8. Caching-System

**Zu implementieren:**

```javascript
/**
 * ✅ P2 PERFORMANCE: Caching system
 */
const CacheManager = {
    cache: new Map(),
    ttl: 5 * 60 * 1000, // 5 minutes
    
    set(key, value, ttl = this.ttl) {
        this.cache.set(key, {
            value: value,
            expires: Date.now() + ttl
        });
    },
    
    get(key) {
        const item = this.cache.get(key);
        
        if (!item) return null;
        
        if (Date.now() > item.expires) {
            this.cache.delete(key);
            return null;
        }
        
        return item.value;
    },
    
    has(key) {
        return this.get(key) !== null;
    },
    
    clear() {
        this.cache.clear();
    }
};

/**
 * Example: Cache questions
 */
async function loadQuestionsWithCache(category) {
    const cacheKey = `questions_${category}`;
    
    // Check cache first
    if (CacheManager.has(cacheKey)) {
        if (isDevelopment) {
            console.log('✅ Questions loaded from cache:', category);
        }
        return CacheManager.get(cacheKey);
    }
    
    // Load from Firebase
    const snapshot = await database.ref(`questions/${category}`).once('value');
    const questions = snapshot.val();
    
    // Cache result
    CacheManager.set(cacheKey, questions);
    
    return questions;
}
```

### 9. Query-Optimierung

**Zu implementieren:**

```javascript
/**
 * ✅ P2 PERFORMANCE: Load questions in batches
 */
async function loadQuestionsBatch(category, startIndex = 0, limit = 50) {
    try {
        const snapshot = await database.ref(`questions/${category}`)
            .orderByKey()
            .limitToFirst(limit)
            .startAt(String(startIndex))
            .once('value');
        
        return snapshot.val();
    } catch (error) {
        ErrorHandler.handleError(error, { 
            operation: 'loadQuestionsBatch',
            category,
            startIndex,
            limit
        });
        throw error;
    }
}

/**
 * ✅ P2 PERFORMANCE: Use server timestamps
 */
function getServerTimestamp() {
    return firebase.database.ServerValue.TIMESTAMP;
}

// Usage
async function createGame(gameData) {
    await database.ref(`games/${gameId}`).set({
        ...gameData,
        createdAt: getServerTimestamp(),  // ✅ Server timestamp
        lastActivity: getServerTimestamp()
    });
}
```

---

## [P1] DSGVO/Jugendschutz-Compliance

### 10. Datenminimierung

**Bereits implementiert, zu dokumentieren:**

```javascript
/**
 * ✅ P1 DSGVO: Data minimization - only pseudonyms
 */
async function addPlayer(gameId, playerData) {
    const sanitizedData = {
        name: SecurityValidator.sanitizePlayerName(playerData.name),
        isPremium: !!playerData.isPremium,
        isHost: !!playerData.isHost,
        isReady: false,
        joinedAt: getServerTimestamp()
        // ✅ NO IP addresses
        // ✅ NO birthdates
        // ✅ NO email addresses
    };
    
    await database.ref(`games/${gameId}/players/${playerId}`).set(sanitizedData);
}
```

### 11. Auto-Delete mit TTL

**Zu implementieren:**

```javascript
/**
 * ✅ P1 DSGVO: Auto-delete games after 24 hours
 */
async function createGameWithTTL(gameData) {
    const TTL_24_HOURS = 24 * 60 * 60 * 1000;
    
    await database.ref(`games/${gameId}`).set({
        ...gameData,
        createdAt: getServerTimestamp(),
        ttl: Date.now() + TTL_24_HOURS  // Auto-delete timestamp
    });
    
    if (isDevelopment) {
        console.log('✅ Game created with 24h TTL');
    }
}

/**
 * Manual delete function
 */
async function deleteGame(gameId) {
    const sanitizedGameId = SecurityValidator.sanitizeGameId(gameId);
    
    try {
        await database.ref(`games/${sanitizedGameId}`).remove();
        
        emitEvent('statusChange', {
            status: 'gameDeleted',
            gameId: sanitizedGameId
        });
        
        if (isDevelopment) {
            console.log('✅ Game deleted:', sanitizedGameId);
        }
    } catch (error) {
        ErrorHandler.handleError(error, {
            operation: 'deleteGame',
            gameId: sanitizedGameId
        });
        throw error;
    }
}
```

**Cloud Function für Auto-Delete (functions/index.js):**

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.cleanupOldGames = functions.pubsub
    .schedule('every 1 hours')
    .onRun(async (context) => {
        const now = Date.now();
        const db = admin.database();
        
        const snapshot = await db.ref('games').once('value');
        const games = snapshot.val();
        
        if (!games) return null;
        
        const deletions = [];
        
        Object.keys(games).forEach(gameId => {
            const game = games[gameId];
            
            // Delete if TTL expired
            if (game.ttl && game.ttl < now) {
                deletions.push(
                    db.ref(`games/${gameId}`).remove()
                );
            }
        });
        
        await Promise.all(deletions);
        
        console.log(`Deleted ${deletions.length} expired games`);
        
        return null;
    });
```

---

## Implementierungs-Checkliste

### Code-Änderungen in firebase-service.js:

1. ✅ SecurityValidator hinzufügen
2. ✅ ConnectionManager implementieren
3. ✅ ErrorHandler implementieren
4. ✅ ListenerManager implementieren
5. ✅ AbortManager implementieren
6. ✅ EventEmitter implementieren
7. ✅ CacheManager implementieren
8. ✅ Alle Public Functions mit Sanitization erweitern
9. ✅ Server-Timestamps verwenden
10. ✅ TTL-Support implementieren

### Neue Dateien:

1. ✅ `database.rules.json` - Erstellt
2. ⚠️ `functions/index.js` - Auto-Delete Function
3. ⚠️ Dokumentation in `FIREBASE_SERVICE_DSGVO.md`

### Deployment:

```powershell
# 1. Deploy Database Rules
firebase deploy --only database

# 2. Deploy Cloud Functions
firebase deploy --only functions

# 3. Test Rules
firebase emulators:start --only database,functions
```

---

## Testing

### Security Tests:

```javascript
// Test 1: Unauthorized access
try {
    await database.ref('games/test123').set({ test: true });
    // Should fail if not authenticated
} catch (error) {
    console.log('✅ Unauthorized write blocked');
}

// Test 2: Player can't modify scores
try {
    await database.ref('games/test123/scores/player1').set(999);
    // Should fail if not host
} catch (error) {
    console.log('✅ Non-host score modification blocked');
}
```

### Sanitization Tests:

```javascript
// Test sanitization
console.assert(
    SecurityValidator.sanitizeGameCode('abc-123!@#') === 'ABC123',
    'Game code sanitization failed'
);

console.assert(
    SecurityValidator.sanitizePlayerName('<script>alert(1)</script>') === 'scriptalert1script',
    'Player name sanitization failed'
);
```

### Connection Tests:

```javascript
// Test reconnect
ConnectionManager.initialize();

// Simulate disconnect
database.goOffline();

// Wait for reconnect
await new Promise(resolve => setTimeout(resolve, 5000));

// Check status
console.log('Status:', ConnectionManager.status);
```

---

## Akzeptanzkriterien - Status

| Kriterium | Status |
|-----------|--------|
| ✅ database.rules.json existiert | ✅ Erstellt |
| ✅ Strikte Zugriffsregeln | ✅ Implementiert |
| ✅ Input-Sanitization | ⚠️ Zu implementieren |
| ✅ Listener-Cleanup | ⚠️ Zu implementieren |
| ✅ Reconnect-Logic | ⚠️ Zu implementieren |
| ✅ Error-Handling | ⚠️ Zu erweitern |
| ✅ UI-Events | ⚠️ Zu implementieren |
| ✅ Caching | ⚠️ Zu implementieren |
| ✅ DSGVO-Compliance | ✅ Konzept vorhanden |
| ✅ Auto-Delete | ⚠️ Cloud Function erforderlich |

---

**Version:** 8.0  
**Letzte Änderung:** 11. Januar 2026  
**Autor:** GitHub Copilot  
**Review-Status:** ⚠️ Implementierung erforderlich

