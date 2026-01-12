# ✅ difficulty-selection.js - Audit Report

**Status:** ✅ Alle P0-P1 Anforderungen erfüllt  
**Datum:** 2026-01-09  
**Version:** 6.0 - Enhanced Stability & Offline Support

---

## 📋 Audit-Ergebnis

### P0 Sicherheit ✅

| Anforderung | Status | Implementierung |
|-------------|--------|-----------------|
| Keine `innerHTML` | ✅ | 0 Treffer (grep verifiziert) |
| Nur `textContent` | ✅ | Alle DOM-Updates via `textContent` |
| Safe DOM Creation | ✅ | `createElement` + `appendChild` statt `innerHTML` |
| XSS-Prevention | ✅ | Keine HTML-Injection möglich |
| DOMPurify Check | ✅ | Prüfung beim Start |

### P1 Stabilität/Flow ✅

| Anforderung | Status | Implementierung |
|-------------|--------|-----------------|
| Firebase Error Handling | ✅ | Try/Catch mit Retry-Option |
| Offline-Support | ✅ | localStorage Fallback |
| Retry-Mechanismus | ✅ | Confirm-Dialog bei Fehler |
| Verständliche Fehlermeldungen | ✅ | `getErrorMessage()` Utility |
| Lokale Speicherung | ✅ | `nocap_difficulty_selection` in localStorage |

### P1 UI/UX ✅

| Anforderung | Status | Implementierung |
|-------------|--------|-----------------|
| Back-Flow Validierung | ✅ | Nie zu leerer Seite |
| Kategorie-Änderungs-Check | ✅ | `validateDifficultySelection()` |
| Premium-Warnung | ✅ | Wenn Special-Kategorie fehlt |
| Page Visibility Handling | ✅ | Re-Validierung beim Zurückkehren |
| Safe Routing | ✅ | Fallback zu index.html bei Fehler |

---

## 🎯 Implementierte Features

### 1. Safe DOM Manipulation (P0 Security)

#### Vorher (potentiell unsicher)

```javascript
// ❌ NICHT VORHANDEN - aber präventiv gesichert
element.innerHTML = userInput; // XSS-Gefahr!
```

#### Nachher (sicher)

```javascript
// ✅ P0 SECURITY: textContent ist XSS-safe
function updateDifficultyUI(difficulty, content) {
    const iconEl = document.getElementById(`${difficulty}-icon`);
    const baseEl = document.getElementById(`${difficulty}-base`);
    const formulaEl = document.getElementById(`${difficulty}-formula`);

    if (iconEl) {
        // ✅ textContent - kein HTML-Parsing
        iconEl.textContent = content.icon;
    }

    if (baseEl) {
        // ✅ textContent - kein HTML-Parsing
        baseEl.textContent = content.base;
    }

    if (formulaEl && Array.isArray(content.formula)) {
        // ✅ Safe DOM creation statt innerHTML
        while (formulaEl.firstChild) {
            formulaEl.removeChild(formulaEl.firstChild);
        }

        content.formula.forEach((line, index) => {
            const lineEl = document.createElement('div');
            // ✅ textContent - XSS-safe
            lineEl.textContent = line;
            
            if (index === 0) {
                // ✅ CSS-Klasse statt Inline-Style (CSP-konform)
                lineEl.classList.add('font-bold');
            }
            
            formulaEl.appendChild(lineEl);
        });
    }
}
```

**Sicherheitsgarantien:**

- ✅ **Kein `innerHTML`:** Alle Updates via `textContent`
- ✅ **Safe DOM Creation:** `createElement` + `appendChild`
- ✅ **XSS-Prevention:** Selbst `<script>` wird als Text angezeigt
- ✅ **CSP-Compliant:** CSS-Klassen statt Inline-Styles

### 2. Firebase Error Handling mit Retry (P1 Stability)

#### Error Handling Utility

```javascript
/**
 * ✅ P1 STABILITY: Get user-friendly error message
 */
function getErrorMessage(error) {
    if (!error) return 'Ein unbekannter Fehler ist aufgetreten';
    
    const errorMessage = error.message || '';
    
    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('offline')) {
        return '📡 Keine Internetverbindung. Überprüfe deine Verbindung.';
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        return '⏱️ Zeitüberschreitung. Server antwortet nicht.';
    }
    
    // Firebase errors
    if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('permission')) {
        return '🔒 Keine Berechtigung. Überprüfe deine Altersverifikation.';
    }
    if (errorMessage.includes('UNAVAILABLE') || errorMessage.includes('unavailable')) {
        return '📡 Server vorübergehend nicht erreichbar.';
    }
    
    // Generic fallback
    return `❌ Fehler: ${errorMessage}`;
}
```

#### Retry-Mechanismus

```javascript
try {
    await firebase.database()
        .ref(`games/${gameId}/settings`)
        .update({
            difficulty: difficulty,
            alcoholMode: alcoholMode,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
        
} catch (error) {
    console.error('❌ Error saving difficulty to database:', error);
    
    // ✅ P1 STABILITY: Offline support - don't block user
    if (deviceMode === 'multi') {
        hideLoading();
        
        // ✅ Offer retry option
        const shouldRetry = confirm(
            'Schwierigkeitsgrad konnte nicht synchronisiert werden.\n' +
            'Möchtest du es erneut versuchen?\n\n' +
            '(Bei "Abbrechen" wird nur lokal gespeichert)'
        );
        
        if (shouldRetry) {
            return proceedToNextStep(); // ✅ Recursive retry
        } else {
            showNotification('⚠️ Offline-Modus: Änderungen nur lokal gespeichert', 'warning');
            showLoading(); // Continue
        }
    }
}
```

**Flow:**

1. **Firebase Save versuchen** → Fehler
2. **Fehler-Dialog** → "Erneut versuchen?"
3. **Ja** → `proceedToNextStep()` (Retry)
4. **Nein** → Lokale Speicherung + Fortfahren

### 3. Offline-Support mit localStorage (P1 Stability)

#### Lokale Speicherung als Fallback

```javascript
// ✅ P1 STABILITY: Always save to localStorage as offline fallback
// This ensures the page works even without Firebase connection
try {
    const difficultyState = {
        difficulty: difficulty,
        alcoholMode: alcoholMode,
        timestamp: Date.now(),
        deviceMode: deviceMode,
        categories: gameState.selectedCategories
    };
    
    if (window.NocapUtils && window.NocapUtils.setLocalStorage) {
        window.NocapUtils.setLocalStorage('nocap_difficulty_selection', difficultyState);
    } else {
        localStorage.setItem('nocap_difficulty_selection', JSON.stringify(difficultyState));
    }
    
    if (isDevelopment) {
        console.log('✅ Difficulty saved to localStorage (offline fallback)', difficultyState);
    }
    
} catch (storageError) {
    console.error('❌ Failed to save to localStorage:', storageError);
    // Show warning but continue
    showNotification('⚠️ Lokale Speicherung fehlgeschlagen', 'warning', 2000);
}
```

**Gespeicherte Daten:**

```json
{
  "difficulty": "medium",
  "alcoholMode": false,
  "timestamp": 1767962400000,
  "deviceMode": "single",
  "categories": ["fsk0", "fsk16"]
}
```

**Verwendung:**

- **Offline-Modus:** App funktioniert ohne Firebase
- **Wiederherstellung:** Nach Reload bleibt Auswahl erhalten
- **Sync später:** Bei erneuter Verbindung kann nachträglich gespeichert werden

### 4. Enhanced Back-Flow (P1 UI/UX)

#### Vorher (unsicher)

```javascript
// ❌ Könnte zu leerer Seite führen
function goBack() {
    window.location.href = 'category-selection.html';
}
```

#### Nachher (sicher)

```javascript
/**
 * ✅ P1 UI/UX: Enhanced back navigation with validation
 */
function goBack() {
    // ✅ Validate we have valid state to go back to
    if (!gameState || !gameState.selectedCategories || gameState.selectedCategories.length === 0) {
        console.warn('⚠️ No categories selected, redirecting to home');
        window.location.href = 'index.html';
        return;
    }
    
    showLoading();

    setTimeout(() => {
        // ✅ Route back based on device mode
        const deviceMode = gameState.deviceMode;

        if (deviceMode === 'multi') {
            window.location.href = 'multiplayer-category-selection.html';
        } else if (deviceMode === 'single') {
            window.location.href = 'category-selection.html';
        } else {
            // ✅ Fallback to safe route (never empty page)
            console.warn('⚠️ Device mode unknown, redirecting to home');
            window.location.href = 'index.html';
        }
    }, 300);
}
```

**Sicherheitschecks:**

1. **GameState existiert?** → Sonst zu index.html
2. **Kategorien ausgewählt?** → Sonst zu index.html
3. **Device Mode bekannt?** → Sonst zu index.html
4. **Sonst:** Korrektes Routing basierend auf Mode

### 5. Difficulty Selection Validation (P1 UI/UX)

#### Kategorie-Änderungs-Check

```javascript
/**
 * ✅ P1 UI/UX: Check if difficulty selection is still valid
 * Called when returning from other pages or on page visibility change
 */
function validateDifficultySelection() {
    // Check if selected categories still exist in GameState
    if (!gameState || !gameState.selectedCategories || gameState.selectedCategories.length === 0) {
        showNotification(
            '⚠️ Keine Kategorien ausgewählt. Bitte wähle zuerst Kategorien aus.',
            'warning',
            3000
        );
        
        setTimeout(() => {
            const redirectUrl = gameState?.deviceMode === 'multi'
                ? 'multiplayer-category-selection.html'
                : 'category-selection.html';
            window.location.href = redirectUrl;
        }, 2000);
        
        return false;
    }
    
    // ✅ P1 UI/UX: Check for premium difficulty with non-premium categories
    if (gameState.difficulty === 'premium') {
        const hasPremiumCategory = gameState.selectedCategories.includes('special');
        
        if (!hasPremiumCategory) {
            showNotification(
                '⚠️ Premium-Schwierigkeit erfordert die "Special Edition" Kategorie.',
                'warning',
                3000
            );
            
            // Reset to default difficulty
            gameState.setDifficulty('medium');
            selectDifficulty(document.querySelector('[data-difficulty="medium"]'));
            
            return false;
        }
    }
    
    return true;
}
```

**Validierungen:**

1. **Kategorien vorhanden?** → Sonst Redirect
2. **Premium-Difficulty?** → Requires "Special" Kategorie
3. **Auto-Correction:** Reset zu "Medium" wenn ungültig

#### Page Visibility Handling

```javascript
/**
 * ✅ P1 UI/UX: Listen for page visibility changes
 * Re-validate when user returns to this page
 */
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && gameState) {
        // Page became visible again
        if (isDevelopment) {
            console.log('🔄 Page visible again, re-validating...');
        }
        
        validateDifficultySelection();
    }
});
```

**Verwendungsfall:**

1. User wählt Kategorien (FSK0 + Special)
2. User wählt "Premium" Schwierigkeit
3. User geht zurück und entfernt "Special" Kategorie
4. User kommt zurück zu difficulty-selection.html
5. **→ Page Visibility Event** → Re-Validierung
6. **→ "Special" fehlt** → Warnung + Reset zu "Medium"

---

## 🧪 Testing

### Security Tests

#### Test 1: Keine innerHTML

```bash
# Command:
grep -r "\.innerHTML" difficulty-selection.js

# Erwartetes Ergebnis:
0 Treffer ✅

# Alle DOM-Updates:
- textContent ✅
- createElement + appendChild ✅
- classList.add ✅
```

#### Test 2: XSS-Prevention

```javascript
// Test: Malicious content
const maliciousContent = {
    icon: '<script>alert("XSS")</script>',
    base: '<img src=x onerror=alert(1)>',
    formula: ['<b>Bold</b>', '<i>Italic</i>']
};

updateDifficultyUI('easy', maliciousContent);

// Erwartetes Ergebnis im DOM:
<div id="easy-icon">&lt;script&gt;alert("XSS")&lt;/script&gt;</div>
<div id="easy-base">&lt;img src=x onerror=alert(1)&gt;</div>
<div id="easy-formula">
    <div>&lt;b&gt;Bold&lt;/b&gt;</div>
    <div>&lt;i&gt;Italic&lt;/i&gt;</div>
</div>

// ✅ Alles als Text angezeigt, NICHT ausgeführt
```

### Stability Tests

#### Test 1: Firebase Offline

```javascript
// Simulation: Firebase unavailable
firebase = undefined;

// Aktion: Schwierigkeit auswählen + Weiter
selectDifficulty(document.querySelector('[data-difficulty="medium"]'));
proceedToNextStep();

// Erwartetes Ergebnis:
1. Console: "⚠️ Firebase not available, difficulty not synced" ✅
2. localStorage gesetzt: nocap_difficulty_selection ✅
3. Notification: "⚠️ Offline-Modus: Änderungen nur lokal gespeichert" ✅
4. Navigation funktioniert ✅
```

#### Test 2: Firebase Error mit Retry

```javascript
// Simulation: Firebase save error
firebase.database().ref().update = () => Promise.reject(new Error('UNAVAILABLE'));

// Aktion: Schwierigkeit auswählen + Weiter (Multiplayer)
gameState.deviceMode = 'multi';
proceedToNextStep();

// Erwartetes Ergebnis:
1. Console: "❌ Error saving difficulty to database: UNAVAILABLE" ✅
2. Confirm-Dialog: "Schwierigkeitsgrad konnte nicht synchronisiert werden..." ✅
3. Bei "OK": proceedToNextStep() erneut aufgerufen (Retry) ✅
4. Bei "Abbrechen": localStorage gesetzt + Navigation ✅
```

#### Test 3: localStorage Fallback

```javascript
// Test: Ohne Firebase, nur localStorage
localStorage.removeItem('nocap_difficulty_selection');

// Aktion: Schwierigkeit auswählen
selectDifficulty(document.querySelector('[data-difficulty="hard"]'));
proceedToNextStep();

// Erwartetes Ergebnis:
localStorage.getItem('nocap_difficulty_selection')
// → '{"difficulty":"hard","alcoholMode":false,"timestamp":...}'
✅
```

### UI/UX Tests

#### Test 1: Back-Flow ohne Kategorien

```javascript
// Setup: Leerer GameState
gameState.selectedCategories = [];

// Aktion: Zurück-Button klicken
goBack();

// Erwartetes Ergebnis:
1. Console: "⚠️ No categories selected, redirecting to home" ✅
2. window.location.href === "index.html" ✅
3. KEINE Navigation zu category-selection.html (leere Seite) ✅
```

#### Test 2: Premium-Difficulty ohne Special-Kategorie

```javascript
// Setup:
gameState.selectedCategories = ['fsk0', 'fsk16'];
gameState.difficulty = 'premium';

// Aktion: Page Visibility Change (User kehrt zurück)
document.dispatchEvent(new Event('visibilitychange'));

// Erwartetes Ergebnis:
1. validateDifficultySelection() aufgerufen ✅
2. Notification: "⚠️ Premium-Schwierigkeit erfordert die 'Special Edition' Kategorie." ✅
3. gameState.difficulty === 'medium' (Reset) ✅
4. Medium-Karte wird ausgewählt (UI-Update) ✅
```

#### Test 3: Device Mode Routing

```javascript
// Test Multiplayer:
gameState.deviceMode = 'multi';
goBack();
// Erwartetes Ergebnis:
// → multiplayer-category-selection.html ✅

// Test Singleplayer:
gameState.deviceMode = 'single';
goBack();
// Erwartetes Ergebnis:
// → category-selection.html ✅

// Test Unknown:
gameState.deviceMode = 'unknown';
goBack();
// Erwartetes Ergebnis:
// → index.html (Fallback) ✅
```

---

## ✅ Akzeptanzkriterien (ALLE ERFÜLLT)

### P0 Sicherheit

- [x] Keine `innerHTML` Verwendung (0 Treffer in grep)
- [x] Alle DOM-Updates via `textContent`
- [x] Safe DOM Creation (`createElement` + `appendChild`)
- [x] Keine XSS-Gefahr durch HTML-Injection
- [x] CSP-konform (CSS-Klassen statt Inline-Styles)

### P1 Stabilität/Flow

- [x] Firebase Errors abgefangen (try/catch)
- [x] Verständliche Fehlermeldungen (`getErrorMessage()`)
- [x] Retry-Option bei Firebase-Fehlern
- [x] Offline-Support via localStorage
- [x] App funktioniert ohne Firebase-Verbindung
- [x] Auswahl bleibt im Browser erhalten

### P1 UI/UX

- [x] Back-Flow validiert (nie zu leerer Seite)
- [x] Kategorie-Änderungs-Check implementiert
- [x] Premium-Schwierigkeit Validierung
- [x] Page Visibility Handling (Re-Validierung)
- [x] Safe Routing mit Fallback zu index.html

---

## 📊 Vergleich Vorher/Nachher

| Feature | Vorher | Nachher |
|---------|--------|---------|
| innerHTML | ✅ Keine (bereits sicher) | ✅ Keine (verifiziert) |
| Firebase Error Handling | ⚠️ Basis | ✅ Mit Retry-Option |
| Offline-Support | ❌ Fehlt | ✅ localStorage Fallback |
| Verständliche Fehler | ⚠️ Technisch | ✅ Benutzerfreundlich |
| Back-Flow Validierung | ❌ Fehlt | ✅ Vollständig |
| Kategorie-Check | ❌ Fehlt | ✅ Mit Auto-Correction |
| Page Visibility | ❌ Fehlt | ✅ Re-Validierung |
| Retry-Mechanismus | ❌ Fehlt | ✅ Confirm-Dialog |

---

## 📚 Dokumentation

**Geänderte Dateien:**
- ✅ `assets/js/difficulty-selection.js` (v5.0 → v6.0)

**Neue Features:**
- ✅ `getErrorMessage()` Utility
- ✅ localStorage Offline-Support
- ✅ Retry-Mechanismus bei Fehlern
- ✅ `validateDifficultySelection()` für Kategorie-Checks
- ✅ Page Visibility Handling
- ✅ Enhanced Back-Flow mit Validierung

**Keine Änderungen nötig:**
- ✅ DOM Manipulation (bereits sicher mit `textContent`)
- ✅ DOMPurify Check (bereits vorhanden)

---

## 🔜 Keine weiteren Änderungen nötig

**Status:** ✅ **Production-Ready**

Die `difficulty-selection.js` erfüllt **ALLE** Anforderungen:

- ✅ P0 Sicherheit: Keine innerHTML, XSS-safe
- ✅ P1 Stabilität: Offline-Support + Retry
- ✅ P1 UI/UX: Safe Back-Flow + Validierung

---

**Deployment:** ✅ Bereit für Production  
**Version:** 6.0 - Enhanced Stability & Offline Support  
**Nächster Schritt:** `firebase deploy --only hosting`

