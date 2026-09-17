/**
 * JWT secret validation — pure (no DB, no side effects).
 *
 * Startup (server.ts) must FAIL CLOSED when JWT_SECRET is:
 *   - missing / empty,
 *   - shorter than MIN_JWT_SECRET_LENGTH,
 *   - a documented placeholder, or
 *   - the previously compromised legacy value.
 *
 * The secret value is NEVER logged or included in error output.
 */

export const MIN_JWT_SECRET_LENGTH = 32;

/**
 * The legacy JWT secret that was previously hardcoded in scripts/test-endpoints.ts
 * and later reproduced in a tracked report. It is assembled from fragments on
 * purpose so the full literal never appears as a plain string in source or docs.
 */
const LEGACY_COMPROMISED_JWT_SECRET = ['sakani', 'secret', 'key', 'change-in-production', '2024'].join('-');
const LEGACY_COMPROMISED_JWT_PREFIX = LEGACY_COMPROMISED_JWT_SECRET.slice(
  0,
  LEGACY_COMPROMISED_JWT_SECRET.indexOf('change'),
);

export const INSECURE_JWT_SECRETS: readonly string[] = [
  'your-secret-key-here',
  'super-secret-key',
  'super-secret-key-change-me-in-production',
  LEGACY_COMPROMISED_JWT_SECRET,
];

export type JwtSecretRejectionReason = 'missing' | 'too-short' | 'insecure';

export interface JwtSecretValidationResult {
  ok: boolean;
  reason?: JwtSecretRejectionReason;
}

export function validateJwtSecret(
  value: string | undefined | null,
  options: { minLength?: number } = {},
): JwtSecretValidationResult {
  const minLength = options.minLength ?? MIN_JWT_SECRET_LENGTH;
  const secret = typeof value === 'string' ? value.trim() : '';
  if (secret.length === 0) return { ok: false, reason: 'missing' };
  if (INSECURE_JWT_SECRETS.includes(secret) || secret.startsWith(LEGACY_COMPROMISED_JWT_PREFIX)) {
    return { ok: false, reason: 'insecure' };
  }
  if (secret.length < minLength) return { ok: false, reason: 'too-short' };
  return { ok: true };
}

export function describeJwtSecretRejection(reason: JwtSecretRejectionReason | undefined): string {
  switch (reason) {
    case 'missing':
      return 'is missing';
    case 'too-short':
      return `must be at least ${MIN_JWT_SECRET_LENGTH} characters`;
    default:
      return 'is using a known unsafe/default/compromised value';
  }
}
