import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { randomId } from './lib/randomId';
import { applyThemeToDocument, resolveTheme, setThemeMetaColor } from './lib/theme';
import './index.css';

if (globalThis.crypto && typeof globalThis.crypto.randomUUID !== 'function') {
  globalThis.crypto.randomUUID = randomId as Crypto['randomUUID'];
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const initialTheme = resolveTheme(window.location.search, window.localStorage);
applyThemeToDocument(initialTheme);
setThemeMetaColor(initialTheme);

if (typeof document !== 'undefined' && initialTheme === 'academy') {
  document.title = '从前书院 · 黄诗扶生日特别版';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
