import { describe, it, expect } from 'vitest';
import { invoiceForStudent, resolveFrozenPrice, roomPriceFor } from '../backend/services/ledger.service';

/**
 * Residence-price policy: once a student's price is frozen at enrollment, the
 * shared room price can never re-base their invoice. A legacy record without
 * the freeze marker keeps the old room-price behaviour.
 */

const past = new Date('2020-01-01T00:00:00Z');
const future = new Date('2999-01-01T00:00:00Z');

const room = { price_daily: 150, price_monthly: 1000, price_semester: 6000 };

describe('resolveFrozenPrice', () => {
  it('prefers an explicit agreed price (including 0)', () => {
    expect(resolveFrozenPrice(room, 'semester', 4200)).toBe(4200);
    expect(resolveFrozenPrice(room, 'semester', 0)).toBe(0);
  });

  it('falls back to the room price for the cycle when no agreed price is given', () => {
    expect(resolveFrozenPrice(room, 'daily', undefined)).toBe(150);
    expect(resolveFrozenPrice(room, 'monthly', '')).toBe(1000);
    expect(resolveFrozenPrice(room, 'semester', null)).toBe(6000);
  });

  it('returns 0 when there is no room and no agreed price', () => {
    expect(resolveFrozenPrice(null, 'semester', undefined)).toBe(0);
  });
});

describe('invoiceForStudent — frozen price', () => {
  it('uses the agreed price and ignores the room price', () => {
    const s = { agreed_price: 6000, billing_cycle: 'semester', price_frozen_at: past, ...room };
    const r = invoiceForStudent(s);
    expect(r.invoice).toBe(6000);
    expect(r.source).toBe('frozen');
  });

  it('is unaffected by a later room-price change', () => {
    const before = invoiceForStudent({ agreed_price: 6000, billing_cycle: 'semester', price_frozen_at: past, ...room });
    const after = invoiceForStudent({
      agreed_price: 6000, billing_cycle: 'semester', price_frozen_at: past,
      price_daily: 999, price_monthly: 9999, price_semester: 88888,
    });
    expect(after.invoice).toBe(before.invoice);
    expect(after.invoice).toBe(6000);
  });

  it('honours a frozen price of 0 (free place)', () => {
    const r = invoiceForStudent({ agreed_price: 0, billing_cycle: 'semester', price_frozen_at: past, ...room });
    expect(r.invoice).toBe(0);
    expect(r.source).toBe('frozen');
  });

  it('a future-dated freeze stays pending and falls back to the room price', () => {
    const r = invoiceForStudent({ agreed_price: 6000, billing_cycle: 'semester', price_frozen_at: future, ...room });
    expect(r.invoice).toBe(6000);
    expect(r.source).toBe('room');
  });
});

describe('invoiceForStudent — legacy behaviour (no marker)', () => {
  it('the room price wins when configured', () => {
    const r = invoiceForStudent({ agreed_price: 100, billing_cycle: 'semester', price_frozen_at: null, ...room });
    expect(r.invoice).toBe(6000);
    expect(r.source).toBe('room');
  });

  it('falls back to agreed_price when the room has no price', () => {
    const r = invoiceForStudent({
      agreed_price: 2500, billing_cycle: 'semester', price_frozen_at: null,
      price_daily: 0, price_monthly: 0, price_semester: 0,
    });
    expect(r.invoice).toBe(2500);
    expect(r.source).toBe('agreed');
  });
});

describe('roomPriceFor', () => {
  it('selects by billing cycle with semester as default', () => {
    expect(roomPriceFor(room, 'daily')).toBe(150);
    expect(roomPriceFor(room, 'monthly')).toBe(1000);
    expect(roomPriceFor(room, null)).toBe(6000);
    expect(roomPriceFor(room, undefined)).toBe(6000);
  });
});
