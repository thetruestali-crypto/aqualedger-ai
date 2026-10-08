import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Service worker: app-shell offline (precached by vite-plugin-pwa).
// Data itself lives in IndexedDB; only GET navigations fall back to index.html.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(<App />);
