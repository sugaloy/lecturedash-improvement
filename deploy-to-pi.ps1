<#
.SYNOPSIS
    Deploys / updates LecturerDash to Raspberry Pi (/var/www/lecturedash).
.DESCRIPTION
    1. Packages repository into a clean tarball (excluding node_modules, dist, presence_db*.json, .agents).
    2. Uploads archive to Raspberry Pi via scp.
    3. Safely extracts to /var/www/lecturedash preserving existing database (presence_db.json) and .env.
    4. Runs npm install and npm run build.
    5. Restarts systemd services (lecturedash.service, presence-agent.service, pn532-agent.service).
.EXAMPLE
    .\deploy-to-pi.ps1 -PiHost "192.168.73.6" -PiUser "sugaloy" -Password "sugaloy123"
#>

[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [string]$PiHost = "192.168.73.6",

    [Parameter(Position=1)]
    [string]$PiUser = "sugaloy",

    [Parameter(Position=2)]
    [string]$TargetDir = "/var/www/lecturedash",

    [Parameter(Position=3)]
    [string]$Password = "",

    [switch]$SkipBuild,
    [switch]$SkipServiceRestart
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   LecturerDash -> Raspberry Pi Deployer & Updater        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Target Host:       $PiHost" -ForegroundColor Yellow
Write-Host "  Target User:       $PiUser" -ForegroundColor Yellow
Write-Host "  Target Directory:  $TargetDir" -ForegroundColor Yellow
Write-Host ""

# Setup askpass if password provided
$tempAskpass = $null
if ($Password) {
    $tempAskpass = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "askpass_$([System.Guid]::NewGuid().ToString('N')).bat")
    [System.IO.File]::WriteAllText($tempAskpass, "@echo $Password`r`n")
    $env:SSH_ASKPASS = $tempAskpass
    $env:SSH_ASKPASS_REQUIRE = "force"
    Write-Host "  [i] Automated authentication configured." -ForegroundColor DarkGray
}

try {
    # 1. Check network reachability
    Write-Host "[1/5] Checking connection to $PiHost:22..." -ForegroundColor Cyan
    $conn = Test-NetConnection -ComputerName $PiHost -Port 22 -InformationLevel Quiet
    if (-not $conn) {
        Write-Warning "Could not reach port 22 on $PiHost. Please check IP address and WiFi/Ethernet connection."
        if (-not $Password) {
            $confirm = Read-Host "Do you want to continue anyway? (y/N)"
            if ($confirm -ne 'y' -and $confirm -ne 'Y') {
                exit 1
            }
        }
    } else {
        Write-Host "  [OK] Host is reachable on port 22." -ForegroundColor Green
    }

    # 2. Package files into tarball
    $tarballName = "lecturedash-update.tar.gz"
    $tarballPath = Join-Path $PSScriptRoot $tarballName

    Write-Host "[2/5] Creating clean project archive ($tarballName)..." -ForegroundColor Cyan
    if (Test-Path $tarballPath) {
        Remove-Item -Force $tarballPath
    }

    # Use tar to package
    tar --exclude=".git" `
        --exclude="node_modules" `
        --exclude="dist" `
        --exclude="build" `
        --exclude=".agents" `
        --exclude="presence_db*.json" `
        --exclude="db.json" `
        --exclude="*.backup*.json" `
        --exclude="lecturer_presence_backup.json" `
        --exclude="lecturedash-update.tar.gz" `
        -czvf $tarballPath .

    if (-not (Test-Path $tarballPath)) {
        Write-Error "Failed to generate $tarballName."
        exit 1
    }

    $sizeKb = [math]::Round((Get-Item $tarballPath).Length / 1KB, 1)
    Write-Host "  [OK] Package created: $tarballName ($sizeKb KB)" -ForegroundColor Green

    # 3. SCP to Pi (/tmp)
    $remoteTmp = "/tmp/lecturedash-update.tar.gz"
    Write-Host "[3/5] Transferring archive to $PiUser@${PiHost}:$remoteTmp..." -ForegroundColor Cyan
    if (-not $Password) {
        Write-Host "  (You may be prompted for the Pi password)" -ForegroundColor DarkGray
    }

    scp -o StrictHostKeyChecking=accept-new $tarballPath "${PiUser}@${PiHost}:${remoteTmp}"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "SCP transfer failed. Please check credentials or network connection."
        exit 1
    }
    Write-Host "  [OK] Transfer complete." -ForegroundColor Green

    # 4. Remote extraction and safety backup
    Write-Host "[4/5] Extracting and updating files on Raspberry Pi..." -ForegroundColor Cyan

    $sudoPrefix = ""
    if ($Password) {
        $escapedPass = $Password.Replace("'", "'\''")
        $sudoPrefix = "echo '$escapedPass' | sudo -S "
    } else {
        $sudoPrefix = "sudo "
    }

    $remoteScript = @"
set -e
echo '==> Preparing target directory: $TargetDir'
${sudoPrefix}mkdir -p '$TargetDir'
${sudoPrefix}mkdir -p /var/backups/lecturedash || true

# Safety backup of existing database if it exists
if [ -f '$TargetDir/presence_db.json' ]; then
  TIMESTAMP=`$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="$TargetDir/presence_db.backup_`$TIMESTAMP.json"
  ${sudoPrefix}cp '$TargetDir/presence_db.json' "`$BACKUP_FILE"
  ${sudoPrefix}cp '$TargetDir/presence_db.json' /var/backups/lecturedash/presence_db_latest.json
  echo "[OK] Database backed up to: `$BACKUP_FILE"
elif [ -f '/var/www/presence_db.json' ]; then
  echo '[i] Migrating existing database from /var/www/presence_db.json...'
  ${sudoPrefix}cp '/var/www/presence_db.json' '$TargetDir/presence_db.json'
elif [ -f '/var/www/db.json' ]; then
  echo '[i] Migrating existing database from /var/www/db.json...'
  ${sudoPrefix}cp '/var/www/db.json' '$TargetDir/presence_db.json'
fi

# Extract new files into target directory
echo '==> Extracting files...'
${sudoPrefix}tar -xzf '$remoteTmp' -C '$TargetDir'
${sudoPrefix}rm -f '$remoteTmp'

# If presence_db.json is missing, restore from persistent safety backup
if [ ! -f '$TargetDir/presence_db.json' ] && [ -f /var/backups/lecturedash/presence_db_latest.json ]; then
  echo '[!] Restoring database from backup...'
  ${sudoPrefix}cp /var/backups/lecturedash/presence_db_latest.json '$TargetDir/presence_db.json'
fi

# Ensure permissions - chmod 666 so both root service and regular users can read/write
${sudoPrefix}chmod -R 775 '$TargetDir' || true
${sudoPrefix}chmod 666 '$TargetDir'/presence_db*.json 2>/dev/null || true
${sudoPrefix}chown -R `$USER:`$USER '$TargetDir' || true

cd '$TargetDir'

# If .env does not exist, initialize from .env.example
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo '[OK] Initialized .env from .env.example'
fi
"@

    if (-not $SkipBuild) {
        $remoteScript += @"

echo '==> Installing dependencies and building production bundle...'
if command -v npm >/dev/null 2>&1; then
  npm install
  npm run build
  echo '[OK] Build successful!'
else
  echo '[WARN] npm not found on Pi. Please install nodejs & npm to build.'
fi
"@
    }

    if (-not $SkipServiceRestart) {
        $remoteScript += @"

echo '==> Restarting systemd services...'
${sudoPrefix}chmod +x '$TargetDir/presence_agent.py' 2>/dev/null || true
${sudoPrefix}systemctl daemon-reload || true
${sudoPrefix}systemctl restart lecturedash.service 2>/dev/null || true
${sudoPrefix}systemctl restart presence-agent.service 2>/dev/null || true
${sudoPrefix}systemctl restart pn532-agent.service 2>/dev/null || true
sleep 3
echo -n 'lecturedash.service status: '
${sudoPrefix}systemctl is-active lecturedash.service || true
echo -n 'presence-agent.service status: '
${sudoPrefix}systemctl is-active presence-agent.service || true
"@
    }

    $remoteScript += @"

echo '==> Remote deployment steps finished.'
"@

    # Execute via SSH using bash -s
    $remoteScript = $remoteScript.Replace("`r`n", "`n")
    $remoteScript | ssh -o StrictHostKeyChecking=accept-new "${PiUser}@${PiHost}" "bash -s"
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "SSH execution completed with code $LASTEXITCODE. Please check remote logs above."
    } else {
        Write-Host ""
        Write-Host "[5/5] Deployment completed successfully! 🎉" -ForegroundColor Green
        Write-Host "  Web board is running at: http://${PiHost}:3000" -ForegroundColor Yellow

        # Quick Health Check Verification
        Write-Host ""
        Write-Host "==> Verifying API health on http://${PiHost}:3000..." -ForegroundColor Cyan
        try {
            Start-Sleep -Seconds 2
            $res = Invoke-RestMethod -Uri "http://${PiHost}:3000/api/network/config" -TimeoutSec 10
            $lec = Invoke-RestMethod -Uri "http://${PiHost}:3000/api/lecturers" -TimeoutSec 10
            Write-Host "  [OK] Health check passed!" -ForegroundColor Green
            Write-Host "       Router IP:    $($res.routerIp)" -ForegroundColor Gray
            Write-Host "       Subnet Mask:  $($res.subnetMask)" -ForegroundColor Gray
            Write-Host "       Lecturers:    $($lec.lecturers.Count) active in database" -ForegroundColor Gray
        } catch {
            Write-Warning "Note: Server is still starting up or endpoint could not be queried immediately."
        }
    }
}
finally {
    if ($tempAskpass -and (Test-Path $tempAskpass)) {
        Remove-Item -Force $tempAskpass -ErrorAction SilentlyContinue
    }
    Remove-Item env:SSH_ASKPASS -ErrorAction SilentlyContinue
    Remove-Item env:SSH_ASKPASS_REQUIRE -ErrorAction SilentlyContinue
}
