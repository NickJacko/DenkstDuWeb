#!/usr/bin/env pwsh
# ============================================
# 🔧 reCAPTCHA Domain Checker
# ============================================
# Prüft, ob no-cap.app in reCAPTCHA registriert ist
# ============================================

Write-Host "`n🔍 RECAPTCHA DOMAIN CHECKER`n" -ForegroundColor Cyan

$SITE_KEY = "6LeEL0UsAAAAABN-JYDFEshwg9Qnmq09IyWzaJ9l"
$DOMAIN = "no-cap.app"

Write-Host "Site Key:  $SITE_KEY" -ForegroundColor White
Write-Host "Domain:    $DOMAIN`n" -ForegroundColor White

# ============================================
# SCHRITT 1: Google reCAPTCHA Admin öffnen
# ============================================

Write-Host "📋 SCHRITT 1: reCAPTCHA Admin Console öffnen`n" -ForegroundColor Yellow

Write-Host "1. Öffne: https://www.google.com/recaptcha/admin" -ForegroundColor White
Write-Host "2. Suche deinen Site Key: $SITE_KEY" -ForegroundColor White
Write-Host "3. Klicke auf den Key (erscheint in der Liste)`n" -ForegroundColor White

Write-Host "❓ Kannst du den Key in der Liste finden? (J/N): " -ForegroundColor Magenta -NoNewline
$found = Read-Host

if ($found -eq "N" -or $found -eq "n") {
    Write-Host "`n⚠️  Key NICHT gefunden!" -ForegroundColor Red
    Write-Host "`nDas bedeutet: Firebase verwendet reCAPTCHA Enterprise (eigener Key)`n" -ForegroundColor Yellow

    Write-Host "LÖSUNG 1: Firebase Console" -ForegroundColor Cyan
    Write-Host "  1. Öffne: https://console.firebase.google.com/project/denkstduwebsite/appcheck" -ForegroundColor White
    Write-Host "  2. Klicke auf 'DenkstDu'" -ForegroundColor White
    Write-Host "  3. Suche 'Manage domains' oder 'Settings'" -ForegroundColor White
    Write-Host "  4. Füge hinzu: no-cap.app`n" -ForegroundColor White

    Write-Host "LÖSUNG 2: Neuen Key erstellen (empfohlen)" -ForegroundColor Cyan
    Write-Host "  1. https://www.google.com/recaptcha/admin → '+ Neues Label erstellen'" -ForegroundColor White
    Write-Host "  2. Typ: reCAPTCHA v3" -ForegroundColor White
    Write-Host "  3. Domains: no-cap.app, localhost" -ForegroundColor White
    Write-Host "  4. Senden → Neuen Site Key kopieren" -ForegroundColor White
    Write-Host "  5. Mir mitteilen → Ich trage ihn in alle Dateien ein`n" -ForegroundColor White

    exit
}

# ============================================
# SCHRITT 2: Domains überprüfen
# ============================================

Write-Host "`n📋 SCHRITT 2: Domains überprüfen`n" -ForegroundColor Yellow

Write-Host "Klicke auf deinen Key → Einstellungen → Domains`n" -ForegroundColor White

Write-Host "❓ Ist 'no-cap.app' in der Domain-Liste? (J/N): " -ForegroundColor Magenta -NoNewline
$domainFound = Read-Host

if ($domainFound -eq "N" -or $domainFound -eq "n") {
    Write-Host "`n⚠️  Domain NICHT registriert - DAS IST DAS PROBLEM!`n" -ForegroundColor Red

    Write-Host "🔧 LÖSUNG:`n" -ForegroundColor Green
    Write-Host "1. Klicke auf 'Einstellungen' → 'Domains'" -ForegroundColor White
    Write-Host "2. Füge hinzu: no-cap.app" -ForegroundColor White
    Write-Host "3. Optional: localhost (für Testing)" -ForegroundColor White
    Write-Host "4. Speichern`n" -ForegroundColor White

    Write-Host "✅ Nach dem Speichern:" -ForegroundColor Green
    Write-Host "  - Öffne: https://no-cap.app" -ForegroundColor White
    Write-Host "  - F12 → Console" -ForegroundColor White
    Write-Host "  - KEIN '400 Invalid reCAPTCHA' Fehler mehr!`n" -ForegroundColor White

} else {
    Write-Host "`n✅ Domain ist registriert!`n" -ForegroundColor Green

    Write-Host "⚠️  Aber der Fehler tritt trotzdem auf?`n" -ForegroundColor Yellow

    Write-Host "Mögliche Ursachen:" -ForegroundColor Cyan
    Write-Host "  1. Browser-Cache: Strg+Shift+R (Hard Reload)" -ForegroundColor White
    Write-Host "  2. reCAPTCHA Cache: Warte 5 Minuten" -ForegroundColor White
    Write-Host "  3. Falscher Provider: Prüfe ob 'reCAPTCHA v3' oder 'Enterprise'" -ForegroundColor White
    Write-Host "`n📋 Nächster Schritt:" -ForegroundColor Yellow
    Write-Host "  - Warte 5 Minuten (reCAPTCHA Cache Refresh)" -ForegroundColor White
    Write-Host "  - Hard Reload: Strg+Shift+R" -ForegroundColor White
    Write-Host "  - Teste erneut: https://no-cap.app`n" -ForegroundColor White
}

Write-Host "`n📚 Weitere Hilfe:`n" -ForegroundColor Cyan
Write-Host "  - Firebase App Check: https://console.firebase.google.com/project/denkstduwebsite/appcheck" -ForegroundColor Gray
Write-Host "  - Google reCAPTCHA: https://www.google.com/recaptcha/admin" -ForegroundColor Gray
Write-Host "  - Anleitung: RECAPTCHA_FIX_ANLEITUNG.md`n" -ForegroundColor Gray

