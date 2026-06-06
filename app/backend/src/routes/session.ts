import Router from 'koa-router';
import { defaultSessionManager } from '../services/session-manager';
import { defaultLogger } from '../services/logger';
import { CreateSessionRequest, ContinueSessionRequest, DeleteSessionRequest } from '../types';
import path from 'path';
import fs from 'fs';

const router = new Router({ prefix: '/api' });

// List all sessions
router.get('/sessions', (ctx) => {
  const sessions = defaultSessionManager.listSessions();
  ctx.body = { sessions };
});

// Create session
router.post('/sessions/create', (ctx) => {
  const req = ctx.request.body as CreateSessionRequest;
  const { apiKey } = ctx.state;
  if (!apiKey || apiKey.length < 10) {
    ctx.status = 403;
    ctx.body = { detail: 'Please configure your API key first' };
    return;
  }

  if (!req.task_description?.trim()) {
    ctx.status = 400;
    ctx.body = { detail: 'Task description cannot be empty' };
    return;
  }

  const defaultProject = process.cwd();
  // Use a session-specific temp directory when no project_dir specified (isolation)
  const dirId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const projectDir = req.project_dir || path.join(defaultProject, 'sessions', 'workspace', dirId);

  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  const session = defaultSessionManager.createSession(req.task_description, projectDir);
  defaultSessionManager.saveSession(session);

  ctx.body = {
    session_id: session.session_id,
    task_description: session.task_description,
    project_dir: session.project_dir,
    created_at: session.created_at,
  };
});

// Continue session (load for continuation)
router.post('/sessions/continue', (ctx) => {
  const req = ctx.request.body as ContinueSessionRequest;
  const { apiKey } = ctx.state;
  if (!apiKey || apiKey.length < 10) {
    ctx.status = 403;
    ctx.body = { detail: 'Please configure your API key first' };
    return;
  }

  const session = defaultSessionManager.loadSession(req.session_id);
  if (!session) {
    ctx.status = 404;
    ctx.body = { detail: `Session '${req.session_id}' not found` };
    return;
  }

  const conversationHistory = [];
  for (const turn of session.turns) {
    conversationHistory.push({
      role: 'user',
      content: turn.user_input,
      timestamp: turn.timestamp,
      turn_num: turn.turn_num,
    });
    const aiResponse: Record<string, unknown> = {};
    if (turn.ai_plan) {
      aiResponse.plan = turn.ai_plan.steps?.map(s => s.description || String(s)) || [];
    }
    if (turn.execution_results) {
      aiResponse.execution = turn.execution_results;
    }
    if (turn.modified_files.length > 0) {
      aiResponse.modified_files = turn.modified_files;
    }
    if (turn.errors.length > 0) {
      aiResponse.errors = turn.errors;
    }
    if (Object.keys(aiResponse).length > 0) {
      conversationHistory.push({
        role: 'assistant',
        content: JSON.stringify(aiResponse),
        structured: aiResponse,
        timestamp: turn.timestamp,
        turn_num: turn.turn_num,
      });
    }
  }

  ctx.body = {
    session_id: session.session_id,
    task_description: session.task_description,
    project_dir: session.project_dir,
    created_at: session.created_at,
    updated_at: session.updated_at,
    turns: session.turns.length,
    conversation_history: conversationHistory,
  };
});

// Delete session
router.post('/sessions/delete', (ctx) => {
  const req = ctx.request.body as DeleteSessionRequest;
  const success = defaultSessionManager.deleteSession(req.session_id);
  if (!success) {
    ctx.status = 404;
    ctx.body = { detail: `Session '${req.session_id}' not found` };
    return;
  }
  ctx.body = { success: true, session_id: req.session_id };
});

// Get session details
router.get('/sessions/:session_id/details', (ctx) => {
  const { session_id } = ctx.params;
  const { apiKey } = ctx.state;
  if (!apiKey || apiKey.length < 10) {
    ctx.status = 403;
    ctx.body = { detail: 'Please configure your API key first' };
    return;
  }

  const session = defaultSessionManager.loadSession(session_id);
  if (!session) {
    ctx.status = 404;
    ctx.body = { detail: `Session '${session_id}' not found` };
    return;
  }

  const conversation = [];
  for (const turn of session.turns) {
    conversation.push({
      role: 'user',
      content: turn.user_input,
      timestamp: turn.timestamp,
      turn_num: turn.turn_num,
    });
    const aiResponse: Record<string, unknown> = {};
    if (turn.ai_plan) {
      aiResponse.plan = turn.ai_plan.steps?.map(s => s.description || String(s)) || [];
    }
    if (turn.execution_results) {
      aiResponse.execution = turn.execution_results;
    }
    if (turn.modified_files.length > 0) {
      aiResponse.modified_files = turn.modified_files;
    }
    if (turn.errors.length > 0) {
      aiResponse.errors = turn.errors;
    }
    if (Object.keys(aiResponse).length > 0) {
      conversation.push({
        role: 'assistant',
        content: JSON.stringify(aiResponse),
        structured: aiResponse,
        timestamp: turn.timestamp,
        turn_num: turn.turn_num,
      });
    }
  }

  ctx.body = {
    session_id: session.session_id,
    task_description: session.task_description,
    project_dir: session.project_dir,
    created_at: session.created_at,
    updated_at: session.updated_at,
    turns: session.turns.length,
    modified_files: session.modified_files,
    deleted_files: session.deleted_files,
    conversation,
  };
});

export default router;