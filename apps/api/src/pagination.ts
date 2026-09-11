import { PaginationSchema, type Pagination } from "@tpb/contracts";
import { parse } from "./zod";

export const parsePagination = (query: unknown): Pagination =>
  parse(PaginationSchema as any, query ?? {}) as Pagination;

export const paginationMeta = (pagination: Pagination, total: number) => ({
  limit: pagination.limit,
  offset: pagination.offset,
  total,
  hasMore: pagination.offset + pagination.limit < total,
});
