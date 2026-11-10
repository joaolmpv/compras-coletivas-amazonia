import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let auth: Partial<Record<keyof AuthService, jest.Mock>>;
  let controller: AuthController;

  beforeEach(() => {
    auth = {
      cadastrarComprador: jest.fn().mockResolvedValue({ id: 'comp-1' }),
      cadastrarFornecedor: jest.fn().mockResolvedValue({ id: 'forn-1' }),
      login: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
      refresh: jest.fn().mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2' }),
      logout: jest.fn().mockResolvedValue(undefined),
      meComprador: jest.fn().mockResolvedValue({ id: 'comp-1' }),
    };
    controller = new AuthController(auth as unknown as AuthService);
  });

  it('cadastrarComprador delega ao service', async () => {
    const dto = { name: 'A', document: 'd', email: 'a@a.com', senha: '12345678' };
    await expect(controller.cadastrarComprador(dto)).resolves.toEqual({ id: 'comp-1' });
    expect(auth.cadastrarComprador).toHaveBeenCalledWith(dto);
  });

  it('login delega ao service', async () => {
    const dto = { email: 'a@a.com', senha: 'x' };
    await expect(controller.login(dto)).resolves.toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('refresh delega ao service passando o token', async () => {
    await controller.refresh({ refreshToken: 'tok' });
    expect(auth.refresh).toHaveBeenCalledWith('tok');
  });

  it('logout delega e retorna { ok: true }', async () => {
    await expect(controller.logout({ refreshToken: 'tok' })).resolves.toEqual({ ok: true });
    expect(auth.logout).toHaveBeenCalledWith('tok');
  });

  it('me usa o perfilId do principal autenticado', async () => {
    await controller.me({ sub: 'u1', role: 'COMPRADOR', perfilId: 'comp-1' });
    expect(auth.meComprador).toHaveBeenCalledWith('comp-1');
  });
});
