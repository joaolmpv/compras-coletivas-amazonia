import { z } from 'zod';

export const CadastroCompradorSchema = z.object({
  name: z.string().min(1),
  document: z.string().min(1), // CNPJ
  email: z.string().email(),
  senha: z.string().min(8),
});
export type CadastroCompradorDto = z.infer<typeof CadastroCompradorSchema>;

export const CadastroFornecedorSchema = z.object({
  name: z.string().min(1),
  document: z.string().min(1), // CNPJ
  email: z.string().email(),
  senha: z.string().min(8),
});
export type CadastroFornecedorDto = z.infer<typeof CadastroFornecedorSchema>;
