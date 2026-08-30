// Vygeneruje WebP varianty vedle puvodnich souboru. Originaly zustavaji na disku,
// takze navrat je jen zmena cesty v CSS / HTML / DB.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const P = (...a) => path.join(__dirname, '..', 'public', ...a);
const kb = n => Math.round(n / 1024);

// [zdroj, cil, sharp options]
const JOBS = [
    // Pozadi pres cely dokument - nejvetsi jednotlivy asset na strance.
    // `darken` predpocita ztmaveni, ktere drive delal cerny prekryv v .global-site-bg::after.
    // Za timto prvkem je jen cerne pozadi <html>, takze `img * 0.315` je matematicky
    // totozny vysledek jako `img` pod rgba(0,0,0,0.685). Tmavy obrazek se v WebP
    // komprimuje radove lepe - 2625 kB -> ~250 kB pri stejnem vysledném vzhledu.
    [P('assets', 'kolaz_v5.jpg'), P('assets', 'kolaz_v5.webp'), { quality: 76, width: 1600, darken: 0.315 }],
    // Fallback thumbnail v mrizce portfolia. Drive se sem davalo cele 2,7MB pozadi.
    // Tenhle se zobrazuje v plne svetlosti, takze bez ztmaveni.
    [P('assets', 'kolaz_v5.jpg'), P('assets', 'thumb-placeholder.webp'), { quality: 74, resize: 720 }],
    // Renderuje se 402x537 px; 850 px staci i na displej s DPR 2.
    [P('assets', 'about-me.jpg'), P('assets', 'about-me.webp'), { quality: 72, width: 850 }],
    // Sum se kresli pres cely dokument pri opacity 0.05 - kvalita neni kriticka.
    [P('assets', 'noise.png'), P('assets', 'noise.webp'), { quality: 70 }],
    [P('assets', 'folder-icon.png'), P('assets', 'folder-icon.webp'), { quality: 90 }],
];

// Avatary recenzi: v layoutu maji 45x45 px (32 na mobilu), soubory ale 200 kB az 3,4 MB.
const AVATAR_SRC = [
    P('assets', 'fotky profilovek', 'Snímek obrazovky 2026-04-21 202602.jpg'),
    P('assets', 'fotky profilovek', 'pbsaam.jpg'),
    P('assets', 'fotky profilovek', 'lilstat__.jpg'),
    P('assets', 'fotky profilovek', 'nikofadess.jpg'),
    P('uploads', 'avatars', '1778152682987-316587767-instc 2025-04-20 212025.461 (2).jpg'),
];
for (const src of AVATAR_SRC) {
    const out = src.replace(/\.(jpe?g|png)$/i, '.webp');
    // 160 px pokryje 45 px slot i na displeji s DPR 3.
    JOBS.push([src, out, { quality: 82, resize: 160 }]);
}

(async () => {
    let before = 0, after = 0;
    for (const [src, out, opt] of JOBS) {
        if (!fs.existsSync(src)) { console.log(`SKIP (chybi): ${path.relative(P(), src)}`); continue; }
        let img = sharp(src);
        if (opt.resize) img = img.resize({ width: opt.resize, height: opt.resize, fit: 'cover', withoutEnlargement: true });
        else if (opt.width) img = img.resize({ width: opt.width, withoutEnlargement: true });
        if (opt.darken) img = img.linear(opt.darken, 0);
        await img.webp({ quality: opt.quality, effort: 6 }).toFile(out);
        const b = fs.statSync(src).size, a = fs.statSync(out).size;
        before += b; after += a;
        console.log(`${kb(b).toString().padStart(6)} kB -> ${kb(a).toString().padStart(5)} kB   ${path.relative(P(), out)}`);
    }
    console.log(`\nCELKEM: ${kb(before)} kB -> ${kb(after)} kB (uspora ${kb(before - after)} kB, ${Math.round((1 - after / before) * 100)} %)`);
})();
