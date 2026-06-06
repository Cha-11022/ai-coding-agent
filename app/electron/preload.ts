import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // App info
  isDev: () => ipcRenderer.invoke('is-dev'),
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // File system
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  checkPathExists: (filePath: string) => ipcRenderer.invoke('check-path-exists', filePath),

  // Dialogs
  showMessageBox: (options: unknown) => ipcRenderer.invoke('show-message-box', options),

  // Notifications
  sendNotification: ({ title, body }: { title: string; body: string }) =>
    ipcRenderer.invoke('notification', { title, body }),

  // Menu events
  onMenuNewSession: (callback: () => void) => {
    ipcRenderer.on('menu-new-session', () => callback());
    return () => ipcRenderer.removeAllListeners('menu-new-session');
  },
  onMenuOpenDir: (callback: (dirPath: string) => void) => {
    ipcRenderer.on('menu-open-dir', (_event: unknown, dirPath: string) => callback(dirPath));
    return () => ipcRenderer.removeAllListeners('menu-open-dir');
  },

  // Backend status
  onBackendStatus: (callback: (status: unknown) => void) => {
    ipcRenderer.on('backend-status', (_event: unknown, status: unknown) => callback(status));
    return () => ipcRenderer.removeAllListeners('backend-status');
  },
});