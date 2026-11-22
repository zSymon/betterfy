import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { Widget } from './Widget';

async function boot() {
  if (new URLSearchParams(location.search).has('mock')) (await import('../dev/mock')).installMock();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Widget />
    </StrictMode>,
  );
}

boot();
