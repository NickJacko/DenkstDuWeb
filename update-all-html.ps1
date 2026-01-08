# Automated HTML Update Script
# Adds Firebase App Check, Error-Boundary, and Cookie-Banner to all HTML files

$ErrorActionPreference = "Stop"

# Define files that need Firebase (exclude 404.html, imprint.html, privacy.html which don't use Firebase heavily)
$firebaseFiles = @(
    "category-selection.html",
    "difficulty-selection.html",
    "gameplay.html",
    "join-game.html",
    "multiplayer-category-selection.html",
    "multiplayer-difficulty-selection.html",
    "multiplayer-gameplay.html",
    "multiplayer-lobby.html",
    "multiplayer-results.html",
    "player-setup.html"
)

$nonFirebaseFiles = @(
    "404.html",
    "imprint.html",
    "privacy.html"
)

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "HTML Files Update Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Function to add App Check to Firebase files
function Add-AppCheck {
    param($filePath)

    $content = Get-Content $filePath -Raw -Encoding UTF8

    # Check if already has app-check
    if ($content -match 'firebase-app-check') {
        Write-Host "  ⏭️  App Check already exists" -ForegroundColor Yellow
        return $false
    }

    # Find firebase-functions line and add app-check after it
    if ($content -match 'firebase-functions-compat\.js') {
        $content = $content -replace '(firebase-functions-compat\.js.*?crossorigin="anonymous"></script>)', "`$1`r`n    `r`n    <!-- ✅ P0 SECURITY: Firebase App Check -->`r`n    <script defer src=`"https://www.gstatic.com/firebasejs/9.23.0/firebase-app-check-compat.js`" crossorigin=`"anonymous`"></script>"

        Set-Content -Path $filePath -Value $content -Encoding UTF8 -NoNewline
        Write-Host "  ✅ Added App Check" -ForegroundColor Green
        return $true
    }

    Write-Host "  ⚠️  Could not find Firebase scripts" -ForegroundColor Yellow
    return $false
}

# Function to add Error Boundary
function Add-ErrorBoundary {
    param($filePath)

    $content = Get-Content $filePath -Raw -Encoding UTF8

    # Check if already has error-boundary
    if ($content -match 'error-boundary\.js') {
        Write-Host "  ⏭️  Error-Boundary already exists" -ForegroundColor Yellow
        return $false
    }

    # Find </body> and add before it
    $content = $content -replace '(</body>)', "    <!-- ✅ ERROR BOUNDARY: Global Error Handling -->`r`n    <script src=`"/assets/js/error-boundary.js`"></script>`r`n`r`n`$1"

    Set-Content -Path $filePath -Value $content -Encoding UTF8 -NoNewline
    Write-Host "  ✅ Added Error-Boundary" -ForegroundColor Green
    return $true
}

# Function to add Cookie Banner
function Add-CookieBanner {
    param($filePath)

    $content = Get-Content $filePath -Raw -Encoding UTF8

    # Check if already has cookie-banner
    if ($content -match 'cookie-banner\.js') {
        Write-Host "  ⏭️  Cookie-Banner already exists" -ForegroundColor Yellow
        return $false
    }

    # Find error-boundary.js or </body> and add after/before
    if ($content -match 'error-boundary\.js') {
        $content = $content -replace '(error-boundary\.js`"></script>)', "`$1`r`n    `r`n    <!-- ✅ DSGVO: Cookie Consent Management -->`r`n    <script src=`"/assets/js/cookie-banner.js`"></script>"
    } else {
        $content = $content -replace '(</body>)', "    <!-- ✅ DSGVO: Cookie Consent Management -->`r`n    <script src=`"/assets/js/cookie-banner.js`"></script>`r`n`r`n`$1"
    }

    Set-Content -Path $filePath -Value $content -Encoding UTF8 -NoNewline
    Write-Host "  ✅ Added Cookie-Banner" -ForegroundColor Green
    return $true
}

# Process Firebase files
Write-Host "Processing Firebase-enabled pages..." -ForegroundColor Cyan
Write-Host ""

foreach ($file in $firebaseFiles) {
    $filePath = "C:\Users\JACK129\IdeaProjects\DenkstDuWeb\$file"

    if (Test-Path $filePath) {
        Write-Host "📄 $file" -ForegroundColor White

        $changed = $false
        $changed = Add-AppCheck $filePath -or $changed
        $changed = Add-ErrorBoundary $filePath -or $changed
        $changed = Add-CookieBanner $filePath -or $changed

        if (-not $changed) {
            Write-Host "  ℹ️  No changes needed" -ForegroundColor Gray
        }

        Write-Host ""
    } else {
        Write-Host "❌ File not found: $file" -ForegroundColor Red
        Write-Host ""
    }
}

# Process non-Firebase files (only Error-Boundary and Cookie-Banner)
Write-Host "Processing non-Firebase pages..." -ForegroundColor Cyan
Write-Host ""

foreach ($file in $nonFirebaseFiles) {
    $filePath = "C:\Users\JACK129\IdeaProjects\DenkstDuWeb\$file"

    if (Test-Path $filePath) {
        Write-Host "📄 $file" -ForegroundColor White

        $changed = $false
        $changed = Add-ErrorBoundary $filePath -or $changed
        $changed = Add-CookieBanner $filePath -or $changed

        if (-not $changed) {
            Write-Host "  ℹ️  No changes needed" -ForegroundColor Gray
        }

        Write-Host ""
    } else {
        Write-Host "❌ File not found: $file" -ForegroundColor Red
        Write-Host ""
    }
}

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "✅ Script execution complete!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan

