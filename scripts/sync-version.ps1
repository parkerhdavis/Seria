# Sync version from .env to tauri.conf.json
# This ensures VITE_APP_VERSION is the single source of truth

$ErrorActionPreference = "Stop"

# Get the project root (parent of scripts directory)
$projectRoot = Split-Path -Parent $PSScriptRoot

# Load version from .env
$envFile = Join-Path $projectRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "Warning: .env file not found, skipping version sync"
    exit 0
}

$envContent = Get-Content $envFile
$versionLine = $envContent | Where-Object { $_ -match "^VITE_APP_VERSION=" }

if (-not $versionLine) {
    Write-Host "Warning: VITE_APP_VERSION not found in .env, skipping version sync"
    exit 0
}

$version = $versionLine -replace "^VITE_APP_VERSION=", ""

Write-Host "Syncing version $version to tauri.conf.json..."

# Update version in tauri.conf.json
$tauriConfPath = Join-Path (Join-Path $projectRoot "backend") "tauri.conf.json"
$tauriConf = Get-Content $tauriConfPath -Raw
$tauriConf = $tauriConf -replace '"version": "[^"]*"', "`"version`": `"$version`""
Set-Content -Path $tauriConfPath -Value $tauriConf -NoNewline

Write-Host "Version synced: $version"
