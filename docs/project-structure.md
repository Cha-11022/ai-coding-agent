# 项目结构说明

```
desktop/
├── package.json                    # monorepo 根配置
├── tsconfig.base.json              # 共享 TypeScript 基础配置
├── .gitignore
│
├── electron/                       # Electron 主进程 (TypeScript)
│   ├── package.json
│   ├── tsconfig.json
│   ├── main.ts                     # 主进程入口：窗口管理、IPC、菜单、托盘
│   └── preload.ts                  # 预加载脚本：contextBridge 暴露安全 API
│
├── frontend/                       # React 前端 (Vite + TypeScript)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts              # Vite 构建配置
│   ├── index.html                  # HTML 入口模板
│   └── src/
│       ├── main.tsx                # React 应用入口
│       ├── App.tsx                 # 主布局组件（标题栏 + 侧边栏 + 聊天区）
│       ├── components/
│       │   ├── Titlebar.tsx        # Electron 自定义标题栏（最小化/最大化/关闭）
│       │   ├── Sidebar.tsx         # 会话列表侧边栏
│       │   ├── ChatInput.tsx       # 消息输入框（支持 Enter 发送）
│       │   ├── Message.tsx         # 单条消息显示（用户/AI）
│       │   ├── NewSessionModal.tsx # 新建会话弹窗
│       │   └── SessionsListModal.tsx # 选择历史会话弹窗
│       ├── hooks/
│       │   ├── useSessions.ts      # 会话管理 Hook（列表/创建/删除/继续）
│       │   └── useChat.ts          # 聊天逻辑 Hook（发送消息、消息状态）
│       ├── api/
│       │   └── client.ts          # Axios HTTP 客户端
│       ├── types/
│       │   └── index.ts           # 前端类型定义
│       └── styles/
│           └── App.css            # 全局样式（暗色主题）
│
├── backend/                        # Node.js 后端服务 (TypeScript + Koa)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts               # 服务器入口（Koa 实例、中间件、路由注册）
│       ├── config.ts              # 配置管理（路径、API Key、超时等）
│       ├── types/
│       │   └── index.ts           # 共享类型定义
│       ├── routes/
│       │   ├── session.ts         # 会话路由（创建、列表、继续、删除）
│       │   └── conversation.ts    # 对话路由（发送消息）
│       └── services/
│           ├── session-manager.ts # 会话持久化管理（读写 JSON 文件）
│           ├── orchestrator.ts    # 编排器（多轮对话核心逻辑）
│           ├── ai-client.ts       # AI API 客户端（Deepseek/Claude/Mock）
│           ├── command-runner.ts  # Shell 命令执行器
│           ├── file-ops.ts        # 文件读写和快照管理
│           ├── file-diff.ts       # 文件差异解析和应用
│           ├── error-parser.ts    # 错误分析和修复建议
│           ├── auth-manager.ts    # 权限审批管理器
│           ├── logger.ts          # 日志系统
│           └── workspace-state.ts # 工作区状态和快照索引
│
├── doc/                            # 项目文档
│   ├── architecture.md            # 架构设计文档
│   ├── project-structure.md       # 本文件 - 项目结构说明
│   ├── api.md                     # API 接口文档
│   └── migration-guide.md         # 迁移指南
│
├── sessions/                       # 会话数据（JSON 文件持久化）
└── logs/                           # 日志文件
```

## 目录职责

### `electron/` — Electron 主进程
- 使用 TypeScript 编写，编译后由 Electron 加载
- `main.ts`：窗口创建、菜单、托盘、IPC 注册、后端进程管理
- `preload.ts`：通过 contextBridge 向渲染进程暴露安全的方法，隔离 Node.js API

### `frontend/` — React 前端
- 使用 Vite 构建，TypeScript 编写
- 组件化设计，每个 UI 模块对应独立组件
- 自定义 hooks 封装业务逻辑，与组件解耦
- 通过 Axios 向 Backend 发送 HTTP 请求

### `backend/` — 后端服务
- Koa 轻量级 HTTP 框架
- 三层结构：routes（路由）→ services（服务）→ types（类型）
- routes 层处理 HTTP 请求/响应格式
- services 层实现业务逻辑
- 在 Electron 启动时作为子进程启动

### `doc/` — 文档
- 架构、结构、API、迁移四份文档
- 使用 Markdown 格式，便于版本控制

### `sessions/` 和 `logs/`
- 运行时数据目录，保留原有格式以保证向后兼容
- `sessions/` 存储会话 JSON 文件
- `logs/` 存储应用日志