import { kdb } from '../infrastructure/db';

/**
 * Resolves the customer identity (name / phone / apartment / room) for an order
 * or canteen sale so it is recorded who the order belongs to — even months
 * later when the student record may change.
 *
 * Best-effort: never throws — returns nulls if anything is missing.
 */
export interface CustomerIdentity {
  customer_name: string | null;
  customer_phone: string | null;
  apartment_name: string | null;
  room_name: string | null;
}

const EMPTY: CustomerIdentity = {
  customer_name: null,
  customer_phone: null,
  apartment_name: null,
  room_name: null,
};

async function fromStudent(studentId: string): Promise<CustomerIdentity | null> {
  const row = await kdb('students as s')
    .leftJoin('users as u', 's.user_id', 'u.id')
    .leftJoin('rooms as r', 's.room_id', 'r.id')
    .leftJoin('apartments as a', 'r.apartment_id', 'a.id')
    .select(
      kdb.raw('COALESCE(s.name, u.name) as customer_name'),
      kdb.raw('COALESCE(s.phone, u.phone) as customer_phone'),
      'a.name as apartment_name',
      'r.room_number as room_name',
    )
    .where('s.id', studentId)
    .first();
  return row || null;
}

async function fromUser(userId: string): Promise<CustomerIdentity> {
  // A user may itself be a student (self-order) — prefer the student record.
  const s = await kdb('students').select('id').where({ user_id: userId }).first();
  if (s) {
    const identity = await fromStudent(s.id);
    if (identity) return identity;
  }
  const u = await kdb('users').select('name', 'phone').where({ id: userId }).first();
  return {
    customer_name: u?.name ?? null,
    customer_phone: u?.phone ?? null,
    apartment_name: null,
    room_name: null,
  };
}

export async function resolveCustomerIdentity(opts: {
  studentId?: string | null;
  userId?: string | null;
}): Promise<CustomerIdentity> {
  try {
    if (opts.studentId) {
      const identity = await fromStudent(opts.studentId);
      if (identity) return identity;
    }
    if (opts.userId) return await fromUser(opts.userId);
  } catch {
    /* best-effort — identity is a convenience, never block the order */
  }
  return { ...EMPTY };
}
