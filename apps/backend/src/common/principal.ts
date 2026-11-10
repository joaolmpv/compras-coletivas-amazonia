import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';

export interface Principal {
  sub: string; // Usuario.id
  role: PapelUsuario;
  perfilId: string | null; // compradorId ou fornecedorId; null para ADMIN
}

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const request = context.switchToHttp().getRequest();
    return request.principal;
  },
);
