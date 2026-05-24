const { execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const manifest = path.join(root, 'chrome-bridge', 'Cargo.toml');

console.log('[build-chrome-bridge] cargo build --release');
execSync(`cargo build --release --manifest-path "${manifest}"`, {
  stdio: 'inherit',
  cwd: root,
});

require('./copy-chrome-bridge-bin.js');
