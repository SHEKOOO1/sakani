// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// The real router, but auth is short-circuited so we can exercise the upload
// contract (extension filter, magic-byte validation, returned URL) directly.
vi.mock('../backend/api/middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'u1', tenantId: 't1', role: 'admin' };
    next();
  },
}));

import mediaRoutes from '../backend/api/media.routes';

let server: Server;
let base = '';
const created: string[] = [];

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
const imagesDir = path.resolve(process.cwd(), 'uploads', 'images');

beforeAll(async () => {
  const app = express();
  app.use('/api/media', mediaRoutes);
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', () => resolve()); });
  const addr = server.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  for (const f of created) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('POST /api/media/image (device upload)', () => {
  it('accepts a valid PNG and persists it under /uploads/images', async () => {
    const fd = new FormData();
    fd.append('image', new Blob([PNG], { type: 'image/png' }), 'photo.png');
    const res = await fetch(`${base}/api/media/image`, { method: 'POST', body: fd });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.url).toMatch(/^\/uploads\/images\/.+\.png$/);

    const onDisk = path.join(imagesDir, json.data.url.split('/').pop());
    created.push(onDisk);
    expect(fs.existsSync(onDisk)).toBe(true);
  });

  it('rejects a non-image extension', async () => {
    const fd = new FormData();
    fd.append('image', new Blob([Buffer.from('hello')], { type: 'text/plain' }), 'note.txt');
    const res = await fetch(`${base}/api/media/image`, { method: 'POST', body: fd });
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
  });

  it('rejects a file whose content does not match an image', async () => {
    const fd = new FormData();
    fd.append('image', new Blob([Buffer.from('<html>not an image</html>')], { type: 'image/png' }), 'fake.png');
    const res = await fetch(`${base}/api/media/image`, { method: 'POST', body: fd });
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
  });

  it('rejects a request with no file', async () => {
    const fd = new FormData();
    const res = await fetch(`${base}/api/media/image`, { method: 'POST', body: fd });
    expect(res.status).toBe(400);
  });
});
