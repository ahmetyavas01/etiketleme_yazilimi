# Etiketleme Sistemi - Electron Desktop Uygulaması

Bu proje, resim etiketleme işlemleri için geliştirilmiş bir Electron desktop uygulamasıdır. Mevcut web tabanlı backend, dashboard ve labeling-app yapısını bozmadan Electron wrapper ile desktop uygulamasına dönüştürülmüştür.

## Özellikler

- 🖥️ **Desktop Uygulaması**: Electron ile native desktop deneyimi
- 📁 **Klasör Seçimi**: Native dosya sistemi erişimi ile kolay klasör seçimi
- 🏷️ **Resim Etiketleme**: Gelişmiş etiketleme arayüzü
- 📊 **Dashboard**: Proje yönetimi ve analiz
- 🔄 **Real-time**: WebSocket ile gerçek zamanlı güncellemeler
- 💾 **SQLite**: Yerel veritabanı ile hızlı erişim

## Kurulum

1. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   ```

2. **Uygulamayı başlatın:**
   ```bash
   npm start
   ```

## Geliştirme

- **Geliştirme modu:**
  ```bash
  npm run dev
  ```

- **Build:**
  ```bash
  npm run build
  ```

- **Dağıtım paketi oluştur:**
  ```bash
  npm run dist
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

## Sorun Giderme

- **Klasör seçimi çalışmıyor**: Electron API'sinin doğru yüklendiğinden emin olun
- **Backend başlamıyor**: Node.js ve npm versiyonlarını kontrol edin
- **Veritabanı hatası**: `backend/database.sqlite` dosyasının yazılabilir olduğundan emin olun

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır.