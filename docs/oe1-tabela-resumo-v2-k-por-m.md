# OE1 -- tabela resumo -- v2, k = ceil(m * volume/capacidade) (30 execucoes por celula)

m e limiar_fracao (greedy_volume) escolhidos por ajuste em seeds separadas das de avaliacao -- ver docs/oe1-tabela-ajuste-v2.md para todos os valores testados. m escolhido por instancia:

- n=10: m=2, limiar_fracao=0.5
- n=50: m=2, limiar_fracao=1.0
- n=200: m=3, limiar_fracao=1.0

## Custo medio por comprador (R$) e reducao % vs cada baseline

| n | kmeans_ga | ag_direto | greedy_volume | greedy_temporal | AG vs volume | AG vs temporal | ag_direto vs volume | ag_direto vs temporal |
|---|---|---|---|---|---|---|---|---|
| 10 | 1552.90 (dp 0.00) | 1552.90 (dp 0.00) | 1552.90 (dp 0.00) | 1792.90 (dp 0.00) | 0.0% | 13.4% | 0.0% | 13.4% |
| 50 | 756.22 (dp 0.00) | 1028.56 (dp 43.86) | 784.85 (dp 0.00) | 1928.85 (dp 0.00) | 3.6% | 60.8% | -31.1% | 46.7% |
| 200 | 617.63 (dp 8.53) | 704.26 (dp 8.87) | 611.56 (dp 0.00) | 1719.56 (dp 0.00) | -1.0% | 64.1% | -15.2% | 59.0% |

## Tempo de espera medio por pedido (dias)

| n | kmeans_ga | ag_direto | greedy_volume | greedy_temporal |
|---|---|---|---|---|
| 10 | 1.20 (dp 0.00) | 1.20 (dp 0.00) | 1.20 (dp 0.00) | 0.30 (dp 0.00) |
| 50 | 10.06 (dp 0.00) | 7.53 (dp 0.54) | 8.80 (dp 0.00) | 0.32 (dp 0.00) |
| 200 | 39.03 (dp 1.25) | 35.88 (dp 1.27) | 13.07 (dp 0.00) | 0.31 (dp 0.00) |
