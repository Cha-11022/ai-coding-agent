import fs from 'fs';
import path from 'path';
import { LOG_DIR } from '../config';
import { LogEntry } from '../types';

class Logger {
  private logFile: string;
  private auditFile: string;

  constructor() {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    this.logFile = path.join(LOG_DIR, 'events.jsonl');
    this.auditFile = path.join(LOG_DIR, 'audit.jsonl');
  }

  private write(filePath: string, entry: Omit<LogEntry, 'timestamp'>): void {
    const fullEntry: LogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    try {
      fs.appendFileSync(filePath, JSON.stringify(fullEntry) + '\n', 'utf-8');
    } catch (err) {
      console.error('[Logger] Failed to write log:', err);
    }
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.write(this.logFile, { level: 'info', message, metadata });
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.write(this.logFile, { level: 'error', message, metadata });
  }

  audit(message: string, metadata?: Record<string, unknown>): void {
    this.write(this.auditFile, { level: 'audit', message, metadata });
  }
}

export const defaultLogger = new Logger();
export default Logger;