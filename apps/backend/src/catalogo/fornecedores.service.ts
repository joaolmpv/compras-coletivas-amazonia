import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DbContextService } from '../common/db-context.service';
import { AppException } from '../common/app-exception';
import { paginar, skipTake, type Paginado, type PaginacaoQuery } from '../common/pagination';
import type { AtualizarFornecedorDto } from './dto/fornecedor.dto';

@Injectable()
export class FornecedoresService {
  constructor(@Inject(DbContextService) private readonly dbContext: DbContextService) {}

  async listar(query: PaginacaoQuery): Promise<Paginado<unknown>> {
    const tx = this.dbContext.getTx();
    const { skip, take } = skipTake(query);
    const [items, total] = await Promise.all([
      tx.fornecedor.findMany({ skip, take, orderBy: { createdAt: 'desc' } }),
      tx.fornecedor.count(),
    ]);
    return paginar(items, total, query);
  }

  async buscarPorId(id: string) {
    const tx = this.dbContext.getTx();
    const fornecedor = await tx.fornecedor.findUnique({ where: { id } });
    if (!fornecedor) {
      throw new AppException('RECURSO_NAO_ENCONTRADO', 'fornecedor nao encontrado', HttpStatus.NOT_FOUND);
    }
    return fornecedor;
  }

  /** fornecedorId vem do JWT (principal.perfilId), nunca do payload -- ver
   * ProdutosService.atualizar para a mesma logica de RLS decidindo o 404. */
  async atualizarMe(fornecedorId: string, dto: AtualizarFornecedorDto) {
    const tx = this.dbContext.getTx();
    try {
      return await tx.fornecedor.update({ where: { id: fornecedorId }, data: dto });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new AppException(
          'RECURSO_NAO_ENCONTRADO',
          'fornecedor nao encontrado',
          HttpStatus.NOT_FOUND,
        );
      }
      throw err;
    }
  }
}
