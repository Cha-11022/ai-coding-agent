# 迁移指南：Python → TypeScript

本文档说明如何从旧版 Python + JavaScript 混合架构迁移到新的 TypeScript 全栈架构。

---

## 1. 架构变更总览

| 旧架构 | 新架构 |
|--------|--------|
| Python (src/) 核心逻辑 | TypeScript (backend/src/services/) |
| Python FastAPI 后端 (gui/backend/server.py) | TypeScript Koa 后端 (backend/src/) |
| JavaScript React 前端 (gui/frontend/) | TypeScript React 前端 (frontend/) |
| JavaScript Electron (electron/) | TypeScript Electron (electron/) |
| 分散的启动脚本 | 无启动脚本，Electron 自动管理 |
| pip + requirements.txt | npm + package.json |

---

## 2. 数据兼容性

### 2.1 会话数据（sessions/ 目录）

**完全兼容。** 会话文件格式未改变，仍然是 JSON 文件：
```
sessions/
├── a1b2c3d4.json
└── f5e6d7c8.json
```

每个 JSON 文件结构与旧版一致：
```json
{
  "session_id": "a1b2c3d4",
  "task_description": "...",
  "project_dir": "...",
  "created_at": "...",
  "updated_at": "...",
  "turns": [...],
  "file_snapshots": {},
  "modified_files": [],
  "deleted_files": []
}
```

迁移无需做任何数据转换，TypeScript 版本的 `session-manager.ts` 使用相同的读写逻辑。

### 2.2 日志数据（logs/ 目录）

**完全兼容。** 日志格式保持 JSON Lines 格式（`.jsonl`），新 Logger 继续追加写入同目录。

### 2.3 文件快照（.snapshots/ 目录）

**完全兼容。** 快照文件路径格式未变。

---

## 3. 模块映射表

### 3.1 核心服务模块

| Python 文件 | TypeScript 文件 | 功能差异 |
|-------------|-----------------|----------|
| `src/config.py` | `backend/src/config.ts` | 直接映射，语法转换 |
| `src/session/session_manager.py` | `backend/src/services/session-manager.ts` | 完全一致的功能，JSON 读写 |
| `src/controller/multi_turn_orchestrator.py` | `backend/src/services/orchestrator.ts` | 去掉 CLI input mock，改为 API 触发 |
| `src/planner/claude_adapter.py` | `backend/src/services/ai-client.ts` | 支持 Deepseek/Claude/Mock |
| `src/executor/command_runner.py` | `backend/src/services/command-runner.ts` | 使用 Node.js child_process |
| `src/executor/file_ops.py` | `backend/src/services/file-ops.ts` | 使用 fs/promises |
| `src/executor/file_diff.py` | `backend/src/services/file-diff.ts` | 直接映射 |
| `src/logger/logger.py` | `backend/src/services/logger.ts` | 直接映射 |
| `src/auth/auth_manager.py` | `backend/src/services/auth-manager.ts` | 简化，移除 CLI 交互 |
| `src/workspace_state/` | `backend/src/services/workspace-state.ts` | 合并为单一文件 |

### 3.2 移除的模块

| 模块 | 说明 |
|------|------|
| `src/cli/` | CLI 交互代码，改为通过 API 触发 |
| `src/analyzer/error_parser.py` | 错误分析功能合并到 orchestrator |
| `src/analyzer/repair_suggester.py` | 修复建议功能合并到 orchestrator |
| `src/controller/task_state.py` | 类型定义移到 `backend/src/types/` |
| `src/controller/orchestrator.py` | 单次执行改为多轮编排的子路径 |

### 3.3 前端模块

| JavaScript 文件 | TypeScript 文件 | 说明 |
|-----------------|-----------------|------|
| `src/App.js` | `src/App.tsx` + `components/*.tsx` | 拆分为多个组件 |
| `src/api.js` | `src/api/client.ts` | 添加类型定义 |
| `(新)` | `src/hooks/useSessions.ts` | 新封装 |
| `(新)` | `src/hooks/useChat.ts` | 新封装 |
| `src/App.css` | `src/styles/App.css` | 不变 |

---

## 4. 环境变量配置

旧版环境变量（Python）到新版（Node.js）的映射：

| Python env | TypeScript env | 说明 |
|------------|----------------|------|
| `DEEPSEEK_API_KEY` | `DEEPSEEK_API_KEY` | 不变 |
| `CLAUDE_API_KEY` | `CLAUDE_API_KEY` | 不变 |
| `API_PROVIDER` | `API_PROVIDER` | 不变 |
| `CLAUDE_API_URL` | `CLAUDE_API_URL` | 不变 |
| `DEEPSEEK_API_URL` | `DEEPSEEK_API_URL` | 不变 |
| `CLAUDE_MODEL` | `CLAUDE_MODEL` | 不变 |
| `DEEPSEEK_MODEL` | `DEEPSEEK_MODEL` | 不变 |
| `USE_MOCK_CLAUDE` | `USE_MOCK_CLAUDE` | 不变 |
| `PYTHONIOENCODING` | (移除) | 不再需要 |
| `ELECTRON_RUN` | `ELECTRON_RUN` | 同样用于标识 Electron 环境 |

---

## 5. 数据目录

旧版数据目录（相对于项目根）和新的保持一致：

| 目录 | 用途 | 迁移动作 |
|------|------|----------|
| `sessions/` | 会话数据 | 无需操作，自动兼容 |
| `logs/` | 日志文件 | 无需操作，自动兼容 |
| `.snapshots/` | 文件快照 | 无需操作，自动兼容 |

---

## 6. 常见问题

### 6.1 旧版 Python 依赖如何处理？
新版为纯 Node.js 项目，不再需要 Python 环境。删除 `.venv/` 和 `requirements.txt`。

### 6.2 旧版启动脚本如何处理？
新版不需要启动脚本，Electron 应用启动时会自动启动后端服务。

### 6.3 API Key 存储方式有无变化？
无变化。API Key 通过前端 UI 输入，发送到后端内存中管理，不写入文件系统。

### 6.4 现有的会话数据会丢失吗？
不会。TypeScript 版本的 `session-manager.ts` 会读取 `sessions/` 目录中的现有 JSON 文件，格式完全兼容。

### 6.5 日志文件会继续按原有格式写入吗？
是的。日志继续以 JSON Lines 格式写入 `logs/events.jsonl`。