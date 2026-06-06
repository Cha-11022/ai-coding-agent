import path from 'path';
import fs from 'fs';

// Determine paths
// app/backend/dist/config.js (compiled) or app/backend/src/config.ts (dev)
export const ROOT_DIR = path.resolve(__dirname, '..');
export const PROJECT_ROOT = path.resolve(ROOT_DIR, '..');
export const CONFIG_FILE = path.join(PROJECT_ROOT, 'config.json');

// Data directories live in the project root
export const LOG_DIR = path.join(PROJECT_ROOT, 'logs');
export const SNAPSHOT_DIR = path.join(PROJECT_ROOT, '.snapshots');
export const SESSIONS_DIR = path.join(PROJECT_ROOT, 'sessions');

export const API_PROVIDER = (process.env.API_PROVIDER || 'deepseek').toLowerCase();
export const USE_MOCK_CLAUDE = ['1', 'true', 'yes'].includes((process.env.USE_MOCK_CLAUDE || 'false').toLowerCase());
export const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
export const CLAUDE_API_URL = process.env.CLAUDE_API_URL || 'https://api.anthropic.com/v1/complete';
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3.5';
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
export const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

export const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '8000', 10);
export const BACKEND_HOST = process.env.BACKEND_HOST || '127.0.0.1';
export const DEFAULT_TIMEOUT = 60000;

// In-memory dynamic config (updated by /api/config)
export let DYNAMIC_PROVIDER = API_PROVIDER;
export let DYNAMIC_DEEPSEEK_KEY = DEEPSEEK_API_KEY;
export let DYNAMIC_CLAUDE_KEY = CLAUDE_API_KEY;
export let DYNAMIC_DEEPSEEK_URL = DEEPSEEK_API_URL;
export let DYNAMIC_CLAUDE_URL = CLAUDE_API_URL;
export let DYNAMIC_DEEPSEEK_MODEL = DEEPSEEK_MODEL;
export let DYNAMIC_CLAUDE_MODEL = CLAUDE_MODEL;

export interface AppConfig {
  provider?: string;
  api_key?: string;
  api_url?: string;
  model?: string;
}

// Load config from config.json
export function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(raw) as AppConfig;
    }
  } catch { /* ignore */ }
  return {};
}

// Save config to config.json
export function saveConfig(config: AppConfig): void {
  const existing = loadConfig();
  const merged = { ...existing, ...config };

  // Don't save api_key as plain text in config.json for security
  // Instead, we keep it in memory and only save the preview flag
  if (merged.api_key) {
    // Save to memory only, not to disk
    applyConfigToMemory(merged);
    // Save config without api_key to file
    const toSave = { ...merged };
    delete toSave.api_key;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(toSave, null, 2), 'utf-8');
  } else {
    applyConfigToMemory(merged);
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  }
}

// Apply config values to memory (so ai-client.ts can read them)
export function applyConfigToMemory(config: AppConfig): void {
  if (config.provider) {
    DYNAMIC_PROVIDER = config.provider.toLowerCase();
    process.env.API_PROVIDER = DYNAMIC_PROVIDER;
  }
  if (config.api_url) {
    if (DYNAMIC_PROVIDER === 'deepseek') {
      DYNAMIC_DEEPSEEK_URL = config.api_url;
      process.env.DEEPSEEK_API_URL = config.api_url;
    } else {
      DYNAMIC_CLAUDE_URL = config.api_url;
      process.env.CLAUDE_API_URL = config.api_url;
    }
  }
  if (config.model) {
    if (DYNAMIC_PROVIDER === 'deepseek') {
      DYNAMIC_DEEPSEEK_MODEL = config.model;
      process.env.DEEPSEEK_MODEL = config.model;
    } else {
      DYNAMIC_CLAUDE_MODEL = config.model;
      process.env.CLAUDE_MODEL = config.model;
    }
  }
  if (config.api_key) {
    if (DYNAMIC_PROVIDER === 'deepseek') {
      DYNAMIC_DEEPSEEK_KEY = config.api_key;
      process.env.DEEPSEEK_API_KEY = config.api_key;
    } else {
      DYNAMIC_CLAUDE_KEY = config.api_key;
      process.env.CLAUDE_API_KEY = config.api_key;
    }
  }
}

// Get current config for API response (no full key)
export function getConfigForResponse(): Record<string, unknown> {
  const hasKey = Boolean(DYNAMIC_DEEPSEEK_KEY || DYNAMIC_CLAUDE_KEY);
  let keyPreview = '';
  const key = DYNAMIC_PROVIDER === 'deepseek' ? DYNAMIC_DEEPSEEK_KEY : DYNAMIC_CLAUDE_KEY;
  if (key && key.length > 8) {
    keyPreview = key.slice(0, 8) + '...';
  }
  return {
    provider: DYNAMIC_PROVIDER,
    api_url: DYNAMIC_PROVIDER === 'deepseek' ? DYNAMIC_DEEPSEEK_URL : DYNAMIC_CLAUDE_URL,
    model: DYNAMIC_PROVIDER === 'deepseek' ? DYNAMIC_DEEPSEEK_MODEL : DYNAMIC_CLAUDE_MODEL,
    has_key: hasKey,
    api_key_preview: keyPreview,
  };
}

// Ensure directories exist
export function ensureDirectories(): void {
  for (const dir of [LOG_DIR, SESSIONS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
