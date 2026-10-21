# OE1 -- tabela resumo -- v1, k_por_grupo=4 fixo (30 execucoes por celula)

Primeira iteracao do experimento: numero de clusters do K-Means fixo em 4 por
grupo (hub x periodo), independente do volume do grupo -- o mesmo valor
herdado sem alteracao do prototipo original (`genetic_algorithm.py`).
Criterio do OE1 (reducao >= 15% nas tres instancias) **nao atingido** contra
`greedy_volume`; atingido parcialmente contra `greedy_temporal` (falha em
n=10). Ver v2 para a correcao de granularidade do K-Means derivada por
principio (PARAMETROS.md).

| n compradores | AG (R$/comprador) | Greedy volume (R$/comprador) | Greedy temporal (R$/comprador) | Reducao AG vs volume | Reducao AG vs temporal |
|---|---|---|---|---|---|
| 10 | 1552.90 (dp 0.00) | 1552.90 (dp 0.00) | 1792.90 (dp 0.00) | 0.0% | 13.4% |
| 50 | 787.23 (dp 27.48) | 784.85 (dp 0.00) | 1928.85 (dp 0.00) | -0.3% | 59.2% |
| 200 | 723.84 (dp 0.02) | 611.56 (dp 0.00) | 1719.56 (dp 0.00) | -18.4% | 57.9% |
