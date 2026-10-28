# Parâmetros do experimento OE1 — fonte ou premissa

Todo parâmetro usado em `custo.py` e `instancias.py` está listado aqui. Nenhum
valor com impacto no resultado foi inventado silenciosamente: ou tem fonte
citável, ou está marcado como premissa (e por quê é uma premissa razoável).

## Histórico de versões — o que mudou entre v1, v2 e v3

| | v1 | v2 | v3 (referência final) |
|---|---|---|---|
| Granularidade do K-Means | `k_por_grupo=4` fixo | `k = ceil(m·vol/cap)`, `m` ajustado em `{2,3,4,6,8}` | mesma regra, `m` **re-ajustado do zero** (v2 não é confiável — ver ERRATA) |
| Instância por tamanho | 1 fixa, reusada em 30 runs do AG | 1 fixa (mesma) | **30 instâncias distintas** por tamanho, comparação pareada |
| Estratégias | kmeans_ga, greedy_volume, greedy_temporal | + ag_direto (controle sem K-Means) | + sem_consolidacao (5 estratégias) |
| Fitness do AG | mono-objetivo (custo) | mono-objetivo (custo) | **multiobjetivo (custo + espera) via NSGA-II**, fronteira de Pareto reportada |
| Tempo de espera | não medido | medido, não otimizado pelo AG | medido para as 5 estratégias; o AG pode otimizá-lo via NSGA-II (ver fronteira), mas a tabela comparativa usa o ponto de menor custo |
| `GA_GERACOES` | 60 | 60 | 90 (60 não estabilizava em todos os casos — ver verificação de convergência) |
| Bug de seed (RNG global do DEAP) | presente, não detectado | presente, não detectado | **corrigido** — única versão com reprodutibilidade de seed verificada (`teste_reprodutibilidade.py`) |
| Critério OE1 (≥15%) vs `greedy_volume` | não atingido (0.0%, -0.3%, -18.4%) | não atingido (0.0%, 3.6%, -1.0%) | não atingido (3.3%, 2.4%, -3.0%) |
| Critério OE1 (≥15%) vs `greedy_temporal` | parcial (13.4%, 59.2%, 57.9% — falha n=10) | parcial (13.4%, 60.8%, 64.1% — falha n=10) | **atingido nas três** (32.8%, 61.2%, 62.8%) |

v1 e v2 continuam no histórico do git (commits `435a2ed` e `6ea746b`) como
etapas da iteração — não foram apagadas nem re-executadas. v3 é a versão que
deve ser citada no TCC como resultado do OE1.

## ERRATA — bug de seed em v1 e v2 (corrigido na v3)

**O que foi afetado**: `_rodar_ga` (v1/v2) e a primeira versão de
`_rodar_ga_nsga2` (v3, antes da correção) semeavam apenas a geração inicial da
população com uma instância local de `random.Random(seed)`. Os operadores do
DEAP efetivamente usados na busca —`tools.cxTwoPoint` (crossover),
`tools.mutUniformInt` (mutação), `tools.selTournament`/`selNSGA2`/
`selTournamentDCD` (seleção) — chamam o módulo `random` **global** do Python
internamente; eles não aceitam uma instância de RNG separada. Como
consequência, o crossover, a mutação e a seleção — ou seja, a maior parte do
que o AG realmente faz a cada geração — dependiam do estado global do
`random` no momento da chamada (que depende da ordem de execução do processo),
não da `seed` documentada.

**O que isso significa na prática**: os valores de custo e tempo de espera
reportados em v1 e v2 (incluindo o `m` escolhido no ajuste da v2) são
execuções reais que de fato aconteceram — não foram inventados — mas **não
são reproduzíveis executando o mesmo script com a mesma seed novamente**; uma
nova execução com "a mesma seed" pode (e na prática deu, ao gerar a v3)
produzir um número diferente, porque a seed nunca controlou o processo
inteiro como a documentação de v1/v2 afirmava. As tendências qualitativas
reportadas (AG perdendo para `greedy_volume`, custo piorando
monotonicamente com `m`, gap grande de tempo de espera) vieram de muitas
execuções estocásticas reais e são plausivelmente robustas, mas os valores
pontuais específicos de v1/v2 não têm a garantia de reprodutibilidade que foi
documentada para eles.

**O que foi corrigido na v3**: `random.seed(seed)` e `np.random.seed(seed)`
são chamados no início de cada execução do AG (mono e multiobjetivo),
semeando o módulo global antes de qualquer chamada aos operadores do DEAP.
Verificado: mesma seed + mesma instância + mesmo `m` → resultado byte-a-byte
idêntico em chamadas repetidas (ver também o teste automatizado
`teste_reprodutibilidade.py`, que verifica isso entre PROCESSOS separados,
não só dentro do mesmo processo Python).

**v1 e v2 permanecem no histórico do git como estavam, sem re-execução** —
são etapas supersedidas da iteração, não a referência final. **A v3 é a
referência reprodutível do OE1.** O ajuste de `m` e dos limiares do
`greedy_volume` foi refeito do zero na v3 com o RNG corrigido (não herdado da
v2 — o valor de `m` escolhido na v2 não é confiável, pelo motivo acima).

## Custo por modal

| Parâmetro | Valor | Status | Fonte / justificativa |
|---|---|---|---|
| Rodoviário — R$/tonelada-km | 0,620 | **Fonte** | [ILOS — Preços de Frete Rodoviário no Brasil](https://ilos.com.br/artigos-precos-de-frete-rodoviario-no-brasil/): caminhão baú, carga geral, ago/2026. Usamos o valor de carga geral (não siderúrgica R$0,513 nem graneleiro R$0,347) por ser o mais próximo do perfil de carga B2B deste TCC. |
| Fluvial — R$/tonelada-km | 0,970 | **Fonte (fornecida pelo autor)** | Valor de referência do TCC, repassado pelo usuário nesta tarefa. |
| Fluvial — multiplicador sazonal (cheia) | 1,0 | Premissa | Nível de água normal/alto adotado como baseline (sem sobretaxa). |
| Fluvial — multiplicador sazonal (seca) | 1,35 | Premissa (ordem de grandeza com fonte) | Reportagens sobre a seca histórica de 2023–2024 no Amazonas registram reajustes de frete de **25% a 50%** sobre o valor normal ([d24am — Impactos da seca histórica no Amazonas afetam logística e comércio exterior](https://d24am.com/amazonas/impactos-da-seca-historica-no-amazonas-afetam-logistica-e-comercio-exterior/)). Adotamos 1,35 (ponto médio da faixa) como premissa conservadora — não o cenário extremo de +147% citado em casos de calado crítico ([Portos e Navios — Quando o rio baixa, o custo sobe](https://www.portosenavios.com.br/artigos/artigos-de-opiniao/artigo-quando-o-rio-baixa-o-custo-para-todos-sobe)), para não inflar artificialmente a vantagem do algoritmo. |
| Aéreo expresso — até 50 kg | R$ 70/kg | **Fonte (fornecida pelo autor)** | Limite superior da faixa do TCC repassada pelo usuário. |
| Aéreo expresso — 50 a 200 kg | R$ 50/kg | Premissa | Ponto intermediário da faixa R$30–70/kg, assumindo desconto por volume em faixas intermediárias (estrutura de tarifa aérea expressa típica — cobrança decrescente por faixa de peso). |
| Aéreo expresso — acima de 200 kg | R$ 30/kg | **Fonte (fornecida pelo autor)** | Limite inferior da faixa do TCC repassada pelo usuário. |
| Aéreo expresso — capacidade máx. por lote | 500 kg | Premissa | Limite prático assumido para carga aérea expressa regional (não cotado no TCC); sem este limite o modal aéreo nunca seria eliminado por capacidade, o que não reflete a realidade operacional. |
| Custo fixo de despacho por hub (Manaus/Santarém/Belém) | R$ 1800 / 2400 / 2000 | Premissa (herdada do protótipo original) | Mesmos valores simulados já presentes em `genetic_algorithm.py` desde a versão anterior do protótipo — mantidos para não introduzir uma nova variável sem fonte adicional. Aplicado a rodoviário e fluvial; aéreo expresso não soma custo fixo porque a tarifa por kg já é "porta a porta" (prática comum de courier aéreo). |
| Distância hub → ponto de consolidação (km) | Manaus 80 / Santarém 850 / Belém 1300 | Premissa | Ordem de grandeza da geografia real da bacia amazônica (Manaus mais próxima do hub de consolidação simulado; Belém e Santarém mais distantes), **não é uma cotação de distância navegável exata** — o TCC não fornece essas distâncias, e o conjunto de hubs em si já é simulado desde a versão original do protótipo. |

## Geração de instâncias

| Parâmetro | Valor | Status | Fonte / justificativa |
|---|---|---|---|
| Tamanhos de instância | 10, 50, 200 compradores | **Fonte** | Critério de aceite exato do OE1 (CLAUDE.md §2). |
| Seed de geração por instância | `10`, `50`, `200` (= o próprio tamanho da instância) | Decisão de design | Fixa e documentada — garante que a mesma instância (mesmos pedidos) seja usada nas 30 execuções de cada estratégia, isolando a variável que o experimento mede (desempenho do algoritmo) da variável que ele não mede (composição da instância). |
| Densidade de carga (kg/m³) | 250, com ruído uniforme ±15% por pedido | Premissa | Densidade média assumida para carga geral paletizada B2B — não há fonte no TCC para peso dos pedidos (o protótipo original só usava volume_m3); o ruído evita que peso seja uma função determinística exata do volume. |
| Período sazonal do pedido (cheia/seca) | 50% / 50% | Premissa | Simplificação — o TCC não especifica a proporção real de pedidos em cada período; 50/50 evita favorecer artificialmente um cenário sazonal sobre o outro. |
| Dia de chegada do pedido (para a baseline de limiar temporal) | uniforme em `[0, max(10, n/2))` | Premissa | Atributo novo, necessário para simular ordem cronológica de chegada (o protótipo original não tinha "quando o pedido chegou", só "janela de entrega"). Horizonte escala com `n` para manter densidade de chegada comparável entre instâncias de tamanhos diferentes. |

## Estratégias de referência (baselines)

| Parâmetro | Valor | Status |
|---|---|---|
| Limiar de volume fixo (greedy por volume) | = capacidade do hub (`capacidade_m3`) | Reaproveita o mesmo parâmetro de capacidade já usado no modelo de custo, em vez de inventar um segundo limiar sem relação com o resto do modelo. |
| Limiar temporal fixo (fechamento por tempo) | 3 dias | Premissa — período de consolidação "ingênuo" razoável para comparação; não foi ajustado para produzir um resultado específico. |

## v2 — regra de granularidade do K-Means (decidida antes de rodar)

Na v1, `k_por_grupo` (número de clusters do K-Means por grupo hub×período)
era fixo em 4, herdado sem alteração do protótipo original. O resultado da
v1 mostrou o AG perdendo para `greedy_volume` nas três instâncias (ver
`docs/oe1-tabela-resumo-v1-k-fixo-4.md`) porque, em instâncias maiores, 4
clusters por grupo ficam grosseiros demais (4 a 16 pedidos por cluster em
n=200) para o AG fracionar e competir com um empacotamento pedido-a-pedido.

**Primeira tentativa de regra (descartada antes de rodar a avaliação final)**:
`k_grupo = ceil(volume_total_do_grupo / capacidade_do_hub)` — essa é o número
mínimo teórico de lotes de capacidade cheia para escoar o grupo. Testamos
numericamente nas três instâncias antes de adotar: o resultado é **menor ou
igual** ao `k=4` fixo da v1 em todos os grupos (ex.: k=1 em quase todo grupo
de n=10/50) — ou seja, pioraria a granularidade, não corrigiria. A leitura
alternativa ("capacidade do modal" = capacidade do aéreo expresso, a menor
dos três) faz o k exceder o número de pedidos do grupo em todos os casos,
degenerando o K-Means para 1 pedido por cluster nas três instâncias — o que
esvaziaria a etapa de agrupamento do OE1. Nenhuma das duas foi adotada.

**Regra final adotada para v2** (introduz `m`, o número médio de clusters
por lote que o AG pode recombinar):

```
k_grupo = min(len(pedidos_do_grupo), ceil(m * volume_total_do_grupo_m3 / capacidade_m3_do_hub))
```

`volume_total/capacidade` continua sendo o piso físico (nº mínimo de lotes);
multiplicar por `m` dá ao AG, em média, `m` clusters por lote para recombinar
-- com `m=1` o AG não teria nenhuma liberdade (cada cluster já seria um
lote). `m` não foi fixado a priori: foi escolhido por ajuste (protocolo
abaixo), varrendo `M_CANDIDATOS = [2, 3, 4, 6, 8]` em seeds de ajuste
DISJUNTAS das `N_RUNS` seeds de avaliação (`OFFSET_SEED_AJUSTE` vs
`OFFSET_SEED_AVALIACAO` em `parametros.py`), critério fixado antes de rodar:
menor custo médio por comprador no conjunto de ajuste. `greedy_volume`
recebeu o mesmo orçamento de ajuste, varrendo o limiar de fechamento como
fração da capacidade do hub (`LIMIAR_VOLUME_FRACOES_CANDIDATAS = [0.5, 0.6,
0.75, 0.9, 1.0]`) nas mesmas seeds de ajuste (determinístico, então cada
fração só precisa ser avaliada uma vez).

A tabela completa de ajuste (todos os `m` e `limiar_fracao` testados, não só
o escolhido) está em `docs/oe1-tabela-ajuste-v2.md`.

**Resultado do ajuste — contra-intuitivo e reportado como saiu**: o `m`
escolhido foi sempre o menor ou um dos menores do conjunto testado (m=2 em
n=10/50, m=3 em n=200) — custo médio por comprador cresce monotonicamente de
m=2 para m=8 nas três instâncias. Ou seja, mais liberdade de recombinação
para o AG piorou o resultado, não melhorou — o oposto da hipótese que
motivou a regra. Isso é consistente com o controle `ag_direto` (AG sem
K-Means, granularidade máxima = 1 pedido por "cluster"): ele também perde
para `kmeans_ga` em n=50/200. A explicação mais provável, registrada aqui em
vez de usada para justificar outra rodada de ajuste: os hiperparâmetros do
AG (`pop=80, ngen=60`, não retunados -- ver seção abaixo) não escalam com o
tamanho do espaço de busca; genomas maiores (mais clusters, ou um por
pedido) ficam mais difíceis de otimizar no mesmo orçamento computacional, e
isso pesa mais do que o ganho teórico de granularidade.

**Nota de escopo (não corrigida, sinalizada por transparência)**: o ajuste de
`m` na v3 reusa `tuning.ajustar_m`, que roda o núcleo MONO-objetivo
(`estrategia_kmeans_ga`, `GA_GERACOES=60`) para escolher `m` — não o núcleo
NSGA-II (`GA_GERACOES_V3=90`) usado na avaliação final. O `m` escolhido
provavelmente não seria diferente (as margens entre `m=2` e os demais
candidatos são grandes e consistentes em todas as instâncias — ver tabela de
ajuste), mas tecnicamente é um algoritmo e orçamento diferentes do que é
realmente avaliado. Não foi corrigido nesta rodada; fica registrado como
limitação conhecida, não como algo verificado.

Esta regra e o conjunto `M_CANDIDATOS`/`LIMIAR_VOLUME_FRACOES_CANDIDATAS`
foram escritos e commitados ANTES de rodar o experimento v2 -- não foram
ajustados depois de ver o resultado final para "bater" o critério de 15%. O
resultado completo (custo e tempo de espera, quatro estratégias) está em
`docs/oe1-tabela-resumo-v2-k-por-m.md`, sem alteração posterior, mesmo
ficando abaixo de 15% contra `greedy_volume`.

## v3 — verificação de convergência

Critério de estabilização fixado antes de checar: variação do custo mínimo da
população entre a geração `GA_GERACOES-10` e `GA_GERACOES-1` menor que 1%.
Com `GA_GERACOES=60` (valor de v1/v2), `n=50, m=4` não estabilizava (2.47%).
Testado com 90 gerações: estabiliza (0.61%). `GA_GERACOES_V3=90` foi fixado
para a v3 (ver `parametros.py` — `GA_GERACOES` original de v1/v2 foi mantido
intocado para não quebrar a reprodutibilidade daquelas duas, apesar da
ERRATA acima sobre o bug de seed). Reverificado depois da correção do bug de
seed, já com o `m` realmente escolhido na v3 (m=2 nas três instâncias): 0.000%
de variação nas últimas 10 gerações nas três — estabilizado com folga.

## v2 — controle: AG direto (sem K-Means)

Adicionada uma quarta estratégia, `ag_direto`: o AG roda direto sobre os
pedidos, cada pedido como seu próprio "cluster" de tamanho 1 -- sem nenhuma
etapa de K-Means. Serve para isolar o que o K-Means de fato contribui (ver
resultado contra-intuitivo acima: `ag_direto` teve desempenho pior que
`kmeans_ga`, não melhor).

## v2 — tempo de espera

Cada pedido ganhou um atributo novo, `dia_chegada` (dia simulado em que o
pedido foi feito -- não existia na v1, necessária para medir esperas e para
a baseline `greedy_temporal`). Tempo de espera de um pedido =
`dia_despacho_do_lote - dia_chegada`, onde `dia_despacho_do_lote =
max(dia_chegada)` dos pedidos daquele lote -- definição aplicada igualmente
às quatro estratégias. O AG (ambas as variantes) não tem nenhum termo de
tempo na função de fitness -- só minimiza custo -- então não há razão a
priori para esperar que ele controle o tempo de espera, e o resultado
medido confirma isso (ver tabela resumo): o AG produz esperas médias muito
maiores que as duas baselines.

## O que **não** foi alterado para favorecer o resultado

Os hiperparâmetros do Algoritmo Genético (`pop=80, ngen=60, cxpb=0.6, mutpb=0.3,
tournsize=3`) são os mesmos do protótipo original (`genetic_algorithm.py`) e
**não foram retunados** durante este experimento, conforme instrução explícita
de não ajustar parâmetros para atingir o critério de sucesso do OE1.
