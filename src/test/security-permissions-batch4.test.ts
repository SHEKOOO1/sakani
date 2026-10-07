import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { userCache, tenantCache, permissionCache } from '../backend/infrastructure/cache';

// ═══════════════════════════════════════════════════════════════
// SECURITY_FIX_BATCH4 — صلاحيات الكتابة (permission write paths)
//   Part 9+10: توصيف + مسارات هجوم + E2E.
//
// التغطية:
//   1. المحلِّل الصارم (parseStoredPermissionsArray / validatePermissionsInput) — وحدة.
//   2. GRANTOR-SUBSET (canGrantSubset / getEffectivePermissionCodes) — وحدة.
//   3. مسارات الهجوم عبر HTTP حقيقي (real routers + real middleware)
//      مع kdb مُقلَّد: PUT /:id/permissions و custom-roles و admin/roles.
//
// ملاحظة: هنا db/knex مُقلَّدان فقط (لا يلزم سيرفر/قاعدة حية)؛ مسار القراءة
//    الحقيقي (checkUserPermission) مُختبر في security-permissions-read.test.ts.
// ═══════════════════════════════════════════════════════════════

type Op = { m: string; a: any[] };

function matchesWhere(row: any, args: any[]): boolean {
  if (args.length >= 2 && typeof args[1] === 'string' && ['like', '=', '>', '<', '>=', '<='].includes(args[1])) {
    const col = String(args[0]);
    const val = args[2];
    const actual = getKey(row, col);
    if (args[1] === 'like') {
      const needle = String(val).replace(/^%|%$/g, '');
      return typeof actual === 'string' && actual.includes(needle);
    }
    return actual === val;
  }
  if (typeof args[0] === 'object' && args[0] !== null) {
    return Object.entries(args[0]).every(([col, val]) => getKey(row, col) === val);
  }
  const col = String(args[0]);
  const val = args[1];
  if (typeof val === 'string' && val.includes('%')) {
    const needle = val.replace(/^%|%$/g, '');
    const actual = getKey(row, col);
    return typeof actual === 'string' && actual.includes(needle);
  }
  return getKey(row, col) === val;
}

function getKey(row: any, col: string): any {
  if (row == null || typeof row !== 'object') return undefined;
  if (col in row) return row[col];
  const last = col.split('.').pop();
  if (last && last in row) return row[last];
  return undefined;
}

function applyOps(base: any[], ops: Op[], store: Record<string, any[]>, table: string): any {
  let out = base;
  for (const { m, a } of ops) {
    if (m === 'first') {
      if (Array.isArray(out)) out = out.length ? { ...out[0] } : out[0] as any;
      continue;
    }
    if (!Array.isArray(out)) continue;
    if (m === 'where') out = out.filter((r: any) => matchesWhere(r, a));
    if (m === 'whereIn') {
      const col = String(a[0]);
      const values = a[1];
      out = out.filter((r: any) => values.includes(getKey(r, col)));
    }
    if (m === 'whereNotNull') out = out.filter((r: any) => getKey(r, colOf(a[0])) != null);
    if (m === 'count') out = [{ count: out.length }];
    if (m === 'del') {
      store[table] = (store[table] ?? []).filter((r: any) => !out.includes(r));
      out = [];
    }
    if (m === 'insert') {
      const rows = Array.isArray(a[0]) ? a[0] : [a[0]];
      store[table] = store[table] ?? [];
      store[table].push(...rows);
      out = [];
    }
    if (m === 'update' && typeof a[0] === 'object' && a[0] !== null) {
      for (const r of out) Object.assign(r, a[0]);
      out = [];
    }
  }
  return out;
}

function colOf(v: any): string {
  return typeof v === 'string' ? v : String(v);
}

function createKdbMock() {
  const rowsStore: Record<string, any[]> = {};
  const makeBuilder = (table: string): any => {
    const rec: { table: string; ops: Op[] } = { table, ops: [] };
    const target: any = { __rec: rec };
    let proxy: any;
    proxy = new Proxy(target, {
      get(_t, prop) {
        if (prop === 'then') {
          return (onF: any, onR: any) => {
            const value = applyOps(rowsStore[rec.table] ?? [], rec.ops, rowsStore, rec.table);
            return Promise.resolve(value).then(onF, onR);
          };
        }
        return (...args: any[]) => {
          rec.ops.push({ m: String(prop), a: args });
          return proxy;
        };
      },
    });
    return proxy;
  };

  const kdb: any = vi.fn((table: string) => makeBuilder(table));
  kdb.transaction = (fn: (trx: any) => Promise<any>) => fn((table: string) => makeBuilder(table));

  return {
    kdb,
    setRows(table: string, rows: any[]) {
      rowsStore[table] = rows;
    },
    readRows(table: string): any[] {
      return rowsStore[table] ?? [];
    },
    reset() {
      for (const k of Object.keys(rowsStore)) rowsStore[k] = [];
    },
  };
}

const dbMock = createKdbMock();

vi.mock('../backend/infrastructure/db', () => ({
  kdb: dbMock.kdb,
  logAuditEvent: vi.fn(),
  hasPermission: vi.fn(async () => true),
  checkUserPermission: vi.fn(async () => true),
}));
vi.mock('../backend/infrastructure/knex', () => ({
  kdb: dbMock.kdb,
  poolPromise: Promise.resolve(null),
  getDBClient: () => 'mssql',
  dateFormatColumn: (col: string) => col,
}));

type ParserModule = typeof import('../backend/infrastructure/permission-parser');
type GrantsModule = typeof import('../backend/infrastructure/permission-grants');

let parser: ParserModule;
let grants: GrantsModule;

let server: Server;
let baseUrl: string;

// ───────────────────────────────────────────────────────────────
// ثوابت مسارات الهجوم (مُنقولة من التقرير)
// ───────────────────────────────────────────────────────────────

// صلاحية فائقة لا يجوز لأي مشرف/كاهن/أسقف منحها (ليست ضمن role_permissions الخاص بهم)
const FAKE_SUPER_PERM = 'MANAGE_BISHOPS';
const SAFE_PERM = 'VIEW_STUDENT';

function signToken(user: { id: string; role: string; tenantId: string | null; email: string }, tokenVersion = 0): string {
  return jwt.sign(
    {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      gender: 'male',
      daily_readings_enabled: true,
      radio_514_enabled: true,
      tokenVersion,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h' }
  );
}

async function request(
  path: string,
  opts: { method?: string; token?: string; body?: any; headers?: Record<string, string> } = {}
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function seedActor(user: { id: string; role: string; tenantId: string | null; email: string }) {
  dbMock.setRows('users', [
    { id: user.id, role: user.role, tenant_id: user.tenantId, email: user.email, custom_permissions: null, custom_role_id: null },
  ]);
  dbMock.setRows('tenants', user.tenantId ? [{ id: user.tenantId, name: 'res' }] : []);
  dbMock.setRows('user_tenant_assignments', []);
}

// صلاحيات الأدوار الافتراضية (نسخة مبسطة من seedPermissions) —
// تُستخدم لحساب GRANTOR-SUBSET في getEffectivePermissionCodes.
function seedRolePermissions(role: string, perms: string[]) {
  dbMock.setRows('role_permissions', perms.map((p) => ({ role, permission: p })));
}

beforeAll(async () => {
  parser = await import('../backend/infrastructure/permission-parser');
  grants = await import('../backend/infrastructure/permission-grants');

  const app = express();
  app.use(express.json());

  const { default: userRouter } = await import('../backend/api/user.routes');
  const { default: adminRouter } = await import('../backend/api/admin_management.routes');

  app.use('/api/users', userRouter);
  app.use('/api/admin', adminRouter);

  server = app.listen(0);
  await new Promise<void>((resolve) => {
    server.once('listening', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
}, 60000);

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

beforeEach(() => {
  dbMock.reset();
  userCache.clear();
  tenantCache.clear();
  permissionCache.clear();
});

// ═══════════════════════════════════════════════════════════════
// Part 9.1 — parseStoredPermissionsArray (FAIL-CLOSED على القراءة)
// ═══════════════════════════════════════════════════════════════

describe('PR-1: parseStoredPermissionsArray — قيمة مخزّنة غير مصفوفة لا تُمنح أبدًا', () => {
  it('1. السلسلة المفردة "ALL" (مسار الهجوم القديم) ⇐ [] — لا تُمنح أي صلاحية', () => {
    const r = parser.parseStoredPermissionsArray('ALL');
    expect(r.perms).toEqual([]);
    expect(r.wasArray).toBe(false);
  });

  it('2. السلسلة "[\"ALL\"]" لا تُمنح (نص وليس مصفوفة فعلية)', () => {
    // تُحاكي قيمة DB خبيثة مكتوبة كنص JSON لسلسلة مُفردة
    const r = parser.parseStoredPermissionsArray('"ALL"');
    expect(r.perms).toEqual([]);
    expect(r.wasArray).toBe(false);
  });

  it('3. كائن/رقم/null/undefined ⇐ [] (فشل آمن)', () => {
    expect(parser.parseStoredPermissionsArray({}).perms).toEqual([]);
    expect(parser.parseStoredPermissionsArray(42).perms).toEqual([]);
    expect(parser.parseStoredPermissionsArray(null).perms).toEqual([]);
    expect(parser.parseStoredPermissionsArray(undefined).perms).toEqual([]);
  });

  it('4. مصفوفة: القيم الصالحة فقط تُبقى؛ غير المعروفة/غير النصية/ALL تُسقط؛ تُكرَّر تُدمج', () => {
    const r = parser.parseStoredPermissionsArray([
      'VIEW_STUDENT',
      'MANAGE_BISHOPS',
      'ALL',
      FAKE_SUPER_PERM,
      123,
      '  view_student  ',
      'fake_perm_x',
    ]);
    expect(r.perms).toEqual(['VIEW_STUDENT', 'MANAGE_BISHOPS']);
    expect(r.wasArray).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Part 9.2 — validatePermissionsInput (FAIL-CLOSED على الكتابة)
// ═══════════════════════════════════════════════════════════════

describe('PR-2: validatePermissionsInput — مدخلات كتابة الصلاحيات', () => {
  it('5. غير مصفوفة (سلسلة "ALL" / كائن / رقم / null) ⇐ 400', () => {
    for (const bad of ['ALL', '"ALL"', { x: 1 }, 7, null]) {
      const r = parser.validatePermissionsInput(bad, 'supervisor');
      expect(r.ok).toBe(false);
      expect(r.status).toBe(400);
    }
  });

  it('6. "ALL" لغير Admin ⇐ 403 (تصعيد عبر ALL)', () => {
    const r = parser.validatePermissionsInput(['ALL'], 'supervisor');
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
  });

  it('7. صلاحية غير معروفة فعليًا ⇐ 400 (وليست قيمة مخترَعة تُتقبل)', () => {
    const r = parser.validatePermissionsInput(['NOT_A_REAL_PERM'], 'bishop');
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it('7b. MANAGE_BISHOPS صلاحية معروفة لكنها فائقة: المحلل يقبلها، والرفض (403) يقع في GRANTOR-SUBSET لغير المدير', () => {
    // MANAGE_BISHOPS ضِمن VALID_PERMISSIONS (صلاحية حقيقية) — الفحص الشكلي
    // لا يرفضها؛ الحماية من منحها لغير المدير تقع في canGrantSubset
    // (اختبارات 21/28/31/33) وليس هنا.
    const r = parser.validatePermissionsInput([FAKE_SUPER_PERM], 'bishop');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.permissions).toEqual([FAKE_SUPER_PERM]);
      const g = grants.canGrantSubset(r.permissions!, ['VIEW_STUDENT'], false, false);
      expect(g.ok).toBe(false);
      if (!g.ok) expect(g.status).toBe(403);
    }
  });

  it('8. Admin + ["ALL", "VIEW_STUDENT"] ⇐ ok، وALL تُستبعد من القائمة المخزّنة', () => {
    const r = parser.validatePermissionsInput(['ALL', 'view_student'], 'admin');
    expect(r.ok).toBe(true);
    expect(r.permissions).toEqual(['VIEW_STUDENT']);
  });

  it('9. عناصر غير نصية داخل مصفوفة ⇐ 400', () => {
    const r = parser.validatePermissionsInput([123, 'VIEW_STUDENT'], 'admin');
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════
// Part 9.3 — canGrantSubset (GRANTOR-SUBSET، طبقة قرار منح
//           لا تُصعد إلا ضمن الصلاحيات الفعلية للدور المنفِّذ)
// ═══════════════════════════════════════════════════════════════

describe('PR-3: canGrantSubset — قاعدة المنح ضمن صلاحيات المنفِّذ', () => {
  const grantor = { codes: ['VIEW_STUDENT', 'MANAGE_USERS'], hasAll: false, isAppAdmin: false };

  it('10. منح صلاحية لا يملكها المنفِّذ ⇐ 403', () => {
    const r = grants.canGrantSubset([FAKE_SUPER_PERM], grantor.codes, grantor.hasAll, grantor.isAppAdmin);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it('11. "ALL" مع منفِّذ غير Admin ⇐ 403 حتى لو يملك كل البقية', () => {
    const r = grants.canGrantSubset(['ALL'], grantor.codes, grantor.hasAll, grantor.isAppAdmin);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it('12. مصفوفة ضمن الصلاحيات الفعلية للمنفِّذ ⇐ ok', () => {
    const r = grants.canGrantSubset(['VIEW_STUDENT', 'MANAGE_USERS'], grantor.codes, grantor.hasAll, grantor.isAppAdmin);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.permissions).toEqual(['VIEW_STUDENT', 'MANAGE_USERS']);
  });

  it('13. Admin (hasAll=true) يستطيع منح أية صلاحية صالحة؛ غير المعروفة ⇐ 400', () => {
    const r1 = grants.canGrantSubset([FAKE_SUPER_PERM], [], true, true);
    expect(r1.ok).toBe(true);
    const r2 = grants.canGrantSubset(['NOT_A_REAL_PERM'], [], true, true);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.status).toBe(400);
  });

  it('14. غير مصفوفة ⇐ 400 (فشل آمن)', () => {
    const r = grants.canGrantSubset('ALL' as any, grantor.codes, grantor.hasAll, grantor.isAppAdmin);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════
// Part 9.4 — getEffectivePermissionCodes (دَمج فعلي للمنفِّذ)
// ═══════════════════════════════════════════════════════════════

describe('PR-4: getEffectivePermissionCodes — الصلاحيات الفعلية للمنفِّذ', () => {
  it('15. دمج المصادر الثلاثة: custom_permissions + custom_role + role_permissions (قيم نصية)', async () => {
    dbMock.setRows('users', [{
      id: 'supA', role: 'supervisor', tenant_id: 'A', custom_role_id: 'cr1',
      custom_permissions: JSON.stringify(['VIEW_STUDENT', 'MANAGE_BISHOPS']),
    }]);
    dbMock.setRows('tenant_custom_roles', [{ id: 'cr1', tenant_id: 'A', permissions: JSON.stringify(['ADD_STUDENT', 'ALL']) }]);
    seedRolePermissions('supervisor', ['VIEW_STUDENT', 'MANAGE_USERS']);

    const eff = await grants.getEffectivePermissionCodes('supA');
    expect(eff.codes.sort()).toEqual(['ADD_STUDENT', 'MANAGE_BISHOPS', 'MANAGE_USERS', 'VIEW_STUDENT']);
    // «ALL» المخزّنة في الدور لا تُكرم: hasAll=false
    expect(eff.hasAll).toBe(false);
    expect(eff.isAppAdmin).toBe(false);
  });

  it('16. مستخدم غير موجود ⇐ FAIL-CLOSED (لا شيء، لا ALL)', async () => {
    dbMock.setRows('users', []);
    const eff = await grants.getEffectivePermissionCodes('ghost');
    expect(eff.codes).toEqual([]);
    expect(eff.hasAll).toBe(false);
    expect(eff.isAppAdmin).toBe(false);
  });

  it('17. Admin ⇐ hasAll=true، isAppAdmin=true، codes = كل الصلاحيات بلا ALL', async () => {
    dbMock.setRows('users', [{ id: 'adm', role: 'admin', tenant_id: null }]);
    const eff = await grants.getEffectivePermissionCodes('adm');
    expect(eff.hasAll).toBe(true);
    expect(eff.isAppAdmin).toBe(true);
    expect(eff.codes).toContain('VIEW_STUDENT');
    expect(eff.codes).toContain(FAKE_SUPER_PERM);
    expect(eff.codes).not.toContain('ALL');
  });

  it('18. قيم مخزّنة تالفة (نصوص/كائنات) لا تُمنح شيئًا', async () => {
    dbMock.setRows('users', [{
      id: 'uBad', role: 'employee', tenant_id: 'A',
      custom_permissions: 'ALL', // سلسلة مفردة (خبيثة)
      custom_role_id: null,
    }]);
    dbMock.setRows('role_permissions', []);
    const eff = await grants.getEffectivePermissionCodes('uBad');
    expect(eff.codes).toEqual([]);
    expect(eff.hasAll).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Part 10 — E2E attack paths عبر HTTP حقيقي
// ═══════════════════════════════════════════════════════════════

describe('SECURITY-FIX-BATCH4: PUT /api/users/:id/permissions (attack paths)', () => {
  const SUP = { id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' };
  const TGT = { id: 'tgt', role: 'employee', tenantId: 'A', email: 't@test.com' };

function seedSupWith(scopePerms: string[]) {
  seedActor(SUP);
  // تنبيه: seedActor يستبدل جدول users بالكامل — يجب بذر الهدف في نفس الدفعة
  dbMock.setRows('users', [
    { id: SUP.id, role: SUP.role, tenant_id: SUP.tenantId, email: SUP.email, custom_permissions: null, custom_role_id: null },
    { id: TGT.id, role: TGT.role, tenant_id: TGT.tenantId, email: TGT.email, custom_permissions: null, custom_role_id: null },
  ]);
  seedRolePermissions('supervisor', scopePerms);
}

  it('19. يُرفض 400: إرسال custom_permissions كسلسلة نصية "ALL" (مسار التصعيد القديم)', async () => {
    seedSupWith(['MANAGE_USERS', 'VIEW_STUDENT']);
    const res = await request('/api/users/tgt/permissions', {
      method: 'PUT',
      token: signToken(SUP),
      body: { permissions: 'ALL' },
    });
    expect(res.status).toBe(400);
    const row = dbMock.readRows('users').find((u) => u.id === 'tgt');
    expect(row.custom_permissions ?? null).toBeNull();
  });

  it('20. يُرفض 403: صفيف ["ALL"] من مشرف (ALL لغير Admin)', async () => {
    seedSupWith(['MANAGE_USERS', 'VIEW_STUDENT']);
    const res = await request('/api/users/tgt/permissions', {
      method: 'PUT',
      token: signToken(SUP),
      body: { permissions: ['ALL'] },
    });
    expect(res.status).toBe(403);
  });

  it('21. يُرفض 403: مشرف يحاول منح MANAGE_BISHOPS (خارج GRANTOR-SUBSET)', async () => {
    seedSupWith(['MANAGE_USERS', 'VIEW_STUDENT']); // المشرف لا يملك MANAGE_BISHOPS
    const res = await request('/api/users/tgt/permissions', {
      method: 'PUT',
      token: signToken(SUP),
      body: { permissions: [FAKE_SUPER_PERM] },
    });
    expect(res.status).toBe(403);
    const row = dbMock.readRows('users').find((u) => u.id === 'tgt');
    expect(row.custom_permissions ?? null).toBeNull();
  });

  it('22. نجاح 200: مشرف يمنح صلاحية يملكها، وتُخزَّن كمصفوفة نظيفة + يُمسح الكاش', async () => {
    seedSupWith(['MANAGE_USERS', 'VIEW_STUDENT']);
    permissionCache.set(`perm:tgt:VIEW_STUDENT`, true);
    userCache.set('user:tgt', { id: 'tgt', role: 'employee' });

    const res = await request('/api/users/tgt/permissions', {
      method: 'PUT',
      token: signToken(SUP),
      body: { permissions: ['view_student'] },
    });
    expect(res.status).toBe(200);
    const row = dbMock.readRows('users').find((u) => u.id === 'tgt');
    expect(row.custom_permissions).toBe(JSON.stringify(['VIEW_STUDENT']));
    // مسح الكاش (invalidation) بعد الكتابة
    expect(permissionCache.get('perm:tgt:VIEW_STUDENT')).toBeUndefined();
    expect(userCache.get('user:tgt')).toBeUndefined();
  });

  it('23. يُرفض 403: تعديل صلاحيات النفس (self-block)', async () => {
    seedSupWith(['MANAGE_USERS', 'VIEW_STUDENT']);
    const res = await request('/api/users/supA/permissions', {
      method: 'PUT',
      token: signToken(SUP),
      body: { permissions: ['VIEW_STUDENT'] },
    });
    expect(res.status).toBe(403);
  });

  it('24. يُرفض 403: ربط دور مخصص يمنح صلاحيات خارج صلاحيات المنفِّذ', async () => {
    seedSupWith(['MANAGE_USERS', 'VIEW_STUDENT']);
    dbMock.setRows('tenant_custom_roles', [
      { id: 'crEvil', tenant_id: 'A', permissions: JSON.stringify([FAKE_SUPER_PERM]), created_by: 'someone' },
    ]);
    const res = await request('/api/users/tgt/permissions', {
      method: 'PUT',
      token: signToken(SUP),
      body: { customRoleId: 'crEvil' },
    });
    expect(res.status).toBe(403);
    const row = dbMock.readRows('users').find((u) => u.id === 'tgt');
    expect(row.custom_role_id ?? null).toBeNull();
  });

  it('25. يُرفض 400: لا بيانات (لا permissions ولا customRoleId)', async () => {
    seedSupWith(['MANAGE_USERS', 'VIEW_STUDENT']);
    const res = await request('/api/users/tgt/permissions', {
      method: 'PUT',
      token: signToken(SUP),
      body: {},
    });
    expect(res.status).toBe(400);
  });

  it('26. مدير التطبيق يستطيع منح الصلاحية الفائقة (200) — لا رقابة على الإدارة العليا', async () => {
    seedActor({ id: 'adm', role: 'admin', tenantId: null, email: 'adm@test.com' });
    // المدير والهدف معًا في جدول users (seedActor يستبدل الجدول بالكامل)
    dbMock.setRows('users', [
      { id: 'adm', role: 'admin', tenant_id: null, email: 'adm@test.com', custom_permissions: null, custom_role_id: null },
      { id: TGT.id, role: TGT.role, tenant_id: TGT.tenantId, email: TGT.email, custom_permissions: null, custom_role_id: null },
    ]);
    const res = await request('/api/users/tgt/permissions', {
      method: 'PUT',
      token: signToken({ id: 'adm', role: 'admin', tenantId: null, email: 'adm@test.com' }),
      body: { permissions: [FAKE_SUPER_PERM] },
    });
    expect(res.status).toBe(200);
    const row = dbMock.readRows('users').find((u) => u.id === 'tgt');
    expect(row.custom_permissions).toBe(JSON.stringify([FAKE_SUPER_PERM]));
  });
});

describe('SECURITY-FIX-BATCH4: POST /api/users/custom-roles (attack paths)', () => {
  const SUP = { id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' };

  it('27. يُرفض 400: إنشاء دور بقيمة صلاحيات غير مصفوفة', async () => {
    seedActor(SUP);
    seedRolePermissions('supervisor', ['MANAGE_USERS', 'VIEW_STUDENT']);
    const res = await request('/api/users/custom-roles', {
      method: 'POST',
      token: signToken(SUP),
      body: { name: 'R', permissions: 'ALL' },
    });
    expect(res.status).toBe(400);
  });

  it('28. يُرفض 403: إنشاء دور بصلاحيات خارجة عن صلاحيات المشرف', async () => {
    seedActor(SUP);
    seedRolePermissions('supervisor', ['MANAGE_USERS', 'VIEW_STUDENT']);
    const res = await request('/api/users/custom-roles', {
      method: 'POST',
      token: signToken(SUP),
      body: { name: 'R', permissions: [FAKE_SUPER_PERM] },
    });
    expect(res.status).toBe(403);
    expect(dbMock.readRows('tenant_custom_roles').length).toBe(0);
  });

  it('29. يُرفض 403: دور منشأ بـ ["ALL"] من مشرف', async () => {
    seedActor(SUP);
    seedRolePermissions('supervisor', ['MANAGE_USERS', 'VIEW_STUDENT']);
    const res = await request('/api/users/custom-roles', {
      method: 'POST',
      token: signToken(SUP),
      body: { name: 'R', permissions: ['ALL'] },
    });
    expect(res.status).toBe(403);
  });

  it('30. نجاح 200: دور بصلاحيات يملكها المشرف يُنشأ ويُخزَّن بنظيف', async () => {
    seedActor(SUP);
    seedRolePermissions('supervisor', ['MANAGE_USERS', 'VIEW_STUDENT']);
    const res = await request('/api/users/custom-roles', {
      method: 'POST',
      token: signToken(SUP),
      body: { name: 'Staff', permissions: ['VIEW_STUDENT', 'view_student'] },
    });
    expect(res.status).toBe(200);
    const roles = dbMock.readRows('tenant_custom_roles');
    expect(roles.length).toBe(1);
    expect(roles[0].permissions).toBe(JSON.stringify(['VIEW_STUDENT']));
  });
});

describe('SECURITY-FIX-BATCH4: /api/admin/roles (attack paths — priest مع MANAGE_SETTINGS)', () => {
  const PRIEST = { id: 'priestA', role: 'priest', tenantId: 'A', email: 'priest@test.com' };
  const SUP = { id: 'supA', role: 'supervisor', tenantId: 'A', email: 'sup@test.com' };

  it('31. يُرفض 403: كاهن (يملك MANAGE_SETTINGS) يحاول إنشاء دور بصلاحية فائقة لا يملكها', async () => {
    seedActor(PRIEST);
    seedRolePermissions('priest', ['MANAGE_SETTINGS', 'VIEW_STUDENT']);
    const res = await request('/api/admin/roles', {
      method: 'POST',
      token: signToken(PRIEST),
      body: { name: 'Evil', permissions: [FAKE_SUPER_PERM], tenant_id: 'A' },
    });
    expect(res.status).toBe(403);
    expect(dbMock.readRows('tenant_custom_roles').length).toBe(0);
  });

  it('32. نجاح 201: نفس الكاهن ينشئ دورًا بصلاحياته فقط', async () => {
    seedActor(PRIEST);
    seedRolePermissions('priest', ['MANAGE_SETTINGS', 'VIEW_STUDENT']);
    const res = await request('/api/admin/roles', {
      method: 'POST',
      token: signToken(PRIEST),
      body: { name: 'SettingsViewer', permissions: ['VIEW_STUDENT'], tenant_id: 'A' },
    });
    expect(res.status).toBe(201);
    expect(dbMock.readRows('tenant_custom_roles').length).toBe(1);
  });

  it('33. يُرفض 403: مشرف يعدّل دورًا (لم ينشئه) أو يوسّعه إلى صلاحياتٍ لا يملكها', async () => {
    seedActor(SUP);
    seedRolePermissions('supervisor', ['MANAGE_USERS', 'VIEW_STUDENT']);
    dbMock.setRows('tenant_custom_roles', [
      { id: 'crS', tenant_id: 'A', permissions: JSON.stringify(['VIEW_STUDENT']), created_by: 'someone_else' },
    ]);
    const res = await request('/api/admin/roles/crS', {
      method: 'PUT',
      token: signToken(SUP),
      body: { name: 'Hijack', permissions: [FAKE_SUPER_PERM] },
    });
    expect(res.status).toBe(403);
    const role = dbMock.readRows('tenant_custom_roles').find((r) => r.id === 'crS');
    expect(role.permissions).toBe(JSON.stringify(['VIEW_STUDENT'])); // دون تعديل
  });

  it('34. نجاح 200: تعديل دور بصلاحياتٍ ضمن نطاق المشرف (دورٌ من إنشائه)', async () => {
    seedActor(SUP);
    seedRolePermissions('supervisor', ['MANAGE_USERS', 'VIEW_STUDENT']);
    dbMock.setRows('tenant_custom_roles', [
      { id: 'crS', tenant_id: 'A', permissions: JSON.stringify(['VIEW_STUDENT']), created_by: 'supA' },
    ]);
    const res = await request('/api/admin/roles/crS', {
      method: 'PUT',
      token: signToken(SUP),
      body: { name: 'Staff2', permissions: ['MANAGE_USERS'] },
    });
    expect(res.status).toBe(200);
    const role = dbMock.readRows('tenant_custom_roles').find((r) => r.id === 'crS');
    expect(role.permissions).toBe(JSON.stringify(['MANAGE_USERS']));
  });
});