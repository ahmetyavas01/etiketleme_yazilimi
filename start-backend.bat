@echo off
chcp 65001 >nul
echo 🚀 Etiketleme Sistemi Backend Server
echo ====================================

REM Set error handling
setlocal enabledelayedexpansion

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js bulunamadı! Lütfen Node.js'i yükleyin.
    echo 💡 İndirme linki: https://nodejs.org/
    pause
    exit /b 1
)

REM Change to the backend directory
cd /d "%~dp0backend"

if not exist "package.json" (
    echo ❌ Backend package.json bulunamadı!
    echo 📁 Mevcut klasör: %CD%
    pause
    exit /b 1
)

echo 📁 Backend klasörü: %CD%
echo 📦 Node.js versiyonu:
node --version
echo 📦 NPM versiyonu:
npm --version

REM Check if node_modules exists
if not exist "node_modules" (
    echo 🔧 Dependencies yükleniyor...
    npm install
    if errorlevel 1 (
        echo ❌ Dependencies yüklenirken hata oluştu!
        pause
        exit /b 1
    )
)

echo 🔧 Backend başlatılıyor...
echo 🌐 Server: http://localhost:3000
echo 📊 Dashboard: http://localhost:3000/dashboard
echo 🎯 Labeling App: http://localhost:3000/labeling-app
echo.
echo ⚠️  Bu pencereyi kapatmayın! Server çalışırken açık kalmalıdır.
echo.

REM Start the backend server with npm start
npm start

REM Keep the window open to see any errors
echo.
echo 🛑 Server durduruldu.
pause
