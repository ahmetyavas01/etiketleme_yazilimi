const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🚀 Etiketleme Sistemi Windows Build Script');
console.log('==========================================');

// Platform kontrolü
const platform = process.platform;
const isWindows = platform === 'win32';

console.log(`🖥️  Platform: ${platform}`);
console.log(`🖥️  Windows: ${isWindows ? 'Evet' : 'Hayır'}`);

try {
    // 1. Clean previous builds
    console.log('🧹 Önceki build dosyaları temizleniyor...');
    if (fs.existsSync('dist-electron')) {
        if (isWindows) {
            execSync('rmdir /s /q dist-electron', { stdio: 'inherit' });
        } else {
            fs.rmSync('dist-electron', { recursive: true, force: true });
        }
    }

    // 2. Install dependencies
    console.log('📦 Dependencies yükleniyor...');
    execSync('npm install', { stdio: 'inherit' });

    // 3. Backend dependencies
    console.log('📦 Backend dependencies yükleniyor...');
    execSync('npm run backend:install', { stdio: 'inherit' });

    // 4. Set production environment
    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'production';
    process.env.ELECTRON_BUILDER_CACHE = path.join(os.homedir(), '.cache', 'electron-builder');

    // 5. Build the EXE
    console.log('🔨 Windows EXE dosyası oluşturuluyor...');
    console.log('⏳ Bu işlem birkaç dakika sürebilir...');
    
    const buildCommand = isWindows 
        ? 'npx electron-builder --win --x64 --ia32'
        : 'npx electron-builder --win --x64';
        
    execSync(buildCommand, { 
        stdio: 'inherit',
        env: { 
            ...process.env, 
            NODE_ENV: 'production', 
            APP_ENV: 'production',
            ELECTRON_BUILDER_CACHE: path.join(os.homedir(), '.cache', 'electron-builder')
        }
    });

    console.log('✅ Windows EXE build tamamlandı!');
    console.log('📁 Output klasörü: dist-electron/');
    
    // 6. List output files
    console.log('\n📋 Oluşturulan dosyalar:');
    if (fs.existsSync('dist-electron')) {
        const files = fs.readdirSync('dist-electron');
        files.forEach(file => {
            const filePath = path.join('dist-electron', file);
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
                const size = (stats.size / (1024 * 1024)).toFixed(2);
                console.log(`  - ${file} (${size} MB)`);
            }
        });
    }

    // 7. Build info
    console.log('\n📊 Build Bilgileri:');
    console.log(`  - Platform: ${platform}`);
    console.log(`  - Node.js: ${process.version}`);
    console.log(`  - Electron: ${require('electron/package.json').version}`);
    console.log(`  - Build Time: ${new Date().toLocaleString('tr-TR')}`);

    console.log('\n🎉 Windows build başarıyla tamamlandı!');
    console.log('💡 EXE dosyasını çalıştırmak için dist-electron klasöründeki .exe dosyasını kullanın.');
    console.log('💡 Setup dosyasını dağıtmak için .exe dosyasını kullanabilirsiniz.');

} catch (error) {
    console.error('❌ Build hatası:', error.message);
    console.error('📋 Hata detayları:', error);
    
    // Windows-specific error handling
    if (isWindows && error.message.includes('spawn')) {
        console.error('💡 Windows için Visual Studio Build Tools gerekli olabilir.');
        console.error('💡 İndirme linki: https://visualstudio.microsoft.com/visual-cpp-build-tools/');
    }
    
    process.exit(1);
}
