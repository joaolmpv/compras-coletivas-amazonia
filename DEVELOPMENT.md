# DEVELOPMENT.md — Roteiro de Desenvolvimento

> **Leia este arquivo no início de cada sessão.** Ele é a fonte de verdade sobre
> o que fazer, em que ordem, e sob quais regras. Para detalhe de arquitetura,
> consulte `docs/design-backend.md`.

**Projeto:** Plataforma full-stack de compras coletivas B2B para a Amazônia Legal
**Autor:** João de Lima Paiva — Bacharelado em Ciência da Computação, UFJ
**Orientador:** Prof. Me. Thomaz Felipe Soares Arnizant
**Defesa:** dezembro/2026

---

## 0. Regras inegociáveis

Valem em todas as etapas, sem exceção.

1. **Nunca faça push, abra PR ou mergeie sem pedido explícito.** Commits locais por padrão.
2. **Nunca rode `prisma migrate reset`.** Em nenhuma circunstância, sem perguntar antes.
3. **Nunca edite uma migration já aplicada.** Correção é sempre migration nova.
4. **Pare ao final de cada etapa** e mostre os testes passando, aguardando aprovação antes da etapa seguinte.
5. **Testes primeiro.** Cobertura mínima de 70% por módulo (etapas com código TypeScript).
6. **Mostre o SQL antes de aplicar** qualquer migration.
7. **Não assuma.** Em caso de ambiguidade, pergunte — uma pergunta por vez.
8. **Não reduza escopo por prazo.** Se algo não couber, reporte; a decisão de cortar é do autor.
9. **Não ajuste parâmetros de experimento para atingir um critério.** Reporte o resultado como saiu.
10. **Nunca registre senha, connection string ou segredo** em arquivo versionado.

---

## 1. Estado do ambiente

| Item | Valor |
|---|---|
| Repositório | `~/compras-coletivas-amazonia` (GitHub: `joaolmpv/compras-coletivas-amazonia`) |
| Banco local | Container `tcc_postgres`, porta **5433**, banco `tcc_db` |
| Branch base | `dev` |
| Backend | `apps/backend` — NestJS + Prisma 6 |
| Frontend | `apps/frontend` — Next.js |
| Otimizador | `services/optimizer` — Python, DEAP, scikit-learn |
| Deploy previsto | Vercel (frontend), Railway (backend + otimizador), Supabase (Postgres) |

**Atenção:** o `docker-compose.yml` do repositório **não** é o que está rodando. O
container atual veio de uma pasta anterior. Não rode `docker compose up` sem
alinhar isso antes (pode conflitar na porta 5433).

---

## 2. Objetivos específicos e critérios de aceite

Estes critérios são o que a banca vai cobrar. Não reinterprete.

### OE1 — Otimização de lotes
Framework de duas etapas (K-Means + AG variante MDVRP) em Python com DEAP.
Instâncias de 10, 50 e 200 compradores. Matrizes de custo com os **três modais**
(rodoviário, fluvial, aéreo), com sazonalidade fluvial e faixas do aéreo expresso.
O algoritmo escolhe o modal de menor custo por rota.
**Critério:** redução ≥15% no custo médio de frete por comprador vs. baseline greedy de limiar fixo.

### OE2 — Banco de dados
PostgreSQL + Prisma. Entidades centrais: `Comprador`, `Fornecedor`, `Produto`,
`Lote`, `PedidoLote`, `HubLogistico`, `Avaliacao`. Entidades de suporte: `Usuario`,
`SessaoRefreshToken`, `Pagamento`, `Repasse`, `LogAuditoria`. RLS multi-ator e transações ACID.
**Critério:** tolerância zero a inconsistência em testes de integridade.

### OE3 — Interface e transparência
Next.js com SSR. O comprador deve conseguir reproduzir manualmente o cálculo de
rateio a partir do que a tela exibe.
**Critério:** teste de usabilidade com 3 empreendedores locais; ao menos 2 de 3 reproduzem o cálculo sem ajuda.

### OE4 — Reputação
Sentimento via Google Cloud Natural Language API + 4 métricas operacionais
(taxa de entrega no prazo, índice de reclamações, volume histórico, tempo médio de resposta).
**Critério:** correlação de Pearson ≥0,6 entre o índice e o desempenho histórico objetivo.

---

## 3. Mapa de etapas

| Etapa | Escopo | Status |
|---|---|---|
| **OE1 v1/v2/v3** | Experimentos do otimizador | ✅ Concluída |
| **OE1 v3.1** | Análise estatística adicional | ⬜ Pendente |
| **Design backend** | `docs/design-backend.md` (12 decisões) | ✅ Concluída |
| **E1** | Migrations, RLS, roles, testes de isolamento | ✅ Concluída (mergeada) |
| **E2** | Identidade e autenticação | 🔄 Próxima |
| **E3** | Catálogo (fornecedores, produtos, hubs) | ⬜ Pendente |
| **E4** | Lotes, adesão, rateio, pagamento | ⬜ Pendente |
| **E5** | Integração com o otimizador (fila) | ⬜ Pendente |
| **E6** | Auditoria com hash encadeado | ⬜ Pendente |
| **E7** | SSE e rate limiting | ⬜ Pendente |
| **F1** | Frontend — comprador (lotes + breakdown) | ⬜ Pendente |
| **F2** | Frontend — fornecedor | ⬜ Pendente |
| **F3** | Frontend — administrador | ⬜ Pendente |
| **OE4** | Módulo de reputação | ⬜ Pendente |
| **D1** | Deploy e provisionamento Supabase | ⬜ Pendente |
| **V1** | Teste de usabilidade (3 empreendedores) | ⬜ Pendente — **agendar com antecedência** |
| **T1** | Capítulo de resultados do TCC | ⬜ Pendente |

---

## 4. Backend — etapas detalhadas

Cada etapa: branch própria a partir da `dev`, commits locais, parar ao final.

### E1 — Migrations e RLS ✅

**Entregue:** 7 entidades centrais + 5 de suporte; RLS multi-ator; roles
`app_backend` (NOINHERIT), `app_comprador`, `app_service`, `app_definer`, `app_auth`;
`fn_breakdown_lote` (SECURITY DEFINER, fail-closed, restrita a participantes);
GRANT por coluna em `PedidoLote` e `Avaliacao`; `LogAuditoria` append-only com
trigger de TRUNCATE; `npm run test:rls` com 38 casos e código de saída correto.

**Achados registrados:** bug do GRANT sem a coluna `id` (o `@default(cuid())` do
Prisma é gerado no client); ataque de tabela temporária neutralizado pelo
`search_path = public, pg_temp`.

### E2 — Identidade e autenticação 🔄

**Branch:** `feature/be-e2-auth`

**Escopo:**
- Model `Usuario`: argon2id, papel (`COMPRADOR`/`FORNECEDOR`/`ADMIN`), relação 1:1 opcional com `Comprador`/`Fornecedor`
- Model `SessaoRefreshToken`: armazena hash, família de tokens, detecção de reuso, job de limpeza
- `AuthModule`: login, logout, refresh com rotação, cadastro de Comprador e Fornecedor, guard por papel
- Interceptor por requisição: abre transação, `SET LOCAL ROLE` + `SET LOCAL app.comprador_id` conforme o papel
- JWT de vida curta (15 min); refresh token (7 dias) com rotação e detecção de reuso por família

**Critérios de aceite:**
- Teste de integração via HTTP: login → token → requisição autenticada → RLS validado na mesma chamada
- Reuso de refresh token revoga a família inteira
- Requisição sem `SET LOCAL ROLE` falha por `permission denied` (não passa em silêncio)
- `app_auth` lê `Usuario` e **não** lê `PedidoLote`/`Pagamento`
- Cobertura ≥70% no módulo

### E3 — Catálogo

**Branch:** `feature/be-e3-catalogo`

**Escopo:** módulos de `Fornecedor`, `Produto` e `HubLogistico`, com DTOs Zod,
paginação e códigos de erro padronizados.

**Critérios:** CRUD completo com validação; fornecedor só edita os próprios
produtos; testes de integração por endpoint.

### E4 — Lotes, adesão, rateio e pagamento

**Branch:** `feature/be-e4-lotes`

**Escopo:**
- Criação de lote (fornecedor para os próprios produtos; admin para qualquer um) 🔶
- Adesão do comprador (`PedidoLote`)
- Cálculo de rateio proporcional em transação ACID
- Endpoint de breakdown auditável (via `fn_breakdown_lote`)
- Máquina de estados do lote (`ABERTO` → `FECHADO` → `DESPACHADO` → `ENTREGUE`/`CANCELADO`)
- Pagamento por `PedidoLote` + `Repasse` por `Lote`, com gateway simulado 🔶

**Critérios:**
- O breakdown devolve totais + própria linha identificada + demais anonimizadas, em dados suficientes para refazer a conta
- Rateio nunca deixa o banco inconsistente (teste de concorrência)
- `app_service` recebe os GRANTs desta etapa, com teste via role real
- Transições inválidas de estado são rejeitadas

### E5 — Integração com o otimizador

**Branch:** `feature/be-e5-otimizacao`

**Escopo:** cliente RabbitMQ no NestJS; consumidor `aio-pika` no FastAPI;
idempotência por chave; DLQ e retry; fechamento automático com override do admin 🔶;
versão do algoritmo gravada em cada execução. Manter os endpoints REST do FastAPI
(`/optimize`, `/health`, OpenAPI).

**Critérios:** mensagem duplicada não reprocessa; falha do otimizador não trava o
lote; a versão do algoritmo fica rastreável por execução.

### E6 — Auditoria

**Branch:** `feature/be-e6-auditoria`

**Escopo:** log append-only com hash encadeado, sob advisory lock, integrado às
escritas financeiras e de lotes e aos eventos de autenticação.

**Pergunta em aberto:** quem calcula o hash encadeado, se `app_service` só tem
INSERT? (Proposta: trigger `BEFORE INSERT` que calcula o hash, com leitura dada
só ao dono — impede o serviço de forjar a cadeia.)

**Critérios:** `UPDATE`, `DELETE` e `TRUNCATE` bloqueados; adulteração de um
registro quebra a verificação da cadeia; contenção do advisory lock medida.

### E7 — Tempo real e rate limiting

**Branch:** `feature/be-e7-realtime`

**Escopo:** SSE do estado dos lotes (cookie httpOnly, conexão direta ao NestJS);
rate limiting conforme a tabela da seção 12 do design.

**Limites:** global 100/min/IP; login 5/min/IP+email com backoff; refresh 10/min;
adesão 20/min/usuário; otimização 3/min/admin com dedup; avaliação 10/h/usuário;
3 conexões SSE/usuário.

---

## 5. Frontend — etapas detalhadas

Next.js com SSR (crítico: conexões de baixa largura de banda na região Norte).
Contrato de tipos compartilhado em `packages/shared-types`. Pode começar com mocks
assim que a E2 definir o contrato.

### F1 — Comprador

**Prioridade máxima:** a tela de breakdown é o que será testado com usuários (OE3).

**Telas:** dashboard de lotes ativos (data de fechamento, participantes, economia
vs. frete individual); detalhes do lote com breakdown completo de custos;
acompanhamento de status de entrega; perfil e histórico.

**Critério do breakdown:** o comprador precisa ver o custo total de frete, o volume
total do lote, o próprio volume e a fórmula — dados suficientes para refazer a conta
no papel.

### F2 — Fornecedor

**Telas:** ofertas ativas com status; minha reputação (índice composto com os
componentes explicitados); histórico de repasses.

### F3 — Administrador

**Telas:** dashboard de saúde (taxa de consolidação, economia média, usuários
ativos, lotes processados); gestão de hubs; resolução de disputas; override de
fechamento de lote.

---

## 6. OE4 — Módulo de reputação

**Branch:** `feature/oe4-reputacao`

**Escopo:**
- Integração com a Google Cloud Natural Language API (suporte nativo a pt-BR)
- Índice composto: score de sentimento + taxa de entrega no prazo + índice de reclamações + volume histórico + tempo médio de resposta
- Extração de dimensões qualitativas: pontualidade, qualidade do produto, embalagem, atendimento pós-venda
- Detecção de padrões de insatisfação recorrente (alerta preventivo antes de a média cair)
- Ranking público com critérios de composição explicitados

**Critérios:**
- Correlação de Pearson ≥0,6 entre o índice e o desempenho histórico objetivo, em dados simulados
- Robustez contra avaliação textual manipulada (o componente objetivo limita a manipulação)
- GRANTs desta etapa concedidos a `app_service` com teste via role real

---

## 7. Deploy (D1)

**Provisionamento do Supabase** (script separado, nunca em migration do Prisma):
1. `GRANT app_definer TO postgres` e `GRANT CREATE ON SCHEMA public TO app_definer` — necessários porque o `postgres` do Supabase não é superuser
2. Revogar os grants padrão de `anon`, `authenticated` e `service_role` (`ALTER DEFAULT PRIVILEGES` + `REVOKE` nos objetos existentes)
3. Desligar a Data API, ou remover `public` dos schemas expostos
4. RLS habilitado em todas as tabelas, inclusive catálogo (defesa em profundidade)
5. Senha do `app_backend` via `scripts/provision-roles.sh`, lendo variável de ambiente

**Validado no Supabase (Fase A/B):** `SET LOCAL ROLE` funciona no pooler transaction
mode; a identidade não vaza entre transações; o provedor permite criar role com
`BYPASSRLS` (mantemos políticas explícitas mesmo assim).

**Nota:** testar conectividade com o pooler a partir de container Docker exige `--network host`.

---

## 8. Validação com usuários (V1)

**Agende com antecedência — depende de disponibilidade de terceiros.**

**Protocolo:**
1. Instância com dados demo (lotes abertos, fornecedores com histórico)
2. 3 participantes do perfil empreendedor local, sem familiaridade prévia com a plataforma
3. Tarefa: "Você quer aderir ao lote X. Reproduza manualmente o cálculo de rateio que o sistema mostra."
4. Registrar: conseguiu ou não, tempo gasto, pontos de confusão
5. Aplicar questionário SUS ao final (meta: ≥70)

**Critério do OE3:** ao menos 2 de 3 reproduzem o cálculo corretamente sem ajuda.

---

## 9. Pendências de decisão

### Com o orientador 🔶
| # | Questão | Impacto |
|---|---|---|
| 1 | A qual baseline o critério ≥15% do OE1 se refere? (`greedy_volume` ou `greedy_temporal`) | Determina se H2 é verificada |
| 2 | Quem pode criar lote: fornecedor dos próprios produtos, ou só admin? | E4 |
| 3 | Fechamento de lote automático com override manual? | E5 |
| 4 | Pagamento por `PedidoLote` com repasse por `Lote`? | E4, modelo de dados |

### Técnicas em aberto
- E6: quem calcula o hash encadeado se `app_service` só tem INSERT?
- `UPDATE` de `Comprador`: todas as colunas ou só as editáveis pelo próprio?
- `Avaliacao` verificada: ligar ao `PedidoLote` entregue? (muda o schema — decidir antes da E4)

---

## 10. Resultados do OE1 (v3)

30 instâncias pareadas, NSGA-II, `m=2`, RNG corrigido.

**Custo médio por comprador (R$):**

| n | kmeans_ga | ag_direto | greedy_volume | greedy_temporal | sem_consolidação |
|---|---|---|---|---|---|
| 10 | 1386,77 | 1418,77 | 1433,44 | 2064,10 | 2429,44 |
| 50 | 676,67 | 1039,79 | 693,24 | 1745,38 | 2440,58 |
| 200 | 628,27 | 710,11 | 609,73 | 1688,90 | 2440,80 |

**Redução do AG (diferença pareada):**

| n | vs greedy_volume | vs greedy_temporal | vs sem_consolidação |
|---|---|---|---|
| 10 | 3,3% | 32,8% | 42,9% |
| 50 | 2,4% | 61,2% | 72,3% |
| 200 | **−3,0%** | 62,8% | 74,3% |

**Leitura honesta:** o critério ≥15% **não** é atingido contra `greedy_volume` em
nenhuma instância. É atingido contra `greedy_temporal` e `sem_consolidação`. H1
(consolidar reduz frete) está sustentada. H2 deve ser escrita como parcialmente
verificada, com discussão do porquê (com custo fixo de despacho e capacidade
limitada, o problema se aproxima de empacotamento, onde um greedy já é forte).

**v1 e v2:** executadas antes da correção do bug de RNG do DEAP (os operadores
usavam o `random` global, não a instância seedada). São etapas superadas e **não
são reproduzíveis pela seed documentada**. Errata registrada em `PARAMETROS.md`.

### OE1 v3.1 — análise pendente
1. IC 95% (bootstrap) e Wilcoxon pareado por comparação e por `n`
2. Dominância de Pareto: algum ponto da fronteira do AG domina cada baseline?
3. Convergência do `ag_direto` com o dobro de gerações/população
4. Confirmar que o limiar do `greedy_volume` foi reajustado com o mesmo protocolo
5. Reajuste de `m` com NSGA-II (ngen=90), incluindo `m=1` e `m=1,5`
6. Gerações até a estagnação por instância
7. Sensibilidade do H1: custo fixo e capacidade em ±50%

---

## 11. Acréscimos pendentes ao texto do TCC

Consolidar em arquivo único quando solicitado. Não perder nenhum item.

- Nota metodológica v1/v2/v3 e errata do bug de RNG
- Bugs encontrados pelos próprios testes (GRANT sem `id`; ataque de tabela temporária)
- Premissas de parâmetros (`PARAMETROS.md`) e a ambiguidade do baseline do OE1
- Redação de H1 e H2 conforme o que foi medido
- Declaração de uso de IA ampliada (inclui Claude Code para desenvolvimento, não só revisão textual)
- Cronograma real vs. planejado
- Fila RabbitMQ na descrição da integração (o texto atual cita só REST)
- Entidades centrais vs. de suporte no OE2
- Pagamento com garantia modelado como fluxo, com gateway simulado
- Modelo de roles com `NOINHERIT` e teste com código de saída (capítulo de segurança)
- Achados de deploy do Supabase (grants padrão de `anon`/`authenticated`/`service_role`)

---

## 12. Comandos úteis

```bash
# Banco
docker ps                                    # confirmar tcc_postgres rodando
cd apps/backend && npx prisma migrate status # estado das migrations
npm run test:rls                             # testes de isolamento (0 = ok, != 0 = falha)

# Otimizador
cd services/optimizer && source .venv/bin/activate
python genetic_algorithm.py

# Trabalho paralelo (duas sessões sem conflito)
git worktree add ../tcc-oe1 -b feature/oe1-v31 dev
```
