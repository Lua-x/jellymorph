import './base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { renderBootError } from './boot-error';
import { bootstrap } from './bootstrap';

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing in index.html');

bootstrap().then(
  (config) => {
    createRoot(container).render(
      <StrictMode>
        <App config={config} />
      </StrictMode>,
    );
  },
  (error: unknown) => {
    renderBootError(container, error);
  },
);
