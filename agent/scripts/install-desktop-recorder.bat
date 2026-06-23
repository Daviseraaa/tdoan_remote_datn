@echo off
setlocal EnableExtensions
chcp 65001 >nul
title StationHub - Cai dat Desktop Recorder

set "PD=%ProgramData%\StationHub"
set "BIN_DIR=%PD%\bin"

echo.
echo [StationHub] Cai dat Desktop Recorder...
echo.
echo   Thu muc dich: %BIN_DIR%
echo   ^(khong phai cung thu muc voi file Cai-dat.bat^)
echo.

rem --- Tao thu muc truoc khi copy ---
if not exist "%PD%" mkdir "%PD%"
if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"
if not exist "%BIN_DIR%" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "New-Item -ItemType Directory -Force -LiteralPath '%BIN_DIR%' | Out-Null"
)
if not exist "%BIN_DIR%" (
  echo LOI: Khong tao duoc thu muc %BIN_DIR%
  pause
  exit /b 1
)

set "RECORDER_EXE="
set "CORE_EXE="

if exist "%~dp0stationhub-desktop-recorder.exe" (
  set "RECORDER_EXE=%~dp0stationhub-desktop-recorder.exe"
)
if not defined RECORDER_EXE if exist "%~dp0..\bin\stationhub-desktop-recorder.exe" (
  set "RECORDER_EXE=%~dp0..\bin\stationhub-desktop-recorder.exe"
)

if exist "%~dp0stationhub-agent-native.exe" (
  set "CORE_EXE=%~dp0stationhub-agent-native.exe"
)
if not defined CORE_EXE if exist "%~dp0..\bin\stationhub-agent-native.exe" (
  set "CORE_EXE=%~dp0..\bin\stationhub-agent-native.exe"
)
if not defined CORE_EXE if exist "%LOCALAPPDATA%\Programs\StationHub Agent\resources\core\stationhub-agent-native.exe" (
  set "CORE_EXE=%LOCALAPPDATA%\Programs\StationHub Agent\resources\core\stationhub-agent-native.exe"
)
if not defined CORE_EXE if exist "C:\Program Files\StationHub\bin\stationhub-agent-native.exe" (
  set "CORE_EXE=C:\Program Files\StationHub\bin\stationhub-agent-native.exe"
)

if not defined RECORDER_EXE (
  echo LOI: Khong tim thay ung dung Desktop Recorder.
  echo   Giai nen day du goi zip va chay lai file nay.
  pause
  exit /b 1
)

if not defined CORE_EXE (
  echo LOI: Thieu bo phan ho tro chuc nang Chay lai.
  echo   Giai nen day du goi zip - can ca hai file .exe - hoac cai StationHub Agent.
  pause
  exit /b 1
)

for %%I in ("%RECORDER_EXE%") do set "RECORDER_EXE=%%~fI"
for %%I in ("%CORE_EXE%") do set "CORE_EXE=%%~fI"

copy /Y "%RECORDER_EXE%" "%BIN_DIR%\stationhub-desktop-recorder.exe" >nul
if errorlevel 1 (
  echo LOI: Khong cai dat duoc. Thu chay lai voi quyen nguoi dung binh thuong.
  pause
  exit /b 1
)

copy /Y "%CORE_EXE%" "%BIN_DIR%\stationhub-agent-native.exe" >nul
if errorlevel 1 (
  echo LOI: Khong cai dat duoc bo phan chay lai.
  pause
  exit /b 1
)

echo.
echo [OK] Cai dat xong.
echo.
echo Mo Desktop Recorder tu:
echo   %BIN_DIR%\stationhub-desktop-recorder.exe
echo.
echo Co the tao shortcut tren Desktop den duong dan tren.
echo.

set /p OPEN="Mo Desktop Recorder ngay? (Y/N): "
if /I "%OPEN%"=="Y" start "" "%BIN_DIR%\stationhub-desktop-recorder.exe"

pause
exit /b 0
