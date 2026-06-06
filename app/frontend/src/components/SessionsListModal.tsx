import React from 'react';
import type { SessionItem } from '../types';
import { useI18n } from '../i18n';

interface SessionsListModalProps {
  sessions: SessionItem[];
  onClose: () => void;
  onContinue: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onNew: () => void;
}

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
const IconX = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function SessionsListModal({ sessions, onClose, onContinue, onDelete, onNew }: SessionsListModalProps) {
  const { t } = useI18n();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2><IconList /> {t('sessionsListTitle')}</h2>
          <button className="icon-btn" onClick={onClose}><IconX /></button>
        </div>
        <div className="modal-body">
          {sessions.length === 0 ? (
            <p className="empty-text">{t('sessionsListEmpty')}</p>
          ) : (
            <table className="session-table">
              <thead>
                <tr>
                  <th>{t('sessionsListId')}</th>
                  <th>{t('sessionsListTask')}</th>
                  <th>{t('sessionsListProject')}</th>
                  <th>{t('sessionsListTurns')}</th>
                  <th>{t('sessionsListUpdated')}</th>
                  <th>{t('sessionsListAction')}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.session_id} className="clickable" onClick={() => onContinue(s.session_id)}>
                    <td><code>{s.session_id}</code></td>
                    <td className="task-cell">{s.task_description}</td>
                    <td>{s.project_dir?.split(/[/\\]/).pop() || '?'}</td>
                    <td>{s.turns}</td>
                    <td>{s.updated_at?.slice(0, 16).replace('T', ' ') || '-'}</td>
                    <td>
                      <button className="icon-btn danger" onClick={e => { e.stopPropagation(); onDelete(s.session_id); }}>
                        <IconTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-primary" onClick={onNew}>
            <IconPlus /> {t('newSession')}
          </button>
        </div>
      </div>
    </div>
  );
}
