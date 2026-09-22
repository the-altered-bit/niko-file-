const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('niko', {
  homedir: () => ipcRenderer.invoke('fs:homedir'),
  readDir: (p) => ipcRenderer.invoke('fs:readdir', p),
  mkdir: (p) => ipcRenderer.invoke('fs:mkdir', p),
  rename: (a, b) => ipcRenderer.invoke('fs:rename', a, b),
  trash: (p) => ipcRenderer.invoke('fs:trash', p),
  openNative: (p) => ipcRenderer.invoke('fs:openNative', p),
  showInFolder: (p) => ipcRenderer.invoke('fs:showInFolder', p),
  copy: (src, destDir) => ipcRenderer.invoke('fs:copy', src, destDir),
  move: (src, destDir) => ipcRenderer.invoke('fs:move', src, destDir),
  diskUsage: (p) => ipcRenderer.invoke('fs:diskUsage', p),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),

  ptyAvailable: () => ipcRenderer.invoke('pty:available'),
  ptyCreate: (cwd, cols, rows) => ipcRenderer.invoke('pty:create', cwd, cols, rows),
  ptyWrite: (data) => ipcRenderer.send('pty:write', data),
  ptyResize: (cols, rows) => ipcRenderer.send('pty:resize', cols, rows),
  ptyCd: (dirPath) => ipcRenderer.send('pty:cd', dirPath),
  ptyKill: () => ipcRenderer.invoke('pty:kill'),
  onPtyData: (cb) => ipcRenderer.on('pty:data', (_e, data) => cb(data)),
  onPtyExit: (cb) => ipcRenderer.on('pty:exit', () => cb())
});
