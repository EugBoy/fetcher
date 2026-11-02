import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { exec, execSync } from 'node:child_process';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { ConfigStore } from './store.js';
import { ProxyManager } from './proxyManager.js';
import { createApiRouter, setupWebSocketServer } from './api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getLocalIp(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

function openBrowser(url: string) {
  try {
    const start = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${start} ${url}`);
  } catch {
    // Ignore error if browser cannot be launched in headless env
  }
}

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
  const clientIndexHtml = path.join(clientDist, 'index.html');

  // If dist is missing, attempt to build client automatically
  if (!fs.existsSync(clientIndexHtml)) {
    const clientDir = path.resolve(__dirname, '../../client');
    console.log('[Fetcher] 📦 Сборка интерфейса UI не найдена, собираем автоматически...');
    try {
      execSync('npm run build', { cwd: clientDir, stdio: 'inherit' });
      console.log('[Fetcher] ✅ Сборка UI успешно завершена!');
    } catch (e: any) {
      console.warn('[Fetcher] ⚠️ Не удалось собрать UI автоматически (возможно не установлены зависимости в client/):', e.message);
    }
  }

  app.use(express.static(clientDist));

  // SPA fallback middleware
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.url.startsWith('/api') || req.url.startsWith('/ws')) {
      return next();
    }

    if (fs.existsSync(clientIndexHtml)) {
      return res.sendFile(clientIndexHtml);
    }

    // Friendly guide if UI is not yet built
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Fetcher Gateway</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #090d16; color: #f8fafc; padding: 40px; display: flex; justify-content: center; align-items: center; min-height: 80vh; }
            .box { max-width: 600px; background: #111827; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 16px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
            h1 { color: #38bdf8; font-size: 24px; margin-bottom: 12px; }
            code { background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 3px 8px; border-radius: 4px; font-family: monospace; }
            ol { line-height: 1.8; margin-top: 16px; margin-bottom: 24px; padding-left: 20px; }
            a { color: #38bdf8; text-decoration: none; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>⚡ Fetcher API Gateway активен!</h1>
            <p>Бэкенд-прокси и API успешно запущены на порту <strong>${config.managementPort}</strong>.</p>
            <p>Для отображения веб-интерфейса выполните в терминале сборку UI:</p>
            <ol>
              <li><code>cd client && npm install && npm run build</code></li>
              <li>Перезапустите <code>npm start</code> (или используйте <code>npm run dev</code> для разработки).</li>
            </ol>
            <p>Или откройте режим разработки на <a href="http://localhost:5173">http://localhost:5173</a></p>
          </div>
        </body>
      </html>
    `);
  });

  const port = config.managementPort || 4000;
  const localIp = getLocalIp();

  server.listen(port, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`⚡ FETCHER GATEWAY УСПЕШНО ЗАПУЩЕН!`);
    console.log(``);
    console.log(`🖥  Открыть UI на этом ПК:        http://localhost:${port}`);
    if (localIp !== 'localhost') {
      console.log(`🌐  Открыть UI с других устройств:  http://${localIp}:${port}`);
    }
    console.log(`🔌  Management API:                http://localhost:${port}/api`);
    console.log(`📡  WebSocket Feed:                ws://localhost:${port}/ws`);
    console.log(`======================================================\n`);

    // Auto-open browser if running locally
    if (process.env.OPEN_BROWSER !== 'false') {
      setTimeout(() => {
        openBrowser(`http://localhost:${port}`);
      }, 1000);
    }
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
