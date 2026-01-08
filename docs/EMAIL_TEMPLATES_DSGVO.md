# E-Mail-Templates für DSGVO-Anfragen

## 📧 Template-Sammlung für Datenschutz-Anfragen

Diese Templates können für die Beantwortung von DSGVO-Anfragen verwendet werden.

---

## 1. ✅ Automatische Empfangsbestätigung

**Betreff**: Ihre Datenschutz-Anfrage wurde empfangen - No-Cap

```
Guten Tag,

vielen Dank für Ihre Anfrage bezüglich Ihrer personenbezogenen Daten bei No-Cap.

Wir haben Ihre Anfrage erhalten und werden diese gemäß den Bestimmungen der DSGVO 
bearbeiten. Sie können mit einer Antwort innerhalb von 30 Tagen (gesetzliche Frist) 
rechnen. In der Regel bearbeiten wir Anfragen jedoch deutlich schneller (7-14 Tage).

**Details Ihrer Anfrage:**
- Eingangsdatum: [DATUM]
- Anfrage-ID: [AUTO-GENERIERTE-ID]
- Anfrage-Typ: [Auskunft/Löschung/Berichtigung]

**Nächste Schritte:**
1. Wir prüfen Ihre Identität
2. Wir bearbeiten Ihre Anfrage
3. Sie erhalten eine Bestätigung per E-Mail

Falls Sie Rückfragen haben, antworten Sie einfach auf diese E-Mail.

Mit freundlichen Grüßen
Das No-Cap Team

---
E-Mail: datenschutz@no-cap.app
Website: https://no-cap.app
```

---

## 2. 🔍 Auskunftsanfrage - Antwort

**Betreff**: Ihre Datenschutz-Auskunft - No-Cap [Anfrage-ID]

```
Guten Tag,

gemäß Ihrer Anfrage vom [DATUM] erhalten Sie hiermit Auskunft über die von uns 
gespeicherten personenbezogenen Daten.

**Gespeicherte Daten:**

1. **Firebase Authentication:**
   - User-ID: [UID]
   - E-Mail-Adresse: [E-MAIL] (falls vorhanden)
   - Erstellungsdatum: [DATUM]
   - Letzter Login: [DATUM]
   - Anmeldemethode: [Anonym/E-Mail/Google]

2. **Spielstand-Daten (Realtime Database):**
   - Anzahl gespielte Spiele: [ANZAHL]
   - Anzahl gehostete Spiele: [ANZAHL]
   - Letzte Aktivität: [DATUM]
   - Gespeicherte Spielstände: [JA/NEIN]

3. **Hochgeladene Dateien (Storage):**
   - Avatar: [JA/NEIN]
   - Avatar-URL: [URL oder "Kein Avatar"]
   - Größe: [KB]
   - Upload-Datum: [DATUM]

4. **Altersverifikation:**
   - Status: [Verifiziert/Nicht verifiziert]
   - Verifikationsdatum: [DATUM]
   - FSK-Level: [0/16/18]
   - IP-Adresse (anonymisiert): [192.168.1.0] (wird nach 30 Tagen gelöscht)

5. **Cookie-Einstellungen:**
   - Cookie-Consent: [Akzeptiert/Abgelehnt]
   - Analytics: [Aktiviert/Deaktiviert]
   - Funktionale Cookies: [Aktiviert/Deaktiviert]

6. **Premium-Status:**
   - Premium aktiv: [JA/NEIN]
   - Premium seit: [DATUM oder "Nicht vorhanden"]

**Ihre Rechte:**

Sie haben jederzeit das Recht auf:
- Berichtigung unrichtiger Daten
- Löschung Ihrer Daten
- Einschränkung der Verarbeitung
- Datenübertragbarkeit
- Widerspruch gegen die Verarbeitung

Um eines dieser Rechte auszuüben, antworten Sie einfach auf diese E-Mail.

**Hinweis:** Diese Auskunft ist eine Momentaufnahme zum Zeitpunkt [DATUM, UHRZEIT].

Mit freundlichen Grüßen
Das No-Cap Team

---
E-Mail: datenschutz@no-cap.app
Website: https://no-cap.app
```

---

## 3. 🗑️ Löschanfrage - Bestätigung & Identitätsprüfung

**Betreff**: Bestätigung Ihrer Löschanfrage erforderlich - No-Cap [Anfrage-ID]

```
Guten Tag,

Sie haben eine Löschung Ihrer personenbezogenen Daten bei No-Cap beantragt.

Um Missbrauch zu vermeiden, müssen wir Ihre Identität verifizieren.

**Bitte bestätigen Sie Ihre Anfrage:**

Klicken Sie auf den folgenden Link, um Ihre Identität zu bestätigen:
[BESTÄTIGUNGS-LINK mit Token, gültig 48 Stunden]

Alternativ antworten Sie auf diese E-Mail mit dem Bestätigungscode:
**Code: [6-STELLIGER CODE]**

**Was wird gelöscht:**

Nach Bestätigung Ihrer Identität löschen wir innerhalb von 14 Tagen:
✅ Ihr Benutzer-Account (Firebase Auth)
✅ Alle Spielstände (Realtime Database)
✅ Hochgeladene Avatare (Storage)
✅ Altersverifikations-Daten
✅ Cookie-Einstellungen

**Hinweis:** Diese Aktion kann nicht rückgängig gemacht werden!

**Nicht gelöscht werden können:**
- Anonymisierte Nutzungsstatistiken (kein Personenbezug)
- Rechnungen (steuerrechtliche Aufbewahrungspflicht: 10 Jahre)

Wenn Sie diese Anfrage NICHT gestellt haben, ignorieren Sie diese E-Mail oder 
melden Sie sich umgehend bei uns.

Mit freundlichen Grüßen
Das No-Cap Team

---
E-Mail: datenschutz@no-cap.app
Website: https://no-cap.app
```

---

## 4. ✅ Löschung abgeschlossen - Bestätigung

**Betreff**: Ihre Daten wurden gelöscht - No-Cap [Anfrage-ID]

```
Guten Tag,

Ihre Löschanfrage vom [DATUM] wurde erfolgreich bearbeitet.

**Gelöschte Daten:**

✅ Firebase Auth Account: Gelöscht
✅ Spielstand-Daten: [X] Spiele gelöscht
✅ Storage-Dateien: [X] Dateien gelöscht
✅ Altersverifikation: Gelöscht
✅ Cookie-Einstellungen: Gelöscht

**Durchgeführt am:** [DATUM, UHRZEIT]

**Was bedeutet das?**

- Sie können sich nicht mehr mit Ihrem vorherigen Account anmelden
- Alle Ihre Spielstände sind unwiederbringlich gelöscht
- Hochgeladene Avatare wurden entfernt
- Sie müssen ein neues Konto erstellen, um No-Cap erneut zu nutzen

**Aufbewahrte Daten (rechtliche Verpflichtung):**

- Rechnungen und Zahlungsdaten: 10 Jahre (Steuerrecht)
- Anonymisierte Nutzungsstatistiken: Kein Personenbezug, daher nicht löschpflichtig

**Weitere Schritte:**

Um auch lokale Daten zu löschen:
1. Öffnen Sie die No-Cap Website
2. Öffnen Sie die Entwicklertools (F12)
3. Gehen Sie zu "Application" → "Local Storage"
4. Klicken Sie auf "Clear All"
5. Löschen Sie Ihre Browser-Cookies für no-cap.app

Vielen Dank, dass Sie No-Cap genutzt haben!

Mit freundlichen Grüßen
Das No-Cap Team

---
E-Mail: datenschutz@no-cap.app
Website: https://no-cap.app
```

---

## 5. 🔧 Berichtigungsanfrage - Bestätigung

**Betreff**: Ihre Daten wurden berichtigt - No-Cap [Anfrage-ID]

```
Guten Tag,

Ihre Berichtigungsanfrage vom [DATUM] wurde erfolgreich bearbeitet.

**Geänderte Daten:**

[DETAILLIERTE LISTE DER ÄNDERUNGEN]

Beispiel:
- E-Mail-Adresse: alt@example.com → neu@example.com
- Spielername: "Alter Name" → "Neuer Name"
- Avatar: Aktualisiert

**Durchgeführt am:** [DATUM, UHRZEIT]

Die Änderungen sind ab sofort wirksam.

Falls Sie weitere Berichtigungen wünschen, antworten Sie einfach auf diese E-Mail.

Mit freundlichen Grüßen
Das No-Cap Team

---
E-Mail: datenschutz@no-cap.app
Website: https://no-cap.app
```

---

## 6. ❌ Anfrage abgelehnt - Begründung

**Betreff**: Ihre Datenschutz-Anfrage [Anfrage-ID]

```
Guten Tag,

Ihre Anfrage vom [DATUM] konnte leider nicht bearbeitet werden.

**Grund:**

[WÄHLEN SIE EINEN:]

1. **Identität konnte nicht verifiziert werden:**
   Die von Ihnen angegebene E-Mail-Adresse stimmt nicht mit unseren Daten überein.
   Bitte verwenden Sie die E-Mail-Adresse, mit der Sie sich registriert haben.

2. **Keine Daten vorhanden:**
   Wir konnten keine Daten zu Ihrer Anfrage finden. Möglicherweise haben Sie sich
   mit einer anderen E-Mail-Adresse registriert oder Ihr Account wurde bereits gelöscht.

3. **Aufbewahrungspflicht:**
   Einige Daten unterliegen einer gesetzlichen Aufbewahrungspflicht (z.B. Rechnungen).
   Diese können erst nach Ablauf der Frist gelöscht werden.

**Weitere Schritte:**

[INDIVIDUELL JE NACH GRUND]

Falls Sie Rückfragen haben, antworten Sie bitte auf diese E-Mail mit zusätzlichen 
Informationen, die uns helfen, Ihre Anfrage zu bearbeiten.

Mit freundlichen Grüßen
Das No-Cap Team

---
E-Mail: datenschutz@no-cap.app
Website: https://no-cap.app
```

---

## 7. 📋 Datenübertragbarkeit - Export

**Betreff**: Ihr Daten-Export - No-Cap [Anfrage-ID]

```
Guten Tag,

gemäß Artikel 20 DSGVO (Recht auf Datenübertragbarkeit) erhalten Sie hiermit Ihre
personenbezogenen Daten in einem strukturierten, gängigen und maschinenlesbaren Format.

**Anhang:**
- user_data_export.json (Ihre Daten im JSON-Format)

**Inhalt des Exports:**

Der JSON-Export enthält:
- Benutzerprofil (User-ID, E-Mail, Erstellungsdatum)
- Spielstände
- Einstellungen
- Cookie-Präferenzen
- Premium-Status

**Verwendung:**

Sie können diese Daten:
- Sichern (Backup)
- An einen anderen Dienst übertragen
- Einsehen und prüfen

**Technische Details:**

- Format: JSON (JavaScript Object Notation)
- Encoding: UTF-8
- Erstellt am: [DATUM, UHRZEIT]
- Größe: [DATEIGRÖSSE] KB

Falls Sie Fragen zur Verwendung der Daten haben, stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Das No-Cap Team

---
E-Mail: datenschutz@no-cap.app
Website: https://no-cap.app
```

---

## 📋 Verwendungshinweise

### Automatisierung

1. **E-Mail-Versand automatisieren:**
   - Nutzen Sie Firebase Functions mit Nodemailer
   - Oder: Gmail API
   - Oder: SendGrid/Mailgun

2. **Platzhalter ersetzen:**
   ```javascript
   const template = emailTemplate
     .replace('[DATUM]', new Date().toLocaleDateString('de-DE'))
     .replace('[UID]', userId)
     .replace('[E-MAIL]', userEmail);
   ```

3. **Bestätigungscodes generieren:**
   ```javascript
   const code = Math.random().toString(36).substring(2, 8).toUpperCase();
   ```

### Rechtliche Fristen (DSGVO)

- **Auskunft**: 30 Tage (Art. 15)
- **Löschung**: 30 Tage (Art. 17)
- **Berichtigung**: 30 Tage (Art. 16)
- **Datenübertragbarkeit**: 30 Tage (Art. 20)

### Wichtige Hinweise

- ✅ Immer innerhalb von 30 Tagen antworten
- ✅ Identität prüfen (Sicherheit)
- ✅ Schriftlich bestätigen (Nachweis)
- ✅ Höflich und professionell bleiben
- ✅ Gesetzliche Aufbewahrungspflichten beachten

---

## 🔒 Datenschutz bei E-Mails

- Verwenden Sie BCC für Massen-E-Mails
- Verschlüsseln Sie sensible Anhänge
- Löschen Sie E-Mails nach Bearbeitung gemäß Löschkonzept
- Speichern Sie nur notwendige E-Mail-Korrespondenz

---

**Status**: ✅ Ready for Use  
**Version**: 1.0  
**Letzte Aktualisierung**: 8. Januar 2026

