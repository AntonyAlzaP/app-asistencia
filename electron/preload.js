const { contextBridge, ipcRenderer } = require('electron');

// The renderer talks to Supabase directly over HTTPS; the only privileged
// capabilities it needs from the main process are reading this machine's
// persisted device id (see main.js) and the optional saved-login store.
contextBridge.exposeInMainWorld('attendanceDevice', {
  getDeviceId: () => ipcRenderer.invoke('device:get-id')
});

contextBridge.exposeInMainWorld('attendanceCredentials', {
  save: (email, password) => ipcRenderer.invoke('credentials:save', { email, password }),
  load: () => ipcRenderer.invoke('credentials:load'),
  clear: () => ipcRenderer.invoke('credentials:clear')
});
