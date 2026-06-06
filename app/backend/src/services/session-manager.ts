import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SESSIONS_DIR } from '../config';
import {
  SessionData,
  SessionListItem,
  ConversationTurn,
} from '../types';
import { defaultLogger } from './logger';

class SessionContext {
  session_id: string;
  task_description: string;
  project_dir: string;
  created_at: string;
  updated_at: string;
  turns: ConversationTurn[];
  file_snapshots: Record<string, string>;
  modified_files: string[];
  deleted_files: string[];

  constructor(session_id: string, task_description: string, project_dir: string = '.') {
    this.session_id = session_id;
    this.task_description = task_description;
    this.project_dir = path.resolve(project_dir);
    this.created_at = new Date().toISOString();
    this.updated_at = this.created_at;
    this.turns = [];
    this.file_snapshots = {};
    this.modified_files = [];
    this.deleted_files = [];
  }

  addTurn(userInput: string): ConversationTurn {
    const turnNum = this.turns.length + 1;
    const turn: ConversationTurn = {
      turn_num: turnNum,
      user_input: userInput,
      timestamp: new Date().toISOString(),
      ai_plan: null,
      execution_results: null,
      modified_files: [],
      deleted_files: [],
      errors: [],
    };
    this.turns.push(turn);
    this.updated_at = new Date().toISOString();
    return turn;
  }

  getConversationHistory(): string {
    if (this.turns.length === 0) return '';
    const history: string[] = [];
    for (const turn of this.turns) {
      history.push(`[Turn ${turn.turn_num}] User: ${turn.user_input}`);
      if (turn.ai_plan) {
        const steps = turn.ai_plan.steps || [];
        const descs = steps.map(s => s.description || '?');
        history.push(`[Turn ${turn.turn_num}] AI Plan: ${descs.join(', ')}`);
      }
      if (turn.execution_results && turn.execution_results.status === 'success') {
        history.push(`[Turn ${turn.turn_num}] Result: ✓ Success`);
      } else if (turn.errors.length > 0) {
        history.push(`[Turn ${turn.turn_num}] Error: ${turn.errors.join('; ')}`);
      }
    }
    return history.join('\n');
  }

  toJSON(): SessionData {
    return {
      session_id: this.session_id,
      task_description: this.task_description,
      project_dir: this.project_dir,
      created_at: this.created_at,
      updated_at: this.updated_at,
      turns: this.turns,
      file_snapshots: this.file_snapshots,
      modified_files: this.modified_files,
      deleted_files: this.deleted_files,
    };
  }

  static fromJSON(data: SessionData): SessionContext {
    const session = new SessionContext(data.session_id, data.task_description, data.project_dir);
    session.created_at = data.created_at;
    session.updated_at = data.updated_at;
    session.turns = data.turns || [];
    session.file_snapshots = data.file_snapshots || {};
    session.modified_files = data.modified_files || [];
    session.deleted_files = data.deleted_files || [];
    return session;
  }
}

class SessionManager {
  constructor() {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
  }

  createSession(taskDescription: string, projectDir: string = '.'): SessionContext {
    const sessionId = uuidv4().slice(0, 8);
    return new SessionContext(sessionId, taskDescription, projectDir);
  }

  saveSession(context: SessionContext): void {
    const sessionFile = path.join(SESSIONS_DIR, `${context.session_id}.json`);
    const data = context.toJSON();
    fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  loadSession(sessionId: string): SessionContext | null {
    const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
    if (!fs.existsSync(sessionFile)) return null;
    try {
      const data = JSON.parse(fs.readFileSync(sessionFile, 'utf-8')) as SessionData;
      return SessionContext.fromJSON(data);
    } catch (err) {
      defaultLogger.error('Failed to load session', { sessionId, error: String(err) });
      return null;
    }
  }

  listSessions(): SessionListItem[] {
    if (!fs.existsSync(SESSIONS_DIR)) return [];
    const sessions: SessionListItem[] = [];
    const files = fs.readdirSync(SESSIONS_DIR);
    for (const fname of files) {
      if (!fname.endsWith('.json')) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, fname), 'utf-8')) as SessionData;
        sessions.push({
          session_id: data.session_id || fname.replace('.json', ''),
          task_description: data.task_description || '',
          project_dir: data.project_dir || '.',
          created_at: data.created_at || '',
          updated_at: data.updated_at || '',
          turns: (data.turns || []).length,
          modified_files: (data.modified_files || []).length,
        });
      } catch {
        // Skip corrupted files
      }
    }
    sessions.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return sessions;
  }

  deleteSession(sessionId: string): boolean {
    const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
    if (!fs.existsSync(sessionFile)) return false;
    fs.unlinkSync(sessionFile);
    return true;
  }

  generateSessionId(): string {
    return uuidv4().slice(0, 8);
  }
}

const defaultSessionManager = new SessionManager();
export { SessionContext, SessionManager, defaultSessionManager };