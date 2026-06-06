import React from 'react';
import type { SessionItem } from '../types';
import { useI18n } from '../i18n';

interface SidebarProps {
  sessions: SessionItem[];
  activeSessionId: string | undefined;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewSession: () => void;
  onRefresh: () => void;
}

const IconRobot = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" /><line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" />
  </svg>
);
const IconList = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const IconTrash = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);
const IconPlus = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconRefresh = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
const IconFolder = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export default function Sidebar({ sessions, activeSessionId, onSelectSession, onDeleteSession, onNewSession, onRefresh }: SidebarProps) {
  const { t } = useI18n();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h3><IconList /> {t('sidebarSessions')}</h3>
        <button className="icon-btn" onClick={onRefresh} title={t('sidebarRefresh')}><IconRefresh /></button>
      </div>
      <div className="session-count">{t('sidebarSessionCount').replace('{count}', String(sessions.length))}</div>
      <div className="session-list">
        {sessions.length === 0 && (
          <div className="empty-state">
            <p>{t('sidebarNoSessions')}</p>
            <button className="btn btn-primary" onClick={onNewSession}>
              <IconPlus /> {t('sidebarCreateFirst')}
            </button>
          </div>
        )}
        {sessions.map(s => (
          <div
            key={s.session_id}
            className={'session-item ' + (activeSessionId === s.session_id ? 'active' : '')}
            onClick={() => onSelectSession(s.session_id)}
          >
            <div className="session-item-header">
              <span className="session-id">{s.session_id}</span>
              <span className="session-turns">{t('sidebarTurns').replace('{count}', String(s.turns))}</span>
            </div>
            <div className="session-task">{s.task_description}</div>
            <div className="session-meta">
              <IconFolder />
              <span>{s.project_dir?.split(/[/\\]/).pop() || '?'}</span>
              <span className="session-date">{s.updated_at?.slice(0, 10) || ''}</span>
              <button
                className="icon-btn danger"
                onClick={(e) => { e.stopPropagation(); onDeleteSession(s.session_id); }}
              >
                <IconTrash />
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
