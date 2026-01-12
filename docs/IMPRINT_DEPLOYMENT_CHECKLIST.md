# ✅ Imprint.html - Deployment-Checkliste

## Pre-Deployment Validierung

### 1. Daten-Validierung ✅
- [x] Name: Nick-Mark Jacklin
- [x] Adresse: Osnabrücker Landstr. 2-8, 33335 Gütersloh
- [x] E-Mail: Nickjacklin99@web.de
- [x] Keine Platzhalter mehr vorhanden

### 2. Link-Validierung
- [ ] `/` (Startseite) funktioniert
- [ ] `/privacy.html` (Datenschutzerklärung) existiert
- [ ] `/privacy-new-sections.html#jugendschutz` (Jugendschutz) existiert
- [x] Externe Links:
  - [x] https://ec.europa.eu/consumers/odr (EU-Streitschlichtung)
  - [x] https://fonts.googleapis.com (Google Fonts)

### 3. Asset-Validierung
- [ ] `/assets/css/styles.css` existiert
- [x] `/assets/css/imprint.css` existiert
- [ ] `/assets/lib/purify.min.js` existiert
- [ ] `/assets/js/utils.js` existiert

### 4. Accessibility-Tests
- [ ] Keyboard-Navigation (Tab-Durchlauf)
- [ ] Screen-Reader-Test (VoiceOver/NVDA)
- [ ] Focus-Styles sichtbar
- [ ] Alle `tabindex` funktionieren

### 5. Responsive-Tests
- [ ] Desktop (1920x1080)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

### 6. Browser-Tests
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (iOS)
- [ ] Samsung Internet (Android)

### 7. SEO & Meta-Tags
- [x] `<title>` vorhanden: "Impressum | No-Cap"
- [x] Meta-Description vorhanden
- [x] `robots` meta: "index, follow"
- [x] Canonical URL (automatisch durch Firebase)

### 8. DSGVO-Compliance
- [x] Impressumspflicht erfüllt (§ 5 TMG)
- [x] Datenschutzerklärung verlinkt
- [x] EU-Streitschlichtung vorhanden
- [x] DSGVO-Rechte dokumentiert (Art. 15-21)
- [x] Löschrecht explizit erwähnt
- [x] Kontakt für Datenschutzanfragen

### 9. Sicherheit
- [x] Keine Inline-Scripts
- [x] CSP-kompatibel
- [x] XSS-Schutz (DOMPurify)
- [x] HTTPS-Only (Firebase Hosting)

### 10. Performance
- [ ] Lighthouse Score > 95
- [x] Keine Bilder zu optimieren
- [x] CSS/JS extern geladen
- [x] Kompression durch Firebase Hosting

---

## Deployment-Befehle

```powershell
# 1. Lokale Validierung
cd C:\Users\JACK129\IdeaProjects\DenkstDuWeb

# 2. Firebase Emulator testen (optional)
firebase emulators:start --only hosting

# 3. Deployment (nur Hosting)
firebase deploy --only hosting

# 4. Vollständiges Deployment
firebase deploy
```

---

## Post-Deployment Tests

### Sofort nach Deployment:

1. **Öffne die Live-URL:**
   ```
   https://no-cap.app/imprint.html
   ```

2. **Teste alle Links:**
   - Zurück-Button → Startseite
   - Datenschutz-Link → Privacy-Seite
   - Jugendschutz-Link → Privacy-Sections
   - Footer-Links

3. **Browser DevTools Console:**
   - Keine CSP-Violations
   - Keine 404-Errors
   - Keine JavaScript-Errors

4. **Network Tab:**
   - Alle Assets laden (200 Status)
   - Cache-Headers korrekt

5. **Mobile-Test:**
   ```
   https://search.google.com/test/mobile-friendly
   ```

6. **Lighthouse Audit:**
   ```powershell
   lighthouse https://no-cap.app/imprint.html --view
   ```

---

## Erwartete Lighthouse-Scores

| Kategorie | Ziel | Akzeptabel |
|-----------|------|------------|
| Performance | 95+ | 90+ |
| Accessibility | 100 | 95+ |
| Best Practices | 95+ | 90+ |
| SEO | 95+ | 90+ |

---

## Bekannte Warnungen (Ignorierbar)

### IDE-Warnungen:
- ❌ "Cannot resolve file 'privacy.html'" → **Ignorieren** (Datei existiert im Root)
- ❌ "Cannot resolve directory 'assets'" → **Ignorieren** (relative Pfade)
- ❌ "Wrong attribute value for X-Content-Type-Options" → **Ignorieren** (Meta-Tag-Limitation)

### Echte Fehler:
- ❗ 404 auf `/assets/...` → **Beheben** (Asset fehlt)
- ❗ CSP-Violation → **Beheben** (Script nicht erlaubt)
- ❗ JavaScript-Error → **Beheben** (Code-Fehler)

---

## Rollback-Plan

Falls Probleme auftreten:

```powershell
# 1. Vorherige Version deployen
firebase hosting:channel:deploy preview

# 2. Oder: Manuell zurück zu letzter Version
git checkout HEAD~1 imprint.html
firebase deploy --only hosting
```

---

## Support-Kontakte

**Bei Fragen zu:**
- Firebase Hosting: https://firebase.google.com/support
- DSGVO-Compliance: Rechtsanwalt für Medienrecht
- Accessibility: https://www.w3.org/WAI/

---

**Erstellt:** 11. Januar 2026  
**Status:** ✅ Bereit für Deployment  
**Letzter Test:** Vor Deployment durchführen

