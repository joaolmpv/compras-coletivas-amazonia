import { z } from 'zod';
import { PaginacaoQuerySchema } from '../../common/pagination';

export const CriarDisponibilidadeSchema = z
  .object({
    produtoId: z.string().min(1),
    hubId: z.string().min(1),
    quantidadeMinima: z.number().positive(),
    quantidadeMaxima: z.number().positive(),
    prazoMaximoEsperaDias: z.number().int().positive(),
    vigenciaFim: z.coerce.date().optional(),
  })
  .refine((v) => v.quantidadeMinima <= v.quantidadeMaxima, {
    message: 'quantidadeMinima deve ser menor ou igual a quantidadeMaxima',
    path: ['quantidadeMinima'],
  });
export type CriarDisponibilidadeDto = z.infer<typeof CriarDisponibilidadeSchema>;

// produtoId/hubId NAO sao editaveis -- mudar produto ou hub e uma
// disponibilidade diferente (identidade da linha e @@unique([produtoId,
// hubId])); quem quiser isso remove e cria outra.
export const AtualizarDisponibilidadeSchema = z
  .object({
    quantidadeMinima: z.number().positive().optional(),
    quantidadeMaxima: z.number().positive().optional(),
    prazoMaximoEsperaDias: z.number().int().positive().optional(),
    vigenciaFim: z.coerce.date().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'informe ao menos um campo' })
  .refine(
    (v) =>
      v.quantidadeMinima === undefined ||
      v.quantidadeMaxima === undefined ||
      v.quantidadeMinima <= v.quantidadeMaxima,
    {
      // Se so UM dos dois vier no payload, o Zod nao tem como validar contra
      // o valor atualmente salvo do outro -- o CHECK do banco
      // (DisponibilidadeFornecedor_min_le_max, mapeado de P2004 no service)
      // e quem fecha essa lacuna.
      message: 'quantidadeMinima deve ser menor ou igual a quantidadeMaxima',
    },
  );
export type AtualizarDisponibilidadeDto = z.infer<typeof AtualizarDisponibilidadeSchema>;

export const ListarDisponibilidadesQuerySchema = PaginacaoQuerySchema.extend({
  produtoId: z.string().optional(),
});
export type ListarDisponibilidadesQuery = z.infer<typeof ListarDisponibilidadesQuerySchema>;
