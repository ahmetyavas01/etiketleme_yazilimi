@echo off
chcp 65001 >nul
echo 📦 Etiketleme Sistemi - Dependencies Kurulum
echo ============================================

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

echo ✅ Node.js bulundu:
node --version
echo ✅ NPM bulundu:
npm --version
echo.

REM Install root dependencies
echo 🔧 Ana dependencies yükleniyor...
npm install
if errorlevel 1 (
    echo ❌ Ana dependencies yüklenirken hata oluştu!
    pause
    exit /b 1
)

REM Install backend dependencies
echo 🔧 Backend dependencies yükleniyor...
cd backend
npm install
if errorlevel 1 (
    echo ❌ Backend dependencies yüklenirken hata oluştu!
    pause
    exit /b 1
)
cd ..

REM Install electron-builder dependencies
echo 🔧 Electron Builder dependencies yükleniyor...
npx electron-builder install-app-deps --platform=win32
if errorlevel 1 (
    echo ⚠️  Electron Builder dependencies yüklenirken uyarı oluştu, devam ediliyor...
)

echo.
echo ✅ Tüm dependencies başarıyla yüklendi!
echo 🚀 Artık 'npm start' ile uygulamayı başlatabilirsiniz.
echo.
pause
