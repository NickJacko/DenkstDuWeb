# 🚀 QUICK REFERENCE - Daily Development

**No-Cap Production Standards**  
**Letzte Aktualisierung:** 2026-01-07

---

## 📝 LOGGING (NEU!)

### ✅ DO: Logger verwenden

```javascript
// Get Logger from utils
const Logger = window.NocapUtils?.Logger || {
    debug: (...args) => {},
    info: (...args) => {},
    warn: console.warn,
    error: console.error
};

// Development-only logging
Logger.debug('User clicked button:', buttonId);
Logger.info('Game state:', gameState.getDebugInfo());

// Production logging (immer)
Logger.warn('Connection unstable');
Logger.error('Failed to load data:', error);  // Auto-sanitized!
```

### ❌ DON'T: console.log

```javascript
// ❌ NEVER DO THIS
console.log('User ID:', userId);  // PII-Leak!
console.log('Game Code:', gameCode);  // Sensitive data!

// ❌ NEVER DO THIS
if (isDevelopment) {
    console.log('Debug info');  // Vergessen zu löschen!
}
```

---

## 🎨 UI HELPERS

### ✅ DO: NocapUtils verwenden

```javascript
// Loading
window.NocapUtils.showLoading();
window.NocapUtils.hideLoading();

// Notifications
window.NocapUtils.showNotification('Success!', 'success', 3000);
window.NocapUtils.showNotification('Error!', 'error');

// DOM Manipulation
window.NocapUtils.showElement(element, 'flex');
window.NocapUtils.hideElement(element);
window.NocapUtils.setTextContent(element, userInput);  // XSS-safe!
```

### ❌ DON'T: Eigene Implementierung

```javascript
// ❌ NEVER DO THIS (Duplikation!)
function showLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.add('show');
    }
}

// ❌ NEVER DO THIS (XSS-Gefahr!)
element.innerHTML = userInput;

// ✅ DO THIS INSTEAD
window.NocapUtils.setTextContent(element, userInput);
```

---

## 🔐 SECURITY

### ✅ DO: Input Sanitization

```javascript
// User Input
const sanitized = window.NocapUtils.sanitizeInput(userInput);

// HTML Content
const safeHTML = window.NocapUtils.sanitizeHTML(htmlString);

// Game ID Validation
const gameId = window.NocapUtils.validateGameId(input);
```

### ❌ DON'T: Direkter DOM-Zugriff

```javascript
// ❌ NEVER
element.innerHTML = '<div>' + userInput + '</div>';

// ✅ DO THIS
const div = document.createElement('div');
div.textContent = userInput;
element.appendChild(div);
```

---

## 🚀 DEPLOYMENT

### One-Liner (PowerShell)

```powershell
# Windows
.\deploy.ps1

# Oder manuell
firebase deploy --only hosting,database,functions
```

### Pre-Deployment Checklist

```bash
# 1. Check für console.log
Select-String -Path "assets\js\*.js" -Pattern "console\.log"

# 2. Check für TODOs
Select-String -Path "assets\js\*.js" -Pattern "TODO"

# 3. Test lokal
firebase serve

# 4. Deploy
.\deploy.ps1
```

---

## 📂 FILE ORGANIZATION

### Wo gehört was hin?

```
✅ Dokumentation → /docs/
✅ Deployment-Logs → .gitignore
✅ Debug-Files → .gitignore
✅ Production-Code → /assets/
✅ Firebase Functions → /functions/
```

### Benennung

```
✅ kebab-case.html
✅ kebab-case.css
✅ kebab-case.js
❌ CamelCase.js
❌ snake_case.js
```

---

## 🧪 TESTING CHECKLIST

### Vor jedem Commit

- [ ] `Logger` statt `console.log`?
- [ ] Keine PII in Logs?
- [ ] `NocapUtils` statt eigene Helper?
- [ ] Input sanitized?
- [ ] Keine `innerHTML` mit User-Input?

### Vor jedem Deploy

- [ ] Lokal getestet?
- [ ] Firebase Rules reviewed?
- [ ] Debug-Logs entfernt?
- [ ] TODOs aufgeräumt?
- [ ] Deployment-Script ausgeführt?

---

## 🐛 DEBUGGING

### Development Mode

```javascript
// Check ob Development
const isDevelopment = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

// Debug-Logging
Logger.debug('Current state:', gameState.getDebugInfo());

// Performance-Tracking
Logger.time('loadQuestions');
// ... code ...
Logger.timeEnd('loadQuestions');
```

### Production Debugging

```javascript
// Nur Errors/Warnings
Logger.error('Failed to connect:', error);
Logger.warn('Slow connection detected');

// Firebase Console checken
// Analytics Events prüfen
// Crashlytics (wenn aktiviert)
```

---

## 📊 PERFORMANCE TIPS

### Do's

✅ Defer/Async Scripts
✅ Debounce Firebase Updates
✅ Unsubscribe Listeners
✅ Cleanup on Page Unload

### Don'ts

❌ Blocking Scripts
❌ Excessive Firebase Reads
❌ Memory Leaks (Listener nicht aufgeräumt)
❌ Inline Styles/Scripts (CSP!)

---

## 🎯 CODE STYLE

### JavaScript

```javascript
// ✅ Semicolons
const foo = 'bar';

// ✅ Single Quotes
const message = 'Hello World';

// ✅ 4 Spaces
function example() {
    if (condition) {
        doSomething();
    }
}

// ✅ Const/Let (kein var)
const immutable = 'value';
let mutable = 0;

// ✅ Arrow Functions
const add = (a, b) => a + b;
```

### Naming

```javascript
// ✅ camelCase für Variablen/Funktionen
const userName = 'John';
function getUserName() {}

// ✅ PascalCase für Klassen
class GameState {}

// ✅ UPPER_CASE für Constants
const API_KEY = 'xxx';
```

---

## 🆘 HELP & RESOURCES

### Dokumentation

- `/docs/` - Alle Projekt-Docs
- `README.md` - Projekt-Übersicht
- `PRODUCTION_HARDENING_STATUS.md` - Live-Status
- `PRODUCTION_HARDENING_CHANGE_LOG.md` - Alle Änderungen

### Bei Problemen

1. Check `Logger.error()` Output
2. Firebase Console → Database/Functions
3. Browser DevTools → Console/Network
4. `PRODUCTION_HARDENING_STATUS.md` → Known Issues

---

## 🚨 EMERGENCY

### Production Down?

```bash
# 1. Check Firebase Status
# firebase.google.com/support/status

# 2. Rollback
firebase hosting:rollback

# 3. Check Logs
firebase functions:log

# 4. Kontakt Lead Dev
```

---

**Erstellt:** 2026-01-07  
**Version:** 6.0  
**Für:** No-Cap Development Team

