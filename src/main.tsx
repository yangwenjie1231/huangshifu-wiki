import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { randomId } from './lib/randomId';
import './index.css';

if (globalThis.crypto && typeof globalThis.crypto.randomUUID !== 'function') {
  globalThis.crypto.randomUUID = (() => randomId()) as Crypto['randomUUID'];
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
