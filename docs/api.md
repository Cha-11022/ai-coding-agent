# API 接口文档

## 基础信息

- **Base URL**: `http://127.0.0.1:8000`
- **Content-Type**: `application/json`
- **字符编码**: UTF-8

---

## 1. 系统状态

### GET /api/status

获取系统状态和 API Key 配置信息。

**Response:**
```json
{
  "status": "running",
  "api_configured": true,
  "provider": "deepseek",
  "api_key_preview": "sk-abc123..."
}
```

---

## 2. API Key 配置

### POST /api/config/apikey

设置或更新 API Key。

**Request:**
```json
{
  "api_key": "sk-your-api-key-here",
  "provider": "deepseek"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| api_key | string | 是 | API Key，长度至少 10 字符 |
| provider | string | 否 | 可选 "deepseek" 或 "claude"，默认 "deepseek" |

**Response:**
```json
{
  "success": true,
  "provider": "deepseek",
  "api_key_preview": "sk-abc123...",
  "message": "API key configured for Deepseek"
}
```

**Error:**
| 状态码 | 说明 |
|--------|------|
| 400 | API Key 为空或太短 |

---

## 3. 会话管理

### GET /api/sessions

获取所有已保存的会话列表。

**Response:**
```json
{
  "sessions": [
    {
      "session_id": "a1b2c3d4",
      "task_description": "Create a REST API server",
      "project_dir": "D:\\projects\\my-api",
      "created_at": "2026-06-06T10:00:00+00:00",
      "updated_at": "2026-06-06T12:00:00+00:00",
      "turns": 5,
      "modified_files": 3
    }
  ]
}
```

### POST /api/sessions/create

创建新会话。

**Request:**
```json
{
  "task_description": "Create a React component",
  "project_dir": "D:\\projects\\my-app"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| task_description | string | 是 | 任务描述 |
| project_dir | string | 否 | 项目目录，默认为当前工作目录 |

**Response:**
```json
{
  "session_id": "a1b2c3d4",
  "task_description": "Create a React component",
  "project_dir": "D:\\projects\\my-app",
  "created_at": "2026-06-06T12:00:00+00:00"
}
```

**Error:**
| 状态码 | 说明 |
|--------|------|
| 403 | API Key 未配置 |
| 400 | 任务描述为空 |

### POST /api/sessions/continue

继续一个已有的会话。

**Request:**
```json
{
  "session_id": "a1b2c3d4"
}
```

**Response:**
```json
{
  "session_id": "a1b2c3d4",
  "task_description": "Create a React component",
  "project_dir": "D:\\projects\\my-app",
  "created_at": "2026-06-06T10:00:00+00:00",
  "updated_at": "2026-06-06T12:00:00+00:00",
  "turns": 5,
  "conversation_history": [
    {
      "role": "user",
      "content": "Create a button component",
      "timestamp": "2026-06-06T10:00:00+00:00",
      "turn_num": 1
    },
    {
      "role": "assistant",
      "content": "{\"plan\":[\"Create Button.tsx\"],\"modified_files\":[\"Button.tsx\"]}",
      "structured": {
        "plan": ["Create Button.tsx"],
        "modified_files": ["Button.tsx"]
      },
      "timestamp": "2026-06-06T10:05:00+00:00",
      "turn_num": 1
    }
  ]
}
```

**Error:**
| 状态码 | 说明 |
|--------|------|
| 403 | API Key 未配置 |
| 404 | 会话未找到 |

### POST /api/sessions/delete

删除一个会话。

**Request:**
```json
{
  "session_id": "a1b2c3d4"
}
```

**Response:**
```json
{
  "success": true,
  "session_id": "a1b2c3d4"
}
```

**Error:**
| 状态码 | 说明 |
|--------|------|
| 404 | 会话未找到 |

---

## 4. 会话详情

### GET /api/sessions/:session_id/details

获取会话详细信息。

**参数:**
- `session_id`: 路径参数，会话 ID

**Response:**
```json
{
  "session_id": "a1b2c3d4",
  "task_description": "Create a React component",
  "project_dir": "D:\\projects\\my-app",
  "created_at": "2026-06-06T10:00:00+00:00",
  "updated_at": "2026-06-06T12:00:00+00:00",
  "turns": 5,
  "modified_files": ["Button.tsx", "styles.css"],
  "deleted_files": [],
  "conversation": [
    {
      "role": "user",
      "content": "Create a button component",
      "timestamp": "2026-06-06T10:00:00+00:00",
      "turn_num": 1
    },
    {
      "role": "assistant",
      "content": "...",
      "structured": {
        "plan": ["Create Button.tsx with props"],
        "modified_files": ["Button.tsx"]
      },
      "timestamp": "2026-06-06T10:05:00+00:00",
      "turn_num": 1
    }
  ]
}
```

**Error:**
| 状态码 | 说明 |
|--------|------|
| 404 | 会话未找到 |

---

## 5. 对话

### POST /api/conversation/send

发送消息并执行 AI 对话回合。

**Request:**
```json
{
  "session_id": "a1b2c3d4",
  "message": "Add a onClick handler to the button"
}
```

**Response (成功):**
```json
{
  "status": "completed",
  "session_id": "a1b2c3d4",
  "turn": {
    "turn_num": 6,
    "user_input": "Add a onClick handler to the button",
    "ai_plan": {
      "steps": [
        {"description": "Modify Button.tsx to add onClick prop"}
      ]
    },
    "execution_results": {
      "status": "success",
      "details": "File updated"
    },
    "modified_files": ["Button.tsx"],
    "errors": []
  }
}
```

**Response (繁忙):**
```json
{
  "status": "busy",
  "message": "Another turn is already being processed. Please wait."
}
```

**Response (超时):**
```json
{
  "status": "timeout",
  "message": "Operation timed out after 5 minutes"
}
```

**Response (错误):**
```json
{
  "status": "error",
  "errors": ["Error message"]
}
```

**Error:**
| 状态码 | 说明 |
|--------|------|
| 403 | API Key 未配置 |
| 404 | 会话未找到 |

---

## 6. 快速开始

### POST /api/sessions/quickstart

一步创建会话并发送第一条消息。

**Request:**
```json
{
  "message": "Create a Python script that reads a CSV file"
}
```

**Response:** 同 `/api/conversation/send` 的响应格式。

**Error:**
| 状态码 | 说明 |
|--------|------|
| 403 | API Key 未配置 |
| 400 | 消息为空 |

---

## 通用错误说明

| 状态码 | 含义 |
|--------|------|
| 400 | 请求参数错误 |
| 403 | API Key 未配置或无效 |
| 404 | 请求的资源未找到 |
| 500 | 服务器内部错误 |

所有错误响应格式：
```json
{
  "detail": "错误描述信息"
}