const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { dbAsync } = require('./db');
const { createToken, verifyToken, requireAdmin } = require('./auth');
const { notifyAdmin, sendAutoReply } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3000;

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


// --- ROUTES ---

// 1. Auth Endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await dbAsync.get('SELECT * FROM users WHERE email = ?', [email]);
        
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });
        
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

        const token = createToken(user);
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        res.json({ message: 'Login successful', role: user.role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
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
app.post('/api/portfolio', verifyToken, requireAdmin, upload.single('media'), async (req, res) => {
    try {
        const { title, category, mediaType, vimeoUrl, descriptionCS, descriptionEN, tags } = req.body;
        
        // Handle media: if file uploaded take file route, else take vimeo string
        let finalMediaUrl = '';
        if (mediaType === 'vimeo' && vimeoUrl) {
            finalMediaUrl = vimeoUrl;
        } else if (req.file) {
            finalMediaUrl = '/uploads/' + req.file.filename;
        }

        // Combine descriptions into JSON
        const description = JSON.stringify({ cs: descriptionCS || '', en: descriptionEN || '' });

        // Note: keeping thumbnail_url mapping to same media or ignoring for now as they haven't explicitly asked for separate thumbs in the new modal. Let's use finalMediaUrl as both.
        const thumbnail_url = req.file && req.file.mimetype.startsWith('image') ? finalMediaUrl : '/assets/download_1774980242270.jpeg'; // use base texture if video

        const result = await dbAsync.run(
            `INSERT INTO portfolio_items (title, category, description, media_url, thumbnail_url, tags) VALUES (?, ?, ?, ?, ?, ?)`,
            [title, category, description, finalMediaUrl, thumbnail_url, tags]
        );
        res.json({ message: 'Portoflio item created', id: result.lastID });
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


// SPA Catch-all
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
