const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'desktop-recorder', 'target', 'release', 'datn-desktop-recorder.exe');
const dest = path.join(root, 'bin', 'datn-desktop-recorder.exe');

if (!fs.existsSync(src)) {
  console.error('[copy-desktop-recorder-bin] Thiếu', src);
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log('[copy-desktop-recorder-bin]', dest);
