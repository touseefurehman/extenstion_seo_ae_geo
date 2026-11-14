import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="container py-5">
      <h1 className="h3">NexusRank</h1>
      <p className="nr-muted">The dashboard is built in a later phase.</p>
    </main>
  </StrictMode>,
);
