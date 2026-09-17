import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════
// Deployment readiness — code-actionable blockers found by the
// read-only production audit.
//
// Proves that:
//   1. docker-compose declares the GHCR image (P0-3) so the deploy job
//      runs the pushed build instead of rebuilding stale source;
//   2. the deploy workflow pulls that image and uses `--no-build`, and
//      refreshes the checkout first;
//   3. nginx TLS paths match the compose `./ssl` mount target (P0-2),
//      so nginx can actually start with the certificates on the host;
//   4. the runtime image fixes ownership of the bind-mounted ./uploads
//      and ./logs before dropping privileges to appuser (P1).
//
// Static assertions only — never touches Docker or real credentials.
// ═══════════════════════════════════════════════════════════════

const ROOT = path.resolve(__dirname, '../..');
const readRepoFile = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

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

const COMPOSE = readRepoFile('docker-compose.yml');
const CI = readRepoFile('.github/workflows/ci.yml');
const NGINX = readRepoFile('nginx.conf');
const DOCKERFILE = readRepoFile('Dockerfile');

// ────────────────────────────────────────────────────────────────
// 1) Compose declares the pushed GHCR image (P0-3)
// ────────────────────────────────────────────────────────────────

describe('deploy-p0-3: compose consumes the pushed image', () => {
  it('app service declares the GHCR image with an APP_IMAGE override', () => {
    const app = serviceBlock(COMPOSE, 'app');
    expect(app).toMatch(/image:\s*\$\{APP_IMAGE:-ghcr\.io\/shekooo1\/sakani:latest\}/);
  });

  it('app service keeps a local build for development', () => {
    expect(serviceBlock(COMPOSE, 'app')).toMatch(/^\s*build:\s*\.\s*$/m);
  });
});

// ────────────────────────────────────────────────────────────────
// 2) Deploy job runs the pushed image, not a stale rebuild (P0-3)
// ────────────────────────────────────────────────────────────────

describe('deploy-p0-3: CI deploy uses the pushed image', () => {
  it('refreshes the server checkout before deploying', () => {
    expect(CI).toMatch(/git pull --ff-only/);
    expect(CI).toMatch(/git fetch origin/);
  });

  it('pulls the app image and starts the full stack without rebuilding', () => {
    expect(CI).toContain('docker compose pull app');
    expect(CI).toContain('docker compose up -d --no-build app nginx');
  });

  it('gates the deploy on readiness and rolls back on failure (P0-DP-1)', () => {
    expect(CI).toContain('docker inspect --format');
    expect(CI).toMatch(/healthy/);
    expect(CI).toContain('Rolling back to');
    expect(CI).toContain('--no-build --no-deps app');
    expect(CI).toContain('exit 1');
  });

  it('passes the exact pushed image tag to the remote host', () => {
    expect(CI).toMatch(/APP_IMAGE:\s*\$\{\{\s*steps\.meta\.outputs\.image\s*\}\}:\$\{\{\s*github\.sha\s*\}\}/);
    expect(CI).toMatch(/envs:\s*APP_IMAGE,BRANCH/);
  });
});

// ────────────────────────────────────────────────────────────────
// 3) nginx TLS paths match the compose mount target (P0-2)
// ────────────────────────────────────────────────────────────────

describe('deploy-p0-2: nginx certificate paths are consistent', () => {
  it('compose mounts ./ssl at /etc/nginx/ssl', () => {
    expect(serviceBlock(COMPOSE, 'nginx')).toMatch(/\.\/ssl:\/etc\/nginx\/ssl:ro/);
  });

  it('nginx reads cert and key from the mounted /etc/nginx/ssl path', () => {
    expect(NGINX).toMatch(/ssl_certificate\s+\/etc\/nginx\/ssl\/sakani\.crt;/);
    expect(NGINX).toMatch(/ssl_certificate_key\s+\/etc\/nginx\/ssl\/sakani\.key;/);
  });

  it('nginx no longer references the unmounted /etc/ssl paths', () => {
    expect(NGINX).not.toContain('/etc/ssl/certs/sakani.crt');
    expect(NGINX).not.toContain('/etc/ssl/private/sakani.key');
  });
});

// ────────────────────────────────────────────────────────────────
// 4) Runtime image fixes writable-dir ownership then drops privileges (P1)
// ────────────────────────────────────────────────────────────────

describe('deploy-p1: uploads/logs ownership and privilege drop', () => {
  const ENTRYPOINT = readRepoFile('docker-entrypoint.sh');

  it('image ships su-exec and the entrypoint', () => {
    expect(DOCKERFILE).toMatch(/apk add --no-cache curl su-exec/);
    expect(DOCKERFILE).toContain('COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh');
    expect(DOCKERFILE).toContain('ENTRYPOINT ["docker-entrypoint.sh"]');
  });

  it('entrypoint fixes uploads/logs ownership and drops to appuser', () => {
    expect(ENTRYPOINT).toMatch(/chown -R appuser:appgroup \/app\/uploads \/app\/logs/);
    expect(ENTRYPOINT).toContain('su-exec appuser:appgroup "$@"');
  });

  it('container no longer pins USER appuser without the entrypoint drop', () => {
    // Privileges must be dropped by the entrypoint, not only by USER.
    expect(DOCKERFILE).not.toMatch(/^\s*USER\s+appuser\s*$/m);
  });
});

// ────────────────────────────────────────────────────────────────
// 5) Runtime readiness + fail-fast startup (P0-DB-1/2, P0-RT-1/2, P0-HL-1)
// ────────────────────────────────────────────────────────────────

describe('deploy-p0: readiness and fail-fast startup', () => {
  const SERVER = readRepoFile('server.ts');

  it('app waits for a healthy database before starting', () => {
    expect(serviceBlock(COMPOSE, 'app')).toMatch(/condition:\s*service_healthy/);
    expect(serviceBlock(COMPOSE, 'db')).toContain('healthcheck:');
  });

  it('docker healthcheck probes database-backed readiness', () => {
    expect(DOCKERFILE).toContain('/api/ready');
  });

  it('server exposes readiness and fails fast on init/migration/server errors', () => {
    expect(SERVER).toContain('/api/ready');
    expect(SERVER).toContain('DATABASE SCHEMA INITIALIZATION FAILED');
    expect(SERVER).toContain('DATABASE MIGRATION FAILED');
    expect(SERVER).toContain('HTTP SERVER FAILED TO START');
  });

  it('ships a backup script with retention', () => {
    const backup = readRepoFile('scripts/backup.sh');
    expect(backup).toContain('BACKUP DATABASE');
    expect(backup).toContain('BACKUP_RETENTION_DAYS');
    expect(readRepoFile('.gitignore')).toContain('backups/');
  });
});
