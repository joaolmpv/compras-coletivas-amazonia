import { FornecedoresController } from './fornecedores.controller';
import { FornecedoresService } from './fornecedores.service';

describe('FornecedoresController', () => {
  let fornecedores: Partial<Record<keyof FornecedoresService, jest.Mock>>;
  let controller: FornecedoresController;

  beforeEach(() => {
    fornecedores = {
      listar: jest.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
      buscarPorId: jest.fn().mockResolvedValue({ id: 'f1' }),
      atualizarMe: jest.fn().mockResolvedValue({ id: 'f1', name: 'novo nome' }),
    };
    controller = new FornecedoresController(fornecedores as unknown as FornecedoresService);
  });

  it('listar delega ao service com a query', async () => {
    const query = { page: 1, pageSize: 20 };
    await controller.listar(query);
    expect(fornecedores.listar).toHaveBeenCalledWith(query);
  });

  it('buscarPorId delega ao service', async () => {
    await expect(controller.buscarPorId('f1')).resolves.toEqual({ id: 'f1' });
  });

  it('atualizarMe usa o perfilId do principal, nunca um id do payload', async () => {
    const principal = { sub: 'u1', role: 'FORNECEDOR' as const, perfilId: 'f1' };
    await controller.atualizarMe(principal, { name: 'novo nome' });
    expect(fornecedores.atualizarMe).toHaveBeenCalledWith('f1', { name: 'novo nome' });
  });
});
