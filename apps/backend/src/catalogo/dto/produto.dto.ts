import { z } from 'zod';
import { PaginacaoQuerySchema } from '../../common/pagination';

export const CriarProdutoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  precoPorUnidade: z.number().positive(),
  // Unidades comerciais (decisao 23/11/2026) -- obrigatorios: sem eles o
  // produto nao participa de rateio nem de calculo de frete.
  unidadeComercial: z.string().min(1),
  pesoPorUnidadeKg: z.number().positive(),
  volumePorUnidadeM3: z.number().positive(),
});
export type CriarProdutoDto = z.infer<typeof CriarProdutoSchema>;

export const AtualizarProdutoSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    precoPorUnidade: z.number().positive().optional(),
    unidadeComercial: z.string().min(1).optional(),
    pesoPorUnidadeKg: z.number().positive().optional(),
    volumePorUnidadeM3: z.number().positive().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'informe ao menos um campo' });
export type AtualizarProdutoDto = z.infer<typeof AtualizarProdutoSchema>;

export const ListarProdutosQuerySchema = PaginacaoQuerySchema.extend({
  fornecedorId: z.string().optional(),
});
export type ListarProdutosQuery = z.infer<typeof ListarProdutosQuerySchema>;
