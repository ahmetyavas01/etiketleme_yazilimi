# Etiketleme Sistemi v3.0.0 - Electron Desktop Uygulaması

Bu proje, resim etiketleme işlemleri için geliştirilmiş bir Electron desktop uygulamasıdır. Mevcut web tabanlı backend, dashboard ve labeling-app yapısını bozmadan Electron wrapper ile desktop uygulamasına dönüştürülmüştür.

## 🚀 Özellikler

- 🖥️ **Desktop Uygulaması**: Electron ile native desktop deneyimi
- 📁 **Klasör Seçimi**: Native dosya sistemi erişimi ile kolay klasör seçimi
- 🏷️ **Resim Etiketleme**: Gelişmiş etiketleme arayüzü
- 📊 **Dashboard**: Proje yönetimi ve analiz
- 🔄 **Real-time**: WebSocket ile gerçek zamanlı güncellemeler
- 💾 **SQLite**: Yerel veritabanı ile hızlı erişim
- 🌐 **Remote Connection**: Uzak server bağlantısı desteği
- 🎨 **Modern UI**: Dark/Light mode desteği
- 📱 **Responsive**: Tüm ekran boyutlarına uyumlu

## 📋 Sistem Gereksinimleri

### Windows
- **İşletim Sistemi**: Windows 10/11 (x64, x86)
- **Node.js**: v16.0.0 veya üzeri
- **RAM**: Minimum 4GB (Önerilen 8GB)
- **Disk Alanı**: 500MB boş alan
- **Visual Studio Build Tools** (Build için gerekli)

### macOS
- **İşletim Sistemi**: macOS 10.14 veya üzeri
- **Node.js**: v16.0.0 veya üzeri
- **RAM**: Minimum 4GB (Önerilen 8GB)
- **Disk Alanı**: 500MB boş alan

### Linux
- **İşletim Sistemi**: Ubuntu 18.04+ / CentOS 7+ / Fedora 30+
- **Node.js**: v16.0.0 veya üzeri
- **RAM**: Minimum 4GB (Önerilen 8GB)
- **Disk Alanı**: 500MB boş alan

## 🛠️ Kurulum

### Windows Kurulumu

#### Yöntem 1: Otomatik Kurulum (Önerilen)
1. **Dependencies otomatik yükleme:**
   ```batch
   install-deps.bat
   ```

2. **Uygulamayı başlatma:**
   ```batch
   start-app.bat
   ```

#### Yöntem 2: Manuel Kurulum
1. **Node.js yükleyin:**
   - [Node.js İndirme Linki](https://nodejs.org/) (LTS versiyonu önerilir)
   - Yükleme sırasında "Add to PATH" seçeneğini işaretleyin

2. **Projeyi klonlayın:**
   ```bash
   git clone <repository-url>
   cd etiketleme-yazilimi-main
   ```

3. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   cd backend
   npm install
   cd ..
   ```

4. **Uygulamayı başlatın:**
   ```bash
   npm start
   ```

### macOS Kurulumu

1. **Homebrew ile Node.js yükleyin:**
   ```bash
   brew install node
   ```

2. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   cd backend && npm install && cd ..
   ```

3. **Uygulamayı başlatın:**
   ```bash
   npm start
   ```

### Linux Kurulumu

1. **Node.js yükleyin:**
   ```bash
   # Ubuntu/Debian
   curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # CentOS/RHEL
   curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
   sudo yum install -y nodejs
   ```

2. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   cd backend && npm install && cd ..
   ```

3. **Uygulamayı başlatın:**
   ```bash
   npm start
   ```

## 🔨 Build ve Dağıtım

### Windows Build

#### Otomatik Build (Önerilen)
```batch
build-windows.bat
```

#### Manuel Build
```bash
# Windows EXE oluşturma
npm run build:exe:win

# Windows dağıtım paketi
npm run dist:win

# Sadece paketleme
npm run pack:win
```

#### Build Script'leri
```bash
# Ana dependencies yükleme
npm run backend:install

# Backend başlatma
npm run backend:start

# Backend geliştirme modu
npm run backend:dev

# Temizlik
npm run clean:win

# Dependencies kontrolü
npm run check:deps:win
```

### macOS Build
```bash
# macOS DMG oluşturma
npm run build:dmg

# macOS dağıtım paketi
npm run dist
```

### Linux Build
```bash
# Linux AppImage oluşturma
npm run dist
```

## 🛠️ Geliştirme

### Geliştirme Modu
```bash
# Ana uygulama geliştirme
npm run dev

# Windows özel geliştirme
npm run dev:win

# Backend geliştirme
npm run backend:dev
```

### Build İşlemleri
```bash
# TypeScript build
npm run build

# Asset kopyalama
npm run copy-assets

# Windows asset kopyalama
npm run copy-assets:win
```

### Test ve Kontrol
```bash
# Windows test
npm run test:win

# Dependencies kontrolü
npm run check:deps

# Windows dependencies kontrolü
npm run check:deps:win
```

## Proje Yapısı

```
etiketleme-sistemi/
├── main.js                 # Electron ana süreç
├── preload.js             # Güvenli API erişimi
├── package.json           # Proje konfigürasyonu
├── backend/               # Express.js backend
│   ├── server.js         # Ana server dosyası
│   ├── database.js       # SQLite veritabanı yönetimi
│   └── auth.js           # Kimlik doğrulama
├── dashboard/             # Dashboard arayüzü
│   ├── index.html        # Ana dashboard sayfası
│   ├── css/              # Stil dosyaları
│   └── js/               # JavaScript dosyaları
└── labeling-app/          # Etiketleme uygulaması
    ├── index.html        # Etiketleme arayüzü
    └── js/               # JavaScript dosyaları
```

## Kullanım

1. **Uygulamayı başlatın** - Backend server otomatik olarak başlar
2. **Dashboard'da proje oluşturun** - "Klasör Seç" butonu ile resim klasörü seçin
3. **Etiketleme uygulamasını açın** - Dashboard'dan "Etiketleme Uygulaması" butonuna tıklayın
4. **Resimleri etiketleyin** - Gelişmiş arayüz ile kolay etiketleme

## Teknik Detaylar

- **Electron**: Desktop uygulama framework'ü
- **Express.js**: Backend API server
- **Better-SQLite3**: Yerel veritabanı
- **Socket.IO**: Real-time iletişim
- **Multer**: Dosya yükleme
- **Sharp**: Resim işleme

## 🚨 Sorun Giderme

### Windows Sorunları

#### Node.js Bulunamadı
```
❌ Node.js bulunamadı! Lütfen Node.js'i yükleyin.
```
**Çözüm:**
1. [Node.js İndirme Linki](https://nodejs.org/) (LTS versiyonu)
2. Yükleme sırasında "Add to PATH" seçeneğini işaretleyin
3. Bilgisayarı yeniden başlatın

#### Visual Studio Build Tools Hatası
```
❌ spawn ENOENT
💡 Windows için Visual Studio Build Tools gerekli olabilir.
```
**Çözüm:**
1. [Visual Studio Build Tools İndirme](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. "C++ build tools" bileşenini yükleyin
3. Windows SDK'yı dahil edin

#### Permission Hatası
```
❌ EACCES: permission denied
```
**Çözüm:**
1. Komut satırını "Yönetici olarak çalıştır"ın
2. Antivirus yazılımını geçici olarak devre dışı bırakın
3. Windows Defender'ı güncelleyin

### Genel Sorunlar

#### Backend Başlamıyor
- Node.js ve npm versiyonlarını kontrol edin: `node --version && npm --version`
- Port 3000'in kullanımda olmadığından emin olun
- Firewall ayarlarını kontrol edin

#### Veritabanı Hatası
- `backend/database.sqlite` dosyasının yazılabilir olduğundan emin olun
- Disk alanının yeterli olduğunu kontrol edin
- Antivirus taramasından sonra tekrar deneyin

#### Klasör Seçimi Çalışmıyor
- Electron API'sinin doğru yüklendiğinden emin olun
- Uygulama izinlerini kontrol edin
- Dosya sistemi erişim izinlerini kontrol edin

#### Memory Hatası
```
JavaScript heap out of memory
```
**Çözüm:**
```bash
# Node.js memory limitini artırın
set NODE_OPTIONS=--max_old_space_size=4096
npm start
```

### Debug Modu
```bash
# Verbose logging ile başlatın
DEBUG=* npm start

# Backend debug modu
npm run backend:dev
```

## 📞 Destek

### Log Dosyaları
- **Windows**: `%APPDATA%\Etiketleme Sistemi\logs\`
- **macOS**: `~/Library/Logs/Etiketleme Sistemi/`
- **Linux**: `~/.config/Etiketleme Sistemi/logs/`

### Sistem Bilgileri
```bash
# Sistem bilgilerini toplama
npm run check:deps:win
node --version
npm --version
```

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 🎯 Versiyon Geçmişi

### v3.0.0 (Mevcut)
- ✅ Windows tam desteği
- ✅ Otomatik kurulum script'leri
- ✅ Remote connection desteği
- ✅ Real-time WebSocket güncellemeleri
- ✅ Modern UI/UX
- ✅ Multi-platform build desteği

### v2.x
- Web tabanlı sürüm
- Temel etiketleme özellikleri
- SQLite veritabanı

### v1.x
- İlk sürüm
- Temel fonksiyonalite