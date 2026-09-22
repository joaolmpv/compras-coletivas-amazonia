# ESTRUTURA.md — Árvore Final Consolidada

Este documento substitui a estrutura genérica proposta em `AMBIENTE.md` (que foi
escrita antes de eu ver o que já existia no GitHub). A partir de agora, **esta é a
estrutura oficial** — qualquer documento anterior que conflite com isto está
desatualizado.

---

## Por que mudou em relação ao `AMBIENTE.md` original

| Proposto antes | Realidade encontrada | Decisão |
|---|---|---|
| `apps/web`, `apps/api` | Scaffold local já criado como `apps/frontend`, `apps/backend` | **Mantém os nomes que já existem** — renomear geraria retrabalho sem ganho real |
| `services/optimizer` (vazio) | GitHub já tem `optimization/` **funcionando** (K-Means + GA testado) | Migra o conteúdo real para `services/optimizer/`, não o contrário |
| `packages/database` (schema compartilhado) | GitHub já tem `database/` com schema Prisma + seed, usando **SQLite** | Schema vira fonte única dentro de `apps/backend/prisma/` (ver justificativa abaixo) |
| — | Entidades em inglês (`Buyer`, `Supplier`, `Hub`, `Lot`, `Participation`) | **Renomear para português**, batendo com o TCC (ver seção "Decisão de nomenclatura") |

### Por que abandonar `packages/database` como pacote separado

Manter o schema em um pacote `packages/database` só compensa em times grandes com
múltiplos consumidores do mesmo schema. Para um TCC solo, isso é complexidade
desnecessária — o schema mora direto em `apps/backend/prisma/schema.prisma`, e o
microsserviço Python (`services/optimizer`) recebe os dados que precisa via API, não
lendo o banco diretamente. Mais simples de manter, mais fácil de explicar na defesa.

### Decisão de nomenclatura: português, batendo com o TCC

O schema atual no GitHub usa `Buyer`, `Supplier`, `Hub`, `Lot`, `Participation`. O
TCC (texto escrito, OE2) especifica `COMPRADOR`, `FORNECEDOR`, `PRODUTO`, `LOTE`,
`PEDIDO_LOTE`, `HUB_LOGISTICO`, `AVALIACAO`. Isso é uma inconsistência que **vai
aparecer** se alguém da banca abrir o repositório e comparar com o texto.

**Decisão:** renomear as entidades do Prisma para os nomes em português do TCC.
Convenção: nome do model em `PascalCase` (padrão Prisma/TypeScript), mas idêntico
semanticamente ao termo do texto — `Comprador`, `Fornecedor`, `Produto`, `Lote`,
`PedidoLote`, `HubLogistico`, `Avaliacao`. Isso resolve a rastreabilidade
texto↔código sem violar convenção de código.

---

## Árvore final

```
compras-coletivas-amazonia/
├── apps/
│   ├── frontend/                  → Next.js (OE3) — já scaffoldado
│   └── backend/                   → NestJS (OE2, orquestração) — já scaffoldado
│       └── prisma/
│           ├── schema.prisma      → schema único, fonte da verdade (migrado de database/)
│           └── migrations/
├── services/
│   └── optimizer/                 → FastAPI + DEAP (OE1) — migrado de optimization/
├── docs/
│   └── screenshots/                → já existe, mantém
├── docker-compose.yml              → Postgres + RabbitMQ + os 3 serviços
├── .env.example
├── .gitignore
├── README.md                       → precisa atualização (seção própria abaixo)
├── AMBIENTE.md                     → histórico, mantido por rastreabilidade
├── ESTRUTURA.md                    → este arquivo
└── CLAUDE.md                       → briefing para o Claude Code, atualizado
```

**O que deixa de existir na raiz** (conteúdo migra para dentro de `apps/` e `services/`):
- `optimization/` → vira `services/optimizer/`
- `database/` → conteúdo do schema migra para `apps/backend/prisma/`, pasta é removida

---

## Checklist de nada ficar para trás

Isto cobre tudo que já foi identificado nesta conversa, para nenhum ponto sumir:

- [ ] `optimization/` migrado para `services/optimizer/`, testado, rodando
- [ ] `database/` schema migrado para `apps/backend/prisma/schema.prisma`
- [ ] Entidades renomeadas para português (`Comprador`, `Fornecedor`, `Lote`, `PedidoLote`, `HubLogistico`)
- [ ] **2 entidades que faltavam adicionadas**: `Produto`, `Avaliacao`
- [ ] Banco migrado de **SQLite → PostgreSQL** (SQLite não suporta RLS)
- [ ] **Row Level Security implementado** (ausente até agora — exigido pelo OE2 escrito)
- [ ] Custos do algoritmo de otimização trocados de genéricos para os **3 modais reais** (rodoviário, fluvial, aéreo) documentados no TCC
- [ ] Algoritmo rodando nas **3 instâncias exigidas**: 10, 50 e 200 compradores (hoje só roda com 60)
- [ ] `README.md` atualizado (conteúdo abaixo) — estrutura, status por OE, e diário de desenvolvimento
- [ ] Pasta local `~/plataforma-tcc` descartada depois da migração (evitar dois repositórios divergentes)
- [ ] Repositório único: `compras-coletivas-amazonia` no GitHub
