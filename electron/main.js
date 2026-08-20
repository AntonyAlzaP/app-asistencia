const { app, BrowserWindow, session, shell, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const isDev = !app.isPackaged;
const startUrl = process.env['ELECTRON_START_URL'];

// Lives in the per-user-per-machine profile folder (e.g. %APPDATA%\<app>),
// NOT inside the install directory — copying the .exe to another laptop does
// not carry this file along, so the new machine looks unrecognized until an
// auditor approves it. Not unbreakable (a technical user could copy this file
// too), but raises the bar well above "drag the folder to another laptop".
function getOrCreateDeviceId() {
  const filePath = path.join(app.getPath('userData'), 'device-id.json');
  try {
    const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (existing.deviceId) {
      return existing;
    }
  } catch {
    // File missing or unreadable — fall through to create a fresh one.
  }
  const record = { deviceId: crypto.randomUUID(), hostname: os.hostname() };
  fs.writeFileSync(filePath, JSON.stringify(record));
  return record;
}

ipcMain.handle('device:get-id', () => getOrCreateDeviceId());

// In dev the app runs from source (public/ exists as-is); once packaged, only
// what's under dist/app-asistencia/browser (which includes a copy of public/,
// per angular.json's assets glob) ships inside the asar.
const windowIcon = isDev
  ? path.join(__dirname, '..', 'public', 'favicon.ico')
  : path.join(__dirname, '..', 'dist', 'app-asistencia', 'browser', 'favicon.ico');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (!isDev) {
    Menu.setApplicationMenu(null);
  }

  // Links like "Ver mapa" (target="_blank") are handed to the OS default
  // browser instead of opening inside (or spawning) an Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // This is a single-page app; the router never does a full document
  // navigation, so any 'will-navigate' (a stray <a href>, a compromised
  // renderer) is unexpected and blocked outright. Doesn't affect the
  // initial loadURL/loadFile below — Electron doesn't fire this event for it.
  win.webContents.on('will-navigate', (event) => event.preventDefault());

  if (startUrl) {
    win.loadURL(startUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'app-asistencia', 'browser', 'index.html'));
  }
}

app.whenReady().then(() => {
  // session.defaultSession only exists once the app is ready — accessing it
  // any earlier throws "Session can only be received when app is ready".
  // The app captures an attendance photo and the device location on every
  // mark, so camera/geolocation requests from our own renderer are
  // auto-granted; everything else is denied.
  const ALLOWED_PERMISSIONS = new Set(['media', 'geolocation']);
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
