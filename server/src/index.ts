import express from 'express';
import http from 'node:http';
import path from 'node:path';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { ConfigStore } from './store.js';
import { ProxyManager } from './proxyManager.js';
import { createApiRouter, setupWebSocketServer } from './api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  const store = new ConfigStore();
  const config = store.getConfig();
  const proxyManager = new ProxyManager(config.maxLogsInMemory || 300);

  // Initialize configured routes
  if (config.autoStartProxies) {
    for (const route of config.routes) {
      if (route.enabled) {
        try {
          await proxyManager.startRoute(route);
        } catch (err: any) {
          console.error(`[Fetcher] Could not start proxy for ${route.name} on port ${route.port}:`, err.message);
        }
      }
    }
  }

  const app = express();
  const server = http.createServer(app);

  // Enable CORS for management API so dev client on port 5173 can call it freely
  app.use(cors());
  app.use(express.json());

  // Mount API router
  const apiRouter = createApiRouter(store, proxyManager);
  app.use('/api', apiRouter);

  // Setup WebSocket server for real-time events
  setupWebSocketServer(server, store, proxyManager);

  // Serve static client production build if exists
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  // SPA fallback middleware
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.url.startsWith('/api') || req.url.startsWith('/ws')) {
      return next();
    }
    const indexPath = path.join(clientDist, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(200).send(`
          <html>
            <head><title>Fetcher Gateway</title></head>
            <body style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center;">
              <h1>⚡ Fetcher API Gateway is running!</h1>
              <p>Management API is active on port ${config.managementPort}.</p>
              <p>In development mode, open the UI at: <a style="color: #38bdf8" href="http://localhost:5173">http://localhost:5173</a></p>
              <p>Or run <code>npm run build</code> in the project root to bundle the UI.</p>
            </body>
          </html>
        `);
      }
    });
  });

  const port = config.managementPort || 4000;
  server.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(`⚡ FETCHER GATEWAY ACTIVE`);
    console.log(`🎯 Management Dashboard: http://localhost:${port}`);
    console.log(`🔌 Management API:       http://localhost:${port}/api`);
    console.log(`📡 WebSocket Feed:       ws://localhost:${port}/ws`);
    console.log(`======================================================\n`);
  });

  // Graceful shutdown
  const handleExit = async () => {
    console.log('\n[Fetcher] Shutting down all proxy servers...');
    await proxyManager.stopAll();
    server.close(() => {
      console.log('[Fetcher] All services stopped. Goodbye!');
      process.exit(0);
    });
  };

  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
}

bootstrap().catch((err) => {
  console.error('[Fetcher Fatal Error]:', err);
  process.exit(1);
});
