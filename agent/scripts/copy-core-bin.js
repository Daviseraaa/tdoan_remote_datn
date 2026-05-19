const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'core', 'target', 'release', 'datn-agent-native.exe');
const dest = path.join(root, 'bin', 'datn-agent-native.exe');

if (!fs.existsSync(src)) {
  console.error('[copy-core-bin] Thiếu', src, '— chạy cargo build --release trong agent/core');
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log('[copy-core-bin]', dest);
