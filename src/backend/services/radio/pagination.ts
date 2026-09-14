import { kdb } from "../../infrastructure/db";

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function parsePagination(query: any): PaginationParams {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 50));
  return { page, limit };
}

export async function paginateQuery<T>(
  baseQuery: any,
  { page, limit }: PaginationParams,
  countQuery?: any,
  fields?: string[]
): Promise<PaginatedResult<T>> {
  const countQ = countQuery || baseQuery.clone();
  const offset = (page - 1) * limit;

  const [countResult, rows] = await Promise.all([
    countQ.clearSelect().clear('order').count("* as total").first(),
    fields
      ? baseQuery.clone().select(fields).offset(offset).limit(limit)
      : baseQuery.clone().offset(offset).limit(limit),
  ]);

  const total = Number((countResult as any)?.total || 0);

  return {
    data: rows as T[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function batchCount<T>(
  table: string,
  foreignKey: string,
  ids: string[]
): Promise<Record<string, number>> {
  if (ids.length === 0) return {};

  const rows = await kdb(table)
    .whereIn(foreignKey, ids)
    .groupBy(foreignKey)
    .select(foreignKey)
    .count("* as count");

  const map: Record<string, number> = {};
  rows.forEach((r: any) => { map[r[foreignKey]] = Number(r.count); });
  return map;
}

export function batchCountQuery(
  baseQuery: any,
  groupByField: string
): Promise<Record<string, number>> {
  return baseQuery
    .clone()
    .groupBy(groupByField)
    .select(groupByField)
    .count("* as count")
    .then((rows: any[]) => {
      const map: Record<string, number> = {};
      rows.forEach((r: any) => { map[r[groupByField]] = Number(r.count); });
      return map;
    });
}
