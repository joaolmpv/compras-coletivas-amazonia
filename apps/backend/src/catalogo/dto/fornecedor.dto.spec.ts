import { AtualizarFornecedorSchema } from './fornecedor.dto';

describe('AtualizarFornecedorSchema', () => {
  it('aceita name valido', () => {
    expect(AtualizarFornecedorSchema.parse({ name: 'Novo Nome' })).toEqual({ name: 'Novo Nome' });
  });

  it('rejeita name vazio', () => {
    expect(() => AtualizarFornecedorSchema.parse({ name: '' })).toThrow();
  });

  it('rejeita payload sem name', () => {
    expect(() => AtualizarFornecedorSchema.parse({})).toThrow();
  });

  // document/reputationScore nao fazem parte do schema -- se alguem tentar
  // manda-los, o Zod ignora campos extras por padrao (nao .strict()), mas o
  // Prisma update() so escreve o que esta no `data` que o service monta a
  // partir do DTO (dto inteiro), entao campos extras nunca chegam ao banco.
  it('ignora campos extras (document/reputationScore nao sao editaveis)', () => {
    const resultado = AtualizarFornecedorSchema.parse({
      name: 'Novo Nome',
      document: 'outro-cnpj',
      reputationScore: 999,
    });
    expect(resultado).toEqual({ name: 'Novo Nome' });
  });
});
