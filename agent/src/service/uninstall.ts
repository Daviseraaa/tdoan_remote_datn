import * as path from 'path';
import { Service } from 'node-windows';

const svc = new Service({
  name: 'DATN Remote Agent',
  script: path.join(__dirname, '..', 'main.js'),
});

svc.on('uninstall', () => {
  console.log('[OK] Service uninstalled');
});

svc.on('error', (err: Error) => {
  console.error('[ERROR]', err);
});

console.log('Uninstalling DATN Remote Agent service...');
svc.uninstall();
