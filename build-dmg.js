const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🍎 Etiketleme Sistemi DMG Build Script');
console.log('=====================================');

const projectRoot = __dirname;
const distDir = path.join(projectRoot, 'dist-electron');

async function buildDmg() {
    try {
        // 1. Önceki build dosyalarını temizle
        console.log('🧹 Önceki build dosyaları temizleniyor...');
        if (fs.existsSync(distDir)) {
            fs.rmSync(distDir, { recursive: true, force: true });
            console.log('   dist-electron klasörü temizlendi.');
        } else {
            console.log('   dist-electron klasörü bulunamadı, temizleme atlandı.');
        }

        // 2. Dependencies yükle
        console.log('📦 Dependencies yükleniyor...');
        execSync('npm install', { stdio: 'inherit', cwd: projectRoot });
        console.log('   Dependencies başarıyla yüklendi.');

        // 3. Node.js binary'sini kontrol et
        console.log('🔍 Node.js binary kontrol ediliyor...');
        const nodePath = path.join(projectRoot, 'node_modules', 'node', 'bin', 'node');
        if (!fs.existsSync(nodePath)) {
            console.log('   Node.js binary bulunamadı, yükleniyor...');
            execSync('npm install node', { stdio: 'inherit', cwd: projectRoot });
        }
        console.log('   Node.js binary hazır.');

        // 4. Electron Builder ile DMG oluştur
        console.log('🔨 DMG dosyası oluşturuluyor...');
        // Mac için build
        execSync('npx electron-builder --mac --x64', { stdio: 'inherit', cwd: projectRoot });
        console.log('✅ DMG build tamamlandı!');

        console.log('\n📁 Output klasörü: ' + distDir);
        console.log('\n📋 Oluşturulan dosyalar:');
        if (fs.existsSync(distDir)) {
            fs.readdirSync(distDir).forEach(file => {
                const filePath = path.join(distDir, file);
                const stats = fs.statSync(filePath);
                console.log(`  - ${file} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
            });
        }

        console.log('\n🎉 DMG build başarıyla tamamlandı!');
        console.log('💡 DMG dosyasını çalıştırmak için dist-electron klasöründeki .dmg dosyasını kullanın.');

    } catch (error) {
        console.error('❌ DMG build hatası:', error.message);
        process.exit(1);
    }
}

buildDmg();
