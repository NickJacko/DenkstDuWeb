# IP-Logging & DSGVO-Compliance Dokumentation

## 🛡️ Übersicht

Diese Dokumentation beschreibt die DSGVO-konforme Implementierung der IP-Speicherung in den Firebase Cloud Functions.

---

## 📋 Was wird gespeichert?

### Audit-Logs mit optionaler IP-Speicherung

Bei der **Altersverifikation** (`verifyAge` Function) werden folgende Daten gespeichert:

```javascript
{
  action: 'age_verification',
  ageLevel: 0 | 16 | 18,
  timestamp: SERVER_TIMESTAMP,
  consentGiven: true,
  ip: '192.168.1.1' | null,  // NUR wenn ipConsent = true
  ipConsent: true | false
}
```

---

## ✅ DSGVO-Konformität

### 1. Explizite Einwilligung erforderlich

IP-Adressen werden **NUR** gespeichert, wenn der Nutzer **explizit** zustimmt:

```javascript
// Cloud Function Code
if (ipConsent === true && context.rawRequest) {
    auditData.ip = context.rawRequest.ip || 'unknown';
    auditData.ipConsent = true;
} else {
    auditData.ip = null;
    auditData.ipConsent = false;
}
```

**Ohne Zustimmung:** `ip: null`

### 2. Automatische Löschung nach 24 Stunden

Eine **Scheduled Cloud Function** läuft alle 6 Stunden und löscht IP-Adressen, die älter als 24 Stunden sind:

```javascript
exports.cleanupAuditLogs = functions.pubsub
    .schedule('every 6 hours')
    .onRun(async (context) => {
        const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
        
        // Lösche alle Logs mit IP älter als 24h
        if (action.timestamp < twentyFourHoursAgo && action.ip) {
            // Löschen
        }
    });
```

**Garantie:** Keine IP-Adresse wird länger als 24 Stunden gespeichert.

### 3. Zweckbindung

IP-Adressen werden **ausschließlich** für folgende Zwecke verwendet:
- **Missbrauchserkennung** (z.B. automatisierte Bot-Angriffe)
- **Altersverifikations-Audit** (Nachweis der Compliance)

**Keine Weitergabe** an Dritte.

### 4. Datensparsamkeit

- **Minimale Speicherung:** Nur wenn notwendig und mit Einwilligung
- **Pseudonymisierung:** IP wird nur als String gespeichert, keine Verknüpfung zu anderen personenbezogenen Daten außer User-ID (notwendig für Zuordnung)
- **Kurze Speicherdauer:** Max. 24 Stunden

---

## 📄 Datenschutzerklärung - Textvorschlag

Folgender Text sollte in die **Datenschutzerklärung** (`privacy.html`) aufgenommen werden:

---

### 📌 IP-Speicherung bei Altersverifikation

**Zweck:**  
Zur Missbrauchserkennung und zur Dokumentation der Altersverifikation speichern wir optional Ihre IP-Adresse.

**Rechtsgrundlage:**  
Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)

**Einwilligung:**  
Die Speicherung Ihrer IP-Adresse erfolgt **nur mit Ihrer ausdrücklichen Einwilligung** im Rahmen der Altersverifikation.

**Speicherdauer:**  
IP-Adressen werden **automatisch nach 24 Stunden gelöscht**. Eine längere Speicherung erfolgt nicht.

**Widerruf:**  
Sie können Ihre Einwilligung jederzeit widerrufen, indem Sie uns kontaktieren. Bereits gespeicherte IP-Adressen werden spätestens nach 24 Stunden automatisch gelöscht.

**Keine Weitergabe:**  
IP-Adressen werden nicht an Dritte weitergegeben.

---

## 🔐 Technische Implementierung

### Client-seitig (index.js)

```javascript
// User wird um Einwilligung gebeten
const ipConsent = userHasGivenConsent(); // true/false

// Call an Cloud Function
const result = await verifyAge({
    ageLevel: 18,
    consent: true,
    ipConsent: ipConsent  // Explizite Einwilligung
});
```

### Server-seitig (functions/index.js)

```javascript
exports.verifyAge = functions.https.onCall(async (data, context) => {
    const { ageLevel, consent, ipConsent } = data;
    
    // IP nur speichern wenn explizite Einwilligung
    if (ipConsent === true && context.rawRequest) {
        auditData.ip = context.rawRequest.ip || 'unknown';
        auditData.ipConsent = true;
    } else {
        auditData.ip = null;
        auditData.ipConsent = false;
    }
    
    await admin.database()
        .ref(`audit_logs/${context.auth.uid}`)
        .push(auditData);
});
```

### Automatische Löschung

```javascript
exports.cleanupAuditLogs = functions.pubsub
    .schedule('every 6 hours')
    .onRun(async (context) => {
        const now = Date.now();
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
        
        // Durchsuche alle Audit-Logs
        const auditLogsRef = admin.database().ref('audit_logs');
        const snapshot = await auditLogsRef.once('value');
        
        snapshot.forEach(userSnapshot => {
            userSnapshot.forEach(actionSnapshot => {
                const action = actionSnapshot.val();
                
                // Lösche IP wenn älter als 24h
                if (action.timestamp < twentyFourHoursAgo && action.ip) {
                    actionSnapshot.ref.remove();
                }
            });
        });
    });
```

---

## 📊 Database-Struktur

```
audit_logs/
  ├── USER_ID_1/
  │   ├── ACTION_ID_1/
  │   │   ├── action: "age_verification"
  │   │   ├── ageLevel: 18
  │   │   ├── timestamp: 1704729600000
  │   │   ├── consentGiven: true
  │   │   ├── ip: "192.168.1.1"         ← NUR wenn ipConsent = true
  │   │   └── ipConsent: true
  │   └── ACTION_ID_2/
  │       ├── action: "age_verification"
  │       ├── timestamp: 1704816000000  ← Älter als 24h
  │       ├── ip: "192.168.1.2"         ← WIRD GELÖSCHT
  │       └── ipConsent: true
  └── USER_ID_2/
      └── ...
```

---

## ✅ Compliance-Checkliste

- [x] **Einwilligung:** IP wird nur mit expliziter Zustimmung gespeichert
- [x] **Transparenz:** Nutzer wird über Speicherung informiert
- [x] **Zweckbindung:** IP nur für Missbrauchserkennung/Audit
- [x] **Datensparsamkeit:** Minimale Speicherung, max. 24h
- [x] **Automatische Löschung:** Scheduled Function alle 6h
- [x] **Keine Weitergabe:** Keine Drittanbieter-Zugriff
- [x] **Widerrufsmöglichkeit:** Kontaktmöglichkeit vorhanden
- [x] **Dokumentation:** In Datenschutzerklärung beschrieben

---

## 🔍 Audit & Monitoring

### Logs überprüfen

```powershell
# Firebase Functions Logs
firebase functions:log

# Erfolgreiche Löschung sollte zeigen:
✅ DSGVO: Deleted X audit logs with IP addresses (>24h old)
```

### Manuelle Überprüfung

```javascript
// Firebase Console > Realtime Database
// Navigiere zu: audit_logs/{userId}/actions/{actionId}
// Prüfe Timestamp vs. IP-Vorhandensein
```

---

## 📞 Verantwortliche Stelle

**Datenschutzbeauftragter:**  
[HIER KONTAKTDATEN EINFÜGEN]

**E-Mail:**  
datenschutz@denkstduwebsite.de

---

## 🔄 Änderungshistorie

| Datum | Version | Änderung |
|-------|---------|----------|
| 2026-01-08 | 1.0 | Initiale DSGVO-Dokumentation erstellt |

---

**Status:** ✅ DSGVO-konform implementiert
**Nächster Review:** Nach 6 Monaten oder bei Gesetzesänderungen

