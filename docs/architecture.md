Claude AI Coding Agent - 设计文档
=================================

概览
-----
- 目标: 在 Windows + VS Code 环境下，用 Python 快速实现一个基于 Claude Code 的 AI Coding Agent，MVP 在一周内交付。
- 核心能力: 接受自然语言编程需求 → 自动生成执行计划 → 在工作区创建/修改/删除文件 → 运行终端命令/测试 → 读取错误并尝试自动修复。危险操作需用户确认；所有操作须记录日志与审计。

高层系统架构
----------------
- 交互层（CLI）: 接收输入、展示计划、请求授权与反馈结果。
- 控制层（Orchestrator）: 协调 Planner、Executor、Auth、Logger。
- 智能层（Planner / Claude Adapter）: 生成执行计划（MVP 使用 MockClaudeAdapter）。
- 执行层（Executor）: 文件操作、命令执行、测试运行。
- 分析层（Analyzer）: 解析错误并提出修复建议（MVP 简化）。
- 安全/授权层（Auth Manager）: 危险操作授权。
- 日志/审计层（Logger）: 结构化日志与审计记录。

模块划分
---------
- `cli`: CLI 入口。
- `controller`: Orchestrator 与任务状态模型。
- `planner`: Claude 适配器（MVP: mock）与 plan builder。
- `executor`: file_ops 与 command_runner。
- `auth`: 授权管理。
- `logger`: JSONL 日志记录。
- `config`: 配置项（日志目录、snapshot 等）。

目录结构（MVP）
-----------------
- claude-ai-coding-agent/
  - src/
    - cli/
      - main.py
    - controller/
      - orchestrator.py
      - task_state.py
    - planner/
      - claude_adapter.py
      - plan_builder.py
    - executor/
      - file_ops.py
      - command_runner.py
    - auth/
      - auth_manager.py
    - logger/
      - logger.py
    - config.py
  - scripts/run_local.bat
  - requirements.txt
  - DESIGN.md

主要模块职责
--------------
- `cli.main`: 接收自然语言输入并触发 Orchestrator。
- `controller.orchestrator`: 生成计划、展示并执行、调用授权及记录日志。
- `planner.claude_adapter`: (MVP) MockClaudeAdapter 生成结构化计划。
- `planner.plan_builder`: 将适配器响应转换为 `TaskPlan`。
- `executor.file_ops`: 文件写入/备份(snapshot)/删除。
- `executor.command_runner`: 使用 PowerShell 运行命令并收集输出。
- `auth.auth_manager`: 对危险操作进行交互式授权并写审计日志。
- `logger.logger`: 记录事件与审计（JSONL）。

危险操作与授权策略
----------------------
- 定义: 删除、修改系统配置、执行外部脚本/网络请求等。
- MVP 流程: 在执行前询问用户（命令行提示），记录审计日志。

日志设计
---------
- JSONL 格式, `logs/events.jsonl` 和 `logs/audit.jsonl`。
- 每条包含 timestamp、level、message、metadata。

Claude 集成（MVP）
------------------
- 使用 `MockClaudeAdapter` 模拟计划生成，返回 JSON 可解析的步骤列表。
- 支持真实 API: `ClaudeAdapter`（Anthropic）、`DeepseekAdapter`（Deepseek）。

多轮对话系统（新增）
--------------------
### 架构改进
- **Session Manager**: 管理对话会话、历史、文件快照、修改跟踪。
  - `ConversationTurn`: 单个对话轮次，包含输入、AI 计划、执行结果。
  - `SessionContext`: 对话上下文，维护对话历史和文件状态。
  - `SessionManager`: 会话生命周期和持久化。

- **Multi-Turn Orchestrator**: 支持持续对话循环，每轮对话可包含：
  - 用户输入或修改建议
  - AI 基于当前状态生成增量修改计划
  - 执行计划，收集结果
  - 反馈给 AI（用于下一轮）

- **File Diff Manager**: 支持增量文件修改（`src/executor/file_diff.py`）
  - `FileDiff`: 表示单个文件操作（CREATE/APPEND/INSERT_AFTER/REPLACE/DELETE）
  - `FileDiffParser`: 从 AI 响应中解析增量修改指令
  - `FileModifier`: 应用 diff 到文件内容

### 增强的 Claude 适配器
- 所有适配器现在支持 `context` 参数（可选）：
  - `conversation_history`: 前面轮次的对话记录
  - `file_snapshots`: 当前已存在或修改的文件内容
- AI 可以看到整个对话上下文，从而作出更智能的增量修改，而非每次全量重写。

### 多模式运行
- **单轮模式** (`src/cli/main.py`): 一个输入 → 一个计划 → 执行完成
- **多轮模式** (`src/cli/multiturn.py`): 持续对话循环，支持：
  - 输入后续修改建议
  - 查看当前文件状态 (`status` 命令)
  - 撤销上一步 (`undo` 命令)
  - 随时退出 (`exit` 命令)

### 文件状态管理
- 会话中所有创建/修改的文件被记录在 `file_state` 字典中（内存）
- 每轮执行后更新快照，用于下轮 AI 上下文
- 支持会话保存/恢复 (`sessions/` 目录)

### 增量修改示例
用户可以在后续轮次中要求修改，例如：
```
第1轮: "创建一个计算器程序"
第2轮: "在加法函数后添加减法函数"
第3轮: "添加单元测试"
```
AI 将逐步修改已有的代码文件，而非重新生成整个程序。

MVP 路线（Day1 已开始）
-----------------------
- Day1: 实现 CLI、Orchestrator、MockPlanner、Executor 基本功能（已实现）。
- 多轮改进: 实现 Session Manager、Multi-Turn Orchestrator、增量修改支持（已实现）。

运行与验证
--------------
- Windows 上运行: `python demo.py`（选择单轮或多轮模式）或直接运行:
  - 单轮模式: `python -m src.cli.main`
  - 多轮模式: `python -m src.cli.multiturn`
