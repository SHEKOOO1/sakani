import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// ───────────────────────────────────────────────────────────────
// Self-contained unit tests for the three authorization fixes.
// The `kdb` module and the middleware `computeUserTenantIds` are
// mocked so no live server/database is required (deterministic).
// ───────────────────────────────────────────────────────────────

type Op = { m: string; a: any[] };

function matchesWhere(row: any, args: any[]): boolean {
  // 3-arg form: .where('col', 'like', '%x%') | .where('col', '=', val)
  if (args.length >= 2 && typeof args[1] === 'string' && ['like', '=', '>', '<', '>=', '<='].includes(args[1])) {
    const col = String(args[0]);
    const op = args[1];
    const val = args[2];
    const actual = getKey(row, col);
    if (op === 'like') {
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

function applyOps(val: any, ops: Op[]): any {
  let out = val;
  for (const { m, a } of ops) {
    if (m === 'first') {
      out = Array.isArray(out) ? out[0] : out;
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
  }
  return out;
}
function colOf(v: any): string {
  return typeof v === 'string' ? v : String(v);
}

function createKdbMock() {
  const rowsStore: Record<string, any[]> = {};
  const calls: { table: string; ops?: Op[] }[] = [];

  const kdb = vi.fn((table: string) => {
    const rec: { table: string; ops: Op[] } = { table, ops: [] };
    calls.push(rec);
    const target: any = { __rec: rec };
    let proxy: any;
    proxy = new Proxy(target, {
      get(t, prop) {
        if (prop === 'then') {
          return (onF: any, onR: any) => {
            const base = rowsStore[rec.table] ?? [];
            const value = applyOps(base, rec.ops);
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
  });

  return {
    kdb,
    calls,
    setRows(table: string, rows: any[]) {
      rowsStore[table] = rows;
    },
    reset() {
      for (const k of Object.keys(rowsStore)) rowsStore[k] = [];
      calls.length = 0;
    },
  };
}

const dbMock = createKdbMock();
const computeUserTenantIds = vi.fn(async (user: any) => {
  if (user.role === 'bishop') return ['tenantA', 'tenantB'];
  return user.tenantId ? [user.tenantId] : [];
});

vi.mock('../backend/infrastructure/db', () => ({ kdb: dbMock.kdb }));
vi.mock('../backend/api/middleware', () => ({
  authenticate: vi.fn(),
  authorizePermission: vi.fn(() => (req: any, res: any, next: any) => next()),
  sanitizeInput: vi.fn((req: any, res: any, next: any) => next()),
  computeUserTenantIds,
}));
// extras.routes → StudentController → student.service imports `poolPromise`
// from Infrastructure/knex.ts whose module top-level opens a real mssql pool.
vi.mock('../backend/infrastructure/knex', () => ({
  kdb: dbMock.kdb,
  poolPromise: Promise.resolve(null),
  getDBClient: () => 'mssql',
  dateFormatColumn: (col: string) => col,
}));

type CrudModule = typeof import('../backend/api/students/crud.routes');
type UploadsModule = typeof import('../backend/api/uploads.routes');
type BroadcastModule = typeof import('../backend/api/broadcast.service');
type ExtrasModule = typeof import('../backend/api/students/extras.routes');
type UserRoutesModule = typeof import('../backend/api/user.routes');
type BadgesModule = typeof import('../backend/api/badges.routes');

let crud: CrudModule;
let uploads: UploadsModule;
let broadcast: BroadcastModule;
let extras: ExtrasModule;
let userRoutes: UserRoutesModule;
let badges: BadgesModule;

beforeAll(async () => {
  crud = await import('../backend/api/students/crud.routes');
  uploads = await import('../backend/api/uploads.routes');
  broadcast = await import('../backend/api/broadcast.service');
  extras = await import('../backend/api/students/extras.routes');
  userRoutes = await import('../backend/api/user.routes');
  badges = await import('../backend/api/badges.routes');
}, 60000);

beforeEach(() => {
  dbMock.reset();
  computeUserTenantIds.mockClear();
});

// ═══════════════════════════════════════════════════════════════
// H-1 — canManageStudent (used by POST /students/:id/files
//        and the sibling files endpoints)
// ═══════════════════════════════════════════════════════════════

describe('H-1: canManageStudent (student file upload authorization)', () => {
  it('1. supervisor of residence A cannot manage a student of residence B', async () => {
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await crud.canManageStudent({ id: 'u1', role: 'supervisor', tenantId: 'A' }, 'B')).toBe(false);
  });

  it('2. supervisor of residence A can manage a student of residence A', async () => {
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await crud.canManageStudent({ id: 'u1', role: 'supervisor', tenantId: 'A' }, 'A')).toBe(true);
  });

  it('3. multi-tenancy: bishop can manage a student in any tenant he oversees', async () => {
    computeUserTenantIds.mockResolvedValue(['A', 'B']);
    expect(await crud.canManageStudent({ id: 'u2', role: 'bishop', tenantId: 'A' }, 'B')).toBe(true);
  });

  it('4. bishop cannot manage students outside his managed residences', async () => {
    computeUserTenantIds.mockResolvedValue(['A', 'B']);
    expect(await crud.canManageStudent({ id: 'u2', role: 'bishop', tenantId: 'A' }, 'C')).toBe(false);
  });

  it('5. scope always comes from computeUserTenantIds — no forged tenantId can widen it', async () => {
    computeUserTenantIds.mockResolvedValue(['A']);
    // canManageStudent has NO client-supplied tenant parameter; scope is derived
    // from the authenticated user only.
    await crud.canManageStudent({ id: 'u1', role: 'supervisor', tenantId: 'A' }, 'A');
    expect(computeUserTenantIds).toHaveBeenCalledWith({ id: 'u1', role: 'supervisor', tenantId: 'A' });
  });

  it('6. null student tenant_id → fail closed (never matches the IS NULL loophole)', async () => {
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await crud.canManageStudent({ id: 'u1', role: 'supervisor', tenantId: 'A' }, null)).toBe(false);
  });

  it('7. legitimate upload still works (admin global + own-tenant staff)', async () => {
    expect(await crud.canManageStudent({ id: 'ua', role: 'admin' }, 'any')).toBe(true);
    computeUserTenantIds.mockResolvedValue(['X']);
    expect(await crud.canManageStudent({ id: 'us', role: 'assistant_supervisor', tenantId: 'X' }, 'X')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// H-2 — orphaned document download authorization
// ═══════════════════════════════════════════════════════════════

describe('H-2: document / orphaned document download authorization', () => {
  it('1. admin can access any student document', async () => {
    dbMock.setRows('students as s', [{ id: 'sA', user_id: 'uX', tenant_id: 'A' }]);
    expect(await uploads.canAccessDocument({ id: 'adm', role: 'admin' }, 'sA')).toBe(true);
  });

  it('2. supervisor of residence A cannot download a doc of a student in residence B', async () => {
    dbMock.setRows('students as s', [{ id: 'sB', user_id: 'uX', tenant_id: 'B' }]);
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await uploads.canAccessDocument({ id: 'u1', role: 'supervisor', tenantId: 'A' }, 'sB')).toBe(false);
  });

  it('3. supervisor of residence A can download a doc of a student in residence A', async () => {
    dbMock.setRows('students as s', [{ id: 'sA', user_id: 'uY', tenant_id: 'A' }]);
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await uploads.canAccessDocument({ id: 'u1', role: 'supervisor', tenantId: 'A' }, 'sA')).toBe(true);
  });

  it('4. event-receipt owner (student) can view their own receipt', async () => {
    const owner = {
      kind: 'event-receipt' as const,
      tenant_id: 'A',
      user_id: 'uStu',
      student_id: 'sA',
    };
    expect(await uploads.canAccessOrphanedDocument({ id: 'uStu', role: 'student' }, owner)).toBe(true);
  });

  it('5. staff of residence A can view receipts of residence A; staff of B cannot', async () => {
    const owner = { kind: 'event-receipt' as const, tenant_id: 'A', user_id: 'uX', student_id: 'sA' };
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await uploads.canAccessOrphanedDocument({ id: 'uA', role: 'supervisor', tenantId: 'A' }, owner)).toBe(true);
    computeUserTenantIds.mockResolvedValue(['B']);
    expect(await uploads.canAccessOrphanedDocument({ id: 'uB', role: 'supervisor', tenantId: 'B' }, owner)).toBe(false);
  });

  it('6. unresolvable orphan document → resolveOrphanedDocument returns null (fail closed)', async () => {
    dbMock.setRows('event_subscriptions as es', []);
    dbMock.setRows('maintenance_requests', []);
    expect(await uploads.resolveOrphanedDocument('mystery-file.png')).toBeNull();
  });

  it('7. maintenance requester sees own photo; a parent linked to the subscribed student sees the receipt', async () => {
    expect(await uploads.canAccessOrphanedDocument(
      { id: 'uReq', role: 'student' },
      { kind: 'maintenance', tenant_id: 'A', requester_id: 'uReq' }
    )).toBe(true);

    dbMock.setRows('student_guardians as sg', [
      { student_id: 'sA', guardian_id: 'g1', user_id: 'uParent' },
    ]);
    // parent linked via student_guardians → true
    computeUserTenantIds.mockResolvedValue([]);
    const linked = await uploads.canAccessOrphanedDocument(
      { id: 'uParent', role: 'parent' },
      { kind: 'event-receipt', tenant_id: 'A', user_id: 'uX', student_id: 'sA' }
    );
    // With a live DB the guardian join returns a row → allowed
    expect(linked).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// H-3 — broadcast target scope (getScoped* / getSenderTenantIds /
//        applySenderTenantScope / passesScopeIsolation)
// ═══════════════════════════════════════════════════════════════

describe('H-3: broadcast scope isolation', () => {
  it('1. assistant_supervisor sees only authorized residences', async () => {
    dbMock.setRows('tenants', [
      { id: 'A', name: 'res A' },
      { id: 'B', name: 'res B' },
    ]);
    const user = { id: 'uAs', role: 'assistant_supervisor', tenantId: 'A', tenantIds: ['A'] };
    const res = await broadcast.getScopedTenants(user);
    expect(res.map((t: any) => t.id)).toEqual(['A']);
    const rec = dbMock.calls.find((c) => c.table === 'tenants');
    const whereIn = (rec as any)?.ops.find((o: Op) => o.m === 'whereIn');
    expect(whereIn.a).toEqual(['id', ['A']]);
  });

  it('2. assistant_supervisor can target only students of authorized residences', async () => {
    dbMock.setRows('students as s', [
      { id: 'sA', tenant_id: 'A', user_id: 'u1', name: 'x' },
      { id: 'sB', tenant_id: 'B', user_id: 'u2', name: 'x' },
      { id: 'sC', tenant_id: 'C', user_id: 'u3', name: 'x' },
    ]);
    const user = { id: 'uAs', role: 'assistant_supervisor', tenantId: 'B', tenantIds: ['B'] };
    const res = await broadcast.getScopedStudents(user, 'x');
    expect(res.map((s: any) => s.id)).toEqual(['sB']);
  });

  it('3. assistant_supervisor sees only authorized priests', async () => {
    dbMock.setRows('users', [
      { id: 'pA', tenant_id: 'A', role: 'priest' },
      { id: 'pB', tenant_id: 'B', role: 'priest' },
    ]);
    const user = { id: 'uAs', role: 'assistant_supervisor', tenantId: 'A', tenantIds: ['A'] };
    const res = await broadcast.getScopedPriests(user);
    expect(res.map((u: any) => u.id)).toEqual(['pA']);
  });

  it('4. assistant_supervisor + supervisor see only authorized supervisors/employees', async () => {
    dbMock.setRows('users', [
      { id: 'supA', tenant_id: 'A', role: 'supervisor' },
      { id: 'supB', tenant_id: 'B', role: 'supervisor' },
      { id: 'empA', tenant_id: 'A', role: 'employee' },
      { id: 'empB', tenant_id: 'B', role: 'employee' },
    ]);
    const user = { id: 'uAs', role: 'assistant_supervisor', tenantId: 'A', tenantIds: ['A'] };
    expect((await broadcast.getScopedSupervisors(user)).map((u: any) => u.id)).toEqual(['supA']);
    expect((await broadcast.getScopedEmployees(user)).map((u: any) => u.id)).toEqual(['empA']);

    const sup = { id: 'uSup', role: 'supervisor', tenantId: 'B', tenantIds: ['B'] };
    expect((await broadcast.getScopedSupervisors(sup)).map((u: any) => u.id)).toEqual(['supB']);
  });

  it('5. multi-tenant supervisor sees all assigned residences', async () => {
    dbMock.setRows('tenants', [
      { id: 'A', name: 'a' },
      { id: 'B', name: 'b' },
      { id: 'C', name: 'c' },
    ]);
    const user = { id: 'uSup', role: 'supervisor', tenantId: 'A', tenantIds: ['A', 'B'] };
    const res = await broadcast.getScopedTenants(user);
    expect(res.map((t: any) => t.id).sort()).toEqual(['A', 'B']);
  });

  it('6. unknown role → empty scope (never all tenants)', async () => {
    dbMock.setRows('students', [
      { college: 'Eng', tenant_id: 'A' },
      { college: 'Med', tenant_id: 'B' },
    ]);
    // A student-owned token must never enumerate all colleges/tenants
    expect(await broadcast.getScopedColleges({ id: 'uStu', role: 'student', tenantId: 'A' }, undefined)).toEqual([]);
    expect(await broadcast.getScopedTenants({ id: 'uStu', role: 'student', tenantId: 'A' })).toEqual([]);
  });

  it('7. staff with NO tenant assignments → empty scope (fail closed)', async () => {
    dbMock.setRows('tenants', [{ id: 'A', name: 'a' }, { id: 'B', name: 'b' }]);
    const user = { id: 'uNone', role: 'assistant_supervisor', tenantId: null, tenantIds: [] };
    expect(await broadcast.getScopedTenants(user)).toEqual([]);
    expect(await broadcast.getScopedColleges(user, undefined)).toEqual([]);
  });

  it('8. admin stays global (no scope filter)', async () => {
    dbMock.setRows('tenants', [{ id: 'A', name: 'a' }, { id: 'B', name: 'b' }]);
    const user = { id: 'uAdm', role: 'admin' };
    const res = await broadcast.getScopedTenants(user);
    expect(res.map((t: any) => t.id).sort()).toEqual(['A', 'B']);
    const rec = dbMock.calls.find((c) => c.table === 'tenants');
    expect((rec as any)?.ops.some((o: Op) => o.m === 'whereIn')).toBe(false);
  });

  it('9. bishop sees only his managed tenants for tenants + sender scope', async () => {
    dbMock.setRows('tenants', [
      { id: 'E1', name: 'e1', bishop_id: 'uB' },
      { id: 'E2', name: 'e2', bishop_id: 'uB' },
      { id: 'O', name: 'other', bishop_id: 'uOther' },
    ]);
    const user = { id: 'uB', role: 'bishop', tenantId: 'E1' };
    const res = await broadcast.getScopedTenants(user);
    expect(res.map((t: any) => t.id).sort()).toEqual(['E1', 'E2']);

    computeUserTenantIds.mockResolvedValue(['E1', 'E2']);
    const ids = await broadcast.getSenderTenantIds(user);
    expect(ids.sort()).toEqual(['E1', 'E2']);
  });

  it('10. non-admin cannot target residences outside scope at send time (applySenderTenantScope)', async () => {
    const user = { id: 'uSup', role: 'supervisor', tenantId: 'A', tenantIds: ['A'] };
    const denied = await broadcast.applySenderTenantScope(user, { tenants: ['B'] });
    expect(denied.ok).toBe(false);

    const scoped = await broadcast.applySenderTenantScope(user, { tenants: ['A'] });
    expect(scoped.ok).toBe(true);
    expect(scoped.targeting.tenants).toEqual(['A']);
  });

  it('11. non-admin with no tenant filter is auto-scoped (fail closed, not global)', async () => {
    const user = { id: 'uAs', role: 'assistant_supervisor', tenantId: 'X', tenantIds: ['X'] };
    const res = await broadcast.applySenderTenantScope(user, { roles: ['student'] });
    expect(res.ok).toBe(true);
    expect(res.targeting.tenants).toEqual(['X']);
  });

  it('12. passesScopeIsolation: assistant_supervisor broadcast is limited to same tenant; unknown sender role fails closed', () => {
    const viewerSame = { id: 'uP', role: 'parent', tenantId: 'A' };
    const viewerOther = { id: 'uQ', role: 'parent', tenantId: 'B' };
    // Same-tenant viewer can see
    expect(broadcast.passesScopeIsolation(viewerSame, 'assistant_supervisor', { tenants: ['A'] }, 'A')).toBe(true);
    // Different-tenant viewer cannot
    expect(broadcast.passesScopeIsolation(viewerOther, 'assistant_supervisor', { tenants: ['A'] }, 'A')).toBe(false);
    // Unknown sender role → fail closed
    expect(broadcast.passesScopeIsolation(viewerSame, 'student', { }, 'A')).toBe(false);
    // Admin broadcast still global
    expect(broadcast.passesScopeIsolation(viewerSame, 'admin', { }, 'A')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// H-4 — canManageEmployee (POST/DELETE /students/:id/employee-permission)
//        Null-tenant employee must NOT be globally manageable.
// ═══════════════════════════════════════════════════════════════

describe('H-4: canManageEmployee (employee permission grant authority)', () => {
  it('1. supervisor of A CANNOT grant permissions to an employee with NULL tenant_id and no assignment', async () => {
    dbMock.setRows('users', [{ id: 'eRoy', role: 'employee', tenant_id: null }]);
    dbMock.setRows('user_tenant_assignments', []);
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await extras.canManageEmployee({ user: { id: 'u1', role: 'supervisor', tenantId: 'A' } }, 'eRoy')).toBe(false);
  });

  it('2. supervisor of A CAN manage an employee of A (same residence)', async () => {
    dbMock.setRows('users', [{ id: 'eA', role: 'employee', tenant_id: 'A' }]);
    dbMock.setRows('user_tenant_assignments', []);
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await extras.canManageEmployee({ user: { id: 'u1', role: 'supervisor', tenantId: 'A' } }, 'eA')).toBe(true);
  });

  it('3. supervisor of A CANNOT manage an employee of B (cross-residence)', async () => {
    dbMock.setRows('users', [{ id: 'eB', role: 'employee', tenant_id: 'B' }]);
    dbMock.setRows('user_tenant_assignments', []);
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await extras.canManageEmployee({ user: { id: 'u1', role: 'supervisor', tenantId: 'A' } }, 'eB')).toBe(false);
  });

  it('4. employee granted via user_tenant_assignments link is manageable by manager of that tenant', async () => {
    dbMock.setRows('users', [{ id: 'eLink', role: 'employee', tenant_id: null }]);
    dbMock.setRows('user_tenant_assignments', [{ user_id: 'eLink', tenant_id: 'A' }]);
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await extras.canManageEmployee({ user: { id: 'u1', role: 'supervisor', tenantId: 'A' } }, 'eLink')).toBe(true);
  });

  it('5. supervisor/a. supervisor with NULL primary tenant but a valid assignment is NOT denied', async () => {
    // computeUserTenantIds mirrors the real middleware: resolves the assignment
    dbMock.setRows('users', [{ id: 'eAss', role: 'employee', tenant_id: 'A' }]);
    dbMock.setRows('user_tenant_assignments', []);
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await extras.canManageEmployee(
      { user: { id: 'uAs', role: 'assistant_supervisor', tenantId: null } }, 'eAss'
    )).toBe(true);
  });

  it('6. bishop can manage employees in any managed residence and no other', async () => {
    dbMock.setRows('users', [
      { id: 'eM', role: 'employee', tenant_id: 'B' },
      { id: 'eO', role: 'employee', tenant_id: 'C' },
    ]);
    dbMock.setRows('user_tenant_assignments', []);
    computeUserTenantIds.mockResolvedValue(['A', 'B']);
    expect(await extras.canManageEmployee({ user: { id: 'uB', role: 'bishop', tenantId: 'A' } }, 'eM')).toBe(true);
    expect(await extras.canManageEmployee({ user: { id: 'uB', role: 'bishop', tenantId: 'A' } }, 'eO')).toBe(false);
  });

  it('7. admin can always manage any employee', async () => {
    dbMock.setRows('users', [{ id: 'eAny', role: 'employee', tenant_id: 'Z' }]);
    dbMock.setRows('user_tenant_assignments', []);
    expect(await extras.canManageEmployee({ user: { id: 'adm', role: 'admin' } }, 'eAny')).toBe(true);
  });

  it('8. an admin/bishop target can never be managed through employee-permission', async () => {
    dbMock.setRows('users', [
      { id: 'admT', role: 'admin', tenant_id: 'A' },
      { id: 'bisT', role: 'bishop', tenant_id: 'A' },
    ]);
    dbMock.setRows('user_tenant_assignments', []);
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await extras.canManageEmployee({ user: { id: 'supA', role: 'supervisor', tenantId: 'A' } }, 'admT')).toBe(false);
    expect(await extras.canManageEmployee({ user: { id: 'supA', role: 'supervisor', tenantId: 'A' } }, 'bisT')).toBe(false);
  });

  it('9. manager with NO resolvable scope fails closed (cannot manage anyone)', async () => {
    dbMock.setRows('users', [{ id: 'eA', role: 'employee', tenant_id: 'A' }]);
    dbMock.setRows('user_tenant_assignments', []);
    computeUserTenantIds.mockResolvedValue([]);
    expect(await extras.canManageEmployee({ user: { id: 'uGhost', role: 'assistant_supervisor', tenantId: null } }, 'eA')).toBe(false);
  });

  it('10. forged X-Tenant-Id on the manager cannot widen scope (derived from DB only)', async () => {
    dbMock.setRows('users', [{ id: 'eB', role: 'employee', tenant_id: 'B' }]);
    dbMock.setRows('user_tenant_assignments', []);
    computeUserTenantIds.mockResolvedValue(['A']); // real tenantIds, not the forged one
    expect(await extras.canManageEmployee(
      // attacker spoofs a header-driven tenantId of 'B'
      { user: { id: 'u1', role: 'supervisor', tenantId: 'B' } },
      'eB'
    )).toBe(false);
    expect(computeUserTenantIds).toHaveBeenCalledWith({ id: 'u1', role: 'supervisor', tenantId: 'B' });
  });
});

// ═══════════════════════════════════════════════════════════════
// H-5 — canManageTargetUser (management) vs canImportTargetUser
//        (add-to-tenant import) in user.routes
// ═══════════════════════════════════════════════════════════════

describe('H-5: canManageTargetUser / canImportTargetUser (user management isolation)', () => {
  it('1. management FAIL-CLOSED: null-tenant global user cannot be updated/deleted by a tenant manager', async () => {
    dbMock.setRows('users', [{ id: 'gU', role: 'priest', tenant_id: null }]);
    dbMock.setRows('user_tenant_assignments', []);
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await userRoutes.canManageTargetUser({ user: { id: 'u1', role: 'supervisor', tenantId: 'A' } }, { id: 'gU', role: 'priest', tenant_id: null })).toBe(false);
  });

  it('2. import INTENDED: the same null-tenant global user can still be imported via add-to-tenant', async () => {
    dbMock.setRows('user_tenant_assignments', []);
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await userRoutes.canImportTargetUser({ user: { id: 'u1', role: 'supervisor', tenantId: 'A' } }, { id: 'gU', role: 'priest', tenant_id: null })).toBe(true);
  });

  it('3. manager of A CAN manage a user of A', async () => {
    dbMock.setRows('user_tenant_assignments', []);
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await userRoutes.canManageTargetUser({ user: { id: 'u1', role: 'supervisor', tenantId: 'A' } }, { id: 'uA', role: 'priest', tenant_id: 'A' })).toBe(true);
  });

  it('4. manager of A CANNOT manage a user of B (cross-residence)', async () => {
    dbMock.setRows('user_tenant_assignments', []);
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await userRoutes.canManageTargetUser({ user: { id: 'u1', role: 'supervisor', tenantId: 'A' } }, { id: 'uB', role: 'priest', tenant_id: 'B' })).toBe(false);
  });

  it('5. user linked to A via assignments is manageable by A manager even if primary tenant is null', async () => {
    dbMock.setRows('user_tenant_assignments', [{ user_id: 'uL', tenant_id: 'A' }]);
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await userRoutes.canManageTargetUser({ user: { id: 'u1', role: 'supervisor', tenantId: 'A' } }, { id: 'uL', role: 'priest', tenant_id: null })).toBe(true);
  });

  it('6. admin manages anyone; nobody but app-admin manages admin/bishop targets', async () => {
    dbMock.setRows('user_tenant_assignments', []);
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await userRoutes.canManageTargetUser({ user: { id: 'adm', role: 'admin' } }, { id: 'uAny', role: 'priest', tenant_id: 'X' })).toBe(true);
    expect(await userRoutes.canImportTargetUser({ user: { id: 'adm', role: 'admin' } }, { id: 'a2', role: 'admin', tenant_id: 'X' })).toBe(true);
    expect(await userRoutes.canManageTargetUser({ user: { id: 'u1', role: 'supervisor', tenantId: 'A' } }, { id: 'adm2', role: 'admin', tenant_id: 'A' })).toBe(false);
    expect(await userRoutes.canManageTargetUser({ user: { id: 'u1', role: 'supervisor', tenantId: 'A' } }, { id: 'bis', role: 'bishop', tenant_id: 'A' })).toBe(false);
  });

  it('7. manager with NO resolvable scope fails closed on both paths', async () => {
    dbMock.setRows('user_tenant_assignments', []);
    computeUserTenantIds.mockResolvedValue([]);
    const ghost = { user: { id: 'uGhost', role: 'assistant_supervisor', tenantId: null } };
    expect(await userRoutes.canManageTargetUser(ghost, { id: 'uA', role: 'priest', tenant_id: 'A' })).toBe(false);
    expect(await userRoutes.canImportTargetUser(ghost, { id: 'uA', role: 'priest', tenant_id: 'A' })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// M-7 — canManageBadge (global badge edit/delete authority).
// Global badges (tenant_id IS NULL) are org-level items: admin + bishop
// only, mirroring canManageItem/requireItemAccess. Tenant badges stay
// within computeUserTenantIds. FAIL-CLOSED for empty resolvable scope.
// ═══════════════════════════════════════════════════════════════

describe('M-7: canManageBadge (global badge edit/delete authority)', () => {
  it('1. admin can manage any badge, including global ones', async () => {
    expect(await badges.canManageBadge({ user: { id: 'adm', role: 'admin' } }, { id: 'b', tenant_id: null })).toBe(true);
    expect(await badges.canManageBadge({ user: { id: 'adm', role: 'admin' } }, { id: 'b', tenant_id: 'A' })).toBe(true);
  });

  it('2. bishop can manage global badges (org-level model, mirrors canManageItem)', async () => {
    expect(await badges.canManageBadge({ user: { id: 'uB', role: 'bishop', tenantId: 'A' } }, { id: 'b', tenant_id: null })).toBe(true);
  });

  it('3. supervisor CANNOT manage a global badge', async () => {
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await badges.canManageBadge({ user: { id: 'uS', role: 'supervisor', tenantId: 'A' } }, { id: 'b', tenant_id: null })).toBe(false);
  });

  it('4. priest CANNOT manage a global badge', async () => {
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await badges.canManageBadge({ user: { id: 'uP', role: 'priest', tenantId: 'A' } }, { id: 'b', tenant_id: null })).toBe(false);
  });

  it('5. employee CANNOT manage a global badge', async () => {
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await badges.canManageBadge({ user: { id: 'uE', role: 'employee', tenantId: 'A' } }, { id: 'b', tenant_id: null })).toBe(false);
  });

  it('6. assistant_supervisor CANNOT manage a global badge', async () => {
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await badges.canManageBadge({ user: { id: 'uAS', role: 'assistant_supervisor', tenantId: 'A' } }, { id: 'b', tenant_id: null })).toBe(false);
  });

  it('7. supervisor can manage a same-tenant badge when authorized', async () => {
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await badges.canManageBadge({ user: { id: 'uS', role: 'supervisor', tenantId: 'A' } }, { id: 'b', tenant_id: 'A' })).toBe(true);
  });

  it('8. cross-tenant badge → denied', async () => {
    computeUserTenantIds.mockResolvedValue(['A']);
    expect(await badges.canManageBadge({ user: { id: 'uS', role: 'supervisor', tenantId: 'A' } }, { id: 'b', tenant_id: 'B' })).toBe(false);
  });

  it('9. staff with NO resolvable scope fails closed (even for tenant badges)', async () => {
    computeUserTenantIds.mockResolvedValue([]);
    const ghost = { user: { id: 'uG', role: 'supervisor', tenantId: null } };
    expect(await badges.canManageBadge(ghost, { id: 'b', tenant_id: null })).toBe(false);
    expect(await badges.canManageBadge(ghost, { id: 'b', tenant_id: 'A' })).toBe(false);
  });
});