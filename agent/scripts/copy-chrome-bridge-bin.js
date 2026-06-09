const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'chrome-bridge', 'target', 'release', 'stationhub-chrome-bridge.exe');
const dest = path.join(root, 'bin', 'stationhub-chrome-bridge.exe');

if (!fs.existsSync(src)) {
  console.error('[copy-chrome-bridge-bin] Thiếu', src);
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log('[copy-chrome-bridge-bin]', dest);
