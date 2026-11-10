import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  Scope,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { DbContextService } from './db-context.service';
import { DB_ROLE_KEY, DbRole } from './db-role.decorator';

const DB_ROLES: readonly DbRole[] = ['app_auth', 'app_comprador', 'app_service'];

/**
 * Abre UMA transacao por requisicao, faz SET LOCAL ROLE (+ SET LOCAL
 * app.comprador_id quando o papel for app_comprador e houver um principal
 * autenticado) e so entao deixa o handler da rota rodar -- design-backend.md
 * secao 4.1/12.4.
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
    const compradorId =
      role === 'app_comprador' ? (request.principal?.perfilId ?? null) : null;

    return from(
      this.prisma.$transaction(async (tx) => {
        this.dbContext.tx = tx;
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
        if (compradorId) {
          await tx.$executeRaw`SELECT set_config('app.comprador_id', ${compradorId}, true)`;
        }
        return firstValueFrom(next.handle());
      }),
    );
  }

  private resolveRole(context: ExecutionContext): DbRole {
    const role =
      this.reflector.get<DbRole>(DB_ROLE_KEY, context.getHandler()) ??
      this.reflector.get<DbRole>(DB_ROLE_KEY, context.getClass()) ??
      'app_comprador';

    if (!DB_ROLES.includes(role)) {
      throw new Error(`DbRoleMeta invalido: ${String(role)}`);
    }
    return role;
  }
}
