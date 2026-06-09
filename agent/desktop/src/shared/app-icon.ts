import * as fs from 'fs';
import * as path from 'path';

/** ICO/PNG cho exe, tray và cửa sổ app (Windows ưu tiên .ico). */
export function resolveAppIconPath(): string | undefined {
  const candidates = [
    path.join(__dirname, '..', 'tray', 'icon.ico'),
    path.join(__dirname, '..', 'tray', 'icon.png'),
    path.join(__dirname, '..', '..', 'build', 'icon.ico'),
    path.join(__dirname, '..', '..', 'build', 'icon.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}
