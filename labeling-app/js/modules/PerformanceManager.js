// Performance Manager - Bellek ve performans optimizasyonları
class PerformanceManager {
    constructor() {
        this.memoryStats = {
            imageCache: 0,
            annotationCache: 0,
            domCache: 0
        };
        
        this.performanceMetrics = {
            renderTime: [],
            loadTime: [],
            saveTime: []
        };
        
        this.maxCacheSize = 50 * 1024 * 1024; // 50MB max cache
        this.memoryCheckInterval = null;
        
        this.init();
    }
    
    init() {
        this.startMemoryMonitoring();
        this.optimizeEventListeners();
        this.setupCleanupTasks();
    }
    
    // Bellek takibi
    startMemoryMonitoring() {
        this.memoryCheckInterval = setInterval(() => {
            this.checkMemoryUsage();
        }, 30000); // Her 30 saniyede kontrol et
    }
    
    checkMemoryUsage() {
        if (performance.memory) {
            const used = performance.memory.usedJSHeapSize;
            const total = performance.memory.totalJSHeapSize;
            const limit = performance.memory.jsHeapSizeLimit;
            
            // Bellek kullanımı %80'i geçtiyse temizlik yap
            if (used / limit > 0.8) {
                this.performGarbageCollection();
            }
            
            // Console'da memory stats
            console.log(`Memory: ${Math.round(used/1024/1024)}MB / ${Math.round(total/1024/1024)}MB`);
        }
    }
    
    performGarbageCollection() {
        console.log('🧹 Bellek temizliği başlatılıyor...');
        
        // Image cache temizliği
        this.cleanupImageCache();
        
        // DOM cache temizliği
        this.cleanupDOMCache();
        
        // Event listener temizliği
        this.cleanupEventListeners();
        
        console.log('✅ Bellek temizliği tamamlandı');
    }
    
    cleanupImageCache() {
        if (window.labelingCore && window.labelingCore.imageCache) {
            const cache = window.labelingCore.imageCache;
            
            // Cache boyutu limiti aştıysa eski resimleri sil
            if (cache.size > 10) {
                const entries = Array.from(cache.entries());
                const toDelete = entries.slice(0, cache.size - 5); // Son 5'i tut
                
                toDelete.forEach(([key]) => {
                    cache.delete(key);
                });
                
                console.log(`🖼️ ${toDelete.length} resim cache'den temizlendi`);
            }
        }
    }
    
    cleanupDOMCache() {
        if (window.labelingCore && window.labelingCore.domCache) {
            const cache = window.labelingCore.domCache;
            
            // DOM elementlerinin hala var olup olmadığını kontrol et
            const toDelete = [];
            cache.forEach((element, key) => {
                if (!document.contains(element)) {
                    toDelete.push(key);
                }
            });
            
            toDelete.forEach(key => cache.delete(key));
            
            if (toDelete.length > 0) {
                console.log(`🗑️ ${toDelete.length} DOM element cache'den temizlendi`);
            }
        }
    }
    
    cleanupEventListeners() {
        // Passive event listener'lar için temizlik
        const elements = document.querySelectorAll('[data-has-listeners]');
        elements.forEach(element => {
            if (!document.contains(element)) {
                // Element DOM'da yoksa listener'ları temizle
                element.removeAttribute('data-has-listeners');
            }
        });
    }
    
    // Event listener optimizasyonları
    optimizeEventListeners() {
        // Passive event listeners
        const passiveEvents = ['scroll', 'touchstart', 'touchmove', 'wheel'];
        
        passiveEvents.forEach(eventType => {
            document.addEventListener(eventType, this.throttle(() => {
                // Passive event handling
            }, 16), { passive: true });
        });
    }
    
    // Performance ölçümleri
    startTimer(operation) {
        return {
            operation,
            startTime: performance.now()
        };
    }
    
    endTimer(timer) {
        const endTime = performance.now();
        const duration = endTime - timer.startTime;
        
        if (!this.performanceMetrics[timer.operation]) {
            this.performanceMetrics[timer.operation] = [];
        }
        
        this.performanceMetrics[timer.operation].push(duration);
        
        // Son 100 ölçümü tut
        if (this.performanceMetrics[timer.operation].length > 100) {
            this.performanceMetrics[timer.operation].shift();
        }
        
        return duration;
    }
    
    getAverageTime(operation) {
        const times = this.performanceMetrics[operation];
        if (!times || times.length === 0) return 0;
        
        const sum = times.reduce((a, b) => a + b, 0);
        return sum / times.length;
    }
    
    // Render optimizasyonları
    optimizeCanvasRendering(canvas, ctx) {
        // Canvas rendering optimizasyonları
        ctx.imageSmoothingEnabled = false; // Pixel art için
        
        // High DPI support
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        
        ctx.scale(dpr, dpr);
        
        return { width: rect.width, height: rect.height, dpr };
    }
    
    // Throttle ve debounce utilities
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }
    
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    // Image lazy loading
    setupLazyLoading() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                }
            });
        }, {
            rootMargin: '50px'
        });
        
        document.querySelectorAll('img[data-src]').forEach(img => {
            observer.observe(img);
        });
        
        return observer;
    }
    
    // Cleanup tasks
    setupCleanupTasks() {
        // Sayfa kapanırken temizlik
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        // Visibility change'de temizlik
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.performGarbageCollection();
            }
        });
    }
    
    cleanup() {
        clearInterval(this.memoryCheckInterval);
        
        // Cache'leri temizle
        if (window.labelingCore) {
            window.labelingCore.imageCache.clear();
            window.labelingCore.domCache.clear();
        }
        
        // Performance metrics temizle
        this.performanceMetrics = {
            renderTime: [],
            loadTime: [],
            saveTime: []
        };
    }
    
    // Debug info
    getPerformanceReport() {
        return {
            memoryUsage: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB',
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
            } : 'Not available',
            averageTimes: {
                render: this.getAverageTime('renderTime').toFixed(2) + 'ms',
                load: this.getAverageTime('loadTime').toFixed(2) + 'ms',
                save: this.getAverageTime('saveTime').toFixed(2) + 'ms'
            },
            cacheStats: {
                imageCache: window.labelingCore?.imageCache.size || 0,
                domCache: window.labelingCore?.domCache.size || 0
            }
        };
    }
    
    // Console'da performans raporu göster
    showPerformanceReport() {
        const report = this.getPerformanceReport();
        console.table(report);
    }
}