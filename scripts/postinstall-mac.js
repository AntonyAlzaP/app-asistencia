#!/usr/bin/env node
// Only relevant on macOS, and only for the unpackaged `electron .` dev-run
// path (see "electron:run" in package.json). electron-builder's packaged
// output already declares camera/location usage in its own Info.plist; the
// raw Electron.app downloaded by npm does not, so macOS silently denies
// camera/location access (no prompt at all) unless we add these ourselves.
if (process.platform !== 'darwin') {
  process.exit(0);
}

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const appPath = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'Electron.app');
const plistPath = path.join(appPath, 'Contents', 'Info.plist');
const entitlements = path.join(__dirname, '..', 'build', 'entitlements.mac.plist');

if (!fs.existsSync(plistPath)) {
  // electron's postinstall hasn't downloaded the binary yet (or install failed) — nothing to patch.
  process.exit(0);
}

const usageDescriptions = {
  NSCameraUsageDescription: 'Esta app necesita acceder a la cámara para marcar asistencia.',
  NSMicrophoneUsageDescription: 'Esta app necesita acceder al micrófono.',
  NSLocationUsageDescription: 'Esta app necesita tu ubicación para registrar la marca de asistencia.',
  NSLocationWhenInUseUsageDescription: 'Esta app necesita tu ubicación para registrar la marca de asistencia.'
};

for (const [key, value] of Object.entries(usageDescriptions)) {
  try {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string "${value}"`, plistPath], { stdio: 'ignore' });
  } catch {
    try {
      execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} "${value}"`, plistPath], { stdio: 'ignore' });
    } catch {
      // best-effort only — a missing key here just means that one prompt won't work.
    }
  }
}

// Editing Info.plist invalidates whatever signature the downloaded Electron.app
// shipped with, which brings back the JIT SIGTRAP crash on Apple Silicon unless
// re-signed with the same entitlements used for the packaged build.
try {
  execFileSync(
    'codesign',
    ['--deep', '--force', '--sign', '-', '--entitlements', entitlements, '--timestamp=none', appPath],
    { stdio: 'ignore' }
  );
  console.log('[postinstall-mac] Electron.app patched (camera/location usage descriptions) and re-signed.');
} catch (err) {
  console.warn('[postinstall-mac] Could not re-sign Electron.app after patching Info.plist:', err.message);
}
