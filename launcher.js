const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class EtiketlemeLauncher {
    constructor() {
        this.backendProcess = null;
        this.electronProcess = null;
        this.isBackendReady = false;
    }

    async start() {
        console.log('🚀 Etiketleme Sistemi Launcher başlatılıyor...');
        
        try {
            // Backend'i başlat
            await this.startBackend();
            
            // Backend'in hazır olmasını bekle
            await this.waitForBackend();
            
            // Electron uygulamasını başlat
            this.startElectron();
            
        } catch (error) {
            console.error('❌ Launcher hatası:', error);
            process.exit(1);
        }
    }

    async startBackend() {
        return new Promise((resolve, reject) => {
            console.log('🔧 Backend server başlatılıyor...');
            
            // Check if we're in a packaged app
            const isPackaged = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
            let backendPath;
            let cwd;
            let nodeExecutable = 'node';
            
            if (isPackaged) {
                // In packaged app, use resources path
                const resourcesPath = process.resourcesPath || path.join(process.execPath, '..', '..', '..');
                backendPath = path.join(resourcesPath, 'backend', 'server.js');
                cwd = path.join(resourcesPath, 'backend');
                
                // Platform'a göre node executable seç
                if (process.platform === 'win32') {
                    nodeExecutable = path.join(resourcesPath, 'node.exe');
                } else {
                    // Mac/Linux için embedded node kullan
                    nodeExecutable = path.join(resourcesPath, 'node');
                }
            } else {
                // In development
                backendPath = path.join(__dirname, 'backend', 'server.js');
                cwd = path.join(__dirname, 'backend');
            }
            
            console.log('Backend path:', backendPath);
            console.log('Working directory:', cwd);
            console.log('Node executable:', nodeExecutable);
            
            // Backend path'inin var olup olmadığını kontrol et
            if (!fs.existsSync(backendPath)) {
                console.error('❌ Backend dosyası bulunamadı:', backendPath);
                reject(new Error(`Backend dosyası bulunamadı: ${backendPath}`));
                return;
            }
            
            // Working directory'nin var olup olmadığını kontrol et
            if (!fs.existsSync(cwd)) {
                console.error('❌ Working directory bulunamadı:', cwd);
                reject(new Error(`Working directory bulunamadı: ${cwd}`));
                return;
            }
            
            this.backendProcess = spawn(nodeExecutable, [backendPath], {
                cwd: cwd,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.backendProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log('Backend:', output);
                
                // Server'ın başladığını kontrol et
                if (output.includes('Server çalışıyor') || output.includes('listening')) {
                    console.log('✅ Backend server başlatıldı');
                    this.isBackendReady = true;
                    resolve();
                }
            });

            this.backendProcess.stderr.on('data', (data) => {
                console.error('Backend Error:', data.toString());
            });

            this.backendProcess.on('error', (error) => {
                console.error('❌ Backend server başlatılamadı:', error);
                reject(error);
            });

            this.backendProcess.on('exit', (code) => {
                console.log(`Backend server kapandı, kod: ${code}`);
                this.backendProcess = null;
            });

            // Timeout - 15 saniye içinde başlamazsa hata
            setTimeout(() => {
                if (!this.isBackendReady) {
                    reject(new Error('Backend server başlatma timeout'));
                }
            }, 15000);
        });
    }

    async waitForBackend() {
        console.log('⏳ Backend hazır olması bekleniyor...');
        
        let attempts = 0;
        const maxAttempts = 30; // 30 saniye
        
        while (attempts < maxAttempts) {
            try {
                const response = await fetch('http://localhost:3000/api/health');
                if (response.ok) {
                    console.log('✅ Backend hazır!');
                    return;
                }
            } catch (error) {
                // Backend henüz hazır değil, bekle
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }
        
        throw new Error('Backend hazır olmadı');
    }

    startElectron() {
        console.log('🖥️ Electron uygulaması başlatılıyor...');
        
        const electronPath = path.join(__dirname, 'node_modules', '.bin', 'electron');
        const mainPath = path.join(__dirname, 'main.js');
        
        // Electron'u başlat
        this.electronProcess = spawn(electronPath, [mainPath], {
            cwd: __dirname,
            stdio: 'inherit'
        });

        this.electronProcess.on('exit', (code) => {
            console.log(`Electron uygulaması kapandı, kod: ${code}`);
            
            // Backend'i de kapat
            if (this.backendProcess) {
                console.log('🛑 Backend kapatılıyor...');
                this.backendProcess.kill();
            }
            
            process.exit(code);
        });

        this.electronProcess.on('error', (error) => {
            console.error('❌ Electron başlatılamadı:', error);
            
            // Backend'i de kapat
            if (this.backendProcess) {
                this.backendProcess.kill();
            }
            
            process.exit(1);
        });
    }

    cleanup() {
        if (this.backendProcess) {
            this.backendProcess.kill();
        }
        if (this.electronProcess) {
            this.electronProcess.kill();
        }
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Launcher kapatılıyor...');
    if (launcher) {
        launcher.cleanup();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Launcher kapatılıyor...');
    if (launcher) {
        launcher.cleanup();
    }
    process.exit(0);
});

// Launcher'ı başlat
const launcher = new EtiketlemeLauncher();
launcher.start().catch(error => {
    console.error('❌ Launcher başlatılamadı:', error);
    process.exit(1);
});
