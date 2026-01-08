# Add Firebase App Check SDK to ALL HTML files that use Firebase
# Version: 9.23.0 (matching existing Firebase SDK version)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Firebase App Check SDK Insertion Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Find all HTML files that contain firebase-database-compat.js
$htmlFiles = Get-ChildItem -Path "C:\Users\JACK129\IdeaProjects\DenkstDuWeb" -Filter "*.html" -File |
    Where-Object {
        $content = Get-Content $_.FullName -Raw -Encoding UTF8
        $content -match 'firebase-database-compat\.js' -or $content -match 'firebase-functions-compat\.js'
    }

Write-Host "Found $($htmlFiles.Count) HTML files with Firebase SDK" -ForegroundColor Green
Write-Host ""

$successCount = 0
$skipCount = 0
$errorCount = 0

foreach ($file in $htmlFiles) {
    Write-Host "📄 Processing: $($file.Name)" -ForegroundColor White

    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8

        # Check if already has app-check
        if ($content -match 'firebase-app-check') {
            Write-Host "  ⏭️  Already has App Check SDK" -ForegroundColor Yellow
            $skipCount++
            Write-Host ""
            continue
        }

        # Pattern 1: After firebase-database-compat.js
        if ($content -match 'firebase-database-compat\.js.*?crossorigin="anonymous"></script>') {
            $appCheckLine = "`r`n    `r`n    <!-- ✅ P0 SECURITY: Firebase App Check -->`r`n    <script defer src=`"https://www.gstatic.com/firebasejs/9.23.0/firebase-app-check-compat.js`" crossorigin=`"anonymous`"></script>"

            $content = $content -replace '(firebase-database-compat\.js.*?crossorigin="anonymous"></script>)', "`$1$appCheckLine"

            Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
            Write-Host "  ✅ Added App Check SDK (after database)" -ForegroundColor Green
            $successCount++
        }
        # Pattern 2: After firebase-functions-compat.js
        elseif ($content -match 'firebase-functions-compat\.js.*?crossorigin="anonymous"></script>') {
            # Skip if already added in previous pattern
            Write-Host "  ℹ️  Functions SDK found (should have been added)" -ForegroundColor Gray
        }
        else {
            Write-Host "  ⚠️  Could not find insertion point" -ForegroundColor Yellow
            $skipCount++
        }

        Write-Host ""

    } catch {
        Write-Host "  ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
        Write-Host ""
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  ✅ Success: $successCount" -ForegroundColor Green
Write-Host "  ⏭️  Skipped: $skipCount" -ForegroundColor Yellow
Write-Host "  ❌ Errors:  $errorCount" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Script complete!" -ForegroundColor Green

