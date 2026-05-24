/**
 * In extension ID từ manifest.key (Chrome rules).
 * Usage: node agent/scripts/chrome-extension-id.js
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'chrome-extension', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const keyB64 = manifest.key;
if (!keyB64) {
  console.error('manifest.json thiếu field "key"');
  process.exit(1);
}

const der = Buffer.from(keyB64, 'base64');
const hash = crypto.createHash('sha256').update(der).digest();
let id = '';
for (let i = 0; i < 16; i++) {
  id += String.fromCharCode(97 + ((hash[i] >> 4) & 0xf));
  id += String.fromCharCode(97 + (hash[i] & 0xf));
}
console.log(id);
