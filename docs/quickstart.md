## 🚀 快速启动

### 1️⃣ 最简单的开始方式

```bash
cd d:\VS_code_workspace\claude-ai-coding-agent
python demo.py
```

然后选择模式：
- `1` = 单轮模式（一个任务，执行完成）
- `2` = 多轮模式（持续对话）

### 2️⃣ 直接启动多轮模式

```bash
python -m src.cli.multiturn
```

### 3️⃣ 使用真实 API

#### Deepseek
```bash
$env:API_PROVIDER="deepseek"
$env:DEEPSEEK_API_KEY="sk-your-api-key"
python demo.py
```

#### Claude
```bash
$env:API_PROVIDER="claude"
$env:CLAUDE_API_KEY="sk-your-api-key"
python demo.py
```

### 4️⃣ 演示多轮对话系统

```bash
python test_multiturn_demo.py
```

这会自动运行 3 轮演示对话，展示系统如何工作。

---

## 📖 详细指南

- **[MULTITURN_GUIDE.md](MULTITURN_GUIDE.md)** - 完整使用说明
- **[DESIGN.md](DESIGN.md)** - 系统架构设计
- **[MULTITURN_IMPLEMENTATION.md](MULTITURN_IMPLEMENTATION.md)** - 实现总结

---

## ✨ 多轮模式特性

✅ **持续对话** - 像 ChatGPT 一样保持上下文
✅ **增量修改** - 在已有代码基础上修改
✅ **会话管理** - 保存/恢复对话历史
✅ **文件状态** - 实时查看修改的文件
✅ **错误恢复** - 支持撤销操作

---

## 🎯 典型工作流

```
[初始化]
> 描述你的任务

[第 1 轮]
→ AI 生成计划
→ 你确认执行
→ 文件创建/修改

[第 2 轮]
→ 输入修改建议
→ AI 在现有代码基础上修改
→ 继续执行

[后续轮次]
→ 重复...

[结束]
> exit (或 Ctrl+C)
```

---

**现在就运行 `python demo.py` 开始体验吧！** 🎉
