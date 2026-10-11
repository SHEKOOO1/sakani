/**
 * Pricing helpers shared by the restaurant and canteen modules.
 *
 * A line item may carry a per-item discount expressed either as a percentage of
 * the list price (`percent`) or as a fixed amount taken off the list price
 * (`amount`). The effective unit price is what the customer actually pays and
 * what flows into the ledger; the original price and the discount amount are
 * kept on the line so receipts can show "before / discount / after".
 */

export type DiscountType = 'percent' | 'amount' | null | undefined;

const round2 = (n: number): number => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export interface PricedLine {
  /** List price before any discount. */
  originalUnitPrice: number;
  /** Price actually charged per unit after the discount. */
  unitPrice: number;
  /** Amount knocked off a single unit (never negative). */
  discountAmount: number;
  /** Effective total for the requested quantity. */
  lineTotal: number;
}

/**
 * Compute the price breakdown for a single unit quantity.
 * - `percent`: value is clamped to [0, 100]; unit = price * (1 - pct/100)
 * - `amount`: value is clamped to [0, price];  unit = price - value
 * - anything else (null / 'none' / missing): no discount
 */
export function priceLine(
  listPrice: unknown,
  discountType: DiscountType,
  discountValue: unknown,
  quantity: number,
): PricedLine {
  const price = Math.max(0, Number(listPrice) || 0);
  const value = Math.max(0, Number(discountValue) || 0);
  const qty = Math.max(0, Number(quantity) || 0);

  let unit = price;
  if (discountType === 'percent') {
    unit = price * (1 - Math.min(value, 100) / 100);
  } else if (discountType === 'amount') {
    unit = price - Math.min(value, price);
  }

  unit = round2(unit);
  const originalUnitPrice = round2(price);
  const discountAmount = round2(Math.max(0, originalUnitPrice - unit));
  const lineTotal = round2(unit * qty);

  return { originalUnitPrice, unitPrice: unit, discountAmount, lineTotal };
}
