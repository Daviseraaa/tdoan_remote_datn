import { execFileSync } from 'child_process';
import * as fs from 'fs';
import {
  installDatnNativeWindowsService,
  NATIVE_SVC_NAME,
  nativeExecutablePath,
} from './native-windows-service';

function removeLegacyNodeService() {
  if (process.platform !== 'win32') return;
  for (const name of ['StationHub Agent', 'StationHubAgent']) {
    try {
      execFileSync('sc', ['stop', name], { stdio: 'pipe' });
    } catch {
      /* */
    }
    try {
      execFileSync('sc', ['delete', name], { stdio: 'pipe' });
    } catch {
      /* */
    }
  }
}

const exe = nativeExecutablePath();
if (!fs.existsSync(exe)) {
  console.error('[ERROR] Không thấy', exe, '\nChạy: cd agent && npm run build:core');
  process.exit(1);
}

console.log('Cài Windows Service agent (Rust)...');
removeLegacyNodeService();
installDatnNativeWindowsService();
try {
  execFileSync('sc', ['start', NATIVE_SVC_NAME], { stdio: 'inherit' });
  console.log('[OK] Service đã cài và khởi động.');
} catch (e) {
  console.error('[WARN] sc start:', e);
  process.exit(1);
}
