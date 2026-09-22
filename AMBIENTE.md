# AMBIENTE.md — Preparação Completa do Ecossistema

Documento prescritivo. Siga na ordem. Cada fase tem um checklist — não avance para a
próxima fase sem fechar a anterior. Isso evita descobrir um problema de configuração
no meio do desenvolvimento, quando já é mais caro corrigir.

---

## FASE 0 — Contas e acessos (antes de instalar qualquer coisa)

Crie estas contas agora, mesmo que não use ainda. Todas têm tier gratuito suficiente
para o TCC.

| Serviço | Para quê | Link |
|---|---|---|
| GitHub | Hospedar o repositório | github.com |
| Vercel | Deploy do frontend (Next.js) | vercel.com |
| Railway | Deploy do backend e microsserviço | railway.app |
| Supabase | PostgreSQL gerenciado em produção | supabase.com |
| Google Cloud | Natural Language API (OE4) | console.cloud.google.com |

**Checklist Fase 0:**
- [ ] Conta GitHub criada (ou já existente — `github.com/joaolmpv`, já vi no seu perfil)
- [ ] Conta Vercel criada, conectada ao GitHub
- [ ] Conta Railway criada, conectada ao GitHub
- [ ] Conta Supabase criada
- [ ] Projeto criado no Google Cloud Console + API "Cloud Natural Language" ativada
- [ ] Chave JSON de credencial do Google Cloud baixada (guarde, não vai usar ainda)

---

## FASE 1 — Ferramentas locais (instalar no Fedora)

Você já usa Fedora, então:

```bash
# Node.js (via nvm, para controlar versão)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Python 3.11+
sudo dnf install python3 python3-pip python3-virtualenv -y

# Docker
sudo dnf install docker docker-compose -y
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# depois disso, faça logout/login para o grupo docker valer

# Git (provavelmente já tem)
sudo dnf install git -y
git config --global user.name "João de Lima Paiva"
git config --global user.email "joaolimapaiva5@gmail.com"

# Claude Code
npm install -g @anthropic-ai/claude-code
```

**Checklist Fase 1:**
- [ ] `node --version` retorna v20.x
- [ ] `python3 --version` retorna 3.11 ou superior
- [ ] `docker --version` funciona sem `sudo`
- [ ] `docker compose version` funciona
- [ ] `git config --global user.name` mostra seu nome corretamente
- [ ] `claude --version` funciona

---

## FASE 2 — Criação do repositório Git

### Nome do repositório

**`compras-coletivas-amazonia`**

Justificativa: descreve o produto (compras coletivas) e o contexto (Amazônia) sem
depender do nome "TCC", que fica datado quando você for reusar isso no portfólio
depois de formado. Evite nomes genéricos como `tcc2` ou `projeto-final`.

Se preferir manter rastreável ao TCC, alternativa aceitável: `tcc-compras-coletivas`.

### Criar no GitHub

1. github.com → New repository
2. Nome: `compras-coletivas-amazonia`
3. Descrição: "Plataforma full-stack de compras coletivas B2B para mitigação de barreiras logísticas na Amazônia Legal — TCC, Ciência da Computação, UFJ"
4. **Privado** (dados de teste, ainda em desenvolvimento — pode abrir depois da defesa)
5. Marque "Add a README file"
6. `.gitignore` template: **Node**
7. License: pode deixar sem por enquanto (decide depois se for abrir o código)

### Clonar localmente

```bash
git clone git@github.com:joaolmpv/compras-coletivas-amazonia.git
cd compras-coletivas-amazonia
```

### Conteúdo inicial do README.md

Substitua o README gerado automaticamente por:

```markdown
# Compras Coletivas Amazônia

Plataforma full-stack de compras coletivas B2B para mitigação de barreiras
logísticas e econômicas em regiões periféricas da Amazônia Legal.

Trabalho de Conclusão de Curso — Bacharelado em Ciência da Computação,
Universidade Federal de Jataí (UFJ).

**Autor:** João de Lima Paiva
**Orientador:** Prof. Me. Thomaz Felipe Soares Arnizant

## Stack
- Frontend: Next.js 14 (React, TypeScript, Tailwind)
- Backend: NestJS (TypeScript, Prisma ORM)
- Otimização: Python (FastAPI, DEAP, scikit-learn)
- Banco de dados: PostgreSQL 15 (Row Level Security)

## Setup local
Veja `SETUP.md`.

## Status
Em desenvolvimento — TCC2, defesa prevista para dezembro/2026.
```

**Checklist Fase 2:**
- [ ] Repositório criado no GitHub com o nome definido
- [ ] Repositório clonado localmente
- [ ] README.md substituído pelo conteúdo acima
- [ ] Primeiro commit feito (`git add . && git commit -m "docs: readme inicial" && git push`)

---

## FASE 3 — Estrutura de pastas e arquivos base

Dentro da pasta clonada, crie a estrutura completa de uma vez:

```bash
mkdir -p apps/web apps/api services/optimizer packages/database packages/shared-types
mkdir -p .github/workflows
touch .env.example
touch CLAUDE.md SETUP.md AMBIENTE.md
```

Coloque nos respectivos lugares os arquivos que já foram gerados nesta conversa:

| Arquivo | Vai para |
|---|---|
| `CLAUDE.md` | raiz do repositório |
| `SETUP.md` | raiz do repositório |
| `AMBIENTE.md` (este arquivo) | raiz do repositório |
| `docker-compose.yml` | raiz do repositório |
| `.env.example` | raiz do repositório |

Depois, adicione ao `.gitignore` (o template Node do GitHub já cobre boa parte, mas confirme que tem):

```gitignore
.env
node_modules/
venv/
__pycache__/
.next/
*.pyc
credentials/
```

**Nunca** commite o arquivo `.env` real nem a chave JSON do Google Cloud. Crie uma
pasta `credentials/` na raiz (já coberta pelo `.gitignore` acima) e coloque a chave
baixada na Fase 0 lá dentro, referenciada pela variável `GOOGLE_APPLICATION_CREDENTIALS`
no `.env`.

**Checklist Fase 3:**
- [ ] Estrutura de pastas criada (`apps/`, `services/`, `packages/`)
- [ ] Os 5 arquivos de configuração na raiz
- [ ] `.gitignore` atualizado com as 6 linhas acima
- [ ] Pasta `credentials/` criada com a chave do Google Cloud dentro
- [ ] `.env` criado localmente a partir do `.env.example` (não commitado)
- [ ] Commit feito: `git add . && git commit -m "chore: estrutura inicial do monorepo"`

---

## FASE 4 — Estratégia de branches e commits

Para um projeto solo de TCC, não precisa de fluxo complexo, mas vale disciplina
mínima — a banca pode pedir para ver o histórico de commits como evidência de
desenvolvimento incremental (é comum perguntarem isso na defesa).

**Branches:**
- `main` — sempre estável, o que está rodando/testado
- `dev` — trabalho em andamento, integra as features
- `feature/nome-da-parte` — uma branch por objetivo específico, ex.: `feature/oe1-otimizacao`, `feature/oe2-schema`, `feature/oe3-frontend`

```bash
git checkout -b dev
git push -u origin dev
git checkout -b feature/oe2-schema
```

**Convenção de commits** (padrão Conventional Commits, fácil de justificar na defesa):
- `feat:` nova funcionalidade
- `fix:` correção de bug
- `docs:` documentação
- `test:` testes
- `chore:` configuração, dependências

Exemplo: `feat(oe1): implementa clustering K-Means para agrupamento de pedidos`

**Checklist Fase 4:**
- [ ] Branch `dev` criada e enviada ao GitHub
- [ ] Primeira `feature/` branch criada (comece pela Fase 2 do fluxo: `feature/oe2-schema`)
- [ ] Entendeu a convenção de commits (não precisa decorar, só ser consistente)

---

## FASE 5 — Subir o ambiente e conectar o Claude Code

```bash
docker compose up --build
```

Depois, dentro da pasta do repositório:

```bash
claude
```

Cole como primeira mensagem ao Claude Code exatamente a instrução da Seção 7 do
`CLAUDE.md` (o briefing do projeto), para ele ler o contexto antes de escrever
qualquer código.

**Checklist Fase 5 (igual ao checklist do `SETUP.md`, repetido aqui para fechar o ciclo):**
- [ ] `http://localhost:3000` responde
- [ ] `http://localhost:3001` responde
- [ ] `http://localhost:8000/docs` abre
- [ ] `http://localhost:15672` abre (RabbitMQ)
- [ ] Postgres aceita conexão via `docker compose exec postgres psql -U compras -d compras_coletivas`
- [ ] Claude Code aberto dentro da pasta do repositório, com o `CLAUDE.md` colado como primeira instrução

---

## Resumo — ordem de execução

```
FASE 0  → Contas (GitHub, Vercel, Railway, Supabase, Google Cloud)
FASE 1  → Instalar Node, Python, Docker, Git, Claude Code
FASE 2  → Criar repositório "compras-coletivas-amazonia" + README
FASE 3  → Estrutura de pastas + arquivos de configuração + .gitignore
FASE 4  → Branches (main/dev/feature) + convenção de commits
FASE 5  → docker compose up + abrir Claude Code + colar briefing
         ↓
   (a partir daqui, segue o fluxo de desenvolvimento já definido:
    OE2 → OE1 → Backend → OE3 → OE4 → Testes)
```

Só depois de fechar todos os checklists das 5 fases é que você entra no fluxo de
implementação propriamente dito (o que já está detalhado em `CLAUDE.md` e `SETUP.md`).
