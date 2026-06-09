/**
 * Build stationhub-cloak-runner (PyInstaller) → agent/bin/cloak/
 * Cần: Python 3.9+, pip install -e agent/CloakBrowser, pip install pyinstaller
 *
 * Nếu EPERM: dừng StationHub Agent (tray) — file trong bin/cloak đang bị khóa.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const agentRoot = path.join(__dirname, '..');
const runnerDir = path.join(agentRoot, 'cloak-runner');
const cloakRepo = path.join(agentRoot, 'CloakBrowser');
const outDir = path.join(agentRoot, 'bin', 'cloak');
const stagingDir = path.join(agentRoot, 'bin', 'cloak-staging');
const distDir = path.join(runnerDir, 'dist', 'stationhub-cloak-runner');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, ...opts });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

function rmDirSafe(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
  } catch (e) {
    if (e.code === 'EPERM' || e.code === 'EBUSY') {
      return false;
    }
    throw e;
  }
  return true;
}

function publishDist() {
  rmDirSafe(stagingDir);
  fs.mkdirSync(path.dirname(stagingDir), { recursive: true });
  fs.cpSync(distDir, stagingDir, { recursive: true });

  if (fs.existsSync(outDir)) {
    const backup = path.join(agentRoot, 'bin', `cloak.bak-${Date.now()}`);
    try {
      fs.renameSync(outDir, backup);
      console.log('[build-cloak-runner] Đã đổi tên bản cũ →', backup);
    } catch (e) {
      console.error('');
      console.error('[build-cloak-runner] Không ghi được bin/cloak (file đang bị khóa).');
      console.error('  → Dừng StationHub Agent tray / tắt stationhub-cloak-runner.exe trong Task Manager.');
      console.error('  → Chạy lại: npm run build:cloak-runner');
      console.error('');
      console.error('Bản build mới đã có tại:', stagingDir);
      console.error('Tạm dùng trong agent.env:');
      console.error(`  CLOAK_RUNNER_DIR=${stagingDir}`);
      process.exit(1);
    }
  }

  fs.renameSync(stagingDir, outDir);
  console.log('[build-cloak-runner] OK →', outDir);
}

if (!fs.existsSync(cloakRepo)) {
  console.error('[build-cloak-runner] Thiếu', cloakRepo);
  process.exit(1);
}

const py = process.env.PYTHON || 'python';
console.log('[build-cloak-runner] pip install CloakBrowser + pyinstaller...');
run(py, ['-m', 'pip', 'install', '-e', cloakRepo, 'pyinstaller']);

console.log('[build-cloak-runner] pyinstaller...');
run(py, ['-m', 'PyInstaller', '--noconfirm', 'stationhub-cloak-runner.spec'], {
  cwd: runnerDir,
});

if (!fs.existsSync(distDir)) {
  console.error('[build-cloak-runner] Không thấy', distDir);
  process.exit(1);
}

publishDist();
