/**
 * Export Manager Module
 * Handles all export functionality
 */
class ExportManager {
    constructor(labelingTool) {
        this.labelingTool = labelingTool;
        this.setupEventListeners();
    }

    setupEventListeners() {
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

        // Image quality slider
        const imageQuality = document.getElementById('imageQuality');
        if (imageQuality) {
            imageQuality.addEventListener('input', (e) => {
                const qualityValue = document.getElementById('qualityValue');
                if (qualityValue) qualityValue.textContent = e.target.value + '%';
                this.updateExportPreview();
            });
        }

        // Export options change
        ['includeImages', 'includeCrops', 'includeDescriptions', 'normalizeCoordinates', 'includeMetadata', 'compressOutput', 'exportLabelCaseMode'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => this.updateExportPreview());
            }
        });

        // Format change
        document.querySelectorAll('input[name="exportFormat"]').forEach(radio => {
            radio.addEventListener('change', () => this.updateExportPreview());
        });

        // Class mapping buttons
        const autoMapClasses = document.getElementById('autoMapClasses');
        const resetClassMapping = document.getElementById('resetClassMapping');
        if (autoMapClasses) autoMapClasses.addEventListener('click', () => this.autoMapClasses());
        if (resetClassMapping) resetClassMapping.addEventListener('click', () => this.resetClassMapping());

        // Modal dışına tıklama
        window.addEventListener('click', (e) => {
            const exportModal = document.getElementById('exportModal');
            if (e.target === exportModal) this.closeExportModal();
        });
    }

    showExportModal() {
        // Class mapping'i güncelle
        this.updateClassMapping();
        
        // Export preview'ı güncelle
        this.updateExportPreview();
        
        const modal = document.getElementById('exportModal');
        if (modal) modal.classList.add('show');
    }

    closeExportModal() {
        const modal = document.getElementById('exportModal');
        if (modal) modal.classList.remove('show');
    }

    updateClassMapping() {
        const container = document.getElementById('classMapping');
        if (!container) return;
        container.innerHTML = '';

        (this.labelingTool.availableLabels || []).forEach((label, index) => {
            const mappingDiv = document.createElement('div');
            mappingDiv.style.margin = '5px 0';
            mappingDiv.innerHTML = `
                <label style="display: flex; align-items: center; gap: 10px; color: #ecf0f1; font-size: 14px;">
                    <span style="min-width: 100px;">${label}:</span>
                    <input type="number" name="class_${index}" class="input" 
                           style="width: 60px; text-align: center;" 
                           placeholder="ID" min="0" max="999">
                </label>
            `;
            container.appendChild(mappingDiv);
        });
    }

    getClassMapping() {
        const mapping = {};
        (this.labelingTool.availableLabels || []).forEach((label, index) => {
            const input = document.querySelector(`input[name="class_${index}"]`);
            const value = input ? parseInt(input.value) : null;
            if (value !== null && !isNaN(value)) {
                mapping[label] = value;
            }
        });
        return mapping;
    }

    getExportOptions() {
        const getElementValue = (id, defaultValue = false) => {
            const element = document.getElementById(id);
            return element ? element.checked || element.value : defaultValue;
        };

        return {
            includeImages: getElementValue('includeImages', false),
            includeCrops: getElementValue('includeCrops', false),
            includeDescriptions: getElementValue('includeDescriptions', false),
            normalizeCoordinates: getElementValue('normalizeCoordinates', false),
            includeMetadata: getElementValue('includeMetadata', false),
            compressOutput: getElementValue('compressOutput', false),
            imageQuality: parseInt(getElementValue('imageQuality', 100)) / 100,
            exportLabelCaseMode: getElementValue('exportLabelCaseMode', 'original'),
            exportFolderPath: this.labelingTool.exportFolderPath
        };
    }

    updateExportPreview() {
        // Export preview'ı güncelle
        const updateElement = (id, text) => {
            const element = document.getElementById(id);
            if (element) element.textContent = text;
        };

        try {
            // ImageManager kontrolü
            let imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager || window.imageManager;
            
            if (!imageManager) {
                updateElement('exportPreview', '⚠️ ImageManager bulunamadı!');
                return;
            }
            
            if (!imageManager.currentProject) {
                updateElement('exportPreview', '⚠️ Aktif proje yok, preview güncellenemiyor.');
                return;
            }
            
            // Proje bilgilerini al
            const project = imageManager.currentProject;
            const totalImages = project.total_images || 0;
            const labeledImages = project.labeled_images || 0;
            
            // Format bilgisini al
        const formatElement = document.querySelector('input[name="exportFormat"]:checked');
        const format = formatElement ? formatElement.value : 'yolo';
            
            // Train/val split bilgisini al
            const trainSplitElement = document.getElementById('trainSplit');
            const trainSplit = trainSplitElement ? parseInt(trainSplitElement.value) / 100 : 0.8;
            const valSplit = 1 - trainSplit;
            
            // Export seçeneklerini al
            const includeImages = document.getElementById('includeImages')?.checked || true;
            const normalizeCoordinates = document.getElementById('normalizeCoordinates')?.checked || true;
            
            // Preview metnini oluştur
            let previewText = `📊 Proje: ${project.name}\n`;
            previewText += `📈 Toplam Resim: ${totalImages}\n`;
            previewText += `🏷️ Etiketli Resim: ${labeledImages}\n`;
            previewText += `📁 Format: ${format.toUpperCase()}\n`;
            previewText += `📊 Train/Val: ${Math.round(trainSplit * 100)}%/${Math.round(valSplit * 100)}%\n`;
            previewText += `🖼️ Resimler Dahil: ${includeImages ? 'Evet' : 'Hayır'}\n`;
            previewText += `📏 Koordinat Normalize: ${normalizeCoordinates ? 'Evet' : 'Hayır'}`;
            
            updateElement('exportPreview', previewText);
            
        } catch (error) {
            console.error('Export preview güncellenirken hata:', error);
            updateElement('exportPreview', '❌ Preview güncellenemedi: ' + error.message);
        }
    }


    

    async previewExport() {
        try {
            // ImageManager kontrolü
            if (!this.labelingTool.imageManager) {
                this.labelingTool.showError('ImageManager bulunamadı! Lütfen sayfayı yenileyin.');
                return;
            }
            
            if (!this.labelingTool.imageManager.currentProject) {
                this.labelingTool.showError('Aktif proje bulunamadı! Lütfen önce bir proje seçin.');
                return;
            }
            
        const formatElement = document.querySelector('input[name="exportFormat"]:checked');
        const format = formatElement ? formatElement.value : 'yolo';
        const exportOptions = this.getExportOptions();
            
            // Proje verilerini al
            const projectData = await this.getProjectData();
            const { images, annotations } = projectData;
            const totalAnnotations = Object.values(annotations).flat().length;
            const totalImages = images.length;
        
        let preview = `📋 Export Önizleme:\n\n`;
        preview += `Format: ${format.toUpperCase()}\n`;
            preview += `Proje: ${this.labelingTool.imageManager.currentProject.name}\n`;
            preview += `Toplam Resim: ${totalImages}\n`;
            preview += `Toplam Etiket: ${totalAnnotations}\n`;
        preview += `Resimler: ${exportOptions.includeImages ? 'Dahil' : 'Dahil Değil'}\n`;
        preview += `Kırpılmış Resimler: ${exportOptions.includeCrops ? 'Dahil' : 'Dahil Değil'}\n`;
        preview += `Açıklamalar: ${exportOptions.includeDescriptions ? 'Dahil' : 'Dahil Değil'}\n`;
        preview += `Koordinat Normalleştirme: ${exportOptions.normalizeCoordinates ? 'Açık' : 'Kapalı'}\n`;
        preview += `Metadata: ${exportOptions.includeMetadata ? 'Dahil' : 'Dahil Değil'}\n`;
        preview += `Sıkıştırma: ${exportOptions.compressOutput ? 'Açık' : 'Kapalı'}\n`;
        preview += `Resim Kalitesi: ${Math.round(exportOptions.imageQuality * 100)}%\n`;
        preview += `Etiket Harf Durumu: ${exportOptions.exportLabelCaseMode === 'uppercase' ? 'Büyük Harf' : exportOptions.exportLabelCaseMode === 'lowercase' ? 'Küçük Harf' : 'Default'}\n`;
        preview += `Kayıt Konumu: ${exportOptions.exportFolderPath || 'İndirilenler klasörü'}\n`;
        
        this.labelingTool.showInfo(preview);
            
        } catch (error) {
            console.error('Export preview hatası:', error);
            this.labelingTool.showError('Export preview oluşturulamadı: ' + error.message);
        }
    }

    autoMapClasses() {
        (this.labelingTool.availableLabels || []).forEach((label, index) => {
            const input = document.querySelector(`input[name="class_${index}"]`);
            if (input) {
                input.value = index;
            }
        });
        this.updateExportPreview();
        this.labelingTool.showToast('Sınıf eşleme otomatik olarak yapıldı!', 'success');
    }

    resetClassMapping() {
        (this.labelingTool.availableLabels || []).forEach((label, index) => {
            const input = document.querySelector(`input[name="class_${index}"]`);
            if (input) {
                input.value = '';
            }
        });
        this.updateExportPreview();
        this.labelingTool.showToast('Sınıf eşleme sıfırlandı!', 'info');
    }

    async performExport() {
        const formatElement = document.querySelector('input[name="exportFormat"]:checked');
        const format = formatElement ? formatElement.value : 'yolo';
        
        const trainSplitElement = document.getElementById('trainSplit');
        const trainSplit = trainSplitElement ? parseInt(trainSplitElement.value) / 100 : 0.8;
        
        // Basit export options
        const exportOptions = {
            includeImages: document.getElementById('includeImages')?.checked || true,
            normalizeCoordinates: document.getElementById('normalizeCoordinates')?.checked || true,
            exportLabelCaseMode: 'original'
        };

        // Modal'ı önce kapat (showSaveFilePicker için gerekli)
        this.closeExportModal();

        try {
            // ImageManager kontrolü - ana sayfadaki yoloExport gibi
            let imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager;
            
            if (!imageManager) {
                this.labelingTool.showError('ImageManager bulunamadı! Lütfen önce bir proje seçin.');
                return;
            }
            
            // Auth kontrolü - ana sayfadaki gibi
            if (!imageManager.auth) {
                if (window.labelingTool?.auth) {
                    imageManager.auth = window.labelingTool.auth;
                } else if (window.labelingAuth) {
                    imageManager.auth = window.labelingAuth;
                } else {
                    this.labelingTool.showError('Auth objesi bulunamadı! Lütfen sayfayı yenileyin.');
                    return;
                }
            }

            // Aktif proje yoksa otomatik proje seçmeye çalış - ana sayfadaki gibi
            if (!imageManager.currentProject) {
                try {
                    const projectsResponse = await imageManager.auth.makeRequest(`${imageManager.baseURL}/projects`);
                    if (projectsResponse.ok) {
                        const projects = await projectsResponse.json();
                        if (projects.length > 0) {
                            await imageManager.setProject(projects[0].id);
                        } else {
                            this.labelingTool.showError('Hiç proje bulunamadı! Lütfen önce bir proje oluşturun.');
                            return;
                        }
                    } else {
                        this.labelingTool.showError('Projeler alınamadı! Lütfen sayfayı yenileyin.');
                        return;
                    }
                } catch (error) {
                    this.labelingTool.showError('Proje kontrol edilemedi! Lütfen sayfayı yenileyin.');
                    return;
                }
            }

            switch (format) {
                case 'yolo':
                    // Sidebar'daki yoloExport fonksiyonunu kullan
                    if (this.labelingTool.yoloExport) {
                        await this.labelingTool.yoloExport();
                    } else {
                        await this.exportYOLO(trainSplit, {}, exportOptions);
                    }
                    break;
                case 'yolo_segmentation':
                    await this.exportYOLOSegmentation(trainSplit, {}, exportOptions);
                    break;
                case 'coco':
                    await this.exportCOCO(trainSplit, {}, exportOptions);
                    break;
                default:
                    this.labelingTool.showError('Desteklenmeyen format: ' + format);
                    return;
            }
            
        } catch (error) {
            console.error('Export hatası:', error);
            this.labelingTool.showError('Export işlemi sırasında hata oluştu: ' + error.message);
        }
    }

    // Export methods implementation
    async exportYOLO(trainSplit, classMapping, exportOptions) {
        if (!this.labelingTool.imageManager || !this.labelingTool.imageManager.currentProject) {
            this.labelingTool.showError('Proje bulunamadı!');
            return;
        }

        try {
            this.labelingTool.showInfo('YOLO formatında export başlatılıyor...');
            
            // ZIP dosyası oluştur
            const zip = new JSZip();
            const projectName = this.labelingTool.imageManager.currentProject.name || 'dataset';
            const projectFolder = zip.folder(projectName);
            
            // Tüm proje verilerini al
            const projectData = await this.getProjectData();
            const { images, annotations, weatherFilters } = projectData;
            
            // Class mapping oluştur (eğer boşsa)
            if (!classMapping || Object.keys(classMapping).length === 0) {
                const allLabels = new Set();
                Object.values(annotations).flat().forEach(annotation => {
                    if (annotation.label) {
                        allLabels.add(annotation.label);
                    }
                });
                
                classMapping = {};
                Array.from(allLabels).forEach((label, index) => {
                    classMapping[label] = index;
                });
                
                console.log('📊 Oluşturulan class mapping:', classMapping);
            }
            
            // Train/Val split hesapla
            const shuffledImages = this.shuffleArray([...images]);
            const trainCount = Math.floor(shuffledImages.length * trainSplit);
            const trainImages = shuffledImages.slice(0, trainCount);
            const valImages = shuffledImages.slice(trainCount);
            
            // YOLO format dosyaları oluştur
            await this.createYOLOFiles(projectFolder, trainImages, valImages, annotations, classMapping, exportOptions, weatherFilters);
            
            // ZIP'i kaydet
            await this.saveZipFile(zip, `${projectName}_yolo.zip`);
            
            this.labelingTool.showInfo('YOLO export tamamlandı! Sayfa yeniden başlatılıyor...');
            
            // Export tamamlandıktan sonra sayfayı yeniden başlat
            setTimeout(() => {
                window.location.reload();
            }, 1500);
            
        } catch (error) {
            console.error('YOLO export hatası:', error);
            this.labelingTool.showError('YOLO export hatası: ' + error.message);
        }
    }

    // YOLO Segmentation Export (polygon koordinatları ile)
    async exportYOLOSegmentation(trainSplit, classMapping, exportOptions) {
        // ImageManager kontrolü
        const imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager || window.imageManager;
        if (!imageManager || !imageManager.currentProject) {
            this.labelingTool.showError('Proje bulunamadı! Lütfen önce bir proje seçin.');
            return;
        }

        try {
            this.labelingTool.showInfo('YOLO Segmentation formatında export başlatılıyor...');
            
            // ZIP dosyası oluştur
            const zip = new JSZip();
            const projectName = imageManager.currentProject.name || 'dataset';
            const projectFolder = zip.folder(projectName);
            
            // Tüm proje verilerini al
            const projectData = await this.getProjectData();
            const { images, annotations, weatherFilters } = projectData;
            
            // Class mapping oluştur (eğer boşsa)
            if (!classMapping || Object.keys(classMapping).length === 0) {
                const allLabels = new Set();
                Object.values(annotations).flat().forEach(annotation => {
                    if (annotation.label) {
                        allLabels.add(annotation.label);
                    }
                });
                
                classMapping = {};
                Array.from(allLabels).forEach((label, index) => {
                    classMapping[label] = index;
                });
                
                console.log('📊 Oluşturulan class mapping:', classMapping);
            }
            
            // Train/Val split hesapla
            const shuffledImages = this.shuffleArray([...images]);
            const trainCount = Math.floor(shuffledImages.length * trainSplit);
            const trainImages = shuffledImages.slice(0, trainCount);
            const valImages = shuffledImages.slice(trainCount);
            
            // YOLO Segmentation format dosyaları oluştur
            await this.createYOLOSegmentationFiles(projectFolder, trainImages, valImages, annotations, classMapping, exportOptions, weatherFilters);
            
            // ZIP'i kaydet
            await this.saveZipFile(zip, `${projectName}_yolo_segmentation.zip`);
            
            this.labelingTool.showInfo('YOLO Segmentation export tamamlandı! Sayfa yeniden başlatılıyor...');
            
            // Export tamamlandıktan sonra sayfayı yeniden başlat
            setTimeout(() => {
                window.location.reload();
            }, 1500);
            
        } catch (error) {
            console.error('YOLO Segmentation export hatası:', error);
            this.labelingTool.showError('YOLO Segmentation export hatası: ' + error.message);
        }
    }

    async exportCOCO(trainSplit, classMapping, exportOptions) {
        const imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager || window.imageManager;
        if (!imageManager || !imageManager.currentProject) {
            this.labelingTool.showError('Proje bulunamadı! Lütfen önce bir proje seçin.');
            return;
        }

        try {
            this.labelingTool.showInfo('COCO formatında export başlatılıyor...');
            
            // Proje verilerini al
            const projectData = await this.getProjectData();
            const { images, annotations } = projectData;
            
            // COCO format JSON oluştur
            const cocoData = this.createCOCOFormat(images, annotations, classMapping, exportOptions);
            
            // ZIP dosyası oluştur
            const zip = new JSZip();
            const projectName = imageManager.currentProject.name || 'dataset';
            const projectFolder = zip.folder(projectName);
            
            // COCO JSON dosyasını ekle
            projectFolder.file('annotations.json', JSON.stringify(cocoData, null, 2));
            
            // Resimleri ekle (eğer isteniyorsa)
            if (exportOptions.includeImages) {
                await this.addImagesToZip(projectFolder, images, exportOptions);
            }
            
            // ZIP'i kaydet
            await this.saveZipFile(zip, `${projectName}_coco.zip`);
            
            this.labelingTool.showInfo('COCO export tamamlandı! Sayfa yeniden başlatılıyor...');
            
            // Export tamamlandıktan sonra sayfayı yeniden başlat
            setTimeout(() => {
                window.location.reload();
            }, 1500);
            
        } catch (error) {
            console.error('COCO export hatası:', error);
            this.labelingTool.showError('COCO export hatası: ' + error.message);
        }
    }

    async exportPascalVOC(trainSplit, classMapping, exportOptions) {
        const imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager || window.imageManager;
        if (!imageManager || !imageManager.currentProject) {
            this.labelingTool.showError('Proje bulunamadı! Lütfen önce bir proje seçin.');
            return;
        }

        try {
            this.labelingTool.showInfo('Pascal VOC formatında export başlatılıyor...');
            
            // Proje verilerini al
            const projectData = await this.getProjectData();
            const { images, annotations } = projectData;
            
            // ZIP dosyası oluştur
            const zip = new JSZip();
            const projectName = imageManager.currentProject.name || 'dataset';
            const projectFolder = zip.folder(projectName);
            
            // Pascal VOC XML dosyaları oluştur
            await this.createPascalVOCFiles(projectFolder, images, annotations, classMapping, exportOptions);
            
            // ZIP'i kaydet
            await this.saveZipFile(zip, `${projectName}_pascal_voc.zip`);
            
            this.labelingTool.showInfo('Pascal VOC export tamamlandı!');
            
        } catch (error) {
            console.error('Pascal VOC export hatası:', error);
            this.labelingTool.showError('Pascal VOC export hatası: ' + error.message);
        }
    }

    async exportJSON(exportOptions) {
        const imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager || window.imageManager;
        if (!imageManager || !imageManager.currentProject) {
            this.labelingTool.showError('Proje bulunamadı! Lütfen önce bir proje seçin.');
            return;
        }

        try {
            this.labelingTool.showInfo('JSON formatında export başlatılıyor...');
            
            // Proje verilerini al
            const projectData = await this.getProjectData();
            const projectName = imageManager.currentProject.name || 'dataset';
            
            // JSON dosyasını oluştur
            const jsonData = this.createJSONFormat(projectData, exportOptions);
            
            // ZIP dosyası oluştur
            const zip = new JSZip();
            const projectFolder = zip.folder(projectName);
            
            // JSON dosyasını ekle
            projectFolder.file('annotations.json', JSON.stringify(jsonData, null, 2));
            
            // Resimleri ekle (eğer isteniyorsa)
            if (exportOptions.includeImages) {
                await this.addImagesToZip(projectFolder, projectData.images, exportOptions);
            }
            
            // ZIP'i kaydet
            await this.saveZipFile(zip, `${projectName}_json.zip`);
            
            this.labelingTool.showInfo('JSON export tamamlandı!');
            
        } catch (error) {
            console.error('JSON export hatası:', error);
            this.labelingTool.showError('JSON export hatası: ' + error.message);
        }
    }

    async exportCSV(classMapping, exportOptions) {
        const imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager || window.imageManager;
        if (!imageManager || !imageManager.currentProject) {
            this.labelingTool.showError('Proje bulunamadı! Lütfen önce bir proje seçin.');
            return;
        }

        try {
            this.labelingTool.showInfo('CSV formatında export başlatılıyor...');
            
            // Proje verilerini al
            const projectData = await this.getProjectData();
            const { images, annotations } = projectData;
            
            // CSV dosyası oluştur
            const csvData = this.createCSVFormat(images, annotations, classMapping, exportOptions);
            
            // ZIP dosyası oluştur
            const zip = new JSZip();
            const projectName = imageManager.currentProject.name || 'dataset';
            const projectFolder = zip.folder(projectName);
            
            // CSV dosyasını ekle
            projectFolder.file('annotations.csv', csvData);
            
            // Resimleri ekle (eğer isteniyorsa)
            if (exportOptions.includeImages) {
                await this.addImagesToZip(projectFolder, images, exportOptions);
            }
            
            // ZIP'i kaydet
            await this.saveZipFile(zip, `${projectName}_csv.zip`);
            
            this.labelingTool.showInfo('CSV export tamamlandı!');
            
        } catch (error) {
            console.error('CSV export hatası:', error);
            this.labelingTool.showError('CSV export hatası: ' + error.message);
        }
    }

    // Export için etiket ismini dönüştür
    transformLabelForExport(labelName, exportOptions) {
        if (!labelName) return labelName;
        
        // Önce boşlukları _ ile değiştir
        let transformedName = labelName.replace(/\s+/g, '_');
        
        // Sonra export harf durumunu uygula
        switch (exportOptions.exportLabelCaseMode) {
            case 'uppercase':
                return transformedName.toUpperCase();
            case 'lowercase':
                return transformedName.toLowerCase();
            case 'original':
            default:
                return transformedName;
        }
    }

    // Kullanıcının belirttiği yere kaydet
    async saveAsExport() {
        try {
            this.labelingTool.showInfo('Export hazırlanıyor...');
            
            // Export seçeneklerini al
            const exportOptions = this.getExportOptions();
            
            // Proje verilerini al
            const projectData = await this.prepareExportData();
            const { images, annotations } = projectData;
            
            // ZIP dosyası oluştur
            const zip = new JSZip();
            const imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager || window.imageManager;
            const projectName = imageManager?.currentProject?.name || 'dataset';
            const projectFolder = zip.folder(projectName);
            
            // Resimleri ekle (eğer isteniyorsa)
            if (exportOptions.includeImages) {
                await this.addImagesToZip(projectFolder, images, exportOptions);
            }
            
            // JSON formatında annotation'ları ekle
            const jsonData = this.createJSONFormat(projectData, exportOptions);
            projectFolder.file('annotations.json', JSON.stringify(jsonData, null, 2));
            
            // ZIP'i blob olarak oluştur
            const content = await zip.generateAsync({type: "blob"});
            
            // Dosya adını oluştur
            const fileName = `${projectName}_dataset.zip`;
            
            // Kullanıcıdan dosya konumu seçmesini iste
            if ('showSaveFilePicker' in window) {
                // Modern tarayıcılar için File System Access API
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
                    
                    // Dosyayı yaz
                    const writable = await fileHandle.createWritable();
                    await writable.write(content);
                    await writable.close();
                    
                    this.labelingTool.showInfo('Dosya başarıyla kaydedildi!');
                    
                } catch (error) {
                    if (error.name === 'AbortError') {
                        this.labelingTool.showInfo('Kaydetme iptal edildi.');
                        return;
                    }
                    throw error;
                }
            } else {
                // Eski tarayıcılar için fallback
                this.fallbackDownload(content, fileName);
            }
            
        } catch (error) {
            console.error('Save As export hatası:', error);
            this.labelingTool.showError('Export sırasında hata oluştu: ' + error.message);
        }
    }

    // Otomatik indirme fonksiyonu
    fallbackDownload(content, fileName) {
        try {
            console.log('📥 Dosya indiriliyor:', fileName, 'Boyut:', content.size, 'bytes');
            
            const blobUrl = URL.createObjectURL(content);
            const downloadLink = document.createElement('a');
            downloadLink.href = blobUrl;
            downloadLink.download = fileName;
            downloadLink.style.display = 'none';
            
            // DOM'a ekle ve tıkla
            document.body.appendChild(downloadLink);
            downloadLink.click();
            
            // Temizle
            setTimeout(() => {
                document.body.removeChild(downloadLink);
                URL.revokeObjectURL(blobUrl);
                console.log('✅ Dosya indirme tamamlandı:', fileName);
            }, 1000);
            
        } catch (error) {
            console.error('❌ Dosya indirme hatası:', error);
            this.labelingTool.showError('Dosya indirilemedi: ' + error.message);
        }
    }

    // YOLO Format Export - Tüm proje için (Optimize edilmiş)
    async cropAndSaveAs() {
        try {
            console.log('🔍 YOLO Format Export başlatılıyor...');
            console.log('🔍 labelingTool:', this.labelingTool);
            console.log('🔍 imageManager:', this.labelingTool?.imageManager);
            console.log('🔍 currentProject:', this.labelingTool?.imageManager?.currentProject);
            
            this.labelingTool.showInfo('YOLO formatında dataset hazırlanıyor...');
            
            // ImageManager kontrolü - script.js'deki imageManager'ı kullan
            const imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager;
            if (!imageManager) {
                console.error('❌ ImageManager null!');
                this.labelingTool.showError('ImageManager bulunamadı! Lütfen sayfayı yenileyin.');
                return;
            }
            
            if (!imageManager.currentProject) {
                console.error('❌ currentProject null!');
                console.error('❌ imageManager detayları:', {
                    currentProject: imageManager.currentProject,
                    totalImages: imageManager.totalImages,
                    currentImageIndex: imageManager.currentImageIndex
                });
                this.labelingTool.showError('Aktif proje bulunamadı! Lütfen önce bir proje seçin.');
                return;
            }
            
            // Proje verilerini al
            const projectData = await this.getProjectData();
            const { images, annotations, weatherFilters = {} } = projectData;
            
            if (images.length === 0) {
                this.labelingTool.showWarning('Projede hiç resim bulunamadı!');
                return;
            }
            
            console.log('📊 Export verileri:', {
                images: images.length,
                annotations: Object.keys(annotations).length,
                weatherFilters: Object.keys(weatherFilters).length
            });
            
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
            
            // Sınıf mapping'i oluştur
            const allLabels = new Set();
            console.log('🔍 Annotations yapısı:', annotations);
            
            Object.values(annotations).flat().forEach(annotation => {
                console.log('🔍 Annotation:', annotation);
                if (annotation.label) {
                    allLabels.add(annotation.label);
                }
            });
            
            console.log('🔍 Bulunan etiketler:', Array.from(allLabels));
            
            // Eğer hiç etiket yoksa uyarı ver
            if (allLabels.size === 0) {
                this.labelingTool.showWarning('⚠️ Projede hiç etiket bulunamadı!\n\nLütfen önce resimlere etiket ekleyin:\n1. Resim seçin\n2. Dikdörtgen çizin\n3. Etiket adı girin\n4. Kaydedin\n\nSonra tekrar export yapın.');
                return;
            }
            
            const classMapping = {};
            Array.from(allLabels).forEach((label, index) => {
                classMapping[label] = index;
            });
            
            console.log('🔍 Class mapping:', classMapping);
            
            // Train set'i işle
            for (const image of trainImages) {
                await this.addImageToYOLO(trainImagesFolder, trainLabelsFolder, image, annotations[image.id] || [], classMapping, { includeImages: true }, weatherFilters);
            }
            
            // Val set'i işle
            for (const image of valImages) {
                await this.addImageToYOLO(valImagesFolder, valLabelsFolder, image, annotations[image.id] || [], classMapping, { includeImages: true }, weatherFilters);
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
            
            // Export işlemi sırasında showSaveFilePicker çalışmaz, otomatik indirme kullan
            console.log('💾 YOLO dataset oluşturuldu, otomatik indirme başlatılıyor:', fileName);
            this.fallbackDownload(content, fileName);
            
            this.labelingTool.showInfo(`YOLO dataset başarıyla kaydedildi!\nToplam: ${images.length} resim\nTrain: ${trainImages.length} resim\nVal: ${valImages.length} resim\nSınıf sayısı: ${allLabels.size}\n\nSayfa yeniden başlatılıyor...`);
            
            // Export tamamlandıktan sonra sayfayı yeniden başlat
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } catch (error) {
            console.error('YOLO Export hatası:', error);
            this.labelingTool.showError('YOLO export sırasında hata oluştu: ' + error.message);
        }
    }


    // Kırpılmış görüntüler için metadata oluştur - Güncellenmiş
    generateCropMetadata(projectName, images, annotations, totalCroppedImages) {
        const metadata = {
            projectName: projectName,
            exportDate: new Date().toISOString(),
            totalImages: totalCroppedImages,
            totalSourceImages: images.length,
            labels: {},
            images: [],
            statistics: {
                imagesWithAnnotations: 0,
                averageAnnotationsPerImage: 0
            }
        };

            let globalIndex = 1;
        let totalAnnotations = 0;
        
        // Her resim için işlem
        images.forEach((image, imageIndex) => {
            const imageAnnotations = annotations[image.id] || [];
            
            if (imageAnnotations.length > 0) {
                metadata.statistics.imagesWithAnnotations++;
                totalAnnotations += imageAnnotations.length;
                
                imageAnnotations.forEach(annotation => {
                    const labelName = this.transformLabelForExport(annotation.label, {});
                    
                    if (!metadata.labels[labelName]) {
                        metadata.labels[labelName] = 0;
                    }
                    metadata.labels[labelName]++;
                    
                    metadata.images.push({
                        id: annotation.id,
                        label: annotation.label,
                        transformedLabel: labelName,
                        type: annotation.type,
                        fileName: `${labelName}_${globalIndex.toString().padStart(4, '0')}.jpg`,
                        sourceImageId: image.id,
                        sourceImageName: image.fileName,
                        sourceImageIndex: imageIndex,
                        globalIndex: globalIndex,
                        coordinates: {
                            x: annotation.x,
                            y: annotation.y,
                            width: annotation.width,
                            height: annotation.height
                        }
                    });
                    
                    globalIndex++;
                });
            }
        });
        
        // İstatistikleri hesapla
        if (metadata.statistics.imagesWithAnnotations > 0) {
            metadata.statistics.averageAnnotationsPerImage = 
                Math.round((totalAnnotations / metadata.statistics.imagesWithAnnotations) * 100) / 100;
        }
        
        // Label istatistikleri
        metadata.labelStatistics = Object.entries(metadata.labels)
            .sort(([,a], [,b]) => b - a)
            .map(([label, count]) => ({ label, count }));

        return metadata;
    }

    // Export verilerini hazırla
    async prepareExportData() {
        try {
            console.log('🔍 Export verileri hazırlanıyor...');
            
            // ImageManager'ı doğru şekilde al
            const imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager || window.imageManager;
            if (!imageManager) {
                console.error('❌ ImageManager bulunamadı');
                console.error('❌ labelingTool:', this.labelingTool);
                console.error('❌ window.labelingTool:', window.labelingTool);
                console.error('❌ window.imageManager:', window.imageManager);
                throw new Error('ImageManager bulunamadı');
            }

            console.log('🔍 ImageManager bulundu:', imageManager);
            console.log('🔍 currentProject:', imageManager.currentProject);

            if (!imageManager.currentProject || !imageManager.currentProject.id) {
                console.error('❌ Aktif proje bulunamadı');
                console.error('❌ currentProject:', imageManager.currentProject);
                
                // Proje yoksa, mevcut projeleri listele ve ilkini seç
                try {
                    console.log('🔍 Mevcut projeler kontrol ediliyor...');
                    const projectsResponse = await imageManager.auth.makeRequest(`${imageManager.baseURL}/projects`);
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
                                throw new Error('Proje seçilemedi! Lütfen manuel olarak bir proje seçin.');
                            }
                        } else {
                            throw new Error('Hiç proje bulunamadı! Lütfen önce bir proje oluşturun.');
                        }
                    } else {
                        throw new Error('Projeler listelenemedi!');
                    }
                } catch (projectError) {
                    console.error('❌ Proje seçme hatası:', projectError);
                throw new Error('Aktif proje bulunamadı. Lütfen önce bir proje seçin.');
                }
            }

            const projectId = imageManager.currentProject.id;
            console.log('📊 Proje verileri alınıyor, Project ID:', projectId);
            
            // Tek API çağrısı ile tüm proje verilerini al
            const response = await imageManager.auth.makeRequest(
                `${imageManager.baseURL}/projects/${projectId}/export-data`
            );
            
            if (!response.ok) {
                // Fallback: eski yöntemle al
                console.log('⚠️ Export endpoint bulunamadı, fallback kullanılıyor...');
                return await this.getProjectDataFallback(projectId);
            }

            const projectData = await response.json();
            console.log('📊 Alınan resim sayısı:', projectData.images.length);
            console.log('📊 Toplam annotation sayısı:', Object.values(projectData.annotations).flat().length);
            
            return projectData;
        } catch (error) {
            console.error('❌ Export verileri hazırlanırken hata:', error);
            throw error;
        }
    }

    // Yardımcı fonksiyonlar - Optimize edilmiş versiyon
    async getProjectData() {
        console.log('🔍 getProjectData çağrıldı');
        console.log('🔍 labelingTool:', this.labelingTool);
        console.log('🔍 imageManager:', this.labelingTool?.imageManager);
        console.log('🔍 currentProject:', this.labelingTool?.imageManager?.currentProject);
        
        // ImageManager'ı doğru şekilde al
        const imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager || window.imageManager;
        if (!imageManager) {
            console.error('❌ ImageManager bulunamadı');
            throw new Error('ImageManager bulunamadı');
        }

        console.log('🔍 ImageManager durumu:', {
            currentProject: imageManager.currentProject,
            totalImages: imageManager.totalImages,
            currentImageIndex: imageManager.currentImageIndex
        });

        if (!imageManager.currentProject || !imageManager.currentProject.id) {
            console.error('❌ Aktif proje bulunamadı');
            console.error('❌ currentProject:', imageManager.currentProject);
            
            // Proje yoksa, mevcut projeleri listele ve ilkini seç
            try {
                console.log('🔍 Mevcut projeler kontrol ediliyor...');
                const projectsResponse = await imageManager.auth.makeRequest(`${imageManager.baseURL}/projects`);
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
                            throw new Error('Proje seçilemedi! Lütfen manuel olarak bir proje seçin.');
                        }
                    } else {
                        throw new Error('Hiç proje bulunamadı! Lütfen önce bir proje oluşturun.');
                    }
                } else {
                    throw new Error('Projeler listelenemedi!');
                }
            } catch (projectError) {
                console.error('❌ Proje seçme hatası:', projectError);
                throw new Error('Aktif proje bulunamadı. Lütfen önce bir proje seçin.');
            }
        }

        const projectId = imageManager.currentProject.id;
        console.log('📊 Proje verileri alınıyor, Project ID:', projectId);
        
        // Tek API çağrısı ile tüm proje verilerini al
        const response = await imageManager.auth.makeRequest(
            `${imageManager.baseURL}/projects/${projectId}/export-data`
        );
        
        if (!response.ok) {
            // Fallback: eski yöntemle al
            console.log('⚠️ Export endpoint bulunamadı, fallback kullanılıyor...');
            return await this.getProjectDataFallback(projectId);
        }

        const projectData = await response.json();
        console.log('📊 Alınan resim sayısı:', projectData.images.length);
        console.log('📊 Toplam annotation sayısı:', Object.values(projectData.annotations).flat().length);
        console.log('📊 Weather filters sayısı:', Object.keys(projectData.weatherFilters || {}).length);
        
        return projectData;
    }

    // Fallback: eski yöntemle veri alma - Veritabanından düzgün çek
    async getProjectDataFallback(projectId) {
        const imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager || window.imageManager;
        
        try {
            // Resimleri al
            const imagesResponse = await imageManager.auth.makeRequest(
                `${imageManager.baseURL}/projects/${projectId}/images`
            );
            
            if (!imagesResponse.ok) {
                throw new Error(`Proje verileri alınamadı: ${imagesResponse.status} ${imagesResponse.statusText}`);
            }

            const images = await imagesResponse.json();
            console.log('📊 Alınan resim sayısı:', images.length);
            
            // Her resim için annotation'ları veritabanından al
            const annotations = {};
            const weatherFilters = {};
            
            for (const image of images) {
                try {
                    // Annotation'ları veritabanından al
                    const annotationsResponse = await imageManager.auth.makeRequest(
                        `${imageManager.baseURL}/images/${image.id}/annotations`
                    );
                    
                    if (annotationsResponse.ok) {
                        const annotationsData = await annotationsResponse.json();
                        console.log(`🔍 Resim ${image.id} için annotation'lar:`, annotationsData);
                        
                        // Annotation verilerini işle
                        const processedAnnotations = [];
                        
                        if (Array.isArray(annotationsData)) {
                            // Her annotation record'ını işle
                            annotationsData.forEach(annRecord => {
                                if (annRecord.annotation_data) {
                                    let annotationData;
                                    try {
                                        annotationData = typeof annRecord.annotation_data === 'string' 
                                            ? JSON.parse(annRecord.annotation_data) 
                                            : annRecord.annotation_data;
                                    } catch (error) {
                                        console.warn(`Annotation ${annRecord.id} parse edilemedi:`, error);
                                        return;
                                    }
                                    
                                    if (annotationData && annotationData.annotations && Array.isArray(annotationData.annotations)) {
                                        // Her annotation'ı işle
                                        annotationData.annotations.forEach(annData => {
                                            const processedAnn = {
                                                id: annData.id || annRecord.id,
                                                label: annData.label,
                                                type: annData.type || 'rectangle',
                                                color: annData.color || '#007AFF',
                                                x: parseFloat(annData.x) || 0,
                                                y: parseFloat(annData.y) || 0,
                                                width: parseFloat(annData.width) || 0,
                                                height: parseFloat(annData.height) || 0,
                                                points: annData.points || [],
                                                imageWidth: image.width || 1280,
                                                imageHeight: image.height || 720
                                            };
                                            
                                            console.log('🔍 İşlenmiş annotation:', processedAnn);
                                            processedAnnotations.push(processedAnn);
                                        });
                                    }
                                }
                            });
                        }
                        
                        annotations[image.id] = processedAnnotations;
                        console.log(`✅ Resim ${image.id} için ${processedAnnotations.length} annotation işlendi`);
                        
                    } else {
                        console.warn(`Resim ${image.id} için annotation'lar alınamadı:`, annotationsResponse.status);
                        annotations[image.id] = [];
                    }
                    
                    // Weather filter'ı al
                    try {
                        const filterResponse = await imageManager.auth.makeRequest(
                            `${imageManager.baseURL}/images/${image.id}/weather-filter`
                        );
                        
                        if (filterResponse.ok) {
                            const filterData = await filterResponse.json();
                            if (filterData && filterData.type && filterData.type !== 'none') {
                                weatherFilters[image.id] = {
                                    type: filterData.type,
                                    data: filterData
                                };
                            }
                        }
                    } catch (error) {
                        console.warn(`Resim ${image.id} için weather filter alınamadı:`, error);
                    }
                    
                } catch (error) {
                    console.error(`Resim ${image.id} işlenirken hata:`, error);
                    annotations[image.id] = [];
                }
            }

            console.log('📊 Toplam annotation sayısı:', Object.values(annotations).flat().length);
            console.log('🌤️ Weather filter sayısı:', Object.keys(weatherFilters).length);
            
            return { images, annotations, weatherFilters };
            
        } catch (error) {
            console.error('❌ Fallback veri alma hatası:', error);
            throw error;
        }
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    async createYOLOFiles(projectFolder, trainImages, valImages, annotations, classMapping, exportOptions, weatherFilters = {}) {
        // Train/Val klasörleri oluştur
        const trainFolder = projectFolder.folder('train');
        const valFolder = projectFolder.folder('val');
        const trainImagesFolder = trainFolder.folder('images');
        const valImagesFolder = valFolder.folder('images');
        const trainLabelsFolder = trainFolder.folder('labels');
        const valLabelsFolder = valFolder.folder('labels');

        // Etiket kontrolü
        const allLabels = new Set();
        Object.values(annotations).flat().forEach(annotation => {
            if (annotation.label) {
                allLabels.add(annotation.label);
            }
        });
        
        if (allLabels.size === 0) {
            this.labelingTool.showWarning('⚠️ Projede hiç etiket bulunamadı!\n\nLütfen önce resimlere etiket ekleyin.');
            return;
        }

        // Train set
        for (const image of trainImages) {
            const imageAnnotations = annotations[image.id] || [];
            console.log(`🔍 Train resim ${image.id} için annotation'lar:`, imageAnnotations);
            await this.addImageToYOLO(trainImagesFolder, trainLabelsFolder, image, imageAnnotations, classMapping, exportOptions, weatherFilters);
        }

        // Val set
        for (const image of valImages) {
            const imageAnnotations = annotations[image.id] || [];
            console.log(`🔍 Val resim ${image.id} için annotation'lar:`, imageAnnotations);
            await this.addImageToYOLO(valImagesFolder, valLabelsFolder, image, imageAnnotations, classMapping, exportOptions, weatherFilters);
        }

        // YAML dosyası oluştur
        const yamlContent = this.createYOLOYaml(classMapping);
        projectFolder.file('data.yaml', yamlContent);
        
        // classes.txt dosyası oluştur (YOLO için gerekli)
        const classes = Object.keys(classMapping).sort((a, b) => classMapping[a] - classMapping[b]);
        const classesContent = classes.join('\n');
        projectFolder.file('classes.txt', classesContent);
    }

    async createYOLOSegmentationFiles(projectFolder, trainImages, valImages, annotations, classMapping, exportOptions, weatherFilters = {}) {
        // YOLO segmentation klasör yapısı: images/ ve labels/ ana klasörler
        const imagesFolder = projectFolder.folder('images');
        const labelsFolder = projectFolder.folder('labels');
        
        // Train/Val alt klasörleri
        const trainImagesFolder = imagesFolder.folder('train');
        const valImagesFolder = imagesFolder.folder('val');
        const trainLabelsFolder = labelsFolder.folder('train');
        const valLabelsFolder = labelsFolder.folder('val');

        // Train set
        for (const image of trainImages) {
            const imageAnnotations = annotations[image.id] || [];
            console.log(`🔍 Train resim ${image.id} için annotation'lar:`, imageAnnotations);
            await this.addImageToYOLOSegmentation(trainImagesFolder, trainLabelsFolder, image, imageAnnotations, classMapping, exportOptions, weatherFilters);
        }

        // Val set
        for (const image of valImages) {
            const imageAnnotations = annotations[image.id] || [];
            console.log(`🔍 Val resim ${image.id} için annotation'lar:`, imageAnnotations);
            await this.addImageToYOLOSegmentation(valImagesFolder, valLabelsFolder, image, imageAnnotations, classMapping, exportOptions, weatherFilters);
        }

        // YAML dosyası oluştur
        const yamlContent = this.createYOLOSegmentationYaml(classMapping);
        projectFolder.file('data.yaml', yamlContent);
        
        // classes.txt dosyası oluştur (YOLO segmentation için gerekli)
        const classes = Object.keys(classMapping).sort((a, b) => classMapping[a] - classMapping[b]);
        const classesContent = classes.join('\n');
        projectFolder.file('classes.txt', classesContent);
    }

    async addImageToYOLO(imagesFolder, labelsFolder, image, imageAnnotations, classMapping, exportOptions, weatherFilters = {}) {
        // Resim dosyasını ekle
        if (exportOptions.includeImages) {
            const imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager || window.imageManager;
            
            // Weather filter kontrolü - export data'dan al
            let imageBlob;
            const weatherFilter = weatherFilters[image.id];
            
            if (weatherFilter && weatherFilter.type && weatherFilter.type !== 'none') {
                console.log(`🌤️ Resim ${image.id} için filtre uygulanıyor:`, weatherFilter.type);
                try {
                    // Filtrelenmiş resmi al
                    imageBlob = await this.getFilteredImageBlob(image, weatherFilter.type);
                } catch (error) {
                    console.warn(`Resim ${image.id} için filtre uygulanamadı:`, error);
                }
            }
            
            // Eğer filtre uygulanamadıysa orijinal resmi al
            if (!imageBlob) {
                const imageResponse = await imageManager.auth.makeRequest(
                    `${imageManager.baseURL}/images/${image.id}/file`
                );
                
                if (imageResponse.ok) {
                    imageBlob = await imageResponse.blob();
                }
            }
            
            if (imageBlob) {
                imagesFolder.file(image.fileName, imageBlob);
            }
        }

        // Annotation'ları düzgün şekilde al ve işle
        let currentImageAnnotations = [];
        
        // Eğer imageAnnotations bir obje ise (image.id ile key'lenmiş)
        if (imageAnnotations && typeof imageAnnotations === 'object' && imageAnnotations[image.id]) {
            currentImageAnnotations = imageAnnotations[image.id];
        } 
        // Eğer imageAnnotations bir array ise (direkt annotation'lar)
        else if (Array.isArray(imageAnnotations)) {
            currentImageAnnotations = imageAnnotations;
        }
        
        // Annotation'ları işle ve koordinatları düzelt
        currentImageAnnotations = currentImageAnnotations.map(annotation => {
            const processedAnnotation = {
                ...annotation,
                imageWidth: image.width || 1280,
                imageHeight: image.height || 720,
                x: parseFloat(annotation.x) || 0,
                y: parseFloat(annotation.y) || 0,
                width: parseFloat(annotation.width) || 0,
                height: parseFloat(annotation.height) || 0
            };
            
            return processedAnnotation;
        });

        console.log(`🔍 Resim ${image.id} için işlenmiş annotation'lar:`, currentImageAnnotations);

        // Label dosyasını oluştur
        const labelContent = this.createYOLLabelFile(currentImageAnnotations, classMapping, exportOptions);
        const labelFileName = image.fileName.replace(/\.[^/.]+$/, '.txt');
        labelsFolder.file(labelFileName, labelContent);
    }

    async addImageToYOLOSegmentation(imagesFolder, labelsFolder, image, imageAnnotations, classMapping, exportOptions, weatherFilters = {}) {
        // Resim dosyasını ekle
        if (exportOptions.includeImages) {
            const imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager || window.imageManager;
            
            // Weather filter kontrolü - export data'dan al
            let imageBlob;
            const weatherFilter = weatherFilters[image.id];
            
            if (weatherFilter && weatherFilter.type && weatherFilter.type !== 'none') {
                console.log(`🌤️ Resim ${image.id} için filtre uygulanıyor:`, weatherFilter.type);
                try {
                    // Filtrelenmiş resmi al
                    imageBlob = await this.getFilteredImageBlob(image, weatherFilter.type);
                } catch (error) {
                    console.warn(`Resim ${image.id} için filtre uygulanamadı:`, error);
                }
            }
            
            // Eğer filtre uygulanamadıysa orijinal resmi al
            if (!imageBlob) {
                const imageResponse = await imageManager.auth.makeRequest(
                    `${imageManager.baseURL}/images/${image.id}/file`
                );
                
                if (imageResponse.ok) {
                    imageBlob = await imageResponse.blob();
                }
            }
            
            if (imageBlob) {
                imagesFolder.file(image.fileName, imageBlob);
            }
        }

        // Annotation'ları düzgün şekilde al
        let currentImageAnnotations = [];
        
        // Eğer imageAnnotations bir obje ise (image.id ile key'lenmiş)
        if (imageAnnotations && typeof imageAnnotations === 'object' && imageAnnotations[image.id]) {
            currentImageAnnotations = imageAnnotations[image.id];
        } 
        // Eğer imageAnnotations bir array ise (direkt annotation'lar)
        else if (Array.isArray(imageAnnotations)) {
            currentImageAnnotations = imageAnnotations;
        }
        
        // Annotation'lara image boyutlarını ekle ve koordinatları düzelt
        currentImageAnnotations = currentImageAnnotations.map(annotation => {
            const processedAnnotation = {
                ...annotation,
                imageWidth: image.width || 1280,
                imageHeight: image.height || 720,
                x: parseFloat(annotation.x) || 0,
                y: parseFloat(annotation.y) || 0,
                width: parseFloat(annotation.width) || 0,
                height: parseFloat(annotation.height) || 0
            };
            
            // Points verilerini kontrol et ve düzelt
            if (annotation.points && Array.isArray(annotation.points)) {
                processedAnnotation.points = annotation.points.map(point => ({
                    x: parseFloat(point.x) || 0,
                    y: parseFloat(point.y) || 0
                }));
            }
            
            return processedAnnotation;
        });

        console.log(`🔍 Resim ${image.id} için işlenmiş annotation'lar:`, currentImageAnnotations);

        // Segmentation label dosyasını oluştur
        const labelContent = this.createYOLOSegmentationLabelFile(currentImageAnnotations, classMapping, exportOptions);
        const labelFileName = image.fileName.replace(/\.[^/.]+$/, '.txt');
        labelsFolder.file(labelFileName, labelContent);
    }

    createYOLLabelFile(annotations, classMapping, exportOptions) {
        console.log('🔍 createYOLLabelFile çağrıldı:', {
            annotationsCount: annotations?.length || 0,
            annotations: annotations,
            classMapping: classMapping
        });
        
        let content = '';
        
        if (!annotations || annotations.length === 0) {
            console.log('⚠️ Hiç annotation yok!');
            return content;
        }
        
        for (const annotation of annotations) {
            const labelName = this.transformLabelForExport(annotation.label, exportOptions);
            const classId = classMapping[labelName] || 0;
            
            // Debug: Annotation koordinatlarını kontrol et
            console.log('🔍 YOLO annotation koordinatları:', {
                annotationId: annotation.id,
                label: annotation.label,
                x: annotation.x,
                y: annotation.y,
                width: annotation.width,
                height: annotation.height,
                imageWidth: annotation.imageWidth,
                imageHeight: annotation.imageHeight
            });
            
            // Koordinat değerlerini kontrol et
            const x = parseFloat(annotation.x) || 0;
            const y = parseFloat(annotation.y) || 0;
            const width = parseFloat(annotation.width) || 0;
            const height = parseFloat(annotation.height) || 0;
            const imageWidth = parseFloat(annotation.imageWidth) || 1280;
            const imageHeight = parseFloat(annotation.imageHeight) || 720;
            
            // Geçerli koordinat kontrolü
            if (width <= 0 || height <= 0 || imageWidth <= 0 || imageHeight <= 0) {
                console.warn('⚠️ Geçersiz koordinat değerleri, annotation atlanıyor:', {
                    x, y, width, height, imageWidth, imageHeight
                });
                continue;
            }
            
            // YOLO format: class_id center_x center_y width height (normalized)
            const centerX = (x + width / 2) / imageWidth;
            const centerY = (y + height / 2) / imageHeight;
            const normalizedWidth = width / imageWidth;
            const normalizedHeight = height / imageHeight;
            
            // Normalize edilmiş değerleri 0-1 arasında sınırla
            const clampedCenterX = Math.max(0, Math.min(1, centerX));
            const clampedCenterY = Math.max(0, Math.min(1, centerY));
            const clampedWidth = Math.max(0, Math.min(1, normalizedWidth));
            const clampedHeight = Math.max(0, Math.min(1, normalizedHeight));
            
            console.log('🔍 YOLO normalize edilmiş koordinatlar:', {
                centerX: clampedCenterX,
                centerY: clampedCenterY,
                width: clampedWidth,
                height: clampedHeight
            });
            
            content += `${classId} ${clampedCenterX.toFixed(6)} ${clampedCenterY.toFixed(6)} ${clampedWidth.toFixed(6)} ${clampedHeight.toFixed(6)}\n`;
        }
        
        console.log('🔍 YOLO label content:', content);
        return content;
    }

    // YOLO Segmentation formatında label dosyası oluştur (polygon koordinatları ile)
    createYOLOSegmentationLabelFile(annotations, classMapping, exportOptions) {
        console.log('🔍 createYOLOSegmentationLabelFile çağrıldı:', {
            annotationsCount: annotations?.length || 0,
            annotations: annotations,
            classMapping: classMapping
        });
        
        let content = '';
        
        if (!annotations || annotations.length === 0) {
            console.log('⚠️ Hiç annotation yok!');
            return content;
        }
        
        for (const annotation of annotations) {
            const labelName = this.transformLabelForExport(annotation.label, exportOptions);
            const classId = classMapping[labelName] || 0;
            
            // Debug: Annotation yapısını kontrol et
            console.log('🔍 Annotation yapısı:', {
                annotationId: annotation.id,
                type: annotation.type,
                hasPoints: !!annotation.points,
                pointsLength: annotation.points?.length,
                hasRectangle: !!(annotation.x !== undefined && annotation.y !== undefined),
                rectangle: { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height },
                imageWidth: annotation.imageWidth,
                imageHeight: annotation.imageHeight
            });
            
            let points = [];
            
            // Önce mevcut points array'ini kontrol et (kullanıcı tarafından düzenlenmiş polygon)
            if (annotation.points && Array.isArray(annotation.points) && annotation.points.length >= 3) {
                // Kullanıcı tarafından düzenlenmiş polygon koordinatlarını kullan
                points = annotation.points;
                console.log('✅ Mevcut points array kullanılıyor:', points);
            } else if (annotation.x !== undefined && annotation.y !== undefined && 
                      annotation.width !== undefined && annotation.height !== undefined) {
                // Rectangle'ı polygon'a çevir (4 köşe noktası)
                points = this.convertRectangleToPolygon(annotation);
                console.log('⚠️ Rectangle\'dan polygon oluşturuluyor:', points);
            } else {
                console.warn('⚠️ Annotation\'da geçerli koordinat verisi yok:', annotation);
                continue; // Bu annotation'ı atla
            }
            
            // Points'ları normalize et (0-1 arası)
            const normalizedPoints = points.map(point => ({
                x: Math.max(0, Math.min(1, (annotation?.imageWidth ? point.x / annotation.imageWidth : 0))),
                y: Math.max(0, Math.min(1, (annotation?.imageHeight ? point.y / annotation.imageHeight : 0)))
                }));
            // Noktaları saat yönünde sırala (YOLO segmentation gereksinimi)
            const sortedPoints = this.sortPointsClockwise(normalizedPoints);
            
            // Gereksiz noktaları temizle (çok yakın noktalar)
            const cleanedPoints = this.cleanPolygonPoints(sortedPoints);
            
            // En az 3 nokta olmalı
            if (cleanedPoints.length < 3) {
                console.warn('⚠️ Yeterli nokta yok, annotation atlanıyor:', cleanedPoints);
                continue;
            }
            
            // Debug: Final koordinatlar
            console.log('🔍 Final YOLO segmentation koordinatları:', {
                annotationId: annotation.id,
                originalPoints: points,
                normalizedPoints: normalizedPoints,
                sortedPoints: sortedPoints,
                cleanedPoints: cleanedPoints
            });
                
            // YOLO segmentation format: class_id x1 y1 x2 y2 x3 y3 ...
            let line = `${classId}`;
            cleanedPoints.forEach(point => {
                line += ` ${point.x.toFixed(6)} ${point.y.toFixed(6)}`;
            });
            content += line + '\n';
        }
        
        console.log('🔍 YOLO Segmentation label content:', content);
        return content;
    }

    // Noktaları saat yönünde sırala (YOLO segmentation gereksinimi)
    sortPointsClockwise(points) {
        if (points.length < 3) return points;
        
        // Merkez noktasını hesapla
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        
        // Her nokta için açı hesapla ve sırala (saat yönünde)
        return points.sort((a, b) => {
            const angleA = Math.atan2(a.y - centerY, a.x - centerX);
            const angleB = Math.atan2(b.y - centerY, b.x - centerX);
            return angleA - angleB;
        });
    }

    // Gereksiz noktaları temizle (çok yakın noktalar)
    cleanPolygonPoints(points) {
        if (points.length < 3) return points;
        
        const cleaned = [];
        const minDistance = 0.001; // Minimum mesafe (normalize edilmiş koordinatlarda)
        
        for (let i = 0; i < points.length; i++) {
            const current = points[i];
            const next = points[(i + 1) % points.length];
            
            // Mesafe hesapla
            const distance = Math.sqrt(
                Math.pow(current.x - next.x, 2) + Math.pow(current.y - next.y, 2)
            );
            
            // Yeterince uzak noktaları ekle
            if (distance > minDistance) {
                cleaned.push(current);
            }
        }
        
        // En az 3 nokta olmalı
        return cleaned.length >= 3 ? cleaned : points;
    }

    // Rectangle'ı polygon'a çevir (4 köşe noktası)
    convertRectangleToPolygon(annotation) {
        // Annotation yapısını kontrol et
        console.log('🔍 convertRectangleToPolygon - annotation yapısı:', annotation);
        
        let x, y, width, height;
        
        // Eğer annotation direkt olarak x, y, width, height içeriyorsa
        if (annotation.x !== undefined && annotation.y !== undefined) {
            x = annotation.x;
            y = annotation.y;
            width = annotation.width;
            height = annotation.height;
            console.log('✅ Direkt annotation değerleri:', { x, y, width, height });
        }
        // Eğer annotation_data.annotations içinde ise
        else if (annotation.annotation_data && annotation.annotation_data.annotations && annotation.annotation_data.annotations[0]) {
            const firstAnnotation = annotation.annotation_data.annotations[0];
            x = firstAnnotation.x;
            y = firstAnnotation.y;
            width = firstAnnotation.width;
            height = firstAnnotation.height;
            console.log('✅ annotation_data.annotations değerleri:', { x, y, width, height });
        }
        // Eğer hiçbiri yoksa hata
        else {
            console.error('❌ Rectangle koordinatları bulunamadı:', annotation);
            return [];
        }
        
        // Değerleri kontrol et
        if (x === undefined || y === undefined || width === undefined || height === undefined) {
            console.error('❌ Eksik rectangle değerleri:', { x, y, width, height });
            return [];
        }
        
        // 4 köşe noktası oluştur (saat yönünde)
        const points = [
            { x: x, y: y }, // Sol üst
            { x: x + width, y: y }, // Sağ üst
            { x: x + width, y: y + height }, // Sağ alt
            { x: x, y: y + height } // Sol alt
        ];
        
        console.log('✅ Oluşturulan polygon noktaları:', points);
        return points;
    }

    // En güncel annotation'ları veritabanından al
    async getFreshAnnotations(imageId) {
        try {
            const imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager || window.imageManager;
            const response = await imageManager.auth.makeRequest(
                `${imageManager.baseURL}/images/${imageId}/annotations`
            );
            
            if (response.ok) {
                const data = await response.json();
                console.log(`🔍 Resim ${imageId} için güncel annotation verisi:`, data);
                
                // Veritabanından gelen yapıyı kontrol et
                if (Array.isArray(data)) {
                    // Eğer data direkt array ise, her annotation'ın annotation_data.annotations'ını al
                    const allAnnotations = [];
                    data.forEach(annotationRecord => {
                        if (annotationRecord.annotation_data && annotationRecord.annotation_data.annotations) {
                            allAnnotations.push(...annotationRecord.annotation_data.annotations);
                        }
                    });
                    return allAnnotations;
                } else if (data && data.annotations && Array.isArray(data.annotations)) {
                    // annotations array'ini döndür
                    return data.annotations;
                } else {
                    console.warn(`Resim ${imageId} için beklenmeyen annotation yapısı:`, data);
                    return [];
                }
            } else {
                console.warn(`Resim ${imageId} için annotation alınamadı:`, response.status);
                return [];
            }
        } catch (error) {
            console.error(`Resim ${imageId} için annotation hatası:`, error);
            return [];
        }
    }

    // Hataları düzeltmek için fonksiyonlarda eksik parantezler, hatalı return, ve olası undefined kontrolleri eklendi.

    createYOLOYaml(classMapping) {
        // classMapping: {label: classId, ...}
        const classes = Object.keys(classMapping)
            .sort((a, b) => classMapping[a] - classMapping[b]);
        return `# YOLO Dataset Configuration
path: ./
train: train/images
val: val/images

nc: ${classes.length}
names: [${classes.map(c => `'${c}'`).join(', ')}]`;
    }

    createYOLOSegmentationYaml(classMapping) {
        const classes = Object.keys(classMapping)
            .sort((a, b) => classMapping[a] - classMapping[b]);
        return `# YOLO Segmentation Dataset Configuration
path:  # dataset root dir (leave empty for HUB)
train: images/train  # train images (relative to 'path')
val: images/val  # val images (relative to 'path')
test:  # test images (optional)

# Classes
names:
${classes.map((className, index) => `  ${index}: ${className}`).join('\n')}

# Segmentation specific - YOLOv8+ otomatik olarak anlar
# task: segment
# segments: true`;
    }

    createCOCOFormat(images, annotations, classMapping, exportOptions) {
        const cocoData = {
            info: {
                description: "Dataset exported from Labeling Tool",
                version: "1.0",
                year: new Date().getFullYear(),
                contributor: "Labeling Tool",
                date_created: new Date().toISOString()
            },
            licenses: [{
                id: 1,
                name: "Unknown",
                url: ""
            }],
            images: [],
            annotations: [],
            categories: []
        };

        // Categories
        const categories = Object.keys(classMapping).map((labelName, index) => ({
            id: classMapping[labelName] !== undefined ? classMapping[labelName] : index,
            name: this.transformLabelForExport ? this.transformLabelForExport(labelName, exportOptions) : labelName,
            supercategory: "object"
        }));
        cocoData.categories = categories;

        // Images and annotations
        let annotationId = 1;
        images.forEach((image, imageIndex) => {
            cocoData.images.push({
                id: imageIndex + 1,
                width: image.width || 1920,
                height: image.height || 1080,
                file_name: image.fileName,
                license: 1,
                date_captured: new Date().toISOString()
            });

            const imageAnnotations = (annotations && annotations[image.id]) ? annotations[image.id] : [];
            imageAnnotations.forEach(annotation => {
                const labelName = this.transformLabelForExport ? this.transformLabelForExport(annotation.label, exportOptions) : annotation.label;
                const categoryId = classMapping[labelName] !== undefined ? classMapping[labelName] : 0;

                cocoData.annotations.push({
                    id: annotationId++,
                    image_id: imageIndex + 1,
                    category_id: categoryId,
                    bbox: [
                        annotation.x !== undefined ? annotation.x : 0,
                        annotation.y !== undefined ? annotation.y : 0,
                        annotation.width !== undefined ? annotation.width : 0,
                        annotation.height !== undefined ? annotation.height : 0
                    ],
                    area: (annotation.width || 0) * (annotation.height || 0),
                    iscrowd: 0
                });
            });
        });

        return cocoData;
    }

    async createPascalVOCFiles(projectFolder, images, annotations, classMapping, exportOptions) {
        const annotationsFolder = projectFolder.folder('Annotations');
        const imagesFolder = projectFolder.folder('JPEGImages');

        for (const image of images) {
            // Resim dosyasını ekle
            if (exportOptions && exportOptions.includeImages) {
                const imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager || window.imageManager;
                const imageResponse = await imageManager.auth.makeRequest(
                    `${imageManager.baseURL}/images/${image.id}/file`
                );
                if (imageResponse.ok) {
                    const imageBlob = await imageResponse.blob();
                    imagesFolder.file(image.fileName, imageBlob);
                }
            }

            // XML dosyasını oluştur
            const xmlContent = this.createPascalVOCXML(
                image,
                (annotations && annotations[image.id]) ? annotations[image.id] : [],
                classMapping,
                exportOptions
            );
            const xmlFileName = image.fileName.replace(/\.[^/.]+$/, '.xml');
            annotationsFolder.file(xmlFileName, xmlContent);
        }
    }

    createPascalVOCXML(image, imageAnnotations, classMapping, exportOptions) {
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<annotation>
    <folder>JPEGImages</folder>
    <filename>${image.fileName}</filename>
    <path>./JPEGImages/${image.fileName}</path>
    <source>
        <database>Labeling Tool</database>
    </source>
    <size>
        <width>${image.width || 1920}</width>
        <height>${image.height || 1080}</height>
        <depth>3</depth>
    </size>
    <segmented>0</segmented>`;

        if (Array.isArray(imageAnnotations)) {
            imageAnnotations.forEach(annotation => {
                const labelName = this.transformLabelForExport ? this.transformLabelForExport(annotation.label, exportOptions) : annotation.label;
                xml += `
    <object>
        <name>${labelName}</name>
        <pose>Unspecified</pose>
        <truncated>0</truncated>
        <difficult>0</difficult>
        <bndbox>
            <xmin>${Math.round(annotation.x || 0)}</xmin>
            <ymin>${Math.round(annotation.y || 0)}</ymin>
            <xmax>${Math.round((annotation.x || 0) + (annotation.width || 0))}</xmax>
            <ymax>${Math.round((annotation.y || 0) + (annotation.height || 0))}</ymax>
        </bndbox>
    </object>`;
            });
        }

        xml += `
</annotation>`;

        return xml;
    }

    createJSONFormat(projectData, exportOptions) {
        const { images, annotations } = projectData;
        const imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager || window.imageManager;
        return {
            project: {
                name: (imageManager && imageManager.currentProject && imageManager.currentProject.name) ? imageManager.currentProject.name : 'dataset',
                exportDate: new Date().toISOString(),
                totalImages: images.length,
                totalAnnotations: Object.values(annotations).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0)
            },
            images: images.map(image => ({
                id: image.id,
                fileName: image.fileName,
                width: image.width || 1920,
                height: image.height || 1080,
                annotations: (annotations && annotations[image.id] ? annotations[image.id] : []).map(annotation => ({
                    id: annotation.id,
                    label: this.transformLabelForExport ? this.transformLabelForExport(annotation.label, exportOptions) : annotation.label,
                    type: annotation.type,
                    x: annotation.x,
                    y: annotation.y,
                    width: annotation.width,
                    height: annotation.height,
                    color: annotation.color
                }))
            }))
        };
    }

    createCSVFormat(images, annotations, classMapping, exportOptions) {
        let csv = 'image_id,image_name,annotation_id,label,class_id,x,y,width,height\n';
        images.forEach(image => {
            const imageAnnotations = (annotations && annotations[image.id]) ? annotations[image.id] : [];
            imageAnnotations.forEach(annotation => {
                const labelName = this.transformLabelForExport ? this.transformLabelForExport(annotation.label, exportOptions) : annotation.label;
                const classId = classMapping[labelName] !== undefined ? classMapping[labelName] : 0;
                csv += `${image.id},${image.fileName},${annotation.id},${labelName},${classId},${annotation.x},${annotation.y},${annotation.width},${annotation.height}\n`;
            });
        });
        return csv;
    }

    async addImagesToZip(projectFolder, images, exportOptions) {
        const imagesFolder = projectFolder.folder('images');
        const imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager || window.imageManager;

        for (const image of images) {
            let imageBlob;
            try {
                const filterResponse = await imageManager.auth.makeRequest(
                    `${imageManager.baseURL}/images/${image.id}/weather-filter`
                );
                if (filterResponse.ok) {
                    const filterData = await filterResponse.json();
                    if (filterData && filterData.type && filterData.type !== 'none') {
                        console.log(`🌤️ Resim ${image.id} için filtre uygulanıyor:`, filterData.type);
                        imageBlob = await this.getFilteredImageBlob(image, filterData.type);
                    }
                }
            } catch (error) {
                console.warn(`Resim ${image.id} için filtre kontrolü başarısız:`, error);
            }

            if (!imageBlob) {
                const imageResponse = await imageManager.auth.makeRequest(
                    `${imageManager.baseURL}/images/${image.id}/file`
                );
                if (imageResponse.ok) {
                    imageBlob = await imageResponse.blob();
                }
            }

            if (imageBlob) {
                imagesFolder.file(image.fileName, imageBlob);
            }
        }
    }

    async saveZipFile(zip, fileName) {
        const content = await zip.generateAsync({ type: "blob" });
        // Export işlemi sırasında showSaveFilePicker çalışmaz, otomatik indirme kullan
        console.log('💾 ZIP dosyası oluşturuldu, otomatik indirme başlatılıyor:', fileName);
        if (this.fallbackDownload) {
            this.fallbackDownload(content, fileName);
        } else {
            // fallbackDownload fonksiyonu yoksa klasik indirme
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        }
    }

    async getFilteredImageBlob(image, filterType) {
        try {
            console.log(`📸 Filtrelenmiş resim oluşturuluyor: ${filterType} filtresi ile`);
            const imageManager = this.labelingTool.imageManager || window.labelingTool?.imageManager || window.imageManager;
            const imageResponse = await imageManager.auth.makeRequest(
                `${imageManager.baseURL}/images/${image.id}/file`
            );
            if (!imageResponse.ok) {
                throw new Error('Resim alınamadı');
            }
            const originalBlob = await imageResponse.blob();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.crossOrigin = 'anonymous';

            return new Promise((resolve, reject) => {
                img.onload = () => {
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    ctx.drawImage(img, 0, 0);

                    if (this.labelingTool && this.labelingTool.applyWeatherFilter) {
                        console.log('🎨 Renk filtresi uygulanıyor:', filterType);
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const filteredData = this.labelingTool.applyWeatherFilter(imageData, filterType);
                        if (filteredData && filteredData instanceof ImageData) {
                            ctx.putImageData(filteredData, 0, 0);
                            console.log('✅ Renk filtresi uygulandı');
                        }
                    }

                    // Canvas efektlerini uygula (kar/yağmur taneleri) - PİKSEL DEĞİŞİMİ İLE
                    if (this.addWeatherEffectToPixels) {
                        console.log('🎨 Canvas efektleri uygulanıyor (piksel değişimi ile):', filterType);
                        this.addWeatherEffectToPixels(ctx, filterType, canvas.width, canvas.height);
                        console.log('✅ Canvas efektleri piksel olarak uygulandı');
                    }

                    canvas.toBlob((blob) => {
                        if (blob) {
                            console.log(`✅ Filtrelenmiş resim oluşturuldu: ${blob.size} bytes`);
                            resolve(blob);
                        } else {
                            reject(new Error('Canvas blob oluşturulamadı'));
                        }
                    }, 'image/jpeg', 0.9);
                };
                img.onerror = () => reject(new Error('Resim yüklenemedi'));
                img.src = URL.createObjectURL(originalBlob);
            });
        } catch (error) {
            console.error('Filtrelenmiş resim oluşturulurken hata:', error);
            throw error;
        }
    }

    addWeatherEffectToPixels(ctx, filterType, width, height) {
        if (!filterType || filterType === 'none') {
            return;
        }
        console.log('🎨 Piksel efektleri uygulanıyor:', filterType, 'Boyutlar:', width, 'x', height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        switch (filterType) {
            case 'snowy':
                this.addNightPixels(data, width, height); // Gece efekti
                ctx.putImageData(imageData, 0, 0);
                this.drawSnowOnCanvas(ctx, width, height); // Kar tanelerini canvas'a çiz
                break;
            case 'rainy':
                this.addNightPixels(data, width, height); // Gece efekti
                ctx.putImageData(imageData, 0, 0);
                this.drawRainOnCanvas(ctx, width, height); // Yağmur damlalarını canvas'a çiz
                break;
            case 'night':
                this.addNightPixels(data, width, height);
                ctx.putImageData(imageData, 0, 0);
                break;
            case 'sunny':
                this.addSunnyPixels(data, width, height);
                ctx.putImageData(imageData, 0, 0);
                break;
            case 'foggy':
                this.addFogPixels(data, width, height);
                ctx.putImageData(imageData, 0, 0);
                break;
            case 'sunset':
                this.addSunsetPixels(data, width, height);
                ctx.putImageData(imageData, 0, 0);
                break;
            case 'cloudy':
                this.addCloudyPixels(data, width, height);
                ctx.putImageData(imageData, 0, 0);
                break;
        }
        console.log('✅ Piksel efektleri tamamlandı:', filterType);
    }

    addSnowPixels(data, width, height) {
        const snowflakes = [];
        // Daha fazla kar tanesi ve daha büyük boyutlar
        for (let i = 0; i < 500; i++) {
            snowflakes.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 6 + 2, // Daha büyük kar taneleri
                opacity: Math.random() * 0.9 + 0.3 // Daha opak
            });
        }
        snowflakes.forEach(flake => {
            const centerX = Math.floor(flake.x);
            const centerY = Math.floor(flake.y);
            const radius = Math.floor(flake.size);
            for (let x = -radius; x <= radius; x++) {
                for (let y = -radius; y <= radius; y++) {
                    if (x * x + y * y <= radius * radius) {
                        const pixelX = centerX + x;
                        const pixelY = centerY + y;
                        if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
                            const index = (pixelY * width + pixelX) * 4;
                            data[index] = Math.min(255, data[index] + (255 - data[index]) * flake.opacity);
                            data[index + 1] = Math.min(255, data[index + 1] + (255 - data[index + 1]) * flake.opacity);
                            data[index + 2] = Math.min(255, data[index + 2] + (255 - data[index + 2]) * flake.opacity);
                        }
                    }
                }
            }
        });
    }

    // Kar tanelerini canvas'a çiz
    drawSnowOnCanvas(ctx, width, height) {
        console.log('❄️ Kar taneleri canvas\'a çiziliyor...');
        
        // Canvas ayarları
        ctx.save();
        ctx.globalAlpha = 0.8;
        
        // Kar taneleri oluştur
        for (let i = 0; i < 300; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * 4 + 2;
            
            // Kar tanesini çiz (beyaz daire)
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();
        }
        
        ctx.restore();
        console.log('✅ Kar taneleri çizildi');
    }

    // Yağmur damlalarını canvas'a çiz
    drawRainOnCanvas(ctx, width, height) {
        console.log('🌧️ Yağmur damlaları canvas\'a çiziliyor...');
        
        // Canvas ayarları
        ctx.save();
        ctx.strokeStyle = 'rgba(173, 216, 230, 0.6)'; // Açık mavi
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        
        // Yağmur damlaları oluştur
        for (let i = 0; i < 400; i++) {
            const startX = Math.random() * width;
            const startY = Math.random() * height;
            const length = Math.random() * 30 + 15;
            const angle = Math.random() * 0.4 + 0.1; // Hafif eğim
            
            // Yağmur damlasını çiz
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(
                startX + length * Math.sin(angle),
                startY + length * Math.cos(angle)
            );
            ctx.stroke();
        }
        
        ctx.restore();
        console.log('✅ Yağmur damlaları çizildi');
    }

    addRainPixels(data, width, height) {
        const raindrops = [];
        // Daha fazla yağmur damlası ve daha belirgin
        for (let i = 0; i < 800; i++) {
            raindrops.push({
                x: Math.random() * width,
                y: Math.random() * height,
                length: Math.random() * 40 + 15, // Daha uzun damlalar
                opacity: Math.random() * 0.8 + 0.4, // Daha opak
                angle: Math.random() * 0.4 + 0.1 // Daha eğik
            });
        }
        raindrops.forEach(drop => {
            const startX = Math.floor(drop.x);
            const startY = Math.floor(drop.y);
            const length = Math.floor(drop.length);
            const angle = drop.angle;
            for (let i = 0; i < length; i++) {
                const x = Math.floor(startX + i * Math.sin(angle));
                const y = Math.floor(startY + i * Math.cos(angle));
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    const index = (y * width + x) * 4;
                    data[index] = Math.min(255, data[index] + (173 - data[index]) * drop.opacity);
                    data[index + 1] = Math.min(255, data[index + 1] + (216 - data[index + 1]) * drop.opacity);
                    data[index + 2] = Math.min(255, data[index + 2] + (230 - data[index + 2]) * drop.opacity);
                }
            }
        });
    }

    addNightPixels(data, width, height) {
        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            data[i] = gray * 0.3;
            data[i + 1] = gray * 0.3;
            data[i + 2] = gray * 0.3;
        }
    }

    addSunnyPixels(data, width, height) {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] * 1.2);
            data[i + 1] = Math.min(255, data[i + 1] * 1.1);
            data[i + 2] = Math.min(255, data[i + 2] * 0.9);
        }
    }

    addFogPixels(data, width, height) {
        for (let i = 0; i < data.length; i += 4) {
            const fogFactor = 0.3;
            data[i] = Math.min(255, data[i] + (255 - data[i]) * fogFactor);
            data[i + 1] = Math.min(255, data[i + 1] + (255 - data[i + 1]) * fogFactor);
            data[i + 2] = Math.min(255, data[i + 2] + (255 - data[i + 2]) * fogFactor);
        }
    }

    addSunsetPixels(data, width, height) {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] * 1.3);
            data[i + 1] = Math.min(255, data[i + 1] * 0.8);
            data[i + 2] = Math.min(255, data[i + 2] * 0.6);
        }
    }

    addCloudyPixels(data, width, height) {
        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            data[i] = gray * 0.7;
            data[i + 1] = gray * 0.7;
            data[i + 2] = gray * 0.7;
        }
    }
}

// Export for use in main script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExportManager;
} else {
    window.ExportManager = ExportManager;
}
