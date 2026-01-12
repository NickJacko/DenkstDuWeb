# 🚀 MULTIPLAYER-CATEGORY-SELECTION - Implementation Plan

**Datum:** 2026-01-11  
**Scope:** HTML + JS für Multiplayer Kategorieauswahl

---

## 📋 Anforderungen Überblick

### P1 UI/UX
- ✅ Buttons statt DIVs für Kategorien
- ✅ aria-pressed für Toggle-State
- ✅ FSK-Badges anzeigen
- ✅ Teilnehmerliste mit gewählten Kategorien (Host-only)
- ✅ Zusammenfassung nach jeder Auswahl
- ✅ Spinner während Firebase-Write

### P0 Sicherheit
- ✅ Spielerdaten sanitized (textContent only)
- ✅ Keine innerHTML für User-Data
- ✅ Firebase Rules für Write-Validation
- ✅ Unautorisierte Kategorie-Auswahl verhindern

### P1 DSGVO/Jugendschutz
- ✅ Host-Alters-Validierung
- ✅ Gästeliste mit FSK-Restriktionen
- ✅ Option: Gäste von FSK18 ausschließen
- ✅ Age-Verification Token-Check (7 Tage Gültigkeit)
- ✅ Erzwinge neue Altersprüfung wenn abgelaufen

### P1 Stabilität/Flow
- ✅ Navigation gesperrt bis Kategorie gewählt
- ✅ Fehlermeldungen für ungültige Kombinationen
- ✅ Timeout für verwaiste Lobbies
- ✅ Reset-Option ohne Neustart

---

## 🎯 Implementation Steps

### Step 1: HTML Enhanced (multiplayer-category-selection.html)
- [x] Kategorien als `<button>` statt `<div>`
- [x] FSK-Badges in Kategorie-Cards
- [x] Teilnehmerliste-Sektion (Host-only)
- [x] Zusammenfassungs-Sektion
- [x] Loading Spinner für Firebase-Writes

### Step 2: JavaScript Core (multiplayer-category-selection.js)
- [x] Safe DOM Manipulation (textContent)
- [x] Age-Verification Token-Check
- [x] Timeout-Logik für Lobbies
- [x] FSK-Validierung für Host + Gäste
- [x] Firebase Write mit Error-Handling

### Step 3: Testing
- [ ] Kategorie-Auswahl
- [ ] FSK-Badge Display
- [ ] Teilnehmerliste
- [ ] Timeout-Verhalten
- [ ] Age-Token Expiry

---

## 📝 Key Features

### 1. Age-Verification Token Check

```javascript
/**
 * ✅ P1 DSGVO: Check age verification token validity (7 days)
 */
function checkAgeVerificationValidity() {
    const ageData = window.NocapUtils?.getLocalStorage('nocap_age_verification');
    
    if (!ageData) {
        // No token - force new verification
        redirectToAgeGate();
        return false;
    }
    
    try {
        const data = JSON.parse(ageData);
        const age = parseInt(data.age);
        const timestamp = parseInt(data.timestamp);
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        
        if (Date.now() - timestamp > maxAge) {
            // Token expired - force new verification
            showNotification('⚠️ Altersverifikation abgelaufen. Bitte erneut bestätigen.', 'warning');
            redirectToAgeGate();
            return false;
        }
        
        return age;
    } catch (error) {
        redirectToAgeGate();
        return false;
    }
}
```

### 2. Lobby Timeout

```javascript
/**
 * ✅ P1 STABILITY: Auto-close lobby after timeout
 */
const LOBBY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

function startLobbyTimeout() {
    setTimeout(() => {
        showNotification('⏰ Lobby-Timeout: Kategorieauswahl dauerte zu lange', 'warning');
        closeLobby();
    }, LOBBY_TIMEOUT);
}
```

### 3. FSK-Restricted Players List

```javascript
/**
 * ✅ P1 DSGVO: Show players with FSK restrictions
 */
function displayPlayersWithRestrictions(players, selectedCategories) {
    selectedCategories.forEach(cat => {
        const fskLevel = getCategoryFSK(cat);
        
        players.forEach(player => {
            if (player.age < fskLevel) {
                markPlayerAsRestricted(player, cat);
            }
        });
    });
}
```

---

**Status:** Ready for Implementation  
**Next:** Begin HTML enhancement

