const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'bin', 'cloak');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'README.txt'),
    'Chưa build cloak-runner. Chạy: npm run build:cloak-runner\n',
  );
  console.warn('[ensure-cloak-dir] Thiếu bin/cloak — chạy: npm run build:cloak-runner');
}
