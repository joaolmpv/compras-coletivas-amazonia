import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppException } from '../common/app-exception';
import { HttpStatus } from '@nestjs/common';
import type { Principal } from '../common/principal';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  // @Inject() explicito -- ver nota em rls.interceptor.ts (isolatedModules
  // + emitDecoratorMetadata nao resolve tipo cross-file de forma confiavel).
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];

    if (!header?.startsWith('Bearer ')) {
      throw new AppException(
        'NAO_AUTENTICADO',
        'token ausente',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = header.slice('Bearer '.length);
    try {
      const payload = this.jwt.verify<Principal>(token);
      request.principal = {
        sub: payload.sub,
        role: payload.role,
        perfilId: payload.perfilId ?? null,
      };
      return true;
    } catch (err) {
      const expirado = err instanceof Error && err.name === 'TokenExpiredError';
      throw new AppException(
        expirado ? 'TOKEN_EXPIRADO' : 'NAO_AUTENTICADO',
        expirado ? 'access token expirado' : 'token invalido',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
