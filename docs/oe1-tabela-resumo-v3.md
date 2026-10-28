# OE1 -- tabela resumo v3 (30 instancias pareadas por tamanho, NSGA-II)

m / limiar_fracao ajustados do zero nesta versao, com o RNG corrigido
(nao herdados da v2 -- ver ERRATA em PARAMETROS.md):

- n=10: m=2, limiar_fracao=0.5
- n=50: m=2, limiar_fracao=1.0
- n=200: m=2, limiar_fracao=1.0

Para kmeans_ga e ag_direto, cada execucao e o PONTO DE MENOR CUSTO da
fronteira de Pareto NSGA-II daquela execucao (regra fixada antes de
rodar) -- o tempo de espera reportado e o DESSE MESMO ponto, nao o
menor tempo de espera da fronteira. Fronteiras completas em
docs/oe1-pareto-v3.png.

## Custo medio por comprador (R$) -- 5 estrategias

| n | kmeans_ga | ag_direto | greedy_volume | greedy_temporal | sem_consolidacao |
|---|---|---|---|---|---|
| 10 | 1386.77 (dp 190.40) | 1418.77 (dp 184.94) | 1433.44 (dp 222.97) | 2064.10 (dp 260.67) | 2429.44 (dp 160.51) |
| 50 | 676.67 (dp 73.24) | 1039.79 (dp 53.98) | 693.24 (dp 68.00) | 1745.38 (dp 105.88) | 2440.58 (dp 70.31) |
| 200 | 628.27 (dp 36.42) | 710.11 (dp 28.11) | 609.73 (dp 32.55) | 1688.90 (dp 54.86) | 2440.80 (dp 34.30) |

## Tempo de espera medio por pedido (dias) -- 5 estrategias

| n | kmeans_ga | ag_direto | greedy_volume | greedy_temporal | sem_consolidacao |
|---|---|---|---|---|---|
| 10 | 2.02 (dp 0.66) | 1.89 (dp 0.73) | 1.91 (dp 0.65) | 0.13 (dp 0.11) | 0.00 (dp 0.00) |
| 50 | 9.55 (dp 0.92) | 3.98 (dp 0.72) | 8.96 (dp 0.95) | 0.31 (dp 0.09) | 0.00 (dp 0.00) |
| 200 | 38.03 (dp 1.51) | 30.53 (dp 2.64) | 12.66 (dp 0.80) | 0.35 (dp 0.04) | 0.00 (dp 0.00) |

## Reducao de custo de kmeans_ga vs cada baseline -- diferenca PAREADA (mesma instancia)

| n | vs greedy_volume | vs greedy_temporal | vs sem_consolidacao |
|---|---|---|---|
| 10 | 3.3% (delta medio 46.67, dp 93.57) | 32.8% (delta medio 677.33, dp 258.55) | 42.9% (delta medio 1042.67, dp 156.78) |
| 50 | 2.4% (delta medio 16.57, dp 22.18) | 61.2% (delta medio 1068.70, dp 97.61) | 72.3% (delta medio 1763.90, dp 24.22) |
| 200 | -3.0% (delta medio -18.54, dp 13.39) | 62.8% (delta medio 1060.63, dp 47.76) | 74.3% (delta medio 1812.53, dp 22.63) |
