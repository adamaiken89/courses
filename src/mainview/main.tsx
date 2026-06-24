import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import './i18n';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1f2937',
            border: '1px solid #374151',
            color: '#f3f4f6',
          },
        }}
        closeButton
      />
    </ErrorBoundary>
  </StrictMode>,
);
