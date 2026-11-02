import { IncomingMessage, ServerResponse } from 'node:http';
import { RouteConfig } from './types.js';

export function handlePreflight(req: IncomingMessage, res: ServerResponse, config: RouteConfig['cors']): boolean {
  if (!config.enabled) return false;
  if (req.method !== 'OPTIONS') return false;

  const origin = req.headers.origin;
  const allowOrigin = getEffectiveAllowOrigin(origin, config);

  res.statusCode = 204;
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);

  if (config.allowCredentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', config.allowMethods || 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');

  // Allow requested headers or configured headers
  const reqHeaders = req.headers['access-control-request-headers'];
  res.setHeader('Access-Control-Allow-Headers', reqHeaders || config.allowHeaders || '*');

  res.setHeader('Access-Control-Max-Age', String(config.maxAge || 86400));
  res.setHeader('Content-Length', '0');
  res.end();

  return true;
}

export function applyCorsResponseHeaders(req: IncomingMessage, res: ServerResponse, config: RouteConfig['cors']) {
  if (!config.enabled) return;

  const origin = req.headers.origin;
  const allowOrigin = getEffectiveAllowOrigin(origin, config);

  res.setHeader('Access-Control-Allow-Origin', allowOrigin);

  if (config.allowCredentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (config.exposeHeaders) {
    res.setHeader('Access-Control-Expose-Headers', config.exposeHeaders);
  } else {
    res.setHeader('Access-Control-Expose-Headers', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', config.allowMethods || 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
}

function getEffectiveAllowOrigin(reqOrigin: string | undefined, config: RouteConfig['cors']): string {
  if (config.allowOrigin === 'echo' || config.allowCredentials) {
    // If credentials are enabled, browser requires exact origin match, not '*'
    return reqOrigin || '*';
  }
  return config.allowOrigin || '*';
}
