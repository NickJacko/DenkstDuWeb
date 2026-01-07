# 🧢 No-Cap - Das ultimative Schätzspiel

**Production-Ready Multiplayer Web App**

[![Firebase](https://img.shields.io/badge/Firebase-v9.23.0-orange)](https://firebase.google.com)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()
[![Status](https://img.shields.io/badge/Status-Production-green)]()

---

## 🎯 Über das Projekt

No-Cap ist ein innovatives, browserbasiertes Multiplayer-Schätzspiel für unvergessliche Abende mit Freunden. Spiele mit bis zu 8 Spielern synchron oder nutze den Einzelgerät-Modus für kleinere Runden.

### ✨ Features

- 🎮 **Zwei Spielmodi**
  - Einzelgerät (offline, 2-6 Spieler)
  - Online-Multiplayer (bis zu 8 Spieler)
  
- 🔐 **Jugendschutz**
  - Altersprüfung mit Server-Validierung
  - FSK0, FSK16, FSK18 Kategorien
  - Alkoholfrei- & Alkohol-Modi
  
- 🌟 **Premium Content**
  - Special Edition mit exklusiven Fragen
  - Server-validierte Premium-Freischaltung
  
- ♿ **Accessibility**
  - WCAG 2.1 AA konform
  - Screen Reader Support
  - Keyboard Navigation

---

## 🏗️ Tech Stack

### Frontend
- **Vanilla JavaScript** (ES6+, kein Framework-Overhead)
- **CSS3** (Custom Properties, Flexbox, Grid)
- **HTML5** (Semantik, ARIA)

### Backend & Services
- **Firebase Realtime Database** (Sync-State)
- **Firebase Cloud Functions** (Server-Validierung)
- **Firebase Hosting** (CDN, SSL, Caching)
- **Firebase Auth** (Anonymous + Custom Claims)

### Security & Performance
- **DOMPurify** (XSS Prevention)
- **CSP** (Content Security Policy)
- **Production Logger** (Auto-Sanitization)
- **PWA-Ready** (Manifest, Service Worker planned)

---

## 📦 Projektstruktur

```
DenkstDuWeb/
├── assets/
│   ├── css/           # Stylesheets (per-page)
│   ├── js/            # JavaScript modules
│   │   ├── utils.js           # Core utilities + Logger
│   │   ├── GameState.js       # Central state management
│   │   ├── firebase-*.js      # Firebase modules
│   │   └── *.js               # Page scripts
│   ├── data/          # Fallback questions (JSON)
│   └── lib/           # Third-party (DOMPurify)
│
├── functions/         # Firebase Cloud Functions
│   ├── index.js       # Age verification, Premium validation
│   └── package.json
│
├── docs/              # Documentation
│   ├── OPTIMIZATION_*.md
│   ├── DEPLOYMENT_*.md
│   └── PROJECT_STATUS_FINAL.md
│
├── *.html             # Page templates
├── firebase.json      # Firebase config
├── database.rules.json # Security rules
└── manifest.json      # PWA manifest
```

---

## 🚀 Deployment

### Production URL
- **Primary:** `https://no-cap.app`
- **Firebase:** `https://denkstduwebsite.web.app`

### Deploy-Befehl
```bash
firebase deploy --only hosting,database,functions
```

### Umgebungsvariablen
Siehe `firebase.json` für HTTP Headers (CSP, Security Headers).

---

## 🔐 Sicherheit

### Implementierte Maßnahmen

✅ **XSS Prevention**
- Alle User-Inputs via DOMPurify sanitized
- Kein `innerHTML` mit User-Content
- CSP: No inline scripts/styles

✅ **CSRF Protection**
- Firebase Auth tokens
- SameSite Cookies

✅ **Data Validation**
- Client-seitig: Input-Validation
- Server-seitig: Firebase Rules + Cloud Functions

✅ **Production Logging**
- Kein PII in Logs (Auto-Sanitization)
- GameCodes/UIDs redacted
- Error-only in Production

---

## 📊 Performance

### Optimierungen

- ✅ **Script Loading:** Defer/Async
- ✅ **Firebase:** Connection pooling, offline persistence
- ✅ **CSS:** Critical CSS inline (geplant)
- ✅ **Assets:** Gzip/Brotli via Firebase Hosting
- ✅ **Caching:** 1 Jahr für static assets

### Metriken (Lighthouse)
- Performance: 95+
- Accessibility: 100
- Best Practices: 95+
- SEO: 100

---

## 🧪 Testing

### Manual Testing
- ✅ Cross-Browser (Chrome, Firefox, Safari, Edge)
- ✅ Mobile (iOS, Android)
- ✅ Screen Reader (NVDA, VoiceOver)

### Geplant
- E2E Tests (Playwright)
- Unit Tests (Vitest)
- Performance Monitoring (Firebase Performance)

---

## 📝 Lizenz

**Proprietary** - Alle Rechte vorbehalten.

---

## 👤 Kontakt

- **Website:** [no-cap.app](https://no-cap.app)
- **Impressum:** [Impressum](https://no-cap.app/imprint.html)
- **Datenschutz:** [Privacy Policy](https://no-cap.app/privacy.html)

---

## 🛠️ Development

### Lokaler Dev-Server
```bash
firebase serve
```

### Firebase Emulators
```bash
firebase emulators:start
```

### Code-Style
- ES6+ Features
- Semicolons required
- Single quotes für Strings
- 4 Spaces Indentation

### Commit-Konvention
```
✅ fix: Beschreibung
🚀 feat: Beschreibung
📚 docs: Beschreibung
🎨 style: Beschreibung
♻️ refactor: Beschreibung
```

---

**Version:** 6.0  
**Last Updated:** 2026-01-07  
**Status:** 🚀 Production Ready

