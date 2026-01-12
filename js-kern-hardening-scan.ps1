# JavaScript-Kern Hardening - Bulk Update Script
# Wendet Module Pattern, Throttle/Debounce und Event-Cleanup auf alle JS-Dateien an

$ErrorActionPreference = "Stop"

Write-Host "🔧 JavaScript-Kern Hardening - Bulk Update" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Liste der zu bearbeitenden Dateien (Priorität 1-3)
$filesToProcess = @(
    # Priority 1: Single-Player Flow
    @{Path="assets/js/category-selection.js"; Module="CategorySelectionModule"; Priority=1},
    @{Path="assets/js/difficulty-selection.js"; Module="DifficultySelectionModule"; Priority=1},
    @{Path="assets/js/gameplay.js"; Module="GameplayModule"; Priority=1},
    @{Path="assets/js/player-setup.js"; Module="PlayerSetupModule"; Priority=1},

    # Priority 2: Multiplayer Flow
    @{Path="assets/js/join-game.js"; Module="JoinGameModule"; Priority=2},
    @{Path="assets/js/multiplayer-category-selection.js"; Module="MultiplayerCategoryModule"; Priority=2},
    @{Path="assets/js/multiplayer-difficulty-selection.js"; Module="MultiplayerDifficultyModule"; Priority=2},
    @{Path="assets/js/multiplayer-gameplay.js"; Module="MultiplayerGameplayModule"; Priority=2},
    @{Path="assets/js/multiplayer-lobby.js"; Module="MultiplayerLobbyModule"; Priority=2},
    @{Path="assets/js/multiplayer-results.js"; Module="MultiplayerResultsModule"; Priority=2},

    # Priority 3: Support Pages
    @{Path="assets/js/settings.js"; Module="SettingsModule"; Priority=3},
    @{Path="assets/js/privacy.js"; Module="PrivacyModule"; Priority=3}
)

$processedCount = 0
$skippedCount = 0
$errors = @()

foreach ($fileInfo in $filesToProcess) {
    $filePath = $fileInfo.Path
    $moduleName = $fileInfo.Module
    $priority = $fileInfo.Priority

    Write-Host "[P$priority] Processing: $filePath" -ForegroundColor Yellow

    if (-not (Test-Path $filePath)) {
        Write-Host "  ⚠️  File not found, skipping..." -ForegroundColor DarkYellow
        $skippedCount++
        continue
    }

    try {
        $content = Get-Content $filePath -Raw -Encoding UTF8

        # Check if already processed (Module Pattern vorhanden?)
        if ($content -match "const $moduleName\s*=\s*\{") {
            Write-Host "  ✅ Already processed (Module Pattern found)" -ForegroundColor Green
            $processedCount++
            continue
        }

        Write-Host "  📝 File needs processing" -ForegroundColor White
        Write-Host "     Module will be: $moduleName" -ForegroundColor Gray

        # Weitere Verarbeitung würde hier erfolgen
        # (Manuelle Bearbeitung empfohlen wegen Komplexität)

        $skippedCount++

    } catch {
        $errorMsg = "Error processing $filePath : $_"
        $errors += $errorMsg
        Write-Host "  ❌ $errorMsg" -ForegroundColor Red
    }

    Write-Host ""
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "📊 Summary" -ForegroundColor Cyan
Write-Host "  Already processed: $processedCount" -ForegroundColor Green
Write-Host "  Needs processing:  $skippedCount" -ForegroundColor Yellow

if ($errors.Count -gt 0) {
    Write-Host "  Errors:            $($errors.Count)" -ForegroundColor Red
    Write-Host ""
    Write-Host "❌ Errors:" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
}

Write-Host ""
Write-Host "✅ Scan complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Review files that need processing" -ForegroundColor White
Write-Host "   2. Apply Module Pattern manually to each file" -ForegroundColor White
Write-Host "   3. Add throttle/debounce utilities" -ForegroundColor White
Write-Host "   4. Add event listener cleanup" -ForegroundColor White
Write-Host "   5. Test each file after changes" -ForegroundColor White

