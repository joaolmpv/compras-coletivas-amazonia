import { HubsService } from './hubs.service';
import { DbContextService } from '../common/db-context.service';

function buildTxMock() {
  return {
    hubLogistico: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
  };
}

describe('HubsService', () => {
  let tx: ReturnType<typeof buildTxMock>;
  let service: HubsService;

  beforeEach(() => {
    tx = buildTxMock();
    const dbContext = new DbContextService();
    dbContext.tx = tx as never;
    service = new HubsService(dbContext);
  });

  it('pagina os hubs', async () => {
    tx.hubLogistico.findMany.mockResolvedValue([{ id: 'h1' }]);
    tx.hubLogistico.count.mockResolvedValue(1);

    const resultado = await service.listar({ page: 1, pageSize: 20 });

    expect(resultado).toEqual({ items: [{ id: 'h1' }], page: 1, pageSize: 20, total: 1 });
  });

  it('lanca RECURSO_NAO_ENCONTRADO quando o hub nao existe', async () => {
    tx.hubLogistico.findUnique.mockResolvedValue(null);
    await expect(service.buscarPorId('inexistente')).rejects.toMatchObject({
      code: 'RECURSO_NAO_ENCONTRADO',
    });
  });
});
