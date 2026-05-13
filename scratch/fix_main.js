const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, '..', 'public', 'main.js');
const logicPath = path.join(__dirname, '..', 'scratch', 'batch_logic.js');

let content = fs.readFileSync(mainPath, 'utf8');

// If the file was corrupted with UTF-16 style null bytes, remove them
// (This is a guess based on the "spaces between letters" symptom)
if (content.includes('\u0000')) {
    content = content.replace(/\u0000/g, '');
}

// Split by lines
let lines = content.split(/\r?\n/);

// Keep only lines before the corrupted append (approx 1457)
// But to be safer, find the last valid function or closing brace before the mess.
// The last valid function was deletePortfolioItem ending at around line 1457.
let lastValidLine = -1;
for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('function deletePortfolioItem')) {
        // Find the closing brace of this function
        let braceCount = 0;
        for (let j = i; j < lines.length; j++) {
            if (lines[j].includes('{')) braceCount++;
            if (lines[j].includes('}')) braceCount--;
            if (braceCount === 0 && j > i) {
                lastValidLine = j;
                break;
            }
        }
        break;
    }
}

if (lastValidLine === -1) {
    console.error('Could not find end of deletePortfolioItem');
    process.exit(1);
}

let cleanLines = lines.slice(0, lastValidLine + 1);
let cleanContent = cleanLines.join('\n');

// Fix the corrupted Czech characters manually in the clean content
const fixes = {
    'ZĂ ZNAM AKTUALIZOVĂ N': 'ZÁZNAM AKTUALIZOVÁN',
    'PRĂ ZDNĂť ZĂ ZNAM': 'PRÁZDNÝ ZÁZNAM',
    'DIREKTIVA ODESLĂ NA.': 'DIREKTIVA ODESLÁNA.',
    'OdhlĂˇĹˇenĂ­ ĂşspÄ›ĹˇnĂ©.': 'Odhlášení úspěšné.',
    'ZĂ ZNAM BYL SMAZĂ N': 'ZÁZNAM BYL SMAZÁN',
    'ĂşspÄ›ĹˇnĂ©': 'úspěšné',
    'ZĂ ZNAM': 'ZÁZNAM'
};

for (const [bad, good] of Object.entries(fixes)) {
    cleanContent = cleanContent.split(bad).join(good);
}

const logicContent = fs.readFileSync(logicPath, 'utf8');
const finalContent = cleanContent + '\n' + logicContent;

fs.writeFileSync(mainPath, finalContent, 'utf8');
console.log('Successfully fixed main.js');
