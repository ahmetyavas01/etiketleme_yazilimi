class SimpleDashboard {
    constructor() {
        console.log('🏗️ SimpleDashboard constructor başlatılıyor...');
        this.projects = [];
        this.labelChart = null; // Chart referansı için
        this.currentProjectId = null; // Seçili proje ID'si
        this.socket = null; // WebSocket bağlantısı
        this.isServerRunning = false; // Server durumu
        this.serverIP = null; // Gerçek IP adresi
        this.baseURL = null; // Dinamik olarak ayarlanacak
        
        console.log('🔧 Dashboard direkt başlatılıyor (auth kaldırıldı)');
        this.init();
    }

    async init() {
        console.log('🚀 SimpleDashboard başlatılıyor...');
        
        // Authentication kaldırıldı - direkt dashboard göster
        console.log('✅ Dashboard direkt gösteriliyor');
        this.setupEventListeners();
        this.setupTabNavigation();
        
        // IP adresini al ve baseURL'i ayarla
        await this.getServerIP();
        this.baseURL = `http://${this.serverIP}:3000/api`;
        console.log('🌐 Base URL:', this.baseURL);
        
        // Server durumunu kontrol et
        await this.checkServerStatus();
        
        // Eğer server çalışıyorsa verileri yükle
        if (this.isServerRunning) {
            await this.loadProjectSummary();
            await this.loadLabelAnalytics();
            this.setupProjectSelector();
            this.setupWebSocket();
            // Server çalışıyorsa başlatma butonunu gizle
            this.hideServerStartButton();
        } else {
            // Server çalışmıyorsa server başlatma butonunu göster
            this.showServerStartButton();
        }
    }


    setupEventListeners() {
        // Logout (sadece sayfa yenileme)
        document.getElementById('logoutBtn').addEventListener('click', () => {
            console.log('🚪 Sayfa yenileniyor...');
            window.location.reload();
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', async () => {
            console.log('🔄 Dashboard yenileniyor...');
            await this.loadLabelAnalytics(); // Bu zaten loadProjectSummary'i çağırıyor
            this.setupProjectSelector();
        });

        // Server connection modal
        this.setupServerConnectionEvents();

        // Open labeling app button
        document.getElementById('openLabelingAppBtn').addEventListener('click', () => {
            this.openLabelingApp();
        });

        // Add project button
        document.getElementById('addProjectBtn').addEventListener('click', () => {
            this.showAddProjectModal();
        });

        // Add project modal events
        document.getElementById('closeProjectModal').addEventListener('click', () => {
            this.hideAddProjectModal();
        });

        // Server start button
        document.getElementById('startServerBtn').addEventListener('click', () => {
            this.showServerStartModal();
        });

        // Server start modal events
        document.getElementById('closeServerModal').addEventListener('click', () => {
            this.hideServerStartModal();
        });

        // Server start actions
        document.getElementById('startServerAuto').addEventListener('click', () => {
            this.startServerAutomatically();
        });

        document.getElementById('startServerManual').addEventListener('click', () => {
            this.startServerManually();
        });

        document.getElementById('openLabelingApp').addEventListener('click', () => {
            this.openLabelingApp();
        });
    }

    // Gerçek IP adresini al
    async getServerIP() {
        // Basit çözüm: Her zaman localhost kullan
        this.serverIP = 'localhost';
        console.log('🌐 IP adresi ayarlandı:', this.serverIP);
    }

    setupTabNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const tabContents = document.querySelectorAll('.tab-content');
        const pageTitle = document.getElementById('pageTitle');
        const pageSubtitle = document.getElementById('pageSubtitle');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const tabName = item.dataset.tab;
                
                // Update active nav item
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Update active tab content
                tabContents.forEach(tab => tab.classList.remove('active'));
                document.getElementById(`${tabName}Tab`).classList.add('active');
                
                // Update page title and subtitle
                if (tabName === 'projects') {
                    pageTitle.textContent = 'Proje Yönetimi';
                    pageSubtitle.textContent = 'Projelerinizi yönetin ve etiket analizlerini görüntüleyin';
                } else if (tabName === 'analytics') {
                    pageTitle.textContent = 'Etiket Analizi';
                    pageSubtitle.textContent = 'Projelerinizdeki etiket dağılımını ve istatistikleri görüntüleyin';
                }
            });
        });

        document.getElementById('cancelAddProject').addEventListener('click', () => {
            this.hideAddProjectModal();
        });

        // Add project form
        document.getElementById('addProjectForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddProject();
        });

        // Folder selection - SADECE drag & drop için kullanılacak
        // Electron API ile seçilen klasörler için handleElectronFolderSelection kullanılacak
        // Bu event listener'ı kaldırıyoruz çünkü Electron API ile seçilen klasörler için gerekli değil
        // document.getElementById('projectFolderPath').addEventListener('change', (e) => {
        //     console.log('⚠️ projectFolderPath change event - bu sadece drag & drop için olmalı');
        //     this.handleFolderSelection(e);
        // });

        // Drag & Drop functionality
        const dropZone = document.getElementById('folderDropZone');
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            this.handleFolderDrop(e);
        });

        // Electron veya modern klasör seçici
        this.setupModernFolderPicker();

        // Klasör adı input'u için otomatik path oluşturma
        document.getElementById('projectFolderPathText').addEventListener('input', (e) => {
            this.handleFolderNameInput(e);
        });

        // Modal outside click
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('addProjectModal');
            if (e.target === modal) {
                console.log('🖱️ Modal dışına tıklandı, modal kapatılıyor');
                this.hideAddProjectModal();
            }
        });

    }


    setupProjectSelector() {
        const projectSelect = document.getElementById('projectSelect');
        if (!projectSelect) return;

        // Proje listesini temizle
        projectSelect.innerHTML = '<option value="">Tüm Projeler</option>';

        // Projeleri ekle
        this.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            projectSelect.appendChild(option);
        });

        // Proje değiştiğinde analizi yenile
        projectSelect.addEventListener('change', async (e) => {
            this.currentProjectId = e.target.value || null;
            console.log('📊 Proje değişti:', this.currentProjectId ? `Proje ID: ${this.currentProjectId}` : 'Tüm projeler');
            await this.loadLabelAnalytics();
        });
    }


    setupWebSocket() {
        try {
            console.log('🔌 WebSocket bağlantısı kuruluyor...');
            const socketURL = `http://${this.serverIP}:3000`;
            console.log('🌐 Socket.IO URL:', socketURL);
            
            // Socket.IO'nun yüklenip yüklenmediğini kontrol et
            if (typeof io === 'undefined') {
                console.error('❌ Socket.IO yüklenemedi');
                this.updateConnectionStatus('disconnected', 'Socket.IO Yüklenemedi');
                return;
            }
            
            this.socket = io(socketURL);
            
            this.socket.on('connect', () => {
                console.log('✅ WebSocket bağlantısı kuruldu');
                this.updateConnectionStatus('connected', `Bağlantı kuruldu: ${this.serverIP}:3000`);
            });
            
            this.socket.on('disconnect', async () => {
                console.log('❌ WebSocket bağlantısı koptu');
                this.updateConnectionStatus('disconnected', 'Bağlantı Koptu');
                
                // Bağlantı koptuğunda son bir kez güncelle
                try {
                    await this.loadLabelAnalytics();
                    console.log('🔄 WebSocket koptuğunda son güncelleme yapıldı');
                } catch (error) {
                    console.error('❌ Son güncelleme hatası:', error);
                }
            });
            
            // Etiket eklendiğinde dashboard'ı güncelle
            this.socket.on('labelAdded', async (data) => {
                console.log('📡 Etiket eklendi bildirimi alındı:', data);
                
                // Sadece gerçek değişiklik olduğunda güncelle
                if (data.savedCount > 0) {
                    // Toast notification göster
                    this.showToast(`Yeni etiket eklendi: ${data.savedCount} adet`, 'success');
                    
                    // Dashboard'ı hemen güncelle
                    try {
                        await this.loadLabelAnalytics();
                        console.log('✅ Dashboard etiket eklendi bildirimi ile güncellendi');
                    } catch (error) {
                        console.error('❌ Dashboard güncelleme hatası:', error);
                    }
                } else {
                    console.log('📡 Etiket değişikliği yok, güncelleme atlandı');
                }
            });
            
        } catch (error) {
            console.error('❌ WebSocket bağlantı hatası:', error);
            this.updateConnectionStatus('disconnected', 'Bağlantı Hatası');
        }
    }

    updateConnectionStatus(status, text) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.className = `connection-status ${status}`;
            
            // Eğer text'te localhost varsa, gerçek IP ile değiştir
            if (text && text.includes('localhost')) {
                const port = window.location.port || '3000';
                text = text.replace('localhost', this.serverIP || 'localhost');
                text = text.replace('127.0.0.1', this.serverIP || '127.0.0.1');
            }
            
            statusElement.querySelector('span').textContent = text;
        }
    }

    // handleLogin metodu kaldırıldı - artık authentication yok

    async loadLabelAnalytics() {
        try {
            console.log('📊 Etiket analizi yükleniyor...', this.currentProjectId ? `Proje: ${this.currentProjectId}` : 'Tüm projeler');
            
            // Önce proje özetini yükle (daha doğru etiket sayıları için)
            await this.loadProjectSummary();
            
            let url;
            if (this.currentProjectId) {
                // Belirli bir proje için analiz
                url = `${this.baseURL}/projects/${this.currentProjectId}/annotation-stats`;
            } else {
                // Tüm projeler için analiz
                url = `${this.baseURL}/label-analytics`;
            }
            
            const response = await fetch(url);
            console.log('📡 Label analytics response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('📊 Etiket analizi verileri:', data);
                
                // Backend'den gelen veri yapısını kontrol et
                if (data.success && data.data) {
                    this.displayLabelAnalytics(data.data);
                } else {
                    // Eski format için geriye dönük uyumluluk
                    this.displayLabelAnalytics(data);
                }
            } else {
                const errorText = await response.text();
                console.error('❌ Label analytics error:', response.status, errorText);
                
                // Hata durumunda sadece proje özeti verilerini kullan
                this.displayLabelAnalytics({});
            }
        } catch (error) {
            console.error('❌ Etiket analizi yüklenirken hata:', error);
            
            // Hata durumunda sadece proje özeti verilerini kullan
            this.displayLabelAnalytics({});
        }
    }

    displayLabelAnalytics(data) {
        // Backend'den gelen veri yapısını kontrol et
        let totalAnnotations = data.totalAnnotations || data.totalLabels || 0;
        let labelStats = data.labelStats || [];
        
        // Backend'ten gelen veriyi kullan
        console.log('📊 Backend verisi:', data);
        
        console.log('📊 Analytics data (aynı isimdeki etiketler dahil):', { 
            totalAnnotations, 
            labelStats: labelStats.length,
            rawData: data
        });
        
        // Etiket sayılarını detaylı logla
        if (labelStats.length > 0) {
            console.log('📊 Etiket detayları:', labelStats.map(stat => `${stat.label}: ${stat.count}`));
        }
        
        // Chart başlığını güncelle
        const chartTitle = document.getElementById('chartTitle');
        if (chartTitle) {
            if (this.currentProjectId) {
                const selectedProject = this.projects.find(p => p.id == this.currentProjectId);
                chartTitle.textContent = selectedProject ? `${selectedProject.name} - Etiket Dağılımı` : 'Etiket Dağılımı';
            } else {
                chartTitle.textContent = 'Tüm Projeler - Etiket Dağılımı';
            }
        }
        
        // Proje istatistiklerini göster
        this.displayProjectStats(data);
        
        // Chart oluştur - eğer labelStats boşsa, proje özeti verilerinden oluştur
        if (labelStats.length === 0 && this.projects && this.projects.length > 0) {
            // Proje özeti verilerinden basit bir chart oluştur (aynı isimdeki etiketler dahil)
            const projectStats = this.projects.map(project => ({
                label: project.name,
                count: project.labelCount || 0
            })).filter(stat => stat.count > 0);
            
            console.log('📊 Chart için proje verileri kullanılıyor (aynı isimdeki etiketler dahil):', projectStats);
            this.createLabelChart(projectStats);
        } else {
            console.log('📊 Chart için analiz verileri kullanılıyor:', labelStats);
            this.createLabelChart(labelStats);
        }
    }

    displayProjectStats(data) {
        const statsContainer = document.getElementById('projectStats');
        if (!statsContainer) return;

        const labelStats = data.labelStats || [];

        statsContainer.innerHTML = labelStats.length > 0 ? 
            labelStats
                .sort((a, b) => b.count - a.count) // Sayıya göre sırala (büyükten küçüğe)
                .map(stat => `
                    <div class="label-item">
                        <div class="label-color" style="background-color: ${this.getLabelColor(stat.label, labelStats)}"></div>
                        <span class="label-name">${stat.label}</span>
                        <span class="label-separator">-</span>
                        <span class="label-count">${stat.count}</span>
                    </div>
                `).join('') :
            '<div class="no-labels">Henüz etiket eklenmemiş</div>';
    }

    createLabelChart(labelStats) {
        const ctx = document.getElementById('labelChart');
        if (!ctx || !labelStats || labelStats.length === 0) {
            console.log('📊 Chart oluşturulamadı - veri yok');
            return;
        }
        
        // Mevcut chart'ı temizle
        if (this.labelChart) {
            this.labelChart.destroy();
        }
        
        const labels = labelStats.map(stat => stat.label);
        const counts = labelStats.map(stat => stat.count);
        
        // Modern renk paleti
        const colors = [
            '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
            '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
            '#14B8A6', '#F43F5E', '#8B5A2B', '#64748B', '#0EA5E9'
        ];
        
        this.labelChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 3,
                    borderColor: '#ffffff',
                    hoverBorderWidth: 4,
                    hoverBorderColor: '#f8fafc'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // Legend'ı kaldır, altında göstereceğiz
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#1e293b',
                        bodyColor: '#1e293b',
                        borderColor: '#e2e8f0',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const count = context.parsed;
                                return `${label}: ${count} adet`;
                            }
                        }
                    }
                }
            }
        });
    }

    getLabelColor(label, labelStats) {
        const colors = [
            '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
            '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
            '#14B8A6', '#F43F5E', '#8B5A2B', '#64748B', '#0EA5E9'
        ];
        
        const index = labelStats.findIndex(stat => stat.label === label);
        return colors[index % colors.length];
    }

    async loadProjectSummary() {
        try {
            console.log('📊 Proje özeti yükleniyor...');
            this.showLoading();
            
            const url = `${this.baseURL}/projects`;
            console.log('🌐 URL:', url);
            
            const response = await fetch(url);
            console.log('📡 Response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('📊 Proje verileri:', data);
                
                // Her proje için etiket sayısını logla (aynı isimdeki etiketler dahil)
                data.forEach(project => {
                    console.log(`📊 Proje "${project.name}": ${project.labelCount} etiket (aynı isimdeki etiketler dahil), ${project.totalImages} fotoğraf`);
                });
                
                this.projects = data;
                this.displayProjectSummary();
            } else {
                const errorText = await response.text();
                console.error('❌ Response error:', response.status, errorText);
                this.showError(`Proje verileri yüklenemedi (${response.status})`);
            }
        } catch (error) {
            console.error('❌ Proje özeti yüklenirken hata:', error);
            this.showError('Proje özeti yüklenirken hata oluştu: ' + error.message);
        }
    }

    displayProjectSummary() {
        const container = document.getElementById('projectsSummaryList');
        
        if (!this.projects || this.projects.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <h3>Henüz Proje Yok</h3>
                    <p>Yeni bir proje oluşturmak için "Yeni Proje" butonuna tıklayın.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.projects.map(project => {
            // Tamamlanma oranı: etiketlenmiş fotoğraf sayısı / toplam fotoğraf sayısı
            const labeledImages = project.labeledImages || 0;
            const totalImages = project.total_images || 0;
            const completionRate = totalImages > 0 ? 
                Math.round((labeledImages / totalImages) * 100) : 0;
            
            return `
                <div class="project-card">
                    <div class="project-card-header">
                        <div class="project-name">${project.name}</div>
                        <div class="project-actions">
                            <button class="btn btn-danger btn-sm" onclick="simpleDashboard.deleteProject(${project.id}, '${project.name}')" title="Projeyi Sil">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="project-stats">
                        <div class="stat-item">
                            <span class="stat-number">${project.labelCount || 0}</span>
                            <span class="stat-label">Toplam Etiket</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${totalImages}</span>
                            <span class="stat-label">Fotoğraf</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${completionRate}%</span>
                            <span class="stat-label">Tamamlanma</span>
                        </div>
                    </div>
                    ${project.description ? `<div class="project-description">${project.description}</div>` : ''}
                    <div class="project-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${completionRate}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    showLoading() {
        const container = document.getElementById('projectsSummaryList');
        container.innerHTML = '<div class="loading">Proje özeti yükleniyor...</div>';
    }

    showError(message) {
        const container = document.getElementById('projectsSummaryList');
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Hata</h3>
                <p>${message}</p>
            </div>
        `;
    }

    showAddProjectModal() {
        const modal = document.getElementById('addProjectModal');
        modal.style.display = 'flex';
        modal.classList.add('show');
        document.getElementById('projectName').focus();
        this.clearAddProjectForm();
    }

    hideAddProjectModal() {
        const modal = document.getElementById('addProjectModal');
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
        this.clearAddProjectForm();
    }

    async deleteProject(projectId, projectName) {
        if (!confirm(`"${projectName}" projesini silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz ve projeye ait tüm fotoğraflar ve etiketler silinecektir.`)) {
            return;
        }

        try {
            console.log('🗑️ Proje siliniyor:', projectId);
            
            const response = await fetch(`${this.baseURL}/projects/${projectId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Proje silindi:', result);
                
                // Proje listesini yenile
                await this.loadLabelAnalytics(); // Bu zaten loadProjectSummary'i çağırıyor
                this.setupProjectSelector();
                
                // Başarı mesajı göster
                this.showToast(`"${projectName}" projesi başarıyla silindi`, 'success');
            } else {
                const error = await response.json();
                console.error('❌ Proje silme hatası:', error);
                this.showToast(`Proje silinemedi: ${error.error}`, 'error');
            }
        } catch (error) {
            console.error('❌ Proje silme hatası:', error);
            this.showToast('Proje silinirken bir hata oluştu', 'error');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Show toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        // Hide toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    clearAddProjectForm() {
        document.getElementById('addProjectForm').reset();
        document.getElementById('addProjectError').textContent = '';
        document.getElementById('addProjectLoading').style.display = 'none';
        
        // Klasör seçimi bilgilerini temizle
        const folderInfo = document.getElementById('selectedFolderInfo');
        const folderText = document.querySelector('.folder-text');
        const folderInput = document.getElementById('projectFolderPath');
        const folderPathText = document.getElementById('projectFolderPathText');
        
        if (folderInfo) folderInfo.style.display = 'none';
        if (folderText) folderText.textContent = 'Klasör seçmek için tıklayın';
        
        // File input'u manuel olarak temizle
        if (folderInput) {
            folderInput.value = '';
            console.log('🧹 File input temizlendi');
        }
        
        // Text input'u temizle
        if (folderPathText) {
            folderPathText.value = '';
            console.log('🧹 Text input temizlendi');
        }
    }

    handleFolderSelection(event) {
        const files = event.target.files;
        this.processFolderFiles(files);
    }

    handleFolderDrop(event) {
        const files = event.dataTransfer.files;
        this.processFolderFiles(files);
    }

    setupModernFolderPicker() {
        console.log('🔧 setupModernFolderPicker çalışıyor...');
        
        const dropZone = document.getElementById('folderDropZone');
        console.log('🔧 dropZone element:', dropZone);
        
        if (!dropZone) {
            console.error('❌ folderDropZone elementi bulunamadı!');
            return;
        }
        
        const folderText = document.querySelector('.folder-text');
        
        // Mevcut butonları temizle
        const existingButton = dropZone.querySelector('.btn-primary');
        if (existingButton) {
            existingButton.remove();
        }
        
        // TEMİZ VE BASİT ÇÖZÜM: Sadece Electron API
        const electronButton = document.createElement('button');
        electronButton.type = 'button';
        electronButton.className = 'btn btn-primary';
        electronButton.innerHTML = '<i class="fas fa-folder-open"></i> Klasör Seç';
        electronButton.style.marginTop = '0.5rem';
        electronButton.style.width = '100%';
        electronButton.style.padding = '12px';
        electronButton.style.fontSize = '16px';
        electronButton.style.backgroundColor = '#007bff';
        electronButton.style.color = 'white';
        electronButton.style.border = 'none';
        electronButton.style.borderRadius = '4px';
        electronButton.style.cursor = 'pointer';
        electronButton.style.display = 'block';
        electronButton.style.zIndex = '1000';
        
        console.log('🔧 Buton oluşturuldu, event listener ekleniyor...');
        
        electronButton.addEventListener('click', async () => {
            alert('Buton tıklandı!'); // Debug
            console.log('📁 Klasör seçimi başlatılıyor...');
            await this.selectFolderWithElectron();
        });
        
        dropZone.appendChild(electronButton);
        console.log('🔧 Buton dropZone\'a eklendi');
        
        // DOM'da kontrolü
        setTimeout(() => {
            const addedButton = dropZone.querySelector('.btn-primary');
            console.log('🔧 DOM\'da buton var mı:', !!addedButton);
            console.log('🔧 Buton görünür mü:', addedButton ? addedButton.offsetWidth > 0 : 'Yok');
            console.log('🔧 DropZone içeriği:', dropZone.innerHTML);
        }, 1000);
        
        if (folderText) {
            folderText.textContent = 'Klasör seçmek için "Klasör Seç" butonunu kullanın';
        }
    }

    handleFolderNameInput(event) {
        const inputValue = event.target.value.trim();
        const folderInfo = document.getElementById('selectedFolderInfo');
        const selectedFolderPath = document.getElementById('selectedFolderPath');
        const folderText = document.querySelector('.folder-text');
        
        if (inputValue) {
            let fullPath;
            
            // Eğer tam path girilmişse (/ veya \ ile başlıyorsa) onu kullan
            if (inputValue.startsWith('/') || inputValue.match(/^[A-Z]:\\/)) {
                fullPath = inputValue;
                console.log('📁 Tam path girildi:', fullPath);
            } else {
                // Sadece klasör adı girilmişse otomatik path oluştur
                const isWindows = navigator.platform.toLowerCase().includes('win');
                fullPath = isWindows 
                    ? `C:\\Users\\kullanici\\Desktop\\${inputValue}`
                    : `/Users/kullanici/Desktop/${inputValue}`;
                console.log('📁 Klasör adı girildi:', inputValue, '→', fullPath);
            }
            
            // Klasör bilgilerini göster
            if (selectedFolderPath) {
                selectedFolderPath.textContent = fullPath;
            }
            if (folderInfo) {
                folderInfo.style.display = 'flex';
            }
            if (folderText) {
                folderText.textContent = `${inputValue} kullanılacak`;
            }
        } else {
            // Input temizlendi
            if (folderInfo) folderInfo.style.display = 'none';
            if (folderText) folderText.textContent = 'Klasör seçmek için tıklayın veya sürükleyin';
        }
    }

    // TEMİZ ELECTRON KLASÖR SEÇİCİ
    async selectFolderWithElectron() {
        try {
            // Electron API kontrol
            if (!window.electronAPI || !window.electronAPI.selectFolder) {
                throw new Error('Electron API mevcut değil');
            }
            
            console.log('🔧 Electron API kullanılıyor');
            const folderPath = await window.electronAPI.selectFolder();
            
            if (!folderPath) {
                console.log('❌ Klasör seçilmedi');
                return;
            }
            
            console.log('📁 Seçilen klasör:', folderPath);
            this.setSelectedFolder(folderPath);
            
        } catch (error) {
            console.error('❌ Elektron klasör seçim hatası:', error);
            document.getElementById('addProjectError').textContent = 
                'Klasör seçici çalışmıyor. Lütfen manuel olarak klasör yolunu girin.';
        }
    }
    
    // TEMİZ KLASÖR AYARLAMA
    setSelectedFolder(folderPath) {
        console.log('🔧 setSelectedFolder çağrıldı:', folderPath);
        
        const folderInfo = document.getElementById('selectedFolderInfo');
        const selectedFolderPath = document.getElementById('selectedFolderPath');
        const folderText = document.querySelector('.folder-text');
        const folderPathText = document.getElementById('projectFolderPathText');
        
        console.log('🔧 Element kontrolü:');
        console.log('🔧 folderInfo:', !!folderInfo);
        console.log('🔧 selectedFolderPath:', !!selectedFolderPath);
        console.log('🔧 folderText:', !!folderText);
        console.log('🔧 folderPathText:', !!folderPathText);
        
        // Klasör adını al
        const folderName = folderPath.includes('/') 
            ? folderPath.split('/').pop() 
            : folderPath.split('\\').pop();
        
        console.log('🔧 Klasör adı:', folderName);
        
        // UI güncelle
        if (selectedFolderPath) {
            selectedFolderPath.textContent = folderPath;
            console.log('🔧 selectedFolderPath güncellendi');
        }
        if (folderInfo) {
            folderInfo.style.display = 'flex';
            folderInfo.style.visibility = 'visible';
            folderInfo.style.opacity = '1';
            folderInfo.style.backgroundColor = '#e8f5e8';
            folderInfo.style.padding = '10px';
            folderInfo.style.border = '1px solid #28a745';
            folderInfo.style.borderRadius = '4px';
            folderInfo.style.marginTop = '10px';
            console.log('🔧 folderInfo gösterildi ve styling uygulandı');
        }
        if (folderText) {
            folderText.textContent = `${folderName} seçildi`;
            console.log('🔧 folderText güncellendi:', folderText.textContent);
        }
        if (folderPathText) {
            folderPathText.value = folderPath;
            console.log('🔧 folderPathText değeri:', folderPathText.value);
            console.log('🔧 folderPathText element ID:', folderPathText.id);
            console.log('🔧 folderPathText element class:', folderPathText.className);
        } else {
            console.error('❌ folderPathText elementi bulunamadı!');
        }
        
        // Hata mesajını temizle
        document.getElementById('addProjectError').textContent = '';
        
        console.log('✅ Klasör ayarlandı:', folderPath);
    }

    // KALDIRILDI - Gereksiz karmaşıklık

    // TEMİZ DRAG & DROP
    processFolderFiles(files) {
        if (!files || files.length === 0) {
            console.log('❌ Dosya seçilmedi');
            return;
        }
        
        const firstFile = files[0];
        const fullPath = firstFile.webkitRelativePath || firstFile.name;
        const folderName = fullPath.split('/')[0];
        
        // Basit path tahmini
        const estimatedPath = `/Users/ahmetyavas/Desktop/${folderName}`;
        
        // Kullanıcıdan gerçek yolu iste
        const realPath = prompt(
            `"${folderName}" klasörü sürüklendi.\n\nTam yolunu girin:`,
            estimatedPath
        );
        
        if (realPath && realPath.trim()) {
            this.setSelectedFolder(realPath.trim());
        } else {
            document.getElementById('addProjectError').textContent = 'Klasör yolu gerekli!';
        }
    }

    async handleAddProject() {
        const name = document.getElementById('projectName').value.trim();
        const description = document.getElementById('projectDescription').value.trim();
        const folderPathText = document.getElementById('projectFolderPathText').value.trim();

        console.log('🔍 Form submit - Değerler kontrol ediliyor:');
        console.log('🔍 Proje adı:', name);
        console.log('🔍 Açıklama:', description); 
        console.log('🔍 Klasör yolu:', folderPathText);
        console.log('🔍 folderPathText element:', document.getElementById('projectFolderPathText'));
        console.log('🔍 folderPathText raw value:', document.getElementById('projectFolderPathText').value);

        if (!name) {
            document.getElementById('addProjectError').textContent = 'Proje adı gerekli';
            return;
        }

        if (!folderPathText) {
            document.getElementById('addProjectError').textContent = 'Lütfen klasör seçin veya klasör yolunu girin';
            console.log('❌ Klasör yolu boş!');
            return;
        }

        console.log('📁 Kullanılacak klasör yolu:', folderPathText);

        try {
            // Loading göster
            document.getElementById('addProjectLoading').style.display = 'block';
            document.getElementById('addProjectError').textContent = '';

            console.log('📡 Backend\'e gönderilen veriler:', {
                name: name,
                description: description,
                folder_path: folderPathText
            });

            const response = await fetch(`${this.baseURL}/projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    description: description,
                    folder_path: folderPathText
                })
            });

            const result = await response.json();

            if (response.ok) {
                // Başarılı - modal'ı kapat ve liste yenile
                this.hideAddProjectModal();
                
                // Backend'den gelen mesajı kullan
                const successMessage = result.message || `Proje "${name}" başarıyla oluşturuldu!`;
                this.showSuccess(successMessage);
                
                console.log('✅ Proje oluşturuldu:', result);
                
                await this.loadLabelAnalytics(); // Bu zaten loadProjectSummary'i çağırıyor
                this.setupProjectSelector();
            } else {
                document.getElementById('addProjectError').textContent = result.error || 'Proje oluşturulamadı';
            }
        } catch (error) {
            console.error('Proje oluşturma hatası:', error);
            document.getElementById('addProjectError').textContent = 'Proje oluşturulurken hata oluştu';
        } finally {
            document.getElementById('addProjectLoading').style.display = 'none';
        }
    }

    showSuccess(message) {
        // Basit toast notification
        const toast = document.createElement('div');
        toast.className = 'toast success';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    // Server kontrol ve başlatma fonksiyonları
    async checkServerStatus() {
        console.log('🔍 Server durumu kontrol ediliyor...');
        console.log('🌐 Kontrol edilen URL:', `${this.baseURL}/health`);
        
        try {
            const response = await fetch(`${this.baseURL}/health`, {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit'
            });
            
            console.log('📡 Response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Server çalışıyor:', data);
                this.isServerRunning = true;
                this.updateConnectionStatus('connected', `Bağlantı kuruldu: ${this.serverIP}:3000`);
                return true;
            } else {
                console.log('❌ Server yanıt vermiyor, status:', response.status);
                this.isServerRunning = false;
                this.updateConnectionStatus('disconnected', 'Server Bağlantısı Yok');
                return false;
            }
        } catch (error) {
            console.log('❌ Server bağlantı hatası:', error.message);
            this.isServerRunning = false;
            this.updateConnectionStatus('disconnected', 'Server Bağlantısı Yok');
            return false;
        }
    }

    showServerStartButton() {
        console.log('🔘 Server başlatma butonu gösteriliyor');
        const startBtn = document.getElementById('startServerBtn');
        if (startBtn) {
            startBtn.style.display = 'block';
        }
    }

    hideServerStartButton() {
        console.log('🔘 Server başlatma butonu gizleniyor');
        const startBtn = document.getElementById('startServerBtn');
        if (startBtn) {
            startBtn.style.display = 'none';
        }
    }

    showServerStartModal() {
        console.log('🔘 Server başlatma modal\'ı gösteriliyor');
        const modal = document.getElementById('serverStartModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('show');
            this.checkServerStatusInModal();
        }
    }

    hideServerStartModal() {
        console.log('🔘 Server başlatma modal\'ı gizleniyor');
        const modal = document.getElementById('serverStartModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    }

    async checkServerStatusInModal() {
        const serverStatusText = document.getElementById('serverStatusText');
        const databaseStatusText = document.getElementById('databaseStatusText');
        const portStatusText = document.getElementById('portStatusText');
        const serverStartActions = document.getElementById('serverStartActions');

        // Server durumu
        serverStatusText.textContent = 'Kontrol ediliyor...';
        databaseStatusText.textContent = 'Kontrol ediliyor...';
        portStatusText.textContent = 'Kontrol ediliyor...';

        try {
            // Server kontrolü
            const serverResponse = await fetch(`${this.baseURL}/health`, {
                method: 'GET',
                timeout: 3000
            });

            if (serverResponse.ok) {
                const serverUrl = `${window.location.hostname}:${window.location.port || '3000'}`;
                serverStatusText.textContent = `Çalışıyor ✅ (${serverUrl})`;
                databaseStatusText.textContent = 'Bağlı ✅';
                portStatusText.textContent = 'Açık ✅';
                serverStartActions.style.display = 'none';
                
                // Server çalışıyorsa modal'ı kapat ve sayfayı yenile
                setTimeout(() => {
                    this.hideServerStartModal();
                    window.location.reload();
                }, 2000);
            } else {
                throw new Error('Server yanıt vermiyor');
            }
        } catch (error) {
            console.log('❌ Server kontrol hatası:', error.message);
            serverStatusText.textContent = 'Çalışmıyor ❌';
            databaseStatusText.textContent = 'Bağlantı Yok ❌';
            portStatusText.textContent = 'Kapalı ❌';
            serverStartActions.style.display = 'block';
        }
    }

    async startServerAutomatically() {
        console.log('🚀 Server otomatik başlatılıyor...');
        
        const serverStartProgress = document.getElementById('serverStartProgress');
        const serverStartActions = document.getElementById('serverStartActions');
        
        // Progress göster
        serverStartActions.style.display = 'none';
        serverStartProgress.style.display = 'block';

        try {
            console.log('📡 Server başlatma isteği gönderiliyor...');
            
            // Backend'e server başlatma isteği gönder
            const response = await fetch(`${this.baseURL}/server/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                if (result.alreadyRunning) {
                    this.showToast('Server zaten çalışıyor!', 'success');
                } else {
                    this.showToast('Server başlatıldı!', 'success');
                }
                
                // Server'ın başladığını kontrol et
                await new Promise(resolve => setTimeout(resolve, 2000));
                const isRunning = await this.checkServerStatus();
                
                if (isRunning) {
                    // Server başladı, butonu gizle
                    this.hideServerStartButton();
                    setTimeout(() => {
                        this.hideServerStartModal();
                        window.location.reload();
                    }, 1000);
                } else {
                    throw new Error('Server başlatıldı ama bağlantı kurulamadı');
                }
            } else {
                throw new Error(result.error || 'Server başlatılamadı');
            }
        } catch (error) {
            console.error('❌ Server başlatma hatası:', error);
            this.showToast(`Server başlatılamadı: ${error.message}`, 'error');
            
            // Progress'i gizle, actions'ı göster
            serverStartProgress.style.display = 'none';
            serverStartActions.style.display = 'block';
        }
    }

    startServerManually() {
        console.log('📋 Manuel server başlatma talimatları gösteriliyor');
        
        const instructions = `
Etiketleme Sistemi Server'ını Manuel Başlatma:

1. Terminal/Command Prompt açın
2. Proje klasörüne gidin:
   cd /Users/ahmetyavas/Documents/etiketlemeprojesi/backend
3. Server'ı başlatın:
   npm start
4. Bu sayfayı yenileyin

Alternatif olarak:
- Masaüstündeki "Etiketleme Sistemi" kısayolunu kullanın
- Veya "Server Başlat" kısayolunu çalıştırın
        `;
        
        alert(instructions);
        this.hideServerStartModal();
    }

    async openLabelingApp() {
        console.log('🏷️ Etiketleme uygulamasına geçiliyor...');
        
        try {
            // Electron API'si ile etiketleme uygulamasına geç
            if (window.electronAPI && window.electronAPI.openLabelingApp) {
                const result = await window.electronAPI.openLabelingApp();
                if (result.success) {
                    this.showToast('Etiketleme uygulamasına geçildi!', 'success');
                } else {
                    this.showToast('Etiketleme uygulamasına geçilemedi: ' + result.error, 'error');
                }
            } else {
                // Fallback: Sayfa yönlendirme
                window.location.href = '../labeling-app/index.html';
            }
        } catch (error) {
            console.error('❌ Etiketleme uygulamasına geçiş hatası:', error);
            this.showToast('Etiketleme uygulamasına geçilemedi', 'error');
        }
    }
    // Server Connection Functions
    setupServerConnectionEvents() {
        // Server connection modal açma
        document.getElementById('serverConnectBtn').addEventListener('click', () => {
            this.openServerModal();
        });

        // Modal kapatma
        document.getElementById('closeServerModal').addEventListener('click', () => {
            this.closeServerModal();
        });

        // Modal dışına tıklayınca kapatma
        document.getElementById('serverModal').addEventListener('click', (e) => {
            if (e.target.id === 'serverModal') {
                this.closeServerModal();
            }
        });

        // Bağlantı modu değişikliği
        document.querySelectorAll('input[name="connectionMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.toggleConnectionMode(e.target.value);
            });
        });

        // Yerel server başlatma
        document.getElementById('startLocalServerBtn').addEventListener('click', () => {
            this.startLocalServer();
        });

        // Uzak server bağlantısı
        document.getElementById('connectRemoteServerBtn').addEventListener('click', () => {
            this.connectRemoteServer();
        });
    }

    openServerModal() {
        const modal = document.getElementById('serverModal');
        modal.style.display = 'block';
        
        // Yerel server durumunu kontrol et
        this.checkLocalServerStatus();
        
        // Uzak serverları ara
        this.discoverRemoteServers();
    }

    closeServerModal() {
        const modal = document.getElementById('serverModal');
        modal.style.display = 'none';
    }

    toggleConnectionMode(mode) {
        const localSection = document.getElementById('localServerSection');
        const remoteSection = document.getElementById('remoteServerSection');
        
        if (mode === 'local') {
            localSection.style.display = 'block';
            remoteSection.style.display = 'none';
            this.checkLocalServerStatus();
        } else {
            localSection.style.display = 'none';
            remoteSection.style.display = 'block';
            this.discoverRemoteServers();
        }
    }

    async checkLocalServerStatus() {
        const statusElement = document.getElementById('localServerStatus');
        const startBtn = document.getElementById('startLocalServerBtn');
        
        statusElement.innerHTML = '<i class="fas fa-circle"></i> Kontrol ediliyor...';
        statusElement.className = 'status-indicator checking';
        
        try {
            const response = await fetch(`${this.baseURL}/health`);
            if (response.ok) {
                statusElement.innerHTML = '<i class="fas fa-circle"></i> Server çalışıyor';
                statusElement.className = 'status-indicator connected';
                startBtn.style.display = 'none';
            } else {
                throw new Error('Server yanıt vermiyor');
            }
        } catch (error) {
            statusElement.innerHTML = '<i class="fas fa-circle"></i> Server çalışmıyor';
            statusElement.className = 'status-indicator disconnected';
            startBtn.style.display = 'block';
        }
    }

    async startLocalServer() {
        const startBtn = document.getElementById('startLocalServerBtn');
        const originalText = startBtn.innerHTML;
        
        startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Başlatılıyor...';
        startBtn.disabled = true;
        
        try {
            // Electron main process'e server başlatma sinyali gönder
            const result = await window.electronAPI?.startBackend();
            
            if (result?.success) {
                this.showToast('Server başarıyla başlatıldı', 'success');
                await this.checkLocalServerStatus();
            } else {
                throw new Error(result?.error || 'Server başlatılamadı');
            }
        } catch (error) {
            this.showToast(`Server başlatma hatası: ${error.message}`, 'error');
        } finally {
            startBtn.innerHTML = originalText;
            startBtn.disabled = false;
        }
    }

    async connectRemoteServer() {
        const serverIP = document.getElementById('serverIP').value;
        const serverPort = document.getElementById('serverPort').value;
        
        if (!serverIP || !serverPort) {
            this.showToast('Lütfen IP adresi ve port girin', 'error');
            return;
        }
        
        const connectBtn = document.getElementById('connectRemoteServerBtn');
        const originalText = connectBtn.innerHTML;
        
        connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Bağlanıyor...';
        connectBtn.disabled = true;
        
        try {
            const testURL = `http://${serverIP}:${serverPort}/api/health`;
            const response = await fetch(testURL);
            
            if (response.ok) {
                // Bağlantı başarılı, baseURL'i güncelle
                this.baseURL = `http://${serverIP}:${serverPort}/api`;
                this.serverIP = serverIP;
                
                this.showToast(`Uzak servera başarıyla bağlandı: ${serverIP}:${serverPort}`, 'success');
                this.closeServerModal();
                
                // Verileri yeniden yükle
                await this.loadProjectSummary();
                await this.loadLabelAnalytics();
                this.setupProjectSelector();
            } else {
                throw new Error('Server yanıt vermiyor');
            }
        } catch (error) {
            this.showToast(`Uzak servera bağlanılamadı: ${error.message}`, 'error');
        } finally {
            connectBtn.innerHTML = originalText;
            connectBtn.disabled = false;
        }
    }

    async discoverRemoteServers() {
        const serversList = document.getElementById('discoveredServersList');
        serversList.innerHTML = '<div class="loading">Aranıyor...</div>';
        
        try {
            // Yerel ağdaki IP aralığını tara (192.168.1.x)
            const baseIP = '192.168.1.';
            const port = 3000;
            const servers = [];
            
            // Paralel olarak IP'leri kontrol et
            const promises = [];
            for (let i = 1; i <= 254; i++) {
                const ip = `${baseIP}${i}`;
                promises.push(this.checkServerAtIP(ip, port));
            }
            
            const results = await Promise.allSettled(promises);
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    servers.push({
                        ip: `${baseIP}${index + 1}`,
                        name: `Server ${index + 1}`,
                        status: 'online'
                    });
                }
            });
            
            if (servers.length > 0) {
                this.displayDiscoveredServers(servers);
            } else {
                serversList.innerHTML = '<div class="loading">Hiç server bulunamadı</div>';
            }
        } catch (error) {
            serversList.innerHTML = '<div class="loading">Arama hatası</div>';
        }
    }

    async checkServerAtIP(ip, port) {
        try {
            const response = await fetch(`http://${ip}:${port}/api/health`, {
                timeout: 2000
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    displayDiscoveredServers(servers) {
        const serversList = document.getElementById('discoveredServersList');
        serversList.innerHTML = '';
        
        servers.forEach(server => {
            const serverItem = document.createElement('div');
            serverItem.className = 'server-item';
            serverItem.innerHTML = `
                <div class="server-info">
                    <div class="server-name">${server.name}</div>
                    <div class="server-ip">${server.ip}:3000</div>
                </div>
                <div class="server-status-badge ${server.status}">${server.status}</div>
            `;
            
            serverItem.addEventListener('click', () => {
                document.getElementById('serverIP').value = server.ip;
                document.getElementById('serverPort').value = '3000';
            });
            
            serversList.appendChild(serverItem);
        });
    }

    showToast(message, type = 'info') {
        // Toast notification göster
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Global değişken
let simpleDashboard;

// Dashboard'ı başlat
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM yüklendi, SimpleDashboard başlatılıyor...');
    try {
        simpleDashboard = new SimpleDashboard();
        console.log('✅ SimpleDashboard başarıyla oluşturuldu');
    } catch (error) {
        console.error('❌ SimpleDashboard oluşturulurken hata:', error);
    }
});