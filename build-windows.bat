@echo off
chcp 65001 >nul
echo 🔨 Etiketleme Sistemi - Windows Build
echo =====================================

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

REM Clean previous builds
echo 🧹 Önceki build dosyaları temizleniyor...
if exist "dist-electron" rmdir /s /q "dist-electron"
if exist "dist" rmdir /s /q "dist"

REM Install dependencies if needed
if not exist "node_modules" (
    echo 📦 Dependencies yükleniyor...
    call install-deps.bat
    if errorlevel 1 (
        echo ❌ Dependencies yüklenirken hata oluştu!
        pause
        exit /b 1
    )
)

REM Set production environment
set NODE_ENV=production
set APP_ENV=production

echo 🔨 Windows EXE dosyası oluşturuluyor...
echo ⏳ Bu işlem birkaç dakika sürebilir...
echo.

REM Build the EXE
npm run dist:win
if errorlevel 1 (
    echo ❌ Build işlemi başarısız!
    pause
    exit /b 1
)

echo.
echo ✅ Windows build başarıyla tamamlandı!
echo 📁 Output klasörü: dist-electron/
echo.

REM List output files
if exist "dist-electron" (
    echo 📋 Oluşturulan dosyalar:
    dir /b "dist-electron"
    echo.
    echo 💡 EXE dosyasını çalıştırmak için dist-electron klasöründeki .exe dosyasını kullanın.
) else (
    echo ⚠️  dist-electron klasörü bulunamadı!
)

echo.
pause
