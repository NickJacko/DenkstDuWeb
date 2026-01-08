# CSS Optimization mit PurgeCSS

## 🎯 Ziel

Unbenutzte CSS-Selektoren entfernen und die Dateigröße von `styles.css` reduzieren.

**Aktueller Stand:**
- Originalgröße: ~90 KB (unkomprimiert)
- Ziel: < 300 KB minifiziert
- Einsparpotential: ~30-40% durch Entfernung ungenutzter Klassen

---

## 📦 Installation

### Node.js & npm erforderlich

```powershell
# PurgeCSS global installieren
npm install -g purgecss

# Oder lokal im Projekt
npm install --save-dev purgecss
```

---

## 🔧 PurgeCSS Konfiguration

### Methode 1: CLI (Schnell & Einfach)

Erstelle eine `purgecss.config.js` im Projektroot:

```javascript
module.exports = {
  content: [
    './index.html',
    './category-selection.html',
    './difficulty-selection.html',
    './gameplay.html',
    './player-setup.html',
    './join-game.html',
    './multiplayer-*.html',
    './imprint.html',
    './privacy.html',
    './404.html',
    './assets/js/**/*.js'
  ],
  css: ['./assets/css/styles.css'],
  output: './assets/css/styles.min.css',
  
  // ✅ WICHTIG: Safelist (Klassen die NICHT gelöscht werden dürfen)
  safelist: {
    // Standard-Klassen (immer behalten)
    standard: [
      'hidden',
      'visible',
      'dark-mode',
      'modal-open',
      'fade-in',
      'fade-out',
      'loading',
      'error',
      'success',
      'active',
      'disabled'
    ],
    
    // Deep-Matching (z.B. für .btn-*, .text-*)
    deep: [
      /^btn-/,
      /^text-/,
      /^bg-/,
      /^d-/,
      /^flex-/,
      /^align-/,
      /^justify-/,
      /^m[tblr]?-/,  // margin classes
      /^p[tblr]?-/,  // padding classes
      /^glass-/,
      /^category-/,
      /^difficulty-/,
      /^player-/,
      /^notification/,
      /^modal/,
      /^animate-/
    ],
    
    // Greedy-Matching (komplette Selektoren)
    greedy: [
      /dark-mode/,
      /:hover/,
      /:focus/,
      /:active/,
      /::before/,
      /::after/
    ]
  },
  
  // Keyframes behalten
  keyframes: true,
  
  // Variablen behalten
  variables: true,
  
  // Font-face behalten
  fontFace: true
};
```

### Methode 2: NPM Scripts (Automatisierung)

Füge zu `package.json` hinzu (falls nicht vorhanden, erstelle eine):

```json
{
  "name": "denkstduweb",
  "version": "4.0.0",
  "scripts": {
    "purge-css": "purgecss --config purgecss.config.js",
    "purge-css:watch": "purgecss --config purgecss.config.js --watch",
    "minify-css": "cleancss -o assets/css/styles.min.css assets/css/styles.css",
    "optimize-css": "npm run purge-css && npm run minify-css"
  },
  "devDependencies": {
    "purgecss": "^5.0.0",
    "clean-css-cli": "^5.6.2"
  }
}
```

Installation:

```powershell
npm install
```

Ausführen:

```powershell
npm run optimize-css
```

---

## 🚀 Ausführung

### CLI-Befehl (ohne Config-Datei)

```powershell
purgecss --css assets/css/styles.css `
         --content index.html `
         --content "**/*.html" `
         --content "assets/js/**/*.js" `
         --output assets/css/styles.min.css
```

### Mit Config-Datei

```powershell
purgecss --config purgecss.config.js
```

### Mit NPM Script

```powershell
npm run purge-css
```

---

## ⚠️ Wichtige Safelist-Klassen

Diese Klassen werden **dynamisch via JavaScript** hinzugefügt und müssen in der Safelist sein:

```javascript
// Aus dem Projekt identifizierte dynamische Klassen:
const safelist = [
  // Modal System
  'modal-open',
  'modal-overlay',
  'modal-content',
  'modal-header',
  'modal-body',
  'modal-footer',
  
  // Notifications
  'notification',
  'notification-error',
  'notification-success',
  'notification-warning',
  
  // Loading States
  'loading',
  'loading-spinner',
  
  // Dark Mode
  'dark-mode',
  
  // Game States
  'correct',
  'incorrect',
  'active-player',
  'winner',
  'host-badge',
  
  // Animations
  'fade-in',
  'fade-out',
  'slide-in',
  'pulse',
  'shake',
  
  // Utility States
  'hidden',
  'visible',
  'disabled',
  'error',
  'success'
];
```

---

## 🧪 Testen nach PurgeCSS

### 1. Visuelle Inspektion

Öffne jede Seite im Browser:

- ✅ `index.html`
- ✅ `category-selection.html`
- ✅ `difficulty-selection.html`
- ✅ `gameplay.html`
- ✅ `player-setup.html`
- ✅ `join-game.html`
- ✅ `multiplayer-lobby.html`
- ✅ `multiplayer-category-selection.html`
- ✅ `multiplayer-difficulty-selection.html`
- ✅ `multiplayer-gameplay.html`
- ✅ `multiplayer-results.html`
- ✅ `imprint.html`
- ✅ `privacy.html`
- ✅ `404.html`

### 2. Interaktive Tests

- [ ] Buttons klicken (Hover, Active, Focus States)
- [ ] Modals öffnen/schließen
- [ ] Dark Mode Toggle
- [ ] Formulare ausfüllen
- [ ] Notifications anzeigen
- [ ] Responsive Breakpoints testen
- [ ] Animationen prüfen

### 3. Browser DevTools

```javascript
// Im Console ausführen, um fehlende Klassen zu finden
const elements = document.querySelectorAll('*');
elements.forEach(el => {
    const computed = window.getComputedStyle(el);
    if (computed.display === 'none' && !el.classList.contains('hidden')) {
        console.warn('Möglicherweise fehlendes CSS:', el);
    }
});
```

---

## 📊 Größenvergleich

### Vor PurgeCSS:

```powershell
# Dateigröße prüfen
Get-Item assets/css/styles.css | Select-Object Name, Length
```

Beispiel:
- `styles.css`: ~90 KB (unkomprimiert)

### Nach PurgeCSS + Minification:

```powershell
Get-Item assets/css/styles.min.css | Select-Object Name, Length
```

Erwartete Größe:
- `styles.min.css`: ~45-60 KB (purged + minified)
- **Einsparung: 30-50%**

---

## 🔄 Automatisierung im Build-Prozess

### Deployment Script (`deploy.ps1`) erweitern:

```powershell
# CSS optimieren vor Deployment
Write-Host "Optimizing CSS..."
npm run optimize-css

# Dann normal deployen
firebase deploy --only hosting
```

### GitHub Actions Integration:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Optimize CSS
        run: npm run optimize-css
      
      - name: Deploy to Firebase
        run: firebase deploy --only hosting
```

---

## 🐛 Troubleshooting

### Problem: Wichtige Styles wurden entfernt

**Lösung:** Klasse zur Safelist hinzufügen:

```javascript
// In purgecss.config.js
safelist: {
  standard: ['missing-class-name']
}
```

### Problem: Hover/Focus States fehlen

**Lösung:** Pseudo-Selektoren in Safelist:

```javascript
safelist: {
  greedy: [/:hover/, /:focus/, /:active/]
}
```

### Problem: Animationen funktionieren nicht

**Lösung:** Keyframes aktivieren:

```javascript
// In purgecss.config.js
keyframes: true
```

### Problem: CSS-Variablen fehlen

**Lösung:** Variables aktivieren:

```javascript
variables: true
```

---

## 📝 Manuelle Alternative: Ungenutzte Styles identifizieren

Falls PurgeCSS zu aggressiv ist, manuell vorgehen:

### Chrome DevTools Coverage Tool:

1. DevTools öffnen (F12)
2. Cmd/Ctrl + Shift + P
3. "Show Coverage" tippen
4. Reload-Button klicken
5. `styles.css` anklicken
6. Rote Bereiche = Ungenutzt

### Manuelle Bereinigung:

Identifizierte ungenutzte Selektoren:
```css
/* Diese wurden nie verwendet (Beispiel):
.unused-class { ... }
.old-component { ... }
.deprecated-style { ... }
*/
```

---

## ✅ Checkliste vor Production

- [ ] `purgecss.config.js` erstellt
- [ ] Safelist konfiguriert
- [ ] PurgeCSS ausgeführt
- [ ] Alle Seiten visuell getestet
- [ ] Interaktive Elemente getestet (Modals, Forms, Buttons)
- [ ] Dark Mode getestet
- [ ] Responsive Breakpoints geprüft
- [ ] Animationen funktionieren
- [ ] CSS minifiziert
- [ ] Dateigröße < 300 KB (minified)
- [ ] Build-Prozess aktualisiert
- [ ] Backup erstellt (`styles.css.bak`)

---

## 📚 Weitere Tools

### CSS Minification:

```powershell
# clean-css installieren
npm install -g clean-css-cli

# Minifizieren
cleancss -o assets/css/styles.min.css assets/css/styles.css
```

### CSS Linting:

```powershell
# stylelint installieren
npm install -g stylelint

# Linting ausführen
stylelint "assets/css/**/*.css"
```

---

## 🎯 Erwartete Ergebnisse

**Vor Optimierung:**
- `styles.css`: ~90 KB (unkomprimiert)
- Geladene CSS: ~90 KB
- Parsing Time: ~150ms

**Nach Optimierung:**
- `styles.min.css`: ~50 KB (purged + minified)
- Geladene CSS: ~50 KB (gzip: ~12 KB)
- Parsing Time: ~80ms
- **Performance Gewinn: ~47%**

---

**Version:** 4.0  
**Datum:** 8. Januar 2026  
**Status:** ✅ Ready for Implementation

