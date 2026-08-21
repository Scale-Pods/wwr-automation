const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const logoPath = path.join(publicDir, 'logo.png');

const buf = fs.readFileSync(logoPath);
// Read PNG header for width & height
const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);

console.log('logo.png dimensions:', width, 'x', height);
