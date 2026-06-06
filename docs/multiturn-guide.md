# 多轮对话系统使用指南

## 概述

Claude AI Coding Agent 现已支持**多轮对话模式**，类似 ChatGPT 的持续交互体验。您可以逐步描述需求、提出修改建议，系统会在已有文件基础上进行增量修改。

## 启动系统

### 方式 1: 通过 demo.py （推荐）
```bash
python demo.py
```
然后选择:
- `1` - 单轮模式（一个任务，执行完成）
- `2` - 多轮模式（持续对话，逐步完善）

### 方式 2: 直接启动多轮模式
```bash
python -m src.cli.multiturn
```

### 方式 3: 单轮模式（原始模式）
```bash
python -m src.cli.main
```

## 多轮对话工作流

### 第 1 步: 初始任务描述
```
请描述你的编程项目或任务:
> 创建一个 Python 计算器程序
```

### 第 2 步: AI 生成计划
```
生成的执行计划:
  [step-1] file_edit: Create or update calculator.py
  [step-2] command: Run command: python calculator.py

确认执行? [y/N] 
```

### 第 3 步: 执行计划
```
✓ 已写入: calculator.py
✓ 命令输出:
  2 + 3 = 5
```

### 第 4 步: 后续修改（关键特性）
现在您可以继续输入修改建议，系统会在已有代码基础上进行增量修改：

```
[轮 2] 请输入:
> 添加减法和乘法功能

生成的执行计划:
  [step-1] file_edit: Update calculator.py
  [step-2] command: Run command: python calculator.py

✓ 已写入: calculator.py
```

## 内置命令

在等待输入时，您可以输入以下命令:

| 命令 | 说明 |
|------|------|
| `exit` | 退出程序 |
| `status` | 查看当前所有文件的状态 |
| `undo` | 撤销上一轮操作（实验性）|

### 使用例子

**查看文件状态:**
```
[轮 3] 请输入:
> status

当前文件状态:

  calculator.py (15 行)
    1: # Calculator Program
    2: def add(a, b):
    3:     return a + b
    4: ...
    [更多行]
```

**撤销上一步:**
```
[轮 3] 请输入:
> undo

已撤销第 2 轮操作。
```

## 系统架构

### 核心模块

```
src/
├── session/
│   └── session_manager.py      # 会话管理、对话历史
├── executor/
│   └── file_diff.py            # 增量文件修改解析
├── planner/
│   └── claude_adapter.py        # 增强了对话上下文支持
├── controller/
│   └── multi_turn_orchestrator.py  # 多轮对话流程
└── cli/
    └── multiturn.py            # 多轮对话 CLI
```

### 工作原理

1. **Session Management**: 
   - 维护对话历史（每轮输入和 AI 响应）
   - 保存文件快照（当前状态）
   - 支持会话持久化（保存到磁盘）

2. **Context-Aware AI**:
   - 每次调用 AI 时，都提供完整的对话历史
   - 包含已有文件的当前内容
   - AI 可以更好地理解上下文，作出智能修改

3. **Orchestration**:
   - 循环处理用户输入
   - 调用 AI 生成计划
   - 执行计划（创建/修改文件、运行命令）
   - 保存状态到会话

4. **Incremental Modifications**:
   - 支持解析 AI 的增量修改指令
   - 在已有文件基础上进行添加、替换、删除操作
   - 避免重复全量生成，节省 token 和时间

## 配置 API

### 使用 Deepseek API (推荐)
```bash
$env:API_PROVIDER="deepseek"
$env:DEEPSEEK_API_KEY="sk-your-key-here"
python demo.py
```

### 使用 Claude API
```bash
$env:API_PROVIDER="claude"
$env:CLAUDE_API_KEY="sk-your-key-here"
python demo.py
```

### 使用 Mock 模式（无需 API Key）
```bash
$env:USE_MOCK_CLAUDE="true"
python demo.py
```
Mock 模式使用启发式规则生成计划，用于演示和测试。

## 实际示例

### 示例 1: 逐步构建计算器

**轮 1:**
```
请描述你的编程项目:
> 创建一个 Python 计算器

执行计划: 创建 calculator.py，运行测试
✓ 完成
```

**轮 2:**
```
请输入:
> 添加减法和乘法函数

执行计划: 更新 calculator.py
✓ 完成
```

**轮 3:**
```
请输入:
> 添加单元测试

执行计划: 创建 test_calculator.py，运行 pytest
✓ 完成
```

### 示例 2: 查看和修复

**轮 1:**
```
请输入:
> 创建一个 Web API 服务

执行计划: 创建 app.py，启动服务
✓ 完成
```

**轮 2:**
```
请输入:
> status

查看文件内容，发现问题...
```

**轮 3:**
```
请输入:
> 修复第 10 行的错误

执行计划: 更新 app.py
✓ 完成
```

## 故障排除

### 问题: "未检测到 API Key"
**解决**: 设置环境变量或在提示时输入 API Key

### 问题: "计划执行失败"
**解决**: 查看错误信息，输入修改建议，让 AI 生成修复方案

### 问题: "文件内容不符合预期"
**解决**: 
1. 输入 `status` 查看当前文件状态
2. 输入 `undo` 撤销上一步
3. 提供新的修改建议

## 性能提示

- 每轮对话会包含完整的对话历史和文件快照，所以会话会逐渐变大
- 建议每个会话控制在 10-20 轮以内，超长对话建议启动新会话
- 用 `status` 命令验证文件状态，避免不必要的修改

## 下一步

- 运行 `python test_multiturn_demo.py` 查看演示
- 阅读 [DESIGN.md](DESIGN.md) 了解系统架构
- 查看日志 `logs/events.jsonl` 了解执行详情
