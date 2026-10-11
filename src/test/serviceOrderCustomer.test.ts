import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// In-memory chainable mock of the query builder used by the identity service.
vi.mock('../backend/infrastructure/db', () => {
  const raw = (s: string) => ({ __raw: s });
  const kdb: any = vi.fn((table: string) => {
    const b: any = {};
    b.leftJoin = () => b;
    b.select = () => b;
    b.where = () => b;
    b.first = () => {
      if (table.startsWith('students as')) {
        return Promise.resolve({ customer_name: 'اسم', customer_phone: '0100', apartment_name: 'شقة ١', room_name: 'غرفة ٢' });
      }
      if (table === 'students') return Promise.resolve({ id: 'st-1' });
      if (table === 'users') return Promise.resolve({ name: 'مستخدم', phone: '0111' });
      return Promise.resolve(undefined);
    };
    return b;
  });
  kdb.raw = raw;
  return { kdb };
});

import { resolveCustomerIdentity } from '../backend/services/customer-identity.service';
import { canteenSaleSchema } from '../backend/validation/schemas';

describe('resolveCustomerIdentity', () => {
  it('captures name, phone, apartment and room from the student record', async () => {
    const id = await resolveCustomerIdentity({ studentId: 'st-1' });
    expect(id).toEqual({ customer_name: 'اسم', customer_phone: '0100', apartment_name: 'شقة ١', room_name: 'غرفة ٢' });
  });

  it('falls back to the student record for a self-ordering user', async () => {
    const id = await resolveCustomerIdentity({ userId: 'u-1' });
    expect(id.customer_name).toBe('اسم');
    expect(id.room_name).toBe('غرفة ٢');
  });

  it('returns all-null identity when nothing is provided', async () => {
    const id = await resolveCustomerIdentity({});
    expect(id).toEqual({ customer_name: null, customer_phone: null, apartment_name: null, room_name: null });
  });
});

describe('canteenSaleSchema payment_method', () => {
  const sale = (payment_method: string) => ({ sale_ref: 'POS-1', items: [{ product_id: 'p-1', quantity: 1 }], payment_method });

  it('accepts the wallet method used by the POS', () => {
    expect(canteenSaleSchema.safeParse(sale('wallet')).success).toBe(true);
  });

  it('rejects an unknown payment method', () => {
    expect(canteenSaleSchema.safeParse(sale('crypto')).success).toBe(false);
  });
});

// Regression guard: student notes are private to supervisor + priest only.
describe('student notes roles', () => {
  const src = fs.readFileSync(path.resolve(process.cwd(), 'src/backend/api/students/profile.routes.ts'), 'utf8');

  it('restricts notes to priest and supervisor', () => {
    expect(src).toContain("const STUDENT_NOTES_ROLES = ['priest', 'supervisor'];");
  });

  it('applies the restriction on every notes route', () => {
    const occurrences = src.split('STUDENT_NOTES_ROLES.includes(role)').length - 1;
    expect(occurrences).toBe(3);
  });
});
