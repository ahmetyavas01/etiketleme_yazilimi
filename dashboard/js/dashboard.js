// Dashboard Manager
class DashboardManager {
    constructor() {
        this.currentTab = 'projects';
        this.auth = new AuthManager();
        this.projectsManager = new ProjectsManager(this.auth);
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuth();
    }

    // Kimlik doğrulama kontrolü - Dashboard artık auth gerektirmez
    checkAuth() {
        this.showDashboard();
        this.loadDashboardData();
    }

    // Event listener'ları kur
    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Navigation tabs
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Add user button - removed (no longer needed)

        // Add project button
        document.getElementById('addProjectBtn').addEventListener('click', () => {
            this.showAddProjectModal();
        });

        // Add user form
        document.getElementById('addUserForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddUser();
        });

        // Add project form
        document.getElementById('addProjectForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddProject();
        });

        // Cancel buttons
        document.getElementById('cancelAddUser').addEventListener('click', () => {
            this.hideModal('addUserModal');
        });

        document.getElementById('cancelAddProject').addEventListener('click', () => {
            this.hideModal('addProjectModal');
        });
    }

    // Giriş işlemi
    async handleLogin() {
        const username = document.getElementById('username').value;
        const errorDiv = document.getElementById('loginError');

        if (!username) {
            errorDiv.textContent = 'Kullanıcı adı gerekli';
            return;
        }

        const result = await this.auth.login(username);
        
        if (result.success) {
            this.showDashboard();
            this.loadDashboardData();
        } else {
            errorDiv.textContent = result.error;
        }
    }

    // Çıkış işlemi
    handleLogout() {
        this.auth.logout();
        this.showLogin();
    }

    // Login modal'ını göster
    showLogin() {
        document.getElementById('loginModal').classList.add('show');
        document.getElementById('dashboard').style.display = 'none';
    }

    // Dashboard'u göster
    showDashboard() {
        document.getElementById('loginModal').classList.remove('show');
        document.getElementById('dashboard').style.display = 'block';
        
        // Kullanıcı bilgilerini güncelle
        const user = this.auth.getUser();
        document.getElementById('username').textContent = user.username;
    }

    // Tab değiştir
    switchTab(tabName) {
        // Aktif tab'ı kaldır
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Yeni tab'ı aktif yap
        const navBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (navBtn) {
            navBtn.classList.add('active');
        }

        // Tab ismini camelCase'e çevir (label-analytics -> labelAnalytics)
        const tabId = tabName.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase()) + 'Tab';
        const tabElement = document.getElementById(tabId);
        if (tabElement) {
            tabElement.classList.add('active');
        }

        this.currentTab = tabName;
        this.loadTabData(tabName);
    }

    // Tab verilerini yükle
    loadTabData(tabName) {
        switch (tabName) {
            case 'projects':
                this.projectsManager.updateProjectsTable();
                break;
            case 'label-analytics':
                // Label analytics sekmesi için özel işlem
                if (window.labelAnalytics) {
                    window.labelAnalytics.loadLabelAnalytics();
                }
                break;
        }
    }

    // Dashboard verilerini yükle
    async loadDashboardData() {
        await this.loadTabData(this.currentTab);
    }

    // Analitik verilerini yükle
    async loadAnalytics() {
        try {
            const [users, projects] = await Promise.all([
                this.usersManager.getUsers(),
                this.projectsManager.getProjects()
            ]);

            document.getElementById('totalUsers').textContent = users.length;
            document.getElementById('totalProjects').textContent = projects.length;
            
            // Aktif kullanıcı sayısı (son 24 saatte giriş yapan)
            const activeUsers = users.filter(user => {
                if (!user.last_login) return false;
                const lastLogin = new Date(user.last_login);
                const now = new Date();
                const diffHours = (now - lastLogin) / (1000 * 60 * 60);
                return diffHours <= 24;
            }).length;
            
            document.getElementById('activeUsers').textContent = activeUsers;
        } catch (error) {
            console.error('Analitik veriler yüklenemedi:', error);
        }
    }

    // Add user modal'ını göster
    showAddUserModal() {
        document.getElementById('addUserModal').classList.add('show');
        document.getElementById('addUserForm').reset();
        document.getElementById('addUserError').textContent = '';
    }

    // Add project modal'ını göster
    showAddProjectModal() {
        document.getElementById('addProjectModal').classList.add('show');
        document.getElementById('addProjectForm').reset();
        document.getElementById('addProjectError').textContent = '';
    }

    // Modal'ı gizle
    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('show');
    }

    // Yeni kullanıcı ekle
    async handleAddUser() {
        const username = document.getElementById('newUsername').value;
        const role = document.getElementById('newRole').value;
        const errorDiv = document.getElementById('addUserError');

        if (!username) {
            errorDiv.textContent = 'Kullanıcı adı gerekli';
            return;
        }

        const result = await this.usersManager.createUser(username, role);
        
        if (result.success) {
            this.hideModal('addUserModal');
            this.usersManager.showMessage('Kullanıcı başarıyla oluşturuldu', 'success');
            this.usersManager.updateUsersTable();
        } else {
            errorDiv.textContent = result.error;
        }
    }

    // Yeni proje oluştur
    async handleAddProject() {
        const name = document.getElementById('projectName').value;
        const description = document.getElementById('projectDescription').value;
        const folderPath = document.getElementById('projectFolderPath').value;
        const errorDiv = document.getElementById('addProjectError');

        if (!name) {
            errorDiv.textContent = 'Proje adı gerekli';
            return;
        }

        const result = await this.projectsManager.createProject(name, description, folderPath);
        
        if (result.success) {
            this.hideModal('addProjectModal');
            this.projectsManager.showMessage('Proje başarıyla oluşturuldu', 'success');
            this.projectsManager.updateProjectsTable();
        } else {
            errorDiv.textContent = result.error;
        }
    }
}

// Dashboard'u başlat
const dashboard = new DashboardManager();
