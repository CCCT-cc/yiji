const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;
let tray = null;

function createWindow() {
  win = new BrowserWindow({
    width: 440,
    height: 880,
    minWidth: 380,
    minHeight: 640,
    title: '一记 · 极简记账',
    icon: path.join(__dirname, 'icon.ico'),
    backgroundColor: '#f7f8fa',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'web', 'index.html'));
  // 开发期可按 F12 打开调试；生产可删掉
  // win.webContents.openDevTools();

  // 关闭窗口时不退出，仅最小化到托盘（常驻后台）
  win.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      win.hide();
      return;
    }
  });
}

function buildTrayMenu() {
  const openAtLogin = app.getLoginItemSettings().openAtLogin;
  return Menu.buildFromTemplate([
    { label: '打开一记', click: () => showWin() },
    {
      label: (openAtLogin ? '☑ ' : '☐ ') + '开机自动启动',
      click: () => {
        const next = !app.getLoginItemSettings().openAtLogin;
        app.setLoginItemSettings({ openAtLogin: next, path: process.execPath, args: [] });
        refreshTray();
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
}

function showWin() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function refreshTray() {
  if (tray) tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.ico');
  let img = nativeImage.createFromPath(iconPath);
  if (img.isEmpty()) {
    // 兜底：用 16x16 绿底白字「记」
    const { nativeImage: NI } = require('electron');
    const c = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" rx="4" fill="#2f7d4f"/><text x="8" y="12" font-size="11" fill="#fff" text-anchor="middle" font-family="sans-serif">记</text></svg>'
    );
    img = NI.createFromBuffer(c, { width: 16, height: 16 });
  }
  tray = new Tray(img);
  tray.setToolTip('一记 · 极简记账');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => showWin());
  tray.on('double-click', () => showWin());
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  // 默认开启开机自启（桌面常驻记账本）；用户可在托盘菜单关闭
  try {
    if (!app.getLoginItemSettings().openAtLogin) {
      app.setLoginItemSettings({ openAtLogin: true, path: process.execPath, args: [] });
    }
  } catch (e) { /* 某些环境无权限，忽略 */ }
});

app.on('window-all-closed', () => {
  // 不再在此退出：关闭仅最小化到托盘，由托盘「退出」真正退出
  if (process.platform === 'darwin' && BrowserWindow.getAllWindows().length === 0) app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else showWin();
});

// 前端可请求退出（如「设置-退出」）
ipcMain.on('app-quit', () => {
  app.isQuiting = true;
  app.quit();
});

// 备份/恢复：把账本 JSON 写入 userData/backups（独立于 localStorage，清档/重装也不丢）
ipcMain.handle('backup-save', async (e, { filename, json }) => {
  try {
    const dir = path.join(app.getPath('userData'), 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const fp = path.join(dir, filename);
    fs.writeFileSync(fp, json, 'utf8');
    return { ok: true, path: fp };
  } catch (err) { return { ok: false, error: err.message }; }
});
ipcMain.handle('backup-open', async () => {
  try {
    const res = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'JSON 备份', extensions: ['json'] }] });
    if (res.canceled || !res.filePaths || !res.filePaths[0]) return null;
    return fs.readFileSync(res.filePaths[0], 'utf8');
  } catch (err) { return null; }
});
// 自愈读取：load() 发现 localStorage 为空时，从自动备份文件找回（不会抛错，读不到返回 null）
ipcMain.handle('backup-read', async (e, { filename }) => {
  try {
    const fp = path.join(app.getPath('userData'), 'backups', filename || 'auto_latest.json');
    if (!fs.existsSync(fp)) return null;
    return fs.readFileSync(fp, 'utf8');
  } catch (err) { return null; }
});
