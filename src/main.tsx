import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { TauriBridge } from './services/tauriBridge';
import { I18nProvider } from './i18n/i18nContext';
import './index.css';

// Global hyperlink handler: makes all standard <a href="http..."> links open in system default browser on click
document.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('a');
  if (target && target.href && (target.href.startsWith('http://') || target.href.startsWith('https://'))) {
    e.preventDefault();
    TauriBridge.openUrl(target.href);
  }
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);
