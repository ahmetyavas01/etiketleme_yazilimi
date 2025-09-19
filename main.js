const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

class EtiketlemeApp {
    constructor() {
        this.mainWindow = null;
        this.serverPort = 3000;
        this.backendProcess = null;
        this.isBackendRunning = false;
    }

    createWindow() {
        // Ana pencereyi oluştur
        this.mainWindow = new BrowserWindow({
            width: 1600,
            height: 1000,
            minWidth: 1400,
            minHeight: 900,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, 'preload.js'),
                webSecurity: false // Hızlı başlatma için
            },
            icon: path.join(__dirname, 'assets/icon.png'),
            title: 'Etiketleme Sistemi',
            show: false, // İlk başta gizli, hızlı başlatma için
            backgroundColor: '#2e2e2e' // Loading sırasında arka plan
        });

        // Dashboard'ı yükle - packaged app için path kontrolü
        const isPackaged = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
        let dashboardPath;
        
        if (isPackaged) {
            // In packaged app, use resources path
            const resourcesPath = process.resourcesPath || path.join(process.execPath, '..', '..', '..');
            dashboardPath = path.join(resourcesPath, 'dashboard', 'index.html');
        } else {
            // In development
            dashboardPath = path.join(__dirname, 'dashboard', 'index.html');
        }
        
        this.mainWindow.loadFile(dashboardPath);

        // Pencere hazır olduğunda göster
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
            console.log('✅ Ana pencere gösterildi');
        });

        // Pencere kapatıldığında
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        // Dev tools'u aç (geliştirme için)
        if (process.env.NODE_ENV === 'development') {
            this.mainWindow.webContents.openDevTools();
        }

        // External link'leri varsayılan tarayıcıda aç
        this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            require('electron').shell.openExternal(url);
            return { action: 'deny' };
        });
    }

    async startBackend() {
        try {
            console.log('🚀 Backend server otomatik başlatılıyor...');
            
            const isPackaged = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
            let backendPath, cwd, nodeExecutable;
            
            if (isPackaged) {
                const resourcesPath = process.resourcesPath || path.join(process.execPath, '..', '..', '..');
                backendPath = path.join(resourcesPath, 'backend', 'server.js');
                cwd = path.join(resourcesPath, 'backend');
                
                if (process.platform === 'win32') {
                    nodeExecutable = path.join(resourcesPath, 'node.exe');
                } else {
                    nodeExecutable = path.join(resourcesPath, 'node');
                }
            } else {
                backendPath = path.join(__dirname, 'backend', 'server.js');
                cwd = path.join(__dirname, 'backend');
                nodeExecutable = process.execPath;
            }
            
            // Path'lerin var olduğunu kontrol et
            if (!fs.existsSync(backendPath)) {
                console.error('❌ Backend dosyası bulunamadı:', backendPath);
                return false;
            }
            
            if (!fs.existsSync(cwd)) {
                console.error('❌ Backend klasörü bulunamadı:', cwd);
                return false;
            }
            
            console.log('📁 Backend path:', backendPath);
            console.log('📁 Working directory:', cwd);
            console.log('🔧 Node executable:', nodeExecutable);
            
            // Dependencies kontrolü ve yükleme
            await this.ensureBackendDependencies(cwd, nodeExecutable);
            
            // Backend'i başlat
            this.backendProcess = spawn(nodeExecutable, [backendPath], {
                cwd: cwd,
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false
            });
            
            this.backendProcess.stdout.on('data', (data) => {
                console.log('Backend:', data.toString());
            });
            
            this.backendProcess.stderr.on('data', (data) => {
                console.error('Backend Error:', data.toString());
            });
            
            this.backendProcess.on('close', (code) => {
                console.log(`Backend process exited with code ${code}`);
                this.isBackendRunning = false;
                this.backendProcess = null;
            });
            
            // Backend'in başlamasını bekle
            await this.waitForBackend();
            this.isBackendRunning = true;
            console.log('✅ Backend başarıyla başlatıldı');
            return true;
            
        } catch (error) {
            console.error('❌ Backend başlatma hatası:', error);
            return false;
        }
    }
    
    async ensureBackendDependencies(cwd, nodeExecutable) {
        try {
            console.log('🔍 Backend dependencies kontrol ediliyor...');
            
            const packageJsonPath = path.join(cwd, 'package.json');
            const nodeModulesPath = path.join(cwd, 'node_modules');
            
            // package.json var mı kontrol et
            if (!fs.existsSync(packageJsonPath)) {
                console.log('⚠️ package.json bulunamadı, dependencies yüklenemiyor');
                return;
            }
            
            // node_modules var mı kontrol et
            if (!fs.existsSync(nodeModulesPath)) {
                console.log('📦 node_modules bulunamadı, dependencies yükleniyor...');
                await this.installBackendDependencies(cwd, nodeExecutable);
            } else {
                console.log('✅ node_modules mevcut');
            }
            
        } catch (error) {
            console.error('❌ Dependencies kontrol hatası:', error);
        }
    }
    
    async installBackendDependencies(cwd, nodeExecutable) {
        return new Promise((resolve, reject) => {
            console.log('📦 Backend dependencies yükleniyor...');
            
            const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
            const installProcess = spawn(npmCommand, ['install'], {
                cwd: cwd,
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: process.platform === 'win32'
            });
            
            installProcess.stdout.on('data', (data) => {
                console.log('NPM:', data.toString());
            });
            
            installProcess.stderr.on('data', (data) => {
                console.log('NPM Error:', data.toString());
            });
            
            installProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Backend dependencies başarıyla yüklendi');
                    resolve();
                } else {
                    console.error('❌ Dependencies yükleme hatası, code:', code);
                    reject(new Error(`Dependencies yükleme hatası: ${code}`));
                }
            });
            
            installProcess.on('error', (error) => {
                console.error('❌ NPM process hatası:', error);
                reject(error);
            });
        });
    }
    
    async waitForBackend(maxAttempts = 30) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await fetch(`http://localhost:${this.serverPort}/api/health`);
                if (response.ok) {
                    console.log('✅ Backend hazır');
                    return true;
                }
            } catch (error) {
                // Backend henüz hazır değil, bekle
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        throw new Error('Backend başlatılamadı');
    }
    
    stopBackend() {
        if (this.backendProcess) {
            console.log('🛑 Backend kapatılıyor...');
            this.backendProcess.kill();
            this.backendProcess = null;
            this.isBackendRunning = false;
        }
    }

    setupIPC() {
        // Klasör seçimi için IPC handler
        ipcMain.handle('select-folder', async () => {
            try {
                const result = await dialog.showOpenDialog(this.mainWindow, {
                    properties: ['openDirectory'],
                    title: 'Resim Klasörü Seçin'
                });

                if (!result.canceled && result.filePaths.length > 0) {
                    const folderPath = result.filePaths[0];
                    console.log('📁 Seçilen klasör:', folderPath);
                    return folderPath;
                }
                return null;
            } catch (error) {
                console.error('❌ Klasör seçim hatası:', error);
                return null;
            }
        });

        // Etiketleme uygulamasına geç
        ipcMain.handle('open-labeling-app', async () => {
            try {
                if (this.mainWindow) {
                    // Mevcut pencereyi labeling-app'e yönlendir
                    // Labeling app path - packaged app için path kontrolü
                    const isPackaged = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
                    let labelingAppPath;
                    
                    if (isPackaged) {
                        // In packaged app, use resources path
                        const resourcesPath = process.resourcesPath || path.join(process.execPath, '..', '..', '..');
                        labelingAppPath = path.join(resourcesPath, 'labeling-app', 'index.html');
                    } else {
                        // In development
                        labelingAppPath = path.join(__dirname, 'labeling-app', 'index.html');
                    }
                    
                    this.mainWindow.loadFile(labelingAppPath);
                    this.mainWindow.setTitle('Etiketleme Uygulaması');
                    return { success: true };
                } else {
                    return { success: false, error: 'Ana pencere bulunamadı' };
                }
            } catch (error) {
                console.error('❌ Etiketleme uygulamasına geçiş hatası:', error);
                return { success: false, error: error.message };
            }
        });

        // Dashboard'a geç
        ipcMain.handle('open-dashboard', async () => {
            try {
                if (this.mainWindow) {
                    // Mevcut pencereyi dashboard'a yönlendir
                    // Dashboard path - packaged app için path kontrolü
                    const isPackaged = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
                    let dashboardPath;
                    
                    if (isPackaged) {
                        // In packaged app, use resources path
                        const resourcesPath = process.resourcesPath || path.join(process.execPath, '..', '..', '..');
                        dashboardPath = path.join(resourcesPath, 'dashboard', 'index.html');
                    } else {
                        // In development
                        dashboardPath = path.join(__dirname, 'dashboard', 'index.html');
                    }
                    
                    this.mainWindow.loadFile(dashboardPath);
                    this.mainWindow.setTitle('Etiketleme Sistemi - Dashboard');
                    return { success: true };
                } else {
                    return { success: false, error: 'Ana pencere bulunamadı' };
                }
            } catch (error) {
                console.error('❌ Dashboard\'a geçiş hatası:', error);
                return { success: false, error: error.message };
            }
        });

        // Server durumunu kontrol et
        ipcMain.handle('get-server-status', async () => {
            try {
                const response = await fetch(`http://localhost:${this.serverPort}/api/health`);
                if (response.ok) {
                    const data = await response.json();
                    return { 
                        running: true, 
                        port: this.serverPort,
                        ip: data.ip || 'localhost'
                    };
                }
                return { running: false };
            } catch (error) {
                return { running: false, error: error.message };
            }
        });

        // External link açma
        ipcMain.handle('open-external', async (event, url) => {
            try {
                require('electron').shell.openExternal(url);
                return { success: true };
            } catch (error) {
                console.error('❌ External link açılamadı:', error);
                return { success: false, error: error.message };
            }
        });

        // Backend başlatma
        ipcMain.handle('start-backend', async () => {
            try {
                if (this.isBackendRunning) {
                    return { success: true, message: 'Backend zaten çalışıyor' };
                }
                
                const started = await this.startBackend();
                if (started) {
                    return { success: true, message: 'Backend başarıyla başlatıldı' };
                } else {
                    return { success: false, error: 'Backend başlatılamadı' };
                }
            } catch (error) {
                console.error('❌ Backend başlatma hatası:', error);
                return { success: false, error: error.message };
            }
        });
    }

    async onReady() {
        console.log('🚀 Etiketleme Sistemi başlatılıyor...');
        
        // Ana pencereyi oluştur
        this.createWindow();
        
        // IPC handler'ları kur
        this.setupIPC();
        
        // Backend'i otomatik başlat
        console.log('🔧 Backend otomatik başlatılıyor...');
        const backendStarted = await this.startBackend();
        
        if (backendStarted) {
            console.log('✅ Backend başarıyla başlatıldı');
        } else {
            console.log('⚠️ Backend başlatılamadı, manuel başlatma gerekebilir');
        }
        
        console.log('✅ Uygulama başarıyla başlatıldı');
        
        // Hızlı başlatma için timeout kaldır
        setTimeout(() => {
            if (this.mainWindow && !this.mainWindow.isVisible()) {
                this.mainWindow.show();
            }
        }, 100);
    }

    onWindowAllClosed() {
        // macOS'ta Cmd + Q ile çıkış yapılmadığı sürece uygulamayı kapatma
        if (process.platform !== 'darwin') {
            app.quit();
        }
    }

    onActivate() {
        // macOS'ta dock'tan tıklandığında pencereyi göster
        if (this.mainWindow === null) {
            this.createWindow();
        }
    }

    quit() {
        console.log('🛑 Uygulama kapatılıyor...');
        this.stopBackend();
        app.quit();
    }
}

// Uygulama instance'ı
const etiketlemeApp = new EtiketlemeApp();

// Electron event handlers
app.whenReady().then(() => etiketlemeApp.onReady());

app.on('window-all-closed', () => etiketlemeApp.onWindowAllClosed());

app.on('activate', () => etiketlemeApp.onActivate());

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Uygulama kapatılıyor...');
    await etiketlemeApp.quit();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Uygulama kapatılıyor...');
    await etiketlemeApp.quit();
    process.exit(0);
});