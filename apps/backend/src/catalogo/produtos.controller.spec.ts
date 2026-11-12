import { ProdutosController } from './produtos.controller';
import { ProdutosService } from './produtos.service';

describe('ProdutosController', () => {
  let produtos: Partial<Record<keyof ProdutosService, jest.Mock>>;
  let controller: ProdutosController;

  beforeEach(() => {
    produtos = {
      listar: jest.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
      buscarPorId: jest.fn().mockResolvedValue({ id: 'p1' }),
      criar: jest.fn().mockResolvedValue({ id: 'p1' }),
      atualizar: jest.fn().mockResolvedValue({ id: 'p1', name: 'novo' }),
      remover: jest.fn().mockResolvedValue(undefined),
    };
    controller = new ProdutosController(produtos as unknown as ProdutosService);
  });

  it('listar delega ao service com a query', async () => {
    const query = { page: 1, pageSize: 20 };
    await controller.listar(query);
    expect(produtos.listar).toHaveBeenCalledWith(query);
  });

  it('buscarPorId delega ao service', async () => {
    await expect(controller.buscarPorId('p1')).resolves.toEqual({ id: 'p1' });
  });

  it('criar usa o perfilId do principal (fornecedorId), nao um campo do payload', async () => {
    const principal = { sub: 'u1', role: 'FORNECEDOR' as const, perfilId: 'f1' };
    const dto = { name: 'Produto', unitPrice: 10 };
    await controller.criar(principal, dto);
    expect(produtos.criar).toHaveBeenCalledWith('f1', dto);
  });

  it('atualizar delega ao service com id e dto', async () => {
    await controller.atualizar('p1', { name: 'novo' });
    expect(produtos.atualizar).toHaveBeenCalledWith('p1', { name: 'novo' });
  });

  it('remover delega ao service', async () => {
    await controller.remover('p1');
    expect(produtos.remover).toHaveBeenCalledWith('p1');
  });
});
