const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const sharp = require('sharp');
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
const avatarDir = path.join(uploadDir, 'avatars');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

// Multer Storage config - Memory Storage for Sharp processing
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB limit
});
const uploadAvatar = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB limit
});

// Middlewares
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001'], credentials: true }));
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

app.post('/api/register', (req, res) => {
    // Registration disabled for public users
    res.status(403).json({ error: 'Registration is currently disabled.' });
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


// 2. Portfolio & Folders Endpoints (Public)
app.get('/api/portfolio', async (req, res) => {
    try {
        const items = await dbAsync.all('SELECT * FROM portfolio_items ORDER BY sort_order ASC, created_at DESC');
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/folders', async (req, res) => {
    try {
        const folders = await dbAsync.all('SELECT * FROM folders ORDER BY id ASC');
        res.json(folders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Admin Portfolio Actions (Protected)
app.post('/api/portfolio', verifyToken, requireAdmin, upload.array('media', 20), async (req, res) => {
    try {
        const { title, category, mediaType, vimeoUrl, descriptionCS, descriptionEN, tags } = req.body;
        const finalTitle = title || '';
        
        // Handle Video/Vimeo Link (Single item as it's a link)
        if (mediaType === 'vimeo' && vimeoUrl) {
            const description = JSON.stringify({ cs: descriptionCS || '', en: descriptionEN || '' });
            await dbAsync.run(
                `INSERT INTO portfolio_items (title, category, description, media_url, thumbnail_url, tags) VALUES (?, ?, ?, ?, ?, ?)`,
                [finalTitle, category, description, vimeoUrl, null, tags]
            );
            return res.json({ message: 'Portfolio item created' });
        }

        // Handle Multiple Files
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No media files uploaded' });
        }

        const description = JSON.stringify({ cs: descriptionCS || '', en: descriptionEN || '' });

        for (const file of req.files) {
            let finalMediaUrl = '';
            let thumbnail_url = null;

            if (file.mimetype.startsWith('image/')) {
                // Process image with Sharp
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const filename = uniqueSuffix + '.webp';
                const outputPath = path.join(uploadDir, filename);

                await sharp(file.buffer)
                    .resize({ width: 2560, withoutEnlargement: true })
                    .webp({ quality: 85 })
                    .toFile(outputPath);

                finalMediaUrl = '/uploads/' + filename;
                thumbnail_url = finalMediaUrl;
            } else {
                // Fallback for non-images (if uploaded)
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname);
                const filename = uniqueSuffix + ext;
                const outputPath = path.join(uploadDir, filename);
                fs.writeFileSync(outputPath, file.buffer);
                
                finalMediaUrl = '/uploads/' + filename;
                thumbnail_url = null; // No thumb for video right now
            }

            await dbAsync.run(
                `INSERT INTO portfolio_items (title, category, description, media_url, thumbnail_url, tags) VALUES (?, ?, ?, ?, ?, ?)`,
                [finalTitle, category, description, finalMediaUrl, thumbnail_url, tags]
            );
        }

        res.json({ message: `${req.files.length} items created successfully` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/portfolio/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const item = await dbAsync.get('SELECT media_url, thumbnail_url FROM portfolio_items WHERE id = ?', [req.params.id]);
        if (item) {
            if (item.media_url && item.media_url.startsWith('/uploads/')) {
                const filePath = path.join(__dirname, 'public', item.media_url);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            if (item.thumbnail_url && item.thumbnail_url.startsWith('/uploads/') && item.thumbnail_url !== item.media_url) {
                const thumbPath = path.join(__dirname, 'public', item.thumbnail_url);
                if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
            }
        }
        await dbAsync.run('DELETE FROM portfolio_items WHERE id = ?', [req.params.id]);
        res.json({ message: 'Item deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/portfolio/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { title, descriptionCS, descriptionEN, tags } = req.body;
        const description = JSON.stringify({ cs: descriptionCS || '', en: descriptionEN || '' });
        const finalTitle = title || '';
        
        await dbAsync.run(
            'UPDATE portfolio_items SET title = ?, description = ?, tags = ? WHERE id = ?',
            [finalTitle, description, tags || '', req.params.id]
        );
        res.json({ message: 'Item updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/folders', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { titleCS, titleEN } = req.body;
        if (!titleCS || !titleEN) return res.status(400).json({ error: 'Titles are required' });
        
        // Generate category_id from English title (uppercase, no spaces)
        const categoryId = titleEN.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
        
        await dbAsync.run(
            'INSERT INTO folders (title_cs, title_en, category_id) VALUES (?, ?, ?)',
            [titleCS, titleEN, categoryId]
        );
        res.json({ message: 'Folder created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/folders/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        
        // 1. Get folder info to find category_id
        const folder = await dbAsync.get('SELECT category_id FROM folders WHERE id = ?', [id]);
        if (!folder) return res.status(404).json({ error: 'Folder not found' });

        const categoryId = folder.category_id;

        // 2. Find all items in this category
        const items = await dbAsync.all('SELECT id, media_url, thumbnail_url FROM portfolio_items WHERE category = ?', [categoryId]);

        // 3. Delete files for each item
        for (const item of items) {
            if (item.media_url && item.media_url.startsWith('/uploads/')) {
                const filePath = path.join(__dirname, 'public', item.media_url);
                if (fs.existsSync(filePath)) {
                    try { fs.unlinkSync(filePath); } catch (e) { console.error(`Failed to delete file: ${filePath}`, e); }
                }
            }
            if (item.thumbnail_url && item.thumbnail_url.startsWith('/uploads/') && item.thumbnail_url !== item.media_url) {
                const thumbPath = path.join(__dirname, 'public', item.thumbnail_url);
                if (fs.existsSync(thumbPath)) {
                    try { fs.unlinkSync(thumbPath); } catch (e) { console.error(`Failed to delete thumbnail: ${thumbPath}`, e); }
                }
            }
        }

        // 4. Delete items from DB
        await dbAsync.run('DELETE FROM portfolio_items WHERE category = ?', [categoryId]);

        // 5. Finally delete the folder
        await dbAsync.run('DELETE FROM folders WHERE id = ?', [id]);

        res.json({ message: 'Folder and all its content deleted successfully' });
    } catch (err) {
        console.error('CASCADE_DELETE_ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// Batch Delete Portfolio Items
app.post('/api/portfolio/batch-delete', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'Invalid IDs' });

        for (const id of ids) {
            const item = await dbAsync.get('SELECT media_url, thumbnail_url FROM portfolio_items WHERE id = ?', [id]);
            if (item) {
                if (item.media_url && item.media_url.startsWith('/uploads/')) {
                    const filePath = path.join(__dirname, 'public', item.media_url);
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }
                if (item.thumbnail_url && item.thumbnail_url.startsWith('/uploads/') && item.thumbnail_url !== item.media_url) {
                    const thumbPath = path.join(__dirname, 'public', item.thumbnail_url);
                    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
                }
            }
            await dbAsync.run('DELETE FROM portfolio_items WHERE id = ?', [id]);
        }
        res.json({ message: `${ids.length} items deleted successfully` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reorder Portfolio Items
app.post('/api/portfolio/reorder', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { orders } = req.body; // Array of { id, sort_order }
        if (!orders || !Array.isArray(orders)) return res.status(400).json({ error: 'Invalid order data' });

        const stmt = await dbAsync.run('BEGIN TRANSACTION');
        try {
            for (const item of orders) {
                await dbAsync.run('UPDATE portfolio_items SET sort_order = ? WHERE id = ?', [item.sort_order, item.id]);
            }
            await dbAsync.run('COMMIT');
            res.json({ message: 'Order updated successfully' });
        } catch (err) {
            await dbAsync.run('ROLLBACK');
            throw err;
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});




// 4. Testimonials (Public)
app.get('/api/testimonials', async (req, res) => {
    try {
        const items = await dbAsync.all('SELECT * FROM testimonials ORDER BY created_at DESC');
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/testimonials', verifyToken, requireAdmin, uploadAvatar.single('avatar'), async (req, res) => {
    try {
        console.log('--- TESTIMONIAL UPLOAD START ---');
        console.log('Body:', req.body);
        console.log('File uploaded:', !!req.file);

        const { clientName, project, quoteCS, quoteEN } = req.body;
        if (!clientName || !quoteCS) {
            console.warn('Validation failed: Missing clientName or quoteCS');
            return res.status(400).json({ error: 'Client name and Czech quote are required' });
        }

        let avatarUrl = null;
        
        if (req.file) {
            if (req.file.mimetype.startsWith('image/')) {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const filename = uniqueSuffix + '.webp';
                const outputPath = path.join(avatarDir, filename);

                await sharp(req.file.buffer)
                    .resize({ width: 800, withoutEnlargement: true })
                    .webp({ quality: 85 })
                    .toFile(outputPath);
                
                avatarUrl = '/uploads/avatars/' + filename;
            } else {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const ext = path.extname(req.file.originalname);
                const filename = uniqueSuffix + ext;
                const outputPath = path.join(avatarDir, filename);
                fs.writeFileSync(outputPath, req.file.buffer);
                avatarUrl = '/uploads/avatars/' + filename;
            }
        }

        await dbAsync.run(
            'INSERT INTO testimonials (client_name, project, quote, quote_en, avatar_url) VALUES (?, ?, ?, ?, ?)',
            [clientName, project || '', quoteCS, quoteEN || '', avatarUrl]
        );

        console.log('Testimonial inserted successfully');
        res.json({ message: 'Testimonial added successfully' });
    } catch (err) {
        console.error('Testimonial upload ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/testimonials/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const testimonial = await dbAsync.get('SELECT avatar_url FROM testimonials WHERE id = ?', [req.params.id]);
        if (testimonial && testimonial.avatar_url && testimonial.avatar_url.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, 'public', testimonial.avatar_url);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await dbAsync.run('DELETE FROM testimonials WHERE id = ?', [req.params.id]);
        res.json({ message: 'Testimonial deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Contact Form (Public)
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, instagram, project_type, budget, message } = req.body;
        
        // Save to DB
        await dbAsync.run(
            `INSERT INTO messages (name, email, instagram, project_type, budget, message) VALUES (?, ?, ?, ?, ?, ?)`,
            [name, email, instagram, project_type, budget, message]
        );

        // Send Emails (Non-blocking)
        notifyAdmin(name, email, project_type, budget, message, instagram).catch(err => console.error("Admin mail fail:", err));
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

app.patch('/api/admin/messages/:id/status', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { is_completed } = req.body;
        await dbAsync.run(
            'UPDATE messages SET is_completed = ? WHERE id = ?',
            [is_completed ? 1 : 0, req.params.id]
        );
        res.json({ message: 'Message status updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/folders/update/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { titleCS, titleEN } = req.body;
        if (!titleCS || !titleEN) return res.status(400).json({ error: 'Titles are required' });
        
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

        await dbAsync.run(
            'UPDATE folders SET title_cs = ?, title_en = ? WHERE id = ?',
            [titleCS, titleEN, id]
        );
        res.json({ message: 'Folder updated successfully' });
    } catch (err) {
        console.error('FOLDER_UPDATE_ERROR:', err);
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

// JSON 404 for unknown API routes
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

// SPA Catch-all
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('GLOBAL_ERROR:', err);
    res.status(err.status || 500).json({ 
        error: err.message || 'INTERNAL_SERVER_ERROR'
    });
});

// STARTUP DB CHECK: Strictly enforce admin role ONLY for the main email in .env
dbAsync.run("UPDATE users SET role = 'user'").then(() => {
    return dbAsync.run(
        "UPDATE users SET role = 'admin', full_name = 'KARBY ADMIN' WHERE email = ?",
        [process.env.ADMIN_EMAIL]
    );
}).then(() => console.log('Admin policy enforced: ONLY .env account is admin.'))
  .catch(err => console.error('Admin policy enforcement failed:', err));

const server = app.listen(PORT, () => {
    console.log(`TACTICAL_COMMAND_CENTER_READY at http://localhost:${PORT}`);
});

// Set timeout to 10 minutes for large uploads
server.timeout = 600000;
