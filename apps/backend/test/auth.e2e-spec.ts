import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PREFIXO_TESTE = `e2e-${Date.now()}`;

function emailDe(sufixo: string) {
  return `${PREFIXO_TESTE}-${sufixo}@example.com`;
}

describe('AuthModule (e2e)', () => {
  let app: INestApplication<App>;
  // Cliente de limpeza, conectado via DIRECT_URL (postgres, superuser) --
  // nenhum role de runtime (app_auth/app_comprador/app_service) tem DELETE
  // em Comprador/Usuario, de proposito (ver design-backend.md). So pra
  // apagar o que este teste cria.
  const limpeza = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL } },
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await limpeza.sessaoRefreshToken.deleteMany({
      where: { usuario: { email: { contains: PREFIXO_TESTE } } },
    });
    await limpeza.usuario.deleteMany({ where: { email: { contains: PREFIXO_TESTE } } });
    await limpeza.comprador.deleteMany({ where: { email: { contains: PREFIXO_TESTE } } });
    await limpeza.fornecedor.deleteMany({ where: { document: { contains: PREFIXO_TESTE } } });
    await limpeza.$disconnect();
    await app.close();
  });

  async function cadastrarEFazerLogin(sufixo: string) {
    const email = emailDe(sufixo);
    await request(app.getHttpServer())
      .post('/auth/cadastro/comprador')
      .send({ name: `Comprador ${sufixo}`, document: `doc-${PREFIXO_TESTE}-${sufixo}`, email, senha: 'senha12345' })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, senha: 'senha12345' })
      .expect(201);

    return login.body as { accessToken: string; refreshToken: string };
  }

  it('cadastro -> login -> GET /auth/me autenticado -> RLS valida na mesma chamada', async () => {
    const { accessToken } = await cadastrarEFazerLogin('a');

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(me.body.email).toBe(emailDe('a'));
  });

  it('GET /auth/me sem token -> 401 NAO_AUTENTICADO', async () => {
    const resposta = await request(app.getHttpServer()).get('/auth/me').expect(401);
    expect(resposta.body.error.code).toBe('NAO_AUTENTICADO');
  });

  it('login com senha errada -> 401 CREDENCIAIS_INVALIDAS', async () => {
    const email = emailDe('b');
    await request(app.getHttpServer())
      .post('/auth/cadastro/comprador')
      .send({ name: 'Comprador B', document: `doc-${PREFIXO_TESTE}-b`, email, senha: 'senha12345' })
      .expect(201);

    const resposta = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, senha: 'senha-errada' })
      .expect(401);

    expect(resposta.body.error.code).toBe('CREDENCIAIS_INVALIDAS');
  });

  it('RLS impede um comprador de ver dados de outro via /auth/me', async () => {
    const compradorC = await cadastrarEFazerLogin('c');
    const compradorD = await cadastrarEFazerLogin('d');

    const meC = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${compradorC.accessToken}`)
      .expect(200);
    const meD = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${compradorD.accessToken}`)
      .expect(200);

    expect(meC.body.email).toBe(emailDe('c'));
    expect(meD.body.email).toBe(emailDe('d'));
    expect(meC.body.id).not.toBe(meD.body.id);
  });

  it('reuso de refresh token revoga a familia inteira (inclusive o token seguinte, ainda nao usado)', async () => {
    const { refreshToken: rt0 } = await cadastrarEFazerLogin('e');

    const primeiroRefresh = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: rt0 })
      .expect(201);
    const rt1 = primeiroRefresh.body.refreshToken as string;

    // Reapresentar rt0 (ja usado) -- reuso detectado.
    const reuso = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: rt0 })
      .expect(401);
    expect(reuso.body.error.code).toBe('REFRESH_TOKEN_INVALIDO');

    // rt1 nunca foi "usado" antes desta linha, mas a familia inteira foi
    // revogada pela deteccao de reuso -- tambem deve falhar.
    const rt1DepoisDoReuso = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: rt1 })
      .expect(401);
    expect(rt1DepoisDoReuso.body.error.code).toBe('REFRESH_TOKEN_INVALIDO');
  });

  it('logout revoga o refresh token -- uso subsequente falha', async () => {
    const { refreshToken } = await cadastrarEFazerLogin('f');

    await request(app.getHttpServer()).post('/auth/logout').send({ refreshToken }).expect(201);

    const resposta = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
    expect(resposta.body.error.code).toBe('REFRESH_TOKEN_INVALIDO');
  });

  it('payload invalido no cadastro -> 400 VALIDACAO', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/auth/cadastro/comprador')
      .send({ name: '', document: '', email: 'nao-e-email', senha: '123' })
      .expect(400);
    expect(resposta.body.error.code).toBe('VALIDACAO');
  });

  it('cadastro com email duplicado -> 409 EMAIL_JA_CADASTRADO', async () => {
    const email = emailDe('g');
    const payload = { name: 'Comprador G', document: `doc-${PREFIXO_TESTE}-g`, email, senha: 'senha12345' };
    await request(app.getHttpServer()).post('/auth/cadastro/comprador').send(payload).expect(201);

    const resposta = await request(app.getHttpServer())
      .post('/auth/cadastro/comprador')
      .send({ ...payload, document: `doc-${PREFIXO_TESTE}-g2` })
      .expect(409);
    expect(resposta.body.error.code).toBe('EMAIL_JA_CADASTRADO');
  });

  it('cadastro de fornecedor funciona (role app_auth, sem perfil de comprador)', async () => {
    await request(app.getHttpServer())
      .post('/auth/cadastro/fornecedor')
      .send({
        name: 'Fornecedor H',
        document: `doc-${PREFIXO_TESTE}-h`,
        email: emailDe('h'),
        senha: 'senha12345',
      })
      .expect(201);
  });

  it('[fail-closed] a conexao de runtime (app_backend) nao tem privilegio direto algum sem SET ROLE', async () => {
    const prisma = app.get(PrismaService);
    await expect(prisma.pedidoLote.findMany()).rejects.toThrow(/permission denied/i);
  });
});
