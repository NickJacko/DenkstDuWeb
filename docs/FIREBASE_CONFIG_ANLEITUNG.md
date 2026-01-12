# 🚀 FIREBASE CONFIG - EINFACHE ANLEITUNG

**Was du noch manuell machen musst (ca. 10-15 Minuten)**

---

## ✅ WAS SCHON FERTIG IST

Der Code in `firebase-config.js` ist **komplett fertig**:
- ✅ Keine Dev-Keys mehr im Code
- ✅ HMAC-Signatur-Prüfung implementiert
- ✅ Offline-Timeout (30 Sekunden)
- ✅ Connection-Monitoring aktiviert

---

## 📋 WAS DU NOCH MACHEN MUSST (3 Schritte)

### **Schritt 1: Keys generieren** (einmalig, 2 Minuten)

#### Windows (PowerShell):
```powershell
# Im Projekt-Ordner ausführen:
.\setup-firebase-signing.ps1
```

Das Script macht:
1. Generiert `private.pem` (geheim!)
2. Generiert `public.pem` (öffentlich)
3. Fügt `private.pem` zu `.gitignore` hinzu
4. Zeigt dir den Public Key an

#### Alternative (ohne OpenSSL):
Falls das Script nicht funktioniert, kannst du Online-Tools nutzen:
- https://travistidwell.com/jsencrypt/demo/
- Wähle "2048 bit"
- Klicke "Generate New Keys"
- Speichere beide Keys

---

### **Schritt 2: Public Key in HTML einfügen** (5 Minuten)

Kopiere den Public Key (aus der Ausgabe von Schritt 1) und füge ihn in **alle** HTML-Dateien ein:

**Wo:** Im `<head>`-Bereich, nach den anderen Meta-Tags

**Was einfügen:**
```html
<head>
    <!-- ... andere Meta-Tags ... -->
    
    <!-- Firebase Config Public Key -->
    <meta name="domain-whitelist-public-key" content="-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
...dein generierter Key hier...
-----END PUBLIC KEY-----">
</head>
```

**WICHTIG:** 
- Den Key als **eine Zeile** einfügen (ohne Zeilenumbrüche im `content=""`)
- In ALLEN HTML-Dateien (index.html, gameplay.html, etc.)

**Dateien die es brauchen:**
```
index.html
category-selection.html
difficulty-selection.html
player-setup.html
gameplay.html
join-game.html
multiplayer-category-selection.html
multiplayer-difficulty-selection.html
multiplayer-lobby.html
multiplayer-gameplay.html
multiplayer-results.html
```

---

### **Schritt 3: Whitelist signieren** (2 Minuten, vor jedem Deploy)

Jedes Mal wenn du `allowed-domains.json` änderst oder deployed:

```powershell
# Im Projekt-Ordner:
node build-scripts/sign-whitelist.js
```

Das Script:
1. Liest `allowed-domains.json`
2. Erstellt Signatur mit `private.pem`
3. Fügt Signatur zur JSON hinzu
4. Speichert die signierte Version

**Nach jedem Domain-Update wiederholen!**

---

## 🎯 OPTIONAL: Firebase Config in HTML

Für Production solltest du die Firebase-Keys **nicht** im Code haben.

**Empfehlung:** Füge in **index.html** VOR dem `firebase-config.js` Script ein:

```html
<script>
  // Firebase Config (aus Environment Variables)
  window.FIREBASE_CONFIG = {
    apiKey: "AIzaSyC_cu_2X2uFCPcxYetxIUHi2v56F1Mz0Vk",
    authDomain: "denkstduwebsite.firebaseapp.com",
    databaseURL: "https://denkstduwebsite-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "denkstduwebsite",
    storageBucket: "denkstduwebsite.appspot.com",
    messagingSenderId: "27029260611",
    appId: "1:27029260611:web:3c7da4db0bf92e8ce247f6",
    measurementId: "G-BNKNW95HK8"
  };
</script>
<script src="assets/js/firebase-config.js"></script>
```

**Später:** Diese Werte aus Environment Variables laden (Build-Process)

---

## ✅ TESTE OB ES FUNKTIONIERT

### 1. Browser-Console öffnen (F12)

### 2. Prüfe Connection Monitoring:
```javascript
// Sollte grün anzeigen:
// 🟢 Firebase verbunden
```

### 3. Prüfe Offline-Mode (optional):
```javascript
// Gehe offline (DevTools -> Network -> Offline)
// Nach 30 Sekunden sollte erscheinen:
// 📴 Offline-Modus aktiviert
```

### 4. Prüfe Signatur (wenn Keys eingefügt):
```javascript
// In der Console sollte NICHT erscheinen:
// ❌ SECURITY: Domain whitelist signature verification failed
```

---

## 🔒 SICHERHEITS-CHECKLISTE

Vor Production-Deployment:

- [ ] Private Key (`private.pem`) ist in `.gitignore`
- [ ] Private Key ist **NICHT** in Git commited
- [ ] Public Key ist in allen HTML-Dateien
- [ ] `allowed-domains.json` ist signiert
- [ ] Firebase Config ist in `window.FIREBASE_CONFIG`
- [ ] Dev-Fallback ist entfernt (schon erledigt ✅)

---

## 📝 ZUSAMMENFASSUNG

**Was du tun musst:**

1. **Einmalig:** PowerShell-Script ausführen → Keys generieren
2. **Einmalig:** Public Key in alle HTML-Dateien kopieren
3. **Bei jedem Deploy:** Whitelist signieren (Node-Script)

**Das war's!** 🎉

**Zeit:** ~15 Minuten einmalig + 2 Minuten pro Deployment

---

## ❓ PROBLEME?

### "OpenSSL not found"
→ Installiere OpenSSL: https://slproweb.com/products/Win32OpenSSL.html
→ Oder nutze Online-Tool (siehe Schritt 1)

### "Signature verification failed"
→ Stelle sicher Public Key in HTML ist
→ Führe `sign-whitelist.js` nochmal aus

### "Firebase config not found"
→ Füge `window.FIREBASE_CONFIG` vor `firebase-config.js` ein

---

**Fertig?** Dann teste es im Browser! 🚀

