import { JwtAuthGuard } from './jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

function contextWithHeader(header?: string): ExecutionContext {
  const request: any = { headers: header ? { authorization: header } : {} };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('rejeita (NAO_AUTENTICADO) quando nao ha header Authorization', () => {
    const jwt = { verify: jest.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwt);
    expect(() => guard.canActivate(contextWithHeader(undefined))).toThrow();
  });

  it('rejeita quando o header nao e Bearer', () => {
    const jwt = { verify: jest.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwt);
    expect(() => guard.canActivate(contextWithHeader('Basic xyz'))).toThrow();
  });

  it('aceita e popula request.principal quando o token e valido', () => {
    const jwt = {
      verify: jest.fn().mockReturnValue({ sub: 'usr-1', role: 'COMPRADOR', perfilId: 'comp-1' }),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwt);
    const context = contextWithHeader('Bearer token-valido');

    expect(guard.canActivate(context)).toBe(true);
    const request = (context.switchToHttp().getRequest as any)();
    expect(request.principal).toEqual({ sub: 'usr-1', role: 'COMPRADOR', perfilId: 'comp-1' });
  });

  it('marca como TOKEN_EXPIRADO quando o erro e TokenExpiredError', () => {
    const erro = new Error('expirado');
    erro.name = 'TokenExpiredError';
    const jwt = { verify: jest.fn().mockImplementation(() => { throw erro; }) } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwt);

    try {
      guard.canActivate(contextWithHeader('Bearer token-expirado'));
      fail('deveria ter lancado');
    } catch (e: any) {
      expect(e.code).toBe('TOKEN_EXPIRADO');
    }
  });

  it('marca como NAO_AUTENTICADO para qualquer outro erro de verificacao', () => {
    const jwt = {
      verify: jest.fn().mockImplementation(() => { throw new Error('assinatura invalida'); }),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwt);

    try {
      guard.canActivate(contextWithHeader('Bearer token-invalido'));
      fail('deveria ter lancado');
    } catch (e: any) {
      expect(e.code).toBe('NAO_AUTENTICADO');
    }
  });
});
