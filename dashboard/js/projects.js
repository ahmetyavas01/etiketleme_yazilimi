// Projects Manager
class ProjectsManager {
    constructor(auth) {
        this.baseURL = 'http://' + window.location.hostname + ':3000/api';
        this.auth = auth;
    }

    // Tüm projeleri getir
    async getProjects() {
        try {
            const response = await this.auth.authenticatedRequest(`${this.baseURL}/projects`);
            return await response.json();
        } catch (error) {
            console.error('Projeler alınamadı:', error);
            return [];
        }
    }

    // Yeni proje oluştur
    async createProject(name, description, folderPath) {
        try {
            const response = await this.auth.authenticatedRequest(`${this.baseURL}/projects`, {
                method: 'POST',
                body: JSON.stringify({ 
                    name, 
                    description, 
                    folder_path: folderPath || '',
                    data: { 
                        annotations: [], 
                        settings: {} 
                    } 
                })
            });

            if (response.ok) {
                return { success: true, project: await response.json() };
            } else {
                const error = await response.json();
                return { success: false, error: error.error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Proje güncelle
    async updateProject(projectId, data) {
        try {
            const response = await this.auth.authenticatedRequest(`${this.baseURL}/projects/${projectId}`, {
                method: 'PUT',
                body: JSON.stringify({ data })
            });

            if (response.ok) {
                return { success: true };
            } else {
                const error = await response.json();
                return { success: false, error: error.error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Proje sil
    async deleteProject(projectId) {
        if (!confirm('Bu projeyi silmek istediğinizden emin misiniz?')) {
            return;
        }

        try {
            const response = await this.auth.authenticatedRequest(`${this.baseURL}/projects/${projectId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showMessage('Proje başarıyla silindi', 'success');
                this.updateProjectsTable();
            } else {
                const error = await response.json();
                this.showMessage(error.error, 'error');
            }
        } catch (error) {
            this.showMessage('Proje silinemedi: ' + error.message, 'error');
        }
    }

    // Proje tablosunu güncelle
    async updateProjectsTable() {
        const projects = await this.getProjects();
        const tbody = document.querySelector('#projectsTable tbody');
        
        if (!tbody) return;

        tbody.innerHTML = '';

        if (projects.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Proje bulunamadı</td></tr>';
            return;
        }

        projects.forEach(project => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${project.id}</td>
                <td>${project.name}</td>
                <td>${project.description || '-'}</td>
                <td>${project.created_by_name || '-'}</td>
                <td>${new Date(project.created_at).toLocaleDateString('tr-TR')}</td>
                <td>${new Date(project.updated_at).toLocaleDateString('tr-TR')}</td>
                <td>
                    <button class="btn btn-success btn-sm" onclick="projectsManager.openProject(${project.id})">
                        🏷️ Aç
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="projectsManager.deleteProject(${project.id})">
                        🗑️ Sil
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Projeyi etiketleme uygulamasında aç
    openProject(projectId) {
        // Etiketleme uygulamasını yeni sekmede aç ve proje ID'sini gönder
        const url = `http://${window.location.hostname}:3000/app?project=${projectId}`;
        window.open(url, '_blank');
    }

    // Mesaj göster
    showMessage(message, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }
}

// Global projects manager
const projectsManager = new ProjectsManager(auth);
