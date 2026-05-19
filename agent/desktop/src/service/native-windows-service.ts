import { execFileSync } from 'child_process';
import * as fs from 'fs';
import { resolveCoreExe } from '../shared/paths';

const NATIVE_SVC_NAME = 'DATNAgentNative';

export { NATIVE_SVC_NAME };

export function nativeExecutablePath(): string {
  return resolveCoreExe();
}

export function installDatnNativeWindowsService(): void {
  if (process.platform !== 'win32') return;
  const exe = nativeExecutablePath();
  if (!fs.existsSync(exe)) {
    throw new Error(`Không thấy core exe: ${exe}. Chạy npm run build:core`);
  }
  try {
    execFileSync('sc', ['query', NATIVE_SVC_NAME], { stdio: 'pipe' });
    try {
      execFileSync('sc', ['stop', NATIVE_SVC_NAME], { stdio: 'inherit' });
    } catch {
      /* */
    }
    try {
      execFileSync('sc', ['delete', NATIVE_SVC_NAME], { stdio: 'inherit' });
    } catch {
      /* */
    }
  } catch {
    /* chưa cài */
  }
  const binPathArg = `binPath= "${exe}" service`;
  execFileSync(
    'sc',
    ['create', NATIVE_SVC_NAME, binPathArg, 'start=', 'auto'],
    { stdio: 'inherit' },
  );
  try {
    execFileSync(
      'sc',
      [
        'description',
        NATIVE_SVC_NAME,
        'DATN agent (Rust): WebSocket /ws/agent + tasks',
      ],
      { stdio: 'inherit' },
    );
  } catch {
    /* */
  }
}

export function uninstallDatnNativeWindowsService(): void {
  if (process.platform !== 'win32') return;
  try {
    execFileSync('sc', ['stop', NATIVE_SVC_NAME], { stdio: 'inherit' });
  } catch {
    /* */
  }
  try {
    execFileSync('sc', ['delete', NATIVE_SVC_NAME], { stdio: 'inherit' });
  } catch {
    /* */
  }
}
