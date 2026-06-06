import React from 'react';
import { useI18n } from '../i18n';

interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const IconRobot = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" /><line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" />
  </svg>
);

const IconUser = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

function formatMessage(text: string): React.ReactNode[] {
  if (!text) return [];
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('### ')) return <h4 key={i}>{line.slice(4)}</h4>;
    if (line.startsWith('## ')) return <h3 key={i}>{line.slice(3)}</h3>;
    if (line.startsWith('# ')) return <h2 key={i}>{line.slice(2)}</h2>;
    if (line.startsWith('```')) return <br key={i} />;
    if (line.match(/^(\d+)\.\s/)) return <div key={i} className="list-item">{line}</div>;
    if (line.match(/^-\s/)) return <div key={i} className="list-item bullet">{line.slice(2)}</div>;
    const boldParts = line.split(/\*\*(.*?)\*\*/g);
    if (boldParts.length > 1) return <p key={i}>{boldParts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}</p>;
    if (line.includes('`')) {
      const parts = line.split(/`(.*?)`/g);
      return <p key={i}>{parts.map((part, j) => j % 2 === 1 ? <code key={j}>{part}</code> : part)}</p>;
    }
    return line ? <p key={i}>{line}</p> : <br key={i} />;
  });
}

export default function Message({ role, content, timestamp }: MessageProps) {
  const { t } = useI18n();

  return (
    <div className={'message ' + role}>
      <div className="message-avatar">
        {role === 'user' ? <IconUser /> : <IconRobot />}
      </div>
      <div className="message-content">
        <div className="message-header">
          <strong>{role === 'user' ? t('messageYou') : t('messageAi')}</strong>
          <span className="message-time">
            {timestamp ? new Date(timestamp).toLocaleTimeString() : ''}
          </span>
        </div>
        <div className="message-body">
          {formatMessage(content)}
        </div>
      </div>
    </div>
  );
}
