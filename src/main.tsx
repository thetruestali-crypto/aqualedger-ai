import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { PwaUpdatePrompt } from './pwa/PwaUpdatePrompt.tsx';
import './index.css';

// Service worker (prompt mode): app-shell offline via precache, data in
// IndexedDB. Update activation is user-driven through PwaUpdatePrompt —
// /api/* stays network-only per vite.config.ts workbox rules.
createRoot(document.getElementById('root')!).render(
  <>
    <App />
    <PwaUpdatePrompt />
  </>,
);
