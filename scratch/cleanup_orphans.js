const fs = require('fs');
const path = require('path');
const { dbAsync } = require('../db');

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');

async function cleanup() {
    const isExecute = process.argv.includes('--execute');
    console.log('==================================================');
    console.log('   UPLOADS ORPHAN CLEANUP SCRIPT (DRY RUN BY DEFAULT)');
    console.log('==================================================');
    if (!isExecute) {
        console.log('NOTE: Running in DRY-RUN mode. No files will be deleted.');
        console.log('To actually delete the files, run: node scratch/cleanup_orphans.js --execute');
    } else {
        console.log('ATTENTION: Executing deletion mode. Orphaned files will be permanently purged.');
    }
    console.log('--------------------------------------------------\n');

    try {
        // 1. Gather all active references from the database
        const activeRefs = new Set();

        // 1a. Portfolio Items
        const portfolioItems = await dbAsync.all('SELECT media_url, thumbnail_url FROM portfolio_items');
        portfolioItems.forEach(item => {
            if (item.media_url && item.media_url.startsWith('/uploads/')) {
                activeRefs.add(item.media_url);
            }
            if (item.thumbnail_url && item.thumbnail_url.startsWith('/uploads/')) {
                activeRefs.add(item.thumbnail_url);
            }
        });

        // 1b. Testimonials (Avatars)
        const testimonials = await dbAsync.all('SELECT avatar_url FROM testimonials');
        testimonials.forEach(t => {
            if (t.avatar_url && t.avatar_url.startsWith('/uploads/')) {
                activeRefs.add(t.avatar_url);
            }
        });

        console.log(`[DATABASE] Found ${activeRefs.size} active unique file reference(s) in database.\n`);

        // 2. Scan the uploads directory recursively
        if (!fs.existsSync(UPLOADS_DIR)) {
            console.log(`[FILE_SYSTEM] Uploads directory does not exist at: ${UPLOADS_DIR}`);
            return;
        }

        const allFiles = [];
        function scanDir(dir) {
            const list = fs.readdirSync(dir);
            list.forEach(file => {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    scanDir(fullPath);
                } else {
                    allFiles.push(fullPath);
                }
            });
        }
        scanDir(UPLOADS_DIR);

        console.log(`[FILE_SYSTEM] Scanned ${allFiles.length} file(s) in public/uploads.\n`);

        // 3. Compare and identify orphans
        let orphanCount = 0;
        let deletedCount = 0;
        let totalSize = 0;

        allFiles.forEach(filePath => {
            // Get relative path within the 'public' directory
            const relativeToPublic = path.relative(path.join(__dirname, '..', 'public'), filePath);
            // Convert to web URL format (always forward slashes and starting with /)
            const fileUrl = '/' + relativeToPublic.replace(/\\/g, '/');

            // Skip any directory traversal or system/hidden files just in case
            if (path.basename(filePath).startsWith('.')) {
                return;
            }

            if (!activeRefs.has(fileUrl)) {
                orphanCount++;
                const stats = fs.statSync(filePath);
                totalSize += stats.size;
                const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

                console.log(`[ORPHAN] ${fileUrl} (${sizeInMB} MB)`);

                if (isExecute) {
                    try {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                        console.log(`  -> DELETED successfully`);
                    } catch (e) {
                        console.error(`  -> FAILED to delete: ${e.message}`);
                    }
                }
            }
        });

        console.log('\n--------------------------------------------------');
        console.log('SUMMARY OF RESULTS:');
        console.log(`Total orphaned files found: ${orphanCount}`);
        console.log(`Total space reclaimable: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
        if (isExecute) {
            console.log(`Successfully purged: ${deletedCount}/${orphanCount} file(s).`);
        } else {
            console.log('No changes were made (dry-run). Run with --execute to clean up.');
        }
        console.log('==================================================');

    } catch (err) {
        console.error('An error occurred during cleanup analysis:', err);
    } finally {
        process.exit(0);
    }
}

cleanup();
