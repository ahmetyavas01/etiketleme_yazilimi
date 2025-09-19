// API Manager - Tüm API işlemlerini yöneten optimized sistem
class APIManager {
    constructor() {
        this.baseURL = this.getServerURL();
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
        
        // Loading state management
        this.activeRequests = new Map();
        this.loadingIndicators = new Map();
        
        this.init();
    }
    
    // Server URL'i dinamik olarak belirle
    getServerURL() {
        // Önce localStorage'dan kontrol et
        const savedIP = localStorage.getItem('serverIP');
        if (savedIP) {
            return `http://${savedIP}:3000/api`;
        }
        
        // window.location.hostname kullan
        const hostname = window.location.hostname;
        
        // Eğer localhost ise, bilinen IP adresini kullan
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // Bilinen IP adresini kullan
            return `http://10.10.1.22:3000/api`;
        }
        
        // Diğer durumlarda window.location.hostname kullan
        return `http://${hostname}:3000/api`;
    }
    
    init() {
        this.setupErrorHandling();
        this.setupLoadingUI();
    }
    
    // Loading UI setup
    setupLoadingUI() {
        // Global loading overlay oluştur
        this.createLoadingOverlay();
        
        // Request counter
        this.requestCounter = 0;
    }
    
    createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'api-loading-overlay';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <div class="loading-text">İşlem yapılıyor...</div>
                <div class="loading-detail"></div>
            </div>
        `;
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(2px);
        `;
        
        // CSS for spinner
        const style = document.createElement('style');
        style.textContent = `
            .loading-content {
                background: white;
                padding: 30px;
                border-radius: 10px;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            }
            .spinner {
                width: 40px;
                height: 40px;
                margin: 0 auto 20px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .loading-text {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 10px;
            }
            .loading-detail {
                font-size: 14px;
                color: #666;
            }
            .error-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #e74c3c;
                color: white;
                padding: 15px 20px;
                border-radius: 5px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 10001;
                animation: slideIn 0.3s ease;
            }
            .success-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #2ecc71;
                color: white;
                padding: 15px 20px;
                border-radius: 5px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 10001;
                animation: slideIn 0.3s ease;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(overlay);
        
        this.loadingOverlay = overlay;
    }
    
    showLoading(message = 'İşlem yapılıyor...', detail = '') {
        this.requestCounter++;
        
        const overlay = this.loadingOverlay;
        const textEl = overlay.querySelector('.loading-text');
        const detailEl = overlay.querySelector('.loading-detail');
        
        if (textEl) textEl.textContent = message;
        if (detailEl) detailEl.textContent = detail;
        
        overlay.style.display = 'flex';
    }
    
    hideLoading() {
        this.requestCounter = Math.max(0, this.requestCounter - 1);
        
        if (this.requestCounter === 0) {
            this.loadingOverlay.style.display = 'none';
        }
    }
    
    showToast(message, type = 'success', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `${type}-toast`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, duration);
    }
    
    // Error handling setup
    setupErrorHandling() {
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleError(event.reason, 'Beklenmeyen bir hata oluştu');
        });
        
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.handleError(event.error, 'Uygulama hatası');
        });
    }
    
    handleError(error, userMessage = 'Bir hata oluştu') {
        console.error('API Error:', error);
        
        this.hideLoading();
        this.showToast(userMessage, 'error');
        
        // Error reporting (if needed)
        if (error.name === 'NetworkError') {
            this.showToast('İnternet bağlantınızı kontrol edin', 'error');
        }
    }
    
    // Request wrapper with error handling
    async makeRequest(url, options = {}, loadingMessage = 'İşlem yapılıyor...') {
        const requestId = Date.now() + Math.random();
        
        try {
            this.showLoading(loadingMessage);
            this.activeRequests.set(requestId, { url, options, startTime: Date.now() });
            
            const response = await this.fetchWithRetry(url, options);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            this.activeRequests.delete(requestId);
            this.hideLoading();
            
            return { success: true, data };
            
        } catch (error) {
            this.activeRequests.delete(requestId);
            this.handleError(error);
            return { success: false, error: error.message };
        }
    }
    
    async fetchWithRetry(url, options, attempt = 1) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            clearTimeout(timeoutId);
            return response;
            
        } catch (error) {
            if (attempt < this.retryAttempts && error.name !== 'AbortError') {
                console.warn(`Request failed, retrying (${attempt}/${this.retryAttempts}):`, error);
                
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
                return this.fetchWithRetry(url, options, attempt + 1);
            }
            throw error;
        }
    }
    
    // API Methods
    async saveAnnotations(imageId, annotations) {
        const result = await this.makeRequest(
            `${this.baseURL}/images/${imageId}/annotations`,
            {
                method: 'POST',
                body: JSON.stringify({ annotations })
            },
            'Etiketler kaydediliyor...'
        );
        
        if (result.success) {
            this.showToast('Etiketler başarıyla kaydedildi ✓', 'success');
        }
        
        return result;
    }
    
    async loadAnnotations(imageId) {
        const result = await this.makeRequest(
            `${this.baseURL}/images/${imageId}/annotations`,
            { method: 'GET' },
            'Etiketler yükleniyor...'
        );
        
        return result;
    }
    
    async loadProjects() {
        const result = await this.makeRequest(
            `${this.baseURL}/projects`,
            { method: 'GET' },
            'Projeler yükleniyor...'
        );
        
        return result;
    }
    
    async loadProjectImages(projectId) {
        const result = await this.makeRequest(
            `${this.baseURL}/projects/${projectId}/images`,
            { method: 'GET' },
            'Resimler yükleniyor...'
        );
        
        return result;
    }
    
    async createProject(projectData) {
        const result = await this.makeRequest(
            `${this.baseURL}/projects`,
            {
                method: 'POST',
                body: JSON.stringify(projectData)
            },
            'Proje oluşturuluyor...'
        );
        
        if (result.success) {
            this.showToast('Proje başarıyla oluşturuldu ✓', 'success');
        }
        
        return result;
    }
    
    async deleteAnnotation(annotationId) {
        const result = await this.makeRequest(
            `${this.baseURL}/annotations/${annotationId}`,
            { method: 'DELETE' },
            'Etiket siliniyor...'
        );
        
        if (result.success) {
            this.showToast('Etiket silindi ✓', 'success');
        }
        
        return result;
    }
    
    // Batch operations
    async batchSaveAnnotations(operations) {
        this.showLoading('Toplu işlem yapılıyor...', `${operations.length} işlem`);
        
        const results = [];
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < operations.length; i++) {
            const operation = operations[i];
            
            try {
                const result = await this.saveAnnotations(operation.imageId, operation.annotations);
                results.push(result);
                
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
                
                // Progress update
                this.updateLoadingProgress(i + 1, operations.length);
                
            } catch (error) {
                errorCount++;
                results.push({ success: false, error: error.message });
            }
        }
        
        this.hideLoading();
        
        if (successCount > 0) {
            this.showToast(`${successCount} işlem başarıyla tamamlandı`, 'success');
        }
        
        if (errorCount > 0) {
            this.showToast(`${errorCount} işlemde hata oluştu`, 'error');
        }
        
        return {
            results,
            summary: { successCount, errorCount, total: operations.length }
        };
    }
    
    updateLoadingProgress(current, total) {
        const overlay = this.loadingOverlay;
        const detailEl = overlay.querySelector('.loading-detail');
        
        if (detailEl) {
            const percent = Math.round((current / total) * 100);
            detailEl.textContent = `${current}/${total} (${percent}%)`;
        }
    }
    
    // Queue system for rate limiting
    addToQueue(request) {
        this.requestQueue.push(request);
        
        if (!this.isProcessingQueue) {
            this.processQueue();
        }
    }
    
    async processQueue() {
        this.isProcessingQueue = true;
        
        while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift();
            
            try {
                await request();
            } catch (error) {
                console.error('Queue request error:', error);
            }
            
            // Rate limiting - 100ms delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.isProcessingQueue = false;
    }
    
    // Health check
    async checkAPIHealth() {
        try {
            const response = await fetch(`${this.baseURL}/health`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }
    
    // Get performance stats
    getPerformanceStats() {
        const activeRequestsCount = this.activeRequests.size;
        const queueLength = this.requestQueue.length;
        
        return {
            activeRequests: activeRequestsCount,
            queueLength,
            isProcessingQueue: this.isProcessingQueue
        };
    }
    
    // Cleanup
    cleanup() {
        this.activeRequests.clear();
        this.requestQueue = [];
        this.isProcessingQueue = false;
        
        if (this.loadingOverlay) {
            this.loadingOverlay.remove();
        }
    }
}