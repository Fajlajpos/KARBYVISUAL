const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to SQLite:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

// Force migration for existing database
db.serialize(() => {
    db.run("ALTER TABLE messages ADD COLUMN is_completed INTEGER DEFAULT 0", (err) => {
        // If it already exists, this will error, which is fine
        if (err && !err.message.includes("duplicate column name")) {
            console.log('Migration info:', err.message);
        }
    });
});

function initDb() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Folders table
        db.run(`CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title_cs TEXT NOT NULL,
            title_en TEXT NOT NULL,
            category_id TEXT UNIQUE NOT NULL,
            icon_url TEXT DEFAULT '/assets/folder-icon.png',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Check if full_name column exists (migration helper for existing tables)
        db.all("PRAGMA table_info(users)", (err, columns) => {
            if (err) return;
            const hasFullName = columns.some(c => c.name === 'full_name');
            if (!hasFullName) {
                db.run("ALTER TABLE users ADD COLUMN full_name TEXT");
            }
        });

        // Create Portfolio Items table
        db.run(`CREATE TABLE IF NOT EXISTS portfolio_items (
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
        db.run(`CREATE TABLE IF NOT EXISTS testimonials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_name TEXT NOT NULL,
            project TEXT,
            quote TEXT NOT NULL,
            quote_en TEXT,
            avatar_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Migration for testimonials
        db.all("PRAGMA table_info(testimonials)", (err, columns) => {
            if (err) return;
            const hasQuoteEn = columns.some(c => c.name === 'quote_en');
            const hasAvatar = columns.some(c => c.name === 'avatar_url');
            if (!hasQuoteEn) {
                db.run("ALTER TABLE testimonials ADD COLUMN quote_en TEXT");
            }
            if (!hasAvatar) {
                db.run("ALTER TABLE testimonials ADD COLUMN avatar_url TEXT");
            }
        });

        // Create Messages table
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            project_type TEXT,
            budget TEXT,
            message TEXT NOT NULL,
            is_completed INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Migration for messages
        db.all("PRAGMA table_info(messages)", (err, columns) => {
            if (err) return;
            const hasIsCompleted = columns.some(c => c.name === 'is_completed');
            if (!hasIsCompleted) {
                db.run("ALTER TABLE messages ADD COLUMN is_completed INTEGER DEFAULT 0");
            }
        });

        // Create Settings table
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Seed Hero Video URL if not exists
        db.get(`SELECT * FROM settings WHERE key = 'hero_video_url'`, (err, row) => {
            if (!row) {
                db.run(`INSERT INTO settings (key, value) VALUES (?, ?)`, 
                    ['hero_video_url', 'https://www.youtube.com/embed/_VWkv_ONEiM?autoplay=0&modestbranding=1&rel=0']);
            }
        });

        // Sync Admin User from .env
        if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
            db.get(`SELECT * FROM users WHERE email = ?`, [process.env.ADMIN_EMAIL], async (err, row) => {
                const salt = await bcrypt.genSalt(10);
                const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, salt);
                if (!row) {
                    db.run(`INSERT INTO users (email, full_name, password_hash, role) VALUES (?, ?, ?, ?)`, 
                        [process.env.ADMIN_EMAIL, 'System Admin', hash, 'admin'], (err) => {
                            if (err) console.error('Error seeding admin:', err.message);
                            else console.log('Admin user seeded from .env.');
                        });
                } else {
                    db.run(`UPDATE users SET password_hash = ?, role = 'admin' WHERE email = ?`, 
                        [hash, process.env.ADMIN_EMAIL], (err) => {
                            if (err) console.error('Error syncing admin:', err.message);
                            else console.log('Admin user password synced from .env.');
                        });
                }
            });
        }

        // Seed some dummy portfolio items if empty
        db.get(`SELECT COUNT(*) as count FROM portfolio_items`, (err, row) => {
            if (row && row.count === 0) {
                const dummyItems = [
                    { title: 'NIGHT RUN', category: 'VIDEO PRODUCTION', description: 'Cinematic car commercial shot at night.', media_url: 'https://vimeo.com/76979871', thumbnail_url: '/uploads/dummy1.jpg' },
                    { title: 'AESTHETIC NOISE', category: 'EDITING', description: 'Music video editing with glitch art.', media_url: 'https://vimeo.com/76979871', thumbnail_url: '/uploads/dummy2.jpg' },
                    { title: 'BALENCIAGA FW', category: 'CINEMATOGRAPHY', description: 'Runway B-roll coverage.', media_url: 'https://vimeo.com/76979871', thumbnail_url: '/uploads/dummy3.jpg' },
                    { title: 'URBAN DECAY', category: 'PHOTOGRAPHY', description: 'Brutalist architecture photo series.', media_url: '/uploads/dummy4.jpg', thumbnail_url: '/uploads/dummy4.jpg' }
                ];

                const stmt = db.prepare(`INSERT INTO portfolio_items (title, category, description, media_url, thumbnail_url) VALUES (?, ?, ?, ?, ?)`);
                dummyItems.forEach(item => {
                    stmt.run(item.title, item.category, item.description, item.media_url, item.thumbnail_url);
                });
                stmt.finalize();
                console.log('Dummy portfolio items seeded.');
            }
        });

        // Seed default folders if empty
        db.get(`SELECT COUNT(*) as count FROM folders`, (err, row) => {
            if (row && row.count === 0) {
                const defaultFolders = [
                    { cs: 'Fotky', en: 'Photos', category: 'PHOTOGRAPHY' },
                    { cs: 'Videoklipy', en: 'Music Videos', category: 'VIDEOKLIPY' },
                    { cs: 'Tiktok videa', en: 'Tiktok Videos', category: 'TIKTOK' },
                    { cs: 'Instagram videa', en: 'Instagram Videos', category: 'INSTAGRAM' },
                    { cs: 'Youtube videa', en: 'Youtube Videos', category: 'YOUTUBE' },
                    { cs: 'Akce', en: 'Events', category: 'AKCE' }
                ];
                const stmt = db.prepare(`INSERT INTO folders (title_cs, title_en, category_id) VALUES (?, ?, ?)`);
                defaultFolders.forEach(f => stmt.run(f.cs, f.en, f.category));
                stmt.finalize();
                console.log('Default folders seeded.');
            }
        });
        
        // Testimonials seeding with original DM reviews
        db.get(`SELECT COUNT(*) as count FROM testimonials`, (err, row) => {
             if (row && row.count === 0) {
                 const stmt = db.prepare(`INSERT INTO testimonials (client_name, project, quote, quote_en, avatar_url) VALUES (?, ?, ?, ?, ?)`);
                 
                 const originalReviews = [
                    { name: 'nayssone01', project: '', cs: 'Díky za dnešek, bomba uplně, až budeš mít, hned posílej', en: 'Thanks for today, absolutely bomb, as soon as you have it, send it', avatar: '/assets/fotky profilovek/Snímek obrazovky 2026-04-21 202602.jpg' },
                    { name: 'pbsaam', project: '', cs: 'hele kamo pokracuj dal delas neco co tady v cesku chybi beres to vazne a jde to videt z prace co delas big up fotky a stříh popici', en: 'hey bro keep going you\'re doing something that is missing here in Czechia you take it seriously and it shows in your work big up photos and editing are sick', avatar: '/assets/fotky profilovek/pbsaam.jpg' },
                    { name: 'lilstat__', project: '', cs: 'Velmi talentovaný, skvělá spolupráce, vřele doporučuji, určitě se brzy ozvu znovu', en: 'Very talented, great collaboration, highly recommended, will definitely be in touch soon', avatar: '/assets/fotky profilovek/lilstat__.jpg' },
                    { name: 'nayssone01', project: '', cs: 'Fakt super práce kamo az to dodelas tak ti poslu dalsi jmena fotky atd', en: 'Really great work bro, when you finish it I\'ll send you more names photos etc', avatar: '/assets/fotky profilovek/Snímek obrazovky 2026-04-21 202602.jpg' },
                    { name: 'nikofadess', project: '', cs: 'braaaaaaaacho extremne to je diki moooc', en: 'broooooo this is extremely good thanks a looooot', avatar: '/assets/fotky profilovek/nikofadess.jpg' },
                    { name: 'nayssone01', project: '', cs: 'Top práce, těším se na další věci! Diky!', en: 'Top work, looking forward to the next stuff! Thanks!', avatar: '/assets/fotky profilovek/Snímek obrazovky 2026-04-21 202602.jpg' },
                    { name: 'nikofadess', project: '', cs: 'predtym to bolo ppci kamo a teraz uplny strop', en: 'before it was dope bro and now it\'s absolute peak', avatar: '/assets/fotky profilovek/nikofadess.jpg' }
                 ];

                 originalReviews.forEach(r => {
                    stmt.run(r.name, r.project, r.cs, r.en, r.avatar);
                 });
                 
                 stmt.finalize();
                 console.log('Original DM reviews seeded to database.');
             }
        });
    });
}

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

module.exports = { db, dbAsync };
