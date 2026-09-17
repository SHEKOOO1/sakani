/**
 * Production CORS origin validation — pure (no DB, no side effects).
 *
 * The server runs with credentialed requests (`credentials: true`) and issued
 * cookies, so in production `CORS_ORIGIN` MUST be explicitly configured:
 *   - missing / empty / whitespace-only is rejected,
 *   - malformed values and non-origin URLs (paths, credentials) are rejected,
 *   - the `*` wildcard is rejected because credentials are enabled, and
 *   - localhost must never silently become the production origin.
 *
 * Development and test keep the permissive local workflow (the CI test job sets
 * `CORS_ORIGIN=*`), so the production rules are only enforced when
 * `NODE_ENV=production`.
 *
 * Origins are not secrets; no configured value is ever logged as a credential.
 */

export const DEFAULT_DEV_CORS_ORIGIN = 'http://localhost:5173';

export type CorsRejectionReason =
  | 'missing'
  | 'empty'
  | 'invalid'
  | 'wildcard-with-credentials';

export interface CorsValidationResult {
  ok: boolean;
  reason?: CorsRejectionReason;
  /** Normalized origins (scheme + host + port), never credentials. */
  origins?: string[];
  /** Malformed entries, returned for developer diagnostics only. */
  invalid?: string[];
}

interface NormalizedOrigin {
  origin?: string;
  wildcard?: boolean;
  invalid?: boolean;
}

function normalizeOrigin(raw: string): NormalizedOrigin {
  const value = raw.trim();
  if (value === '*') return { wildcard: true };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { invalid: true };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { invalid: true };
  if (!url.hostname) return { invalid: true };
  // An origin must not carry userinfo, a path, query or fragment.
  if (url.username || url.password) return { invalid: true };
  if (url.pathname !== '/' || url.search || url.hash) return { invalid: true };
  return { origin: url.origin };
}

/**
 * Validate the production `CORS_ORIGIN` value. Accepts a single origin or a
 * comma-separated list of origins and returns them normalized.
 */
export function validateProductionCorsOrigin(
  value: string | undefined | null,
): CorsValidationResult {
  if (value === undefined || value === null || typeof value !== 'string') {
    return { ok: false, reason: 'missing' };
  }
  if (value.trim() === '') return { ok: false, reason: 'empty' };

  const parts = value.split(',').map((part) => part.trim()).filter((part) => part !== '');
  if (parts.length === 0) return { ok: false, reason: 'empty' };

  const origins: string[] = [];
  const invalid: string[] = [];
  let sawWildcard = false;

  for (const part of parts) {
    const normalized = normalizeOrigin(part);
    if (normalized.wildcard) {
      sawWildcard = true;
      continue;
    }
    if (normalized.invalid || !normalized.origin) {
      invalid.push(part);
      continue;
    }
    origins.push(normalized.origin);
  }

  if (invalid.length > 0) return { ok: false, reason: 'invalid', invalid };
  // Credentialed requests are always enabled, so `*` is never acceptable.
  if (sawWildcard) return { ok: false, reason: 'wildcard-with-credentials' };

  return { ok: true, origins };
}

export interface ResolvedCorsConfig {
  ok: boolean;
  reason?: CorsRejectionReason;
  invalid?: string[];
  origins: string[];
  originString: string;
  usedDevFallback: boolean;
}

/**
 * Resolve the CORS configuration for the current environment, applying the
 * strict production rules and the permissive local fallback everywhere else.
 */
export function resolveCorsOrigins(env: NodeJS.ProcessEnv = process.env): ResolvedCorsConfig {
  const isProduction = env.NODE_ENV === 'production';
  const configured = env.CORS_ORIGIN;

  if (isProduction) {
    const result = validateProductionCorsOrigin(configured);
    if (!result.ok) {
      return { ok: false, reason: result.reason, invalid: result.invalid, origins: [], originString: '', usedDevFallback: false };
    }
    return { ok: true, origins: result.origins!, originString: result.origins!.join(','), usedDevFallback: false };
  }

  // Non-production: keep local development and the CI test job usable.
  if (configured === undefined || configured === null || String(configured).trim() === '') {
    return {
      ok: true,
      origins: [DEFAULT_DEV_CORS_ORIGIN],
      originString: DEFAULT_DEV_CORS_ORIGIN,
      usedDevFallback: true,
    };
  }

  const trimmed = String(configured).trim();
  if (trimmed === '*') {
    return { ok: true, origins: ['*'], originString: '*', usedDevFallback: false };
  }

  const result = validateProductionCorsOrigin(trimmed);
  if (!result.ok) {
    // Never crash local development over a malformed value — fall back to localhost.
    return {
      ok: true,
      origins: [DEFAULT_DEV_CORS_ORIGIN],
      originString: DEFAULT_DEV_CORS_ORIGIN,
      usedDevFallback: true,
    };
  }
  return { ok: true, origins: result.origins!, originString: result.origins!.join(','), usedDevFallback: false };
}

/** Human-readable reason. NEVER includes credentials (origins are not secrets). */
export function describeCorsRejection(reason: CorsRejectionReason | undefined): string {
  switch (reason) {
    case 'missing':
      return 'is missing (CORS_ORIGIN must be explicitly set in production, e.g. https://app.example.com)';
    case 'empty':
      return 'is empty (CORS_ORIGIN must be explicitly set in production, e.g. https://app.example.com)';
    case 'invalid':
      return 'contains an invalid origin (expected an origin such as https://app.example.com, without a path)';
    case 'wildcard-with-credentials':
      return 'must not be "*" because credentialed requests (cookies) are enabled';
    default:
      return 'is invalid';
  }
}
