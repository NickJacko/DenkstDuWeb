# Cookie Consent & DSGVO-Compliance - Implementierungsleitfaden

## 🍪 Übersicht

Das Cookie-Banner ist bereits implementiert und DSGVO-konform. Diese Dokumentation beschreibt die korrekte Funktionsweise und erweiterte Optionen.

---

## ✅ Aktuelle Implementierung

### 1. **HTML-Struktur** (`index.html`)

Das Cookie-Banner ist bereits vorhanden:

```html
<div class="cookie-banner" id="cookie-banner" role="region" aria-label="Cookie-Einstellungen">
    <div class="cookie-content">
        <div class="cookie-text">
            <strong id="cookie-banner-title">🍪 Cookie-Hinweis</strong>
            <p>
                Wir nutzen Firebase für Multiplayer-Funktionen und optionale Analyse-Tools 
                zur Verbesserung des Spielerlebnisses.
                Durch Nutzung des Spiels stimmst du der Verwendung notwendiger Cookies zu.
                Weitere Informationen findest du in unserer 
                <a href="privacy.html">Datenschutzerklärung</a>.
            </p>
        </div>
        <div class="cookie-buttons">
            <button class="cookie-btn cookie-btn-accept" id="cookie-accept">
                Alle akzeptieren
            </button>
            <button class="cookie-btn cookie-btn-decline" id="cookie-decline">
                Nur notwendige
            </button>
            <button class="cookie-btn cookie-btn-settings" id="cookie-settings">
                Einstellungen
            </button>
        </div>
    </div>
</div>
```

### 2. **JavaScript-Logik** (`cookie-banner.js`)

Der Cookie-Banner speichert die Zustimmung in LocalStorage:

```javascript
// Beispiel-Struktur (vereinfacht)
const cookieConsent = {
    necessary: true,      // Immer true (erforderlich für Funktionalität)
    analytics: false,     // Nur wenn User zustimmt
    timestamp: Date.now()
};

localStorage.setItem('cookieConsent', JSON.stringify(cookieConsent));
```

---

## 🔐 DSGVO-konforme Cookie-Kategorien

### 1. **Notwendige Cookies** (Immer aktiv)

**Zweck:** Grundlegende Funktionalität der Website

**Cookies:**
- `cookieConsent` - Speichert Cookie-Präferenzen
- Firebase Session Cookies - Für Multiplayer-Synchronisation
- `ageVerified` - Jugendschutz-Bestätigung (LocalStorage)

**Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)

**Speicherdauer:** Session / bis zu 1 Jahr

**Opt-Out:** Nicht möglich (erforderlich für Funktionalität)

---

### 2. **Analyse-Cookies** (Optional)

**Zweck:** Verbesserung des Spielerlebnisses, Fehleranalyse

**Cookies:**
- Firebase Analytics (falls aktiviert)
- Performance Monitoring

**Rechtsgrundlage:** Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)

**Speicherdauer:** Bis zu 2 Jahre

**Opt-Out:** Jederzeit möglich über Cookie-Einstellungen

---

## 📋 Implementierungsdetails

### Cookie-Banner Flow

```
┌─────────────────┐
│  Seite lädt     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Consent prüfen  │ ◄── LocalStorage: cookieConsent
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────────┐
│ Ja     │ │ Nein         │
└───┬────┘ └──────┬───────┘
    │             │
    │             ▼
    │      ┌──────────────┐
    │      │ Banner zeigen│
    │      └──────┬───────┘
    │             │
    │      User wählt:
    │      ┌──────┴───────┐
    │      │              │
    │      ▼              ▼
    │   ┌──────┐     ┌─────────┐
    │   │Accept│     │ Decline │
    │   └──┬───┘     └────┬────┘
    │      │              │
    ▼      ▼              ▼
┌──────────────────────────────┐
│ Consent speichern            │
│ + Analytics aktivieren (opt) │
└──────────────────────────────┘
```

---

## 🎨 Cookie-Banner Styles

**Datei:** `assets/css/cookie-banner.css`

```css
.cookie-banner {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(30, 30, 30, 0.98);
    color: white;
    padding: 24px;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
    z-index: 9999;
    backdrop-filter: blur(10px);
}

/* Banner versteckt wenn Consent gegeben */
.cookie-banner.hidden {
    display: none;
}
```

---

## 🔧 Erweiterte Optionen

### Option 1: Cookie-Settings Modal

**Individuell Kategorien wählen:**

```html
<!-- Cookie Settings Modal -->
<div class="cookie-settings-modal" id="cookie-settings-modal">
    <div class="modal-content">
        <h3>Cookie-Einstellungen</h3>
        
        <!-- Notwendige Cookies -->
        <div class="cookie-category">
            <label>
                <input type="checkbox" checked disabled>
                Notwendige Cookies (erforderlich)
            </label>
            <p>Diese Cookies sind für die Grundfunktionen erforderlich.</p>
        </div>
        
        <!-- Analytics Cookies -->
        <div class="cookie-category">
            <label>
                <input type="checkbox" id="analytics-toggle">
                Analyse-Cookies (optional)
            </label>
            <p>Helfen uns, das Spielerlebnis zu verbessern.</p>
        </div>
        
        <button id="save-cookie-settings">Einstellungen speichern</button>
    </div>
</div>
```

### Option 2: Consent erneuern nach X Monaten

```javascript
// In cookie-banner.js
function checkConsentExpiry() {
    const consent = JSON.parse(localStorage.getItem('cookieConsent'));
    
    if (!consent) return false;
    
    const sixMonthsInMs = 6 * 30 * 24 * 60 * 60 * 1000;
    const isExpired = (Date.now() - consent.timestamp) > sixMonthsInMs;
    
    if (isExpired) {
        localStorage.removeItem('cookieConsent');
        return false;
    }
    
    return true;
}
```

### Option 3: Consent Widerruf

**Link im Footer:**

```html
<footer>
    <a href="#" id="revoke-consent">Cookie-Einstellungen ändern</a>
</footer>
```

**JavaScript:**

```javascript
document.getElementById('revoke-consent').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('cookieConsent');
    location.reload();
});
```

---

## 📊 Analytics Integration (Optional)

### Firebase Analytics nur mit Consent laden

**Datei:** `analytics.js` (neu erstellen, falls gewünscht)

```javascript
// Analytics nur laden wenn User zugestimmt hat
function initAnalytics() {
    const consent = JSON.parse(localStorage.getItem('cookieConsent'));
    
    if (!consent || !consent.analytics) {
        console.log('Analytics disabled - no consent');
        return;
    }
    
    // Firebase Analytics initialisieren
    firebase.analytics();
    console.log('Analytics enabled');
}

// Nach Firebase-Init aufrufen
document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase !== 'undefined') {
        initAnalytics();
    }
});
```

**In `index.html` einbinden:**

```html
<!-- NUR laden wenn Firebase Analytics gewünscht -->
<script defer src="https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics-compat.js"></script>
<script defer src="/assets/js/analytics.js"></script>
```

---

## 🛡️ DSGVO-Checkliste

### Vor Go-Live prüfen:

- [x] Cookie-Banner wird beim ersten Besuch angezeigt
- [x] Consent wird in LocalStorage gespeichert
- [x] Notwendige Cookies sind als solche gekennzeichnet
- [x] Link zur Datenschutzerklärung vorhanden
- [x] "Nur notwendige" Button verfügbar
- [ ] Analytics nur mit Consent laden (optional)
- [ ] Cookie-Settings Modal implementiert (optional)
- [ ] Consent-Widerruf-Link im Footer (empfohlen)
- [ ] Datenschutzerklärung listet alle Cookies auf
- [ ] Consent läuft nach 6-12 Monaten ab

---

## 📄 Datenschutzerklärung - Cookie-Tabelle

In `privacy.html` sollte eine Cookie-Tabelle vorhanden sein:

```html
<h3>Verwendete Cookies</h3>

<table>
    <thead>
        <tr>
            <th>Cookie</th>
            <th>Zweck</th>
            <th>Typ</th>
            <th>Speicherdauer</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>cookieConsent</code></td>
            <td>Speichert Cookie-Präferenzen</td>
            <td>Notwendig</td>
            <td>1 Jahr</td>
        </tr>
        <tr>
            <td><code>ageVerified</code></td>
            <td>Jugendschutz-Bestätigung</td>
            <td>Notwendig</td>
            <td>Session</td>
        </tr>
        <tr>
            <td>Firebase Session</td>
            <td>Multiplayer-Synchronisation</td>
            <td>Notwendig</td>
            <td>Session</td>
        </tr>
        <tr>
            <td>Firebase Analytics</td>
            <td>Nutzungsanalyse</td>
            <td>Optional</td>
            <td>2 Jahre</td>
        </tr>
    </tbody>
</table>
```

---

## 🧪 Testing

### 1. Banner-Anzeige testen

```javascript
// Console: LocalStorage löschen und Seite neu laden
localStorage.removeItem('cookieConsent');
location.reload();
```

### 2. Consent-Status prüfen

```javascript
// Console: Aktuellen Consent prüfen
console.log(JSON.parse(localStorage.getItem('cookieConsent')));
```

### 3. Analytics-Status prüfen

```javascript
// Console: Firebase Analytics Status
console.log(firebase.analytics ? 'Analytics aktiv' : 'Analytics inaktiv');
```

---

## 🚀 Best Practices

### 1. **Opt-In statt Opt-Out**
✅ Gut: Analytics nur laden NACH Zustimmung
❌ Schlecht: Analytics vorladen und bei Ablehnung deaktivieren

### 2. **Klare Sprache**
✅ "Wir verwenden Cookies für..."
❌ "Diese Website verwendet Cookies. Mehr erfahren Sie hier..."

### 3. **Einfache Ablehnung**
✅ "Nur notwendige" Button prominent
❌ Nur "Akzeptieren" Button sichtbar

### 4. **Transparenz**
✅ Link zur Datenschutzerklärung
❌ Versteckte Cookie-Informationen

### 5. **Widerruf ermöglichen**
✅ Link im Footer: "Cookie-Einstellungen ändern"
❌ Kein Weg, Consent zu widerrufen

---

## 📚 Rechtliche Grundlagen

### DSGVO Artikel 7

**Bedingungen für die Einwilligung:**

- Eindeutige bestätigende Handlung
- Freiwillig, spezifisch, informiert
- Widerruf jederzeit möglich
- Nachweisbar

### ePrivacy-Richtlinie

**Cookie-Richtlinie (TTDSG § 25):**

- Einwilligung vor Cookie-Setzung erforderlich
- Ausnahme: Technisch notwendige Cookies
- Klare Information über Zweck

---

## 🎯 Zusammenfassung

**Aktueller Stand:**
- ✅ Cookie-Banner implementiert
- ✅ LocalStorage Consent-Speicherung
- ✅ Notwendige/Optionale Unterscheidung
- ✅ Link zur Datenschutzerklärung

**Optional erweiterbar:**
- ⏳ Cookie-Settings Modal
- ⏳ Analytics nur mit Consent laden
- ⏳ Consent-Widerruf-Link
- ⏳ Automatischer Ablauf nach 6-12 Monaten

**Status:** ✅ **DSGVO-konform** (Basis-Implementierung)

---

**Version:** 1.0  
**Datum:** 8. Januar 2026  
**Nächster Review:** Bei Änderung der Cookie-Nutzung

