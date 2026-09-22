const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const os = require('os');
const { spawn } = require('child_process');

let ptyProcess = null;
try {
  // node-pty is optional at dev-time; app still runs (terminal panel disabled) if missing.
  var pty = require('node-pty');
} catch (e) {
  console.warn('[niko-files] node-pty not available — terminal panel will be disabled.', e.message);
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 860,
    minHeight: 560,
    backgroundColor: '#15161a',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (ptyProcess) ptyProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/* ---------------- Filesystem IPC ---------------- */

function humanSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

ipcMain.handle('fs:homedir', () => os.homedir());

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

ipcMain.handle('fs:thumbnail', async (event, filePath) => {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_BY_EXT[ext];
    if (!mime) return null;
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size > 12 * 1024 * 1024) return null;
    const data = await fs.readFile(filePath);
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
});

ipcMain.handle('fs:readdir', async (event, dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    let stat;
    try {
      stat = await fs.lstat(full);
    } catch {
      continue;
    }
    let isSymlink = stat.isSymbolicLink();
    let isDir = entry.isDirectory();
    if (isSymlink) {
      try {
        const real = await fs.stat(full);
        isDir = real.isDirectory();
      } catch {
        /* broken symlink */
      }
    }
    results.push({
      name: entry.name,
      path: full,
      isDir,
      isSymlink,
      hidden: entry.name.startsWith('.'),
      size: stat.size,
      sizeLabel: isDir ? '' : humanSize(stat.size),
      mtime: stat.mtimeMs,
      mode: stat.mode
    });
  }
  return results.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
});

ipcMain.handle('fs:mkdir', async (event, dirPath) => fs.mkdir(dirPath, { recursive: false }));

ipcMain.handle('fs:rename', async (event, oldPath, newPath) => fs.rename(oldPath, newPath));

ipcMain.handle('fs:trash', async (event, targetPath) => shell.trashItem(targetPath));

ipcMain.handle('fs:openNative', async (event, targetPath) => shell.openPath(targetPath));

ipcMain.handle('fs:showInFolder', async (event, targetPath) => shell.showItemInFolder(targetPath));

async function uniqueDestName(destDir, baseName) {
  const ext = path.extname(baseName);
  const stem = ext ? baseName.slice(0, -ext.length) : baseName;
  let candidate = baseName;
  let n = 1;
  while (fsSync.existsSync(path.join(destDir, candidate))) {
    n++;
    candidate = n === 2 ? `${stem} (copy)${ext}` : `${stem} (copy ${n - 1})${ext}`;
  }
  return candidate;
}

ipcMain.handle('fs:copy', async (event, src, destDir) => {
  // Never silently overwrite: if the name exists at the destination, pick
  // a free "name (copy)" / "name (copy 2)" style name instead.
  const name = await uniqueDestName(destDir, path.basename(src));
  const dest = path.join(destDir, name);
  await fs.cp(src, dest, { recursive: true, errorOnExist: true, force: false });
  return dest;
});

ipcMain.handle('fs:move', async (event, src, destDir) => {
  const name = await uniqueDestName(destDir, path.basename(src));
  const dest = path.join(destDir, name);
  try {
    await fs.rename(src, dest);
  } catch (err) {
    // EXDEV: moving across filesystems/devices — rename() can't do that,
    // fall back to copy + delete original.
    if (err.code === 'EXDEV') {
      await fs.cp(src, dest, { recursive: true });
      await fs.rm(src, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
  return dest;
});

ipcMain.handle('fs:diskUsage', async (event, dirPath) => {
  return new Promise((resolve) => {
    const child = spawn('du', ['-sh', dirPath]);
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('close', () => resolve(out.split('\t')[0] || '?'));
    child.on('error', () => resolve('?'));
  });
});

ipcMain.handle('dialog:pickFolder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (res.canceled) return null;
  return res.filePaths[0];
});

/* ---------------- Terminal (PTY) IPC ---------------- */

ipcMain.handle('pty:available', () => !!pty);

ipcMain.handle('pty:create', (event, cwd, cols, rows) => {
  if (!pty) return false;
  if (ptyProcess) ptyProcess.kill();
  const shellBin = process.env.SHELL || '/bin/bash';
  ptyProcess = pty.spawn(shellBin, [], {
    name: 'xterm-256color',
    cols: cols || 100,
    rows: rows || 30,
    cwd: cwd || os.homedir(),
    env: process.env
  });
  ptyProcess.onData((data) => {
    if (mainWindow) mainWindow.webContents.send('pty:data', data);
  });
  ptyProcess.onExit(() => {
    if (mainWindow) mainWindow.webContents.send('pty:exit');
    ptyProcess = null;
  });
  return true;
});

ipcMain.on('pty:write', (event, data) => {
  if (ptyProcess) ptyProcess.write(data);
});

ipcMain.on('pty:resize', (event, cols, rows) => {
  if (ptyProcess) {
    try {
      ptyProcess.resize(cols, rows);
    } catch {}
  }
});

ipcMain.on('pty:cd', (event, dirPath) => {
  if (ptyProcess) {
    // Escape embedded double quotes/backslashes so a folder name like
    // `weird"name` can't break out of the quoted shell argument.
    const safe = String(dirPath).replace(/(["\\$`])/g, '\\$1');
    ptyProcess.write(`cd "${safe}"\r`);
  }
});

ipcMain.handle('pty:kill', () => {
  if (ptyProcess) ptyProcess.kill();
  ptyProcess = null;
});
