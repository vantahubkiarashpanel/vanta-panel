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

// فایل ذخیره‌سازی
const DATA_FILE = path.join(__dirname, 'data.json');

// خواندن دیتا
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (err) {
        console.error('خطا در خواندن فایل:', err);
    }
    // دیتای پیش‌فرض (رمز: vanta)
    return {
        password: '$2a$10$GjBvZPQdVbqHtXhZq9Y6kuBZ5w4kKjQVsnMxkqWXZvKJkQ8XkKjY6',
        configs: []
    };
}

// ذخیره دیتا
function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ==================== API ها ====================

// دریافت کانفیگ‌ها
app.get('/api/configs', (req, res) => {
    const data = loadData();
    res.json(data.configs);
});

// ساخت کانفیگ جدید
app.post('/api/configs', (req, res) => {
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
    
    data.configs.unshift(newConfig);
    saveData(data);
    res.json(newConfig);
});

// حذف کانفیگ
app.delete('/api/configs/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const data = loadData();
    data.configs = data.configs.filter(c => c.id !== id);
    saveData(data);
    res.json({ success: true });
});

// به‌روزرسانی مصرف
app.put('/api/configs/:id/usage', (req, res) => {
    const id = parseInt(req.params.id);
    const { used } = req.body;
    const data = loadData();
    const config = data.configs.find(c => c.id === id);
    if (config) {
        config.used = parseFloat(used) || 0;
        saveData(data);
        res.json(config);
    } else {
        res.status(404).json({ error: 'کانفیگ یافت نشد' });
    }
});

// تأیید رمز
app.post('/api/verify', async (req, res) => {
    const { password } = req.body;
    const data = loadData();
    try {
        const isValid = await bcrypt.compare(password, data.password);
        res.json({ valid: isValid });
    } catch (err) {
        res.json({ valid: false });
    }
});

// تغییر رمز
app.post('/api/password', async (req, res) => {
    const { newPassword } = req.body;
    const data = loadData();
    data.password = await bcrypt.hash(newPassword, 10);
    saveData(data);
    res.json({ success: true });
});

// تولید UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

app.listen(PORT, () => {
    console.log(`🚀 سرور روی پورت ${PORT} اجرا شد`);
    console.log(`🔑 رمز پیش‌فرض: vanta`);
});
