# CLAUDE.md — Briefing de Desenvolvimento da Plataforma de Compras Coletivas

Este documento é o ponto de partida para o Claude Code. Cole-o na raiz do repositório
como `CLAUDE.md` (ele lê automaticamente) ou cole o conteúdo na primeira mensagem de
cada sessão de desenvolvimento.

---

## 1. Contexto do projeto

TCC de Ciência da Computação (UFJ). Plataforma full-stack de compras coletivas B2B
para mitigar o "Custo Norte" (barreiras logísticas amazônicas), com três pilares:
otimização algorítmica de lotes, transparência financeira multi-ator auditável, e
reputação meritocrática de fornecedores por análise de sentimento.

**A implementação precisa provar 4 hipóteses experimentalmente (OE1–OE4 abaixo).
Todo código deve ser escrito pensando em como vai gerar os dados que comprovam (ou
refutam) cada critério — não é só "fazer funcionar".**

---

## 2. Objetivos específicos — critérios de aceite exatos

Copie estes critérios literalmente. São o que a banca vai cobrar.

### OE1 — Otimização de lotes
- Framework de duas etapas: **K-Means** (agrupamento) + **Algoritmo Genético MDVRP** (roteamento)
- Implementado em **Python + DEAP**
- Instâncias sintéticas de **10, 50 e 200 compradores**
- Matrizes de custo com os **3 modais**: rodoviário, fluvial, aéreo (não só fluvial)
- Inclui sazonalidade fluvial e faixas tarifárias do aéreo expresso
- **Critério de sucesso: redução ≥15% no custo médio de frete por comprador vs. baseline greedy de limiar fixo**

### OE2 — Banco de dados
- PostgreSQL + **Prisma ORM**
- Entidades: `COMPRADOR`, `FORNECEDOR`, `PRODUTO`, `LOTE`, `PEDIDO_LOTE`, `HUB_LOGISTICO`, `AVALIACAO`
- **Row Level Security (RLS)** multi-ator ativado
- Transações **ACID** no cálculo de rateio
- **Critério de sucesso: tolerância zero a inconsistência em testes de integridade**

### OE3 — Interface e transparência
- **Next.js com SSR** (crítico: conexões lentas amazônicas)
- O comprador deve conseguir **reproduzir manualmente o cálculo de rateio** a partir do que a tela mostra
- **Critério de sucesso: teste de usabilidade com 3 empreendedores locais; ao menos 2 de 3 reproduzem o cálculo sem ajuda**

### OE4 — Reputação
- Sentimento via **Google Cloud Natural Language API**
- Índice composto = sentimento + 4 métricas operacionais (taxa de entrega no prazo, índice de reclamações, volume histórico, tempo médio de resposta)
- **Critério de sucesso: correlação de Pearson ≥0,6 entre índice e desempenho histórico objetivo em dados simulados**

---

## 3. Stack (já justificada no Referencial Teórico — não trocar sem atualizar o TCC)

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14+, React, TypeScript, Tailwind |
| Backend | NestJS, TypeScript, Prisma ORM |
| Microsserviço de otimização | Python, FastAPI, DEAP, scikit-learn (K-Means), NumPy/Pandas |
| Banco de dados | PostgreSQL 15+ (RLS ativado) |
| Fila de mensagens | RabbitMQ ou Celery (orquestrar chamadas ao microsserviço) |
| Hosting | Vercel (frontend), Railway (backend + microsserviço), Supabase (Postgres) |

---

## 4. Estrutura de repositório sugerida (monorepo)

```
/apps
  /web          → Next.js (OE3)
  /api          → NestJS (OE2, orquestração)
/services
  /optimizer    → FastAPI + DEAP (OE1)
/packages
  /database     → schema Prisma compartilhado
  /shared-types → tipos TS compartilhados entre web e api
docker-compose.yml
CLAUDE.md
```

Peça ao Claude Code para criar essa estrutura primeiro, com Docker Compose subindo
Postgres + os 3 serviços localmente antes de escrever qualquer lógica de negócio.

---

## 5. Ordem de implementação (mapeada ao Cronograma do TCC)

1. **Setup**: monorepo, Docker, variáveis de ambiente, CI básico
2. **OE2 primeiro**: schema Prisma completo com RLS, seeds de teste
3. **OE1**: microsserviço de otimização isolado, testável via `curl`/Postman antes de integrar
4. **Backend NestJS**: endpoints REST que consomem o microsserviço via fila
5. **OE3**: frontend consumindo os endpoints, com a tela de breakdown de rateio como prioridade #1 (é o que será testado com usuários)
6. **OE4**: módulo de reputação (pode rodar em paralelo ao frontend)
7. **Testes e validação**: escrever testes ao longo do processo, não só no fim — mas reservar tempo explícito para o teste de usabilidade com 3 pessoas

**Peça ao Claude Code para não pular a etapa 2** — schema errado quebra tudo depois.

---

## 6. Contrato de API mínimo (ponto de partida para o Claude Code refinar)

```
POST   /lotes                     → cria lote
POST   /lotes/:id/aderir          → comprador adere
GET    /lotes/:id/breakdown       → retorna cálculo de rateio auditável
POST   /lotes/:id/fechar          → dispara otimização (fila → microsserviço)
GET    /fornecedores/:id/reputacao → índice composto + componentes
POST   /avaliacoes                → nova avaliação (dispara análise de sentimento)

# Microsserviço (chamado pela fila, não exposto ao frontend)
POST   /optimize                  → recebe compradores + matriz de custo, retorna lotes otimizados
```

O endpoint `/breakdown` é o mais importante do projeto inteiro — é ele que prova
o OE3 (auditabilidade). Peça ao Claude Code para retornar o cálculo passo a passo
em JSON, não só o resultado final, para a interface conseguir exibir a conta aberta.

---

## 7. Instruções diretas para o Claude Code

Cole isto como primeira tarefa:

> Leia o CLAUDE.md deste repositório. Antes de escrever qualquer código, monte o
> Docker Compose com PostgreSQL, e crie o schema Prisma completo das 7 entidades
> listadas na seção 5 do OE2, com RLS. Depois disso, pare e me mostre o schema antes
> de continuar para o próximo passo.

Isso evita que ele avance rápido demais sem você validar as decisões de schema, que
são a base de tudo.

### 7.1 Política de Git (regra permanente)

Nunca faça push, abra PR ou mergeie sem pedido explícito; commits locais por
padrão.

---

## 8. ⚠️ O que precisa mudar no texto do TCC — leia antes de começar

Duas coisas no `projeto_ATUALIZADO.tex` vão ficar **desatualizadas ou incorretas**
assim que você começar a desenvolver com Claude Code. Resolva isso agora ou na
próxima revisão com o orientador:

### 8.1 — Declaração de uso de IA (Portaria CNPq) — **precisa mudar**

O texto atual (Seção "Declaração de Conformidade", Metodologia) diz:

> "...foi utilizado o modelo Claude (Anthropic) para **auxílio na revisão gramatical
> e coesão textual de seções selecionadas**."

Isso deixa de ser verdade no momento em que você usa Claude Code para **escrever
código de produção** (backend, frontend, microsserviço, schema). Revisão gramatical
e desenvolvimento de software são usos completamente diferentes, e a Portaria CNPq
exige que a declaração reflita o uso real, não um uso genérico.

**Sugestão de texto atualizado** (para você levar ao orientador):

> "Em conformidade com a Portaria CNPq nº 2.664/2026, declara-se que ferramentas de
> inteligência artificial generativa foram utilizadas no processo de elaboração deste
> trabalho em duas frentes distintas: (a) suporte à escrita acadêmica, revisão
> gramatical, coesão textual e estruturação bibliográfica do documento escrito; e
> (b) assistência ao desenvolvimento de software, incluindo geração e revisão de
> código-fonte, modelagem de banco de dados e depuração, sob supervisão e validação
> técnica constantes do autor. Especificamente, foi utilizado o modelo Claude
> (Anthropic), nas interfaces de chat e Claude Code. Todo o conteúdo intelectual —
> incluindo argumento, análise crítica, decisões arquiteturais, escolhas
> metodológicas e conclusões — é de responsabilidade exclusiva do autor, com
> supervisão do orientador Prof. Me. Thomaz Felipe Soares Arnizant."

Isso é mais defensável na banca do que deixar a declaração antiga, que ficaria
factualmente incompleta assim que o código começar a existir.

### 8.2 — Cronograma — confira a data de início

O Cronograma (Capítulo 3) prevê:
- Ago/2026: preparação de ambiente + modelagem do schema
- Set/2026: módulo de otimização

Hoje é 21/set/2026. Se a preparação de ambiente (Ago) ainda não foi feita, ela está
absorvida dentro do que vamos começar agora — o que empurra o restante das fases em
~3–4 semanas. Não é um problema grave, mas **avise o orientador** que o cronograma
real pode deslizar um pouco em relação ao datado no TCC2, e ajuste as datas na
próxima revisão do documento em vez de deixar desalinhado até a defesa.

---

## 9. Checklist antes de abrir o Claude Code

- [ ] Repositório Git criado (mesmo que vazio)
- [ ] Conta Supabase, Railway e Vercel criadas (mesmo que só o free tier)
- [ ] Chave da Google Cloud Natural Language API obtida (OE4 depende dela)
- [ ] Este `CLAUDE.md` colado na raiz do projeto
- [ ] Declaração de IA do TCC atualizada (seção 8.1 acima) — combine com o orientador
- [ ] Ciente do possível deslize de cronograma (seção 8.2)
