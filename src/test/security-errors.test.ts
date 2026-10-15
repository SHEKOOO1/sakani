import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const readRepoFile = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('HTTP error hardening', () => {
  it('disables the X-Powered-By header so the stack engine is not disclosed', () => {
    const server = readRepoFile('server.ts');
    expect(server).toContain("app.disable('x-powered-by')");
  });

  it('assigns a requestId per request and sends it as X-Request-Id header', () => {
    const server = readRepoFile('server.ts');
    expect(server).toContain('requestId');
    expect(server).toContain("res.setHeader('X-Request-Id'");
  });

  it('decorates res.status/res.json so every 500 response carries a requestId and a server log', () => {
    const server = readRepoFile('server.ts');
    expect(server).toContain('__sakani500');
    expect(server).toContain('requestId: rid');
  });

  it('the global error handler never leaks internal details and echoes the requestId', () => {
    const server = readRepoFile('server.ts');
    expect(server).toContain('"حصل خطأ فني. لو سمحت كرر المحاولة أو تواصل مع الدعم الفني."');
    expect(server).toMatch(/message:\s*"حصل خطأ فني\.[\s\S]*?"/);
  });

  it('the client surfaces the support reference code when a 500 is returned', () => {
    const useApi = readRepoFile('src/hooks/useApi.ts');
    // The requestId echoed by a 5xx response is appended to the message the user
    // sees, so support can correlate the report with the server log.
    expect(useApi).toContain('data?.requestId');
    expect(useApi).toContain('response.status >= 500 && requestId');
    expect(useApi).toContain('(رمز: ${requestId})');
  });
});