import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash, randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { DbContextService } from '../common/db-context.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app-exception';
import type { CadastroCompradorDto, CadastroFornecedorDto } from './dto/cadastro.dto';
import type { LoginDto } from './dto/login.dto';
import type { Principal } from '../common/principal';

const REFRESH_TOKEN_BYTES = 32;

export interface TokensResponse {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  // @Inject() explicito -- ver nota em rls.interceptor.ts (isolatedModules
  // + emitDecoratorMetadata nao resolve tipo cross-file de forma confiavel).
  constructor(
    @Inject(DbContextService) private readonly dbContext: DbContextService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async cadastrarComprador(dto: CadastroCompradorDto): Promise<{ id: string }> {
    // Nao abre uma NOVA transacao -- `tx` ja e a transacao por requisicao
    // aberta pelo RlsInterceptor (role app_auth); os dois INSERTs abaixo ja
    // sao atomicos por estarem na mesma transacao. Prisma.TransactionClient
    // nao tem `$transaction` proprio (so o PrismaClient de topo tem).
    const tx = this.dbContext.getTx();
    const passwordHash = await argon2.hash(dto.senha);

    try {
      const comprador = await tx.comprador.create({
        data: { name: dto.name, document: dto.document, email: dto.email },
      });
      await tx.usuario.create({
        data: {
          email: dto.email,
          passwordHash,
          role: 'COMPRADOR',
          compradorId: comprador.id,
        },
      });
      return { id: comprador.id };
    } catch (err) {
      throw this.mapUniqueViolation(err);
    }
  }

  async cadastrarFornecedor(dto: CadastroFornecedorDto): Promise<{ id: string }> {
    const tx = this.dbContext.getTx();
    const passwordHash = await argon2.hash(dto.senha);

    try {
      const fornecedor = await tx.fornecedor.create({
        data: { name: dto.name, document: dto.document },
      });
      await tx.usuario.create({
        data: {
          email: dto.email,
          passwordHash,
          role: 'FORNECEDOR',
          fornecedorId: fornecedor.id,
        },
      });
      return { id: fornecedor.id };
    } catch (err) {
      throw this.mapUniqueViolation(err);
    }
  }

  async login(dto: LoginDto): Promise<TokensResponse> {
    const tx = this.dbContext.getTx();
    const usuario = await tx.usuario.findUnique({ where: { email: dto.email } });

    if (!usuario || !(await argon2.verify(usuario.passwordHash, dto.senha))) {
      throw new AppException(
        'CREDENCIAIS_INVALIDAS',
        'email ou senha invalidos',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const familiaId = randomUUID();
    return this.emitirTokens(usuario, familiaId);
  }

  async refresh(refreshTokenPlain: string): Promise<TokensResponse> {
    const tx = this.dbContext.getTx();
    const hashToken = AuthService.hash(refreshTokenPlain);

    const sessao = await tx.sessaoRefreshToken.findUnique({ where: { hashToken } });
    if (!sessao || sessao.revokedAt || sessao.expiresAt < new Date()) {
      throw new AppException(
        'REFRESH_TOKEN_INVALIDO',
        'refresh token invalido, revogado ou expirado',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (sessao.usedAt) {
      // Reuso detectado -- token ja consumido sendo apresentado de novo.
      // Revoga toda a familia: possivel sinal de token roubado.
      //
      // Critico: NAO usar `tx` (a transacao por-requisicao aberta pelo
      // RlsInterceptor) aqui. O proximo passo desta funcao e lancar
      // AppException (401) -- e como TODA a requisicao roda dentro de UMA
      // transacao Prisma, uma excecao que escapa do callback de
      // $transaction faz o Prisma dar ROLLBACK em TUDO que aconteceu
      // nela, inclusive esta revogacao. A revogacao da familia e um efeito
      // de seguranca que precisa sobreviver independente da requisicao
      // atual "falhar" -- por isso roda numa transacao PROPRIA, que
      // comita sozinha antes do throw abaixo.
      await this.revogarFamiliaIndependente(sessao.familiaId);
      throw new AppException(
        'REFRESH_TOKEN_INVALIDO',
        'reuso de refresh token detectado -- familia revogada',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const usuario = await tx.usuario.findUnique({ where: { id: sessao.usuarioId } });
    if (!usuario) {
      throw new AppException(
        'REFRESH_TOKEN_INVALIDO',
        'usuario da sessao nao encontrado',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await tx.sessaoRefreshToken.update({
      where: { id: sessao.id },
      data: { usedAt: new Date() },
    });

    return this.emitirTokens(usuario, sessao.familiaId);
  }

  async logout(refreshTokenPlain: string): Promise<void> {
    const tx = this.dbContext.getTx();
    const hashToken = AuthService.hash(refreshTokenPlain);

    const sessao = await tx.sessaoRefreshToken.findUnique({ where: { hashToken } });
    if (!sessao) {
      throw new AppException(
        'REFRESH_TOKEN_INVALIDO',
        'refresh token invalido',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await tx.sessaoRefreshToken.update({
      where: { id: sessao.id },
      data: { revokedAt: new Date() },
    });
  }

  /** Perfil do proprio comprador autenticado -- GET /auth/me.
   * Roda como app_comprador (role padrao do RlsInterceptor); a visibilidade
   * vem da politica comprador_self (RLS), nao de um WHERE explicito aqui --
   * e exatamente isso que a E2 precisa provar (login -> RLS na mesma
   * chamada). */
  async meComprador(perfilId: string) {
    const tx = this.dbContext.getTx();
    const comprador = await tx.comprador.findUnique({ where: { id: perfilId } });
    if (!comprador) {
      throw new AppException(
        'RECURSO_NAO_ENCONTRADO',
        'comprador nao encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    return comprador;
  }

  private async emitirTokens(
    usuario: { id: string; role: Principal['role']; compradorId: string | null; fornecedorId: string | null },
    familiaId: string,
  ): Promise<TokensResponse> {
    const tx = this.dbContext.getTx();
    const perfilId = usuario.compradorId ?? usuario.fornecedorId ?? null;

    const payload: Principal = { sub: usuario.id, role: usuario.role, perfilId };
    const accessToken = this.jwt.sign(payload);

    const refreshTokenPlain = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const hashToken = AuthService.hash(refreshTokenPlain);
    const expiresAt = new Date(Date.now() + AuthService.refreshTtlMs());

    await tx.sessaoRefreshToken.create({
      data: {
        usuarioId: usuario.id,
        familiaId,
        hashToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: refreshTokenPlain };
  }

  /** Transacao PROPRIA (nao a do request) -- ver nota em refresh(). Commita
   * de forma independente da transacao da requisicao que a chamou. */
  private async revogarFamiliaIndependente(familiaId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE app_auth');
      await tx.sessaoRefreshToken.updateMany({
        where: { familiaId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  private mapUniqueViolation(err: unknown): AppException {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return new AppException(
        'EMAIL_JA_CADASTRADO',
        'email ou documento ja cadastrado',
        HttpStatus.CONFLICT,
      );
    }
    throw err;
  }

  private static hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private static refreshTtlMs(): number {
    const raw = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
    const match = /^(\d+)([smhd])$/.exec(raw);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const n = Number(match[1]);
    const unit = match[2];
    const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 86_400_000;
    return n * factor;
  }
}
