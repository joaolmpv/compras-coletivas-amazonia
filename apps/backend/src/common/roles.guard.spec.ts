import { RolesGuard } from './roles.guard';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

function buildContext(request: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('permite quando nenhum @Roles foi declarado na rota', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(buildContext({}))).toBe(true);
  });

  it('permite quando o papel do principal esta na lista exigida', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['FORNECEDOR']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const request = { principal: { sub: 'u1', role: 'FORNECEDOR', perfilId: 'f1' } };

    expect(guard.canActivate(buildContext(request))).toBe(true);
  });

  it('rejeita com SEM_PERMISSAO quando o papel do principal nao esta na lista', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['FORNECEDOR']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const request = { principal: { sub: 'u1', role: 'COMPRADOR', perfilId: 'c1' } };

    expect(() => guard.canActivate(buildContext(request))).toThrow();
    try {
      guard.canActivate(buildContext(request));
    } catch (err: any) {
      expect(err.code).toBe('SEM_PERMISSAO');
    }
  });

  it('rejeita quando nao ha principal (rota sem JwtAuthGuard antes)', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['FORNECEDOR']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(buildContext({}))).toThrow();
  });
});
