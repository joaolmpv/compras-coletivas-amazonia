import { DisponibilidadesService } from './disponibilidades.service';
import { DbContextService } from '../common/db-context.service';
import { Prisma } from '@prisma/client';

function buildTxMock() {
  return {
    disponibilidadeFornecedor: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    produto: {
      findUnique: jest.fn(),
    },
  };
}

function prismaErro(code: string) {
  return new Prisma.PrismaClientKnownRequestError('erro', { code, clientVersion: '6.19.3' });
}

function prismaCheckViolation() {
  return new Prisma.PrismaClientUnknownRequestError(
    'violates check constraint "DisponibilidadeFornecedor_min_le_max"',
    { clientVersion: '6.19.3' },
  );
}

describe('DisponibilidadesService', () => {
  let tx: ReturnType<typeof buildTxMock>;
  let service: DisponibilidadesService;

  beforeEach(() => {
    tx = buildTxMock();
    const dbContext = new DbContextService();
    dbContext.tx = tx as never;
    service = new DisponibilidadesService(dbContext);
  });

  describe('listar', () => {
    it('pagina e filtra por produtoId quando informado (identidade e so RLS, nao o WHERE)', async () => {
      tx.disponibilidadeFornecedor.findMany.mockResolvedValue([{ id: 'd1' }]);
      tx.disponibilidadeFornecedor.count.mockResolvedValue(1);

      const resultado = await service.listar({ page: 1, pageSize: 20, produtoId: 'p1' });

      expect(resultado).toEqual({ items: [{ id: 'd1' }], page: 1, pageSize: 20, total: 1 });
      expect(tx.disponibilidadeFornecedor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { produtoId: 'p1' } }),
      );
    });

    it('sem produtoId nao filtra', async () => {
      tx.disponibilidadeFornecedor.findMany.mockResolvedValue([]);
      tx.disponibilidadeFornecedor.count.mockResolvedValue(0);
      await service.listar({ page: 1, pageSize: 20 });
      expect(tx.disponibilidadeFornecedor.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });
  });

  describe('buscarPorId', () => {
    it('lanca RECURSO_NAO_ENCONTRADO quando a RLS esconde a linha (retorna null)', async () => {
      tx.disponibilidadeFornecedor.findUnique.mockResolvedValue(null);
      await expect(service.buscarPorId('d-de-outro-fornecedor')).rejects.toMatchObject({
        code: 'RECURSO_NAO_ENCONTRADO',
      });
    });
  });

  describe('criar', () => {
    const dto = {
      produtoId: 'p1',
      hubId: 'h1',
      quantidadeMinimaM3: 10,
      quantidadeMaximaM3: 100,
      prazoMaximoEsperaDias: 5,
    };

    it('cria quando o produto pertence ao fornecedor autenticado', async () => {
      tx.produto.findUnique.mockResolvedValue({ id: 'p1', fornecedorId: 'f1' });
      tx.disponibilidadeFornecedor.create.mockResolvedValue({ id: 'd1', ...dto, fornecedorId: 'f1' });

      const resultado = await service.criar('f1', dto);

      expect(resultado).toEqual({ id: 'd1', ...dto, fornecedorId: 'f1' });
      expect(tx.disponibilidadeFornecedor.create).toHaveBeenCalledWith({
        data: { ...dto, fornecedorId: 'f1' },
      });
    });

    it('rejeita com RECURSO_NAO_ENCONTRADO quando o produto nao existe', async () => {
      tx.produto.findUnique.mockResolvedValue(null);
      await expect(service.criar('f1', dto)).rejects.toMatchObject({ code: 'RECURSO_NAO_ENCONTRADO' });
      expect(tx.disponibilidadeFornecedor.create).not.toHaveBeenCalled();
    });

    it('rejeita com SEM_PERMISSAO quando o produto pertence a outro fornecedor -- RLS nao pega isso (sem join com Produto)', async () => {
      tx.produto.findUnique.mockResolvedValue({ id: 'p1', fornecedorId: 'outro-fornecedor' });
      await expect(service.criar('f1', dto)).rejects.toMatchObject({ code: 'SEM_PERMISSAO' });
      expect(tx.disponibilidadeFornecedor.create).not.toHaveBeenCalled();
    });

    it('mapeia P2002 (unique produtoId+hubId) para DISPONIBILIDADE_JA_EXISTE', async () => {
      tx.produto.findUnique.mockResolvedValue({ id: 'p1', fornecedorId: 'f1' });
      tx.disponibilidadeFornecedor.create.mockRejectedValue(prismaErro('P2002'));
      await expect(service.criar('f1', dto)).rejects.toMatchObject({ code: 'DISPONIBILIDADE_JA_EXISTE' });
    });
  });

  describe('atualizar', () => {
    it('atualiza quando o UPDATE bate uma linha', async () => {
      tx.disponibilidadeFornecedor.update.mockResolvedValue({ id: 'd1', quantidadeMaximaM3: 200 });
      const resultado = await service.atualizar('d1', { quantidadeMaximaM3: 200 });
      expect(resultado).toEqual({ id: 'd1', quantidadeMaximaM3: 200 });
    });

    it('mapeia P2025 para RECURSO_NAO_ENCONTRADO', async () => {
      tx.disponibilidadeFornecedor.update.mockRejectedValue(prismaErro('P2025'));
      await expect(service.atualizar('d-de-outro', { quantidadeMaximaM3: 1 })).rejects.toMatchObject({
        code: 'RECURSO_NAO_ENCONTRADO',
      });
    });

    it('mapeia violacao do CHECK minima<=maxima (contra valor ja salvo) para VALIDACAO', async () => {
      tx.disponibilidadeFornecedor.update.mockRejectedValue(prismaCheckViolation());
      await expect(service.atualizar('d1', { quantidadeMinimaM3: 999 })).rejects.toMatchObject({
        code: 'VALIDACAO',
      });
    });

    it('propaga erros que nao sao P2025/P2002/CHECK min_le_max', async () => {
      tx.disponibilidadeFornecedor.update.mockRejectedValue(new Error('boom'));
      await expect(service.atualizar('d1', { quantidadeMaximaM3: 1 })).rejects.toThrow('boom');
    });
  });
});
