import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DisponibilidadesService } from './disponibilidades.service';
import { DbRoleMeta } from '../common/db-role.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  CriarDisponibilidadeSchema,
  AtualizarDisponibilidadeSchema,
  ListarDisponibilidadesQuerySchema,
  type CriarDisponibilidadeDto,
  type AtualizarDisponibilidadeDto,
  type ListarDisponibilidadesQuery,
} from './dto/disponibilidade.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentPrincipal, type Principal } from '../common/principal';

// Sem rota publica aqui (diferente de ProdutosController) -- decisao
// aprovada em design-backend.md 13.2: leitura restrita ao proprio
// fornecedor + app_service (job de casamento da E5), nunca anonima. Por
// isso os tres decorators vao na CLASSE, nao por metodo.
@Controller('disponibilidades')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FORNECEDOR')
@DbRoleMeta('app_fornecedor')
export class DisponibilidadesController {
  constructor(
    @Inject(DisponibilidadesService) private readonly disponibilidades: DisponibilidadesService,
  ) {}

  @Get()
  listar(@Query(new ZodValidationPipe(ListarDisponibilidadesQuerySchema)) query: ListarDisponibilidadesQuery) {
    return this.disponibilidades.listar(query);
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string) {
    return this.disponibilidades.buscarPorId(id);
  }

  @Post()
  criar(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodValidationPipe(CriarDisponibilidadeSchema)) dto: CriarDisponibilidadeDto,
  ) {
    return this.disponibilidades.criar(principal.perfilId!, dto);
  }

  @Patch(':id')
  atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AtualizarDisponibilidadeSchema)) dto: AtualizarDisponibilidadeDto,
  ) {
    return this.disponibilidades.atualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(@Param('id') id: string): Promise<void> {
    await this.disponibilidades.remover(id);
  }
}
