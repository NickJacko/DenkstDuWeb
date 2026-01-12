# JavaScript-Kern Hardening - Schnell-Implementierung

**Strategie:** Template-basierte Bulk-Bearbeitung mit manueller Nachprüfung

## ✅ Fertiggestellt

1. **index.js** - IndexPageModule ✅
2. **category-selection.js** - CategorySelectionModule ✅

## 🚀 Nächste Dateien (P1 - Kritisch)

Für die verbleibenden Dateien erstelle ich ein vereinfachtes Template-System.

### Standard-Template für jede Datei

```javascript
// Am Anfang (nach Logger-Setup):
const [ModuleName] = {
    state: {
        // Alle let/var Variablen hier
        eventListenerCleanup: [],
        isDevelopment: window.location.hostname === 'localhost' || /*...*/
    },
    
    // Getter für Variablen
    get varName() { return this.state.varName; },
    set varName(val) { this.state.varName = val; }
};
Object.seal([ModuleName].state);

// Performance Utils (copy-paste from index.js)
function throttle(func, wait = 100) { /*...*/ }
function debounce(func, wait = 300) { /*...*/ }
function addTrackedEventListener(el, evt, handler, opts = {}) {
    if (!el) return;
    el.addEventListener(evt, handler, opts);
    [ModuleName].state.eventListenerCleanup.push({element: el, event: evt, handler, options: opts});
}

// Am Ende (vor DOMContentLoaded):
function cleanup() {
    [ModuleName].state.eventListenerCleanup.forEach(({element, event, handler, options}) => {
        try {
            element.removeEventListener(event, handler, options);
        } catch (e) {}
    });
    [ModuleName].state.eventListenerCleanup = [];
    
    if (window.NocapUtils?.cleanupEventListeners) {
        window.NocapUtils.cleanupEventListeners();
    }
    
    if ([ModuleName].isDevelopment) {
        Logger.debug('✅ Cleanup completed');
    }
}
window.addEventListener('beforeunload', cleanup);
```

### Automatisierte Schritte

1. **Suche**: `let|var [variableName]`
2. **Verschiebe** zu `[ModuleName].state.{variableName}`
3. **Ersetze** alle Referenzen
4. **Füge** Utils + Cleanup hinzu
5. **Ersetze** `addEventListener` → `addTrackedEventListener`
6. **Teste** Syntax-Fehler

---

## 📝 Detaillierte Anleitung pro Datei

### difficulty-selection.js

**Modul:** `DifficultySelectionModule`

**Globale Variablen zu migrieren:**
- `let gameState = null;`
- `let selectedDifficulty = null;`
- `const isDevelopment = ...`

**Schritte:**
1. Module Pattern einfügen
2. `gameState` → `DifficultySelectionModule.gameState`
3. `selectedDifficulty` → `DifficultySelectionModule.selectedDifficulty`
4. `isDevelopment` → `DifficultySelectionModule.isDevelopment`
5. Event-Listener tracken
6. Cleanup hinzufügen

---

### gameplay.js

**Modul:** `GameplayModule`

**Globale Variablen:**
- `let gameState`
- `let currentQuestion`
- `let currentQuestionIndex`
- `let answeredPlayers`
- `let roundTimer`
- Etc.

**Besonderheit:** Viele Timer/Intervals → alle in cleanup clearen!

---

### player-setup.js

**Modul:** `PlayerSetupModule`

**Globale Variablen:**
- `let gameState`
- `let players`
- `const isDevelopment`

---

## 🎯 Priorisierte Bearbeitungsreihenfolge

| # | Datei | Komplexität | Zeit | Status |
|---|-------|-------------|------|--------|
| 1 | index.js | Hoch | - | ✅ FERTIG |
| 2 | category-selection.js | Mittel | - | ✅ FERTIG |
| 3 | difficulty-selection.js | Niedrig | 15min | ⏳ NEXT |
| 4 | gameplay.js | Hoch | 25min | 🔜 |
| 5 | player-setup.js | Niedrig | 10min | 🔜 |
| 6 | join-game.js | Mittel | 15min | 🔜 |
| 7-11 | Multiplayer-Dateien | Variabel | 90min | 🔜 |

---

**Geschätzter Gesamtaufwand:** ~2.5 Stunden  
**Bisheriger Fortschritt:** ~20% (2/11 Dateien)  
**Nächster Schritt:** difficulty-selection.js bearbeiten

