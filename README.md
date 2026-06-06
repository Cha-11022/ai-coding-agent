# AI Coding Agent

AI 驱动的编程助手，支持自然语言交互的文件操作和命令执行。

## ✨ 功能

- 🗣️ **自然语言交流** - 像聊天一样提需求，AI 自然回复
- 📝 **文件操作** - 创建、修改、删除文件，每次输出完整代码
- 🔄 **多轮迭代** - 在现有代码基础上持续修改
- 🔒 **会话隔离** - 每个会话独立工作区，互不干扰
- 🌐 **浏览器模式** - 双击启动，无需安装 Electron

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18（推荐 22+）
- **Python** 3.12+（可选，仅 CLI 模式需要）
- **API Key**（Deepseek 或 Claude）

### 安装与运行

```powershell
# 1. 克隆项目
git clone https://github.com/Cha-11022/ai-coding-agent.git
cd ai-coding-agent

# 2. 安装前端和后端依赖
cd app
npm install
cd ..

# 3. 编译前端和后端
cd app
npm run build:backend
npm run build:frontend
cd ..

# 4. 双击启动
launcher\start.bat
```

启动后浏览器自动打开 `http://127.0.0.1:3000`，在界面右上角 ⚙️ 设置中配置 API Key 即可使用。

### 可用的启动器

| 方式 | 命令 |
|------|------|
| 浏览器模式（推荐） | 双击 `launcher\start.bat` |
| Python 多轮对话 | `python -m src.cli.multiturn` |
| Python 单轮模式 | `python -m src.cli.main` |

### 配置 API Key

设置环境变量或在网页中配置：

```powershell
$env:DEEPSEEK_API_KEY = "sk-your-api-key"
$env:API_PROVIDER = "deepseek"
```

支持：Deepseek、OpenAI 兼容、Claude。

## 📖 使用指南

1. **新建会话** - 点击「+ 新建会话」，输入任务描述
2. **自动执行** - 创建会话后自动发送任务给 AI
3. **继续对话** - 在聊天框输入更多指令
4. **指定目录** - 在新建会话时填入目录路径，可共享工作区
5. **管理会话** - 左侧边栏查看所有会话，可删除

## 🏗 项目结构

```
ai-coding-agent/
├── app/
│   ├── backend/          # Koa API 服务器（TypeScript）
│   ├── frontend/         # React 前端（TypeScript + Vite）
│   └── electron/         # Electron 桌面端（备选）
├── launcher/
│   ├── start.bat         # 启动器（双击）
│   └── start.js          # Node.js 启动脚本
├── src/                  # Python CLI 模式
└── docs/                 # 详细文档
```

## 📄 详细文档

见 [docs/](docs/) 目录。
