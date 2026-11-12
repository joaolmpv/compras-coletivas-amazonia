import { z } from 'zod';
import { PaginacaoQuerySchema } from '../../common/pagination';

export const CriarProdutoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  unitPrice: z.number().positive(),
});
export type CriarProdutoDto = z.infer<typeof CriarProdutoSchema>;

export const AtualizarProdutoSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    unitPrice: z.number().positive().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'informe ao menos um campo' });
export type AtualizarProdutoDto = z.infer<typeof AtualizarProdutoSchema>;

export const ListarProdutosQuerySchema = PaginacaoQuerySchema.extend({
  fornecedorId: z.string().optional(),
});
export type ListarProdutosQuery = z.infer<typeof ListarProdutosQuerySchema>;
