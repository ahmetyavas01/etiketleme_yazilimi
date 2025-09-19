// Optimized Loader - Yeni modülleri yükleyen ve eski sistemi destekleyen loader
(function() {
    'use strict';
    
    console.log('🚀 Optimized Loader başlatılıyor...');
    
    // Performance manager'ı başlat
    window.performanceManager = new PerformanceManager();
    
    // API manager'ı başlat
    window.apiManager = new APIManager();
    
    // Labeling core'u başlat
    window.labelingCore = new LabelingCore();
    
    // Backward compatibility için eski sistemi destekle
    const initBackwardCompatibility = () => {
        // Eski LabelingTool API'sine bridge oluştur
        if (!window.labelingTool && window.labelingCore) {
            window.labelingTool = {
                // Eski API'yi yeni core'a bridge et
                annotations: [],
                
                setAnnotations(annotations) {
                    this.annotations = annotations || [];
                    window.labelingCore.setAnnotations(this.annotations);
                },
                
                async saveAllAnnotationsToDatabase() {
                    if (!window.imageManager?.currentImage) return;
                    
                    const result = await window.apiManager.saveAnnotations(
                        window.imageManager.currentImage.id, 
                        this.annotations
                    );
                    
                    return result.success;
                },
                
                redraw() {
                    if (window.labelingCore) {
                        window.labelingCore.queueRender();
                    }
                },
                
                updateAnnotationList() {
                    // Annotation listesi güncellemesi
                    const event = new CustomEvent('annotationsChanged', {
                        detail: { annotations: this.annotations }
                    });
                    document.dispatchEvent(event);
                },
                
                updateProjectStats() {
                    // Project stats güncellemesi
                    const event = new CustomEvent('statsChanged');
                    document.dispatchEvent(event);
                }
            };
            
            console.log('✅ Backward compatibility bridge oluşturuldu');
        }
    };
    
    // DOM hazır olduğunda başlat
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBackwardCompatibility);
    } else {
        initBackwardCompatibility();
    }
    
    // Global error handling
    window.addEventListener('error', (event) => {
        console.error('🚨 Global error:', event.error);
        if (window.apiManager) {
            window.apiManager.showToast('Bir hata oluştu', 'error');
        }
    });
    
    // Cleanup when page unloads
    window.addEventListener('beforeunload', () => {
        console.log('🧹 Cleanup başlatılıyor...');
        
        if (window.performanceManager) {
            window.performanceManager.cleanup();
        }
        
        if (window.apiManager) {
            window.apiManager.cleanup();
        }
        
        if (window.labelingCore) {
            window.labelingCore.destroy();
        }
        
        if (window.imageManager) {
            window.imageManager.clearCache();
        }
    });
    
    // Debug shortcuts (development only)
    if (window.location.hostname === 'localhost') {
        window.debugOptimized = {
            showPerformanceReport: () => {
                if (window.performanceManager) {
                    window.performanceManager.showPerformanceReport();
                }
            },
            
            showAPIStats: () => {
                if (window.apiManager) {
                    console.table(window.apiManager.getPerformanceStats());
                }
            },
            
            clearAllCaches: () => {
                if (window.performanceManager) {
                    window.performanceManager.performGarbageCollection();
                }
                if (window.imageManager) {
                    window.imageManager.clearCache();
                }
                console.log('🧹 Tüm cache\'ler temizlendi');
            },
            
            getMemoryUsage: () => {
                if (performance.memory) {
                    const used = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                    const total = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
                    const limit = Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024);
                    console.log(`Memory: ${used}MB / ${total}MB (Limit: ${limit}MB)`);
                    return { used, total, limit };
                }
                return 'Memory API not available';
            }
        };
        
        console.log('🔧 Debug tools available: window.debugOptimized');
    }
    
    console.log('✅ Optimized Loader hazır');
})();