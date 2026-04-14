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

function initDb() {
    db.serialize(() => {
        // Create Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Testimonials table
        db.run(`CREATE TABLE IF NOT EXISTS testimonials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_name TEXT NOT NULL,
            project TEXT,
            quote TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Messages table
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            project_type TEXT,
            budget TEXT,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

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

        // Seed Admin User
        db.get(`SELECT * FROM users WHERE email = ?`, [process.env.ADMIN_EMAIL], async (err, row) => {
            if (!row && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
                const salt = await bcrypt.genSalt(10);
                const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, salt);
                db.run(`INSERT INTO users (email, full_name, password_hash, role) VALUES (?, ?, ?, ?)`, 
                    [process.env.ADMIN_EMAIL, 'System Admin', hash, 'admin'], (err) => {
                        if (err) console.error('Error seeding admin:', err.message);
                        else console.log('Admin user seeded.');
                    });
            }
        });

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
        
        // Seed some dummy testimonials if empty
        db.get(`SELECT COUNT(*) as count FROM testimonials`, (err, row) => {
             if (row && row.count === 0) {
                 const stmt = db.prepare(`INSERT INTO testimonials (client_name, project, quote) VALUES (?, ?, ?)`);
                 stmt.run('Lukas K.', 'Music Video', 'Absolutely incredible eye for detail. The final video exceeded all our expectations.');
                 stmt.run('Sarah J.', 'Brand Campaign', 'KARBYVISUAL understands the modern aesthetic like no one else. Raw, emotional, perfect.');
                 stmt.finalize();
                 console.log('Dummy testimonials seeded.');
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
