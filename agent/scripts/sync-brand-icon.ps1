# Dong bo favicon tu landing -> agent, admin, chrome extension
# Usage: .\scripts\sync-brand-icon.ps1

$ErrorActionPreference = "Stop"
$AgentRoot = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent $AgentRoot
$LandingIco = Join-Path $RepoRoot "landing-stationhub\public\favicon.ico"

if (-not (Test-Path $LandingIco)) {
  throw "Khong tim thay: $LandingIco"
}

$copyTargets = @(
  (Join-Path $AgentRoot "desktop\build\icon.ico"),
  (Join-Path $RepoRoot "admin-stationhub\public\favicon.ico")
)

foreach ($target in $copyTargets) {
  $dir = Split-Path -Parent $target
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Copy-Item -Force $LandingIco $target
  Write-Host "[sync-brand-icon] $target"
}

Add-Type -AssemblyName System.Drawing
$chromeIcons = Join-Path $AgentRoot "chrome-extension\icons"
New-Item -ItemType Directory -Force -Path $chromeIcons | Out-Null

foreach ($size in @(16, 32, 48, 128)) {
  $out = Join-Path $chromeIcons "icon$size.png"
  $icon = New-Object System.Drawing.Icon($LandingIco, $size, $size)
  $bmp = $icon.ToBitmap()
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $icon.Dispose()
  Write-Host "[sync-brand-icon] $out"
}

Write-Host "[sync-brand-icon] OK"
