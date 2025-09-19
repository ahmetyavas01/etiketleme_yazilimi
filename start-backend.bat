@echo off
echo 🚀 Etiketleme Sistemi Backend Server
echo ====================================

REM Change to the backend directory
cd /d "%~dp0backend"

echo 📁 Backend klasörü: %CD%
echo 🔧 Backend başlatılıyor...

REM Start the backend server with npm start
npm start

REM Keep the window open to see any errors
pause
