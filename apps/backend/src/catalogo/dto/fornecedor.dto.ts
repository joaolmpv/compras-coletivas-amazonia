import { z } from 'zod';

// So `name` e auto-editavel -- `document` (CNPJ) e identidade, e
// `reputationScore` e calculado pelo OE4 (sentimento + metricas), nunca
// escrito pelo proprio fornecedor.
export const AtualizarFornecedorSchema = z.object({
  name: z.string().min(1),
});
export type AtualizarFornecedorDto = z.infer<typeof AtualizarFornecedorSchema>;
