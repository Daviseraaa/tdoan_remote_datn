import * as path from 'path';
import { Service } from 'node-windows';

const svc = new Service({
  name: 'DATN Remote Agent',
  description:
    'Remote PC control agent for DATN server. Connects to WebSocket and executes tasks.',
  script: path.join(__dirname, '..', 'main.js'),
  nodeOptions: [],
  workingDirectory: path.join(__dirname, '..', '..'),
  env: [
    {
      name: 'NODE_ENV',
      value: 'production',
    },
  ],
});

svc.on('install', () => {
  console.log('[OK] Service installed. Starting...');
  svc.start();
});

svc.on('alreadyinstalled', () => {
  console.log('[INFO] Service already installed');
});

svc.on('start', () => {
  console.log('[OK] Service started successfully');
});

svc.on('error', (err: Error) => {
  console.error('[ERROR]', err);
});

console.log('Installing DATN Remote Agent service...');
svc.install();
