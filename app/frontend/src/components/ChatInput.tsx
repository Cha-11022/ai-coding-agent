import React, { useState, forwardRef } from 'react';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
  placeholder: string;
}

const IconSend = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(({ onSend, disabled, placeholder }, ref) => {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="chat-input">
      <textarea
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
      />
      <button className="btn btn-primary send-btn" onClick={handleSubmit} disabled={disabled || !text.trim()}>
        <IconSend />
      </button>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';
export default ChatInput;