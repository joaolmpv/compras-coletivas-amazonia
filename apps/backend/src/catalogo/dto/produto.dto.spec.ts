import { CriarProdutoSchema, AtualizarProdutoSchema, ListarProdutosQuerySchema } from './produto.dto';

describe('CriarProdutoSchema', () => {
  it('aceita um payload valido', () => {
    expect(CriarProdutoSchema.parse({ name: 'Produto', unitPrice: 10 })).toEqual({
      name: 'Produto',
      unitPrice: 10,
    });
  });

  it('rejeita unitPrice nao positivo', () => {
    expect(() => CriarProdutoSchema.parse({ name: 'Produto', unitPrice: 0 })).toThrow();
  });

  it('rejeita name vazio', () => {
    expect(() => CriarProdutoSchema.parse({ name: '', unitPrice: 10 })).toThrow();
  });
});

describe('AtualizarProdutoSchema', () => {
  it('aceita um unico campo informado', () => {
    expect(AtualizarProdutoSchema.parse({ name: 'novo nome' })).toEqual({ name: 'novo nome' });
  });

  it('rejeita objeto vazio (precisa de ao menos um campo)', () => {
    expect(() => AtualizarProdutoSchema.parse({})).toThrow();
  });

  it('rejeita unitPrice nao positivo quando informado', () => {
    expect(() => AtualizarProdutoSchema.parse({ unitPrice: -1 })).toThrow();
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
