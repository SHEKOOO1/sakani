/**
 * Helpers for comparing stored identifiers.
 *
 * Every id column in this schema is `nvarchar`, and SQL Server compares those
 * case-insensitively (collation SQL_Latin1_General_CP1_CI_AS). JavaScript does
 * not. Code paths that registered rows through the raw MSSQL driver used to
 * bind ids as `mssql.UniqueIdentifier`, which made SQL Server rewrite them as
 * UPPERCASE, while knex wrote them lowercase.
 *
 * The result was that a query like `WHERE tenant_id = @tenant_id` matched, but
 * the identical check in JavaScript (`a === b`, `list.includes(x)`) failed --
 * turning a pure formatting difference into a 403 authorization failure.
 *
 * Use these helpers instead of `===` / `includes()` whenever identifiers that
 * came from the database are compared, so casing can never affect behavior.
 */

/** True when both values represent the same identifier, ignoring case. */
export function sameId(a: unknown, b: unknown): boolean {
    if (a === null || a === undefined || b === null || b === undefined) return a === b;
    return String(a).toLowerCase() === String(b).toLowerCase();
}

/** Case-insensitive replacement for `Array.prototype.includes` on id lists. */
export function includesId(list: readonly unknown[] | null | undefined, id: unknown): boolean {
    if (!Array.isArray(list)) return false;
    return list.some((item) => sameId(item, id));
}

/** Returns the element of `list` that matches `id`, ignoring case. */
export function findId<T>(list: readonly T[] | null | undefined, id: unknown): T | undefined {
    if (!Array.isArray(list)) return undefined;
    return list.find((item) => sameId(item, id));
}