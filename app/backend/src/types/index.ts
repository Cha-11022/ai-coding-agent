// ©¤©¤©¤ Conversation Turn ©¤©¤©¤

export interface ConversationTurn {
  turn_num: number;
  user_input: string;
  timestamp: string;
  ai_plan: AiPlan | null;
  execution_results: Record<string, unknown> | null;
  modified_files: string[];
  deleted_files: string[];
  errors: string[];
}

export interface AiPlan {
  steps: PlanStep[];
  [key: string]: unknown;
}

export interface PlanStep {
  description: string;
  type?: string;
  files?: string[];
  content?: string | null;
  command?: string;
  danger_level?: number;
  [key: string]: unknown;
}

// ©¤©¤©¤ Session ©¤©¤©¤

export interface SessionData {
  session_id: string;
  task_description: string;
  project_dir: string;
  created_at: string;
  updated_at: string;
  turns: ConversationTurn[];
  file_snapshots: Record<string, string>;
  modified_files: string[];
  deleted_files: string[];
  permission_level: PermissionLevel;
  pending_plan: TaskPlan | null;
}

export interface SessionListItem {
  session_id: string;
  task_description: string;
  project_dir: string;
  created_at: string;
  updated_at: string;
  turns: number;
  modified_files: number;
}

// ©¤©¤©¤ Task Plan ©¤©¤©¤

export interface TaskPlan {
  task_id: string;
  title: string;
  steps: PlanStep[];
  [key: string]: unknown;
}

// ©¤©¤©¤ API Request/Response ©¤©¤©¤

export type PermissionLevel = 'full' | 'default' | 'readonly';

export interface CreateSessionRequest {
  task_description: string;
  project_dir?: string;
}

export interface ContinueSessionRequest {
  session_id: string;
}

export interface DeleteSessionRequest {
  session_id: string;
}

export interface SendMessageRequest {
  session_id: string;
  message: string;
  permission_level?: PermissionLevel;
}

export interface ApproveRequest {
  session_id: string;
}

export interface SetApiKeyRequest {
  api_key: string;
  provider?: string;
}

export interface QuickStartRequest {
  message: string;
}

export interface ApiStatusResponse {
  status: string;
  api_configured: boolean;
  provider: string;
  api_key_preview: string;
}

export interface TurnResult {
  turn_num: number;
  user_input: string;
  ai_plan: AiPlan | null;
  execution_results: Record<string, unknown> | null;
  modified_files: string[];
  errors: string[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  turn_num: number;
  structured?: Record<string, unknown>;
}

// ©¤©¤©¤ File Diff ©¤©¤©¤

export interface FileDiff {
  filepath: string;
  operation: 'create' | 'edit' | 'delete';
  content?: string;
  line_num?: number;
}

// ©¤©¤©¤ Logger ©¤©¤©¤

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ©¤©¤©¤ Auth ©¤©¤©¤

export interface PermissionEntry {
  key: string;
  action: string;
  granted: boolean;
  permanent: boolean;
  timestamp: string;
}