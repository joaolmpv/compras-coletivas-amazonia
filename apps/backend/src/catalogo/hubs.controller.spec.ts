import { HubsController } from './hubs.controller';
import { HubsService } from './hubs.service';

describe('HubsController', () => {
  let hubs: Partial<Record<keyof HubsService, jest.Mock>>;
  let controller: HubsController;

  beforeEach(() => {
    hubs = {
      listar: jest.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
      buscarPorId: jest.fn().mockResolvedValue({ id: 'h1' }),
    };
    controller = new HubsController(hubs as unknown as HubsService);
  });

  it('listar delega ao service com a query', async () => {
    const query = { page: 1, pageSize: 20 };
    await controller.listar(query);
    expect(hubs.listar).toHaveBeenCalledWith(query);
  });

  it('buscarPorId delega ao service', async () => {
    await expect(controller.buscarPorId('h1')).resolves.toEqual({ id: 'h1' });
  });
});
