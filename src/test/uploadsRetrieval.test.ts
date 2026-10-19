// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// Auth is short-circuited (admin) and the DB is stubbed so we can exercise the
// full upload -> persist -> retrieve contract without a live database.
const h = vi.hoisted(() => {
  const state: { docRow: any } = { docRow: undefined };
  const chain: any = {};
  chain.select = () => chain;
  chain.where = () => chain;
  chain.join = () => chain;
  chain.first = async () => state.docRow;
  return { state, kdb: () => chain };
});

vi.mock('../backend/api/middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'u1', tenantId: 't1', role: 'admin' };
    next();
  },
  computeUserTenantIds: async () => ['t1'],
}));

vi.mock('../backend/infrastructure/db', () => ({ kdb: h.kdb }));

import mediaRoutes from '../backend/api/media.routes';
import uploadsRoutes from '../backend/api/uploads.routes';

let server: Server;
let base = '';
const created: string[] = [];

// Minimal, valid PNG header (16 bytes) — passes the magic-byte check.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
const imagesDir = path.resolve(process.cwd(), 'uploads', 'images');
const docsDir = path.resolve(process.cwd(), 'uploads', 'documents');

beforeAll(async () => {
  fs.mkdirSync(imagesDir, { recursive: true });
  fs.mkdirSync(docsDir, { recursive: true });
  const app = express();
  app.use('/api/media', mediaRoutes);
  app.use('/uploads', uploadsRoutes);
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', () => resolve()); });
  const addr = server.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
});

beforeEach(() => {
  h.state.docRow = undefined;
});

afterAll(async () => {
  for (const f of created) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('upload -> retrieve round trip', () => {
  it('serves back the exact bytes that were uploaded', async () => {
    const fd = new FormData();
    fd.append('image', new Blob([PNG], { type: 'image/png' }), 'photo.png');
    const up = await fetch(`${base}/api/media/image`, { method: 'POST', body: fd });
    expect(up.status).toBe(200);
    const { data } = await up.json();
    expect(data.url).toMatch(/^\/uploads\/images\/.+\.png$/);

    const onDisk = path.join(imagesDir, data.url.split('/').pop());
    created.push(onDisk);
    expect(fs.existsSync(onDisk)).toBe(true);

    const got = await fetch(`${base}${data.url}`);
    expect(got.status).toBe(200);
    expect(got.headers.get('content-type')).toContain('image/png');
    const buf = Buffer.from(await got.arrayBuffer());
    expect(buf.equals(PNG)).toBe(true);
  });
});

describe('GET /uploads (retrieval)', () => {
  it('serves a StudentDocuments file for an authorized user', async () => {
    const name = `test-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    const full = path.join(docsDir, name);
    fs.writeFileSync(full, PNG);
    created.push(full);
    h.state.docRow = { student_id: 's1', file_path: `/uploads/documents/${name}`, doc_type: 'other' };

    const got = await fetch(`${base}/uploads/documents/${name}`);
    expect(got.status).toBe(200);
    expect(Buffer.from(await got.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it('returns 404 when the referenced file is missing', async () => {
    h.state.docRow = { student_id: 's1', file_path: '/uploads/documents/ghost.png', doc_type: 'other' };
    const got = await fetch(`${base}/uploads/documents/ghost.png`);
    expect(got.status).toBe(404);
  });

  it('rejects path traversal attempts', async () => {
    const got = await fetch(`${base}/uploads/documents/..%2f..%2fserver.ts`);
    expect([400, 403, 404]).toContain(got.status);
  });
});
