import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'node:http';
import { ConfigStore } from './store.js';
import { ProxyManager } from './proxyManager.js';
import { RouteConfig } from './types.js';

export function createApiRouter(store: ConfigStore, proxyManager: ProxyManager) {
  const router = express.Router();

  // Get full app state
  router.get('/config', (req, res) => {
    const config = store.getConfig();
    const allStats = proxyManager.getAllStats();
    const enrichedRoutes = config.routes.map((route) => ({
      ...route,
      isRunning: proxyManager.isRunning(route.id),
      stats: allStats[route.id] || { totalRequests: 0, status2xx: 0, status3xx: 0, status4xx: 0, status5xx: 0 },
    }));

    res.json({
      ...config,
      routes: enrichedRoutes,
    });
  });

  // Query next available port
  router.get('/next-port', async (req, res) => {
    try {
      const preferred = parseInt(req.query.preferred as string, 10) || 5001;
      const port = await ProxyManager.findNextAvailablePort(preferred);
      res.json({ port });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create new route
  router.post('/routes', async (req, res) => {
    try {
      const {
        name,
        targetUrl,
        port: requestedPort,
        enabled = true,
        cors = {},
        cookies = {},
        headers = {},
      } = req.body;

      if (!name || !targetUrl) {
        return res.status(400).json({ error: 'Name and Target URL are required' });
      }

      // Format URL (ensure http/https protocol)
      let formattedTarget = targetUrl.trim();
      if (!/^https?:\/\//i.test(formattedTarget)) {
        formattedTarget = `http://${formattedTarget}`;
      }

      // Determine port
      let port = requestedPort ? parseInt(requestedPort, 10) : undefined;
      if (!port || isNaN(port)) {
        port = await ProxyManager.findNextAvailablePort(5001);
      } else {
        const available = await ProxyManager.isPortAvailable(port);
        if (!available) {
          return res.status(400).json({ error: `Port ${port} is already in use by another application.` });
        }
      }

      const id = `route_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const newRoute: RouteConfig = {
        id,
        name: name.trim(),
        targetUrl: formattedTarget,
        port,
        enabled,
        cors: {
          enabled: cors.enabled !== false,
          allowCredentials: cors.allowCredentials !== false,
          allowOrigin: cors.allowOrigin || 'echo',
          allowMethods: cors.allowMethods || 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
          allowHeaders: cors.allowHeaders || '*',
          exposeHeaders: cors.exposeHeaders || '*',
          maxAge: cors.maxAge || 86400,
        },
        cookies: {
          enabled: cookies.enabled !== false,
          stripSecure: cookies.stripSecure !== false,
          rewriteDomain: cookies.rewriteDomain !== false,
          targetDomain: cookies.targetDomain || '',
          sameSite: cookies.sameSite || 'lax',
        },
        headers: {
          changeOrigin: headers.changeOrigin !== false,
          customRequestHeaders: headers.customRequestHeaders || {},
          customResponseHeaders: headers.customResponseHeaders || {},
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      store.addRoute(newRoute);

      if (newRoute.enabled) {
        try {
          await proxyManager.startRoute(newRoute);
        } catch (err: any) {
          console.error(`Failed to start proxy on port ${newRoute.port}:`, err.message);
        }
      }

      res.status(201).json({
        ...newRoute,
        isRunning: proxyManager.isRunning(newRoute.id),
        stats: proxyManager.getStats(newRoute.id),
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Update existing route
  router.put('/routes/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (updates.targetUrl) {
        let formatted = updates.targetUrl.trim();
        if (!/^https?:\/\//i.test(formatted)) {
          formatted = `http://${formatted}`;
        }
        updates.targetUrl = formatted;
      }

      if (updates.port) {
        updates.port = parseInt(updates.port, 10);
      }

      const updated = store.updateRoute(id, updates);
      await proxyManager.restartRoute(updated);

      res.json({
        ...updated,
        isRunning: proxyManager.isRunning(updated.id),
        stats: proxyManager.getStats(updated.id),
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Toggle route enabled/disabled
  router.post('/routes/:id/toggle', async (req, res) => {
    try {
      const { id } = req.params;
      const route = store.getRoute(id);
      if (!route) {
        return res.status(404).json({ error: 'Route not found' });
      }

      const newEnabled = !route.enabled;
      const updated = store.updateRoute(id, { enabled: newEnabled });

      if (newEnabled) {
        await proxyManager.startRoute(updated);
      } else {
        await proxyManager.stopRoute(id);
      }

      res.json({
        ...updated,
        isRunning: proxyManager.isRunning(id),
        stats: proxyManager.getStats(id),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete route
  router.delete('/routes/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await proxyManager.stopRoute(id);
      const deleted = store.deleteRoute(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Route not found' });
      }
      res.json({ success: true, deletedRoute: deleted });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get logs
  router.get('/logs', (req, res) => {
    const limit = parseInt(req.query.limit as string, 10) || 100;
    res.json(proxyManager.getLogs(limit));
  });

  // Clear logs
  router.delete('/logs', (req, res) => {
    proxyManager.clearLogs();
    res.json({ success: true });
  });

  // Test target connection
  router.post('/test-connection', async (req, res) => {
    const { targetUrl } = req.body;
    if (!targetUrl) {
      return res.status(400).json({ error: 'targetUrl is required' });
    }

    let url = targetUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `http://${url}`;
    }

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const durationMs = Date.now() - start;
      const headersObj: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        headersObj[k] = v;
      });

      res.json({
        reachable: true,
        status: response.status,
        statusText: response.statusText,
        durationMs,
        headers: headersObj,
      });
    } catch (err: any) {
      const durationMs = Date.now() - start;
      res.json({
        reachable: false,
        durationMs,
        error: err.name === 'AbortError' ? 'Connection timed out (6s)' : err.message,
      });
    }
  });

  return router;
}

export function setupWebSocketServer(server: http.Server, store: ConfigStore, proxyManager: ProxyManager) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    // Send initial config and logs
    const initialPayload = {
      type: 'INIT',
      data: {
        config: store.getConfig(),
        stats: proxyManager.getAllStats(),
        logs: proxyManager.getLogs(50),
      },
    };
    ws.send(JSON.stringify(initialPayload));
  });

  const broadcast = (type: string, data: any) => {
    const msg = JSON.stringify({ type, data });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  };

  proxyManager.onLog((log) => {
    broadcast('NEW_LOG', log);
  });

  proxyManager.onStats((routeId, stats) => {
    broadcast('STATS_UPDATE', { routeId, stats });
  });

  return { broadcast, wss };
}
