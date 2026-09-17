import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  validateProductionCorsOrigin,
  resolveCorsOrigins,
  describeCorsRejection,
  DEFAULT_DEV_CORS_ORIGIN,
} from '../backend/config/cors-config';
import {
  validateDefaultUserPassword,
  resolveAccountPassword,
  describeDefaultUserPasswordRejection,
  MIN_DEFAULT_USER_PASSWORD_LENGTH,
} from '../backend/config/default-password';

// ═══════════════════════════════════════════════════════════════
// Final hardening batch:
//   1. production CORS_ORIGIN validation (fail closed, no `*`, no
//      silent localhost fallback, Express + Socket.IO + CSRF share it);
//   2. DEFAULT_USER_PASSWORD safety for auto-created accounts;
//   3. .dockerignore / Dockerfile build-context hygiene;
//   4. uploads removed from Git tracking but the directory is preserved.
//
// Fake domains only — never a real production domain. No secrets printed.
// ═══════════════════════════════════════════════════════════════

const ROOT = path.resolve(__dirname, '../..');
const readRepoFile = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const FAKE_ORIGIN = 'https://sakani.example.test';
const FAKE_ORIGIN_2 = 'https://admin.example.test';

// ────────────────────────────────────────────────────────────────
// 1) CORS — pure validation
// ────────────────────────────────────────────────────────────────

describe('final: CORS_ORIGIN production validation', () => {
  it('rejects missing / empty / whitespace-only values', () => {
    expect(validateProductionCorsOrigin(undefined)).toMatchObject({ ok: false, reason: 'missing' });
    expect(validateProductionCorsOrigin(null)).toMatchObject({ ok: false, reason: 'missing' });
    expect(validateProductionCorsOrigin('')).toMatchObject({ ok: false, reason: 'empty' });
    expect(validateProductionCorsOrigin('   ')).toMatchObject({ ok: false, reason: 'empty' });
    expect(validateProductionCorsOrigin(' , , ')).toMatchObject({ ok: false, reason: 'empty' });
  });

  it('rejects a wildcard because credentialed requests are enabled', () => {
    expect(validateProductionCorsOrigin('*')).toMatchObject({ ok: false, reason: 'wildcard-with-credentials' });
    expect(validateProductionCorsOrigin(`${FAKE_ORIGIN}, *`)).toMatchObject({ ok: false, reason: 'wildcard-with-credentials' });
  });

  it('rejects malformed values and non-origin URLs', () => {
    for (const bad of ['not a url', 'ftp://example.test', `${FAKE_ORIGIN}/path`, 'https://user:pass@example.test', 'javascript:alert(1)']) {
      expect(validateProductionCorsOrigin(bad)).toMatchObject({ ok: false });
    }
  });

  it('accepts a valid HTTPS production origin and normalizes it', () => {
    const result = validateProductionCorsOrigin(`${FAKE_ORIGIN}/`);
    expect(result.ok).toBe(true);
    expect(result.origins).toEqual([FAKE_ORIGIN]);
  });

  it('accepts multiple valid origins', () => {
    const result = validateProductionCorsOrigin(`${FAKE_ORIGIN},${FAKE_ORIGIN_2}`);
    expect(result.ok).toBe(true);
    expect(result.origins).toEqual([FAKE_ORIGIN, FAKE_ORIGIN_2]);
  });

  it('describeCorsRejection never includes an origin value', () => {
    const message = describeCorsRejection('wildcard-with-credentials');
    expect(message).toContain('*');
    expect(message.toLowerCase()).toContain('credential');
    expect(describeCorsRejection('invalid')).not.toContain(FAKE_ORIGIN);
  });
});

// ────────────────────────────────────────────────────────────────
// 2) CORS — environment resolution / fail closed
// ────────────────────────────────────────────────────────────────

describe('final: CORS resolution by environment', () => {
  it('production fails closed when CORS_ORIGIN is absent (no localhost fallback)', () => {
    const resolved = resolveCorsOrigins({ NODE_ENV: 'production' });
    expect(resolved.ok).toBe(false);
    expect(resolved.origins).not.toContain(DEFAULT_DEV_CORS_ORIGIN);
    expect(resolved.origins).toHaveLength(0);
  });

  it('production fails closed on empty, whitespace and wildcard values', () => {
    for (const value of ['', '   ', '*']) {
      const resolved = resolveCorsOrigins({ NODE_ENV: 'production', CORS_ORIGIN: value });
      expect(resolved.ok).toBe(false);
    }
  });

  it('production accepts a valid explicit origin list', () => {
    const resolved = resolveCorsOrigins({ NODE_ENV: 'production', CORS_ORIGIN: `${FAKE_ORIGIN},${FAKE_ORIGIN_2}` });
    expect(resolved.ok).toBe(true);
    expect(resolved.origins).toEqual([FAKE_ORIGIN, FAKE_ORIGIN_2]);
  });

  it('development remains usable with the localhost fallback', () => {
    const resolved = resolveCorsOrigins({ NODE_ENV: 'development' });
    expect(resolved.ok).toBe(true);
    expect(resolved.origins).toEqual([DEFAULT_DEV_CORS_ORIGIN]);
    expect(resolved.usedDevFallback).toBe(true);
  });

  it('development/test keep tolerating a wildcard for local tooling', () => {
    for (const nodeEnv of ['development', 'test']) {
      const resolved = resolveCorsOrigins({ NODE_ENV: nodeEnv, CORS_ORIGIN: '*' });
      expect(resolved.ok).toBe(true);
      expect(resolved.origins).toEqual(['*']);
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 3) DEFAULT_USER_PASSWORD — pure validation + resolution
// ────────────────────────────────────────────────────────────────

describe('final: DEFAULT_USER_PASSWORD safety', () => {
  it('rejects missing / empty / whitespace-only defaults', () => {
    for (const value of [undefined, null, '', '   ']) {
      expect(validateDefaultUserPassword(value)).toMatchObject({ ok: false, reason: 'missing' });
    }
  });

  it('rejects the documented .env.example default and known weak values', () => {
    const documented = ['Sakani', '@', '2026', '#', 'Change', 'Me'].join('');
    for (const value of [documented, 'admin123', 'password', '123456', 'changeme', 'test123']) {
      expect(validateDefaultUserPassword(value)).toMatchObject({ ok: false, reason: 'insecure' });
    }
  });

  it('rejects too-short values and accepts a strong value', () => {
    expect(validateDefaultUserPassword('Ab1!')).toMatchObject({ ok: false, reason: 'too-short' });
    expect(validateDefaultUserPassword('Tr0ub4dor&3-Friends!').ok).toBe(true);
    expect(MIN_DEFAULT_USER_PASSWORD_LENGTH).toBe(8);
  });

  it('never exposes the configured value in the rejection text', () => {
    const sentinel = 'Zz9';
    const result = validateDefaultUserPassword(sentinel);
    expect(result.ok).toBe(false);
    expect(describeDefaultUserPasswordRejection(result.reason)).not.toContain(sentinel);
  });

  it('preserves an explicit caller-supplied password without needing a default', () => {
    const resolved = resolveAccountPassword('Caller-Supplied-Pass-1', {});
    expect(resolved.ok).toBe(true);
    expect(resolved.usedDefault).toBe(false);
    expect(resolved.password).toBe('Caller-Supplied-Pass-1');
  });

  it('falls back only to a safe DEFAULT_USER_PASSWORD', () => {
    const safe = resolveAccountPassword(undefined, { DEFAULT_USER_PASSWORD: 'Safe-Default-Pass-9' });
    expect(safe.ok).toBe(true);
    expect(safe.usedDefault).toBe(true);

    const insecure = resolveAccountPassword(undefined, { DEFAULT_USER_PASSWORD: 'admin123' });
    expect(insecure).toMatchObject({ ok: false, reason: 'insecure' });

    const missing = resolveAccountPassword('', {});
    expect(missing).toMatchObject({ ok: false, reason: 'missing' });
  });
});

// ────────────────────────────────────────────────────────────────
// 4) Build context — .dockerignore and Dockerfile
// ────────────────────────────────────────────────────────────────

describe('final: Docker build context hygiene', () => {
  const dockerignore = readRepoFile('.dockerignore');
  const dockerfile = readRepoFile('Dockerfile');

  it('.dockerignore excludes secrets, VCS, deps, runtime data and keys', () => {
    for (const entry of ['.git', '.env', '.env.*', '!.env.example', 'node_modules', 'dist', 'dev-dist', 'logs', 'uploads', '*.log', 'coverage', 'ssl', '*.pem', '*.key', 'tmp']) {
      expect(dockerignore).toContain(entry);
    }
  });

  it('Dockerfile no longer bakes uploads into the image and creates the dirs', () => {
    expect(dockerfile).not.toContain('COPY --from=builder /app/uploads');
    expect(dockerfile).toContain('mkdir -p /app/uploads/documents /app/uploads/radio /app/uploads/broadcasts');
  });

  it('.dockerignore keeps files the Docker build needs', () => {
    for (const needed of ['src', 'migrations', 'server.ts', 'knexfile.ts', 'tsconfig.json', 'package.json', 'vite.config.ts', 'public', 'docker-entrypoint.sh']) {
      // None of the required build inputs may be ignored.
      expect(dockerignore.split(/\r?\n/).map((l) => l.trim())).not.toContain(needed);
    }
  });

  it('resolves the build context like Docker (.dockerignore semantics)', () => {
    function globToRegExp(glob: string): RegExp {
      let re = '';
      for (let i = 0; i < glob.length; i++) {
        const c = glob[i];
        if (c === '*') {
          if (glob[i + 1] === '*') {
            if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
          } else { re += '[^/]*'; }
        } else if (c === '?') { re += '[^/]'; }
        else if ('\\^$.|+()[]{}'.includes(c)) { re += '\\' + c; }
        else { re += c; }
      }
      return new RegExp('^' + re + '$');
    }

    const rules = dockerignore
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== '' && !l.startsWith('#'))
      .map((l) => {
        const negate = l.startsWith('!');
        return { negate, re: globToRegExp(negate ? l.slice(1) : l) };
      });
    const matchesAncestor = (p: string, re: RegExp) => {
      const parts = p.split('/');
      return parts.some((_, i) => re.test(parts.slice(0, i + 1).join('/')));
    };
    const ignored = (p: string) => {
      let result = false;
      for (const rule of rules) if (matchesAncestor(p, rule.re)) result = !rule.negate;
      return result;
    };

    for (const keep of ['server.ts', 'knexfile.ts', 'migrations/001_init.ts', 'public/icon.png', 'src/backend/config/cors-config.ts', '.env.example', 'docker-entrypoint.sh']) {
      expect(ignored(keep), `${keep} must stay in the context`).toBe(false);
    }
    for (const drop of ['.env', '.gitignore', '.git/config', 'node_modules/react/index.js', 'dist/sw.js', 'dev-dist/sw.js', 'coverage/x.json', 'test-results/x', 'logs/app.log', 'uploads/documents/x.jpg', 'server.err', 'ssl/priv.key', 'x.pem', 'x.db', 'tmp/x']) {
      expect(ignored(drop), `${drop} must be excluded from the context`).toBe(true);
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 5) Uploads are untracked but preserved
// ────────────────────────────────────────────────────────────────

describe('final: uploads are runtime data, not repository content', () => {
  it('.gitignore ignores uploads but keeps the directory', () => {
    const gitignore = readRepoFile('.gitignore');
    expect(gitignore).toContain('uploads/*');
    expect(gitignore).toContain('!uploads/.gitkeep');
    expect(gitignore).toContain('*.err');
  });

  it('the application ensures the upload directories exist at startup', () => {
    const upload = readRepoFile('src/backend/middleware/upload.ts');
    expect(upload).toMatch(/mkdirSync\(path\.resolve\(process\.cwd\(\), 'uploads', sub\)/);
  });
});

// ────────────────────────────────────────────────────────────────
// 6) Wiring — server + account-creation call sites
// ────────────────────────────────────────────────────────────────

describe('final: security wiring', () => {
  const server = readRepoFile('server.ts');

  it('server shares one validated CORS list and has no localhost fallback', () => {
    expect(server).toContain('resolveCorsOrigins(process.env)');
    expect(server).toContain('origin: corsConfig.origins');
    expect(server).toContain('const allowedOrigins = corsConfig.origins;');
    expect(server).not.toContain('process.env.CORS_ORIGIN || "http://localhost:5173"');
  });

  it('every DEFAULT_USER_PASSWORD consumer uses the safe resolver', () => {
    const consumers = [
      'src/backend/api/user.routes.ts',
      'src/backend/api/tenant.routes.ts',
      'src/backend/api/students/crud.routes.ts',
      'src/backend/api/student.service.ts',
    ];
    for (const rel of consumers) {
      const src = readRepoFile(rel);
      expect(src).toContain('resolveAccountPassword');
      expect(src).not.toContain('process.env.DEFAULT_USER_PASSWORD');
    }
  });
});
