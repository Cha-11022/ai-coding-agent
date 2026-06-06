import React from 'react';
import { useI18n } from '../i18n';

interface TitlebarProps {
  isMaximized: boolean;
  isVisible: boolean;
}

const IconMinus = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconSquare = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="5" y="5" width="14" height="14" rx="2" />
  </svg>
);

const IconXSmall = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="6" y1="18" x2="18" y2="6" />
  </svg>
);

export default function Titlebar({ isMaximized, isVisible }: TitlebarProps) {
  if (!isVisible) return null;

  const { t } = useI18n();
  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => window.electronAPI?.close();

  return (
    <div className="titlebar">
      <div className="titlebar-title">{t('appTitle')}</div>
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={handleMinimize} title={t('titleMinimize')}>
          <IconMinus />
        </button>
        <button className="titlebar-btn" onClick={handleMaximize} title={isMaximized ? t('titleRestore') : t('titleMaximize')}>
          <IconSquare />
        </button>
        <button className="titlebar-btn close" onClick={handleClose} title={t('titleClose')}>
          <IconXSmall />
        </button>
      </div>
    </div>
  );
}
