// Clear All Data - Tüm cache ve annotation verilerini temizle
(function() {
    console.log('🧹 Cache ve annotation temizliği başlatılıyor...');
    
    // Simple Labeling System cache'ini temizle
    if (window.simpleLabelingSystem) {
        window.simpleLabelingSystem.clearAnnotations();
        console.log('✅ Simple System temizlendi');
    }
    
    // Image Manager cache'ini temizle
    if (window.imageManager) {
        if (window.imageManager.clearCache) {
            window.imageManager.clearCache();
        }
        // Annotation cache'ini manuel temizle
        if (window.imageManager.annotationCache) {
            window.imageManager.annotationCache.clear();
        }
        console.log('✅ Image Manager cache temizlendi');
    }
    
    // Performance Manager cache'ini temizle
    if (window.performanceManager && window.performanceManager.performGarbageCollection) {
        window.performanceManager.performGarbageCollection();
        console.log('✅ Performance Manager temizlendi');
    }
    
    // Eski sistem cache'ini temizle (eğer varsa)
    if (window.labelingTool) {
        window.labelingTool.annotations = [];
        if (window.labelingTool.clearAnnotations) {
            window.labelingTool.clearAnnotations();
        }
        console.log('✅ Legacy system temizlendi');
    }
    
    // Browser localStorage temizle (eğer kullanılıyorsa)
    try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.includes('annotation') || key.includes('label') || key.includes('image')) {
                localStorage.removeItem(key);
            }
        });
        console.log('✅ LocalStorage temizlendi');
    } catch (e) {
        console.log('ℹ️ LocalStorage temizleme atlandı');
    }
    
    // SessionStorage temizle
    try {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.includes('annotation') || key.includes('label') || key.includes('image')) {
                sessionStorage.removeItem(key);
            }
        });
        console.log('✅ SessionStorage temizlendi');
    } catch (e) {
        console.log('ℹ️ SessionStorage temizleme atlandı');
    }
    
    // Global değişkenleri temizle
    if (window.currentAnnotations) {
        window.currentAnnotations = [];
    }
    
    if (window.annotationHistory) {
        window.annotationHistory = [];
    }
    
    console.log('🎯 Tüm cache ve veriler temizlendi! Artık sıfırdan etiketleme yapabilirsiniz.');
    
    // Sayfa yenileme öneri mesajı
    if (confirm('Cache tamamen temizlendi! Sayfayı yenilemek ister misiniz?')) {
        window.location.reload();
    }
})();