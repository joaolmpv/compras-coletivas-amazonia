import { z } from 'zod';

/** Offset/limit -- design-backend.md secao 2.1 (decisao ja tomada: nao cursor). */
export const PaginacaoQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginacaoQuery = z.infer<typeof PaginacaoQuerySchema>;

export interface Paginado<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function skipTake(query: PaginacaoQuery): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

export function paginar<T>(items: T[], total: number, query: PaginacaoQuery): Paginado<T> {
  return { items, page: query.page, pageSize: query.pageSize, total };
}
