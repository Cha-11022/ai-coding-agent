import React, { useState } from 'react';
import { useI18n } from '../i18n';

interface NewSessionModalProps {
  onClose: () => void;
  onCreate: (taskDescription: string, projectDir: string | null) => Promise<void>;
}

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
const IconFolder = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export default function NewSessionModal({ onClose, onCreate }: NewSessionModalProps) {
  const { t } = useI18n();
  const [task, setTask] = useState('');
  const [projectDir, setProjectDir] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!task.trim()) return;
    setLoading(true);
    await onCreate(task.trim(), projectDir.trim() || null);
    setLoading(false);
  };

  const handleSelectDir = async () => {
    if (window.electronAPI) {
      const dir = await window.electronAPI.selectDirectory();
      if (dir) setProjectDir(dir);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2><IconPlus /> {t('newSessionTitle')}</h2>
          <button className="icon-btn" onClick={onClose}><IconX /></button>
        </div>
        <div className="modal-body">
          <label>{t('newSessionTaskLabel')}</label>
          <textarea
            value={task}
            onChange={e => setTask(e.target.value)}
            placeholder={t('newSessionTaskPlaceholder')}
            rows={4}
            autoFocus
          />
          <label>{t('newSessionDirLabel')}</label>
          <div className="input-with-button">
            <input
              type="text"
              value={projectDir}
              onChange={e => setProjectDir(e.target.value)}
              placeholder={t('newSessionDirPlaceholder')}
            />
            {window.electronAPI && (
              <button className="btn btn-sm" onClick={handleSelectDir} type="button">
                <IconFolder /> {t('newSessionBrowse')}
              </button>
            )}
          </div>
          <p className="dir-hint">{t('newSessionDirHint')}</p>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!task.trim() || loading}>
            {loading ? t('newSessionCreating') : t('newSessionCreate')}
          </button>
        </div>
      </div>
    </div>
  );
}
