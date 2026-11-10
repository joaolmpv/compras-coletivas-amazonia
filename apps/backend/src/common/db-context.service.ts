import { Injectable, Scope } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Request-scoped: o RlsInterceptor seta `tx` dentro da transacao que abre
 * por requisicao (SET LOCAL ROLE + app.comprador_id); os services leem
 * `tx` daqui em vez de injetar o PrismaService cru -- ver design-backend.md
 * secao 4.1. Por ser Scope.REQUEST, a MESMA instancia e compartilhada entre
 * o interceptor e os services chamados durante aquela requisicao.
 */
@Injectable({ scope: Scope.REQUEST })
export class DbContextService {
  tx?: Prisma.TransactionClient;

  getTx(): Prisma.TransactionClient {
    if (!this.tx) {
      throw new Error(
        'DbContextService.tx nao foi setado -- RlsInterceptor nao rodou para esta requisicao?',
      );
    }
    return this.tx;
  }
}
