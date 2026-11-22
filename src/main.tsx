import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

async function boot() {
  // Entwicklungs-Mock (nur mit ?mock in der URL, sonst wird das Modul nie geladen)
  if (new URLSearchParams(location.search).has('mock')) (await import('./dev/mock')).installMock();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

boot();
