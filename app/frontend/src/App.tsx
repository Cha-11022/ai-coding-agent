import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from './i18n';
import { getStatus, listSessions, createSession, continueSession, deleteSession, sendMessage, getSessionDetails, quickstart, saveConfig } from './api/client';
import { useSessions } from './hooks/useSessions';
import { useChat } from './hooks/useChat';
import Titlebar from './components/Titlebar';
import Sidebar from './components/Sidebar';
import ChatInput from './components/ChatInput';
import Message from './components/Message';
import NewSessionModal from './components/NewSessionModal';
import SessionsListModal from './components/SessionsListModal';
import LanguageToggle from './components/LanguageToggle';
import SettingsModal from './components/SettingsModal';
import type { ConversationMessage } from './types';
import './styles/App.css';

const IconRobot = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" /><line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" />
  </svg>
);
const IconPlus = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconList = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const IconMenu = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const IconGear = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4v.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4v-.09a1.65 1.65 0 0 0-1.51-1z" />
  </svg>
);

export default function App() {
  const { t } = useI18n();
  const { sessions, fetchSessions, createSession: hookCreate, deleteSession: hookDelete, continueSession: hookContinue } = useSessions();
  const {
    messages, loading, activeSession,
    setActiveSession, sendMessage: hookSend, setInitialMessages, clearMessages,
  } = useChat();

  const [status, setStatus] = useState<{ status: string; mode?: string }>({ status: 'checking' });
  const [showNewSession, setShowNewSession] = useState(false);
  const [showSessionsList, setShowSessionsList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const s = await getStatus();
        setStatus({ status: s.status, mode: s.provider });
      } catch {
        setStatus({ status: 'offline', mode: t('statusOffline') });
      }
    };
    fetchStatus();
    setIsElectron(!!window.electronAPI || !!window.isElectron);
  }, [t]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { inputRef.current?.focus(); }, [activeSession]);

  useEffect(() => {
    if (!isElectron) return;
    const checkMaximized = async () => {
      try {
        const max = await window.electronAPI!.isMaximized();
        setIsMaximized(max);
      } catch { /* ignore */ }
    };
    const interval = setInterval(checkMaximized, 1000);
    return () => clearInterval(interval);
  }, [isElectron]);

  // Listen for menu events from Electron
  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;
    const unsub1 = window.electronAPI.onMenuNewSession(() => setShowNewSession(true));
    return () => { unsub1(); };
  }, [isElectron]);

  const handleCreateSession = async (taskDescription: string, projectDir: string | null) => {
    try {
      const session = await createSession(taskDescription, projectDir);
      // Refresh sidebar
      await fetchSessions();
      setActiveSession({
        session_id: session.session_id,
        task_description: session.task_description,
        project_dir: session.project_dir,
      });
      setShowNewSession(false);
      // Auto-send the task description as the first message via API directly
      try {
        const result = await sendMessage(session.session_id, taskDescription);
        if (result.status === 'completed' && result.turn) {
          const aiTurn = result.turn;
          const aiMsg = buildAiMessage(aiTurn);
          setInitialMessages([
            { role: 'assistant', content: `${t('welcomeNew')}\n\n**ID**: ${session.session_id}\n**Task**: ${session.task_description}\n**Dir**: ${session.project_dir}\n\n${t('chatPlaceholder')}`, timestamp: new Date().toISOString(), turn_num: 0 },
            { role: 'user', content: taskDescription, timestamp: new Date().toISOString(), turn_num: aiTurn.turn_num },
            { role: 'assistant', content: aiMsg, timestamp: new Date().toISOString(), turn_num: aiTurn.turn_num },
          ]);
        } else {
          // Fallback: show welcome message only
          setInitialMessages([{
            role: 'assistant',
            content: `${t('welcomeNew')}\n\n**ID**: ${session.session_id}\n**Task**: ${session.task_description}\n**Dir**: ${session.project_dir}\n\n${t('chatPlaceholder')}`,
            timestamp: new Date().toISOString(),
            turn_num: 0,
          }]);
        }
      } catch {
        // If auto-send fails, still show welcome so user can try again
        setInitialMessages([{
          role: 'assistant',
          content: `${t('welcomeNew')}\n\n**ID**: ${session.session_id}\n**Task**: ${session.task_description}\n**Dir**: ${session.project_dir}\n\n${t('chatPlaceholder')}`,
          timestamp: new Date().toISOString(),
          turn_num: 0,
        }]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      alert(t('errorCreateSession') + msg);
    }
  };

  const handleContinueSession = async (sessionId: string) => {
    try {
      const data = await continueSession(sessionId);
      setActiveSession({
        session_id: data.session_id,
        task_description: data.task_description,
        project_dir: data.project_dir,
      });
      const history = data.conversation_history || [];
      const formattedMessages: ConversationMessage[] = [
        {
          role: 'assistant' as const,
          content: `**${t('welcomeContinueHint')}** ${data.session_id}\n\n**Task**: ${data.task_description}\n**Turns**: ${data.turns}\n\n${t('chatPlaceholder')}`,
          timestamp: new Date().toISOString(),
          turn_num: 0,
        },
        ...history.map((m: ConversationMessage) => ({
          role: m.role,
          content: m.role === 'assistant' && m.structured
            ? formatStructuredContent(m.structured)
            : m.content,
          timestamp: m.timestamp,
          turn_num: m.turn_num,
        })),
      ];
      setInitialMessages(formattedMessages);
      setShowSessionsList(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      alert(t('errorLoadSession') + msg);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm(t('confirmDelete') + sessionId + '"?')) return;
    try {
      await deleteSession(sessionId);
      // Refresh sidebar
      await fetchSessions();
      if (activeSession?.session_id === sessionId) {
        setActiveSession(null);
        clearMessages();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      alert(t('errorDeleteSession') + msg);
    }
  };

  return (
    <div className={'app' + (isElectron ? ' electron' : '')}>
      <Titlebar isMaximized={isMaximized} isVisible={isElectron} />
      <header className="header">
        <button className="icon-btn sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <IconMenu />
        </button>
        <div className="header-left">
          <h1 className="title">
            <IconRobot />
            {t('appTitle')}
          </h1>
        </div>
        <div className="header-right">
          <span className={'status-dot ' + (status.status === 'running' ? 'online' : 'offline')} />
          <span className="status-text">{status.mode || t('statusChecking')}</span>
          <LanguageToggle />
          <button className="icon-btn" onClick={() => setShowSettings(true)} title={t('settingsTitle')}>
            <IconGear />
          </button>
          <button className="btn btn-sm" onClick={() => setShowNewSession(true)}>
            <IconPlus /> {t('newSession')}
          </button>
        </div>
      </header>

      <div className="main-layout">
        {sidebarOpen && (
          <Sidebar
            sessions={sessions}
            activeSessionId={activeSession?.session_id}
            onSelectSession={handleContinueSession}
            onDeleteSession={handleDeleteSession}
            onNewSession={() => setShowNewSession(true)}
            onRefresh={fetchSessions}
          />
        )}

        <main className="main-content">
          {!activeSession ? (
            <div className="welcome">
              <div className="welcome-icon"><IconRobot /></div>
              <h2>{t('welcomeTitle')}</h2>
              <p>{t('welcomeDesc')}</p>
              <div className="welcome-actions">
                <button className="btn btn-primary btn-lg" onClick={() => setShowNewSession(true)}>
                  <IconPlus /> {t('welcomeNew')}
                </button>
                <button className="btn btn-secondary btn-lg" onClick={() => setShowSessionsList(true)}>
                  <IconList /> {t('welcomeContinue')}
                </button>
              </div>
            </div>
          ) : (
            <div className="chat-container">
              <div className="session-bar">
                <div className="session-bar-info">
                  <strong>{activeSession.session_id}</strong> &mdash; {activeSession.task_description}
                </div>
                <span className="session-bar-dir">
                  {t('sessionBarDir')}: {activeSession.project_dir}
                </span>
              </div>

              <div className="messages">
                {messages.map((msg: ConversationMessage, i: number) => (
                  <Message key={i} role={msg.role} content={msg.content} timestamp={msg.timestamp} />
                ))}
                {loading && (
                  <div className="message assistant">
                    <div className="message-avatar"><IconRobot /></div>
                    <div className="message-content">
                      <div className="message-header"><strong>{t('messageAi')}</strong></div>
                      <div className="typing-indicator">
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="input-area">
                <ChatInput
                  ref={inputRef}
                  onSend={hookSend}
                  disabled={loading}
                  placeholder={t('chatPlaceholder')}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {showNewSession && (
        <NewSessionModal
          onClose={() => setShowNewSession(false)}
          onCreate={handleCreateSession}
        />
      )}
      {showSessionsList && (
        <SessionsListModal
          sessions={sessions}
          onClose={() => setShowSessionsList(false)}
          onContinue={handleContinueSession}
          onDelete={handleDeleteSession}
          onNew={() => { setShowSessionsList(false); setShowNewSession(true); }}
        />
      )}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

function buildAiMessage(turn: { ai_plan?: { response?: string; title?: string; steps?: Array<Record<string, unknown>> }; modified_files?: string[]; execution_results?: Record<string, unknown>; errors?: string[] }): string {
  const parts: string[] = [];
  // Natural language response from AI
  if (turn.ai_plan?.response) {
    parts.push(turn.ai_plan.response);
  }
  // Steps
  const steps = turn.ai_plan?.steps || [];
  if (steps.length > 0) {
    parts.push('\n---\n**执行计划:**');
    steps.forEach((s, i) => {
      parts.push(`${i + 1}. ${s.description || JSON.stringify(s)}`);
    });
  }
  // Modified files
  if (turn.modified_files && turn.modified_files.length > 0) {
    parts.push('\n**修改的文件:**');
    turn.modified_files.forEach((f: string) => parts.push('- `' + f + '`'));
  }
  // Errors
  if (turn.errors && turn.errors.length > 0) {
    parts.push('\n**错误:**');
    turn.errors.forEach((e: string) => parts.push('- ' + e));
  }
  return parts.join('\n') || '已完成';
}

function formatStructuredContent(structured: Record<string, unknown>): string {
  try {
    const saved = localStorage.getItem('app_lang');
    const lang = saved === 'en' || saved === 'zh' ? saved : 'zh';
    const labels = lang === 'en'
      ? { response: 'AI Response', plan: 'Execution Plan', files: 'Modified Files', errors: 'Errors', done: 'Completed' }
      : { response: 'AI 回复', plan: '执行计划', files: '修改的文件', errors: '错误', done: '已完成' };

    const parts: string[] = [];
    // Natural language response from AI
    if (structured.response) {
      parts.push(structured.response as string);
    }
    if (structured.plan) {
      parts.push('\n### ' + labels.plan);
      const plan = structured.plan as Array<{ description?: string }>;
      plan.forEach((s: { description?: string }, i: number) => parts.push((i + 1) + '. ' + (s.description || String(s))));
    }
    if (structured.modified_files && Array.isArray(structured.modified_files) && structured.modified_files.length > 0) {
      parts.push('\n### ' + labels.files);
      (structured.modified_files as string[]).forEach(f => parts.push('- `' + f + '`'));
    }
    if (structured.errors && Array.isArray(structured.errors) && structured.errors.length > 0) {
      parts.push('\n### ' + labels.errors);
      (structured.errors as string[]).forEach(e => parts.push('- ' + e));
    }
    return parts.join('\n') || labels.done;
  } catch {
    return 'Completed';
  }
}
