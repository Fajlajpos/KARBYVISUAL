const fs = require('fs');
const path = require('path');

/**
 * DATABASE BACKUP UTILITY for KARBYVISUAL SQLite Database
 * 
 * This script copies 'database.sqlite' into a timestamped file inside the 'backups' directory.
 * It is lightweight, safe, and can be scheduled via Cron or run manually.
 */

const dbFile = path.resolve(__dirname, 'database.sqlite');
const backupDir = path.resolve(__dirname, 'backups');

console.log('[DATABASE_BACKUP] Initiating database backup sequence...');

// Ensure backups directory exists
if (!fs.existsSync(backupDir)) {
    try {
        fs.mkdirSync(backupDir, { recursive: true });
        console.log(`[DATABASE_BACKUP] Created backup directory at: ${backupDir}`);
    } catch (err) {
        console.error(`[DATABASE_BACKUP_ERROR] Failed to create backup directory: ${err.message}`);
        process.exit(1);
    }
}

// Generate secure timestamp for the file
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const hours = String(now.getHours()).padStart(2, '0');
const minutes = String(now.getMinutes()).padStart(2, '0');
const timestamp = `${year}-${month}-${day}_${hours}-${minutes}`;

const backupFile = path.join(backupDir, `database_backup_${timestamp}.sqlite`);

if (fs.existsSync(dbFile)) {
    try {
        fs.copyFileSync(dbFile, backupFile);
        console.log(`[DATABASE_BACKUP_SUCCESS] Safe backup created successfully: ${backupFile}`);
        
        // Retention Policy: Keep only the last 14 backups to prevent disk space waste
        const files = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('database_backup_') && f.endsWith('.sqlite'))
            .map(f => ({ name: f, path: path.join(backupDir, f), time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }));
        
        if (files.length > 14) {
            // Sort by age (oldest first)
            files.sort((a, b) => a.time - b.time);
            const toDelete = files.slice(0, files.length - 14);
            toDelete.forEach(f => {
                fs.unlinkSync(f.path);
                console.log(`[DATABASE_BACKUP_CLEANUP] Deleted old backup file: ${f.name}`);
            });
        }
        
    } catch (err) {
        console.error(`[DATABASE_BACKUP_ERROR] File operation failed during copy: ${err.message}`);
        process.exit(1);
    }
} else {
    console.error(`[DATABASE_BACKUP_ERROR] Primary database file not found at: ${dbFile}`);
    process.exit(1);
}
