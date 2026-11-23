import { CriarProdutoSchema, AtualizarProdutoSchema, ListarProdutosQuerySchema } from './produto.dto';

const unidadesComerciais = {
  unidadeComercial: 'saco 50kg',
  pesoPorUnidadeKg: 50,
  volumePorUnidadeM3: 0.04,
};

describe('CriarProdutoSchema', () => {
  it('aceita um payload valido', () => {
    expect(
      CriarProdutoSchema.parse({ name: 'Produto', precoPorUnidade: 10, ...unidadesComerciais }),
    ).toEqual({
      name: 'Produto',
      precoPorUnidade: 10,
      ...unidadesComerciais,
    });
  });

  it('rejeita precoPorUnidade nao positivo', () => {
    expect(() =>
      CriarProdutoSchema.parse({ name: 'Produto', precoPorUnidade: 0, ...unidadesComerciais }),
    ).toThrow();
  });

  it('rejeita name vazio', () => {
    expect(() =>
      CriarProdutoSchema.parse({ name: '', precoPorUnidade: 10, ...unidadesComerciais }),
    ).toThrow();
  });

  it('rejeita sem unidadeComercial/pesoPorUnidadeKg/volumePorUnidadeM3', () => {
    expect(() => CriarProdutoSchema.parse({ name: 'Produto', precoPorUnidade: 10 })).toThrow();
  });

  it('rejeita pesoPorUnidadeKg ou volumePorUnidadeM3 nao positivo', () => {
    expect(() =>
      CriarProdutoSchema.parse({
        name: 'Produto',
        precoPorUnidade: 10,
        ...unidadesComerciais,
        pesoPorUnidadeKg: 0,
      }),
    ).toThrow();
    expect(() =>
      CriarProdutoSchema.parse({
        name: 'Produto',
        precoPorUnidade: 10,
        ...unidadesComerciais,
        volumePorUnidadeM3: -1,
      }),
    ).toThrow();
  });
});

describe('AtualizarProdutoSchema', () => {
  it('aceita um unico campo informado', () => {
    expect(AtualizarProdutoSchema.parse({ name: 'novo nome' })).toEqual({ name: 'novo nome' });
  });

  it('rejeita objeto vazio (precisa de ao menos um campo)', () => {
    expect(() => AtualizarProdutoSchema.parse({})).toThrow();
  });

  it('rejeita precoPorUnidade nao positivo quando informado', () => {
    expect(() => AtualizarProdutoSchema.parse({ precoPorUnidade: -1 })).toThrow();
  });
});

describe('ListarProdutosQuerySchema', () => {
  it('aplica defaults de paginacao e aceita fornecedorId opcional', () => {
    expect(ListarProdutosQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(ListarProdutosQuerySchema.parse({ fornecedorId: 'f1' })).toMatchObject({
      fornecedorId: 'f1',
    });
  });

  it('faz coerce de page/pageSize vindos como string (query param)', () => {
    expect(ListarProdutosQuerySchema.parse({ page: '2', pageSize: '10' })).toEqual({
      page: 2,
      pageSize: 10,
    });
  });
});
