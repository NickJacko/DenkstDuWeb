# Add Firebase Config Meta Tags to all HTML files that use Firebase
# This fixes the "Firebase configuration not found" error

$ErrorActionPreference = "Stop"

$firebaseMetaTags = @"

    <!-- ✅ P0 SECURITY: Firebase Config via Meta Tags (CSP-compliant) -->
    <meta name="firebase-api-key" content="AIzaSyD7cvUCiYm2rp6UqLZPy7qM8eEa7mBx-r8">
    <meta name="firebase-auth-domain" content="denkstduwebsite.firebaseapp.com">
    <meta name="firebase-database-url" content="https://denkstduwebsite-default-rtdb.europe-west1.firebasedatabase.app">
    <meta name="firebase-project-id" content="denkstduwebsite">
    <meta name="firebase-storage-bucket" content="denkstduwebsite.appspot.com">
    <meta name="firebase-messaging-sender-id" content="1068876330726">
    <meta name="firebase-app-id" content="1:1068876330726:web:bca93e21e1e4ddc73b7c7c">
    <meta name="firebase-measurement-id" content="G-V4WVVP7FYQ">
"@

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Firebase Config Meta Tags Insertion" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Find all HTML files with Firebase SDK
$htmlFiles = Get-ChildItem -Path "C:\Users\JACK129\IdeaProjects\DenkstDuWeb" -Filter "*.html" -File |
    Where-Object {
        $content = Get-Content $_.FullName -Raw -Encoding UTF8
        $content -match 'firebase-app-compat\.js'
    }

Write-Host "Found $($htmlFiles.Count) files with Firebase SDK" -ForegroundColor Green
Write-Host ""

$successCount = 0
$skipCount = 0

foreach ($file in $htmlFiles) {
    Write-Host "📄 $($file.Name)" -ForegroundColor White

    $content = Get-Content $file.FullName -Raw -Encoding UTF8

    # Check if already has meta tags
    if ($content -match 'firebase-api-key') {
        Write-Host "  ⏭️  Already has Firebase meta tags" -ForegroundColor Yellow
        $skipCount++
    }
    else {
        # Find </head> and insert before it
        $content = $content -replace '(</head>)', "$firebaseMetaTags`r`n`$1"

        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
        Write-Host "  ✅ Added Firebase meta tags" -ForegroundColor Green
        $successCount++
    }

    Write-Host ""
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  ✅ Added: $successCount" -ForegroundColor Green
Write-Host "  ⏭️  Skipped: $skipCount" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Done! Firebase config is now available on all pages." -ForegroundColor Green

