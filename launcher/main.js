/**
 * AI Coding Agent - Standalone Launcher
 * 
 * 此文件通过 child_process 启动后端服务，然后创建 Electron 窗口加载前端。
 * 完全不依赖 require('electron')，解决模块解析问题。
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ===== 配置 =====
const PROJECT_ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.join(PROJECT_ROOT, 'app');
const BACKEND_DIST = path.join(APP_DIR, 'backend', 'dist', 'index.js');
const FRONTEND_DIST = path.join(APP_DIR, 'frontend', 'dist', 'index.html');
const BACKEND_PORT = 8000;
const FRONTEND_PORT = 3000;

// ===== 1. 简易 HTTP 服务器（替代 Electron 内置，直接提供前端页面）=====
function startFrontendServer() {
  const http = require('http');
  const fs = require('fs');
  const path = require('path');

  const server = http.createServer((req, res) => {
    let filePath = path.join(FRONTEND_DIST, '..', req.url === '/' ? '/index.html' : req.url);
    
    try {
      const content = fs.readFileSync(filePath);
      const ext = path.extname(filePath);
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain; charset=utf-8' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(FRONTEND_PORT, () => {
    console.log(`[Frontend] Server running at http://127.0.0.1:${FRONTEND_PORT}`);
  });

  return server;
}

// ===== 2. 启动后端 =====
function startBackend() {
  if (!fs.existsSync(BACKEND_DIST)) {
    console.error(`[Backend] Not built: ${BACKEND_DIST}`);
    console.log('[Backend] Run "cd app && npm run build:backend" first');
    return null;
  }

  const env = {
    ...process.env,
    NODE_OPTIONS: '',
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
    API_PROVIDER: process.env.API_PROVIDER || 'deepseek',
    PORT: String(BACKEND_PORT),
  };

  // Try using system Node for backend
  const nodePaths = [
    'D:\\nodejs\\node.exe',
    'C:\\Program Files\\nodejs\\node.exe',
    'node',
  ];

  let nodeExe = nodePaths.find(p => {
    try { return fs.existsSync(p) || p === 'node'; } catch { return false; }
  });

  if (!nodeExe) {
    nodeExe = 'node';
  }

  const child = spawn(nodeExe, [BACKEND_DIST], {
    env,
    cwd: APP_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: false,
  });

  child.stdout.on('data', (data) => {
    process.stdout.write(`[Backend] ${data}`);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(`[Backend] ${data}`);
  });

  child.on('close', (code) => {
    console.log(`[Backend] Process exited with code ${code}`);
  });

  return child;
}

// ===== 3. 等待后端就绪 =====
function waitForBackend(maxRetries = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/health`, (res) => {
        resolve(true);
      });
      req.on('error', () => {
        if (attempts >= maxRetries) {
          resolve(false); // 后端没起来也继续，前端会显示连接错误
        } else {
          setTimeout(check, 1000);
        }
      });
      req.setTimeout(2000, () => {
        req.destroy();
        if (attempts >= maxRetries) {
          resolve(false);
        } else {
          setTimeout(check, 1000);
        }
      });
    };
    check();
  });
}

// ===== 4. 主流程 =====
async function main() {
  console.log('='.repeat(50));
  console.log('  Claude AI Coding Agent - Launcher');
  console.log('='.repeat(50));
  console.log(`  后端: ${BACKEND_DIST}`);
  console.log(`  前端: ${FRONTEND_DIST}`);
  console.log('='.repeat(50));

  // 启动后端
  console.log('\n[Start] Starting backend server...');
  const backend = startBackend();

  // 启动前端 HTTP 服务器
  console.log('[Start] Starting frontend server...');
  const frontend = startFrontendServer();

  // 等待后端
  console.log('[Start] Waiting for backend...');
  const backendReady = await waitForBackend();
  if (backendReady) {
    console.log('[Start] Backend is ready!');
  } else {
    console.log('[Start] Backend may not be ready, continuing...');
  }

  // 打开浏览器
  const url = `http://127.0.0.1:${FRONTEND_PORT}`;
  console.log(`\n[Start] Opening browser: ${url}`);
  
  const { exec } = require('child_process');
  exec(`start ${url}`);

  console.log('\n[Start] ✓ Application is running!');
  console.log(`  Frontend: http://127.0.0.1:${FRONTEND_PORT}`);
  console.log(`  Backend:  http://127.0.0.1:${BACKEND_PORT}`);
  console.log('\n  按 Ctrl+C 停止所有服务\n');

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\n[Shutdown] Stopping services...');
    if (backend) backend.kill();
    frontend.close();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('[Error]', err);
  process.exit(1);
});
