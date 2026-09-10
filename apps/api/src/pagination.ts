import { PaginationSchema, type Pagination } from "@tpb/contracts";

export const parsePagination = (query: unknown): Pagination =>
  PaginationSchema.parse(query ?? {});

export const paginationMeta = (pagination: Pagination, total: number) => ({
  limit: pagination.limit,
  offset: pagination.offset,
  total,
  hasMore: pagination.offset + pagination.limit < total,
});
