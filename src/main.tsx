import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';
import { applyTheme, preferredTheme } from './theme';

applyTheme(preferredTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
