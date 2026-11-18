import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { attemptStaleChunkReload } from './utils/lazyWithRetry';
import './index.css';

if (typeof window !== 'undefined') {
  // Recover cleanly if a backgrounded tab attempts to load chunks from an older deployment
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    attemptStaleChunkReload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
