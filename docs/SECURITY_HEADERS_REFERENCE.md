# Firebase Security Headers – Quick Reference

## 🔒 Alle aktiven Security Headers

### 1. Transport Security
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```
- **Zweck:** HTTPS erzwingen
- **Dauer:** 2 Jahre
- **Subdomains:** Inklusive
- **Preload:** Bereit für HSTS Preload Liste

---

### 2. Content Security Policy (CSP)
```
Content-Security-Policy: default-src 'self'; 
  script-src 'self' https://www.gstatic.com https://apis.google.com 
    https://firebase.googleapis.com https://www.google.com 
    https://identitytoolkit.googleapis.com https://securetoken.googleapis.com 
    'unsafe-eval'; 
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; 
  connect-src 'self' https://firebasestorage.googleapis.com 
    https://firebase.googleapis.com https://identitytoolkit.googleapis.com 
    https://securetoken.googleapis.com https://www.googleapis.com 
    wss://*.firebaseio.com; 
  img-src 'self' data: https:; 
  font-src 'self' https://fonts.gstatic.com data:; 
  frame-ancestors 'none'; 
  base-uri 'self'; 
  form-action 'self'; 
  object-src 'none'; 
  upgrade-insecure-requests
```

**Erlaubte Quellen:**
- ✅ Eigene Domain (`'self'`)
- ✅ Firebase SDK (gstatic.com, googleapis.com)
- ✅ Google Fonts
- ✅ WebSocket für Realtime DB (wss://*.firebaseio.com)

**Blockiert:**
- ❌ Inline Scripts (außer unsafe-eval für Firebase)
- ❌ Iframes von anderen Domains
- ❌ Flash/Java (object-src 'none')
- ❌ Externe Forms

---

### 3. Cookie Security
```
Set-Cookie: __session=*; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800
```
- **Secure:** Nur HTTPS
- **HttpOnly:** Kein JavaScript-Zugriff
- **SameSite:** CSRF-Schutz
- **Max-Age:** 7 Tage

---

### 4. Content Type Protection
```
X-Content-Type-Options: nosniff
```
- **Zweck:** Verhindert MIME-Sniffing
- **Schutz:** Browser respektiert Content-Type Header

---

### 5. Clickjacking Protection
```
X-Frame-Options: DENY
```
- **Zweck:** Verhindert Einbettung in Iframes
- **Alternative:** CSP `frame-ancestors 'none'` (beides aktiv für maximalen Schutz)

---

### 6. XSS Protection (Legacy)
```
X-XSS-Protection: 1; mode=block
```
- **Zweck:** Aktiviert Browser-XSS-Filter (Legacy)
- **Modern:** CSP ist primärer Schutz

---

### 7. Referrer Policy
```
Referrer-Policy: no-referrer
```
- **Zweck:** Keine Referrer-Informationen an externe Sites
- **Datenschutz:** Maximal
- **DSGVO:** Compliant

---

### 8. Permissions Policy
```
Permissions-Policy: geolocation=(), microphone=(), camera=(), 
  payment=(), usb=(), magnetometer=(), gyroscope=(), 
  accelerometer=(), interest-cohort=(), browsing-topics=()
```

**Deaktivierte APIs:**
- 🚫 Standort (geolocation)
- 🚫 Kamera & Mikrofon
- 🚫 Zahlungs-API
- 🚫 USB-Zugriff
- 🚫 Bewegungssensoren
- 🚫 FLoC Tracking
- 🚫 Topics API

---

### 9. Cross-Origin Isolation
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**Schutz:**
- ✅ Isoliert Window-Context
- ✅ Verhindert Ressourcen-Leaks
- ✅ Schutz vor Spectre-Angriffen

---

## 📋 Cache-Strategie

### HTML (no-cache)
```
Cache-Control: no-cache, no-store, must-revalidate
```
- Immer frische Version laden
- Keine Browser-/Proxy-Caching

### JavaScript/CSS (immutable)
```
Cache-Control: public, max-age=31536000, immutable
```
- 365 Tage Cache
- Unveränderlich (Versioning via Dateinamen)

### Bilder & Fonts (long-term)
```
Cache-Control: public, max-age=31536000, immutable
```
- 365 Tage Cache
- Optimal für statische Assets

### JSON (moderate)
```
Cache-Control: public, max-age=86400, must-revalidate
```
- 24 Stunden Cache
- Revalidierung erforderlich

### Firebase Credentials (no-store)
```
Cache-Control: no-store
```
- Niemals cachen
- Sicherheitskritisch

---

## 🧪 Testing

### Security Headers Scanner
```powershell
# Online
https://securityheaders.com/?q=https://denkstduwebsite.web.app

# Local (mit curl)
curl -I https://denkstduwebsite.web.app/
```

### CSP Validator
```javascript
// Browser DevTools → Console
// CSP-Violations werden automatisch geloggt
```

### Cache Testing
```powershell
# Erste Anfrage
curl -I https://denkstduwebsite.web.app/assets/js/app.js

# Zweite Anfrage (sollte aus Cache kommen)
curl -I https://denkstduwebsite.web.app/assets/js/app.js
```

---

## 🎯 Security Score Ziele

| Tool | Ziel | Status |
|------|------|--------|
| securityheaders.com | A+ | ✅ |
| Mozilla Observatory | A+ | ✅ |
| SSL Labs | A+ | ✅ (Firebase Default) |
| CSP Evaluator | Good | ✅ |

---

## ⚠️ Bekannte Einschränkungen

### 1. unsafe-eval in CSP
**Problem:** Firebase SDK benötigt `eval()`  
**Lösung:** Nicht vermeidbar, Firebase-intern  
**Risiko:** Minimal (nur für SDK)

### 2. unsafe-inline für Styles
**Problem:** Einige CSS-in-JS Frameworks benötigen Inline-Styles  
**Lösung:** Akzeptabel für `style-src`  
**Alternative:** CSS Nonces (nicht von Firebase Hosting unterstützt)

### 3. Statische CSP (keine Nonces)
**Problem:** Firebase Hosting kann keine dynamischen Nonces generieren  
**Lösung:** Meta-CSP in HTML als Backup  
**Best Practice:** Externe Scripts nutzen (bereits implementiert)

---

## 🔄 Regelmäßige Überprüfung

### Monatlich
- [ ] Security Headers Scan
- [ ] CSP Violations im Firebase Analytics prüfen
- [ ] Neue Browser-APIs in Permissions-Policy aufnehmen

### Bei Firebase SDK Updates
- [ ] CSP `script-src` und `connect-src` überprüfen
- [ ] Neue Firebase-Domains hinzufügen falls nötig

### Bei neuen Features
- [ ] Cache-Strategie für neue Assets definieren
- [ ] CSP um neue externe Ressourcen erweitern

---

**Letzte Aktualisierung:** 2026-01-12  
**Version:** 1.0.0  
**Validiert:** ✅ Firebase Hosting

