const Database = require('better-sqlite3');
const path = require('path');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.init();
    }

    init() {
        const dbPath = path.join(__dirname, 'database.sqlite');
        
        try {
            // Main connection
            this.db = new Database(dbPath);
            console.log('✅ SQLite veritabanına bağlandı');
            this.optimizeDatabase();
            this.createTables();
        } catch (err) {
            console.error('❌ Veritabanı bağlantı hatası:', err.message);
        }
    }
    
    // Database optimizations
    optimizeDatabase() {
        // WAL mode for better concurrency
        this.db.pragma("journal_mode = WAL");
        
        // Optimize for performance
        this.db.pragma("synchronous = NORMAL");
        this.db.pragma("cache_size = 10000");
        this.db.pragma("temp_store = memory");
        this.db.pragma("mmap_size = 268435456"); // 256MB
        
        console.log('✅ Database optimized for performance');
    }
    
    // Better-sqlite3 is synchronous, no need for connection pooling

    createTables() {
        try {
            // Kullanıcılar tablosu
            this.db.exec(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            )`);

            // Projeler tablosu
            this.db.exec(`CREATE TABLE IF NOT EXISTS projects (
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
            try {
                this.db.exec(`ALTER TABLE projects ADD COLUMN data TEXT`);
                console.log('✅ Data kolonu eklendi');
            } catch (err) {
                if (!err.message.includes('duplicate column name')) {
                    console.error('❌ Data kolonu eklenirken hata:', err.message);
                }
            }

            // Fotoğraflar tablosu
            this.db.exec(`CREATE TABLE IF NOT EXISTS images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_size INTEGER,
                file_extension TEXT,
                sort_order INTEGER NOT NULL,
                is_labeled BOOLEAN DEFAULT 0,
                labeled_at DATETIME,
                labeled_by INTEGER,
                width INTEGER,
                height INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (labeled_by) REFERENCES users(id)
            )`);

            // Etiketler tablosu
            this.db.exec(`CREATE TABLE IF NOT EXISTS annotations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_id INTEGER NOT NULL,
                annotation_data TEXT NOT NULL,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )`);

            // Veritabanı migration'ları
            this.runMigrations();
            
            // İlk admin kullanıcısını oluştur
            this.createDefaultAdmin();
            
            console.log('✅ Tablolar oluşturuldu');
        } catch (err) {
            console.error('❌ Tablo oluşturma hatası:', err.message);
        }
    }

    // Veritabanı migration'ları
    runMigrations() {
        // width ve height kolonlarını ekle (eğer yoksa)
        try {
            this.db.exec(`ALTER TABLE images ADD COLUMN width INTEGER`);
            console.log('✅ width kolonu eklendi');
        } catch (err) {
            if (!err.message.includes('duplicate column name')) {
                console.error('❌ width kolonu eklenirken hata:', err.message);
            }
        }
        
        try {
            this.db.exec(`ALTER TABLE images ADD COLUMN height INTEGER`);
            console.log('✅ height kolonu eklendi');
        } catch (err) {
            if (!err.message.includes('duplicate column name')) {
                console.error('❌ height kolonu eklenirken hata:', err.message);
            }
        }
    }

    createDefaultAdmin() {
        try {
            const row = this.db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
            if (!row) {
                this.db.prepare('INSERT INTO users (username, role) VALUES (?, ?)').run('admin', 'admin');
                console.log('✅ Varsayılan admin kullanıcısı oluşturuldu (admin)');
            }
        } catch (err) {
            console.error('❌ Admin kullanıcısı oluşturulamadı:', err);
        }
    }

    // Kullanıcı işlemleri
    createUser(username, role = 'user') {
        return new Promise((resolve, reject) => {
            this.db.run('INSERT INTO users (username, role) VALUES (?, ?)', 
                [username, role], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, username, role });
                }
            });
        });
    }

    getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    getAllUsers() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT id, username, role, created_at, last_login FROM users ORDER BY created_at DESC', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Proje işlemleri
    createProject(name, description, folderPath, createdBy) {
        return new Promise((resolve, reject) => {
            this.db.run('INSERT INTO projects (name, description, folder_path, created_by) VALUES (?, ?, ?, ?)', 
                [name, description, folderPath, createdBy], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, name, description, folder_path: folderPath });
                }
            });
        });
    }

    getAllProjects() {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT p.*, u.username as created_by_name 
                        FROM projects p 
                        LEFT JOIN users u ON p.created_by = u.id 
                        ORDER BY p.updated_at DESC`, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    getProject(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM projects WHERE id = ?', [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    updateProject(id, data) {
        return new Promise((resolve, reject) => {
            console.log('🗄️ Database güncelleme başlıyor:', id);
            
            const jsonData = JSON.stringify(data);
            console.log('📦 JSON boyutu:', jsonData.length, 'karakter');
            
            this.db.run('UPDATE projects SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
                [jsonData, id], function(err) {
                if (err) {
                    console.error('❌ Database hatası:', err);
                    reject(err);
                } else {
                    console.log('✅ Database güncellendi:', id, 'Değişen satır:', this.changes);
                    resolve({ message: 'Proje güncellendi' });
                }
            });
        });
    }

    // Proje mevcut pozisyonunu güncelle
    updateProjectPosition(projectId, currentIndex) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE projects SET current_image_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
                [currentIndex, projectId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ message: 'Pozisyon güncellendi' });
                }
            });
        });
    }

    deleteProject(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM projects WHERE id = ?', [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ message: 'Proje silindi' });
                }
            });
        });
    }

    // Fotoğraf işlemleri
    addImage(projectId, filePath, fileName, fileSize, fileExtension, sortOrder, width = null, height = null) {
        return new Promise((resolve, reject) => {
            this.db.run('INSERT INTO images (project_id, file_path, file_name, file_size, file_extension, sort_order, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
                [projectId, filePath, fileName, fileSize, fileExtension, sortOrder, width, height], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, file_path: filePath, file_name: fileName });
                }
            });
        });
    }

    // Projeye ait tüm fotoğrafları getir
    getProjectImages(projectId) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM images WHERE project_id = ? ORDER BY sort_order ASC', [projectId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // is_labeled -> isLabeled (camelCase) dönüşümü
                    const formattedRows = rows.map(row => ({
                        ...row,
                        isLabeled: row.is_labeled,
                        fileName: row.file_name
                    }));
                    resolve(formattedRows);
                }
            });
        });
    }

    // Belirli bir fotoğrafı getir
    getImageById(imageId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM images WHERE id = ?', [imageId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Proje pozisyonuna göre fotoğraf getir
    getImageByPosition(projectId, position) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM images WHERE project_id = ? ORDER BY sort_order ASC LIMIT 1 OFFSET ?', 
                [projectId, position], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // ID'ye göre fotoğraf getir
    getImageById(imageId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM images WHERE id = ?', [imageId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Dosya adına göre fotoğraf getir
    getImageByFileName(fileName) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM images WHERE file_name = ?', [fileName], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Fotoğrafı etiketli olarak işaretle
    markImageAsLabeled(imageId, labeledBy) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE images SET is_labeled = 1, labeled_at = CURRENT_TIMESTAMP, labeled_by = ? WHERE id = ?', 
                [labeledBy, imageId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ message: 'Fotoğraf etiketli olarak işaretlendi' });
                }
            });
        });
    }

    // Fotoğrafı etiketlenmemiş olarak işaretle
    markImageAsUnlabeled(imageId) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE images SET is_labeled = 0, labeled_at = NULL, labeled_by = NULL WHERE id = ?', 
                [imageId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ message: 'Fotoğraf etiketlenmemiş olarak işaretlendi' });
                }
            });
        });
    }

    // Proje toplam fotoğraf sayısını güncelle
    updateProjectImageCount(projectId, totalImages) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE projects SET total_images = ? WHERE id = ?', 
                [totalImages, projectId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ message: 'Fotoğraf sayısı güncellendi' });
                }
            });
        });
    }

    // Etiket işlemleri
    saveAnnotation(imageId, annotationData, createdBy) {
        return new Promise((resolve, reject) => {
            this.db.run('INSERT INTO annotations (image_id, annotation_data, created_by) VALUES (?, ?, ?)', 
                [imageId, JSON.stringify(annotationData), createdBy], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, annotation_data: annotationData });
                }
            });
        });
    }

    // Fotoğrafa ait etiketleri getir
    getImageAnnotations(imageId) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM annotations WHERE image_id = ? ORDER BY created_at DESC', [imageId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const annotations = rows.map(row => ({
                        ...row,
                        annotation_data: JSON.parse(row.annotation_data)
                    }));
                    resolve(annotations);
                }
            });
        });
    }

    // Tüm fotoğrafları getir
    getAllImages() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM images ORDER BY id ASC', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Fotoğraf boyutlarını güncelle
    updateImageDimensions(imageId, width, height) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE images SET width = ?, height = ? WHERE id = ?', 
                [width, height, imageId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // Belirli bir fotoğrafa etiket ekle
    addImageAnnotation(imageId, annotationData) {
        return new Promise((resolve, reject) => {
            const annotationDataStr = typeof annotationData === 'string' 
                ? annotationData 
                : JSON.stringify(annotationData);
            
            this.db.run(
                'INSERT INTO annotations (image_id, annotation_data, created_by, created_at) VALUES (?, ?, ?, ?)',
                [imageId, annotationDataStr, 1, new Date().toISOString()],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    // Belirli bir fotoğrafın tüm etiketlerini sil
    deleteImageAnnotations(imageId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM annotations WHERE image_id = ?', [imageId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // Belirli bir fotoğrafı sil
    deleteImage(imageId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM images WHERE id = ?', [imageId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // Tüm projeler için etiket istatistikleri
    getAllAnnotationStats() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    a.annotation_data,
                    p.name as project_name,
                    p.id as project_id,
                    u.username as created_by_name,
                    a.created_at
                FROM annotations a
                JOIN images i ON a.image_id = i.id
                JOIN projects p ON i.project_id = p.id
                JOIN users u ON a.created_by = u.id
                ORDER BY a.created_at DESC
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const annotations = rows.map(row => ({
                        ...row,
                        annotation_data: JSON.parse(row.annotation_data)
                    }));
                    resolve(annotations);
                }
            });
        });
    }

    // Proje bazında etiket istatistikleri
    getProjectAnnotationStats(projectId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    a.annotation_data,
                    a.created_at,
                    u.username as created_by_name
                FROM annotations a
                JOIN images i ON a.image_id = i.id
                JOIN users u ON a.created_by = u.id
                WHERE i.project_id = ?
                ORDER BY a.created_at DESC
            `, [projectId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const annotations = rows.map(row => ({
                        ...row,
                        annotation_data: JSON.parse(row.annotation_data)
                    }));
                    resolve(annotations);
                }
            });
        });
    }

    // Etiket sayıları ve oranları
    getLabelStatistics() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    a.annotation_data,
                    p.name as project_name,
                    p.id as project_id
                FROM annotations a
                JOIN images i ON a.image_id = i.id
                JOIN projects p ON i.project_id = p.id
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const annotations = rows.map(row => ({
                        ...row,
                        annotation_data: JSON.parse(row.annotation_data)
                    }));
                    resolve(annotations);
                }
            });
        });
    }

    // Kullanıcı bazında etiket istatistikleri
    getUserAnnotationStats() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    u.username,
                    u.id as user_id,
                    COUNT(a.id) as total_annotations,
                    COUNT(DISTINCT i.project_id) as projects_worked,
                    COUNT(DISTINCT i.id) as images_labeled,
                    MIN(a.created_at) as first_annotation,
                    MAX(a.created_at) as last_annotation
                FROM users u
                LEFT JOIN annotations a ON u.id = a.created_by
                LEFT JOIN images i ON a.image_id = i.id
                GROUP BY u.id, u.username
                ORDER BY total_annotations DESC
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Tek bir etiket güncelle
    updateAnnotation(annotationId, annotationData) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE annotations 
                 SET annotation_data = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [JSON.stringify(annotationData), annotationId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes);
                    }
                }
            );
        });
    }

    // Tek bir etiket sil
    deleteAnnotation(annotationId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM annotations WHERE id = ?',
                [annotationId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes);
                    }
                }
            );
        });
    }

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

    // Fotoğrafın is_labeled durumunu güncelle
    async updateImageLabeledStatus(imageId, isLabeled) {
        return new Promise((resolve, reject) => {
            const sql = 'UPDATE images SET is_labeled = ? WHERE id = ?';
            this.db.run(sql, [isLabeled, imageId], function(err) {
                if (err) {
                    console.error('❌ is_labeled durumu güncellenirken hata:', err);
                    reject(err);
                } else {
                    console.log(`✅ Fotoğraf ${imageId} is_labeled durumu güncellendi: ${isLabeled}`);
                    resolve(this.changes);
                }
            });
        });
    }

    // Tüm fotoğrafların is_labeled durumunu güncelle
    async updateAllImagesLabeledStatus() {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE images 
                SET is_labeled = CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM annotations 
                        WHERE annotations.image_id = images.id
                    ) THEN 1 
                    ELSE 0 
                END
            `;
            this.db.run(sql, [], function(err) {
                if (err) {
                    console.error('❌ Tüm fotoğrafların is_labeled durumu güncellenirken hata:', err);
                    reject(err);
                } else {
                    console.log(`✅ ${this.changes} fotoğrafın is_labeled durumu güncellendi`);
                    resolve(this.changes);
                }
            });
        });
    }

    // Proje için tüm annotation'ları getir (export için optimize edilmiş)
    getProjectAnnotations(projectId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    a.id,
                    a.image_id,
                    a.annotation_data,
                    a.created_at,
                    a.updated_at
                FROM annotations a
                JOIN images i ON a.image_id = i.id
                WHERE i.project_id = ?
                ORDER BY i.sort_order ASC, a.created_at ASC
            `, [projectId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const annotations = rows.map(row => ({
                        ...row,
                        annotation_data: JSON.parse(row.annotation_data)
                    }));
                    resolve(annotations);
                }
            });
        });
    }
}

module.exports = new DatabaseManager();
