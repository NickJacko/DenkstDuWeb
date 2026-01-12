# JavaScript-Kern Hardening - Automatisiertes Update Skript
# Version 1.0

Write-Host "🚀 JavaScript-Kern Hardening - Automatische Anwendung" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Definiere Ersetzungs-Pattern für häufige Fälle
$patterns = @{
    # Entferne alte globale Variablen-Deklarationen
    "OldGlobalVars" = @{
        Pattern = "(?m)^\s*let (gameState|selectedCategories|questionCounts|isDevelopment|eventListenerCleanup)\s*=.*?;\s*$"
        Replacement = ""
        Description = "Entferne alte globale let-Deklarationen"
    }

    # Ersetze gameState Referenzen
    "GameStateRef" = @{
        Pattern = "\bgameState\b(?!\.state|Module)"
        Replacement = "MODULENAME.gameState"
        Description = "Ersetze gameState mit Module-Referenz"
    }

    # Ersetze isDevelopment Referenzen
    "IsDevelopmentRef" = @{
        Pattern = "\bisDevelopment\b(?!\.state|:)"
        Replacement = "MODULENAME.isDevelopment"
        Description = "Ersetze isDevelopment mit Module-Referenz"
    }
}

# Liste der Dateien mit ihren Modul-Namen
$files = @(
    @{Path="assets/js/category-selection.js"; Module="CategorySelectionModule"},
    @{Path="assets/js/difficulty-selection.js"; Module="DifficultySelectionModule"},
    @{Path="assets/js/gameplay.js"; Module="GameplayModule"},
    @{Path="assets/js/player-setup.js"; Module="PlayerSetupModule"},
    @{Path="assets/js/join-game.js"; Module="JoinGameModule"}
)

Write-Host ""
Write-Host "📝 Dateien zum Bearbeiten: $($files.Count)" -ForegroundColor Yellow
Write-Host ""

foreach ($fileInfo in $files) {
    $filePath = $fileInfo.Path
    $moduleName = $fileInfo.Module

    Write-Host "Bearbeite: $filePath" -ForegroundColor Cyan
    Write-Host "  Module: $moduleName" -ForegroundColor Gray

    if (-not (Test-Path $filePath)) {
        Write-Host "  ⚠️  Datei nicht gefunden!" -ForegroundColor Red
        continue
    }

    try {
        # Lese Datei
        $content = Get-Content $filePath -Raw -Encoding UTF8
        $original = $content
        $changes = 0

        # Wende Pattern an
        foreach ($patternName in $patterns.Keys) {
            $p = $patterns[$patternName]
            $pattern = $p.Pattern -replace "MODULENAME", $moduleName
            $replacement = $p.Replacement -replace "MODULENAME", $moduleName

            if ($content -match $pattern) {
                $content = $content -replace $pattern, $replacement
                $changes++
                Write-Host "  ✓ $($p.Description)" -ForegroundColor Green
            }
        }

        if ($changes -gt 0) {
            # Backup erstellen
            $backupPath = "$filePath.backup"
            $original | Set-Content $backupPath -Encoding UTF8 -NoNewline

            # Speichere geänderte Datei
            $content | Set-Content $filePath -Encoding UTF8 -NoNewline

            Write-Host "  ✅ $changes Änderungen angewendet (Backup: *.backup)" -ForegroundColor Green
        } else {
            Write-Host "  ℹ️  Keine Änderungen nötig" -ForegroundColor DarkGray
        }

    } catch {
        Write-Host "  ❌ Fehler: $_" -ForegroundColor Red
    }

    Write-Host ""
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ Automatisches Update abgeschlossen!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  WICHTIG: Manuelle Überprüfung erforderlich!" -ForegroundColor Yellow
Write-Host "  - Prüfe jede Datei auf Syntax-Fehler" -ForegroundColor White
Write-Host "  - Teste die Funktionalität" -ForegroundColor White
Write-Host "  - Backup-Dateien (.backup) bei Bedarf wiederherstellen" -ForegroundColor White

