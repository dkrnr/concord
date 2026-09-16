import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';
import { applyTheme, preferredTheme } from './theme';
import { I18nProvider } from './i18n';
import VisitorPass from './VisitorPass';

applyTheme(preferredTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><I18nProvider>{window.location.pathname.startsWith('/visitor-pass/') ? <VisitorPass /> : <App />}</I18nProvider></React.StrictMode>,
);
