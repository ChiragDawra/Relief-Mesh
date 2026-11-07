import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { envResult } from './lib/env';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    {envResult.success ? (
      <App />
    ) : (
      <div className="p-8 text-sm text-red-900">
        ReliefMesh web is not configured: set{' '}
        {envResult.error.issues.map((issue) => issue.path.join('.')).join(', ')} in the root .env (see .env.example).
      </div>
    )}
  </StrictMode>,
);
