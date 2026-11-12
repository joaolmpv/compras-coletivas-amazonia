import { ProdutosService } from './produtos.service';
import { DbContextService } from '../common/db-context.service';
import { Prisma } from '@prisma/client';

function buildTxMock() {
  return {
    produto: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function p2025() {
  return new Prisma.PrismaClientKnownRequestError('nao encontrado', {
    code: 'P2025',
    clientVersion: '6.19.3',
  });
}

function p2003() {
  return new Prisma.PrismaClientKnownRequestError('violacao de FK', {
    code: 'P2003',
    clientVersion: '6.19.3',
  });
}

describe('ProdutosService', () => {
  let tx: ReturnType<typeof buildTxMock>;
  let dbContext: DbContextService;
  let service: ProdutosService;

  beforeEach(() => {
    tx = buildTxMock();
    dbContext = new DbContextService();
    dbContext.tx = tx as never;
    service = new ProdutosService(dbContext);
  });

  describe('listar', () => {
    it('pagina e filtra por fornecedorId quando informado', async () => {
      tx.produto.findMany.mockResolvedValue([{ id: 'p1' }]);
      tx.produto.count.mockResolvedValue(1);

      const resultado = await service.listar({ page: 2, pageSize: 10, fornecedorId: 'f1' });

      expect(resultado).toEqual({ items: [{ id: 'p1' }], page: 2, pageSize: 10, total: 1 });
      expect(tx.produto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { fornecedorId: 'f1' }, skip: 10, take: 10 }),
      );
      expect(tx.produto.count).toHaveBeenCalledWith({ where: { fornecedorId: 'f1' } });
    });

    it('sem fornecedorId nao filtra', async () => {
      tx.produto.findMany.mockResolvedValue([]);
      tx.produto.count.mockResolvedValue(0);

      await service.listar({ page: 1, pageSize: 20 });

      expect(tx.produto.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });
  });

  describe('buscarPorId', () => {
    it('retorna o produto quando encontrado', async () => {
      tx.produto.findUnique.mockResolvedValue({ id: 'p1' });
      expect(await service.buscarPorId('p1')).toEqual({ id: 'p1' });
    });

    it('lanca RECURSO_NAO_ENCONTRADO quando nao existe', async () => {
      tx.produto.findUnique.mockResolvedValue(null);
      await expect(service.buscarPorId('inexistente')).rejects.toMatchObject({
        code: 'RECURSO_NAO_ENCONTRADO',
      });
    });
  });

  describe('criar', () => {
    it('associa o produto ao fornecedorId informado (do JWT, nao do payload)', async () => {
      tx.produto.create.mockResolvedValue({ id: 'p1', fornecedorId: 'f1' });

      const resultado = await service.criar('f1', { name: 'Caixa de parafusos', unitPrice: 10 });

      expect(resultado).toEqual({ id: 'p1', fornecedorId: 'f1' });
      expect(tx.produto.create).toHaveBeenCalledWith({
        data: { name: 'Caixa de parafusos', unitPrice: 10, fornecedorId: 'f1' },
      });
    });
  });

  describe('atualizar', () => {
    it('atualiza quando o UPDATE bate uma linha', async () => {
      tx.produto.update.mockResolvedValue({ id: 'p1', name: 'novo nome' });
      expect(await service.atualizar('p1', { name: 'novo nome' })).toEqual({
        id: 'p1',
        name: 'novo nome',
      });
    });

    it('mapeia P2025 (RLS escondeu a linha, ou id nao existe) para RECURSO_NAO_ENCONTRADO -- nao distingue os dois casos de proposito', async () => {
      tx.produto.update.mockRejectedValue(p2025());
      await expect(service.atualizar('produto-de-outro-fornecedor', { name: 'x' })).rejects.toMatchObject({
        code: 'RECURSO_NAO_ENCONTRADO',
      });
    });

    it('propaga erros que nao sao P2025/P2003', async () => {
      tx.produto.update.mockRejectedValue(new Error('boom'));
      await expect(service.atualizar('p1', { name: 'x' })).rejects.toThrow('boom');
    });
  });

  describe('remover', () => {
    it('remove quando o DELETE bate uma linha', async () => {
      tx.produto.delete.mockResolvedValue({ id: 'p1' });
      await expect(service.remover('p1')).resolves.toBeUndefined();
    });

    it('mapeia P2025 para RECURSO_NAO_ENCONTRADO', async () => {
      tx.produto.delete.mockRejectedValue(p2025());
      await expect(service.remover('inexistente')).rejects.toMatchObject({
        code: 'RECURSO_NAO_ENCONTRADO',
      });
    });

    it('mapeia violacao de FK (produto com lotes associados) para RECURSO_EM_USO', async () => {
      tx.produto.delete.mockRejectedValue(p2003());
      await expect(service.remover('produto-com-lote')).rejects.toMatchObject({
        code: 'RECURSO_EM_USO',
      });
    });
  });
});
