import { RouteConfig } from './types.js';

export interface ParsedCookie {
  name: string;
  value: string;
}

export function parseSetCookies(rawCookies: string | string[] | undefined): ParsedCookie[] {
  if (!rawCookies) return [];
  const list = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
  const result: ParsedCookie[] = [];

  for (const cookieStr of list) {
    if (!cookieStr) continue;
    const parts = cookieStr.split(';');
    const main = parts[0]?.trim();
    if (!main) continue;
    const eqIdx = main.indexOf('=');
    if (eqIdx > 0) {
      result.push({
        name: main.slice(0, eqIdx).trim(),
        value: main.slice(eqIdx + 1).trim(),
      });
    }
  }

  return result;
}

export function parseCookieHeader(headerStr: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!headerStr) return map;

  headerStr.split(';').forEach((part) => {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim();
      map.set(k, v);
    }
  });

  return map;
}

export function formatCookieHeader(map: Map<string, string>): string {
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

export function sanitizeCookies(
  rawCookies: string | string[] | undefined,
  config: RouteConfig['cookies']
): { cookies: string[] | undefined; modified: boolean } {
  if (!rawCookies || !config.enabled) {
    return {
      cookies: Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : undefined,
      modified: false,
    };
  }

  const cookieList = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
  let modified = false;

  const transformed = cookieList.map((cookieStr) => {
    let current = cookieStr;

    // 1. Strip Secure flag for HTTP environments (browsers reject Secure cookies over HTTP)
    if (config.stripSecure) {
      const stripped = current.replace(/;\s*Secure/gi, '');
      if (stripped !== current) {
        current = stripped;
        modified = true;
      }
    }

    // 2. Rewrite or remove Domain (so browser binds it to the current proxy host)
    if (config.rewriteDomain) {
      if (config.targetDomain && config.targetDomain.trim() !== '') {
        const replaced = current.replace(/;\s*Domain=[^;]+/gi, `; Domain=${config.targetDomain.trim()}`);
        if (replaced !== current) {
          current = replaced;
          modified = true;
        }
      } else {
        const stripped = current.replace(/;\s*Domain=[^;]+/gi, '');
        if (stripped !== current) {
          current = stripped;
          modified = true;
        }
      }
    }

    // 3. Force Path=/
    // If backend sets Path=/php84/lk-expert-conclusion-admin-api/, browser will NEVER send the cookie to /
    const pathPattern = /;\s*Path=[^;]+/gi;
    if (pathPattern.test(current)) {
      current = current.replace(pathPattern, '; Path=/');
      modified = true;
    } else {
      current = `${current}; Path=/`;
      modified = true;
    }

    // 4. SameSite handling:
    // In modern browsers, SameSite=None is BLOCKED if Secure is missing!
    // Since we are running over HTTP without Secure, SameSite MUST be Lax (or Strict/omitted), never None.
    let desiredSameSite = config.sameSite || 'lax';
    if (config.stripSecure && desiredSameSite === 'none') {
      desiredSameSite = 'lax';
    }

    if (desiredSameSite !== 'preserve') {
      const sameSitePattern = /;\s*SameSite=[^;]+/gi;
      const formatted = desiredSameSite.charAt(0).toUpperCase() + desiredSameSite.slice(1);
      const newSameSite = `; SameSite=${formatted}`;

      if (sameSitePattern.test(current)) {
        current = current.replace(sameSitePattern, newSameSite);
        modified = true;
      } else {
        current = `${current}${newSameSite}`;
        modified = true;
      }
    }

    return current;
  });

  return { cookies: transformed, modified };
}
