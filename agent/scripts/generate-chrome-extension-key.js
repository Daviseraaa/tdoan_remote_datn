/**
 * Tạo cặp RSA cho manifest.key (Chrome) và cập nhật EXTENSION_ID.txt.
 * Chạy: node agent/scripts/generate-chrome-extension-key.js
 * Sau đó: npm run chrome-bridge:install
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const extDir = path.join(root, 'chrome-extension');
const manifestPath = path.join(extDir, 'manifest.json');
const idPath = path.join(extDir, 'EXTENSION_ID.txt');
const privPath = path.join(extDir, '.extension-key.pem');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const keyB64 = publicKey.toString('base64');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.key = keyB64;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
fs.writeFileSync(privPath, privateKey, 'utf8');

const der = Buffer.from(keyB64, 'base64');
const hash = crypto.createHash('sha256').update(der).digest();
let id = '';
for (let i = 0; i < 16; i++) {
  id += String.fromCharCode(97 + ((hash[i] >> 4) & 0xf));
  id += String.fromCharCode(97 + (hash[i] & 0xf));
}
fs.writeFileSync(idPath, `${id}\n`, 'utf8');

console.log('[generate-chrome-extension-key] OK');
console.log('  extension ID:', id);
console.log('  manifest:', manifestPath);
console.log('  private key (gitignore):', privPath);
console.log('  Chạy: npm run chrome-bridge:install');
