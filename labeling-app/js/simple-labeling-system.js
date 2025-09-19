// Simple Labeling System - Tek dosyada basit ve güvenilir etiketleme sistemi
class SimpleLabelingSystem {
    constructor() {
        console.log('🎯 Simple Labeling System başlatılıyor...');
        
        // DOM elemanları
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentImage = document.getElementById('currentImage');
        
        // State
        this.annotations = [];
        this.currentAnnotation = null;
        this.isDrawing = false;
        this.image = null;
        this.imageScale = 1;
        this.imageOffsetX = 0;
        this.imageOffsetY = 0;
        
        // Mouse state
        this.startX = 0;
        this.startY = 0;
        
        // Auto-save
        this.saveTimeout = null;
        
        this.init();
    }
    
    init() {
        console.log('🔧 Sistem başlatılıyor...');
        
        // Canvas hazır olana kadar bekle
        if (!this.canvas) {
            console.log('⏳ Canvas bekleniyor...');
            setTimeout(() => {
                this.canvas = document.getElementById('canvas');
                this.ctx = this.canvas?.getContext('2d');
                if (this.canvas) {
                    this.setupCanvas();
                    this.bindEvents();
                    console.log('✅ Simple Labeling System hazır (delayed)');
                } else {
                    console.error('❌ Canvas element hala bulunamadı');
                }
            }, 500);
            return;
        }
        
        this.setupCanvas();
        this.bindEvents();
        console.log('✅ Simple Labeling System hazır');
    }
    
    setupCanvas() {
        if (!this.canvas) {
            console.error('❌ Canvas element bulunamadı');
            return;
        }
        
        // Container boyutlarını al
        const container = this.canvas.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = Math.max(container.clientHeight, 600);
        
        // Canvas boyutlarını ayarla
        this.canvas.width = containerWidth;
        this.canvas.height = containerHeight;
        this.canvas.style.width = containerWidth + 'px';
        this.canvas.style.height = containerHeight + 'px';
        
        console.log(`📐 Canvas: ${containerWidth}x${containerHeight}`);
    }
    
    bindEvents() {
        if (!this.canvas) return;
        
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        // Window resize
        window.addEventListener('resize', () => {
            setTimeout(() => {
                this.setupCanvas();
                this.fitImageToCanvas();
                this.redraw();
            }, 100);
        });
        
        console.log('📝 Event listeners bağlandı');
    }
    
    // Mouse Events
    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Fotoğraf alanı kontrolü
        if (!this.isPointInImage(x, y)) {
            console.log('📍 Fotoğraf dışına tıklandı, işlem yapılmadı');
            return;
        }
        
        this.isDrawing = true;
        this.startX = x;
        this.startY = y;
        
        // Yeni annotation başlat
        this.currentAnnotation = {
            id: Date.now(),
            x: x,
            y: y,
            width: 0,
            height: 0,
            label: 'unlabeled'
        };
        
        console.log('🎯 Yeni etiket çizimi başladı:', x, y);
    }
    
    onMouseMove(e) {
        if (!this.isDrawing || !this.currentAnnotation) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Annotation boyutunu güncelle
        this.currentAnnotation.width = x - this.currentAnnotation.x;
        this.currentAnnotation.height = y - this.currentAnnotation.y;
        
        this.redraw();
    }
    
    onMouseUp(e) {
        if (!this.isDrawing || !this.currentAnnotation) return;
        
        this.isDrawing = false;
        
        // Minimum boyut kontrolü
        if (Math.abs(this.currentAnnotation.width) < 10 || Math.abs(this.currentAnnotation.height) < 10) {
            console.log('⚠️ Çok küçük annotation, iptal edildi');
            this.currentAnnotation = null;
            this.redraw();
            return;
        }
        
        // Negative değerleri düzelt
        if (this.currentAnnotation.width < 0) {
            this.currentAnnotation.x += this.currentAnnotation.width;
            this.currentAnnotation.width = Math.abs(this.currentAnnotation.width);
        }
        if (this.currentAnnotation.height < 0) {
            this.currentAnnotation.y += this.currentAnnotation.height;
            this.currentAnnotation.height = Math.abs(this.currentAnnotation.height);
        }
        
        // Label seçme modalı göster
        this.showLabelModal(this.currentAnnotation);
        
        console.log('🏷️ Etiket çizimi tamamlandı, label seçimi bekleniyor...');
    }
    
    onMouseLeave(e) {
        this.isDrawing = false;
        this.currentAnnotation = null;
        this.redraw();
    }
    
    onKeyDown(e) {
        // Ctrl+S veya Cmd+S - Kaydet
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.saveAnnotations();
        }
        
        // Delete veya Backspace - Son etiketi sil
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.annotations.length > 0) {
                this.annotations.pop();
                console.log('🗑️ Son etiket silindi');
                this.redraw();
                this.autoSave();
            }
        }
    }
    
    // Image işlemleri
    loadImage(src) {
        console.log('📸 Fotoğraf yükleniyor:', src);
        
        this.image = new Image();
        this.image.onload = () => {
            console.log('✅ Fotoğraf yüklendi:', this.image.width, 'x', this.image.height);
            this.fitImageToCanvas();
            this.redraw();
        };
        this.image.onerror = () => {
            console.error('❌ Fotoğraf yüklenemedi:', src);
        };
        this.image.src = src;
    }
    
    fitImageToCanvas() {
        if (!this.image || !this.canvas) return;
        
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const imageAspect = this.image.width / this.image.height;
        const canvasAspect = canvasWidth / canvasHeight;
        
        // Fotoğrafı canvas'ın %90'ına sığdır
        if (imageAspect > canvasAspect) {
            this.imageScale = (canvasWidth * 0.9) / this.image.width;
        } else {
            this.imageScale = (canvasHeight * 0.9) / this.image.height;
        }
        
        // Ortalama konumlandır
        this.imageOffsetX = (canvasWidth - this.image.width * this.imageScale) / 2;
        this.imageOffsetY = (canvasHeight - this.image.height * this.imageScale) / 2;
        
        console.log(`📏 Image scale: ${this.imageScale.toFixed(3)}, offset: (${this.imageOffsetX.toFixed(1)}, ${this.imageOffsetY.toFixed(1)})`);
    }
    
    isPointInImage(x, y) {
        if (!this.image) return false;
        
        const imageLeft = this.imageOffsetX;
        const imageTop = this.imageOffsetY;
        const imageRight = imageLeft + (this.image.width * this.imageScale);
        const imageBottom = imageTop + (this.image.height * this.imageScale);
        
        return x >= imageLeft && x <= imageRight && y >= imageTop && y <= imageBottom;
    }
    
    // Render
    redraw() {
        if (!this.ctx) return;
        
        const canvas = this.canvas;
        this.ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Fotoğrafı çiz
        if (this.image) {
            this.ctx.drawImage(
                this.image,
                this.imageOffsetX,
                this.imageOffsetY,
                this.image.width * this.imageScale,
                this.image.height * this.imageScale
            );
        }
        
        // Annotation'ları çiz
        this.annotations.forEach(annotation => {
            this.drawAnnotation(annotation, false);
        });
        
        // Mevcut annotation'ı çiz
        if (this.currentAnnotation) {
            this.drawAnnotation(this.currentAnnotation, true);
        }
    }
    
    drawAnnotation(annotation, isActive = false) {
        this.ctx.save();
        
        // Stil ayarları
        this.ctx.strokeStyle = isActive ? '#ff0000' : '#00ff00';
        this.ctx.lineWidth = 2;
        this.ctx.fillStyle = isActive ? 'rgba(255, 0, 0, 0.1)' : 'rgba(0, 255, 0, 0.1)';
        
        // Dikdörtgen çiz
        this.ctx.fillRect(annotation.x, annotation.y, annotation.width, annotation.height);
        this.ctx.strokeRect(annotation.x, annotation.y, annotation.width, annotation.height);
        
        // Label çiz
        if (annotation.label && annotation.label !== 'unlabeled') {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(annotation.label, annotation.x, annotation.y - 5);
        }
        
        this.ctx.restore();
    }
    
    // API işlemleri
    async saveAnnotations() {
        if (!window.imageManager?.currentImage) {
            console.log('⚠️ Mevcut fotoğraf yok, kaydetme atlandı');
            return;
        }
        
        try {
            console.log('💾 Etiketler kaydediliyor...', this.annotations.length, 'adet');
            
            const imageId = window.imageManager.currentImage.id;
            const response = await fetch(`http://${window.location.hostname}:3000/api/images/${imageId}/annotations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ annotations: this.annotations })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Etiketler kaydedildi:', result.saved_count);
                this.showMessage('Etiketler kaydedildi ✓', 'success');
            } else {
                throw new Error('Kaydetme başarısız');
            }
        } catch (error) {
            console.error('❌ Kaydetme hatası:', error);
            this.showMessage('Kaydetme hatası ✗', 'error');
        }
    }
    
    async loadAnnotations(imageId) {
        if (!imageId) {
            console.log('⚠️ Image ID yok, etiket yükleme atlandı');
            return;
        }
        
        try {
            console.log('📋 Simple System - Etiketler yükleniyor...', imageId);
            
            const response = await fetch(`http://${window.location.hostname}:3000/api/images/${imageId}/annotations`);
            
            if (response.ok) {
                const dbAnnotations = await response.json();
                this.annotations = [];
                
                dbAnnotations.forEach(dbAnnotation => {
                    const annotationData = dbAnnotation.annotation_data;
                    if (annotationData && annotationData.annotations) {
                        annotationData.annotations.forEach(ann => {
                            // Validation
                            if (this.validateAnnotation(ann)) {
                                ann.dbId = dbAnnotation.id;
                                this.annotations.push(ann);
                            }
                        });
                    }
                });
                
                console.log('✅ Simple System - Etiketler yüklendi:', this.annotations.length, 'adet');
                this.redraw();
            } else {
                console.log('ℹ️ Bu fotoğraf için etiket bulunamadı');
                this.annotations = [];
                this.redraw();
            }
        } catch (error) {
            console.error('❌ Simple System etiket yükleme hatası:', error);
            this.annotations = [];
            this.redraw();
        }
    }
    
    validateAnnotation(annotation) {
        return annotation &&
               typeof annotation.x === 'number' &&
               typeof annotation.y === 'number' &&
               typeof annotation.width === 'number' &&
               typeof annotation.height === 'number' &&
               annotation.width > 0 &&
               annotation.height > 0;
    }
    
    // ImageManager ile uyumlu API
    updateImageDisplay() {
        // ImageManager tarafından çağrılabilir
        this.redraw();
    }
    
    updateAnnotationList() {
        // Backward compatibility
        this.redraw();
    }
    
    updateProjectStats() {
        // Backward compatibility
        console.log('📊 Proje istatistikleri:', this.annotations.length, 'etiket');
    }
    
    // Auto-save
    autoSave() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.saveAnnotations();
        }, 2000); // 2 saniye sonra otomatik kaydet
    }
    
    // Utility
    showMessage(message, type = 'info') {
        console.log('📢', message);
        
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 5px;
            z-index: 10000;
            font-weight: bold;
            ${type === 'success' ? 'background: #4caf50; color: white;' : 'background: #f44336; color: white;'}
        `;
        messageEl.textContent = message;
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            messageEl.remove();
        }, 3000);
    }
    
    // Label seçme modalı
    showLabelModal(annotation) {
        // Modal HTML oluştur
        const modal = document.createElement('div');
        modal.id = 'labelModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            min-width: 400px;
            max-width: 500px;
        `;
        
        modalContent.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #333;">🏷️ Etiket Adını Girin</h3>
            <input type="text" id="labelInput" placeholder="Etiket adını yazın..." 
                   style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 5px; font-size: 16px; margin-bottom: 20px; box-sizing: border-box;">
            <div style="margin-bottom: 20px;">
                <label style="color: #666; font-size: 14px;">Hızlı Seçim:</label>
                <div style="margin-top: 10px;">
                    <button class="quick-label" data-label="araba" style="margin: 5px; padding: 8px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">🚗 Araba</button>
                    <button class="quick-label" data-label="insan" style="margin: 5px; padding: 8px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">👤 İnsan</button>
                    <button class="quick-label" data-label="bisiklet" style="margin: 5px; padding: 8px 12px; background: #ffc107; color: black; border: none; border-radius: 4px; cursor: pointer;">🚲 Bisiklet</button>
                    <button class="quick-label" data-label="motosiklet" style="margin: 5px; padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">🏍️ Motosiklet</button>
                    <button class="quick-label" data-label="hayvan" style="margin: 5px; padding: 8px 12px; background: #6f42c1; color: white; border: none; border-radius: 4px; cursor: pointer;">🐕 Hayvan</button>
                </div>
            </div>
            <div style="text-align: right;">
                <button id="cancelLabel" style="margin-right: 10px; padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">❌ İptal</button>
                <button id="confirmLabel" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">✅ Onayla</button>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        const labelInput = document.getElementById('labelInput');
        const confirmBtn = document.getElementById('confirmLabel');
        const cancelBtn = document.getElementById('cancelLabel');
        const quickLabels = document.querySelectorAll('.quick-label');
        
        // Focus input
        labelInput.focus();
        
        // Hızlı seçim butonları
        quickLabels.forEach(btn => {
            btn.addEventListener('click', () => {
                labelInput.value = btn.dataset.label;
                labelInput.focus();
            });
        });
        
        // Enter ile onayla
        labelInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                confirmLabel();
            } else if (e.key === 'Escape') {
                cancelLabel();
            }
        });
        
        // Onayla
        const confirmLabel = () => {
            const labelText = labelInput.value.trim();
            if (labelText) {
                annotation.label = labelText;
                this.annotations.push(annotation);
                this.currentAnnotation = null;
                this.redraw();
                this.autoSave();
                console.log('✅ Etiket eklendi:', labelText);
                this.showMessage(`Etiket eklendi: ${labelText}`, 'success');
            } else {
                labelInput.focus();
                labelInput.style.borderColor = '#dc3545';
                return;
            }
            modal.remove();
        };
        
        // İptal
        const cancelLabel = () => {
            this.currentAnnotation = null;
            this.redraw();
            console.log('❌ Etiket iptal edildi');
            modal.remove();
        };
        
        confirmBtn.addEventListener('click', confirmLabel);
        cancelBtn.addEventListener('click', cancelLabel);
        
        // Modal dışına tıklama ile iptal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cancelLabel();
            }
        });
    }

    // Public API
    clearAnnotations() {
        this.annotations = [];
        this.currentAnnotation = null;
        this.redraw();
        console.log('🧹 Tüm etiketler temizlendi');
    }
    
    getAnnotations() {
        return this.annotations;
    }
    
    setAnnotations(annotations) {
        this.annotations = annotations || [];
        this.redraw();
        console.log('📥 Etiketler ayarlandı:', this.annotations.length, 'adet');
    }
}