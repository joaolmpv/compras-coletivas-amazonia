import { SetMetadata } from '@nestjs/common';
import type { PapelUsuario } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Defesa em profundidade -- marca o PAPEL DE APLICACAO (PapelUsuario, do
 * JWT) exigido por uma rota. Checado pelo RolesGuard ANTES da query rodar.
 *
 * Isso NAO substitui o RLS: a garantia estrutural de "fornecedor so edita
 * os proprios produtos" e a politica produto_update_fornecedor no Postgres
 * (fornecedorId = app.fornecedor_id), que vale mesmo se este guard for
 * esquecido numa rota nova. @Roles() so evita que a tentativa chegue ate o
 * banco pra, so ali, descobrir que nao tinha permissao -- da um 403
 * explicito (SEM_PERMISSAO) em vez do 404 "silencioso" que o RLS devolveria
 * (ver design-backend.md 2.4, nota sobre RECURSO_NAO_ENCONTRADO vs RLS).
 */
export const Roles = (...roles: PapelUsuario[]) => SetMetadata(ROLES_KEY, roles);
