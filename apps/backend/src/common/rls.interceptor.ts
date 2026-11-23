import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
  NestInterceptor,
  Scope,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import type { PapelUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DbContextService } from './db-context.service';
import { DB_ROLE_KEY, DbRole } from './db-role.decorator';
import { AppException } from './app-exception';
import type { Principal } from './principal';

const DB_ROLES: readonly DbRole[] = [
  'app_auth',
  'app_comprador',
  'app_service',
  'app_fornecedor',
  'app_admin',
];

/**
 * Papel de aplicacao (JWT) exigido pra cada role de banco -- checado SO
 * quando a rota tem guard de autenticacao (request.principal existe).
 * Rota publica (sem guard, sem principal) nao passa por aqui -- e
 * exatamente o caso de GET /produtos etc., que continuam publicas mesmo
 * rodando como app_comprador.
 */
const PAPEL_PERMITIDO: Record<DbRole, readonly PapelUsuario[]> = {
  app_comprador: ['COMPRADOR'],
  app_fornecedor: ['FORNECEDOR'],
  app_admin: ['ADMIN'],
  // Rotas de auth (cadastro/login/refresh/logout) nunca tem guard --
  // request.principal nunca existe nelas, entao esta lista nunca e
  // consultada de verdade. Vazia de proposito: ninguem deveria autenticar
  // via JWT de usuario pra agir como app_auth.
  app_auth: [],
  // Uso exclusivo de jobs internos -- AuthService.revogarFamiliaIndependente
  // hoje (SET LOCAL ROLE direto em código, fora do RlsInterceptor); o job
  // de casamento da E5 depois. Nunca via JWT de usuario -- nenhuma rota
  // HTTP declara @DbRoleMeta('app_service') hoje, e se uma vier a
  // declarar com um guard na frente, fica recusada por padrao (lista
  // vazia), ate que isso seja decidido explicitamente.
  app_service: [],
};

/**
 * Abre UMA transacao por requisicao, faz SET LOCAL ROLE (+ SET LOCAL
 * app.comprador_id/app.fornecedor_id quando aplicavel) e so entao deixa o
 * handler da rota rodar -- design-backend.md secao 4.1/12.4. Tambem valida
 * (ver PAPEL_PERMITIDO) que o papel do JWT autenticado, quando existe,
 * autoriza o @DbRoleMeta da rota -- decisao de 23/11/2026, antes so o
 * RolesGuard/@Roles() (opcional, por rota) fazia isso.
 *
 * @DbRoleMeta e OBRIGATORIO em toda rota desde 23/11/2026 -- resolveRole()
 * lanca erro de configuracao (nao passa mais pra 'app_comprador' em
 * silencio) se faltar.
 *
 * `scope: Scope.REQUEST` EXPLICITO -- depender de um provider request-scoped
 * (DbContextService) nao bastou pra Nest tratar este interceptor global
 * (APP_INTERCEPTOR) como request-scoped na pratica: sem a marca explicita, a
 * instancia usada para resolver as dependencias de construtor saia
 * inconsistente (Reflector/PrismaService resolviam como undefined mesmo com
 * @Inject() explicito) -- confirmado empiricamente removendo DbContextService
 * do construtor, quando tudo voltava a resolver normalmente.
 *
 * Se esquecido (removido de um controller por engano): a conexao de
 * runtime e app_backend, que nao tem GRANT direto em tabela alguma (ver
 * migration de roles) -- qualquer query do handler falharia com
 * "permission denied", nunca passaria em silencio. Isso nao e testado
 * aqui (o interceptor e global, nunca "esquecido" em produto) -- e
 * testado direto contra o Postgres em prisma/tests/rls-app-backend.sql e,
 * no nivel da aplicacao, no teste de integracao do AuthModule
 * (test/auth.e2e-spec.ts, caso [fail-closed]).
 */
@Injectable({ scope: Scope.REQUEST })
export class RlsInterceptor implements NestInterceptor {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(DbContextService) private readonly dbContext: DbContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const role = this.resolveRole(context);
    const request = context.switchToHttp().getRequest();
    const principal: Principal | undefined = request.principal;

    // So checa quando ha principal (rota com JwtAuthGuard na frente) --
    // rota publica (sem guard) nunca tem principal e nunca passa por
    // aqui. Guards (RolesGuard/@Roles()) continuam existindo e podem
    // pegar isso primeiro em algumas rotas -- dupla cobertura de
    // proposito, nao uma substitui a outra.
    if (principal && !PAPEL_PERMITIDO[role].includes(principal.role)) {
      throw new AppException(
        'SEM_PERMISSAO',
        `papel ${principal.role} nao autoriza o role de banco ${role} desta rota`,
        HttpStatus.FORBIDDEN,
      );
    }

    const perfilId = principal?.perfilId ?? null;
    const compradorId = role === 'app_comprador' ? perfilId : null;
    const fornecedorId = role === 'app_fornecedor' ? perfilId : null;

    return from(
      this.prisma.$transaction(async (tx) => {
        this.dbContext.tx = tx;
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
        if (compradorId) {
          await tx.$executeRaw`SELECT set_config('app.comprador_id', ${compradorId}, true)`;
        }
        if (fornecedorId) {
          await tx.$executeRaw`SELECT set_config('app.fornecedor_id', ${fornecedorId}, true)`;
        }
        return firstValueFrom(next.handle());
      }),
    );
  }

  private resolveRole(context: ExecutionContext): DbRole {
    const role =
      this.reflector.get<DbRole>(DB_ROLE_KEY, context.getHandler()) ??
      this.reflector.get<DbRole>(DB_ROLE_KEY, context.getClass());

    // Decisao revisada em 23/11/2026: antes tinha um default implicito
    // ('app_comprador') aqui. Removido -- toda rota declara @DbRoleMeta
    // explicitamente agora, mesmo as publicas (app_comprador "visivel").
    // Erro de configuracao generico (nao AppException/SEM_PERMISSAO --
    // isso aqui nunca deveria acontecer em produto, e um bug de rota, nao
    // algo que o cliente causou), cai no catch-all do HttpExceptionFilter
    // (500 ERRO_INTERNO) -- mesmo padrao do `DbRoleMeta invalido` abaixo.
    if (role === undefined) {
      throw new Error('rota sem @DbRoleMeta declarado -- nao ha mais default implicito');
    }
    if (!DB_ROLES.includes(role)) {
      throw new Error(`DbRoleMeta invalido: ${String(role)}`);
    }
    return role;
  }
}
