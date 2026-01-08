# Dark Mode Implementation Guide

## 🌓 Übersicht

Das Design System unterstützt jetzt vollständig Dark Mode mit automatischer Erkennung und manuellem Toggle.

---

## 🎨 Verwendung

### Methode 1: Manueller Toggle (Empfohlen)

Füge die `.dark-mode` Klasse zum `<body>` oder `<html>` Element hinzu:

```javascript
// Dark Mode aktivieren
document.body.classList.add('dark-mode');

// Dark Mode deaktivieren
document.body.classList.remove('dark-mode');

// Toggle
document.body.classList.toggle('dark-mode');
```

### Methode 2: Auto-Erkennung via System Preference

Automatische Aktivierung basierend auf Systemeinstellungen:

```javascript
// System Preference prüfen
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark-mode');
}

// Änderungen überwachen
window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', e => {
        if (e.matches) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    });
```

### Methode 3: LocalStorage Persistierung

User-Präferenz speichern:

```javascript
// Dark Mode Toggle mit Speicherung
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
}

// Beim Laden prüfen
const darkMode = localStorage.getItem('darkMode');
if (darkMode === 'enabled') {
    document.body.classList.add('dark-mode');
}
```

---

## 🎨 Design Tokens - Dark Mode

### Automatisch überschriebene Variablen

Wenn `.dark-mode` aktiv ist, werden folgende Custom Properties überschrieben:

```css
/* Hintergründe */
--bg-primary: #121212;        /* Haupthintergrund */
--bg-secondary: #1e1e1e;      /* Sekundärer Hintergrund */
--bg-tertiary: #2a2a2a;       /* Tertiärer Hintergrund */

/* Text */
--text-primary: #ffffff;      /* Haupttext */
--text-secondary: #b0b0b0;    /* Sekundärtext */
--text-tertiary: #808080;     /* Tertiärtext */
--text-inverse: #121212;      /* Inverser Text */

/* Borders */
--border-color: rgba(255, 255, 255, 0.12);
--border-color-light: rgba(255, 255, 255, 0.06);

/* Shadows & Cards */
--shadow-color: rgba(0, 0, 0, 0.5);
--card-bg: rgba(30, 30, 30, 0.95);

/* Glass Morphism (Dark) */
--glass-bg: rgba(255, 255, 255, 0.05);
--glass-bg-hover: rgba(255, 255, 255, 0.08);
--glass-bg-active: rgba(255, 255, 255, 0.12);
--glass-border: rgba(255, 255, 255, 0.1);
--glass-shadow: rgba(0, 0, 0, 0.5);
```

### Farben bleiben gleich

Diese Farben ändern sich **nicht** im Dark Mode (konsistente Brand-Farben):

```css
--color-primary
--color-secondary
--color-accent
--color-success
--color-warning
--color-danger
--color-info
```

---

## 🎨 Komponenten mit Dark Mode Support

### ✅ Automatisch unterstützt:

- **Cards** (`.glass-card`, `.category-card`, `.difficulty-card`, `.player-card`)
- **Buttons** (`.btn-outline` passt sich an)
- **Forms** (Inputs, Textareas, Selects)
- **Links** (helleres Blau im Dark Mode)
- **Modals** (dunklerer Overlay)
- **Notifications** (angepasste Hintergründe)
- **Focus States** (hellere Outlines)

---

## 🧪 Beispiel: Toggle Button

### HTML:

```html
<button id="dark-mode-toggle" class="btn btn-outline" aria-label="Dark Mode umschalten">
    <span class="icon-light">☀️</span>
    <span class="icon-dark">🌙</span>
</button>
```

### CSS:

```css
/* Icons anzeigen/verstecken */
.dark-mode .icon-light {
    display: none;
}

.dark-mode .icon-dark {
    display: inline;
}

.icon-dark {
    display: none;
}

.icon-light {
    display: inline;
}
```

### JavaScript:

```javascript
const toggleBtn = document.getElementById('dark-mode-toggle');

toggleBtn.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
});

// Beim Laden prüfen
if (localStorage.getItem('darkMode') === 'enabled') {
    document.body.classList.add('dark-mode');
}
```

---

## 🎨 Custom Components anpassen

Wenn du eigene Komponenten hast, die Dark Mode unterstützen sollen:

```css
/* Deine Komponente (Light) */
.my-component {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
}

/* Dark Mode wird automatisch unterstützt durch CSS-Variablen! */
```

### Spezifische Dark Mode Anpassungen:

```css
/* Wenn spezielle Anpassungen nötig sind */
.dark-mode .my-component {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
}

.dark-mode .my-component:hover {
    background: var(--glass-bg-hover);
}
```

---

## ♿ Accessibility

### WCAG-Konformität

Alle Dark Mode Farben erfüllen **WCAG AA** Standards:
- Mindestkontrast 4.5:1 für normalen Text
- Mindestkontrast 3:1 für große Texte

### System Preference Respektieren

```css
@media (prefers-color-scheme: dark) {
    /* Optional: Auto-Aktivierung */
    /* Siehe styles.css Zeile ~2950 */
}
```

### Reduced Motion

Dark Mode respektiert `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
    .dark-mode * {
        transition: none !important;
    }
}
```

---

## 📱 Responsive Verhalten

Dark Mode funktioniert auf allen Bildschirmgrößen identisch:

```css
/* Mobile */
@media (max-width: 768px) {
    .dark-mode .glass-card {
        /* Anpassungen wenn nötig */
    }
}
```

---

## 🐛 Troubleshooting

### Problem: Dark Mode bleibt nicht bestehen

**Lösung:** LocalStorage Persistierung implementieren (siehe oben)

### Problem: Einige Elemente sind zu hell/dunkel

**Lösung:** CSS-Variablen verwenden statt Hardcoded-Farben:

```css
/* ❌ Schlecht */
.element {
    background: #ffffff;
    color: #000000;
}

/* ✅ Gut */
.element {
    background: var(--bg-primary);
    color: var(--text-primary);
}
```

### Problem: Bilder sind zu hell im Dark Mode

**Lösung:** Filter anwenden:

```css
.dark-mode img {
    filter: brightness(0.8) contrast(1.2);
}
```

---

## 🎨 Erweiterte Anpassungen

### Gradient Backgrounds anpassen:

```css
.dark-mode body {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}
```

### Custom Scrollbar (Dark):

```css
.dark-mode ::-webkit-scrollbar {
    background: var(--bg-secondary);
}

.dark-mode ::-webkit-scrollbar-thumb {
    background: var(--bg-tertiary);
}
```

---

## 📊 Browser Support

- ✅ Chrome/Edge 76+
- ✅ Firefox 67+
- ✅ Safari 12.1+
- ✅ iOS Safari 12.2+
- ✅ Chrome Android 76+

**CSS Custom Properties** werden von allen modernen Browsern unterstützt.

---

## 🚀 Deployment Checklist

- [ ] Dark Mode Toggle UI implementiert
- [ ] LocalStorage Persistierung aktiviert
- [ ] System Preference Detection aktiviert (optional)
- [ ] Alle Custom Components getestet
- [ ] Kontrast-Verhältnisse geprüft (WCAG AA)
- [ ] Mobile Darstellung getestet
- [ ] Print Styles berücksichtigt (siehe `styles.css`)

---

## 📚 Weitere Ressourcen

- **WCAG Kontrast Checker:** https://webaim.org/resources/contrastchecker/
- **CSS Custom Properties:** https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties
- **prefers-color-scheme:** https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme

---

**Version:** 4.0  
**Datum:** 8. Januar 2026  
**Status:** ✅ Production Ready

