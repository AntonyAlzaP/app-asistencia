const { contextBridge, ipcRenderer } = require('electron');

// The renderer talks to Supabase directly over HTTPS; the only privileged
// capability it needs from the main process is reading this machine's
// persisted device id (see main.js) for device-recognition purposes.
contextBridge.exposeInMainWorld('attendanceDevice', {
  getDeviceId: () => ipcRenderer.invoke('device:get-id')
});
