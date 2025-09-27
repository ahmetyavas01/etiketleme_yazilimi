# 🪟 Windows Kurulum ve Build Rehberi

Bu dosya Windows özelinde Etiketleme Sistemi v3.0.0 kurulumu ve build işlemleri için detaylı rehberdir.

## 📋 Ön Gereksinimler

### 1. Node.js Kurulumu
- **Versiyon**: v16.0.0 veya üzeri (LTS önerilir)
- **İndirme**: [Node.js Official Site](https://nodejs.org/)
- **Kurulum**: "Add to PATH" seçeneğini işaretleyin
- **Doğrulama**: `node --version` ve `npm --version`

### 2. Visual Studio Build Tools (Build için)
- **İndirme**: [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- **Bileşenler**: 
  - C++ build tools
  - Windows 10/11 SDK
  - CMake tools

### 3. Git (Geliştirme için)
- **İndirme**: [Git for Windows](https://git-scm.com/download/win)
- **Kurulum**: Varsayılan ayarlarla kurun

## 🚀 Hızlı Başlangıç

### Otomatik Kurulum
```batch
# 1. Dependencies yükle
install-deps.bat

# 2. Uygulamayı başlat
start-app.bat
```

### Build İşlemi
```batch
# Windows EXE oluştur
build-windows.bat
```

## 📁 Dosya Yapısı

```
etiketleme-sistemi/
├── install-deps.bat          # Otomatik dependencies kurulumu
├── start-app.bat            # Uygulama başlatıcı
├── start-backend.bat        # Backend server başlatıcı
├── build-windows.bat        # Windows build script
├── build-exe.js             # Gelişmiş build script
├── package.json             # Windows script'leri dahil
├── build/
│   └── installer.nsh        # NSIS installer script
└── assets/
    └── README.md            # Icon rehberi
```

## 🔧 Manuel Kurulum

### 1. Proje Klonlama
```bash
git clone <repository-url>
cd etiketleme-yazilimi-main
```

### 2. Ana Dependencies
```bash
npm install
```

### 3. Backend Dependencies
```bash
cd backend
npm install
cd ..
```

### 4. Uygulama Başlatma
```bash
npm start
```

## 🏗️ Build İşlemleri

### Otomatik Build
```batch
build-windows.bat
```

### Manuel Build
```bash
# Windows EXE oluştur
npm run build:exe:win

# Windows dağıtım paketi
npm run dist:win

# Sadece paketleme
npm run pack:win
```

### Build Script'leri
```bash
# Ana dependencies yükle
npm run backend:install

# Backend başlat
npm run backend:start

# Backend geliştirme modu
npm run backend:dev

# Temizlik
npm run clean:win

# Dependencies kontrolü
npm run check:deps:win
```

## 📦 Output Dosyaları

Build işlemi sonrası `dist-electron/` klasöründe:

- `Etiketleme Sistemi Setup 3.0.0.exe` - NSIS installer
- `Etiketleme Sistemi Setup 3.0.0.exe.blockmap` - Update dosyası
- `latest.yml` - Update metadata
- `win-unpacked/` - Unpacked uygulama dosyaları

## 🚨 Sorun Giderme

### Node.js Bulunamadı
```
❌ Node.js bulunamadı! Lütfen Node.js'i yükleyin.
```
**Çözüm:**
1. Node.js'i PATH'e ekleyin
2. Bilgisayarı yeniden başlatın
3. Komut satırını yeniden açın

### Build Tools Hatası
```
❌ spawn ENOENT
💡 Windows için Visual Studio Build Tools gerekli olabilir.
```
**Çözüm:**
1. Visual Studio Build Tools'u yükleyin
2. "C++ build tools" bileşenini seçin
3. Windows SDK'yı dahil edin

### Permission Hatası
```
❌ EACCES: permission denied
```
**Çözüm:**
1. Komut satırını "Yönetici olarak çalıştır"ın
2. Antivirus'u geçici olarak devre dışı bırakın
3. Windows Defender'ı güncelleyin

### Memory Hatası
```
JavaScript heap out of memory
```
**Çözüm:**
```bash
set NODE_OPTIONS=--max_old_space_size=4096
npm start
```

## 🔍 Debug ve Test

### Verbose Logging
```bash
DEBUG=* npm start
```

### Backend Debug
```bash
npm run backend:dev
```

### Dependencies Kontrolü
```bash
npm run check:deps:win
```

## 📊 Performans Optimizasyonu

### Build Cache
```bash
# Electron Builder cache temizle
rmdir /s /q "%USERPROFILE%\.cache\electron-builder"

# NPM cache temizle
npm cache clean --force
```

### Memory Optimization
```bash
# Node.js memory limit artır
set NODE_OPTIONS=--max_old_space_size=8192
```

## 🎯 Production Build

### Release Build
```bash
# Production environment
set NODE_ENV=production
set APP_ENV=production

# Build
npm run build:exe:win
```

### Code Signing (Opsiyonel)
```bash
# Certificate ile imzalama
set CSC_LINK=path/to/certificate.p12
set CSC_KEY_PASSWORD=password
npm run build:exe:win
```

## 📞 Destek

### Log Dosyaları
- **Build Logs**: `dist-electron/` klasörü
- **App Logs**: `%APPDATA%\Etiketleme Sistemi\logs\`
- **NPM Logs**: `npm config get cache` klasörü

### Sistem Bilgileri
```bash
# Sistem bilgileri
systeminfo

# Node.js bilgileri
node --version
npm --version
npm config list
```

---

**Not**: Bu rehber Windows 10/11 için optimize edilmiştir. Farklı Windows versiyonları için ek konfigürasyon gerekebilir.
