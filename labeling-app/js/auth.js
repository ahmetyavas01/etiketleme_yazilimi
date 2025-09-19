// Basitleştirilmiş Auth Manager - Sadece username ve proje seçimi
class LabelingAuth {
    constructor() {
        console.log('🔧 LabelingAuth constructor başlatılıyor...');
        this.currentUser = null;
        this.currentProject = null;
        this.token = null;
        this.baseURL = this.getServerURL();
        // Try to load from storage on initialization
        this.loadFromStorage();
        console.log('✅ LabelingAuth constructor tamamlandı:', {
            currentUser: this.currentUser,
            currentProject: this.currentProject
        });
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

    // Kullanıcı ve proje bilgilerini ayarla
    setUserAndProject(username, projectId, projectName = null) {
        this.currentUser = { username };
        this.currentProject = { 
            id: projectId,
            name: projectName || 'Bilinmeyen Proje'
        };
        
        // Local storage'a kaydet
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        localStorage.setItem('currentProject', JSON.stringify(this.currentProject));
        
        console.log('👤 Kullanıcı ve proje bilgileri ayarlandı:', {
            username,
            projectId,
            projectName
        });
    }

    // Login fonksiyonu
    async login(username, password) {
        try {
            const response = await fetch(`${this.baseURL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                throw new Error('Login başarısız');
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Login başarısız');
            }

            this.setToken(result.token);
            this.currentUser = result.user;
            return result;
        } catch (error) {
            console.error('Login hatası:', error);
            throw error;
        }
    }

    // Token'ı ayarla
    setToken(token) {
        this.token = token;
        localStorage.setItem('authToken', token);
    }

    // Local storage'dan kullanıcı bilgilerini yükle
    loadFromStorage() {
        const user = localStorage.getItem('currentUser');
        const project = localStorage.getItem('currentProject');
        const token = localStorage.getItem('authToken');
        
        if (user) {
            this.currentUser = JSON.parse(user);
        }
        
        if (project) {
            this.currentProject = JSON.parse(project);
        }

        if (token) {
            this.token = token;
        }
        
        return this.currentUser !== null && this.currentProject !== null;
    }

    // Çıkış yap
    logout() {
        this.currentUser = null;
        this.currentProject = null;
        this.token = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentProject');
        localStorage.removeItem('authToken');
    }

    // Kullanıcı giriş yapmış mı?
    isLoggedIn() {
        return this.currentUser !== null;
    }

    // Mevcut kullanıcı bilgilerini al
    getUser() {
        return this.currentUser;
    }

    // Mevcut proje bilgilerini al
    getProject() {
        return this.currentProject;
    }

    // Mevcut proje ID'sini al
    getCurrentProject() {
        return this.currentProject ? this.currentProject.id : null;
    }

    // Projeleri getir
    async getProjects() {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }
            
            const response = await fetch(`${this.baseURL}/projects`, { headers });
            if (!response.ok) {
                throw new Error('Projeler yüklenemedi');
            }
            return await response.json();
        } catch (error) {
            console.error('Projeler yüklenirken hata:', error);
            return [];
        }
    }

    // Basit HTTP isteği (auth gerektirmeyen)
    async makeRequest(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const response = await fetch(url, { ...defaultOptions, ...options });
        return response;
    }

    // Authenticated request method - token ekleyerek request gönder
    async authenticatedRequest(url, options = {}) {
        // Headers'ı hazırla
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        // Token varsa Authorization header'ına ekle
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const requestOptions = {
            ...options,
            headers
        };

        return this.makeRequest(url, requestOptions);
    }
}

// Global değişken oluştur
console.log('🔧 Auth sistemi global değişken oluşturuluyor...');
window.simpleAuth = new LabelingAuth();
console.log('✅ Auth sistemi global değişken oluşturuldu:', window.simpleAuth);