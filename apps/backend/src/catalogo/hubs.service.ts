import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { DbContextService } from '../common/db-context.service';
import { AppException } from '../common/app-exception';
import { paginar, skipTake, type Paginado, type PaginacaoQuery } from '../common/pagination';

/** Somente leitura -- HubLogistico e seed/admin, sem escrita via API (design-backend.md 2.2). */
@Injectable()
export class HubsService {
  constructor(@Inject(DbContextService) private readonly dbContext: DbContextService) {}

  async listar(query: PaginacaoQuery): Promise<Paginado<unknown>> {
    const tx = this.dbContext.getTx();
    const { skip, take } = skipTake(query);
    const [items, total] = await Promise.all([
      tx.hubLogistico.findMany({ skip, take, orderBy: { name: 'asc' } }),
      tx.hubLogistico.count(),
    ]);
    return paginar(items, total, query);
  }

  async buscarPorId(id: string) {
    const tx = this.dbContext.getTx();
    const hub = await tx.hubLogistico.findUnique({ where: { id } });
    if (!hub) {
      throw new AppException('RECURSO_NAO_ENCONTRADO', 'hub logistico nao encontrado', HttpStatus.NOT_FOUND);
    }
    return hub;
  }
}
