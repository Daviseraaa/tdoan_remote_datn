const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function copyRecursive(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const f = path.join(from, name);
    const d = path.join(to, name);
    if (fs.statSync(f).isDirectory()) copyRecursive(f, d);
    else fs.copyFileSync(f, d);
  }
}

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

const srcDir = path.join(root, 'src', 'renderer');
const destDir = path.join(root, 'dist', 'renderer');

if (fs.existsSync(srcDir)) {
  copyRecursive(srcDir, destDir);
  console.log('[copy-static] renderer -> dist/renderer');
}

const buildIco = path.join(root, 'build', 'icon.ico');
const buildPng = path.join(root, 'build', 'icon.png');
const trayIco = path.join(root, 'dist', 'tray', 'icon.ico');
const trayPng = path.join(root, 'dist', 'tray', 'icon.png');

if (copyIfExists(buildIco, trayIco)) {
  console.log('[copy-static] build/icon.ico -> dist/tray/icon.ico');
} else if (copyIfExists(buildPng, trayPng)) {
  console.log('[copy-static] build/icon.png -> dist/tray/icon.png');
}

if (copyIfExists(buildPng, path.join(root, 'dist', 'renderer', 'logo.png'))) {
  console.log('[copy-static] build/icon.png -> dist/renderer/logo.png');
} else if (copyIfExists(buildIco, path.join(root, 'dist', 'renderer', 'logo.ico'))) {
  console.log('[copy-static] build/icon.ico -> dist/renderer/logo.ico');
}
