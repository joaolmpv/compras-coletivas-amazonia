import {
  CriarDisponibilidadeSchema,
  AtualizarDisponibilidadeSchema,
  ListarDisponibilidadesQuerySchema,
} from './disponibilidade.dto';

describe('CriarDisponibilidadeSchema', () => {
  const base = {
    produtoId: 'p1',
    hubId: 'h1',
    quantidadeMinimaM3: 10,
    quantidadeMaximaM3: 100,
    prazoMaximoEsperaDias: 5,
  };

  it('aceita um payload valido', () => {
    expect(CriarDisponibilidadeSchema.parse(base)).toMatchObject(base);
  });

  it('rejeita quantidadeMinimaM3 maior que quantidadeMaximaM3', () => {
    expect(() =>
      CriarDisponibilidadeSchema.parse({ ...base, quantidadeMinimaM3: 200 }),
    ).toThrow();
  });

  it('rejeita quantidadeMinimaM3 nao positiva', () => {
    expect(() => CriarDisponibilidadeSchema.parse({ ...base, quantidadeMinimaM3: 0 })).toThrow();
  });

  it('rejeita prazoMaximoEsperaDias nao inteiro', () => {
    expect(() =>
      CriarDisponibilidadeSchema.parse({ ...base, prazoMaximoEsperaDias: 1.5 }),
    ).toThrow();
  });

  it('aceita vigenciaFim opcional', () => {
    const resultado = CriarDisponibilidadeSchema.parse({ ...base, vigenciaFim: '2027-01-01' });
    expect(resultado.vigenciaFim).toBeInstanceOf(Date);
  });
});

describe('AtualizarDisponibilidadeSchema', () => {
  it('aceita um unico campo informado', () => {
    expect(AtualizarDisponibilidadeSchema.parse({ quantidadeMaximaM3: 500 })).toEqual({
      quantidadeMaximaM3: 500,
    });
  });

  it('rejeita objeto vazio', () => {
    expect(() => AtualizarDisponibilidadeSchema.parse({})).toThrow();
  });

  it('rejeita quando os dois campos vem juntos e minima > maxima', () => {
    expect(() =>
      AtualizarDisponibilidadeSchema.parse({ quantidadeMinimaM3: 50, quantidadeMaximaM3: 10 }),
    ).toThrow();
  });

  it('aceita quando so um dos dois vem (o CHECK do banco cobre o cruzamento com o valor salvo)', () => {
    expect(AtualizarDisponibilidadeSchema.parse({ quantidadeMinimaM3: 999 })).toEqual({
      quantidadeMinimaM3: 999,
    });
  });

  it('aceita vigenciaFim null (reabrir vigencia sem fim)', () => {
    expect(AtualizarDisponibilidadeSchema.parse({ vigenciaFim: null })).toEqual({ vigenciaFim: null });
  });
});

describe('ListarDisponibilidadesQuerySchema', () => {
  it('aplica defaults de paginacao e aceita produtoId opcional', () => {
    expect(ListarDisponibilidadesQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(ListarDisponibilidadesQuerySchema.parse({ produtoId: 'p1' })).toMatchObject({
      produtoId: 'p1',
    });
  });
});
