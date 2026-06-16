const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const assetsDir = path.join(__dirname, '..', 'public', 'assets');

async function optimize() {
    console.log('--- STARTING IMAGE OPTIMIZATION ---');

    // 1. Optimize about-me.jpg
    const aboutMePath = path.join(assetsDir, 'about-me.jpg');
    if (fs.existsSync(aboutMePath)) {
        console.log('Optimizing about-me.jpg...');
        const tempPath = path.join(assetsDir, 'about-me-temp.jpg');
        
        // Let's backup the original first in case
        fs.copyFileSync(aboutMePath, path.join(assetsDir, 'about-me-original.jpg'));
        
        await sharp(aboutMePath)
            .resize({ width: 1000, withoutEnlargement: true })
            .jpeg({ quality: 80, progressive: true })
            .toFile(tempPath);
            
        fs.unlinkSync(aboutMePath);
        fs.renameSync(tempPath, aboutMePath);
        console.log(`about-me.jpg optimized! New size: ${fs.statSync(aboutMePath).size} bytes`);
    }

    // 2. Optimize kolaz_v5.jpg
    const kolazPath = path.join(assetsDir, 'kolaz_v5.jpg');
    if (fs.existsSync(kolazPath)) {
        console.log('Optimizing kolaz_v5.jpg...');
        const tempPath = path.join(assetsDir, 'kolaz-temp.jpg');
        
        // Backup
        fs.copyFileSync(kolazPath, path.join(assetsDir, 'kolaz_v5-original.jpg'));
        
        await sharp(kolazPath)
            .resize({ width: 1920, withoutEnlargement: true }) // 1920 is plenty for background
            .jpeg({ quality: 75, progressive: true })
            .toFile(tempPath);
            
        fs.unlinkSync(kolazPath);
        fs.renameSync(tempPath, kolazPath);
        console.log(`kolaz_v5.jpg optimized! New size: ${fs.statSync(kolazPath).size} bytes`);
    }

    // 3. Optimize folder-icon.png
    const folderIconPath = path.join(assetsDir, 'folder-icon.png');
    if (fs.existsSync(folderIconPath)) {
        console.log('Optimizing folder-icon.png...');
        const tempPath = path.join(assetsDir, 'folder-icon-temp.png');
        
        // Backup
        fs.copyFileSync(folderIconPath, path.join(assetsDir, 'folder-icon-original.jpg'));
        
        await sharp(folderIconPath)
            .resize({ width: 128, height: 128 }) // It is only shown at 64x64 anyway
            .png({ compressionLevel: 9 })
            .toFile(tempPath);
            
        fs.unlinkSync(folderIconPath);
        fs.renameSync(tempPath, folderIconPath);
        console.log(`folder-icon.png optimized! New size: ${fs.statSync(folderIconPath).size} bytes`);
    }
    
    // 4. Optimize ikona slozky.png
    const folderIcon2Path = path.join(assetsDir, 'ikona slozky.png');
    if (fs.existsSync(folderIcon2Path)) {
        console.log('Optimizing ikona slozky.png...');
        const tempPath = path.join(assetsDir, 'ikona-slozky-temp.png');
        
        // Backup
        fs.copyFileSync(folderIcon2Path, path.join(assetsDir, 'ikona-slozky-original.png'));
        
        await sharp(folderIcon2Path)
            .resize({ width: 128, height: 128 })
            .png({ compressionLevel: 9 })
            .toFile(tempPath);
            
        fs.unlinkSync(folderIcon2Path);
        fs.renameSync(tempPath, folderIcon2Path);
        console.log(`ikona slozky.png optimized! New size: ${fs.statSync(folderIcon2Path).size} bytes`);
    }

    console.log('--- IMAGE OPTIMIZATION COMPLETED ---');
}

optimize().catch(err => {
    console.error('Error during optimization:', err);
});
