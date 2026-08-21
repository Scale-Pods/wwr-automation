const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\abeer\\.gemini\\antigravity-ide\\brain\\cfbb4514-cacc-4563-82f9-c0d25b6d5b7b';
const publicDir = path.join(__dirname, '..', 'public');

const fullLogoFile = path.join(brainDir, 'clean_logo_original_blue_1787296352238.png');
const iconLogoFile = path.join(brainDir, 'clean_blue_globe_icon_1787296365907.png');

console.log('Copying full logo from:', fullLogoFile);
fs.copyFileSync(fullLogoFile, path.join(publicDir, 'logo.png'));
fs.copyFileSync(fullLogoFile, path.join(publicDir, 'logo-full.png'));

console.log('Copying icon logo from:', iconLogoFile);
fs.copyFileSync(iconLogoFile, path.join(publicDir, 'logo-icon.png'));
fs.copyFileSync(iconLogoFile, path.join(publicDir, 'favicon.png'));
fs.copyFileSync(iconLogoFile, path.join(publicDir, 'apple-icon.png'));
fs.copyFileSync(iconLogoFile, path.join(publicDir, 'favicon.ico'));

console.log('Successfully updated logo and favicon files in public/!');
