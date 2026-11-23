import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DbContextService } from '../common/db-context.service';
import { AppException } from '../common/app-exception';
import { paginar, skipTake, type Paginado } from '../common/pagination';
import type {
  CriarDisponibilidadeDto,
  AtualizarDisponibilidadeDto,
  ListarDisponibilidadesQuery,
} from './dto/disponibilidade.dto';

@Injectable()
export class DisponibilidadesService {
  constructor(@Inject(DbContextService) private readonly dbContext: DbContextService) {}

  /** Sem filtro de fornecedorId no WHERE -- a politica disponibilidade_own
   * (RLS) ja restringe o findMany as linhas do proprio fornecedor; o WHERE
   * aqui so carrega o filtro de NEGOCIO (produtoId), nao o de identidade. */
  async listar(query: ListarDisponibilidadesQuery): Promise<Paginado<unknown>> {
    const tx = this.dbContext.getTx();
    const where = query.produtoId ? { produtoId: query.produtoId } : {};
    const { skip, take } = skipTake(query);

    const [items, total] = await Promise.all([
      tx.disponibilidadeFornecedor.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      tx.disponibilidadeFornecedor.count({ where }),
    ]);
    return paginar(items, total, query);
  }

  async buscarPorId(id: string) {
    const tx = this.dbContext.getTx();
    const disponibilidade = await tx.disponibilidadeFornecedor.findUnique({ where: { id } });
    if (!disponibilidade) {
      throw new AppException(
        'RECURSO_NAO_ENCONTRADO',
        'disponibilidade nao encontrada',
        HttpStatus.NOT_FOUND,
      );
    }
    return disponibilidade;
  }

  /**
   * fornecedorId vem do JWT, nunca do payload (mesmo padrao de
   * ProdutosService.criar) -- mas isso so garante que a LINHA criada e
   * atribuida ao fornecedor certo, nao que o `produtoId` informado
   * pertence a ele. RLS nao pega esse caso (so compara a coluna
   * fornecedorId desta tabela, nunca faz join com Produto) -- por isso a
   * checagem explicita abaixo, ANTES do INSERT.
   */
  async criar(fornecedorId: string, dto: CriarDisponibilidadeDto) {
    const tx = this.dbContext.getTx();
    const produto = await tx.produto.findUnique({ where: { id: dto.produtoId } });
    if (!produto) {
      throw new AppException('RECURSO_NAO_ENCONTRADO', 'produto nao encontrado', HttpStatus.NOT_FOUND);
    }
    if (produto.fornecedorId !== fornecedorId) {
      throw new AppException(
        'SEM_PERMISSAO',
        'produto nao pertence ao fornecedor autenticado',
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      return await tx.disponibilidadeFornecedor.create({ data: { ...dto, fornecedorId } });
    } catch (err) {
      throw this.mapErro(err);
    }
  }

  /** Mesma logica de ProdutosService.atualizar: o WHERE e so `{ id }` --
   * quem restringe a propria linha e a politica disponibilidade_own. */
  async atualizar(id: string, dto: AtualizarDisponibilidadeDto) {
    const tx = this.dbContext.getTx();
    try {
      return await tx.disponibilidadeFornecedor.update({ where: { id }, data: dto });
    } catch (err) {
      throw this.mapErro(err);
    }
  }

  private mapErro(err: unknown): AppException {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') {
        return new AppException(
          'RECURSO_NAO_ENCONTRADO',
          'disponibilidade nao encontrada',
          HttpStatus.NOT_FOUND,
        );
      }
      if (err.code === 'P2002') {
        return new AppException(
          'DISPONIBILIDADE_JA_EXISTE',
          'ja existe disponibilidade declarada para este produto neste hub',
          HttpStatus.CONFLICT,
        );
      }
    }
    // CHECK DisponibilidadeFornecedor_min_le_max -- so dispara aqui num
    // UPDATE parcial que deixa quantidadeMinima > quantidadeMaxima contra
    // o valor JA SALVO do outro campo (ver nota no DTO). Descoberto pelo
    // teste e2e: o Postgres reporta isso como violacao de CHECK (codigo
    // 23514), que o Prisma NAO embrulha como PrismaClientKnownRequestError
    // com um P-code (essa suposicao inicial estava errada) -- vem como
    // PrismaClientUnknownRequestError, so com o codigo do Postgres dentro
    // da mensagem.
    if (
      err instanceof Prisma.PrismaClientUnknownRequestError &&
      err.message.includes('DisponibilidadeFornecedor_min_le_max')
    ) {
      return new AppException(
        'VALIDACAO',
        'quantidadeMinima deve ser menor ou igual a quantidadeMaxima',
        HttpStatus.BAD_REQUEST,
      );
    }
    throw err;
  }
}
