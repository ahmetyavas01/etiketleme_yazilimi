const jwt = require('jsonwebtoken');
const database = require('./database-simple');

const JWT_SECRET = 'etiketleme_sistemi_secret_key_2024';

class Auth {
    // Kullanıcı girişi (sadece username ile)
    async login(username) {
        try {
            let user = await database.getUserByUsername(username);
            if (!user) {
                // Kullanıcı yoksa otomatik oluştur
                const role = username === 'admin' ? 'admin' : 'user';
                console.log('👤 Yeni kullanıcı oluşturuluyor:', username, 'rol:', role);
                user = await database.createUser(username, role);
            }

            // Son giriş zamanını güncelle
            await database.runQuery('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

            // JWT token oluştur
            const token = jwt.sign(
                { 
                    id: user.id, 
                    username: user.username, 
                    role: user.role 
                },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            return {
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Token doğrulama
    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            return {
                success: true,
                user: decoded
            };
        } catch (error) {
            return {
                success: false,
                error: 'Geçersiz token'
            };
        }
    }

    // Middleware: Token kontrolü
    authenticateToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ error: 'Token gerekli' });
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            next();
        } catch (error) {
            return res.status(403).json({ error: 'Geçersiz token' });
        }
    }

    // Admin yetkisi kontrolü
    requireAdmin(req, res, next) {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin yetkisi gerekli' });
        }
        next();
    }

    // Kullanıcı oluşturma (sadece admin)
    async createUser(username, role = 'user') {
        try {
            const user = await database.createUser(username, role);
            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Tüm kullanıcıları listele
    async getAllUsers() {
        try {
            const users = await database.getAllUsers();
            return {
                success: true,
                users
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new Auth();
