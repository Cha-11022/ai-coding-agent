import axios from 'axios';

const isElectron = !!(window.electronAPI) || !!(window.isElectron);

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 300000,
  headers: { 'Content-Type': 'application/json' },
});

// If in Electron, try to get backend URL from main process
if (isElectron && window.electronAPI) {
  window.electronAPI.getBackendUrl().then((url: string) => {
    api.defaults.baseURL = url;
  }).catch(() => { /* use default */ });
}

export async function getStatus() {
  const { data } = await api.get('/api/status');
  return data;
}

export async function setApiKey(apiKey: string, provider: string = 'deepseek') {
  const { data } = await api.post('/api/config/apikey', { api_key: apiKey, provider });
  return data;
}

export async function listSessions() {
  const { data } = await api.get('/api/sessions');
  return data.sessions;
}

export async function createSession(taskDescription: string, projectDir: string | null = null) {
  const { data } = await api.post('/api/sessions/create', {
    task_description: taskDescription,
    project_dir: projectDir,
  });
  return data;
}

export async function continueSession(sessionId: string) {
  const { data } = await api.post('/api/sessions/continue', {
    session_id: sessionId,
  });
  return data;
}

export async function deleteSession(sessionId: string) {
  const { data } = await api.post('/api/sessions/delete', {
    session_id: sessionId,
  });
  return data;
}

export async function sendMessage(sessionId: string, message: string, permissionLevel?: string) {
  const data = { session_id: sessionId, message };
  if (permissionLevel) Object.assign(data, { permission_level: permissionLevel });
  const { data: res } = await api.post('/api/conversation/send', data);
  return res;
}

export async function approvePlan(sessionId: string) {
  const { data } = await api.post('/api/conversation/approve', { session_id: sessionId });
  return data;
}

export async function setPermissionLevel(sessionId: string, permissionLevel: string) {
  const { data } = await api.post('/api/conversation/permission', {
    session_id: sessionId,
    permission_level: permissionLevel,
  });
  return data;
}

export async function getSessionDetails(sessionId: string) {
  const { data } = await api.get(`/api/sessions/${sessionId}/details`);
  return data;
}

export async function quickstart(message: string) {
  const { data } = await api.post('/api/sessions/quickstart', { message });
  return data;
}

// --- Config endpoints ---
export async function getConfig() {
  const { data } = await api.get('/api/config');
  return data;
}

export async function saveConfig(config: {
  provider?: string;
  api_key?: string;
  api_url?: string;
  model?: string;
}) {
  const { data } = await api.post('/api/config', config);
  return data;
}

export { isElectron, api, API_BASE };
export default api;