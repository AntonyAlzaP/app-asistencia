// Runs after electron-builder packages the app but before afterSign.js signs
// it. Electron embeds a fuse (baked-in flag) that makes it validate an
// integrity hash for its bundled default_app.asar at startup. Since we ship
// with asar disabled, that file isn't present in our package, so the check
// fails and Electron aborts with SIGTRAP the instant it starts — this turns
// that check off. `resetAdHocDarwinSignature` re-signs immediately after
// flipping the fuse (flipping it modifies the binary, invalidating whatever
// signature was there); our own afterSign.js still runs afterward to layer
// on the JIT entitlements Electron actually needs.
const path = require('path');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

  const appName = context.packager.appInfo.productFilename;
  const executablePath = path.join(context.appOutDir, `${appName}.app`, 'Contents', 'MacOS', appName);

  await flipFuses(executablePath, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false
  });
};
