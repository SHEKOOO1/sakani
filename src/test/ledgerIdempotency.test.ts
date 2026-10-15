import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit coverage for the DB-enforced reference idempotency:
 * migrations/054 adds a unique filtered index UQ_journal_entries_reference_status
 * on (reference, status); postEntry() must absorb a duplicate insert by
 * returning the already-posted entry — never posting the money twice.
 */

const { mock, entryInserts } = vi.hoisted(() => {
  const entryInserts: any[] = [];

  function makeBuilder() {
    const entryInsert = vi.fn(async (rows: any) => {
      const rec = Array.isArray(rows) ? rows[0] : rows;
      entryInserts.push(rec);
      return [rec?.id || 'new-id'];
    });
    const lineInsert = vi.fn(async (rows: any) => {
      const rec = Array.isArray(rows) ? rows[0] : rows;
      return [rec?.id || 'line-id'];
    });
    const first = vi.fn();

    const entryChain = {
      insert: entryInsert,
      where: vi.fn(() => entryChain),
      whereNot: vi.fn(() => entryChain),
      select: vi.fn(() => entryChain),
      first,
      update: vi.fn(async () => [1]),
      del: vi.fn(async () => 1),
      orderBy: vi.fn(() => entryChain),
    };
    const lineChain = {
      insert: lineInsert,
      where: vi.fn(() => lineChain),
      whereNot: vi.fn(() => lineChain),
      select: vi.fn(() => lineChain),
      first: vi.fn(async () => null),
      update: vi.fn(async () => [1]),
      del: vi.fn(async () => 1),
      orderBy: vi.fn(() => lineChain),
    };

    const kdbFn = vi.fn((table: string) => (table === 'journal_lines' ? lineChain : entryChain)) as any;
    (kdbFn as any).transaction = async (cb: any) => cb(kdbFn);
    (kdbFn as any).raw = vi.fn();
    return { kdb: kdbFn, entryInsert, lineInsert, first };
  }

  return { mock: makeBuilder(), entryInserts };
});

vi.mock('../backend/infrastructure/db', () => ({
  kdb: mock.kdb,
  logAuditEvent: vi.fn(),
  hasPermission: vi.fn(async () => true),
  checkUserPermission: vi.fn(async () => true),
}));

import { postEntry, paymentLines } from '../backend/services/ledger.service';

const BASE = {
  entryType: 'payment' as const,
  amount: 50,
  lines: paymentLines(50),
  reference: 'probe:1',
  source: 'system' as const,
};

beforeEach(() => {
  entryInserts.length = 0;
  mock.entryInsert.mockReset();
  mock.lineInsert.mockReset();
  mock.first.mockReset();
});

describe('Ledger reference idempotency', () => {
  it('a duplicate unique-index error returns the existing posted entry (no second row)', async () => {
    const existing = { id: 'existing-entry', entry_type: 'payment', status: 'posted', amount: 50 };
    mock.entryInsert
      .mockImplementationOnce(async (rows: any) => {
        entryInserts.push(Array.isArray(rows) ? rows[0] : rows);
        return ['first-id'];
      })
      .mockRejectedValueOnce({ number: 2601, message: "Violation of UQ_journal_entries_reference_status" });
    mock.first.mockResolvedValue(existing);

    const a = await postEntry(mock.kdb as any, BASE);
    const b = await postEntry(mock.kdb as any, BASE);

    // The duplicate insert was absorbed: same id, one logical charge.
    expect(a.id).toBeTruthy();
    expect(b.id).toBe('existing-entry');

    // Only ONE journal_entries row actually landed; nothing was posted twice.
    expect(entryInserts.length).toBe(1);
    expect(entryInserts[0]).toMatchObject({ reference: 'probe:1', status: 'posted' });
  });

  it('rethrows a unique violation that is not the reference index', async () => {
    mock.entryInsert.mockRejectedValueOnce({ number: 2601, message: 'Violation of UQ_something_else' });
    await expect(postEntry(mock.kdb as any, BASE)).rejects.toThrow();
  });

  it('rethrows when the fallback lookup finds no posted entry with that reference', async () => {
    mock.entryInsert.mockRejectedValueOnce({ number: 2601, message: 'UQ_journal_entries_reference_status' });
    mock.first.mockResolvedValue(null);
    await expect(postEntry(mock.kdb as any, BASE)).rejects.toThrow();
  });
});