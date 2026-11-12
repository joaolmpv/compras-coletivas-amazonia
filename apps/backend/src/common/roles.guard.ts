import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PapelUsuario } from '@prisma/client';
import { AppException } from './app-exception';
import { ROLES_KEY } from './roles.decorator';

/** Roda DEPOIS do JwtAuthGuard (precisa de request.principal ja setado). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesExigidos = this.reflector.getAllAndOverride<PapelUsuario[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rolesExigidos || rolesExigidos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const principal = request.principal;
    if (!principal || !rolesExigidos.includes(principal.role)) {
      throw new AppException(
        'SEM_PERMISSAO',
        'papel do usuario nao autoriza esta operacao',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
