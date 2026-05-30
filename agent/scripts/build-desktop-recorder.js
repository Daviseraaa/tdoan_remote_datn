const { execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const manifest = path.join(root, 'desktop-recorder', 'Cargo.toml');

console.log('[build-desktop-recorder] cargo build --release');
execSync(`cargo build --release --manifest-path "${manifest}"`, {
  cwd: root,
  stdio: 'inherit',
});

require('./copy-desktop-recorder-bin.js');
