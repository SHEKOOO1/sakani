/** Small typed errors for domain rules in the restaurant/canteen modules. */

export class InputError extends Error {}

export class ConflictError extends Error {}

export class InsufficientStockError extends Error {}

export class StockChangedError extends Error {}

export function isDomainError(e: unknown): boolean {
  return (
    e instanceof InputError ||
    e instanceof ConflictError ||
    e instanceof InsufficientStockError ||
    e instanceof StockChangedError
  );
}

/** mssql update returns an affected-row count; the test dbMock returns an array. */
export function affected(result: unknown): boolean {
  return typeof result === "number" ? result > 0 : true;
}