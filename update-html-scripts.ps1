# HTML Update Script
# Fügt Cookie-Banner, Error-Boundary und Firebase App Check zu allen HTML-Dateien hinzu

$htmlFiles = @(
    "404.html",
    "category-selection.html",
    "difficulty-selection.html",
    "gameplay.html",
    "index.html",
    "join-game.html",
    "multiplayer-category-selection.html",
    "multiplayer-difficulty-selection.html",
    "multiplayer-gameplay.html",
    "multiplayer-lobby.html",
    "multiplayer-results.html",
    "player-setup.html",
    "privacy.html",
    "imprint.html"
)

$scriptInsertions = @"

    <!-- ✅ P0 SECURITY: Firebase App Check -->
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app-check.js"></script>

    <!-- ✅ ERROR BOUNDARY: Global Error Handling -->
    <script src="/assets/js/error-boundary.js"></script>

    <!-- ✅ DSGVO: Cookie Consent Management -->
    <script src="/assets/js/cookie-banner.js"></script>
"@

foreach ($file in $htmlFiles) {
    $filePath = "C:\Users\JACK129\IdeaProjects\DenkstDuWeb\$file"

    if (Test-Path $filePath) {
        Write-Host "Processing: $file" -ForegroundColor Cyan

        $content = Get-Content $filePath -Raw -Encoding UTF8

        # Check if already has error-boundary.js
        if ($content -notmatch 'error-boundary\.js') {
            # Find </body> tag and insert before it
            $content = $content -replace '(</body>)', "$scriptInsertions`r`n`$1"

            Set-Content -Path $filePath -Value $content -Encoding UTF8 -NoNewline
            Write-Host "  ✅ Added scripts to $file" -ForegroundColor Green
        } else {
            Write-Host "  ⏭️  Skipped $file (already has scripts)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ❌ File not found: $file" -ForegroundColor Red
    }
}

Write-Host "`n✅ Script insertion complete!" -ForegroundColor Green

