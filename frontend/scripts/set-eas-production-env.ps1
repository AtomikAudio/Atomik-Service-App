param(
  [Parameter(Mandatory = $true)]
  [string]$ApiBaseUrl,
  [string]$RazorpayKeyId = "rzp_test_SvZcQbsHG9oTF4",
  [string]$GoogleMapsKey = "your_google_maps_key_here"
)

$ErrorActionPreference = 'Stop'
$base = $ApiBaseUrl.TrimEnd('/')
if ($base -notmatch '^https://') {
  throw "ApiBaseUrl must start with https:// (e.g. https://atomik-service-app.onrender.com)"
}
$apiUrl = if ($base.EndsWith('/api')) { $base } else { "$base/api" }

Push-Location $PSScriptRoot/..
Write-Host "Setting EAS production env → $apiUrl" -ForegroundColor Cyan

npx eas-cli env:create production --name EXPO_PUBLIC_API_URL --value $apiUrl --visibility plaintext --scope project --non-interactive --force
npx eas-cli env:create production --name EXPO_PUBLIC_RAZORPAY_KEY_ID --value $RazorpayKeyId --visibility plaintext --scope project --non-interactive --force
npx eas-cli env:create production --name EXPO_PUBLIC_GOOGLE_MAPS_KEY --value $GoogleMapsKey --visibility plaintext --scope project --non-interactive --force

npx eas-cli env:list --environment production
Pop-Location
Write-Host "Done. Run: eas build --platform android --profile production" -ForegroundColor Green
