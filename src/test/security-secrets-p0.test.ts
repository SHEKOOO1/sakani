import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  validateJwtSecret,
  INSECURE_JWT_SECRETS,
  MIN_JWT_SECRET_LENGTH,
  describeJwtSecretRejection,
} from '../backend/config/jwt-secret';

// ═══════════════════════════════════════════════════════════════
// P0-1 — compromised JWT secret + fail-closed startup validation.
//
//   * missing / placeholder / compromised / weak => rejected
//   * strong, unique secret => accepted
//   * signing & verification round-trip still works
//   * a token signed with the old compromised key is NOT valid under
//     a rotated key
//   * token_version invalidation wiring is intact (behavior covered
//     by security-authz.test.ts)
//   * no secret value ever appears in validation output
//   * tracked documentation contains no live credential material
//
// NOTE: every "secret" literal below is assembled from fragments so no
// real/legacy secret appears as a plain string in source. Nothing is printed.
// ═══════════════════════════════════════════════════════════════

const ROOT = path.resolve(__dirname, '../..');
const readRepoFile = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const LEGACY_COMPROMISED = ['sakani', 'secret', 'key', 'change-in-production', '2024'].join('-');
const ENCRYPTION_KEY_LITERAL = ['sakani', 'encryption', 'key', '32chars!!'].join('-');
const YOUTUBE_PREFIX = ['AIzaSyBTjv2SHPMRbRlTi9Dd', 'm8'].join('-');
const VAPID_PRIVATE_PREFIX = ['Gb9gulZaC1dlJjg', 'ZnIa'].join('');
const VAPID_PUBLIC_PREFIX = ['BAazhTY4BAIhi', '-eUAt5rWHw7'].join('');

const strongSecret = () => crypto.randomBytes(64).toString('hex');

// ────────────────────────────────────────────────────────────────
// 1) fail-closed validation
// ────────────────────────────────────────────────────────────────

describe('p0: validateJwtSecret fails closed', () => {
  it('rejects a missing / empty / whitespace JWT_SECRET', () => {
    for (const value of [undefined, null, '', '   ']) {
      const res = validateJwtSecret(value as any);
      expect(res.ok).toBe(false);
      expect(res.reason).toBe('missing');
    }
  });

  it('rejects every documented / known-unsafe placeholder', () => {
    for (const value of INSECURE_JWT_SECRETS) {
      const res = validateJwtSecret(value);
      expect(res.ok).toBe(false);
      expect(res.reason).toBe('insecure');
    }
  });

  it('rejects the previously compromised legacy JWT secret', () => {
    const res = validateJwtSecret(LEGACY_COMPROMISED);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('insecure');
  });

  it('rejects a too-short secret', () => {
    const res = validateJwtSecret('x'.repeat(MIN_JWT_SECRET_LENGTH - 1));
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('too-short');
  });

  it('accepts a strong, unique, sufficiently long secret', () => {
    const secret = strongSecret();
    expect(secret.length).toBeGreaterThanOrEqual(MIN_JWT_SECRET_LENGTH);
    expect(validateJwtSecret(secret).ok).toBe(true);
    // الحد الأدنى بالضبط يجب أن يُقبل أيضاً
    const exact = crypto.randomBytes(16).toString('hex');
    expect(exact.length).toBe(MIN_JWT_SECRET_LENGTH);
    expect(validateJwtSecret(exact).ok).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// 2) never leak the secret in validation output
// ────────────────────────────────────────────────────────────────

describe('p0: validation output never contains the secret', () => {
  it('result and rejection description leak neither value nor fragment', () => {
    for (const value of [LEGACY_COMPROMISED, ...INSECURE_JWT_SECRETS.filter(Boolean)]) {
      const res = validateJwtSecret(value);
      const described = describeJwtSecretRejection(res.reason);
      expect(JSON.stringify(res)).not.toContain(value);
      expect(described).not.toContain(value);
    }
    expect(describeJwtSecretRejection('missing')).not.toMatch(/sakani|secret-key/i);
  });
});

// ────────────────────────────────────────────────────────────────
// 3) signing / verification still works; old key no longer valid
// ────────────────────────────────────────────────────────────────

describe('p0: JWT signing & verification', () => {
  it('signs and verifies tokens with a validated strong secret', () => {
    const secret = strongSecret();
    const token = jwt.sign({ id: 'u1', role: 'admin', tokenVersion: 0 }, secret, { expiresIn: '1h' });
    const decoded = jwt.verify(token, secret) as any;
    expect(decoded.id).toBe('u1');
    expect(decoded.role).toBe('admin');
  });

  it('a token signed with the compromised secret is rejected after rotation', () => {
    const oldToken = jwt.sign({ id: 'u1' }, LEGACY_COMPROMISED, { expiresIn: '1h' });
    const rotated = strongSecret();
    expect(() => jwt.verify(oldToken, rotated)).toThrow();
  });
});

// ────────────────────────────────────────────────────────────────
// 4) startup wiring + signing code use env only
// ────────────────────────────────────────────────────────────────

describe('p0: server startup & signing wiring', () => {
  it('server.ts validates process.env.JWT_SECRET and exits 1 without logging it', () => {
    const src = readRepoFile('server.ts');
    expect(src).toContain('validateJwtSecret');
    expect(src).toContain("from \"./src/backend/config/jwt-secret.ts\"");
    expect(src).toMatch(/process\.exit\(1\)/);
    // رسالة الخطأ لا تُدرج قيمة السر إطلاقاً
    expect(src).not.toMatch(/console\.error\([^;]*process\.env\.JWT_SECRET/s);
  });

  it('all sign/verify call sites read process.env.JWT_SECRET (no inline literals)', () => {
    for (const rel of [
      'src/backend/api/auth.routes.ts',
      'src/backend/api/user.routes.ts',
      'src/backend/api/middleware.ts',
      'scripts/test-endpoints.ts',
    ]) {
      const src = readRepoFile(rel);
      expect(src).toContain('process.env.JWT_SECRET');
      expect(src).not.toContain(LEGACY_COMPROMISED);
    }
  });

  it('token_version invalidation wiring is intact (middleware + password change)', () => {
    const mw = readRepoFile('src/backend/api/middleware.ts');
    expect(mw).toContain('tokenVersion !== dbTokenVersion');
    expect(mw).toContain('token_version');
    const users = readRepoFile('src/backend/api/user.routes.ts');
    expect(users).toContain('token_version');
  });
});

// ────────────────────────────────────────────────────────────────
// 5) tracked documentation must not contain live credential material
// ────────────────────────────────────────────────────────────────

describe('p0: no secret values in tracked documentation', () => {
  const DOCS = ['SECURITY_FIXES.md', 'SECURITY_FIX_BATCH5_REPORT.md'];
  const FORBIDDEN: Array<[string, string]> = [
    ['legacy JWT secret', LEGACY_COMPROMISED],
    ['ENCRYPTION_KEY', ENCRYPTION_KEY_LITERAL],
    ['YOUTUBE_API_KEY prefix', YOUTUBE_PREFIX],
    ['VAPID_PRIVATE_KEY prefix', VAPID_PRIVATE_PREFIX],
    ['VAPID_PUBLIC_KEY prefix', VAPID_PUBLIC_PREFIX],
  ];

  it.each(DOCS)('%s contains no live credential values and documents redaction', (doc) => {
    const src = readRepoFile(doc);
    for (const [label, needle] of FORBIDDEN) {
      expect(src.includes(needle), `${doc} must not contain ${label}`).toBe(false);
    }
  });

  it('SECURITY_FIXES.md marks the disclosed values as redacted', () => {
    expect(readRepoFile('SECURITY_FIXES.md')).toContain('[REDACTED');
  });

  it('SECURITY_FIX_BATCH5_REPORT.md marks the compromised secret as redacted', () => {
    const src = readRepoFile('SECURITY_FIX_BATCH5_REPORT.md');
    expect(src).toContain('[REDACTED COMPROMISED JWT SECRET]');
    expect(src).not.toContain(LEGACY_COMPROMISED);
  });
});
