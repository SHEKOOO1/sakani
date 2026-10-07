/**
 * The `mssql` driver collapses duplicate result-set column names into an array
 * instead of letting the later column win.
 *
 * Several list/detail queries select a base table with `*` and then join a table
 * that owns a column with the same name, e.g.
 *
 *   SELECT s.*, u.name FROM students s JOIN users u ON s.user_id = u.id
 *
 * Both `students.name` and `users.name` come back as `name`, so the driver
 * returns `name: [students.name, users.name]`. Any consumer that expects a
 * string (`.toLowerCase()`, `String(...)`, React child rendering) then throws
 * `TypeError: s.name.toLowerCase is not a function`.
 *
 * These helpers keep the declared select order's intent: the *last* non-null
 * value wins, which is the explicitly aliased/joined column. They also protect
 * against every other `X.*` + `Y.name` pair in the codebase.
 */

/**
 * Collapses driver-merged duplicate columns on a single row.
 * Only array values are touched: SQL Server has no array-typed column, so an
 * array can only mean "this name came back more than once".
 */
export const collapseDuplicateColumns = <T extends Record<string, any>>(row: T): T => {
  for (const key of Object.keys(row)) {
    const value = (row as Record<string, any>)[key];
    if (!Array.isArray(value)) continue;

    const lastNonNull = value.filter((entry) => entry !== null && entry !== undefined);
    (row as Record<string, any>)[key] = lastNonNull.length ? lastNonNull[lastNonNull.length - 1] : null;
  }
  return row;
};

/** Collapses duplicate columns across a list of rows. */
export const collapseDuplicateColumnsIn = <T extends Record<string, any>>(rows: T[]): T[] =>
  rows.map((row) => collapseDuplicateColumns(row));

/**
 * Guarantees a usable display name for rows that expose a `name` column coming
 * from a `users` join, so the frontend never has to null-guard before
 * `.toLowerCase()` / rendering.
 */
export const ensureDisplayName = <T extends Record<string, any>>(row: T, fallback = ''): T => {
  collapseDuplicateColumns(row);
  const name = (row as Record<string, any>).name;
  (row as Record<string, any>).name = typeof name === 'string' && name.trim() ? name : fallback;
  return row;
};