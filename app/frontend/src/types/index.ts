// ©¤©¤©¤ API Types ©¤©¤©¤

export interface ApiStatus {
  status: string;
  api_configured: boolean;
  provider: string;
  api_key_preview: string;
}

export interface SessionItem {
  session_id: string;
  task_description: string;
  project_dir: string;
  created_at: string;
  updated_at: string;
  turns: number;
  modified_files: number;
}

export interface SessionDetail {
  session_id: string;
  task_description: string;
  project_dir: string;
  created_at: string;
  updated_at: string;
  turns: number;
  modified_files: string[];
  deleted_files: string[];
  conversation: ConversationMessage[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  turn_num: number;
  structured?: Record<string, unknown>;
}

export interface TurnResult {
  turn_num: number;
  user_input: string;
  ai_plan: AiPlan | null;
  execution_results: Record<string, unknown> | null;
  modified_files: string[];
  errors: string[];
}

export interface AiPlan {
  steps: Array<{
    description: string;
    type?: string;
    files?: string[];
    command?: string;
    danger_level?: number;
  }>;
}

// ©¤©¤©¤ UI Types ©¤©¤©¤

export interface ElectronAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  isDev: () => Promise<boolean>;
  getBackendUrl: () => Promise<string>;
  getAppVersion: () => Promise<string>;
  selectDirectory: () => Promise<string | null>;
  checkPathExists: (filePath: string) => Promise<boolean>;
  showMessageBox: (options: unknown) => Promise<unknown>;
  sendNotification: (options: { title: string; body: string }) => void;
  onMenuNewSession: (callback: () => void) => () => void;
  onMenuOpenDir: (callback: (dirPath: string) => void) => () => void;
  onBackendStatus: (callback: (status: unknown) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    isElectron?: boolean;
  }
}