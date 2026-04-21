const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const rateLimit = require('express-rate-limit');
const { dbAsync } = require('./db');
const { createToken, verifyToken, requireAdmin } = require('./auth');
const { notifyAdmin, sendAutoReply } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3001;

// Setup Uploads Directory (Ensure it exists)
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Middlewares
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static Files - serve 'public' directory
app.use(express.static(path.join(__dirname, 'public')));


// Rate Limiting
const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // limit each IP to 5 requests per windowMs
    message: { error: "Too many login attempts, please try again in a minute" }
});

// 1. Auth Endpoints

app.post('/api/register', async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        
        if (!fullName || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const existing = await dbAsync.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) return res.status(400).json({ error: 'Email already exists' });

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const result = await dbAsync.run(
            'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [fullName, email, hash, 'user']
        );

        const user = { id: result.lastID, email, full_name: fullName, role: 'user' };
        const token = createToken(user);
        
        res.cookie('token', token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 
        });

        res.json({ message: 'Registration successful', fullName: fullName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await dbAsync.get('SELECT * FROM users WHERE email = ?', [email]);
        
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });
        
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

        const token = createToken(user);
        res.cookie('token', token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 
        });

        res.json({ message: 'Login successful', fullName: user.full_name, role: user.role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

app.get('/api/me', verifyToken, (req, res) => {
    res.json({ 
        id: req.user.id,
        email: req.user.email,
        full_name: req.user.full_name,
        role: req.user.role 
    });
});

app.get('/api/check-auth', verifyToken, (req, res) => {
    res.json({ authenticated: true, role: req.user.role });
});


// 2. Portfolio Endpoints (Public)
app.get('/api/portfolio', async (req, res) => {
    try {
        const items = await dbAsync.all('SELECT * FROM portfolio_items ORDER BY created_at DESC');
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Admin Portfolio Actions (Protected)
app.post('/api/portfolio', verifyToken, requireAdmin, upload.array('media', 20), async (req, res) => {
    try {
        const { title, category, mediaType, vimeoUrl, descriptionCS, descriptionEN, tags } = req.body;
        
        // Handle Video/Vimeo Link (Single item as it's a link)
        if (mediaType === 'vimeo' && vimeoUrl) {
            const description = JSON.stringify({ cs: descriptionCS || '', en: descriptionEN || '' });
            await dbAsync.run(
                `INSERT INTO portfolio_items (title, category, description, media_url, thumbnail_url, tags) VALUES (?, ?, ?, ?, ?, ?)`,
                [title, category, description, vimeoUrl, '/assets/download_1774980242270.jpeg', tags]
            );
            return res.json({ message: 'Portfolio item created' });
        }

        // Handle Multiple Files
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No media files uploaded' });
        }

        const description = JSON.stringify({ cs: descriptionCS || '', en: descriptionEN || '' });

        for (const file of req.files) {
            const finalMediaUrl = '/uploads/' + file.filename;
            const thumbnail_url = file.mimetype.startsWith('image') ? finalMediaUrl : '/assets/download_1774980242270.jpeg';

            await dbAsync.run(
                `INSERT INTO portfolio_items (title, category, description, media_url, thumbnail_url, tags) VALUES (?, ?, ?, ?, ?, ?)`,
                [title, category, description, finalMediaUrl, thumbnail_url, tags]
            );
        }

        res.json({ message: `${req.files.length} items created successfully` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/portfolio/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        await dbAsync.run('DELETE FROM portfolio_items WHERE id = ?', [req.params.id]);
        res.json({ message: 'Item deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// 4. Testimonials (Public)
app.get('/api/testimonials', async (req, res) => {
    try {
        const items = await dbAsync.all('SELECT * FROM testimonials');
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Contact Form (Public)
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, project_type, budget, message } = req.body;
        
        // Save to DB
        await dbAsync.run(
            `INSERT INTO messages (name, email, project_type, budget, message) VALUES (?, ?, ?, ?, ?)`,
            [name, email, project_type, budget, message]
        );

        // Send Emails (Non-blocking)
        notifyAdmin(name, email, project_type, budget, message).catch(err => console.error("Admin mail fail:", err));
        sendAutoReply(email, name).catch(err => console.error("Auto-reply mail fail:", err));

        res.json({ message: 'Message received successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Admin Database Views (Protected)
app.get('/api/settings', async (req, res) => {
    try {
        const rows = await dbAsync.all('SELECT key, value FROM settings');
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key) return res.status(400).json({ error: 'Key required' });
        
        await dbAsync.run(
            'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
            [key, value]
        );
        res.json({ message: `Setting ${key} updated` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/users', verifyToken, requireAdmin, async (req, res) => {
    try {
        const users = await dbAsync.all('SELECT id, email, full_name, role, created_at FROM users ORDER BY created_at DESC');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/messages', verifyToken, requireAdmin, async (req, res) => {
    try {
        const messages = await dbAsync.all('SELECT * FROM messages ORDER BY created_at DESC');
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/user-messages/:email', verifyToken, requireAdmin, async (req, res) => {
    try {
        const email = req.params.email;
        const messages = await dbAsync.all('SELECT * FROM messages WHERE email = ? ORDER BY created_at DESC', [email]);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/messages/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        await dbAsync.run('DELETE FROM messages WHERE id = ?', [req.params.id]);
        res.json({ message: 'Message deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/users/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        await dbAsync.run('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// SPA Catch-all
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// STARTUP DB CHECK: Ensure admin role for the main email
dbAsync.run(
    "UPDATE users SET role = 'admin', full_name = 'KARBY ADMIN' WHERE email = ?",
    [process.env.ADMIN_EMAIL]
).then(() => console.log('Admin role check completed.')).catch(err => console.error('Admin role check failed:', err));

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
