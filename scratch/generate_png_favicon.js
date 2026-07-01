const sharp = require('sharp');
const path = require('path');

const svgPath = path.join(__dirname, '../public/favicon.svg');
const pngPath = path.join(__dirname, '../public/favicon.png');

sharp(svgPath)
  .resize(32, 32)
  .png()
  .toFile(pngPath)
  .then(info => {
    console.log('Favicon PNG generated successfully!', info);
  })
  .catch(err => {
    console.error('Error generating favicon PNG:', err);
    process.exit(1);
  });
