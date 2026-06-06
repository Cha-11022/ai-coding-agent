import { app, BrowserWindow, Menu, Tray, ipcMain, shell, dialog, nativeImage, Notification, MenuItemConstructorOptions, NativeImage, IpcMainInvokeEvent, MessageBoxOptions, Event } from 'electron';
import * as path from 'path';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import { screen } from 'electron';

// --- Configuration ---
const isDev = process.env.NODE_ENV === 'development';
const BACKEND_PORT = 8000;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let backendProcess: any = null;
let isQuitting = false;
let backendRestartCount = 0;
const MAX_BACKEND_RESTARTS = 3;

// --- Paths ---
// Compiled file lives at app/electron/dist/main.js
// We need app/ as the root for backend/ and frontend/
const APP_DIR = path.resolve(__dirname, '..', '..');
const PROJECT_ROOT = path.resolve(APP_DIR, '..');
const BACKEND_SRC = path.join(APP_DIR, 'backend', 'src', 'index.ts');
const BACKEND_DIST = path.join(APP_DIR, 'backend', 'dist', 'index.js');
const FRONTEND_DIST = path.join(APP_DIR, 'frontend', 'dist', 'index.html');
const FRONTEND_DEV_DIR = path.join(APP_DIR, 'frontend');

console.log(`[Paths] APP_DIR: ${APP_DIR}`);
console.log(`[Paths] PROJECT_ROOT: ${PROJECT_ROOT}`);
console.log(`[Paths] BACKEND_SRC: ${BACKEND_SRC}`);
console.log(`[Paths] BACKEND_DIST: ${BACKEND_DIST}`);
console.log(`[Paths] FRONTEND_DIST: ${FRONTEND_DIST}`);

// --- Kill existing process on port ---
function killProcessOnPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        // Port is in use, try to kill it
        console.log(`[Backend] Port ${port} is already in use, attempting to free it...`);
        if (process.platform === 'win32') {
          // Find PID using the port
          const { execSync } = require('child_process');
          try {
            const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
            const lines = out.split('\n').filter((l: string) => l.includes('LISTENING'));
            if (lines.length > 0) {
              const pid = lines[0].trim().split(/\s+/).pop();
              if (pid && parseInt(pid) > 0) {
                try {
                  execSync(`taskkill /PID ${pid} /F`, { windowsHide: true });
                  console.log(`[Backend] Killed process ${pid} on port ${port}`);
                  resolve(true);
                  return;
                } catch {
                  console.warn(`[Backend] Failed to kill process ${pid}`);
                }
              }
            }
          } catch {
            // netstat failed
          }
        }
        resolve(false);
      } else {
        server.close();
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port, '127.0.0.1');
  });
}

// --- Start Backend Server ---
function startBackendServer(): Promise<string> {
  return new Promise(async (resolve, reject) => {
    // Try to free the port first
    await killProcessOnPort(BACKEND_PORT);

    // Use compiled JS if available, otherwise fall back to ts-node
    const isCompiled = fs.existsSync(BACKEND_DIST);
    let command: string;
    let args: string[];

    if (isCompiled) {
      command = 'node';
      args = [BACKEND_DIST];
    } else {
      // Check if npx/ts-node available
      command = 'npx';
      args = ['ts-node', BACKEND_SRC];
    }

    console.log(`[Backend] Starting: ${command} ${args.join(' ')}`);
    console.log(`[Backend] CWD: ${APP_DIR}`);

    const env = {
      ...process.env,
      ELECTRON_RUN: '1',
      PYTHONIOENCODING: 'utf-8',
    };

    backendProcess = spawn(command, args, {
      cwd: APP_DIR,
      env: env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: process.platform === 'win32',
    });

    let outputBuffer = '';
    let started = false;

    backendProcess.stdout.on('data', (data: Buffer) => {
      const text = data.toString('utf-8');
      outputBuffer += text;
      console.log(`[Backend] ${text.trim()}`);

      if (!started && (text.includes('Server running') || text.includes(`${BACKEND_PORT}`))) {
        started = true;
        setTimeout(() => resolve(BACKEND_URL), 500);
      }
    });

    backendProcess.stderr.on('data', (data: Buffer) => {
      const text = data.toString('utf-8');
      console.log(`[Backend:err] ${text.trim()}`);
      outputBuffer += text;

      if (!started && text.includes(`${BACKEND_PORT}`)) {
        started = true;
        setTimeout(() => resolve(BACKEND_URL), 500);
      }
    });

    backendProcess.on('error', (err: Error) => {
      console.error(`[Backend] Failed to start:`, err);
      if (!started) reject(err);
    });

    backendProcess.on('exit', (code: number | null, signal: string | null) => {
      console.log(`[Backend] Exited with code ${code}, signal ${signal}`);
      if (!started) {
        reject(new Error(`Backend exited with code ${code}. Output: ${outputBuffer}`));
      } else {
        // Auto-restart backend if it crashed after successful start (with limit)
        if (!isQuitting && code !== 0 && backendRestartCount < MAX_BACKEND_RESTARTS) {
          backendRestartCount++;
          console.log(`[Backend] Unexpected crash, restarting... (attempt ${backendRestartCount}/${MAX_BACKEND_RESTARTS})`);
          startBackendServer().catch(() => {});
        } else if (code !== 0 && backendRestartCount >= MAX_BACKEND_RESTARTS) {
          console.error(`[Backend] Max restart attempts (${MAX_BACKEND_RESTARTS}) reached. Stopping.`);
        }
      }
    });

    // Timeout: poll /api/status after 15s
    setTimeout(() => {
      if (!started) {
        const req = http.get(`${BACKEND_URL}/api/status`, (res) => {
          if (res.statusCode === 200) {
            started = true;
            resolve(BACKEND_URL);
          }
        });
        req.on('error', () => {
          reject(new Error(`Backend failed to start within 15s. Output: ${outputBuffer.slice(-500)}`));
        });
        req.setTimeout(2000, () => {
          req.destroy();
          reject(new Error(`Backend timeout. Output: ${outputBuffer.slice(-500)}`));
        });
      }
    }, 15000);
  });
}

// --- Stop Backend Server ---
function stopBackendServer(): void {
  if (backendProcess) {
    console.log('[Backend] Stopping...');
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(backendProcess.pid), '/f', '/t'], { windowsHide: true });
    } else {
      backendProcess.kill('SIGTERM');
      setTimeout(() => {
        if (backendProcess && !backendProcess.killed) {
          backendProcess.kill('SIGKILL');
        }
      }, 3000);
    }
    backendProcess = null;
  }
}

// --- Create Menu ---
function createMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Session',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-new-session');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Open Directory',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              properties: ['openDirectory']
            });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow!.webContents.send('menu-open-dir', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About Claude AI Coding Agent',
              message: 'Claude AI Coding Agent',
              detail: 'Version 1.0.0\n\nAn AI-powered coding assistant for efficient software development.',
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// --- Create Tray ---
function createTray(): void {
  const iconPath = path.join(__dirname, 'icon.png');
  let trayIcon: NativeImage;
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } else {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Claude AI Coding Agent');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'New Session',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('menu-new-session');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// --- Create Window ---
function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1400, width),
    height: Math.min(900, height),
    minWidth: 900,
    minHeight: 600,
    title: 'Claude AI Coding Agent',
    icon: path.join(__dirname, 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    frame: process.platform === 'win32' ? false : true,
    backgroundColor: '#0f0f1a',
  });

  // Load frontend: prefer built dist, fallback to Vite dev server
  if (fs.existsSync(FRONTEND_DIST)) {
    mainWindow.loadURL(`file://${FRONTEND_DIST}`);
  } else {
    // Try Vite dev server
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      // Last resort: load backend URL
      if (mainWindow) mainWindow.loadURL(BACKEND_URL);
    });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow!.show();
    if (isDev) {
      mainWindow!.webContents.openDevTools();
    }
  });

  mainWindow.on('close', (event: Event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow!.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// --- IPC Handlers ---
function setupIPC(): void {
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  ipcMain.handle('is-dev', () => isDev);
  ipcMain.handle('get-backend-url', () => BACKEND_URL);

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('show-message-box', async (_event: IpcMainInvokeEvent, options: MessageBoxOptions) => {
    return await dialog.showMessageBox(mainWindow!, options);
  });

  ipcMain.handle('get-app-version', () => app.getVersion());

  ipcMain.handle('check-path-exists', (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  });

  ipcMain.handle('notification', (_event: IpcMainInvokeEvent, { title, body }: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      const notif = new Notification({ title, body });
      notif.show();
      notif.on('click', () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      });
    }
  });
}

// --- App Lifecycle ---
app.whenReady().then(async () => {
  setupIPC();
  createMenu();

  // Start backend server first
  try {
    await startBackendServer();
    console.log('[Backend] Server started successfully');
  } catch (err) {
    console.error('[Backend] Failed to start:', err);
    // Continue anyway - the window will show a connection error
  }

  createWindow();
  createTray();

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopBackendServer();
});

app.on('will-quit', () => {
  stopBackendServer();
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
