import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

const PREFIXO_TESTE = `e2e-cat-${Date.now()}`;

function emailDe(sufixo: string) {
  return `${PREFIXO_TESTE}-${sufixo}@example.com`;
}

describe('CatalogoModule (e2e)', () => {
  let app: INestApplication<App>;
  // Mesmo padrao de auth.e2e-spec.ts -- cliente via DIRECT_URL (postgres,
  // superuser) pra limpeza e pra inserir fixtures (HubLogistico) que nao tem
  // endpoint de escrita na API (design-backend.md: "sem escrita via API").
  const admin = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL } },
  });

  let hubId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const hub = await admin.hubLogistico.create({
      data: {
        name: `Hub ${PREFIXO_TESTE}`,
        city: 'Manaus',
        fixedDispatchCost: 100,
        variableCostPerM3: 10,
        capacityM3: 50,
      },
    });
    hubId = hub.id;
  });

  afterAll(async () => {
    await admin.lote.deleteMany({ where: { hubId } });
    await admin.produto.deleteMany({
      where: { fornecedor: { document: { contains: PREFIXO_TESTE } } },
    });
    await admin.hubLogistico.deleteMany({ where: { id: hubId } });
    await admin.sessaoRefreshToken.deleteMany({
      where: { usuario: { email: { contains: PREFIXO_TESTE } } },
    });
    await admin.usuario.deleteMany({ where: { email: { contains: PREFIXO_TESTE } } });
    await admin.fornecedor.deleteMany({ where: { document: { contains: PREFIXO_TESTE } } });
    await admin.comprador.deleteMany({ where: { email: { contains: PREFIXO_TESTE } } });
    await admin.$disconnect();
    await app.close();
  });

  async function cadastrarFornecedorEFazerLogin(sufixo: string) {
    const email = emailDe(sufixo);
    await request(app.getHttpServer())
      .post('/auth/cadastro/fornecedor')
      .send({
        name: `Fornecedor ${sufixo}`,
        document: `doc-${PREFIXO_TESTE}-${sufixo}`,
        email,
        senha: 'senha12345',
      })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, senha: 'senha12345' })
      .expect(201);

    const payload = JSON.parse(
      Buffer.from(login.body.accessToken.split('.')[1], 'base64url').toString(),
    );
    return { ...(login.body as { accessToken: string; refreshToken: string }), fornecedorId: payload.perfilId as string };
  }

  async function cadastrarCompradorEFazerLogin(sufixo: string) {
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

  describe('Produtos', () => {
    it('GET /produtos e publico e retorna paginado sem autenticacao', async () => {
      const resposta = await request(app.getHttpServer()).get('/produtos').expect(200);
      expect(resposta.body).toMatchObject({ page: 1, pageSize: 20 });
      expect(Array.isArray(resposta.body.items)).toBe(true);
    });

    it('POST /produtos sem token -> 401 NAO_AUTENTICADO', async () => {
      const resposta = await request(app.getHttpServer())
        .post('/produtos')
        .send({ name: 'x', unitPrice: 1 })
        .expect(401);
      expect(resposta.body.error.code).toBe('NAO_AUTENTICADO');
    });

    it('COMPRADOR autenticado nao pode criar produto -> 403 SEM_PERMISSAO', async () => {
      const comprador = await cadastrarCompradorEFazerLogin('comprador-sem-permissao');
      const resposta = await request(app.getHttpServer())
        .post('/produtos')
        .set('Authorization', `Bearer ${comprador.accessToken}`)
        .send({ name: 'Produto ilegitimo', unitPrice: 10 })
        .expect(403);
      expect(resposta.body.error.code).toBe('SEM_PERMISSAO');
    });

    it('fornecedor cadastra -> login -> cria produto -> aparece no GET /produtos/:id', async () => {
      const fornecedor = await cadastrarFornecedorEFazerLogin('a');

      const criado = await request(app.getHttpServer())
        .post('/produtos')
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ name: 'Caixa de parafusos', description: '100 unidades', unitPrice: 25.5 })
        .expect(201);

      expect(criado.body.fornecedorId).toBe(fornecedor.fornecedorId);

      const buscado = await request(app.getHttpServer())
        .get(`/produtos/${criado.body.id}`)
        .expect(200);
      expect(buscado.body.name).toBe('Caixa de parafusos');
    });

    it('GET /produtos?fornecedorId= filtra por fornecedor', async () => {
      const fornecedorB = await cadastrarFornecedorEFazerLogin('b');
      const fornecedorC = await cadastrarFornecedorEFazerLogin('c');

      await request(app.getHttpServer())
        .post('/produtos')
        .set('Authorization', `Bearer ${fornecedorB.accessToken}`)
        .send({ name: 'Produto B', unitPrice: 5 })
        .expect(201);
      await request(app.getHttpServer())
        .post('/produtos')
        .set('Authorization', `Bearer ${fornecedorC.accessToken}`)
        .send({ name: 'Produto C', unitPrice: 5 })
        .expect(201);

      const resposta = await request(app.getHttpServer())
        .get(`/produtos?fornecedorId=${fornecedorB.fornecedorId}`)
        .expect(200);

      expect(resposta.body.items.length).toBeGreaterThanOrEqual(1);
      expect(
        resposta.body.items.every((p: { fornecedorId: string }) => p.fornecedorId === fornecedorB.fornecedorId),
      ).toBe(true);
    });

    it('fornecedor atualiza o proprio produto', async () => {
      const fornecedor = await cadastrarFornecedorEFazerLogin('d');
      const criado = await request(app.getHttpServer())
        .post('/produtos')
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ name: 'Nome antigo', unitPrice: 10 })
        .expect(201);

      const atualizado = await request(app.getHttpServer())
        .patch(`/produtos/${criado.body.id}`)
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ name: 'Nome novo' })
        .expect(200);

      expect(atualizado.body.name).toBe('Nome novo');
    });

    it('RLS impede um fornecedor de editar o produto de outro -- 404 RECURSO_NAO_ENCONTRADO, nao 403', async () => {
      const dono = await cadastrarFornecedorEFazerLogin('e-dono');
      const intruso = await cadastrarFornecedorEFazerLogin('e-intruso');

      const criado = await request(app.getHttpServer())
        .post('/produtos')
        .set('Authorization', `Bearer ${dono.accessToken}`)
        .send({ name: 'Produto do dono', unitPrice: 10 })
        .expect(201);

      const resposta = await request(app.getHttpServer())
        .patch(`/produtos/${criado.body.id}`)
        .set('Authorization', `Bearer ${intruso.accessToken}`)
        .send({ name: 'Tentativa de roubo' })
        .expect(404);

      expect(resposta.body.error.code).toBe('RECURSO_NAO_ENCONTRADO');
    });

    it('fornecedor remove o proprio produto -- 204, e some do catalogo', async () => {
      const fornecedor = await cadastrarFornecedorEFazerLogin('f');
      const criado = await request(app.getHttpServer())
        .post('/produtos')
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ name: 'Produto descartavel', unitPrice: 1 })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/produtos/${criado.body.id}`)
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .expect(204);

      const resposta = await request(app.getHttpServer())
        .get(`/produtos/${criado.body.id}`)
        .expect(404);
      expect(resposta.body.error.code).toBe('RECURSO_NAO_ENCONTRADO');
    });

    it('remover produto com lote associado -> 409 RECURSO_EM_USO', async () => {
      const fornecedor = await cadastrarFornecedorEFazerLogin('g');
      const criado = await request(app.getHttpServer())
        .post('/produtos')
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ name: 'Produto com lote', unitPrice: 1 })
        .expect(201);

      await admin.lote.create({ data: { produtoId: criado.body.id, hubId } });

      const resposta = await request(app.getHttpServer())
        .delete(`/produtos/${criado.body.id}`)
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .expect(409);
      expect(resposta.body.error.code).toBe('RECURSO_EM_USO');
    });

    it('payload invalido (unitPrice negativo) -> 400 VALIDACAO', async () => {
      const fornecedor = await cadastrarFornecedorEFazerLogin('h');
      const resposta = await request(app.getHttpServer())
        .post('/produtos')
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ name: 'Produto invalido', unitPrice: -5 })
        .expect(400);
      expect(resposta.body.error.code).toBe('VALIDACAO');
    });
  });

  describe('Fornecedores', () => {
    it('GET /fornecedores e publico e paginado', async () => {
      const resposta = await request(app.getHttpServer()).get('/fornecedores').expect(200);
      expect(resposta.body).toMatchObject({ page: 1, pageSize: 20 });
    });

    it('GET /fornecedores/:id retorna o cadastro', async () => {
      const fornecedor = await cadastrarFornecedorEFazerLogin('i');
      const resposta = await request(app.getHttpServer())
        .get(`/fornecedores/${fornecedor.fornecedorId}`)
        .expect(200);
      expect(resposta.body.id).toBe(fornecedor.fornecedorId);
    });

    it('PATCH /fornecedores/me atualiza o proprio cadastro', async () => {
      const fornecedor = await cadastrarFornecedorEFazerLogin('j');
      const resposta = await request(app.getHttpServer())
        .patch('/fornecedores/me')
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ name: 'Nome Atualizado' })
        .expect(200);
      expect(resposta.body.name).toBe('Nome Atualizado');
    });

    it('PATCH /fornecedores/me por um COMPRADOR -> 403 SEM_PERMISSAO', async () => {
      const comprador = await cadastrarCompradorEFazerLogin('comprador-patch-fornecedor');
      const resposta = await request(app.getHttpServer())
        .patch('/fornecedores/me')
        .set('Authorization', `Bearer ${comprador.accessToken}`)
        .send({ name: 'x' })
        .expect(403);
      expect(resposta.body.error.code).toBe('SEM_PERMISSAO');
    });
  });

  describe('Hubs', () => {
    it('GET /hubs e publico, paginado, e inclui o hub de fixture', async () => {
      const resposta = await request(app.getHttpServer()).get('/hubs').expect(200);
      expect(resposta.body.items.some((h: { id: string }) => h.id === hubId)).toBe(true);
    });

    it('GET /hubs/:id retorna o hub', async () => {
      const resposta = await request(app.getHttpServer()).get(`/hubs/${hubId}`).expect(200);
      expect(resposta.body.city).toBe('Manaus');
    });

    it('GET /hubs/:id inexistente -> 404 RECURSO_NAO_ENCONTRADO', async () => {
      const resposta = await request(app.getHttpServer())
        .get('/hubs/hub-que-nao-existe')
        .expect(404);
      expect(resposta.body.error.code).toBe('RECURSO_NAO_ENCONTRADO');
    });
  });
});
