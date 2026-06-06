import React from 'react';
import ReactDOM from 'react-dom/client';
import I18nProvider from './i18n';
import App from './App';

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </React.StrictMode>
  );
}
