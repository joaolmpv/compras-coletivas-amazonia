# Parâmetros do experimento OE1 — fonte ou premissa

Todo parâmetro usado em `custo.py` e `instancias.py` está listado aqui. Nenhum
valor com impacto no resultado foi inventado silenciosamente: ou tem fonte
citável, ou está marcado como premissa (e por quê é uma premissa razoável).

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

Esta regra e o conjunto `M_CANDIDATOS`/`LIMIAR_VOLUME_FRACOES_CANDIDATAS`
foram escritos e commitados ANTES de rodar o experimento v2 -- não foram
ajustados depois de ver o resultado final para "bater" o critério de 15%. O
resultado completo (custo e tempo de espera, quatro estratégias) está em
`docs/oe1-tabela-resumo-v2-k-por-m.md`, sem alteração posterior, mesmo
ficando abaixo de 15% contra `greedy_volume`.

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
