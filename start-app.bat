@echo off
chcp 65001 >nul
echo 🚀 Etiketleme Sistemi - Uygulama Başlatıcı
echo ==========================================

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

REM Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Dependencies bulunamadı! Yükleniyor...
    call install-deps.bat
    if errorlevel 1 (
        echo ❌ Dependencies yüklenirken hata oluştu!
        pause
        exit /b 1
    )
)

echo ✅ Tüm gerekli dosyalar hazır!
echo 🚀 Etiketleme Sistemi başlatılıyor...
echo.

REM Start the application
npm start

REM Keep the window open to see any errors
echo.
echo 🛑 Uygulama durduruldu.
pause
