import Router from 'koa-router';
import { defaultSessionManager } from '../services/session-manager';
import { Orchestrator } from '../services/orchestrator';
import { defaultLogger } from '../services/logger';
import { SendMessageRequest, QuickStartRequest } from '../types';
import fs from 'fs';
import path from 'path';

const router = new Router({ prefix: '/api' });
const activeOrchestrators = new Map<string, Orchestrator>();

// Send message in conversation
router.post('/conversation/send', async (ctx) => {
  const req = ctx.request.body as SendMessageRequest;
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

  // Check if orchestrator is already running
  if (activeOrchestrators.has(req.session_id)) {
    ctx.body = {
      status: 'busy',
      message: 'Another turn is already being processed. Please wait.',
    };
    return;
  }

  try {
    const orchestrator = new Orchestrator(session);
    activeOrchestrators.set(req.session_id, orchestrator);

    const turn = await orchestrator.executeTurn(req.message);

    // Save session
    defaultSessionManager.saveSession(session);
    defaultLogger.info('session_saved', {
      session_id: session.session_id,
      turns: session.turns.length,
    });

    ctx.body = {
      status: 'completed',
      session_id: session.session_id,
      turn: {
        turn_num: turn.turn_num,
        user_input: turn.user_input,
        ai_plan: turn.ai_plan,
        execution_results: turn.execution_results,
        modified_files: turn.modified_files,
        errors: turn.errors,
      },
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    ctx.body = {
      status: 'error',
      errors: [errorMsg],
    };
  } finally {
    activeOrchestrators.delete(req.session_id);
  }
});

// Quick start: create session + send first message
router.post('/sessions/quickstart', async (ctx) => {
  const req = ctx.request.body as QuickStartRequest;
  const { apiKey } = ctx.state;

  if (!apiKey || apiKey.length < 10) {
    ctx.status = 403;
    ctx.body = { detail: 'Please configure your API key first' };
    return;
  }

  if (!req.message?.trim()) {
    ctx.status = 400;
    ctx.body = { detail: 'Message cannot be empty' };
    return;
  }

  const taskDescription = req.message.length > 40
    ? req.message.slice(0, 40) + '...'
    : req.message;

  const dirId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const projectDir = path.join(process.cwd(), 'sessions', 'workspace', dirId);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  const session = defaultSessionManager.createSession(taskDescription, projectDir);
  defaultSessionManager.saveSession(session);

  try {
    const orchestrator = new Orchestrator(session);
    const turn = await orchestrator.executeTurn(req.message);

    defaultSessionManager.saveSession(session);
    defaultLogger.info('quickstart_completed', {
      session_id: session.session_id,
      turns: session.turns.length,
    });

    ctx.body = {
      status: 'completed',
      session_id: session.session_id,
      turn: {
        turn_num: turn.turn_num,
        user_input: turn.user_input,
        ai_plan: turn.ai_plan,
        execution_results: turn.execution_results,
        modified_files: turn.modified_files,
        errors: turn.errors,
      },
      session: {
        session_id: session.session_id,
        task_description: session.task_description,
        project_dir: session.project_dir,
        created_at: session.created_at,
      },
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    ctx.body = {
      status: 'error',
      errors: [errorMsg],
    };
  }
});

export default router;