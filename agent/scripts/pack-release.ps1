# Dong goi ban phat hanh StationHub
# Usage: .\scripts\pack-release.ps1 [-OutDir "..."] [-Version "1.0.0"] [-SkipBuild]

param(
  [string]$OutDir = "C:\Users\trant\Documents\StationHub\release_v1.0.0",
  [string]$Version = "1.0.0",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$AgentRoot = Split-Path -Parent $PSScriptRoot

# Exe Rust release thuc te ~900KB; 13 byte = file hong (vd. echo CMD ghi de)
$MinBridgeBytes = 100000
$MinRecorderBytes = 500000
$MinCoreBytes = 2000000

function Require-Path([string]$Path, [string]$Hint) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Thieu file: $Path`n$Hint"
  }
}

function Assert-ValidExe([string]$Path, [int]$MinBytes, [string]$Label) {
  Require-Path $Path "Can file $Label hop le."
  $len = (Get-Item -LiteralPath $Path).Length
  if ($len -lt $MinBytes) {
    throw "File $Label khong hop le (chi $len bytes, can >= ${MinBytes}): $Path. Co the bi ghi de boi loi CMD hoac chua build. Chay: cd agent; npm run build:chrome-bridge"
  }
  Write-Host ('(pack-release) ' + $Label + ' OK (' + [math]::Round($len / 1KB, 1) + ' KB)')
}

function Invoke-AgentNpm([string]$Script) {
  Write-Host ('(pack-release) npm run ' + $Script + ' ...')
  Push-Location $AgentRoot
  try {
    & npm run $Script
    if ($LASTEXITCODE -ne 0) {
      throw "npm run $Script that bai (exit $LASTEXITCODE)"
    }
  } finally {
    Pop-Location
  }
}

function Ensure-Binary {
  param(
    [string]$RelativePath,
    [int]$MinBytes,
    [string]$Label,
    [string]$BuildScript
  )

  $full = Join-Path $AgentRoot $RelativePath
  $needsBuild = $true
  if (Test-Path -LiteralPath $full) {
    $len = (Get-Item -LiteralPath $full).Length
    $needsBuild = $len -lt $MinBytes
    if (-not $needsBuild) {
      Write-Host ('(pack-release) ' + $Label + ' da co san (' + [math]::Round($len / 1KB, 1) + ' KB)')
      return $full
    }
    Write-Warning ('(pack-release) ' + $Label + ' hong (' + $len + ' bytes) - se build lai')
  }

  if ($SkipBuild) {
    throw "Thieu hoac hong ${Label}: $full - Chay npm run $BuildScript (hoac bo -SkipBuild)"
  }

  Invoke-AgentNpm $BuildScript
  Assert-ValidExe $full $MinBytes $Label
  return $full
}

function Copy-VerifiedExe([string]$Source, [string]$Dest, [int]$MinBytes, [string]$Label) {
  $destDir = Split-Path -Parent $Dest
  if ($destDir -and -not (Test-Path $destDir)) {
    $null = New-Item -ItemType Directory -Force -Path $destDir
  }
  Copy-Item -LiteralPath $Source -Destination $Dest -Force
  Assert-ValidExe $Dest $MinBytes "$Label (sau copy)"
}

Write-Host ('(pack-release) Agent root: ' + $AgentRoot)
Write-Host ('(pack-release) Output:     ' + $OutDir)
Write-Host ('(pack-release) Version:    ' + $Version)

$bridgeSrc = Ensure-Binary `
  -RelativePath "bin\stationhub-chrome-bridge.exe" `
  -MinBytes $MinBridgeBytes `
  -Label "stationhub-chrome-bridge.exe" `
  -BuildScript "build:chrome-bridge"

$recorderSrc = Ensure-Binary `
  -RelativePath "bin\stationhub-desktop-recorder.exe" `
  -MinBytes $MinRecorderBytes `
  -Label "stationhub-desktop-recorder.exe" `
  -BuildScript "build:desktop-recorder"

$coreSrc = Ensure-Binary `
  -RelativePath "bin\stationhub-agent-native.exe" `
  -MinBytes $MinCoreBytes `
  -Label "stationhub-agent-native.exe" `
  -BuildScript "build:core"

Require-Path (Join-Path $AgentRoot "scripts\install-chrome-bridge.bat") ""
Require-Path (Join-Path $AgentRoot "scripts\install-desktop-recorder.bat") ""

$null = New-Item -ItemType Directory -Force -Path $OutDir
$chromeDir = Join-Path $OutDir "StationHub-Chrome-Recorder-$Version"
if (Test-Path $chromeDir) { Remove-Item $chromeDir -Recurse -Force }
$null = New-Item -ItemType Directory -Force -Path $chromeDir
$null = New-Item -ItemType Directory -Force -Path (Join-Path $chromeDir "extension")

Copy-Item (Join-Path $AgentRoot "scripts\install-chrome-bridge.bat") (Join-Path $chromeDir "Cai-dat.bat") -Force
Copy-VerifiedExe `
  -Source $bridgeSrc `
  -Dest (Join-Path $chromeDir "stationhub-chrome-bridge.exe") `
  -MinBytes $MinBridgeBytes `
  -Label "zip\stationhub-chrome-bridge.exe"

Copy-Item (Join-Path $AgentRoot "chrome-extension\*") (Join-Path $chromeDir "extension") -Recurse -Force
Get-ChildItem (Join-Path $chromeDir "extension") -Filter ".extension-key.pem" -Recurse -ErrorAction SilentlyContinue |
  Remove-Item -Force -ErrorAction SilentlyContinue

Copy-VerifiedExe `
  -Source $recorderSrc `
  -Dest (Join-Path $OutDir "stationhub-desktop-recorder-$Version.exe") `
  -MinBytes $MinRecorderBytes `
  -Label "stationhub-desktop-recorder-$Version.exe"

$desktopDir = Join-Path $OutDir "StationHub-Desktop-Recorder-$Version"
if (Test-Path $desktopDir) { Remove-Item $desktopDir -Recurse -Force }
$null = New-Item -ItemType Directory -Force -Path $desktopDir

Copy-Item (Join-Path $AgentRoot "scripts\install-desktop-recorder.bat") (Join-Path $desktopDir "Cai-dat.bat") -Force
Copy-VerifiedExe `
  -Source $recorderSrc `
  -Dest (Join-Path $desktopDir "stationhub-desktop-recorder.exe") `
  -MinBytes $MinRecorderBytes `
  -Label "zip\stationhub-desktop-recorder.exe"
Copy-VerifiedExe `
  -Source $coreSrc `
  -Dest (Join-Path $desktopDir "stationhub-agent-native.exe") `
  -MinBytes $MinCoreBytes `
  -Label "zip\stationhub-agent-native.exe"

$desktopZipPath = Join-Path $OutDir "StationHub-Desktop-Recorder-$Version.zip"
if (Test-Path $desktopZipPath) { Remove-Item $desktopZipPath -Force }
Compress-Archive -Path $desktopDir -DestinationPath $desktopZipPath -Force

$verifyDesktopDir = Join-Path $env:TEMP "stationhub-desktop-pack-$([guid]::NewGuid().ToString('N'))"
try {
  Expand-Archive -LiteralPath $desktopZipPath -DestinationPath $verifyDesktopDir -Force
  $zipCore = Join-Path $verifyDesktopDir "StationHub-Desktop-Recorder-$Version\stationhub-agent-native.exe"
  $zipRec = Join-Path $verifyDesktopDir "StationHub-Desktop-Recorder-$Version\stationhub-desktop-recorder.exe"
  Assert-ValidExe $zipCore $MinCoreBytes "stationhub-agent-native.exe (trong desktop zip)"
  Assert-ValidExe $zipRec $MinRecorderBytes "stationhub-desktop-recorder.exe (trong desktop zip)"
} finally {
  if (Test-Path $verifyDesktopDir) { Remove-Item $verifyDesktopDir -Recurse -Force -ErrorAction SilentlyContinue }
}

$setup = $null
foreach ($relDir in @("desktop\release-v1.0.0", "desktop\release-fresh", "desktop\release")) {
  $setup = Get-ChildItem (Join-Path $AgentRoot $relDir) -Filter "StationHub Agent Setup *.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($setup) { break }
}
if ($setup) {
  Copy-Item $setup.FullName (Join-Path $OutDir "StationHub-Agent-Setup-$Version.exe") -Force
  Write-Host ('(pack-release) Agent setup: ' + $setup.Name)
} else {
  Write-Warning 'Chua co installer Agent - chay: npm run dist:desktop'
}

$zipPath = Join-Path $OutDir "StationHub-Chrome-Recorder-$Version.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path $chromeDir -DestinationPath $zipPath -Force

$repoRoot = Split-Path $AgentRoot -Parent
$releaseNotesSrc = Join-Path $repoRoot "docs\production\release-notes-v$Version.md"
if (Test-Path -LiteralPath $releaseNotesSrc) {
  Copy-Item -LiteralPath $releaseNotesSrc -Destination (Join-Path $OutDir "RELEASE_NOTES.md") -Force
  Write-Host ('(pack-release) RELEASE_NOTES.md <- ' + $releaseNotesSrc)
} else {
  Write-Warning ('(pack-release) Thieu release notes: ' + $releaseNotesSrc)
}

# Kiem tra exe trong zip (giai nen tam)
$verifyDir = Join-Path $env:TEMP "stationhub-pack-verify-$([guid]::NewGuid().ToString('N'))"
try {
  Expand-Archive -LiteralPath $zipPath -DestinationPath $verifyDir -Force
  $zipBridge = Join-Path $verifyDir "StationHub-Chrome-Recorder-$Version\stationhub-chrome-bridge.exe"
  Assert-ValidExe $zipBridge $MinBridgeBytes "stationhub-chrome-bridge.exe (trong zip)"
} finally {
  if (Test-Path $verifyDir) { Remove-Item $verifyDir -Recurse -Force -ErrorAction SilentlyContinue }
}

Write-Host ''
Write-Host '(pack-release) OK'
Get-ChildItem $OutDir | Sort-Object Name | Format-Table Name, @{ N = 'Size_KB'; E = { [math]::Round($_.Length / 1KB, 1) } } -AutoSize
