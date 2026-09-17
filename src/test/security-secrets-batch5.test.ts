import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════
// SECURITY_FIX_BATCH5 — أسرار/بيئة (scripts/seed-admin, test-endpoints, …)
//
// التغطية:
//   1. وحدة: scripts/seed-admin-lib.ts (FAIL-CLOSED للتحقق والسلامة والنسخ
//      المبطّن للجلسات) — بدون قاعدة حقيقية.
//   2. فحص كود المصدر: لا كلمات مرور/مفاتيح مضمّنة في سكربتات الإدارة،
//      server.ts يرفض جملات placeholder الموثقة، الواجهة لا تشير إلى أسرار
//      الخادم، وvite لا يُدرج بيئة الخادم في الـ bundle.
// ═══════════════════════════════════════════════════════════════

const ROOT = path.resolve(__dirname, '../..');

function readRepoFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// ────────────────────────────────────────────────────────────────
// 1) وحدة: seed-admin-lib
// ────────────────────────────────────────────────────────────────

describe('batch5: seed-admin-lib (FAIL-CLOSED unit)', () => {
  it('rejects a missing / empty SEED_ADMIN_PASSWORD (no default password ever)', async () => {
    const { validateSeedAdminPassword } = await import('../../scripts/seed-admin-lib');
    expect(validateSeedAdminPassword(undefined).ok).toBe(false);
    expect(validateSeedAdminPassword('').ok).toBe(false);
    expect(validateSeedAdminPassword('   ').ok).toBe(false);
  });

  it('rejects short, weak, or documented-default passwords', async () => {
    const { validateSeedAdminPassword, MIN_SEED_ADMIN_PASSWORD_LENGTH } = await import('../../scripts/seed-admin-lib');
    // الطول أقل من الحد الأدنى
    expect(validateSeedAdminPassword('x'.repeat(MIN_SEED_ADMIN_PASSWORD_LENGTH - 1)).ok).toBe(false);
    // قيم ضعيفة معروفة (منها المسرّبة سابقاً)
    for (const weak of ['admin123', '123456', 'password', 'changeme', 'letmein']) {
      expect(validateSeedAdminPassword(weak).ok).toBe(false);
    }
    // إعادة استخدام كلمة المرور الافتراضية الموثّقة للمستخدمين
    const withDefault = validateSeedAdminPassword('Sakani@2026#ChangeMe', { DEFAULT_USER_PASSWORD: 'Sakani@2026#ChangeMe' } as any);
    expect(withDefault.ok).toBe(false);
  });

  it('accepts a strong, unique password', async () => {
    const { validateSeedAdminPassword } = await import('../../scripts/seed-admin-lib');
    const res = validateSeedAdminPassword('Tr0ub4dor&3-Friends!', { DEFAULT_USER_PASSWORD: 'SomeOtherDefault' } as any);
    expect(res.ok).toBe(true);
  });

  it('resolves the admin email from env or falls back to the canonical address', async () => {
    const { resolveSeedAdminEmail } = await import('../../scripts/seed-admin-lib');
    expect(resolveSeedAdminEmail({} as any)).toBe('admin@sakani.com');
    expect(resolveSeedAdminEmail({ SEED_ADMIN_EMAIL: ' boss@example.com ' } as any)).toBe('boss@example.com');
  });

  it('refuses seed-admin in production without explicit opt-in', async () => {
    const { assertSeedAdminProductionSafety } = await import('../../scripts/seed-admin-lib');
    expect(assertSeedAdminProductionSafety({ NODE_ENV: 'production' } as any).ok).toBe(false);
    expect(assertSeedAdminProductionSafety({ NODE_ENV: 'production', SEED_ADMIN_ALLOW_PRODUCTION: 'false' } as any).ok).toBe(false);
    expect(assertSeedAdminProductionSafety({ NODE_ENV: 'production', SEED_ADMIN_ALLOW_PRODUCTION: 'true' } as any).ok).toBe(true);
    expect(assertSeedAdminProductionSafety({} as any).ok).toBe(true);
  });

  it('bumps token_version for the reset in the same update (kills every old session)', async () => {
    const { buildAdminPasswordReset } = await import('../../scripts/seed-admin-lib');
    expect(buildAdminPasswordReset(null, 'h1').token_version).toBe(1);
    expect(buildAdminPasswordReset(undefined, 'h1').token_version).toBe(1);
    expect(buildAdminPasswordReset({ token_version: 0 }, 'h1').token_version).toBe(1);
    expect(buildAdminPasswordReset({ token_version: 5 }, 'h1').token_version).toBe(6);
    expect(buildAdminPasswordReset({ token_version: '3' }, 'h1').token_version).toBe(4);
    expect(buildAdminPasswordReset({ token_version: -2 } as any, 'h1').token_version).toBe(1);
    const reset = buildAdminPasswordReset({ token_version: 7 }, 'hash');
    expect(reset.password).toBe('hash');
  });
});

// ────────────────────────────────────────────────────────────────
// 2) فحص المصدر: لا أسرار مضمّنة في السكربتات + إصلاحات VERIFIED
// ────────────────────────────────────────────────────────────────

describe('batch5: no hardcoded secrets remain in admin scripts (source scan)', () => {
  it('seed-admin.ts reads the password from env, has no hardcoded literal, and imports the lib', () => {
    const src = readRepoFile('scripts/seed-admin.ts');
    expect(src).toContain('SEED_ADMIN_PASSWORD');
    expect(src).toContain('from \'./seed-admin-lib\'');
    // لا `bcrypt.hash('literal', …)` ولا القيم المسرّبة سابقاً
    expect(/bcrypt\.hash\(\s*['"]/.test(src)).toBe(false);
    expect(src.toLowerCase()).not.toContain('admin123');
    expect(src).not.toContain('123456');
  });

  it('test-endpoints.ts reads JWT_SECRET from env and contains no inline secret', () => {
    const src = readRepoFile('scripts/test-endpoints.ts');
    expect(src).toContain('process.env.JWT_SECRET');
    // المفتاح المضمّن السابق زال نهائياً
    expect(src).not.toContain('sakani-secret-key');
    expect(/jwt\.sign\([^)]*,\s*['"]/.test(src)).toBe(false);
    // فشل آمن عند غياب المفتاح
    expect(src.toLowerCase()).toContain('jwt_secret غير مضبوط');
  });

  it('set-passwords.ts is env-driven (no DB password / user password literals) and bumps token_version', () => {
    const src = readRepoFile('scripts/set-passwords.ts');
    expect(src).toContain('SET_ALL_USERS_PASSWORD');
    expect(src).toContain('DB_PASSWORD');
    expect(/bcrypt\.hash\(\s*['"]/.test(src)).toBe(false);
    expect(src).toContain('token_version');
  });

  it('server.ts rejects the documented .env.example JWT placeholder at boot (E-1)', () => {
    const src = readRepoFile('server.ts');
    expect(src).toContain('insecureJwtValues');
    // sentinel: القيمة الموثقة في .env.example (ليست سراً حقيقياً) أصبحت ضمن قائمة الرفض
    expect(src).toContain('super-secret-key-change-me-in-production');
  });

  it('vite.config.ts inlines ONLY client-safe env (fixes secret leakage into the bundle)', () => {
    const src = readRepoFile('vite.config.ts');
    expect(src).toContain('clientSafeEnv');
    expect(src).toMatch(/startsWith\('VITE_'\)/);
    // لم يعد يدرج البيئة الكاملة ككائن JSON
    expect(/JSON\.stringify\(\s*env\s*\)/.test(src)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────
// 3) .env.example — Placeholders ومن دون أسرار حقيقية
// ────────────────────────────────────────────────────────────────

describe('batch5: .env.example documents seed-admin env placeholders', () => {
  it('contains SEED_ADMIN_* documentation and no real secrets', () => {
    const src = readRepoFile('.env.example');
    expect(src).toContain('SEED_ADMIN_PASSWORD');
    expect(src).toContain('SEED_ADMIN_EMAIL');
    expect(src).toContain('SEED_ADMIN_ALLOW_PRODUCTION');
    // القيم المسرّبة سابقاً لم تعد تظهر كقيم افتراضية صالحة
    expect(src).not.toContain('sakani-secret-key');
  });
});

// ────────────────────────────────────────────────────────────────
// 4) الواجهة الأمامية — لا تشير إلى أسرار الخادم إطلاقاً
// ────────────────────────────────────────────────────────────────

describe('batch5: client source must never reference server secrets', () => {
  const CLIENT_DIRS = [
    'src/App.tsx',
    'src/main.tsx',
    'src/components',
    'src/contexts',
    'src/hooks',
    'src/providers',
    'src/services',
    'src/types',
  ];

  function* walk(rel: string): Generator<string> {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) return;
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      for (const e of fs.readdirSync(abs)) {
        yield* walk(path.join(rel, e));
      }
    } else if (/\.(ts|tsx|js|jsx)$/.test(rel)) {
      yield rel;
    }
  }

  it('no process.env usage anywhere in client code (JWT_SECRET / DB_PASSWORD / ENCRYPTION_KEY / …)', () => {
    const offenders: string[] = [];
    for (const root of CLIENT_DIRS) {
      for (const rel of walk(root)) {
        const src = readRepoFile(rel);
        if (/process\.env(?:\.[A-Z_]+)?/.test(src)) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────
// 5) المرتبط بالـ build: dist الحالي لا يُدرج أسرار الخادم إن وُجد
// ────────────────────────────────────────────────────────────────

describe('batch5: built bundles must not contain real server secret VALUES', () => {
  function configValues(): string[] {
    const envPath = path.join(ROOT, '.env');
    if (!fs.existsSync(envPath)) return [];
    const names = ['JWT_SECRET', 'DB_PASSWORD', 'ENCRYPTION_KEY', 'VAPID_PRIVATE_KEY', 'SETUP_REGISTRATION_TOKEN', 'YOUTUBE_API_KEY'];
    const values: string[] = [];
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && names.includes(m[1]) && m[2].length >= 6) values.push(m[2].replace(/^["']|["']$/g, ''));
    }
    return values;
  }

  it('dist/ has no server secret values (only scanned when a build exists)', () => {
    const distDir = path.join(ROOT, 'dist');
    if (!fs.existsSync(distDir)) return; // لا build حاضر — سكيب
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(js|mjs|cjs|html|webmanifest|json|css)$/.test(e.name)) files.push(p);
      }
    };
    walk(distDir);
    const values = configValues();
    const hits: string[] = [];
    for (const f of files) {
      let text = '';
      try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
      for (const v of values) {
        if (v.length >= 6 && text.includes(v)) { hits.push(path.relative(ROOT, f)); break; }
      }
    }
    expect(hits).toEqual([]);
  });
});