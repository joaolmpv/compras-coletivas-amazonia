import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { HubsService } from './hubs.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PaginacaoQuerySchema, type PaginacaoQuery } from '../common/pagination';

@Controller('hubs')
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
