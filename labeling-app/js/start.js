// Basit Başlangıç Sistemi
class StartManager {
    constructor() {
        console.log('🔧 StartManager constructor başlatılıyor...');
        // LabelingAuth'u initialize et
        if (!window.labelingAuth) {
            window.labelingAuth = new LabelingAuth();
        }
        this.auth = window.labelingAuth;
        this.projects = []; // Projeleri saklamak için
        console.log('🔧 Auth sistemi:', this.auth);
        this.init();
    }

    async init() {
        console.log('🔧 StartManager init başladı');
        
        // Önce kullanıcı bilgilerini güncelle
        this.updateUserInfo();
        
        // Her zaman modal göster - kullanıcı proje seçebilsin
        console.log('👤 Modal gösteriliyor - proje seçimi için');
        this.showStartModal();
    }

    showStartModal() {
        console.log('📱 StartModal gösteriliyor...');
        const modal = document.getElementById('startModal');
        console.log('📱 Modal elementi:', modal);
        
        if (modal) {
            modal.classList.add('show');
            console.log('📱 Modal gösterildi, projeler yükleniyor...');
            
            // Mevcut kullanıcı bilgilerini doldur
            this.fillCurrentUserInfo();
            
            this.loadProjects();
            this.setupEventListeners();
        } else {
            console.error('❌ startModal elementi bulunamadı!');
        }
    }

    fillCurrentUserInfo() {
        // Mevcut kullanıcı bilgilerini doldur
        const currentUser = this.auth.getUser();
        const currentProject = this.auth.getProject();
        
        const usernameInput = document.getElementById('username');
        const projectSelect = document.getElementById('projectSelect');
        
        if (currentUser && usernameInput) {
            usernameInput.value = currentUser.username;
        }
        
        if (currentProject && projectSelect) {
            projectSelect.value = currentProject.id;
        }
    }

    async loadProjects() {
        try {
            console.log('📁 Projeler yükleniyor...');
            console.log('🔧 StartManager: Auth instance:', this.auth);
            console.log('🔧 StartManager: Auth baseURL:', this.auth?.baseURL);
            
            // Önce server bağlantısını kontrol et
            try {
                const healthURL = `${this.auth.baseURL}/health`;
                console.log(`🔧 StartManager: Health check URL: ${healthURL}`);
                
                const healthResponse = await fetch(healthURL);
                console.log('🔧 Health response status:', healthResponse.status);
                if (!healthResponse.ok) {
                    throw new Error('Server bağlantısı yok');
                }
                console.log('✅ Server bağlantısı OK');
            } catch (healthError) {
                console.error('❌ Server bağlantısı hatası:', healthError.message);
                this.showError('Server bağlantısı yok! Lütfen server\'ı başlatın.');
                return;
            }
            
            // Login yap (admin/admin varsayılan)
            try {
                console.log('🔐 Login yapılıyor...');
                await this.auth.login('admin', 'admin');
                console.log('✅ Login başarılı');
            } catch (loginError) {
                console.log('⚠️ Login hatası, projeleri token olmadan yüklemeye çalışıyor...', loginError.message);
            }
            
            console.log('📁 getProjects() çağrılıyor...');
            const projects = await this.auth.getProjects();
            console.log('📁 Yüklenen projeler:', projects);
            console.log('📁 Projeler tipi:', typeof projects);
            console.log('📁 Projeler uzunluğu:', projects?.length);
            
            // Projeleri sınıf değişkenine kaydet
            this.projects = projects;
            
            const select = document.getElementById('projectSelect');
            console.log('📁 Select element:', select);
            
            if (select) {
                // Mevcut seçenekleri temizle (ilk seçenek hariç)
                while (select.children.length > 1) {
                    select.removeChild(select.lastChild);
                }

                // Projeleri ekle
                projects.forEach(project => {
                    const option = document.createElement('option');
                    option.value = project.id;
                    option.textContent = `${project.name} (${project.total_images || 0} fotoğraf)`;
                    select.appendChild(option);
                    console.log('📁 Proje eklendi:', project.name);
                });
                
                console.log('📁 Toplam proje sayısı:', projects.length);
            } else {
                console.error('❌ projectSelect elementi bulunamadı');
            }
        } catch (error) {
            console.error('❌ Projeler yüklenirken hata:', error);
            this.showError('Projeler yüklenirken hata oluştu: ' + error.message);
        }
    }

    getProjectNameById(projectId) {
        if (!this.projects) return 'Bilinmeyen Proje';
        
        const project = this.projects.find(p => p.id == projectId);
        return project ? project.name : 'Bilinmeyen Proje';
    }

    setupEventListeners() {
        const form = document.getElementById('startForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleStart();
            });
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }
    }

    async handleStart() {
        const username = document.getElementById('username').value.trim();
        const projectId = document.getElementById('projectSelect').value;

        if (!username || !projectId) {
            this.showError('Lütfen kullanıcı adı ve proje seçin');
            return;
        }

        try {
            console.log('🚀 Başlatılıyor:', { username, projectId });
            
            // Backend'den token al
            console.log('🔑 Token alınıyor...');
            const response = await fetch(`${this.auth.baseURL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });

            if (!response.ok) {
                throw new Error('Login başarısız');
            }

            const loginResult = await response.json();
            if (!loginResult.success) {
                throw new Error(loginResult.error || 'Login başarısız');
            }

            console.log('✅ Token alındı:', loginResult.token ? 'Var' : 'Yok');
            
            // Token'ı sakla
            this.auth.setToken(loginResult.token);
            
            // Proje adını al
            const projectName = this.getProjectNameById(projectId);
            console.log('📁 Proje adı:', projectName);
            
            // Kullanıcı ve proje bilgilerini ayarla
            this.auth.setUserAndProject(username, projectId, projectName);
            
            // Modalı kapat
            const modal = document.getElementById('startModal');
            if (modal) {
                modal.classList.remove('show');
            }

            // Uygulamayı başlat
            await this.startApp();
        } catch (error) {
            console.error('❌ Başlatma hatası:', error);
            this.showError('Uygulama başlatılırken hata oluştu: ' + error.message);
        }
    }

    async startApp() {
        try {
            console.log('🚀 Uygulama başlatılıyor...');
            
            // ImageManager'ı oluştur ve başlat
            const projectId = this.auth.getProject().id;
            console.log('📁 Proje ID:', projectId);
            
            window.imageManager = new ImageManager(this.auth);
            console.log('📁 ImageManager oluşturuldu');
            
            // Proje ayarlama işlemini bekle
            await window.imageManager.setProject(projectId);
            console.log('✅ Proje başarıyla ayarlandı');
            
            // Mevcut kullanıcı ve proje bilgilerini göster
            this.updateUserInfo();
            
            console.log('✅ Uygulama başlatıldı');
        } catch (error) {
            console.error('❌ Uygulama başlatılırken hata:', error);
        }
    }

    updateUserInfo() {
        const user = this.auth.getUser();
        const project = this.auth.getProject();
        
        console.log('🔍 updateUserInfo çağrıldı:', { user, project });
        
        if (user && project) {
            // Kullanıcı adını göster
            const currentUserSpan = document.getElementById('currentUser');
            if (currentUserSpan) {
                currentUserSpan.textContent = user.username;
                console.log('✅ Kullanıcı adı güncellendi:', user.username);
            } else {
                console.error('❌ currentUser elementi bulunamadı');
            }
            
            // Proje adını sidebar'da göster
            const projectNameSpan = document.getElementById('projectName');
            if (projectNameSpan) {
                projectNameSpan.textContent = project.name;
                console.log('✅ Proje adı güncellendi:', project.name);
            } else {
                console.error('❌ projectName elementi bulunamadı');
            }
            
            console.log('👤 Kullanıcı bilgileri güncellendi:', user.username, 'Proje:', project.name);
        } else {
            // Bilgiler yoksa varsayılan değerleri göster
            const currentUserSpan = document.getElementById('currentUser');
            if (currentUserSpan) {
                currentUserSpan.textContent = '-';
            }
            
            const projectNameSpan = document.getElementById('projectName');
            if (projectNameSpan) {
                projectNameSpan.textContent = '-';
            }
            
            console.log('⚠️ Kullanıcı veya proje bilgisi bulunamadı:', { user, project });
        }
    }

    showError(message) {
        const errorElement = document.getElementById('startError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    // Dashboard'a dön
    goToDashboard() {
        const confirmDashboard = confirm('Dashboard\'a geçmek istediğinizden emin misiniz?');
        if (confirmDashboard) {
            console.log('🏠 Dashboard\'a dönülüyor...');
            // Dashboard'a yönlendir - Electron uygulamasında doğru path
            window.location.href = '../dashboard/';
        } else {
            console.log('❌ Dashboard\'a dönüş iptal edildi');
        }
    }

    // Çıkış yap (eski fonksiyon - artık kullanılmıyor)
    logout() {
        // Alert göster
        const confirmLogout = confirm('Uygulamadan çıkmak istediğinizden emin misiniz?');
        
        if (confirmLogout) {
            console.log('🚪 Kullanıcı çıkış yapıyor...');
            this.auth.logout();
            // Auto refresh ile başa sar
            window.location.reload();
        } else {
            console.log('❌ Çıkış iptal edildi');
        }
    }
}

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 StartManager başlatılıyor...');
    window.startManager = new StartManager();
    console.log('✅ StartManager başlatıldı');
    
    // Form submit event'i
    const startForm = document.getElementById('startForm');
    if (startForm) {
        startForm.addEventListener('submit', (e) => {
            e.preventDefault();
            window.startManager.handleStart();
        });
    }
    
    // Logout button event'i
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.startManager.handleLogout();
        });
    }
    
    // Dashboard button event'i
    const dashboardBtn = document.getElementById('dashboardBtn');
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', () => {
            window.startManager.goToDashboard();
        });
    }
});
