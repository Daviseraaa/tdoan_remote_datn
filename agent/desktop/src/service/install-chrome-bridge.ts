/**
 * Đăng ký Native Messaging host cho Chrome (HKCU).
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ensureProgramDataDir, programDataConfigPath } from '../shared/paths';

const HOST_NAME = 'com.datn.chrome_bridge';

/** Thư mục gốc `agent/` (từ `desktop/dist/service` → lên 3 cấp). */
function agentRoot(): string {
  return path.resolve(__dirname, '..', '..', '..');
}

function resolveBridgeExe(): string {
  const root = agentRoot();
  const candidates = [
    path.join(root, 'bin', 'datn-chrome-bridge.exe'),
    path.join(process.resourcesPath || '', 'bin', 'datn-chrome-bridge.exe'),
    path.join('C:', 'Program Files', 'DATN', 'bin', 'datn-chrome-bridge.exe'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return path.resolve(p);
  }
  throw new Error(
    'Không tìm thấy datn-chrome-bridge.exe — chạy npm run build:chrome-bridge trong agent/',
  );
}

function extensionId(): string {
  const root = agentRoot();
  const idFile = path.join(root, 'chrome-extension', 'EXTENSION_ID.txt');
  if (fs.existsSync(idFile)) {
    const id = fs.readFileSync(idFile, 'utf8').trim();
    if (id) return id;
  }

  const script = path.join(root, 'scripts', 'chrome-extension-id.js');
  if (fs.existsSync(script)) {
    return execSync(`node "${script}"`, { encoding: 'utf8', cwd: root }).trim();
  }

  throw new Error(
    `Không đọc được extension ID — cần ${script} hoặc chrome-extension/EXTENSION_ID.txt`,
  );
}

function main(): void {
  ensureProgramDataDir();
  const pd = path.dirname(programDataConfigPath());
  const bridgeDir = path.join(pd, 'chrome-bridge');
  fs.mkdirSync(bridgeDir, { recursive: true });

  const exe = resolveBridgeExe();
  const extId = extensionId();
  const templatePath = path.join(
    agentRoot(),
    'chrome-bridge',
    'com.datn.chrome_bridge.json.template',
  );
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Thiếu template: ${templatePath}`);
  }
  const template = fs.readFileSync(templatePath, 'utf8');
  const manifestBody = template
    .replace(/__BRIDGE_EXE__/g, exe.replace(/\\/g, '\\\\'))
    .replace(/__EXTENSION_ID__/g, extId);

  const manifestPath = path.join(bridgeDir, `${HOST_NAME}.json`);
  fs.writeFileSync(manifestPath, manifestBody, 'utf8');

  const regKey = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`;
  execSync(`reg add "${regKey}" /ve /t REG_SZ /d "${manifestPath}" /f`, { stdio: 'inherit' });

  console.log('[install-chrome-bridge] OK');
  console.log('  exe:', exe);
  console.log('  extension:', extId);
  console.log('  manifest:', manifestPath);
  console.log('  Load extension: agent/chrome-extension/ tại chrome://extensions');
}

main();
