const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
const manifest = path.join(root, 'desktop-recorder', 'Cargo.toml');
const assets = path.join(root, 'desktop-recorder', 'assets');
const icoPath = path.join(assets, 'icon.ico');
const exePath = path.join(root, 'bin', 'stationhub-desktop-recorder.exe');

function ensureIcon() {
  if (!fs.existsSync(icoPath)) {
    throw new Error(
      `Thieu ${icoPath}\nDat file icon.ico (da chuan) vao desktop-recorder/assets/ roi build lai.`,
    );
  }
  const stat = fs.statSync(icoPath);
  console.log(`[build-desktop-recorder] icon.ico (${stat.size} bytes)`);
}

async function embedRcedit() {
  if (!fs.existsSync(exePath) || !fs.existsSync(icoPath)) return;
  const rceditUrl = pathToFileURL(
    path.join(root, 'desktop', 'node_modules', 'rcedit', 'lib', 'index.js'),
  ).href;
  const { rcedit } = await import(rceditUrl);
  console.log('[build-desktop-recorder] embed icon via rcedit');
  await rcedit(exePath, {
    icon: icoPath,
    'version-string': {
      ProductName: 'StationHub Desktop Recorder',
      FileDescription: 'StationHub Desktop Recorder',
      CompanyName: 'StationHub',
      OriginalFilename: 'stationhub-desktop-recorder.exe',
    },
  });
  console.log('[build-desktop-recorder] rcedit OK');
}

async function main() {
  ensureIcon();

  console.log('[build-desktop-recorder] cargo build --release');
  execSync(`cargo build --release --manifest-path "${manifest}"`, {
    cwd: root,
    stdio: 'inherit',
  });

  require('./copy-desktop-recorder-bin.js');

  try {
    await embedRcedit();
  } catch (e) {
    console.warn('[build-desktop-recorder] rcedit skipped:', e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
