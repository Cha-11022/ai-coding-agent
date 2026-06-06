import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cors = require('@koa/cors');
import { BACKEND_PORT, BACKEND_HOST, ensureDirectories, loadConfig, saveConfig, applyConfigToMemory, getConfigForResponse, DYNAMIC_PROVIDER } from './config';
import sessionRouter from './routes/session';
import conversationRouter from './routes/conversation';
import { defaultLogger } from './services/logger';
import fs from 'fs';
import path from 'path';

const app = new Koa();

// Middleware
app.use(cors());
app.use(bodyParser());

// Load config from disk on startup
try {
  const savedConfig = loadConfig();
  if (savedConfig && Object.keys(savedConfig).length > 0) {
    applyConfigToMemory(savedConfig);
    defaultLogger.info('config_loaded_from_disk', { provider: savedConfig.provider });
  }
} catch (err) {
  defaultLogger.error('config_load_failed', { error: String(err) });
}

// Global state (deprecated - use config.ts dynamic vars instead)
let apiKeyInMemory = process.env.DEEPSEEK_API_KEY || process.env.CLAUDE_API_KEY || '';
let apiProvider = DYNAMIC_PROVIDER;

// Middleware to set API key in ctx.state
app.use(async (ctx, next) => {
  ctx.state.apiKey = process.env.DEEPSEEK_API_KEY || process.env.CLAUDE_API_KEY || apiKeyInMemory;
  await next();
});

// �w�w�w Status & Config Routes �w�w�w

app.use(async (ctx, next) => {
  if (ctx.method === 'GET' && ctx.path === '/api/status') {
    const hasKey = Boolean(ctx.state.apiKey && (ctx.state.apiKey as string).length > 10);
    const cfg = getConfigForResponse();
    ctx.body = {
      status: 'running',
      api_configured: hasKey,
      provider: cfg.provider,
      api_key_preview: cfg.api_key_preview,
    };
    return;
  }
  await next();
});

app.use(async (ctx, next) => {
  if (ctx.method === 'POST' && ctx.path === '/api/config/apikey') {
    const { api_key, provider } = ctx.request.body as { api_key: string; provider?: string };
    const key = (api_key || '').trim();
    if (!key) {
      ctx.status = 400;
      ctx.body = { detail: 'API key cannot be empty' };
      return;
    }
    if (key.length < 10) {
      ctx.status = 400;
      ctx.body = { detail: 'API key seems too short' };
      return;
    }

    apiKeyInMemory = key;
    apiProvider = (provider || 'deepseek').toLowerCase();

    if (apiProvider === 'deepseek') {
      process.env.DEEPSEEK_API_KEY = apiKeyInMemory;
      process.env.API_PROVIDER = 'deepseek';
    } else {
      process.env.CLAUDE_API_KEY = apiKeyInMemory;
      process.env.API_PROVIDER = apiProvider;
    }

    ctx.body = {
      success: true,
      provider: apiProvider,
      api_key_preview: apiKeyInMemory.slice(0, 8) + '...',
      message: `API key configured for ${apiProvider.charAt(0).toUpperCase() + apiProvider.slice(1)}`,
    };
    return;
  }
  await next();
});

// �w�w�w New: GET/POST /api/config �w�w�w

app.use(async (ctx, next) => {
  // GET /api/config �X return current config (no full key)
  if (ctx.method === 'GET' && ctx.path === '/api/config') {
    ctx.body = getConfigForResponse();
    return;
  }
  await next();
});

app.use(async (ctx, next) => {
  // POST /api/config �X save full config (key + provider + url + model)
  if (ctx.method === 'POST' && ctx.path === '/api/config') {
    const body = ctx.request.body as {
      provider?: string;
      api_key?: string;
      api_url?: string;
      model?: string;
    };

    const provider = (body.provider || 'deepseek').toLowerCase();
    const configToSave: Record<string, string> = { provider };

    // Handle API key
    if (body.api_key && body.api_key !== '????????') {
      const key = body.api_key.trim();
      if (key.length < 10) {
        ctx.status = 400;
        ctx.body = { detail: 'API key seems too short' };
        return;
      }
      if (provider === 'deepseek') {
        process.env.DEEPSEEK_API_KEY = key;
      } else {
        process.env.CLAUDE_API_KEY = key;
      }
      configToSave.api_key = key;
    }

    // Handle API URL
    if (body.api_url) {
      configToSave.api_url = body.api_url;
      if (provider === 'deepseek') {
        process.env.DEEPSEEK_API_URL = body.api_url;
      } else {
        process.env.CLAUDE_API_URL = body.api_url;
      }
    }

    // Handle model
    if (body.model) {
      configToSave.model = body.model;
      if (provider === 'deepseek') {
        process.env.DEEPSEEK_MODEL = body.model;
      } else {
        process.env.CLAUDE_MODEL = body.model;
      }
    }

    configToSave.provider = provider;
    process.env.API_PROVIDER = provider;

    // Save to disk (saveConfig handles not writing api_key to file)
    try {
      saveConfig(configToSave);
    } catch (err) {
      defaultLogger.error('config_save_failed', { error: String(err) });
    }

    ctx.body = {
      success: true,
      ...getConfigForResponse(),
    };
    return;
  }
  await next();
});

// Mount routers
app.use(sessionRouter.routes());
app.use(sessionRouter.allowedMethods());
app.use(conversationRouter.routes());
app.use(conversationRouter.allowedMethods());

// Start server
async function main(): Promise<void> {
  ensureDirectories();
  defaultLogger.info('backend_starting', {
    port: BACKEND_PORT,
    host: BACKEND_HOST,
    provider: DYNAMIC_PROVIDER,
    hasApiKey: Boolean(process.env.DEEPSEEK_API_KEY || process.env.CLAUDE_API_KEY),
  });

  const server = app.listen(BACKEND_PORT, BACKEND_HOST, () => {
    defaultLogger.info('backend_started', { port: BACKEND_PORT, host: BACKEND_HOST });
    console.log(`[Backend] Server running at http://${BACKEND_HOST}:${BACKEND_PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Backend] Port ${BACKEND_PORT} is already in use. Please kill the process occupying it or change the port.`);
      console.error(`[Backend] Tip: run 'netstat -ano | findstr :${BACKEND_PORT}' to find the PID, then 'taskkill /PID <pid> /F'`);
    } else {
      console.error('[Backend] Server error:', err.message);
    }
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('[Backend] Failed to start:', err);
  defaultLogger.error('backend_failed_to_start', { error: String(err) });
  process.exit(1);
});

export default app;
