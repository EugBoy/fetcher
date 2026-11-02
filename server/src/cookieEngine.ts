import { RouteConfig } from './types.js';

export function sanitizeCookies(
  rawCookies: string | string[] | undefined,
  config: RouteConfig['cookies']
): { cookies: string[] | undefined; modified: boolean } {
  if (!rawCookies || !config.enabled) {
    return {
      cookies: Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : undefined,
      modified: false
    };
  }

  const cookieList = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
  let modified = false;

  const transformed = cookieList.map((cookieStr) => {
    let current = cookieStr;

    // 1. Strip Secure flag if dev is HTTP
    if (config.stripSecure) {
      const stripped = current.replace(/;\s*Secure/gi, '');
      if (stripped !== current) {
        current = stripped;
        modified = true;
      }
    }

    // 2. Rewrite or remove Domain
    if (config.rewriteDomain) {
      if (config.targetDomain && config.targetDomain.trim() !== '') {
        // Replace with target domain (e.g. localhost)
        const replaced = current.replace(/;\s*Domain=[^;]+/gi, `; Domain=${config.targetDomain.trim()}`);
        if (replaced !== current) {
          current = replaced;
          modified = true;
        }
      } else {
        // Completely strip Domain so browser binds it to the current request host
        const stripped = current.replace(/;\s*Domain=[^;]+/gi, '');
        if (stripped !== current) {
          current = stripped;
          modified = true;
        }
      }
    }

    // 3. SameSite adjustment
    if (config.sameSite && config.sameSite !== 'preserve') {
      const sameSitePattern = /;\s*SameSite=[^;]+/gi;
      const newSameSite = `; SameSite=${config.sameSite.charAt(0).toUpperCase() + config.sameSite.slice(1)}`;
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
