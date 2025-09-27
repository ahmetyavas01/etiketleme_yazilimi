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
        // 🆕 Önce URL parametresinden kontrol et (dashboard'dan geliyorsa)
        const urlParams = new URLSearchParams(window.location.search);
        const serverParam = urlParams.get('server');
        if (serverParam) {
            console.log(`🔧 Auth: URL parametresinden IP alındı: ${serverParam}`);
            // URL'den gelen IP'yi localStorage'a kaydet
            localStorage.setItem('serverIP', serverParam);
            localStorage.setItem('isRemoteServer', 'true');
            return `http://${serverParam}:3000/api`;
        }
        
        // Sonra localStorage'dan kontrol et
        const savedIP = localStorage.getItem('serverIP');
        if (savedIP && savedIP !== '192.168.1.100') {
            console.log(`🔧 Auth: Kaydedilmiş IP kullanılıyor: ${savedIP}`);
            return `http://${savedIP}:3000/api`;
        }
        
        // window.location.hostname kullan
        const hostname = window.location.hostname;
        console.log(`🔧 Auth: Hostname: ${hostname}`);
        
        // Eğer localhost ise, localhost kullan
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
            console.log(`🔧 Auth: Localhost tespit edildi, localhost kullanılıyor`);
            return `http://localhost:3000/api`;
        }
        
        // Diğer durumlarda window.location.hostname kullan
        console.log(`🔧 Auth: Hostname kullanılıyor: ${hostname}`);
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
        
        // 🆕 Server bilgilerini koru - sadece kullanıcı bilgilerini temizle
        console.log('🚪 Kullanıcı çıkış yapıyor, server bilgileri korunuyor...');
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
            console.log('🔐 Auth: getProjects() çağrıldı');
            console.log('🔐 Auth: baseURL:', this.baseURL);
            console.log('🔐 Auth: token:', this.token ? 'Mevcut' : 'Yok');
            
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
                console.log('🔐 Auth: Authorization header eklendi');
            }
            
            const url = `${this.baseURL}/projects`;
            console.log('🔐 Auth: Request URL:', url);
            console.log('🔐 Auth: Request headers:', headers);
            
            const response = await fetch(url, { headers });
            console.log('🔐 Auth: Response status:', response.status);
            console.log('🔐 Auth: Response ok:', response.ok);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('🔐 Auth: Response error text:', errorText);
                throw new Error(`Projeler yüklenemedi: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            console.log('🔐 Auth: Response data:', data);
            return data;
        } catch (error) {
            console.error('🔐 Auth: Projeler yüklenirken hata:', error);
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