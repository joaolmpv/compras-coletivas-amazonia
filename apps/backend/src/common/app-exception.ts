import { HttpException, HttpStatus } from '@nestjs/common';

/** Catalogo fechado de codigos de erro -- design-backend.md secao 2.4. */
export type ErrorCode =
  | 'VALIDACAO'
  | 'NAO_AUTENTICADO'
  | 'TOKEN_EXPIRADO'
  | 'REFRESH_TOKEN_INVALIDO'
  | 'CREDENCIAIS_INVALIDAS'
  | 'EMAIL_JA_CADASTRADO'
  | 'SEM_PERMISSAO'
  | 'RECURSO_NAO_ENCONTRADO'
  | 'RECURSO_EM_USO'
  | 'DISPONIBILIDADE_JA_EXISTE';

export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    public readonly details?: unknown,
  ) {
    super({ error: { code, message, details } }, status);
  }
}
