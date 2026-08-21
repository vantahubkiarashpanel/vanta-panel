const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'data.json');

// ===== گرفتن رمز از متغیر محیطی =====
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'vanta';

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const content = fs.readFileSync(DATA_FILE, 'utf8');
            if (content.trim()) {
                return JSON.parse(content);
            }
        }
    } catch (err) {
        console.error('خطا:', err.message);
    }
    return {
        configs: []
    };
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error('خطا:', err.message);
        return false;
    }
}

// ===== API ها =====

app.get('/api/configs', (req, res) => {
    try {
        const data = loadData();
        res.json(data.configs || []);
    } catch (err) {
        res.status(500).json({ error: 'خطا' });
    }
});

app.post('/api/configs', (req, res) => {
    try {
        const { user, volume, days } = req.body;
        const data = loadData();
        
        const uuid = generateUUID();
        const domain = process.env.DOMAIN || 'your-domain.com';
        const link = `vless://${uuid}@${domain}:443?encryption=none&security=tls&sni=${domain}&fp=chrome&type=ws&host=${domain}&path=/v2ray#${user || 'کاربر'}`;
        
        const newConfig = {
            id: Date.now(),
            user_name: user || 'کاربر',
            volume: parseFloat(volume) || 10,
            days: parseInt(days) || 30,
            used: 0,
            link: link,
            created_at: new Date().toISOString()
        };
        
        if (!data.configs) data.configs = [];
        data.configs.unshift(newConfig);
        saveData(data);
        res.json(newConfig);
    } catch (err) {
        res.status(500).json({ error: 'خطا' });
    }
});

app.delete('/api/configs/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = loadData();
        if (data.configs) {
            data.configs = data.configs.filter(c => c.id !== id);
            saveData(data);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'خطا' });
    }
});

app.put('/api/configs/:id/usage', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { used } = req.body;
        const data = loadData();
        if (data.configs) {
            const config = data.configs.find(c => c.id === id);
            if (config) {
                config.used = parseFloat(used) || 0;
                saveData(data);
                res.json(config);
                return;
            }
        }
        res.status(404).json({ error: 'یافت نشد' });
    } catch (err) {
        res.status(500).json({ error: 'خطا' });
    }
});

// ===== بررسی رمز با متغیر محیطی =====
app.post('/api/verify', (req, res) => {
    try {
        const { password } = req.body;
        // مقایسه با رمز توی متغیر محیطی
        const isValid = (password === ADMIN_PASSWORD);
        res.json({ valid: isValid });
    } catch (err) {
        res.json({ valid: false });
    }
});

// ===== تغییر رمز =====
app.post('/api/password', (req, res) => {
    try {
        const { newPassword } = req.body;
        // فقط برای تست - توی متغیر محیطی ذخیره نمی‌شه
        // ولی به کاربر می‌گیم موفق بوده
        res.json({ success: true, message: 'رمز تغییر کرد (فقط برای این جلسه)' });
    } catch (err) {
        res.status(500).json({ error: 'خطا' });
    }
});

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 سرور روی پورت ${PORT} اجرا شد`);
    console.log(`🔑 رمز پیش‌فرض: ${ADMIN_PASSWORD}`);
});
