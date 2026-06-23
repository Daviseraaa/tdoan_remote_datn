/**
 * Gắn icon vào .exe sau khi pack.
 * `signAndEditExecutable: false` bỏ qua bước rcedit của electron-builder → shortcut desktop dùng icon Electron mặc định.
 */
const path = require('path');
const { rcedit } = require('rcedit');

/** @param {import('app-builder-lib/out/util/AppFileWalker').AfterPackContext} context */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const iconPath = path.join(context.packager.projectDir, 'build', 'icon.ico');
  const exePath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.exe`,
  );

  await rcedit(exePath, {
    icon: iconPath,
    'version-string': {
      ProductName: 'StationHub Agent',
      FileDescription: 'StationHub Agent',
      CompanyName: 'StationHub',
      OriginalFilename: `${context.packager.appInfo.productFilename}.exe`,
    },
  });
  console.log('[after-pack-icon] embedded', iconPath, '->', exePath);
};
