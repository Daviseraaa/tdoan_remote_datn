import { execFileSync } from 'child_process';
import { uninstallDatnNativeWindowsService } from './native-windows-service';

if (process.platform === 'win32') {
  for (const name of ['StationHub Agent', 'StationHubAgent']) {
    try {
      execFileSync('sc', ['stop', name], { stdio: 'inherit' });
    } catch {
      /* */
    }
    try {
      execFileSync('sc', ['delete', name], { stdio: 'inherit' });
    } catch {
      /* */
    }
  }
}

uninstallDatnNativeWindowsService();
console.log('[OK] Gỡ service agent.');
