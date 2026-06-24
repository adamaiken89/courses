import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import './i18n';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TOAST_BG, TOAST_BORDER, TOAST_TEXT } from './colors';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          style: {
            background: TOAST_BG,
            border: `1px solid ${TOAST_BORDER}`,
            color: TOAST_TEXT,
          },
        }}
        closeButton
      />
    </ErrorBoundary>
  </StrictMode>,
);
