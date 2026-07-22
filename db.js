const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs');
require('dotenv').config();

const dbPath = path.resolve(__dirname, 'data', 'database.sqlite');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to SQLite:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Wrapper to use Promises with SQLite
const dbAsync = {
    get: (query, params = []) => new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err); else resolve(row);
        });
    }),
    all: (query, params = []) => new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    }),
    run: (query, params = []) => new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) reject(err); else resolve(this);
        });
    })
};

// Force migration for existing database (pre-init)
async function runForceMigrations() {
    try {
        await dbAsync.run("ALTER TABLE messages ADD COLUMN is_completed INTEGER DEFAULT 0");
    } catch (err) {
        if (err && !err.message.includes("duplicate column name") && !err.message.includes("no such table")) {
            console.log('Migration info:', err.message);
        }
    }
    try {
        await dbAsync.run("ALTER TABLE messages ADD COLUMN instagram TEXT");
    } catch (err) {
        if (err && !err.message.includes("duplicate column name") && !err.message.includes("no such table")) {
            console.log('Migration info:', err.message);
        }
    }
}

async function initDb() {
    // Enable WAL mode and Busy Timeout
    await dbAsync.run("PRAGMA journal_mode=WAL");
    await dbAsync.run("PRAGMA busy_timeout=5000");

    // Run basic migrations that might fail if tables don't exist yet (handled gracefully)
    await runForceMigrations();

    // Create users table
    await dbAsync.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create Folders table
    await dbAsync.run(`CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title_cs TEXT NOT NULL,
        title_en TEXT NOT NULL,
        category_id TEXT UNIQUE NOT NULL,
        icon_url TEXT DEFAULT '/assets/folder-icon.png',
        parent_id INTEGER DEFAULT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Migration for folders table (parent_id, sort_order)
    try {
        const columns = await dbAsync.all("PRAGMA table_info(folders)");
        const hasParentId = columns.some(c => c.name === 'parent_id');
        if (!hasParentId) {
            await dbAsync.run("ALTER TABLE folders ADD COLUMN parent_id INTEGER DEFAULT NULL");
        }
        const hasSortOrder = columns.some(c => c.name === 'sort_order');
        if (!hasSortOrder) {
            await dbAsync.run("ALTER TABLE folders ADD COLUMN sort_order INTEGER DEFAULT 0");
        }
    } catch (err) {
        console.error('Error checking folders columns:', err.message);
    }

    // Check if full_name column exists (migration helper for existing tables)
    try {
        const columns = await dbAsync.all("PRAGMA table_info(users)");
        const hasFullName = columns.some(c => c.name === 'full_name');
        if (!hasFullName) {
            await dbAsync.run("ALTER TABLE users ADD COLUMN full_name TEXT");
        }
    } catch (err) {
        console.error('Error checking users columns:', err.message);
    }

    // Create Portfolio Items table
    await dbAsync.run(`CREATE TABLE IF NOT EXISTS portfolio_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        media_url TEXT,
        thumbnail_url TEXT,
        tags TEXT,
        is_featured INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create Testimonials table
    await dbAsync.run(`CREATE TABLE IF NOT EXISTS testimonials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_name TEXT NOT NULL,
        project TEXT,
        quote TEXT NOT NULL,
        quote_en TEXT,
        avatar_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Migration for testimonials
    try {
        const columns = await dbAsync.all("PRAGMA table_info(testimonials)");
        const hasQuoteEn = columns.some(c => c.name === 'quote_en');
        const hasAvatar = columns.some(c => c.name === 'avatar_url');
        if (!hasQuoteEn) {
            await dbAsync.run("ALTER TABLE testimonials ADD COLUMN quote_en TEXT");
        }
        if (!hasAvatar) {
            await dbAsync.run("ALTER TABLE testimonials ADD COLUMN avatar_url TEXT");
        }
    } catch (err) {
        console.error('Error checking testimonials columns:', err.message);
    }

    // Create Messages table
    await dbAsync.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        instagram TEXT,
        project_type TEXT,
        budget TEXT,
        message TEXT NOT NULL,
        is_completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Migration for messages
    try {
        const columns = await dbAsync.all("PRAGMA table_info(messages)");
        const hasIsCompleted = columns.some(c => c.name === 'is_completed');
        if (!hasIsCompleted) {
            await dbAsync.run("ALTER TABLE messages ADD COLUMN is_completed INTEGER DEFAULT 0");
        }
    } catch (err) {
        console.error('Error checking messages columns:', err.message);
    }

    // Create Settings table
    await dbAsync.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Seed Hero Video URL if not exists
    try {
        const row = await dbAsync.get(`SELECT * FROM settings WHERE key = 'hero_video_url'`);
        if (!row) {
            await dbAsync.run(`INSERT INTO settings (key, value) VALUES (?, ?)`, 
                ['hero_video_url', 'https://www.youtube.com/embed/_VWkv_ONEiM?autoplay=1&mute=1&loop=1&playlist=_VWkv_ONEiM&modestbranding=1&rel=0&controls=1']);
        }
    } catch (err) {
        console.error('Error seeding settings:', err.message);
    }

    // Sync Admin User from .env
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
        try {
            const row = await dbAsync.get(`SELECT * FROM users WHERE email = ?`, [process.env.ADMIN_EMAIL]);
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, salt);
            if (!row) {
                await dbAsync.run(`INSERT INTO users (email, full_name, password_hash, role) VALUES (?, ?, ?, ?)`, 
                    [process.env.ADMIN_EMAIL, 'System Admin', hash, 'admin']);
                console.log('Admin user seeded from .env.');
            } else {
                await dbAsync.run(`UPDATE users SET password_hash = ?, role = 'admin' WHERE email = ?`, 
                    [hash, process.env.ADMIN_EMAIL]);
                console.log('Admin user password synced from .env.');
            }
        } catch (err) {
            console.error('Error seeding admin user:', err.message);
        }
    }

    // Seed some dummy portfolio items if empty
    try {
        const row = await dbAsync.get(`SELECT COUNT(*) as count FROM portfolio_items`);
        if (row && row.count === 0) {
            const dummyItems = [
                { title: 'NIGHT RUN', category: 'VIDEO PRODUCTION', description: 'Cinematic car commercial shot at night.', media_url: 'https://vimeo.com/76979871', thumbnail_url: '/uploads/dummy1.jpg' },
                { title: 'AESTHETIC NOISE', category: 'EDITING', description: 'Music video editing with glitch art.', media_url: 'https://vimeo.com/76979871', thumbnail_url: '/uploads/dummy2.jpg' },
                { title: 'BALENCIAGA FW', category: 'CINEMATOGRAPHY', description: 'Runway B-roll coverage.', media_url: 'https://vimeo.com/76979871', thumbnail_url: '/uploads/dummy3.jpg' },
                { title: 'URBAN DECAY', category: 'PHOTOGRAPHY', description: 'Brutalist architecture photo series.', media_url: '/uploads/dummy4.jpg', thumbnail_url: '/uploads/dummy4.jpg' }
            ];

            for (const item of dummyItems) {
                await dbAsync.run(`INSERT INTO portfolio_items (title, category, description, media_url, thumbnail_url) VALUES (?, ?, ?, ?, ?)`,
                    [item.title, item.category, item.description, item.media_url, item.thumbnail_url]);
            }
            console.log('Dummy portfolio items seeded.');
        }
    } catch (err) {
        console.error('Error seeding portfolio:', err.message);
    }

    // Seed default folders if empty
    try {
        const row = await dbAsync.get(`SELECT COUNT(*) as count FROM folders`);
        if (row && row.count === 0) {
            const defaultFolders = [
                { cs: 'Fotky', en: 'Photos', category: 'PHOTOGRAPHY' },
                { cs: 'Videoklipy', en: 'Music Videos', category: 'VIDEOKLIPY' },
                { cs: 'Tiktok videa', en: 'Tiktok Videos', category: 'TIKTOK' },
                { cs: 'Instagram videa', en: 'Instagram Videos', category: 'INSTAGRAM' },
                { cs: 'Youtube videa', en: 'Youtube Videos', category: 'YOUTUBE' },
                { cs: 'Akce', en: 'Events', category: 'AKCE' }
            ];
            for (const f of defaultFolders) {
                await dbAsync.run(`INSERT INTO folders (title_cs, title_en, category_id) VALUES (?, ?, ?)`, [f.cs, f.en, f.category]);
            }
            console.log('Default folders seeded.');
        }
    } catch (err) {
        console.error('Error seeding folders:', err.message);
    }
    
    // Testimonials seeding s originálními recenzemi
    try {
        const row = await dbAsync.get(`SELECT COUNT(*) as count FROM testimonials`);
        if (row && row.count === 0) {
            const originalReviews = [
               { name: 'nayssone01', project: '', cs: 'Díky za dnešek, bomba uplně, až budeš mít, hned posílej', en: 'Thanks for today, absolutely bomb, as soon as you have it, send it', avatar: '/assets/fotky profilovek/Snímek obrazovky 2026-04-21 202602.jpg' },
               { name: 'pbsaam', project: '', cs: 'hele kamo pokracuj dal delas neco co tady v cesku chybi beres to vazne a jde to videt z prace co delas big up fotky a stříh popici', en: 'hey bro keep going you\'re doing something that is missing here in Czechia you take it seriously and it shows in your work big up photos and editing are sick', avatar: '/assets/fotky profilovek/pbsaam.jpg' },
               { name: 'lilstat__', project: '', cs: 'Velmi talentovaný, skvělá spolupráce, vřele doporučuji, určitě se brzy ozvu znovu', en: 'Very talented, great collaboration, highly recommended, will definitely be in touch soon', avatar: '/assets/fotky profilovek/lilstat__.jpg' },
               { name: 'nayssone01', project: '', cs: 'Fakt super práce kamo az to dodelas tak ti poslu dalsi jmena fotky atd', en: 'Really great work bro, when you finish it I\'ll send you more names photos etc', avatar: '/assets/fotky profilovek/Snímek obrazovky 2026-04-21 202602.jpg' },
               { name: 'nikofadess', project: '', cs: 'braaaaaaaacho extremne to je diki moooc', en: 'broooooo this is extremely good thanks a looooot', avatar: '/assets/fotky profilovek/nikofadess.jpg' },
               { name: 'nayssone01', project: '', cs: 'Top práce, těším se na další věci! Diky!', en: 'Top work, looking forward to the next stuff! Thanks!', avatar: '/assets/fotky profilovek/Snímek obrazovky 2026-04-21 202602.jpg' },
               { name: 'nikofadess', project: '', cs: 'predtym to bolo ppci kamo a teraz uplny strop', en: 'before it was dope bro and now it\'s absolute peak', avatar: '/assets/fotky profilovek/nikofadess.jpg' }
            ];

            for (const r of originalReviews) {
                await dbAsync.run(`INSERT INTO testimonials (client_name, project, quote, quote_en, avatar_url) VALUES (?, ?, ?, ?, ?)`,
                    [r.name, r.project, r.cs, r.en, r.avatar]);
            }
            console.log('Original DM reviews seeded to database.');
        }
    } catch (err) {
        console.error('Error seeding testimonials:', err.message);
    }
}

// Promise that resolves when DB is connected, initialized and fully seeded
const dbInitialized = new Promise((resolve, reject) => {
    db.serialize(() => {
        initDb()
            .then(() => {
                console.log('Database initialization and seeding completed.');
                resolve();
            })
            .catch((err) => {
                console.error('Database initialization failed:', err);
                reject(err);
            });
    });
});

module.exports = { db, dbAsync, dbInitialized };
