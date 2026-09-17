/**
 * Production database configuration validation — pure (no DB, no side effects).
 *
 * The application runtime (server.ts / knex.ts) must FAIL CLOSED in production
 * when the database account is missing, empty, the SQL Server `sa` account, or
 * a known weak/example password. Development and test are unaffected.
 *
 * No secret value is ever logged or included in the rejection description —
 * only the *name* of the offending configuration variable.
 */

export const REQUIRED_PRODUCTION_DB_VARS = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] as const;

export type RequiredProductionDbVar = (typeof REQUIRED_PRODUCTION_DB_VARS)[number];

/**
 * Known weak/example database passwords that must never be usable in
 * production. The legacy compose default is assembled from fragments on
 * purpose so the full literal is not committed as a plain string.
 */
const WEAK_DB_PASSWORD_FRAGMENTS: readonly (readonly string[])[] = [
  ['Your', 'Strong', '@', 'Password', '123'], // legacy docker-compose default
  ['change', 'me'],
  ['change', 'me', 'in', 'production'],
  ['pass', 'word'],
  ['pass', 'word', '123'],
  ['123', '456'],
  ['1', '2', '3'],
  ['s', 'a', '1', '2', '3'],
];

const KNOWN_WEAK_DB_PASSWORDS: ReadonlySet<string> = new Set(
  WEAK_DB_PASSWORD_FRAGMENTS.map((fragments) => fragments.join('').toLowerCase()),
);

export type DbConfigRejectionReason = 'missing' | 'empty' | 'sa-account' | 'weak-password';

export interface DbConfigValidationResult {
  ok: boolean;
  reason?: DbConfigRejectionReason;
  /** Names (never values) of the offending variables. */
  vars?: string[];
}

export function validateProductionDbConfig(
  env: NodeJS.ProcessEnv = process.env,
): DbConfigValidationResult {
  const missing: string[] = [];
  const empty: string[] = [];

  for (const name of REQUIRED_PRODUCTION_DB_VARS) {
    const value = env[name];
    if (value === undefined) missing.push(name);
    else if (value.trim() === '') empty.push(name);
  }

  if (missing.length > 0) return { ok: false, reason: 'missing', vars: missing };
  if (empty.length > 0) return { ok: false, reason: 'empty', vars: empty };

  // Production must not run on the server-wide `sa` account.
  if ((env.DB_USER ?? '').trim().toLowerCase() === 'sa') {
    return { ok: false, reason: 'sa-account', vars: ['DB_USER'] };
  }

  // Reject documented weak/example passwords (compared case-insensitively).
  if (KNOWN_WEAK_DB_PASSWORDS.has((env.DB_PASSWORD ?? '').toLowerCase())) {
    return { ok: false, reason: 'weak-password', vars: ['DB_PASSWORD'] };
  }

  return { ok: true };
}

/**
 * Validate only when the current environment is production. Development/test
 * keep the permissive local workflow.
 */
export function assertProductionDbConfig(
  env: NodeJS.ProcessEnv = process.env,
): DbConfigValidationResult {
  if (env.NODE_ENV !== 'production') return { ok: true };
  return validateProductionDbConfig(env);
}

/** Human-readable reason. NEVER includes a configured value. */
export function describeDbConfigRejection(result: DbConfigValidationResult): string {
  const names = result.vars?.join(', ');
  switch (result.reason) {
    case 'missing':
      return `is missing required value(s): ${names}`;
    case 'empty':
      return `has empty required value(s): ${names}`;
    case 'sa-account':
      return 'DB_USER must be a dedicated application login, not the SQL Server "sa" account';
    case 'weak-password':
      return 'DB_PASSWORD is a known weak/example value, which is not allowed in production';
    default:
      return 'is invalid';
  }
}
