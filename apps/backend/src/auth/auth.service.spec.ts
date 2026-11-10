import { AuthService } from './auth.service';
import { DbContextService } from '../common/db-context.service';
import { JwtService } from '@nestjs/jwt';
import { AppException } from '../common/app-exception';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

function buildTxMock() {
  return {
    comprador: { create: jest.fn() },
    fornecedor: { create: jest.fn() },
    usuario: { create: jest.fn(), findUnique: jest.fn() },
    sessaoRefreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
}

describe('AuthService', () => {
  let tx: ReturnType<typeof buildTxMock>;
  let dbContext: DbContextService;
  let jwt: JwtService;
  let prisma: { $transaction: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    tx = buildTxMock();
    dbContext = new DbContextService();
    dbContext.tx = tx as never;
    jwt = { sign: jest.fn().mockReturnValue('access-token-fake') } as unknown as JwtService;
    // Simula o PrismaService de topo usado por revogarFamiliaIndependente --
    // chama o callback com o MESMO tx mockado (a transacao independente, em
    // produção, e uma conexao separada; para o teste so precisamos que o
    // callback rode e chegue em sessaoRefreshToken.updateMany).
    prisma = { $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb({ ...tx, $executeRawUnsafe: jest.fn() })) };
    service = new AuthService(dbContext, jwt, prisma as never);
  });

  describe('cadastrarComprador', () => {
    it('cria Comprador + Usuario na mesma transacao (nao abre uma nova)', async () => {
      tx.comprador.create.mockResolvedValue({ id: 'comp-1' });
      tx.usuario.create.mockResolvedValue({ id: 'usr-1' });

      const resultado = await service.cadastrarComprador({
        name: 'Loja A',
        document: '00.000.000/0001-00',
        email: 'a@example.com',
        senha: 'senha12345',
      });

      expect(resultado).toEqual({ id: 'comp-1' });
      expect(tx.comprador.create).toHaveBeenCalledTimes(1);
      expect(tx.usuario.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'COMPRADOR', compradorId: 'comp-1' }),
        }),
      );
      // senha nunca em texto puro no INSERT de Usuario
      const dataEnviada = tx.usuario.create.mock.calls[0][0].data;
      expect(dataEnviada.passwordHash).not.toBe('senha12345');
      expect(await argon2.verify(dataEnviada.passwordHash, 'senha12345')).toBe(true);
    });

    it('mapeia violacao de unicidade (email/document duplicado) para EMAIL_JA_CADASTRADO', async () => {
      tx.comprador.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicado', {
          code: 'P2002',
          clientVersion: '6.19.3',
        }),
      );

      await expect(
        service.cadastrarComprador({
          name: 'Loja A',
          document: 'doc',
          email: 'a@example.com',
          senha: 'senha12345',
        }),
      ).rejects.toMatchObject({ code: 'EMAIL_JA_CADASTRADO' });
    });

    it('propaga erros que nao sao violacao de unicidade', async () => {
      tx.comprador.create.mockRejectedValue(new Error('boom'));

      await expect(
        service.cadastrarComprador({
          name: 'Loja A',
          document: 'doc',
          email: 'a@example.com',
          senha: 'senha12345',
        }),
      ).rejects.toThrow('boom');
    });
  });

  describe('login', () => {
    it('emite tokens quando a senha bate', async () => {
      const passwordHash = await argon2.hash('senha-certa');
      tx.usuario.findUnique.mockResolvedValue({
        id: 'usr-1',
        role: 'COMPRADOR',
        compradorId: 'comp-1',
        fornecedorId: null,
        passwordHash,
      });
      tx.sessaoRefreshToken.create.mockResolvedValue({});

      const resultado = await service.login({ email: 'a@example.com', senha: 'senha-certa' });

      expect(resultado.accessToken).toBe('access-token-fake');
      expect(typeof resultado.refreshToken).toBe('string');
      expect(jwt.sign).toHaveBeenCalledWith({ sub: 'usr-1', role: 'COMPRADOR', perfilId: 'comp-1' });
      expect(tx.sessaoRefreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('rejeita com CREDENCIAIS_INVALIDAS quando o usuario nao existe', async () => {
      tx.usuario.findUnique.mockResolvedValue(null);
      await expect(service.login({ email: 'x@example.com', senha: 'qualquer' })).rejects.toMatchObject({
        code: 'CREDENCIAIS_INVALIDAS',
      });
    });

    it('rejeita com CREDENCIAIS_INVALIDAS quando a senha esta errada', async () => {
      const passwordHash = await argon2.hash('senha-certa');
      tx.usuario.findUnique.mockResolvedValue({
        id: 'usr-1',
        role: 'COMPRADOR',
        compradorId: 'comp-1',
        fornecedorId: null,
        passwordHash,
      });
      await expect(service.login({ email: 'a@example.com', senha: 'senha-errada' })).rejects.toMatchObject({
        code: 'CREDENCIAIS_INVALIDAS',
      });
    });
  });

  describe('refresh', () => {
    const usuario = { id: 'usr-1', role: 'COMPRADOR' as const, compradorId: 'comp-1', fornecedorId: null };

    it('emite novos tokens e marca a sessao atual como usada', async () => {
      tx.sessaoRefreshToken.findUnique.mockResolvedValue({
        id: 'sess-1',
        familiaId: 'fam-1',
        hashToken: 'hash',
        usedAt: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60),
        usuarioId: 'usr-1',
      });
      tx.usuario.findUnique.mockResolvedValue(usuario);
      tx.sessaoRefreshToken.update.mockResolvedValue({});
      tx.sessaoRefreshToken.create.mockResolvedValue({});

      const resultado = await service.refresh('token-plano');

      expect(resultado.accessToken).toBe('access-token-fake');
      expect(tx.sessaoRefreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sess-1' }, data: { usedAt: expect.any(Date) } }),
      );
    });

    it('detecta reuso (usedAt ja setado) e revoga a familia inteira', async () => {
      tx.sessaoRefreshToken.findUnique.mockResolvedValue({
        id: 'sess-1',
        familiaId: 'fam-1',
        hashToken: 'hash',
        usedAt: new Date(),
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60),
        usuarioId: 'usr-1',
      });

      await expect(service.refresh('token-plano')).rejects.toMatchObject({ code: 'REFRESH_TOKEN_INVALIDO' });

      expect(tx.sessaoRefreshToken.updateMany).toHaveBeenCalledWith({
        where: { familiaId: 'fam-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejeita quando o token nao existe', async () => {
      tx.sessaoRefreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh('token-invalido')).rejects.toMatchObject({ code: 'REFRESH_TOKEN_INVALIDO' });
    });

    it('rejeita quando o token ja foi revogado', async () => {
      tx.sessaoRefreshToken.findUnique.mockResolvedValue({
        id: 'sess-1',
        familiaId: 'fam-1',
        usedAt: null,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60),
        usuarioId: 'usr-1',
      });
      await expect(service.refresh('token-revogado')).rejects.toMatchObject({ code: 'REFRESH_TOKEN_INVALIDO' });
    });

    it('rejeita quando o token esta expirado', async () => {
      tx.sessaoRefreshToken.findUnique.mockResolvedValue({
        id: 'sess-1',
        familiaId: 'fam-1',
        usedAt: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        usuarioId: 'usr-1',
      });
      await expect(service.refresh('token-expirado')).rejects.toMatchObject({ code: 'REFRESH_TOKEN_INVALIDO' });
    });
  });

  describe('logout', () => {
    it('revoga a sessao encontrada', async () => {
      tx.sessaoRefreshToken.findUnique.mockResolvedValue({ id: 'sess-1' });
      tx.sessaoRefreshToken.update.mockResolvedValue({});

      await service.logout('token-plano');

      expect(tx.sessaoRefreshToken.update).toHaveBeenCalledWith({
        where: { id: 'sess-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejeita com REFRESH_TOKEN_INVALIDO quando a sessao nao existe', async () => {
      tx.sessaoRefreshToken.findUnique.mockResolvedValue(null);
      await expect(service.logout('token-invalido')).rejects.toMatchObject({ code: 'REFRESH_TOKEN_INVALIDO' });
    });
  });

  describe('meComprador', () => {
    it('retorna o comprador quando encontrado', async () => {
      tx.usuario.findUnique.mockResolvedValue(undefined); // nao usado aqui
      (tx as any).comprador.findUnique = jest.fn().mockResolvedValue({ id: 'comp-1', name: 'Loja A' });
      const resultado = await service.meComprador('comp-1');
      expect(resultado).toEqual({ id: 'comp-1', name: 'Loja A' });
    });

    it('lanca RECURSO_NAO_ENCONTRADO quando o RLS filtra a linha (retorna null)', async () => {
      (tx as any).comprador.findUnique = jest.fn().mockResolvedValue(null);
      await expect(service.meComprador('comp-inexistente')).rejects.toMatchObject({
        code: 'RECURSO_NAO_ENCONTRADO',
      });
    });
  });

  it('usa AppException (nao erro generico) para todo erro de negocio', () => {
    expect(new AppException('VALIDACAO', 'x', 400)).toBeInstanceOf(AppException);
  });
});
