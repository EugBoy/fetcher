export interface RouteConfig {
  id: string;
  name: string;
  targetUrl: string;
  port: number;
  enabled: boolean;
  cors: {
    enabled: boolean;
    allowCredentials: boolean;
    allowOrigin: string; // '*' or 'echo' or specific
    allowMethods: string;
    allowHeaders: string;
    exposeHeaders: string;
    maxAge: number;
  };
  cookies: {
    enabled: boolean;
    stripSecure: boolean;
    rewriteDomain: boolean;
    targetDomain: string; // empty string or 'localhost'
    sameSite: 'none' | 'lax' | 'strict' | 'preserve';
  };
  headers: {
    changeOrigin: boolean;
    customRequestHeaders: Record<string, string>;
    customResponseHeaders: Record<string, string>;
  };
  createdAt: number;
  updatedAt: number;
}

export interface RequestLog {
  id: string;
  routeId: string;
  routeName: string;
  timestamp: number;
  method: string;
  url: string;
  targetUrl: string;
  status: number;
  durationMs: number;
  requestHeaders: Record<string, string | string[] | undefined>;
  responseHeaders: Record<string, string | string[] | undefined>;
  requestBodyPreview?: string;
  responseBodyPreview?: string;
  corsApplied: boolean;
  cookiesModified: boolean;
  error?: string;
}

export interface RouteStats {
  totalRequests: number;
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
  lastRequestTime?: number;
}

export interface AppConfig {
  managementPort: number;
  autoStartProxies: boolean;
  maxLogsInMemory: number;
  routes: RouteConfig[];
}
