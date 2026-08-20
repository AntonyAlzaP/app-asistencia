// No Apple Developer certificate (paid, $99/yr) — instead of leaving the app
// fully unsigned, ad-hoc sign it (identity "-", no real cert) with the
// entitlements Electron's JS engine needs. Without this, macOS's hardened
// runtime blocks V8's JIT with a SIGTRAP the moment the app tries to run
// any JavaScript, which looks like an instant crash ("zsh: trace trap").
const { execFileSync } = require('child_process');
const path = require('path');

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  const entitlements = path.join(__dirname, '..', 'build', 'entitlements.mac.plist');

  execFileSync(
    'codesign',
    ['--deep', '--force', '--sign', '-', '--entitlements', entitlements, '--timestamp=none', appPath],
    { stdio: 'inherit' }
  );
};
