import { DbContextService } from './db-context.service';

describe('DbContextService', () => {
  it('lanca erro claro se getTx() for chamado antes do RlsInterceptor setar tx', () => {
    const ctx = new DbContextService();
    expect(() => ctx.getTx()).toThrow(/RlsInterceptor/);
  });

  it('retorna o tx depois de setado', () => {
    const ctx = new DbContextService();
    const fakeTx = {} as never;
    ctx.tx = fakeTx;
    expect(ctx.getTx()).toBe(fakeTx);
  });
});
