import { Body, Controller, Get, Inject, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { FornecedoresService } from './fornecedores.service';
import { DbRoleMeta } from '../common/db-role.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PaginacaoQuerySchema, type PaginacaoQuery } from '../common/pagination';
import { AtualizarFornecedorSchema, type AtualizarFornecedorDto } from './dto/fornecedor.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentPrincipal, type Principal } from '../common/principal';

@Controller('fornecedores')
export class FornecedoresController {
  constructor(@Inject(FornecedoresService) private readonly fornecedores: FornecedoresService) {}

  @Get()
  listar(@Query(new ZodValidationPipe(PaginacaoQuerySchema)) query: PaginacaoQuery) {
    return this.fornecedores.listar(query);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FORNECEDOR')
  @DbRoleMeta('app_fornecedor')
  atualizarMe(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodValidationPipe(AtualizarFornecedorSchema)) dto: AtualizarFornecedorDto,
  ) {
    return this.fornecedores.atualizarMe(principal.perfilId!, dto);
  }

  // :id DEPOIS de 'me' -- rota literal (PATCH 'me') nao colide com GET ':id'
  // (verbos diferentes), mas mantem a convencao de rotas literais antes de
  // parametrizadas no mesmo controller, pra evitar surpresa se um GET /me
  // for adicionado no futuro.
  @Get(':id')
  buscarPorId(@Param('id') id: string) {
    return this.fornecedores.buscarPorId(id);
  }
}
