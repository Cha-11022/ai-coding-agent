/**
 * AI Coding Agent - 桌面启动器
 * 
 * 使用方式：双击 start.bat 即可启动
 * 
 * 原理：
 * 1. 启动后端 Koa API 服务器（端口 8000）
 * 2. 启动静态文件服务器提供前端页面（端口 3000）
 * 3. 打开系统默认浏览器访问前端
 * 4. 按 Ctrl+C 停止所有服务
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

// ========== 配置 ==========
const PROJECT_ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.join(PROJECT_ROOT, 'app');
const BACKEND_DIST = path.join(APP_DIR, 'backend', 'dist', 'index.js');
const FRONTEND_DIST = path.join(APP_DIR, 'frontend', 'dist');
const BACKEND_PORT = 8000;
const FRONTEND_PORT = 3000;

// ========== 1. 启动后端服务 ==========
function startBackend() {
  return new Promise((resolve) => {
    if (!fs.existsSync(BACKEND_DIST)) {
      console.log('⚠️  后端未编译，正在编译...');
      const build = spawn('npm.cmd', ['run', 'build:backend'], {
        cwd: APP_DIR,
        shell: true,
        stdio: 'inherit',
      });
      build.on('close', (code) => {
        if (code !== 0) {
          console.error('❌ 后端编译失败');
          resolve(null);
          return;
        }
        doStartBackend(resolve);
      });
    } else {
      doStartBackend(resolve);
    }
  });
}

function doStartBackend(resolve) {
  const env = {
    ...process.env,
    NODE_OPTIONS: '',
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
    API_PROVIDER: process.env.API_PROVIDER || 'deepseek',
    PORT: String(BACKEND_PORT),
  };

  const child = spawn('node', [BACKEND_DIST], {
    env,
    cwd: APP_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  child.stdout.on('data', (d) => process.stdout.write(`[后端] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[后端] ${d}`));
  child.on('close', (code) => console.log(`[后端] 已退出 (code=${code})`));

  resolve(child);
}

// ========== 2. 启动前端静态服务器 ==========
function startFrontend() {
  const server = http.createServer((req, res) => {
    // 解析请求路径
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';

    let filePath = path.join(FRONTEND_DIST, urlPath);

    // 安全检查：防止目录遍历
    if (!filePath.startsWith(FRONTEND_DIST)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // SPA 支持：如果文件不存在，返回 index.html
        fs.readFile(path.join(FRONTEND_DIST, 'index.html'), (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(data2);
        });
        return;
      }

      const ext = path.extname(filePath);
      const mime = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
      };
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });

  server.listen(FRONTEND_PORT, () => {
    console.log(`[前端] 静态服务器运行在 http://127.0.0.1:${FRONTEND_PORT}`);
  });

  server.on('error', (err) => {
    console.error(`[前端] 服务器启动失败: ${err.message}`);
  });

  return server;
}

// ========== 3. 等待后端就绪 ==========
function waitForBackend(timeout = 30000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/api/sessions`, (res) => {
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) {
          resolve(false);
        } else {
          setTimeout(check, 1000);
        }
      });
      req.setTimeout(2000, () => {
        req.destroy();
        if (Date.now() - start > timeout) {
          resolve(false);
        } else {
          setTimeout(check, 1000);
        }
      });
    };
    setTimeout(check, 500);
  });
}

// ========== 4. 打开浏览器 ==========
function openBrowser(url) {
  console.log(`\n🌐 正在打开浏览器: ${url}\n`);
  try {
    exec(`start "" "${url}"`);
  } catch (e) {
    console.log(`请手动打开浏览器访问: ${url}`);
  }
}

// ========== 5. 主流程 ==========
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║    Claude AI Coding Agent 启动器     ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  // 检查前端是否已编译
  if (!fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
    console.log('⚠️  前端未编译，正在编译...');
    const build = spawn('npm.cmd', ['run', 'build:frontend'], {
      cwd: APP_DIR,
      shell: true,
      stdio: 'inherit',
    });
    await new Promise((resolve) => build.on('close', resolve));
    if (!fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
      console.error('❌ 前端编译失败');
      process.exit(1);
    }
  }

  // 启动后端
  console.log('[1/4] 启动后端服务...');
  const backend = await startBackend();
  if (!backend) {
    console.error('❌ 后端启动失败');
    process.exit(1);
  }

  // 启动前端
  console.log('[2/4] 启动前端服务...');
  const frontend = startFrontend();

  // 等待后端就绪
  console.log('[3/4] 等待后端就绪...');
  const ready = await waitForBackend();
  if (ready) {
    console.log('✅ 后端就绪！');
  } else {
    console.log('⚠️  后端未在超时内响应，仍然尝试打开...');
  }

  // 打开浏览器
  console.log('[4/4] 打开前端界面...');
  const url = `http://127.0.0.1:${FRONTEND_PORT}`;
  openBrowser(url);

  // 显示信息
  console.log('');
  console.log('┌─────────────────────────────────────┐');
  console.log(`│  ✅ 应用已启动！                      │`);
  console.log(`│  前端: http://127.0.0.1:${FRONTEND_PORT}          │`);
  console.log(`│  后端: http://127.0.0.1:${BACKEND_PORT}           │`);
  console.log('│                                      │');
  console.log('│  按 Ctrl+C 停止所有服务              │');
  console.log('└─────────────────────────────────────┘');
  console.log('');

  // 优雅退出
  const cleanup = () => {
    console.log('\n🛑 正在停止服务...');
    if (backend && !backend.killed) backend.kill();
    if (frontend) frontend.close();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((err) => {
  console.error('❌ 启动失败:', err.message);
  process.exit(1);
});
