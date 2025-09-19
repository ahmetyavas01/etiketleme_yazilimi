/**
 * Canvas Manager Module
 * Handles canvas operations, drawing, and rendering
 */
class CanvasManager {
    constructor(labelingTool) {
        this.labelingTool = labelingTool;
        this.canvas = document.getElementById('canvas');
        
        // Weather filter cache
        this.filteredImageData = null;
        this.lastFilterType = null;
        this.lastImageRect = null;
        
        console.log('🎨 CanvasManager constructor çağrıldı');
        console.log('🎨 Canvas element:', this.canvas);
        
        // DOM hazır olma kontrolü
        if (!this.canvas) {
            console.error('❌ Canvas element bulunamadı!');
            throw new Error('Canvas element not found. Make sure DOM is loaded before initializing CanvasManager.');
        }
        
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error('❌ Canvas 2D context bulunamadı!');
            throw new Error('Canvas 2D context not available.');
        }
        
        console.log('✅ Canvas ve context hazır, event listener\'lar ekleniyor...');
        this.setupEventListeners();
        console.log('✅ Event listener\'lar eklendi');
    }

    setupEventListeners() {
        console.log('🎧 Event listener\'lar ekleniyor...');
        // Canvas event listeners
        this.canvas.addEventListener('mousedown', (e) => {
            console.log('🎧 mousedown event listener çalıştı');
            this.handleMouseDown(e);
        });
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('dblclick', (e) => this.labelingTool.handleDoubleClick(e));
        this.canvas.addEventListener('contextmenu', (e) => this.labelingTool.handleRightClick(e), { passive: false });
        this.canvas.addEventListener('wheel', (e) => this.labelingTool.handleWheel(e), { passive: false });
        console.log('🎧 Event listener\'lar eklendi');
        
        // Coordinate display
        this.canvas.addEventListener('mouseenter', () => {
            this.labelingTool.showCoordinates();
            this.labelingTool.showFullscreenCrosshairCursor();
        });
        this.canvas.addEventListener('mouseleave', () => {
            this.labelingTool.hideCoordinates();
            this.labelingTool.hideFullscreenCrosshairCursor();
        });
    }

    handleMouseDown(e) {
        console.log('🖱️ CanvasManager.handleMouseDown çağrıldı!', e);
        this.labelingTool.handleMouseDown(e);
    }

    handleMouseMove(e) {
        this.labelingTool.handleMouseMove(e);
        this.labelingTool.updateCoordinates(e);
    }

    handleMouseUp(e) {
        // Tüm tool'larda handleMouseUp çalışmalı
        this.labelingTool.handleMouseUp(e);
    }

    handleClick(e) {
        // Tüm tool'larda handleClick çalışmalı (focus işlemi için)
        this.labelingTool.handleClick(e);
    }


    resizeCanvas() {
        const container = document.getElementById('canvasContainer');
        const rect = container.getBoundingClientRect();
        
        // HiDPI desteği
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = rect.width - 4;
        const displayHeight = rect.height - 4;
        
        // Canvas boyutunu ayarla
        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';
        
        // Context'i scale et
        this.ctx.scale(dpr, dpr);
        
        this.labelingTool.redraw();
    }

    clearCanvas() {
        // Transform'u sıfırla ve temizle
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
    }

    drawImage() {
        if (!this.labelingTool.image) return;

        this.ctx.save();
        this.ctx.setTransform(this.labelingTool.zoom, 0, 0, this.labelingTool.zoom, this.labelingTool.panX, this.labelingTool.panY);
        this.ctx.drawImage(this.labelingTool.image, 0, 0, this.labelingTool.image.width, this.labelingTool.image.height);
        this.ctx.restore();
    }

    drawAnnotations() {
        this.labelingTool.annotations.forEach(annotation => {
            // Sadece focus'lanan annotation'lar için handle göster
            const isFocused = annotation === this.labelingTool.focusedAnnotation;
            this.drawAnnotation(annotation, isFocused);
        });
    }

    drawAnnotation(annotation, isSelected = false) {
        if (annotation.type === 'rectangle') {
            this.drawRectangle(annotation, isSelected);
        } else if (annotation.type === 'polygon') {
            this.drawPolygon(annotation, isSelected);
        }
    }

    drawRectangle(annotation, isSelected) {
        // Rectangle çizimi - Polygon stili (her köşe bağımsız)
        const isFocused = this.labelingTool.focusedAnnotation && this.labelingTool.focusedAnnotation.id === annotation.id;
        const isLocked = annotation.locked || false;
        const strokeColor = annotation.color || '#007AFF';
        
        // Rectangle'ı polygon'a dönüştür (eğer henüz dönüştürülmemişse)
        this.convertRectangleToPolygon(annotation);
        
        // Transform kullanarak image-space'inde çiz
        this.ctx.save();
        this.ctx.setTransform(
            this.labelingTool.zoom, 0, 0, this.labelingTool.zoom, 
            this.labelingTool.panX, this.labelingTool.panY
        );
        
        // Çizgi stili
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 2 / this.labelingTool.zoom; // Zoom'a göre ayarla
        this.ctx.setLineDash([]);
        
        if (isLocked) {
            // Kilitli için gri çizgi
            this.ctx.strokeStyle = '#8E8E93';
            this.ctx.lineWidth = 2 / this.labelingTool.zoom;
        } else if (isFocused) {
            // Focus için kesikli çizgi
            this.ctx.setLineDash([6 / this.labelingTool.zoom, 3 / this.labelingTool.zoom]);
        }
        
        // Polygon olarak çiz - image koordinatlarında
        this.ctx.beginPath();
        this.ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
        for (let i = 1; i < annotation.points.length; i++) {
            this.ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
        }
        this.ctx.closePath();
        this.ctx.stroke();
        
        this.ctx.restore();
        
        // UI overlay'ler için transform'u sıfırla
        this.drawPolygonLabelText(annotation, []);
        
        // Sadece focus'lanan annotation için handle'ları göster
        if (isFocused) {
            this.drawRectangleHandles(annotation);
        }
    }

    drawLockIcon(annotation, canvasPoints) {
        // Kilit simgesini annotation'ın ortasına çiz
        const centerX = canvasPoints.reduce((sum, point) => sum + point.x, 0) / canvasPoints.length;
        const centerY = canvasPoints.reduce((sum, point) => sum + point.y, 0) / canvasPoints.length;
        
        // Kilit simgesi boyutu
        const lockSize = 16;
        const x = centerX - lockSize / 2;
        const y = centerY - lockSize / 2;
        
        // Kilit arka planı (yuvarlak)
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, lockSize / 2 + 2, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Kilit simgesi - cross-platform SVG benzeri çizim
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        
        // Kilit gövdesi
        this.ctx.fillRect(x + 4, y + 8, 8, 6);
        // Kilit kemeri
        this.ctx.beginPath();
        this.ctx.arc(centerX, y + 6, 4, Math.PI, 0, false);
        this.ctx.stroke();
    }

    drawPolygon(annotation, isSelected) {
        // Transform kullanarak image-space'inde çiz
        this.ctx.save();
        this.ctx.setTransform(
            this.labelingTool.zoom, 0, 0, this.labelingTool.zoom, 
            this.labelingTool.panX, this.labelingTool.panY
        );
        
        // Focuslanan etiketi kesikli çizgi ile göster
        const isFocused = this.labelingTool.focusedAnnotation && this.labelingTool.focusedAnnotation.id === annotation.id;
        const strokeColor = annotation.color || '#2ecc71';
        const lineWidth = 2 / this.labelingTool.zoom; // Zoom'a göre ayarla
        
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = lineWidth;
        
        if (isFocused) {
            // Kesikli çizgi ayarla
            this.ctx.setLineDash([8 / this.labelingTool.zoom, 4 / this.labelingTool.zoom]);
        } else {
            // Düz çizgi
            this.ctx.setLineDash([]);
        }
        
        this.ctx.beginPath();
        this.ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
        
        for (let i = 1; i < annotation.points.length; i++) {
            this.ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
        }
        
        this.ctx.closePath();
        // Sadece kenar çizgisi, dolgu yok
        this.ctx.stroke();
        
        this.ctx.restore();
        
        // UI overlay'ler için transform'u sıfırla
        this.drawPolygonLabelText(annotation, []);
        
        // Sadece focus'lanan annotation için handle'ları göster
        if (isFocused) {
            this.drawPolygonHandles(annotation);
        }
    }

    // drawResizeHandles fonksiyonu kaldırıldı - gereksiz tekrar

    drawRectangleHandles(annotation) {
        // Rectangle handle'ları - Köşe + Kenar handle'ları
        // Sabit ekran-piksel handle boyutu
        const handleSize = 8; // Sabit boyut - zoom'dan etkilenmez
        
        // Rectangle'ı polygon'a dönüştür (eğer henüz dönüştürülmemişse)
        this.convertRectangleToPolygon(annotation);
        
        // Polygon noktalarını canvas koordinatlarına çevir
        const canvasPoints = annotation.points.map(point => 
            this.labelingTool.imageToCanvas(point.x, point.y)
        );

        // Handle stili
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#007AFF';
        this.ctx.lineWidth = 2;

        // 1. Köşe handle'ları çiz (kare)
        canvasPoints.forEach((point, index) => {
            this.ctx.beginPath();
            this.ctx.rect(point.x - handleSize/2, point.y - handleSize/2, handleSize, handleSize);
            this.ctx.fill();
            this.ctx.stroke();
        });
        
        // 2. Kenar handle'ları çiz (daire)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#FF6B6B';
        this.ctx.lineWidth = 2;
        
        for (let i = 0; i < canvasPoints.length; i++) {
            const currentPoint = canvasPoints[i];
            const nextPoint = canvasPoints[(i + 1) % canvasPoints.length];
            
            // Kenar orta noktasını hesapla
            const midX = (currentPoint.x + nextPoint.x) / 2;
            const midY = (currentPoint.y + nextPoint.y) / 2;
            
            this.ctx.beginPath();
            this.ctx.arc(midX, midY, handleSize / 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }
    }

    // Rectangle'ı polygon'a dönüştür (CanvasManager'da)
    convertRectangleToPolygon(annotation) {
        if (annotation.points) return; // Zaten dönüştürülmüş
        
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
    }

    drawPolygonHandles(annotation) {
        // Orijinal image koordinatlarını kullan
        const originalPoints = annotation.points;
        const handleSize = 8; // Sabit handle boyutu (zoom'dan etkilenmez)

        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#2c3e50';
        this.ctx.lineWidth = 1; // Sabit çizgi kalınlığı

        originalPoints.forEach(point => {
            // Sadece pozisyonu canvas'a çevir, boyutu sabit
            const canvasPoint = this.labelingTool.imageToCanvas(point.x, point.y);
            
            this.ctx.beginPath();
            this.ctx.arc(canvasPoint.x, canvasPoint.y, handleSize / 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        });
    }

    drawLabelText(annotation, canvasCoords, canvasWidth, canvasHeight) {
        if (!annotation.label) return;

        this.ctx.save();
        
        // Transform'u sıfırla - label'lar zoom'dan etkilenmesin
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Sabit font boyutu ve genişlik (zoom'dan etkilenmez)
        const fontSize = 14; // getLabelPosition ile uyumlu
        const textWidth = 120; // getLabelPosition ile uyumlu
        const textHeight = fontSize;
        this.ctx.font = `bold ${fontSize}px Arial`;
        
        // Arka plan rengi (etiket rengi ile aynı)
        const bgColor = annotation.color || '#2ecc71';
        const bgAlpha = 0.8;
        
        // Metin pozisyonu - getLabelPosition fonksiyonunu kullan
        const labelPos = this.labelingTool.getLabelPosition(annotation);
        let textX, textY;
        
        if (labelPos) {
            // Transform sıfırlandığı için koordinatları zoom'a göre ayarla
            textX = labelPos.x;
            textY = labelPos.y;
        } else {
            // Fallback: sol üst köşe pozisyonu
            textX = canvasCoords.x + 5;
            textY = canvasCoords.y - 5;
        }
        
        // Konuşma balonu çiz
        this.drawSpeechBubble(textX, textY, textWidth, textHeight, bgColor, bgAlpha, annotation);
        
        this.ctx.restore();
    }

    drawPolygonLabelText(annotation, canvasPoints) {
        if (!annotation.label) return;

        this.ctx.save();
        
        // Transform'u sıfırla - label'lar zoom'dan etkilenmesin
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Sabit font boyutu ve genişlik (zoom'dan etkilenmez)
        const fontSize = 14; // getLabelPosition ile uyumlu
        const textWidth = 120; // getLabelPosition ile uyumlu
        this.ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        
        // Etiket pozisyonu - getLabelPosition fonksiyonunu kullan
        const labelPos = this.labelingTool.getLabelPosition(annotation);
        let textX, textY;
        
        if (labelPos) {
            // Transform sıfırlandığı için koordinatları zoom'a göre ayarla
            textX = labelPos.x;
            textY = labelPos.y;
        } else {
            // Fallback: sol üst köşe pozisyonu
            let leftTopPoint;
            if (annotation.points && annotation.points.length > 0) {
                // Polygon için sol üst köşe bul
                const xs = annotation.points.map(p => p.x);
                const ys = annotation.points.map(p => p.y);
                const minX = Math.min(...xs);
                const minY = Math.min(...ys);
                leftTopPoint = { x: minX, y: minY };
            } else {
                // Rectangle için sol üst köşe
                leftTopPoint = { x: annotation.x, y: annotation.y };
            }
            
            // Sol üst köşeyi canvas'a çevir
            const canvasLeftTop = this.labelingTool.imageToCanvas(leftTopPoint.x, leftTopPoint.y);
            
            // Etiket pozisyonu - sol üst köşenin tam üstünde
            textX = canvasLeftTop.x; // Sol üst köşe ile aynı x
            textY = canvasLeftTop.y - 20; // Sol üst köşeden 20px yukarı
        }
        
        // Konuşma balonu çiz
        const textColor = annotation.color || '#007AFF';
        this.drawSpeechBubble(textX, textY, textWidth, fontSize, textColor, 0.95, annotation);
        
        // Eski format kaldırıldı - sadece drawSpeechBubble kullanılıyor
        
        this.ctx.restore();
    }

    drawDebugOverlay() {
        if (!this.labelingTool.debugMode) return;

        this.ctx.save();
        
        // Debug bilgileri için stil
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(10, 10, 450, 400);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px monospace';
        
        // Koordinat bilgileri
        const info = [
            `Zoom: ${this.labelingTool.zoom.toFixed(3)}`,
            `Pan: (${this.labelingTool.panX.toFixed(1)}, ${this.labelingTool.panY.toFixed(1)})`,
            `Canvas: ${this.canvas.width}x${this.canvas.height}`,
            `Image: ${this.labelingTool.image ? this.labelingTool.image.width + 'x' + this.labelingTool.image.height : 'N/A'}`,
            `Annotations: ${this.labelingTool.annotations.length}`,
            `Selected: ${this.labelingTool.selectedAnnotation ? 'Yes' : 'No'}`,
            `Mouse: ${this.labelingTool.currentMousePos ? `(${this.labelingTool.currentMousePos.x.toFixed(1)}, ${this.labelingTool.currentMousePos.y.toFixed(1)})` : 'N/A'}`
        ];
        
        info.forEach((line, index) => {
            this.ctx.fillText(line, 20, 30 + index * 20);
        });
        
        this.ctx.restore();
    }

    drawTemporaryPolygon() {
        if (!this.labelingTool.isPolygonMode) return;

        // Mouse pozisyonunu al (tıklama değil, konum)
        const mousePos = this.labelingTool.currentMousePos;
        let mouseCanvasPos = null;
        if (mousePos) {
            mouseCanvasPos = this.labelingTool.imageToCanvas(mousePos.x, mousePos.y);
        }

        this.ctx.save();

        // Eğer hiç nokta yoksa, mouse pozisyonuna göre ön görü alanı göster
        if (this.labelingTool.polygonPoints.length === 0) {
            if (mouseCanvasPos) {
                // Mouse pozisyonunda küçük bir alan göster (ROI ön görüsü)
                this.ctx.fillStyle = 'rgba(255, 106, 0, 0.1)'; // Çok düşük opacity
                this.ctx.strokeStyle = this.labelingTool.currentFrameColor;
                this.ctx.lineWidth = 1; // Sabit çizgi kalınlığı (zoom'dan etkilenmez)
                
                // Küçük bir kare alan göster
                const previewSize = 20 / this.labelingTool.zoom;
                this.ctx.fillRect(
                    mouseCanvasPos.x - previewSize/2, 
                    mouseCanvasPos.y - previewSize/2, 
                    previewSize, 
                    previewSize
                );
                this.ctx.strokeRect(
                    mouseCanvasPos.x - previewSize/2, 
                    mouseCanvasPos.y - previewSize/2, 
                    previewSize, 
                    previewSize
                );
            }
            this.ctx.restore();
            return;
        }

        // Canvas koordinatlarına dönüştür
        const canvasPoints = this.labelingTool.polygonPoints.map(point => 
            this.labelingTool.imageToCanvas(point.x, point.y)
        );

        // Çizgi çiz
        this.ctx.strokeStyle = this.labelingTool.currentFrameColor;
        this.ctx.lineWidth = 2; // Sabit çizgi kalınlığı (zoom'dan etkilenmez)
        
        this.ctx.beginPath();
        this.ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
        
        for (let i = 1; i < canvasPoints.length; i++) {
            this.ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
        }
        
        // Mouse pozisyonuna çizgi çek
        if (mouseCanvasPos) {
            this.ctx.lineTo(mouseCanvasPos.x, mouseCanvasPos.y);
        }
        
        // 4. noktada otomatik kapat (ROI gibi)
        if (this.labelingTool.polygonPoints.length >= 4) {
            this.ctx.closePath();
        }
        
        // Mouse pozisyonunu da dahil ederek taralı alan göster
        if (this.labelingTool.polygonPoints.length >= 2 && mouseCanvasPos) {
            // Geçici polygon oluştur (mevcut noktalar + mouse pozisyonu)
            const tempPoints = [...canvasPoints, mouseCanvasPos];
            
            // Geçici polygon çiz
            this.ctx.beginPath();
            this.ctx.moveTo(tempPoints[0].x, tempPoints[0].y);
            for (let i = 1; i < tempPoints.length; i++) {
                this.ctx.lineTo(tempPoints[i].x, tempPoints[i].y);
            }
            this.ctx.closePath();
            
            // Taralı alan göster (mouse pozisyonu dahil)
            if (this.labelingTool.polygonPoints.length >= 3) {
                this.ctx.fillStyle = 'rgba(255, 165, 0, 0.4)'; // %40 opacity - daha belirgin
            } else {
                this.ctx.fillStyle = 'rgba(255, 165, 0, 0.2)'; // %20 opacity - hafif ön görü
            }
            this.ctx.fill();
        }
        
        // 4. noktada tam ROI alanı göster (mouse pozisyonu olmadan)
        if (this.labelingTool.polygonPoints.length >= 4) {
            this.ctx.beginPath();
            this.ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
            for (let i = 1; i < canvasPoints.length; i++) {
                this.ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
            }
            this.ctx.closePath();
            this.ctx.fillStyle = 'rgba(255, 165, 0, 0.5)'; // %50 opacity - tam alan
            this.ctx.fill();
        }
        
        this.ctx.stroke();

        // Noktaları işaretle
        canvasPoints.forEach((point, index) => {
            this.ctx.fillStyle = index === 0 ? '#e74c3c' : this.labelingTool.currentFrameColor; // İlk nokta kırmızı
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 1;
            
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();
            
            // İlk noktayı özel işaretle (kapatma için)
            if (index === 0 && this.labelingTool.polygonPoints.length >= 3) {
                this.ctx.fillStyle = '#ffffff';
                this.ctx.beginPath();
                this.ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
                this.ctx.fill();
            }
        });

        // Mouse pozisyonunu işaretle (ön görü noktası)
        if (mouseCanvasPos) {
            this.ctx.fillStyle = this.labelingTool.currentFrameColor;
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 1;
            
            this.ctx.beginPath();
            this.ctx.arc(mouseCanvasPos.x, mouseCanvasPos.y, 4, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    // Hex rengi RGB'ye çevir
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? 
            `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
            '46, 204, 113'; // Default green
    }

    redraw() {
        this.clearCanvas();
        this.drawImage();
        
        // Weather filter uygula (sadece filtre değiştiğinde veya cache yoksa)
        if (this.labelingTool.currentWeatherFilter && this.labelingTool.currentWeatherFilter !== 'none') {
            this.applyWeatherFilterIfNeeded();
        }
        
        this.drawAnnotations();
        
        // Geçici annotation çiz
        if (this.labelingTool.currentAnnotation) {
            this.drawAnnotation(this.labelingTool.currentAnnotation, false);
        }
        
        // Polygon çizimi (geçici)
        if (this.labelingTool.isPolygonMode && this.labelingTool.polygonPoints.length > 0) {
            this.drawTemporaryPolygon();
        }
        
        this.drawDebugOverlay();
    }
    
    // Weather filter uygula (sadece gerektiğinde)
    applyWeatherFilterIfNeeded() {
        if (!this.labelingTool.currentWeatherFilter || this.labelingTool.currentWeatherFilter === 'none') {
            this.filteredImageData = null;
            this.lastFilterType = null;
            return;
        }
        
        const imageRect = this.labelingTool.getImageRect();
        if (imageRect.width === 0 || imageRect.height === 0) {
            return;
        }
        
        // Cache kontrolü - filtre veya resim boyutu değişmiş mi?
        const currentFilterType = this.labelingTool.currentWeatherFilter;
        const imageRectChanged = !this.lastImageRect || 
            this.lastImageRect.width !== imageRect.width || 
            this.lastImageRect.height !== imageRect.height ||
            this.lastImageRect.x !== imageRect.x ||
            this.lastImageRect.y !== imageRect.y;
        
        if (this.filteredImageData && this.lastFilterType === currentFilterType && !imageRectChanged) {
            // Cache'den kullan
            this.ctx.putImageData(this.filteredImageData, imageRect.x, imageRect.y);
            return;
        }
        
        // Yeni filtre uygula
        console.log('🎨 Yeni weather filter uygulanıyor:', currentFilterType);
        
        // Resim alanından ImageData al
        const imageData = this.ctx.getImageData(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
        
        // Filtre uygula
        this.labelingTool.applyWeatherFilter(imageData, currentFilterType);
        
        // Cache'e kaydet
        this.filteredImageData = new ImageData(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
        );
        this.lastFilterType = currentFilterType;
        this.lastImageRect = { ...imageRect };
        
        // Filtrelenmiş veriyi geri çiz
        this.ctx.putImageData(imageData, imageRect.x, imageRect.y);
    }

    // Weather filter uygula (eski fonksiyon - geriye uyumluluk için)
    applyWeatherFilter() {
        this.applyWeatherFilterIfNeeded();
    }

    // Konuşma balonu şeklinde label çizim fonksiyonu
    drawSpeechBubble(textX, textY, textWidth, textHeight, bgColor, bgAlpha, annotation) {
        const padding = 8; // Konuşma balonu için daha fazla padding
        const borderRadius = 12; // Daha yuvarlak köşeler
        const tailSize = 8; // Kuyruk boyutu

        // Label text - emoji ile
        const fullText = `${annotation.label}`;

        // Font ayarı
        this.ctx.font = `bold ${textHeight}px 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        const fullTextWidth = this.ctx.measureText(fullText).width;

        // Konuşma balonu boyutları
        const bubbleWidth = fullTextWidth + (padding * 2);
        const bubbleHeight = textHeight + (padding * 2);

        // Konuşma balonu pozisyonu (handle'ın üstünde, ortalanmış)
        const bubbleX = textX - (bubbleWidth / 2); // Label'ı handle ile ortalayalım
        const bubbleY = textY - bubbleHeight - tailSize; // Balon kuyruk boyutu kadar yukarıda

        this.ctx.save();

        // Konuşma balonu rengi
        this.ctx.fillStyle = `rgba(${this.hexToRgb(bgColor)}, 0.95)`;
        this.ctx.strokeStyle = `rgba(${this.hexToRgb(bgColor)}, 1.0)`;
        this.ctx.lineWidth = 2;

        // Konuşma balonu şekli çiz (tek path olarak)
        this.ctx.beginPath();
        
        // Ana yuvarlak köşeli kutu
        this.ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, borderRadius);
        
        // Aşağı doğru üçgen kuyruk (handle'ın tam üstünde)
        const tailCenterX = textX; // Kuyruk handle'ın x koordinatında (tam ortada)
        const tailTopY = bubbleY + bubbleHeight; // Balonun alt kenarı
        const tailBottomY = textY; // Kuyruğun alt ucu handle'ın y koordinatının tam üstüne
        
        // Kuyruğu aynı path'e ekle
        this.ctx.moveTo(tailCenterX - tailSize/2, tailTopY); // Sol üst köşe
        this.ctx.lineTo(tailCenterX + tailSize/2, tailTopY); // Sağ üst köşe
        this.ctx.lineTo(tailCenterX, tailBottomY); // Alt uç (handle'a işaret eden)
        this.ctx.closePath();
        
        // Doldur ve çerçevele
        this.ctx.fill();
        this.ctx.stroke();

        // Metin - beyaz renk (ortalanmış)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold ${textHeight}px 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        this.ctx.textAlign = 'center'; // Metni ortalayalım
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(fullText, textX, bubbleY + padding);

        this.ctx.restore();
    }
}

// Export for use in main script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasManager;
} else {
    window.CanvasManager = CanvasManager;
}
