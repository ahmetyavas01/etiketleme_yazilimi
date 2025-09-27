const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const database = require('./database-simple');
const auth = require('./auth');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = 3000;

// Multer konfigürasyonu
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadsDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Orijinal dosya adını koru ama güvenli hale getir
        const timestamp = Date.now();
        const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${timestamp}_${originalName}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        // Sadece resim dosyalarını kabul et
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Sadece resim dosyaları kabul edilir!'), false);
        }
    }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // JSON limitini 50MB'a çıkar

// Health check endpoint
app.get('/api/health', (req, res) => {
    // Gerçek IP adresini al
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    let serverIP = 'localhost';
    
    // En uygun IP adresini bul (localhost olmayan)
    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            if (iface.family === 'IPv4' && !iface.internal) {
                serverIP = iface.address;
                break;
            }
        }
        if (serverIP !== 'localhost') break;
    }
    
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        message: 'Etiketleme Sistemi Server çalışıyor',
        ip: serverIP
    });
});

// Server başlatma endpoint'i
app.post('/api/server/start', (req, res) => {
    console.log('🚀 Dashboard\'dan server başlatma isteği alındı');
    
    try {
        const { spawn } = require('child_process');
        const path = require('path');
        const os = require('os');
        
        // Server'ın zaten çalışıp çalışmadığını kontrol et
        const isRunning = process.uptime() > 0;
        
        if (isRunning) {
            return res.json({
                success: true,
                message: 'Server zaten çalışıyor',
                alreadyRunning: true
            });
        }
        
        // Platform'a göre server başlatma script'ini seç
        let startScript;
        if (os.platform() === 'win32') {
            // Windows için batch script
            startScript = path.join(__dirname, '../scripts/start-server.bat');
        } else {
            // Mac/Linux için shell script
            startScript = path.join(__dirname, '../scripts/start-server.sh');
        }
        
        console.log('📜 Server başlatma script\'i:', startScript);
        
        // Server başlatma script'ini çalıştır
        let serverProcess;
        if (os.platform() === 'win32') {
            serverProcess = spawn('cmd', ['/c', startScript], {
                detached: true,
                stdio: 'ignore',
                cwd: path.join(__dirname, '..')
            });
        } else {
            serverProcess = spawn('bash', [startScript], {
                detached: true,
                stdio: 'ignore',
                cwd: path.join(__dirname, '..')
            });
        }
        
        serverProcess.unref();
        
        console.log('✅ Server başlatma script\'i çalıştırıldı, PID:', serverProcess.pid);
        
        res.json({
            success: true,
            message: 'Server başlatma script\'i çalıştırıldı',
            pid: serverProcess.pid,
            platform: os.platform()
        });
        
    } catch (error) {
        console.error('❌ Server başlatma hatası:', error);
        res.status(500).json({
            success: false,
            error: 'Server başlatılamadı: ' + error.message
        });
    }
});

// Static files
app.use('/dashboard', express.static(path.join(__dirname, '../dashboard')));
app.use('/app', express.static(path.join(__dirname, '../labeling-app')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Sadece orijinal path'leri serve et - uploads klasörü yok

// CORS preflight için OPTIONS request'i handle et
app.options('/api/files/*', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
});

// Orijinal dosya path'lerini serve et (fallback)
app.get('/api/files/*', async (req, res) => {
    try {
        // URL'den dosya path'ini al
        const filePath = req.params[0]; // * wildcard'dan gelen path
        const fileName = decodeURIComponent(filePath);
        
        console.log('📁 Dosya isteniyor:', fileName);
        
        // Önce veritabanından dosyayı bul ve doğrudan file_path'i kullan
        let foundPath = null;
        
        try {
            // Dosyayı veritabanında ara
            const image = await database.getImageByFileName(fileName);
            if (image && image.file_path) {
                // Göreli path'i mutlak path'e dönüştür
                let absoluteFilePath = image.file_path;
                if (image.file_path.startsWith('~')) {
                    const os = require('os');
                    absoluteFilePath = path.join(os.homedir(), image.file_path.substring(2));
                } else if (!path.isAbsolute(image.file_path)) {
                    absoluteFilePath = path.join(process.cwd(), image.file_path);
                }
                
                console.log('🔍 Veritabanından dosya yolu alındı:', image.file_path);
                console.log('🔍 Mutlak path:', absoluteFilePath);
                
                if (fs.existsSync(absoluteFilePath)) {
                    console.log('✅ Dosya veritabanı yolunda bulundu:', absoluteFilePath);
                    foundPath = absoluteFilePath;
                } else {
                    console.log('⚠️ Dosya veritabanı yolunda bulunamadı, fallback klasörlerde arayacak:', absoluteFilePath);
                }
            }
        } catch (dbError) {
            console.log('⚠️ Veritabanı hatası, fallback klasörlerde arayacak:', dbError.message);
        }
        
        // Eğer veritabanı yolunda bulunamadıysa, fallback klasörlerde ara
        if (!foundPath) {
            const searchPaths = [
                path.join(__dirname, '../uploads', fileName),
                path.join(__dirname, '../plaka_deneme/images/train', fileName),
                path.join(__dirname, '../plaka_deneme/images/val', fileName)
            ];
            
            for (const searchPath of searchPaths) {
                console.log('🔍 Fallback klasörde arıyor:', searchPath);
                if (fs.existsSync(searchPath)) {
                    console.log('✅ Fallback klasörde bulundu:', searchPath);
                    foundPath = searchPath;
                    break;
                }
            }
        }
        
        if (!foundPath) {
            console.log('❌ Dosya hiçbir klasörde bulunamadı:', fileName);
            return res.status(404).json({ error: 'Dosya bulunamadı' });
        }
        
        // Dosya istatistiklerini al
        const stats = fs.statSync(foundPath);
        if (!stats.isFile()) {
            console.log('❌ Geçersiz dosya:', foundPath);
            return res.status(400).json({ error: 'Geçersiz dosya' });
        }
        
        // MIME type belirle
        const ext = path.extname(foundPath).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp'
        };
        
        const mimeType = mimeTypes[ext] || 'application/octet-stream';
        
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        // Content-Type header'ını set et
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', stats.size);
        
        // Dosyayı stream et
        const fileStream = fs.createReadStream(foundPath);
        fileStream.pipe(res);
        
        console.log('✅ Dosya serve edildi:', foundPath);
        
    } catch (error) {
        console.error('❌ Dosya serve hatası:', error);
        res.status(500).json({ error: 'Dosya okuma hatası' });
    }
});

// File Upload Route (multer middleware önce çalışmalı)
app.post('/api/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Dosya yüklenmedi' });
        }
        
        const fileInfo = {
            fileName: req.file.originalname,
            savedName: req.file.filename,
            filePath: `/uploads/${req.file.filename}`,
            fullPath: req.file.path,
            size: req.file.size,
            mimeType: req.file.mimetype,
            uploadedAt: new Date().toISOString(),
            uploadedBy: 'system'
        };
        
        console.log('📤 Dosya yüklendi:', fileInfo);
        
        res.json({
            success: true,
            message: 'Dosya başarıyla yüklendi',
            file: fileInfo
        });
        
    } catch (error) {
        console.error('❌ Dosya yükleme hatası:', error);
        res.status(500).json({ error: 'Dosya yükleme hatası: ' + error.message });
    }
});

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
    const { username } = req.body;
    
    if (!username) {
        return res.status(400).json({ error: 'Kullanıcı adı gerekli' });
    }

    const result = await auth.login(username);
    if (result.success) {
        res.json(result);
    } else {
        res.status(401).json(result);
    }
});

// User Management Routes (Admin only)
app.get('/api/users', async (req, res) => {
    const result = await auth.getAllUsers();
    if (result.success) {
        res.json(result.users);
    } else {
        res.status(500).json({ error: result.error });
    }
});

app.post('/api/users', async (req, res) => {
    const { username, role } = req.body;
    
    if (!username) {
        return res.status(400).json({ error: 'Kullanıcı adı gerekli' });
    }

    const result = await auth.createUser(username, role);
    if (result.success) {
        res.json(result.user);
    } else {
        res.status(400).json({ error: result.error });
    }
});

// Project Routes
app.get('/api/projects', async (req, res) => {
    try {
        const projects = await database.getAllProjects();
        
        // Her proje için etiket sayısını hesapla
        const projectsWithStats = await Promise.all(
            projects.map(async (project) => {
                try {
                    const stats = await database.getProjectAnnotationStats(project.id);
                    return {
                        ...project,
                        labelCount: stats.totalAnnotations || 0
                    };
                } catch (error) {
                    console.error(`Proje ${project.id} etiket sayısı hesaplanamadı:`, error);
                    return {
                        ...project,
                        labelCount: 0
                    };
                }
            })
        );
        
        res.json(projectsWithStats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Basit proje özeti
app.get('/api/projects/summary', async (req, res) => {
    try {
        console.log('📊 Proje özeti endpoint çağrıldı');
        const projects = await database.getAllProjects();
        console.log('📊 Projeler alındı:', projects.length);
        
        // Her proje için etiket sayısını hesapla
        const projectSummaries = await Promise.all(
            projects.map(async (project) => {
                try {
                    // Proje için annotation istatistikleri al
                    const annotations = await database.getProjectAnnotationStats(project.id);
                    
                    let labelCount = 0;
                    if (annotations && annotations.length > 0) {
                        annotations.forEach(annotation => {
                            if (annotation.annotation_data && annotation.annotation_data.annotations) {
                                labelCount += annotation.annotation_data.annotations.length;
                            }
                        });
                    }
                    
                    return {
                        id: project.id,
                        name: project.name,
                        labelCount: labelCount,
                        totalImages: project.total_images || 0,
                        description: project.description
                    };
                } catch (error) {
                    console.error(`❌ Proje ${project.id} özeti alınırken hata:`, error);
                    return {
                        id: project.id,
                        name: project.name,
                        labelCount: 0,
                        totalImages: project.total_images || 0,
                        description: project.description
                    };
                }
            })
        );
        
        console.log('📊 Özet hazırlandı:', projectSummaries.length);
        res.json(projectSummaries);
    } catch (error) {
        console.error('❌ Proje özeti hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Etiket analizi endpoint'i
app.get('/api/analytics/labels', async (req, res) => {
    try {
        console.log('📊 Etiket analizi endpoint çağrıldı');
        const projects = await database.getAllProjects();
        
        let totalLabels = 0;
        const projectAnalytics = [];
        
        for (const project of projects) {
            const images = await database.getProjectImages(project.id);
            const projectData = {
                id: project.id,
                name: project.name,
                totalImages: images.length,
                images: []
            };
            
            for (const image of images) {
                try {
                    const annotations = await database.getImageAnnotations(image.id);
                    const imageData = {
                        id: image.id,
                        fileName: image.file_path.split('/').pop(),
                        filePath: image.file_path,
                        isLabeled: image.is_labeled,
                        annotations: []
                    };
                    
                    if (annotations && annotations.length > 0) {
                        annotations.forEach(annotation => {
                            try {
                                if (annotation.annotation_data && annotation.annotation_data.annotations) {
                                    annotation.annotation_data.annotations.forEach(ann => {
                                        const label = ann.label || 'Unknown';
                                        imageData.annotations.push({
                                            label: label,
                                            coordinates: ann.coordinates
                                        });
                                        totalLabels++;
                                    });
                                }
                            } catch (error) {
                                console.error(`❌ Annotation parse hatası (image ${image.id}):`, error);
                            }
                        });
                    }
                    
                    projectData.images.push(imageData);
                } catch (error) {
                    console.error(`❌ Image annotations hatası (image ${image.id}):`, error);
                    // Hata olsa bile boş image data ekle
                    projectData.images.push({
                        id: image.id,
                        fileName: image.file_path.split('/').pop(),
                        filePath: image.file_path,
                        isLabeled: image.is_labeled,
                        annotations: []
                    });
                }
            }
            
            projectAnalytics.push(projectData);
        }
        
        // Genel etiket istatistikleri
        const labelCounts = {};
        projectAnalytics.forEach(project => {
            project.images.forEach(image => {
                image.annotations.forEach(annotation => {
                    const label = annotation.label;
                    labelCounts[label] = (labelCounts[label] || 0) + 1;
                });
            });
        });
        
        const labelStats = Object.entries(labelCounts).map(([label, count]) => ({
            label: label,
            count: count,
            percentage: totalLabels > 0 ? Math.round((count / totalLabels) * 100) : 0
        })).sort((a, b) => b.count - a.count);
        
        console.log('📊 Analytics response:', {
            totalLabels,
            labelStatsCount: labelStats.length,
            projectsCount: projectAnalytics.length
        });
        
        res.json({
            totalLabels: totalLabels,
            labelStats: labelStats,
            projects: projectAnalytics
        });
    } catch (error) {
        console.error('❌ Etiket analizi hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/projects/:id', async (req, res) => {
    try {
        const project = await database.getProject(req.params.id);
        if (project) {
            res.json(project);
        } else {
            res.status(404).json({ error: 'Proje bulunamadı' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Proje silme
app.delete('/api/projects/:id', async (req, res) => {
    try {
        const projectId = req.params.id;
        console.log('🗑️ Proje siliniyor:', projectId);
        
        // Önce projenin var olup olmadığını kontrol et
        const project = await database.getProject(projectId);
        if (!project) {
            return res.status(404).json({ error: 'Proje bulunamadı' });
        }
        
        // Projeyi sil (cascade delete ile ilgili tüm veriler silinecek)
        await database.deleteProject(projectId);
        
        console.log('✅ Proje silindi:', project.name);
        res.json({ message: 'Proje başarıyla silindi', projectName: project.name });
    } catch (error) {
        console.error('❌ Proje silme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Tüm fotoğrafların is_labeled durumunu güncelle
app.post('/api/update-labeled-status', async (req, res) => {
    try {
        console.log('🔄 Tüm fotoğrafların is_labeled durumu güncelleniyor...');
        const updatedCount = await database.updateAllImagesLabeledStatus();
        console.log(`✅ ${updatedCount} fotoğrafın is_labeled durumu güncellendi`);
        
        res.json({
            success: true,
            message: `${updatedCount} fotoğrafın is_labeled durumu güncellendi`,
            updatedCount: updatedCount
        });
    } catch (error) {
        console.error('❌ is_labeled durumu güncelleme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/projects', async (req, res) => {
    const { name, description, folder_path } = req.body;
    
    if (!name || !folder_path) {
        return res.status(400).json({ error: 'Proje adı ve klasör yolu gerekli' });
    }

    try {
        console.log('📁 Yeni proje oluşturuluyor:', { name, folder_path });
        
        // Path'i kontrol et ve gerekirse mutlak path'e dönüştür
        let absolutePath = folder_path;
        if (folder_path.startsWith('~')) {
            const os = require('os');
            absolutePath = path.join(os.homedir(), folder_path.substring(2));
        } else if (!path.isAbsolute(folder_path)) {
            // Göreli path ise, mevcut çalışma dizinine göre mutlak path oluştur
            absolutePath = path.resolve(folder_path);
        }
        
        // Projeyi oluştur (tam path ile)
        const project = await database.createProject(name, description, absolutePath, 1); // Admin user ID
        console.log('✅ Proje oluşturuldu:', project.id);
        
        // Klasör yolunu kontrol et
        if (!fs.existsSync(absolutePath)) {
            console.log('⚠️ Klasör bulunamadı, fotoğraf tarama atlandı:', absolutePath);
            return res.json({
                ...project,
                message: 'Proje oluşturuldu, ancak klasör bulunamadı. Fotoğrafları manuel olarak tarayın.',
                imagesScanned: false
            });
        }

        // Desteklenen resim formatları
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'];
        
        // Klasördeki dosyaları oku (mutlak path kullan)
        const files = fs.readdirSync(absolutePath);
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return imageExtensions.includes(ext);
        }).sort(); // Alfabetik sıralama

        console.log(`📸 ${imageFiles.length} resim dosyası bulundu`);

        // Yeni fotoğrafları ekle
        let addedCount = 0;
        for (let i = 0; i < imageFiles.length; i++) {
            const fileName = imageFiles[i];
            const filePath = path.join(absolutePath, fileName);
            const stats = fs.statSync(filePath);
            
            try {
                // Fotoğraf boyutlarını hesapla
                const sharp = require('sharp');
                const metadata = await sharp(filePath).metadata();
                const width = metadata.width;
                const height = metadata.height;
                
                await database.addImage(
                    project.id,
                    filePath,
                    fileName,
                    stats.size,
                    path.extname(fileName).toLowerCase(),
                    i,
                    width,
                    height
                );
                addedCount++;
            } catch (error) {
                console.error(`❌ Fotoğraf eklenemedi: ${fileName}`, error);
            }
        }

        // Proje toplam fotoğraf sayısını güncelle
        await database.updateProjectImageCount(project.id, addedCount);

        // Tüm fotoğrafların is_labeled durumunu güncelle
        await database.updateAllImagesLabeledStatus();
        console.log('✅ Tüm fotoğrafların is_labeled durumu güncellendi');

        console.log(`✅ ${addedCount} fotoğraf projeye eklendi`);

        res.json({
            ...project,
            message: `${addedCount} fotoğraf başarıyla eklendi`,
            imagesScanned: true,
            total_images: addedCount
        });
        
    } catch (error) {
        console.error('❌ Proje oluşturma hatası:', error);
        res.status(400).json({ error: error.message });
    }
});

app.put('/api/projects/:id', async (req, res) => {
    const { data } = req.body;
    
    try {
        console.log('📝 Proje güncelleniyor:', req.params.id);
        console.log('📊 Veri boyutu:', JSON.stringify(data).length, 'karakter');
        console.log('📋 Annotation sayısı:', data.annotations ? data.annotations.length : 0);
        
        const result = await database.updateProject(req.params.id, data);
        console.log('✅ Proje güncellendi:', req.params.id);
        
        // Real-time güncelleme: Proje odasındaki tüm kullanıcılara yeni veriyi broadcast et
        io.to(`project_${req.params.id}`).emit('projectUpdated', {
            projectId: req.params.id,
            data: data,
            updatedBy: 'system',
            timestamp: new Date().toISOString()
        });
        
        res.json(result);
    } catch (error) {
        console.error('❌ Proje güncelleme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    try {
        const result = await database.deleteProject(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fotoğraf tarama ve ekleme endpoint'i
app.post('/api/projects/:id/scan-images', async (req, res) => {
    try {
        const projectId = req.params.id;
        const project = await database.getProject(projectId);
        
        if (!project) {
            return res.status(404).json({ error: 'Proje bulunamadı' });
        }

        const folderPath = project.folder_path;
        
        // Path'i kontrol et ve gerekirse mutlak path'e dönüştür
        let absolutePath = folderPath;
        if (folderPath.startsWith('~')) {
            const os = require('os');
            absolutePath = path.join(os.homedir(), folderPath.substring(2));
        } else if (!path.isAbsolute(folderPath)) {
            // Göreli path ise, mevcut çalışma dizinine göre mutlak path oluştur
            absolutePath = path.resolve(folderPath);
        }
        
        if (!fs.existsSync(absolutePath)) {
            return res.status(400).json({ error: 'Klasör bulunamadı: ' + absolutePath });
        }

        console.log('📁 Klasör taranıyor:', absolutePath);
        
        // Desteklenen resim formatları
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'];
        
        // Klasördeki dosyaları oku
        const files = fs.readdirSync(absolutePath);
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return imageExtensions.includes(ext);
        }).sort(); // Alfabetik sıralama

        console.log(`📸 ${imageFiles.length} resim dosyası bulundu`);

        // Mevcut fotoğrafları temizle
        await database.db.run('DELETE FROM images WHERE project_id = ?', [projectId]);

        // Yeni fotoğrafları ekle
        let addedCount = 0;
        for (let i = 0; i < imageFiles.length; i++) {
            const fileName = imageFiles[i];
            const filePath = path.join(absolutePath, fileName);
            const stats = fs.statSync(filePath);
            
            try {
                await database.addImage(
                    projectId,
                    filePath,
                    fileName,
                    stats.size,
                    path.extname(fileName).toLowerCase(),
                    i
                );
                addedCount++;
            } catch (error) {
                console.error(`❌ Fotoğraf eklenemedi: ${fileName}`, error);
            }
        }

        // Proje toplam fotoğraf sayısını güncelle
        await database.updateProjectImageCount(projectId, addedCount);

        console.log(`✅ ${addedCount} fotoğraf veritabanına eklendi`);

        res.json({
            success: true,
            message: `${addedCount} fotoğraf başarıyla eklendi`,
            total_images: addedCount,
            folder_path: folderPath
        });

    } catch (error) {
        console.error('❌ Fotoğraf tarama hatası:', error);
        res.status(500).json({ error: 'Fotoğraf tarama hatası: ' + error.message });
    }
});

// Proje fotoğraflarını listele
app.get('/api/projects/:id/images', async (req, res) => {
    try {
        const projectId = req.params.id;
        const images = await database.getProjectImages(projectId);
        res.json(images);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mevcut fotoğrafların boyutlarını güncelle
app.post('/api/update-image-dimensions', async (req, res) => {
    try {
        console.log('📏 Fotoğraf boyutları güncelleniyor...');
        
        // Tüm fotoğrafları al
        const images = await database.getAllImages();
        console.log(`📏 ${images.length} fotoğraf bulundu`);
        
        let updatedCount = 0;
        const sharp = require('sharp');
        
        for (const image of images) {
            try {
                // Eğer boyut bilgisi yoksa güncelle
                if (!image.width || !image.height) {
                    const metadata = await sharp(image.file_path).metadata();
                    const width = metadata.width;
                    const height = metadata.height;
                    
                    // Database'de güncelle
                    await database.updateImageDimensions(image.id, width, height);
                    updatedCount++;
                    console.log(`✅ ${image.file_name}: ${width}x${height}`);
                }
            } catch (error) {
                console.error(`❌ ${image.file_name} boyut güncellenemedi:`, error.message);
            }
        }
        
        res.json({
            success: true,
            message: `${updatedCount} fotoğrafın boyutu güncellendi`,
            updatedCount: updatedCount,
            totalImages: images.length
        });
        
    } catch (error) {
        console.error('❌ Boyut güncelleme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Export için optimize edilmiş proje verileri
app.get('/api/projects/:id/export-data', async (req, res) => {
    try {
        const projectId = req.params.id;
        console.log('📊 Export verileri alınıyor, Project ID:', projectId);
        
        // Proje bilgileri
        const project = await database.getProject(projectId);
        if (!project) {
            return res.status(404).json({ error: 'Proje bulunamadı' });
        }
        
        // Tüm resimleri al
        const images = await database.getProjectImages(projectId);
        console.log('📊 Alınan resim sayısı:', images.length);
        
        // Her resim için annotation'ları ayrı ayrı al (normal API'den)
        const annotations = {};
        for (const image of images) {
            try {
                // Normal API'den annotation'ları al
                const imageAnnotations = await database.allQuery(
                    'SELECT * FROM annotations WHERE image_id = ? ORDER BY created_at ASC',
                    [image.id]
                );
                console.log(`🔍 Resim ${image.id} için annotation'lar:`, imageAnnotations ? imageAnnotations.length : 'undefined');
                
                if (imageAnnotations && imageAnnotations.length > 0) {
                    const allAnnotations = [];
                    
                    imageAnnotations.forEach(ann => {
                        // Annotation verilerini parse et
                        let annotationData;
                        try {
                            annotationData = typeof ann.annotation_data === 'string' 
                                ? JSON.parse(ann.annotation_data) 
                                : ann.annotation_data;
                        } catch (error) {
                            console.warn(`Annotation ${ann.id} parse edilemedi:`, error);
                            return;
                        }
                        
                        if (annotationData && annotationData.annotations && annotationData.annotations.length > 0) {
                            // Tüm annotation'ları işle
                            annotationData.annotations.forEach(annData => {
                                console.log('🔍 AnnData:', annData);
                                const result = {
                                    id: annData.id || ann.id, // annotation'ın kendi id'sini kullan
                                    label: annData.label,
                                    label_name: annData.label,
                                    type: annData.type || 'rectangle',
                                    color: annData.color || '#007AFF',
                                    x: parseFloat(annData.x) || 0,
                                    y: parseFloat(annData.y) || 0,
                                    width: parseFloat(annData.width) || 0,
                                    height: parseFloat(annData.height) || 0,
                                    points: (annData.points && Array.isArray(annData.points)) ? 
                                        annData.points.map(point => ({
                                            x: parseFloat(point.x) || 0,
                                            y: parseFloat(point.y) || 0
                                        })) : [],
                                    imageWidth: parseFloat(image.width) || 1280,
                                    imageHeight: parseFloat(image.height) || 720
                                };
                                console.log('🔍 Result:', result);
                                allAnnotations.push(result);
                            });
                        }
                    });
                    
                    annotations[image.id] = allAnnotations;
                } else {
                    annotations[image.id] = [];
                }
            } catch (error) {
                console.error(`Resim ${image.id} annotation'ları alınamadı:`, error);
                annotations[image.id] = [];
            }
        }
        
        console.log('📊 Toplam annotation sayısı:', Object.values(annotations).flat().length);
        
        // Weather filter bilgilerini al
        const weatherFilters = {};
        for (const image of images) {
            try {
                const filterData = await database.getImageWeatherFilter(image.id);
                if (filterData && filterData.filter_data) {
                    weatherFilters[image.id] = {
                        type: filterData.filter_data.type,
                        data: filterData.filter_data
                    };
                }
            } catch (error) {
                console.warn(`Resim ${image.id} için weather filter alınamadı:`, error);
            }
        }
        
        console.log('🌤️ Weather filter sayısı:', Object.keys(weatherFilters).length);
        
        res.json({
            project: project,
            images: images,
            annotations: annotations,
            weatherFilters: weatherFilters
        });
        
    } catch (error) {
        console.error('❌ Export verileri hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Belirli resim dosyasını getir
app.get('/api/images/:id/file', async (req, res) => {
    try {
        const imageId = req.params.id;
        console.log('📁 Dosya isteniyor:', imageId);
        
        const image = await database.getImageById(imageId);
        if (!image) {
            return res.status(404).json({ error: 'Resim bulunamadı' });
        }
        
        const filePath = image.file_path;
        console.log('📁 Dosya yolu:', filePath);
        
        // Göreli path'i mutlak path'e dönüştür
        let absoluteFilePath = filePath;
        if (filePath.startsWith('~')) {
            const os = require('os');
            absoluteFilePath = path.join(os.homedir(), filePath.substring(2));
        } else if (!path.isAbsolute(filePath)) {
            absoluteFilePath = path.join(process.cwd(), filePath);
        }
        
        console.log('📁 Mutlak dosya yolu:', absoluteFilePath);
        
        // Dosya var mı kontrol et
        if (!fs.existsSync(absoluteFilePath)) {
            console.error('❌ Dosya bulunamadı:', absoluteFilePath);
            return res.status(404).json({ error: 'Dosya bulunamadı' });
        }
        
        // Dosya türünü belirle
        const ext = path.extname(filePath).toLowerCase();
        let contentType = 'image/jpeg';
        
        switch (ext) {
            case '.jpg':
            case '.jpeg':
                contentType = 'image/jpeg';
                break;
            case '.png':
                contentType = 'image/png';
                break;
            case '.gif':
                contentType = 'image/gif';
                break;
            case '.webp':
                contentType = 'image/webp';
                break;
            default:
                contentType = 'application/octet-stream';
        }
        
        console.log('✅ Dosya serve edildi:', absoluteFilePath);
        res.setHeader('Content-Type', contentType);
        res.sendFile(absoluteFilePath);
        
    } catch (error) {
        console.error('❌ Dosya serve hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Belirli pozisyondaki fotoğrafı getir
app.get('/api/projects/:id/images/:position', async (req, res) => {
    try {
        const projectId = req.params.id;
        const position = parseInt(req.params.position);
        
        if (isNaN(position) || position < 0) {
            return res.status(400).json({ error: 'Geçersiz pozisyon' });
        }

        const image = await database.getImageByPosition(projectId, position);
        
        if (!image) {
            return res.status(404).json({ error: 'Fotoğraf bulunamadı' });
        }

        // Fotoğrafın etiketlerini de getir
        const annotations = await database.getImageAnnotations(image.id);

        res.json({
            ...image,
            annotations: annotations
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint - Tüm weather filters'ları listele
app.get('/api/debug/weather-filters', async (req, res) => {
    try {
        console.log('🔍 Debug: Tüm weather filters listeleniyor');
        const allWeatherFilters = await database.allQuery('SELECT * FROM weather_filters ORDER BY created_at DESC');
        console.log(`🔍 Debug: ${allWeatherFilters.length} adet weather filter bulundu`);
        
        const formattedFilters = [];
        allWeatherFilters.forEach(filter => {
            try {
                const filterData = typeof filter.filter_data === 'string' 
                    ? JSON.parse(filter.filter_data) 
                    : filter.filter_data;
                
                formattedFilters.push({
                    id: filter.id,
                    image_id: filter.image_id,
                    created_at: filter.created_at,
                    updated_at: filter.updated_at,
                    filter_data: filterData
                });
            } catch (e) {
                console.error('❌ Debug: Weather filter parse edilemedi:', filter.id);
            }
        });
        
        res.json({
            total: allWeatherFilters.length,
            weatherFilters: formattedFilters
        });
    } catch (error) {
        console.error('❌ Debug weather filters hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint - Tüm annotations'ları listele
app.get('/api/debug/annotations', async (req, res) => {
    try {
        console.log('🔍 Debug: Tüm annotations listeleniyor');
        const allAnnotations = await database.allQuery('SELECT * FROM annotations ORDER BY created_at DESC');
        console.log(`🔍 Debug: ${allAnnotations.length} adet annotation bulundu`);
        
        const formattedAnnotations = [];
        allAnnotations.forEach(annotation => {
            try {
                const annotationData = typeof annotation.annotation_data === 'string' 
                    ? JSON.parse(annotation.annotation_data) 
                    : annotation.annotation_data;
                
                formattedAnnotations.push({
                    id: annotation.id,
                    image_id: annotation.image_id,
                    created_at: annotation.created_at,
                    annotation_data: annotationData
                });
            } catch (e) {
                console.error('❌ Debug: Annotation parse edilemedi:', annotation.id);
            }
        });
        
        res.json({
            total: allAnnotations.length,
            annotations: formattedAnnotations
        });
    } catch (error) {
        console.error('❌ Debug annotations hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Belirli bir fotoğrafın etiketlerini getir (AUTH YOK)
app.get('/api/images/:id/annotations', async (req, res) => {
    try {
        const imageId = req.params.id;
        console.log(`📋 Fotoğraf ${imageId} etiketleri isteniyor`);
        const dbAnnotations = await database.getImageAnnotations(imageId);
        console.log(`📋 Veritabanından ${dbAnnotations.length} adet annotation bulundu`);
        
        // Annotation data'yı parse et ve frontend formatına çevir
        const formattedAnnotations = [];
        
        dbAnnotations.forEach(dbAnnotation => {
            console.log(`📋 DB Annotation ID: ${dbAnnotation.id}, Data:`, dbAnnotation.annotation_data);
            
            try {
                // annotation_data'yı parse et
                const annotationData = typeof dbAnnotation.annotation_data === 'string' 
                    ? JSON.parse(dbAnnotation.annotation_data) 
                    : dbAnnotation.annotation_data;
                
                console.log(`📋 Parsed annotation data:`, annotationData);
                
                // Eğer annotations array'i varsa, her birini ayrı annotation olarak ekle
                if (annotationData && annotationData.annotations && Array.isArray(annotationData.annotations)) {
                    annotationData.annotations.forEach(ann => {
                        formattedAnnotations.push({
                            ...ann,
                            dbId: dbAnnotation.id,
                            created_at: dbAnnotation.created_at,
                            updated_at: dbAnnotation.updated_at
                        });
                    });
                } else if (annotationData && annotationData.label) {
                    // Tek annotation formatı
                    formattedAnnotations.push({
                        ...annotationData,
                        dbId: dbAnnotation.id,
                        created_at: dbAnnotation.created_at,
                        updated_at: dbAnnotation.updated_at
                    });
                }
            } catch (parseError) {
                console.error(`❌ Annotation ${dbAnnotation.id} parse edilemedi:`, parseError);
            }
        });
        
        console.log(`📋 ${formattedAnnotations.length} adet etiket frontend'e gönderiliyor`);
        res.json(formattedAnnotations);
    } catch (error) {
        console.error('❌ Etiket getirme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Belirli bir fotoğrafa etiket ekle (AUTH YOK - BASIT)
app.post('/api/images/:id/annotations', async (req, res) => {
    try {
        const imageId = req.params.id;
        const { annotations } = req.body; // Sadece annotations array'i al
        
        console.log(`📝 Fotoğraf ${imageId} için ${annotations?.length || 0} etiket kaydediliyor`);
        console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
        console.log('📝 Headers:', req.headers);
        
        if (!annotations || !Array.isArray(annotations)) {
            console.log('❌ Annotations array eksik');
            console.log('❌ Gelen data:', req.body);
            return res.status(400).json({ error: 'Annotations array gerekli' });
        }

        // Önce mevcut etiketleri sil
        await database.deleteImageAnnotations(imageId);
        console.log(`🗑️ Fotoğraf ${imageId} mevcut etiketleri silindi`);

        let savedCount = 0;
        // Her etiket için ayrı kaydet - her birinin kendi dbId'si olsun
        if (annotations.length > 0) {
            for (let i = 0; i < annotations.length; i++) {
                const annotation = annotations[i];
                const annotationData = {
                    annotations: [annotation] // Tek etiket kaydet
                };
                
                console.log(`💾 Server: Etiket ${i + 1}/${annotations.length} kaydediliyor:`, annotation.label);
                const annotationId = await database.addImageAnnotation(imageId, annotationData, 1); // user_id = 1
                console.log(`✅ Server: Etiket kaydedildi, ID: ${annotationId.id}`);
                savedCount++;
            }
        }
        
        console.log(`✅ ${savedCount} adet etiket kaydedildi`);
        
        // Fotoğrafın is_labeled durumunu güncelle
        try {
            const isLabeled = savedCount > 0 ? 1 : 0;
            await database.updateImageLabeledStatus(imageId, isLabeled, 1); // labeledBy = 1
            console.log(`📝 Fotoğraf ${imageId} is_labeled durumu güncellendi: ${isLabeled}`);
        } catch (error) {
            console.error('❌ is_labeled durumu güncellenirken hata:', error);
        }
        
        // Real-time güncelleme: Sadece gerçek değişiklik olduğunda dashboard'a bildir
        if (savedCount > 0) {
            // 🆕 Eklenen etiketlerin detaylarını al
            const addedLabels = [];
            annotations.forEach(annotation => {
                if (annotation.label) {
                    addedLabels.push(annotation.label);
                }
            });
            
            io.emit('labelAdded', {
                imageId: imageId,
                savedCount: savedCount,
                addedLabels: addedLabels, // 🆕 Eklenen etiket isimleri
                labelNames: [...new Set(addedLabels)], // 🆕 Benzersiz etiket isimleri
                timestamp: new Date().toISOString()
            });
            console.log(`📡 Dashboard'a etiket eklendi bildirimi gönderildi: ${savedCount} etiket, isimler: ${addedLabels.join(', ')}`);
        } else {
            console.log('📡 Etiket değişikliği yok, WebSocket bildirimi atlandı');
        }
        
        // Proje özetini de güncelle (etiket sayısı için)
        try {
            // Fotoğrafın hangi projeye ait olduğunu bul
            const image = await database.getImageById(imageId);
            if (image && image.project_id) {
                console.log(`📊 Proje ${image.project_id} etiket sayısı güncelleniyor...`);
                // Proje özeti otomatik olarak güncellenecek (database'de trigger var)
            }
        } catch (error) {
            console.error('❌ Proje özeti güncelleme hatası:', error);
        }
        
        res.json({
            success: true,
            saved_count: savedCount,
            message: `${savedCount} etiket kaydedildi`
        });
    } catch (error) {
        console.error('❌ Etiket kaydetme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Belirli bir etiket güncelle
app.put('/api/annotations/:id', async (req, res) => {
    try {
        const annotationId = req.params.id;
        const { annotation_data } = req.body;
        
        if (!annotation_data) {
            return res.status(400).json({ error: 'Etiket verisi gerekli' });
        }

        await database.updateAnnotation(annotationId, annotation_data);
        
        res.json({
            success: true,
            message: 'Etiket güncellendi'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Belirli bir etiket sil
app.delete('/api/annotations/:id', async (req, res) => {
    try {
        const annotationId = req.params.id;
        console.log(`🗑️ API: Annotation siliniyor, ID: ${annotationId}`);
        
        const result = await database.deleteAnnotation(annotationId);
        
        // Etiket bulunamadıysa veya zaten silinmişse
        if (!result.success || result.changes === 0) {
            return res.status(404).json({ error: 'Etiket bulunamadı veya zaten silinmiş' });
        }

        // Silinen etiket ismini al (database'den geldi)
        const deletedLabelName = result.deletedLabelName;

        // 🆕 Real-time güncelleme: Etiket silindi bildirimi
        io.emit('labelDeleted', {
            annotationId: annotationId,
            deletedCount: result.changes,
            deletedLabelName: deletedLabelName, // 🆕 Silinen etiket ismi
            timestamp: new Date().toISOString()
        });
        console.log(`📡 Dashboard'a etiket silindi bildirimi gönderildi: ${result.changes} etiket, isim: ${deletedLabelName || 'Bilinmeyen'}`);
        
        res.json({
            success: true,
            message: 'Etiket silindi',
            changes: result.changes
        });
    } catch (error) {
        console.error('❌ API: Annotation silme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});
// Belirli bir fotoğrafın tüm etiketlerini sil
app.delete('/api/images/:id/annotations', async (req, res) => {
    try {
        const imageId = req.params.id;
        const deletedCount = await database.deleteImageAnnotations(imageId);
        
        // 🆕 Real-time güncelleme: Tüm etiketler silindi bildirimi
        io.emit('labelDeleted', {
            imageId: imageId,
            deletedCount: deletedCount || 0,
            timestamp: new Date().toISOString(),
            allAnnotations: true
        });
        console.log(`📡 Dashboard'a tüm etiketler silindi bildirimi gönderildi: ${deletedCount || 0} etiket`);
        
        res.json({
            success: true,
            message: 'Tüm etiketler silindi',
            deletedCount: deletedCount || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Weather filter endpoint'leri
// Belirli bir fotoğrafın weather filter'ını getir
app.get('/api/images/:id/weather-filter', async (req, res) => {
    try {
        const imageId = req.params.id;
        console.log(`🌤️ Fotoğraf ${imageId} weather filter'ı isteniyor`);
        
        const weatherFilter = await database.getImageWeatherFilter(imageId);
        
        if (weatherFilter) {
            console.log(`✅ Weather filter bulundu:`, weatherFilter.filter_data);
            res.json({
                success: true,
                weatherFilter: weatherFilter
            });
        } else {
            console.log(`ℹ️ Weather filter bulunamadı, varsayılan döndürülüyor`);
            res.json({
                success: true,
                weatherFilter: null,
                message: 'Weather filter bulunamadı'
            });
        }
    } catch (error) {
        console.error('❌ Weather filter getirme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Belirli bir fotoğrafın weather filter'ını kaydet/güncelle
app.post('/api/images/:id/weather-filter', async (req, res) => {
    try {
        const imageId = req.params.id;
        const { filterData, filter_data } = req.body;
        
        // Hem filterData hem de filter_data formatını destekle
        const actualFilterData = filterData || filter_data;
        
        console.log(`🌤️ Fotoğraf ${imageId} için weather filter kaydediliyor:`, actualFilterData);
        
        if (!actualFilterData) {
            console.log('❌ Filter data eksik');
            return res.status(400).json({ error: 'Filter data gerekli' });
        }

        // Weather filter'ı kaydet/güncelle
        const filterId = await database.updateImageWeatherFilter(imageId, actualFilterData, 1); // user_id = 1
        
        console.log(`✅ Weather filter kaydedildi, ID: ${filterId}`);
        
        // 🆕 Real-time güncelleme: Dashboard'a bildir
        io.emit('weatherFiltersUpdated', {
            imageId: imageId,
            filterData: actualFilterData,
            weatherFilters: actualFilterData, // Daha uyumlu format
            timestamp: new Date().toISOString()
        });
        console.log(`📡 Dashboard'a weather filter güncellendi bildirimi gönderildi`);
        
        res.json({
            success: true,
            filterId: filterId,
            message: 'Weather filter başarıyla kaydedildi'
        });
    } catch (error) {
        console.error('❌ Weather filter kaydetme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Belirli bir fotoğrafın weather filter'ını sil
app.delete('/api/images/:id/weather-filter', async (req, res) => {
    try {
        const imageId = req.params.id;
        console.log(`🗑️ Fotoğraf ${imageId} weather filter'ı siliniyor`);
        
        const deletedCount = await database.deleteImageWeatherFilter(imageId);
        
        console.log(`✅ ${deletedCount} weather filter silindi`);

        // 🆕 Real-time güncelleme: Weather filter silindi bildirimi
        io.emit('weatherFiltersUpdated', {
            imageId: imageId,
            deleted: true,
            deletedCount: deletedCount,
            timestamp: new Date().toISOString()
        });
        console.log(`📡 Dashboard'a weather filter silindi bildirimi gönderildi`);
        
        res.json({
            success: true,
            message: 'Weather filter silindi',
            deletedCount: deletedCount
        });
    } catch (error) {
        console.error('❌ Weather filter silme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Favori etiket API'leri
// Projeye favori etiket ekle
app.post('/api/projects/:id/favorite-labels', async (req, res) => {
    try {
        const projectId = req.params.id;
        const { labelName } = req.body;
        const userId = 1; // Şimdilik sabit user_id
        
        console.log(`⭐ Proje ${projectId} için favori etiket ekleniyor: ${labelName}`);
        
        if (!labelName || labelName.trim() === '') {
            return res.status(400).json({ error: 'Etiket adı gerekli' });
        }
        
        const favoriteId = await database.addFavoriteLabel(projectId, userId, labelName.trim());
        
        console.log(`✅ Favori etiket eklendi, ID: ${favoriteId}`);
        
        res.json({
            success: true,
            favoriteId: favoriteId,
            message: 'Favori etiket eklendi'
        });
    } catch (error) {
        console.error('❌ Favori etiket ekleme hatası:', error);
        
        // UNIQUE constraint hatası kontrolü
        if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ 
                error: 'Bu etiket zaten favorilerde!',
                code: 'DUPLICATE_FAVORITE'
            });
        }
        
        res.status(500).json({ error: error.message });
    }
});

// Projenin favori etiketlerini getir
app.get('/api/projects/:id/favorite-labels', async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = 1; // Şimdilik sabit user_id
        
        console.log(`⭐ Proje ${projectId} favori etiketleri getiriliyor`);
        
        const favoriteLabels = await database.getFavoriteLabels(projectId, userId);
        
        console.log(`✅ ${favoriteLabels.length} favori etiket bulundu`);
        
        res.json({
            success: true,
            favoriteLabels: favoriteLabels
        });
    } catch (error) {
        console.error('❌ Favori etiket getirme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Projeden favori etiket sil
app.delete('/api/projects/:id/favorite-labels/:labelName', async (req, res) => {
    try {
        const projectId = req.params.id;
        const labelName = decodeURIComponent(req.params.labelName);
        const userId = 1; // Şimdilik sabit user_id
        
        console.log(`🗑️ Proje ${projectId} favori etiketi siliniyor: ${labelName}`);
        
        const deletedCount = await database.removeFavoriteLabel(projectId, userId, labelName);
        
        console.log(`✅ ${deletedCount} favori etiket silindi`);
        
        res.json({
            success: true,
            message: 'Favori etiket silindi',
            deletedCount: deletedCount
        });
    } catch (error) {
        console.error('❌ Favori etiket silme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Belirli bir fotoğrafı sil (etiketleriyle birlikte)
app.delete('/api/images/:id', async (req, res) => {
    try {
        const imageId = req.params.id;
        
        // Önce etiketleri sil
        await database.deleteImageAnnotations(imageId);
        
        // Sonra fotoğrafı sil
        await database.deleteImage(imageId);
        
        res.json({
            success: true,
            message: 'Fotoğraf ve etiketleri silindi'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Proje detaylı istatistikleri (kullanıcı bazında etiket sayıları için)
app.get('/api/projects/:id/detailed-stats', async (req, res) => {
    try {
        const projectId = req.params.id;
        
        // Proje bilgileri
        const project = await database.getProject(projectId);
        if (!project) {
            return res.status(404).json({ error: 'Proje bulunamadı' });
        }

        // Proje görüntüleri ve etiketleri
        const images = await database.getProjectImages(projectId);
        
        // Her resim için etiket sayısı
        let totalLabels = 0;
        let labeledImages = 0;
        const labelCounts = {};
        
        for (const image of images) {
            const annotations = await database.getImageAnnotations(image.id);
            let imageLabels = 0;
            
            annotations.forEach(annotation => {
                if (annotation.annotation_data && annotation.annotation_data.annotations) {
                    imageLabels += annotation.annotation_data.annotations.length;
                    
                    // Label türlerini say
                    annotation.annotation_data.annotations.forEach(ann => {
                        if (ann.label) {
                            labelCounts[ann.label] = (labelCounts[ann.label] || 0) + 1;
                        }
                    });
                }
            });
            
            totalLabels += imageLabels;
            if (imageLabels > 0) labeledImages++;
        }

        res.json({
            project: {
                id: project.id,
                name: project.name,
                totalImages: images.length,
                labeledImages: labeledImages,
                totalLabels: totalLabels,
                completionRate: images.length > 0 ? Math.round((labeledImages / images.length) * 100) : 0
            },
            labelCounts: labelCounts,
            recentActivity: await database.getProjectAnnotationStats(projectId)
        });
        
    } catch (error) {
        console.error('❌ Proje istatistikleri hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Proje mevcut pozisyonunu güncelle
app.put('/api/projects/:id/position', async (req, res) => {
    try {
        const projectId = req.params.id;
        const { current_index } = req.body;
        
        if (typeof current_index !== 'number' || current_index < 0) {
            return res.status(400).json({ error: 'Geçersiz pozisyon' });
        }

        await database.updateProjectPosition(projectId, current_index);
        
        res.json({
            success: true,
            message: 'Pozisyon güncellendi',
            current_index: current_index
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fotoğrafı etiketli olarak işaretle
app.put('/api/images/:id/mark-labeled', async (req, res) => {
    try {
        const imageId = req.params.id;
        const { annotation_data, label_name, username } = req.body;
        
        console.log('📝 Etiket kaydediliyor:', { imageId, annotation_data, label_name, username });
        
        // Frontend'den gelen annotation_data'yı kullan
        if (annotation_data) {
            // Etiket verilerini kaydet
            await database.saveAnnotation(imageId, annotation_data, 1);
            
            // Fotoğrafı etiketli olarak işaretle
            await database.markImageAsLabeled(imageId, 1);
            
            res.json({
                success: true,
                message: 'Fotoğraf etiketli olarak işaretlendi',
                annotation_data: annotation_data
            });
        } else if (label_name && username) {
            // Eski format için geriye dönük uyumluluk
            const simpleAnnotationData = {
                label: label_name,
                username: username,
                timestamp: new Date().toISOString()
            };
            
            await database.saveAnnotation(imageId, simpleAnnotationData, 1);
            await database.markImageAsLabeled(imageId, 1);
            
            res.json({
                success: true,
                message: 'Fotoğraf etiketli olarak işaretlendi',
                label: label_name
            });
        } else {
            return res.status(400).json({ error: 'Etiket verisi gerekli' });
        }
    } catch (error) {
        console.error('❌ Etiket kaydetme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Fotoğrafı etiketlenmemiş olarak işaretle
app.put('/api/images/:id/mark-unlabeled', async (req, res) => {
    try {
        const imageId = req.params.id;
        
        await database.markImageAsUnlabeled(imageId);
        
        res.json({
            success: true,
            message: 'Fotoğraf etiketlenmemiş olarak işaretlendi'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Etiket istatistikleri API'leri
app.get('/api/analytics/labels', async (req, res) => {
    try {
        const annotations = await database.getLabelStatistics();
        
        // Etiket sayılarını hesapla
        const labelCounts = {};
        const projectStats = {};
        let totalAnnotations = 0;
        
        annotations.forEach(annotation => {
            const projectName = annotation.project_name;
            const projectId = annotation.project_id;
            
            if (!projectStats[projectId]) {
                projectStats[projectId] = {
                    name: projectName,
                    labels: {},
                    total: 0
                };
            }
            
            if (annotation.annotation_data && annotation.annotation_data.annotations) {
                annotation.annotation_data.annotations.forEach(ann => {
                    const label = ann.label || 'Etiketlenmemiş';
                    
                    // Global sayım
                    labelCounts[label] = (labelCounts[label] || 0) + 1;
                    totalAnnotations++;
                    
                    // Proje bazında sayım
                    projectStats[projectId].labels[label] = (projectStats[projectId].labels[label] || 0) + 1;
                    projectStats[projectId].total++;
                });
            }
        });
        
        // Oranları hesapla
        const labelStats = Object.entries(labelCounts).map(([label, count]) => ({
            label,
            count,
            percentage: totalAnnotations > 0 ? ((count / totalAnnotations) * 100).toFixed(2) : 0
        })).sort((a, b) => b.count - a.count);
        
        // Proje bazında istatistikler
        const projectLabelStats = Object.values(projectStats).map(project => ({
            projectName: project.name,
            totalLabels: project.total,
            labels: Object.entries(project.labels).map(([label, count]) => ({
                label,
                count,
                percentage: project.total > 0 ? ((count / project.total) * 100).toFixed(2) : 0
            })).sort((a, b) => b.count - a.count)
        }));
        
        res.json({
            success: true,
            data: {
                totalAnnotations,
                labelStats,
                projectLabelStats,
                summary: {
                    uniqueLabels: labelStats.length,
                    mostUsedLabel: labelStats[0] || null,
                    leastUsedLabel: labelStats[labelStats.length - 1] || null
                }
            }
        });
    } catch (error) {
        console.error('❌ Etiket istatistikleri hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Kullanıcı etiket istatistikleri
app.get('/api/analytics/users', async (req, res) => {
    try {
        const userStats = await database.getUserAnnotationStats();
        
        res.json({
            success: true,
            data: userStats
        });
    } catch (error) {
        console.error('❌ Kullanıcı istatistikleri hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Proje bazında etiket istatistikleri
app.get('/api/analytics/projects/:id/labels', async (req, res) => {
    try {
        const projectId = req.params.id;
        const annotations = await database.getProjectAnnotationStats(projectId);
        
        // Etiket sayılarını hesapla
        const labelCounts = {};
        let totalAnnotations = 0;
        
        annotations.forEach(annotation => {
            if (annotation.annotation_data && annotation.annotation_data.annotations) {
                annotation.annotation_data.annotations.forEach(ann => {
                    const label = ann.label || 'Etiketlenmemiş';
                    labelCounts[label] = (labelCounts[label] || 0) + 1;
                    totalAnnotations++;
                });
            }
        });
        
        // Oranları hesapla
        const labelStats = Object.entries(labelCounts).map(([label, count]) => ({
            label,
            count,
            percentage: totalAnnotations > 0 ? ((count / totalAnnotations) * 100).toFixed(2) : 0
        })).sort((a, b) => b.count - a.count);
        
        res.json({
            success: true,
            data: {
                projectId,
                totalAnnotations,
                labelStats,
                summary: {
                    uniqueLabels: labelStats.length,
                    mostUsedLabel: labelStats[0] || null,
                    leastUsedLabel: labelStats[labelStats.length - 1] || null
                }
            }
        });
    } catch (error) {
        console.error('❌ Proje etiket istatistikleri hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Label Analytics endpoint
app.get('/api/label-analytics', async (req, res) => {
    try {
        console.log('📊 Etiket analizi endpoint çağrıldı');
        
        const projects = await database.getAllProjects();
        let totalLabels = 0;
        let labelStatsCount = 0;
        
        for (const project of projects) {
            const stats = await database.getProjectAnnotationStats(project.id);
            totalLabels += stats.totalAnnotations;
            labelStatsCount += stats.labelStats.length;
        }
        
        const response = {
            totalLabels,
            labelStatsCount,
            projectsCount: projects.length
        };
        
        console.log('📊 Analytics response:', response);
        res.json(response);
    } catch (error) {
        console.error('❌ Label analytics hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Annotation Stats endpoint
app.get('/api/projects/:id/annotation-stats', async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const stats = await database.getProjectAnnotationStats(projectId);
        res.json(stats);
    } catch (error) {
        console.error('❌ Annotation stats hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Labels endpoint
app.get('/api/labels', async (req, res) => {
    try {
        const labels = await database.getAllLabels();
        res.json(labels);
    } catch (error) {
        console.error('❌ Labels hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Dashboard route
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../dashboard/index.html'));
});

// Etiketleme uygulaması route
app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, '../labeling-app/index.html'));
});

// Dosya yolu endpoint'i kaldırıldı - artık direkt dosya yolundan çekiliyor

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint bulunamadı' });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Server kapatılıyor...');
    database.close();
    process.exit(0);
});

// WebSocket connection handling
const connectedUsers = new Map(); // Bağlı kullanıcıları takip et

io.on('connection', (socket) => {
    console.log('🔌 Yeni kullanıcı bağlandı:', socket.id);
    
    // JWT token ile authentication
    socket.on('authenticate', async (token) => {
        try {
            const decoded = auth.verifyToken(token);
            if (decoded) {
                socket.userId = decoded.id;
                socket.username = decoded.username;
                connectedUsers.set(socket.id, {
                    userId: decoded.id,
                    username: decoded.username,
                    socketId: socket.id
                });
                
                console.log(`✅ Kullanıcı doğrulandı: ${decoded.username} (${socket.id})`);
                socket.emit('authenticated', { success: true, username: decoded.username });
            } else {
                socket.emit('authError', { error: 'Geçersiz token' });
            }
        } catch (error) {
            console.error('❌ WebSocket auth hatası:', error);
            socket.emit('authError', { error: 'Authentication başarısız' });
        }
    });
    
    // Projeye katılma
    socket.on('joinProject', (projectId) => {
        if (socket.username) {
            const roomName = `project_${projectId}`;
            socket.join(roomName);
            socket.currentProject = projectId;
            
            console.log(`👥 ${socket.username} projeye katıldı: ${projectId}`);
            
            // Diğer kullanıcılara bildir
            socket.to(roomName).emit('userJoined', {
                username: socket.username,
                projectId: projectId,
                timestamp: new Date().toISOString()
            });
            
            // Odadaki kullanıcı sayısını gönder
            const room = io.sockets.adapter.rooms.get(roomName);
            const userCount = room ? room.size : 0;
            io.to(roomName).emit('roomStats', { userCount, projectId });
        }
    });
    
    // Projeden ayrılma
    socket.on('leaveProject', (projectId) => {
        if (socket.username) {
            const roomName = `project_${projectId}`;
            socket.leave(roomName);
            socket.currentProject = null;
            
            console.log(`👋 ${socket.username} projeden ayrıldı: ${projectId}`);
            
            // Diğer kullanıcılara bildir
            socket.to(roomName).emit('userLeft', {
                username: socket.username,
                projectId: projectId,
                timestamp: new Date().toISOString()
            });
            
            // Odadaki kullanıcı sayısını güncelle
            const room = io.sockets.adapter.rooms.get(roomName);
            const userCount = room ? room.size : 0;
            io.to(roomName).emit('roomStats', { userCount, projectId });
        }
    });
    
    // Bağlantı koptuğunda temizlik
    socket.on('disconnect', () => {
        if (socket.currentProject) {
            const roomName = `project_${socket.currentProject}`;
            socket.to(roomName).emit('userLeft', {
                username: socket.username,
                projectId: socket.currentProject,
                timestamp: new Date().toISOString()
            });
            
            // Odadaki kullanıcı sayısını güncelle
            const room = io.sockets.adapter.rooms.get(roomName);
            const userCount = room ? room.size : 0;
            io.to(roomName).emit('roomStats', { userCount, projectId: socket.currentProject });
        }
        
        connectedUsers.delete(socket.id);
        console.log(`🔌 Kullanıcı bağlantısı koptu: ${socket.username || socket.id}`);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server çalışıyor: http://0.0.0.0:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`🏷️ Etiketleme: http://localhost:${PORT}/app`);
    console.log(`👤 Varsayılan admin: admin`);
    console.log(`🔌 WebSocket desteği aktif`);
    console.log(`🌐 Ağ erişimi: Aynı ağdaki tüm cihazlardan erişilebilir`);
});
