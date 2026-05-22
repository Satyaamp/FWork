const fs = require('fs');
const path = require('path');

const iconDir = path.join(__dirname, '../frontend/assets/icons');
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Green 1x1 pixel base64 image data
const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkOMD0DwADegGp5y55HAAAAABJRU5ErkJggg==';
const buffer = Buffer.from(base64Png, 'base64');

fs.writeFileSync(path.join(iconDir, 'icon-192.png'), buffer);
fs.writeFileSync(path.join(iconDir, 'icon-512.png'), buffer);
console.log('Successfully generated default launcher icons.');
