import React from 'react';
import { useI18n } from '../i18n';

export default function LanguageToggle() {
  const { lang, toggleLang, t } = useI18n();

  return (
    <button
      className="icon-btn lang-toggle"
      onClick={toggleLang}
      title={t('language')}
      style={{
        fontFamily: lang === 'zh' ? '"PingFang SC","Microsoft YaHei",sans-serif' : 'inherit',
        fontWeight: 600,
        fontSize: 13,
        letterSpacing: 0.5,
      }}
    >
      {lang === 'zh' ? 'EN' : '中'}
    </button>
  );
}
