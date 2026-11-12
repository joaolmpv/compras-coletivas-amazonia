import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DbContextService } from '../common/db-context.service';
import { AppException } from '../common/app-exception';
import { paginar, skipTake, type Paginado } from '../common/pagination';
import type { CriarProdutoDto, AtualizarProdutoDto, ListarProdutosQuery } from './dto/produto.dto';

@Injectable()
export class ProdutosService {
  constructor(@Inject(DbContextService) private readonly dbContext: DbContextService) {}

  async listar(query: ListarProdutosQuery): Promise<Paginado<unknown>> {
    const tx = this.dbContext.getTx();
    const where = query.fornecedorId ? { fornecedorId: query.fornecedorId } : {};
    const { skip, take } = skipTake(query);

    const [items, total] = await Promise.all([
      tx.produto.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      tx.produto.count({ where }),
    ]);
    return paginar(items, total, query);
  }

  async buscarPorId(id: string) {
    const tx = this.dbContext.getTx();
    const produto = await tx.produto.findUnique({ where: { id } });
    if (!produto) {
      throw new AppException('RECURSO_NAO_ENCONTRADO', 'produto nao encontrado', HttpStatus.NOT_FOUND);
    }
    return produto;
  }

  async criar(fornecedorId: string, dto: CriarProdutoDto) {
    const tx = this.dbContext.getTx();
    return tx.produto.create({ data: { ...dto, fornecedorId } });
  }

  /**
   * O WHERE e so `{ id }` -- nao ha checagem de dono aqui. Quem garante
   * "fornecedor so edita o proprio produto" e a politica RLS
   * produto_update_fornecedor (role app_fornecedor, fornecedorId =
   * app.fornecedor_id), nao esta linha de codigo. Se o produto nao existe
   * OU pertence a outro fornecedor, o UPDATE no Postgres afeta 0 linhas e o
   * Prisma lanca P2025 -- os dois casos sao indistinguiveis de proposito
   * (design-backend.md 2.4: RLS devolve "nao encontrado", nunca
   * "sem permissao", pra nao revelar que o recurso existe).
   */
  async atualizar(id: string, dto: AtualizarProdutoDto) {
    const tx = this.dbContext.getTx();
    try {
      return await tx.produto.update({ where: { id }, data: dto });
    } catch (err) {
      throw this.mapErro(err);
    }
  }

  async remover(id: string): Promise<void> {
    const tx = this.dbContext.getTx();
    try {
      await tx.produto.delete({ where: { id } });
    } catch (err) {
      throw this.mapErro(err);
    }
  }

  private mapErro(err: unknown): AppException {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') {
        return new AppException(
          'RECURSO_NAO_ENCONTRADO',
          'produto nao encontrado',
          HttpStatus.NOT_FOUND,
        );
      }
      if (err.code === 'P2003') {
        return new AppException(
          'RECURSO_EM_USO',
          'produto possui lotes associados e nao pode ser removido',
          HttpStatus.CONFLICT,
        );
      }
    }
    throw err;
  }
}
