param(
    [string]$PiHost = "192.168.73.6",
    [string]$PiUser = "sugaloy",
    [string]$Password = "sugaloy123"
)

$ErrorActionPreference = "Continue"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 1. Checking HTTP Web Server on Pi" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
try {
    $res = Invoke-RestMethod -Uri "http://${PiHost}:3000/api/network/config" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "[OK] HTTP Web App is running!" -ForegroundColor Green
    Write-Host "     Router IP:           $($res.routerIp)"
    Write-Host "     Subnet Mask:         $($res.subnetMask)"
    Write-Host "     Subnet Rules Count:  $($res.subnetZoneRules.Count)"
} catch {
    Write-Host "[FAIL] Could not query http://${PiHost}:3000/api/network/config: $_" -ForegroundColor Red
}

try {
    $lecs = Invoke-RestMethod -Uri "http://${PiHost}:3000/api/lecturers" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "[OK] Lecturers API is alive! Total Lecturers: $($lecs.lecturers.Count)" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Could not query /api/lecturers: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 2. Checking Bluetooth Hardware on Pi" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$tempAskpass = Join-Path $env:TEMP "askpass_diag.bat"
Set-Content -Path $tempAskpass -Value "@echo $Password`r`n"
$env:SSH_ASKPASS = $tempAskpass
$env:SSH_ASKPASS_REQUIRE = "force"

try {
    $sshCmd = @"
which bluetoothctl hciconfig btmon;
echo '---HCICONFIG---';
hciconfig -a;
echo '---RAW BLE BROADCASTS IN AIR---';
echo 'sugaloy123' | sudo -S timeout 3 hcitool lescan --duplicates 2>&1 | head -n 20;
"@
    ssh -o StrictHostKeyChecking=no "${PiUser}@${PiHost}" "$sshCmd"
} finally {
    if (Test-Path $tempAskpass) {
        Remove-Item -Force $tempAskpass
    }
}
