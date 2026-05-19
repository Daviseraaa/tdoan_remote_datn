const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'renderer');
const destDir = path.join(__dirname, '..', 'dist', 'renderer');

function copyRecursive(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const f = path.join(from, name);
    const d = path.join(to, name);
    if (fs.statSync(f).isDirectory()) copyRecursive(f, d);
    else fs.copyFileSync(f, d);
  }
}

if (fs.existsSync(srcDir)) {
  copyRecursive(srcDir, destDir);
  console.log('[copy-static] renderer -> dist/renderer');
}
