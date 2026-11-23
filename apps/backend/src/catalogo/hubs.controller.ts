import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { HubsService } from './hubs.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PaginacaoQuerySchema, type PaginacaoQuery } from '../common/pagination';
import { DbRoleMeta } from '../common/db-role.decorator';

// Publico (sem guard) -- @DbRoleMeta obrigatorio mesmo assim, no nivel da
// classe porque as duas rotas usam o mesmo role (ver nota em
// ProdutosController).
@Controller('hubs')
@DbRoleMeta('app_comprador')
export class HubsController {
  constructor(@Inject(HubsService) private readonly hubs: HubsService) {}

  @Get()
  listar(@Query(new ZodValidationPipe(PaginacaoQuerySchema)) query: PaginacaoQuery) {
    return this.hubs.listar(query);
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string) {
    return this.hubs.buscarPorId(id);
  }
}
