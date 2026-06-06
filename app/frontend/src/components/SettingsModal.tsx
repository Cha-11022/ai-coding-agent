import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../i18n';

interface SettingsModalProps {
  onClose: () => void;
}

const PROVIDERS = [
  { value: 'deepseek', labelKey: 'providerDeepseek' as const },
  { value: 'openai', labelKey: 'providerOpenai' as const },
];

const DEEPSEEK_MODELS = [
  { value: 'deepseek-chat', label: 'deepseek-chat' },
  { value: 'deepseek-reasoner', label: 'deepseek-reasoner' },
  { value: 'deepseek-coder', label: 'deepseek-coder' },
];

function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '*'.repeat(key.length);
  return key.slice(0, 4) + '*'.repeat(Math.max(key.length - 8, 4)) + key.slice(-4);
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { t, lang, toggleLang } = useI18n();

  const [provider, setProvider] = useState('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Load current config on mount
  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/config');
      const data = await res.json();
      if (data.provider) setProvider(data.provider);
      if (data.api_url) setApiUrl(data.api_url);
      if (data.model) setModel(data.model);
      if (data.has_key) setApiKey('••••••••');
    } catch {
      // backend may not be running; use localStorage fallback
      try {
        const saved = localStorage.getItem('app_config');
        if (saved) {
          const cfg = JSON.parse(saved);
          if (cfg.provider) setProvider(cfg.provider);
          if (cfg.api_url) setApiUrl(cfg.api_url);
          if (cfg.model) setModel(cfg.model);
          if (cfg.has_key) setApiKey('••••••••');
        }
      } catch {}
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // Auto-fill defaults when provider changes
  const handleProviderChange = (val: string) => {
    setProvider(val);
    if (val === 'deepseek' && !apiUrl) {
      setApiUrl('https://api.deepseek.com/v1/chat/completions');
      if (!model) setModel('deepseek-chat');
    } else if (val === 'openai' && !apiUrl) {
      setApiUrl('');
      if (!model) setModel('');
    }
  };

  const handleSave = async () => {
    setError('');
    if (!apiKey || apiKey === '••••••••') {
      setError(t('settingsApiKeyRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        provider,
        api_key: apiKey,
      };
      if (apiUrl) payload.api_url = apiUrl;
      if (model) payload.model = model;

      const res = await fetch('http://127.0.0.1:8000/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || t('settingsSaveFailed'));

      // Also save to localStorage
      localStorage.setItem('app_config', JSON.stringify({
        provider,
        api_url: apiUrl,
        model,
        has_key: true,
      }));

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('settingsUnknownError');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginBottom: 4,
    fontWeight: 500,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'auto' as React.CSSProperties['appearance'],
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ {t('settingsTitle')}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-body">
          {/* Provider */}
          <div className="settings-field">
            <label style={labelStyle}>{t('settingsProvider')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PROVIDERS.map(p => (
                <button
                  key={p.value}
                  className={'settings-provider-btn' + (provider === p.value ? ' active' : '')}
                  onClick={() => handleProviderChange(p.value)}
                  type="button"
                >
                  {t(p.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div className="settings-field">
            <label style={labelStyle}>{t('settingsApiKey')}</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={t('settingsApiKey')}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowKey(!showKey)}
                style={{ minWidth: 40 }}
              >
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* API URL */}
          <div className="settings-field">
            <label style={labelStyle}>{t('settingsApiUrl')}</label>
            <input
              type="text"
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
              placeholder="https://..."
              style={inputStyle}
            />
          </div>

          {/* Model */}
          <div className="settings-field">
            <label style={labelStyle}>{t('settingsModel')}</label>
            {provider === 'deepseek' ? (
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                style={selectStyle}
              >
                {DEEPSEEK_MODELS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder={t('settingsModelPlaceholder')}
                style={inputStyle}
              />
            )}
          </div>

          {/* Language */}
          <div className="settings-field">
            <label style={labelStyle}>{t('language')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={'settings-provider-btn' + (lang === 'zh' ? ' active' : '')}
                onClick={() => { if (lang !== 'zh') toggleLang(); }}
              >
                {t('languageChinese')}
              </button>
              <button
                type="button"
                className={'settings-provider-btn' + (lang === 'en' ? ' active' : '')}
                onClick={() => { if (lang !== 'en') toggleLang(); }}
              >
                {t('languageEnglish')}
              </button>
            </div>
          </div>

          {error && (
            <div className="settings-error">{error}</div>
          )}
          {saved && (
            <div className="settings-success">{t('settingsSaved')}</div>
          )}
        </div>

        <div className="settings-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? t('settingsSaving') : t('settingsSave')}
          </button>
        </div>
      </div>
    </div>
  );
}
