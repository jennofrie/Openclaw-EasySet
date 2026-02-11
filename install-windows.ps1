# OpenClaw EasySet - Windows Quick Install
# Run this script in PowerShell to install OpenClaw on Windows

Write-Host "🌃 OpenClaw EasySet - Windows Installation" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js 18+ from:" -ForegroundColor Yellow
    Write-Host "https://nodejs.org" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "✓ Node.js $nodeVersion installed" -ForegroundColor Green
Write-Host ""

# Install openclaw-easyset
Write-Host "Installing openclaw-easyset..." -ForegroundColor Yellow
npm install -g openclaw-easyset

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Installation failed" -ForegroundColor Red
    exit 1
}

Write-Host "✓ openclaw-easyset installed" -ForegroundColor Green
Write-Host ""

# Run detection
Write-Host "Detecting platform..." -ForegroundColor Yellow
openclaw-easyset detect --recommendations

Write-Host ""
Write-Host "🚀 Ready to install OpenClaw!" -ForegroundColor Green
Write-Host ""
Write-Host "Next step:" -ForegroundColor Yellow
Write-Host "  openclaw-easyset install" -ForegroundColor Cyan
Write-Host ""
