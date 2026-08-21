const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// اتصال به PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ==================== دیتابیس ====================
async function initDB() {
    try {
        // جدول تنظیمات (رمز)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                password VARCHAR(255) NOT NULL
            )
        `);

        // جدول کانفیگ‌ها
        await pool.query(`
            CREATE TABLE IF NOT EXISTS configs (
                id SERIAL PRIMARY KEY,
                user_name VARCHAR(100) NOT NULL,
                volume NUMERIC(10,2) NOT NULL,
                days INTEGER NOT NULL,
                used NUMERIC(10,2) DEFAULT 0,
                link TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // تنظیم رمز پیش‌فرض
        const res = await pool.query('SELECT * FROM settings');
        if (res.rows.length === 0) {
            const hashedPassword = await bcrypt.hash('vanta', 10);
            await pool.query('INSERT INTO settings (password) VALUES ($1)', [hashedPassword]);
            console.log('✅ رمز پیش‌فرض "vanta" تنظیم شد');
        }

        console.log('✅ دیتابیس آماده است');
    } catch (err) {
        console.error('❌ خطا در دیتابیس:', err);
    }
}

initDB();

// ==================== API ها ====================

// دریافت همه کانفیگ‌ها
app.get('/api/configs', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM configs ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'خطا در دریافت کانفیگ‌ها' });
    }
});

// ساخت کانفیگ جدید (با لینک واقعی)
app.post('/api/configs', async (req, res) => {
    try {
        const { user, volume, days } = req.body;
        
        // تولید UUID برای کانفیگ
        const uuid = generateUUID();
        
        // لینک کانفیگ (V2Ray/VLess)
        const domain = process.env.DOMAIN || 'your-domain.com';
        const link = `vless://${uuid}@${domain}:443?encryption=none&security=tls&sni=${domain}&fp=chrome&type=ws&host=${domain}&path=/v2ray#${user || 'کاربر'}`;
        
        const result = await pool.query(
            'INSERT INTO configs (user_name, volume, days, link) VALUES ($1, $2, $3, $4) RETURNING *',
            [user || 'کاربر', parseFloat(volume) || 10, parseInt(days) || 30, link]
        );
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطا در ساخت کانفیگ' });
    }
});

// حذف کانفیگ
app.delete('/api/configs/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await pool.query('DELETE FROM configs WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'خطا در حذف' });
    }
});

// به‌روزرسانی مصرف
app.put('/api/configs/:id/usage', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { used } = req.body;
        await pool.query('UPDATE configs SET used = $1 WHERE id = $2', [parseFloat(used) || 0, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'خطا در به‌روزرسانی' });
    }
});

// تأیید رمز
app.post('/api/verify', async (req, res) => {
    try {
        const { password } = req.body;
        const result = await pool.query('SELECT password FROM settings LIMIT 1');
        const isValid = await bcrypt.compare(password, result.rows[0].password);
        res.json({ valid: isValid });
    } catch (err) {
        res.status(500).json({ error: 'خطا' });
    }
});

// تغییر رمز
app.post('/api/password', async (req, res) => {
    try {
        const { newPassword } = req.body;
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE settings SET password = $1', [hashedPassword]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'خطا در تغییر رمز' });
    }
});

// تولید UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ==================== شروع سرور ====================
app.listen(PORT, () => {
    console.log(`🚀 سرور روی پورت ${PORT} اجرا شد`);
    console.log(`📁 لینک پنل: http://localhost:${PORT}`);
});
