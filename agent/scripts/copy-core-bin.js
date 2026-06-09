const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'core', 'target', 'release', 'stationhub-agent-native.exe');
const dest = path.join(root, 'bin', 'stationhub-agent-native.exe');

if (!fs.existsSync(src)) {
  console.error('[copy-core-bin] Thiếu', src, '— chạy cargo build --release trong agent/core');
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });

function tryCopy(target) {
  fs.copyFileSync(src, target);
}

try {
  tryCopy(dest);
  console.log('[copy-core-bin]', dest);
} catch (err) {
  if (err && err.code === 'EBUSY') {
    const pending = path.join(root, 'bin', 'stationhub-agent-native.pending.exe');
    tryCopy(pending);
    console.error(
      '[copy-core-bin] bin/stationhub-agent-native.exe đang bị khóa (agent đang chạy).',
    );
    console.error('[copy-core-bin] Đã ghi bản mới:', pending);
    console.error(
      '[copy-core-bin] Dừng agent/service → đổi tên pending → stationhub-agent-native.exe → chạy lại agent.',
    );
    process.exit(1);
  }
  throw err;
}
