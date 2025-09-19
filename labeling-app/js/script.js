class LabelingTool {
    // Server URL'i dinamik olarak belirle
    getServerURL() {
        // Önce localStorage'dan kontrol et
        const savedIP = localStorage.getItem('serverIP');
        if (savedIP) {
            return `http://${savedIP}:3000/api`;
        }
        
        // window.location.hostname kullan
        const hostname = window.location.hostname;
        
        // Eğer hostname boş veya geçersizse localhost kullan
        if (!hostname || hostname === '' || hostname === 'null' || hostname === 'undefined') {
            console.log('⚠️ Hostname boş, localhost kullanılıyor');
            return `http://localhost:3000/api`;
        }
        
        // Eğer localhost ise, bilinen IP adresini kullan
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // Bilinen IP adresini kullan
            return `http://10.10.1.22:3000/api`;
        }
        
        // Diğer durumlarda window.location.hostname kullan
        return `http://${hostname}:3000/api`;
    }

    constructor() {
        console.log('🏗️ LabelingTool constructor başlatılıyor...');
        
        // Auth kontrolü artık auth sistemi tarafından yapılıyor
        
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.image = null;
        this.currentTool = 'rectangle'; // Sadece rectangle tool
        this.isDrawing = false;
        this.annotations = [];
        this.currentAnnotation = null;
        this.focusedAnnotation = null; // Focuslanan etiket
        this.currentMousePos = null; // Mouse pozisyonu
        this.startX = 0;
        this.startY = 0;
        this.imageScale = 1;
        this.imageOffsetX = 0;
        this.imageOffsetY = 0;
        this.croppedImages = [];
        this.availableLabels = []; // Tanımlı etiketler
        this.favoriteLabels = []; // Favori etiketler
        this.selectedFavoriteLabel = null; // Modal'da seçilen favori etiket
        this.activeLabel = null; // Şu anda seçili etiket
        this.quickLabelMode = false; // Hızlı etiket modu aktif mi?
        this.labelCaseMode = 'original'; // Etiket harf durumu: 'original', 'uppercase', 'lowercase'
        this.exportFolderPath = null; // Export klasörü yolu
        this.isSaved = true; // Kaydetme durumu (başlangıçta kaydedilmiş)
        this.snowTextureCache = null; // Kar texture cache'i
        
        // Undo/Redo sistemi
        this.history = []; // İşlem geçmişi
        this.historyIndex = -1; // Mevcut geçmiş indeksi
        this.maxHistorySize = 50; // Maksimum geçmiş boyutu
        
        // Kopyala-Yapıştır sistemi
        this.copiedAnnotation = null; // Kopyalanan annotation
        this.cropFolderPath = null; // Kırp klasörü yolu
        
        // Multi-image support
        this.images = []; // Tüm yüklenen resimler
        this.currentImageIndex = 0; // Aktif resim indexi
        this.imageAnnotations = {}; // Her resim için ayrı annotationlar
        this.imageFilters = {}; // Her resim için ayrı filtre ayarları
        this.isMultiImageMode = false; // Klasör modu aktif mi?
        this.totalImages = 0; // Toplam resim sayısı
        
        // Performance optimizations
        this.imageCache = new Map(); // Resim cache'i
        this.filterCache = new Map(); // Filtre cache'i
        
        // Color filters
        this.originalImageData = null; // Orijinal resim verisi
        this.activeFilters = new Set(); // Aktif filtreler
        this.activeTextures = new Set(); // Aktif texture efektleri
        
        // Image Manager
        this.imageManager = null;
        this.debounceTimers = new Map(); // Debounce timer'ları
        this.isProcessing = false; // İşlem devam ediyor mu?
        this.needsRedraw = true; // Canvas yeniden çizim gerekli mi?
        this.lastRedrawTime = 0; // Son redraw zamanı
        
        // Pagination
        this.currentPage = 1;
        this.itemsPerPage = 15;
        this.totalPages = 1;
        
        // Zoom/Pan support
        this.zoom = 1; // Zoom seviyesi
        this.panX = 0; // X ekseni kaydırma
        this.panY = 0; // Y ekseni kaydırma
        this.isPanning = false; // Pan modu aktif mi?
        this.lastPanX = 0; // Son pan pozisyonu X
        this.lastPanY = 0; // Son pan pozisyonu Y
        
        this.selectedAnnotation = null; // Seçili annotation         // Renk paleti
        this.colorPalette = ['#2ecc71', '#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
        this.currentColorIndex = 0; // Otomatik renk atama için index
        this.selectedColor = '#2ecc71'; // Modal'da seçilen renk
        
        // Annotation interaction system
        this.dragHandle = null; // Sürüklenen handle
        this.isDraggingHandle = false; // Handle sürükleniyor mu?
        this.dragAnnotation = null; // Sürüklenen annotation
        this.isDraggingAnnotation = false; // Annotation sürükleniyor mu?
        this.dragStartPos = null; // Sürükleme başlangıç pozisyonu
        
        // Initialize modules
        console.log('🚀 CanvasManager başlatılıyor...');
        if (window.CanvasManager) {
            this.canvasManager = new CanvasManager(this);
            console.log('✅ CanvasManager başlatıldı');
        } else {
            console.error('❌ CanvasManager bulunamadı!');
        }
        
        console.log('🚀 AnnotationManager başlatılıyor...');
        if (window.AnnotationManager) {
            this.annotationManager = new AnnotationManager(this);
            console.log('✅ AnnotationManager başlatıldı');
        } else {
            console.error('❌ AnnotationManager bulunamadı!');
        }
        
        console.log('🚀 ExportManager başlatılıyor...');
        
        // ExportManager'ın yüklenmesini bekle
        const initExportManager = () => {
        if (window.ExportManager) {
            this.exportManager = new ExportManager(this);
            console.log('✅ ExportManager başlatıldı');
        } else {
            console.error('❌ ExportManager bulunamadı!');
                // 100ms sonra tekrar dene
                setTimeout(initExportManager, 100);
        }
        };
        
        initExportManager();
        
        console.log('🚀 UtilityManager başlatılıyor...');
        if (window.UtilityManager) {
            this._utilityManager = new UtilityManager(this);
            console.log('✅ UtilityManager başlatıldı');
        } else {
            console.error('❌ UtilityManager bulunamadı!');
        }
        
        // Auth objesini initialize et - LabelingAuth kullan
        if (!window.labelingAuth) {
            console.log('🔧 Auth objesi initialize ediliyor...');
            window.labelingAuth = new LabelingAuth();
            console.log('✅ Auth objesi initialize edildi:', window.labelingAuth);
        }
        
        // Image Manager'ı başlat
        if (typeof ImageManager === 'undefined') {
            console.error('❌ ImageManager sınıfı yüklenmedi!');
            throw new Error('ImageManager sınıfı yüklenmedi. Lütfen sayfayı yenileyin.');
        }
        this.imageManager = new ImageManager(window.labelingAuth);
        
        this.setupEventListeners();
        this.setupImageNavigationListeners();
        this.setupFavoriteLabelListeners();
        this.resizeCanvas();
        this.migrateAnnotationsColors();
        
        // İlk history kaydını yap
        this.saveToHistory();
        
        // Kaydetmeden çıkış onayı
        window.addEventListener('beforeunload', (e) => {
            if (this.annotations.length > 0 && !this.isSaved) {
                e.preventDefault();
                e.returnValue = 'Kaydedilmemiş etiketlemeler var, sayfadan çıkmak istediğinizden emin misiniz?';
            }
        });
        
        // Performance utility functions
        // Utility functions will be handled by UtilityManager
    }

    // Proje klasörünü tara
    async scanProjectFolder() {
        if (!this.imageManager) {
            this.showError('Image Manager henüz hazır değil');
            return;
        }

        try {
            this.showInfo('Klasör taranıyor...');
            const success = await this.imageManager.scanFolder();
            
            if (success) {
                this.showSuccess('Klasör başarıyla tarandı!');
                this.showImageNavigation();
            } else {
                this.showError('Klasör tarama başarısız');
            }
        } catch (error) {
            console.error('❌ Klasör tarama hatası:', error);
            this.showError('Klasör tarama hatası: ' + error.message);
        }
    }


    // Mevcut fotoğrafı etiketli olarak işaretle
    async markCurrentImageAsLabeled() {
        if (!this.imageManager) return;
        
        try {
            // Mevcut annotation'ları al
            const annotationData = {
                annotations: this.annotations,
                timestamp: new Date().toISOString()
            };
            
            const success = await this.imageManager.markAsLabeled(annotationData);
            if (success) {
                this.showSuccess('Fotoğraf etiketli olarak işaretlendi');
            }
        } catch (error) {
            console.error('❌ Etiketleme hatası:', error);
            this.showError('Fotoğraf etiketlenemedi');
        }
    }

    // Mevcut fotoğrafı etiketlenmemiş olarak işaretle
    async markCurrentImageAsUnlabeled() {
        if (!this.imageManager) return;
        
        try {
            const success = await this.imageManager.markAsUnlabeled();
            if (success) {
                this.showSuccess('Fotoğraf etiketlenmemiş olarak işaretlendi');
            }
        } catch (error) {
            console.error('❌ Etiketleme hatası:', error);
            this.showError('Fotoğraf etiketlenmemiş olarak işaretlenemedi');
        }
    }

    // Mevcut fotoğrafı canvas'a yükle
    loadCurrentImageToCanvas() {
        if (!this.imageManager || !this.imageManager.currentImage) return;
        
        const imageElement = document.getElementById('currentImage');
        if (imageElement) {
            imageElement.style.display = 'block';
            this.canvas.style.display = 'none';
            
            // Canvas'ı image boyutuna ayarla
            this.resizeCanvas();
        }
    }

    // Fotoğraf navigasyon panelini göster
    showImageNavigation() {
        const imageNavSection = document.getElementById('imageNavigationSection');
        if (imageNavSection) {
            imageNavSection.style.display = 'block';
        }
    }

    // Fotoğraf navigasyon panelini gizle
    hideImageNavigation() {
        const imageNavSection = document.getElementById('imageNavigationSection');
        if (imageNavSection) {
            imageNavSection.style.display = 'none';
        }
        
        // Start memory management timer - büyük dosya sayıları için daha sık
        setInterval(() => {
            this.manageMemory();
        }, 10000); // Her 10 saniyede bir
        
        // Color Filter System
        this.originalImageData = null; // Orijinal resim verisi
        this.activeFilters = new Set(); // Aktif filtreler
        
        // Weather Filter State Management
        this.currentWeatherFilter = null; // Mevcut seçili weather filter
        this.weatherFilterButtons = []; // Weather filter butonları
        
        // DOM yüklendikten sonra filtreleri ayarla
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
        this.setupColorFilters();
            });
        } else {
            this.setupColorFilters();
        }
        
        // Texture Overlay System
        this.textureCanvas = document.createElement('canvas');
        this.textureCtx = this.textureCanvas.getContext('2d');
        this.activeTextures = new Set(); // Aktif texture'lar
        
        // Grid System
        this.showGrid = true; // Grid gösterimi aktif mi?
        this.gridSize = 20; // Grid boyutu (piksel)
        this.majorGridSize = 100; // Ana grid boyutu
        
        // Rectangle System
        
        // Fullscreen Crosshair System
        this.showFullscreenCrosshair = true; // Fullscreen crosshair gösterimi
        this.crosshairVisible = false; // Crosshair şu anda görünür mü?
        
        // Real-time senkronizasyon
        if (window.RealtimeSync) {
            this.realtimeSync = new RealtimeSync(this);
            console.log('✅ Real-time senkronizasyon başlatıldı');
        } else {
            console.error('❌ RealtimeSync bulunamadı!');
        }
    }

    // Auth kontrolü - Artık auth sistemi kendi kendini yönetiyor
    checkAuth() {
        console.log('🔍 checkAuth çağrıldı - Auth sistemi kendi kendini yönetiyor');
        
        if (!window.labelingAuth) {
            console.error('❌ labelingAuth bulunamadı!');
            return;
        }
        
        // URL'den proje ID'sini al
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get('project');
        
        if (projectId && window.labelingAuth.isLoggedIn()) {
            console.log('🔍 Proje ID bulundu, yükleniyor:', projectId);
            this.loadProject(projectId);
        }
        // Not loading first available project automatically anymore - start.js handles this
    }

    // İlk mevcut projeyi yükle
    async loadFirstAvailableProject() {
        try {
            const projects = await window.labelingAuth.getProjects();
            if (projects && projects.length > 0) {
                const firstProject = projects[0];
                console.log('📁 İlk mevcut proje yükleniyor:', firstProject.id, firstProject.name);
                window.labelingAuth.setUserAndProject('user', firstProject.id);
                this.loadProject(firstProject.id);
            } else {
                console.log('⚠️ Mevcut proje bulunamadı');
            }
        } catch (error) {
            console.error('❌ Proje yüklenirken hata:', error);
        }
    }

    // Proje yükle
    async loadProject(projectId) {
        try {
            console.log('📁 Proje yükleniyor:', projectId);
            
            // Proje bilgilerini al (auth bypass)
            const response = await fetch(`${this.getServerURL()}/projects/${projectId}`);
            const project = await response.json();
            
            if (project) {
                console.log('✅ Proje yüklendi:', project.name);
                this.showSuccess(`Proje yüklendi: ${project.name}`);
                
                // ImageManager'a proje bilgisini bildir
                await this.imageManager.setProject(projectId);
                
                // Sidebar'daki proje adı input'unu güncelle
                const projectNameInput = document.getElementById('projectName');
                if (projectNameInput) {
                    projectNameInput.value = project.name;
                }
                
                // Proje verilerini uygulamaya yükle
                if (project.data) {
                    this.annotations = project.data.annotations || [];
                    this.availableLabels = project.data.settings?.availableLabels || [];
                    this.activeLabel = project.data.settings?.activeLabel;
                    this.selectedColor = project.data.settings?.selectedColor || '#2ecc71';
                    // favoriteLabels artık veritabanından yükleniyor
                    this.currentImageIndex = project.data.settings?.currentImageIndex || 0;
                    this.croppedImages = project.data.settings?.croppedImages || [];
                    this.exportFolderPath = project.data.settings?.exportFolderPath;
                    
                    // Fotoğraf dosya bilgisini kontrol et ve otomatik yükle
                    if (project.data.imageFile) {
                        console.log('📸 Proje fotoğraf bilgisi:', project.data.imageFile.fileName);
                        console.log('📁 Dosya yolu:', project.data.imageFile.fullPath);
                        this.projectImageFile = project.data.imageFile; // Fotoğraf bilgisini sakla
                        
                        // HTTP üzerinden dosya yolundan yükle
                        console.log('📁 HTTP üzerinden dosya yolundan yükleniyor...');
                        this.loadImageFromPath(project.data.imageFile.fullPath);
                    } else if (this.croppedImages.length > 0 && this.currentImageIndex < this.croppedImages.length) {
                        // Fallback: Eğer fotoğraf bilgisi yoksa, cropped image'ı yükle
                        this.loadImageFromIndex(this.currentImageIndex);
                    }
                    
                    // UI'yi güncelle
                    this.updateLabelList();
                    this.updateAnnotationList();
                    this.updateAvailableLabels();
                    
                    // Favori etiketleri veritabanından yükle
                    await this.loadFavoriteLabels();
                    this.updateProjectStats(); // Proje istatistiklerini güncelle
                    this.redraw();
                    
                    // Real-time senkronizasyona projeye katıl
                    if (this.realtimeSync) {
                        this.realtimeSync.joinProject(projectId);
                    }
                    
                    console.log('✅ Proje durumu yüklendi:', {
                        annotations: this.annotations.length,
                        labels: this.availableLabels.length,
                        imageFile: project.data.imageFile ? project.data.imageFile.fileName : 'Yok',
                        croppedImages: this.croppedImages.length,
                        currentImage: this.currentImageIndex
                    });
                }
            } else {
                this.showError('Proje yüklenemedi');
            }
        } catch (error) {
            console.error('❌ Proje yükleme hatası:', error);
            this.showError('Proje yükleme hatası: ' + error.message);
        }
    }

    // Orijinal fotoğrafı yükle
    loadOriginalImage(imageInfo) {
        if (!imageInfo || !imageInfo.src) {
            console.log('⚠️ Orijinal fotoğraf bilgisi eksik');
            return;
        }

        console.log('📸 Orijinal fotoğraf yükleniyor:', imageInfo.name);
        
        const img = new Image();
        img.onload = () => {
            this.image = img;
            this.initializeCoordinateSystem();
            this.redraw();
            console.log('✅ Orijinal fotoğraf yüklendi:', {
                name: imageInfo.name,
                width: img.width,
                height: img.height
            });
        };
        
        img.onerror = () => {
            console.error('❌ Orijinal fotoğraf yüklenemedi:', imageInfo.src);
            this.showError('Orijinal fotoğraf yüklenemedi');
        };
        
        img.src = imageInfo.src;
        img.name = imageInfo.name;
    }

    // Proje fotoğrafını yükle
    loadProjectImage(imageFileInfo) {
        if (!imageFileInfo || !imageFileInfo.dataURL) {
            console.log('⚠️ Proje fotoğraf bilgisi eksik');
            return;
        }

        console.log('📸 Proje fotoğrafı yükleniyor:', imageFileInfo.fileName);
        
        const img = new Image();
        img.onload = () => {
            this.image = img;
            
            // Dosya bilgilerini sakla
            this.image.name = imageFileInfo.fileName;
            this.image.filePath = imageFileInfo.filePath;
            this.image.lastModified = imageFileInfo.lastModified;
            
            this.initializeCoordinateSystem();
            this.redraw();
            
            console.log('✅ Proje fotoğrafı yüklendi:', {
                name: imageFileInfo.fileName,
                width: img.width,
                height: img.height
            });
        };
        
        img.onerror = () => {
            console.error('❌ Proje fotoğrafı yüklenemedi:', imageFileInfo.fileName);
            this.showError('Proje fotoğrafı yüklenemedi');
        };
        
        img.src = imageFileInfo.dataURL;
    }

    // Fotoğraf yüklendiğinde proje etiketlerini kontrol et
    checkAndLoadProjectAnnotations(file) {
        // Eğer proje yüklendiyse ve aynı fotoğraf ise
        if (this.projectImageFile && this.projectImageFile.fileName === file.name) {
            console.log('✅ Aynı fotoğraf yüklendi, etiketler gösteriliyor');
            this.showSuccess(`Etiketler yüklendi: ${this.annotations.length} adet`);
            this.redraw(); // Etiketleri göster
        }
    }

    // Sunucudan fotoğraf yükle
    loadImageFromServer(filename) {
        console.log('📸 Sunucudan fotoğraf yükleniyor:', filename);
        
        const img = new Image();
        img.onload = () => {
            this.image = img;
            
            // Dosya bilgilerini sakla
            this.image.name = filename;
            this.image.filePath = filename;
            this.image.lastModified = Date.now();
            
            this.initializeCoordinateSystem();
            this.redraw();
            
            // State'i temizle (toast gösterme, backend'e kaydetme)
            this.selectWeatherFilter('none', false, false);
            
            console.log('✅ Sunucudan fotoğraf yüklendi:', {
                name: filename,
                width: img.width,
                height: img.height
            });
            
            this.showSuccess(`Fotoğraf yüklendi: ${filename}`);
        };
        
        img.onerror = () => {
            console.error('❌ Sunucudan fotoğraf yüklenemedi:', filename);
            this.showError(`Fotoğraf yüklenemedi: ${filename}`);
        };
        
        // Backend'den fotoğrafı çek
        img.src = `${window.labelingAuth.baseURL}/files/${filename}`;
    }

    // Sunucu path fonksiyonu kaldırıldı - sadece orijinal path kullanılıyor

    // HTTP üzerinden dosya yolundan fotoğraf yükle
    async loadImageFromPath(filePath) {
        console.log('📸 HTTP üzerinden dosya yolundan fotoğraf yükleniyor:', filePath);
        
        // 1. Önce HTTP üzerinden dene
        const img = new Image();
        
        const tryHttpProtocol = () => {
            return new Promise((resolve, reject) => {
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('HTTP protocol failed'));
                
                // Server uploads dizininden direkt yükle
                img.src = `${window.labelingAuth.baseURL}${filePath}`;
            });
        };
        
        try {
            await tryHttpProtocol();
            
            // Başarılı oldu
            this.image = img;
            this.image.name = this.projectImageFile.fileName;
            this.image.filePath = filePath;
            this.image.fullPath = filePath;
            this.image.lastModified = this.projectImageFile.lastModified;
            
            this.initializeCoordinateSystem();
            this.redraw();
            
            // Önce state'i temizle
            this.selectWeatherFilter('none', false);
            
            // Weather filter'ı yükle
            await this.loadWeatherFilter();
            
            console.log('✅ HTTP üzerinden fotoğraf yüklendi:', {
                name: this.projectImageFile.fileName,
                path: filePath,
                width: img.width,
                height: img.height
            });
            
            this.showSuccess(`Fotoğraf yüklendi: ${this.projectImageFile.fileName}`);
            
        } catch (error) {
            console.error('❌ HTTP protocol başarısız, kullanıcıdan izin isteniyor...');
            
            // File System Access API ile izin iste
            await this.requestFilePermission(filePath);
        }
    }
    
    // Kullanıcıdan dosya seçmesini iste
    async requestFilePermission(filePath) {
        console.log('📁 Dosya bulunamadı, kullanıcıdan seçim isteniyor...');
        this.showError(`Dosya bulunamadı: ${filePath}. Lütfen dosyayı tekrar seçin.`);
        this.showFileSelector();
    }

    // Base64 fonksiyonları kaldırıldı - sadece HTTP kullanılıyor

    // Upload fonksiyonu kaldırıldı - sadece path kullanılıyor

    // Dosya seçiciyi göster (folder seçimi ile tam path almak için)
    showFileSelector() {
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true; // Folder seçimi
        input.accept = 'image/*';
        input.style.display = 'none';
        
        input.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                // İlk resim dosyasını al
                const imageFile = Array.from(e.target.files).find(file => 
                    file.type.startsWith('image/')
                );
                
                if (imageFile) {
                    this.loadSingleImage(imageFile);
                } else {
                    this.showError('Seçilen klasörde resim dosyası bulunamadı.');
                }
            }
        });
        
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
    }

    // Çoklu fotoğraf modunda mevcut fotoğrafın etiketlerini kaydet
    async saveCurrentImageAnnotations() {
        if (!this.isMultiImageMode || !window.imageManager || !window.imageManager.currentImage) {
            console.log('⚠️ Çoklu fotoğraf modu değil veya mevcut fotoğraf yok');
            return;
        }

        try {
            console.log('💾 Mevcut fotoğraf etiketleri kaydediliyor...', {
                imageId: window.imageManager.currentImage.id,
                annotationsCount: this.annotations.length
            });

            // Önce mevcut etiketleri sil
            await window.labelingAuth.authenticatedRequest(
                `${this.getServerURL()}/images/${window.imageManager.currentImage.id}/annotations`,
                { method: 'DELETE' }
            );

            // Tüm etiketleri toplu olarak kaydet
            if (this.annotations.length > 0) {
                const formattedAnnotations = this.annotations.map(annotation => {
                    const formatted = {
                        id: annotation.id,
                        label: annotation.label,
                        type: annotation.type,
                        color: annotation.color,
                        x: annotation.x,
                        y: annotation.y,
                        width: annotation.width,
                        height: annotation.height
                    };
                    
                    if (annotation.points && annotation.points.length > 0) {
                        formatted.points = annotation.points;
                        formatted.type = 'polygon';
                    }
                    
                    return formatted;
                });

                const response = await window.labelingAuth.authenticatedRequest(
                    `${this.getServerURL()}/images/${window.imageManager.currentImage.id}/annotations`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ annotations: formattedAnnotations })
                    }
                );

                if (!response.ok) {
                    console.error('❌ Etiketler kaydedilemedi:', response.statusText);
                } else {
                    console.log('✅ Tüm etiketler başarıyla kaydedildi');
                }
            }

            console.log('✅ Fotoğraf etiketleri başarıyla kaydedildi');
            this.isSaved = true;
        } catch (error) {
            console.error('❌ Fotoğraf etiketleri kaydedilirken hata:', error);
            this.showError('Etiketler kaydedilirken hata oluştu: ' + error.message);
        }
    }

    // Proje kaydet
    async saveProject() {
        if (!window.imageManager || !window.imageManager.currentProject) {
            console.log('⚠️ Aktif proje yok, kaydetme atlanıyor');
            console.log('🔍 ImageManager:', window.imageManager);
            console.log('🔍 CurrentProject:', window.imageManager?.currentProject);
            return;
        }

        try {
            // Çoklu fotoğraf modunda, ImageManager üzerinden kaydet
            if (this.isMultiImageMode && window.imageManager) {
                await this.saveCurrentImageAnnotations();
                return;
            }

            // Sadece dosya path'i ve boyut bilgisi
            let imageFileInfo = null;
            if (this.image) {
                imageFileInfo = {
                    fileName: this.image.name || 'image.jpg',
                    filePath: this.image.filePath || this.image.name, // Dosya yolu
                    fullPath: this.image.fullPath || this.image.filePath || this.image.name, // Tam yol
                    width: this.image.width,
                    height: this.image.height,
                    lastModified: this.image.lastModified || Date.now()
                };
            }

            const projectData = {
                annotations: this.annotations,
                imageFile: imageFileInfo, // Sadece dosya bilgisi, fotoğraf değil
                settings: {
                    quickLabelMode: this.quickLabelMode,
                    activeLabel: this.activeLabel,
                    selectedColor: this.selectedColor,
                    availableLabels: this.availableLabels,
                    // favoriteLabels artık veritabanında tutuluyor
                    currentImageIndex: this.currentImageIndex,
                    croppedImages: this.croppedImages, // Export için ayrı tutuluyor
                    exportFolderPath: this.exportFolderPath,
                    showGrid: this.showGrid,
                    showFullscreenCrosshair: this.showFullscreenCrosshair,
                    labelCaseMode: this.labelCaseMode
                }
            };

            console.log('📤 Proje verisi gönderiliyor:', {
                projectId: window.imageManager.currentProject,
                annotations: projectData.annotations.length,
                imageFile: projectData.imageFile ? projectData.imageFile.fileName : 'Yok',
                dataSize: JSON.stringify(projectData).length
            });

            // Auth bypass - basit fetch kullan
            const response = await fetch(
                `${this.getServerURL()}/projects/${window.imageManager.currentProject}`, 
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: projectData })
                }
            );
            
            if (response.ok) {
                this.isSaved = true;
                console.log('✅ Proje kaydedildi');
            } else {
                const error = await response.json();
                console.error('❌ Proje kaydetme hatası:', error.error);
                this.showError('Proje kaydedilemedi: ' + error.error);
            }
        } catch (error) {
            console.error('❌ Proje kaydetme hatası:', error);
            this.showError('Proje kaydetme hatası: ' + error.message);
        }
    }

    setupEventListeners() {
        // DOM zaten yüklü olduğu için direkt setup yap
        this.setupFileEventListeners();
        this.setupLabelCaseModeListener();
        this.setupExportFolderSelector();
        this.setupShortcutsModalListeners();
        this.setupPaginationListeners();
        this.setupColorFilters();
    }

    setupPaginationListeners() {
        // Sayfalama butonları
        const prevPageBtn = document.getElementById('prevPageBtn');
        const nextPageBtn = document.getElementById('nextPageBtn');
        
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => this.goToPreviousPage());
        }
        
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => this.goToNextPage());
        }
    }


    updateUserInfo() {
        // Auth sisteminden kullanıcı ve proje bilgilerini al
        if (window.startManager && window.startManager.auth) {
            console.log('🔄 Script.js updateUserInfo çağrıldı');
            window.startManager.updateUserInfo();
        } else {
            console.error('❌ startManager veya auth bulunamadı');
        }
    }

    setupLabelCaseModeListener() {
        const labelCaseSelect = document.getElementById('labelCaseMode');
        if (labelCaseSelect) {
            labelCaseSelect.addEventListener('change', (e) => {
                this.labelCaseMode = e.target.value;
                this.showInfo(`Etiket harf durumu: ${e.target.options[e.target.selectedIndex].text}`);
            });
        }
    }

    setupExportFolderSelector() {
        const selectFolderBtn = document.getElementById('selectExportFolder');
        const folderPathInput = document.getElementById('exportFolderPath');
        
        if (selectFolderBtn && folderPathInput) {
            selectFolderBtn.addEventListener('click', () => {
                this.selectExportFolder();
            });
        }
    }

    setupShortcutsModalListeners() {
        // Shortcuts modal açma butonu
        const showShortcutsBtn = document.getElementById('showShortcuts');
        if (showShortcutsBtn) {
            showShortcutsBtn.addEventListener('click', () => this.showShortcutsModal());
        }

        // Shortcuts modal kapatma butonları
        const closeShortcutsModal = document.getElementById('closeShortcutsModal');
        const closeShortcutsBtn = document.getElementById('closeShortcutsBtn');
        
        if (closeShortcutsModal) {
            closeShortcutsModal.addEventListener('click', () => this.closeShortcutsModal());
        }
        
        if (closeShortcutsBtn) {
            closeShortcutsBtn.addEventListener('click', () => this.closeShortcutsModal());
        }

        // Modal dışına tıklanınca kapat
        const shortcutsModal = document.getElementById('shortcutsModal');
        if (shortcutsModal) {
            shortcutsModal.addEventListener('click', (e) => {
                if (e.target === shortcutsModal) {
                    this.closeShortcutsModal();
                }
            });
        }
    }


    setupFavoriteLabelListeners() {
        // Favori Ekle butonu
        const addFavoriteBtn = document.getElementById('addFavoriteLabel');
        if (addFavoriteBtn) {
            addFavoriteBtn.addEventListener('click', () => this.showFavoriteLabelsModal());
        }

        // Favori etiketler modal event listeners
        const favoriteModal = document.getElementById('favoriteLabelsModal');
        const closeFavoriteModal = document.getElementById('closeFavoriteModal');
        const addFavoriteBtn2 = document.getElementById('addFavoriteBtn');
        const newFavoriteInput = document.getElementById('newFavoriteInput');

        if (closeFavoriteModal) {
            closeFavoriteModal.addEventListener('click', () => this.closeFavoriteLabelsModal());
        }

        if (addFavoriteBtn2) {
            addFavoriteBtn2.addEventListener('click', () => this.addFavoriteFromModal());
        }

        if (newFavoriteInput) {
            newFavoriteInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addFavoriteFromModal();
                }
            });
        }

        // Modal dışına tıklama ile kapatma
        if (favoriteModal) {
            favoriteModal.addEventListener('click', (e) => {
                if (e.target === favoriteModal) {
                    this.closeFavoriteLabelsModal();
                }
            });
        }
    }

    setupImageNavigationListeners() {
        // Navigasyon butonları
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const markLabeledBtn = document.getElementById('markLabeledBtn');
        const markUnlabeledBtn = document.getElementById('markUnlabeledBtn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.previousImage();
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.nextImage();
            });
        }
        
        if (markLabeledBtn) {
            markLabeledBtn.addEventListener('click', () => {
                this.markCurrentImageAsLabeled();
            });
        }
        
        if (markUnlabeledBtn) {
            markUnlabeledBtn.addEventListener('click', () => {
                this.markCurrentImageAsUnlabeled();
            });
        }
    }

    setupFileEventListeners() {
        // Dosya yükleme - güvenli element kontrolü
        const singleImageBtn = document.getElementById('singleImageBtn');
        const scanFolderBtn = document.getElementById('scanFolderBtn');
        const imageInput = document.getElementById('imageInput');
        
        if (singleImageBtn && imageInput) {
            singleImageBtn.addEventListener('click', () => {
                imageInput.click();
            });
        }
        
        if (scanFolderBtn) {
            scanFolderBtn.addEventListener('click', () => {
                this.scanProjectFolder();
            });
        }

        if (imageInput) {
            imageInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.uploadAndLoadImage(e.target.files[0]);
                }
            });
        }

        // folderInput kaldırıldı - artık klasör tarama API ile yapılıyor

        // Araç seçimi
        // Tool seçimi - Kaldırıldı: Sadece dikdörtgen kullanılıyor
        

        // Hızlı işlemler

        // Hızlı etiket modu toggle
        document.getElementById('quickLabelModeToggle').addEventListener('change', (e) => {
            this.quickLabelMode = e.target.checked;
            this.updateQuickModeUI();
        });


        document.getElementById('gridToggle').addEventListener('change', (e) => {
            this.showGrid = e.target.checked;
            this.updateGridDisplay();
        });

        document.getElementById('crosshairToggle').addEventListener('change', (e) => {
            this.showFullscreenCrosshair = e.target.checked;
            if (!this.showFullscreenCrosshair) {
                this.hideFullscreenCrosshairCursor();
            }
        });

        // Canvas olayları artık CanvasManager'da kuruldu - duplikasyon kaldırıldı

        // Diğer kontroller
        const addNewLabelBtn = document.getElementById('addNewLabel');
        const yoloExportBtn = document.getElementById('yoloExport');
        const exportDataBtn = document.getElementById('exportData');
        
        if (addNewLabelBtn) {
            addNewLabelBtn.addEventListener('click', () => this.showNewLabelModal());
        }
        
        if (yoloExportBtn) {
            yoloExportBtn.addEventListener('click', () => this.yoloExport());
        }
        
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', () => this.showExportModal());
        }


        // Zoom kontrolleri
        const zoomInBtn = document.getElementById('zoomIn');
        const zoomOutBtn = document.getElementById('zoomOut');
        const fitScreenBtn = document.getElementById('fitScreen');
        
        // Zoom kontrolleri - Kaldırıldı: Mouse wheel ile zoom
        
        if (fitScreenBtn) {
            fitScreenBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.fitToScreen();
            });
        }

        // Modal kontrolleri
        this.setupModalListeners();



        // Pencere boyutu değiştiğinde canvas'ı yeniden boyutlandır
        window.addEventListener('resize', () => this.resizeCanvas());

        // Keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Export modal kontrolleri
        this.setupExportModalListeners();

        // YOLO örnek modal
        this.setupYoloExampleModal();
        
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Modal açıkken shortcuts'ları devre dışı bırak
            const labelModal = document.getElementById('labelModal');
            if (labelModal && labelModal.style.display === 'block') return;
            
            // Input alanlarındayken shortcuts'ları devre dışı bırak
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key) {
                // Backspace tuşu ile focuslanan etiketi sil
                case 'Backspace':
                    if (this.focusedAnnotation) {
                        const label = this.focusedAnnotation.label;
                        this.deleteAnnotation(this.focusedAnnotation.id);
                        this.showInfo(`"${label}" etiketi silindi.`);
                        this.focusedAnnotation = null;
                        this.redraw();
                    }
                    e.preventDefault();
                    break;

                // Yeni etiket
                case 'n': case 'N':
                    this.showNewLabelModal();
                    e.preventDefault();
                    break;

                // Favori etiket ekle
                case 'a': case 'A':
                    this.showFavoriteLabelsModal();
                    e.preventDefault();
                    break;

                case 'f': case 'F':
                    this.zoomToPhoto(); // Fotoğrafı hizala
                    e.preventDefault();
                    break;

                // Genel
                case 'Delete':
                    this.deleteSelectedAnnotation();
                    e.preventDefault();
                    break;
            }

            // Ctrl/Command kombinasyonları (Mac uyumlu)
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'z': case 'Z':
                        if (e.shiftKey) {
                            this.redo(); // Ctrl+Shift+Z veya Cmd+Shift+Z
                        } else {
                            this.undo(); // Ctrl+Z veya Cmd+Z
                        }
                        e.preventDefault();
                        break;
                    
                    case 'c': case 'C':
                        this.copyAnnotation();
                        e.preventDefault();
                        break;
                    
                    case 'v': case 'V':
                        this.pasteAnnotation();
                        e.preventDefault();
                        break;
                    
                    case 's': case 'S':
                        this.saveProject();
                        e.preventDefault();
                        break;
                }
            }
        });
    }


    cancelCurrentOperation() {
        // Edit modundan çık
        if (this.editMode) {
            this.exitEditMode();
            return;
        }
        
        if (this.currentAnnotation) {
            this.currentAnnotation = null;
            this.needsRedraw = true;
            this.redraw();
        }
        
    }

    exitEditMode() {
        this.editMode = false;
        this.editingAnnotation = null;
        this.selectedAnnotation = null;
        this.isDraggingHandle = false;
        this.dragHandle = null;
        if (this.canvas) {
        this.canvas.style.cursor = 'crosshair';
            this.canvas.style.outline = 'none';
        }
        
        this.redraw();
    }

    deleteSelectedAnnotation() {
        // Eğer focused annotation varsa onu sil
        if (this.focusedAnnotation) {
            const label = this.focusedAnnotation.label;
            this.deleteAnnotation(this.focusedAnnotation.id);
            this.showInfo(`"${label}" etiketi silindi.`);
            this.focusedAnnotation = null;
            this.redraw();
        } else if (this.annotations && this.annotations.length > 0) {
            // Eğer focused annotation yoksa son annotation'ı sil
            const lastAnnotation = this.annotations[this.annotations.length - 1];
            this.deleteAnnotation(lastAnnotation.id);
            this.showInfo('Son etiket silindi');
        } else {
            this.showInfo('Silinecek etiket bulunamadı');
        }
    }

    // Gelişmiş Undo/Redo sistemi
    saveToHistory() {
        // Mevcut durumu kaydet
        const state = {
            annotations: JSON.parse(JSON.stringify(this.annotations)),
            selectedAnnotation: this.selectedAnnotation ? this.selectedAnnotation.id : null,
            timestamp: Date.now()
        };
        
        // Geçmişte ileriye gitmişsek, o noktadan sonraki geçmişi sil
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // Yeni durumu ekle
        this.history.push(state);
        this.historyIndex = this.history.length - 1;
        
        // Maksimum geçmiş boyutunu kontrol et
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreFromHistory();
            console.log('Geri alındı');
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreFromHistory();
            console.log('İleri alındı');
        }
    }
    
    restoreFromHistory() {
        if (this.historyIndex >= 0 && this.historyIndex < this.history.length) {
            const state = this.history[this.historyIndex];
            this.annotations = JSON.parse(JSON.stringify(state.annotations));
            
            // Seçili annotation'ı geri yükle
            if (state.selectedAnnotation) {
                this.selectedAnnotation = this.annotations.find(ann => ann.id === state.selectedAnnotation);
            } else {
                this.selectedAnnotation = null;
            }
            
            this.updateAnnotationList();
            
            // Etiket listesini güncelle - kullanılmayan etiketleri temizle
            this.updateLabelListFromAnnotations();
            
            this.redraw();
        }
    }
    
    // Kopyala-Yapıştır sistemi
    copyAnnotation() {
        if (this.focusedAnnotation) {
            this.copiedAnnotation = JSON.parse(JSON.stringify(this.focusedAnnotation));
            this.showSuccess(`"${this.focusedAnnotation.label}" kopyalandı!`);
        } else if (this.annotations && this.annotations.length > 0) {
            // Eğer focused annotation yoksa son annotation'ı kopyala
            const lastAnnotation = this.annotations[this.annotations.length - 1];
            this.copiedAnnotation = JSON.parse(JSON.stringify(lastAnnotation));
            this.showSuccess(`"${lastAnnotation.label}" kopyalandı!`);
        } else {
            this.showInfo('Kopyalanacak etiket bulunamadı');
        }
    }
    
    pasteAnnotation() {
        if (this.copiedAnnotation && this.image) {
            // Yeni annotation oluştur
            const newAnnotation = {
                ...this.copiedAnnotation,
                id: Date.now(), // Yeni ID
                x: this.copiedAnnotation.x + 20, // Biraz kaydır
                y: this.copiedAnnotation.y + 20,
                points: this.copiedAnnotation.points ? this.copiedAnnotation.points.map(point => ({
                    x: point.x + 20,
                    y: point.y + 20
                })) : undefined,
                color: this.getNextAutoColor() // Yeni renk
            };
            
            this.annotations.push(newAnnotation);
            this.focusedAnnotation = newAnnotation;
            this.updateAnnotationList();
            
            // History'ye kaydet
            this.saveToHistory();
            
            this.redraw();
            this.showSuccess(`"${newAnnotation.label}" yapıştırıldı!`);
        } else {
            this.showInfo('Yapıştırılacak etiket bulunamadı');
        }
    }

    setupModalListeners() {
        const modal = document.getElementById('labelModal');
        const closeBtn = modal.querySelector('.close');
        const cancelBtn = document.getElementById('cancelLabel');
        const confirmBtn = document.getElementById('confirmLabel');
        const modalInput = document.getElementById('modalLabelInput');

        // Modal kapatma
        if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeModal());
        }
        if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.closeModal());
        }
        
        // Modal dışına tıklama
        window.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });

        // Etiket onaylama
        confirmBtn.addEventListener('click', () => this.confirmNewLabel());
        
        // Enter tuşu ile onaylama
        modalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.confirmNewLabel();
            }
        });

        // Etiket önerileri için input event listener
        modalInput.addEventListener('input', (e) => {
            this.showLabelSuggestions(e.target.value);
        });

        // Focus olayı
        modalInput.addEventListener('focus', () => {
            this.showLabelSuggestions(modalInput.value);
        });

        // Blur olayı (biraz gecikme ile kapat)
        modalInput.addEventListener('blur', () => {
            setTimeout(() => {
                this.hideLabelSuggestions();
            }, 200);
        });
    }

    createModalElements() {
        console.log('🔧 Modal elementleri oluşturuluyor...');
        
        // Label Modal oluştur
        const labelModal = document.createElement('div');
        labelModal.id = 'labelModal';
        labelModal.className = 'modal';
        labelModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Etiket Ekle</h3>
                    <button class="close">&times;</button>
                </div>
                <div class="input-group">
                    <label class="input-label">Favori Etiketler</label>
                    <div id="favoriteLabels" class="favorite-labels">
                        <!-- Favori etiketler burada görünecek -->
                    </div>
                </div>
                <div class="input-group">
                    <label class="input-label" for="modalLabelInput">Etiket Adı *</label>
                    <input type="text" class="input" id="modalLabelInput" placeholder="örn: #arac" />
                    <div id="labelSuggestions" class="label-suggestions" style="display: none;">
                        <!-- Etiket önerileri burada görünecek -->
                    </div>
                </div>
                <div class="input-group">
                    <label class="input-label">Renk Seçimi</label>
                    <div class="color-picker-container">
                        <div class="color-options" id="colorOptions">
                            <div class="color-option" data-color="#2ecc71" style="background-color: #2ecc71;"></div>
                            <div class="color-option" data-color="#e74c3c" style="background-color: #e74c3c;"></div>
                            <div class="color-option" data-color="#3498db" style="background-color: #3498db;"></div>
                            <div class="color-option" data-color="#f39c12" style="background-color: #f39c12;"></div>
                            <div class="color-option" data-color="#9b59b6" style="background-color: #9b59b6;"></div>
                            <div class="color-option" data-color="#1abc9c" style="background-color: #1abc9c;"></div>
                            <div class="color-option" data-color="#e67e22" style="background-color: #e67e22;"></div>
                            <div class="color-option" data-color="#34495e" style="background-color: #34495e;"></div>
                        </div>
                    </div>
                </div>
                <div class="modal-buttons">
                    <button class="btn" id="cancelLabel">İptal</button>
                    <button class="btn btn-primary" id="confirmLabel">Etiket Ekle</button>
                </div>
            </div>
        `;
        
        // Body'ye ekle
        document.body.appendChild(labelModal);
        console.log('✅ Label Modal oluşturuldu ve eklendi');
        
        // Event listener'ları ekle
        this.setupModalListeners();
        
        // Modal'ı göster
        labelModal.classList.add('show');
    }

    showNewLabelModal() {
        console.log('🔍 showNewLabelModal çağrıldı');
        console.log('🔍 Document ready state:', document.readyState);
        console.log('🔍 Document body:', document.body);
        console.log('🔍 All elements with id containing "Modal":', document.querySelectorAll('[id*="Modal"]'));
        
        // Modal elementlerini tekrar kontrol et
        console.log('🔍 Tekrar kontrol - labelModal:', document.getElementById('labelModal'));
        console.log('🔍 Tekrar kontrol - favoriteLabelsModal:', document.getElementById('favoriteLabelsModal'));
        console.log('🔍 Tekrar kontrol - Tüm modal elementleri:', document.querySelectorAll('.modal'));
        
        const modal = document.getElementById('labelModal');
        const modalInput = document.getElementById('modalLabelInput');
        
        console.log('🔍 Modal element:', modal);
        console.log('🔍 Modal input element:', modalInput);
        
        if (!modal) {
            console.error('❌ Modal bulunamadı!');
            console.log('🔍 Tüm modal elementleri:', document.querySelectorAll('.modal'));
            console.log('🔍 Tüm div elementleri:', document.querySelectorAll('div'));
            
            // Modal elementlerini manuel olarak oluştur
            console.log('🔧 Modal elementlerini manuel olarak oluşturuyorum...');
            this.createModalElements();
            return;
        }
        
        if (!modalInput) {
            console.error('❌ Modal input bulunamadı!');
            return;
        }
        
        modal.classList.add('show');
        modalInput.focus();
        modalInput.value = '';
        this.selectedFavoriteLabel = null; // Favori etiket seçimini sıfırla
        this.showLabelSuggestions('');
        
        // Favori etiketleri yükle ve göster
        this.loadFavoriteLabels().then(() => {
        this.showFavoriteLabelsInModal();
        });
        
        
        // Renk seçiciyi başlat
        this.setupColorPicker();
        
        console.log('✅ Modal açıldı');
    }

    showLabelSuggestions(query) {
        const suggestionsContainer = document.getElementById('labelSuggestions');
        if (!suggestionsContainer) return;

        // Mevcut etiketleri filtrele
        const filteredLabels = (this.availableLabels || []).filter(label => 
            label.toLowerCase().includes(query.toLowerCase())
        );

        if ((filteredLabels ? filteredLabels.length : 0) === 0 || (query ? query.length : 0) === 0) {
            this.hideLabelSuggestions();
            return;
        }

        // Önerileri göster
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.style.display = 'block';

        filteredLabels.forEach((label, index) => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            
            // Etiket rengini al
            const colors = ['#2ecc71', '#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
            const color = colors[index % colors.length];

            suggestionItem.innerHTML = `
                <div class="suggestion-color" style="background-color: ${color}"></div>
                <div class="suggestion-text">${label}</div>
                <div class="suggestion-hint">Mevcut etiket</div>
            `;

            suggestionItem.addEventListener('click', () => {
                document.getElementById('modalLabelInput').value = label;
                this.hideLabelSuggestions();
            });

            suggestionsContainer.appendChild(suggestionItem);
        });
    }

    hideLabelSuggestions() {
        const suggestionsContainer = document.getElementById('labelSuggestions');
        if (suggestionsContainer) {
            suggestionsContainer.style.display = 'none';
        }
    }

    setupColorPicker() {
        const colorOptions = document.querySelectorAll('.color-option');
        const colorPreview = document.getElementById('selectedColorPreview');
        
        // Varsayılan rengi ayarla
        this.selectedColor = '#2ecc71';

        // İlk rengi seçili yap
        colorOptions.forEach(option => option.classList.remove('selected'));
        if (colorOptions[0]) {
            colorOptions[0].classList.add('selected');
            this.selectedColor = colorOptions[0].dataset.color;
            if (colorPreview) colorPreview.style.backgroundColor = this.selectedColor;
        }

        // Renk seçimi event listener'ları
        colorOptions.forEach(option => {
            option.addEventListener('click', () => {
                // Tüm seçimleri kaldır
                colorOptions.forEach(opt => opt.classList.remove('selected'));
                
                // Seçili rengi işaretle
                option.classList.add('selected');
                this.selectedColor = option.dataset.color;
                
                // Preview'ı güncelle
                if (colorPreview) {
                    colorPreview.style.backgroundColor = this.selectedColor;
                }
            });
        });
    }

    closeModal() {
        const modal = document.getElementById('labelModal');
        if (modal) {
            modal.classList.remove('show');
        }
        
        // Geçici annotation'ı temizle
        if (this.currentAnnotation) {
            this.currentAnnotation = null;
            this.redraw();
        }
        
        // Önerileri gizle
        this.hideLabelSuggestions();
    }

    confirmNewLabel() {
        const modalInput = document.getElementById('modalLabelInput');
        const label = modalInput.value.trim();

        // Favori etiket seçildiyse etiket ismi boş olsa bile devam et
        if (!label && !this.selectedFavoriteLabel) {
            this.showWarning('Lütfen etiket adı girin!');
            return;
        }

        const finalLabel = label || this.selectedFavoriteLabel;
        const transformedLabel = this.transformLabelName(finalLabel);

        // Etiket zaten var mı kontrol et
        if (!this.availableLabels.includes(transformedLabel)) {
            this.availableLabels.push(transformedLabel);
            this.updateLabelList();
        }

        // Eğer çizim bekleyen annotation varsa, bu etiketi ata
        if (this.currentAnnotation) {
            this.currentAnnotation.label = transformedLabel;
            // Seçili rengi kullan, yoksa otomatik renk
            this.currentAnnotation.color = this.selectedColor || this.getNextAutoColor();
            this.annotations.push(this.currentAnnotation);
            
            // Database'e kaydet (async olarak)
            console.log('🔵 Etiket eklendi, database\'e kaydediliyor...', this.currentAnnotation);
            this.saveAllAnnotationsToDatabase(); // Basit API kullan
            
            this.currentAnnotation = null;
            this.updateAnnotationList();
            
            // History'ye kaydet
            this.saveToHistory();
            
            this.redraw();
            
            // Yeni annotation oluşturuldu, onu seçili yap
            this.selectedAnnotation = this.annotations[this.annotations.length - 1];
            this.focusedAnnotation = this.annotations[this.annotations.length - 1];
        }

        // Yeni eklenen etiketi aktif yap
        this.setActiveLabel(transformedLabel);
        this.closeModal();
    }

    setupExportModalListeners() {
        // Export modal kontrolleri - güvenli element kontrolü
        const closeExport = document.getElementById('closeExport');
        const cancelExport = document.getElementById('cancelExport');
        const confirmExport = document.getElementById('confirmExport');
        const previewExport = document.getElementById('previewExport');

        if (closeExport) closeExport.addEventListener('click', () => this.closeExportModal());
        if (cancelExport) cancelExport.addEventListener('click', () => this.closeExportModal());
        if (confirmExport) confirmExport.addEventListener('click', () => this.performExport());
        if (previewExport) previewExport.addEventListener('click', () => this.previewExport());

        // Train split değiştiğinde val split'i güncelle
        const trainSplit = document.getElementById('trainSplit');
        if (trainSplit) {
            trainSplit.addEventListener('input', (e) => {
                const trainValue = parseInt(e.target.value);
                const valSplit = document.getElementById('valSplit');
                if (valSplit) valSplit.value = 100 - trainValue;
                this.updateExportPreview();
            });
        }

        // Export options change - sadece mevcut element'ler için
        ['includeImages', 'normalizeCoordinates'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => this.updateExportPreview());
            }
        });

        // Format change
        document.querySelectorAll('input[name="exportFormat"]').forEach(radio => {
            radio.addEventListener('change', () => this.updateExportPreview());
        });

        // Modal dışına tıklama
        window.addEventListener('click', (e) => {
            const exportModal = document.getElementById('exportModal');
            if (e.target === exportModal) this.closeExportModal();
        });
    }

    showExportModal() {
        // Export preview'ı güncelle
        this.updateExportPreview();
        
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    closeExportModal() {
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    updateClassMapping() {
        const container = document.getElementById('classMapping');
        if (!container) return;
        container.innerHTML = '';

        this.availableLabels.forEach((label, index) => {
            const mappingDiv = document.createElement('div');
            mappingDiv.style.margin = '5px 0';
            mappingDiv.innerHTML = `
                <label style="display: flex; justify-content: space-between; align-items: center;">
                    <span>${label}</span>
                    <input type="number" value="${index}" min="0" max="99" style="width: 50px;" 
                           data-label="${label}" class="class-id-input">
                </label>
            `;
            container.appendChild(mappingDiv);
        });
    }

    getClassMapping() {
        const inputs = document.querySelectorAll('.class-id-input');
        const mapping = {};
        
        inputs.forEach(input => {
            const label = input.getAttribute('data-label');
            const classId = parseInt(input.value);
            mapping[label] = classId;
        });
        
        return mapping;
    }

    // Sonraki rengi al ve index'i artır
    getNextAutoColor() {
        const color = this.colorPalette[this.currentColorIndex];
        this.currentColorIndex = (this.currentColorIndex + 1) % this.colorPalette.length;
        return color;
    }

    // Yeni annotation oluştururken otomatik renk ata
    createNewAnnotation(annotationData) {
        // Seçili renk varsa onu kullan, yoksa otomatik renk
        const color = this.selectedColor || this.getNextAutoColor();
        const annotation = {
            ...annotationData,
            color: color,
            locked: false // Varsayılan olarak kilitli değil
        };
        
        // Label kontrolü - boşsa uyarı ver ama devam et
        if (!annotation.label || annotation.label.trim() === '') {
            console.log('⚠️ Boş label tespit edildi, modal\'dan seçim yapılacak');
        } else {
            console.log('✅ Label korundu:', annotation.label);
        }
        
        // En sol üst handle index'ini başlat (getLabelPosition tarafından hesaplanacak)
        if (annotation.points && annotation.points.length > 0) {
            // getLabelPosition çağrıldığında topLeftHandleIndex hesaplanacak
            annotation.topLeftHandleIndex = undefined;
        }
        
        // Etiket pozisyonunu sabit tutmak için labelPosition ekle
        if (!annotation.labelPosition) {
            // Sol üst köşe pozisyonunu hesapla
            let leftTopPoint;
            if (annotation.points && annotation.points.length > 0) {
                const xs = annotation.points.map(p => p.x);
                const ys = annotation.points.map(p => p.y);
                const minX = Math.min(...xs);
                const minY = Math.min(...ys);
                leftTopPoint = { x: minX, y: minY - 20 }; // 20px yukarı
            } else {
                leftTopPoint = { x: annotation.x, y: annotation.y - 20 }; // 20px yukarı
            }
            annotation.labelPosition = leftTopPoint;
        }
        
        console.log('✅ createNewAnnotation:', { 
            inputLabel: annotationData.label, 
            finalLabel: annotation.label, 
            color: annotation.color,
            labelPosition: annotation.labelPosition,
            fullAnnotationData: annotationData,
            fullFinalAnnotation: annotation
        });
        
        // Annotations listesine otomatik ekle
        this.annotations.push(annotation);
        this.isSaved = false; // Yeni annotation eklendi, kaydedilmemiş
        
        // Projeyi kaydet
        this.saveProject();
        
        return annotation;
    }

    async performExport() {
        // ExportManager ile export yap
        if (this.exportManager) {
            await this.exportManager.performExport();
        } else {
            this.showError('ExportManager bulunamadı!');
        }
    }

    getExportOptions() {
        return {
            includeImages: document.getElementById('includeImages').checked,
            includeCrops: document.getElementById('includeCrops').checked,
            normalizeCoordinates: document.getElementById('normalizeCoordinates').checked,
            includeMetadata: document.getElementById('includeMetadata').checked,
            compressOutput: document.getElementById('compressOutput').checked,
            imageQuality: parseInt(document.getElementById('imageQuality').value) / 100
        };
    }

    updateExportPreview() {
        const totalAnnotations = this.annotations ? this.annotations.length : 0;
        const formatElement = document.querySelector('input[name="exportFormat"]:checked');
        const format = formatElement ? formatElement.value : 'yolo';
        
        const includeImages = document.getElementById('includeImages')?.checked || true;
        
        // Dosya sayısını hesapla
        let totalFiles = 0;
        if (includeImages) totalFiles += (this.images ? this.images.length : 0) || 1;
        
        // Format'a göre ek dosyalar
        switch (format) {
            case 'yolo':
            case 'yolo_segmentation':
                totalFiles += totalAnnotations + 1; // .txt files + .yaml
                break;
            case 'coco':
                totalFiles += 1; // .json
                break;
        }
        
        // Tahmini boyut hesapla (MB)
        let estimatedSize = 0;
        if (includeImages && this.image) {
            const imageSize = (this.image.width * this.image.height * 3) / (1024 * 1024); // Rough estimate
            estimatedSize += imageSize * ((this.images ? this.images.length : 0) || 1);
        }
        estimatedSize = Math.round(estimatedSize * 100) / 100;
        
        // Tahmini süre hesapla (saniye)
        const estimatedTime = Math.max(1, Math.round(totalFiles * 0.1));
        
        // UI'yi güncelle - güvenli element kontrolü
        const updateElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        };
        
        updateElement('totalAnnotations', totalAnnotations);
        updateElement('totalFiles', totalFiles);
        updateElement('estimatedSize', estimatedSize + ' MB');
        updateElement('estimatedTime', estimatedTime + ' saniye');
    }

    previewExport() {
        const formatElement = document.querySelector('input[name="exportFormat"]:checked');
        const format = formatElement ? formatElement.value : 'yolo';
        
        const includeImages = document.getElementById('includeImages')?.checked || true;
        const normalizeCoordinates = document.getElementById('normalizeCoordinates')?.checked || true;
        
        let preview = `📋 Export Önizleme:\n\n`;
        preview += `Format: ${format.toUpperCase()}\n`;
        preview += `Toplam Etiket: ${this.annotations.length}\n`;
        preview += `Resimler: ${includeImages ? 'Dahil' : 'Dahil Değil'}\n`;
        preview += `Koordinat Normalleştirme: ${normalizeCoordinates ? 'Açık' : 'Kapalı'}\n`;
        
        this.showInfo(preview);
    }

    autoMapClasses() {
        this.availableLabels.forEach((label, index) => {
            const input = document.querySelector(`input[name="class_${index}"]`);
            if (input) {
                input.value = index;
            }
        });
        this.updateExportPreview();
        this.showToast('Sınıf eşleme otomatik olarak yapıldı!', 'success');
    }

    resetClassMapping() {
        this.availableLabels.forEach((label, index) => {
            const input = document.querySelector(`input[name="class_${index}"]`);
            if (input) {
                input.value = '';
            }
        });
        this.updateExportPreview();
        this.showToast('Sınıf eşleme sıfırlandı!', 'info');
    }

    setupYoloExampleModal() {
        // YOLO örnek linki - güvenli element kontrolü
        const yoloExampleLink = document.getElementById('yoloExampleLink');
        if (yoloExampleLink) {
            yoloExampleLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showYoloExampleModal();
            });
        }

        // Modal kapatma kontrolleri - güvenli element kontrolü
        const closeYoloExample = document.getElementById('closeYoloExample');
        const closeYoloExampleBtn = document.getElementById('closeYoloExampleBtn');
        
        if (closeYoloExample) {
            closeYoloExample.addEventListener('click', () => this.closeYoloExampleModal());
        }
        if (closeYoloExampleBtn) {
            closeYoloExampleBtn.addEventListener('click', () => this.closeYoloExampleModal());
        }

        // Modal dışına tıklama
        window.addEventListener('click', (e) => {
            const yoloModal = document.getElementById('yoloExampleModal');
            if (e.target === yoloModal) this.closeYoloExampleModal();
        });
    }


    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        
        // Toast element oluştur
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        // Container'a ekle
        container.appendChild(toast);
        
        // Animasyon için kısa gecikme
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        // Belirtilen süre sonra kaldır
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    // Alert'leri toast ile değiştir
    showAlert(message, type = 'info') {
        this.showToast(message, type);
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showWarning(message) {
        this.showToast(message, 'warning');
    }

    showInfo(message) {
        this.showToast(message, 'info');
    }

    // Etiket ismi düzenleme mimarisi kaldırıldı. Artık etiket düzenleme yok.

    // ID ile annotation düzenleme başlat
    startEditingAnnotationById(annotationId) {
        const annotation = this.annotations.find(ann => ann.id === annotationId);
        if (annotation) {
            this.startEditingAnnotation(annotation);
        }
    }

    // Mevcut annotation'ları eski renklerle uyumlu hale getir
    migrateAnnotationsColors() {
        this.annotations.forEach(annotation => {
            if (!annotation.color) {
                annotation.color = '#2ecc71'; // Varsayılan yeşil
            }
        });
    }

    // Weather filter seçimi - state management ile

    showYoloExampleModal() {
        const modal = document.getElementById('yoloExampleModal');
        modal.classList.add('show');
    }

    closeYoloExampleModal() {
        const modal = document.getElementById('yoloExampleModal');
        modal.classList.remove('show');
    }


    setupColorFilters() {
        console.log('🔧 Yeni Weather Filter sistemi başlatılıyor...');
        
        // Yeni Weather Filter sistemi
        this.setupNewWeatherFilterSystem();
    }

    setupNewWeatherFilterSystem() {
        console.log('🌤️ Yeni Weather Filter sistemi kuruluyor...');
        
        // Filtre ekleme butonu
        const addFilterBtn = document.getElementById('addFilterBtn');
        if (addFilterBtn) {
            addFilterBtn.addEventListener('click', () => {
                console.log('➕ Filtre ekleme butonu tıklandı');
                this.showFilterModal();
            });
        }

        // Filtre silme butonu
        const removeFilterBtn = document.getElementById('removeFilter');
        if (removeFilterBtn) {
            removeFilterBtn.addEventListener('click', () => {
                console.log('🗑️ Filtre silme butonu tıklandı');
                this.removeCurrentFilter();
            });
        }

        // Modal kapatma butonu
        const closeModalBtn = document.getElementById('closeFilterModal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                this.hideFilterModal();
            });
        }

        // Modal dışına tıklama ile kapatma
        const filterModal = document.getElementById('filterModal');
        if (filterModal) {
            filterModal.addEventListener('click', (e) => {
                if (e.target === filterModal) {
                    this.hideFilterModal();
                }
            });
        }

        // Filtre seçenekleri
        const filterOptions = document.querySelectorAll('.filter-option');
        filterOptions.forEach(option => {
            option.addEventListener('click', () => {
                const filterType = option.getAttribute('data-filter');
                    console.log('🎯 Filtre seçildi:', filterType);
                this.selectWeatherFilter(filterType);
                this.hideFilterModal();
            });
        });

        console.log('✅ Yeni Weather Filter sistemi kuruldu');
    }

    showFilterModal() {
        const modal = document.getElementById('filterModal');
        if (modal) {
            modal.style.display = 'flex';
            console.log('📱 Filtre modalı açıldı');
        }
    }

    hideFilterModal() {
        const modal = document.getElementById('filterModal');
        if (modal) {
            modal.style.display = 'none';
            console.log('📱 Filtre modalı kapandı');
        }
    }

    selectWeatherFilter(filterType, showToast = true, saveToBackend = true) {
        console.log('🎯 Weather filter seçiliyor:', filterType, 'showToast:', showToast, 'saveToBackend:', saveToBackend);
        
        // Filtre bilgilerini güncelle
        this.currentWeatherFilter = filterType;
        this.updateWeatherFilterData(filterType);
        
        // UI'yi güncelle
        this.updateWeatherFilterUI();
        
        // Canvas cache'ini temizle (yeni filtre için)
        if (this.canvasManager) {
            this.canvasManager.filteredImageData = null;
            this.canvasManager.lastFilterType = null;
            this.canvasManager.lastImageRect = null;
        }
        
        // Canvas'ı yeniden çiz
        this.redraw();
        
        // Backend'e kaydet (sadece gerekli olduğunda)
        if (saveToBackend) {
            this.saveWeatherFilter(showToast);
        }
        
        console.log('✅ Weather filter uygulandı:', filterType);
    }

    updateWeatherFilterData(filterType) {
        const filterMap = {
            'sunny': { name: 'Güneşli', icon: '☀️' },
            'cloudy': { name: 'Bulutlu', icon: '☁️' },
            'rainy': { name: 'Yağmurlu', icon: '🌧️' },
            'snowy': { name: 'Karlı', icon: '❄️' },
            'foggy': { name: 'Sisli', icon: '🌫️' },
            'sunset': { name: 'Gün Batımı', icon: '🌅' },
            'night': { name: 'Gece', icon: '🌙' }
        };

        if (filterType && filterType !== 'none') {
            this.weatherFilterData = {
                type: filterType,
                name: filterMap[filterType]?.name || filterType,
                icon: filterMap[filterType]?.icon || '🌤️'
            };
        } else {
            this.weatherFilterData = {
                type: null,
                name: null,
                icon: null
            };
        }
    }

    updateWeatherFilterUI() {
        const currentFilterDisplay = document.getElementById('currentFilterDisplay');
        const addFilterSection = document.getElementById('addFilterSection');
        const currentFilterIcon = document.getElementById('currentFilterIcon');
        const currentFilterName = document.getElementById('currentFilterName');

        // null, "null", "none" veya boş değerleri kontrol et
        if (this.currentWeatherFilter && 
            this.currentWeatherFilter !== 'none' && 
            this.currentWeatherFilter !== 'null' && 
            this.currentWeatherFilter !== null) {
            // Filtre var - göster
            if (currentFilterDisplay) currentFilterDisplay.style.display = 'flex';
            if (addFilterSection) addFilterSection.style.display = 'none';
            if (currentFilterIcon) currentFilterIcon.textContent = this.weatherFilterData.icon;
            if (currentFilterName) currentFilterName.textContent = this.weatherFilterData.name;
        } else {
            // Filtre yok - gizle
            if (currentFilterDisplay) currentFilterDisplay.style.display = 'none';
            if (addFilterSection) addFilterSection.style.display = 'block';
        }
    }

    removeCurrentFilter() {
        console.log('🗑️ Mevcut filtre kaldırılıyor');
        
        this.currentWeatherFilter = null;
        this.weatherFilterData = { type: null, name: null, icon: null };
        
        this.updateWeatherFilterUI();
        this.redraw();
        this.saveWeatherFilter(true); // Filtre silme işlemi için toast göster ve backend'e kaydet
        
        console.log('✅ Filtre kaldırıldı');
    }

    // Orijinal resim verisini kaydet (resim yüklendiğinde çağrılacak)
    saveOriginalImageData() {
        if (this.image && this.canvas.width > 0 && this.canvas.height > 0) {
            try {
                // Temp canvas oluştur
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = this.image.width;
                tempCanvas.height = this.image.height;
                
                // Orijinal resmi çiz
                tempCtx.drawImage(this.image, 0, 0);
                
                // ImageData'yı kaydet - CORS hatası olabilir
                this.originalImageData = tempCtx.getImageData(0, 0, this.image.width, this.image.height);
            } catch (error) {
                console.warn('⚠️ Orijinal resim verisi kaydedilemedi (CORS):', error.message);
                // CORS hatası durumunda null olarak ayarla
                this.originalImageData = null;
            }
            
            // Orijinal fotoğraf bilgisini de sakla (kaydetme için)
            this.originalImageInfo = {
                width: this.image.width,
                height: this.image.height,
                src: this.image.src,
                name: this.image.name || 'original_image.jpg'
            };
            
            console.log('📸 Orijinal fotoğraf bilgisi kaydedildi:', this.originalImageInfo);
            console.log('🔍 OriginalImageData boyutu:', this.originalImageData ? this.originalImageData.data.length : 'null');
            
            // Filtreler varsa hemen uygula
            if (this.activeFilters.size > 0) {
                console.log('🎨 Kaydedilen orijinal veri ile filtreler uygulanıyor...');
                this.applyColorFilters();
            }
        }
    }

    applyColorFilters() {
        console.log('🎨 applyColorFilters çağrıldı');
        console.log('🔍 Durum kontrolü:', {
            hasOriginalData: !!this.originalImageData,
            hasImage: !!this.image,
            activeFilters: Array.from(this.activeFilters),
            activeFiltersSize: this.activeFilters.size
        });
        
        if (!this.originalImageData || !this.image) {
            console.warn('⚠️ applyColorFilters: Orijinal veri veya resim yok', {
                hasOriginalData: !!this.originalImageData,
                hasImage: !!this.image,
                activeFilters: Array.from(this.activeFilters)
            });
            return;
        }
        
        if (this.activeFilters.size === 0) {
            console.log('🔄 Aktif filtre yok, orijinal resmi göster');
            this.resetToOriginalImage();
            return;
        }
        
        console.log('🎨 Filtreler uygulanıyor:', Array.from(this.activeFilters));

        // Check cache first
        const cacheKey = `filters_${this.currentImageIndex}_${Array.from(this.activeFilters).sort().join('_')}_${Array.from(this.activeTextures).sort().join('_')}`;
        if (this.filterCache.has(cacheKey)) {
            this.image = this.filterCache.get(cacheKey);
            this.redraw();
            return;
        }

        // Orijinal veriyi kopyala (her seferinde temiz orijinal veri kullan)
        const imageData = new ImageData(
            new Uint8ClampedArray(this.originalImageData.data),
            this.originalImageData.width,
            this.originalImageData.height
        );

        // Her aktif filtreyi uygula (sadece bir kez, orijinal veri üzerinde)
        this.activeFilters.forEach(filterType => {
            this.applyWeatherFilter(imageData, filterType);
        });

        // Temp canvas oluştur
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        
        // Filtrelenmiş renkleri çiz
        tempCtx.putImageData(imageData, 0, 0);
        
        // Texture overlay'leri ekle
        if (this.activeTextures.size > 0) {
            this.applyTextureOverlays(tempCtx, tempCanvas.width, tempCanvas.height);
        }
        
        // Yeni Image objesi oluştur
        const filteredImage = new Image();
        filteredImage.onload = () => {
            this.image = filteredImage;
            // Cache'e kaydet
            this.filterCache.set(cacheKey, filteredImage);
            // Cache boyutunu kontrol et (max 10 item)
            if (this.filterCache.size > 10) {
                const firstKey = this.filterCache.keys().next().value;
                this.filterCache.delete(firstKey);
            }
            this.redraw();
        };
        filteredImage.src = tempCanvas.toDataURL('image/jpeg', 0.9);
    }

    resetAllFilters() {
        console.log('🔄 Tüm filtreler sıfırlanıyor');
        
        // State management ile "none" seç (toast gösterme, backend'e kaydetme)
        this.selectWeatherFilter('none', false, false);
        
        // Çoklu fotoğraf modunda mevcut fotoğrafın filtrelerini de temizle
        if (this.isMultiImageMode && this.currentImageIndex >= 0) {
            this.imageFilters[this.currentImageIndex] = {
                activeFilters: [],
                activeTextures: []
            };
        }
        
        // Canvas'ta orijinal resmi göster
        if (this.image && this.canvas) {
            this.showOriginalImage();
        }
    }

    // Weather filter'ı backend'den getir
    async loadWeatherFilter() {
        try {
            const imageId = window.imageManager?.currentImage?.id;
            console.log('🔍 Image ID kontrolü:', {
                imageManager: !!window.imageManager,
                currentImage: !!window.imageManager?.currentImage,
                imageId: imageId,
                imageManagerKeys: window.imageManager ? Object.keys(window.imageManager) : 'undefined',
                currentImageKeys: window.imageManager?.currentImage ? Object.keys(window.imageManager.currentImage) : 'undefined'
            });
            
            if (!imageId) {
                console.log('ℹ️ Image ID bulunamadı, weather filter yüklenmiyor');
                this.clearWeatherFilter();
                return;
            }

            console.log('🌤️ Weather filter yükleniyor, Image ID:', imageId);

            const response = await window.labelingAuth.authenticatedRequest(`${this.getServerURL()}/images/${imageId}/weather-filter`);
            
            if (response.ok) {
                const result = await response.json();
                if (result.weatherFilter && result.weatherFilter.filter_data) {
                    // filter_data JSON string olarak geliyor, parse et
                    const filterData = typeof result.weatherFilter.filter_data === 'string' 
                        ? JSON.parse(result.weatherFilter.filter_data) 
                        : result.weatherFilter.filter_data;
                    console.log('✅ Weather filter yüklendi:', filterData);
                    
                    // null, "null" veya boş değerleri kontrol et
                    if (filterData.type && 
                        filterData.type !== 'none' && 
                        filterData.type !== 'null' && 
                        filterData.type !== null) {
                        this.selectWeatherFilter(filterData.type, false, false);
                    } else {
                        console.log('ℹ️ Filter type null/empty, filtre temizleniyor');
                        this.clearWeatherFilter();
                    }
                } else {
                    console.log('ℹ️ Bu fotoğraf için weather filter bulunamadı');
                    this.clearWeatherFilter();
                }
            } else {
                console.log('ℹ️ Weather filter yüklenemedi:', response.status);
                this.clearWeatherFilter();
            }

        } catch (error) {
            console.error('❌ Weather filter yükleme hatası:', error);
            this.clearWeatherFilter();
        }
    }

    clearWeatherFilter() {
        console.log('🧹 Weather filter temizleniyor');
        
        this.currentWeatherFilter = null;
        this.weatherFilterData = { type: null, name: null, icon: null };
        
        // Canvas cache'ini temizle
        if (this.canvasManager) {
            this.canvasManager.filteredImageData = null;
            this.canvasManager.lastFilterType = null;
            this.canvasManager.lastImageRect = null;
        }
        
        this.updateWeatherFilterUI();
                this.redraw();
        // clearWeatherFilter'da backend'e kaydetme, sadece UI'yi temizle
    }



    // Weather filter'ı backend'e kaydet
    async saveWeatherFilter(showToast = true) {
        try {
            // Mevcut image ID'yi al
            const imageId = window.imageManager?.currentImage?.id;
            if (!imageId) {
                console.error('❌ Image ID bulunamadı');
                this.showError('Fotoğraf ID bulunamadı');
                return;
            }

            // State'den seçili weather filter'ı al
            let filterType = this.currentWeatherFilter;
            
            // null veya "null" string'ini "none" olarak değiştir
            if (filterType === null || filterType === 'null' || filterType === undefined) {
                filterType = 'none';
            }

            console.log('💾 Weather filter kaydediliyor:', {
                imageId: imageId,
                filterType: filterType
            });

            // Filter data oluştur
            const filterData = {
                type: filterType === 'none' ? null : filterType,
                name: this.weatherFilterData.name,
                icon: this.weatherFilterData.icon,
                timestamp: new Date().toISOString()
            };

            // Backend'e POST et
            const baseURL = this.getServerURL();
            const response = await window.labelingAuth.authenticatedRequest(`${baseURL}/images/${imageId}/weather-filter`, {
                method: 'POST',
                body: JSON.stringify({ filter_data: filterData })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Weather filter kaydedildi:', result);
                
                // Sadece kullanıcı manuel olarak filtre seçtiğinde toast göster
                if (showToast) {
                    this.showSuccess(`Hava durumu filtresi kaydedildi: ${filterType === 'none' ? 'Filtre yok' : this.weatherFilterData.name}`);
                }
            } else {
                const error = await response.json();
                console.error('❌ Weather filter kaydedilemedi:', error);
                this.showError(`Hata: ${error.error || 'Bilinmeyen hata'}`);
            }

        } catch (error) {
            console.error('❌ Weather filter kaydetme hatası:', error);
            this.showError(`Hata: ${error.message}`);
        }
    }

    // Ana filtre uygulama metodu - KALDIRILDI (Canvas overlay kaldırıldı)
    // applyFilter fonksiyonu artık kullanılmıyor
    // Weather filter'lar sadece backend'e kaydediliyor

    // Canvas filtre fonksiyonları - Kullanıcı önizlemesi için
    // Weather filter'lar canvas'ta gösteriliyor + backend'e kaydediliyor

    // Resmin canvas'taki konumunu hesapla
    getImageRect() {
        if (!this.image || !this.canvas) return { x: 0, y: 0, width: 0, height: 0 };
        
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const imageWidth = this.image.naturalWidth;
        const imageHeight = this.image.naturalHeight;
        
        // Zoom ve pan değerlerini kullan
        const scaledWidth = imageWidth * this.zoom;
        const scaledHeight = imageHeight * this.zoom;
        
        const x = this.panX;
        const y = this.panY;
        
        return {
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(scaledWidth),
            height: Math.round(scaledHeight)
        };
    }

    // Orijinal resmi göster (filtre yok)
    showOriginalImage() {
        if (!this.image || !this.canvas) return;
        
        console.log('🖼️ Orijinal resim gösteriliyor (filtre yok)');
        
        // CSS filtrelerini temizle
        this.canvas.style.filter = 'none';
        
        // Canvas'ı temizle
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Orijinal resmi çiz (canvas'ın tamamına)
        this.ctx.drawImage(this.image, 0, 0, this.canvas.width, this.canvas.height);
        
        console.log('✅ Orijinal resim gösterildi');
    }

    // Weather filter önizlemesi uygula
    applyWeatherFilterPreview(filterType) {
        if (!this.image || !this.canvas) {
            console.error('❌ Image veya canvas yok:', { image: !!this.image, canvas: !!this.canvas });
            return;
        }
        
        console.log('🎨 Weather filter önizlemesi uygulanıyor:', filterType);
        console.log('🔍 Canvas boyutları:', this.canvas.width, 'x', this.canvas.height);
        console.log('🔍 Resim boyutları:', this.image.naturalWidth, 'x', this.image.naturalHeight);
        
        // Canvas boyutları kontrolü
        if (this.canvas.width === 0 || this.canvas.height === 0) {
            console.error('❌ Canvas boyutları 0:', this.canvas.width, 'x', this.canvas.height);
            return;
        }
        
        // Canvas'ı temizle
        const ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Resmi çiz
        const imageRect = this.getImageRect();
        ctx.drawImage(this.image, imageRect.x, imageRect.y, imageRect.width, imageRect.height);
        
        // Eğer "none" değilse, filtre uygula
        if (filterType && filterType !== 'none') {
            // Resim alanından ImageData al
            const imageData = ctx.getImageData(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
            
            // Filtre uygula
            this.applyWeatherFilter(imageData, filterType);
            
            // Filtrelenmiş veriyi geri çiz
            ctx.putImageData(imageData, imageRect.x, imageRect.y);
        }
        
        // CSS filtreleri temizle
        this.canvas.style.filter = 'none';
    }
    
    // CSS filtreleri kullanarak weather filter uygula
    applyCSSFilter(filterType) {
        console.log('🎨 CSS filter uygulanıyor:', filterType);
        
        // Önce tüm CSS filtrelerini temizle
        this.canvas.style.filter = 'none';
        
        let cssFilter = '';
        
        switch(filterType) {
            case 'sunny':
                cssFilter = 'brightness(1.3) saturate(1.4) hue-rotate(20deg) contrast(1.2) sepia(0.1)';
                break;
            case 'cloudy':
                cssFilter = 'brightness(0.85) saturate(0.7) contrast(0.9) grayscale(0.2)';
                break;
            case 'rainy':
                cssFilter = 'brightness(0.7) saturate(0.6) contrast(0.8) blur(0.8px) grayscale(0.3)';
                break;
            case 'snowy':
                cssFilter = 'brightness(1.2) saturate(0.5) contrast(1.3) blur(0.5px) grayscale(0.1)';
                break;
            case 'foggy':
                cssFilter = 'brightness(0.8) saturate(0.4) contrast(0.7) blur(1.5px) grayscale(0.4)';
                break;
            case 'sunset':
                cssFilter = 'brightness(1.2) saturate(1.5) hue-rotate(35deg) contrast(1.3) sepia(0.2)';
                break;
            case 'night':
                cssFilter = 'brightness(0.4) saturate(0.6) contrast(1.4) grayscale(0.8) hue-rotate(220deg)';
                break;
            default:
                cssFilter = 'none';
        }
        
        // CSS filter'ları kaldır - sadece canvas-based filtreler kullan
        this.canvas.style.filter = 'none';
        console.log('✅ CSS filter temizlendi, canvas-based filtreler kullanılıyor');
    }
    
    // Kar tanesi efekti ekle
    addSnowEffect(ctx = null, width = null, height = null) {
        if (!ctx) {
            if (!this.canvas) return;
            ctx = this.canvas.getContext('2d');
        }
        
        const imageRect = width && height ? { x: 0, y: 0, width, height } : this.getImageRect();
        console.log('❄️ addSnowEffect çağrıldı:', { width, height, imageRect });
        
        // Kar taneleri için rastgele pozisyonlar oluştur
        const snowflakes = [];
        for (let i = 0; i < 50; i++) {
            snowflakes.push({
                x: Math.random() * imageRect.width + imageRect.x,
                y: Math.random() * imageRect.height + imageRect.y,
                size: Math.random() * 3 + 1,
                opacity: Math.random() * 0.8 + 0.2,
                speed: Math.random() * 2 + 1
            });
        }
        
        // Kar tanelerini çiz
        ctx.save();
        snowflakes.forEach(flake => {
            ctx.globalAlpha = flake.opacity;
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
            ctx.fill();
            
            // Kar tanesi şekli (yıldız benzeri)
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3;
                const x1 = flake.x + Math.cos(angle) * flake.size;
                const y1 = flake.y + Math.sin(angle) * flake.size;
                const x2 = flake.x + Math.cos(angle) * (flake.size * 0.5);
                const y2 = flake.y + Math.sin(angle) * (flake.size * 0.5);
                
                if (i === 0) {
                    ctx.moveTo(x1, y1);
                } else {
                    ctx.lineTo(x1, y1);
                }
                ctx.moveTo(flake.x, flake.y);
                ctx.lineTo(x2, y2);
            }
            ctx.stroke();
        });
        ctx.restore();
    }
    
    // Yağmur damlası efekti ekle
    addRainEffect(ctx = null, width = null, height = null) {
        if (!ctx) {
            if (!this.canvas) return;
            ctx = this.canvas.getContext('2d');
        }
        
        const imageRect = width && height ? { x: 0, y: 0, width, height } : this.getImageRect();
        console.log('🌧️ addRainEffect çağrıldı:', { width, height, imageRect });
        
        // Yağmur damlaları için rastgele pozisyonlar oluştur
        const raindrops = [];
        for (let i = 0; i < 100; i++) {
            raindrops.push({
                x: Math.random() * imageRect.width + imageRect.x,
                y: Math.random() * imageRect.height + imageRect.y,
                length: Math.random() * 20 + 10,
                opacity: Math.random() * 0.6 + 0.2,
                speed: Math.random() * 3 + 2
            });
        }
        
        // Yağmur damlalarını çiz
        ctx.save();
        raindrops.forEach(drop => {
            ctx.globalAlpha = drop.opacity;
            ctx.strokeStyle = 'rgba(173, 216, 230, 0.8)'; // Açık mavi
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(drop.x, drop.y);
            ctx.lineTo(drop.x, drop.y + drop.length);
            ctx.stroke();
        });
        ctx.restore();
    }
    
    // Gece efekti ekle (siyah-beyaz + karartma)
    addNightEffect(ctx = null, width = null, height = null) {
        if (!ctx) {
            if (!this.canvas) return;
            ctx = this.canvas.getContext('2d');
        }
        
        const imageRect = width && height ? { x: 0, y: 0, width, height } : this.getImageRect();
        
        // Gece karartma efekti
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = 'rgba(0, 0, 50, 0.4)'; // Koyu mavi karartma
        ctx.fillRect(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
        
        // Yıldızlar ekle
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * imageRect.width + imageRect.x;
            const y = Math.random() * imageRect.height + imageRect.y;
            const size = Math.random() * 2 + 1;
            
            ctx.globalAlpha = Math.random() * 0.8 + 0.2;
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
    
    // Güneşli efekt ekle (sarı ışık filtresi)
    addSunnyEffect(ctx = null, width = null, height = null) {
        if (!ctx) {
            if (!this.canvas) return;
            ctx = this.canvas.getContext('2d');
        }
        
        const imageRect = width && height ? { x: 0, y: 0, width, height } : this.getImageRect();
        
        // Sarı ışık filtresi
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'; // Sarı ışık
        ctx.fillRect(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
        
        // Güneş ışınları efekti
        const centerX = imageRect.x + imageRect.width / 2;
        const centerY = imageRect.y + imageRect.height / 2;
        const radius = Math.min(imageRect.width, imageRect.height) / 3;
        
        ctx.globalAlpha = 0.1;
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
        ctx.lineWidth = 2;
        
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius * 1.5);
            const y2 = centerY + Math.sin(angle) * (radius * 1.5);
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        
        // Güneş merkezi
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    // Sis efekti ekle
    addFogEffect(ctx = null, width = null, height = null) {
        if (!ctx) {
            if (!this.canvas) return;
            ctx = this.canvas.getContext('2d');
        }
        
        const imageRect = width && height ? { x: 0, y: 0, width, height } : this.getImageRect();
        
        // Sis katmanları
        ctx.save();
        
        // Alt sis katmanı
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
        ctx.fillRect(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
        
        // Orta sis katmanı
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = 'rgba(180, 180, 180, 0.3)';
        ctx.fillRect(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
        
        // Üst sis katmanı
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = 'rgba(160, 160, 160, 0.2)';
        ctx.fillRect(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
        
        // Sis parçacıkları
        for (let i = 0; i < 30; i++) {
            const x = Math.random() * imageRect.width + imageRect.x;
            const y = Math.random() * imageRect.height + imageRect.y;
            const size = Math.random() * 40 + 20;
            
            ctx.globalAlpha = Math.random() * 0.1 + 0.05;
            ctx.fillStyle = 'rgba(220, 220, 220, 0.3)';
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    // Gün batımı efekti ekle
    addSunsetEffect(ctx = null, width = null, height = null) {
        if (!ctx) {
            if (!this.canvas) return;
            ctx = this.canvas.getContext('2d');
        }
        
        const imageRect = width && height ? { x: 0, y: 0, width, height } : this.getImageRect();
        
        // Gün batımı renk geçişi
        ctx.save();
        
        // Turuncu-kırmızı geçiş
        const gradient = ctx.createLinearGradient(
            imageRect.x, imageRect.y, 
            imageRect.x, imageRect.y + imageRect.height
        );
        gradient.addColorStop(0, 'rgba(255, 100, 0, 0.3)'); // Turuncu
        gradient.addColorStop(0.5, 'rgba(255, 50, 0, 0.2)'); // Kırmızı-turuncu
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0.1)');   // Kırmızı
        
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = gradient;
        ctx.fillRect(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
        
        // Güneş efekti (ufukta)
        const sunX = imageRect.x + imageRect.width * 0.8;
        const sunY = imageRect.y + imageRect.height * 0.7;
        const sunRadius = 30;
        
        // Güneş halesi
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = 'rgba(255, 200, 0, 0.6)';
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Güneş
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = 'rgba(255, 150, 0, 0.8)';
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    // Bulutlu efekt ekle
    addCloudyEffect(ctx = null, width = null, height = null) {
        if (!ctx) {
            if (!this.canvas) return;
            ctx = this.canvas.getContext('2d');
        }
        
        const imageRect = width && height ? { x: 0, y: 0, width, height } : this.getImageRect();
        
        // Bulutlu hava efekti
        ctx.save();
        
        // Gri tonlama efekti
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = 'rgba(150, 150, 150, 0.3)';
        ctx.fillRect(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
        
        // Bulut parçacıkları
        for (let i = 0; i < 15; i++) {
            const x = Math.random() * imageRect.width + imageRect.x;
            const y = Math.random() * imageRect.height * 0.3 + imageRect.y; // Üst kısımda
            const size = Math.random() * 60 + 30;
            
            ctx.globalAlpha = Math.random() * 0.15 + 0.05;
            ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            
            // Bulut gölgesi
            ctx.globalAlpha = Math.random() * 0.1 + 0.02;
            ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
            ctx.beginPath();
            ctx.arc(x + 5, y + 5, size * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }

    // Weather filter uygula
    applyWeatherFilter(imageData, filterType) {
        console.log('🎨 applyWeatherFilter çağrıldı:', filterType);
        console.log('🔍 ImageData boyutları:', imageData.width, 'x', imageData.height);
        console.log('🔍 ImageData data length:', imageData.data.length);
        
        const data = imageData.data;
        
        switch(filterType) {
            case 'sunny':
                console.log('☀️ Sunny filter uygulanıyor');
                this.applySunnyFilter(data);
                break;
            case 'cloudy':
                console.log('☁️ Cloudy filter uygulanıyor');
                this.applyCloudyFilter(data);
                break;
            case 'rainy':
                console.log('🌧️ Rainy filter uygulanıyor');
                this.applyRainyFilter(data);
                break;
            case 'snowy':
                console.log('❄️ Snowy filter uygulanıyor');
                this.applySnowyFilter(data);
                break;
            case 'foggy':
                console.log('🌫️ Foggy filter uygulanıyor');
                this.applyFoggyFilter(data);
                break;
            case 'sunset':
                console.log('🌅 Sunset filter uygulanıyor');
                this.applySunsetFilter(data);
                break;
            case 'night':
                console.log('🌙 Night filter uygulanıyor');
                this.applyNightFilter(data);
                break;
            default:
                console.log('❌ Bilinmeyen filter type:', filterType);
        }
        
        console.log('✅ applyWeatherFilter tamamlandı');
    }

    // Canvas efektlerini uygula (kar taneleri, yağmur damlaları vs.)
    addWeatherEffect(ctx, filterType, width, height) {
        if (!filterType || filterType === 'none') {
            return;
        }

        console.log('🎨 Canvas efektleri uygulanıyor:', filterType, 'Boyutlar:', width, 'x', height);

        switch (filterType) {
            case 'snowy':
                console.log('❄️ Kar efekti uygulanıyor...');
                this.addSnowEffect(ctx, width, height);
                break;
            case 'rainy':
                console.log('🌧️ Yağmur efekti uygulanıyor...');
                this.addRainEffect(ctx, width, height);
                break;
            case 'night':
                console.log('🌙 Gece efekti uygulanıyor...');
                this.addNightEffect(ctx, width, height);
                break;
            case 'sunny':
                console.log('☀️ Güneş efekti uygulanıyor...');
                this.addSunnyEffect(ctx, width, height);
                break;
            case 'foggy':
                console.log('🌫️ Sis efekti uygulanıyor...');
                this.addFogEffect(ctx, width, height);
                break;
            case 'sunset':
                console.log('🌅 Gün batımı efekti uygulanıyor...');
                this.addSunsetEffect(ctx, width, height);
                break;
            case 'cloudy':
                console.log('☁️ Bulut efekti uygulanıyor...');
                this.addCloudyEffect(ctx, width, height);
                break;
        }
        
        console.log('✅ Canvas efektleri tamamlandı:', filterType);
    }

    // Export için ayrı weather filter fonksiyonu - global state'i etkilemez
    applyWeatherFilterForExport(imageData, filterType) {
        console.log('🎨 applyWeatherFilterForExport çağrıldı:', filterType);
        console.log('🔍 ImageData boyutları:', imageData.width, 'x', imageData.height);
        console.log('🔍 ImageData data length:', imageData.data.length);
        
        const data = imageData.data;
        
        switch(filterType) {
            case 'sunny':
                console.log('☀️ Sunny filter uygulanıyor (export)');
                this.applySunnyFilterForExport(data);
                break;
            case 'cloudy':
                console.log('☁️ Cloudy filter uygulanıyor (export)');
                this.applyCloudyFilterForExport(data);
                break;
            case 'rainy':
                console.log('🌧️ Rainy filter uygulanıyor (export)');
                this.applyRainyFilterForExport(data, imageData.width, imageData.height);
                break;
            case 'snowy':
                console.log('❄️ Snowy filter uygulanıyor (export)');
                this.applySnowyFilterForExport(data, imageData.width, imageData.height);
                break;
            case 'foggy':
                console.log('🌫️ Foggy filter uygulanıyor (export)');
                this.applyFoggyFilterForExport(data);
                break;
            case 'sunset':
                console.log('🌅 Sunset filter uygulanıyor (export)');
                this.applySunsetFilterForExport(data);
                break;
            case 'night':
                console.log('🌙 Night filter uygulanıyor (export)');
                this.applyNightFilterForExport(data);
                break;
            default:
                console.log('❌ Bilinmeyen filter type:', filterType);
        }
        
        console.log('✅ applyWeatherFilterForExport tamamlandı');
    }

    // ☀️ GÜNEŞLİ/AÇIK HAVA FİLTRESİ
    // ☀️ GÜNEŞLİ/AÇIK HAVA FİLTRESİ
    applySunnyFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Sarı/altın tonları artır
            r = Math.min(255, r * 1.15 + 15);
            g = Math.min(255, g * 1.1 + 10);
            b = Math.min(255, b * 0.95);
            
            // Genel parlaklık artırma
            const brightness = (r + g + b) / 3;
            if (brightness < 200) {
                r = Math.min(255, r + 10);
                g = Math.min(255, g + 8);
                b = Math.min(255, b + 5);
            }
            
            // Kontrast hafif artır
            r = Math.min(255, (r - 128) * 1.1 + 128);
            g = Math.min(255, (g - 128) * 1.1 + 128);
            b = Math.min(255, (b - 128) * 1.1 + 128);
            
            data[i] = Math.max(0, r);
            data[i + 1] = Math.max(0, g);
            data[i + 2] = Math.max(0, b);
        }
    }

    // ☁️ BULUTLU HAVA FİLTRESİ
    applyCloudyFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Hafif gri cast
            const gray = (r + g + b) / 3;
            r = r * 0.9 + gray * 0.1;
            g = g * 0.9 + gray * 0.1;
            b = b * 0.9 + gray * 0.1;
            
            // Genel karartma (az)
            r *= 0.95;
            g *= 0.95;
            b *= 0.95;
            
            // Kontrast azaltma
            r = (r - 128) * 0.9 + 128;
            g = (g - 128) * 0.9 + 128;
            b = (b - 128) * 0.9 + 128;
            
            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
    }

    // Yağmurlu hava filtresi (daha gerçekçi ve ince efektler)
    applyRainyFilter(data) {
        // Orijinal resim boyutlarını kullan (zoom'dan bağımsız)
        const width = this.originalImageInfo ? this.originalImageInfo.width : this.canvas.width;
        const height = this.originalImageInfo ? this.originalImageInfo.height : this.canvas.height;
        
        // Önce atmosferik renk ayarlamalarını uygula (daha ince)
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Hafif soğuk ton (yağmurlu atmosfer)
            r *= 0.95;
            g *= 0.97;
            b = Math.min(255, b * 1.05);
            
            // Hafif desatürasyon (yağmur renkleri biraz sönükleştirir)
            const avg = (r + g + b) / 3;
            r = r * 0.9 + avg * 0.1;
            g = g * 0.9 + avg * 0.1;
            b = b * 0.9 + avg * 0.1;
            
            // Çok hafif karartma
            r *= 0.95;
            g *= 0.95;
            b *= 0.97;
            
            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
        }

        // Şimdi gerçekçi yağmur damlaları piksel bazında entegre et
        this.addRainDrops(data, width, height);
    }

    // Yağmur damlaları ekleme fonksiyonu (gerçekçi damla şekilleri ve refraksiyon simülasyonu)
    addRainDrops(data, width, height) {
        // Yağmur yoğunluğunu ayarla (daha doğal dağılım için artır ama alpha azalt)
        const numDrops = Math.floor(width * height * 0.0005); // Azaltılmış yoğunluk
        
        const minSize = 2; // Min damla yarıçapı
        const maxSize = 6; // Max damla yarıçapı (daha küçük, doğal)
        const dropAlphaBase = 0.15; // Temel şeffaflık (daha hafif)
        const refractionStrength = 0.15; // Refraksiyon etkisi gücü (yarıya indirildi)
        
        for (let i = 0; i < numDrops; i++) {
            const centerX = Math.floor(Math.random() * width);
            const centerY = Math.floor(Math.random() * height);
            const size = Math.floor(Math.random() * (maxSize - minSize + 1) + minSize);
            const alphaVariation = Math.random() * 0.1 + dropAlphaBase; // Hafif varyasyon
            
            // Damla için elips/damla şekli simüle et (basit daire + dikey uzama)
            const aspectRatio = 1.5; // Dikey uzama için (yağmur düşüş hissi)
            
            // Damla içindeki pikselleri işle
            for (let dy = -size * aspectRatio; dy <= size * aspectRatio; dy++) {
                for (let dx = -size; dx <= size; dx++) {
                    // Elips içinde mi? (uzatılmış daire)
                    if ((dx * dx) / (size * size) + (dy * dy) / (size * size * aspectRatio * aspectRatio) <= 1) {
                        const x = Math.floor(centerX + dx);
                        const y = Math.floor(centerY + dy);
                        
                        if (x >= 0 && x < width && y >= 0 && y < height) {
                            const index = (y * width + x) * 4;
                            
                            // Basit refraksiyon simülasyonu - daha ince ve güvenli
                            const offsetX = Math.floor(dx * -refractionStrength * 0.5); // Gücü yarıya indir
                            const offsetY = Math.floor(dy * -refractionStrength * 0.5);
                            const srcX = Math.min(width - 1, Math.max(0, x + offsetX));
                            const srcY = Math.min(height - 1, Math.max(0, y + offsetY));
                            const srcIndex = (srcY * width + srcX) * 4;
                            
                            // Güvenli piksel okuma - sınırları kontrol et
                            let r, g, b;
                            if (srcIndex >= 0 && srcIndex < data.length - 3) {
                                r = data[srcIndex];
                                g = data[srcIndex + 1];
                                b = data[srcIndex + 2];
                            } else {
                                // Güvenli fallback - mevcut pikseli kullan
                                r = data[index];
                                g = data[index + 1];
                                b = data[index + 2];
                            }
                            
                        // Hafif mavi ton ve parlaklık artır (su yansıması) - daha ince
                        b = Math.min(255, b * 1.03);
                        const brightnessBoost = 1.02;
                        r *= brightnessBoost;
                        g *= brightnessBoost;
                        b *= brightnessBoost;
                            
                            // Mevcut piksel ile refrakte edilmiş rengi blend et (screen blending benzeri)
                            data[index] = Math.min(255, data[index] + (r - data[index]) * alphaVariation);
                            data[index + 1] = Math.min(255, data[index + 1] + (g - data[index + 1]) * alphaVariation);
                            data[index + 2] = Math.min(255, data[index + 2] + (b - data[index + 2]) * alphaVariation);
                        }
                    }
                }
            }
        }
        
        // Blur efektini kaldır - sürekli uygulanması "hayalet" efekti yaratıyor
        // this.applyLightBlur(data, width, height);
    }

    // Hafif bulanıklık fonksiyonu (Gaussian benzeri 3x3 blur, güç parametreli)
    applyLightBlur(data, width, height, strength = 1) {
        const tempData = new Uint8ClampedArray(data); // Kopya al
        const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1]; // Basit Gaussian kernel
        const kernelSum = kernel.reduce((a, b) => a + b, 0);
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const index = (y * width + x) * 4;
                let r = 0, g = 0, b = 0;
                let k = 0;
                
                // 3x3 kernel uygula
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nIndex = ((y + dy) * width + (x + dx)) * 4;
                        const weight = kernel[k++] * strength;
                        r += tempData[nIndex] * weight;
                        g += tempData[nIndex + 1] * weight;
                        b += tempData[nIndex + 2] * weight;
                    }
                }
                
                data[index] = Math.floor(r / (kernelSum * strength));
                data[index + 1] = Math.floor(g / (kernelSum * strength));
                data[index + 2] = Math.floor(b / (kernelSum * strength));
            }
        }
    }

    // ❄️ KARLI HAVA FİLTRESİ (optimize edilmiş, gerçekçi kar taneleri ile)
    applySnowyFilter(data) {
        // Orijinal resim boyutlarını kullan (zoom'dan bağımsız)
        const width = this.originalImageInfo ? this.originalImageInfo.width : this.canvas.width;
        const height = this.originalImageInfo ? this.originalImageInfo.height : this.canvas.height;
        
        // Piksel verilerini Float32Array olarak işle (performans için)
        const floatData = new Float32Array(data.length);
        for (let i = 0; i < data.length; i++) {
            floatData[i] = data[i];
        }

        // Atmosferik değişiklikleri uygula (optimize edilmiş döngü)
        for (let i = 0; i < data.length; i += 4) {
            let r = floatData[i];
            let g = floatData[i + 1];
            let b = floatData[i + 2];

            // Soğuk hava: kırmızı ve yeşil tonları azalt, maviye hafif vurgu
            r *= 0.88;
            g *= 0.92;
            b = Math.min(255, b * 1.08);

            // Kapalı hava: genel parlaklık azaltılır
            r *= 0.93;
            g *= 0.93;
            b *= 0.95;

            // Kar yansıması: beyazımsı etki
            const snowReflection = 0.06;
            r += (255 - r) * snowReflection;
            g += (255 - g) * snowReflection;
            b += (255 - b) * (snowReflection + 0.01);

            // Sis efekti: renkler griye yaklaşır
            const avgLuminance = (r * 0.299 + g * 0.587 + b * 0.114);
            const fogFactor = 0.18;
            r = r * (1 - fogFactor) + avgLuminance * fogFactor;
            g = g * (1 - fogFactor) + avgLuminance * fogFactor;
            b = b * (1 - fogFactor) + avgLuminance * fogFactor;

            // Kontrastı düşür (kapalı hava için)
            const contrastReduction = 0.89;
            r = (r - 128) * contrastReduction + 128;
            g = (g - 128) * contrastReduction + 128;
            b = (b - 128) * contrastReduction + 128;

            // Parlak alanları ve gölgeleri yumuşat
            const brightness = (r + g + b) / 3;
            if (brightness > 135) {
                r *= 0.97;
                g *= 0.97;
                b *= 0.98;
            } else if (brightness < 80) {
                r = Math.min(255, r * 1.015 + 2);
                g = Math.min(255, g * 1.015 + 2);
                b = Math.min(255, b * 1.015 + 3);
            }

            // Sınırları uygula ve orijinal veriye yaz
            data[i] = Math.min(255, Math.max(0, Math.round(r)));
            data[i + 1] = Math.min(255, Math.max(0, Math.round(g)));
            data[i + 2] = Math.min(255, Math.max(0, Math.round(b)));
        }

        // Hazır kar tanesi texture'ını overlay olarak ekle
        this.addSnowTextureOverlay(data, width, height);
    }

    // Kar tanesi texture overlay fonksiyonu (hazır PNG kullanarak)
    addSnowTextureOverlay(data, width, height) {
        // Hazır PNG dosyasını yükle
        const snowTexture = this.loadSnowPNG();
        if (!snowTexture) {
            console.warn('⚠️ Kar PNG yüklenemedi, fallback kullanılıyor');
            this.addRealisticSnowflakes(data, width, height);
            return;
        }

        // Texture'ı resim boyutuna ölçekle ve uygula
        const textureCanvas = document.createElement('canvas');
        const textureCtx = textureCanvas.getContext('2d');
        textureCanvas.width = width;
        textureCanvas.height = height;
        
        // Texture'ı çiz
        textureCtx.drawImage(snowTexture, 0, 0, width, height);
        const textureData = textureCtx.getImageData(0, 0, width, height);
        
        // Overlay blending uygula
        for (let i = 0; i < data.length; i += 4) {
            const textureR = textureData.data[i];
            const textureG = textureData.data[i + 1];
            const textureB = textureData.data[i + 2];
            const textureA = textureData.data[i + 3];
            
            // Sadece beyaz pikselleri (kar taneleri) uygula
            if (textureR > 200 && textureG > 200 && textureB > 200) {
                const alpha = (textureA / 255) * 0.4; // Biraz daha görünür
                
                // Screen blending ile kar tanesi ekle
                data[i] = Math.min(255, data[i] + (textureR - data[i]) * alpha);
                data[i + 1] = Math.min(255, data[i + 1] + (textureG - data[i + 1]) * alpha);
                data[i + 2] = Math.min(255, data[i + 2] + (textureB - data[i + 2]) * alpha);
            }
        }
    }

    // Hazır PNG dosyasını yükle
    loadSnowPNG() {
        // Cache'den kontrol et
        if (this.snowTextureCache) {
            return this.snowTextureCache;
        }
        
        // Hazır PNG dosyasını yükle
        const img = new Image();
        img.crossOrigin = 'anonymous'; // CORS için
        img.onload = () => {
            this.snowTextureCache = img;
        };
        img.onerror = () => {
            console.warn('⚠️ Kar PNG dosyası yüklenemedi');
            this.snowTextureCache = null;
        };
        
        // PNG dosyasının yolunu belirt
        img.src = 'image-from-rawpixel-id-12655443-png.png';
        
        return img;
    }

    // Gerçekçi kar taneleri ekleme fonksiyonu (daha ince, doğal ve varyasyonlu)
    addRealisticSnowflakes(data, width, height) {
        // Kar yoğunluğunu ayarla (daha doğal dağılım için artır ama alpha azalt)
        const numFlakes = Math.floor(width * height * 0.0003); // Azaltılmış yoğunluk, daha doğal
        
        const minSize = 2; // Min tanecik yarıçapı
        const maxSize = 4; // Max tanecik yarıçapı (küçük tutuldu)
        const flakeAlphaBase = 0.12; // Temel şeffaflık (çok hafif)
        const glowStrength = 0.15; // Hafif parlama etkisi gücü
        const blurStrength = 0.8; // Bulanıklık gücü (yumuşak kenarlar için)
        
        for (let i = 0; i < numFlakes; i++) {
            const centerX = Math.floor(Math.random() * width);
            const centerY = Math.floor(Math.random() * height);
            const size = Math.floor(Math.random() * (maxSize - minSize + 1) + minSize);
            const alphaVariation = Math.random() * 0.08 + flakeAlphaBase; // Hafif varyasyon
            const rotation = Math.random() * Math.PI * 2; // Rastgele rotasyon
            
            // Kar tanesi için düzensiz/heksagonal şekil simüle et (dallanma ile)
            const branches = 6; // Heksagonal dallar
            const branchVariation = Math.random() * 0.3 + 0.7; // Dal uzunluk varyasyonu
            
            for (let branch = 0; branch < branches; branch++) {
                const angle = (Math.PI * 2 / branches) * branch + rotation;
                const branchLength = size * branchVariation * (0.6 + Math.random() * 0.4);
                
                // Dal boyunca pikselleri blend et (yumuşak geçiş için alpha azalarak)
                for (let step = 0; step < branchLength; step++) {
                    const fade = 1 - (step / branchLength); // Uçlarda solma
                    const dx = Math.cos(angle) * step;
                    const dy = Math.sin(angle) * step;
                    const x = Math.floor(centerX + dx);
                    const y = Math.floor(centerY + dy);
                    
                    if (x >= 0 && x < width && y >= 0 && y < height) {
                        const index = (y * width + x) * 4;
                        
                        // Hafif parlama simülasyonu: Yakın pikselleri hafifçe aydınlat
                        let r = data[index];
                        let g = data[index + 1];
                        let b = data[index + 2];
                        
                        // Beyaz ton ve parlaklık artır (kar yansıması) - daha ince ve doğal
                        const brightnessBoost = 1.03;
                        r = Math.min(255, r * brightnessBoost + glowStrength * 180 * fade); // 255 yerine 180
                        g = Math.min(255, g * brightnessBoost + glowStrength * 190 * fade); // 255 yerine 190
                        b = Math.min(255, b * brightnessBoost + glowStrength * 200 * fade); // 255 yerine 200, hafif mavi
                        
                        // Mevcut piksel ile kar rengini blend et (additive blending)
                        const effectiveAlpha = alphaVariation * fade;
                        data[index] = Math.min(255, data[index] + (r - data[index]) * effectiveAlpha);
                        data[index + 1] = Math.min(255, data[index + 1] + (g - data[index + 1]) * effectiveAlpha);
                        data[index + 2] = Math.min(255, data[index + 2] + (b - data[index + 2]) * effectiveAlpha);
                    }
                }
            }
            
            // Merkez için ekstra yumuşak yoğunluk - daha ince
            const centerIndex = (centerY * width + centerX) * 4;
            if (centerIndex >= 0 && centerIndex < data.length - 3) {
                data[centerIndex] = Math.min(255, data[centerIndex] + 8); // 15 yerine 8
                data[centerIndex + 1] = Math.min(255, data[centerIndex + 1] + 8); // 15 yerine 8
                data[centerIndex + 2] = Math.min(255, data[centerIndex + 2] + 10); // 18 yerine 10
            }
        }
        
        // Hafif genel bulanıklık uygula (gerçekçiliği artırır)
        this.applyLightBlur(data, width, height, blurStrength);
    }

    // Optimize edilmiş kar taneleri ekleme fonksiyonu
    addOptimizedSnowflakes(data, width, height) {
        // Kar tanelerini ekle (gerçekçi, rastgele dağılmış, boyut varyasyonlu)
        const numFlakes = Math.floor(width * height * 0.0005); // Yoğunluk: piksel başına ~0.05% kar tanesi
        const flakeColor = { r: 240, g: 245, b: 255 }; // Hafif mavi-beyaz ton
        const minSize = 1; // Piksel cinsinden min yarıçap
        const maxSize = 3; // Max yarıçap
        const alphaRange = [0.4, 0.8]; // Şeffaflık aralığı

        for (let flake = 0; flake < numFlakes; flake++) {
            const centerX = Math.floor(Math.random() * width);
            const centerY = Math.floor(Math.random() * height);
            const size = Math.floor(Math.random() * (maxSize - minSize + 1) + minSize);
            const alpha = Math.random() * (alphaRange[1] - alphaRange[0]) + alphaRange[0];

            // Basit dairesel kar tanesi çiz (anti-aliased değil, ama hızlı)
            for (let dy = -size; dy <= size; dy++) {
                for (let dx = -size; dx <= size; dx++) {
                    if (dx * dx + dy * dy <= size * size) { // Daire içinde mi?
                        const x = centerX + dx;
                        const y = centerY + dy;
                        if (x >= 0 && x < width && y >= 0 && y < height) {
                            const index = (y * width + x) * 4;
                            // Alpha blending ile karıştır
                            data[index] = Math.round(data[index] * (1 - alpha) + flakeColor.r * alpha);
                            data[index + 1] = Math.round(data[index + 1] * (1 - alpha) + flakeColor.g * alpha);
                            data[index + 2] = Math.round(data[index + 2] * (1 - alpha) + flakeColor.b * alpha);
                        }
                    }
                }
            }
        }
    }

    // 🌫️ SİSLİ/BULANIK FİLTRESİ
    applyFoggyFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Desaturation (gri tonuna çekme)
            const gray = (r + g + b) / 3;
            r = r * 0.4 + gray * 0.6;
            g = g * 0.4 + gray * 0.6;
            b = b * 0.4 + gray * 0.6;
            
            // Hafif beyazlatma
            r = r + 20;
            g = g + 20;
            b = b + 20;
            
            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
    }

    // 🌅 GÜN BATIMI FİLTRESİ
    applySunsetFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Turuncu/kırmızı tonları artır
            r = r * 1.3;
            g = g * 1.1;
            b = b * 0.8;
            
            // Sıcak ton ekleme
            r = r + 20;
            g = g + 10;
            
            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
    }

    // 🌙 GECE FİLTRESİ (Optimize edilmiş, gerçekçi gece atmosferi)
    applyNightFilter(data) {
        // Orijinal resim boyutlarını kullan (zoom'dan bağımsız)
        const width = this.originalImageInfo ? this.originalImageInfo.width : this.canvas.width;
        const height = this.originalImageInfo ? this.originalImageInfo.height : this.canvas.height;
        
        // Piksel verilerini Float32Array ile işle (hassasiyet ve performans için)
        const floatData = new Float32Array(data.length);
        for (let i = 0; i < data.length; i++) {
            floatData[i] = data[i];
        }

        // Gece atmosferi: soğuk mavimsi tonlar, düşük parlaklık ve kontrast ayarları
        for (let i = 0; i < data.length; i += 4) {
            let r = floatData[i];
            let g = floatData[i + 1];
            let b = floatData[i + 2];

            // Kısmi desatürasyon (gece tamamen gri değil, ama renkler soluk)
            const luminance = r * 0.299 + g * 0.587 + b * 0.114;
            const desatFactor = 0.6; // Desatürasyon oranı (0: tam renk, 1: tam gri)
            r = r * (1 - desatFactor) + luminance * desatFactor;
            g = g * (1 - desatFactor) + luminance * desatFactor;
            b = b * (1 - desatFactor) + luminance * desatFactor;

            // Mavimsi gece tonu ekle (ay ışığı etkisi)
            const blueTint = 1.15;
            const redGreenReduce = 0.85;
            r *= redGreenReduce;
            g *= redGreenReduce;
            b *= blueTint;

            // Kontrast artırma (gölgeler daha derin, vurgular korunur)
            const contrast = 1.4;
            r = (r - 128) * contrast + 128;
            g = (g - 128) * contrast + 128;
            b = (b - 128) * contrast + 128;

            // Genel karartma (gece parlaklığı azalt)
            const darkness = 0.65;
            r *= darkness;
            g *= darkness;
            b *= darkness;

            // Vurguları hafifçe artır (ışık kaynakları parlasın)
            const brightness = (r + g + b) / 3;
            if (brightness > 80) {
                const boost = 1.15;
                r = Math.min(255, r * boost);
                g = Math.min(255, g * boost);
                b = Math.min(255, b * boost);
            }

            // Sınırları uygula
            floatData[i] = Math.min(255, Math.max(0, r));
            floatData[i + 1] = Math.min(255, Math.max(0, g));
            floatData[i + 2] = Math.min(255, Math.max(0, b));
        }

        // Vignette efekti ekle (kenarları karart, merkez aydınlık)
        this.addVignetteEffect(floatData, width, height);

        // Film grain/noise ekle (gece fotoğraflarında yaygın)
        this.addFilmGrain(floatData);

        // Sonuçları orijinal Uint8ClampedArray'e yuvarlayarak yaz
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.round(floatData[i]);
        }
    }

    // Vignette efekti ekleme fonksiyonu
    addVignetteEffect(floatData, width, height) {
        const vignetteStrength = 0.5; // 0-1 arası güç
        const vignetteRadius = Math.min(width, height) / 2;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                const dx = x - width / 2;
                const dy = y - height / 2;
                const dist = Math.sqrt(dx * dx + dy * dy) / vignetteRadius;
                const vignetteFactor = 1 - Math.min(1, dist) * vignetteStrength;

                floatData[index] *= vignetteFactor;
                floatData[index + 1] *= vignetteFactor;
                floatData[index + 2] *= vignetteFactor;
            }
        }
    }

    // Film grain/noise ekleme fonksiyonu
    addFilmGrain(floatData) {
        const noiseStrength = 20; // Noise miktarı (0-255)
        
        for (let i = 0; i < floatData.length; i += 4) {
            const noise = (Math.random() - 0.5) * noiseStrength;
            floatData[i] = Math.min(255, Math.max(0, floatData[i] + noise));
            floatData[i + 1] = Math.min(255, Math.max(0, floatData[i + 1] + noise));
            floatData[i + 2] = Math.min(255, Math.max(0, floatData[i + 2] + noise));
        }
    }

    // Annotation işlemleri

    // ❄️ KARLI HAVA FİLTRESİ (gerçekçi kar taneleri ile)
    // Küçük, yoğun ve tutarlı kar taneleri ekleyen filtre:
    applySnowyFilter(data) {
        // Orijinal resim boyutlarını kullan (zoom'dan bağımsız)
        const width = this.originalImageInfo ? this.originalImageInfo.width : this.canvas.width;
        const height = this.originalImageInfo ? this.originalImageInfo.height : this.canvas.height;
        
        // Önce atmosferik değişiklikleri uygula
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // Soğuk hava: kırmızı ve yeşil tonları azalt, maviye hafif vurgu
            r *= 0.88;
            g *= 0.92;
            b = Math.min(255, b * 1.08);

            // Kapalı hava: genel parlaklık azaltılır
            r *= 0.93;
            g *= 0.93;
            b *= 0.95;

            // Kar yansıması: beyazımsı etki
            const snowReflection = 0.06;
            r = r + (255 - r) * snowReflection;
            g = g + (255 - g) * snowReflection;
            b = b + (255 - b) * (snowReflection + 0.01);

            // Sis efekti: renkler griye yaklaşır
            const avgLuminance = (r * 0.299 + g * 0.587 + b * 0.114);
            const fogFactor = 0.18;
            r = r * (1 - fogFactor) + avgLuminance * fogFactor;
            g = g * (1 - fogFactor) + avgLuminance * fogFactor;
            b = b * (1 - fogFactor) + avgLuminance * fogFactor;

            // Kontrastı düşür (kapalı hava için)
            const contrastReduction = 0.89;
            r = (r - 128) * contrastReduction + 128;
            g = (g - 128) * contrastReduction + 128;
            b = (b - 128) * contrastReduction + 128;

            // Parlak alanları ve gölgeleri yumuşat
            const brightness = (r + g + b) / 3;
            if (brightness > 135) {
                r *= 0.97;
                g *= 0.97;
                b *= 0.98;
            } else if (brightness < 80) {
                r = Math.min(255, r * 1.015 + 2);
                g = Math.min(255, g * 1.015 + 2);
                b = Math.min(255, b * 1.015 + 3);
            }

            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }

        // Gerçekçi kar taneleri ekle
        this.addRealisticSnowflakes(data, width, height);
    }

    // Kar taneleri ekleme fonksiyonu
    addSnowflakes(data, width, height) {
        // Kar tanesi yoğunluğu (piksel başına kar tanesi sayısı)
        const snowDensity = 0.0008; // Daha yoğun kar
        const totalPixels = width * height;
        const numSnowflakes = Math.floor(totalPixels * snowDensity);
        
        // Kar tanesi boyutları (fotoğraf boyutundan bağımsız, sabit)
        const minSize = 1; // Minimum kar tanesi boyutu
        const maxSize = 3; // Maksimum kar tanesi boyutu
        
        for (let i = 0; i < numSnowflakes; i++) {
            // Rastgele pozisyon
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            
            // Rastgele boyut
            const size = minSize + Math.random() * (maxSize - minSize);
            
            // Kar tanesi şeffaflığı (daha gerçekçi)
            const opacity = 0.6 + Math.random() * 0.4; // 0.6-1.0 arası
            
            // Kar tanesini çiz
            this.drawSnowflake(data, width, height, x, y, size, opacity);
        }
    }

    // Tek kar tanesi çizme fonksiyonu
    drawSnowflake(data, width, height, centerX, centerY, size, opacity) {
        const radius = Math.ceil(size);
        
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const x = centerX + dx;
                const y = centerY + dy;
                
                // Sınırları kontrol et
                if (x < 0 || x >= width || y < 0 || y >= height) continue;
                
                // Dairesel kar tanesi şekli
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= size) {
                    const index = (y * width + x) * 4;
                    
                    // Mevcut renkleri al
                    let r = data[index];
                    let g = data[index + 1];
                    let b = data[index + 2];
                    
                    // Kar tanesi rengi (beyaz, hafif mavi tonlu)
                    const snowR = 255;
                    const snowG = 255;
                    const snowB = 255;
                    
                    // Kar tanesini mevcut renge karıştır
                    const blendFactor = opacity * (1 - distance / size); // Merkezden uzaklaştıkça şeffaflaşır
                    r = r * (1 - blendFactor) + snowR * blendFactor;
                    g = g * (1 - blendFactor) + snowG * blendFactor;
                    b = b * (1 - blendFactor) + snowB * blendFactor;
                    
                    data[index] = Math.min(255, Math.max(0, r));
                    data[index + 1] = Math.min(255, Math.max(0, g));
                    data[index + 2] = Math.min(255, Math.max(0, b));
                }
            }
        }
    }


    // 🌅 GÜN BATIMI FİLTRESİ
    applySunsetFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Turuncu/kırmızı tonları artır
            r = r * 1.3;
            g = g * 1.1;
            b = b * 0.8;
            
            // Sıcak ton ekleme
            r = r + 20;
            g = g + 10;
            
            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
    }

    // ❄️ SOĞUK HAVA FİLTRESİ
    applyColdFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Mavi/beyaz tonları artır
            r = r * 0.9;
            g = g * 0.95;
            b = b * 1.2;
            
            // Soğuk ton ekleme
            b = b + 15;
            
            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
    }

    // ☀️ SICAK/GÜNEŞLİ FİLTRESİ
    applyWarmFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Sarı/kırmızı tonları artır
            r = r * 1.2;
            g = g * 1.1;
            b = b * 0.9;
            
            // Parlaklık artırma
            r = r + 10;
            g = g + 5;
            
            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
    }

    // 🌫️ SİSLİ/BULANIK FİLTRESİ
    applyFoggyFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Desaturation (gri tonuna çekme)
            const gray = (r + g + b) / 3;
            r = r * 0.4 + gray * 0.6;
            g = g * 0.4 + gray * 0.6;
            b = b * 0.4 + gray * 0.6;
            
            // Hafif beyazlatma
            r = r + 20;
            g = g + 20;
            b = b + 20;
            
            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
    }

    // 🎭 VİNTAGE FİLTRESİ
    applyVintageFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Sepia tonları
            const newR = (r * 0.393) + (g * 0.769) + (b * 0.189);
            const newG = (r * 0.349) + (g * 0.686) + (b * 0.168);
            const newB = (r * 0.272) + (g * 0.534) + (b * 0.131);
            
            data[i] = Math.min(255, Math.max(0, newR));
            data[i + 1] = Math.min(255, Math.max(0, newG));
            data[i + 2] = Math.min(255, Math.max(0, newB));
        }
    }

    // 🌈 CANLI RENKLER FİLTRESİ
    applyVibrantFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Saturation artırma
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const diff = max - min;
            
            if (diff > 0) {
                const saturation = 1.5; // %50 saturation artışı
                r = min + (r - min) * saturation;
                g = min + (g - min) * saturation;
                b = min + (b - min) * saturation;
            }
            
            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
    }

    // ===== EXPORT İÇİN AYRI FİLTRE FONKSİYONLARI =====
    // Bu fonksiyonlar global state'i etkilemez, sadece verilen data'yı işler

    applySunnyFilterForExport(data) {
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Sarı/altın tonları artır
            r = r * 1.1;
            g = g * 1.05;
            b = b * 0.9;
            
            // Genel parlaklık artır
            r = r * 1.1;
            g = g * 1.1;
            b = b * 1.1;
            
            // Kontrast artır
            r = (r - 128) * 1.2 + 128;
            g = (g - 128) * 1.2 + 128;
            b = (b - 128) * 1.2 + 128;
            
            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.max(0, b);
        }
    }

    applyCloudyFilterForExport(data) {
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Hafif gri ton ekle
            const gray = (r + g + b) / 3;
            r = r * 0.7 + gray * 0.3;
            g = g * 0.7 + gray * 0.3;
            b = b * 0.7 + gray * 0.3;
            
            // Genel koyulaştırma
            r = r * 0.9;
            g = g * 0.9;
            b = b * 0.9;
            
            // Kontrast azalt
            r = (r - 128) * 0.8 + 128;
            g = (g - 128) * 0.8 + 128;
            b = (b - 128) * 0.8 + 128;
            
            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
    }

    applyRainyFilterForExport(data, width, height) {
        // Önce orijinal renk ayarlamalarını uygula (soğuk, nemli atmosfer)
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Soğuk tonlar (mavi artır, kırmızı azalt)
            r = r * 0.8;
            g = g * 0.9;
            b = b * 1.1;
            
            // Genel koyulaştırma (yağmurlu hava)
            r = r * 0.85;
            g = g * 0.85;
            b = b * 0.85;
            
            // Saturation azalt (gri tonlar)
            const gray = (r + g + b) / 3;
            r = r * 0.7 + gray * 0.3;
            g = g * 0.7 + gray * 0.3;
            b = b * 0.7 + gray * 0.3;
            
            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
    }

    applySnowyFilterForExport(data, width, height) {
        // Önce soğuk hava efekti uygula
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Soğuk tonlar (mavi artır)
            r = r * 0.9;
            g = g * 0.95;
            b = b * 1.1;
            
            // Genel parlaklık azalt (karlı hava)
            r = r * 0.9;
            g = g * 0.9;
            b = b * 0.9;
            
            // Kar yansıması efekti (beyaz tonları artır)
            const brightness = (r + g + b) / 3;
            if (brightness > 150) {
                r = r * 1.1;
                g = g * 1.1;
                b = b * 1.1;
            }
            
            // Sis efekti (kontrast azalt)
            r = (r - 128) * 0.8 + 128;
            g = (g - 128) * 0.8 + 128;
            b = (b - 128) * 0.8 + 128;
            
            // Parlak ve koyu alanları yumuşat
            if (brightness > 180) {
                r = r * 0.9 + 128 * 0.1;
                g = g * 0.9 + 128 * 0.1;
                b = b * 0.9 + 128 * 0.1;
            } else if (brightness < 80) {
                r = r * 1.1 + 128 * 0.1;
                g = g * 1.1 + 128 * 0.1;
                b = b * 1.1 + 128 * 0.1;
            }
            
            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
    }

    applyFoggyFilterForExport(data) {
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Desaturation (gri tonuna çekme)
            const gray = (r + g + b) / 3;
            r = r * 0.4 + gray * 0.6;
            g = g * 0.4 + gray * 0.6;
            b = b * 0.4 + gray * 0.6;
            
            // Hafif beyazlatma
            r = r + 20;
            g = g + 20;
            b = b + 20;
            
            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
    }

    applySunsetFilterForExport(data) {
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Turuncu/kırmızı tonları artır
            r = r * 1.2;
            g = g * 1.1;
            b = b * 0.8;
            
            // Sıcak tonlar
            r = r * 1.1;
            g = g * 1.05;
            b = b * 0.9;
            
            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
    }

    applyNightFilterForExport(data) {
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Luminance hesapla
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            
            // Siyah-beyaz dönüşüm
            const bw = luminance;
            r = bw;
            g = bw;
            b = bw;
            
            // Kontrast artır
            r = (r - 128) * 1.3 + 128;
            g = (g - 128) * 1.3 + 128;
            b = (b - 128) * 1.3 + 128;
            
            // Genel koyulaştırma
            r = r * 0.8;
            g = g * 0.8;
            b = b * 0.8;
            
            // Beyaz tonları artır (daha beyaz yap)
            if (bw > 150) {
                r = Math.min(255, r * 1.2);
                g = Math.min(255, g * 1.2);
                b = Math.min(255, b * 1.2);
            }
            
            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
    }

    // TEXTURE OVERLAY SİSTEMİ
    
    // Hangi filtrelerin texture efekti olduğunu belirle
    hasTextureEffect(filterType) {
        return ['night', 'snowy', 'foggy', 'rainy'].includes(filterType);
    }

    // Belirli bir fotoğrafın filtrelerini yükle
    loadImageFilters(imageIndex) {
        if (this.imageFilters[imageIndex]) {
            // Filtreleri yükle
            this.activeFilters.clear();
            this.activeFilters = new Set(this.imageFilters[imageIndex].activeFilters);
            
            // Texture'ları yükle
            this.activeTextures.clear();
            this.activeTextures = new Set(this.imageFilters[imageIndex].activeTextures);
            
            // Filtreleri uygula
            this.applyColorFilters();
        } else {
            // Yeni fotoğraf için filtreleri temizle
            this.activeFilters.clear();
            this.activeTextures.clear();
            
            // Orijinal resmi göster
            this.resetToOriginalImage();
        }
        
        // UI'yi güncelle - bu çok önemli!
        this.updateFilterUI();
    }

    // Orijinal resmi geri yükle (filtre olmadan)
    resetToOriginalImage() {
        if (this.originalImageData) {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = this.originalImageData.width;
            tempCanvas.height = this.originalImageData.height;
            
            tempCtx.putImageData(this.originalImageData, 0, 0);
            
            const originalImage = new Image();
            originalImage.onload = () => {
                this.image = originalImage;
                this.redraw();
            };
            originalImage.src = tempCanvas.toDataURL('image/jpeg', 0.9);
        }
    }

    // Filtre UI'ını güncelle (mevcut fotoğrafın filtrelerine göre)
    updateFilterUI() {
        console.log('🔄 updateFilterUI çağrıldı, mevcut fotoğraf:', this.currentImageIndex);
        
        if (this.isMultiImageMode && this.currentImageIndex >= 0 && this.imageFilters[this.currentImageIndex]) {
            const currentFilters = this.imageFilters[this.currentImageIndex];
            console.log('📋 Mevcut filtreler:', currentFilters.activeFilters);
            
            // Tüm radio button'ları temizle
            document.querySelectorAll('input[data-filter]').forEach(radio => {
                radio.checked = false;
            });
            
            // Mevcut filtreleri işaretle ve change event'ini tetikle
            currentFilters.activeFilters.forEach(filterType => {
                const radio = document.querySelector(`input[data-filter="${filterType}"]`);
                if (radio) {
                    radio.checked = true;
                    console.log('✅ Filtre işaretlendi:', filterType);
                    
                    // Change event'ini manuel olarak tetikle
                    const changeEvent = new Event('change', { bubbles: true });
                    radio.dispatchEvent(changeEvent);
                }
            });
        } else {
            // Tek fotoğraf modunda veya filtre yoksa tüm radio button'ları temizle
            console.log('🧹 Tüm filtreler temizleniyor');
            document.querySelectorAll('input[data-filter]').forEach(radio => {
                radio.checked = false;
            });
            
            // Filtreleri de temizle
            this.activeFilters.clear();
            this.activeTextures.clear();
            this.resetToOriginalImage();
        }
    }

    // Ana texture overlay metodu
    applyTextureOverlays(ctx, width, height) {
        this.activeTextures.forEach(textureType => {
            switch(textureType) {
                case 'night':
                    this.addStarTexture(ctx, width, height);
                    break;
                case 'snowy':
                    this.addSnowTexture(ctx, width, height);
                    break;
                case 'foggy':
                    this.addFogTexture(ctx, width, height);
                    break;
                case 'rainy':
                    this.addRainTexture(ctx, width, height);
                    break;
            }
        });
    }

    // 🌙 GECE ATMOSFERİ (sadece renk, yıldız yok)
    addStarTexture(ctx, width, height) {
        ctx.save();
        
        // Sadece hafif gece atmosferi (yıldız yok) - daha düşük opaklık
        const nightAtmosphere = ctx.createLinearGradient(0, 0, 0, height);
        nightAtmosphere.addColorStop(0, 'rgba(20, 20, 30, 0.02)'); // Üst kısım çok hafif
        nightAtmosphere.addColorStop(0.5, 'rgba(15, 15, 25, 0.015)'); // Orta kısım
        nightAtmosphere.addColorStop(1, 'rgba(10, 10, 20, 0.03)'); // Alt kısım
        ctx.fillStyle = nightAtmosphere;
        ctx.fillRect(0, 0, width, height);
        
        ctx.restore();
    }

    // ❄️ KAR TEXTURE
    addSnowTexture(ctx, width, height) {
        ctx.save();
        
        // 1. YOĞUN KAR TANELERİ (arka plan) - Gerçekçi boyut ve yoğunluk
        const denseSnowCount = Math.floor((width * height) / 3000); // Daha az yoğun
        for (let i = 0; i < denseSnowCount; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const baseSize = Math.random() * 1.2 + 0.5; // Daha küçük ve gerçekçi
            const opacity = Math.random() * 0.4 + 0.2; // Daha hafif
            
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.beginPath();
            
            // Düzensiz kar tanesi - küçük taneler için basit organik şekil
            const points = 6 + Math.floor(Math.random() * 4); // 6-9 nokta
            ctx.moveTo(x + baseSize, y);
            
            for (let j = 1; j <= points; j++) {
                const angle = (j * 2 * Math.PI) / points;
                const radiusVariation = 0.7 + Math.random() * 0.6; // %70-130 boyut varyasyonu
                const radius = baseSize * radiusVariation;
                const pointX = x + Math.cos(angle) * radius;
                const pointY = y + Math.sin(angle) * radius;
                ctx.lineTo(pointX, pointY);
            }
            ctx.closePath();
            ctx.fill();
        }
        
        // 2. ORTA BOYUT KAR TANELERİ - Gerçekçi boyut
        const mediumSnowCount = Math.floor((width * height) / 8000); // Daha az yoğun
        for (let i = 0; i < mediumSnowCount; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const baseSize = Math.random() * 2.5 + 1.5; // Daha küçük
            const opacity = Math.random() * 0.6 + 0.3; // Daha hafif
            
            // Ana organik kar tanesi
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.beginPath();
            
            // Daha karmaşık organik şekil
            const points = 8 + Math.floor(Math.random() * 6); // 8-13 nokta
            const angleStep = (2 * Math.PI) / points;
            
            for (let j = 0; j < points; j++) {
                const angle = j * angleStep + (Math.random() - 0.5) * 0.3; // Açı varyasyonu
                const radiusVariation = 0.5 + Math.random() * 0.8; // %50-130 boyut varyasyonu
                const radius = baseSize * radiusVariation;
                
                // Bezier eğrilerle yumuşak geçişler
                const pointX = x + Math.cos(angle) * radius;
                const pointY = y + Math.sin(angle) * radius;
                
                if (j === 0) {
                    ctx.moveTo(pointX, pointY);
                } else {
                    // Önceki noktadan smooth geçiş
                    const prevAngle = (j-1) * angleStep + (Math.random() - 0.5) * 0.3;
                    const prevRadius = baseSize * (0.5 + Math.random() * 0.8);
                    const controlX = x + Math.cos(prevAngle + angleStep/2) * (prevRadius + radius) * 0.3;
                    const controlY = y + Math.sin(prevAngle + angleStep/2) * (prevRadius + radius) * 0.3;
                    
                    ctx.quadraticCurveTo(controlX, controlY, pointX, pointY);
                }
            }
            ctx.closePath();
            ctx.fill();
            
            // Hafif blur efekti - organik halo
            ctx.fillStyle = `rgba(245, 250, 255, ${opacity * 0.2})`;
            ctx.beginPath();
            
            for (let j = 0; j < points; j++) {
                const angle = j * angleStep;
                const haloRadius = baseSize * 1.8 * (0.8 + Math.random() * 0.4);
                const haloX = x + Math.cos(angle) * haloRadius;
                const haloY = y + Math.sin(angle) * haloRadius;
                
                if (j === 0) {
                    ctx.moveTo(haloX, haloY);
                } else {
                    ctx.lineTo(haloX, haloY);
                }
            }
            ctx.closePath();
            ctx.fill();
        }
        
        // 3. BÜYÜK KAR TANELERİ (ön plan) - Gerçekçi boyut
        const largeSnowCount = Math.floor((width * height) / 20000); // Daha az yoğun
        for (let i = 0; i < largeSnowCount; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const baseSize = Math.random() * 3.5 + 2.5; // Daha küçük
            const opacity = Math.random() * 0.7 + 0.4; // Daha hafif
            
            // Ana büyük organik kar tanesi
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.beginPath();
            
            // Çok düzensiz, doğal kar tanesi şekli
            const mainPoints = 10 + Math.floor(Math.random() * 8); // 10-17 nokta
            const angleStep = (2 * Math.PI) / mainPoints;
            
            // İlk nokta
            let firstX, firstY;
            
            for (let j = 0; j < mainPoints; j++) {
                const baseAngle = j * angleStep;
                const angleNoise = (Math.random() - 0.5) * 0.6; // Büyük açı varyasyonu
                const angle = baseAngle + angleNoise;
                
                // Çok değişken radius - doğal düzensizlik
                const radiusBase = 0.3 + Math.random() * 1.2; // %30-150 varyasyon
                const radiusNoise = (Math.random() - 0.5) * 0.4;
                const radius = baseSize * (radiusBase + radiusNoise);
                
                const pointX = x + Math.cos(angle) * radius;
                const pointY = y + Math.sin(angle) * radius;
                
                if (j === 0) {
                    ctx.moveTo(pointX, pointY);
                    firstX = pointX;
                    firstY = pointY;
                } else {
                    // Organik eğriler - kontrolsüz Bezier
                    const prevAngle = ((j-1) * angleStep) + (Math.random() - 0.5) * 0.6;
                    const controlDistance = baseSize * (0.2 + Math.random() * 0.6);
                    const controlAngle = (baseAngle + prevAngle) / 2 + (Math.random() - 0.5) * 1.0;
                    
                    const controlX = x + Math.cos(controlAngle) * controlDistance;
                    const controlY = y + Math.sin(controlAngle) * controlDistance;
                    
                    ctx.quadraticCurveTo(controlX, controlY, pointX, pointY);
                }
            }
            
            // Şekli kapatmak için son noktayı ilk noktaya bağla
            const finalControlAngle = Math.random() * 2 * Math.PI;
            const finalControlDistance = baseSize * (0.2 + Math.random() * 0.4);
            const finalControlX = x + Math.cos(finalControlAngle) * finalControlDistance;
            const finalControlY = y + Math.sin(finalControlAngle) * finalControlDistance;
            
            ctx.quadraticCurveTo(finalControlX, finalControlY, firstX, firstY);
            ctx.closePath();
            ctx.fill();
            
            // Detaylı kar kristali - gerçekçi 6 noktalı yapı
            if (Math.random() < 0.5) {
                ctx.strokeStyle = `rgba(230, 240, 255, ${opacity * 0.8})`;
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                
                // 6 ana kol
                for (let angle = 0; angle < 6; angle++) {
                    const rad = (angle * 60) * Math.PI / 180;
                    const mainLength = baseSize * 0.9;
                    
                    // Ana çizgi
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + Math.cos(rad) * mainLength, y + Math.sin(rad) * mainLength);
                    
                    // Her ana kol için yan dallar
                    for (let branch = 0.3; branch <= 0.7; branch += 0.4) {
                        const branchX = x + Math.cos(rad) * mainLength * branch;
                        const branchY = y + Math.sin(rad) * mainLength * branch;
                        const branchLength = baseSize * 0.3;
                        
                        // Sol dal
                        const leftAngle = rad + Math.PI / 4;
                        ctx.moveTo(branchX, branchY);
                        ctx.lineTo(branchX + Math.cos(leftAngle) * branchLength, 
                                  branchY + Math.sin(leftAngle) * branchLength);
                        
                        // Sağ dal
                        const rightAngle = rad - Math.PI / 4;
                        ctx.moveTo(branchX, branchY);
                        ctx.lineTo(branchX + Math.cos(rightAngle) * branchLength, 
                                  branchY + Math.sin(rightAngle) * branchLength);
                    }
                }
                ctx.stroke();
            }
            
            // Organik soft glow efekti
            const glowSize = baseSize * (2.0 + Math.random() * 1.0); // Değişken glow boyutu
            const glowOpacity = opacity * (0.08 + Math.random() * 0.05);
            
            // Düzensiz glow gradient
            const glowOffsetX = (Math.random() - 0.5) * baseSize * 0.4;
            const glowOffsetY = (Math.random() - 0.5) * baseSize * 0.4;
            const glowGradient = ctx.createRadialGradient(
                x + glowOffsetX, y + glowOffsetY, 0,
                x, y, glowSize
            );
            glowGradient.addColorStop(0, `rgba(255, 255, 255, ${glowOpacity})`);
            glowGradient.addColorStop(0.7, `rgba(245, 250, 255, ${glowOpacity * 0.6})`);
            glowGradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
            
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(x, y, glowSize, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 4. ÇOK BÜYÜK BULANIK TANELER (kameraya çok yakın, odak dışı efekti)
        const blurrySnowCount = Math.floor((width * height) / 60000); // Daha az yoğun
        for (let i = 0; i < blurrySnowCount; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const baseSize = Math.random() * 8 + 4; // Daha küçük
            const opacity = Math.random() * 0.15 + 0.03; // Daha hafif
            
            // Organik bulanık kar tanesi - düzensiz gradient
            const offsetX = (Math.random() - 0.5) * baseSize * 0.3; // Merkez kayması
            const offsetY = (Math.random() - 0.5) * baseSize * 0.3;
            const gradientCenterX = x + offsetX;
            const gradientCenterY = y + offsetY;
            
            // Düzensiz boyutlar
            const radiusX = baseSize * (0.8 + Math.random() * 0.4); // X ekseni
            const radiusY = baseSize * (0.8 + Math.random() * 0.4); // Y ekseni
            const maxRadius = Math.max(radiusX, radiusY);
            
            const gradient = ctx.createRadialGradient(
                gradientCenterX, gradientCenterY, 0, 
                gradientCenterX, gradientCenterY, maxRadius
            );
            gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
            gradient.addColorStop(0.3, `rgba(255, 255, 255, ${opacity * 0.8})`);
            gradient.addColorStop(0.6, `rgba(250, 252, 255, ${opacity * 0.5})`);
            gradient.addColorStop(0.9, `rgba(248, 250, 255, ${opacity * 0.2})`);
            gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
            
            ctx.fillStyle = gradient;
            
            // Organik elips şekli
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.random() * Math.PI * 2); // Rastgele rotasyon
            ctx.scale(radiusX / maxRadius, radiusY / maxRadius); // Oval şekil
            ctx.beginPath();
            ctx.arc(0, 0, maxRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        // 5. ATMOSFERIK KAR EFEKTİ (genel kar yoğunluğu) - Daha hafif
        if (Math.random() < 0.6) { // %60 şans
            const atmosphereOpacity = Math.random() * 0.03 + 0.01; // Daha hafif
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, `rgba(250, 252, 255, ${atmosphereOpacity * 0.5})`);
            gradient.addColorStop(0.5, `rgba(248, 250, 255, ${atmosphereOpacity})`);
            gradient.addColorStop(1, `rgba(245, 248, 255, ${atmosphereOpacity * 0.7})`);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
        }
        
        // 6. RASTGELE KAR RÜZGARI EFEKTİ - Daha hafif
        if (Math.random() < 0.2) { // %20 şans
            const windSnowCount = Math.floor((width * height) / 25000); // Daha az yoğun
            for (let i = 0; i < windSnowCount; i++) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const length = Math.random() * 6 + 3; // Daha kısa
                const angle = Math.random() * 0.3 + 0.1; // Hafif eğik rüzgar
                const opacity = Math.random() * 0.3 + 0.1; // Daha hafif
                
                ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                ctx.lineWidth = Math.random() * 1.0 + 0.5; // Daha ince
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
                ctx.stroke();
            }
        }
        
        // 7. BASİT KAR TANELERİ - Gerçekçi boyut ve yoğunluk
        const testSnowCount = Math.floor((width * height) / 12000); // Daha az yoğun
        for (let i = 0; i < testSnowCount; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * 1.5 + 0.8; // Daha küçük
            const opacity = Math.random() * 0.5 + 0.3; // Daha hafif
            
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }

    // 🌫️ SİS TEXTURE
    addFogTexture(ctx, width, height) {
        ctx.save();
        
        // Çoklu sis katmanları
        for (let layer = 0; layer < 3; layer++) {
            const opacity = 0.1 + layer * 0.05;
            const yOffset = height * (0.3 + layer * 0.2);
            
            // Gradient sis bulutları
            for (let i = 0; i < 5; i++) {
                const centerX = (width / 6) * (i + 1) + (Math.random() - 0.5) * 100;
                const centerY = yOffset + (Math.random() - 0.5) * 50;
                const radius = width * 0.2 + Math.random() * 100;
                
                const gradient = ctx.createRadialGradient(
                    centerX, centerY, 0,
                    centerX, centerY, radius
                );
                gradient.addColorStop(0, `rgba(220, 220, 220, ${opacity})`);
                gradient.addColorStop(0.5, `rgba(200, 200, 200, ${opacity * 0.5})`);
                gradient.addColorStop(1, 'rgba(200, 200, 200, 0)');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        ctx.restore();
    }

    // 🌧️ YAĞMUR TEXTURE
    addRainTexture(ctx, width, height) {
        const rainDrops = Math.floor((width * height) / 8000);
        
        ctx.save();
        
        for (let i = 0; i < rainDrops; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const length = Math.random() * 20 + 10;
            const opacity = Math.random() * 0.6 + 0.2;
            const thickness = Math.random() * 1.5 + 0.5;
            
            // Yağmur damlası çizgisi
            ctx.strokeStyle = `rgba(180, 200, 220, ${opacity})`;
            ctx.lineWidth = thickness;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - 3, y + length); // Hafif eğik
            ctx.stroke();
        }
        
        ctx.restore();
    }





    // Basit etiket atama sistemi
    assignLabelToCurrentAnnotation(label = null, color = null) {
        console.log('🔍 assignLabelToCurrentAnnotation çağrıldı:', { 
            quickLabelMode: this.quickLabelMode, 
            activeLabel: this.activeLabel,
            currentAnnotation: this.currentAnnotation 
        });
        
        if (!this.currentAnnotation) {
            console.log('❌ currentAnnotation yok!');
            return;
        }

        if (this.quickLabelMode) {
            // Hızlı etiket modu: Önceki etiketin ismini direkt al
            if (this.activeLabel) {
                // Önceki etiketin ismini kullan
                this.currentAnnotation.label = this.activeLabel;
                // Otomatik farklı renk ata
                this.currentAnnotation.color = this.getNextAutoColor();
                // createNewAnnotation zaten annotations listesine ekliyor
                this.currentAnnotation = null;
                this.updateAnnotationList();
                this.redraw();
                
                // Yeni annotation'ı seçili ve focuslanmış yap
                this.selectedAnnotation = this.annotations[this.annotations.length - 1];
                this.focusedAnnotation = this.annotations[this.annotations.length - 1];
                this.showSuccess(`"${this.activeLabel}" etiketi eklendi!`);
            } else {
                // Aktif etiket yoksa modal göster
                this.showNewLabelModal();
            }
        } else {
            // Normal mod: Her seferinde etiket seç - modal göster
            this.showNewLabelModal();
        }
    }

    // Modal'dan gelen etiket ataması
    assignLabelFromModal(label, color) {
        if (!this.currentAnnotation) {
            console.log('❌ currentAnnotation yok!');
            return;
        }

        console.log('✅ assignLabelFromModal çağrıldı:', { 
            label, 
            color, 
            currentAnnotationBefore: { ...this.currentAnnotation } 
        });

        // Etiketi ata
        console.log('🔍 Etiket atanmadan önce:', { 
            currentAnnotationLabel: this.currentAnnotation.label,
            newLabel: label,
            newColor: color 
        });
        
        this.currentAnnotation.label = label;
        this.currentAnnotation.color = color;
        
        console.log('✅ Etiket atandı - currentAnnotation.label:', this.currentAnnotation.label);
        console.log('✅ Etiket atandı - currentAnnotation.color:', this.currentAnnotation.color);
        
        // Etiket pozisyonunu sabit tutmak için labelPosition ekle
        if (!this.currentAnnotation.labelPosition) {
            // Sol üst köşe pozisyonunu hesapla
            let leftTopPoint;
            if (this.currentAnnotation.points && this.currentAnnotation.points.length > 0) {
                const xs = this.currentAnnotation.points.map(p => p.x);
                const ys = this.currentAnnotation.points.map(p => p.y);
                const minX = Math.min(...xs);
                const minY = Math.min(...ys);
                leftTopPoint = { x: minX, y: minY - 20 }; // 20px yukarı
            } else {
                leftTopPoint = { x: this.currentAnnotation.x, y: this.currentAnnotation.y - 20 }; // 20px yukarı
            }
            this.currentAnnotation.labelPosition = leftTopPoint;
        }
        
        console.log('✅ Etiket atandı:', this.currentAnnotation);
        
        // Etiket listesine ekle
        if (!this.availableLabels.includes(label)) {
            this.availableLabels.push(label);
        }
        
        // Annotation'ı tamamla - direkt listeye ekle
        this.annotations.push(this.currentAnnotation);
        console.log('✅ Yeni annotation oluşturuldu:', this.currentAnnotation);
        
        this.currentAnnotation = null;
        this.updateAnnotationList();
        this.updateLabelListFromAnnotations();
        this.redraw();
        
        // Yeni annotation'ı seçili yap
        this.selectedAnnotation = this.annotations[this.annotations.length - 1];
        
        // Projeyi kaydet
        this.isSaved = false; // Yeni annotation eklendi, kaydedilmemiş
        this.saveProject();
        
        // Database'e de kaydet (WebSocket bildirimi için)
        console.log('🔵 Etiket modal\'dan eklendi, database\'e kaydediliyor...', this.currentAnnotation);
        this.saveAllAnnotationsToDatabase();
        
        this.showSuccess(`"${label}" etiketi eklendi!`);
    }

    // Basit etiket seçimi - modal olmadan
    showSimpleLabelSelection() {
        if (this.availableLabels.length === 0) {
            // Hiç etiket yok, hızlı etiket ekleme
            const labelName = prompt('Etiket adı girin:', 'yeni_etiket');
            if (labelName && labelName.trim()) {
                this.addNewLabel(labelName.trim());
                this.currentAnnotation.label = labelName.trim();
                this.currentAnnotation.color = this.getNextAutoColor();
                this.annotations.push(this.currentAnnotation);
                this.currentAnnotation = null;
                this.updateAnnotationList();
                this.redraw();
                
                // Database'e kaydet (WebSocket bildirimi için)
                console.log('🔵 Hızlı etiket eklendi, database\'e kaydediliyor...', labelName.trim());
                this.saveAllAnnotationsToDatabase();
                
                this.showSuccess(`"${labelName}" etiketi eklendi!`);
            } else {
                this.currentAnnotation = null;
                this.redraw();
            }
        } else {
            // Mevcut etiketlerden seçim yap
            const labelOptions = this.availableLabels.map((label, index) => 
                `${index + 1}. ${label}`
            ).join('\n');
            
            const choice = prompt(`Etiket seçin:\n\n${labelOptions}\n\n0. Yeni etiket ekle\n\nNumara girin:`);
            const choiceNum = parseInt(choice);
            
            if (choiceNum > 0 && choiceNum <= this.availableLabels.length) {
                // Mevcut etiket seçildi
                const selectedLabel = this.availableLabels[choiceNum - 1];
                this.currentAnnotation.label = selectedLabel;
                this.currentAnnotation.color = this.getNextAutoColor();
                this.annotations.push(this.currentAnnotation);
                this.currentAnnotation = null;
                this.updateAnnotationList();
                this.redraw();
                
                // Database'e kaydet (WebSocket bildirimi için)
                console.log('🔵 Etiket basit seçimden eklendi, database\'e kaydediliyor...', selectedLabel);
                this.saveAllAnnotationsToDatabase();
                
                this.showSuccess(`"${selectedLabel}" etiketi eklendi!`);
            } else if (choiceNum === 0) {
                // Yeni etiket ekle
                const labelName = prompt('Yeni etiket adı girin:', 'yeni_etiket');
                if (labelName && labelName.trim()) {
                    this.addNewLabel(labelName.trim());
                    this.currentAnnotation.label = labelName.trim();
                    this.currentAnnotation.color = this.getNextAutoColor();
                    this.annotations.push(this.currentAnnotation);
                    this.currentAnnotation = null;
                    this.updateAnnotationList();
                    this.redraw();
                    
                    // Database'e kaydet (WebSocket bildirimi için)
                    console.log('🔵 Yeni etiket basit seçimden eklendi, database\'e kaydediliyor...', labelName.trim());
                    this.saveAllAnnotationsToDatabase();
                    
                    this.showSuccess(`"${labelName}" etiketi eklendi!`);
                } else {
                    this.currentAnnotation = null;
                    this.redraw();
                }
            } else {
                // Geçersiz seçim
                this.currentAnnotation = null;
                this.redraw();
            }
        }
    }

    setActiveLabel(label) {
        const transformedLabel = this.transformLabelName(label);
        this.activeLabel = transformedLabel;
        this.updateLabelList();
        this.showSuccess(`Aktif etiket: "${transformedLabel}"`);
        
        // Eğer mevcut bir annotation varsa ve etiket atanmamışsa, otomatik ata
        if (this.currentAnnotation && !this.currentAnnotation.label) {
            this.currentAnnotation.label = transformedLabel;
            // Seçili rengi kullan, yoksa otomatik renk
            this.currentAnnotation.color = this.selectedColor || this.getNextAutoColor();
            this.updateAnnotationList();
            this.redraw();
            console.log(`Etiket otomatik atandı: ${label}`);
            
            // Etiket atandı, annotation'ı seçili yap
            this.selectedAnnotation = this.currentAnnotation;
            
            // Database'e kaydet (WebSocket bildirimi için)
            console.log('🔵 Etiket aktif etiket olarak atandı, database\'e kaydediliyor...', transformedLabel);
            this.saveAllAnnotationsToDatabase();
        }
    }

    // Basit etiket ekleme fonksiyonu
    addNewLabel(labelName) {
        if (!labelName || labelName.trim() === '') return false;
        
        const cleanLabel = labelName.trim();
        
        // Aynı etiket var mı kontrol et
        if (this.availableLabels.includes(cleanLabel)) {
            this.showWarning(`"${cleanLabel}" etiketi zaten mevcut!`);
            return false;
        }
        
        // Etiketi ekle
        this.availableLabels.push(cleanLabel);
        this.updateLabelList();
        
        // Yeni eklenen etiketi aktif yap
        this.setActiveLabel(cleanLabel);
        
        return true;
    }

    updateQuickModeUI() {
        const toggle = document.getElementById('quickLabelModeToggle');
        const labelText = toggle.parentElement.querySelector('span');
        
    }


    updateLabelList() {
        const container = document.getElementById('labelList');
        container.innerHTML = '';

        if (this.availableLabels.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-state';
            emptyMessage.innerHTML = `
                <div class="empty-state-content">
                    <i class="fas fa-tags" style="font-size: 32px; color: #7f8c8d; margin-bottom: 12px;"></i>
                    <h4 style="color: #95a5a6; margin: 0 0 6px 0;">Etiket Bulunamadı</h4>
                    <p style="color: #7f8c8d; margin: 0; font-size: 12px;">Henüz hiç etiket oluşturulmamış. İlk etiketinizi oluşturun.</p>
                </div>
            `;
            container.appendChild(emptyMessage);
            return;
        }

        this.availableLabels.forEach((label, index) => {
            const labelItem = document.createElement('div');
            labelItem.className = 'label-item';
            
            // Aktif etiket kontrolü
            if (this.activeLabel === label) {
                labelItem.classList.add('active');
            }

            // Etiket rengini al (varsayılan renkler)
            const colors = ['#2ecc71', '#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
            const color = colors[index % colors.length];

            labelItem.innerHTML = `
                <div class="label-info">
                    <div class="label-color-indicator" style="background-color: ${color}"></div>
                    <div class="label-name">${label}</div>
                </div>
                <div class="label-actions">
                    <button class="label-delete-btn" title="Etiketi sil">×</button>
                </div>
            `;

            // Tıklama olayı
            labelItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('label-delete-btn')) {
                    this.setActiveLabel(label);
                }
            });

            // Silme butonu
            const deleteBtn = labelItem.querySelector('.label-delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteLabel(label);
            });

            container.appendChild(labelItem);
        });
    }

    // Available labels'ı güncelle (updateLabelList ile aynı işlevi görür)
    updateAvailableLabels() {
        this.updateLabelList();
    }

    // Belirli bir index'teki resmi yükle
    loadImageFromIndex(index) {
        if (this.croppedImages && index >= 0 && index < this.croppedImages.length) {
            const imageData = this.croppedImages[index];
            if (imageData && imageData.image) {
                this.image = imageData.image;
                this.currentImageIndex = index;
                this.redraw();
                
                // Önce state'i temizle
                this.selectWeatherFilter('none', false);
                
                // Weather filter'ı yükle
                this.loadWeatherFilter();
                
                console.log(`✅ Resim yüklendi: ${index + 1}/${this.croppedImages.length}`);
            }
        }
    }

    // Annotation silindikten sonra etiket listesini güncelle
    updateLabelListAfterDeletion(deletedLabel) {
        if (!deletedLabel) return;
        
        // Silinen etiketin başka annotation'larda kullanılıp kullanılmadığını kontrol et
        const isLabelStillUsed = this.annotations.some(ann => ann.label === deletedLabel);
        
        // Eğer etiket artık kullanılmıyorsa, etiket listesinden de sil
        if (!isLabelStillUsed) {
            this.availableLabels = this.availableLabels.filter(label => label !== deletedLabel);
            
            // Eğer silinen etiket aktif etiketse, aktif etiketi temizle
            if (this.activeLabel === deletedLabel) {
                this.activeLabel = this.availableLabels.length > 0 ? this.availableLabels[0] : null;
            }
            
            // Etiket listesini güncelle
            this.updateLabelList();
            
            this.showSuccess(`"${deletedLabel}" etiketi artık kullanılmadığı için listeden silindi.`);
        }
    }

    // Etiket kilitleme fonksiyonları
    isLabelLocked(label) {
        // Bu etiketin tüm annotation'larının kilitli olup olmadığını kontrol et
        const labelAnnotations = this.annotations.filter(ann => ann.label === label);
        if (labelAnnotations.length === 0) return false;
        
        // Eğer annotation'larda locked özelliği yoksa, false döndür
        return labelAnnotations.every(ann => ann.locked === true);
    }

    toggleLabelLock(label) {
        // Bu etiketin tüm annotation'larını bul
        const labelAnnotations = this.annotations.filter(ann => ann.label === label);
        
        if (labelAnnotations.length === 0) {
            this.showWarning(`"${label}" etiketi için annotation bulunamadı.`);
            return;
        }
        
        // Tüm annotation'ların kilit durumunu kontrol et
        const allLocked = labelAnnotations.every(ann => ann.locked === true);
        const newLockState = !allLocked;
        
        // Tüm annotation'ları aynı kilit durumuna getir
        labelAnnotations.forEach(ann => {
            ann.locked = newLockState;
        });
        
        // Etiket listesini güncelle
        this.updateLabelList();
        
        // Canvas'ı yeniden çiz
        this.redraw();
        
        // Toast mesajı
        const message = newLockState ? `"${label}" etiketi kilitlendi` : `"${label}" etiketi kilidi açıldı`;
        this.showInfo(message);
    }

    updateLabelListFromAnnotations() {
        // Mevcut annotation'lardan kullanılan etiketleri topla
        const usedLabels = new Set();
        this.annotations.forEach(annotation => {
            if (annotation.label && annotation.label.trim() !== '') {
                usedLabels.add(annotation.label);
            }
        });
        
        // Kullanılmayan etiketleri temizle
        const oldAvailableLabels = [...this.availableLabels];
        this.availableLabels = this.availableLabels.filter(label => usedLabels.has(label));
        
        // Eğer aktif etiket artık kullanılmıyorsa, temizle
        if (this.activeLabel && !usedLabels.has(this.activeLabel)) {
            this.activeLabel = this.availableLabels.length > 0 ? this.availableLabels[0] : null;
        }
        
        // Etiket listesini güncelle
        this.updateLabelList();
        
        // Sidebar'daki etiket listesini güncelle
        this.updateSidebarLabelList();
        
        // Eğer etiketler silindiyse kullanıcıya bildir
        const removedLabels = oldAvailableLabels.filter(label => !usedLabels.has(label));
        if (removedLabels.length > 0) {
            console.log('Kullanılmayan etiketler temizlendi:', removedLabels);
        }
    }

    updateSidebarLabelList() {
        const labelListContainer = document.getElementById('labelList');
        if (!labelListContainer) return;

        // Mevcut listeyi temizle
        labelListContainer.innerHTML = '';

        if (this.availableLabels.length === 0) {
            // Etiket yoksa boş mesaj göster
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = 'Etiket Bulunamadı';
            labelListContainer.appendChild(emptyMessage);
            return;
        }

        // Her etiket için liste öğesi oluştur
        this.availableLabels.forEach(label => {
            const labelItem = document.createElement('div');
            labelItem.className = 'label-item';
            labelItem.innerHTML = `
                <span class="label-name">${label}</span>
                <button class="delete-btn" onclick="event.stopPropagation(); labelingTool.deleteLabel('${label}')" title="Etiketi Sil">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"></polyline>
                        <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                    </svg>
                </button>
            `;

            // Etiket seçimi için tıklama olayı
            labelItem.addEventListener('click', () => {
                this.selectLabelFromSidebar(label);
            });

            // Aktif etiket vurgulama
            if (label === this.activeLabel) {
                labelItem.classList.add('active');
            }

            labelListContainer.appendChild(labelItem);
        });
    }

    selectLabelFromSidebar(label) {
        // Sidebar'dan etiket seçimi
        this.activeLabel = label;
        this.updateSidebarLabelList(); // Aktif etiket vurgulaması için
        this.updateLabelList(); // Ana etiket listesini güncelle
        
        console.log('✅ Sidebar\'dan etiket seçildi:', label);
        this.showToast(`"${label}" etiketi seçildi`, 'success');
    }



    deleteLabel(labelToDelete) {
        // Onay alert'i göster
        const confirmDelete = confirm(`"${labelToDelete}" isimdeki tüm etiketler silinecektir, onaylıyor musunuz?`);
        
        if (!confirmDelete) {
            return; // Kullanıcı onaylamadıysa işlemi iptal et
        }

        // Silinecek annotation sayısını say
        const annotationsToDelete = this.annotations.filter(annotation => annotation.label === labelToDelete);
        const deleteCount = annotationsToDelete.length;

        console.log(`🗑️ Silinecek etiket: "${labelToDelete}", Toplam annotation sayısı: ${deleteCount}`);

        // Etiket listesinden çıkar
        this.availableLabels = this.availableLabels.filter(label => label !== labelToDelete);

        // Bu etiketle ilişkili TÜM annotationları sil (birden fazla varsa hepsini sil)
        this.annotations = this.annotations.filter(annotation => annotation.label !== labelToDelete);

        // Bu etiketle ilişkili kırpılmış görüntüleri sil
        this.croppedImages = this.croppedImages.filter(img => {
            const annotation = this.annotations.find(ann => ann.id === img.annotationId);
            return annotation && annotation.label !== labelToDelete;
        });

        // Eğer silinen etiket aktifse, yeni aktif etiket seç
        if (this.activeLabel === labelToDelete) {
            this.activeLabel = this.availableLabels.length > 0 ? this.availableLabels[0] : null;
        }

        // UI'yi güncelle
        this.updateLabelList();
        this.updateAnnotationList();
        this.redraw();

        // Database'e kaydet (WebSocket bildirimi için)
        console.log('🔵 Etiket silindi, database\'e kaydediliyor...', labelToDelete);
        this.saveAllAnnotationsToDatabase();

        // Bilgilendirme mesajı
        this.showSuccess(`"${labelToDelete}" etiketi silindi. (${deleteCount} adet annotation silindi)`);
    }



    async uploadAndLoadImage(file) {
        if (!file) return;
        
        try {
            console.log('📤 Dosya backend\'e yükleniyor:', file.name);
            this.showInfo('Dosya yükleniyor...');
            
            // FormData oluştur
            const formData = new FormData();
            formData.append('image', file);
            
            // Backend'e yükle  
            const response = await fetch(`${window.labelingAuth.baseURL}/api/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Dosya yüklendi:', result.file);
                
                // Yüklenen dosya bilgisiyle resmi yükle
                const serverPath = result.file.filePath; // `/uploads/timestamp_filename.jpg`
                const fullServerUrl = `${window.labelingAuth.baseURL}${serverPath}`;
                
                await this.loadImageFromServerPath(serverPath, result.file);
                
                this.showSuccess(`Dosya yüklendi: ${result.file.fileName}`);
                
                // Otomatik kaydet
                if (window.imageManager && window.imageManager.currentProject) {
                    this.saveProject();
                }
                
            } else {
                throw new Error(result.error || 'Dosya yükleme başarısız');
            }
            
        } catch (error) {
            console.error('❌ Dosya yükleme hatası:', error);
            this.showError('Dosya yükleme hatası: ' + error.message);
            
            // Fallback: Eski sistemi kullan
            this.loadSingleImage(file);
        }
    }

    async loadImageFromServerPath(serverPath, fileInfo) {
        console.log('📸 Server\'dan resim yükleniyor:', serverPath);
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                this.image = img;
                
                // Sunucudan gelen dosya bilgisini sakla
                this.image.name = fileInfo.fileName;
                this.image.filePath = serverPath;
                this.image.fullPath = serverPath;
                this.image.lastModified = Date.parse(fileInfo.uploadedAt) || Date.now();
                this.image.serverFile = fileInfo; // Server bilgilerini sakla
                
                this.isMultiImageMode = false;
                this.images = [];
                this.currentImageIndex = 0;
                this.hideImageList();
                
                this.initializeCoordinateSystem();
                this.resizeCanvas();
                
                // State'i temizle
                this.selectWeatherFilter('none', false);
                
                setTimeout(() => {
                    this.zoomToPhoto();
                    this.updateGridDisplay();
                    this.redraw();
                }, 50);
                
                this.saveOriginalImageData();
                
                console.log('✅ Server\'dan resim yüklendi:', {
                    name: fileInfo.fileName,
                    path: serverPath,
                    width: img.width,
                    height: img.height
                });
                
                resolve(img);
            };
            
            img.onerror = (error) => {
                console.error('❌ Server resim yükleme hatası:', error);
                reject(error);
            };
            
            // Server path'ini tam URL'ye çevir
            img.src = `${window.labelingAuth.baseURL}${serverPath}`;
        });
    }

    loadSingleImage(file) {
        if (!file) return;
        
        this.isMultiImageMode = false;
        this.images = [];
        this.currentImageIndex = 0;
        this.hideImageList();

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.image = img;
                
                // Dosya bilgisini sakla
                this.image.name = file.name;
                
                // File System Access API ile tam path almaya çalış
                let fullPath = file.name;
                if (file.webkitRelativePath) {
                    fullPath = file.webkitRelativePath;
                } else if (window.showOpenFilePicker && file.handle) {
                    // Modern browsers ile tam path
                    fullPath = file.handle.name;
                } else if (file.path) {
                    // Electron gibi desktop uygulamalarda
                    fullPath = file.path;
                }
                
                this.image.filePath = fullPath;
                this.image.fullPath = fullPath;
                this.image.lastModified = file.lastModified;
                
                console.log('📁 Dosya yolu bilgisi:', {
                    name: file.name,
                    filePath: fullPath,
                    webkitRelativePath: file.webkitRelativePath,
                    hasPath: !!file.path
                });
                
                this.initializeCoordinateSystem();
                
                // Canvas'ı boyutlandır ve resmi göster
                this.resizeCanvas();
                
                // State'i temizle
                this.selectWeatherFilter('none', false);
                
                // Kısa bir gecikme ile resmi ortala
                setTimeout(() => {
                    this.zoomToPhoto();
                    this.updateGridDisplay();
                    this.redraw(); // Resmi göster
                }, 50);
                
                // Orijinal resim verisini kaydet
                this.saveOriginalImageData();
                
                console.log('📸 Fotoğraf yüklendi:', {
                    name: file.name,
                    size: file.size,
                    lastModified: new Date(file.lastModified).toLocaleString()
                });
                
                // Eğer proje yüklendiyse ve aynı fotoğraf ise, etiketleri göster
                this.checkAndLoadProjectAnnotations(file);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    async loadImageFolder(files) {
        if (!files || files.length === 0) return;

        // Sadece resim dosyalarını filtrele
        const imageFiles = Array.from(files).filter(file => 
            file.type.startsWith('image/')
        );

        if (imageFiles.length === 0) {
            this.showWarning('Seçilen klasörde resim dosyası bulunamadı!');
            return;
        }

        // Yükleme işlemini başlat
        this.isLoading = true;
        this.loadingProgress = 0;
        this.totalImages = imageFiles.length;
        this.loadedImages = 0;
        this.cancelLoading = false;
        this.loadingStartTime = Date.now();

        this.isMultiImageMode = true;
        this.images = [];
        this.imageAnnotations = {};
        
        // Progress bar göster
        this.showLoadingProgress();
        
        try {
            // Sadece dosya listesi oluştur - hiçbir resim yükleme!
            this.initializeImageList(imageFiles);
            
            // Progress'i hemen 100% yap
            this.loadedImages = imageFiles.length;
            this.updateLoadingProgress();
            
            // Progress bar'ı kısa bir süre sonra kapat
            setTimeout(() => {
                this.hideLoadingProgress();
            }, 500);
            
            if (this.cancelLoading) {
                this.showInfo('Yükleme iptal edildi.');
                return;
            }
            
            // İlk resmi aktif yap (lazy loading ile yüklenecek)
        this.currentImageIndex = 0;
        this.showImageList();
            // İlk resmi lazy loading ile yükle
        this.switchToImage(0);
        
            this.showSuccess(`${this.totalImages} adet dosya listelendi! Resimler tıklandığında yüklenecek.`);
            
        } catch (error) {
            console.error('Klasör yükleme hatası:', error);
            this.showError('Klasör yüklenirken hata oluştu!');
        } finally {
            this.isLoading = false;
        }
    }

    loadImageFile(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    resolve({
                        image: img,
                        dataURL: e.target.result
                    });
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    loadImageFileOptimized(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Çok büyük resimleri otomatik olarak küçült
                    let processedImage = img;
                    let processedDataURL = e.target.result;
                    
                    // Maksimum boyut kontrolü (4K: 3840x2160)
                    const maxWidth = 3840;
                    const maxHeight = 2160;
                    
                    if (img.width > maxWidth || img.height > maxHeight) {
                        const resized = this.resizeImageIfNeeded(img, maxWidth, maxHeight);
                        processedImage = resized.image;
                        processedDataURL = resized.dataURL;
                    }
                    
                    // Thumbnail oluştur (150x150 piksel)
                    const thumbnail = this.createThumbnail(processedImage, 150, 150);
                    
                    resolve({
                        image: processedImage,
                        dataURL: processedDataURL,
                        thumbnail: thumbnail,
                        originalSize: { width: img.width, height: img.height },
                        processedSize: { width: processedImage.width, height: processedImage.height }
                    });
                };
                img.onerror = () => {
                    reject(new Error(`Resim yüklenemedi: ${file.name}`));
                };
                img.src = e.target.result;
            };
            reader.onerror = () => {
                reject(new Error(`Dosya okunamadı: ${file.name}`));
            };
            reader.readAsDataURL(file);
        });
    }

    resizeImageIfNeeded(img, maxWidth, maxHeight) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Oranları koruyarak boyutları hesapla
        let { width, height } = this.calculateThumbnailSize(img.width, img.height, maxWidth, maxHeight);
        
        canvas.width = width;
        canvas.height = height;
        
        // Resmi çiz
        ctx.drawImage(img, 0, 0, width, height);
        
        return {
            image: canvas,
            dataURL: canvas.toDataURL('image/jpeg', 0.9) // %90 kalite
        };
    }

    initializeImageList(imageFiles) {
        // Tüm resimler için placeholder oluştur (çok hızlı - sadece dosya bilgileri)
        this.images = imageFiles.map((file, index) => ({
            file: file,
            name: file.name,
            image: null,
            dataURL: null,
            thumbnail: null,
            index: index,
            loaded: false,
            thumbnailLoaded: false,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
        }));
        
        // Her resim için boş annotation ve filtre listesi oluştur
        imageFiles.forEach((file, index) => {
            this.imageAnnotations[index] = [];
            this.imageFilters[index] = {
                activeFilters: [],
                activeTextures: []
            };
        });
        
        // İlk UI güncellemesi
        this.updateImageList();
    }

    async loadFirstImage(file) {
        try {
            // İlk resmi tam olarak yükle
            const imageData = await this.loadImageFileOptimized(file);
            
            // İlk resim bilgilerini güncelle
            this.images[0].image = imageData.image;
            this.images[0].dataURL = imageData.dataURL;
            this.images[0].thumbnail = imageData.thumbnail;
            this.images[0].loaded = true;
            this.images[0].thumbnailLoaded = true;
            
            // İlk resmi aktif yap
            this.currentImageIndex = 0;
            this.image = imageData.image;
            
            // Cache'e ekle
            this.imageCache.set('image_0', imageData.image);
            
        } catch (error) {
            console.error(`İlk resim yükleme hatası (${file.name}):`, error);
            this.showWarning(`İlk resim yüklenemedi: ${file.name}`);
        }
    }

    async loadThumbnailLazy(imageData) {
        if (imageData.thumbnailLoaded) return;
        
        try {
            imageData.thumbnailLoaded = true; // İşlem başladı olarak işaretle
            
            const thumbnail = await this.loadImageThumbnailOnly(imageData.file);
            imageData.thumbnail = thumbnail.thumbnail;
            
            // UI'yi güncelle
            this.updateImageList();
            
        } catch (error) {
            console.error(`Thumbnail yükleme hatası (${imageData.name}):`, error);
            imageData.thumbnailLoaded = false; // Hata durumunda tekrar deneyebilsin
        }
    }

    loadImageThumbnailOnly(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Sadece küçük thumbnail oluştur (100x100 piksel)
                    const thumbnail = this.createThumbnail(img, 100, 100);
                    
                    resolve({
                        thumbnail: thumbnail
                    });
                };
                img.onerror = () => {
                    reject(new Error(`Resim yüklenemedi: ${file.name}`));
                };
                img.src = e.target.result;
            };
            reader.onerror = () => {
                reject(new Error(`Dosya okunamadı: ${file.name}`));
            };
            reader.readAsDataURL(file);
        });
    }

    createThumbnail(img, maxWidth, maxHeight) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Oranları koruyarak boyutları hesapla
        let { width, height } = this.calculateThumbnailSize(img.width, img.height, maxWidth, maxHeight);
        
        canvas.width = width;
        canvas.height = height;
        
        // Resmi çiz
        ctx.drawImage(img, 0, 0, width, height);
        
        return canvas.toDataURL('image/jpeg', 0.8); // JPEG formatında, %80 kalite
    }

    calculateThumbnailSize(originalWidth, originalHeight, maxWidth, maxHeight) {
        let width = originalWidth;
        let height = originalHeight;
        
        // Oranları koruyarak boyutları ayarla
        if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
        }
        
        if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
        }
        
        return { width: Math.round(width), height: Math.round(height) };
    }

    showLoadingProgress() {
        // Progress bar HTML'i oluştur
        const progressHTML = `
            <div id="loadingProgress" style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--bg-secondary);
                border: 1px solid var(--border-primary);
                border-radius: var(--radius-lg);
                padding: var(--spacing-xl);
                z-index: 2000;
                min-width: 400px;
                text-align: center;
                box-shadow: var(--shadow-lg);
            ">
                <div style="margin-bottom: var(--spacing-md);">
                    <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: var(--accent-primary);"></i>
                </div>
                <h3 style="color: var(--text-primary); margin-bottom: var(--spacing-md);">
                    <span id="loadingTitle">Resimler Yükleniyor...</span>
                </h3>
                <div style="
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-sm);
                    height: 8px;
                    margin-bottom: var(--spacing-sm);
                    overflow: hidden;
                ">
                    <div id="progressBar" style="
                        background: var(--accent-primary);
                        height: 100%;
                        width: 0%;
                        transition: width 0.3s ease;
                    "></div>
                </div>
                <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: var(--spacing-md);">
                    <div id="progressText">0 / 0 resim yüklendi</div>
                    <div id="progressDetails" style="font-size: 12px; margin-top: 4px; color: var(--text-muted);">
                        Hazırlanıyor...
                    </div>
                </div>
                <button id="cancelLoadingBtn" style="
                    background: var(--accent-error);
                    color: white;
                    border: none;
                    padding: var(--spacing-sm) var(--spacing-md);
                    border-radius: var(--radius-sm);
                    cursor: pointer;
                    font-size: 14px;
                ">
                    <i class="fas fa-times"></i> İptal Et
                </button>
            </div>
        `;
        
        // Progress bar'ı ekle
        document.body.insertAdjacentHTML('beforeend', progressHTML);
        
        // İptal butonu event listener'ı
        document.getElementById('cancelLoadingBtn').addEventListener('click', () => {
            this.cancelLoading = true;
        });
    }

    updateLoadingProgress() {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const progressDetails = document.getElementById('progressDetails');
        const loadingTitle = document.getElementById('loadingTitle');
        
        if (progressBar && progressText) {
            const percentage = (this.loadedImages / this.totalImages) * 100;
            progressBar.style.width = `${percentage}%`;
            progressText.textContent = `${this.loadedImages} / ${this.totalImages} dosya listelendi`;
            
            if (progressDetails) {
                const remaining = this.totalImages - this.loadedImages;
                if (remaining > 0) {
                    progressDetails.textContent = `${remaining} dosya kaldı`;
                } else {
                    progressDetails.textContent = 'Klasör hazır!';
                }
            }
            
            if (loadingTitle) {
                if (this.totalImages > 1000) {
                    loadingTitle.textContent = `Büyük Klasör Listeleniyor (${this.totalImages} dosya)...`;
                } else {
                    loadingTitle.textContent = 'Klasör Listeleniyor...';
                }
            }
        }
    }

    estimateRemainingTime(remaining) {
        if (this.loadedImages === 0) return null;
        
        const startTime = this.loadingStartTime || Date.now();
        const elapsed = Date.now() - startTime;
        const avgTimePerImage = elapsed / this.loadedImages;
        const estimatedRemaining = Math.round((remaining * avgTimePerImage) / 1000);
        
        if (estimatedRemaining < 60) {
            return `~${estimatedRemaining}s`;
        } else {
            const minutes = Math.round(estimatedRemaining / 60);
            return `~${minutes}dk`;
        }
    }

    hideLoadingProgress() {
        const progressElement = document.getElementById('loadingProgress');
        if (progressElement) {
            progressElement.remove();
        }
    }

    showImageList() {
        document.getElementById('imageListSection').style.display = 'block';
        this.updateImageList();
        this.updateImageNavigation();
    }

    hideImageList() {
        document.getElementById('imageListSection').style.display = 'none';
    }

    updateImageList() {
        const container = document.getElementById('imageList');
        const countSpan = document.getElementById('imageCount');
        
        // ImageManager'dan fotoğrafları al
        if (this.imageManager && this.imageManager.images) {
            this.images = this.imageManager.images;
        }
        
        // Yükleme sırasında totalImages kullan, yoksa images.length kullan
        const totalCount = this.totalImages || (this.images ? this.images.length : 0);
        if (countSpan) {
        countSpan.textContent = totalCount;
        }

        // Sayfalama ile normal rendering (virtual scrolling kaldırıldı)
            this.updateImageListNormal(container);
    }

    updateImageListVirtual(container) {
        // Sadece görünen alan + buffer için DOM elementleri oluştur
        const containerHeight = container.clientHeight || 300;
        const itemHeight = 33; // Her thumbnail yaklaşık 33px (32px + 1px margin)
        const visibleCount = Math.ceil(containerHeight / itemHeight) + 10; // +10 buffer
        
        // Mevcut DOM elementlerini temizle
        container.innerHTML = '';
        
        // Sadece görünen aralıktaki resimleri oluştur
        const startIndex = Math.max(0, this.currentImageIndex - Math.floor(visibleCount / 2));
        const endIndex = Math.min(this.images ? this.images.length : 0, startIndex + visibleCount);
        
        // Toplam yükseklik için spacer oluştur
        const totalHeight = (this.images ? this.images.length : 0) * itemHeight;
        const spacerTop = document.createElement('div');
        spacerTop.style.height = `${startIndex * itemHeight}px`;
        container.appendChild(spacerTop);
        
        // Görünen elementleri oluştur
        for (let i = startIndex; i < endIndex; i++) {
            const imageData = this.images[i];
            const thumbnail = this.createThumbnailElement(imageData, i);
            container.appendChild(thumbnail);
        }
        
        // Alt spacer
        const spacerBottom = document.createElement('div');
        spacerBottom.style.height = `${(this.images ? this.images.length : 0) - endIndex}px`;
        container.appendChild(spacerBottom);
        
        // Scroll pozisyonunu ayarla
        const scrollTop = startIndex * itemHeight;
        container.scrollTop = scrollTop;
        
        console.log(`📱 Virtual scrolling: ${startIndex}-${endIndex} / ${this.images.length} (${visibleCount} görünür)`);
    }

    updateImageListNormal(container) {
        container.innerHTML = '';

        if (!this.images || this.images.length === 0) {
            container.innerHTML = `
                <div style="
                    text-align: center; 
                    color: var(--text-muted); 
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.8rem;
                ">
                    <i class="fas fa-images" style="font-size: 1.5rem; opacity: 0.5;"></i>
                    <div>Henüz fotoğraf yüklenmedi</div>
                </div>
            `;
            this.totalPages = 1;
            this.currentPage = 1;
            this.updatePaginationInfo();
            this.updatePaginationControls();
            return;
        }

        // Sayfalama hesapla
        const totalCount = this.totalImages || this.images.length;
        this.totalPages = Math.ceil(totalCount / this.itemsPerPage);
        if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages;
        }
        if (this.currentPage < 1) {
            this.currentPage = 1;
        }

        // Mevcut sayfa için fotoğrafları al
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, totalCount);
        const currentPageImages = this.images.slice(startIndex, endIndex);

        // Sayfa fotoğraflarını render et
        currentPageImages.forEach((imageData, index) => {
            const globalIndex = startIndex + index;
            const thumbnail = this.createThumbnailElement(imageData, globalIndex);
            container.appendChild(thumbnail);
        });

        // Sayfalama bilgilerini güncelle
        this.updatePaginationInfo();
        this.updatePaginationControls();
    }

    // Sayfalama bilgilerini güncelle
    updatePaginationInfo() {
        const prevPageBtn = document.getElementById('prevPageBtn');
        const nextPageBtn = document.getElementById('nextPageBtn');
        const pageNumbersContainer = document.getElementById('pageNumbers');

        // Önceki/Sonraki butonları
        if (prevPageBtn) {
            prevPageBtn.disabled = this.currentPage <= 1;
            if (!prevPageBtn.hasAttribute('data-listener-added')) {
                prevPageBtn.addEventListener('click', () => this.goToPreviousPage());
                prevPageBtn.setAttribute('data-listener-added', 'true');
            }
        }
        
        if (nextPageBtn) {
            nextPageBtn.disabled = this.currentPage >= this.totalPages;
            if (!nextPageBtn.hasAttribute('data-listener-added')) {
                nextPageBtn.addEventListener('click', () => this.goToNextPage());
                nextPageBtn.setAttribute('data-listener-added', 'true');
            }
        }

        // Sayfa numaralarını oluştur
        this.renderPageNumbers(this.currentPage, this.totalPages, pageNumbersContainer);
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

    // Sayfalama kontrollerini güncelle (eski fonksiyon - artık kullanılmıyor)
    updatePaginationControls() {
        // Bu fonksiyon artık updatePaginationInfo içinde yapılıyor
    }

    // Belirli sayfaya git
    goToPage(page) {
        if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
            this.currentPage = page;
            this.updateImageList();
        }
    }

    // Önceki sayfa
    goToPreviousPage() {
        if (this.currentPage > 1) {
            this.goToPage(this.currentPage - 1);
        }
    }

    // Sonraki sayfa
    goToNextPage() {
        if (this.currentPage < this.totalPages) {
            this.goToPage(this.currentPage + 1);
        }
    }

    createThumbnailElement(imageData, index) {
            const thumbnail = document.createElement('div');
            thumbnail.className = 'image-thumbnail';
            
            if (index === this.currentImageIndex) {
                thumbnail.classList.add('active');
            }

        // Küçük önizleme resmi (24x24px)
        const preview = document.createElement('img');
        preview.className = 'image-preview';
        if (imageData.thumbnail) {
            preview.src = imageData.thumbnail;
        } else {
            // Placeholder resim
            preview.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iMTIiIHk9IjEyIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iOCIgZmlsbD0iIzY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltZzwvdGV4dD48L3N2Zz4=';
        }
        preview.alt = imageData.name;
        thumbnail.appendChild(preview);

        // Resim bilgileri container'ı
            const info = document.createElement('div');
            info.className = 'image-info';
            
        // Resim adı
            const name = document.createElement('div');
            name.className = 'image-name';
        name.textContent = imageData.name;
        info.appendChild(name);

        // Badge'ler container'ı
        const badges = document.createElement('div');
        badges.className = 'image-badges';

        // Resim numarası
        const number = document.createElement('div');
        number.className = 'image-number';
        number.textContent = index + 1;
        badges.appendChild(number);

        // Etiket sayısı (eğer varsa)
        const annotationCount = (this.imageAnnotations && this.imageAnnotations[index]) ? this.imageAnnotations[index].length : 0;
        if (annotationCount > 0) {
            const annotationBadge = document.createElement('div');
            annotationBadge.className = 'annotation-count';
            annotationBadge.textContent = annotationCount;
            badges.appendChild(annotationBadge);
        }

        info.appendChild(badges);
            thumbnail.appendChild(info);
            
            thumbnail.addEventListener('click', () => this.switchToImage(index));
        
        return thumbnail;
    }

    updateImageNavigation() {
        document.getElementById('currentImageIndex').textContent = this.currentImageIndex + 1;
        document.getElementById('totalImages').textContent = this.images ? this.images.length : 0;
        
        // Ana navigasyon butonları
        const prevImageBtn = document.getElementById('prevImage');
        const nextImageBtn = document.getElementById('nextImage');
        if (prevImageBtn) prevImageBtn.disabled = this.currentImageIndex === 0;
        if (nextImageBtn) nextImageBtn.disabled = this.currentImageIndex === (this.images ? this.images.length - 1 : 0);
    }

    switchToImage(index) {
        // Use optimized version
        this.switchToImageOptimized(index);
    }


    async previousImage() {
        if (!this.imageManager) return;
        
        // Direkt ImageManager'ın previousImage fonksiyonunu kullan
        await this.imageManager.previousImage();
    }

    async nextImage() {
        if (!this.imageManager) return;
        
        // Direkt ImageManager'ın nextImage fonksiyonunu kullan
        await this.imageManager.nextImage();
    }

    deleteImage(index) {
        if (!this.isMultiImageMode || !this.images || index < 0 || index >= this.images.length) return;
        
        // Silinecek fotoğrafın adını al
        const imageToDelete = this.images[index];
        const deletedImageName = imageToDelete.name;
        
        // Onay alert'i göster
        const confirmDelete = confirm(`"${deletedImageName}" fotoğrafını silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz ve fotoğrafa ait tüm etiketler de silinecektir.`);
        
        if (!confirmDelete) {
            return; // Kullanıcı iptal etti
        }
        
        // Eğer tek fotoğraf kaldıysa, tek resim moduna geç
        if (this.images && this.images.length === 1) {
            this.images = [];
            this.imageAnnotations = {};
            this.annotations = [];
            this.image = null;
            this.isMultiImageMode = false;
            this.hideImageList();
            this.redraw();
            this.showSuccess('Son fotoğraf silindi. Tekrar fotoğraf yükleyebilirsiniz.');
            return;
        }

        // Fotoğrafı ve annotation'larını sil
        this.images.splice(index, 1);
        delete this.imageAnnotations[index];
        
        // Annotation indexlerini yeniden düzenle
        const newImageAnnotations = {};
        Object.keys(this.imageAnnotations).forEach(key => {
            const oldIndex = parseInt(key);
            if (oldIndex > index) {
                newImageAnnotations[oldIndex - 1] = this.imageAnnotations[key];
            } else if (oldIndex < index) {
                newImageAnnotations[oldIndex] = this.imageAnnotations[key];
            }
        });
        this.imageAnnotations = newImageAnnotations;
        
        // Fotoğraf indexlerini güncelle
        this.images.forEach((img, i) => {
            img.index = i;
        });
        
        // Aktif fotoğraf indexini ayarla
        if (this.images && this.currentImageIndex >= this.images.length) {
            // Son fotoğraftaysak, bir öncekine geç
            this.currentImageIndex = this.images.length - 1;
        } else if (this.currentImageIndex > index) {
            // Silinen fotoğraftan sonraki bir fotoğraftaysak, index'i bir azalt
            this.currentImageIndex--;
        }
        // Silinen fotoğraftan önceki bir fotoğraftaysak, index aynı kalır
        
        // UI'yi güncelle
        this.switchToImage(this.currentImageIndex);
        this.showSuccess(`"${deletedImageName}" fotoğrafı silindi.`);
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // Canvas boyutlarını container'a göre ayarla
        this.canvas.width = containerWidth;
        this.canvas.height = containerHeight;
        
        // Eğer resim varsa, boyutlandırma yap
        if (this.image) {
            this.zoomToPhoto();
        }
        
        this.redraw();
    }

    setTool(tool) {
        // Sadece rectangle tool desteklenir
        if (tool !== 'rectangle') {
            this.showWarning('Sadece dikdörtgen aracı desteklenir!');
            return;
        }
        
        this.currentTool = 'rectangle';
        
        // Buton durumlarını güncelle (sadece mevcut butonlar için)
        const buttons = document.querySelectorAll('.btn');
        if (buttons) {
            buttons.forEach(btn => {
                if (btn && btn.classList) {
                    btn.classList.remove('active');
                }
            });
        }
        
        // Canvas cursor'ını güncelle
        this.updateCanvasCursor();
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Raw canvas koordinatları
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        
        // Canvas koordinatlarını görsel koordinatlarına dönüştür
        const imageX = (canvasX - this.panX) / this.zoom;
        const imageY = (canvasY - this.panY) / this.zoom;
        
        return { x: imageX, y: imageY };
    }

    getRawMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    // Canvas koordinatlarını görsel koordinatlara dönüştür
    canvasToImage(canvasX, canvasY) {
        return {
            x: (canvasX - this.panX) / this.zoom,
            y: (canvasY - this.panY) / this.zoom
        };
    }

    // Görsel koordinatları canvas koordinatlarına dönüştür
    imageToCanvas(imageX, imageY) {
        return {
            x: imageX * this.zoom + this.panX,
            y: imageY * this.zoom + this.panY
        };
    }

    // Canvas koordinatlarını görsel koordinatlarına dönüştür
    canvasToImageCoords(canvasX, canvasY) {
        if (!this.image) return { x: canvasX, y: canvasY };
        
        // Raw canvas koordinatlarını görsel koordinatlarına dönüştür
        const imageX = (canvasX - this.panX) / this.zoom;
        const imageY = (canvasY - this.panY) / this.zoom;
        
        // Görsel boyutlarına göre sınırla
        const imageWidth = this.image.width;
        const imageHeight = this.image.height;
        
        return {
            x: Math.max(0, Math.min(imageWidth, imageX)),
            y: Math.max(0, Math.min(imageHeight, imageY))
        };
    }

    // Görsel koordinatlarını canvas koordinatlarına dönüştür
    imageToCanvasCoords(imageX, imageY) {
        if (!this.image) return { x: imageX, y: imageY };
        
        // Zoom ve pan dönüşümü
        const canvasX = imageX * this.zoom + this.panX;
        const canvasY = imageY * this.zoom + this.panY;
        
        return { x: canvasX, y: canvasY };
    }

    handleMouseDown(e) {
        console.log('🖱️ Script.js handleMouseDown çağrıldı!', e);
        if (!this.image) {
            console.log('❌ Image yok, mouse down iptal edildi');
            return;
        }

        const rawPos = this.getRawMousePos(e);
        
        // Ctrl + sol tık = pan modu başlat
        if (e.ctrlKey && e.button === 0) {
            this.isPanning = true;
            this.lastPanX = rawPos.x;
            this.lastPanY = rawPos.y;
            if (this.canvas) {
            this.canvas.style.cursor = 'grabbing';
                this.canvas.style.outline = 'none';
            }
            e.preventDefault();
            return;
        }

        // 1. Handle kontrolü - tüm annotation'ları kontrol et
        const rect = this.canvas.getBoundingClientRect();
        const canvasPos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        console.log('🔍 Handle detection başlatılıyor...', { canvasPos, annotations: this.annotations.length });
        const handle = this.getHandleAt(canvasPos);
        console.log('🔍 Handle detection sonucu:', handle);
        
        if (handle) {
            console.log('🎯 Handle bulundu!', handle);
            // Handle'a tıklandı - boyut değiştirme başlat
            // Handle bulunduğunda annotation'ı seç
            if (this.selectedAnnotation || this.focusedAnnotation) {
                // Zaten seçili annotation var
                console.log('✅ Annotation zaten seçili:', this.selectedAnnotation || this.focusedAnnotation);
            } else {
                // Handle'dan annotation'ı bul ve seç
                const annotation = this.annotations.find(ann => 
                    ann === this.selectedAnnotation || ann === this.focusedAnnotation
                );
                if (annotation) {
                    this.selectedAnnotation = annotation;
                    this.focusedAnnotation = annotation;
                    console.log('✅ Annotation seçildi:', annotation);
                }
            }
            
            this.isDraggingHandle = true;
            this.dragHandle = handle;
            this.canvas.style.cursor = 'grabbing';
            console.log('🚀 Handle dragging başlatıldı');
            e.preventDefault();
            return;
        }
        
        // 2. Etiket taşıma kontrolü - seçili etiket varsa
        if (this.focusedAnnotation && !this.focusedAnnotation.locked) {
            const pos = this.getMousePos(e);
            const clickedAnnotation = this.getAnnotationAt(e);
            
            if (clickedAnnotation && clickedAnnotation === this.focusedAnnotation) {
                // Etiket taşıma başlat
                this.isDraggingAnnotation = true;
                this.dragStartPos = pos;
                this.dragAnnotation = clickedAnnotation;
                
                // labelPosition'ı en sol üstteki handle'a göre ayarla
                const labelPos = this.getLabelPosition(this.dragAnnotation);
                if (labelPos) {
                    this.dragAnnotation.labelPosition = {
                        x: labelPos.x,
                        y: labelPos.y
                    };
                }
                
                this.canvas.style.cursor = 'grabbing';
                e.preventDefault();
                return;
            }
        }

        // 3. Rectangle çizim modu - yeni etiket oluştur
        if (this.currentTool === 'rectangle') {
            const pos = this.getMousePos(e);
            this.isDrawing = true;
            this.startX = pos.x;
            this.startY = pos.y;
        }
        
        // 4. Etiket seçimi - her zaman çalışır
        this.handleClick(e);
    }

    addPolygonPointToCanvas(pos) {
        // Polygon sistemi kaldırıldı - sadece rectangle desteklenir
        return;
    }

    handleMouseMove(e) {
        if (!this.image) return;

        const rawPos = this.getRawMousePos(e);
        
        this.currentMousePos = this.getMousePos(e);
        

        // Pan modu
        if (this.isPanning) {
            this.panX += rawPos.x - this.lastPanX;
            this.panY += rawPos.y - this.lastPanY;
            this.lastPanX = rawPos.x;
            this.lastPanY = rawPos.y;
            this.needsRedraw = true;
            this.redraw();
            return;
        }

        // Handle sürükleme modu
        if (this.isDraggingHandle && this.dragHandle) {
            console.log('🔄 Handle dragging devam ediyor...');
            // Handle'dan annotation'ı bul
            const annotation = this.selectedAnnotation || this.focusedAnnotation;
            if (!annotation) {
                console.log('❌ Annotation bulunamadı!');
                this.isDraggingHandle = false;
                this.dragHandle = null;
                return;
            }
            
            // Kilitli annotation'ı kontrol et
            if (annotation.locked) {
                console.log('🔒 Annotation kilitli!');
                this.showToast('Bu etiket kilitli! Düzenlemek için kilidi açın.', 'warning');
                this.isDraggingHandle = false;
                this.dragHandle = null;
                return;
            }
            
            // Mouse pozisyonunu al (canvas koordinatları)
            const rawPos = this.getRawMousePos(e);
            console.log('📍 Mouse pos (canvas):', rawPos);
            
            // AnnotationManager'a canvas koordinatlarını gönder (dönüşümü o yapacak)
            this.annotationManager.resizeAnnotation(annotation, this.dragHandle, rawPos);
            this.needsRedraw = true;
            this.redraw();
            return;
        }
        
        // Etiket taşıma modu
        if (this.isDraggingAnnotation && this.dragAnnotation) {
            // Kilitli annotation'ı kontrol et
            if (this.dragAnnotation.locked) {
                this.showToast('Bu etiket kilitli! Düzenlemek için kilidi açın.', 'warning');
                this.isDraggingAnnotation = false;
                this.dragAnnotation = null;
                return;
            }
            
            // Mouse pozisyonunu image koordinatlarına dönüştür
            const pos = this.getMousePos(e);
            const deltaX = pos.x - this.dragStartPos.x;
            const deltaY = pos.y - this.dragStartPos.y;
            
            // Etiket pozisyonunu güncelle
            this.dragAnnotation.x += deltaX;
            this.dragAnnotation.y += deltaY;
            
            // LabelPosition'ı en sol üstteki handle'a göre yeniden hesapla
            // getLabelPosition fonksiyonu en sol üstteki handle'ı bulur ve pozisyonu hesaplar
            const newLabelPos = this.getLabelPosition(this.dragAnnotation);
            if (newLabelPos) {
                this.dragAnnotation.labelPosition = {
                    x: newLabelPos.x,
                    y: newLabelPos.y
                };
            }
            
            // Başlangıç pozisyonunu güncelle
            this.dragStartPos = pos;
            
            this.needsRedraw = true;
            this.redraw();
            return;
        }

        // Handle hover cursor kontrolü - seçili etiket varsa
        if (this.focusedAnnotation && !this.focusedAnnotation.locked && !this.isDraggingHandle && !this.isDraggingAnnotation) {
            const rect = this.canvas.getBoundingClientRect();
            const canvasPos = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            const handle = this.getHandleAt(canvasPos);
            
            if (handle) {
                // Handle üzerinde cursor değiştir
                if (handle.type === 'corner') {
                    // Köşe handle'ı - resize cursor
                    this.canvas.style.cursor = 'nw-resize';
                } else if (handle.type === 'edge') {
                    // Kenar handle'ı - resize cursor (kenar yönüne göre)
                    const edgeIndex = handle.index;
                    if (edgeIndex === 0 || edgeIndex === 2) {
                        // Üst ve alt kenar - yatay resize
                        this.canvas.style.cursor = 'ns-resize';
                    } else {
                        // Sol ve sağ kenar - dikey resize
                        this.canvas.style.cursor = 'ew-resize';
                    }
                } else {
                    // Diğer handle tipleri
                    this.canvas.style.cursor = 'grab';
                }
            } else if (this.focusedAnnotation) {
                // Etiket üzerinde cursor değiştir
                this.canvas.style.cursor = 'move';
            } else {
                this.canvas.style.cursor = 'default';
            }
        } else {
            // Handle yoksa normal cursor
            this.canvas.style.cursor = 'default';
        }

        // Rectangle çizim modu
        if (this.isDrawing && this.currentTool === 'rectangle') {
            const pos = this.getMousePos(e);
            this.needsRedraw = true;
            this.redraw();
            
            // Rectangle çiziliyor
            
            // Geçici rectangle çiz (zoom'a göre ayarla)
            this.ctx.save();
            this.ctx.setTransform(this.zoom, 0, 0, this.zoom, this.panX, this.panY);
            this.ctx.strokeStyle = '#e74c3c';
            this.ctx.lineWidth = 2 / this.zoom;
            this.ctx.strokeRect(
                this.startX, 
                this.startY, 
                pos.x - this.startX, 
                pos.y - this.startY
            );
            this.ctx.restore();
        }
    }

    handleMouseUp(e) {
        // Pan modunu bitir
        if (this.isPanning) {
            this.isPanning = false;
            if (this.canvas) {
            this.canvas.style.cursor = 'crosshair';
            this.canvas.style.outline = 'none';
        }
            return;
        }

        // Handle sürükleme bitir - tüm tool'larda çalışmalı
        if (this.isDraggingHandle) {
            // Kilitli annotation'ı kontrol et
            if (this.focusedAnnotation && this.focusedAnnotation.locked) {
                this.showToast('Bu etiket kilitli! Düzenlemek için kilidi açın.', 'warning');
                this.isDraggingHandle = false;
                this.dragHandle = null;
                this.canvas.style.cursor = 'default';
                return;
            }
            
            this.isDraggingHandle = false;
            this.dragHandle = null;
            this.canvas.style.cursor = 'default';
            this.redraw(); // Değişiklikleri göster
            
            // Handle sürükleme bittiğinde database'e kaydet
            console.log('🔵 Handle sürükleme bitti, database\'e kaydediliyor...');
            this.saveAllAnnotationsToDatabase();
            return;
        }
        
        // Etiket taşıma bitir
        if (this.isDraggingAnnotation) {
            // Kilitli annotation'ı kontrol et
            if (this.dragAnnotation && this.dragAnnotation.locked) {
                this.showToast('Bu etiket kilitli! Düzenlemek için kilidi açın.', 'warning');
                this.isDraggingAnnotation = false;
                this.dragAnnotation = null;
                this.canvas.style.cursor = 'default';
                return;
            }
            
            this.isDraggingAnnotation = false;
            this.dragAnnotation = null;
            this.dragStartPos = null;
            this.canvas.style.cursor = 'default';
            this.redraw(); // Değişiklikleri göster
            return;
        }
        
        // Handle sürükleme sırasında yeni etiket oluşturmayı engelle - zaten yukarıda kontrol edildi
        
        // Sadece rectangle tool desteklenir

        if (!this.image || !this.isDrawing || this.currentTool !== 'rectangle') return;

        const pos = this.getMousePos(e);
        this.isDrawing = false;

        // Rectangle oluşturuluyor

        // Rectangle annotation oluştur
        const width = pos.x - this.startX;
        const height = pos.y - this.startY;

        // Minimum boyut kontrolü - daha büyük minimum boyut
        const minSize = 20 / this.zoom; // 20 piksel minimum
        if (Math.abs(width) > minSize && Math.abs(height) > minSize) {
            // getMousePos zaten görsel koordinatlarını veriyor, direkt kullan
            const imageWidth = Math.abs(pos.x - this.startX);
            const imageHeight = Math.abs(pos.y - this.startY);
            
            // Rectangle'ı direkt polygon benzeri düzenlenebilir olarak oluştur
            const x = Math.min(this.startX, pos.x);
            const y = Math.min(this.startY, pos.y);
            const width = imageWidth;
            const height = imageHeight;
            
            // Annotation'ı oluştur ama henüz listeye ekleme
            this.currentAnnotation = {
                type: 'rectangle',
                x: x,
                y: y,
                width: width,
                height: height,
                // Polygon benzeri düzenlenebilir noktalar
                points: [
                    { x: x, y: y }, // Sol üst
                    { x: x + width, y: y }, // Sağ üst
                    { x: x + width, y: y + height }, // Sağ alt
                    { x: x, y: y + height } // Sol alt
                ],
                label: '',
                color: this.selectedColor || this.getNextAutoColor(),
                id: Date.now()
            };
            
            // DEBUG: Koordinatları konsola yazdır
            console.log('🔍 Etiket koordinatları:', {
                x: x,
                y: y,
                width: width,
                height: height,
                imageWidth: this.image?.width,
                imageHeight: this.image?.height,
                zoom: this.zoom,
                panX: this.panX,
                panY: this.panY
            });
            this.redraw();
            
            // Hızlı etiket modunda direkt önceki etiketin ismini al
            if (this.quickLabelMode && this.activeLabel) {
                this.currentAnnotation.label = this.activeLabel;
                this.currentAnnotation.color = this.getNextAutoColor();
                // Annotation'ı listeye ekle
                this.annotations.push(this.currentAnnotation);
                this.currentAnnotation = null;
                this.updateAnnotationList();
                
                // History'ye kaydet
                this.saveToHistory();
                
                // Projeyi kaydet
                this.isSaved = false; // Yeni annotation eklendi, kaydedilmemiş
                this.saveProject();
                
                // Redraw flag'ini set et
                this.needsRedraw = true;
                this.redraw();
                
                // Yeni annotation'ı seçili ve focuslanmış yap
                this.selectedAnnotation = this.annotations[this.annotations.length - 1];
                this.focusedAnnotation = this.annotations[this.annotations.length - 1];
                this.showSuccess(`"${this.activeLabel}" etiketi eklendi!`);
            } else {
                // Normal mod: Modal göster
                this.showNewLabelModal();
            }
        }
    }

    handleClick(e) {
        if (!this.image) return;

        // Kilit ikonuna tıklama kontrolü
        const lockClickResult = this.checkLockIconClick(e);
        if (lockClickResult) {
            return; // Kilit ikonuna tıklandı, işlem tamamlandı
        }

        // Sadece rectangle tool desteklenir

        // Diğer tool'lar için normal mantık
        const clickedAnnotation = this.getAnnotationAt(e);
        
        if (clickedAnnotation) {
            // Etikete tıklandığında sadece focus yap
            this.focusedAnnotation = clickedAnnotation;
            
            // Seçim işlemini de yap
            this.selectedAnnotation = clickedAnnotation;
            this.annotationManager.updateAnnotationList();
            
            console.log('✅ Annotation focus\'landı:', clickedAnnotation.id);
            this.redraw();
        } else {
            // Boş alana tıklandığında focus'u kaldır
            this.focusedAnnotation = null;
            this.selectedAnnotation = null;
            this.annotationManager.updateAnnotationList();
            
            console.log('❌ Focus kaldırıldı - boş alana tıklandı');
            this.redraw();
        }

        // Boş alana tıklanırsa seçimi kaldır - zaten yukarıda yapıldı

        // Başka bir annotation'a tıklandı - zaten yukarıda seçim yapıldı
    }


    // Polygon sistemi kaldırıldı

    handleDoubleClick(e) {
        // Çift tıklama - annotation edit modu
        const clickedAnnotation = this.getAnnotationAt(e);
        if (clickedAnnotation) {
            this.startEditingAnnotation(clickedAnnotation);
        }
    }

    handleRightClick(e) {
        e.preventDefault(); // Varsayılan context menu'yu engelle
        
        if (!this.image) return;

        // Sağ tık işlemi kaldırıldı - kilitleme sistemi yok
        console.log('ℹ️ Sağ tık işlemi kaldırıldı');
    }

    showContextMenu(e, annotation) {
        // Mevcut context menu'yu kaldır
        const existingMenu = document.getElementById('contextMenu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Yeni context menu oluştur
        const menu = document.createElement('div');
        menu.id = 'contextMenu';
        menu.className = 'context-menu';
        menu.style.cssText = `
            position: fixed;
            background: #34495e;
            border: 1px solid #2c3e50;
            border-radius: 6px;
            padding: 5px 0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            min-width: 150px;
            color: white;
            font-size: 13px;
        `;

        // Menu öğeleri
        const deleteItem = document.createElement('div');
        deleteItem.className = 'context-menu-item';
        deleteItem.innerHTML = `
            <span style="margin-right: 8px;">🗑️</span>
            <span>Silme (${annotation.label})</span>
        `;
        deleteItem.style.cssText = `
            padding: 8px 15px;
            cursor: pointer;
            transition: background-color 0.2s;
            display: flex;
            align-items: center;
        `;
        
        deleteItem.addEventListener('mouseenter', () => {
            deleteItem.style.backgroundColor = '#e74c3c';
        });
        
        deleteItem.addEventListener('mouseleave', () => {
            deleteItem.style.backgroundColor = 'transparent';
        });
        
        deleteItem.addEventListener('click', () => {
            this.deleteAnnotationByObject(annotation);
            menu.remove();
        });

        // Edit öğesi
        const editItem = document.createElement('div');
        editItem.className = 'context-menu-item';
        editItem.innerHTML = `
            <span style="margin-right: 8px;">✏️</span>
            <span>Düzenle</span>
        `;
        editItem.style.cssText = `
            padding: 8px 15px;
            cursor: pointer;
            transition: background-color 0.2s;
            display: flex;
            align-items: center;
        `;
        
        editItem.addEventListener('mouseenter', () => {
            editItem.style.backgroundColor = '#3498db';
        });
        
        editItem.addEventListener('mouseleave', () => {
            editItem.style.backgroundColor = 'transparent';
        });
        
        editItem.addEventListener('click', () => {
            this.startEditingAnnotation(annotation);
            menu.remove();
        });

        // Renk değiştir öğesi

        // Açıklama ekle/düzenle öğesi

        // Menu'ya öğeleri ekle
        menu.appendChild(editItem);
        menu.appendChild(deleteItem);

        // Sayfaya ekle
        document.body.appendChild(menu);

        // Mouse pozisyonuna yerleştir
        const rect = this.canvas.getBoundingClientRect();
        const menuX = e.clientX;
        const menuY = e.clientY;
        
        menu.style.left = Math.min(window.innerWidth - 200, menuX) + 'px';
        menu.style.top = Math.min(window.innerHeight - 120, menuY) + 'px';

        // Dışarı tıklandığında kapat
        const closeMenu = (clickEvent) => {
            if (!menu.contains(clickEvent.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
                document.removeEventListener('contextmenu', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
            document.addEventListener('contextmenu', closeMenu);
        }, 100);
    }


    deleteAnnotationByObject(annotation) {
        // Annotation'ı listeden kaldır
        this.annotations = this.annotations.filter(ann => ann.id !== annotation.id);
        
        // Eğer silinen annotation seçiliyse, seçimi kaldır
        if (this.selectedAnnotation && this.selectedAnnotation.id === annotation.id) {
            this.selectedAnnotation = null;
        }
        
        // Edit modundaysa çık
        if (this.editingAnnotation && this.editingAnnotation.id === annotation.id) {
            this.exitEditMode();
        }
        
        this.updateAnnotationList();
        this.redraw();
        
        this.showSuccess(`"${annotation.label}" silindi.`);
    }

    selectAnnotationAt(e) {
        const mousePos = this.getMousePos(e);
        const clickedAnnotation = this.getAnnotationAtPosition(mousePos);
        
        if (clickedAnnotation) {
            this.selectedAnnotation = clickedAnnotation;
        } else {
            this.selectedAnnotation = null;
        }
        
        this.updateAnnotationList();
        this.redraw();
    }

    getAnnotationAt(e) {
        const mousePos = this.getMousePos(e);
        return this.getAnnotationAtPosition(mousePos);
    }

    // Kilit noktasına tıklama kontrolü
    checkLockIconClick(e) {
        const mousePos = this.getMousePos(e);
        
        // Tüm annotation'ları kontrol et
        for (const annotation of this.annotations) {
            if (!annotation.label) continue;
            
            // Etiket pozisyonunu hesapla
            const labelPos = this.getLabelPosition(annotation);
            if (!labelPos) continue;
            
            // Kilit noktası pozisyonu - etiket kutusunun sağında
            const lockPos = {
                x: labelPos.x + labelPos.width + 8,
                y: labelPos.y - labelPos.height + 2,
                radius: 4
            };
            
            // Tıklama kilit noktası içinde mi?
            const distance = Math.sqrt(
                Math.pow(mousePos.x - lockPos.x, 2) + 
                Math.pow(mousePos.y - lockPos.y, 2)
            );
            
            if (distance <= lockPos.radius + 5) { // 5px tolerance
                // Kilit durumunu değiştir
                annotation.locked = !annotation.locked;
                this.redraw();
                
                // Toast mesajı
                const message = annotation.locked ? `"${annotation.label}" kilitlendi` : `"${annotation.label}" kilidi açıldı`;
                this.showInfo(message);
                
                return true;
            }
        }
        
        return false;
    }

    // Kilit sistemi kaldırıldı

    // Etiket pozisyonunu hesapla - Sol üst handle'a göre hizalanmış
    // Etiket pozisyonu ayarları için class seviyesinde değişkenler
    // Handle'ın tam ortası referans alınacak şekilde ayarlandı
    static labelPositionSettings = {
        fontSize: 14,         // px, etiket kutusu yüksekliği
        textWidth: 120,       // px, etiket kutusu genişliği
        padding: 6,           // px, canvas kenarından boşluk
        offsetX: 0,           // px, handle'ın x koordinatı (ortalanmış)
        offsetY: -4           // px, handle'ın y koordinatı (kuyruğun alt ucu biraz yukarıda)
    };

    getLabelPosition(annotation) {
        if (!annotation.label) return null;

        // 1) En sol üst handle'ı bul veya kullan
        let handlePoint;
        if (annotation.points && annotation.points.length > 0) {
            if (annotation.topLeftHandleIndex !== undefined && annotation.topLeftHandleIndex < annotation.points.length) {
                handlePoint = annotation.points[annotation.topLeftHandleIndex];
                // console.log('✅ Kayıtlı en sol üst handle kullanıldı:', handlePoint, 'index:', annotation.topLeftHandleIndex);
            } else {
                let bestIndex = 0;
                handlePoint = annotation.points.reduce((best, p, index) => {
                    if (p.y < best.y) {
                        bestIndex = index;
                        return p;
                    }
                    if (p.y === best.y && p.x < best.x) {
                        bestIndex = index;
                        return p;
                    }
                    return best;
                }, annotation.points[0]);
                annotation.topLeftHandleIndex = bestIndex;
                // console.log('✅ En sol üst handle hesaplandı ve kaydedildi:', handlePoint, 'index:', bestIndex);
            }
        } else {
            handlePoint = { x: annotation.x || 0, y: annotation.y || 0 };
            console.log('✅ Rectangle sol üst köşe:', handlePoint);
        }

        // 2) Canvas koordinatlarına çevir (zoom'a göre)
        const canvasHandle = this.imageToCanvas(handlePoint.x, handlePoint.y);
        console.log('🔍 Canvas handle koordinatı:', canvasHandle);

        // 3) Ayarları class seviyesinden al
        const {
            fontSize,
            textWidth,
            padding,
            offsetX,
            offsetY
        } = this.constructor.labelPositionSettings;

        // 4) Label'ı handle ile aynı yatay eksende ve daha yakın hizala
        let x = canvasHandle.x + offsetX; // Handle'ın sağında, offsetX kadar sağa
        let y = canvasHandle.y + offsetY; // Handle'ın y koordinatı (merkez)

        // console.log('🔍 Etiket pozisyonu (canvas):', { x, y });

        // 5) Canvas sınırlarını aşmaması için düzelt
        const cw = this.canvas.width || (this.ctx && this.ctx.canvas && this.ctx.canvas.width) || 0;
        if (cw) {
            if (x + textWidth + padding > cw) x = Math.max(padding, cw - textWidth - padding);
            if (x < padding) x = padding;
        }

        return {
            x: x,
            y: y,
            width: textWidth,
            height: fontSize,
            handleCanvasPos: canvasHandle
        };
    }

    getAnnotationAtPosition(pos) {
        // Tüm annotation'ları topla ve iç içe geçme durumunu kontrol et
        const overlappingAnnotations = [];
        
        for (let i = 0; i < this.annotations.length; i++) {
            const annotation = this.annotations[i];
            let isInside = false;
            let distance = Infinity;
            let area = 0;
            
            if (annotation.type === 'rectangle') {
                // Rectangle'ı polygon'a dönüştür (eğer henüz dönüştürülmemişse)
                this.annotationManager.convertRectangleToPolygon(annotation);
                
                // Polygon kontrolü yap
                if (annotation.points && annotation.points.length > 0) {
                    isInside = this.isPointInPolygon(pos, annotation.points);
                    
                    if (isInside) {
                        // Polygon'un merkezine olan mesafeyi hesapla
                        const centerX = annotation.points.reduce((sum, point) => sum + point.x, 0) / annotation.points.length;
                        const centerY = annotation.points.reduce((sum, point) => sum + point.y, 0) / annotation.points.length;
                        distance = Math.sqrt((pos.x - centerX) ** 2 + (pos.y - centerY) ** 2);
                        // Polygon alanını hesapla
                        area = this.calculatePolygonArea(annotation.points);
                    }
                } else {
                    // Fallback: Eski rectangle kontrolü
                    isInside = pos.x >= annotation.x && pos.x <= annotation.x + annotation.width &&
                              pos.y >= annotation.y && pos.y <= annotation.y + annotation.height;
                    
                    if (isInside) {
                        // Dikdörtgenin merkezine olan mesafeyi hesapla
                        const centerX = annotation.x + annotation.width / 2;
                        const centerY = annotation.y + annotation.height / 2;
                        distance = Math.sqrt((pos.x - centerX) ** 2 + (pos.y - centerY) ** 2);
                        area = annotation.width * annotation.height;
                    }
                }
            } else if (annotation.type === 'polygon') {
                isInside = this.isPointInPolygon(pos, annotation.points);
                
                if (isInside) {
                    // Polygon'un merkezine olan mesafeyi hesapla
                    const centerX = annotation.points.reduce((sum, point) => sum + point.x, 0) / annotation.points.length;
                    const centerY = annotation.points.reduce((sum, point) => sum + point.y, 0) / annotation.points.length;
                    distance = Math.sqrt((pos.x - centerX) ** 2 + (pos.y - centerY) ** 2);
                    // Polygon alanını hesapla (basit yaklaşım)
                    area = this.calculatePolygonArea(annotation.points);
                }
            }
            
            if (isInside) {
                overlappingAnnotations.push({
                    annotation: annotation,
                    index: i,
                    distance: distance,
                    area: area
                });
            }
        }
        
        if (overlappingAnnotations.length === 0) {
            return null;
        }
        
        // İç içe geçme durumunu kontrol et
        const nestedAnnotations = this.findNestedAnnotations(overlappingAnnotations);
        
        if (nestedAnnotations.length > 0) {
            // İç içe geçen annotation'lar varsa, en küçük alanı seç (en içteki)
            nestedAnnotations.sort((a, b) => a.area - b.area);
            return nestedAnnotations[0].annotation;
        }
        
        // İç içe geçme yoksa, en yakın annotation'ı seç
        overlappingAnnotations.sort((a, b) => a.distance - b.distance);
        return overlappingAnnotations[0].annotation;
    }

    findNestedAnnotations(annotations) {
        const nested = [];
        
        for (let i = 0; i < annotations.length; i++) {
            for (let j = 0; j < annotations.length; j++) {
                if (i !== j) {
                    const ann1 = annotations[i].annotation;
                    const ann2 = annotations[j].annotation;
                    
                    if (this.isAnnotationInside(ann1, ann2)) {
                        nested.push(annotations[i]);
                        break;
                    }
                }
            }
        }
        
        return nested;
    }

    isAnnotationInside(inner, outer) {
        if (inner.type === 'rectangle' && outer.type === 'rectangle') {
            return inner.x >= outer.x && 
                   inner.y >= outer.y && 
                   inner.x + inner.width <= outer.x + outer.width && 
                   inner.y + inner.height <= outer.y + outer.height;
        }
        // Diğer durumlar için basit alan karşılaştırması
        return inner.area < outer.area;
    }

    calculatePolygonArea(points) {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return Math.abs(area) / 2;
    }

    isPointInPolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
                (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
                inside = !inside;
            }
        }
        return inside;
    }


    getHandleAt(pos) {
        console.log('🔍 getHandleAt çağrıldı:', { pos, focusedAnnotation: this.focusedAnnotation?.id, selectedAnnotation: this.selectedAnnotation?.id });
        
        // Seçili annotation varsa handle'larını kontrol et
        if (this.focusedAnnotation) {
            console.log('🔍 Focused annotation var, handle kontrol ediliyor...');
            const handle = this.annotationManager.getHandleAt(pos);
            console.log('🔍 Focused annotation handle sonucu:', handle);
            return handle;
        }
        
        // Seçili annotation yoksa tüm annotation'ları kontrol et
        console.log('🔍 Tüm annotation\'lar kontrol ediliyor...', this.annotations.length);
        for (const annotation of this.annotations) {
            console.log('🔍 Annotation kontrol ediliyor:', annotation.id, annotation.type);
            // Annotation'ı geçici olarak seçili yap
            const originalSelected = this.selectedAnnotation;
            const originalFocused = this.focusedAnnotation;
            this.selectedAnnotation = annotation;
            this.focusedAnnotation = annotation;
            
            // AnnotationManager'daki getHandleAt fonksiyonunu kullan
            const handle = this.annotationManager.getHandleAt(pos);
            console.log('🔍 Annotation handle sonucu:', handle);
            
            if (handle) {
                // Handle bulundu, annotation'ı seçili yap
                console.log('✅ Handle bulundu!', handle);
                return handle;
            } else {
                // Handle bulunamadı, eski seçimi geri yükle
                this.selectedAnnotation = originalSelected;
                this.focusedAnnotation = originalFocused;
            }
        }
        
        console.log('❌ Hiçbir annotation\'da handle bulunamadı');
        return null;
    }

    getHandleForAnnotation(pos, annotation) {
        const handleSize = 12; // Sabit handle boyutu
        const tolerance = handleSize;

        // pos image koordinatlarında, handle'lar canvas koordinatlarında
        // pos'u canvas koordinatlarına dönüştür
        const canvasPos = this.imageToCanvas(pos.x, pos.y);

        if (annotation.type === 'rectangle') {
            // Görsel koordinatlarını canvas koordinatlarına dönüştür
            const canvasCoords = this.imageToCanvas(annotation.x, annotation.y);
            const canvasWidth = annotation.width * this.zoom;
            const canvasHeight = annotation.height * this.zoom;
            
            // Rectangle için 8 handle (canvas koordinatlarında)
            const handles = [
                { type: 'top-left', x: canvasCoords.x, y: canvasCoords.y },
                { type: 'top-center', x: canvasCoords.x + canvasWidth / 2, y: canvasCoords.y },
                { type: 'top-right', x: canvasCoords.x + canvasWidth, y: canvasCoords.y },
                { type: 'middle-right', x: canvasCoords.x + canvasWidth, y: canvasCoords.y + canvasHeight / 2 },
                { type: 'bottom-right', x: canvasCoords.x + canvasWidth, y: canvasCoords.y + canvasHeight },
                { type: 'bottom-center', x: canvasCoords.x + canvasWidth / 2, y: canvasCoords.y + canvasHeight },
                { type: 'bottom-left', x: canvasCoords.x, y: canvasCoords.y + canvasHeight },
                { type: 'middle-left', x: canvasCoords.x, y: canvasCoords.y + canvasHeight / 2 }
            ];

            for (let handle of handles) {
                if (Math.abs(canvasPos.x - handle.x) <= tolerance && Math.abs(canvasPos.y - handle.y) <= tolerance) {
                    return handle;
                }
            }
        } else if (annotation.type === 'polygon') {
            // Polygon noktalarını canvas koordinatlarına dönüştür
            const canvasPoints = annotation.points.map(point => 
                this.imageToCanvas(point.x, point.y)
            );
            
            // Polygon için nokta handle'ları
            for (let i = 0; i < canvasPoints.length; i++) {
                const point = canvasPoints[i];
                if (Math.abs(canvasPos.x - point.x) <= tolerance && Math.abs(canvasPos.y - point.y) <= tolerance) {
                    return { type: 'polygon-point', index: i, x: point.x, y: point.y };
                }
            }
        }

        return null;
    }

    resizeAnnotation(annotation, handle, pos) {
        // AnnotationManager'daki resizeAnnotation fonksiyonunu kullan
        this.annotationManager.resizeAnnotation(annotation, handle, pos);
    }

    // Eski resize fonksiyonları kaldırıldı - AnnotationManager'daki fonksiyonlar kullanılıyor

    handleWheel(e) {
        if (!this.image) return;
        
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const oldZoom = this.zoom;
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        
        this.zoom = Math.max(0.1, Math.min(5, this.zoom * zoomFactor));
        
        // Zoom merkezini mouse pozisyonuna ayarla
        const zoomRatio = this.zoom / oldZoom;
        this.panX = mouseX - (mouseX - this.panX) * zoomRatio;
        this.panY = mouseY - (mouseY - this.panY) * zoomRatio;
        
        this.redraw();
    }

    zoomIn() {
        if (!this.image) return;
        
        this.zoom = Math.min(5, this.zoom * 1.2);
        this.redraw();
        this.updateGridSize();
    }

    zoomOut() {
        if (!this.image) return;
        
        this.zoom = Math.max(0.1, this.zoom * 0.8);
        this.redraw();
        this.updateGridSize();
    }

    initializeCoordinateSystem() {
        if (!this.image) return;
        
        // Koordinat sistemini sıfırla
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        
        console.log('Koordinat sistemi başlatıldı:', {
            imageWidth: this.image.width,
            imageHeight: this.image.height,
            canvasWidth: this.canvas.width,
            canvasHeight: this.canvas.height
        });
    }

    fitToScreen() {
        if (!this.image) {
            this.showWarning('Önce bir resim yükleyin!');
            return;
        }
        
        this.zoomToPhoto(); // Photo-only zoom kullan
    }



    preserveLockStates() {
        // Mevcut lock durumlarını kaydet
        if (!this.lockStates) {
            this.lockStates = new Map();
        }
        
        // Tüm annotation'ların lock durumlarını kaydet
        this.annotations.forEach(annotation => {
            if (annotation.id) {
                this.lockStates.set(annotation.id, annotation.locked || false);
            }
        });
        
        // Çoklu fotoğraf modunda imageAnnotations'ları da kontrol et
        if (this.isMultiImageMode && this.imageAnnotations) {
            this.imageAnnotations.forEach(imageAnnotations => {
                if (imageAnnotations) {
                    imageAnnotations.forEach(annotation => {
                        if (annotation.id) {
                            this.lockStates.set(annotation.id, annotation.locked || false);
                        }
                    });
                }
            });
        }
    }

    restoreLockStates() {
        // Kaydedilen lock durumlarını geri yükle
        if (!this.lockStates) return;
        
        this.annotations.forEach(annotation => {
            if (annotation.id && this.lockStates.has(annotation.id)) {
                annotation.locked = this.lockStates.get(annotation.id);
            }
        });
        
        // Çoklu fotoğraf modunda imageAnnotations'ları da güncelle
        if (this.isMultiImageMode && this.imageAnnotations) {
            this.imageAnnotations.forEach(imageAnnotations => {
                if (imageAnnotations) {
                    imageAnnotations.forEach(annotation => {
                        if (annotation.id && this.lockStates.has(annotation.id)) {
                            annotation.locked = this.lockStates.get(annotation.id);
                        }
                    });
                }
            });
        }
    }

    updateAnnotationList() {
        const list = document.getElementById('annotationList');
        if (!list) return;
        
        console.log('updateAnnotationList çağrıldı, annotations sayısı:', this.annotations.length);
        
        // Mevcut lock durumlarını koru
        this.preserveLockStates();
        
        list.innerHTML = '';

        // Tüm modlarda annotation'ları göster
        if (this.isMultiImageMode && this.imageAnnotations) {
            // Çoklu fotoğraf modunda tüm fotoğraflardaki annotation'ları göster
            let globalIndex = 1;
            let hasAnnotations = false;
            
            for (let imageIndex = 0; imageIndex < this.imageAnnotations.length; imageIndex++) {
                const imageAnnotations = this.imageAnnotations[imageIndex] || [];
                const imageData = this.images[imageIndex];
                
                imageAnnotations.forEach((annotation, localIndex) => {
                    hasAnnotations = true;
                    const item = document.createElement('div');
                    item.className = 'annotation-item';
                    
                    // Seçili annotation için özel stil
                    if (this.selectedAnnotation === annotation) {
                        item.classList.add('selected');
                    }
                    
                    const annotationColor = annotation.color || '#2ecc71';
                    
                    // Eski annotation'lar için locked property'sini ekle (sadece kontrol için)
                    const isLocked = annotation.locked || false;
                    const lockIcon = isLocked ? '🔒' : '🔓';
                    const lockTitle = isLocked ? 'Kilidi Aç' : 'Kilitle';
                    
                    item.innerHTML = `
                        <div class="annotation-content">
                            <div class="annotation-label">${annotation.label}</div>
                            <div class="annotation-actions">
                                <button class="lock-btn ${isLocked ? 'locked' : 'unlocked'}" onclick="event.stopPropagation(); labelingTool.toggleAnnotationLock(${annotation.id})" title="${lockTitle}">
                                    <span style="font-size: 12px;">${lockIcon}</span>
                                </button>
                                <button class="delete-btn" onclick="event.stopPropagation(); labelingTool.deleteAnnotation(${annotation.id})" title="Sil">
                                    <span style="font-size: 12px;">🗑️</span>
                                </button>
                            </div>
                        </div>
                    `;
                    list.appendChild(item);
                    globalIndex++;
                });
            }
            
            // Eğer hiç annotation yoksa mesaj göster
            if (!hasAnnotations) {
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'empty-state';
                emptyMessage.innerHTML = `
                    <div class="empty-state-content">
                        <i class="fas fa-vector-square" style="font-size: 48px; color: #7f8c8d; margin-bottom: 16px;"></i>
                        <h3 style="color: #95a5a6; margin: 0 0 8px 0;">Seçili Alan Bulunamadı</h3>
                        <p style="color: #7f8c8d; margin: 0; font-size: 14px;">Henüz hiç etiketlenmiş alan yok. Resim üzerinde dikdörtgen çizerek başlayın.</p>
                    </div>
                `;
                list.appendChild(emptyMessage);
            }
        } else {
            // Tek fotoğraf modunda mevcut annotation'ları göster
            if (this.annotations.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'empty-state';
                emptyMessage.innerHTML = `
                    <div class="empty-state-content">
                        <i class="fas fa-vector-square" style="font-size: 48px; color: #7f8c8d; margin-bottom: 16px;"></i>
                        <h3 style="color: #95a5a6; margin: 0 0 8px 0;">Seçili Alan Bulunamadı</h3>
                        <p style="color: #7f8c8d; margin: 0; font-size: 14px;">Henüz hiç etiketlenmiş alan yok. Resim üzerinde dikdörtgen çizerek başlayın.</p>
                    </div>
                `;
                list.appendChild(emptyMessage);
            } else {
                this.annotations.forEach((annotation, index) => {
                const item = document.createElement('div');
                item.className = 'annotation-item';
                
                // Seçili annotation için özel stil
                if (this.selectedAnnotation === annotation) {
                    item.classList.add('selected');
                }
                
                const annotationColor = annotation.color || '#2ecc71';
                
                // Eski annotation'lar için locked property'sini ekle (sadece kontrol için)
                const isLocked = annotation.locked || false;
                const lockIcon = isLocked ? '🔒' : '🔓';
                const lockTitle = isLocked ? 'Kilidi Aç' : 'Kilitle';
                
                item.innerHTML = `
                    <div class="annotation-content">
                        <div class="annotation-label">${annotation.label}</div>
                        <div class="annotation-actions">
                            <button class="lock-btn ${isLocked ? 'locked' : 'unlocked'}" onclick="event.stopPropagation(); labelingTool.toggleAnnotationLock(${annotation.id})" title="${lockTitle}">
                                <span style="font-size: 12px;">${lockIcon}</span>
                            </button>
                            <button class="delete-btn" onclick="event.stopPropagation(); labelingTool.deleteAnnotation(${annotation.id})" title="Sil">
                                <span style="font-size: 12px;">🗑️</span>
                            </button>
                        </div>
                    </div>
                `;
                list.appendChild(item);
                });
            }
        }
        
        // Lock durumlarını geri yükle
        this.restoreLockStates();
    }

    toggleAnnotationLock(id) {
        // Annotation'ı bul
        let annotation = this.annotations.find(ann => ann.id === id);
        
        // Çoklu fotoğraf modunda imageAnnotations'da ara
        if (!annotation && this.isMultiImageMode && this.imageAnnotations) {
            for (let imageIndex = 0; imageIndex < this.imageAnnotations.length; imageIndex++) {
                if (this.imageAnnotations[imageIndex]) {
                    annotation = this.imageAnnotations[imageIndex].find(ann => ann.id === id);
                    if (annotation) break;
                }
            }
        }
        
        if (annotation) {
            annotation.locked = !annotation.locked;
            
            // Sadece lock durumunu değiştir, annotation'ı seçme
            // this.selectedAnnotation = annotation; // Bu satırı kaldırdık
            
            this.updateAnnotationList();
            this.redraw();
            
            // Toast bildirimi
            const message = annotation.locked ? 'Etiket kilitlendi' : 'Etiket kilidi açıldı';
            this.showToast(message, 'info');
        }
    }

    async deleteAnnotation(id) {
        // Silinecek annotation'ı bul
        const annotationToDelete = this.annotations.find(ann => ann.id === id);
        console.log('Silinecek annotation:', annotationToDelete);
        console.log('Silme öncesi annotations sayısı:', this.annotations.length);
        
        // Kilitli annotation'ı silmeyi engelle
        if (annotationToDelete && annotationToDelete.locked) {
            this.showToast('Bu etiket kilitli! Silmek için önce kilidi açın.', 'warning');
            return;
        }
        
        // Database'den sil (eğer database annotation ID'si varsa)
        if (annotationToDelete && annotationToDelete.dbId && window.labelingAuth) {
            try {
                const response = await window.labelingAuth.authenticatedRequest(
                    `${window.labelingAuth.baseURL}/annotations/${annotationToDelete.dbId}`,
                    { method: 'DELETE' }
                );
                
                if (!response.ok) {
                    console.error('❌ Database\'den etiket silinirken hata:', response.statusText);
                    this.showToast('Etiket database\'den silinemedi!', 'error');
                    return;
                }
                
                console.log('✅ Etiket database\'den silindi');
            } catch (error) {
                console.error('❌ Database silme hatası:', error);
                this.showToast('Database bağlantı hatası!', 'error');
                return;
            }
        } else if (annotationToDelete && !annotationToDelete.dbId) {
            // Eski etiket (dbId yok) - backend'e güncel listeyi gönder
            console.log('🔄 Eski etiket siliniyor, backend\'e güncel liste gönderiliyor...');
        }
        
        // Silinecek annotation'ın etiketini kaydet
        const deletedLabel = annotationToDelete ? annotationToDelete.label : null;
        
        // Etiketi frontend'ten sil
        this.annotations = this.annotations.filter(ann => ann.id !== id);
        console.log('Silme sonrası annotations sayısı:', this.annotations.length);
        this.isSaved = false; // Annotation silindi, kaydedilmemiş
        
        // Çoklu fotoğraf modunda ImageManager üzerinden kaydet
        if (this.isMultiImageMode && window.imageManager) {
            this.saveCurrentImageAnnotations();
        }
        // Tek fotoğraf modunda database'e kaydetme - etiket zaten silindi
        
        // Çoklu fotoğraf modunda imageAnnotations'dan da sil
        if (this.isMultiImageMode && this.imageAnnotations) {
            for (let imageIndex = 0; imageIndex < this.imageAnnotations.length; imageIndex++) {
                if (this.imageAnnotations[imageIndex]) {
                    this.imageAnnotations[imageIndex] = this.imageAnnotations[imageIndex].filter(ann => ann.id !== id);
                }
            }
        }
        
        // Mevcut resim için imageAnnotations'ı da güncelle
        console.log('🔍 imageManager durumu:', {
            imageManager: !!window.imageManager,
            currentImageIndex: window.imageManager?.currentImageIndex,
            imageAnnotations: !!this.imageAnnotations,
            imageAnnotationsType: typeof this.imageAnnotations,
            imageAnnotationsKeys: this.imageAnnotations ? Object.keys(this.imageAnnotations) : []
        });
        
        if (window.imageManager && window.imageManager.currentImageIndex !== undefined) {
            const currentIndex = window.imageManager.currentImageIndex;
            
            // imageAnnotations array'ini initialize et (eğer yoksa)
            if (!this.imageAnnotations) {
                this.imageAnnotations = {};
            }
            
            // Mevcut resim için annotation'ları güncelle
            this.imageAnnotations[currentIndex] = [...this.annotations];
            console.log(`🔄 imageAnnotations[${currentIndex}] güncellendi:`, this.annotations.length, 'etiket');
            
            // ImageManager cache'ini de temizle
            if (window.imageManager && window.imageManager.annotationCache) {
                const cacheKey = `annotations_${window.imageManager.currentImage?.id}`;
                window.imageManager.annotationCache.delete(cacheKey);
                console.log(`🗑️ ImageManager cache temizlendi: ${cacheKey}`);
            }
        } else {
            console.log('❌ imageManager veya currentImageIndex bulunamadı');
        }
        
        // Eğer silinen annotation seçiliyse, seçimi kaldır
        if (this.selectedAnnotation && this.selectedAnnotation.id === id) {
            this.selectedAnnotation = null;
        }
        
        // Eğer silinen annotation focuslanmışsa, focus'u kaldır
        if (this.focusedAnnotation && this.focusedAnnotation.id === id) {
            this.focusedAnnotation = null;
        }
        
        // Etiket listesini güncelle - kullanılmayan etiketleri sil
        this.updateLabelListAfterDeletion(deletedLabel);
        
        this.updateAnnotationList();
        
        // Backend'e güncel annotation listesini gönder (silinen annotation dahil değil)
        this.saveAllAnnotationsToDatabase();
        
        console.log('🔄 Canvas yeniden çiziliyor...');
        this.redraw();
        console.log('✅ Canvas yeniden çizildi');
    }

    // ID ile annotation seç
    selectAnnotationById(id) {
        const annotation = this.annotations.find(ann => ann.id === id);
        if (annotation) {
            this.selectedAnnotation = annotation;
            this.updateAnnotationList();
            this.redraw();
        }
    }


    clearAll() {
        this.annotations = [];
        this.currentAnnotation = null;
        this.updateAnnotationList();
        this.redraw();
    }

    // Tek bir annotation'ı database'e kaydet
    async saveCurrentAnnotationToDatabase(annotation) {
        console.log('🔧 saveCurrentAnnotationToDatabase çağrıldı:', annotation);
        console.log('🔧 imageManager:', window.imageManager);
        console.log('🔧 currentImage:', window.imageManager?.currentImage);
        console.log('🔧 labelingAuth:', window.labelingAuth);
        
        if (!window.imageManager || !window.imageManager.currentImage || !window.labelingAuth) {
            console.log('⚠️ Database kaydetme için gerekli koşullar sağlanmadı');
            console.log('  - imageManager:', !!window.imageManager);
            console.log('  - currentImage:', !!window.imageManager?.currentImage);
            console.log('  - labelingAuth:', !!window.labelingAuth);
            return;
        }

        try {
            const annotationData = {
                annotation_data: {
                    annotations: [annotation] // Array olarak gönder
                }
            };

            const url = `${window.labelingAuth.baseURL}/images/${window.imageManager.currentImage.id}/annotations`;
            console.log('📡 API çağrısı yapılıyor:', url);
            console.log('📡 Gönderilen veri:', annotationData);

            const response = await window.labelingAuth.authenticatedRequest(url, {
                method: 'POST',
                body: JSON.stringify(annotationData),
                headers: { 'Content-Type': 'application/json' }
            });
            
            console.log('📡 API yanıtı:', response.status, response.statusText);

            if (response.ok) {
                const result = await response.json();
                // Database'den dönen ID'yi annotation'a ekle
                annotation.dbId = result.id;
                console.log('✅ Etiket database\'e kaydedildi:', result.id);
                
                // Proje istatistiklerini güncelle
                this.updateProjectStats();
            } else {
                console.error('❌ Database\'e etiket kaydedilemedi:', response.statusText);
            }
        } catch (error) {
            console.error('❌ Database kaydetme hatası:', error);
        }
    }

    // BASIT API ILE ETIKET KAYDET
    async saveAllAnnotationsToDatabase() {
        if (!window.imageManager?.currentImage) return;
        
        // Handle sürükleme sırasında database kaydetme işlemini engelle
        if (this.isDraggingHandle) {
            console.log('🔄 Handle sürükleniyor, database kaydetme atlandı');
            return;
        }
        
        try {
            const imageId = window.imageManager.currentImage.id;
            console.log(`💾 ${this.annotations.length} etiket kaydediliyor...`);
            
            // Annotations'ları backend formatına çevir
            const formattedAnnotations = this.annotations.map(annotation => {
                const formatted = {
                    id: annotation.id,
                    label: annotation.label,
                    type: annotation.type,
                    color: annotation.color,
                    x: annotation.x,
                    y: annotation.y,
                    width: annotation.width,
                    height: annotation.height
                };
                
                // Points bilgisi varsa ekle
                if (annotation.points && annotation.points.length > 0) {
                    formatted.points = annotation.points;
                    formatted.type = 'polygon'; // Points varsa polygon olarak işaretle
                    console.log('🔺 Polygon points kaydediliyor:', annotation.points);
                }
                
                return formatted;
            });

            const response = await window.labelingAuth.authenticatedRequest(`${this.getServerURL()}/images/${imageId}/annotations`, {
                method: 'POST',
                body: JSON.stringify({ annotations: formattedAnnotations })
            });

            if (response.ok) {
            console.log('✅ Etiketler kaydedildi');
            } else {
                console.error('❌ Etiketler kaydedilemedi:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('❌ Hata detayı:', errorText);
            }
        } catch (error) {
            console.error('❌ Kaydetme hatası:', error);
        }
    }

    // Proje istatistiklerini güncelle
    async updateProjectStats() {
        if (!window.labelingAuth || !window.labelingAuth.getCurrentProject()) {
            // Kullanıcı giriş yapmamış veya proje seçilmemiş, istatistikleri gizle
            const statsSection = document.getElementById('projectStatsSection');
            if (statsSection) {
                statsSection.style.display = 'none';
            }
            return;
        }

        try {
            // API'den proje istatistiklerini getir
            const projectId = window.labelingAuth.getCurrentProject();
            const response = await window.labelingAuth.authenticatedRequest(
                `${window.labelingAuth.baseURL}/projects/${projectId}/detailed-stats`
            );

            if (response.ok) {
                const stats = await response.json();
                
                // DOM elementlerini güncelle
                const statsSection = document.getElementById('projectStatsSection');
                if (statsSection) {
                    statsSection.style.display = 'block';
                    
                    document.getElementById('totalImages').textContent = stats.project.totalImages || 0;
                    document.getElementById('labeledImages').textContent = stats.project.labeledImages || 0;
                    document.getElementById('totalLabels').textContent = stats.project.totalLabels || 0;
                    document.getElementById('completionRate').textContent = `${stats.project.completionRate || 0}%`;
                    
                    // Label sayılarını güncelle
                    const labelCountsContainer = document.getElementById('labelCounts');
                    if (labelCountsContainer && stats.labelCounts) {
                        labelCountsContainer.innerHTML = '';
                        
                        if (Object.keys(stats.labelCounts).length === 0) {
                            labelCountsContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 12px;">Henüz etiket yok</div>';
                        } else {
                            Object.entries(stats.labelCounts)
                                .sort(([,a], [,b]) => b - a) // Sayıya göre sırala
                                .forEach(([label, count]) => {
                                    const item = document.createElement('div');
                                    item.className = 'label-count-item';
                                    item.innerHTML = `
                                        <span class="label-count-name">${label}</span>
                                        <span class="label-count-value">${count}</span>
                                    `;
                                    labelCountsContainer.appendChild(item);
                                });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ Proje istatistikleri güncellenirken hata:', error);
            // Hata durumunda istatistikleri gizle
            const statsSection = document.getElementById('projectStatsSection');
            if (statsSection) {
                statsSection.style.display = 'none';
            }
        }
    }

    redraw() {
        // Throttle redraw calls to prevent excessive rendering
        const now = Date.now();
        // Büyük dosya sayıları için daha agresif throttle
        const throttleTime = (this.images && this.images.length > 1000) ? 100 : 16; // 1000+ dosya için 10fps, diğerleri için 60fps
        if (!this.needsRedraw && (now - this.lastRedrawTime) < throttleTime) {
            return;
        }
        
        this.needsRedraw = false;
        this.lastRedrawTime = now;

        // CanvasManager modülü ile çizim
        this.canvasManager.redraw();

        
        // Grid ve polygon noktalarını güncelle
        if (this.showGrid) {
            this.updateGridSize();
        }
    }




    drawResizeHandles(annotation) {
        const handleSize = 8;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1;

        // Görsel koordinatlarını canvas koordinatlarına dönüştür
        const canvasCoords = this.imageToCanvasCoords(annotation.x, annotation.y);
        const canvasWidth = annotation.width * this.zoom;
        const canvasHeight = annotation.height * this.zoom;

        // 8 köşe/kenar handle'ı (canvas koordinatlarında)
        const handles = [
            { x: canvasCoords.x, y: canvasCoords.y }, // Sol üst
            { x: canvasCoords.x + canvasWidth / 2, y: canvasCoords.y }, // Üst orta
            { x: canvasCoords.x + canvasWidth, y: canvasCoords.y }, // Sağ üst
            { x: canvasCoords.x + canvasWidth, y: canvasCoords.y + canvasHeight / 2 }, // Sağ orta
            { x: canvasCoords.x + canvasWidth, y: canvasCoords.y + canvasHeight }, // Sağ alt
            { x: canvasCoords.x + canvasWidth / 2, y: canvasCoords.y + canvasHeight }, // Alt orta
            { x: canvasCoords.x, y: canvasCoords.y + canvasHeight }, // Sol alt
            { x: canvasCoords.x, y: canvasCoords.y + canvasHeight / 2 } // Sol orta
        ];

        handles.forEach(handle => {
            this.ctx.fillRect(
                handle.x - handleSize / 2, 
                handle.y - handleSize / 2, 
                handleSize, 
                handleSize
            );
            this.ctx.strokeRect(
                handle.x - handleSize / 2, 
                handle.y - handleSize / 2, 
                handleSize, 
                handleSize
            );
        });
    }

    drawPolygonHandles(annotation) {
        const handleSize = 8;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1;

        // Polygon noktalarını canvas koordinatlarına dönüştür
        const canvasPoints = annotation.points.map(point => 
            this.imageToCanvasCoords(point.x, point.y)
        );

        canvasPoints.forEach(point => {
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, handleSize / 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        });
    }

    canvasToImageCoordinates(canvasX, canvasY) {
        // Canvas koordinatlarını orijinal resim koordinatlarına çevir
        // Mevcut zoom ve pan sistemini kullan
        const imageX = (canvasX - this.panX) / this.zoom;
        const imageY = (canvasY - this.panY) / this.zoom;
        return { x: imageX, y: imageY };
    }

    cropAnnotation(annotation) {
        if (!this.image) return null;

        // Yeni bir canvas oluştur kırpma için
        const cropCanvas = document.createElement('canvas');
        const cropCtx = cropCanvas.getContext('2d');

        let cropData = null;

        if (annotation.type === 'rectangle') {
            // Eğer polygon points varsa, polygon'un bounding box'ını hesapla
            if (annotation.points && annotation.points.length > 0) {
                const xs = annotation.points.map(p => p.x);
                const ys = annotation.points.map(p => p.y);
                const topLeft = { x: Math.min(...xs), y: Math.min(...ys) };
                const bottomRight = { x: Math.max(...xs), y: Math.max(...ys) };
            } else {
                // Normal rectangle koordinatları
            const topLeft = { x: annotation.x, y: annotation.y };
            const bottomRight = { 
                x: annotation.x + annotation.width, 
                y: annotation.y + annotation.height 
            };
            }

            const cropWidth = Math.abs(bottomRight.x - topLeft.x);
            const cropHeight = Math.abs(bottomRight.y - topLeft.y);

            cropCanvas.width = cropWidth;
            cropCanvas.height = cropHeight;

            // Önce arka planı temizle (siyah alanları önlemek için)
            cropCtx.clearRect(0, 0, cropWidth, cropHeight);

            // Orijinal resimden kırp
            cropCtx.drawImage(
                this.image,
                Math.max(0, topLeft.x), Math.max(0, topLeft.y), cropWidth, cropHeight,
                0, 0, cropWidth, cropHeight
            );

            cropData = {
                type: 'rectangle',
                originalCoords: {
                    x: topLeft.x,
                    y: topLeft.y,
                    width: cropWidth,
                    height: cropHeight
                }
            };

        } else if (annotation.type === 'polygon') {
            // Polygon tam resim boyutunda, sadece polygon alanını göster
            console.log('🔍 POLYGON CROP DEBUG:', {
                type: annotation.type,
                points: annotation.points
            });
            
            const imagePoints = annotation.points;
            
            // Canvas boyutunu TAM RESİM boyutuna ayarla
            cropCanvas.width = this.image.width;
            cropCanvas.height = this.image.height;

            // Polygon maskesi oluştur (tam koordinatlar)
            cropCtx.save();
            cropCtx.beginPath();
            imagePoints.forEach((point, index) => {
                if (index === 0) {
                    cropCtx.moveTo(point.x, point.y);
                } else {
                    cropCtx.lineTo(point.x, point.y);
                }
            });
            cropCtx.closePath();
            cropCtx.clip();

            // Orijinal resmi tam boyutta çiz (sadece polygon alanında görünecek)
            cropCtx.drawImage(this.image, 0, 0);
            
            cropCtx.restore();

            cropData = {
                type: 'polygon',
                originalCoords: {
                    width: this.image.width,
                    height: this.image.height,
                    points: imagePoints
                }
            };
        }

        // Canvas'ı base64'e çevir - Hem rectangle hem polygon için JPEG kullan (beyaz arka plan)
        const dataURL = cropCanvas.toDataURL('image/jpeg', 0.9);
        
        return {
            dataURL: dataURL,
            cropData: cropData,
            label: annotation.label
        };
    }

    async cropAndSaveAll() {
        try {
            // ImageManager kontrolü
            if (!this.imageManager) {
                this.showError('ImageManager bulunamadı! Lütfen önce bir proje seçin.');
                return;
            }

            if (!this.imageManager.currentProject) {
                this.showError('Aktif proje bulunamadı! Lütfen önce bir proje seçin.');
                return;
            }

            // ExportManager kontrolü
            if (!this.exportManager) {
                this.showError('ExportManager bulunamadı! Lütfen sayfayı yenileyin.');
                return;
            }

            // Yeni Save As yöntemi ile kırp ve kaydet
            await this.exportManager.cropAndSaveAs();
            
        } catch (error) {
            console.error('Crop and Save All hatası:', error);
            this.showError('Kırpma işlemi sırasında hata oluştu: ' + error.message);
        }
    }

    // Normal Save - Eski sistem gibi klasör yapısı
    async normalSave() {
        try {
            console.log('💾 Normal Save başlatılıyor...');
            
            // ImageManager kontrolü
            let imageManager = this.imageManager || window.labelingTool?.imageManager;
            
            if (!imageManager) {
                console.error('❌ ImageManager bulunamadı');
                this.showError('ImageManager bulunamadı! Lütfen önce bir proje seçin.');
                return;
            }
            
            if (!imageManager.auth) {
                if (window.labelingTool?.auth) {
                    imageManager.auth = window.labelingTool.auth;
                } else if (window.labelingAuth) {
                    imageManager.auth = window.labelingAuth;
                } else {
                    this.showError('Auth objesi bulunamadı! Lütfen sayfayı yenileyin.');
                    return;
                }
            }

            if (!imageManager.currentProject) {
                console.error('❌ Aktif proje bulunamadı');
                console.error('❌ imageManager detayları:', {
                    currentProject: imageManager.currentProject,
                    totalImages: imageManager.totalImages,
                    currentImageIndex: imageManager.currentImageIndex
                });
                
                // Mevcut projeleri kontrol et
                console.log('🔍 Mevcut projeler kontrol ediliyor...');
                try {
                    const projectsResponse = await imageManager.auth.authenticatedRequest(`${imageManager.baseURL}/projects`);
                    if (projectsResponse.ok) {
                        const projects = await projectsResponse.json();
                        console.log('📁 Mevcut projeler:', projects);
                        
                        if (projects.length > 0) {
                            console.log('📁 İlk proje seçiliyor:', projects[0]);
                            await imageManager.setProject(projects[0].id);
                            
                            // Tekrar kontrol et
                            if (imageManager.currentProject) {
                                console.log('✅ Proje başarıyla seçildi:', imageManager.currentProject);
                            } else {
                                this.showError('Proje seçilemedi! Lütfen manuel olarak bir proje seçin.');
                return;
            }
        } else {
                            this.showError('Hiç proje bulunamadı! Lütfen önce bir proje oluşturun.');
                            return;
                        }
                    } else {
                        this.showError('Projeler alınamadı! Lütfen sayfayı yenileyin.');
                        return;
                    }
                } catch (error) {
                    console.error('❌ Proje kontrol hatası:', error);
                    this.showError('Proje kontrol edilemedi! Lütfen sayfayı yenileyin.');
                return;
            }
        }

            this.showInfo('Normal formatında dataset hazırlanıyor...');

            // Proje verilerini al
            const projectId = imageManager.currentProject.id;
            const response = await imageManager.auth.authenticatedRequest(
                `${imageManager.baseURL}/projects/${projectId}/export-data`
            );

            if (!response.ok) {
                this.showError('Proje verileri alınamadı!');
                return;
            }

            const projectData = await response.json();
            const { images, annotations } = projectData;
            
            if (images.length === 0) {
                this.showWarning('Projede hiç resim bulunamadı!');
                return;
            }

            // ZIP dosyası oluştur
            const zip = new JSZip();
            const projectName = imageManager.currentProject.name || 'project';
            
            // Klasör yapısı: proje/images/images_name/etiketler/
            for (const image of images) {
                const imageAnnotations = annotations[image.id] || [];
                if (imageAnnotations.length === 0) continue;
                
                // Resim dosyasını al
                const imageResponse = await imageManager.auth.authenticatedRequest(
                    `${imageManager.baseURL}/images/${image.id}/file`
                );
                
                if (!imageResponse.ok) continue;
                
                const imageBlob = await imageResponse.blob();
                const imageName = image.fileName || image.file_name;
                const imageNameWithoutExt = imageName.replace(/\.[^/.]+$/, "");
                
                // Her etiket için klasör oluştur
                for (let i = 0; i < imageAnnotations.length; i++) {
                    const annotation = imageAnnotations[i];
                    const labelName = annotation.label || annotation.label_name || 'unknown';
                    
                    
                    // Klasör yapısı: proje/images/images_name/etiketler/
                    const folderPath = `${projectName}/images/${imageNameWithoutExt}/etiketler/`;
                    const fileName = `${labelName}_${i + 1}.jpg`;
                    
                    // Kırpılmış resmi oluştur
                    const croppedImage = await this.cropImageFromAnnotation(imageBlob, annotation);
                    if (croppedImage) {
                        zip.file(`${folderPath}${fileName}`, croppedImage);
                    }
                }
            }
            
            // ZIP'i blob olarak oluştur
            const content = await zip.generateAsync({type: "blob"});
            
            // Dosya adını oluştur
            const fileName = `${projectName}_normal_dataset.zip`;
            
            // Kullanıcıdan dosya konumu seçmesini iste
            if ('showSaveFilePicker' in window) {
                try {
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: fileName,
                        types: [{
                            description: 'ZIP dosyaları',
                            accept: {
                                'application/zip': ['.zip']
                            }
                        }]
                    });
                    
                    const writable = await fileHandle.createWritable();
                    await writable.write(content);
                    await writable.close();
                    
                    this.showInfo(`Normal dataset başarıyla kaydedildi!\nProje: ${projectName}\nToplam resim: ${images.length}`);
                    
                } catch (error) {
                    if (error.name === 'AbortError') {
                        this.showInfo('Kaydetme iptal edildi.');
                        return;
                    }
                    throw error;
                }
            } else {
                // Eski tarayıcılar için fallback
                this.fallbackDownload(content, fileName);
            }
            
        } catch (error) {
            console.error('❌ Normal Save hatası:', error);
            this.showError('Normal save sırasında hata oluştu: ' + error.message);
        }
    }

    // Annotation'dan kırpılmış resim oluştur
    async cropImageFromAnnotation(imageBlob, annotation) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Polygon points varsa, tam resim boyutunda polygon mask ile kırp
                if (annotation.points && annotation.points.length >= 3) {
                    // Canvas tam resim boyutu
                    canvas.width = img.width;
                    canvas.height = img.height;

                    // Polygon maskesi oluştur (tam koordinatlar)
                    ctx.save();
                    ctx.beginPath();
                    annotation.points.forEach((point, index) => {
                        if (index === 0) {
                            ctx.moveTo(point.x, point.y);
                        } else {
                            ctx.lineTo(point.x, point.y);
                        }
                    });
                    ctx.closePath();
                    ctx.clip();

                    // Orijinal resmi tam boyutta çiz (sadece polygon alanında görünecek)
                    ctx.drawImage(img, 0, 0);
                    ctx.restore();
                } else {
                    // Normal rectangle crop
                    const x = annotation.x || 0;
                    const y = annotation.y || 0;
                    const width = annotation.width || 0;
                    const height = annotation.height || 0;
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Beyaz arka plan (JPEG için)
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, width, height);
                    
                    ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
                }
                
                // Canvas'ı blob'a çevir
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.9);
            };
            
            img.onerror = () => {
                console.error('Resim yüklenemedi');
                resolve(null);
            };
            
            img.src = URL.createObjectURL(imageBlob);
        });
    }


    // Eski fonksiyon - kaldırılabilir
    cropPolygonImage(ctx, img, annotation, x, y, width, height) {
        const points = annotation.points || [];
        if (points.length < 3) return;
        
        // Önce tüm canvas'ı siyah yap
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);
        
        // Polygon path'ini oluştur
        ctx.save();
        ctx.beginPath();
        
        // Polygon koordinatlarını relative yap (bounding box'a göre)
        ctx.moveTo(points[0].x - x, points[0].y - y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x - x, points[i].y - y);
        }
        ctx.closePath();
        
        // Polygon'u clip olarak ayarla
        ctx.clip();
        
        // Orijinal resmi çiz (sadece polygon alanında görünecek)
        // Bounding box alanını orijinal resimden kırp ve çiz
        ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
        
        ctx.restore();
    }

    // YOLO Export - ExportManager kullanarak
    async yoloExport() {
        try {
            console.log('🚀 YOLO Export başlatılıyor...');
            
            // ExportManager'ı kontrol et
            if (!window.ExportManager) {
                this.showError('ExportManager bulunamadı! Lütfen sayfayı yenileyin.');
                return;
            }
            
            // ExportManager instance'ı oluştur
            const exportManager = new window.ExportManager(this);
            
            // YOLO export'u başlat
            await exportManager.exportYOLO(0.8, {}, { includeImages: true });
            
        } catch (error) {
            console.error('❌ YOLO Export hatası:', error);
            this.showError('YOLO Export hatası: ' + error.message);
        }
    }

    // YOLO Export - Manuel implementasyon
    async yoloExportManual() {
        try {
            console.log('🚀 YOLO Export (Manuel) başlatılıyor...');
            
            // ImageManager kontrolü
            let imageManager = this.imageManager || window.labelingTool?.imageManager;
            
            if (!imageManager) {
                console.error('❌ ImageManager bulunamadı');
                this.showError('ImageManager bulunamadı! Lütfen önce bir proje seçin.');
                return;
            }
            
            if (!imageManager.auth) {
                console.error('❌ ImageManager.auth bulunamadı');
                console.log('🔍 window.labelingAuth:', window.labelingAuth);
                console.log('🔍 window.labelingTool:', window.labelingTool);
                console.log('🔍 window.labelingTool?.auth:', window.labelingTool?.auth);
                
                // window.labelingTool.auth'u kullanmayı dene
                if (window.labelingTool?.auth) {
                    console.log('🔄 window.labelingTool.auth kullanılıyor');
                    imageManager.auth = window.labelingTool.auth;
                } else if (window.labelingAuth) {
                    console.log('🔄 window.labelingAuth kullanılıyor');
                    imageManager.auth = window.labelingAuth;
                } else {
                    console.error('❌ Hiçbir auth objesi bulunamadı');
                    this.showError('Auth objesi bulunamadı! Lütfen sayfayı yenileyin.');
                    return;
                }
            }

            if (!imageManager.currentProject) {
                console.error('❌ Aktif proje bulunamadı');
                console.error('❌ imageManager detayları:', {
                    currentProject: imageManager.currentProject,
                    totalImages: imageManager.totalImages,
                    currentImageIndex: imageManager.currentImageIndex
                });
                
                // Mevcut projeleri kontrol et
                console.log('🔍 Mevcut projeler kontrol ediliyor...');
                try {
                    const projectsResponse = await imageManager.auth.authenticatedRequest(`${imageManager.baseURL}/projects`);
                    if (projectsResponse.ok) {
                        const projects = await projectsResponse.json();
                        console.log('📁 Mevcut projeler:', projects);
                        
                        if (projects.length > 0) {
                            console.log('📁 İlk proje seçiliyor:', projects[0]);
                            await imageManager.setProject(projects[0].id);
                            
                            // Tekrar kontrol et
                            if (imageManager.currentProject) {
                                console.log('✅ Proje başarıyla seçildi:', imageManager.currentProject);
                            } else {
                                this.showError('Proje seçilemedi! Lütfen manuel olarak bir proje seçin.');
                                return;
                            }
                        } else {
                            this.showError('Hiç proje bulunamadı! Lütfen önce bir proje oluşturun.');
                            return;
                        }
                    } else {
                        this.showError('Projeler alınamadı! Lütfen sayfayı yenileyin.');
                        return;
                    }
                } catch (error) {
                    console.error('❌ Proje kontrol hatası:', error);
                    this.showError('Proje kontrol edilemedi! Lütfen sayfayı yenileyin.');
                    return;
                }
            }

            console.log('✅ ImageManager ve proje kontrolü başarılı');
            console.log('📁 Proje:', imageManager.currentProject);

            this.showInfo('YOLO formatında dataset hazırlanıyor...');

            // Proje verilerini al
            const projectId = imageManager.currentProject.id;
            console.log('📊 Proje verileri alınıyor, Project ID:', projectId);

            // Tek API çağrısı ile tüm proje verilerini al
            const response = await imageManager.auth.authenticatedRequest(
                `${imageManager.baseURL}/projects/${projectId}/export-data`
            );

            if (!response.ok) {
                console.error('❌ Export endpoint hatası:', response.status);
                this.showError('Proje verileri alınamadı!');
                return;
            }

            const projectData = await response.json();
            const { images, annotations } = projectData;
            
            console.log('📊 Alınan resim sayısı:', images.length);
            console.log('📊 Toplam annotation sayısı:', Object.values(annotations).flat().length);

            if (images.length === 0) {
                this.showWarning('Projede hiç resim bulunamadı!');
                return;
            }

            // ZIP dosyası oluştur
            const zip = new JSZip();
            const projectName = imageManager.currentProject.name || 'dataset';
            const datasetFolder = zip.folder(projectName);
            
            // YOLO klasör yapısını oluştur
            const imagesFolder = datasetFolder.folder('images');
            const labelsFolder = datasetFolder.folder('labels');
            const trainImagesFolder = imagesFolder.folder('train');
            const valImagesFolder = imagesFolder.folder('val');
            const trainLabelsFolder = labelsFolder.folder('train');
            const valLabelsFolder = labelsFolder.folder('val');
            
            // Train/Val split hesapla (80/20)
            const shuffledImages = this.shuffleArray([...images]);
            const trainCount = Math.floor(shuffledImages.length * 0.8);
            const trainImages = shuffledImages.slice(0, trainCount);
            const valImages = shuffledImages.slice(trainCount);
            
            console.log(`📊 Train/Val split: ${trainImages.length}/${valImages.length}`);
            
            // Sınıf mapping'i oluştur
            const allLabels = new Set();
            Object.values(annotations).flat().forEach(annotation => {
                allLabels.add(annotation.label);
            });
            const classMapping = {};
            Array.from(allLabels).forEach((label, index) => {
                classMapping[label] = index;
            });
            
            console.log('📊 Sınıf mapping:', classMapping);
            
            // Train set'i işle
            for (const image of trainImages) {
                await this.addImageToYOLO(trainImagesFolder, trainLabelsFolder, image, annotations[image.id] || [], classMapping);
            }
            
            // Val set'i işle
            for (const image of valImages) {
                await this.addImageToYOLO(valImagesFolder, valLabelsFolder, image, annotations[image.id] || [], classMapping);
            }
            
            // classes.txt dosyası oluştur
            const classesContent = Array.from(allLabels).join('\n');
            datasetFolder.file('classes.txt', classesContent);
            
            // data.yaml dosyası oluştur
            const yamlContent = this.createYOLOYaml(classMapping);
            datasetFolder.file('data.yaml', yamlContent);
            
            // ZIP'i blob olarak oluştur
            const content = await zip.generateAsync({type: "blob"});
            
            // Dosya adını oluştur
            const fileName = `${projectName}_yolo_dataset.zip`;
            
            // Otomatik indirme kullan (showSaveFilePicker user activation gerektirir)
            console.log('💾 YOLO dataset oluşturuldu, otomatik indirme başlatılıyor:', fileName);
            this.fallbackDownload(content, fileName);
            
            this.showInfo(`YOLO dataset indirildi!\nToplam: ${images.length} resim\nTrain: ${trainImages.length} resim\nVal: ${valImages.length} resim\nSınıf sayısı: ${allLabels.size}`);
            
        } catch (error) {
            console.error('❌ YOLO Export hatası:', error);
            this.showError('YOLO export sırasında hata oluştu: ' + error.message);
        } finally {
            // Export flag'ini temizle
            this.isExporting = false;
            
            // Orijinal loadImage fonksiyonunu geri yükle
            if (window.imageManager && typeof originalLoadImage !== 'undefined') {
                window.imageManager.loadImage = originalLoadImage;
            }
            
            // Orijinal selectWeatherFilter fonksiyonunu geri yükle
            if (typeof originalSelectWeatherFilter !== 'undefined') {
                this.selectWeatherFilter = originalSelectWeatherFilter;
            }
            
            // Orijinal loadWeatherFilter fonksiyonunu geri yükle
            if (typeof originalLoadWeatherFilter !== 'undefined') {
                this.loadWeatherFilter = originalLoadWeatherFilter;
            }
            
            // Orijinal updateWeatherFilterUI fonksiyonunu geri yükle
            if (typeof originalUpdateWeatherFilterUI !== 'undefined') {
                this.updateWeatherFilterUI = originalUpdateWeatherFilterUI;
            }
            
            // Orijinal redraw fonksiyonunu geri yükle
            if (typeof originalRedraw !== 'undefined') {
                this.redraw = originalRedraw;
            }
            
            // Export tamamlandıktan sonra sayfayı yeniden başlat
            console.log('🔄 Export tamamlandı, sayfa yeniden başlatılıyor...');
            
            // DEBUG: Sayfa yenileme geçici olarak devre dışı
            console.log('🔍 DEBUG: Sayfa yenileme devre dışı, filtreleri kontrol et');
            // setTimeout(() => {
            //     console.log('🔄 Sayfa yenileniyor...');
            //     window.location.reload();
            // }, 3000);
        }
    }

    // Yardımcı fonksiyonlar
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    async addImageToYOLO(imagesFolder, labelsFolder, image, imageAnnotations, classMapping) {
        console.log('📷 addImageToYOLO çağrıldı:', {
            imageFileName: image.fileName,
            imageId: image.id,
            annotationsCount: imageAnnotations.length,
            currentImageId: window.imageManager?.currentImage?.id
        });
        
        // Resim dosyasını ekle - filtrelenmiş hali ile
        const imageManager = this.imageManager || window.labelingTool?.imageManager;
        
        // Önce weather filter'ı kontrol et
        let imageBlob;
        try {
            const filterResponse = await imageManager.auth.authenticatedRequest(
                `${imageManager.baseURL}/images/${image.id}/weather-filter`
            );
            
            if (filterResponse.ok) {
                const filterData = await filterResponse.json();
                if (filterData.weatherFilter && 
                    filterData.weatherFilter.filter_data && 
                    filterData.weatherFilter.filter_data.type && 
                    filterData.weatherFilter.filter_data.type !== 'null' && 
                    filterData.weatherFilter.filter_data.type !== null) {
                    // Filtrelenmiş resmi al
                    console.log(`🌤️ Filtrelenmiş resim export ediliyor: ${image.fileName} (${filterData.weatherFilter.filter_data.type})`);
                    imageBlob = await this.getFilteredImageBlob(image, filterData.weatherFilter.filter_data.type);
                } else {
                    // Orijinal resmi al (null, "null" veya boş değerler için)
                    console.log(`📷 Orijinal resim export ediliyor: ${image.fileName} (filter: ${filterData.weatherFilter?.filter_data?.type || 'none'})`);
        const imageResponse = await imageManager.auth.authenticatedRequest(
            `${imageManager.baseURL}/images/${image.id}/file`
        );
        if (imageResponse.ok) {
                        imageBlob = await imageResponse.blob();
                    }
                }
            } else {
                // Orijinal resmi al
                const imageResponse = await imageManager.auth.authenticatedRequest(
                    `${imageManager.baseURL}/images/${image.id}/file`
                );
                if (imageResponse.ok) {
                    imageBlob = await imageResponse.blob();
                }
            }
        } catch (error) {
            console.log('⚠️ Weather filter kontrolü başarısız, orijinal resim kullanılıyor:', error);
            // Hata durumunda orijinal resmi al
            const imageResponse = await imageManager.auth.authenticatedRequest(
                `${imageManager.baseURL}/images/${image.id}/file`
            );
            if (imageResponse.ok) {
                imageBlob = await imageResponse.blob();
            }
        }
        
        if (imageBlob) {
            imagesFolder.file(image.fileName, imageBlob);
        }

        // Label dosyasını oluştur
        const labelContent = this.createYOLLabelFile(imageAnnotations, classMapping);
        const labelFileName = image.fileName.replace(/\.[^/.]+$/, '.txt');
        labelsFolder.file(labelFileName, labelContent);
    }

    async getFilteredImageBlob(image, filterType) {
        try {
            console.log('🎨 getFilteredImageBlob çağrıldı:', { image: image.fileName, filterType });
            
            // Orijinal resmi al
            const imageManager = this.imageManager || window.labelingTool?.imageManager;
            const imageResponse = await imageManager.auth.authenticatedRequest(
                `${imageManager.baseURL}/images/${image.id}/file`
            );
            
            if (!imageResponse.ok) {
                throw new Error('Orijinal resim alınamadı');
            }
            
            const originalBlob = await imageResponse.blob();
            console.log('📷 Orijinal resim alındı, boyut:', originalBlob.size);
            
            // Canvas oluştur ve resmi yükle
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            return new Promise((resolve, reject) => {
                img.onload = () => {
                    console.log('🖼️ Resim yüklendi, boyutlar:', img.width, 'x', img.height);
                    
                    // Canvas boyutunu ayarla
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    // Orijinal resmi çiz
                    ctx.drawImage(img, 0, 0);
                    console.log('🎨 Orijinal resim canvas\'a çizildi');
                    
                    // Weather filter uygula - AYRI FONKSİYON KULLAN
                    if (filterType && filterType !== 'none') {
                        console.log('🌤️ Weather filter uygulanıyor:', filterType);
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        console.log('📊 ImageData alındı, boyutlar:', imageData.width, 'x', imageData.height);
                        
                        // Export için ayrı filtre fonksiyonu kullan
                        this.applyWeatherFilterForExport(imageData, filterType);
                        console.log('✅ Weather filter uygulandı');
                        
                        ctx.putImageData(imageData, 0, 0);
                        console.log('🔄 Filtrelenmiş ImageData canvas\'a geri konuldu');
                    } else {
                        console.log('ℹ️ Filter yok veya none, orijinal resim kullanılıyor');
                    }
                    
                    // Canvas'ı blob'a çevir
                    canvas.toBlob((blob) => {
                        if (blob) {
                            console.log('💾 Canvas blob\'a çevrildi, boyut:', blob.size);
                            resolve(blob);
                        } else {
                            console.error('❌ Canvas blob\'a çevrilemedi');
                            reject(new Error('Canvas blob\'a çevrilemedi'));
                        }
                    }, 'image/jpeg', 0.9);
                };
                
                img.onerror = () => {
                    console.error('❌ Resim yüklenemedi');
                    reject(new Error('Resim yüklenemedi'));
                };
                
                img.src = URL.createObjectURL(originalBlob);
            });
            
        } catch (error) {
            console.error('❌ Filtrelenmiş resim oluşturma hatası:', error);
            throw error;
        }
    }

    createYOLLabelFile(annotations, classMapping) {
        let content = '';
        
        for (const annotation of annotations) {
            const classId = classMapping[annotation.label] || 0;
            
            // YOLO format: class_id center_x center_y width height (normalized)
            const centerX = (annotation.x + annotation.width / 2) / annotation.imageWidth;
            const centerY = (annotation.y + annotation.height / 2) / annotation.imageHeight;
            const width = annotation.width / annotation.imageWidth;
            const height = annotation.height / annotation.imageHeight;
            
            content += `${classId} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}\n`;
        }
        
        return content;
    }

    createYOLOYaml(classMapping) {
        const classes = Object.keys(classMapping).sort((a, b) => classMapping[a] - classMapping[b]);
        
        return `# YOLO Dataset Configuration
path: ./
train: images/train
val: images/val

nc: ${classes.length}
names: [${classes.map(c => `'${c}'`).join(', ')}]`;
    }

    fallbackDownload(content, fileName) {
        const blobUrl = URL.createObjectURL(content);
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = fileName;
        downloadLink.style.display = 'none';
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
        }, 1000);
        
        this.showInfo('Dosya indirildi! Tarayıcınızın indirme klasörünü kontrol edin.');
    }

    downloadBlob(blob, fileName) {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
    }

    // ZIP dosyasını indir
    async saveToSelectedFolder(zip, projectName) {
        try {
            // ZIP dosyasını oluştur
            const content = await zip.generateAsync({type: "blob"});
            
            // Direkt indirme yap
            this.downloadBlob(content, `${projectName}_dataset.zip`);
            this.showInfo('ZIP dosyası indirildi.');
            
        } catch (error) {
            console.error('İndirme hatası:', error);
            this.showError('ZIP dosyası oluşturulurken hata oluştu.');
        }
    }

    generateMetadata(projectName) {
        if (this.isMultiImageMode) {
            // Çoklu fotoğraf modunda tüm annotation'ları topla
            const allAnnotations = [];
            const labelCounts = {};
            
            for (let imageIndex = 0; imageIndex < (this.images ? this.images.length : 0); imageIndex++) {
                const imageData = this.images[imageIndex];
                const imageAnnotations = this.imageAnnotations[imageIndex] || [];
                
                imageAnnotations.forEach(annotation => {
                    const croppedImage = this.croppedImages.find(img => 
                        img.annotationId === annotation.id && img.imageIndex === imageIndex
                    );
                    
                    allAnnotations.push({
                        id: annotation.id,
                        label: annotation.label,
                        type: annotation.type,
                        imageIndex: imageIndex,
                        imageName: imageData.name,
                        coordinates: annotation.points && annotation.points.length > 0 ? {
                            points: annotation.points
                        } : {
                            x: annotation.x,
                            y: annotation.y,
                            width: annotation.width,
                            height: annotation.height
                        },
                        croppedImage: croppedImage ? {
                            fileName: croppedImage.fileName,
                            filePath: croppedImage.filePath,
                            originalCoords: croppedImage.cropData.originalCoords
                        } : null
                    });
                    
                    // Label sayılarını hesapla
                    labelCounts[annotation.label] = (labelCounts[annotation.label] || 0) + 1;
                });
            }
            
            return {
                project: {
                    name: projectName,
                    created: new Date().toISOString(),
                    mode: 'multi-image',
                    totalImages: this.images ? this.images.length : 0,
                    images: this.images.map((img, index) => ({
                        index: index,
                        name: img.name,
                        width: img.image.width,
                        height: img.image.height,
                        annotationCount: this.imageAnnotations[index] ? this.imageAnnotations[index].length : 0
                    }))
                },
                annotations: allAnnotations,
                summary: {
                    totalAnnotations: allAnnotations.length,
                    totalCroppedImages: this.croppedImages.length,
                    totalImages: this.images ? this.images.length : 0,
                    labelCounts: labelCounts
                }
            };
        } else {
            // Tek fotoğraf modunda
            return {
                project: {
                    name: projectName,
                    created: new Date().toISOString(),
                    mode: 'single-image',
                    image: this.image ? {
                        width: this.image.width,
                        height: this.image.height
                    } : null
                },
                annotations: this.annotations.map(annotation => {
                    const croppedImage = this.croppedImages.find(img => img.annotationId === annotation.id);
                    return {
                        id: annotation.id,
                        label: annotation.label,
                        type: annotation.type,
                        coordinates: annotation.points && annotation.points.length > 0 ? {
                            points: annotation.points
                        } : {
                            x: annotation.x,
                            y: annotation.y,
                            width: annotation.width,
                            height: annotation.height
                        },
                        croppedImage: croppedImage ? {
                            fileName: croppedImage.fileName,
                            filePath: croppedImage.filePath,
                            originalCoords: croppedImage.cropData.originalCoords
                        } : null
                    };
                }),
                summary: {
                    totalAnnotations: this.annotations.length,
                    totalCroppedImages: this.croppedImages.length,
                    labelCounts: this.annotations.reduce((acc, ann) => {
                        acc[ann.label] = (acc[ann.label] || 0) + 1;
                        return acc;
                    }, {})
                }
            };
        }
    }

    // Export fonksiyonları ExportManager'a taşındı

    // Export fonksiyonları ExportManager'a taşındı


    // Utility manager instance
    get utilityManager() {
        if (!this._utilityManager) {
            this._utilityManager = new UtilityManager(this);
        }
        return this._utilityManager;
    }

    // Optimized image switching with caching
    async switchToImageOptimized(index) {
        // ImageManager'dan fotoğrafları al
        if (this.imageManager && this.imageManager.images) {
            this.images = this.imageManager.images;
        }
        
        if (!this.isMultiImageMode || index < 0 || index >= (this.images ? this.images.length : 0)) return;
        
        // Prevent multiple simultaneous switches
        if (this.isProcessing) return;
        this.isProcessing = true;

        // Loading göstergesi ekle (sadece tıklandığında)
        this.showImageLoadingIndicator(index);

        try {
            // Mevcut annotationları kaydet
            if (this.imageAnnotations[this.currentImageIndex]) {
                this.imageAnnotations[this.currentImageIndex] = [...this.annotations];
            }

            // Mevcut filtreleri kaydet
            if (this.currentImageIndex >= 0) {
                this.imageFilters[this.currentImageIndex] = {
                    activeFilters: [...this.activeFilters],
                    activeTextures: [...this.activeTextures]
                };
            }

            // Yeni resme geç
            this.currentImageIndex = index;
            
            // ImageManager'daki index'i de güncelle
            if (this.imageManager) {
                this.imageManager.currentImageIndex = index;
            }
            
            const imageInfo = this.images[index];
            
            // Lazy loading: Eğer resim henüz yüklenmemişse yükle
            if (!imageInfo.loaded || !imageInfo.image) {
                await this.loadFullImage(imageInfo);
            }
            
            // Cache'den resmi al veya yükle
            const cacheKey = `image_${index}`;
            if (this.imageCache.has(cacheKey)) {
                this.image = this.imageCache.get(cacheKey);
            } else {
                this.image = imageInfo.image;
                this.imageCache.set(cacheKey, this.image);
            }
            
            // Bu resim için orijinal veriyi kaydet (eğer yoksa)
            this.saveOriginalImageData();
            
            // Bu resmin annotationlarını yükle
            this.annotations = this.imageAnnotations[index] || [];
            
            // Bu resmin filtrelerini yükle (debounced)
            this.debouncedLoadImageFilters(index);
            
            // UI'yi güncelle (throttled)
            this.throttledUpdateUI();
            
            // Proje durumunu kaydet (resim değişti)
            this.saveProject();
            
        } finally {
            this.isProcessing = false;
            this.hideImageLoadingIndicator();
        }
    }

    showImageLoadingIndicator(index) {
        // Thumbnail'da loading göstergesi ekle
        const thumbnails = document.querySelectorAll('.image-thumbnail');
        if (thumbnails[index]) {
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'image-loading-indicator';
            loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            loadingIndicator.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: var(--accent-primary);
                font-size: 16px;
                z-index: 10;
                background: rgba(0, 0, 0, 0.7);
                border-radius: 50%;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            thumbnails[index].appendChild(loadingIndicator);
        }
    }

    hideImageLoadingIndicator() {
        // Tüm loading göstergelerini kaldır
        const loadingIndicators = document.querySelectorAll('.image-loading-indicator');
        loadingIndicators.forEach(indicator => indicator.remove());
    }

    async loadFullImage(imageInfo) {
        if (imageInfo.loaded && imageInfo.image) {
            return; // Zaten yüklenmiş
        }

        try {
            // Tam resmi yükle
            const imageData = await this.loadImageFileOptimized(imageInfo.file);
            
            // ImageInfo'yu güncelle
            imageInfo.image = imageData.image;
            imageInfo.dataURL = imageData.dataURL;
            imageInfo.loaded = true;
            
            // Cache'e ekle
            const cacheKey = `image_${imageInfo.index}`;
            this.imageCache.set(cacheKey, imageData.image);
            
        } catch (error) {
            console.error(`Tam resim yükleme hatası (${imageInfo.name}):`, error);
            this.showWarning(`Resim yüklenemedi: ${imageInfo.name}`);
        }
    }

    // Debounced filter loading
    debouncedLoadImageFilters = this.utilityManager.debounce((index) => {
        this.loadImageFilters(index);
    }, 100, 'loadFilters');

    // Throttled UI update - büyük dosya sayıları için daha agresif throttle
    throttledUpdateUI = this.utilityManager.throttle(() => {
        this.updateImageList();
        this.updateImageNavigation();
        this.updateAnnotationList();
        this.updateFilterUI();
        this.resizeCanvas();
        // Resim değiştiğinde otomatik ortala
        this.zoomToPhoto();
    }, (this.images && this.images.length > 1000) ? 200 : 50, 'updateUI');

    // Cache management
    clearImageCache() {
        this.imageCache.clear();
    }

    clearFilterCache() {
        this.filterCache.clear();
    }

    clearAllCaches() {
        this.clearImageCache();
        this.clearFilterCache();
    }

    // Memory management - call this periodically
    manageMemory() {
        // Büyük dosya sayıları için çok daha agresif bellek temizleme
        const maxCacheSize = (this.images && this.images.length > 1000) ? 5 : 20;
        
        // Clear old cache entries if memory usage is high
        if (this.imageCache.size > maxCacheSize) {
            const keys = Array.from(this.imageCache.keys());
            // Sadece mevcut resim hariç diğerlerini temizle
            const currentKey = `image_${this.currentImageIndex}`;
            for (let i = 0; i < keys.length; i++) {
                if (keys[i] !== currentKey) {
                this.imageCache.delete(keys[i]);
                }
            }
        }
        
        if (this.filterCache.size > 10) {
            const keys = Array.from(this.filterCache.keys());
            for (let i = 0; i < Math.floor(keys.length / 2); i++) {
                this.filterCache.delete(keys[i]);
            }
        }
        
        // Garbage collection'ı tetikle
        if (this.images && this.images.length > 1000) {
            this.forceGarbageCollection();
        }
    }

    forceGarbageCollection() {
        // Bellek temizliği için garbage collection'ı tetikle
        if (window.gc) {
            window.gc();
        }
        
        // Büyük objeleri temizle
        this.images.forEach((imageData, index) => {
            if (index !== this.currentImageIndex && imageData.image) {
                // Mevcut resim hariç diğerlerinin image objelerini temizle
                imageData.image = null;
                imageData.dataURL = null;
            }
        });
    }

    // Koordinat gösterimi metodları
    updateCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.round(e.clientX - rect.left);
        const y = Math.round(e.clientY - rect.top);
        
        // Resim koordinatlarına dönüştür (zoom ve pan dikkate alınarak)
        const imageX = Math.round((x - this.panX) / this.zoom);
        const imageY = Math.round((y - this.panY) / this.zoom);
        
        // Koordinatları güncelle
        const coordX = document.getElementById('coordX');
        const coordY = document.getElementById('coordY');
        
        if (coordX && coordY) {
            coordX.textContent = imageX;
            coordY.textContent = imageY;
        }
        
        // Fullscreen crosshair pozisyonunu güncelle
        this.updateFullscreenCrosshairPosition(x, y);
    }

    showCoordinates() {
        const coordinatesDisplay = document.getElementById('coordinatesDisplay');
        if (coordinatesDisplay) {
            coordinatesDisplay.classList.remove('hidden');
        }
    }

    hideCoordinates() {
        const coordinatesDisplay = document.getElementById('coordinatesDisplay');
        if (coordinatesDisplay) {
            coordinatesDisplay.classList.add('hidden');
        }
    }

    // Grid Display Methods
    updateGridDisplay() {
        const gridOverlay = document.getElementById('gridOverlay');
        if (gridOverlay) {
            if (this.showGrid) {
                gridOverlay.style.display = 'block';
                this.updateGridSize();
            } else {
                gridOverlay.style.display = 'none';
            }
        }
    }

    updateGridSize() {
        if (!this.showGrid || !this.image) return;
        
        const majorGrid = document.getElementById('majorGrid');
        const minorGrid = document.getElementById('minorGrid');
        
        if (majorGrid && minorGrid) {
            // Zoom seviyesine göre grid boyutunu ayarla
            const scaledGridSize = this.gridSize * this.zoom;
            const scaledMajorSize = this.majorGridSize * this.zoom;
            
            majorGrid.style.backgroundSize = `${scaledMajorSize}px ${scaledMajorSize}px`;
            minorGrid.style.backgroundSize = `${scaledGridSize}px ${scaledGridSize}px`;
        }
    }

    // Polygon sistemi kaldırıldı

    // Polygon sistemi kaldırıldı

    // Polygon sistemi kaldırıldı

    // Polygon sistemi kaldırıldı

    // Polygon sistemi kaldırıldı

    // Canvas Cursor Update
    updateCanvasCursor() {
        if (this.canvas) {
        if (this.canvas) {
        this.canvas.style.cursor = 'crosshair';
            this.canvas.style.outline = 'none';
        }
            this.canvas.style.outline = 'none';
        }
    }

    // Polygon sistemi kaldırıldı

    // Improved Photo-Only Zoom
    zoomToPhoto() {
        if (!this.image) return;
        
        const container = this.canvas.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        const imageAspect = this.image.naturalWidth / this.image.naturalHeight;
        const containerAspect = containerWidth / containerHeight;
        
        let scale;
        if (imageAspect > containerAspect) {
            // Resim daha geniş - genişliğe göre ölçekle
            scale = (containerWidth - 20) / this.image.naturalWidth;
        } else {
            // Resim daha yüksek - yüksekliğe göre ölçekle
            scale = (containerHeight - 20) / this.image.naturalHeight;
        }
        
        // Maksimum %100 zoom, minimum %10 zoom
        this.zoom = Math.min(Math.max(scale, 0.1), 1.0);
        
        // Resmi ortala
        const scaledWidth = this.image.naturalWidth * this.zoom;
        const scaledHeight = this.image.naturalHeight * this.zoom;
        this.panX = (containerWidth - scaledWidth) / 2;
        this.panY = (containerHeight - scaledHeight) / 2;
        
        this.redraw();
        this.updateGridSize();
    }

    // Fullscreen Crosshair Methods
    showFullscreenCrosshairCursor() {
        if (!this.showFullscreenCrosshair) return;
        
        const crosshair = document.getElementById('fullscreenCrosshair');
        if (crosshair) {
            crosshair.style.display = 'block';
            this.crosshairVisible = true;
        }
        
        // Canvas cursor'ını gizle
        this.canvas.style.cursor = 'none';
    }

    hideFullscreenCrosshairCursor() {
        const crosshair = document.getElementById('fullscreenCrosshair');
        if (crosshair) {
            crosshair.style.display = 'none';
            this.crosshairVisible = false;
        }
        
        // Canvas cursor'ını geri getir
        if (this.canvas) {
        if (this.canvas) {
        this.canvas.style.cursor = 'crosshair';
            this.canvas.style.outline = 'none';
        }
            this.canvas.style.outline = 'none';
        }
    }

    updateFullscreenCrosshairPosition(x, y) {
        if (!this.crosshairVisible) return;
        
        const crosshairVertical = document.getElementById('crosshairVertical');
        const crosshairHorizontal = document.getElementById('crosshairHorizontal');
        const crosshairCenter = document.getElementById('crosshairCenter');
        
        if (crosshairVertical && crosshairHorizontal && crosshairCenter) {
            // Dikey çizgiyi mouse X pozisyonuna ayarla
            crosshairVertical.style.left = `${x}px`;
            
            // Yatay çizgiyi mouse Y pozisyonuna ayarla
            crosshairHorizontal.style.top = `${y}px`;
            
            // Merkez noktayı mouse pozisyonuna ayarla
            crosshairCenter.style.left = `${x}px`;
            crosshairCenter.style.top = `${y}px`;
        }
    }

    // Favori Etiket Fonksiyonları
    async showFavoriteLabelsModal() {
        const modal = document.getElementById('favoriteLabelsModal');
        const input = document.getElementById('newFavoriteInput');
        
        if (!modal) {
            console.error('❌ favoriteLabelsModal bulunamadı!');
            return;
        }
        
        if (!input) {
            console.error('❌ newFavoriteInput bulunamadı!');
            return;
        }
        
        // Favori etiketleri yükle
        console.log('🔍 Modal açılıyor, favori etiketler yükleniyor...');
        await this.loadFavoriteLabels();
        console.log('✅ Modal açıldı, favori etiketler:', this.favoriteLabels);
        
        modal.classList.add('show');
        input.focus();
        input.value = '';
    }

    closeFavoriteLabelsModal() {
        const modal = document.getElementById('favoriteLabelsModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    showShortcutsModal() {
        const modal = document.getElementById('shortcutsModal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    closeShortcutsModal() {
        const modal = document.getElementById('shortcutsModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    async addFavoriteFromModal() {
        const input = document.getElementById('newFavoriteInput');
        const labelName = input.value.trim();
        
        if (!labelName) {
            this.showInfo('Lütfen etiket adı girin!');
            return;
        }

        // Aynı isimde favori var mı kontrol et
        if (this.favoriteLabels.includes(labelName)) {
            this.showInfo('Bu etiket zaten favorilerde!');
            return;
        }

        try {
            const projectId = window.labelingAuth?.currentProject?.id;
            if (!projectId) {
                this.showError('Proje bilgisi bulunamadı!');
                return;
            }

            const response = await fetch(`${this.getServerURL()}/projects/${projectId}/favorite-labels`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ labelName: labelName })
            });

            if (response.ok) {
        this.favoriteLabels.push(labelName);
        this.updateFavoriteLabelsList();
        input.value = '';
        this.showInfo(`"${labelName}" favorilere eklendi!`);
            } else {
                const error = await response.json();
                this.showError(error.error || 'Favori etiket eklenemedi!');
            }
        } catch (error) {
            console.error('❌ Favori etiket ekleme hatası:', error);
            this.showError('Favori etiket eklenemedi!');
        }
    }

    async removeFavoriteLabel(labelName) {
        try {
            const projectId = window.labelingAuth?.currentProject?.id;
            if (!projectId) {
                this.showError('Proje bilgisi bulunamadı!');
                return;
            }

            const response = await fetch(`${this.getServerURL()}/projects/${projectId}/favorite-labels/${encodeURIComponent(labelName)}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
        const index = this.favoriteLabels.indexOf(labelName);
        if (index > -1) {
            this.favoriteLabels.splice(index, 1);
            this.updateFavoriteLabelsList();
            this.showInfo(`"${labelName}" favorilerden kaldırıldı!`);
                }
            } else {
                const error = await response.json();
                this.showError(error.error || 'Favori etiket silinemedi!');
            }
        } catch (error) {
            console.error('❌ Favori etiket silme hatası:', error);
            this.showError('Favori etiket silinemedi!');
        }
    }

    updateFavoriteLabelsList() {
        const container = document.getElementById('favoriteLabelsList');
        if (!container) return;

        container.innerHTML = '';

        if (this.favoriteLabels.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); font-style: italic; text-align: center; padding: 20px;">Henüz favori etiket yok</div>';
            return;
        }

        this.favoriteLabels.forEach(labelName => {
            const favoriteItem = document.createElement('div');
            favoriteItem.className = 'favorite-item';
            favoriteItem.innerHTML = `
                <div class="favorite-item-content">
                    <i class="fas fa-star favorite-item-icon"></i>
                    <span class="favorite-item-name">#${labelName}</span>
                </div>
                <div class="favorite-item-actions">
                    <button class="favorite-item-btn edit" data-action="use" data-label="${labelName}">Kullan</button>
                    <button class="favorite-item-btn delete" data-action="delete" data-label="${labelName}">Sil</button>
                </div>
            `;
            
            // Event listeners
            const useBtn = favoriteItem.querySelector('[data-action="use"]');
            const deleteBtn = favoriteItem.querySelector('[data-action="delete"]');
            
            useBtn.addEventListener('click', () => {
                this.createLabelFromFavorite(labelName);
            });
            
            deleteBtn.addEventListener('click', () => {
                this.removeFavoriteLabel(labelName);
            });

            container.appendChild(favoriteItem);
        });
    }

    updateFavoriteLabelsDisplay() {
        const container = document.getElementById('favoriteLabels');
        if (!container) return;

        container.innerHTML = '';

        if (this.favoriteLabels.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); font-style: italic; font-size: 0.9em;">Henüz favori etiket yok</div>';
            return;
        }

        this.favoriteLabels.forEach(labelName => {
            const favoriteElement = document.createElement('div');
            favoriteElement.className = 'favorite-label';
            favoriteElement.innerHTML = `
                <i class="fas fa-star favorite-icon"></i>
                <span class="favorite-name">#${labelName}</span>
            `;
            
            // Favori etikete tıklandığında direkt kaydet
            favoriteElement.addEventListener('click', () => {
                this.createLabelFromFavorite(labelName);
            });

            container.appendChild(favoriteElement);
        });
    }

    createLabelFromFavorite(labelName) {
        // Etiket ismi alanına favori etiket adını yaz
        const modalInput = document.getElementById('modalLabelInput');
        if (modalInput) {
            modalInput.value = labelName;
        }
        
        // Otomatik olarak Enter'a basmış gibi davran (confirmNewLabel çağır)
        this.confirmNewLabel();
    }

    showFavoriteLabelsInModal() {
        console.log('🔍 Modal\'da favori etiketler gösteriliyor:', this.favoriteLabels);
        this.updateFavoriteLabelsDisplay();
    }

    async loadFavoriteLabels() {
        try {
            const projectId = window.labelingAuth?.currentProject?.id;
            if (!projectId) {
                console.log('ℹ️ Proje ID bulunamadı, favori etiketler yüklenmiyor');
                this.favoriteLabels = [];
                this.updateFavoriteLabelsList();
                this.updateFavoriteLabelsDisplay();
                return;
            }

            const response = await fetch(`${this.getServerURL()}/projects/${projectId}/favorite-labels`);
            
            if (response.ok) {
                const result = await response.json();
                // Backend'ten gelen object array'ini string array'ine çevir
                this.favoriteLabels = (result.favoriteLabels || []).map(item => item.label_name || item);
                console.log('✅ Favori etiketler yüklendi:', this.favoriteLabels);
                this.updateFavoriteLabelsList();
                this.updateFavoriteLabelsDisplay();
            } else {
                console.log('ℹ️ Favori etiketler yüklenemedi:', response.status);
                this.favoriteLabels = [];
                this.updateFavoriteLabelsList();
                this.updateFavoriteLabelsDisplay();
            }
        } catch (error) {
            console.error('❌ Favori etiket yükleme hatası:', error);
            this.favoriteLabels = [];
            this.updateFavoriteLabelsList();
            this.updateFavoriteLabelsDisplay();
        }
    }

    // Etiket ismini harf durumuna göre dönüştür ve boşlukları _ ile değiştir
    transformLabelName(labelName) {
        if (!labelName) return labelName;
        
        // Önce boşlukları _ ile değiştir
        let transformedName = labelName.replace(/\s+/g, '_');
        
        // Sonra harf durumunu uygula
        switch (this.labelCaseMode) {
            case 'uppercase':
                return transformedName.toUpperCase();
            case 'lowercase':
                return transformedName.toLowerCase();
            case 'original':
            default:
                return transformedName;
        }
    }

    // Export klasörü seç
    async selectExportFolder() {
        try {
            // File System Access API kullanarak klasör seç
            if ('showDirectoryPicker' in window) {
                const directoryHandle = await window.showDirectoryPicker({
                    mode: 'readwrite',
                    startIn: 'documents'
                });
                this.exportFolderPath = directoryHandle.name;
                
                // Input alanını güncelle
                const folderPathInput = document.getElementById('exportFolderPath');
                if (folderPathInput) {
                    folderPathInput.value = this.exportFolderPath;
                }
                
                this.showInfo(`Export klasörü seçildi: ${this.exportFolderPath}`);
                return true;
            } else {
                // Fallback: Basit input dialog
                const folderPath = prompt('Export klasörü yolunu girin (örn: C:\\Users\\Kullanici\\Desktop\\Export):');
                if (folderPath && folderPath.trim()) {
                    this.exportFolderPath = folderPath.trim();
                    
                    // Input alanını güncelle
                    const folderPathInput = document.getElementById('exportFolderPath');
                    if (folderPathInput) {
                        folderPathInput.value = this.exportFolderPath;
                    }
                    
                    this.showInfo(`Export klasörü ayarlandı: ${this.exportFolderPath}`);
                    return true;
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Export klasör seçimi kullanıcı tarafından iptal edildi');
                return false;
            } else {
                console.error('Export klasör seçim hatası:', error);
                this.showWarning('Export klasör seçimi sırasında hata oluştu. Lütfen tekrar deneyin.');
                return false;
            }
        }
        return false;
    }

    // Kırp klasörü seç
    async selectCropFolder() {
        try {
            // File System Access API kullanarak klasör seç
            if ('showDirectoryPicker' in window) {
                const directoryHandle = await window.showDirectoryPicker({
                    mode: 'readwrite',
                    startIn: 'documents'
                });
                this.cropFolderPath = directoryHandle.name;
                this.showInfo(`Kırp klasörü seçildi: ${this.cropFolderPath}`);
                return true;
            } else {
                // Fallback: Basit input dialog
                const folderPath = prompt('Kırp klasörü yolunu girin (örn: C:\\Users\\Kullanici\\Desktop\\Kırpılan_Resimler):');
                if (folderPath && folderPath.trim()) {
                    this.cropFolderPath = folderPath.trim();
                    this.showInfo(`Kırp klasörü ayarlandı: ${this.cropFolderPath}`);
                    return true;
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Klasör seçimi kullanıcı tarafından iptal edildi');
                return false;
            } else {
                console.error('Klasör seçim hatası:', error);
                this.showWarning('Klasör seçimi sırasında hata oluştu. Lütfen tekrar deneyin.');
                return false;
            }
        }
        return false;
    }

}



// Dashboard'a geri dönüş fonksiyonu
function backToDashboard() {
    console.log('🏠 Dashboard\'a dönülüyor...');
    
    try {
        // Electron API'si ile dashboard'a geç
        if (window.electronAPI && window.electronAPI.openDashboard) {
            window.electronAPI.openDashboard().then(result => {
                if (result.success) {
                    console.log('✅ Dashboard\'a geçildi');
                } else {
                    console.error('❌ Dashboard\'a geçiş hatası:', result.error);
                    // Fallback: Sayfa yönlendirme
                    window.location.href = '../dashboard/index.html';
                }
            });
        } else {
            // Fallback: Sayfa yönlendirme
            window.location.href = '../dashboard/index.html';
        }
    } catch (error) {
        console.error('❌ Dashboard\'a dönüş hatası:', error);
        // Fallback: Sayfa yönlendirme
        window.location.href = '../dashboard/index.html';
    }
}

// Uygulamayı başlat - DOM yüklendikten sonra
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM yüklendi, LabelingTool başlatılıyor...');
    
    // Dashboard'a geri dönüş butonu event listener'ı
    const backToDashboardBtn = document.getElementById('backToDashboardBtn');
    if (backToDashboardBtn) {
        backToDashboardBtn.addEventListener('click', backToDashboard);
        console.log('✅ Dashboard geri dönüş butonu event listener eklendi');
    } else {
        console.warn('⚠️ Dashboard geri dönüş butonu bulunamadı');
    }
    
    // Modal elementlerini kontrol et
    console.log('🔍 Modal elementleri kontrol ediliyor...');
    console.log('🔍 labelModal:', document.getElementById('labelModal'));
    console.log('🔍 favoriteLabelsModal:', document.getElementById('favoriteLabelsModal'));
    console.log('🔍 Tüm modal elementleri:', document.querySelectorAll('.modal'));
    
    // Hava durumu filtrelerini kontrol et
    console.log('🌤️ Hava durumu filtreleri kontrol ediliyor...');
    const weatherFilters = document.querySelectorAll('input[data-filter]');
    console.log('🌤️ Bulunan hava durumu filtreleri:', weatherFilters.length);
    weatherFilters.forEach((filter, index) => {
        console.log(`🌤️ Filtre ${index + 1}:`, filter.getAttribute('data-filter'));
    });
    
    console.log('LabelingAuth zaten yüklenmiş');
    window.labelingTool = new LabelingTool();
    console.log('LabelingTool başlatıldı');
});

// Eğer DOM zaten yüklendiyse hemen başlat
if (document.readyState !== 'loading') {
    // DOM zaten yüklendi
    console.log('DOM zaten yüklü, LabelingTool başlatılıyor...');
    
    // Modal elementlerini kontrol et
    console.log('🔍 Modal elementleri kontrol ediliyor...');
    console.log('🔍 labelModal:', document.getElementById('labelModal'));
    console.log('🔍 favoriteLabelsModal:', document.getElementById('favoriteLabelsModal'));
    console.log('🔍 Tüm modal elementleri:', document.querySelectorAll('.modal'));
    
    // Hava durumu filtrelerini kontrol et
    console.log('🌤️ Hava durumu filtreleri kontrol ediliyor...');
    const weatherFilters = document.querySelectorAll('input[data-filter]');
    console.log('🌤️ Bulunan hava durumu filtreleri:', weatherFilters.length);
    weatherFilters.forEach((filter, index) => {
        console.log(`🌤️ Filtre ${index + 1}:`, filter.getAttribute('data-filter'));
    });
    
    console.log('LabelingAuth zaten yüklenmiş');
    window.labelingTool = new LabelingTool();
    console.log('LabelingTool başlatıldı');
}