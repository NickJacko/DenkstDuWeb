# PowerShell Script: Generate Keys and Sign Whitelist
# Fuer Windows-Nutzer ohne OpenSSL

Write-Host "==== Firebase Config - Key Generation and Signing ====" -ForegroundColor Cyan
Write-Host ""

# Check if OpenSSL is available
$opensslPath = Get-Command openssl -ErrorAction SilentlyContinue

if (-not $opensslPath) {
    Write-Host "[ERROR] OpenSSL nicht gefunden!" -ForegroundColor Red
    Write-Host ""
    Write-Host "INSTALLATION:" -ForegroundColor Yellow
    Write-Host "1. Installiere OpenSSL fuer Windows:"
    Write-Host "   https://slproweb.com/products/Win32OpenSSL.html"
    Write-Host ""
    Write-Host "2. Oder nutze WSL (Windows Subsystem for Linux):"
    Write-Host "   wsl openssl genrsa -out private.pem 2048"
    Write-Host ""
    exit 1
}

# Create build-scripts directory if not exists
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$buildScriptsDir = Join-Path $scriptDir "build-scripts"

if (-not (Test-Path $buildScriptsDir)) {
    New-Item -ItemType Directory -Path $buildScriptsDir | Out-Null
    Write-Host "[OK] Created build-scripts directory" -ForegroundColor Green
}

# Generate private key
Write-Host "[STEP 1/3] Generating private key..." -ForegroundColor Cyan
$privateKeyPath = Join-Path $buildScriptsDir "private.pem"
& openssl genrsa -out $privateKeyPath 2048 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Private key generated: $privateKeyPath" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Failed to generate private key" -ForegroundColor Red
    exit 1
}

# Generate public key
Write-Host "[STEP 2/3] Generating public key..." -ForegroundColor Cyan
$publicKeyPath = Join-Path $buildScriptsDir "public.pem"
& openssl rsa -in $privateKeyPath -pubout -out $publicKeyPath 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Public key generated: $publicKeyPath" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Failed to generate public key" -ForegroundColor Red
    exit 1
}

# Show public key
Write-Host ""
Write-Host "=============== PUBLIC KEY (kopiere in HTML) ===============" -ForegroundColor Yellow
Write-Host ""
$publicKey = Get-Content $publicKeyPath -Raw
Write-Host $publicKey -ForegroundColor White

# Add to .gitignore
$gitignorePath = Join-Path $scriptDir ".gitignore"
if (Test-Path $gitignorePath) {
    $gitignoreContent = Get-Content $gitignorePath -Raw
    if (-not $gitignoreContent.Contains("build-scripts/private.pem")) {
        Add-Content $gitignorePath "`n# Private keys`nbuild-scripts/private.pem`nbuild-scripts/*.key"
        Write-Host ""
        Write-Host "[OK] Added private.pem to .gitignore" -ForegroundColor Green
    }
}

# Sign whitelist if Node.js is available
$nodePath = Get-Command node -ErrorAction SilentlyContinue
if ($nodePath) {
    Write-Host ""
    Write-Host "[STEP 3/3] Signing domain whitelist..." -ForegroundColor Cyan

    $signScriptPath = Join-Path $buildScriptsDir "sign-whitelist.js"
    if (Test-Path $signScriptPath) {
        $env:PRIVATE_KEY_PATH = $privateKeyPath
        $env:PUBLIC_KEY_PATH = $publicKeyPath
        & node $signScriptPath
    } else {
        Write-Host "[WARNING] sign-whitelist.js not found, skipping signing" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "[WARNING] Node.js nicht gefunden - Whitelist-Signierung uebersprungen" -ForegroundColor Yellow
    Write-Host "   Installiere Node.js: https://nodejs.org/" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=============== FERTIG! ===============" -ForegroundColor Green
Write-Host ""
Write-Host "NAECHSTE SCHRITTE:" -ForegroundColor Yellow
Write-Host "1. Fuege den PUBLIC KEY in alle HTML-Dateien ein:" -ForegroundColor White
Write-Host '   <meta name="domain-whitelist-public-key" content="...kopiere Public Key hier...">' -ForegroundColor Gray
Write-Host ""
Write-Host "WICHTIG: Committe NICHT die private.pem!" -ForegroundColor Red
Write-Host "   (Ist bereits in .gitignore)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Deploy die signierte allowed-domains.json" -ForegroundColor White
Write-Host ""

