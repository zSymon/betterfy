const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aura', {
  platform: process.platform,
  login: (clientId) => ipcRenderer.invoke('auth:login', clientId),
  cancelLogin: () => ipcRenderer.invoke('auth:cancel'),
  getToken: (force) => ipcRenderer.invoke('auth:token', Boolean(force)),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  savePrefs: (prefs) => ipcRenderer.invoke('config:prefs', prefs),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  showMain: () => ipcRenderer.invoke('app:show'),
  getWidget: () => ipcRenderer.invoke('widget:get'),
  setWidget: (patch) => ipcRenderer.invoke('widget:set', patch),
  notesStyles: () => ipcRenderer.invoke('notes:styles'),
  sendPlayerState: (s) => ipcRenderer.send('player:state', s),
  sendCommand: (cmd, arg) => ipcRenderer.send('player:command', { cmd, arg }),
  setMediaKeys: (on) => ipcRenderer.send('media:keys', Boolean(on)),
  getUpdate: () => ipcRenderer.invoke('update:get'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  on: (channel, cb) => {
    if (!['widget:changed', 'prefs:changed', 'player:state', 'player:command', 'update:status'].includes(channel)) return () => {};
    const h = (_e, payload) => cb(payload);
    ipcRenderer.on(channel, h);
    return () => ipcRenderer.removeListener(channel, h);
  },
});
