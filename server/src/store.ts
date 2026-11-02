import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppConfig, RouteConfig } from './types.js';

const CONFIG_PATH = path.resolve(process.cwd(), 'fetcher-config.json');

const DEFAULT_CONFIG: AppConfig = {
  managementPort: 4000,
  autoStartProxies: true,
  maxLogsInMemory: 300,
  routes: [
    {
      id: 'demo-pokeapi',
      name: 'Sample Backend (JSONPlaceholder)',
      targetUrl: 'https://jsonplaceholder.typicode.com',
      port: 5001,
      enabled: true,
      cors: {
        enabled: true,
        allowCredentials: true,
        allowOrigin: 'echo',
        allowMethods: 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
        allowHeaders: '*',
        exposeHeaders: '*',
        maxAge: 86400,
      },
      cookies: {
        enabled: true,
        stripSecure: true,
        rewriteDomain: true,
        targetDomain: '',
        sameSite: 'lax',
      },
      headers: {
        changeOrigin: true,
        customRequestHeaders: {},
        customResponseHeaders: {},
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
};

export class ConfigStore {
  private config: AppConfig;

  constructor() {
    this.config = this.load();
  }

  private load(): AppConfig {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          routes: Array.isArray(parsed.routes) ? parsed.routes : DEFAULT_CONFIG.routes,
        };
      }
    } catch (err) {
      console.error('[ConfigStore] Failed to read config file, using defaults:', err);
    }
    this.save(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  public save(config?: AppConfig): void {
    if (config) {
      this.config = config;
    }
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      console.error('[ConfigStore] Failed to save config file:', err);
    }
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  public getRoutes(): RouteConfig[] {
    return this.config.routes;
  }

  public getRoute(id: string): RouteConfig | undefined {
    return this.config.routes.find((r) => r.id === id);
  }

  public addRoute(route: RouteConfig): void {
    const existingIndex = this.config.routes.findIndex((r) => r.id === route.id || r.port === route.port);
    if (existingIndex >= 0) {
      throw new Error(`A route with ID "${route.id}" or port ${route.port} already exists.`);
    }
    this.config.routes.push(route);
    this.save();
  }

  public updateRoute(id: string, updates: Partial<RouteConfig>): RouteConfig {
    const index = this.config.routes.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Route with ID "${id}" not found.`);
    }

    // Check if new port conflicts with another route
    if (updates.port && updates.port !== this.config.routes[index].port) {
      const portConflict = this.config.routes.some((r) => r.id !== id && r.port === updates.port);
      if (portConflict) {
        throw new Error(`Port ${updates.port} is already assigned to another route.`);
      }
    }

    const updated: RouteConfig = {
      ...this.config.routes[index],
      ...updates,
      updatedAt: Date.now(),
    };
    this.config.routes[index] = updated;
    this.save();
    return updated;
  }

  public deleteRoute(id: string): RouteConfig | undefined {
    const index = this.config.routes.findIndex((r) => r.id === id);
    if (index === -1) return undefined;
    const [deleted] = this.config.routes.splice(index, 1);
    this.save();
    return deleted;
  }
}
