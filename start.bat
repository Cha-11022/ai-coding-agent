@echo off
chcp 65001 >nul
title Claude AI Coding Agent

:: 设置 API Key（替换成你的）
set DEEPSEEK_API_KEY=sk-df041fa594334581bd121908beca6585
set API_PROVIDER=deepseek

:: 清除 NODE_OPTIONS 避免冲突
set NODE_OPTIONS=

:: 启动 Electron 桌面应用
echo 正在启动 Claude AI Coding Agent...
"D:\electron-pkg\dist\electron.exe" "D:\Agent-workspace\WorkBuddy\ai-coding-agent-main\app\electron"

if %errorlevel% neq 0 (
    echo.
    echo 启动失败，请检查路径是否正确。
    pause
)
