# OE1 -- tabela completa de ajuste (v2)

Seeds de ajuste disjuntas das seeds de avaliacao (ver parametros.py, OFFSET_SEED_AJUSTE vs OFFSET_SEED_AVALIACAO). Critério de escolha: menor custo médio por comprador nas seeds de ajuste. Todos os valores testados estão listados -- nenhum foi omitido.

## kmeans_ga -- varredura de m (media de 10 seeds de ajuste)

| n | m | custo médio/comprador (ajuste) | escolhido |
|---|---|---|---|
| 10 | 2 | 1552.90 | **sim** |
| 10 | 3 | 1552.90 |  |
| 10 | 4 | 1552.90 |  |
| 10 | 6 | 1552.90 |  |
| 10 | 8 | 1552.90 |  |
| 50 | 2 | 756.22 | **sim** |
| 50 | 3 | 759.08 |  |
| 50 | 4 | 797.86 |  |
| 50 | 6 | 892.39 |  |
| 50 | 8 | 947.25 |  |
| 200 | 2 | 620.78 |  |
| 200 | 3 | 614.72 | **sim** |
| 200 | 4 | 630.22 |  |
| 200 | 6 | 664.50 |  |
| 200 | 8 | 681.24 |  |

## greedy_volume -- varredura de limiar_fracao (deterministico, 1 avaliação por valor)

| n | limiar_fracao | custo médio/comprador | escolhido |
|---|---|---|---|
| 10 | 0.5 | 1552.90 | **sim** |
| 10 | 0.6 | 1552.90 |  |
| 10 | 0.75 | 1552.90 |  |
| 10 | 0.9 | 1552.90 |  |
| 10 | 1.0 | 1552.90 |  |
| 50 | 0.5 | 1080.85 |  |
| 50 | 0.6 | 996.85 |  |
| 50 | 0.75 | 868.85 |  |
| 50 | 0.9 | 868.85 |  |
| 50 | 1.0 | 784.85 | **sim** |
| 200 | 0.5 | 828.56 |  |
| 200 | 0.6 | 757.56 |  |
| 200 | 0.75 | 683.56 |  |
| 200 | 0.9 | 633.56 |  |
| 200 | 1.0 | 611.56 | **sim** |
