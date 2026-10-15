import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getLedgerClassTotals,
  postEntry,
  reverseEntry,
  LEDGER_KINDS,
} from '../backend/services/ledger.service';

// ───────────────────────────────────────────────────────────────
// Section 5 — accounting separation. The three activities (dorm,
// restaurant, canteen) share one journal but keep independent books:
//   • every posting is stamped with a ledger_kind (default 'dorm'),
//   • a reversal inherits the kind of the entry it mirrors,
//   • the housing report scope defaults to 'dorm' and can only widen
//     to the whole journal when it explicitly asks for 'all'.
// ───────────────────────────────────────────────────────────────

interface Rec { table: string; op: string; args: any[]; }

function makeExecutor(rows: Record<string, any> = {}) {
  const calls: Rec[] = [];
  const inserted: Record<string, any[]> = {};
  const executor: any = (table: string) => {
    const proxy: any = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') {
          const data = rows[table] ?? [];
          return (resolve: any) => resolve(Array.isArray(data) ? data : [data]);
        }
        if (typeof prop !== 'string') return undefined;
        return (...args: any[]) => {
          calls.push({ table, op: prop, args });
          if (prop === 'insert') {
            (inserted[table] ||= []).push(...(Array.isArray(args[0]) ? args[0] : [args[0]]));
          }
          if (prop === 'first') {
            const data = rows[table];
            return Promise.resolve(Array.isArray(data) ? data[0] : data);
          }
          return proxy;
        };
      },
    });
    return proxy;
  };
  executor.raw = (sql: string) => sql;
  return { executor, calls, inserted };
}

describe('ledger separation — report scope', () => {
  let ctx: ReturnType<typeof makeExecutor>;
  beforeEach(() => { ctx = makeExecutor(); });

  it('defaults every housing report to the dorm book', async () => {
    await getLedgerClassTotals({ tenantId: 'A' }, ctx.executor);
    const kinds = ctx.calls.filter(c => c.op === 'where' && c.args[0] === 'e.ledger_kind');
    expect(kinds).toHaveLength(1);
    expect(kinds[0].args[1]).toBe('dorm');
  });

  it("keeps a combined rollup read-only and opt-in via ledgerKind: 'all'", async () => {
    await getLedgerClassTotals({ tenantId: 'A', ledgerKind: 'all' }, ctx.executor);
    expect(ctx.calls.some(c => c.op === 'where' && c.args[0] === 'e.ledger_kind')).toBe(false);
  });

  it('can read one activity book explicitly', async () => {
    await getLedgerClassTotals({ ledgerKind: 'canteen' }, ctx.executor);
    const kinds = ctx.calls.filter(c => c.op === 'where' && c.args[0] === 'e.ledger_kind');
    expect(kinds).toHaveLength(1);
    expect(kinds[0].args[1]).toBe('canteen');
  });
});

describe('ledger separation — posting stamps the activity', () => {
  it('stamps the dorm book by default', async () => {
    const ctx = makeExecutor();
    await postEntry(ctx.executor, {
      entryType: 'payment', amount: 100,
      lines: [{ account: 'CASH', debit: 100 }, { account: 'STUDENT_PAYMENT', credit: 100 }],
    });
    expect(ctx.inserted['journal_entries'][0].ledger_kind).toBe('dorm');
  });

  it('stamps restaurant and canteen sales with their own book', async () => {
    const ctx = makeExecutor();
    await postEntry(ctx.executor, {
      entryType: 'payment', amount: 30,
      lines: [{ account: 'CASH', debit: 30 }, { account: 'CANTEEN_REVENUE', credit: 30 }],
      ledgerKind: 'canteen',
    });
    expect(ctx.inserted['journal_entries'][0].ledger_kind).toBe('canteen');
  });

  it('exposes exactly the three known books', () => {
    expect([...LEDGER_KINDS]).toEqual(['dorm', 'restaurant', 'canteen']);
  });
});

describe('ledger separation — a reversal stays in its original book', () => {
  it('inherits the ledger_kind of the entry it mirrors', async () => {
    const ctx = makeExecutor({
      'journal_entries': [{
        id: 'entry-1', entry_type: 'payment', status: 'posted', amount: 30,
        tenant_id: 'A', student_id: null, category: 'كانتين', description: 'sale',
        is_admin_only: 0, version: 1, ledger_kind: 'canteen',
      }],
      'journal_lines': [
        { account: 'CASH', debit: 30, credit: 0, student_id: null, memo: null, line_no: 1 },
        { account: 'CANTEEN_REVENUE', debit: 0, credit: 30, student_id: null, memo: null, line_no: 2 },
      ],
    });
    await reverseEntry(ctx.executor, { entryId: 'entry-1', reason: 'إرجاع' });
    const reversalInsert = ctx.inserted['journal_entries']
      .find((r: any) => r.entry_type === 'reversal');
    expect(reversalInsert).toBeTruthy();
    expect(reversalInsert.ledger_kind).toBe('canteen');
  });
});
