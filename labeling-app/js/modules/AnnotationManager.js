/**
 * Annotation Manager Module
 * Handles annotation creation, editing, and management
 */
class AnnotationManager {
    constructor(labelingTool) {
        this.labelingTool = labelingTool;
    }

    createNewAnnotation(data) {
        // Her etiket için otomatik farklı renk ata
        const autoColor = this.labelingTool.getNextAutoColor();
        
        const annotation = {
            ...data,
            color: autoColor,
            id: data.id || Date.now()
        };

        // Açıklama varsa ekle
        if (data.description) {
            annotation.description = data.description;
        }

        return annotation;
    }

    selectAnnotationAt(e) {
        const mousePos = this.labelingTool.getMousePos(e);
        const clickedAnnotation = this.getAnnotationAtPosition(mousePos);
        
        if (clickedAnnotation) {
            this.labelingTool.selectedAnnotation = clickedAnnotation;
        } else {
            this.labelingTool.selectedAnnotation = null;
        }
        
        this.updateAnnotationList();
        this.labelingTool.redraw();
    }

    getAnnotationAtPosition(pos) {
        // Ters sırayla kontrol et (en son çizilen önce)
        for (let i = this.labelingTool.annotations.length - 1; i >= 0; i--) {
            const annotation = this.labelingTool.annotations[i];
            
            if (annotation.type === 'rectangle') {
                const isInside = pos.x >= annotation.x && pos.x <= annotation.x + annotation.width &&
                                pos.y >= annotation.y && pos.y <= annotation.y + annotation.height;
                
                if (isInside) {
                    return annotation;
                }
            } else if (annotation.type === 'polygon') {
                if (this.isPointInPolygon(pos, annotation.points)) {
                    return annotation;
                }
            }
        }
        
        return null;
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

    deleteAnnotation(id) {
        this.labelingTool.annotations = this.labelingTool.annotations.filter(ann => ann.id !== id);
        // Eğer silinen annotation seçiliyse, seçimi kaldır
        if (this.labelingTool.selectedAnnotation && this.labelingTool.selectedAnnotation.id === id) {
            this.labelingTool.selectedAnnotation = null;
        }
        this.updateAnnotationList();
        this.labelingTool.redraw();
    }

    deleteAnnotationByObject(annotation) {
        // Annotation'ı listeden kaldır
        this.labelingTool.annotations = this.labelingTool.annotations.filter(ann => ann.id !== annotation.id);
        
        // Eğer silinen annotation seçiliyse, seçimi kaldır
        if (this.labelingTool.selectedAnnotation && this.labelingTool.selectedAnnotation.id === annotation.id) {
            this.labelingTool.selectedAnnotation = null;
        }
        
        this.updateAnnotationList();
        this.labelingTool.redraw();
        
        this.labelingTool.showSuccess(`"${annotation.label}" silindi.`);
    }

    selectAnnotationById(id) {
        const annotation = this.labelingTool.annotations.find(ann => ann.id === id);
        if (annotation) {
            this.labelingTool.selectedAnnotation = annotation;
            // Seçilen annotation'ın rengini aktif renk yap
            this.labelingTool.currentFrameColor = annotation.color || '#2ecc71';
            document.getElementById('currentColorSwatch').style.backgroundColor = this.labelingTool.currentFrameColor;
            this.labelingTool.updateActiveColorOption();
            this.updateAnnotationList();
            this.labelingTool.redraw();
        }
    }

    updateAnnotationList() {
        // Annotation listesi artık sidebar'da yok, sadece seçim işlemi yap
        // Bu fonksiyon artık sadece seçim durumunu günceller
        if (this.labelingTool.selectedAnnotation) {
            // Seçili annotation'ı güncelle
            this.labelingTool.redraw();
        }
    }

    // Kilit durumunu değiştir
    toggleAnnotationLock(id) {
        const annotation = this.labelingTool.annotations.find(ann => ann.id === id);
        if (annotation) {
            annotation.locked = !annotation.locked;
            this.labelingTool.redraw();
            
            const message = annotation.locked ? `"${annotation.label}" kilitlendi` : `"${annotation.label}" kilidi açıldı`;
            this.labelingTool.showInfo(message);
        }
    }

    getHandleAt(pos) {
        console.log('🔍 AnnotationManager.getHandleAt çağrıldı:', { pos });
        
        // Hem selectedAnnotation hem de focusedAnnotation kontrol et
        const annotation = this.labelingTool.focusedAnnotation || this.labelingTool.selectedAnnotation;
        console.log('🔍 Annotation bulundu:', annotation?.id, annotation?.type);
        if (!annotation) {
            console.log('❌ Annotation bulunamadı');
            return null;
        }
        
        // Kilit sistemi kaldırıldı

        // Handle boyutu - zoom'dan etkilenmez (sabit ekran pikseli)
        const handleSize = 8;
        const tolerance = handleSize / 2; // Yarı boyut tolerans

        // Points array kontrolü - eğer yoksa oluştur
        if (!Array.isArray(annotation.points) || annotation.points.length < 4) {
            console.log('🔧 Points array eksik, oluşturuluyor:', annotation.label);
            this.convertRectangleToPolygon(annotation);
        }
        
        if (annotation.type === 'rectangle' || annotation.type === 'polygon') {
            // Polygon noktalarını canvas koordinatlarına çevir
            const canvasPoints = annotation.points.map(point => 
                this.labelingTool.imageToCanvas(point.x, point.y)
            );
            console.log('📍 Polygon noktaları:', { 
                imagePoints: annotation.points,
                canvasPoints: canvasPoints
            });

            // 1. Köşe handle'ları kontrol et
            const cornerNames = ['Sol Üst', 'Sağ Üst', 'Sağ Alt', 'Sol Alt'];
            
            for (let i = 0; i < canvasPoints.length; i++) {
                const corner = canvasPoints[i];
                const cornerName = cornerNames[i] || `Köşe ${i}`;
                console.log(`🔍 ${cornerName} kontrol ediliyor:`, { corner, pos, tolerance });
                
                // Bounding box kontrolü - tolerance kullan
                const isInBounds = Math.abs(pos.x - corner.x) <= tolerance && 
                                 Math.abs(pos.y - corner.y) <= tolerance;
                console.log(`🔍 ${cornerName} bounds kontrolü:`, { 
                    isInBounds, 
                    tolerance, 
                    distanceX: Math.abs(pos.x - corner.x), 
                    distanceY: Math.abs(pos.y - corner.y) 
                });
                
                if (isInBounds) {
                    console.log(`✅ ${cornerName} handle bulundu!`);
                    
                    return { 
                        type: 'corner', 
                        index: i, 
                        name: cornerName,
                        x: corner.x, // Canvas koordinatı (görsel)
                        y: corner.y, // Canvas koordinatı (görsel)
                        imageX: annotation.points[i].x, // Image koordinatı (hesaplama)
                        imageY: annotation.points[i].y  // Image koordinatı (hesaplama)
                    };
                }
            }
            
            // 2. Kenar handle'ları kontrol et
            const edgeNames = ['Üst Kenar', 'Sağ Kenar', 'Alt Kenar', 'Sol Kenar'];
            
            for (let i = 0; i < canvasPoints.length; i++) {
                const currentPoint = canvasPoints[i];
                const nextPoint = canvasPoints[(i + 1) % canvasPoints.length];
                const edgeName = edgeNames[i] || `Kenar ${i}`;
                
                // Kenar orta noktasını hesapla
                const midX = (currentPoint.x + nextPoint.x) / 2;
                const midY = (currentPoint.y + nextPoint.y) / 2;
                
                console.log(`🔍 ${edgeName} kontrol ediliyor:`, { 
                    midPoint: { x: midX, y: midY }, 
                    pos, 
                    tolerance 
                });
                
                // Kenar handle kontrolü
                const isInBounds = Math.abs(pos.x - midX) <= tolerance && 
                                 Math.abs(pos.y - midY) <= tolerance;
                console.log(`🔍 ${edgeName} bounds kontrolü:`, { 
                    isInBounds, 
                    tolerance, 
                    distanceX: Math.abs(pos.x - midX), 
                    distanceY: Math.abs(pos.y - midY) 
                });
                
                if (isInBounds) {
                    console.log(`✅ ${edgeName} handle bulundu!`);
                    
                    // Kenar orta noktasının image koordinatlarını hesapla
                    const imageMidX = (annotation.points[i].x + annotation.points[(i + 1) % annotation.points.length].x) / 2;
                    const imageMidY = (annotation.points[i].y + annotation.points[(i + 1) % annotation.points.length].y) / 2;
                    
                    return { 
                        type: 'edge', 
                        index: i, 
                        name: edgeName,
                        x: midX, // Canvas koordinatı (görsel)
                        y: midY, // Canvas koordinatı (görsel)
                        imageX: imageMidX, // Image koordinatı (hesaplama)
                        imageY: imageMidY  // Image koordinatı (hesaplama)
                    };
                }
            }
        }

        console.log('❌ Hiçbir handle bulunamadı');
        return null;
    }

    resizeAnnotation(annotation, handle, mousePos) {
        console.log('🔧 resizeAnnotation çağrıldı:', { 
            annotation: annotation.id, 
            handle, 
            mousePos,
            annotationType: annotation.type 
        });
        
        // Kilit sistemi kaldırıldı
        
        // Mouse pozisyonunu image koordinatlarına çevir
        const imagePos = this.labelingTool.canvasToImage(mousePos.x, mousePos.y);
        console.log('📍 Koordinat dönüşümü:', { mousePos, imagePos });
        
        if (annotation.type === 'rectangle') {
            console.log('📐 Rectangle resize başlatılıyor...');
            this.resizeRectangle(annotation, handle, imagePos);
        } else if (annotation.type === 'polygon') {
            console.log('🔺 Polygon resize başlatılıyor...');
            this.resizePolygon(annotation, handle, imagePos);
        }
    }

    resizeRectangle(annotation, handle, imagePos) {
        console.log('📐 resizeRectangle (Köşe + Kenar) başlatıldı:', { 
            handle: handle.name, 
            handleType: handle.type,
            imagePos, 
            annotation: annotation.id 
        });
        
        // Rectangle'ı polygon'a dönüştür (eğer henüz dönüştürülmemişse)
        this.convertRectangleToPolygon(annotation);
        
        if (handle.type === 'corner') {
            // Köşe handle'ı - polygon noktasını güncelle
            const cornerIndex = handle.index;
            console.log('🔧 Köşe sürükleniyor:', handle.name, 'Index:', cornerIndex);
            
            if (Array.isArray(annotation.points) && cornerIndex < annotation.points.length) {
                console.log('🔧 Polygon nokta güncelleniyor:', cornerIndex, '->', imagePos);
                annotation.points[cornerIndex] = { x: imagePos.x, y: imagePos.y };
                console.log('✅ Güncellenmiş polygon points:', annotation.points);
            } else {
                console.log('❌ Geçersiz polygon points veya index:', cornerIndex, annotation.points);
            }
            
        } else if (handle.type === 'edge') {
            // Kenar handle'ı - kenarı paralel olarak hareket ettir
            const edgeIndex = handle.index;
            console.log('🔧 Kenar sürükleniyor:', handle.name, 'Index:', edgeIndex);
            
            if (Array.isArray(annotation.points) && edgeIndex < annotation.points.length) {
                const currentPoint = annotation.points[edgeIndex];
                const nextPoint = annotation.points[(edgeIndex + 1) % annotation.points.length];
                
                // Kenar yönünü hesapla
                const edgeVector = {
                    x: nextPoint.x - currentPoint.x,
                    y: nextPoint.y - currentPoint.y
                };
                
                // Kenar uzunluğu
                const edgeLength = Math.sqrt(edgeVector.x * edgeVector.x + edgeVector.y * edgeVector.y);
                
                if (edgeLength > 0) {
                    // Kenar yönü birim vektörü
                    const edgeUnit = {
                        x: edgeVector.x / edgeLength,
                        y: edgeVector.y / edgeLength
                    };
                    
                    // Mouse pozisyonundan kenara olan mesafeyi hesapla
                    const toMouse = {
                        x: imagePos.x - currentPoint.x,
                        y: imagePos.y - currentPoint.y
                    };
                    
                    // Kenar üzerindeki projeksiyon
                    const projection = toMouse.x * edgeUnit.x + toMouse.y * edgeUnit.y;
                    
                    // Kenar üzerindeki nokta
                    const edgePoint = {
                        x: currentPoint.x + projection * edgeUnit.x,
                        y: currentPoint.y + projection * edgeUnit.y
                    };
                    
                    // Kenarı paralel olarak hareket ettir
                    const deltaX = imagePos.x - edgePoint.x;
                    const deltaY = imagePos.y - edgePoint.y;
                    
                    // Her iki noktayı da hareket ettir
                    annotation.points[edgeIndex] = {
                        x: currentPoint.x + deltaX,
                        y: currentPoint.y + deltaY
                    };
                    annotation.points[(edgeIndex + 1) % annotation.points.length] = {
                        x: nextPoint.x + deltaX,
                        y: nextPoint.y + deltaY
                    };
                    
                    console.log('✅ Kenar hareket ettirildi:', {
                        deltaX, deltaY,
                        newPoints: annotation.points
                    });
                }
            } else {
                console.log('❌ Geçersiz polygon points veya index:', edgeIndex, annotation.points);
            }
        } else {
            console.log('❌ Geçersiz handle type:', handle.type);
            return;
        }
        
        // Polygon noktalarından rectangle özelliklerini güncelle (bounding box için)
        this.updateBoundingBoxFromPoints(annotation);
        
        console.log('✅ Rectangle özellikleri güncellendi:', {
            x: annotation.x,
            y: annotation.y,
            width: annotation.width,
            height: annotation.height
        });
        
        // Güncel koordinatları database'e kaydet
        if (this.labelingTool && this.labelingTool.saveAllAnnotationsToDatabase) {
            this.labelingTool.saveAllAnnotationsToDatabase();
        }
    }

    // Rectangle'ı polygon'a dönüştür
    convertRectangleToPolygon(annotation) {
        if (Array.isArray(annotation.points) && annotation.points.length >= 4) {
            console.log('✅ Annotation zaten polygon formatında:', annotation.label);
            return; // Zaten dönüştürülmüş
        }
        
        console.log('🔧 Rectangle polygon\'a dönüştürülüyor:', annotation.label);
        
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
        
        // Annotation type'ını polygon'a çevir
        annotation.type = 'polygon';
        
        console.log('✅ Annotation type polygon\'a çevrildi:', annotation.type);
        
        // Database'e kaydet
        if (this.labelingTool && this.labelingTool.saveAllAnnotationsToDatabase) {
            this.labelingTool.saveAllAnnotationsToDatabase();
        }
    }

    // Polygon noktalarından bounding box hesapla (type'ı değiştirme)
    updateBoundingBoxFromPoints(annotation) {
        if (!annotation.points || annotation.points.length < 3) return;
        
        // En küçük ve en büyük x, y değerlerini bul
        const xs = annotation.points.map(p => p.x);
        const ys = annotation.points.map(p => p.y);
        
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        // Sadece bounding box özelliklerini güncelle, type'ı polygon olarak bırak
        annotation.x = minX;
        annotation.y = minY;
        annotation.width = maxX - minX;
        annotation.height = maxY - minY;
    }

    // Polygon noktalarından rectangle özelliklerini güncelle
    updateRectangleFromPoints(annotation) {
        if (!annotation.points || annotation.points.length !== 4) return;
        
        // En küçük ve en büyük x, y değerlerini bul
        const xs = annotation.points.map(p => p.x);
        const ys = annotation.points.map(p => p.y);
        
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        // Rectangle özelliklerini güncelle
        annotation.x = minX;
        annotation.y = minY;
        annotation.width = maxX - minX;
        annotation.height = maxY - minY;
    }

    // Polygon noktası sürükleme (handle ile)
    resizePolygon(annotation, handle, imagePos) {
        if (handle.type === 'polygon-point') {
            // Nokta indexini güvenli al, yanlış index gelirse işlem yapma
            if (
                Array.isArray(annotation.points) &&
                handle.index >= 0 &&
                handle.index < annotation.points.length
            ) {
                annotation.points[handle.index] = { x: imagePos.x, y: imagePos.y };
                
                // Bounding box'ı güncelle
                this.updateBoundingBoxFromPoints(annotation);
                
                // Güncel koordinatları database'e kaydet
                if (this.labelingTool && this.labelingTool.saveAllAnnotationsToDatabase) {
                    this.labelingTool.saveAllAnnotationsToDatabase();
                }
            }
        }
    }

    // Polygon tamamla: Kullanıcının tıkladığı noktaları sırasıyla polygon olarak ekler
    completePolygon() {
        // Kullanıcının tıkladığı noktaları sırayla al
        const points = this.labelingTool.polygonPoints.map(p => ({ x: p.x, y: p.y }));

        // En az 3 nokta olmalı (dörtten fazlası da desteklenir)
        if (points.length >= 3) {
            // Annotation oluştur - henüz listeye ekleme
            this.labelingTool.currentAnnotation = {
                type: 'polygon',
                points: points,
                label: '',
                color: this.labelingTool.selectedColor || this.labelingTool.getNextAutoColor(),
                id: Date.now()
            };

            // Polygon noktalarını temizle
            this.labelingTool.polygonPoints = [];
            this.labelingTool.clearPolygonPoints();
            this.labelingTool.polygonComplete = true;
            this.labelingTool.updatePolygonStatus();
            this.labelingTool.redraw();

            // Etiket modalını aç
            this.labelingTool.showNewLabelModal();

            // Tool'u otomatik olarak seçim moduna geçir
            this.labelingTool.currentTool = 'select';
            this.labelingTool.showInfo('Polygon oluşturuldu! Tool otomatik olarak seçim moduna geçti.');
        } else {
            this.labelingTool.showInfo('Polygon için en az 3 nokta seçmelisiniz.');
        }
    }
}

// Export for use in main script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnnotationManager;
} else {
    window.AnnotationManager = AnnotationManager;
}
