@echo off
setlocal EnableExtensions
chcp 65001 >nul
title StationHub — Cai dat Chrome Native Messaging

set "HOST_NAME=com.stationhub.chrome_bridge"
set "EXT_ID=hdbeonmlkpnbnimjdnbpgcpmomjdiplg"
set "PD=%ProgramData%\StationHub"
set "BRIDGE_DIR=%PD%\chrome-bridge"
set "BIN_DIR=%PD%\bin"
set "EXT_DIR=%PD%\chrome-extension"
set "MANIFEST=%BRIDGE_DIR%\%HOST_NAME%.json"

echo.
echo [StationHub] Dang ky Native Messaging cho Chrome...
echo.

rem --- Tim stationhub-chrome-bridge.exe ---
set "BRIDGE_EXE="

if exist "%~dp0..\bin\stationhub-chrome-bridge.exe" (
  set "BRIDGE_EXE=%~dp0..\bin\stationhub-chrome-bridge.exe"
)
if not defined BRIDGE_EXE if exist "%~dp0stationhub-chrome-bridge.exe" (
  set "BRIDGE_EXE=%~dp0stationhub-chrome-bridge.exe"
)
if not defined BRIDGE_EXE if exist "C:\Program Files\StationHub\bin\stationhub-chrome-bridge.exe" (
  set "BRIDGE_EXE=C:\Program Files\StationHub\bin\stationhub-chrome-bridge.exe"
)

if not defined BRIDGE_EXE (
  echo LOI: Khong tim thay stationhub-chrome-bridge.exe
  echo   Dat file .exe cung thu muc voi script nay, hoac trong agent\bin\
  pause
  exit /b 1
)

for %%I in ("%BRIDGE_EXE%") do set "BRIDGE_EXE=%%~fI"
echo   Bridge: %BRIDGE_EXE%

rem --- Copy bridge vao ProgramData (duong dan on dinh) ---
if /I not "%~dp0"=="%BIN_DIR%\" (
  if not exist "%BIN_DIR%" mkdir "%BIN_DIR%" 2>nul
  copy /Y "%BRIDGE_EXE%" "%BIN_DIR%\stationhub-chrome-bridge.exe" >nul
  if errorlevel 1 (
    echo LOI: Khong copy duoc bridge vao %BIN_DIR%
    pause
    exit /b 1
  )
  set "BRIDGE_EXE=%BIN_DIR%\stationhub-chrome-bridge.exe"
  echo   Da copy thanh cong: %BRIDGE_EXE%
)

if not exist "%BRIDGE_DIR%" mkdir "%BRIDGE_DIR%" 2>nul

rem --- Copy extension vao ProgramData ---
set "EXT_SRC="
if exist "%~dp0extension\manifest.json" (
  set "EXT_SRC=%~dp0extension"
)
if not defined EXT_SRC if exist "%~dp0..\chrome-extension\manifest.json" (
  set "EXT_SRC=%~dp0..\chrome-extension"
)
if not defined EXT_SRC (
  echo LOI: Khong tim thay thu muc extension
  echo   Can co extension\manifest.json cung goi cai dat
  pause
  exit /b 1
)

if not exist "%EXT_DIR%" mkdir "%EXT_DIR%" 2>nul
xcopy "%EXT_SRC%\*" "%EXT_DIR%\" /E /I /Y >nul
if errorlevel 1 (
  echo LOI: Khong copy duoc extension vao %EXT_DIR%
  pause
  exit /b 1
)
echo   Extension: %EXT_DIR%

rem --- Ghi manifest JSON (UTF-8 khong BOM) ---
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$exe='%BRIDGE_EXE%'; $manifest='%MANIFEST%'; $json=@{name='%HOST_NAME%';description='StationHub Agent Chrome Native Messaging Host';path=$exe;type='stdio';allowed_origins=@('chrome-extension://%EXT_ID%/')} | ConvertTo-Json -Compress; [System.IO.File]::WriteAllText($manifest, $json, [System.Text.UTF8Encoding]::new($false))"

if not exist "%MANIFEST%" (
  echo LOI: Khong tao duoc manifest %MANIFEST%
  pause
  exit /b 1
)
echo   Manifest: %MANIFEST%

rem --- Registry HKCU (khong can quyen Admin) ---
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%MANIFEST%" /f >nul
if errorlevel 1 (
  echo LOI: Khong ghi duoc Registry
  pause
  exit /b 1
)

echo.
echo [OK] Da dang ky Native Messaging.
echo.
echo Buoc tiep theo:
echo   1. Mo Chrome: chrome://extensions
echo   2. Bat "Che do nha phat trien"
echo   3. "Tai extension da giai nen" -^> chon %EXT_DIR%
echo   4. StationHub Agent tray -^> Cai dat -^> bat Chrome extension bridge
echo.
echo Dong Chrome het roi mo lai neu extension bao loi ket noi.
echo.

start "" "chrome://extensions"
pause
exit /b 0
