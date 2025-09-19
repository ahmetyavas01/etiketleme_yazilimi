// Auth Manager
class AuthManager {
    constructor() {
        this.token = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        this.baseURL = 'http://' + window.location.hostname + ':3000/api';
    }

    // Giriş yap
    async login(username) {
        try {
            const response = await fetch(`${this.baseURL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username })
            });

            const data = await response.json();

            if (data.success) {
                this.token = data.token;
                this.user = data.user;
                
                // Local storage'a kaydet
                localStorage.setItem('authToken', this.token);
                localStorage.setItem('user', JSON.stringify(this.user));
                
                return { success: true, user: this.user };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return { success: false, error: 'Sunucu bağlantı hatası' };
        }
    }

    // Çıkış yap
    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
    }

    // Token ile istek gönder
    async authenticatedRequest(url, options = {}) {
        if (!this.token) {
            throw new Error('Token bulunamadı');
        }

        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        const response = await fetch(url, mergedOptions);
        
        if (response.status === 401) {
            console.log('🔐 401 Unauthorized - Token geçersiz');
            this.logout();
            // Auto refresh'i engelle - sadece console'a log yaz
            console.log('🔄 Sayfa yenileme iptal edildi - manuel giriş gerekli');
            throw new Error('Oturum süresi doldu');
        }

        return response;
    }

    // Kullanıcı bilgilerini al
    getUser() {
        return this.user;
    }

    // Admin kontrolü
    isAdmin() {
        return this.user && this.user.role === 'admin';
    }

    // Giriş yapılmış mı kontrol et
    isLoggedIn() {
        return !!this.token && !!this.user;
    }
}

// Global auth manager
const auth = new AuthManager();
