const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Etiketleme Sistemi EXE Build Script');
console.log('=====================================');

try {
    // 1. Clean previous builds
    console.log('🧹 Önceki build dosyaları temizleniyor...');
    if (fs.existsSync('dist-electron')) {
        fs.rmSync('dist-electron', { recursive: true, force: true });
    }

    // 2. Install dependencies
    console.log('📦 Dependencies yükleniyor...');
    execSync('npm install', { stdio: 'inherit' });

    // 3. Set production environment
    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'production';

    // 4. Build the EXE
    console.log('🔨 EXE dosyası oluşturuluyor...');
    execSync('npx electron-builder --win --x64', { 
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'production', APP_ENV: 'production' }
    });

    console.log('✅ EXE build tamamlandı!');
    console.log('📁 Output klasörü: dist-electron/');
    
    // 5. List output files
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

    console.log('\n🎉 Build başarıyla tamamlandı!');
    console.log('💡 EXE dosyasını çalıştırmak için dist-electron klasöründeki .exe dosyasını kullanın.');

} catch (error) {
    console.error('❌ Build hatası:', error.message);
    process.exit(1);
}
