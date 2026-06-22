# Run this script in a normal PowerShell window (not CI) so Expo Go can load the app.
$ErrorActionPreference = 'Stop'

# CRITICAL: Cursor/CI sets CI=true which breaks Expo manifest signing on device
Remove-Item Env:CI -ErrorAction SilentlyContinue
Remove-Item Env:CONTINUOUS_INTEGRATION -ErrorAction SilentlyContinue
$env:CI = 'false'

$ip = (
  Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notmatch '^127\.' -and
    $_.IPAddress -notmatch '^169\.254\.' -and
    ($_.IPAddress -match '^192\.168\.' -or $_.IPAddress -match '^172\.(1[6-9]|2[0-9]|3[0-1])\.' -or $_.IPAddress -match '^10\.')
  } |
  Select-Object -First 1
).IPAddress

if (-not $ip) {
  Write-Host 'Could not detect LAN IP. Set REACT_NATIVE_PACKAGER_HOSTNAME manually.'
  exit 1
}

$env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip
Set-Location $PSScriptRoot

# Sync frontend/.env API URL to current LAN IP (stale IP causes "failed to download remote update")
$envFile = Join-Path $PSScriptRoot '.env'
$newApiLine = "EXPO_PUBLIC_API_URL=http://${ip}:5000/api"
if (Test-Path $envFile) {
  $lines = Get-Content $envFile
  $found = $false
  $updated = foreach ($line in $lines) {
    if ($line -match '^EXPO_PUBLIC_API_URL=') {
      $found = $true
      $current = ($line -replace '^EXPO_PUBLIC_API_URL=', '').Trim()
      if ($current -match '^https://') {
        # Remote API (e.g. Render) set intentionally — keep it so the device
        # can hit production without depending on the PC backend / LAN firewall.
        Write-Host (' Keeping remote API URL -> ' + $current) -ForegroundColor Yellow
        $line
      } else {
        if ($line -ne $newApiLine) {
          Write-Host (' Synced .env API URL -> ' + $newApiLine) -ForegroundColor Green
        }
        $newApiLine
      }
    } else {
      $line
    }
  }
  if (-not $found) {
    $updated = @($newApiLine) + $lines
    Write-Host (' Added .env API URL -> ' + $newApiLine) -ForegroundColor Green
  }
  Set-Content -Path $envFile -Value ($updated -join "`n")
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host (' ATOMIK Expo - LAN (' + $ip + ')') -ForegroundColor White
Write-Host '========================================' -ForegroundColor Cyan
$expUrl = 'exp://' + $ip + ':8081'
Write-Host (' In Expo Go use: ' + $expUrl) -ForegroundColor Yellow
Write-Host ' Phone and PC must be on the same Wi-Fi.' -ForegroundColor Gray
Write-Host ' If you see "failed to download remote update":' -ForegroundColor Gray
Write-Host '   1. Close old Expo Go session on phone' -ForegroundColor Gray
Write-Host '   2. Scan THIS QR / enter URL above (not an old IP)' -ForegroundColor Gray
Write-Host '   3. Allow port 8081 in Windows Firewall if prompted' -ForegroundColor Gray
Write-Host ''

# Print scannable QR in this terminal (Expo Go URL must use LAN IP, not 127.0.0.1)
$qrScript = Join-Path $PSScriptRoot 'scripts\show-qr.ps1'
& $qrScript -Ip $ip

Write-Host ' Starting Metro... (keep this window open)' -ForegroundColor Cyan
Write-Host ''

npx expo start --lan --clear
