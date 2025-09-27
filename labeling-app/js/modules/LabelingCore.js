// Core Labeling System - Ana etiketleme motoru
class LabelingCore {
    constructor() {
        // DOM elementleri cache'le
        this.domCache = new Map();
        
        // Canvas ve context
        this.canvas = this.getElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Ana state
        this.state = {
            image: null,
            currentTool: 'rectangle',
            isDrawing: false,
            annotations: [],
            currentAnnotation: null,
            focusedAnnotation: null,
            imageScale: 1,
            imageOffsetX: 0,
            imageOffsetY: 0,
            isSaved: true
        };
        
        // Performance optimizations
        this.imageCache = new Map();
        this.renderQueue = [];
        this.isRendering = false;
        
        this.init();
    }
    
    // DOM element cache sistemi
    getElement(id) {
        if (!this.domCache.has(id)) {
            const element = document.getElementById(id);
            if (element) {
                this.domCache.set(id, element);
            }
        }
        return this.domCache.get(id);
    }
    
    init() {
        this.setupCanvas();
        this.bindEvents();
        this.startRenderLoop();
    }
    
    setupCanvas() {
        const canvas = this.canvas;
        if (!canvas) return;
        
        // Canvas boyutlarını container'a göre ayarla
        const container = canvas.parentElement;
        if (!container) return;
        
        // Container boyutlarını al
        const containerWidth = container.clientWidth;
        const containerHeight = Math.max(container.clientHeight, 600); // Minimum 600px
        
        // High DPI support
        const dpr = window.devicePixelRatio || 1;
        
        // Canvas boyutlarını ayarla
        canvas.width = containerWidth * dpr;
        canvas.height = containerHeight * dpr;
        canvas.style.width = containerWidth + 'px';
        canvas.style.height = containerHeight + 'px';
        
        // Context'i scale et
        this.ctx.scale(dpr, dpr);
        
        console.log(`🖼️ Canvas setup: ${containerWidth}x${containerHeight} (DPR: ${dpr})`);
    }
    
    // Event binding - optimized
    bindEvents() {
        const canvas = this.canvas;
        if (!canvas) return;
        
        // Throttled event handlers
        const throttledMouseMove = this.throttle((e) => this.onMouseMove(e), 16);
        
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mousemove', throttledMouseMove);
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        canvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        // Window resize handling
        const resizeHandler = this.throttle(() => {
            this.setupCanvas();
            this.fitImageToCanvas();
            this.queueRender();
        }, 250);
        
        window.addEventListener('resize', resizeHandler);
    }
    
    // Mouse events
    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.state.isDrawing = true;
        this.state.startX = x;
        this.state.startY = y;
        
        // Yeni annotation başlat
        this.startNewAnnotation(x, y);
    }
    
    onMouseMove(e) {
        if (!this.state.isDrawing) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.updateCurrentAnnotation(x, y);
        this.queueRender();
    }
    
    onMouseUp(e) {
        if (!this.state.isDrawing) return;
        
        this.state.isDrawing = false;
        this.finishAnnotation();
        this.queueRender();
    }
    
    onMouseLeave(e) {
        this.state.isDrawing = false;
    }
    
    onKeyDown(e) {
        // Keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'z':
                    e.preventDefault();
                    this.undo();
                    break;
                case 's':
                    e.preventDefault();
                    this.saveAnnotations();
                    break;
                case 'Delete':
                case 'Backspace':
                    this.deleteSelectedAnnotation();
                    break;
            }
        }
    }
    
    // Annotation işlemleri
    startNewAnnotation(x, y) {
        this.state.currentAnnotation = {
            id: Date.now(),
            type: this.state.currentTool,
            x: x,
            y: y,
            width: 0,
            height: 0,
            label: '',
            confidence: 1.0
        };
    }
    
    updateCurrentAnnotation(x, y) {
        if (!this.state.currentAnnotation) return;
        
        const annotation = this.state.currentAnnotation;
        annotation.width = x - annotation.x;
        annotation.height = y - annotation.y;
    }
    
    finishAnnotation() {
        if (!this.state.currentAnnotation) return;
        
        const annotation = this.state.currentAnnotation;
        
        // Minimum boyut kontrolü
        if (Math.abs(annotation.width) < 10 || Math.abs(annotation.height) < 10) {
            this.state.currentAnnotation = null;
            return;
        }
        
        // Negative değerleri düzelt
        if (annotation.width < 0) {
            annotation.x += annotation.width;
            annotation.width = Math.abs(annotation.width);
        }
        if (annotation.height < 0) {
            annotation.y += annotation.height;
            annotation.height = Math.abs(annotation.height);
        }
        
        this.state.annotations.push(annotation);
        this.state.currentAnnotation = null;
        this.state.isSaved = false;
        
        // Auto-save
        this.autoSave();
    }
    
    deleteSelectedAnnotation() {
        if (!this.state.focusedAnnotation) return;
        
        const index = this.state.annotations.indexOf(this.state.focusedAnnotation);
        if (index > -1) {
            this.state.annotations.splice(index, 1);
            this.state.focusedAnnotation = null;
            this.state.isSaved = false;
            this.queueRender();
            this.autoSave();
        }
    }
    
    // Rendering sistemi
    queueRender() {
        if (!this.isRendering) {
            this.isRendering = true;
            requestAnimationFrame(() => this.render());
        }
    }
    
    render() {
        this.clearCanvas();
        this.drawImage();
        this.drawAnnotations();
        this.isRendering = false;
    }
    
    startRenderLoop() {
        const renderLoop = () => {
            if (this.renderQueue.length > 0) {
                this.render();
                this.renderQueue = [];
            }
            requestAnimationFrame(renderLoop);
        };
        renderLoop();
    }
    
    clearCanvas() {
        const canvas = this.canvas;
        this.ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
    }
    
    drawImage() {
        if (!this.state.image) return;
        
        this.ctx.drawImage(
            this.state.image,
            this.state.imageOffsetX,
            this.state.imageOffsetY,
            this.state.image.width * this.state.imageScale,
            this.state.image.height * this.state.imageScale
        );
    }
    
    drawAnnotations() {
        // Mevcut annotationları çiz
        this.state.annotations.forEach(annotation => {
            this.drawAnnotation(annotation, false);
        });
        
        // Şu anki annotation'ı çiz
        if (this.state.currentAnnotation) {
            this.drawAnnotation(this.state.currentAnnotation, true);
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
        if (annotation.label) {
            this.ctx.fillStyle = '#000';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(annotation.label, annotation.x, annotation.y - 5);
        }
        
        this.ctx.restore();
    }
    
    // Image işlemleri
    loadImage(src) {
        return new Promise((resolve, reject) => {
            // Cache'den kontrol et
            if (this.imageCache.has(src)) {
                this.state.image = this.imageCache.get(src);
                this.fitImageToCanvas();
                this.queueRender();
                resolve(this.state.image);
                return;
            }
            
            const img = new Image();
            img.onload = () => {
                this.imageCache.set(src, img);
                this.state.image = img;
                this.fitImageToCanvas();
                this.queueRender();
                resolve(img);
            };
            img.onerror = reject;
            img.src = src;
        });
    }
    
    fitImageToCanvas() {
        if (!this.state.image || !this.canvas) return;
        
        const canvasWidth = this.canvas.width / window.devicePixelRatio;
        const canvasHeight = this.canvas.height / window.devicePixelRatio;
        const imageAspect = this.state.image.width / this.state.image.height;
        const canvasAspect = canvasWidth / canvasHeight;
        
        // Minimum %80 canvas alanını kullan, maksimum %95
        const minScale = Math.min(canvasWidth * 0.8 / this.state.image.width, canvasHeight * 0.8 / this.state.image.height);
        const maxScale = Math.min(canvasWidth * 0.95 / this.state.image.width, canvasHeight * 0.95 / this.state.image.height);
        
        if (imageAspect > canvasAspect) {
            // Fotoğraf daha geniş - genişliği canvas'ın %90'ına sığdır
            this.state.imageScale = Math.max(minScale, canvasWidth * 0.9 / this.state.image.width);
        } else {
            // Fotoğraf daha yüksek - yüksekliği canvas'ın %90'ına sığdır  
            this.state.imageScale = Math.max(minScale, canvasHeight * 0.9 / this.state.image.height);
        }
        
        // Maksimum scale'i sınırla
        this.state.imageScale = Math.min(this.state.imageScale, maxScale);
        
        // Tam ortala
        this.state.imageOffsetX = (canvasWidth - this.state.image.width * this.state.imageScale) / 2;
        this.state.imageOffsetY = (canvasHeight - this.state.image.height * this.state.imageScale) / 2;
        
        console.log(`📏 Image scaling: ${this.state.imageScale.toFixed(3)}x, Position: (${this.state.imageOffsetX.toFixed(1)}, ${this.state.imageOffsetY.toFixed(1)})`);
    }
    
    // Auto-save sistemi
    autoSave() {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            this.saveAnnotations();
        }, 2000); // 2 saniye sonra kaydet
    }
    
    async saveAnnotations() {
        if (!window.imageManager?.currentImage) return;
        
        try {
            const imageId = window.imageManager.currentImage.id;
            
            // APIManager kullan
            if (window.apiManager) {
                console.log('💾 LabelingCore: APIManager ile kaydetme yapılıyor');
                const result = await window.apiManager.saveAnnotations(imageId, this.state.annotations);
                
                if (result.success) {
                    this.state.isSaved = true;
                    this.showStatus('Etiketler kaydedildi ✓', 'success');
                } else {
                    throw new Error(result.error || 'Kaydetme başarısız');
                }
            } else {
                // Fallback: Doğrudan fetch kullan
                console.log('💾 LabelingCore: Fallback fetch ile kaydetme yapılıyor');
                
                // URL'i doğru şekilde oluştur
                const hostname = window.location.hostname;
                const port = window.location.port || '3000';
                const baseURL = `http://${hostname}:${port}/api`;
                
                console.log('🌐 LabelingCore: Base URL:', baseURL);
                
                const response = await fetch(`${baseURL}/images/${imageId}/annotations`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ annotations: this.state.annotations })
                });
                
                console.log('📡 LabelingCore: Response status:', response.status);
                
                if (response.ok) {
                    this.state.isSaved = true;
                    this.showStatus('Etiketler kaydedildi ✓', 'success');
                } else {
                    const errorText = await response.text();
                    console.error('❌ LabelingCore: HTTP Error:', response.status, errorText);
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }
            }
        } catch (error) {
            console.error('❌ LabelingCore: Kaydetme hatası:', error);
            this.showStatus('Kaydetme hatası: ' + error.message, 'error');
        }
    }
    
    // Utility functions
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }
    
    showStatus(message, type = 'info') {
        // Status message göster
        const statusElement = this.getElement('status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status ${type}`;
            setTimeout(() => {
                statusElement.textContent = '';
                statusElement.className = 'status';
            }, 3000);
        }
    }
    
    undo() {
        if (this.state.annotations.length > 0) {
            this.state.annotations.pop();
            this.state.isSaved = false;
            this.queueRender();
            this.autoSave();
        }
    }
    
    // API
    getAnnotations() {
        return this.state.annotations;
    }
    
    setAnnotations(annotations) {
        this.state.annotations = annotations || [];
        this.queueRender();
    }
    
    clearAnnotations() {
        this.state.annotations = [];
        this.state.currentAnnotation = null;
        this.state.focusedAnnotation = null;
        this.queueRender();
    }
    
    destroy() {
        // Cleanup
        this.imageCache.clear();
        this.domCache.clear();
        clearTimeout(this.autoSaveTimeout);
    }
}