# Client-Integration Guide - Firebase Cloud Functions

## 🚀 Schnelle Integration

### 1. FSK-Validierung (Jugendschutz)

**Vor dem Laden von FSK16/18 Inhalten:**

```javascript
// In category-selection.js oder wo FSK-Content geladen wird

async function validateFSKAccess(category) {
    try {
        // Server-seitige Validierung aufrufen
        const validateFSK = firebase.functions().httpsCallable('validateFSKAccess');
        const result = await validateFSK({ category: category });
        
        if (result.data.allowed) {
            console.log('✅ FSK Access granted:', category);
            return true;
        } else {
            console.warn('❌ FSK Access denied:', result.data.message);
            showError(result.data.message);
            return false;
        }
        
    } catch (error) {
        console.error('FSK validation error:', error);
        showError('Fehler bei der Altersverifikation');
        return false;
    }
}

// Nutzung
async function loadCategory(categoryId) {
    // Hole Category Info
    const categoryRef = await db.ref(`categories/${categoryId}`).once('value');
    const category = categoryRef.val();
    
    // Prüfe FSK vor dem Laden
    if (category.fskLevel && category.fskLevel !== 'fsk0') {
        const allowed = await validateFSKAccess(category.fskLevel);
        if (!allowed) {
            // Zeige Alternative oder Fehler
            showFSKError(category.fskLevel);
            return;
        }
    }
    
    // Lade Category Content
    loadCategoryContent(category);
}
```

---

### 2. Altersverifikation einstellen

**In User Settings / Profil:**

```javascript
async function setUserAge(birthdate) {
    try {
        // Berechne Alter
        const age = calculateAge(birthdate);
        
        // Setze Altersverifikation
        const setAge = firebase.functions().httpsCallable('setAgeVerification');
        const result = await setAge({ 
            ageLevel: age,
            verificationMethod: 'birthdate-self-declaration'
        });
        
        console.log('✅ Age verified:', result.data);
        console.log('FSK Access:', result.data.fskAccess);
        // { fsk0: true, fsk16: true, fsk18: false } - Beispiel für 17-jährigen
        
        // Update UI
        updateFSKBadges(result.data.fskAccess);
        
        // Force Token Refresh (wichtig für Custom Claims!)
        await firebase.auth().currentUser.getIdToken(true);
        
        showSuccess('Altersverifikation erfolgreich!');
        
    } catch (error) {
        console.error('Age verification error:', error);
        showError('Fehler bei der Altersverifikation');
    }
}

function calculateAge(birthdate) {
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    
    return age;
}
```

---

### 3. Daten exportieren (DSGVO)

**In User Settings / Datenschutz:**

```html
<button onclick="exportMyData()">
    📥 Meine Daten exportieren
</button>
```

```javascript
async function exportMyData() {
    try {
        showLoading('Exportiere Daten...');
        
        const exportData = firebase.functions().httpsCallable('exportUserData');
        const result = await exportData();
        
        console.log('Export completed:', result.data);
        
        // Download als JSON
        const dataStr = JSON.stringify(result.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `denkstduweb-daten-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        hideLoading();
        showSuccess('✅ Daten erfolgreich exportiert!');
        
    } catch (error) {
        console.error('Export error:', error);
        hideLoading();
        showError('Fehler beim Datenexport');
    }
}
```

---

### 4. Account löschen (DSGVO)

**In User Settings / Account:**

```html
<button onclick="showDeleteAccountDialog()" class="btn-danger">
    🗑️ Account löschen
</button>
```

```javascript
async function showDeleteAccountDialog() {
    const confirmed = confirm(
        '⚠️ WARNUNG: Dies löscht Ihren Account und alle Daten unwiderruflich!\n\n' +
        'Möchten Sie fortfahren?'
    );
    
    if (!confirmed) return;
    
    const doubleConfirm = prompt(
        'Bitte geben Sie zur Bestätigung "LÖSCHEN" ein:'
    );
    
    if (doubleConfirm !== 'LÖSCHEN') {
        showError('Löschung abgebrochen');
        return;
    }
    
    await deleteMyAccount();
}

async function deleteMyAccount() {
    try {
        showLoading('Lösche Account...');
        
        const deleteAccount = firebase.functions().httpsCallable('deleteMyAccount');
        const result = await deleteAccount({ 
            confirmation: 'DELETE_MY_ACCOUNT' 
        });
        
        console.log('✅ Account deleted:', result.data);
        
        hideLoading();
        
        // Zeige Bestätigung
        alert('✅ ' + result.data.message);
        
        // Logout (wird automatisch ausgeführt, da User gelöscht wurde)
        window.location.href = '/index.html';
        
    } catch (error) {
        console.error('Account deletion error:', error);
        hideLoading();
        
        if (error.code === 'failed-precondition') {
            showError('Bestätigung fehlgeschlagen');
        } else {
            showError('Fehler beim Löschen des Accounts');
        }
    }
}
```

---

### 5. Fehlerbehandlung Best Practices

```javascript
function handleFunctionError(error) {
    console.error('Cloud Function Error:', error);
    
    const errorMessages = {
        'unauthenticated': 'Bitte melden Sie sich an.',
        'permission-denied': 'Keine Berechtigung für diese Aktion.',
        'invalid-argument': 'Ungültige Eingabe.',
        'failed-precondition': 'Vorbedingung nicht erfüllt.',
        'resource-exhausted': 'Zu viele Anfragen. Bitte warten Sie.',
        'internal': 'Serverfehler. Bitte versuchen Sie es später erneut.'
    };
    
    const message = errorMessages[error.code] || 'Ein Fehler ist aufgetreten.';
    showError(message);
    
    return message;
}

// Nutzung
try {
    const result = await someFunction();
} catch (error) {
    handleFunctionError(error);
}
```

---

## 🎨 UI/UX Empfehlungen

### FSK-Status Badge

```html
<div class="user-profile">
    <span class="fsk-badge fsk-0">FSK 0</span>
    <span class="fsk-badge fsk-16" id="fsk16-badge" style="display:none;">FSK 16</span>
    <span class="fsk-badge fsk-18" id="fsk18-badge" style="display:none;">FSK 18</span>
</div>
```

```css
.fsk-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    margin: 0 4px;
}

.fsk-badge.fsk-0 { background: #4caf50; color: white; }
.fsk-badge.fsk-16 { background: #ff9800; color: white; }
.fsk-badge.fsk-18 { background: #f44336; color: white; }
```

```javascript
function updateFSKBadges(fskAccess) {
    document.getElementById('fsk16-badge').style.display = 
        fskAccess.fsk16 ? 'inline-block' : 'none';
    document.getElementById('fsk18-badge').style.display = 
        fskAccess.fsk18 ? 'inline-block' : 'none';
}
```

---

### FSK-Warnung Modal

```html
<div id="fsk-warning-modal" class="modal" style="display:none;">
    <div class="modal-content">
        <h2>⚠️ Altersbeschränkung</h2>
        <p id="fsk-message"></p>
        <button onclick="closeFSKModal()">Verstanden</button>
        <button onclick="goToAgeVerification()">Alter verifizieren</button>
    </div>
</div>
```

```javascript
function showFSKError(fskLevel) {
    const messages = {
        'fsk16': 'Dieser Inhalt ist ab 16 Jahren freigegeben.',
        'fsk18': 'Dieser Inhalt ist ab 18 Jahren freigegeben.'
    };
    
    document.getElementById('fsk-message').textContent = messages[fskLevel];
    document.getElementById('fsk-warning-modal').style.display = 'block';
}

function closeFSKModal() {
    document.getElementById('fsk-warning-modal').style.display = 'none';
}

function goToAgeVerification() {
    window.location.href = '/settings.html#age-verification';
}
```

---

## 🔒 Sicherheits-Checkliste für Client

- [ ] **FSK-Validierung VOR Content-Laden**
  ```javascript
  const allowed = await validateFSKAccess(category);
  if (!allowed) return;
  ```

- [ ] **Token Refresh nach Age Verification**
  ```javascript
  await firebase.auth().currentUser.getIdToken(true);
  ```

- [ ] **Fehlerbehandlung für alle Calls**
  ```javascript
  try { ... } catch (error) { handleFunctionError(error); }
  ```

- [ ] **Loading States zeigen**
  ```javascript
  showLoading('Validiere...');
  // ... operation
  hideLoading();
  ```

- [ ] **User Feedback bei Erfolg/Fehler**
  ```javascript
  showSuccess('✅ Erfolgreich!');
  showError('❌ Fehler!');
  ```

---

## 📱 Responsive Design Tipps

```javascript
// Mobile: Kompakte Fehlermeldungen
function showError(message) {
    if (window.innerWidth < 768) {
        // Toast notification
        showToast(message, 'error');
    } else {
        // Modal
        showModal(message, 'error');
    }
}

// Loading Spinner
function showLoading(message) {
    const loader = document.getElementById('global-loader');
    loader.querySelector('.message').textContent = message;
    loader.style.display = 'flex';
}
```

---

## 🚨 Wichtige Hinweise

1. **Niemals FSK-Checks nur client-seitig!**
   - Immer `validateFSKAccess()` aufrufen
   - Client-seitige Checks sind nur UI-Hints

2. **Token Refresh nach Age Verification**
   - Custom Claims brauchen Token-Refresh
   - `getIdToken(true)` erzwingt Refresh

3. **Rate Limiting beachten**
   - Max. 60 Requests/Minute
   - Bei Überschreitung: 429 Error
   - Retry nach Wartezeit

4. **Offline-Handling**
   ```javascript
   try {
       await validateFSKAccess(category);
   } catch (error) {
       if (error.code === 'unavailable') {
           showError('Keine Internetverbindung');
       }
   }
   ```

---

## ✅ Testing Checklist

- [ ] FSK-Validierung für alle Altersgruppen getestet
- [ ] Age Verification Flow getestet
- [ ] Datenexport heruntergeladen & validiert
- [ ] Account-Löschung getestet (Test-Account!)
- [ ] Fehlerbehandlung getestet (offline, invalid input)
- [ ] Loading States & User Feedback OK
- [ ] Mobile Responsive OK

---

**Fertig!** 🎉 Die Cloud Functions sind jetzt vollständig in den Client integrierbar.

