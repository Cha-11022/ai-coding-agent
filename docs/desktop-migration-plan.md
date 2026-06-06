# Claude AI Coding Agent → 桌面应用改造完整方案

## 一、项目现状分析

当前项目结构：
- **CLI入口**: `demo.py`（命令行菜单）
- **后端核心**: `src/` 目录（Planner、Executor、Session Manager、Auth等）
- **已有Web GUI**: 
  - `gui/backend/server.py`（FastAPI后端）
  - `gui/frontend/`（React前端）
  - 当前运行方式：启动FastAPI + 在浏览器中打开

## 二、改造方案评估

| 方案 | 技术 | 优点 | 缺点 |
|------|------|------|------|
| **方案A: Electron** | Electron + React (已有) | 生态成熟、跨平台、复用现有前端代码 | 包体积大(~150MB)、内存占用高 |
| **方案B: Tauri** | Tauri + React (已有) | 包体积小(~5MB)、性能好、安全 | 需要Rust知识、部分API不如Electron成熟 |
| **方案C: Python+webview** | pywebview + React | 最轻量、直接调用Python、无需Node后端 | 功能受限、样式整合复杂 |
| **方案D: PyQt/PySide** | Qt框架 + Python | 原生体验、功能强大 | 开发工作量大、UI美观度不如Web方案 |

## 三、推荐方案：Electron（方案A）

### 理由
1. **已有现成的React前端** — `gui/frontend/` 可直接复用
2. **已有FastAPI后端** — 可直接作为Electron的后台进程
3. **改动最小** — 只需添加Electron壳，无需重写前端
4. **生态成熟** — 文档丰富，打包部署方案成熟

### 需要改动的文件清单

### 1. 新增文件

| 文件 | 说明 |
|------|------|
| `electron/package.json` | Electron项目配置 |
| `electron/main.js` | Electron主进程（创建窗口、启动Python后端） |
| `electron/preload.js` | 预加载脚本（安全上下文桥接） |
| `electron/icon.png` | 应用图标 |
| `electron/build.js` | 打包脚本 |
| `.electron-builder.yml` | 打包配置 |

### 2. 需要修改的文件

| 文件 | 修改内容 |
|------|---------|
| `gui/backend/server.py` | 添加IPC通信支持、支持通过Electron菜单控制后台启动/停止 |
| `gui/frontend/package.json` | 添加electron依赖、修改scripts |
| `gui/frontend/public/index.html` | 可能需要调整title |
| `gui/frontend/src/App.js` | 添加窗口控制（最小化、关闭）、添加桌面端特有功能（文件拖拽、系统托盘） |
| `gui/frontend/src/App.css` | 适配Electron窗口（标题栏、无边框窗口） |
| `gui/frontend/src/api.js` | 添加IPC通道支持（直接调用Python而非HTTP） |
| `demo.py` | 添加桌面应用入口函数 |

### 3. 可选新增功能

| 功能 | 说明 |
|------|------|
| 系统托盘 | 最小化到系统托盘 |
| 全局快捷键 | 如 `Ctrl+Shift+A` 唤起应用 |
| 文件拖拽 | 拖拽项目目录到窗口直接打开 |
| 自动更新 | 集成 auto-updater |
| 原生菜单 | 文件、编辑、视图等原生菜单栏 |
| 启动加载页 | Python后端启动时的加载动画 |

## 四、详细实施步骤

### 第1步：初始化Electron项目
```bash
cd gui
npm init -y  # 在gui目录创建package.json
npm install electron electron-builder --save-dev
```

### 第2步：创建主进程 (electron/main.js)
- 创建BrowserWindow并加载React构建产物
- 启动Python FastAPI作为子进程
- 处理窗口关闭、系统托盘等

### 第3步：创建预加载脚本 (electron/preload.js)
- 暴露安全的IPC API给渲染进程
- 提供文件系统访问、窗口控制等桥接

### 第4步：修改前端适配桌面
- 添加窗口拖拽、最大化/最小化按钮
- 添加系统托盘集成
- 添加启动状态管理

### 第5步：配置打包 (.electron-builder.yml)
- 配置Windows安装包 (NSIS)
- 配置Python运行环境嵌入
- 配置自动更新

### 第6步：构建与分发
- 使用 electron-builder 打包为 exe 安装包
- 支持 Windows/Mac/Linux 三平台

## 五、替代简易方案：Python + pywebview

如果您不想引入Node.js/Rust，可以使用最轻量的方案：

### 只需新增/修改3个文件

| 文件 | 说明 |
|------|------|
| `gui/desktop_app.py` | 主入口，启动FastAPI + pywebview窗口 |
| `gui/requirements.txt` | 添加 pywebview 依赖 |
| 修改 `demo.py` | 添加桌面模式入口 |

**优点**：纯Python，无需额外运行时，包体积小
**缺点**：UI渲染依赖于系统WebView（Edge WebView2 on Windows），不如Electron灵活

## 六、推荐实施方案

**我建议采用 Electron 方案**，理由：
1. 您的React前端已经基本完善
2. Electro生态成熟，文档丰富
3. 可以做出更专业的桌面体验（托盘、快捷键、自动更新等）
4. 跨平台支持最好

---

请问您倾向于哪个方案？如果确定了方向，我可以立即开始实施。