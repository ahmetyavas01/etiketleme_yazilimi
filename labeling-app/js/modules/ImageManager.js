// Image Manager - Fotoğraf yönetimi için
class ImageManager {
    constructor(auth) {
        this.auth = auth;
        this.baseURL = this.getServerURL();
        this.currentProject = null;
        this.currentImageIndex = 0;
        this.totalImages = 0;
        this.currentImage = null;
        this.isLoading = false;
        
        // Performance optimizations
        this.annotationCache = new Map();
        this.imageCache = new Map();
        this.lastLoadTime = 0;
        this.labelingToolRetryCount = 0; // Retry counter for LabelingTool
        
        // Server IP'ini test et ve güncelle
        this.testAndSaveServerIP();
    }

    // Server URL'i dinamik olarak belirle
    getServerURL() {
        // Önce localStorage'dan kontrol et
        const savedIP = localStorage.getItem('serverIP');
        if (savedIP && savedIP !== '192.168.1.100') {
            console.log(`🔧 Kaydedilmiş IP kullanılıyor: ${savedIP}`);
            return `http://${savedIP}:3000/api`;
        }
        
        // window.location.hostname kullan
        const hostname = window.location.hostname;
        
        // Eğer localhost ise, localhost kullan
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            console.log('🔧 localhost tespit edildi, localhost kullanılacak');
            return `http://localhost:3000/api`;
        }
        
        // Diğer durumlarda window.location.hostname kullan
        console.log(`🔧 Hostname kullanılıyor: ${hostname}`);
        return `http://${hostname}:3000/api`;
    }

    // Server IP'ini test et ve kaydet
    async testAndSaveServerIP() {
        // Önce localStorage'dan kaydedilmiş IP'yi kontrol et
        const savedIP = localStorage.getItem('serverIP');
        if (savedIP) {
            console.log(`🔍 Kaydedilmiş IP test ediliyor: ${savedIP}`);
            try {
                const testURL = `http://${savedIP}:3000/api/health`;
                const response = await fetch(testURL, { 
                    method: 'GET',
                    signal: AbortSignal.timeout(2000)
                });
                
                if (response.ok) {
                    console.log(`✅ Kaydedilmiş IP çalışıyor: ${savedIP}`);
                    this.baseURL = `http://${savedIP}:3000/api`;
                    return savedIP;
                }
            } catch (error) {
                console.log(`❌ Kaydedilmiş IP çalışmıyor: ${savedIP}`, error.message);
                localStorage.removeItem('serverIP');
            }
        }
        
        // Localhost'u test et
        try {
            const localhostURL = `http://localhost:3000/api/health`;
            console.log(`🔍 Localhost test ediliyor`);
            const response = await fetch(localhostURL, { 
                method: 'GET',
                signal: AbortSignal.timeout(2000)
            });
            
            if (response.ok) {
                console.log(`✅ Localhost çalışıyor`);
                localStorage.setItem('serverIP', 'localhost');
                this.baseURL = `http://localhost:3000/api`;
                return 'localhost';
            }
        } catch (error) {
            console.log(`❌ Localhost çalışmıyor`, error.message);
        }
        
        console.warn('⚠️ Hiçbir IP adresi çalışmıyor, localhost kullanılıyor');
        this.baseURL = `http://localhost:3000/api`;
        return 'localhost';
    }

    // Proje seçildiğinde çağrılır
    async setProject(projectId) {
        console.log('📁 Proje ayarlanıyor:', projectId);
        
        // Önce proje bilgilerini al
        try {
            const projectResponse = await this.auth.authenticatedRequest(`${this.baseURL}/projects/${projectId}`);
            if (projectResponse.ok) {
                const projectData = await projectResponse.json();
                this.currentProject = projectData;
                console.log('✅ Proje bilgileri yüklendi:', this.currentProject);
            } else {
                throw new Error('Proje bilgileri alınamadı');
            }
        } catch (error) {
            console.error('❌ Proje bilgileri yüklenirken hata:', error);
            this.currentProject = { id: projectId }; // Fallback olarak sadece ID
        }
        
        this.currentImageIndex = 0;
        this.totalImages = 0;
        this.currentImage = null;
        
        try {
            // Proje bilgilerini yükle
            console.log('📁 Proje bilgileri yükleniyor...');
            await this.loadProjectInfo();
            
            // Proje fotoğraflarını yükle
            console.log('📸 Proje fotoğrafları yükleniyor...');
            await this.loadProjectImages();
            
            // Mevcut pozisyonu yükle
            console.log('📍 Mevcut pozisyon yükleniyor...');
            await this.loadCurrentPosition();
            
            // Önce tüm fotoğrafların is_labeled durumunu güncelle
            console.log('🔄 Fotoğrafların etiket durumu güncelleniyor...');
            try {
                const response = await this.auth.authenticatedRequest(`${this.baseURL}/update-labeled-status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Etiket durumu güncellendi:', result.message);
                }
            } catch (error) {
                console.warn('⚠️ Etiket durumu güncellenemedi:', error);
            }

            // Etiketlenmemiş ilk fotoğrafı bul
            console.log('🔍 Etiketlenmemiş fotoğraf aranıyor...');
            const unlabeledIndex = await this.findFirstUnlabeledImage();
            if (unlabeledIndex !== -1) {
                console.log('📸 Etiketlenmemiş fotoğraf bulundu:', unlabeledIndex);
                this.currentImageIndex = unlabeledIndex;
                await this.updateProjectPosition();
            } else {
                console.log('📸 Tüm fotoğraflar etiketlenmiş, ilk fotoğraf açılıyor');
            }
            
            // İlk fotoğrafı yükle
            console.log('📸 İlk fotoğraf yükleniyor...');
            await this.loadCurrentImage();
            
            // Kullanıcı bilgilerini güncelle
            if (window.labelingTool && window.labelingTool.updateUserInfo) {
                window.labelingTool.updateUserInfo();
            }
            
            console.log('✅ Proje başarıyla ayarlandı');
        } catch (error) {
            console.error('❌ Proje ayarlanırken hata:', error);
            throw error; // Hatayı yukarı fırlat
        }
    }

    // Proje bilgilerini yükle
    async loadProjectInfo() {
        try {
            const response = await this.auth.authenticatedRequest(`${this.baseURL}/projects/${this.currentProject.id}`);
            const project = await response.json();
            
            // currentProject'i tam obje olarak set et
            this.currentProject = {
                id: project.id,
                name: project.name,
                description: project.description,
                created_at: project.created_at,
                total_images: project.total_images
            };
            
            this.totalImages = project.total_images || 0;
            this.currentImageIndex = project.current_image_index || 0;
            
            console.log(`📁 Proje yüklendi: ${project.name}`);
            console.log(`📸 Toplam fotoğraf: ${this.totalImages}`);
            console.log(`📍 Mevcut pozisyon: ${this.currentImageIndex}`);
            
            return project;
        } catch (error) {
            console.error('❌ Proje bilgileri yüklenemedi:', error);
            throw error;
        }
    }

    // Proje fotoğraflarını yükle
    async loadProjectImages() {
        try {
            console.log(`🔍 Fotoğraflar yükleniyor: ${this.baseURL}/projects/${this.currentProject.id}/images`);
            const response = await this.auth.authenticatedRequest(`${this.baseURL}/projects/${this.currentProject.id}/images`);
            console.log(`🔍 Response status: ${response.status}`);
            
            if (response.ok) {
                this.images = await response.json();
                console.log(`📸 ${this.images.length} fotoğraf yüklendi:`, this.images);
                
                // totalImages'i de güncelle
                this.totalImages = this.images.length;
                console.log(`📸 totalImages güncellendi: ${this.totalImages}`);
            } else {
                console.error('❌ Fotoğraflar yüklenemedi, status:', response.status);
                this.images = [];
                this.totalImages = 0;
            }
        } catch (error) {
            console.error('❌ Fotoğraf yükleme hatası:', error);
            this.images = [];
            this.totalImages = 0;
        }
    }

    // Mevcut pozisyonu yükle
    async loadCurrentPosition() {
        if (this.totalImages === 0) {
            console.log('⚠️ Projede fotoğraf bulunamadı');
            return;
        }

        // Pozisyonu sınırla
        if (this.currentImageIndex >= this.totalImages) {
            this.currentImageIndex = this.totalImages - 1;
        }
        if (this.currentImageIndex < 0) {
            this.currentImageIndex = 0;
        }

        await this.loadCurrentImage();
    }

    // Mevcut fotoğrafı yükle
    async loadCurrentImage() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        
        try {
            console.log(`📸 Fotoğraf yükleniyor: ${this.currentImageIndex + 1}/${this.totalImages}`);
            
            const response = await this.auth.authenticatedRequest(
                `${this.baseURL}/projects/${this.currentProject.id}/images/${this.currentImageIndex}`
            );
            
            if (response.ok) {
                this.currentImage = await response.json();
                this.updateUI();
                
                // Hava durumu filtreleri için orijinal resim verisini kaydet
                if (window.labelingTool && window.labelingTool.saveOriginalImageData) {
                    window.labelingTool.saveOriginalImageData();
                }
                
                // Cache'i temizle (yeni fotoğraf için)
                this.clearCurrentImageAnnotationCache();
                console.log('🧹 Yeni fotoğraf için cache temizlendi');
                
                // Etiketleri yükle (yeni fotoğraf için)
                setTimeout(() => {
                    console.log('🏷️ Etiketler yükleniyor (yeni fotoğraf)');
                    this.loadImageAnnotations();
                }, 100); // 100ms bekle
                
                // Weather filter'ı yükle (her fotoğraf için kendi filter'ı)
                setTimeout(() => {
                    if (window.labelingTool && window.labelingTool.loadWeatherFilter) {
                        console.log('🌤️ Weather filter yükleniyor (yeni fotoğraf)');
                        window.labelingTool.loadWeatherFilter();
                    }
                }, 100); // 100ms bekle ki annotations yüklensin
            } else {
                console.error('❌ Fotoğraf yüklenemedi');
            }
        } catch (error) {
            console.error('❌ Fotoğraf yükleme hatası:', error);
        } finally {
            this.isLoading = false;
        }
    }

    // Sonraki fotoğrafa geç
    async nextImage() {
        // Eğer images henüz yüklenmemişse, totalImages'i kullan
        const maxImages = this.images ? Math.max(this.images.length, this.totalImages) : this.totalImages;
        
        console.log('🔍 ImageManager nextImage:', {
            currentImageIndex: this.currentImageIndex,
            totalImages: this.totalImages,
            imagesLength: this.images ? this.images.length : 0,
            maxImages: maxImages
        });
        
        if (this.currentImageIndex < maxImages - 1) {
            // Önceki fotoğrafın etiketlerini kaydet
            await this.saveCurrentImageAnnotationsBeforeSwitch();
            
            this.currentImageIndex++;
            await this.savePosition();
            await this.loadCurrentImage();
            return true;
        }
        return false;
    }

    // Önceki fotoğrafa geç
    async previousImage() {
        console.log('🔍 ImageManager previousImage:', {
            currentImageIndex: this.currentImageIndex,
            totalImages: this.totalImages,
            imagesLength: this.images ? this.images.length : 0
        });
        
        if (this.currentImageIndex > 0) {
            // Önceki fotoğrafın etiketlerini kaydet
            await this.saveCurrentImageAnnotationsBeforeSwitch();
            
            this.currentImageIndex--;
            await this.savePosition();
            await this.loadCurrentImage();
            return true;
        }
        return false;
    }

    // Belirli bir pozisyona git
    async goToPosition(position) {
        if (position >= 0 && position < this.totalImages) {
            // Önceki fotoğrafın etiketlerini kaydet
            await this.saveCurrentImageAnnotationsBeforeSwitch();
            
            this.currentImageIndex = position;
            await this.savePosition();
            await this.loadCurrentImage();
            return true;
        }
        return false;
    }

    // Mevcut fotoğrafın etiketlerini sil
    async deleteCurrentImageAnnotations() {
        if (!this.currentImage || !window.labelingTool) {
            return;
        }

        try {
            console.log('🗑️ Mevcut fotoğraf etiketleri siliniyor...', {
                imageId: this.currentImage.id
            });

            const response = await this.auth.authenticatedRequest(
                `${this.baseURL}/images/${this.currentImage.id}/annotations`,
                { method: 'DELETE' }
            );

            if (response.ok) {
                console.log('✅ Etiketler silindi');
                // Frontend'teki etiketleri de temizle
                if (window.labelingTool) {
                    window.labelingTool.annotations = [];
                    window.labelingTool.redraw();
                }
            } else {
                console.error('❌ Etiketler silinemedi:', response.statusText);
            }
        } catch (error) {
            console.error('❌ Etiket silme hatası:', error);
        }
    }

    // Fotoğraf değiştirmeden önce mevcut etiketleri kaydet
    async saveCurrentImageAnnotationsBeforeSwitch() {
        if (!this.currentImage || !window.labelingTool) {
            return;
        }

        if (window.labelingTool.annotations && window.labelingTool.annotations.length > 0) {
            console.log('💾 Fotoğraf değiştirmeden önce etiketler kaydediliyor...', {
                imageId: this.currentImage.id,
                annotationsCount: window.labelingTool.annotations.length
            });

            try {
                // Basit API ile tüm etiketleri kaydet (AUTH YOK)
                const response = await fetch(`${this.baseURL}/images/${this.currentImage.id}/annotations`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        annotations: window.labelingTool.annotations // Basit format
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log(`✅ ${result.saved_count} etiket fotoğraf değişimi öncesi kaydedildi`);
                } else {
                    console.error('❌ Etiketler kaydedilemedi:', response.statusText);
                }

                console.log('✅ Fotoğraf etiketleri başarıyla kaydedildi');
            } catch (error) {
                console.error('❌ Etiketler kaydedilirken hata:', error);
            }
        } else {
            console.log('ℹ️ Kaydedilecek etiket yok');
        }
    }

    // Mevcut pozisyonu kaydet
    async savePosition() {
        try {
            await this.auth.authenticatedRequest(
                `${this.baseURL}/projects/${this.currentProject.id}/position`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ current_index: this.currentImageIndex })
                }
            );
        } catch (error) {
            console.error('❌ Pozisyon kaydedilemedi:', error);
        }
    }

    // Fotoğrafı etiketli olarak işaretle
    async markAsLabeled(annotationData = null) {
        if (!this.currentImage) return false;

        try {
            const response = await this.auth.authenticatedRequest(
                `${this.baseURL}/images/${this.currentImage.id}/mark-labeled`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ annotation_data: annotationData })
                }
            );

            if (response.ok) {
                this.currentImage.is_labeled = 1;
                this.currentImage.labeled_at = new Date().toISOString();
                this.currentImage.labeled_by = this.auth.getUser().id;
                this.updateUI();
                return true;
            }
        } catch (error) {
            console.error('❌ Fotoğraf etiketlenemedi:', error);
        }
        return false;
    }

    // Fotoğrafı etiketlenmemiş olarak işaretle
    async markAsUnlabeled() {
        if (!this.currentImage) return false;

        try {
            const response = await this.auth.authenticatedRequest(
                `${this.baseURL}/images/${this.currentImage.id}/mark-unlabeled`,
                {
                    method: 'PUT'
                }
            );

            if (response.ok) {
                this.currentImage.is_labeled = 0;
                this.currentImage.labeled_at = null;
                this.currentImage.labeled_by = null;
                this.updateUI();
                return true;
            }
        } catch (error) {
            console.error('❌ Fotoğraf etiketlenmemiş olarak işaretlenemedi:', error);
        }
        return false;
    }

    // UI'yi güncelle
    updateUI() {
        // Fotoğraf gösterimi
        this.updateImageDisplay();
        
        // Fotoğraf listesi
        this.updateImageList();
        
        // Etiketleri yükle
        this.loadImageAnnotations();
    }

    // Fotoğraf gösterimini güncelle
    updateImageDisplay() {
        const imageContainer = document.getElementById('imageContainer');
        const imageElement = document.getElementById('currentImage');
        const canvas = document.getElementById('canvas');
        
        if (!imageContainer || !imageElement || !canvas || !this.currentImage) return;

        // Fotoğraf yolu - dosya adını kullan
        const fileName = this.currentImage.file_name || (this.currentImage.file_path ? this.currentImage.file_path.split('/').pop() : '');

        // window.location.hostname'e göre backend URL'sini oluştur
        // baseURL'den host ve port'u al, /api kısmını kaldır, sonra /api/files/... ekle
        let backendHost = window.location.hostname;
        let backendPort = '3000';
        // Eğer localStorage'da serverIP varsa onu kullan
        const savedIP = localStorage.getItem('serverIP');
        if (savedIP) {
            backendHost = savedIP;
        }
        // Eğer baseURL'de port varsa onu kullan
        try {
            const urlObj = new URL(this.baseURL);
            if (urlObj.port) backendPort = urlObj.port;
        } catch (e) {
            // baseURL bir URL değilse, port 3000 olarak kalır
        }
        const imageUrl = `http://${backendHost}:${backendPort}/api/files/${encodeURIComponent(fileName)}`;

        console.log('📸 Fotoğraf yükleniyor:', imageUrl);

        // Image element'i gizli olarak yükle
        imageElement.style.display = 'none';
        imageElement.crossOrigin = 'anonymous'; // CORS için
        imageElement.src = imageUrl;
        imageElement.alt = this.currentImage.file_name;

        // Loading state
        imageElement.onload = async () => {
            console.log('✅ Fotoğraf yüklendi, simple system\'e aktarılıyor...');
            imageContainer.classList.remove('loading');
            
            // Script.js'deki image referansını güncelle
            if (window.labelingTool) {
                window.labelingTool.image = imageElement;
                console.log('✅ Script.js image referansı güncellendi');
            }
            
            // Bu fotoğrafa ait etiketleri yükle
            await this.loadImageAnnotations();
        };

        imageElement.onerror = () => {
            imageContainer.classList.add('error');
            // Hata mesajında window.location.hostname ve port ile göster
            const shownUrl = `http://${backendHost}:${backendPort}/api/files/${encodeURIComponent(fileName)}`;
            console.error('❌ Fotoğraf yüklenemedi:', shownUrl);
        };

        imageContainer.classList.add('loading');
        imageContainer.classList.remove('error');
    }

    // Fotoğrafı canvas'a çiz - BÜYÜK BOYUTLU
    drawImageToCanvas(img, canvas) {
        const ctx = canvas.getContext('2d');
        
        // Canvas boyutlarını container'a göre ayarla
        const container = canvas.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // Canvas boyutlarını ayarla
        canvas.width = containerWidth;
        canvas.height = containerHeight;
        
        // Canvas'ı temizle
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Fotoğraf boyutlarını hesapla (aspect ratio korunarak)
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const containerAspect = containerWidth / containerHeight;
        
        let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
        
        // Canvas alanının en az %85'ini, maksimum %95'ini kullan
        const minUsage = 0.85;
        const maxUsage = 0.95;
        
        if (imgAspect > containerAspect) {
            // Fotoğraf daha geniş - genişliği container'ın %90'ına sığdır
            drawWidth = containerWidth * 0.9;
            drawHeight = drawWidth / imgAspect;
            
            // Eğer yükseklik çok büyükse, yüksekliği sınırla
            if (drawHeight > containerHeight * maxUsage) {
                drawHeight = containerHeight * maxUsage;
                drawWidth = drawHeight * imgAspect;
            }
            
            // Minimum boyut kontrolü
            if (drawWidth < containerWidth * minUsage && drawHeight < containerHeight * minUsage) {
                drawWidth = containerWidth * minUsage;
                drawHeight = drawWidth / imgAspect;
            }
        } else {
            // Fotoğraf daha yüksek - yüksekliği container'ın %90'ına sığdır
            drawHeight = containerHeight * 0.9;
            drawWidth = drawHeight * imgAspect;
            
            // Eğer genişlik çok büyükse, genişliği sınırla
            if (drawWidth > containerWidth * maxUsage) {
                drawWidth = containerWidth * maxUsage;
                drawHeight = drawWidth / imgAspect;
            }
            
            // Minimum boyut kontrolü
            if (drawHeight < containerHeight * minUsage && drawWidth < containerWidth * minUsage) {
                drawHeight = containerHeight * minUsage;
                drawWidth = drawHeight * imgAspect;
            }
        }
        
        // Tam ortala
        offsetX = (containerWidth - drawWidth) / 2;
        offsetY = (containerHeight - drawHeight) / 2;
        
        // Fotoğrafı büyük boyutlu ve ortalanmış şekilde çiz
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        
        console.log(`✅ Fotoğraf büyük boyutlu çizildi: ${drawWidth.toFixed(0)}x${drawHeight.toFixed(0)} @ (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);
    }

    // Eski loadImageAnnotations fonksiyonu kaldırıldı - optimized versiyon kullanılıyor


    // Klasör tarama
    async scanFolder() {
        if (!this.currentProject) return false;

        try {
            console.log('📁 Klasör taranıyor...');
            
            const response = await this.auth.authenticatedRequest(
                `${this.baseURL}/projects/${this.currentProject.id}/scan-images`,
                { method: 'POST' }
            );

            if (response.ok) {
                const result = await response.json();
                this.totalImages = result.total_images;
                this.currentImageIndex = 0;
                
                console.log(`✅ ${result.total_images} fotoğraf bulundu`);
                
                // İlk fotoğrafı yükle
                if (this.totalImages > 0) {
                    await this.loadCurrentImage();
                }
                
                return true;
            }
        } catch (error) {
            console.error('❌ Klasör tarama hatası:', error);
        }
        return false;
    }

    // Etiketlenmemiş ilk fotoğrafı bul
    async findFirstUnlabeledImage() {
        try {
            const response = await this.auth.authenticatedRequest(`${this.baseURL}/projects/${this.currentProject.id}/images`);
            if (!response.ok) {
                throw new Error('Fotoğraflar yüklenemedi');
            }
            
            const images = await response.json();
            
            // Etiketlenmemiş ilk fotoğrafı bul
            for (let i = 0; i < images.length; i++) {
                // Backend'den isLabeled (camelCase) geliyor
                if (!images[i].isLabeled) {
                    console.log(`📸 Etiketlenmemiş fotoğraf bulundu: ${i} - ${images[i].fileName}`);
                    return i;
                }
            }
            
            // Tüm fotoğraflar etiketlenmişse, ilk fotoğrafı döndür
            return images.length > 0 ? 0 : -1;
        } catch (error) {
            console.error('Etiketlenmemiş fotoğraf bulunurken hata:', error);
            return -1;
        }
    }

    // Proje pozisyonunu güncelle
    async updateProjectPosition() {
        try {
            await this.auth.authenticatedRequest(`${this.baseURL}/projects/${this.currentProject.id}/position`, {
                method: 'PUT',
                body: JSON.stringify({ current_index: this.currentImageIndex })
            });
        } catch (error) {
            console.error('Pozisyon güncellenirken hata:', error);
        }
    }

    // Fotoğraf listesini güncelle
    async updateImageList() {
        const imageListSection = document.getElementById('imageListSection');
        const imageList = document.getElementById('imageList');
        
        if (!imageListSection || !imageList) return;
        
        try {
            // Fotoğraf listesini yükle
            const response = await this.auth.authenticatedRequest(`${this.baseURL}/projects/${this.currentProject.id}/images`);
            if (!response.ok) return;
            
            const images = await response.json();
            
            // Listeyi temizle
            imageList.innerHTML = '';
            
            // 15'li sayfalama ile tüm fotoğrafları göster
            const itemsPerPage = 15;
            const totalPages = Math.ceil(images.length / itemsPerPage);
            const currentPage = Math.floor(this.currentImageIndex / itemsPerPage) + 1;
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = Math.min(startIndex + itemsPerPage, images.length);
            
            // Sayfa bilgisini güncelle
            this.updatePaginationInfo(currentPage, totalPages);
            
            // Bu sayfadaki fotoğrafları göster
            for (let i = startIndex; i < endIndex; i++) {
                const image = images[i];
                const listItem = document.createElement('div');
                listItem.className = 'image-thumbnail';
                if (i === this.currentImageIndex) {
                    listItem.classList.add('active');
                }
                
                // Fotoğraf adını kısalt
                const fileName = image.file_name || image.file_path.split('/').pop();
                const shortName = fileName.length > 20 ? fileName.substring(0, 20) + '...' : fileName;
                
                listItem.innerHTML = `
                    <div class="image-info">
                        <div class="image-name">${shortName}</div>
                        <div class="image-number">${i + 1}</div>
                    </div>
                `;
                
                // Tıklama olayı
                listItem.addEventListener('click', () => {
                    this.goToPosition(i);
                });
                
                imageList.appendChild(listItem);
            }
            
            // Fotoğraf listesi bölümünü göster
            imageListSection.style.display = 'block';
            
        } catch (error) {
            console.error('❌ Fotoğraf listesi yüklenemedi:', error);
        }
    }

    // Sayfalama bilgisini güncelle
    updatePaginationInfo(currentPage, totalPages) {
        const prevPageBtn = document.getElementById('prevPageBtn');
        const nextPageBtn = document.getElementById('nextPageBtn');
        const pageNumbersContainer = document.getElementById('pageNumbers');

        // Önceki/Sonraki butonları
        if (prevPageBtn) {
            prevPageBtn.disabled = currentPage <= 1;
            if (!prevPageBtn.hasAttribute('data-listener-added')) {
                prevPageBtn.addEventListener('click', () => this.goToPreviousPage());
                prevPageBtn.setAttribute('data-listener-added', 'true');
            }
        }
        
        if (nextPageBtn) {
            nextPageBtn.disabled = currentPage >= totalPages;
            if (!nextPageBtn.hasAttribute('data-listener-added')) {
                nextPageBtn.addEventListener('click', () => this.goToNextPage());
                nextPageBtn.setAttribute('data-listener-added', 'true');
            }
        }

        // Sayfa numaralarını oluştur
        this.renderPageNumbers(currentPage, totalPages, pageNumbersContainer);
    }

    // Sayfa numaralarını render et
    renderPageNumbers(currentPage, totalPages, container) {
        if (!container) return;

        container.innerHTML = '';
        
        // Eğer toplam sayfa 10'dan azsa, tüm sayfaları göster
        if (totalPages <= 10) {
            for (let i = 1; i <= totalPages; i++) {
                this.createPageNumber(i, i === currentPage, container);
            }
            return;
        }

        // İlk sayfa
        this.createPageNumber(1, currentPage === 1, container);
        
        // Başlangıç ellipsis
        if (currentPage > 4) {
            this.createEllipsis(container);
        }

        // Mevcut sayfa etrafındaki sayfalar
        const startPage = Math.max(2, currentPage - 2);
        const endPage = Math.min(totalPages - 1, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            if (i !== 1 && i !== totalPages) {
                this.createPageNumber(i, i === currentPage, container);
            }
        }

        // Son ellipsis
        if (currentPage < totalPages - 3) {
            this.createEllipsis(container);
        }

        // Son sayfa
        if (totalPages > 1) {
            this.createPageNumber(totalPages, currentPage === totalPages, container);
        }
    }

    // Sayfa numarası butonu oluştur
    createPageNumber(pageNumber, isActive, container) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-number ${isActive ? 'active' : ''}`;
        pageBtn.textContent = pageNumber;
        pageBtn.addEventListener('click', () => this.goToPage(pageNumber));
        container.appendChild(pageBtn);
    }

    // Ellipsis oluştur
    createEllipsis(container) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'page-number ellipsis';
        ellipsis.textContent = '...';
        container.appendChild(ellipsis);
    }

    // Belirli bir sayfaya git
    goToPage(pageNumber) {
        const itemsPerPage = 15;
        const newIndex = (pageNumber - 1) * itemsPerPage;
        this.goToPosition(newIndex);
    }

    // Önceki sayfaya git
    goToPreviousPage() {
        const itemsPerPage = 15;
        const currentPage = Math.floor(this.currentImageIndex / itemsPerPage) + 1;
        if (currentPage > 1) {
            const newIndex = (currentPage - 2) * itemsPerPage;
            this.goToPosition(newIndex);
        }
    }

    // Sonraki sayfaya git
    goToNextPage() {
        const itemsPerPage = 15;
        const totalPages = Math.ceil(this.totalImages / itemsPerPage);
        const currentPage = Math.floor(this.currentImageIndex / itemsPerPage) + 1;
        if (currentPage < totalPages) {
            const newIndex = currentPage * itemsPerPage;
            this.goToPosition(Math.min(newIndex, this.totalImages - 1));
        }
    }

    // İstatistikleri getir
    getStats() {
        // Bu metod frontend'de çağrılabilir
        return {
            currentIndex: this.currentImageIndex,
            totalImages: this.totalImages,
            progress: this.totalImages > 0 ? ((this.currentImageIndex + 1) / this.totalImages) * 100 : 0,
            isLabeled: this.currentImage ? this.currentImage.is_labeled === 1 : false
        };
    }

    // Optimized annotation loading with caching and performance monitoring
    async loadImageAnnotations() {
        if (!this.currentImage) {
            console.log('⚠️ Mevcut fotoğraf yok, etiket yüklenemez');
            return;
        }

        // Rate limiting - Son yüklemeden en az 1000ms geçmiş olmalı (daha uzun süre)
        const now = Date.now();
        if (now - this.lastLoadTime < 1000) {
            console.log('⏳ Rate limiting - çok sık yükleme engellendi, 1000ms bekle');
            setTimeout(() => {
                this.loadImageAnnotations();
            }, 1000);
            return;
        }
        this.lastLoadTime = now;

        // Cache kontrolü
        const cacheKey = `annotations_${this.currentImage.id}`;
        const cached = this.annotationCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < 30000) { // 30 saniye cache
            console.log('💾 Cache\'den etiketler yüklendi:', cached.data.length, 'adet');
            this.applyAnnotations(cached.data);
            
            // Debug paneli güncelle
            if (window.debugPanel) {
                window.debugPanel.updateAnnotationStatus(cached.data.length, new Date().toLocaleTimeString());
            }
            return;
        }

        try {
            console.log(`🔄 ${this.currentImage.filename || this.currentImage.id} için etiketler yükleniyor...`);
            
            // Performance timing
            const startTime = performance.now();
            
            // API çağrısı - Authentication ile
            const response = await this.auth.authenticatedRequest(`${this.baseURL}/images/${this.currentImage.id}/annotations`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.log('ℹ️ Bu fotoğraf için etiket bulunamadı');
                    this.clearAnnotations();
                    return;
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            }
            
            const annotations = await response.json();
            const loadTime = performance.now() - startTime;
            
            console.log(`📊 ${annotations.length} etiket yüklendi (${loadTime.toFixed(2)}ms)`);
            
            const parsedAnnotations = this.parseAnnotations(annotations);
            
            // Cache'e kaydet
            this.annotationCache.set(cacheKey, {
                data: parsedAnnotations,
                timestamp: Date.now()
            });
            
            // Cache boyutunu sınırla
            if (this.annotationCache.size > 50) {
                const firstKey = this.annotationCache.keys().next().value;
                this.annotationCache.delete(firstKey);
            }
            
            // Apply annotations
            this.applyAnnotations(parsedAnnotations);
            
            // Debug paneli güncelle
            if (window.debugPanel) {
                window.debugPanel.updateAnnotationStatus(parsedAnnotations.length, new Date().toLocaleTimeString());
            }
            
        } catch (error) {
            console.error('❌ Etiket yükleme hatası:', error);
            this.showError('Etiketler yüklenirken hata oluştu');
            this.clearAnnotations();
        }
    }

    parseAnnotations(annotations) {
        console.log('🔍 parseAnnotations çağrıldı:', {
            annotationsLength: annotations?.length || 0,
            annotations: annotations
        });
        
        // Backend'den artık direkt formatlanmış array geliyor
        if (!Array.isArray(annotations)) {
            console.warn('⚠️ Annotations array değil:', typeof annotations);
            return [];
        }
        
        const parsedAnnotations = [];
        
        annotations.forEach(annotation => {
            console.log('🔍 Annotation işleniyor:', annotation);
            
            if (this.validateAnnotation(annotation)) {
                parsedAnnotations.push(annotation);
                console.log('✅ Annotation eklendi:', annotation.label);
            } else {
                console.warn('⚠️ Geçersiz annotation atlandı:', annotation);
            }
        });
        
        console.log(`✅ ${parsedAnnotations.length} annotation parse edildi`);
        return parsedAnnotations;
    }
    
    validateAnnotation(annotation) {
        const isValid = annotation &&
               annotation.label &&
               typeof annotation.x === 'number' &&
               typeof annotation.y === 'number' &&
               typeof annotation.width === 'number' &&
               typeof annotation.height === 'number' &&
               annotation.width > 0 &&
               annotation.height > 0;
        
        // Points array kontrolü - eğer yoksa oluştur
        if (isValid && (!Array.isArray(annotation.points) || annotation.points.length < 4)) {
            console.log('🔧 Points array eksik veya yetersiz, oluşturuluyor:', annotation.label);
            this.createPointsArray(annotation);
        }
        
        if (!isValid) {
            console.warn('⚠️ Geçersiz annotation atlandı:', {
                hasLabel: !!annotation?.label,
                x: annotation?.x,
                y: annotation?.y,
                width: annotation?.width,
                height: annotation?.height,
                hasPoints: Array.isArray(annotation?.points),
                pointsLength: annotation?.points?.length,
                annotation: annotation
            });
        }
        
        return isValid;
    }
    
    // Points array oluştur
    createPointsArray(annotation) {
        const x = annotation.x;
        const y = annotation.y;
        const width = annotation.width;
        const height = annotation.height;
        
        // 4 köşe noktası oluştur (saat yönünde)
        annotation.points = [
            { x: x, y: y }, // Sol üst
            { x: x + width, y: y }, // Sağ üst
            { x: x + width, y: y + height }, // Sağ alt
            { x: x, y: y + height } // Sol alt
        ];
        
        console.log('✅ Points array oluşturuldu:', annotation.points);
    }
    
    applyAnnotations(annotations) {
        console.log('🔄 applyAnnotations çağrıldı:', {
            annotationsLength: annotations?.length || 0,
            labelingToolExists: !!window.labelingTool,
            annotations: annotations
        });
        
        // LabelingTool yüklenmesini bekle - Geliştirilmiş kontrol
        if (window.labelingTool && typeof window.labelingTool.annotations !== 'undefined') {
            console.log('✅ LabelingTool mevcut, etiketler yükleniyor...');
            
            // Annotations'ı güvenli şekilde ayarla
            window.labelingTool.annotations = annotations || [];
            
            // Annotation'ları validate et ve points array'ini düzelt
            if (window.labelingTool.validateAllAnnotations) {
                window.labelingTool.validateAllAnnotations();
                console.log('🔍 Annotationlar validate edildi');
            }
            
            // UI güncellemeleri
            if (window.labelingTool.updateAnnotationList) {
                window.labelingTool.updateAnnotationList();
                console.log('📋 Annotation listesi güncellendi');
            }
            
            if (window.labelingTool.updateLabelListFromAnnotations) {
                window.labelingTool.updateLabelListFromAnnotations();
                console.log('🏷️ Label listesi güncellendi');
            }
            
            if (window.labelingTool.redraw) {
                window.labelingTool.redraw();
                console.log('🎨 Canvas yeniden çizildi');
            }
            
            console.log(`✅ ${annotations?.length || 0} etiket LabelingTool'a yüklendi`);
        } else {
            // LabelingTool henüz yüklenmemiş, retry mekanizması
            console.log('⏳ LabelingTool bekleniyor...');
            
            // Retry counter'ı initialize et
            if (typeof this.labelingToolRetryCount === 'undefined') {
                this.labelingToolRetryCount = 0;
            }
            
            if (this.labelingToolRetryCount < 5) { // Maksimum 5 deneme
                this.labelingToolRetryCount++;
                console.log(`🔄 LabelingTool tekrar kontrol ediliyor... (${this.labelingToolRetryCount}/5)`);
                setTimeout(() => {
                    this.applyAnnotations(annotations);
                }, 500); // 500ms bekle
            } else {
                console.warn('⚠️ LabelingTool yüklenemedi, etiketler yüklenmedi');
                this.labelingToolRetryCount = 0; // Reset counter
            }
        }
    }
    
    clearAnnotations() {
        if (window.labelingTool) {
            window.labelingTool.annotations = [];
            window.labelingTool.updateAnnotationList();
            window.labelingTool.updateProjectStats();
            window.labelingTool.redraw();
        }
    }
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e74c3c;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;
        errorDiv.textContent = message;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }
    
    // Cache temizleme
    clearCache() {
        this.annotationCache.clear();
        this.imageCache.clear();
        console.log('🧹 Cache temizlendi');
    }

    // Belirli bir fotoğrafın cache'ini temizle
    clearImageCache(imageId) {
        const cacheKey = `annotations_${imageId}`;
        this.annotationCache.delete(cacheKey);
        console.log(`🧹 Fotoğraf ${imageId} cache'i temizlendi`);
    }

    // Tüm annotation cache'ini temizle
    clearAnnotationCache() {
        this.annotationCache.clear();
        console.log('🧹 Annotation cache temizlendi');
    }
    
    // Mevcut fotoğrafın annotation cache'ini temizle
    clearCurrentImageAnnotationCache() {
        if (this.currentImage && this.currentImage.id) {
            const cacheKey = `annotations_${this.currentImage.id}`;
            this.annotationCache.delete(cacheKey);
            console.log(`🧹 Mevcut fotoğraf cache'i temizlendi: ${cacheKey}`);
        }
    }
    
    clearAnnotations() {
        console.log('🧹 Etiketler temizleniyor');
        if (window.labelingTool) {
            window.labelingTool.annotations = [];
            window.labelingTool.selectedAnnotation = null;
            window.labelingTool.focusedAnnotation = null;
            if (window.labelingTool.updateAnnotationList) {
                window.labelingTool.updateAnnotationList();
            }
            if (window.labelingTool.updateLabelListFromAnnotations) {
                window.labelingTool.updateLabelListFromAnnotations();
            }
            if (window.labelingTool.redraw) {
                window.labelingTool.redraw();
            }
            console.log('✅ Etiketler temizlendi');
        }
    }
}

// Global image manager
window.ImageManager = ImageManager;
