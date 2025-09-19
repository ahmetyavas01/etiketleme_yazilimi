const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.init();
    }

    init() {
        const dbPath = path.join(__dirname, 'database.sqlite');
        
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err.message);
            } else {
                console.log('✅ SQLite veritabanına bağlandı');
                this.optimizeDatabase();
                this.createTables();
            }
        });
    }
    
    // Database optimizations
    optimizeDatabase() {
        // WAL mode for better concurrency
        this.db.run("PRAGMA journal_mode = WAL");
        
        // Optimize for performance
        this.db.run("PRAGMA synchronous = NORMAL");
        this.db.run("PRAGMA cache_size = 10000");
        this.db.run("PRAGMA temp_store = memory");
        this.db.run("PRAGMA mmap_size = 268435456"); // 256MB
        
        console.log('✅ Database optimized for performance');
    }

    createTables() {
        try {
            // Kullanıcılar tablosu
            this.db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            )`);

            // Projeler tablosu
            this.db.run(`CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                folder_path TEXT NOT NULL,
                current_image_index INTEGER DEFAULT 0,
                total_images INTEGER DEFAULT 0,
                data TEXT,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )`);

            // Mevcut tabloya data kolonu ekle (eğer yoksa)
            this.db.run(`ALTER TABLE projects ADD COLUMN data TEXT`, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                    console.error('❌ Data kolonu eklenirken hata:', err.message);
                }
            });

            // Fotoğraflar tablosu
            this.db.run(`CREATE TABLE IF NOT EXISTS images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_size INTEGER,
                file_extension TEXT,
                sort_order INTEGER DEFAULT 0,
                width INTEGER,
                height INTEGER,
                is_labeled BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )`);

            // Etiketler tablosu
            this.db.run(`CREATE TABLE IF NOT EXISTS labels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_id INTEGER NOT NULL,
                label_name TEXT NOT NULL,
                x INTEGER NOT NULL,
                y INTEGER NOT NULL,
                width INTEGER NOT NULL,
                height INTEGER NOT NULL,
                confidence REAL DEFAULT 1.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
            )`);

            // Varsayılan admin kullanıcısı oluştur
            this.createDefaultAdmin();
            
            console.log('✅ Veritabanı tabloları oluşturuldu');
        } catch (err) {
            console.error('❌ Tablo oluşturma hatası:', err.message);
        }
    }

    createDefaultAdmin() {
        // Admin kullanıcısı var mı kontrol et
        this.db.get("SELECT id FROM users WHERE username = 'admin'", (err, row) => {
            if (err) {
                console.error('❌ Admin kontrol hatası:', err.message);
                return;
            }
            
            if (!row) {
                // Admin kullanıcısı yoksa oluştur
                this.db.run("INSERT INTO users (username, role) VALUES ('admin', 'admin')", (err) => {
                    if (err) {
                        console.error('❌ Admin oluşturma hatası:', err.message);
                    } else {
                        console.log('✅ Varsayılan admin kullanıcısı oluşturuldu');
                    }
                });
            }
        });
    }

    // Async wrapper methods for compatibility
    runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }
    
    getQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }
    
    allQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Kullanıcı işlemleri
    async createUser(username, role = 'user') {
        try {
            const result = await this.runQuery('INSERT INTO users (username, role) VALUES (?, ?)', [username, role]);
            return { id: result.id, username, role };
        } catch (err) {
            throw err;
        }
    }

    async getUserByUsername(username) {
        try {
            return await this.getQuery('SELECT * FROM users WHERE username = ?', [username]);
        } catch (err) {
            throw err;
        }
    }

    async getAllUsers() {
        try {
            return await this.allQuery('SELECT * FROM users ORDER BY created_at DESC');
        } catch (err) {
            throw err;
        }
    }

    // Proje işlemleri
    async createProject(name, description, folderPath, createdBy) {
        try {
            const result = await this.runQuery('INSERT INTO projects (name, description, folder_path, created_by) VALUES (?, ?, ?, ?)', [name, description, folderPath, createdBy]);
            return { id: result.id, name, description, folder_path: folderPath };
        } catch (err) {
            throw err;
        }
    }

    async getAllProjects() {
        try {
            return await this.allQuery(`SELECT p.*, u.username as created_by_name 
                        FROM projects p 
                        LEFT JOIN users u ON p.created_by = u.id 
                        ORDER BY p.created_at DESC`);
        } catch (err) {
            throw err;
        }
    }

    async getProjectById(id) {
        try {
            return await this.getQuery('SELECT * FROM projects WHERE id = ?', [id]);
        } catch (err) {
            throw err;
        }
    }

    async getProject(id) {
        try {
            return await this.getQuery('SELECT * FROM projects WHERE id = ?', [id]);
        } catch (err) {
            throw err;
        }
    }

    async getAllLabels() {
        try {
            const annotations = await this.allQuery('SELECT annotation_data FROM annotations');
            const labels = new Set();
            
            annotations.forEach(annotation => {
                try {
                    const data = JSON.parse(annotation.annotation_data);
                    if (data.annotations && Array.isArray(data.annotations)) {
                        data.annotations.forEach(ann => {
                            if (ann.label && ann.label.trim()) {
                                labels.add(ann.label.trim());
                            }
                        });
                    }
                } catch (e) {
                    // JSON parse hatası, atla
                }
            });
            
            return Array.from(labels).map(label => ({ label }));
        } catch (err) {
            throw err;
        }
    }

    async getImageByFileName(fileName) {
        try {
            return await this.getQuery('SELECT * FROM images WHERE file_name = ?', [fileName]);
        } catch (err) {
            throw err;
        }
    }

    async getImageWeatherFilter(imageId) {
        try {
            return await this.getQuery('SELECT * FROM weather_filters WHERE image_id = ?', [imageId]);
        } catch (err) {
            throw err;
        }
    }

    async getFavoriteLabels(projectId) {
        try {
            return await this.allQuery('SELECT * FROM favorite_labels WHERE project_id = ?', [projectId]);
        } catch (err) {
            throw err;
        }
    }

    async deleteImageAnnotations(imageId) {
        try {
            await this.runQuery('DELETE FROM annotations WHERE image_id = ?', [imageId]);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    async updateImageWeatherFilter(imageId, filterData) {
        try {
            const existing = await this.getQuery('SELECT * FROM weather_filters WHERE image_id = ?', [imageId]);
            if (existing) {
                await this.runQuery('UPDATE weather_filters SET filter_data = ?, updated_at = CURRENT_TIMESTAMP WHERE image_id = ?', [JSON.stringify(filterData), imageId]);
            } else {
                await this.runQuery('INSERT INTO weather_filters (image_id, filter_data, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [imageId, JSON.stringify(filterData)]);
            }
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    async saveImageAnnotations(imageId, annotations) {
        try {
            // Önce mevcut etiketleri sil
            await this.deleteImageAnnotations(imageId);
            
            // Yeni etiketleri kaydet
            for (const annotation of annotations) {
                await this.runQuery('INSERT INTO annotations (image_id, annotation_data, created_by, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [imageId, JSON.stringify(annotation), 1]);
            }
            
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    async updateProjectPosition(projectId, position) {
        try {
            await this.runQuery('UPDATE projects SET current_image_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [position, projectId]);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    async addImageAnnotation(imageId, annotationData, createdBy = 1) {
        try {
            const result = await this.runQuery('INSERT INTO annotations (image_id, annotation_data, created_by, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [imageId, JSON.stringify(annotationData), createdBy]);
            return { id: result.id, success: true };
        } catch (err) {
            throw err;
        }
    }

    // Image işlemleri
    async getImageByPosition(projectId, position) {
        try {
            return await this.getQuery('SELECT * FROM images WHERE project_id = ? ORDER BY sort_order LIMIT 1 OFFSET ?', [projectId, position]);
        } catch (err) {
            throw err;
        }
    }

    async getImageAnnotations(imageId) {
        try {
            return await this.allQuery('SELECT * FROM annotations WHERE image_id = ?', [imageId]);
        } catch (err) {
            throw err;
        }
    }

    async updateImageLabeledStatus(imageId, isLabeled, labeledBy = 1) {
        try {
            await this.runQuery('UPDATE images SET is_labeled = ?, labeled_at = CURRENT_TIMESTAMP, labeled_by = ? WHERE id = ?', [isLabeled ? 1 : 0, labeledBy, imageId]);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    // Weather filter işlemleri
    async createWeatherFilter(imageId, filterData) {
        try {
            await this.runQuery('INSERT INTO weather_filters (image_id, filter_data, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [imageId, JSON.stringify(filterData)]);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    // Favorite labels işlemleri
    async addFavoriteLabel(projectId, userId, labelName) {
        try {
            await this.runQuery('INSERT INTO favorite_labels (project_id, user_id, label_name, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', [projectId, userId, labelName]);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    async removeFavoriteLabel(projectId, userId, labelName) {
        try {
            await this.runQuery('DELETE FROM favorite_labels WHERE project_id = ? AND user_id = ? AND label_name = ?', [projectId, userId, labelName]);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    // Project işlemleri
    async updateProjectData(projectId, data) {
        try {
            await this.runQuery('UPDATE projects SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(data), projectId]);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    async getProjectImages(projectId) {
        try {
            return await this.allQuery('SELECT * FROM images WHERE project_id = ? ORDER BY sort_order', [projectId]);
        } catch (err) {
            throw err;
        }
    }

    // Label işlemleri
    async createLabel(projectId, imageId, labelName, coordinates, createdBy = 1) {
        try {
            const result = await this.runQuery('INSERT INTO labels (project_id, image_id, label_name, coordinates, created_by, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)', [projectId, imageId, labelName, JSON.stringify(coordinates), createdBy]);
            return { id: result.id, success: true };
        } catch (err) {
            throw err;
        }
    }

    async updateLabel(id, labelName, coordinates) {
        try {
            await this.runQuery('UPDATE labels SET label_name = ?, coordinates = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [labelName, JSON.stringify(coordinates), id]);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    async getLabelsByProject(projectId) {
        try {
            return await this.allQuery('SELECT * FROM labels WHERE project_id = ?', [projectId]);
        } catch (err) {
            throw err;
        }
    }

    async getLabelsByImage(imageId) {
        try {
            return await this.allQuery('SELECT * FROM labels WHERE image_id = ?', [imageId]);
        } catch (err) {
            throw err;
        }
    }

    async updateProject(id, data) {
        try {
            await this.runQuery('UPDATE projects SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(data), id]);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    async deleteProject(id) {
        try {
            await this.runQuery('DELETE FROM projects WHERE id = ?', [id]);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    // Fotoğraf işlemleri
    async addImage(projectId, filePath, fileName, fileSize, fileExtension, sortOrder, width, height) {
        try {
            const result = await this.runQuery(
                'INSERT INTO images (project_id, file_path, file_name, file_size, file_extension, sort_order, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [projectId, filePath, fileName, fileSize, fileExtension, sortOrder, width, height]
            );
            return { id: result.id };
        } catch (err) {
            throw err;
        }
    }

    async getImagesByProject(projectId) {
        try {
            return await this.allQuery('SELECT * FROM images WHERE project_id = ? ORDER BY sort_order ASC', [projectId]);
        } catch (err) {
            throw err;
        }
    }

    async getProjectImages(projectId) {
        try {
            return await this.allQuery('SELECT * FROM images WHERE project_id = ? ORDER BY sort_order ASC', [projectId]);
        } catch (err) {
            throw err;
        }
    }

    async getImageById(id) {
        try {
            return await this.getQuery('SELECT * FROM images WHERE id = ?', [id]);
        } catch (err) {
            throw err;
        }
    }

    async getImageByPosition(projectId, position) {
        try {
            return await this.getQuery('SELECT * FROM images WHERE project_id = ? ORDER BY sort_order ASC LIMIT 1 OFFSET ?', [projectId, position]);
        } catch (err) {
            throw err;
        }
    }

    async updateImageLabeledStatus(imageId, isLabeled) {
        try {
            await this.runQuery('UPDATE images SET is_labeled = ? WHERE id = ?', [isLabeled ? 1 : 0, imageId]);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    async updateAllImagesLabeledStatus() {
        try {
            // Tüm fotoğrafların is_labeled durumunu güncelle
            await this.runQuery(`
                UPDATE images 
                SET is_labeled = CASE 
                    WHEN EXISTS (SELECT 1 FROM labels WHERE image_id = images.id) THEN 1 
                    ELSE 0 
                END
            `);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    async updateProjectImageCount(projectId, count) {
        try {
            await this.runQuery('UPDATE projects SET total_images = ? WHERE id = ?', [count, projectId]);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    // Etiket işlemleri
    async addLabel(imageId, labelName, x, y, width, height, confidence = 1.0) {
        try {
            const result = await this.runQuery(
                'INSERT INTO labels (image_id, label_name, x, y, width, height, confidence) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [imageId, labelName, x, y, width, height, confidence]
            );
            return { id: result.id };
        } catch (err) {
            throw err;
        }
    }

    async getLabelsByImage(imageId) {
        try {
            return await this.allQuery('SELECT * FROM labels WHERE image_id = ? ORDER BY created_at ASC', [imageId]);
        } catch (err) {
            throw err;
        }
    }

    async getImageAnnotations(imageId) {
        try {
            return await this.allQuery('SELECT * FROM labels WHERE image_id = ? ORDER BY created_at ASC', [imageId]);
        } catch (err) {
            throw err;
        }
    }

    async getProjectAnnotationStats(projectId) {
        try {
            // Tüm etiketleri al
            const annotations = await this.allQuery(`
                SELECT a.annotation_data
                FROM annotations a
                JOIN images i ON a.image_id = i.id
                WHERE i.project_id = ?
            `, [projectId]);
            
            // Etiketleri say
            const labelCounts = {};
            let totalAnnotations = 0;
            
            annotations.forEach(annotation => {
                try {
                    const data = JSON.parse(annotation.annotation_data);
                    if (data.annotations && Array.isArray(data.annotations)) {
                        data.annotations.forEach(ann => {
                            if (ann.label && ann.label.trim()) {
                                labelCounts[ann.label] = (labelCounts[ann.label] || 0) + 1;
                                totalAnnotations++;
                            }
                        });
                    }
                } catch (e) {
                    // JSON parse hatası, atla
                }
            });
            
            const labelStats = Object.entries(labelCounts).map(([label, count]) => ({
                label,
                count,
                percentage: totalAnnotations > 0 ? ((count / totalAnnotations) * 100).toFixed(2) : 0
            })).sort((a, b) => b.count - a.count);
            
            return {
                totalAnnotations,
                labelStats
            };
        } catch (err) {
            throw err;
        }
    }

    async deleteLabel(id) {
        try {
            await this.runQuery('DELETE FROM labels WHERE id = ?', [id]);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    async deleteLabelsByImage(imageId) {
        try {
            await this.runQuery('DELETE FROM labels WHERE image_id = ?', [imageId]);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    // İstatistikler
    async getProjectStats(projectId) {
        try {
            const stats = await this.getQuery(`
                SELECT 
                    COUNT(i.id) as total_images,
                    COUNT(CASE WHEN i.is_labeled = 1 THEN 1 END) as labeled_images,
                    COUNT(l.id) as total_labels
                FROM images i
                LEFT JOIN labels l ON i.id = l.image_id
                WHERE i.project_id = ?
            `, [projectId]);
            
            return stats;
        } catch (err) {
            throw err;
        }
    }

    async getAllLabelsStats() {
        try {
            return await this.allQuery(`
                SELECT 
                    label_name,
                    COUNT(*) as count,
                    AVG(confidence) as avg_confidence
                FROM labels 
                GROUP BY label_name 
                ORDER BY count DESC
            `);
        } catch (err) {
            throw err;
        }
    }

    // Veritabanını kapat
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('❌ Veritabanı kapatma hatası:', err.message);
                } else {
                    console.log('✅ Veritabanı bağlantısı kapatıldı');
                }
            });
        }
    }
}

module.exports = new DatabaseManager();