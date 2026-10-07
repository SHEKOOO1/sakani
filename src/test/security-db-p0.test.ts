import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  assertProductionDbConfig,
  describeDbConfigRejection,
  validateProductionDbConfig,
  REQUIRED_PRODUCTION_DB_VARS,
} from '../backend/config/db-config';

// ═══════════════════════════════════════════════════════════════
// P0-4 — Production database security.
//
// Proves that:
//   1. production fails closed on missing / empty required DB vars;
//   2. production rejects the SQL Server `sa` account;
//   3. production rejects known weak/example DB passwords;
//   4. valid dedicated credentials pass and development is unaffected;
//   5. validation messages never reveal a configured value;
//   6. compose does not publish SQL Server 1433 and has no weak
//      `SA_PASSWORD` fallback (host port is dev-override only);
//   7. runtime/migration config keeps production TLS strictly validated
//      and no longer defaults to `sa`/localhost/DormMaster in production.
//
// No real credentials are used — only generated test-only values.
// ═══════════════════════════════════════════════════════════════

const ROOT = path.resolve(__dirname, '../..');
const readRepoFile = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Legacy compose default, assembled so the full literal is not committed here. */
const WEAK_EXAMPLE = ['Your', 'Strong', '@', 'Password', '123'].join('');

/** Generated, non-production test credentials. */
const SAFE_PROD_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  DB_HOST: 'db',
  DB_NAME: 'DormMaster',
  DB_USER: 'sakani_app',
  DB_PASSWORD: 'TestOnly-' + 'x'.repeat(24),
};

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

// ────────────────────────────────────────────────────────────────
// 1) Missing / empty required configuration
// ────────────────────────────────────────────────────────────────

describe('p0-4: production DB credentials fail closed', () => {
  it('rejects each required variable when missing (name reported, never a value)', () => {
    for (const name of REQUIRED_PRODUCTION_DB_VARS) {
      const env: NodeJS.ProcessEnv = { ...SAFE_PROD_ENV };
      delete env[name];
      const result = validateProductionDbConfig(env);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('missing');
      expect(result.vars).toContain(name);
    }
  });

  it('rejects each required variable when empty or whitespace', () => {
    for (const name of REQUIRED_PRODUCTION_DB_VARS) {
      const result = validateProductionDbConfig({ ...SAFE_PROD_ENV, [name]: '   ' });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('empty');
      expect(result.vars).toContain(name);
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 2) No sa / no weak password in production
// ────────────────────────────────────────────────────────────────

describe('p0-4: production refuses sa and weak passwords', () => {
  it('rejects the SQL Server sa account regardless of case/padding', () => {
    for (const user of ['sa', 'SA', ' Sa ', 'sA']) {
      const result = validateProductionDbConfig({ ...SAFE_PROD_ENV, DB_USER: user });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('sa-account');
    }
  });

  it('rejects the removed compose default and common weak values', () => {
    for (const password of [WEAK_EXAMPLE, '123', 'password', 'changeme', 'PASSWORD123', 'sa123', '123456']) {
      const result = validateProductionDbConfig({ ...SAFE_PROD_ENV, DB_PASSWORD: password });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('weak-password');
    }
  });

  it('accepts a strong dedicated application account', () => {
    expect(validateProductionDbConfig(SAFE_PROD_ENV).ok).toBe(true);
    expect(assertProductionDbConfig(SAFE_PROD_ENV).ok).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// 3) Development/test remain usable
// ────────────────────────────────────────────────────────────────

describe('p0-4: local development and tests are not blocked', () => {
  it('assertProductionDbConfig is a no-op outside production', () => {
    expect(assertProductionDbConfig({ NODE_ENV: 'development' }).ok).toBe(true);
    expect(assertProductionDbConfig({ NODE_ENV: 'test' }).ok).toBe(true);
    expect(assertProductionDbConfig({ NODE_ENV: 'development', DB_USER: 'sa', DB_PASSWORD: '123' }).ok).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// 4) No secret leakage in validation output
// ────────────────────────────────────────────────────────────────

describe('p0-4: validation never leaks configured values', () => {
  const SENTINEL = 'Zz-Do-Not-Log-This-Sentinel-Value-1234567890';

  it('does not include the DB password or host value in rejection text', () => {
    const saResult = validateProductionDbConfig({ ...SAFE_PROD_ENV, DB_USER: 'sa', DB_PASSWORD: SENTINEL });
    expect(saResult.ok).toBe(false);
    expect(describeDbConfigRejection(saResult)).not.toContain(SENTINEL);

    const missingResult = validateProductionDbConfig({
      NODE_ENV: 'production',
      DB_HOST: SENTINEL,
      DB_NAME: 'DormMaster',
      DB_USER: SENTINEL,
      DB_PASSWORD: undefined,
    });
    expect(missingResult.ok).toBe(false);
    const message = describeDbConfigRejection(missingResult);
    expect(message).not.toContain(SENTINEL);
    expect(message).toContain('DB_PASSWORD');
  });
});

// ────────────────────────────────────────────────────────────────
// 5) Compose: no published 1433, no weak SA_PASSWORD fallback
// ────────────────────────────────────────────────────────────────

describe('p0-4: compose hardens SQL Server exposure and credentials', () => {
  const COMPOSE = readRepoFile('docker-compose.yml');
  const DEV = readRepoFile('docker-compose.dev.yml');
  const dbBlock = serviceBlock(COMPOSE, 'db');
  const devDbBlock = serviceBlock(DEV, 'db');

  it('production compose does not publish SQL Server 1433', () => {
    expect(dbBlock).not.toMatch(/^\s*ports:/m);
    expect(dbBlock).not.toContain('1433:1433');
    expect(COMPOSE).not.toMatch(/"1433:1433"|'1433:1433'|1433:1433/);
  });

  it('production compose has no weak/default SA_PASSWORD fallback', () => {
    expect(COMPOSE).not.toContain(WEAK_EXAMPLE);
    // required interpolation with no default value
    expect(dbBlock).toMatch(/SA_PASSWORD:\s*"\$\{MSSQL_SA_PASSWORD:\?[^}]*\}"/);
    expect(dbBlock).not.toMatch(/MSSQL_SA_PASSWORD\s*:-/);
  });

  it('development override publishes 1433 for local host access only', () => {
    expect(devDbBlock).toMatch(/^\s*ports:/m);
    expect(devDbBlock).toContain('1433:1433');
    expect(devDbBlock).toMatch(/LOCAL DEVELOPMENT ONLY/i);
  });
});

// ────────────────────────────────────────────────────────────────
// 6) Runtime/migration config: strict prod TLS, no prod fallbacks
// ────────────────────────────────────────────────────────────────

describe('p0-4: runtime DB config is production-safe', () => {
  it('knex runtime keeps production TLS encryption with certificate validation', () => {
    const knexSrc = readRepoFile('src/backend/infrastructure/knex.ts');
    expect(knexSrc).toContain("encrypt: process.env.NODE_ENV === 'production'");
    expect(knexSrc).toContain("trustServerCertificate: process.env.NODE_ENV === 'production' ? false : true");
    // injectable CA bundle instead of weakening certificate validation
    expect(knexSrc).toContain('DB_SSL_CA_PATH');
    expect(knexSrc).toContain('cryptoCredentialsDetails');
  });

  it('knex runtime does not fall back to sa/localhost/default db in production', () => {
    const knexSrc = readRepoFile('src/backend/infrastructure/knex.ts');
    expect(knexSrc).toContain('assertProductionDbConfig');
    // the old unconditional `sa` fallback must be gone
    expect(knexSrc).not.toContain("process.env.DB_USER || 'sa'");
    expect(knexSrc).not.toContain("process.env.DB_HOST || '127.0.0.1', ");
    expect(knexSrc).not.toContain("process.env.DB_NAME || 'DormMaster', ");
  });

  it('server.ts validates production DB config before/at startup', () => {
    const serverSrc = readRepoFile('server.ts');
    expect(serverSrc).toContain('assertProductionDbConfig');
    expect(serverSrc).toContain('DB_PASSWORD');
  });

  it('knexfile production config has secure TLS and no sa fallback', () => {
    const knexfileSrc = readRepoFile('knexfile.ts');
    const prodSection = knexfileSrc.slice(knexfileSrc.indexOf('production:'));
    expect(prodSection).not.toContain("'sa'");
    expect(prodSection).toContain('trustServerCertificate: false');
    expect(prodSection).toContain('encrypt: true');
  });

  it('migration script reuses the shared env config (no hardcoded dev TLS)', () => {
    const migrateSrc = readRepoFile('scripts/migrate.ts');
    expect(migrateSrc).toContain("from '../knexfile'");
    expect(migrateSrc).toContain('assertProductionDbConfig');
    expect(migrateSrc).not.toMatch(/trustServerCertificate:\s*true/);
  });

  it('diagnostic scripts no longer contain hardcoded sa/123 credentials', () => {
    for (const rel of ['scripts/check-db.ts', 'scripts/test-db-conn.ts']) {
      const src = readRepoFile(rel);
      expect(src).not.toContain("user: 'sa'");
      expect(src).not.toContain("password: '123'");
    }
  });
});
