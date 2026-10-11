/**
 * Frontend mirror of the backend line-pricing helper (see pricing.service.ts).
 * Used to preview the effective price / discount before a sale is submitted;
 * the backend is the source of truth and recomputes everything on write.
 */

export type DiscountType = 'percent' | 'amount' | null | undefined;

const round2 = (n: number): number => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export interface PriceBreakdown {
  originalUnitPrice: number;
  unitPrice: number;
  discountAmount: number;
  hasDiscount: boolean;
}

export function priceBreakdown(
  listPrice: unknown,
  discountType: DiscountType,
  discountValue: unknown,
): PriceBreakdown {
  const price = Math.max(0, Number(listPrice) || 0);
  const value = Math.max(0, Number(discountValue) || 0);

  let unit = price;
  if (discountType === 'percent') unit = price * (1 - Math.min(value, 100) / 100);
  else if (discountType === 'amount') unit = price - Math.min(value, price);

  unit = round2(unit);
  const originalUnitPrice = round2(price);
  return {
    originalUnitPrice,
    unitPrice: unit,
    discountAmount: round2(Math.max(0, originalUnitPrice - unit)),
    hasDiscount: unit < originalUnitPrice,
  };
}

/** Effective unit price after applying the item/product discount. */
export function effectivePrice(
  listPrice: unknown,
  discountType: DiscountType,
  discountValue: unknown,
): number {
  return priceBreakdown(listPrice, discountType, discountValue).unitPrice;
}
