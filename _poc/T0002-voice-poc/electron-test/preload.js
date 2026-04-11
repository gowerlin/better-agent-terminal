const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  transcribe: () => ipcRenderer.invoke('transcribe'),
});
