// Users Manager
class UsersManager {
    constructor(auth) {
        this.baseURL = 'http://' + window.location.hostname + ':3000/api';
        this.auth = auth;
    }

    // Tüm kullanıcıları getir
    async getUsers() {
        try {
            const response = await this.auth.authenticatedRequest(`${this.baseURL}/users`);
            return await response.json();
        } catch (error) {
            console.error('Kullanıcılar alınamadı:', error);
            return [];
        }
    }

    // Yeni kullanıcı oluştur
    async createUser(username, role) {
        try {
            const response = await this.auth.authenticatedRequest(`${this.baseURL}/users`, {
                method: 'POST',
                body: JSON.stringify({ username, role })
            });

            if (response.ok) {
                return { success: true, user: await response.json() };
            } else {
                const error = await response.json();
                return { success: false, error: error.error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Kullanıcı tablosunu güncelle
    async updateUsersTable() {
        const users = await this.getUsers();
        const tbody = document.querySelector('#usersTable tbody');
        
        if (!tbody) return;

        tbody.innerHTML = '';

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Kullanıcı bulunamadı</td></tr>';
            return;
        }

        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>
                    <span class="role-badge ${user.role}">${user.role}</span>
                </td>
                <td>${new Date(user.created_at).toLocaleDateString('tr-TR')}</td>
                <td>${user.last_login ? new Date(user.last_login).toLocaleDateString('tr-TR') : 'Hiç giriş yapmamış'}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="usersManager.deleteUser(${user.id})" 
                            ${user.role === 'admin' ? 'disabled' : ''}>
                        🗑️ Sil
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Kullanıcı sil
    async deleteUser(userId) {
        if (!confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) {
            return;
        }

        try {
            const response = await this.auth.authenticatedRequest(`${this.baseURL}/users/${userId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showMessage('Kullanıcı başarıyla silindi', 'success');
                this.updateUsersTable();
            } else {
                const error = await response.json();
                this.showMessage(error.error, 'error');
            }
        } catch (error) {
            this.showMessage('Kullanıcı silinemedi: ' + error.message, 'error');
        }
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

// Global users manager
const usersManager = new UsersManager(auth);
