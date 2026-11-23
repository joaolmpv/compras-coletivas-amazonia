import { DisponibilidadesController } from './disponibilidades.controller';
import { DisponibilidadesService } from './disponibilidades.service';

describe('DisponibilidadesController', () => {
  let disponibilidades: Partial<Record<keyof DisponibilidadesService, jest.Mock>>;
  let controller: DisponibilidadesController;

  beforeEach(() => {
    disponibilidades = {
      listar: jest.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
      buscarPorId: jest.fn().mockResolvedValue({ id: 'd1' }),
      criar: jest.fn().mockResolvedValue({ id: 'd1' }),
      atualizar: jest.fn().mockResolvedValue({ id: 'd1', quantidadeMaximaM3: 200 }),
    };
    controller = new DisponibilidadesController(disponibilidades as unknown as DisponibilidadesService);
  });

  it('listar delega ao service com a query', async () => {
    const query = { page: 1, pageSize: 20 };
    await controller.listar(query);
    expect(disponibilidades.listar).toHaveBeenCalledWith(query);
  });

  it('buscarPorId delega ao service', async () => {
    await expect(controller.buscarPorId('d1')).resolves.toEqual({ id: 'd1' });
  });

  it('criar usa o perfilId do principal (fornecedorId), nao um campo do payload', async () => {
    const principal = { sub: 'u1', role: 'FORNECEDOR' as const, perfilId: 'f1' };
    const dto = { produtoId: 'p1', hubId: 'h1', quantidadeMinimaM3: 1, quantidadeMaximaM3: 10, prazoMaximoEsperaDias: 5 };
    await controller.criar(principal, dto);
    expect(disponibilidades.criar).toHaveBeenCalledWith('f1', dto);
  });

  it('atualizar delega ao service com id e dto', async () => {
    await controller.atualizar('d1', { quantidadeMaximaM3: 200 });
    expect(disponibilidades.atualizar).toHaveBeenCalledWith('d1', { quantidadeMaximaM3: 200 });
  });
});
