import http, { IncomingMessage, ServerResponse } from 'node:http';
import net from 'node:net';
import httpProxy from 'http-proxy';
import { RouteConfig, RequestLog, RouteStats } from './types.js';
import { handlePreflight, applyCorsResponseHeaders } from './corsEngine.js';
import { sanitizeCookies } from './cookieEngine.js';

type LogCallback = (log: RequestLog) => void;
type StatsCallback = (routeId: string, stats: RouteStats) => void;

interface RunningInstance {
  server: http.Server;
  proxy: httpProxy;
  route: RouteConfig;
}

export class ProxyManager {
  private instances = new Map<string, RunningInstance>();
  private stats = new Map<string, RouteStats>();
  private logs: RequestLog[] = [];
  private maxLogs: number;
  private onLogCallbacks: LogCallback[] = [];
  private onStatsCallbacks: StatsCallback[] = [];

  constructor(maxLogs = 300) {
    this.maxLogs = maxLogs;
  }

  public onLog(cb: LogCallback): void {
    this.onLogCallbacks.push(cb);
  }

  public onStats(cb: StatsCallback): void {
    this.onStatsCallbacks.push(cb);
  }

  public getStats(routeId: string): RouteStats {
    return (
      this.stats.get(routeId) || {
        totalRequests: 0,
        status2xx: 0,
        status3xx: 0,
        status4xx: 0,
        status5xx: 0,
      }
    );
  }

  public getAllStats(): Record<string, RouteStats> {
    const result: Record<string, RouteStats> = {};
    for (const [id, s] of this.stats.entries()) {
      result[id] = s;
    }
    return result;
  }

  public getLogs(limit = 100): RequestLog[] {
    return this.logs.slice(-limit);
  }

  public clearLogs(): void {
    this.logs = [];
  }

  public isRunning(routeId: string): boolean {
    return this.instances.has(routeId);
  }

  public async startRoute(route: RouteConfig): Promise<void> {
    if (this.instances.has(route.id)) {
      await this.stopRoute(route.id);
    }

    const proxy = httpProxy.createProxyServer({
      target: route.targetUrl,
      changeOrigin: route.headers.changeOrigin,
      ws: true,
      secure: false, // Dev proxy: allow self-signed certificates
      xfwd: true,
    });

    const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      const startTime = Date.now();
      (req as any)._startTime = startTime;
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // 1. Check for Preflight OPTIONS request
      if (route.cors.enabled && req.method === 'OPTIONS') {
        const handled = handlePreflight(req, res, route.cors);
        if (handled) {
          this.recordLog({
            id: requestId,
            routeId: route.id,
            routeName: route.name,
            timestamp: startTime,
            method: 'OPTIONS',
            url: req.url || '/',
            targetUrl: `${route.targetUrl}${req.url || '/'}`,
            status: 204,
            durationMs: Date.now() - startTime,
            requestHeaders: req.headers,
            responseHeaders: { 'access-control-allow-origin': res.getHeader('access-control-allow-origin') as string },
            corsApplied: true,
            cookiesModified: false,
          });
          this.updateRouteStats(route.id, 204);
          return;
        }
      }

      // 2. Inject custom request headers if specified
      if (route.headers.customRequestHeaders) {
        for (const [key, val] of Object.entries(route.headers.customRequestHeaders)) {
          req.headers[key.toLowerCase()] = val;
        }
      }

      // Capture request body preview for JSON/text if small
      let requestBodyPreview = '';
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => {
          if (chunks.reduce((acc, c) => acc + c.length, 0) < 4096) {
            chunks.push(chunk);
          }
        });
        req.on('end', () => {
          try {
            requestBodyPreview = Buffer.concat(chunks).toString('utf-8');
          } catch {
            // ignore preview parse error
          }
        });
      }

      let cookiesModified = false;

      // 3. Intercept response
      proxy.web(req, res, {}, (err) => {
        // Fallback error handler
        if (!res.headersSent) {
          applyCorsResponseHeaders(req, res, route.cors);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          const errorMsg = {
            error: 'Bad Gateway (Fetcher Dev Proxy)',
            message: `Could not connect to target backend at ${route.targetUrl}`,
            details: err.message,
            hint: 'Make sure your target backend container/service is running and accessible from the host.',
          };
          res.end(JSON.stringify(errorMsg, null, 2));
        }

        const duration = Date.now() - startTime;
        this.recordLog({
          id: requestId,
          routeId: route.id,
          routeName: route.name,
          timestamp: startTime,
          method: req.method || 'GET',
          url: req.url || '/',
          targetUrl: `${route.targetUrl}${req.url || '/'}`,
          status: 502,
          durationMs: duration,
          requestHeaders: req.headers,
          responseHeaders: {},
          corsApplied: route.cors.enabled,
          cookiesModified: false,
          error: err.message,
        });
        this.updateRouteStats(route.id, 502);
      });
    });

    // 4. WebSocket Upgrade Support
    server.on('upgrade', (req, socket, head) => {
      proxy.ws(req, socket, head, {}, (err) => {
        console.error(`[ProxyManager WS Error] Route ${route.name}:`, err.message);
        socket.destroy();
      });
    });

    // 5. Intercept Proxy Response Headers (CORS + Cookies)
    proxy.on('proxyRes', (proxyRes, req, res) => {
      let cookiesModified = false;

      // Inject CORS headers
      if (route.cors.enabled) {
        applyCorsResponseHeaders(req, res, route.cors);
      }

      // Sanitize / Rewrite Cookies
      if (route.cookies.enabled && proxyRes.headers['set-cookie']) {
        const result = sanitizeCookies(proxyRes.headers['set-cookie'], route.cookies);
        if (result.cookies) {
          proxyRes.headers['set-cookie'] = result.cookies;
          res.setHeader('set-cookie', result.cookies);
        }
        cookiesModified = result.modified;
      }

      // Inject custom response headers
      if (route.headers.customResponseHeaders) {
        for (const [key, val] of Object.entries(route.headers.customResponseHeaders)) {
          res.setHeader(key, val);
        }
      }

      // Listen to response finish to log
      res.on('finish', () => {
        const duration = Date.now() - (req as any)._startTime || 0;
        const statusCode = res.statusCode || proxyRes.statusCode || 200;

        this.recordLog({
          id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          routeId: route.id,
          routeName: route.name,
          timestamp: Date.now() - duration,
          method: req.method || 'GET',
          url: req.url || '/',
          targetUrl: `${route.targetUrl}${req.url || '/'}`,
          status: statusCode,
          durationMs: duration,
          requestHeaders: req.headers,
          responseHeaders: proxyRes.headers,
          corsApplied: route.cors.enabled,
          cookiesModified,
        });

        this.updateRouteStats(route.id, statusCode);
      });
    });

    proxy.on('error', (err, req, res) => {
      console.error(`[ProxyManager Error] Route ${route.name} (${route.targetUrl}):`, err.message);
    });

    // Start listening on the allocated port (0.0.0.0 to accept connections from LAN/Docker)
    await new Promise<void>((resolve, reject) => {
      server.listen(route.port, '0.0.0.0', () => {
        console.log(`[Fetcher] Proxy for "${route.name}" running on port ${route.port} -> ${route.targetUrl}`);
        this.instances.set(route.id, { server, proxy, route });
        resolve();
      });

      server.on('error', (err: any) => {
        console.error(`[Fetcher] Failed to bind route "${route.name}" to port ${route.port}:`, err.message);
        reject(err);
      });
    });
  }

  public async stopRoute(routeId: string): Promise<void> {
    const instance = this.instances.get(routeId);
    if (!instance) return;

    await new Promise<void>((resolve) => {
      instance.proxy.close();
      instance.server.close(() => {
        this.instances.delete(routeId);
        resolve();
      });
    });
    console.log(`[Fetcher] Stopped proxy route "${instance.route.name}" on port ${instance.route.port}`);
  }

  public async restartRoute(route: RouteConfig): Promise<void> {
    if (this.instances.has(route.id)) {
      await this.stopRoute(route.id);
    }
    if (route.enabled) {
      await this.startRoute(route);
    }
  }

  public async stopAll(): Promise<void> {
    for (const routeId of Array.from(this.instances.keys())) {
      await this.stopRoute(routeId);
    }
  }

  private updateRouteStats(routeId: string, status: number): void {
    const current = this.getStats(routeId);
    current.totalRequests++;
    if (status >= 200 && status < 300) current.status2xx++;
    else if (status >= 300 && status < 400) current.status3xx++;
    else if (status >= 400 && status < 500) current.status4xx++;
    else if (status >= 500) current.status5xx++;
    current.lastRequestTime = Date.now();

    this.stats.set(routeId, current);

    for (const cb of this.onStatsCallbacks) {
      try {
        cb(routeId, current);
      } catch (e) {
        // ignore
      }
    }
  }

  private recordLog(log: RequestLog): void {
    this.logs.push(log);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    for (const cb of this.onLogCallbacks) {
      try {
        cb(log);
      } catch (e) {
        // ignore
      }
    }
  }

  public static async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => {
        resolve(false);
      });
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port);
    });
  }

  public static async findNextAvailablePort(startPort = 5001): Promise<number> {
    let port = startPort;
    while (port < 65535) {
      const available = await ProxyManager.isPortAvailable(port);
      if (available) return port;
      port++;
    }
    throw new Error('No available port found.');
  }
}
