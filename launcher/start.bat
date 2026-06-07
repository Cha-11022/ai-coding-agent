@echo off
chcp 65001 >nul
title AI Coding Agent

:: ====== SET API KEY ======
set DEEPSEEK_API_KEY=sk-d7e5785531a349eb8fdbf5a73ae85086
set API_PROVIDER=deepseek
set NODE_OPTIONS=

:: ====== CHANGE TO PROJECT DIR ======
cd /d "%~dp0.."

:: ====== LAUNCH ======
echo.
echo ========================================
echo   Claude AI Coding Agent Launcher
echo ========================================
echo.
echo Starting, please wait...

:: Run the startup script
node "%~dp0start.js"

:: If node is not in PATH, try common locations
if %errorlevel% neq 0 (
    if exist "D:\nodejs\node.exe" (
        "D:\nodejs\node.exe" "%~dp0start.js"
    ) else (
        echo.
        echo Launch failed. Please check:
        echo 1. Node.js is installed
        echo 2. Backend and frontend are built
        echo 3. Run: cd app ^&^& npm run build:backend ^&^& npm run build:frontend
        pause
    )
)
