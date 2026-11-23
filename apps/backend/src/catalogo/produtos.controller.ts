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
import { ProdutosService } from './produtos.service';
import { DbRoleMeta } from '../common/db-role.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  CriarProdutoSchema,
  AtualizarProdutoSchema,
  ListarProdutosQuerySchema,
  type CriarProdutoDto,
  type AtualizarProdutoDto,
  type ListarProdutosQuery,
} from './dto/produto.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentPrincipal, type Principal } from '../common/principal';

@Controller('produtos')
export class ProdutosController {
  constructor(@Inject(ProdutosService) private readonly produtos: ProdutosService) {}

  // Publico -- sem guard de autenticacao, mas @DbRoleMeta e OBRIGATORIO
  // mesmo assim desde 23/11/2026 (nao ha mais default implicito no
  // interceptor). produto_select_publico (RLS) nao restringe leitura a
  // nenhum role especifico -- app_comprador e so o role "visivel" que
  // qualquer requisicao sem identidade usa.
  @Get()
  @DbRoleMeta('app_comprador')
  listar(@Query(new ZodValidationPipe(ListarProdutosQuerySchema)) query: ListarProdutosQuery) {
    return this.produtos.listar(query);
  }

  @Get(':id')
  @DbRoleMeta('app_comprador')
  buscarPorId(@Param('id') id: string) {
    return this.produtos.buscarPorId(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FORNECEDOR')
  @DbRoleMeta('app_fornecedor')
  criar(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodValidationPipe(CriarProdutoSchema)) dto: CriarProdutoDto,
  ) {
    return this.produtos.criar(principal.perfilId!, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FORNECEDOR')
  @DbRoleMeta('app_fornecedor')
  atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AtualizarProdutoSchema)) dto: AtualizarProdutoDto,
  ) {
    return this.produtos.atualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FORNECEDOR')
  @DbRoleMeta('app_fornecedor')
  async remover(@Param('id') id: string): Promise<void> {
    await this.produtos.remover(id);
  }
}
