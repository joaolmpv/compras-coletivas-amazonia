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
    await admin.disponibilidadeFornecedor.deleteMany({
      where: { fornecedor: { document: { contains: PREFIXO_TESTE } } },
    });
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
        .send({ name: 'x', precoPorUnidade: 1, unidadeComercial: 'saco 50kg', pesoPorUnidadeKg: 50, volumePorUnidadeM3: 0.04 })
        .expect(401);
      expect(resposta.body.error.code).toBe('NAO_AUTENTICADO');
    });

    it('COMPRADOR autenticado nao pode criar produto -> 403 SEM_PERMISSAO', async () => {
      const comprador = await cadastrarCompradorEFazerLogin('comprador-sem-permissao');
      const resposta = await request(app.getHttpServer())
        .post('/produtos')
        .set('Authorization', `Bearer ${comprador.accessToken}`)
        .send({ name: 'Produto ilegitimo', precoPorUnidade: 10, unidadeComercial: 'saco 50kg', pesoPorUnidadeKg: 50, volumePorUnidadeM3: 0.04 })
        .expect(403);
      expect(resposta.body.error.code).toBe('SEM_PERMISSAO');
    });

    it('fornecedor cadastra -> login -> cria produto -> aparece no GET /produtos/:id', async () => {
      const fornecedor = await cadastrarFornecedorEFazerLogin('a');

      const criado = await request(app.getHttpServer())
        .post('/produtos')
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ name: 'Caixa de parafusos', description: '100 unidades', precoPorUnidade: 25.5, unidadeComercial: 'saco 50kg', pesoPorUnidadeKg: 50, volumePorUnidadeM3: 0.04 })
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
        .send({ name: 'Produto B', precoPorUnidade: 5, unidadeComercial: 'saco 50kg', pesoPorUnidadeKg: 50, volumePorUnidadeM3: 0.04 })
        .expect(201);
      await request(app.getHttpServer())
        .post('/produtos')
        .set('Authorization', `Bearer ${fornecedorC.accessToken}`)
        .send({ name: 'Produto C', precoPorUnidade: 5, unidadeComercial: 'saco 50kg', pesoPorUnidadeKg: 50, volumePorUnidadeM3: 0.04 })
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
        .send({ name: 'Nome antigo', precoPorUnidade: 10, unidadeComercial: 'saco 50kg', pesoPorUnidadeKg: 50, volumePorUnidadeM3: 0.04 })
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
        .send({ name: 'Produto do dono', precoPorUnidade: 10, unidadeComercial: 'saco 50kg', pesoPorUnidadeKg: 50, volumePorUnidadeM3: 0.04 })
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
        .send({ name: 'Produto descartavel', precoPorUnidade: 1, unidadeComercial: 'saco 50kg', pesoPorUnidadeKg: 50, volumePorUnidadeM3: 0.04 })
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
        .send({ name: 'Produto com lote', precoPorUnidade: 1, unidadeComercial: 'saco 50kg', pesoPorUnidadeKg: 50, volumePorUnidadeM3: 0.04 })
        .expect(201);

      await admin.lote.create({ data: { produtoId: criado.body.id, hubId } });

      const resposta = await request(app.getHttpServer())
        .delete(`/produtos/${criado.body.id}`)
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .expect(409);
      expect(resposta.body.error.code).toBe('RECURSO_EM_USO');
    });

    it('payload invalido (precoPorUnidade negativo) -> 400 VALIDACAO', async () => {
      const fornecedor = await cadastrarFornecedorEFazerLogin('h');
      const resposta = await request(app.getHttpServer())
        .post('/produtos')
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ name: 'Produto invalido', precoPorUnidade: -5, unidadeComercial: 'saco 50kg', pesoPorUnidadeKg: 50, volumePorUnidadeM3: 0.04 })
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

  describe('Disponibilidades (D-B)', () => {
    async function criarProduto(token: string, nome: string) {
      const resposta = await request(app.getHttpServer())
        .post('/produtos')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: nome, precoPorUnidade: 10, unidadeComercial: 'saco 50kg', pesoPorUnidadeKg: 50, volumePorUnidadeM3: 0.04 })
        .expect(201);
      return resposta.body.id as string;
    }

    it('POST /disponibilidades sem token -> 401 NAO_AUTENTICADO', async () => {
      const resposta = await request(app.getHttpServer())
        .post('/disponibilidades')
        .send({ produtoId: 'x', hubId, quantidadeMinima: 1, quantidadeMaxima: 10, prazoMaximoEsperaDias: 5 })
        .expect(401);
      expect(resposta.body.error.code).toBe('NAO_AUTENTICADO');
    });

    it('COMPRADOR autenticado nao pode criar disponibilidade -> 403 SEM_PERMISSAO', async () => {
      const comprador = await cadastrarCompradorEFazerLogin('comprador-disponibilidade');
      const resposta = await request(app.getHttpServer())
        .post('/disponibilidades')
        .set('Authorization', `Bearer ${comprador.accessToken}`)
        .send({ produtoId: 'x', hubId, quantidadeMinima: 1, quantidadeMaxima: 10, prazoMaximoEsperaDias: 5 })
        .expect(403);
      expect(resposta.body.error.code).toBe('SEM_PERMISSAO');
    });

    it('fornecedor declara disponibilidade pro proprio produto -> 201, aparece no GET /disponibilidades/:id', async () => {
      const fornecedor = await cadastrarFornecedorEFazerLogin('disp-a');
      const produtoId = await criarProduto(fornecedor.accessToken, 'Produto com disponibilidade');

      const criada = await request(app.getHttpServer())
        .post('/disponibilidades')
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ produtoId, hubId, quantidadeMinima: 10, quantidadeMaxima: 100, prazoMaximoEsperaDias: 7 })
        .expect(201);

      expect(criada.body.fornecedorId).toBe(fornecedor.fornecedorId);

      const buscada = await request(app.getHttpServer())
        .get(`/disponibilidades/${criada.body.id}`)
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .expect(200);
      expect(buscada.body.quantidadeMaxima).toBe(100);
    });

    it('fornecedor nao pode declarar disponibilidade pro produto de OUTRO fornecedor -- 403, RLS nao pegaria isso', async () => {
      const dono = await cadastrarFornecedorEFazerLogin('disp-b-dono');
      const intruso = await cadastrarFornecedorEFazerLogin('disp-b-intruso');
      const produtoId = await criarProduto(dono.accessToken, 'Produto do dono (disponibilidade)');

      const resposta = await request(app.getHttpServer())
        .post('/disponibilidades')
        .set('Authorization', `Bearer ${intruso.accessToken}`)
        .send({ produtoId, hubId, quantidadeMinima: 1, quantidadeMaxima: 10, prazoMaximoEsperaDias: 5 })
        .expect(403);
      expect(resposta.body.error.code).toBe('SEM_PERMISSAO');
    });

    it('criar com produtoId inexistente -> 404 RECURSO_NAO_ENCONTRADO', async () => {
      const fornecedor = await cadastrarFornecedorEFazerLogin('disp-c');
      const resposta = await request(app.getHttpServer())
        .post('/disponibilidades')
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({
          produtoId: 'produto-que-nao-existe',
          hubId,
          quantidadeMinima: 1,
          quantidadeMaxima: 10,
          prazoMaximoEsperaDias: 5,
        })
        .expect(404);
      expect(resposta.body.error.code).toBe('RECURSO_NAO_ENCONTRADO');
    });

    it('payload invalido (quantidadeMinima > quantidadeMaxima) -> 400 VALIDACAO', async () => {
      const fornecedor = await cadastrarFornecedorEFazerLogin('disp-d');
      const produtoId = await criarProduto(fornecedor.accessToken, 'Produto payload invalido');
      const resposta = await request(app.getHttpServer())
        .post('/disponibilidades')
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ produtoId, hubId, quantidadeMinima: 100, quantidadeMaxima: 10, prazoMaximoEsperaDias: 5 })
        .expect(400);
      expect(resposta.body.error.code).toBe('VALIDACAO');
    });

    it('duas declaracoes para o mesmo produto+hub -> 409 DISPONIBILIDADE_JA_EXISTE', async () => {
      const fornecedor = await cadastrarFornecedorEFazerLogin('disp-e');
      const produtoId = await criarProduto(fornecedor.accessToken, 'Produto duplicado');
      await request(app.getHttpServer())
        .post('/disponibilidades')
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ produtoId, hubId, quantidadeMinima: 1, quantidadeMaxima: 10, prazoMaximoEsperaDias: 5 })
        .expect(201);

      const resposta = await request(app.getHttpServer())
        .post('/disponibilidades')
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ produtoId, hubId, quantidadeMinima: 2, quantidadeMaxima: 20, prazoMaximoEsperaDias: 5 })
        .expect(409);
      expect(resposta.body.error.code).toBe('DISPONIBILIDADE_JA_EXISTE');
    });

    it('GET /disponibilidades isola por fornecedor (RLS, nao WHERE)', async () => {
      const fornecedorF = await cadastrarFornecedorEFazerLogin('disp-f');
      const fornecedorG = await cadastrarFornecedorEFazerLogin('disp-g');
      const produtoF = await criarProduto(fornecedorF.accessToken, 'Produto F');
      const produtoG = await criarProduto(fornecedorG.accessToken, 'Produto G');

      await request(app.getHttpServer())
        .post('/disponibilidades')
        .set('Authorization', `Bearer ${fornecedorF.accessToken}`)
        .send({ produtoId: produtoF, hubId, quantidadeMinima: 1, quantidadeMaxima: 10, prazoMaximoEsperaDias: 5 })
        .expect(201);
      await request(app.getHttpServer())
        .post('/disponibilidades')
        .set('Authorization', `Bearer ${fornecedorG.accessToken}`)
        .send({ produtoId: produtoG, hubId, quantidadeMinima: 1, quantidadeMaxima: 10, prazoMaximoEsperaDias: 5 })
        .expect(201);

      const listaF = await request(app.getHttpServer())
        .get('/disponibilidades')
        .set('Authorization', `Bearer ${fornecedorF.accessToken}`)
        .expect(200);

      expect(listaF.body.items.length).toBeGreaterThanOrEqual(1);
      expect(
        listaF.body.items.every((d: { fornecedorId: string }) => d.fornecedorId === fornecedorF.fornecedorId),
      ).toBe(true);
    });

    it('fornecedor B nao ve nem edita a disponibilidade do fornecedor A via :id -- 404, nao 403 (RLS)', async () => {
      const fornecedorA = await cadastrarFornecedorEFazerLogin('disp-h-a');
      const fornecedorB = await cadastrarFornecedorEFazerLogin('disp-h-b');
      const produtoA = await criarProduto(fornecedorA.accessToken, 'Produto H');

      const criada = await request(app.getHttpServer())
        .post('/disponibilidades')
        .set('Authorization', `Bearer ${fornecedorA.accessToken}`)
        .send({ produtoId: produtoA, hubId, quantidadeMinima: 1, quantidadeMaxima: 10, prazoMaximoEsperaDias: 5 })
        .expect(201);

      const buscaB = await request(app.getHttpServer())
        .get(`/disponibilidades/${criada.body.id}`)
        .set('Authorization', `Bearer ${fornecedorB.accessToken}`)
        .expect(404);
      expect(buscaB.body.error.code).toBe('RECURSO_NAO_ENCONTRADO');

      const patchB = await request(app.getHttpServer())
        .patch(`/disponibilidades/${criada.body.id}`)
        .set('Authorization', `Bearer ${fornecedorB.accessToken}`)
        .send({ quantidadeMaxima: 999 })
        .expect(404);
      expect(patchB.body.error.code).toBe('RECURSO_NAO_ENCONTRADO');
    });

    it('fornecedor atualiza a propria disponibilidade', async () => {
      const fornecedor = await cadastrarFornecedorEFazerLogin('disp-i');
      const produtoId = await criarProduto(fornecedor.accessToken, 'Produto I');
      const criada = await request(app.getHttpServer())
        .post('/disponibilidades')
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ produtoId, hubId, quantidadeMinima: 1, quantidadeMaxima: 10, prazoMaximoEsperaDias: 5 })
        .expect(201);

      const atualizada = await request(app.getHttpServer())
        .patch(`/disponibilidades/${criada.body.id}`)
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ quantidadeMaxima: 500 })
        .expect(200);
      expect(atualizada.body.quantidadeMaxima).toBe(500);
    });

    it('CHECK do banco: UPDATE so de quantidadeMinima pra valor maior que a quantidadeMaxima JA SALVA -> 400 VALIDACAO (P2004)', async () => {
      const fornecedor = await cadastrarFornecedorEFazerLogin('disp-j');
      const produtoId = await criarProduto(fornecedor.accessToken, 'Produto J');
      const criada = await request(app.getHttpServer())
        .post('/disponibilidades')
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ produtoId, hubId, quantidadeMinima: 1, quantidadeMaxima: 10, prazoMaximoEsperaDias: 5 })
        .expect(201);

      // So quantidadeMinima vem no payload -- o Zod nao tem o que comparar
      // (so um campo presente), entao quem precisa rejeitar isso e o CHECK
      // do Postgres contra o quantidadeMaxima=10 ja salvo.
      const resposta = await request(app.getHttpServer())
        .patch(`/disponibilidades/${criada.body.id}`)
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ quantidadeMinima: 999 })
        .expect(400);
      expect(resposta.body.error.code).toBe('VALIDACAO');
    });

    it('nao existe DELETE -- "remover" e encerrar a vigencia (PATCH vigenciaFim), historico preservado', async () => {
      const fornecedor = await cadastrarFornecedorEFazerLogin('disp-k');
      const produtoId = await criarProduto(fornecedor.accessToken, 'Produto K');
      const criada = await request(app.getHttpServer())
        .post('/disponibilidades')
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ produtoId, hubId, quantidadeMinima: 1, quantidadeMaxima: 10, prazoMaximoEsperaDias: 5 })
        .expect(201);

      // Enquanto esta vigente (vigenciaFim null), uma SEGUNDA declaracao
      // pro mesmo produto+hub colide no indice unico parcial.
      const colisao = await request(app.getHttpServer())
        .post('/disponibilidades')
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ produtoId, hubId, quantidadeMinima: 2, quantidadeMaxima: 20, prazoMaximoEsperaDias: 5 })
        .expect(409);
      expect(colisao.body.error.code).toBe('DISPONIBILIDADE_JA_EXISTE');

      // Encerra a vigencia -- a linha continua existindo (historico), so
      // some de "vigente".
      await request(app.getHttpServer())
        .patch(`/disponibilidades/${criada.body.id}`)
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ vigenciaFim: new Date().toISOString() })
        .expect(200);

      const aindaExiste = await request(app.getHttpServer())
        .get(`/disponibilidades/${criada.body.id}`)
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .expect(200);
      expect(aindaExiste.body.vigenciaFim).not.toBeNull();

      // Com a anterior encerrada, uma nova pro mesmo produto+hub agora
      // cabe no indice unico parcial (WHERE vigenciaFim IS NULL).
      await request(app.getHttpServer())
        .post('/disponibilidades')
        .set('Authorization', `Bearer ${fornecedor.accessToken}`)
        .send({ produtoId, hubId, quantidadeMinima: 2, quantidadeMaxima: 20, prazoMaximoEsperaDias: 5 })
        .expect(201);
    });
  });
});
