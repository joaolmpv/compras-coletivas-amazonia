import { RlsInterceptor } from './rls.interceptor';
import { DbContextService } from './db-context.service';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, firstValueFrom } from 'rxjs';

function buildContext(request: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

describe('RlsInterceptor', () => {
  let executeRawUnsafe: jest.Mock;
  let executeRaw: jest.Mock;
  let prisma: any;
  let dbContext: DbContextService;

  beforeEach(() => {
    executeRawUnsafe = jest.fn().mockResolvedValue(undefined);
    executeRaw = jest.fn().mockResolvedValue(undefined);
    prisma = {
      $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => {
        const tx = { $executeRawUnsafe: executeRawUnsafe, $executeRaw: executeRaw };
        return cb(tx);
      }),
    };
    dbContext = new DbContextService();
  });

  it('usa app_comprador por padrao quando nenhum @DbRoleMeta foi declarado', async () => {
    const reflector = { get: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const interceptor = new RlsInterceptor(prisma, reflector, dbContext);
    const next: CallHandler = { handle: () => of('resultado') };

    const resultado = await firstValueFrom(interceptor.intercept(buildContext({}), next));

    expect(resultado).toBe('resultado');
    expect(executeRawUnsafe).toHaveBeenCalledWith('SET LOCAL ROLE app_comprador');
  });

  it('seta app.comprador_id quando o role e app_comprador e ha principal autenticado', async () => {
    const reflector = { get: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const interceptor = new RlsInterceptor(prisma, reflector, dbContext);
    const next: CallHandler = { handle: () => of('ok') };
    const request = { principal: { sub: 'u1', role: 'COMPRADOR', perfilId: 'comp-1' } };

    await firstValueFrom(interceptor.intercept(buildContext(request), next));

    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('NAO seta app.comprador_id quando o role e app_auth (metadata explicito)', async () => {
    const reflector = { get: jest.fn().mockReturnValue('app_auth') } as unknown as Reflector;
    const interceptor = new RlsInterceptor(prisma, reflector, dbContext);
    const next: CallHandler = { handle: () => of('ok') };

    await firstValueFrom(interceptor.intercept(buildContext({}), next));

    expect(executeRawUnsafe).toHaveBeenCalledWith('SET LOCAL ROLE app_auth');
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('popula dbContext.tx dentro da transacao para o service usar', async () => {
    const reflector = { get: jest.fn().mockReturnValue('app_service') } as unknown as Reflector;
    const interceptor = new RlsInterceptor(prisma, reflector, dbContext);
    const next: CallHandler = {
      handle: () => {
        expect(dbContext.tx).toBeDefined();
        return of('ok');
      },
    };

    await firstValueFrom(interceptor.intercept(buildContext({}), next));
  });

  it('rejeita (nao faz SET ROLE) se o metadata trouxer um role fora da whitelist', () => {
    const reflector = { get: jest.fn().mockReturnValue('role_inventado') } as unknown as Reflector;
    const interceptor = new RlsInterceptor(prisma, reflector, dbContext);
    const next: CallHandler = { handle: () => of('nunca chega aqui') };

    expect(() => interceptor.intercept(buildContext({}), next)).toThrow();
  });
});
