import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../backend/infrastructure/knex', () => ({
  kdb: undefined,
  poolPromise: Promise.resolve(null),
  getDBClient: () => 'mssql',
  dateFormatColumn: (c: string) => c,
}));

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async () => ({ statusCode: 201 })),
  },
}));

// Chainable in-memory mock of the query builder used by notifications.routes.
vi.mock('../backend/infrastructure/db', () => {
  const inserted: any[] = [];
  const norm = (t: string) => t.replace(/\s+as\s+\w+$/i, '').trim();
  const staff = [{ id: 'u-sup' }, { id: 'u-asst' }, { id: 'u-priest' }];
  // u-op1 appears twice on purpose to prove the union de-duplicates.
  const operators = [{ user_id: 'u-op1' }, { user_id: 'u-op2' }, { user_id: 'u-op1' }];

  const builder = (table: string) => {
    const b: any = {};
    const self = () => b;
    b.leftJoin = self; b.join = self; b.distinct = self; b.select = self;
    b.whereIn = self; b.orderBy = self; b.limit = self; b.offset = self; b.count = self;
    b.where = (arg: any) => { if (typeof arg === 'function') arg.call(b); return b; };
    b.orWhere = (arg: any) => { if (typeof arg === 'function') arg.call(b); return b; };
    b.first = () => Promise.resolve(undefined);
    b.insert = (row: any) => { if (norm(table) === 'notifications') inserted.push(row); return Promise.resolve([]); };
    b.del = () => Promise.resolve([]);
    b.then = (onF: any) => {
      const t = norm(table);
      let value: any = [];
      if (t === 'users') value = staff;
      else if (t === 'restaurant_operators') value = operators;
      else if (t === 'user_push_subscriptions') value = [];
      return Promise.resolve(value).then(onF);
    };
    return b;
  };

  const kdb: any = vi.fn((table: string) => builder(table));
  return {
    kdb,
    logAuditEvent: vi.fn(),
    hasPermission: vi.fn(async () => true),
    checkUserPermission: vi.fn(async () => true),
    __inserted: inserted,
  };
});

import * as db from '../backend/infrastructure/db';
import {
  getRestaurantStaffUserIds,
  notifyRestaurantOrderPlaced,
  createNotification,
} from '../backend/api/notifications.routes';

const inserted = (db as any).__inserted as any[];

beforeEach(() => {
  inserted.length = 0;
  delete (global as any).__io;
});

describe('getRestaurantStaffUserIds', () => {
  it('unions restaurant operators with tenant staff and de-duplicates', async () => {
    const ids = await getRestaurantStaffUserIds('tenant-A');
    expect(ids.length).toBe(5);
    expect(new Set(ids)).toEqual(new Set(['u-op1', 'u-op2', 'u-sup', 'u-asst', 'u-priest']));
  });
});

describe('notifyRestaurantOrderPlaced', () => {
  it('notifies restaurant staff except the person who ordered', async () => {
    await notifyRestaurantOrderPlaced({
      tenantId: 'tenant-A', orderId: 'o-1', orderNumber: 7, orderDate: '2026-10-15',
      total: 500, itemCount: 3, ordererName: 'أحمد', customerName: null,
      roomName: 'غرفة 1', apartmentName: null, orderedBy: 'u-op1',
    });
    expect(inserted.length).toBe(4);
    expect(inserted.find((n) => n.user_id === 'u-op1')).toBeUndefined();
    expect(inserted.every((n) => n.type === 'info')).toBe(true);
    expect(inserted[0].title).toContain('#0007');
    expect(inserted[0].metadata).toContain('restaurant');
    expect(inserted[0].metadata).toContain('o-1');
  });

  it('marks a carried-over order as a warning and mentions its original date', async () => {
    await notifyRestaurantOrderPlaced({
      tenantId: 'tenant-A', orderId: 'o-2', orderNumber: 2, orderDate: '2026-10-14',
      total: 120, itemCount: 1, ordererName: 'منى', customerName: null,
      roomName: null, apartmentName: null, orderedBy: 'u-sup', isLate: true,
    });
    expect(inserted.length).toBe(4);
    expect(inserted.every((n) => n.type === 'warning')).toBe(true);
    expect(inserted[0].title).toContain('متأخر');
    expect(inserted[0].message).toContain('2026-10-14');
  });
});

describe('createNotification realtime + push', () => {
  it('emits a socket event to the recipient user room', async () => {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    (global as any).__io = { to };

    await createNotification({ userId: 'u-x', tenantId: 'tenant-A', title: 'عنوان', message: 'رسالة', type: 'info' });

    expect(to).toHaveBeenCalledWith('user-u-x');
    expect(emit).toHaveBeenCalledWith('notification', expect.objectContaining({ userId: 'u-x', title: 'عنوان' }));
  });
});
