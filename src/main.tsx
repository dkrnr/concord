import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';
import { applyTheme, preferredTheme } from './theme';
import { I18nProvider } from './i18n';

applyTheme(preferredTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><I18nProvider><App /></I18nProvider></React.StrictMode>,
);
