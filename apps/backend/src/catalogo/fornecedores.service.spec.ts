import { FornecedoresService } from './fornecedores.service';
import { DbContextService } from '../common/db-context.service';
import { Prisma } from '@prisma/client';

function buildTxMock() {
  return {
    fornecedor: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('FornecedoresService', () => {
  let tx: ReturnType<typeof buildTxMock>;
  let service: FornecedoresService;

  beforeEach(() => {
    tx = buildTxMock();
    const dbContext = new DbContextService();
    dbContext.tx = tx as never;
    service = new FornecedoresService(dbContext);
  });

  describe('listar', () => {
    it('pagina os fornecedores', async () => {
      tx.fornecedor.findMany.mockResolvedValue([{ id: 'f1' }]);
      tx.fornecedor.count.mockResolvedValue(1);

      const resultado = await service.listar({ page: 1, pageSize: 20 });

      expect(resultado).toEqual({ items: [{ id: 'f1' }], page: 1, pageSize: 20, total: 1 });
    });
  });

  describe('buscarPorId', () => {
    it('lanca RECURSO_NAO_ENCONTRADO quando nao existe', async () => {
      tx.fornecedor.findUnique.mockResolvedValue(null);
      await expect(service.buscarPorId('inexistente')).rejects.toMatchObject({
        code: 'RECURSO_NAO_ENCONTRADO',
      });
    });
  });

  describe('atualizarMe', () => {
    it('atualiza o proprio fornecedor (id vem do JWT)', async () => {
      tx.fornecedor.update.mockResolvedValue({ id: 'f1', name: 'Novo Nome' });

      const resultado = await service.atualizarMe('f1', { name: 'Novo Nome' });

      expect(resultado).toEqual({ id: 'f1', name: 'Novo Nome' });
      expect(tx.fornecedor.update).toHaveBeenCalledWith({
        where: { id: 'f1' },
        data: { name: 'Novo Nome' },
      });
    });

    it('mapeia P2025 para RECURSO_NAO_ENCONTRADO', async () => {
      tx.fornecedor.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('nao encontrado', {
          code: 'P2025',
          clientVersion: '6.19.3',
        }),
      );
      await expect(service.atualizarMe('f-inexistente', { name: 'x' })).rejects.toMatchObject({
        code: 'RECURSO_NAO_ENCONTRADO',
      });
    });
  });
});
