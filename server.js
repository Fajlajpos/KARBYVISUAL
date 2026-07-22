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
const { dbAsync, dbInitialized } = require('./db');
const { createToken, verifyToken, requireAdmin } = require('./auth');
const { notifyAdmin, sendAutoReply } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable Trust Proxy for VPS deployment (Nginx secure HTTPS cookies support)
app.set('trust proxy', 1);

// Setup Uploads Directory (Ensure it exists)
const uploadDir = path.join(__dirname, 'public', 'uploads');
const tmpUploadDir = path.join(uploadDir, 'tmp');
const avatarDir = path.join(uploadDir, 'avatars');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(tmpUploadDir)) fs.mkdirSync(tmpUploadDir, { recursive: true });
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

// Robust file deletion helper to prevent Windows file-lock blockages
function safeDeleteFile(relativeUrl) {
    if (!relativeUrl || typeof relativeUrl !== 'string' || !relativeUrl.startsWith('/uploads/')) {
        return;
    }
    // Prevent directory traversal
    const normalized = path.normalize(relativeUrl).replace(/^(\.\.(\/|\\))+/, '');
    const filePath = path.join(__dirname, 'public', normalized);
    
    // Safety check: ensure the resolved path stays inside public/uploads
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!filePath.startsWith(uploadDir)) {
        console.warn(`[SECURITY] Blocked potential directory traversal attempt for path: ${filePath}`);
        return;
    }

    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            console.log(`[FILE_SYSTEM] Successfully deleted file: ${filePath}`);
        } catch (err) {
            console.error(`[FILE_SYSTEM] Failed to delete file on primary attempt: ${filePath}. Error: ${err.message}`);
            
            // Retry after 1.5 seconds if file is locked (typical Windows behavior)
            setTimeout(() => {
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`[FILE_SYSTEM] Successfully deleted file on retry: ${filePath}`);
                    }
                } catch (retryErr) {
                    console.error(`[FILE_SYSTEM] Permanent failure deleting file: ${filePath}. Error: ${retryErr.message}`);
                }
            }, 1500);
        }
    }
}

// Helper to clean up any remaining temporary upload files (in tmp/) to prevent disk leaks
function cleanUpTempFiles(req) {
    if (req.files) {
        Object.keys(req.files).forEach(key => {
            const files = req.files[key];
            if (Array.isArray(files)) {
                files.forEach(file => {
                    if (file.path && fs.existsSync(file.path)) {
                        try {
                            fs.unlinkSync(file.path);
                            console.log(`[FILE_SYSTEM] Cleaned up temporary file: ${file.path}`);
                        } catch (e) {
                            console.error(`[FILE_SYSTEM] Failed to clean up temp file ${file.path}:`, e.message);
                        }
                    }
                });
            }
        });
    }
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
            fs.unlinkSync(req.file.path);
            console.log(`[FILE_SYSTEM] Cleaned up temporary avatar/file: ${req.file.path}`);
        } catch (e) {
            console.error(`[FILE_SYSTEM] Failed to clean up temp file ${req.file.path}:`, e.message);
        }
    }
}

// Helper to sanitize HTML inputs to prevent XSS (Cross-Site Scripting)
function sanitizeInput(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

// Multer Storage config - Disk Storage for Sharp processing (avoids memory overload)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, tmpUploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100 MB limit
});
const uploadAvatar = multer({ 
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 } // 20 MB limit
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

const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // limit each IP to 3 contact submissions per 15 minutes
    message: { error: "Příliš mnoho odeslaných zpráv. Zkuste to prosím znovu za 15 minut." }
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
        const folders = await dbAsync.all('SELECT * FROM folders ORDER BY sort_order ASC, id ASC');
        res.json(folders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Admin Portfolio Actions (Protected)
app.post('/api/portfolio', verifyToken, requireAdmin, upload.fields([{ name: 'media', maxCount: 20 }, { name: 'thumbnail', maxCount: 1 }]), async (req, res) => {
    try {
        const { title, category, mediaType, vimeoUrl, descriptionCS, descriptionEN, tags } = req.body;
        const finalTitle = title || '';
        
        const mediaFiles = req.files && req.files['media'] ? req.files['media'] : [];
        const thumbnailFile = req.files && req.files['thumbnail'] && req.files['thumbnail'][0];

        let uploadedThumbnailUrl = null;
        if (thumbnailFile) {
            if (thumbnailFile.mimetype.startsWith('image/')) {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const filename = 'thumb-' + uniqueSuffix + '.webp';
                const outputPath = path.join(uploadDir, filename);

                await sharp(thumbnailFile.path)
                    .resize({ width: 1280, withoutEnlargement: true })
                    .webp({ quality: 85 })
                    .toFile(outputPath);

                uploadedThumbnailUrl = '/uploads/' + filename;
            } else {
                return res.status(400).json({ error: 'Náhledový obrázek musí být obrázek.' });
            }
        }

        // Handle External URL (YouTube, Vimeo, Instagram, etc.)
        if (mediaType === 'vimeo' && vimeoUrl) {
            const isInstagram = /instagram\.com/i.test(vimeoUrl);
            if (isInstagram) {
                // Validate Instagram Reel URL format if it's Instagram
                const igPattern = /instagram\.com\/(reel|p)\/[A-Za-z0-9_-]+/i;
                if (!igPattern.test(vimeoUrl)) {
                    return res.status(400).json({ error: 'Neplatný formát Instagram URL. Použij např. https://www.instagram.com/reel/...' });
                }
            }
            
            const isTikTok = /tiktok\.com/i.test(vimeoUrl);
            if (isTikTok) {
                // Validate TikTok URL format (standard, mobile short urls vt/vm/t)
                const tiktokPattern = /tiktok\.com\/(?:@(?:[A-Za-z0-9_\.]+)\/video\/(\d+)|(?:vm|vt|t)\.tiktok\.com\/[A-Za-z0-9_-]+)/i;
                if (!tiktokPattern.test(vimeoUrl)) {
                    return res.status(400).json({ error: 'Neplatný formát TikTok URL. Použij např. https://www.tiktok.com/@uzivatel/video/... nebo vm.tiktok.com/...' });
                }

                // Auto-fetch oEmbed thumbnail if no custom thumbnail was uploaded
                if (!uploadedThumbnailUrl) {
                    try {
                        let targetUrlForOembed = vimeoUrl;
                        if (/vm\.tiktok\.com|vt\.tiktok\.com|t\.tiktok\.com/i.test(vimeoUrl)) {
                            const resolveRes = await fetch(vimeoUrl, { 
                                method: 'GET', 
                                redirect: 'follow',
                                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                            });
                            if (resolveRes.ok) {
                                targetUrlForOembed = resolveRes.url;
                            }
                        }
                        
                        const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrlForOembed)}`;
                        const oembedRes = await fetch(oembedUrl);
                        if (oembedRes.ok) {
                            const oembedData = await oembedRes.json();
                            const tiktokThumbUrl = oembedData.thumbnail_url;
                            
                            if (tiktokThumbUrl) {
                                const imgRes = await fetch(tiktokThumbUrl);
                                if (imgRes.ok) {
                                    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
                                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                                    const filename = 'thumb-tiktok-' + uniqueSuffix + '.webp';
                                    const outputPath = path.join(uploadDir, filename);
                                    
                                    await sharp(imgBuffer)
                                        .resize({ width: 1280, withoutEnlargement: true })
                                        .webp({ quality: 85 })
                                        .toFile(outputPath);
                                        
                                    uploadedThumbnailUrl = '/uploads/' + filename;
                                }
                            }
                        }
                    } catch (oembedErr) {
                        console.error('TikTok oEmbed auto-thumbnail fetch failed:', oembedErr);
                    }
                }
            }

            const description = JSON.stringify({ cs: descriptionCS || '', en: descriptionEN || '' });
            await dbAsync.run(
                `INSERT INTO portfolio_items (title, category, description, media_url, thumbnail_url, tags) VALUES (?, ?, ?, ?, ?, ?)`,
                [finalTitle, category, description, vimeoUrl, uploadedThumbnailUrl, tags]
            );
            return res.json({ message: 'Portfolio item created successfully' });
        }

        // Handle Multiple Files
        if (!mediaFiles || mediaFiles.length === 0) {
            return res.status(400).json({ error: 'No media files uploaded' });
        }

        const description = JSON.stringify({ cs: descriptionCS || '', en: descriptionEN || '' });

        for (const file of mediaFiles) {
            let finalMediaUrl = '';
            let thumbnail_url = null;

            if (file.mimetype.startsWith('image/')) {
                // Process image with Sharp
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const filename = uniqueSuffix + '.webp';
                const outputPath = path.join(uploadDir, filename);

                await sharp(file.path)
                    .resize({ width: 2560, withoutEnlargement: true })
                    .webp({ quality: 85 })
                    .toFile(outputPath);

                finalMediaUrl = '/uploads/' + filename;
                thumbnail_url = uploadedThumbnailUrl || finalMediaUrl;
            } else {
                // Fallback for non-images (if uploaded) - move from tmp/ to final destination
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname);
                const filename = uniqueSuffix + ext;
                const outputPath = path.join(uploadDir, filename);
                
                try {
                    fs.renameSync(file.path, outputPath);
                } catch (renameErr) {
                    fs.copyFileSync(file.path, outputPath);
                    fs.unlinkSync(file.path);
                }
                
                finalMediaUrl = '/uploads/' + filename;
                thumbnail_url = uploadedThumbnailUrl; // Use the uploaded custom thumbnail for video
            }

            await dbAsync.run(
                `INSERT INTO portfolio_items (title, category, description, media_url, thumbnail_url, tags) VALUES (?, ?, ?, ?, ?, ?)`,
                [finalTitle, category, description, finalMediaUrl, thumbnail_url, tags]
            );
        }

        res.json({ message: `${mediaFiles.length} items created successfully` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        cleanUpTempFiles(req);
    }
});

app.delete('/api/portfolio/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const item = await dbAsync.get('SELECT media_url, thumbnail_url FROM portfolio_items WHERE id = ?', [req.params.id]);
        if (item) {
            safeDeleteFile(item.media_url);
            if (item.thumbnail_url !== item.media_url) {
                safeDeleteFile(item.thumbnail_url);
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
        const { titleCS, titleEN, parentId } = req.body;
        if (!titleCS || !titleEN) return res.status(400).json({ error: 'Titles are required' });
        
        let baseSlug = titleEN.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
        if (!baseSlug) baseSlug = 'FOLDER';

        let categoryId = baseSlug;
        const parentIdValue = parentId ? parseInt(parentId, 10) : null;

        if (parentIdValue) {
            categoryId = 'SUB_' + baseSlug + '_' + Date.now().toString(36).toUpperCase();
        } else {
            const existing = await dbAsync.get('SELECT id FROM folders WHERE category_id = ?', [baseSlug]);
            if (existing) {
                categoryId = baseSlug + '_' + Date.now().toString(36).toUpperCase();
            }
        }
        
        await dbAsync.run(
            'INSERT INTO folders (title_cs, title_en, category_id, parent_id) VALUES (?, ?, ?, ?)',
            [titleCS, titleEN, categoryId, parentIdValue]
        );
        res.json({ message: 'Folder created successfully', category_id: categoryId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/folders/reorder', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { orders } = req.body;
        if (!Array.isArray(orders)) return res.status(400).json({ error: 'Orders array is required' });
        
        for (const item of orders) {
            if (item.id) {
                await dbAsync.run('UPDATE folders SET sort_order = ? WHERE id = ?', [item.sort_order || 0, item.id]);
            }
        }
        res.json({ message: 'Folders reordered successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/folders/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        
        async function deleteSingleFolder(folderId) {
            const folder = await dbAsync.get('SELECT id, category_id FROM folders WHERE id = ?', [folderId]);
            if (!folder) return;
            
            // Delete all subfolders first recursively
            const subfolders = await dbAsync.all('SELECT id FROM folders WHERE parent_id = ?', [folderId]);
            for (const sf of subfolders) {
                await deleteSingleFolder(sf.id);
            }

            // Find all items in this category
            const items = await dbAsync.all('SELECT id, media_url, thumbnail_url FROM portfolio_items WHERE category = ?', [folder.category_id]);
            for (const item of items) {
                safeDeleteFile(item.media_url);
                if (item.thumbnail_url !== item.media_url) {
                    safeDeleteFile(item.thumbnail_url);
                }
            }
            await dbAsync.run('DELETE FROM portfolio_items WHERE category = ?', [folder.category_id]);
            await dbAsync.run('DELETE FROM folders WHERE id = ?', [folderId]);
        }

        const targetFolder = await dbAsync.get('SELECT id FROM folders WHERE id = ?', [id]);
        if (!targetFolder) return res.status(404).json({ error: 'Folder not found' });

        await deleteSingleFolder(id);

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
                safeDeleteFile(item.media_url);
                if (item.thumbnail_url !== item.media_url) {
                    safeDeleteFile(item.thumbnail_url);
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

                await sharp(req.file.path)
                    .resize({ width: 800, withoutEnlargement: true })
                    .webp({ quality: 85 })
                    .toFile(outputPath);
                
                avatarUrl = '/uploads/avatars/' + filename;
            } else {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const ext = path.extname(req.file.originalname);
                const filename = uniqueSuffix + ext;
                const outputPath = path.join(avatarDir, filename);
                
                try {
                    fs.renameSync(req.file.path, outputPath);
                } catch (renameErr) {
                    fs.copyFileSync(req.file.path, outputPath);
                    fs.unlinkSync(req.file.path);
                }
                
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
    } finally {
        cleanUpTempFiles(req);
    }
});

app.delete('/api/testimonials/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const testimonial = await dbAsync.get('SELECT avatar_url FROM testimonials WHERE id = ?', [req.params.id]);
        if (testimonial) {
            safeDeleteFile(testimonial.avatar_url);
        }
        await dbAsync.run('DELETE FROM testimonials WHERE id = ?', [req.params.id]);
        res.json({ message: 'Testimonial deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Contact Form (Public)
app.post('/api/contact', contactLimiter, async (req, res) => {
    try {
        const name = sanitizeInput(req.body.name);
        const email = req.body.email || '';
        const instagram = sanitizeInput(req.body.instagram);
        const project_type = sanitizeInput(req.body.project_type);
        const budget = sanitizeInput(req.body.budget);
        const message = sanitizeInput(req.body.message);
        
        // Basic Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            return res.status(400).json({ error: 'Neplatný formát e-mailové adresy.' });
        }
        
        // Save to DB
        await dbAsync.run(
            `INSERT INTO messages (name, email, instagram, project_type, budget, message) VALUES (?, ?, ?, ?, ?, ?)`,
            [name, email, instagram, project_type, budget, message]
        );

        // Send Emails (Non-blocking, using sanitized safe strings)
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

// Function to clean temporary uploads directory
function cleanTempUploadDirectory() {
    const tmpDir = path.join(__dirname, 'public', 'uploads', 'tmp');
    if (fs.existsSync(tmpDir)) {
        try {
            const files = fs.readdirSync(tmpDir);
            let cleanedCount = 0;
            files.forEach(file => {
                const filePath = path.join(tmpDir, file);
                try {
                    const stat = fs.statSync(filePath);
                    if (stat.isFile()) {
                        fs.unlinkSync(filePath);
                        cleanedCount++;
                    }
                } catch (fileErr) {
                    console.error(`[FILE_SYSTEM] Failed to clean up file ${file}:`, fileErr.message);
                }
            });
            if (cleanedCount > 0) {
                console.log(`[FILE_SYSTEM] Successfully cleaned up ${cleanedCount} temporary upload file(s).`);
            } else {
                console.log('[FILE_SYSTEM] Temporary upload directory is already clean.');
            }
        } catch (err) {
            console.error('[FILE_SYSTEM] Failed to read temporary upload directory:', err.message);
        }
    }
}

// Wait for DB to be completely connected, initialized and seeded before starting server
dbInitialized.then(() => {
    // 1. Clean the tmp uploads directory on start
    cleanTempUploadDirectory();

    // 2. Enforce admin role policy
    return dbAsync.run("UPDATE users SET role = 'user'").then(() => {
        return dbAsync.run(
            "UPDATE users SET role = 'admin', full_name = 'KARBY ADMIN' WHERE email = ?",
            [process.env.ADMIN_EMAIL]
        );
    }).then(() => console.log('Admin policy enforced: ONLY .env account is admin.'));
}).then(() => {
    // 3. Start the server
    const server = app.listen(PORT, () => {
        console.log(`TACTICAL_COMMAND_CENTER_READY at http://localhost:${PORT}`);
    });
    // Set timeout to 10 minutes for large uploads
    server.timeout = 600000;
}).catch(err => {
    console.error('CRITICAL: Server initialization sequence failed:', err);
    process.exit(1);
});
