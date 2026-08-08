// ============================================================
// Zenith — Main Process (Electron)
// Production-ready: persistent settings, cross-platform, IPC
// ============================================================

const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, globalShortcut } = require('electron');
const path = require('path');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// ── Persistent Store ──────────────────────────────────────────
const fs = require('fs');
const os = require('os');
const settingsDir = path.join(os.homedir(), '.zenith');
const settingsFile = path.join(settingsDir, 'settings.json');

try { fs.mkdirSync(settingsDir, { recursive: true }); } catch (e) {}

let settingsData = {
  userName: '',
  onboardingComplete: false,
  theme: 'dark',
  monitoringEnabled: true,
  alertCooldown: 120,
  sensitivity: 5,
  sessionsCount: 0,
  totalMinutes: 0,
  interventionsCompleted: 0,
};

try {
  if (fs.existsSync(settingsFile)) {
    const saved = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    settingsData = { ...settingsData, ...saved };
  }
} catch (e) {
  console.error('[Zenith] Failed to load settings:', e);
}

const store = {
  get: (key, def) => settingsData[key] !== undefined ? settingsData[key] : def,
  set: (key, val) => {
    settingsData[key] = val;
    try {
      fs.writeFileSync(settingsFile, JSON.stringify(settingsData, null, 2), 'utf8');
    } catch (e) {
      console.error('[Zenith] Failed to save settings:', e);
    }
  },
};

let mainWindow = null;
let tray = null;
let isQuitting = false;

// ── Single Instance Lock ──────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

app.on('second-instance', () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
});

// ── Create Main Window ────────────────────────────────────────
function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Responsive sizing based on screen
  const winWidth = Math.min(440, Math.round(screenWidth * 0.25));
  const winHeight = Math.min(720, Math.round(screenHeight * 0.85));

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: screenWidth - winWidth - 20,
    y: Math.round((screenHeight - winHeight) / 2),
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: false,
    alwaysOnTop: false,
    hasShadow: true,
    show: false,
    icon: path.join(__dirname, '..', 'renderer', 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Forward renderer console to terminal (safely)
  mainWindow.webContents.on('console-message', (event, level, message) => {
    try {
      const levels = ['LOG', 'WARN', 'ERROR'];
      process.stdout.write(`[Renderer ${levels[level] || 'LOG'}] ${message}\n`);
    } catch(e) { /* EPIPE — stdout closed, ignore */ }
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// ── System Tray ───────────────────────────────────────────────
function createTray() {
  tray = new Tray(nativeImage.createFromBuffer(
    createTrayIconBuffer(), { width: 16, height: 16 }
  ));

  const userName = store.get('userName', '');
  const greeting = userName ? `🧠 Zenith — ${userName}` : '🧠 Open Zenith';

  const contextMenu = Menu.buildFromTemplate([
    { label: greeting, click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: '⏸  Pause Monitoring', type: 'checkbox', checked: false,
      click: (m) => mainWindow.webContents.send('toggle-monitoring', !m.checked) },
    { label: '🌙 Focus Mode', click: () => { mainWindow.webContents.send('activate-focus-mode'); mainWindow.show(); } },
    { type: 'separator' },
    { label: '⚙️  Settings', click: () => { mainWindow.webContents.send('open-settings'); mainWindow.show(); } },
    { type: 'separator' },
    { label: '✕  Quit Zenith', click: () => { isQuitting = true; app.quit(); } },
  ]);

  tray.setToolTip('Zenith — Cognitive Wellness');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow.isVisible()) mainWindow.hide();
    else { mainWindow.show(); mainWindow.focus(); }
  });
}

function createTrayIconBuffer() {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  const cx = 8, cy = 8, r = 6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= r) {
        const t = dist / r;
        buf[idx]     = Math.round(99 * (1-t) + 123 * t);
        buf[idx + 1] = Math.round(226 * (1-t) + 147 * t);
        buf[idx + 2] = Math.round(184 * (1-t) + 253 * t);
        buf[idx + 3] = 255;
      }
    }
  }
  return buf;
}

// ── IPC Handlers ──────────────────────────────────────────────
ipcMain.on('minimize-window', () => mainWindow.hide());
ipcMain.on('close-window', () => mainWindow.hide());

// Mini Widget Mode
let isMiniMode = false;
ipcMain.on('toggle-mini-mode', () => {
  if (!mainWindow) return;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  if (!isMiniMode) {
    // Switch to mini mode
    mainWindow.setBounds({ width: 280, height: 100, x: screenWidth - 300, y: screenHeight - 120 });
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    isMiniMode = true;
  } else {
    // Restore normal mode
    const winWidth = Math.min(440, Math.round(screenWidth * 0.25));
    const winHeight = Math.min(720, Math.round(screenHeight * 0.85));
    mainWindow.setBounds({ width: winWidth, height: winHeight, x: screenWidth - winWidth - 20, y: Math.round((screenHeight - winHeight) / 2) });
    mainWindow.setAlwaysOnTop(false);
    isMiniMode = false;
  }
  mainWindow.webContents.send('mini-mode-toggled', isMiniMode);
});

ipcMain.on('show-notification', (event, { title, body }) => {
  const { Notification } = require('electron');
  new Notification({ title, body, silent: true }).show();
});

// Active window detection
ipcMain.handle('get-active-window', async () => {
  const { execSync } = require('child_process');
  try {
    if (process.platform === 'win32') {
      const cmd = `powershell -NoProfile -Command "(Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Sort-Object -Property CPU -Descending | Select-Object -First 1).MainWindowTitle"`;
      const result = execSync(cmd, { timeout: 3000, encoding: 'utf8' }).trim();
      const parts = result.split(' - ');
      return parts[parts.length - 1] || result || 'Unknown';
    } else if (process.platform === 'darwin') {
      const result = execSync(`osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`, { timeout: 3000, encoding: 'utf8' }).trim();
      return result || 'Unknown';
    }
    return 'Unknown';
  } catch (e) { return 'Unknown'; }
});

// Screen Dim — creates a fullscreen dark overlay
let dimWindow = null;
ipcMain.handle('screen-dim-on', (event, opacity) => {
  if (dimWindow) return;
  // Get full bounds across all displays
  const displays = screen.getAllDisplays();
  let minX = 0, minY = 0, maxWidth = 0, maxHeight = 0;
  displays.forEach(d => {
    minX = Math.min(minX, d.bounds.x);
    minY = Math.min(minY, d.bounds.y);
    maxWidth = Math.max(maxWidth, d.bounds.x + d.bounds.width);
    maxHeight = Math.max(maxHeight, d.bounds.y + d.bounds.height);
  });

  dimWindow = new BrowserWindow({
    x: minX, y: minY, width: maxWidth - minX, height: maxHeight - minY,
    frame: false, transparent: true, alwaysOnTop: true,
    backgroundColor: '#00000000',
    skipTaskbar: true, resizable: false, focusable: false,
    hasShadow: false, type: 'window',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  dimWindow.setIgnoreMouseEvents(true);
  dimWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  dimWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  const dimHtml = `data:text/html,<html><body style="margin:0;background:rgba(0,0,0,${opacity || 0.65});width:100vw;height:100vh;overflow:hidden;"></body></html>`;
  dimWindow.loadURL(dimHtml);
  dimWindow.showInactive();
  return true;
});

ipcMain.handle('screen-dim-off', () => {
  if (dimWindow) { dimWindow.close(); dimWindow = null; }
  return true;
});

// Focus Mode — set app opacity + try to enable Windows DND
ipcMain.handle('focus-mode-on', () => {
  if (mainWindow) mainWindow.setOpacity(0.85);
  // Try to enable Windows Focus Assist (best effort)
  try {
    const { execSync } = require('child_process');
    if (process.platform === 'win32') {
      execSync('powershell -NoProfile -Command "Set-ItemProperty -Path HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings -Name NOC_GLOBAL_SETTING_TOASTS_ENABLED -Value 0 -Type DWord -ErrorAction SilentlyContinue"', { timeout: 3000 });
      // Actually force focus by minimizing everything else
      execSync('powershell -NoProfile -WindowStyle Hidden -Command "(New-Object -ComObject Shell.Application).MinimizeAll()"', { timeout: 3000 });
    }
  } catch (e) { /* non-critical */ }
  return true;
});

ipcMain.handle('focus-mode-off', () => {
  if (mainWindow) mainWindow.setOpacity(1.0);
  try {
    const { execSync } = require('child_process');
    if (process.platform === 'win32') {
      execSync('powershell -NoProfile -Command "Set-ItemProperty -Path HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings -Name NOC_GLOBAL_SETTING_TOASTS_ENABLED -Value 1 -Type DWord -ErrorAction SilentlyContinue"', { timeout: 3000 });
      // Restore windows
      execSync('powershell -NoProfile -WindowStyle Hidden -Command "(New-Object -ComObject Shell.Application).UndoMinimizeALL()"', { timeout: 3000 });
    }
  } catch (e) { /* non-critical */ }
  return true;
});

// Settings IPC
ipcMain.handle('store-get', (event, key) => store.get(key));
ipcMain.handle('store-set', (event, key, value) => {
  store.set(key, value);
  return true;
});
ipcMain.handle('store-get-all', () => {
  return {
    userName: store.get('userName'),
    onboardingComplete: store.get('onboardingComplete'),
    theme: store.get('theme'),
    monitoringEnabled: store.get('monitoringEnabled'),
    alertCooldown: store.get('alertCooldown'),
    sensitivity: store.get('sensitivity'),
    sessionsCount: store.get('sessionsCount'),
    totalMinutes: store.get('totalMinutes'),
    interventionsCompleted: store.get('interventionsCompleted'),
  };
});

// ── App Lifecycle ─────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();

  // Cross-platform shortcut
  const shortcut = process.platform === 'darwin' ? 'Command+Shift+Z' : 'Control+Shift+Z';
  globalShortcut.register(shortcut, () => {
    if (mainWindow.isVisible()) mainWindow.hide();
    else { mainWindow.show(); mainWindow.focus(); }
  });

  // Increment session count
  store.set('sessionsCount', (store.get('sessionsCount') || 0) + 1);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
