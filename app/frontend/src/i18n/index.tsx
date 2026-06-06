import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import zh from './zh';
import en from './en';

export type Lang = 'zh' | 'en';
type Dict = typeof zh;

const dicts: Record<Lang, Dict> = { zh, en };

interface I18nContextType {
  lang: Lang;
  t: (key: keyof Dict, vars?: Record<string, string | number>) => string;
  toggleLang: () => void;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'zh',
  t: (() => '') as any,
  toggleLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem('app_lang');
      if (saved === 'en' || saved === 'zh') return saved;
    } catch {}
    return 'zh';
  });

  const t = useCallback((key: keyof Dict, vars?: Record<string, string | number>) => {
    let text = dicts[lang][key] ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  }, [lang]);

  const toggleLang = useCallback(() => {
    setLang(prev => {
      const next = prev === 'zh' ? 'en' : 'zh';
      try { localStorage.setItem('app_lang', next); } catch {}
      return next;
    });
  }, []);

  // Sync lang to <html lang>
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, t, toggleLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export default I18nProvider;
