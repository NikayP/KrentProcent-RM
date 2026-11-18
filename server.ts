import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import configHandler from './api/config.js';
import loginHandler from './api/login.js';
import scanMenuHandler from './api/scan-menu.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parsing limited to 6 MB (supports 3 MB PDFs / compressed menu photos while preventing DoS)
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true, limit: '6mb' }));

// Shared API endpoints (mirrors Vercel serverless functions in api/*.ts)
app.get('/api/config', (req, res) => configHandler(req as any, res as any));
app.post('/api/login', (req, res) => loginHandler(req as any, res as any));
app.post('/api/scan-menu', (req, res) => scanMenuHandler(req as any, res as any));

// Dev server vs Production setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KrentProcent server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
