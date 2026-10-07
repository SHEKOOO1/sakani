import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════
// P0-3 — Production environment enforcement.
//
// Proves that:
//   1. docker-compose's production `app` service explicitly forces
//      NODE_ENV=production under `environment` (which overrides env_file,
//      so a local .env NODE_ENV=development can never downgrade it);
//   2. the composed/resolved environment is production even when a local
//      `.env` says development (documented Compose precedence emulation);
//   3. .env.example keeps `development` for local use only and does not
//      present a misleading production default;
//   4. the existing production security branches in server.ts / auth /
//      knex remain intact (CSP, CSRF local fallback, Vite dev serving,
//      secure cookies, DB TLS);
//   5. the dev override is opt-in and not auto-loaded.
//
// No production credentials or real .env values are read by these tests.
// ═══════════════════════════════════════════════════════════════

const ROOT = path.resolve(__dirname, '../..');
const readRepoFile = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * Return the YAML block of a top-level 2-space-indented service mapping,
 * from its header until the next top-level service key. Sufficient for the
 * controlled docker-compose files in this repo.
 */
function serviceBlock(yaml: string, service: string): string {
  const lines = yaml.split(/\r?\n/);
  const startRe = new RegExp(`^  ${service}:\\s*$`);
  const start = lines.findIndex((l) => startRe.test(l));
  if (start < 0) throw new Error(`service not found in compose: ${service}`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^  [A-Za-z0-9_.-]+:\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

const indentOf = (s: string): number => s.match(/^(\s*)/)?.[1]?.length ?? 0;

/** Parse the `environment:` mapping of a service block into a plain object. */
function environmentMap(block: string): Record<string, string> {
  const lines = block.split(/\r?\n/);
  const idx = lines.findIndex((l) => /^\s*environment:\s*$/.test(l));
  const out: Record<string, string> = {};
  if (idx < 0) return out;
  const baseIndent = indentOf(lines[idx]!);
  for (let i = idx + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim()) continue;
    if (indentOf(line) <= baseIndent) break;
    const m = line.match(/^\s*([A-Za-z0-9_]+):\s*(.*?)\s*$/);
    if (m) out[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
  }
  return out;
}

/**
 * Emulate Docker Compose environment precedence for a service:
 *   process env > compose `environment` > `env_file` > Dockerfile ENV
 * Here we model the concrete risk: a local .env that sets
 * NODE_ENV=development must lose against the compose `environment` key.
 */
function resolveComposeServiceEnv(composeYaml: string, service: string, envFileValues: Record<string, string>) {
  const block = serviceBlock(composeYaml, service);
  return { ...envFileValues, ...environmentMap(block) };
}

const COMPOSE = readRepoFile('docker-compose.yml');

// ────────────────────────────────────────────────────────────────
// 1) Compose forces production on the app service
// ────────────────────────────────────────────────────────────────

describe('p0-3: docker-compose forces production NODE_ENV', () => {
  it('app service declares environment.NODE_ENV=production', () => {
    const app = serviceBlock(COMPOSE, 'app');
    expect(environmentMap(app).NODE_ENV).toBe('production');
  });

  it('app service also still loads env_file .env (but environment wins)', () => {
    const app = serviceBlock(COMPOSE, 'app');
    expect(app).toMatch(/^\s*env_file:\s*\.env\s*$/m);
    // production flag is in `environment`, not left to the env file
    expect(app).toMatch(/^\s*environment:\s*$/m);
  });

  it('no compose file downgrades NODE_ENV to development in the base file', () => {
    expect(COMPOSE).not.toMatch(/NODE_ENV:\s*["']?development["']?/);
  });

  it('Dockerfile keeps ENV NODE_ENV=production as defense-in-depth', () => {
    expect(readRepoFile('Dockerfile')).toMatch(/^\s*ENV\s+NODE_ENV=production\s*$/m);
  });
});

// ────────────────────────────────────────────────────────────────
// 2) A developer .env cannot downgrade the resolved production env
// ────────────────────────────────────────────────────────────────

describe('p0-3: local .env cannot downgrade production', () => {
  it('resolved production env is NODE_ENV=production even when .env says development', () => {
    const resolved = resolveComposeServiceEnv(COMPOSE, 'app', { NODE_ENV: 'development' });
    expect(resolved.NODE_ENV).toBe('production');
  });

  it('a production-only deploy path (compose up app) resolves production', () => {
    // The CI deploy uses: `docker compose up -d --no-deps app` (base file only).
    for (const localValue of ['development', 'test', 'staging', '']) {
      const resolved = resolveComposeServiceEnv(COMPOSE, 'app', { NODE_ENV: localValue });
      expect(resolved.NODE_ENV).toBe('production');
    }
  });

  it('the dev override is opt-in (separate file, not auto-loaded) and only for local dev', () => {
    const dev = readRepoFile('docker-compose.dev.yml');
    expect(environmentMap(serviceBlock(dev, 'app')).NODE_ENV).toBe('development');
    // must not be the auto-loaded override name
    expect(fs.existsSync(path.join(ROOT, 'docker-compose.override.yml'))).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────
// 3) .env.example: development is documented as local-only
// ────────────────────────────────────────────────────────────────

describe('p0-3: .env.example distinguishes development from production', () => {
  const envExample = readRepoFile('.env.example');

  it('keeps NODE_ENV=development for local development', () => {
    expect(envExample).toMatch(/^NODE_ENV=development\s*$/m);
  });

  it('does not present a misleading production default', () => {
    expect(envExample).not.toMatch(/^NODE_ENV=production\s*$/m);
  });

  it('documents that production is enforced and requires a real secret store', () => {
    expect(envExample.toLowerCase()).toMatch(/production/);
    expect(envExample).toMatch(/docker-compose/);
    expect(envExample.toLowerCase()).toMatch(/development/);
  });
});

// ────────────────────────────────────────────────────────────────
// 4) Existing production security behavior remains enabled
// ────────────────────────────────────────────────────────────────

describe('p0-3: production security branches remain intact', () => {
  it('server.ts keeps production CSP, strict CSRF fallback and no Vite dev server', () => {
    const server = readRepoFile('server.ts');
    expect(server).toContain("const isProd = process.env.NODE_ENV === 'production'");
    // CSP drops unsafe-inline/unsafe-eval in production
    expect(server).toContain('...(isProd ? [] : ["\'unsafe-inline\'", "\'unsafe-eval\'"])');
    // CSRF local-host fallback is off in production unless explicitly enabled
    expect(server).toContain("process.env.NODE_ENV !== 'production' || process.env.CSRF_ALLOW_LOCAL === 'true'");
    // Vite middleware mounts only outside production/test
    expect(server).toMatch(/process\.env\.NODE_ENV !== "production" && process\.env\.NODE_ENV !== "test"/);
  });

  it('auth/user routes issue Secure cookies only in production', () => {
    for (const rel of ['src/backend/api/auth.routes.ts', 'src/backend/api/user.routes.ts']) {
      const src = readRepoFile(rel);
      expect(src).toContain("process.env.NODE_ENV === 'production'");
      expect(src).toContain('secure: isProduction');
      expect(src).toContain('httpOnly: true');
      expect(src).toContain('sameSite: "strict"');
    }
  });

  it('knex enables DB TLS only in production', () => {
    const knex = readRepoFile('src/backend/infrastructure/knex.ts');
    expect(knex).toContain("encrypt: process.env.NODE_ENV === 'production'");
    expect(knex).toContain("trustServerCertificate: process.env.NODE_ENV === 'production' ? false : true");
  });
});
