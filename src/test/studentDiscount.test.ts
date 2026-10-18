import { describe, it, expect } from 'vitest';
import { discountAmountFor, invoiceForStudent } from '../backend/services/ledger.service';

// ───────────────────────────────────────────────────────────────
// Unit tests for the per-student discount pricing.
//
// A discount is a property of the student's price, not a cash movement:
// discountAmountFor() derives the reduction and invoiceForStudent() applies
// it to the gross invoice, leaving `grossInvoice` intact so a later price
// edit (or a room freeze) still compares against the real residence price.
// ───────────────────────────────────────────────────────────────

describe('discountAmountFor', () => {
  it('returns 0 when there is no discount', () => {
    expect(discountAmountFor(6000, {})).toBe(0);
    expect(discountAmountFor(6000, { discount_type: null, discount_value: null })).toBe(0);
  });

  it('computes a percentage of the gross price', () => {
    expect(discountAmountFor(6000, { discount_type: 'percent', discount_value: 10 })).toBe(600);
    expect(discountAmountFor(7500, { discount_type: 'percent', discount_value: 25 })).toBe(1875);
  });

  it('caps a percentage at 100% of the price', () => {
    expect(discountAmountFor(6000, { discount_type: 'percent', discount_value: 150 })).toBe(6000);
    expect(discountAmountFor(6000, { discount_type: 'percent', discount_value: 100 })).toBe(6000);
  });

  it('applies a flat amount discount', () => {
    expect(discountAmountFor(6000, { discount_type: 'amount', discount_value: 500 })).toBe(500);
  });

  it('never lets a flat discount exceed the price itself', () => {
    expect(discountAmountFor(300, { discount_type: 'amount', discount_value: 500 })).toBe(300);
  });

  it('ignores malformed discounts instead of inventing money', () => {
    expect(discountAmountFor(6000, { discount_type: 'percent', discount_value: -10 })).toBe(0);
    expect(discountAmountFor(6000, { discount_type: 'amount', discount_value: 0 })).toBe(0);
    expect(discountAmountFor(6000, { discount_type: 'percent', discount_value: 'abc' })).toBe(0);
    expect(discountAmountFor(6000, { discount_type: 'weird', discount_value: 50 })).toBe(0);
    expect(discountAmountFor(0, { discount_type: 'amount', discount_value: 500 })).toBe(0);
  });
});

describe('invoiceForStudent — discount application', () => {
  const priced = {
    room_id: 'r1',
    billing_cycle: 'semester',
    price_semester: 6000,
  };

  it('leaves invoice equal to gross when no discount is set', () => {
    const r = invoiceForStudent(priced);
    expect(r.grossInvoice).toBe(6000);
    expect(r.discountAmount).toBe(0);
    expect(r.invoice).toBe(6000);
  });

  it('deducts a percentage discount from the invoice but keeps the gross intact', () => {
    const r = invoiceForStudent({ ...priced, discount_type: 'percent', discount_value: 10 });
    expect(r.grossInvoice).toBe(6000);
    expect(r.discountAmount).toBe(600);
    expect(r.invoice).toBe(5400);
  });

  it('deducts a flat amount discount from the invoice', () => {
    const r = invoiceForStudent({ ...priced, discount_type: 'amount', discount_value: 1500 });
    expect(r.grossInvoice).toBe(6000);
    expect(r.invoice).toBe(4500);
  });

  it('applies the discount on top of a frozen price', () => {
    const r = invoiceForStudent({
      agreed_price: 8000,
      billing_cycle: 'semester',
      price_frozen_at: new Date('2020-01-01'),
      discount_type: 'percent',
      discount_value: 25,
    });
    expect(r.source).toBe('frozen');
    expect(r.grossInvoice).toBe(8000);
    expect(r.invoice).toBe(6000);
  });

  it('never produces a negative invoice', () => {
    const r = invoiceForStudent({ ...priced, discount_type: 'amount', discount_value: 99999 });
    expect(r.invoice).toBe(0);
    expect(r.discountAmount).toBe(6000);
  });
});
