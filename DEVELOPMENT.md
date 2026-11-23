# DEVELOPMENT.md — Roteiro de Desenvolvimento

> **Leia este arquivo no início de cada sessão.** Ele é a fonte de verdade sobre
> o que fazer, em que ordem e sob quais regras. Para detalhe de arquitetura,
> consulte `docs/design-backend.md`.

**Projeto:** Plataforma full-stack de compras coletivas B2B para a Amazônia Legal
**Autor:** João de Lima Paiva — Bacharelado em Ciência da Computação, UFJ
**Orientador:** Prof. Me. Thomaz Felipe Soares Arnizant
**Defesa:** dezembro/2026
**Última atualização:** 12/11/2026 — inclui as decisões D-A (limiar adaptativo) e D-B (formação de lote por casamento)

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
11. **Nomes de entidades no código acompanham o texto do TCC** (PascalCase, em português): `IntencaoCompra`, `DisponibilidadeFornecedor` etc.
12. **Divisão schema.prisma vs. SQL puro na migration:** o que o Prisma consegue representar (FK simples ou composta, `@@unique`, índice comum) fica declarado em `schema.prisma`, usando `map:` com o nome exato já criado no banco quando a constraint foi aplicada por SQL puro primeiro — nunca deixado "invisível" só porque dava mais trabalho modelar. RLS, trigger, `CHECK` e índice parcial não são expressáveis no Prisma e ficam só no SQL da migration — essa é a única divisão aceita. `npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --shadow-database-url <descartável> --exit-code` roda ao final de toda etapa, junto com `npm run test:rls` — código de saída 0 é obrigatório antes de considerar a etapa pronta (achado real: a FK composta de `DisponibilidadeFornecedor` ficou só em SQL puro na E3/revisão da E4 e isso gerava divergência — corrigido modelando a FK no schema com `map:` pros nomes já existentes, sem tocar no banco).

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
Framework de duas etapas (K-Means + AG variante MDVRP capacitado) em Python com
DEAP. Instâncias de 10, 50 e 200 compradores. Matrizes de custo com os **três
modais** (rodoviário, fluvial, aéreo), com sazonalidade fluvial e faixas do aéreo
expresso (tarifa de referência fluvial R$0,97/t-km). O algoritmo escolhe o modal de
menor custo por rota. Aptidão multiobjetivo (custo + tempo de espera) com NSGA-II.

**Decisão D-A (12/11/2026) — limiar adaptativo:** o limiar de fechamento é variável
de decisão do AG, por **segmento** (rota × região × categoria de produto), e não
parâmetro fixo. Um lote do segmento fecha quando o volume acumulado atinge o limiar
do segmento, quando a janela logística se encerra ou quando o prazo máximo do
fornecedor é atingido — o que vier primeiro —, respeitando a quantidade mínima e
máxima declaradas pelo fornecedor. A avaliação considera o custo marginal de esperar.

**Critério (redação proposta, levar ao orientador):** H2 verificada se o AG com
limiar adaptativo reduzir ≥15% o custo médio por comprador em relação a **cada**
política fixa — volume fixo e temporal fixo, cada uma com parâmetro único calibrado
em seeds de ajuste disjuntas e aplicado uniformemente a todas as rotas —, nas três
escalas, medido no ponto da fronteira de Pareto com **tempo de espera igual ou
inferior** ao da política comparada. H1 verificada se o AG tiver custo
significativamente menor que "sem consolidação".

⚠️ **Não enfraquecer o baseline:** as políticas fixas são a **melhor** configuração
uniforme calibrada, nunca um valor arbitrário. Comparar com um limiar fixo ruim seria
um espantalho.

### OE2 — Banco de dados
PostgreSQL + Prisma. Entidades centrais: `Comprador`, `Fornecedor`, `Produto`, `Lote`,
`PedidoLote`, `HubLogistico`, `Avaliacao`, **`IntencaoCompra`** e
**`DisponibilidadeFornecedor`** (as duas últimas criadas nas etapas E3/E4, decisão D-B).
Entidades de suporte: `Usuario`, `SessaoRefreshToken`, `Pagamento`, `Repasse`,
`LogAuditoria`. RLS multi-ator e transações ACID.
**Critério:** tolerância zero a inconsistência em testes de integridade.

### OE3 — Interface e transparência
Next.js com SSR. O comprador deve conseguir reproduzir manualmente o cálculo de
rateio a partir do que a tela exibe.
**Critério:** teste de usabilidade com 3 empreendedores locais; ao menos 2 de 3 reproduzem o cálculo sem ajuda.

### OE4 — Reputação
Sentimento via Google Cloud Natural Language API + 4 métricas operacionais (taxa de
entrega no prazo, índice de reclamações, volume histórico, tempo médio de resposta).
O índice também ordena a notificação de fornecedores no casamento (D-B).
**Critério:** correlação de Pearson ≥0,6 entre o índice e o desempenho histórico objetivo.

---

## 3. Mapa de etapas

| Etapa | Escopo | Status |
|---|---|---|
| **OE1 v1/v2/v3** | Experimentos do otimizador | ✅ Concluída |
| **OE1 v4** | Limiar adaptativo (D-A) + análise estatística (absorve a antiga v3.1) | ⬜ Pendente |
| **Design backend** | `docs/design-backend.md` (12 decisões + seção 13 com D-A/D-B) | ✅ Concluída |
| **E1** | Migrations, RLS, roles, testes de isolamento | ✅ Concluída (mergeada) |
| **E2** | Identidade e autenticação | ✅ Concluída (branch `feature/be-e2-auth`, aguardando aprovação/merge) |
| **E3** | Catálogo + `DisponibilidadeFornecedor` | ✅ Concluída (branch `feature/be-e3-catalogo`) |
| **E4** | `IntencaoCompra`, lote `CANDIDATO`, confirmação do fornecedor, adesão, rateio, pagamento | 🔄 Em andamento (branch `feature/be-e4-lotes` — avaliação verificada feita; falta `IntencaoCompra`, estado `CANDIDATO`, confirmação do fornecedor, adesão/rateio, breakdown, pagamento) |
| **E5** | Otimizador por fila + job de casamento + fechamento adaptativo | ⬜ Pendente |
| **E6** | Auditoria com hash encadeado | ⬜ Pendente |
| **E7** | SSE e rate limiting | ⬜ Pendente |
| **F1** | Frontend — comprador (intenção, lotes, breakdown) | ⬜ Pendente |
| **F2** | Frontend — fornecedor (disponibilidade, confirmação de oferta) | ⬜ Pendente |
| **F3** | Frontend — administrador | ⬜ Pendente |
| **OE4** | Módulo de reputação | ⬜ Pendente |
| **D1** | Deploy e provisionamento Supabase | ⬜ Pendente |
| **V1** | Teste de usabilidade (3 empreendedores) | ⬜ Pendente — **agendar com antecedência** |
| **T1** | Texto do TCC: aplicar `ACRESCIMOS_TCC2.tex` e preencher Resultados | 🔄 Entregue ao autor, aplicação manual |

---

## 4. Backend — etapas detalhadas

Cada etapa: branch própria a partir da `dev`, commits locais, parar ao final.

### E1 — Migrations e RLS ✅

**Entregue:** 7 entidades centrais + 5 de suporte; RLS multi-ator; roles
`app_backend` (NOINHERIT), `app_comprador`, `app_service`, `app_definer`, `app_auth`, `app_fornecedor` (criado na E3, simétrico a `app_comprador` — identidade de fornecedor autenticado);
`fn_breakdown_lote` (SECURITY DEFINER, fail-closed, restrita a participantes);
GRANT por coluna em `PedidoLote` e `Avaliacao`; `LogAuditoria` append-only com
trigger de TRUNCATE; `npm run test:rls` com 38 casos e código de saída correto.

**Achados registrados:** bug do GRANT sem a coluna `id` (o `@default(cuid())` do
Prisma é gerado no client); ataque de tabela temporária neutralizado pelo
`search_path = public, pg_temp`.

### E2 — Identidade e autenticação 🔄

**Branch:** `feature/be-e2-auth` — **não é afetada por D-A nem D-B.**

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

### E3 — Catálogo e disponibilidade do fornecedor

**Branch:** `feature/be-e3-catalogo`

**Escopo:**
- Módulos de `Fornecedor`, `Produto` e `HubLogistico`, com DTOs Zod, paginação e códigos de erro padronizados
- **Nova entidade `DisponibilidadeFornecedor` (D-B):** por produto, o fornecedor declara quantidade mínima de despacho, quantidade máxima disponível, hubs atendidos, prazo máximo de espera aceito e vigência
- Mostrar o schema proposto e aguardar aprovação antes da migration

**Critérios:** CRUD completo com validação; fornecedor só edita os próprios
produtos e a própria disponibilidade (RLS + teste via role real); mínimo ≤ máximo
garantido no banco (CHECK); testes de integração por endpoint.

### E4 — Intenção, lote candidato, adesão, rateio e pagamento

**Branch:** `feature/be-e4-lotes`

**Decisão técnica no início da etapa (mostrar proposta, aguardar aprovação):**
`Avaliacao` verificada — proposta: `Avaliacao.pedidoLoteId` único, permitida só
após `ENTREGUE` (robustez contra avaliação manipulada, OE4).

**Escopo:**
- **Nova entidade `IntencaoCompra` (D-B):** comprador registra produto, quantidade, hub de destino e prazo máximo, sem compromisso financeiro; RLS: comprador só vê as próprias
- **Estado `CANDIDATO`** no enum `StatusLote` (e `ENTREGUE`, se ainda não existir)
- Fluxo de confirmação: lote `CANDIDATO` → fornecedor confirma preço e limites → `ABERTO`; recusa ou expiração → `CANCELADO`
- Adesão do comprador (`PedidoLote`), convertendo intenções compatíveis
- Cálculo de rateio proporcional em transação ACID
- Endpoint de breakdown auditável (via `fn_breakdown_lote`)
- Máquina de estados (`CANDIDATO` → `ABERTO` → `FECHADO` → `DESPACHADO` → `ENTREGUE`, com `CANCELADO` a partir de `CANDIDATO`/`ABERTO`)
- Pagamento por `PedidoLote` + `Repasse` por `Lote`, com gateway simulado

**Critérios:**
- O breakdown devolve totais + própria linha identificada + demais anonimizadas, em dados suficientes para refazer a conta
- Rateio nunca deixa o banco inconsistente (teste de concorrência)
- Lote nunca abre acima da quantidade máxima nem fecha abaixo da mínima do fornecedor
- `app_service` recebe os GRANTs desta etapa, com teste via role real
- Transições inválidas de estado são rejeitadas

### E5 — Otimizador, casamento e fechamento adaptativo

**Branch:** `feature/be-e5-otimizacao`

**Escopo:**
- Cliente RabbitMQ no NestJS; consumidor `aio-pika` no FastAPI; idempotência por chave; DLQ e retry; versão do algoritmo gravada em cada execução; manter REST do FastAPI (`/optimize`, `/health`, OpenAPI)
- **Job de casamento (D-B):** agrega `IntencaoCompra` por produto/região; quando a demanda alcança a mínima de alguma `DisponibilidadeFornecedor` dentro da janela, cria lote `CANDIDATO` e notifica fornecedores aptos (ordem pelo índice de reputação quando o OE4 existir; antes disso, ordem documentada e determinística)
- **Fechamento adaptativo (D-A):** o otimizador decide o fechamento com o limiar do segmento; override manual do admin registrado na auditoria

**Critérios:** mensagem duplicada não reprocessa; falha do otimizador não trava o
lote; a versão do algoritmo é rastreável por execução; o job de casamento não cria
dois lotes candidatos para a mesma demanda (teste de concorrência).

### E6 — Auditoria

**Branch:** `feature/be-e6-auditoria`

**Escopo:** log append-only com hash encadeado, sob advisory lock, integrado às
escritas financeiras e de lotes, às transições de estado (incluindo `CANDIDATO`) e
aos eventos de autenticação.

**Pergunta em aberto:** quem calcula o hash encadeado, se `app_service` só tem
INSERT? (Proposta: trigger `BEFORE INSERT` que calcula o hash, com leitura dada
só ao dono — impede o serviço de forjar a cadeia.)

**Critérios:** `UPDATE`, `DELETE` e `TRUNCATE` bloqueados; adulteração de um
registro quebra a verificação da cadeia; contenção do advisory lock medida.

### E7 — Tempo real e rate limiting

**Branch:** `feature/be-e7-realtime`

**Escopo:** SSE do estado dos lotes (cookie httpOnly, conexão direta ao NestJS),
incluindo a notificação de lote candidato ao fornecedor; rate limiting conforme a
tabela da seção 12 do design.

**Limites:** global 100/min/IP; login 5/min/IP+email com backoff; refresh 10/min;
adesão 20/min/usuário; intenção de compra 20/min/usuário; otimização 3/min/admin
com dedup; avaliação 10/h/usuário; 3 conexões SSE/usuário.

---

## 5. Frontend — etapas detalhadas

Next.js com SSR (crítico: conexões de baixa largura de banda na região Norte).
Contrato de tipos gerado a partir do OpenAPI do NestJS (`@nestjs/swagger` +
`openapi-typescript`), não um pacote `packages/shared-types` mantido à mão.
Pode começar com mocks assim que a E2 definir o contrato.

### F1 — Comprador

**Prioridade máxima:** a tela de breakdown é o que será testado com usuários (OE3).

**Telas:** registro de intenção de compra; dashboard de lotes ativos (data de
fechamento, participantes, economia vs. frete individual); convite de adesão a lote
aberto compatível com a intenção; detalhes do lote com breakdown completo de custos;
acompanhamento de status de entrega; perfil e histórico.

**Critério do breakdown:** o comprador precisa ver o custo total de frete, o volume
total do lote, o próprio volume e a fórmula — dados suficientes para refazer a conta
no papel.

### F2 — Fornecedor

**Telas:** declaração de disponibilidade por produto (mínimo, máximo, hubs, prazo,
vigência); lotes candidatos aguardando confirmação (volume potencial, prazo para
responder, botão confirmar/recusar com preço e limites); ofertas ativas com status;
minha reputação (índice composto com componentes explicitados); histórico de repasses.

### F3 — Administrador

**Telas:** dashboard de saúde (taxa de consolidação, economia média, usuários ativos,
lotes processados, intenções sem atendimento por região); gestão de hubs; resolução de
disputas; override de fechamento de lote.

---

## 6. OE4 — Módulo de reputação

**Branch:** `feature/oe4-reputacao`

**Escopo:**
- Integração com a Google Cloud Natural Language API (suporte nativo a pt-BR)
- Índice composto: score de sentimento + taxa de entrega no prazo + índice de reclamações + volume histórico + tempo médio de resposta
- Extração de dimensões qualitativas: pontualidade, qualidade do produto, embalagem, atendimento pós-venda
- Detecção de padrões de insatisfação recorrente (alerta preventivo antes de a média cair)
- Ranking público com critérios de composição explicitados
- Integração com o job de casamento (E5): ordem de notificação dos fornecedores aptos

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

**Validado no Supabase em 29/10/2026 (projeto de teste descartável):**
- `postgres` do Supabase: `rolsuper=false`, `rolcreaterole=true`, `rolbypassrls=true`
- `CREATE ROLE ... BYPASSRLS` permitido (mantemos políticas explícitas mesmo assim)
- `ALTER FUNCTION ... OWNER TO` funcionou com os dois GRANTs do item 1
- `anon`/`authenticated`/`service_role` recebem todos os privilégios por padrão em tabelas e funções de `public` (via `pg_default_acl`); `REVOKE FROM PUBLIC` não os remove
- Pooler transaction mode (6543): sem `SET ROLE` → `permission denied`; com `SET LOCAL ROLE` + `app.comprador_id` → RLS filtra e `SECURITY DEFINER` funciona; após commit, a identidade não vaza

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

## 9. Decisões

### Definidas em 12/11/2026
| ID | Decisão | Etapas afetadas |
|---|---|---|
| D-A | Limiar de fechamento adaptativo por segmento (rota × região × categoria), variável de decisão do AG | OE1 v4, E5 |
| D-B | Formação de lote por casamento: `IntencaoCompra` + `DisponibilidadeFornecedor` + estado `CANDIDATO` + confirmação do fornecedor | E3, E4, E5, F1, F2, OE4 |
| — | Pagamento por `PedidoLote` + `Repasse` por `Lote`, gateway simulado | E4 |
| — | Fechamento automático (agora adaptativo) com override manual do admin | E5 |

### Informar ao orientador (não bloqueiam o desenvolvimento)
- D-A e D-B como evolução do escopo
- Correção CVRP → MDVRP capacitado no texto
- Declaração de IA ampliada
- **Redação do critério de H2** (custo com espera igual ou inferior, contra cada política fixa calibrada) — esta muda texto de objetivo aprovado: aguardar o aval antes de aplicar no TCC
- Cronograma revisado

### Técnicas em aberto
- E6: quem calcula o hash encadeado se `app_service` só tem INSERT?
- `UPDATE` de `Comprador`: todas as colunas ou só as editáveis pelo próprio?
- `Avaliacao` verificada (decidir no início da E4)
- D-A: granularidade dos segmentos e codificação do limiar no cromossomo (definir em `PARAMETROS.md` **antes** de rodar a v4)

---

## 10. OE1 — resultados e próxima iteração

### Resultados da v3
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

**Leitura honesta:** o critério ≥15% não é atingido contra `greedy_volume`. As
reduções contra `greedy_temporal` foram medidas no ponto de menor custo, com espera de
até 38 dias em n=200 — não são ganho equivalente. H1 está sustentada.

**v1 e v2:** executadas antes da correção do bug de RNG do DEAP. Não são
reproduzíveis pela seed documentada. Errata em `PARAMETROS.md`.

### OE1 v4 — limiar adaptativo (D-A) + análise estatística
**Branch:** `feature/oe1-v4` (pode rodar em worktree paralela à trilha do backend)

**Antes de rodar (escrever em `PARAMETROS.md` e parar para aprovação):**
- Definição de segmento (rota × região × categoria de produto) e como o limiar entra no cromossomo
- Limites do fornecedor e janelas sazonais simulados por segmento, com fonte ou marcados como premissa
- Regra de seleção do ponto da fronteira: o de espera igual ou inferior à da política comparada

**Protocolo:**
1. Estratégias: (a) AG com limiar adaptativo; (b) volume fixo; (c) temporal fixo; (d) sem consolidação; (e) AG sem agrupamento (ablação)
2. (b) e (c): parâmetro único calibrado nas seeds de ajuste, aplicado igual a todas as rotas
3. 30 instâncias pareadas por porte (10/50/200), seeds de avaliação disjuntas
4. Métricas: custo médio por comprador, tempo médio de espera, gerações até estagnação, desvio-padrão
5. Estatística: IC 95% (bootstrap) e Wilcoxon pareado, por comparação e por n; % de instâncias em que o AG vence
6. Pareto: dominância sobre cada baseline e custo com espera igualada
7. Convergência da variante (e) com o dobro de gerações/população
8. Sensibilidade do H1: custo fixo de despacho e capacidade em ±50%
9. Reanalisar a v3 com os itens 5–6 (registro histórico)

**Proibido:** ajustar granularidade de segmento, regra de fechamento ou parâmetros
depois de ver resultados de avaliação. Reportar como sair.

---

## 11. Texto do TCC

Os acréscimos foram consolidados em **`ACRESCIMOS_TCC2.tex`** (12/11/2026, 17 blocos,
com local e ação de cada um). A aplicação no Overleaf é feita pelo autor. Blocos 04 e
06 dependem do aval do orientador.

**Pendentes de preenchimento após execução (marcados [PREENCHER] no Bloco 16):**
resultados da v4; testes de concorrência da E4; teste de usabilidade (OE3);
correlação e robustez do OE4.

Novos itens que surgirem durante o desenvolvimento entram aqui, para a próxima rodada:
- **Avaliação verificada (E4):** vínculo obrigatório com o `PedidoLote` (FK
  única); validação de elegibilidade estrutural no banco (trigger
  `fn_avaliacao_requer_entregue`, não só checagem na aplicação); caso de
  falha do fornecedor (`FORNECEDOR_NAO_DESPACHOU`) libera avaliação mesmo
  com o lote `CANCELADO` — recusar ou demorar pra confirmar (lote ainda
  `CANDIDATO`) não libera, entram no OE4 pela métrica de tempo de resposta.
- **Novo role `app_fornecedor` (E3):** identidade de fornecedor autenticado
  no Postgres, simétrica a `app_comprador` — não estava no desenho
  original de 5 roles da E1.
- **Bugs reais encontrados pelos próprios testes:**
  - E2: `app_auth` sem `SELECT` em `Comprador`/`Fornecedor`, exigido pelo
    `RETURNING` implícito do `.create()` do Prisma mesmo em operação só de
    escrita; revogação de família de refresh token sendo desfeita pelo
    `ROLLBACK` da própria transação da requisição (corrigida com uma
    transação independente).
  - E3: RLS em `Fornecedor` sem política de `INSERT` quebrando o cadastro
    feito por `app_auth`; `AuthModule` não reexportava `JwtModule`, e por
    isso `JwtAuthGuard` não resolvia sua dependência (`JwtService`) fora
    do próprio módulo.

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
git worktree add ../tcc-oe1 -b feature/oe1-v4 dev
```
