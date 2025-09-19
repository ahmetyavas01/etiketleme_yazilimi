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
    
    connect() {
        try {
            // Socket.IO bağlantısı
            this.socket = io(this.getServerURL().replace('/api', ''));
            
            // Bağlantı olayları
            this.socket.on('connect', () => {
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
            
            // Proje güncelleme olayları
            this.socket.on('projectUpdated', (update) => {
                this.handleProjectUpdate(update);
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