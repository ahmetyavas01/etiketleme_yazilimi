// Real-time senkronizasyon modülü
class RealtimeSync {
    constructor(labelingTool) {
        this.labelingTool = labelingTool;
        this.socket = null;
        this.isConnected = false;
        this.currentProject = null;
        this.lastUpdateTime = 0;
        this.syncDebounceTimer = null;
        
        // Bağlantı durumu göstergeleri
        this.statusIndicator = this.createStatusIndicator();
        this.userCounter = this.createUserCounter();
        
        console.log('🔌 RealtimeSync initialized');
        this.connect();
    }
    
    // Server URL'i dinamik olarak belirle
    getServerURL() {
        // 🆕 Önce URL parametresinden kontrol et (dashboard'dan geliyorsa)
        const urlParams = new URLSearchParams(window.location.search);
        const serverParam = urlParams.get('server');
        if (serverParam) {
            console.log('🔗 Realtime: URL parametresinden IP alındı:', serverParam);
            // URL'den gelen IP'yi localStorage'a kaydet
            localStorage.setItem('serverIP', serverParam);
            localStorage.setItem('isRemoteServer', 'true');
            return `http://${serverParam}:3000/api`;
        }
        
        // Sonra localStorage'dan kontrol et
        const savedIP = localStorage.getItem('serverIP');
        if (savedIP && savedIP !== '192.168.1.100') {
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
    
    connect() {
        try {
            // Socket.IO bağlantısı - timeout ile
            this.socket = io(this.getServerURL().replace('/api', ''), {
                timeout: 3000, // 3 saniye timeout
                forceNew: true,
                transports: ['websocket', 'polling']
            });
            
            // Bağlantı timeout kontrolü
            const connectionTimeout = setTimeout(() => {
                if (this.socket && !this.socket.connected) {
                    console.log('⏰ Labeling app WebSocket bağlantı timeout');
                    this.socket.disconnect();
                    this.updateStatusIndicator('error');
                    this.showNotification('Bağlantı zaman aşımına uğradı', 'error');
                }
            }, 5000); // 5 saniye sonra timeout
            
            // Bağlantı olayları
            this.socket.on('connect', () => {
                clearTimeout(connectionTimeout);
                console.log('🔌 WebSocket bağlantısı kuruldu');
                this.isConnected = true;
                this.updateStatusIndicator('connected');
                
                // JWT token ile authentication
                const token = localStorage.getItem('token');
                if (token) {
                    this.socket.emit('authenticate', token);
                }
            });
            
            this.socket.on('disconnect', () => {
                console.log('🔌 WebSocket bağlantısı koptu');
                this.isConnected = false;
                this.updateStatusIndicator('disconnected');
            });
            
            // Authentication olayları
            this.socket.on('authenticated', (data) => {
                console.log('✅ WebSocket authentication başarılı:', data.username);
                this.updateStatusIndicator('authenticated');
            });
            
            this.socket.on('authError', (error) => {
                console.error('❌ WebSocket authentication hatası:', error);
                this.updateStatusIndicator('error');
            });

            // 🆕 Bağlantı hatalarını yakala
            this.socket.on('connect_error', (error) => {
                console.error('❌ Labeling app WebSocket bağlantı hatası:', error);
                this.updateStatusIndicator('error');
                this.showNotification('Bağlantı hatası oluştu', 'error');
            });
            
            // Proje güncelleme olayları
            this.socket.on('projectUpdated', (update) => {
                this.handleProjectUpdate(update);
            });
            
            // 🆕 Etiket güncelleme olayları
            this.socket.on('labelAdded', (data) => {
                console.log('📡 Labeling app: Etiket eklendi bildirimi:', data);
                
                // 🆕 Etiket isimlerini göster
                let notificationMessage = `Yeni etiket eklendi: ${data.savedCount} adet`;
                if (data.labelNames && data.labelNames.length > 0) {
                    const uniqueLabels = data.labelNames.join(', ');
                    notificationMessage += `\nEtiketler: ${uniqueLabels}`;
                }
                
                this.showNotification(notificationMessage, 'success');
                this.handleProjectUpdate(data);
            });
            
            this.socket.on('labelDeleted', (data) => {
                console.log('📡 Labeling app: Etiket silindi bildirimi:', data);
                
                // 🆕 Silinen etiket ismini göster
                let notificationMessage = `Etiket silindi: ${data.deletedCount} adet`;
                if (data.deletedLabelName) {
                    notificationMessage += `\nSilinen etiket: ${data.deletedLabelName}`;
                }
                
                this.showNotification(notificationMessage, 'info');
                this.handleProjectUpdate(data);
            });
            
            this.socket.on('labelUpdated', (data) => {
                console.log('📡 Labeling app: Etiket güncellendi bildirimi:', data);
                this.showNotification(`Etiket güncellendi: ${data.labelName || 'Bilinmeyen'}`, 'info');
                this.handleProjectUpdate(data);
            });
            
            // 🆕 Hava durumu filtreleri güncelleme
            this.socket.on('weatherFiltersUpdated', (data) => {
                console.log('📡 Labeling app: Hava durumu filtreleri güncellendi:', data);
                this.showNotification('Hava durumu filtreleri güncellendi', 'info');
                this.handleWeatherFiltersUpdate(data);
            });
            
            // Kullanıcı olayları
            this.socket.on('userJoined', (data) => {
                this.showNotification(`${data.username} projeye katıldı`, 'info');
            });
            
            this.socket.on('userLeft', (data) => {
                this.showNotification(`${data.username} projeden ayrıldı`, 'info');
            });
            
            this.socket.on('roomStats', (stats) => {
                this.updateUserCounter(stats.userCount);
            });
            
        } catch (error) {
            console.error('❌ WebSocket bağlantı hatası:', error);
            this.updateStatusIndicator('error');
        }
    }
    
    joinProject(projectId) {
        if (this.isConnected && projectId) {
            this.currentProject = projectId;
            this.socket.emit('joinProject', projectId);
            console.log('👥 Projeye katılıldı:', projectId);
        }
    }
    
    leaveProject(projectId) {
        if (this.isConnected && projectId) {
            this.socket.emit('leaveProject', projectId);
            this.currentProject = null;
            console.log('👋 Projeden ayrıldı:', projectId);
        }
    }
    
    handleProjectUpdate(update) {
        // Kendi güncellemelerini görmezden gel
        if (update.updatedBy === window.labelingAuth.getUsername()) {
            return;
        }
        
        // Throttling: Çok hızlı güncellemeleri engelle
        const now = Date.now();
        if (now - this.lastUpdateTime < 500) {
            return;
        }
        this.lastUpdateTime = now;
        
        console.log('📥 Real-time güncelleme alındı:', {
            projectId: update.projectId,
            updatedBy: update.updatedBy,
            annotations: update.data.annotations ? update.data.annotations.length : 0
        });
        
        // Verileri güncelle
        if (update.data.annotations) {
            this.labelingTool.annotations = update.data.annotations;
        }
        
        if (update.data.settings) {
            const settings = update.data.settings;
            if (settings.availableLabels) this.labelingTool.availableLabels = settings.availableLabels;
            if (settings.favoriteLabels) this.labelingTool.favoriteLabels = settings.favoriteLabels;
            if (settings.activeLabel) this.labelingTool.activeLabel = settings.activeLabel;
            if (settings.selectedColor) this.labelingTool.selectedColor = settings.selectedColor;
        }
        
        // UI'yi güncelle
        this.labelingTool.updateAnnotationList();
        this.labelingTool.updateLabelList();
        this.labelingTool.updateAvailableLabels();
        this.labelingTool.redraw();
        
        // Bildirim göster
        this.showNotification(`${update.updatedBy} tarafından güncellendi`, 'success');
    }

    // 🆕 Hava durumu filtreleri güncelleme işleyicisi
    handleWeatherFiltersUpdate(data) {
        console.log('🌤️ Hava durumu filtreleri güncelleniyor:', data);
        
        // Kendi güncellemelerini görmezden gel
        if (data.updatedBy === window.labelingAuth.getUsername()) {
            return;
        }
        
        // Throttling: Çok hızlı güncellemeleri engelle
        const now = Date.now();
        if (now - this.lastUpdateTime < 300) {
            return;
        }
        this.lastUpdateTime = now;
        
        // Hava durumu filtrelerini güncelle
        if (data.weatherFilters) {
            // Eğer labeling tool'da hava durumu filtreleri varsa güncelle
            if (this.labelingTool.weatherFilters) {
                this.labelingTool.weatherFilters = data.weatherFilters;
            }
            
            // Eğer UI'de hava durumu filtreleri gösteriliyorsa güncelle
            if (this.labelingTool.updateWeatherFiltersUI) {
                this.labelingTool.updateWeatherFiltersUI(data.weatherFilters);
            }
            
            // Etiket listesini yenile (hava durumu filtrelerine göre)
            if (this.labelingTool.updateLabelList) {
                this.labelingTool.updateLabelList();
            }
            
            // Mevcut görüntüyü yeniden çiz
            if (this.labelingTool.redraw) {
                this.labelingTool.redraw();
            }
            
            console.log('✅ Hava durumu filtreleri güncellendi');
        }
    }
    
    createStatusIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'realtime-status';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 6px;
            color: white;
            font-size: 12px;
            font-weight: 500;
        `;
        
        indicator.innerHTML = `
            <div id="status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444;"></div>
            <span id="status-text">Bağlantı kuruluyor...</span>
        `;
        
        document.body.appendChild(indicator);
        return indicator;
    }
    
    createUserCounter() {
        const counter = document.createElement('div');
        counter.id = 'user-counter';
        counter.style.cssText = `
            position: fixed;
            top: 50px;
            right: 10px;
            z-index: 10000;
            padding: 6px 10px;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 6px;
            color: white;
            font-size: 11px;
            display: none;
        `;
        
        counter.innerHTML = `
            <i class="fas fa-users" style="margin-right: 4px;"></i>
            <span id="user-count">0</span> aktif kullanıcı
        `;
        
        document.body.appendChild(counter);
        return counter;
    }
    
    updateStatusIndicator(status) {
        const dot = document.getElementById('status-dot');
        const text = document.getElementById('status-text');
        
        if (!dot || !text) return;
        
        switch (status) {
            case 'connected':
                dot.style.background = '#f59e0b';
                text.textContent = 'Bağlandı';
                break;
            case 'authenticated':
                dot.style.background = '#10b981';
                text.textContent = 'Senkronize';
                break;
            case 'disconnected':
                dot.style.background = '#ef4444';
                text.textContent = 'Bağlantı yok';
                break;
            case 'error':
                dot.style.background = '#ef4444';
                text.textContent = 'Hata';
                break;
        }
    }
    
    updateUserCounter(count) {
        const userCount = document.getElementById('user-count');
        const userCounter = document.getElementById('user-counter');
        
        if (userCount && userCounter) {
            userCount.textContent = count;
            userCounter.style.display = count > 1 ? 'block' : 'none';
        }
    }
    
    showNotification(message, type = 'info') {
        // Mevcut notification sistemini kullan
        if (this.labelingTool.showSuccess && type === 'success') {
            this.labelingTool.showSuccess(message);
        } else if (this.labelingTool.showError && type === 'error') {
            this.labelingTool.showError(message);
        } else if (this.labelingTool.showWarning && type === 'warning') {
            this.labelingTool.showWarning(message);
        } else {
            // Basit notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 90px;
                right: 10px;
                z-index: 10000;
                padding: 10px 15px;
                background: rgba(0, 0, 0, 0.9);
                border-radius: 6px;
                color: white;
                font-size: 13px;
                max-width: 300px;
                animation: slideIn 0.3s ease-out;
                white-space: pre-line;
                line-height: 1.4;
            `;
            
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// CSS animation
const style = document.createElement('style');
style.textContent = `
@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}
`;
document.head.appendChild(style);

// Global olarak erişilebilir yap
window.RealtimeSync = RealtimeSync;