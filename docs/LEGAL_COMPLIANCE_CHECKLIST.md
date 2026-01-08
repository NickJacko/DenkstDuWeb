# Rechtliche Anforderungen - Implementierungs-Checkliste

## 📋 Übersicht

Diese Checkliste deckt alle rechtlichen Anforderungen für die No-Cap Web-App ab:
1. ✅ Impressum vervollständigen
2. ✅ Datenschutzerklärung aktualisieren
3. ✅ Jugendschutz & Age-Gate testen
4. ✅ Kontakt-/Löschweg anbieten

---

## 1. 📝 Impressum vervollständigen

### Status: ⚠️ TODO

### Datei: `imprint.html`

### Erforderliche Angaben (§5 TMG):

#### **Mindestangaben**:
```html
<!-- Anbieter -->
<p><strong>Angaben gemäß § 5 TMG:</strong></p>

<!-- TODO: Echte Daten eintragen -->
<p>
  [Vorname Nachname] oder [Firmenname]<br>
  [Straße Hausnummer]<br>
  [PLZ Ort]<br>
  [Land]
</p>

<!-- Kontakt -->
<p><strong>Kontakt:</strong></p>
<p>
  E-Mail: <a href="mailto:kontakt@no-cap.app">kontakt@no-cap.app</a><br>
  Telefon: [optional, aber empfohlen]
</p>

<!-- Umsatzsteuer-ID (falls vorhanden) -->
<p><strong>Umsatzsteuer-ID:</strong></p>
<p>
  Umsatzsteuer-Identifikationsnummer gemäß §27a Umsatzsteuergesetz:<br>
  DE[123456789] <!-- TODO: Falls vorhanden -->
</p>

<!-- Handelsregister (falls eingetragen) -->
<p><strong>Registereintrag:</strong></p>
<p>
  Eintragung im Handelsregister<br>
  Registergericht: [Amtsgericht]<br>
  Registernummer: [HRB 12345] <!-- TODO: Falls vorhanden -->
</p>

<!-- Verantwortlich für den Inhalt (§55 RStV) -->
<p><strong>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV:</strong></p>
<p>
  [Name]<br>
  [Adresse wie oben]
</p>

<!-- Online-Streitbeilegung (EU-Verordnung) -->
<p><strong>EU-Streitschlichtung:</strong></p>
<p>
  Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:<br>
  <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener">
    https://ec.europa.eu/consumers/odr/
  </a><br>
  Unsere E-Mail-Adresse finden Sie oben im Impressum.
</p>

<!-- Verbraucherstreitbeilegung -->
<p><strong>Verbraucherstreitbeilegung/Universalschlichtungsstelle:</strong></p>
<p>
  Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer 
  Verbraucherschlichtungsstelle teilzunehmen.
</p>
```

---

### ✅ Checkliste für Impressum:

- [ ] **Name/Firma**: Vollständiger Name oder Firmenname eingetragen
- [ ] **Adresse**: Vollständige Postanschrift (keine Postfachadresse)
- [ ] **Kontakt**: E-Mail-Adresse angegeben (Telefon empfohlen)
- [ ] **USt-ID**: Falls vorhanden, eingetragen
- [ ] **Handelsregister**: Falls eingetragen, Angaben vollständig
- [ ] **§55 RStV**: Verantwortlicher für Inhalte benannt
- [ ] **EU-Streitschlichtung**: Link zur ODR-Plattform vorhanden
- [ ] **Verbraucherstreitbeilegung**: Hinweis vorhanden

---

### 🔍 IHK Impressums-Generator:

**Link**: https://www.ihk.de/impressumsgenerator

**Verwendung**:
1. Generator öffnen
2. Unternehmensform auswählen (Einzelunternehmer, GmbH, etc.)
3. Alle Felder ausfüllen
4. Generierten Text in `imprint.html` einfügen

---

### 📄 Template für imprint.html:

```html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Impressum - No-Cap</title>
    <link rel="stylesheet" href="/assets/css/styles.css">
</head>
<body>
    <main class="legal-page">
        <div class="legal-container">
            <h1>Impressum</h1>
            
            <!-- Angaben gemäß § 5 TMG -->
            <section>
                <h2>Angaben gemäß § 5 TMG</h2>
                <p>
                    <!-- TODO: Echte Daten eintragen -->
                    [Ihr Name / Firmenname]<br>
                    [Straße Hausnummer]<br>
                    [PLZ Ort]<br>
                    Deutschland
                </p>
            </section>
            
            <!-- Kontakt -->
            <section>
                <h2>Kontakt</h2>
                <p>
                    E-Mail: <a href="mailto:kontakt@no-cap.app">kontakt@no-cap.app</a><br>
                    Telefon: [Optional]
                </p>
            </section>
            
            <!-- Falls vorhanden: USt-ID -->
            <section>
                <h2>Umsatzsteuer-ID</h2>
                <p>
                    Umsatzsteuer-Identifikationsnummer gemäß §27a UStG:<br>
                    DE[123456789] <!-- TODO: Falls vorhanden -->
                </p>
            </section>
            
            <!-- Falls vorhanden: Handelsregister -->
            <section>
                <h2>Registereintrag</h2>
                <p>
                    Eintragung im Handelsregister<br>
                    Registergericht: Amtsgericht [Ort]<br>
                    Registernummer: HRB [12345] <!-- TODO: Falls vorhanden -->
                </p>
            </section>
            
            <!-- Verantwortlich für Inhalt -->
            <section>
                <h2>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
                <p>
                    [Name]<br>
                    [Adresse wie oben]
                </p>
            </section>
            
            <!-- EU-Streitschlichtung -->
            <section>
                <h2>EU-Streitschlichtung</h2>
                <p>
                    Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:
                    <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener">
                        https://ec.europa.eu/consumers/odr/
                    </a>
                </p>
                <p>
                    Unsere E-Mail-Adresse finden Sie oben im Impressum.
                </p>
            </section>
            
            <!-- Verbraucherstreitbeilegung -->
            <section>
                <h2>Verbraucherstreitbeilegung</h2>
                <p>
                    Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer 
                    Verbraucherschlichtungsstelle teilzunehmen.
                </p>
            </section>
            
            <!-- Haftungsausschluss -->
            <section>
                <h2>Haftung für Inhalte</h2>
                <p>
                    Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten 
                    nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als 
                    Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde 
                    Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige 
                    Tätigkeit hinweisen.
                </p>
            </section>
            
            <a href="/" class="btn btn-primary">Zurück zur Startseite</a>
        </div>
    </main>
</body>
</html>
```

---

## 2. 🔒 Datenschutzerklärung aktualisieren

### Status: ⚠️ TODO

### Datei: `privacy.html`

### Zu ergänzende Abschnitte:

#### **A. Verwendete Dienste vollständig auflisten**

```html
<section id="services">
    <h2>3. Eingesetzte Dienste und Tools</h2>
    
    <!-- Firebase Authentication -->
    <h3>3.1 Firebase Authentication</h3>
    <p>
        <strong>Anbieter:</strong> Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland<br>
        <strong>Zweck:</strong> Benutzeranmeldung (anonym und mit E-Mail)<br>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)<br>
        <strong>Datenübermittlung USA:</strong> Ja, auf Basis von EU-Standardvertragsklauseln<br>
        <strong>Datenschutzerklärung:</strong> 
        <a href="https://firebase.google.com/support/privacy" target="_blank">
            https://firebase.google.com/support/privacy
        </a>
    </p>
    
    <!-- Firebase Realtime Database -->
    <h3>3.2 Firebase Realtime Database</h3>
    <p>
        <strong>Anbieter:</strong> Google Ireland Limited<br>
        <strong>Zweck:</strong> Speicherung von Spielständen, Multiplayer-Daten<br>
        <strong>Gespeicherte Daten:</strong> Spieler-IDs, Spielstände, Spielcodes, Zeitstempel<br>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)<br>
        <strong>Speicherdauer:</strong> Spieldaten werden nach 24 Stunden automatisch gelöscht
    </p>
    
    <!-- Firebase Analytics (nur mit Consent) -->
    <h3>3.3 Firebase Analytics</h3>
    <p>
        <strong>Anbieter:</strong> Google Ireland Limited<br>
        <strong>Zweck:</strong> Analyse der App-Nutzung, Verbesserung der Benutzererfahrung<br>
        <strong>Gespeicherte Daten:</strong> Anonymisierte Nutzungsdaten, Gerätetyp, Browser<br>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung via Cookie-Banner)<br>
        <strong>Opt-Out:</strong> Über Cookie-Einstellungen möglich<br>
        <strong>Hinweis:</strong> Wird nur nach Ihrer Zustimmung im Cookie-Banner aktiviert
    </p>
    
    <!-- Firebase Storage (zukünftig für Avatare) -->
    <h3>3.4 Firebase Storage</h3>
    <p>
        <strong>Anbieter:</strong> Google Ireland Limited<br>
        <strong>Zweck:</strong> Speicherung von Benutzer-Avataren (optional)<br>
        <strong>Gespeicherte Daten:</strong> Profilbilder (max. 5 MB)<br>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)<br>
        <strong>Speicherdauer:</strong> Bis zur Löschung durch den Nutzer<br>
        <strong>Hinweis:</strong> Nur wenn Sie ein Avatar hochladen
    </p>
    
    <!-- Stripe (falls Bezahlung) -->
    <h3>3.5 Stripe (Zahlungsabwicklung)</h3>
    <p>
        <strong>Anbieter:</strong> Stripe, Inc., 510 Townsend Street, San Francisco, CA 94103, USA<br>
        <strong>Zweck:</strong> Sichere Zahlungsabwicklung für Premium-Features<br>
        <strong>Gespeicherte Daten:</strong> Zahlungsinformationen (verschlüsselt), E-Mail-Adresse<br>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)<br>
        <strong>Datenübermittlung USA:</strong> Ja, Stripe ist Privacy Shield zertifiziert<br>
        <strong>Datenschutzerklärung:</strong> 
        <a href="https://stripe.com/de/privacy" target="_blank">
            https://stripe.com/de/privacy
        </a><br>
        <strong>Hinweis:</strong> Nur wenn Sie Premium-Features kaufen
    </p>
</section>
```

---

#### **B. Cookie-Tabelle aktualisieren**

```html
<section id="cookies">
    <h2>4. Cookies und lokale Speicherung</h2>
    
    <h3>4.1 Was sind Cookies?</h3>
    <p>
        Cookies sind kleine Textdateien, die auf Ihrem Gerät gespeichert werden. 
        Wir verwenden ausschließlich technisch notwendige Cookies und solche, die Sie über 
        unser Cookie-Banner explizit akzeptiert haben.
    </p>
    
    <h3>4.2 Verwendete Cookies und LocalStorage-Keys</h3>
    <table class="cookie-table">
        <thead>
            <tr>
                <th>Name</th>
                <th>Typ</th>
                <th>Zweck</th>
                <th>Speicherdauer</th>
                <th>Kategorie</th>
            </tr>
        </thead>
        <tbody>
            <!-- Notwendige Cookies -->
            <tr>
                <td><code>nocap_cookie_consent</code></td>
                <td>LocalStorage</td>
                <td>Speichert Ihre Cookie-Einstellungen</td>
                <td>365 Tage</td>
                <td>Notwendig</td>
            </tr>
            <tr>
                <td><code>nocap_privacy_consent</code></td>
                <td>LocalStorage</td>
                <td>Datenschutz-Zustimmung</td>
                <td>Permanent</td>
                <td>Notwendig</td>
            </tr>
            <tr>
                <td><code>nocap_age_verification</code></td>
                <td>LocalStorage</td>
                <td>Altersverifikation für Jugendschutz</td>
                <td>30 Tage</td>
                <td>Notwendig</td>
            </tr>
            <tr>
                <td><code>nocap_game_state</code></td>
                <td>LocalStorage</td>
                <td>Spielstand-Zwischenspeicherung</td>
                <td>Session</td>
                <td>Notwendig</td>
            </tr>
            
            <!-- Funktionale Cookies -->
            <tr>
                <td><code>nocap_cached_questions</code></td>
                <td>LocalStorage</td>
                <td>Zwischenspeicherung von Fragen (Performance)</td>
                <td>24 Stunden</td>
                <td>Funktional</td>
            </tr>
            <tr>
                <td><code>firebase:authUser</code></td>
                <td>LocalStorage</td>
                <td>Firebase Authentication Status</td>
                <td>Bis Abmeldung</td>
                <td>Funktional</td>
            </tr>
            
            <!-- Analytics Cookies (nur mit Consent) -->
            <tr>
                <td><code>_ga</code></td>
                <td>Cookie</td>
                <td>Google Analytics - Nutzer-Identifikation</td>
                <td>2 Jahre</td>
                <td>Analyse</td>
            </tr>
            <tr>
                <td><code>_ga_*</code></td>
                <td>Cookie</td>
                <td>Google Analytics - Session-Daten</td>
                <td>2 Jahre</td>
                <td>Analyse</td>
            </tr>
        </tbody>
    </table>
    
    <h3>4.3 Cookie-Einstellungen ändern</h3>
    <p>
        Sie können Ihre Cookie-Einstellungen jederzeit ändern:
    </p>
    <button onclick="window.NocapCookies.revokeConsent(); window.NocapCookies.reinitialize();" 
            class="btn btn-secondary">
        Cookie-Einstellungen zurücksetzen
    </button>
</section>
```

---

#### **C. IP-Logging bei Age-Verification**

```html
<section id="age-verification">
    <h2>5. Jugendschutz und Altersverifikation</h2>
    
    <h3>5.1 Warum Altersverifikation?</h3>
    <p>
        Gemäß Jugendschutzgesetz (JuSchG) müssen wir sicherstellen, dass Inhalte mit 
        FSK16/FSK18-Einstufung nur für entsprechende Altersgruppen zugänglich sind.
    </p>
    
    <h3>5.2 Welche Daten werden bei der Altersverifikation gespeichert?</h3>
    <p>
        Bei der Altersverifikation speichern wir folgende Daten:
    </p>
    <ul>
        <li><strong>Eingegebenes Geburtsdatum:</strong> Zur Berechnung des Alters</li>
        <li><strong>Zeitstempel:</strong> Wann die Verifikation stattfand</li>
        <li><strong>IP-Adresse (anonymisiert):</strong> 
            Zur Missbrauchsprävention und Erfüllung der Nachweispflicht gemäß JMStV §5</li>
        <li><strong>Verifikations-Status:</strong> Ob Verifikation erfolgreich war</li>
    </ul>
    
    <h3>5.3 IP-Adress-Speicherung im Detail</h3>
    <p>
        <strong>Zweck:</strong> Nachweis der Altersverifikation gemäß Jugendmedienschutz-Staatsvertrag (JMStV)<br>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung)<br>
        <strong>Speicherung:</strong> IP-Adresse wird gekürzt (letztes Oktett entfernt, z.B. 192.168.1.xxx)<br>
        <strong>Speicherdauer:</strong> 30 Tage ab Verifikation<br>
        <strong>Automatische Löschung:</strong> Nach Ablauf der 30 Tage werden die Daten automatisch gelöscht
    </p>
    
    <h3>5.4 Wie funktioniert die Anonymisierung?</h3>
    <p>
        Ihre IP-Adresse wird vor der Speicherung anonymisiert:
    </p>
    <pre><code>Original:      192.168.1.42
Anonymisiert:  192.168.1.0
→ Kein Personenbezug mehr möglich</code></pre>
    
    <h3>5.5 Löschfristen</h3>
    <table class="data-table">
        <thead>
            <tr>
                <th>Datenart</th>
                <th>Löschfrist</th>
                <th>Grund</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Anonymisierte IP-Adresse</td>
                <td>30 Tage</td>
                <td>Nachweis Jugendschutz (JMStV)</td>
            </tr>
            <tr>
                <td>Geburtsdatum</td>
                <td>30 Tage</td>
                <td>Nachweis Altersverifikation</td>
            </tr>
            <tr>
                <td>Verifikations-Timestamp</td>
                <td>30 Tage</td>
                <td>Audit-Trail</td>
            </tr>
            <tr>
                <td>LocalStorage-Eintrag</td>
                <td>30 Tage oder bei Browserdaten-Löschung</td>
                <td>Client-seitige Speicherung</td>
            </tr>
        </tbody>
    </table>
</section>
```

---

## 3. 🔞 Jugendschutz & Age-Gate testen

### Status: ⚠️ TODO

### Test-Szenarien:

#### **Test 1: FSK0 (Ohne Age-Gate)**
```
Schritte:
1. Kategorie-Auswahl öffnen
2. FSK0-Kategorie auswählen
3. Spiel starten

Erwartetes Ergebnis:
✅ Kein Age-Gate wird angezeigt
✅ Fragen laden normal
✅ Kein FSK-Badge wird angezeigt
```

#### **Test 2: FSK16 (Mit Age-Gate)**
```
Schritte:
1. Kategorie-Auswahl öffnen
2. FSK16-Kategorie auswählen
3. Age-Gate sollte erscheinen
4. Geburtsdatum eingeben (z.B. 01.01.2005 - 21 Jahre alt)
5. Bestätigen

Erwartetes Ergebnis:
✅ Age-Gate wird angezeigt
✅ Nach korrektem Alter: Zugriff gewährt
✅ FSK16-Badge wird im Spiel angezeigt
✅ localStorage hat "nocap_age_verification" Eintrag
```

#### **Test 3: FSK16 (Zu jung)**
```
Schritte:
1. FSK16-Kategorie auswählen
2. Age-Gate erscheint
3. Geburtsdatum eingeben (z.B. 01.01.2015 - 11 Jahre alt)
4. Bestätigen

Erwartetes Ergebnis:
✅ Age-Gate zeigt Fehlermeldung
❌ Zugriff wird verweigert
✅ Redirect zur Kategorie-Auswahl
✅ Toast: "Du musst mindestens 16 Jahre alt sein"
```

#### **Test 4: FSK18 (Server-Side Validation)**
```
Schritte:
1. FSK18-Kategorie auswählen
2. Age-Gate passieren (18+)
3. DevTools öffnen
4. Versuchen, FSK18-Fragen ohne Custom Claim abzurufen

Erwartetes Ergebnis:
✅ Age-Gate funktioniert client-side
✅ Server prüft Custom Claim "ageVerified18: true"
❌ OHNE Claim: Firebase Rules blockieren Zugriff
✅ MIT Claim: Fragen werden geladen
✅ FSK18-Badge wird angezeigt
```

---

### 🔍 Checkliste Jugendschutz:

- [ ] **Age-Gate UI**: Formularclosed existiert und ist benutzerfreundlich
- [ ] **FSK0**: Keine Altersprüfung erforderlich
- [ ] **FSK16**: Age-Gate ab 16 Jahren
- [ ] **FSK18**: Age-Gate ab 18 Jahren
- [ ] **Custom Claims**: Firebase Custom Claims werden gesetzt
- [ ] **Server-Validation**: Database Rules prüfen Custom Claims
- [ ] **FSK-Badges**: Werden im UI korrekt angezeigt
- [ ] **IP-Logging**: Anonymisiert gespeichert
- [ ] **Auto-Delete**: 30-Tage-Löschung implementiert
- [ ] **Error-Handling**: Zu junge User werden abgewiesen
- [ ] **LocalStorage**: Age-Verification wird gespeichert (30 Tage)

---

## 4. 📧 Kontakt-/Löschweg anbieten

### Status: ⚠️ TODO

### Zu implementieren:

#### **A. Kontakt-E-Mail einrichten**

Empfohlene E-Mail-Adressen:
- `kontakt@no-cap.app` - Allgemeine Anfragen
- `datenschutz@no-cap.app` - DSGVO-Anfragen
- `loeschung@no-cap.app` - Löschanfragen

#### **B. Abschnitt in privacy.html ergänzen**

```html
<section id="deletion-request">
    <h2>8. Ihre Rechte als betroffene Person</h2>
    
    <h3>8.1 Auskunftsrecht</h3>
    <p>
        Sie haben das Recht, Auskunft über die von uns gespeicherten personenbezogenen Daten zu erhalten.
    </p>
    
    <h3>8.2 Recht auf Berichtigung</h3>
    <p>
        Sie haben das Recht, die Berichtigung unrichtiger oder die Vervollständigung unvollständiger 
        personenbezogener Daten zu verlangen.
    </p>
    
    <h3>8.3 Recht auf Löschung ("Recht auf Vergessenwerden")</h3>
    <p>
        Sie haben das Recht, die Löschung Ihrer personenbezogenen Daten zu verlangen.
    </p>
    
    <h4>So beantragen Sie die Löschung Ihrer Daten:</h4>
    
    <div class="deletion-process">
        <h5>Schritt 1: Löschanfrage stellen</h5>
        <p>
            Senden Sie eine E-Mail an:<br>
            <a href="mailto:datenschutz@no-cap.app">datenschutz@no-cap.app</a>
        </p>
        <p>
            Bitte geben Sie an:
        </p>
        <ul>
            <li>Ihre E-Mail-Adresse (falls Sie ein Konto haben)</li>
            <li>Ihre User-ID (finden Sie in den Einstellungen)</li>
            <li>Welche Daten gelöscht werden sollen</li>
        </ul>
        
        <h5>Schritt 2: Identitätsprüfung</h5>
        <p>
            Um Missbrauch zu vermeiden, müssen wir Ihre Identität prüfen. 
            Wir senden Ihnen eine Bestätigungs-E-Mail an die hinterlegte Adresse.
        </p>
        
        <h5>Schritt 3: Löschung durchführen</h5>
        <p>
            Nach Bestätigung Ihrer Identität löschen wir innerhalb von 
            <strong>14 Tagen</strong> folgende Daten:
        </p>
        <ul>
            <li>✅ Ihr Benutzer-Account (Firebase Auth)</li>
            <li>✅ Alle Spielstände (Realtime Database)</li>
            <li>✅ Hochgeladene Avatare (Storage)</li>
            <li>✅ LocalStorage-Einträge (Sie müssen Browser-Daten selbst löschen)</li>
            <li>✅ Altersverifikations-Daten</li>
        </ul>
        
        <h5>Schritt 4: Bestätigung</h5>
        <p>
            Sie erhalten eine Bestätigungs-E-Mail, sobald die Löschung abgeschlossen ist.
        </p>
    </div>
    
    <h4>Welche Daten können NICHT gelöscht werden?</h4>
    <p>
        Aus rechtlichen Gründen müssen wir folgende Daten aufbewahren:
    </p>
    <ul>
        <li>📋 Rechnungen und Zahlungsdaten (Steuerrecht: 10 Jahre)</li>
        <li>📋 Anonymisierte Nutzungsstatistiken (kein Personenbezug)</li>
    </ul>
    
    <h3>8.4 Bearbeitungszeit</h3>
    <table class="data-table">
        <thead>
            <tr>
                <th>Anfrage-Typ</th>
                <th>Bearbeitungszeit</th>
                <th>Gesetzliche Frist</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Auskunftsanfrage</td>
                <td>7 Tage</td>
                <td>30 Tage (DSGVO Art. 15)</td>
            </tr>
            <tr>
                <td>Löschanfrage</td>
                <td>14 Tage</td>
                <td>30 Tage (DSGVO Art. 17)</td>
            </tr>
            <tr>
                <td>Berichtigungsanfrage</td>
                <td>7 Tage</td>
                <td>30 Tage (DSGVO Art. 16)</td>
            </tr>
        </tbody>
    </table>
    
    <h3>8.5 Kontakt Datenschutz</h3>
    <div class="contact-box">
        <p>
            <strong>E-Mail:</strong> 
            <a href="mailto:datenschutz@no-cap.app">datenschutz@no-cap.app</a>
        </p>
        <p>
            <strong>Postanschrift:</strong><br>
            [Ihr Name/Firma]<br>
            [Straße Hausnummer]<br>
            [PLZ Ort]
        </p>
    </div>
    
    <h3>8.6 Beschwerderecht bei Aufsichtsbehörde</h3>
    <p>
        Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren:
    </p>
    <div class="authority-box">
        <p>
            <strong>Zuständig für [Bundesland]:</strong><br>
            [Name der Landesdatenschutzbehörde]<br>
            [Adresse]<br>
            Website: <a href="[URL]" target="_blank">[URL]</a>
        </p>
    </div>
</section>
```

---

### ✅ Checkliste Löschweg:

- [ ] **E-Mail eingerichtet**: datenschutz@no-cap.app
- [ ] **Automatische Antwort**: "Ihre Anfrage wurde empfangen"
- [ ] **Prozess dokumentiert**: In privacy.html beschrieben
- [ ] **Verantwortlicher benannt**: Wer bearbeitet Anfragen?
- [ ] **Fristen eingehalten**: Max. 30 Tage (DSGVO)
- [ ] **Identitätsprüfung**: Prozess definiert
- [ ] **Lösch-Script**: Automatisierung für Account-Deletion
- [ ] **Bestätigungs-E-Mail**: Template erstellt
- [ ] **Test durchgeführt**: Löschanfrage getestet
- [ ] **Aufbewahrungspflichten**: Dokumentiert (Rechnungen etc.)

---

## 📋 Deployment Checkliste - Rechtliches

### Impressum:
- [ ] IHK Generator verwendet
- [ ] Alle Pflichtangaben vorhanden
- [ ] imprint.html aktualisiert
- [ ] Link im Footer aller Seiten
- [ ] Von allen Seiten erreichbar

### Datenschutz:
- [ ] Alle Dienste aufgelistet (Firebase, Stripe, etc.)
- [ ] Cookie-Tabelle vollständig
- [ ] IP-Logging dokumentiert
- [ ] Löschfristen angegeben
- [ ] privacy.html aktualisiert
- [ ] Cookie-Banner integriert
- [ ] Von allen Seiten erreichbar

### Jugendschutz:
- [ ] Age-Gate für FSK16 getestet
- [ ] Age-Gate für FSK18 getestet
- [ ] Server-Side Validation aktiv
- [ ] Custom Claims funktionieren
- [ ] IP-Logging anonymisiert
- [ ] 30-Tage Auto-Delete
- [ ] FSK-Badges korrekt angezeigt

### Löschweg:
- [ ] E-Mail eingerichtet
- [ ] Prozess dokumentiert
- [ ] Identitätsprüfung definiert
- [ ] Fristen kommuniziert
- [ ] Test-Löschung durchgeführt
- [ ] Bestätigungs-E-Mail funktioniert

---

## 🔗 Nützliche Links

- **IHK Impressum-Generator**: https://www.ihk.de/impressumsgenerator
- **DSGVO-Generator**: https://dsgvo-gesetz.de/generator/
- **Jugendmedienschutz-Staatsvertrag**: https://www.kjm-online.de/aufsicht/rechtsgrundlagen
- **Datenschutz-Aufsichtsbehörden**: https://www.bfdi.bund.de/DE/Infothek/Anschriften_Links/anschriften_links-node.html

---

## ✅ Status

**Rechtliche Anforderungen**: ⚠️ **IN PROGRESS**

**Nächste Schritte**:
1. Impressum mit echten Daten ausfüllen
2. Datenschutzerklärung aktualisieren
3. Age-Gate auf allen Flows testen
4. Lösch-E-Mail einrichten und testen

**Ziel**: 100% DSGVO & JuSchG Compliance! 🎯

