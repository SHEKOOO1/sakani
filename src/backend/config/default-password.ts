/**
 * DEFAULT_USER_PASSWORD safety — pure (no DB, no side effects).
 *
 * Several account-creation flows fall back to `DEFAULT_USER_PASSWORD` when the
 * caller does not supply an explicit password (new users, imported tenants,
 * students, and auto-created parents). A documented/example value from
 * `.env.example` must NEVER silently become a real production account password.
 *
 * `resolveAccountPassword`:
 *   - preserves an explicit, non-empty caller-supplied password, and
 *   - otherwise requires DEFAULT_USER_PASSWORD to be present, long enough, and
 *     not a known weak/example value.
 *
 * The configured value is never logged or returned in rejection messages — only
 * the variable name and a reason are exposed.
 */

export const MIN_DEFAULT_USER_PASSWORD_LENGTH = 8;

/**
 * Known weak/example default passwords. Documented defaults are assembled from
 * fragments on purpose so the full literal is not re-committed as a plain string.
 */
const KNOWN_INSECURE_DEFAULT_PASSWORD_FRAGMENTS: readonly (readonly string[])[] = [
  ['Sakani', '@', '2026', '#', 'Change', 'Me'], // documented .env.example default
  ['Sakani', '@', '2024'], // CI/test password
  ['admin', '123'],
  ['pass', 'word'],
  ['pass', 'word', '123'],
  ['123', '456'],
  ['1', '2', '3', '4', '5', '6'],
  ['change', 'me'],
  ['change', 'me', 'in', 'production'],
  ['welcome'],
  ['letmein'],
  ['qwerty'],
  ['test', '123'],
  ['default'],
  ['secret'],
];

const KNOWN_INSECURE_DEFAULT_PASSWORDS: ReadonlySet<string> = new Set(
  KNOWN_INSECURE_DEFAULT_PASSWORD_FRAGMENTS.map((fragments) => fragments.join('').toLowerCase()),
);

export type DefaultPasswordRejectionReason = 'missing' | 'too-short' | 'insecure';

export interface DefaultPasswordValidationResult {
  ok: boolean;
  reason?: DefaultPasswordRejectionReason;
}

export function validateDefaultUserPassword(
  value: string | undefined | null,
  options: { minLength?: number } = {},
): DefaultPasswordValidationResult {
  const minLength = options.minLength ?? MIN_DEFAULT_USER_PASSWORD_LENGTH;
  const password = typeof value === 'string' ? value.trim() : '';
  if (password.length === 0) return { ok: false, reason: 'missing' };
  if (KNOWN_INSECURE_DEFAULT_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, reason: 'insecure' };
  }
  if (password.length < minLength) return { ok: false, reason: 'too-short' };
  return { ok: true };
}

export interface ResolvedAccountPassword {
  ok: boolean;
  /** The password to hash. Present only when `ok` is true. Never logged. */
  password?: string;
  /** True when DEFAULT_USER_PASSWORD was used instead of an explicit password. */
  usedDefault?: boolean;
  reason?: DefaultPasswordRejectionReason;
}

/**
 * Resolve the password for an auto-created account:
 *   - an explicit, non-empty caller-supplied password is always preserved;
 *   - otherwise DEFAULT_USER_PASSWORD must be present and safe.
 */
export function resolveAccountPassword(
  providedPassword: string | undefined | null,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedAccountPassword {
  if (typeof providedPassword === 'string' && providedPassword.trim() !== '') {
    return { ok: true, password: providedPassword, usedDefault: false };
  }

  const validation = validateDefaultUserPassword(env.DEFAULT_USER_PASSWORD);
  if (!validation.ok) return { ok: false, reason: validation.reason };

  return { ok: true, password: (env.DEFAULT_USER_PASSWORD as string).trim(), usedDefault: true };
}

/** Human-readable reason. NEVER includes the configured value. */
export function describeDefaultUserPasswordRejection(
  reason: DefaultPasswordRejectionReason | undefined,
): string {
  switch (reason) {
    case 'missing':
      return 'DEFAULT_USER_PASSWORD is not set';
    case 'too-short':
      return `DEFAULT_USER_PASSWORD must be at least ${MIN_DEFAULT_USER_PASSWORD_LENGTH} characters`;
    default:
      return 'DEFAULT_USER_PASSWORD is a known weak/example value and must not be used for accounts';
  }
}
